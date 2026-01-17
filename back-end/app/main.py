import base64
import json
import os
import re
import shutil
import httpx
from datetime import date, datetime, timedelta
from pathlib import Path
from uuid import UUID, uuid4
from urllib.parse import urlencode

from fastapi import Depends, FastAPI, File, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, RedirectResponse
from sqlalchemy import func, or_, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from . import auth, database, models, schemas

app = FastAPI()

BASE_DIR = Path(__file__).resolve().parent.parent
UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR") or (BASE_DIR / "uploads")).resolve()
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# Libera chamadas do front (localhost/127.0.0.1:3000).
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Cria tabelas.
models.Base.metadata.create_all(bind=database.engine)
# Garante coluna de ownership para ambientes sem migracao.
try:
    with database.engine.begin() as conn:
        conn.execute(text("ALTER TABLE patients ADD COLUMN IF NOT EXISTS owner_user_id UUID"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_patients_owner_user_id ON patients (owner_user_id)"))
        conn.execute(text("ALTER TABLE appointments ADD COLUMN IF NOT EXISTS meeting_url VARCHAR"))
        conn.execute(text("ALTER TABLE appointments ADD COLUMN IF NOT EXISTS calendar_event_id VARCHAR"))
        conn.execute(
            text(
                "CREATE INDEX IF NOT EXISTS ix_appointments_calendar_event_id "
                "ON appointments (calendar_event_id)"
            )
        )
except Exception:
    # Em bancos sem suporte ao comando, falhar silenciosamente para nao travar o app.
    pass


def get_db():
    db = database.SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_request_user(db: Session, x_user_id: str | None):
    """
    Valida o usuario vindo do cabecalho X-User-Id.
    """
    if not x_user_id:
        raise HTTPException(status_code=401, detail="Usuario nao identificado")
    try:
        user_id = UUID(x_user_id)
    except ValueError as exc:  # noqa: B904
        raise HTTPException(status_code=400, detail="Usuario invalido") from exc

    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario nao encontrado")
    return user


def generate_patient_username(db: Session, cpf: str) -> str:
    """
    Monta username derivado do CPF e garante unicidade.
    """
    cpf_digits = re.sub(r"\D", "", cpf)
    base_username = f"pac_{cpf_digits or 'user'}"
    candidate = base_username
    suffix = 1
    while db.query(models.User).filter(models.User.username == candidate).first():
        candidate = f"{base_username}_{suffix}"
        suffix += 1
    return candidate


def normalize_identity_fields(full_name: str, cpf: str, phone: str, email: str):
    """
    Normaliza campos principais para evitar inconsistencias (espacos, mascara, etc).
    """
    return {
        "full_name": full_name.strip(),
        "cpf": re.sub(r"\D", "", cpf),
        "phone": re.sub(r"\D", "", phone),
        "email": email.strip(),
    }


def integrity_error_message(exc: IntegrityError) -> str:
    """
    Retorna mensagem mais amigavel com base no erro do Postgres.
    """
    orig = getattr(exc, "orig", None)
    diag = getattr(orig, "diag", None)
    constraint = getattr(diag, "constraint_name", "") or ""
    primary = getattr(diag, "message_primary", "") or ""
    detail = getattr(diag, "detail", "") or ""
    text = f"{primary} {detail}".strip()

    constraint_lower = constraint.lower()
    if "cpf" in constraint_lower:
        return "CPF ja cadastrado"
    if "email" in constraint_lower:
        return "Email ja cadastrado"
    if "username" in constraint_lower:
        return "Nome de usuario ja existe"
    if text:
        return text
    return "Erro ao salvar cadastro (registro duplicado ou dados invalidos)."


def normalize_address(address: schemas.Address | None):
    """
    Retorna um dicionario com campos de endereco. Usa string vazia
    para evitar violar colunas NOT NULL no banco (ex.: address_street).
    """
    if not address:
        return {
            "street": "",
            "number": "",
            "complement": "",
            "district": "",
            "city": "",
            "state": "",
            "zip_code": "",
        }
    return {
        "street": address.street or "",
        "number": address.number or "",
        "complement": address.complement or "",
        "district": address.district or "",
        "city": address.city or "",
        "state": address.state or "",
        "zip_code": address.zip_code or "",
    }


def serialize_document(doc: models.PatientDocument):
    """
    Transforma um PatientDocument em dict pronto para resposta.
    """
    return {
        "id": str(doc.id),
        "patient_id": str(doc.patient_id),
        "original_name": doc.original_name,
        "content_type": doc.content_type,
        "size": doc.size,
        "download_url": f"/patients/{doc.patient_id}/documents/{doc.id}",
        "created_at": doc.created_at,
    }


def serialize_user(user: models.User):
    """
    Transforma um User em dict pronto para resposta ao front.
    """
    return {
        "id": str(user.id),
        "full_name": user.full_name,
        "username": user.username,
        "cpf": user.cpf,
        "phone": user.phone or "",
        "email": user.email,
        "account_type": user.account_type,
        "address": {
            "street": user.address_street or "",
            "number": user.address_number or "",
            "complement": user.address_complement or "",
            "district": user.address_district or "",
            "city": user.address_city or "",
            "state": user.address_state or "",
            "zip_code": user.address_zip or "",
        },
        "created_at": user.created_at.isoformat() if user.created_at else None,
    }


def serialize_patient(patient: models.Patient):
    """
    Transforma um Patient em dict pronto para resposta ao front.
    """
    return {
        "id": str(patient.id),
        "full_name": patient.full_name,
        "username": "",
        "account_type": "Paciente",
        "cpf": patient.cpf,
        "email": patient.email,
        "phone": patient.phone or "",
        "address": {
            "street": patient.address_street or "",
            "number": patient.address_number or "",
            "complement": patient.address_complement or "",
            "district": patient.address_district or "",
            "city": patient.address_city or "",
            "state": patient.address_state or "",
            "zip_code": patient.address_zip or "",
        },
        "created_at": patient.created_at.isoformat() if patient.created_at else None,
    }


def serialize_appointment(appointment: models.Appointment, patient_name: str):
    """
    Transforma um Appointment em dict pronto para resposta ao front.
    """
    return {
        "id": str(appointment.id),
        "patient_id": str(appointment.patient_id),
        "patient_name": patient_name,
        "starts_at": appointment.starts_at.isoformat(),
        "ends_at": appointment.ends_at.isoformat(),
        "type": appointment.type,
        "room": appointment.room or "",
        "notes": appointment.notes or "",
        "meeting_url": appointment.meeting_url or "",
        "status": appointment.status,
        "created_at": appointment.created_at.isoformat() if appointment.created_at else None,
    }


GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GMAIL_SEND_SCOPE = "https://www.googleapis.com/auth/gmail.send"
CALENDAR_EVENTS_SCOPE = "https://www.googleapis.com/auth/calendar.events"
GOOGLE_OAUTH_SCOPES = [GMAIL_SEND_SCOPE, CALENDAR_EVENTS_SCOPE]
GMAIL_SEND_URL = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send"
GOOGLE_CALENDAR_EVENTS_URL = "https://www.googleapis.com/calendar/v3/calendars/{calendar_id}/events"


def load_google_client_credentials():
    client_id = os.getenv("GOOGLE_CLIENT_ID")
    client_secret = os.getenv("GOOGLE_CLIENT_SECRET")
    secret_path = os.getenv("GOOGLE_CLIENT_SECRET_PATH")
    if (not client_id or not client_secret) and secret_path:
        path = Path(secret_path)
        if not path.is_absolute():
            path = BASE_DIR / secret_path
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except FileNotFoundError as exc:
            raise HTTPException(
                status_code=500,
                detail=f"Arquivo Google OAuth nao encontrado: {path}",
            ) from exc
        except json.JSONDecodeError as exc:
            raise HTTPException(
                status_code=500,
                detail="JSON do Google OAuth invalido",
            ) from exc
        web = data.get("web") or data.get("installed") or {}
        client_id = client_id or web.get("client_id")
        client_secret = client_secret or web.get("client_secret")
    return client_id, client_secret


def require_google_client_credentials():
    client_id, client_secret = load_google_client_credentials()
    missing = []
    if not client_id:
        missing.append("GOOGLE_CLIENT_ID")
    if not client_secret:
        missing.append("GOOGLE_CLIENT_SECRET")
    if missing:
        missing_list = ", ".join(missing)
        raise HTTPException(status_code=500, detail=f"Config Google OAuth ausente: {missing_list}")
    return client_id, client_secret


def require_google_oauth_config():
    client_id, client_secret = require_google_client_credentials()
    redirect_uri = os.getenv("GOOGLE_REDIRECT_URI")
    missing = []
    if not redirect_uri:
        missing.append("GOOGLE_REDIRECT_URI")
    if missing:
        missing_list = ", ".join(missing)
        raise HTTPException(status_code=500, detail=f"Config Google OAuth ausente: {missing_list}")
    return client_id, client_secret, redirect_uri


def get_google_oauth_scopes() -> str:
    return " ".join(scope for scope in GOOGLE_OAUTH_SCOPES if scope)


def build_google_auth_url(client_id: str, redirect_uri: str) -> str:
    query = urlencode(
        {
            "client_id": client_id,
            "redirect_uri": redirect_uri,
            "response_type": "code",
            "access_type": "offline",
            "prompt": "consent",
            "scope": get_google_oauth_scopes(),
        }
    )
    return f"{GOOGLE_AUTH_URL}?{query}"


def request_google_token(payload: dict) -> dict:
    try:
        response = httpx.post(GOOGLE_TOKEN_URL, data=payload, timeout=15)
    except httpx.HTTPError as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail="Falha ao falar com Google OAuth") from exc
    if response.status_code >= 400:
        detail = "Falha ao obter token do Google"
        try:
            payload = response.json()
            detail = payload.get("error_description") or payload.get("error") or detail
        except ValueError:
            pass
        raise HTTPException(status_code=400, detail=detail)
    return response.json()


def exchange_code_for_tokens(code: str, client_id: str, client_secret: str, redirect_uri: str) -> dict:
    payload = {
        "code": code,
        "client_id": client_id,
        "client_secret": client_secret,
        "redirect_uri": redirect_uri,
        "grant_type": "authorization_code",
    }
    return request_google_token(payload)


def refresh_access_token(refresh_token: str, client_id: str, client_secret: str) -> dict:
    payload = {
        "refresh_token": refresh_token,
        "client_id": client_id,
        "client_secret": client_secret,
        "grant_type": "refresh_token",
    }
    return request_google_token(payload)


def build_raw_email(
    sender: str,
    recipient: str,
    subject: str,
    body: str,
    calendar_ics: str | None = None,
) -> str:
    if not calendar_ics:
        message = "\r\n".join(
            [
                f"From: {sender}",
                f"To: {recipient}",
                f"Subject: {subject}",
                "MIME-Version: 1.0",
                "Content-Type: text/plain; charset=utf-8",
                "",
                body,
            ]
        )
        return base64.urlsafe_b64encode(message.encode("utf-8")).decode("ascii")

    boundary = f"===============_{uuid4().hex}_=="
    message = "\r\n".join(
        [
            f"From: {sender}",
            f"To: {recipient}",
            f"Subject: {subject}",
            "MIME-Version: 1.0",
            "Content-Class: urn:content-classes:calendarmessage",
            f"Content-Type: multipart/alternative; boundary=\"{boundary}\"",
            "",
            f"--{boundary}",
            "Content-Type: text/plain; charset=utf-8",
            "Content-Transfer-Encoding: 7bit",
            "",
            body,
            "",
            f"--{boundary}",
            "Content-Type: text/calendar; charset=utf-8; method=REQUEST; name=invite.ics",
            "Content-Transfer-Encoding: 7bit",
            "Content-Disposition: inline; filename=invite.ics",
            "",
            calendar_ics,
            "",
            f"--{boundary}--",
            "",
        ]
    )
    return base64.urlsafe_b64encode(message.encode("utf-8")).decode("ascii")


def send_gmail_message(access_token: str, raw_message: str) -> dict:
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json",
    }
    try:
        response = httpx.post(
            GMAIL_SEND_URL,
            headers=headers,
            json={"raw": raw_message},
            timeout=15,
        )
    except httpx.HTTPError as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail="Falha ao enviar email pelo Gmail") from exc
    if response.status_code >= 400:
        detail = "Falha ao enviar email pelo Gmail"
        try:
            detail = response.json().get("error", {}).get("message") or detail
        except ValueError:
            pass
        raise HTTPException(status_code=502, detail=detail)
    return response.json()


def get_gmail_sender() -> str:
    sender = os.getenv("GMAIL_SENDER")
    if not sender:
        raise HTTPException(status_code=500, detail="GMAIL_SENDER nao configurado")
    return sender


def format_calendar_datetime(value: datetime) -> str:
    return value.strftime("%Y%m%dT%H%M%S")


def format_calendar_datetime_utc(value: datetime) -> str:
    return value.strftime("%Y%m%dT%H%M%SZ")


def build_calendar_link(appointment: models.Appointment, patient_name: str) -> str:
    timezone = os.getenv("GOOGLE_CALENDAR_TIMEZONE") or "America/Sao_Paulo"
    start = format_calendar_datetime(appointment.starts_at)
    end = format_calendar_datetime(appointment.ends_at)
    title = f"Consulta - {patient_name}"
    details_parts = [f"Paciente: {patient_name}", f"Tipo: {appointment.type}"]
    if appointment.room:
        details_parts.append(f"Sala: {appointment.room}")
    if appointment.meeting_url:
        details_parts.append(f"Link: {appointment.meeting_url}")
    if appointment.notes:
        details_parts.append(f"Notas: {appointment.notes}")
    details = "\n".join(details_parts)
    location = appointment.meeting_url or appointment.room or ""
    query = urlencode(
        {
            "action": "TEMPLATE",
            "text": title,
            "dates": f"{start}/{end}",
            "details": details,
            "location": location,
            "ctz": timezone,
        }
    )
    return f"https://calendar.google.com/calendar/render?{query}"


def escape_ics_text(value: str) -> str:
    return (
        value.replace("\\", "\\\\")
        .replace(";", "\\;")
        .replace(",", "\\,")
        .replace("\r\n", "\\n")
        .replace("\n", "\\n")
    )


def build_calendar_event_payload(
    appointment: models.Appointment,
    patient: models.Patient,
    owner: models.User | None = None,
) -> dict:
    timezone = os.getenv("GOOGLE_CALENDAR_TIMEZONE") or "America/Sao_Paulo"
    description_parts = [
        f"Paciente: {patient.full_name}",
        f"Tipo: {appointment.type}",
    ]
    if appointment.room:
        description_parts.append(f"Sala: {appointment.room}")
    if appointment.meeting_url:
        description_parts.append(f"Link: {appointment.meeting_url}")
    if appointment.notes:
        description_parts.append(f"Notas: {appointment.notes}")

    attendees: list[dict] = []
    seen_emails: set[str] = set()

    def add_attendee(email: str | None, name: str | None = None):
        if not email:
            return
        key = email.strip().lower()
        if not key or key in seen_emails:
            return
        attendee = {"email": email}
        if name:
            attendee["displayName"] = name
        attendees.append(attendee)
        seen_emails.add(key)

    add_attendee(patient.email, patient.full_name)
    if owner:
        add_attendee(owner.email, owner.full_name)

    event = {
        "summary": f"Consulta - {patient.full_name}",
        "description": "\n".join(description_parts),
        "start": {"dateTime": appointment.starts_at.isoformat(), "timeZone": timezone},
        "end": {"dateTime": appointment.ends_at.isoformat(), "timeZone": timezone},
        "attendees": attendees,
    }

    if appointment.room:
        event["location"] = appointment.room

    appointment_type = (appointment.type or "").lower()
    is_tele = appointment_type.startswith("tele")
    if appointment.meeting_url:
        event["location"] = appointment.meeting_url
    elif is_tele:
        event["conferenceData"] = {
            "createRequest": {
                "requestId": uuid4().hex,
                "conferenceSolutionKey": {"type": "hangoutsMeet"},
            }
        }
    return event


def extract_meet_link(event: dict) -> str | None:
    link = event.get("hangoutLink")
    if link:
        return link
    conference = event.get("conferenceData") or {}
    for entry in conference.get("entryPoints", []):
        if entry.get("entryPointType") == "video":
            return entry.get("uri")
    return None


def create_calendar_event(access_token: str, payload: dict) -> dict:
    calendar_id = os.getenv("GOOGLE_CALENDAR_ID") or "primary"
    url = GOOGLE_CALENDAR_EVENTS_URL.format(calendar_id=calendar_id)
    params = {"sendUpdates": "all"}
    if "conferenceData" in payload:
        params["conferenceDataVersion"] = 1
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json",
    }
    try:
        response = httpx.post(url, headers=headers, params=params, json=payload, timeout=20)
    except httpx.HTTPError as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail="Falha ao falar com Google Calendar API") from exc
    if response.status_code >= 400:
        detail = "Falha ao criar evento no Google Calendar"
        try:
            detail = response.json().get("error", {}).get("message") or detail
        except ValueError:
            pass
        raise HTTPException(status_code=502, detail=detail)
    return response.json()


def get_calendar_access_token() -> str:
    refresh_token = os.getenv("GOOGLE_REFRESH_TOKEN")
    if not refresh_token:
        raise HTTPException(status_code=500, detail="GOOGLE_REFRESH_TOKEN nao configurado")
    client_id, client_secret = require_google_client_credentials()
    tokens = refresh_access_token(refresh_token, client_id, client_secret)
    access_token = tokens.get("access_token")
    if not access_token:
        raise HTTPException(status_code=500, detail="Access token nao retornou")
    return access_token


def fetch_calendar_event(access_token: str, event_id: str) -> dict:
    calendar_id = os.getenv("GOOGLE_CALENDAR_ID") or "primary"
    url = f"{GOOGLE_CALENDAR_EVENTS_URL.format(calendar_id=calendar_id)}/{event_id}"
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json",
    }
    try:
        response = httpx.get(url, headers=headers, timeout=20)
    except httpx.HTTPError as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail="Falha ao buscar evento no Google Calendar") from exc
    if response.status_code >= 400:
        detail = "Falha ao buscar evento no Google Calendar"
        try:
            detail = response.json().get("error", {}).get("message") or detail
        except ValueError:
            pass
        raise HTTPException(status_code=502, detail=detail)
    return response.json()


def get_attendee_response_status(event: dict, email: str) -> str | None:
    if not email:
        return None
    email_lower = email.strip().lower()
    for attendee in event.get("attendees", []):
        attendee_email = (attendee.get("email") or "").strip().lower()
        if attendee_email == email_lower:
            return attendee.get("responseStatus")
    return None


def map_calendar_status(event: dict, response_status: str | None) -> str | None:
    if event.get("status") == "cancelled":
        return "Cancelado"
    if response_status == "accepted":
        return "Confirmado"
    if response_status == "declined":
        return "Recusado"
    if response_status in ("needsAction", "tentative"):
        return "Em espera"
    return None


def create_calendar_invite(
    appointment: models.Appointment,
    patient: models.Patient,
    owner: models.User | None = None,
) -> dict:
    access_token = get_calendar_access_token()
    payload = build_calendar_event_payload(appointment, patient, owner)
    return create_calendar_event(access_token, payload)


def build_calendar_invite(
    appointment: models.Appointment,
    patient_name: str,
    recipient: str,
    sender: str,
) -> str:
    timezone = os.getenv("GOOGLE_CALENDAR_TIMEZONE") or "America/Sao_Paulo"
    uid = f"{uuid4()}@clinic-dashboard"
    dtstamp = format_calendar_datetime_utc(datetime.utcnow())
    dtstart = format_calendar_datetime(appointment.starts_at)
    dtend = format_calendar_datetime(appointment.ends_at)
    summary = escape_ics_text(f"Consulta - {patient_name}")
    location = escape_ics_text(appointment.meeting_url or appointment.room or "")
    description_parts = [
        f"Paciente: {patient_name}",
        f"Tipo: {appointment.type}",
    ]
    if appointment.room:
        description_parts.append(f"Sala: {appointment.room}")
    if appointment.meeting_url:
        description_parts.append(f"Link: {appointment.meeting_url}")
    if appointment.notes:
        description_parts.append(f"Notas: {appointment.notes}")
    description = escape_ics_text("\n".join(description_parts))
    return "\r\n".join(
        [
            "BEGIN:VCALENDAR",
            "VERSION:2.0",
            "PRODID:-//Clinic Dashboard//PT-BR",
            "CALSCALE:GREGORIAN",
            "METHOD:REQUEST",
            "BEGIN:VEVENT",
            f"UID:{uid}",
            f"DTSTAMP:{dtstamp}",
            f"DTSTART;TZID={timezone}:{dtstart}",
            f"DTEND;TZID={timezone}:{dtend}",
            "CLASS:PUBLIC",
            f"SUMMARY:{summary}",
            f"DESCRIPTION:{description}",
            f"LOCATION:{location}",
            f"ORGANIZER;CN=Clinica:mailto:{sender}",
            (
                "ATTENDEE;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE"
                f";CN={escape_ics_text(patient_name)}:mailto:{recipient}"
            ),
            "STATUS:CONFIRMED",
            "SEQUENCE:0",
            "TRANSP:OPAQUE",
            "END:VEVENT",
            "END:VCALENDAR",
        ]
    )


def build_appointment_email_body(
    appointment: models.Appointment,
    patient_name: str,
) -> str:
    appointment_type = appointment.type or ""
    appointment_type_lower = appointment_type.lower()
    is_online = bool(appointment.meeting_url) or appointment_type_lower.startswith("tele")
    date_label = appointment.starts_at.strftime("%d/%m/%Y")
    start_label = appointment.starts_at.strftime("%H:%M")
    end_label = appointment.ends_at.strftime("%H:%M")
    lines = [
        f"Ola {patient_name},",
        "",
        "Sua consulta foi agendada.",
        f"Data: {date_label}",
        f"Horario: {start_label} - {end_label}",
        f"Tipo: {appointment_type}",
    ]
    if is_online:
        if appointment.meeting_url:
            lines.append(f"Link: {appointment.meeting_url}")
        else:
            lines.append("Link: sera enviado em breve.")
        lines.append("Se precisar remarcar, responda este email.")
    else:
        if appointment.room:
            lines.append(f"Sala: {appointment.room}")
        lines.append("Por favor, confirme sua presenca respondendo este email.")
    return "\n".join(lines)


def send_email_via_gmail(recipient: str, subject: str, body: str) -> dict:
    if not recipient:
        raise HTTPException(status_code=400, detail="Destinatario nao informado")
    refresh_token = os.getenv("GOOGLE_REFRESH_TOKEN")
    if not refresh_token:
        raise HTTPException(status_code=500, detail="GOOGLE_REFRESH_TOKEN nao configurado")
    sender = get_gmail_sender()
    client_id, client_secret = require_google_client_credentials()
    tokens = refresh_access_token(refresh_token, client_id, client_secret)
    access_token = tokens.get("access_token")
    if not access_token:
        raise HTTPException(status_code=500, detail="Access token nao retornou")
    raw_message = build_raw_email(sender, recipient, subject, body)
    return send_gmail_message(access_token, raw_message)


def send_calendar_invite_via_gmail(
    recipient: str,
    subject: str,
    body: str,
    appointment: models.Appointment,
    patient_name: str,
) -> dict:
    if not recipient:
        raise HTTPException(status_code=400, detail="Destinatario nao informado")
    refresh_token = os.getenv("GOOGLE_REFRESH_TOKEN")
    if not refresh_token:
        raise HTTPException(status_code=500, detail="GOOGLE_REFRESH_TOKEN nao configurado")
    sender = get_gmail_sender()
    client_id, client_secret = require_google_client_credentials()
    tokens = refresh_access_token(refresh_token, client_id, client_secret)
    access_token = tokens.get("access_token")
    if not access_token:
        raise HTTPException(status_code=500, detail="Access token nao retornou")
    calendar_ics = build_calendar_invite(appointment, patient_name, recipient, sender)
    raw_message = build_raw_email(sender, recipient, subject, body, calendar_ics=calendar_ics)
    return send_gmail_message(access_token, raw_message)


@app.get("/auth/google/login")
def google_login():
    client_id, _, redirect_uri = require_google_oauth_config()
    url = build_google_auth_url(client_id, redirect_uri)
    return RedirectResponse(url)


@app.get("/auth/google/callback")
def google_callback(code: str | None = None):
    if not code:
        raise HTTPException(status_code=400, detail="Codigo ausente")
    client_id, client_secret, redirect_uri = require_google_oauth_config()
    tokens = exchange_code_for_tokens(code, client_id, client_secret, redirect_uri)
    access_token = tokens.get("access_token")
    refresh_token = tokens.get("refresh_token")
    sender = os.getenv("GMAIL_SENDER")
    recipient = os.getenv("GMAIL_TEST_RECIPIENT") or sender
    if access_token and sender:
        raw_message = build_raw_email(sender, recipient, "funcionou", "funcionou")
        send_gmail_message(access_token, raw_message)

    response = {"message": "OAuth OK", "refresh_token": refresh_token}
    if sender:
        response["sent_to"] = recipient
    if not refresh_token:
        response["warning"] = "Refresh token nao retornou. Revogue o acesso e tente novamente."
    return response


@app.post("/auth/google/test-email")
def google_test_email():
    sender = get_gmail_sender()
    recipient = os.getenv("GMAIL_TEST_RECIPIENT") or sender
    result = send_email_via_gmail(recipient, "funcionou", "funcionou")
    return {"message": "Email enviado", "to": recipient, "id": result.get("id")}

@app.post("/auth/login")
def login(payload: schemas.UserLogin, db: Session = Depends(get_db)):
    identifier = payload.username.strip()
    identifier_lower = identifier.lower()
    user = (
        db.query(models.User)
        .filter(
            or_(
                models.User.username == identifier,
                func.lower(models.User.email) == identifier_lower,
            )
        )
        .first()
    )
    # Se a conta não tem hash de senha (ex.: Paciente sem acesso), bloqueia login.
    if not user or not user.password_hash or not auth.verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Credenciais invalidas")

    return {
        "message": "Login OK",
        "user": {"id": user.id, "full_name": user.full_name, "username": user.username},
    }


@app.get("/users/me")
def get_current_user(
    db: Session = Depends(get_db),
    x_user_id: str | None = Header(default=None, alias="X-User-Id"),
):
    user = get_request_user(db, x_user_id)
    return serialize_user(user)


@app.put("/users/me")
def update_current_user(
    payload: schemas.UserUpdate,
    db: Session = Depends(get_db),
    x_user_id: str | None = Header(default=None, alias="X-User-Id"),
):
    user = get_request_user(db, x_user_id)

    if payload.full_name is None and payload.cpf is None and payload.address is None:
        raise HTTPException(status_code=400, detail="Nenhum dado para atualizar")

    if payload.full_name is not None:
        user.full_name = payload.full_name.strip()

    if payload.cpf is not None:
        new_cpf = re.sub(r"\D", "", payload.cpf)
        if len(new_cpf) != 11:
            raise HTTPException(status_code=400, detail="CPF invalido")
        if new_cpf != user.cpf:
            user_conflict = (
                db.query(models.User)
                .filter(models.User.cpf == new_cpf, models.User.id != user.id)
                .first()
            )
            patient_conflict = db.query(models.Patient).filter(models.Patient.cpf == new_cpf).first()
            if user_conflict or patient_conflict:
                raise HTTPException(status_code=400, detail="CPF ja cadastrado")
        user.cpf = new_cpf

    if payload.address is not None:
        normalized_address = normalize_address(payload.address)
        user.address_street = normalized_address["street"]
        user.address_number = normalized_address["number"]
        user.address_complement = normalized_address["complement"]
        user.address_district = normalized_address["district"]
        user.address_city = normalized_address["city"]
        user.address_state = normalized_address["state"]
        user.address_zip = normalized_address["zip_code"]

    db.add(user)
    try:
        db.commit()
        db.refresh(user)
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail=integrity_error_message(exc)) from exc

    return serialize_user(user)


@app.put("/users/me/password")
def update_password(
    payload: schemas.UserPasswordUpdate,
    db: Session = Depends(get_db),
    x_user_id: str | None = Header(default=None, alias="X-User-Id"),
):
    user = get_request_user(db, x_user_id)
    hashed = auth.hash_password(payload.new_password)
    user.password_hash = hashed
    db.add(user)
    db.commit()
    return {"message": "Senha atualizada com sucesso"}


@app.put("/users/me/username")
def update_username(
    payload: schemas.UserUsernameUpdate,
    db: Session = Depends(get_db),
    x_user_id: str | None = Header(default=None, alias="X-User-Id"),
):
    user = get_request_user(db, x_user_id)
    username_input = payload.new_username.strip()

    existing = (
        db.query(models.User)
        .filter(models.User.username == username_input, models.User.id != user.id)
        .first()
    )
    if existing:
        raise HTTPException(status_code=400, detail="Nome de usuario ja existe")

    user.username = username_input
    db.add(user)
    try:
        db.commit()
        db.refresh(user)
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail=integrity_error_message(exc)) from exc

    return {"message": "Nome de usuario atualizado com sucesso", "username": user.username}


@app.get("/patients")
def list_patients(
    db: Session = Depends(get_db),
    x_user_id: str | None = Header(default=None, alias="X-User-Id"),
):
    user = get_request_user(db, x_user_id)
    patients = (
        db.query(models.Patient)
        .filter(models.Patient.owner_user_id == user.id)
        .order_by(models.Patient.created_at.desc())
        .all()
    )
    return [serialize_patient(p) for p in patients]


@app.get("/patients/{patient_id}")
def get_patient(
    patient_id: UUID,
    db: Session = Depends(get_db),
    x_user_id: str | None = Header(default=None, alias="X-User-Id"),
):
    user = get_request_user(db, x_user_id)
    patient = (
        db.query(models.Patient)
        .filter(
            models.Patient.id == patient_id,
            models.Patient.owner_user_id == user.id,
        )
        .first()
    )
    if not patient:
        raise HTTPException(status_code=404, detail="Paciente nao encontrado")

    return serialize_patient(patient)


@app.put("/patients/{patient_id}")
def update_patient(
    patient_id: UUID,
    payload: schemas.PatientUpdate,
    db: Session = Depends(get_db),
    x_user_id: str | None = Header(default=None, alias="X-User-Id"),
):
    user = get_request_user(db, x_user_id)
    patient = (
        db.query(models.Patient)
        .filter(
            models.Patient.id == patient_id,
            models.Patient.owner_user_id == user.id,
        )
        .first()
    )
    if not patient:
        raise HTTPException(status_code=404, detail="Paciente nao encontrado")

    if (
        payload.full_name is None
        and payload.cpf is None
        and payload.phone is None
        and payload.email is None
        and payload.address is None
    ):
        raise HTTPException(status_code=400, detail="Nenhum dado para atualizar")

    if payload.full_name is not None:
        patient.full_name = payload.full_name.strip()

    if payload.cpf is not None:
        new_cpf = re.sub(r"\D", "", payload.cpf)
        if len(new_cpf) != 11:
            raise HTTPException(status_code=400, detail="CPF invalido")
        if new_cpf != patient.cpf:
            conflict_patient = (
                db.query(models.Patient)
                .filter(models.Patient.cpf == new_cpf, models.Patient.id != patient.id)
                .first()
            )
            conflict_user = db.query(models.User).filter(models.User.cpf == new_cpf).first()
            if conflict_patient or conflict_user:
                raise HTTPException(status_code=400, detail="CPF ja cadastrado")
        patient.cpf = new_cpf

    if payload.email is not None:
        new_email = payload.email.strip()
        if new_email.lower() != (patient.email or "").lower():
            conflict_patient = (
                db.query(models.Patient)
                .filter(models.Patient.email == new_email, models.Patient.id != patient.id)
                .first()
            )
            conflict_user = db.query(models.User).filter(models.User.email == new_email).first()
            if conflict_patient or conflict_user:
                raise HTTPException(status_code=400, detail="Email ja cadastrado")
        patient.email = new_email

    if payload.phone is not None:
        new_phone = re.sub(r"\D", "", payload.phone)
        if new_phone and len(new_phone) < 10:
            raise HTTPException(status_code=400, detail="Telefone invalido")
        patient.phone = new_phone

    if payload.address is not None:
        normalized_address = normalize_address(payload.address)
        patient.address_street = normalized_address["street"]
        patient.address_number = normalized_address["number"]
        patient.address_complement = normalized_address["complement"]
        patient.address_district = normalized_address["district"]
        patient.address_city = normalized_address["city"]
        patient.address_state = normalized_address["state"]
        patient.address_zip = normalized_address["zip_code"]

    db.add(patient)
    try:
        db.commit()
        db.refresh(patient)
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail=integrity_error_message(exc)) from exc

    return serialize_patient(patient)


@app.get("/patients/{patient_id}/documents")
def list_patient_documents(
    patient_id: UUID,
    db: Session = Depends(get_db),
    x_user_id: str | None = Header(default=None, alias="X-User-Id"),
):
    user = get_request_user(db, x_user_id)
    patient = (
        db.query(models.Patient)
        .filter(
            models.Patient.id == patient_id,
            models.Patient.owner_user_id == user.id,
        )
        .first()
    )
    if not patient:
        raise HTTPException(status_code=404, detail="Paciente nao encontrado")

    docs = (
        db.query(models.PatientDocument)
        .filter(models.PatientDocument.patient_id == patient_id)
        .order_by(models.PatientDocument.created_at.desc())
        .all()
    )
    return [serialize_document(doc) for doc in docs]


@app.post("/patients/{patient_id}/documents")
async def upload_patient_document(
    patient_id: UUID,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    x_user_id: str | None = Header(default=None, alias="X-User-Id"),
):
    user = get_request_user(db, x_user_id)
    patient = (
        db.query(models.Patient)
        .filter(
            models.Patient.id == patient_id,
            models.Patient.owner_user_id == user.id,
        )
        .first()
    )
    if not patient:
        raise HTTPException(status_code=404, detail="Paciente nao encontrado")

    if not file or not file.filename:
        raise HTTPException(status_code=400, detail="Arquivo invalido")
    if file.content_type not in ["application/pdf", "application/octet-stream"]:
        raise HTTPException(status_code=400, detail="Apenas PDFs sao aceitos")

    safe_name = Path(file.filename).name
    doc_id = uuid4()
    stored_name = f"{doc_id}_{safe_name}"
    file_path = UPLOAD_DIR / stored_name

    try:
        with file_path.open("wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        size = file_path.stat().st_size
    except Exception as exc:  # noqa: BLE001
        if file_path.exists():
            file_path.unlink(missing_ok=True)
        raise HTTPException(status_code=500, detail="Falha ao salvar arquivo") from exc

    db_doc = models.PatientDocument(
        id=doc_id,
        patient_id=patient_id,
        stored_name=stored_name,
        original_name=safe_name,
        content_type=file.content_type or "application/octet-stream",
        size=size,
    )
    db.add(db_doc)
    db.commit()
    db.refresh(db_doc)

    return serialize_document(db_doc)


@app.get("/patients/{patient_id}/documents/{document_id}")
def download_patient_document(
    patient_id: UUID,
    document_id: UUID,
    db: Session = Depends(get_db),
    x_user_id: str | None = Header(default=None, alias="X-User-Id"),
):
    user = get_request_user(db, x_user_id)
    doc = (
        db.query(models.PatientDocument)
        .filter(
            models.PatientDocument.id == document_id,
            models.PatientDocument.patient_id == patient_id,
        )
        .first()
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Documento nao encontrado")

    patient_owner = (
        db.query(models.Patient.owner_user_id)
        .filter(models.Patient.id == patient_id)
        .scalar()
    )
    if patient_owner != user.id:
        raise HTTPException(status_code=404, detail="Documento nao encontrado")

    file_path = UPLOAD_DIR / doc.stored_name
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Arquivo nao encontrado no servidor")

    return FileResponse(
        path=file_path,
        media_type=doc.content_type or "application/octet-stream",
        filename=doc.original_name,
    )


@app.delete("/patients/{patient_id}/documents/{document_id}")
def delete_patient_document(
    patient_id: UUID,
    document_id: UUID,
    db: Session = Depends(get_db),
    x_user_id: str | None = Header(default=None, alias="X-User-Id"),
):
    user = get_request_user(db, x_user_id)
    doc = (
        db.query(models.PatientDocument)
        .filter(
            models.PatientDocument.id == document_id,
            models.PatientDocument.patient_id == patient_id,
        )
        .first()
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Documento nao encontrado")

    patient_owner = (
        db.query(models.Patient.owner_user_id)
        .filter(models.Patient.id == patient_id)
        .scalar()
    )
    if patient_owner != user.id:
        raise HTTPException(status_code=404, detail="Documento nao encontrado")

    file_path = UPLOAD_DIR / doc.stored_name
    db.delete(doc)
    db.commit()
    file_path.unlink(missing_ok=True)

    return {"message": "Documento deletado com sucesso", "id": str(document_id)}


@app.delete("/patients/{patient_id}")
def delete_patient(
    patient_id: UUID,
    db: Session = Depends(get_db),
    x_user_id: str | None = Header(default=None, alias="X-User-Id"),
):
    user = get_request_user(db, x_user_id)
    patient = (
        db.query(models.Patient)
        .filter(
            models.Patient.id == patient_id,
            models.Patient.owner_user_id == user.id,
        )
        .first()
    )
    if not patient:
        raise HTTPException(status_code=404, detail="Paciente nao encontrado")

    db.delete(patient)
    db.commit()
    return {"message": "Paciente deletado com sucesso", "id": str(patient.id)}


@app.post("/auth/register/patient")
def register_patient(
    payload: schemas.PatientCreate,
    db: Session = Depends(get_db),
    x_user_id: str | None = Header(default=None, alias="X-User-Id"),
):
    user = get_request_user(db, x_user_id)
    normalized = normalize_identity_fields(
        full_name=payload.full_name,
        cpf=payload.cpf,
        phone=payload.phone,
        email=payload.email,
    )
    address = normalize_address(payload.address)

    # Evita duplicar CPF/Email tanto em pacientes quanto em usuarios
    if (
        db.query(models.Patient)
        .filter(models.Patient.cpf == normalized["cpf"])
        .first()
    ) or (
        db.query(models.User)
        .filter(models.User.cpf == normalized["cpf"])
        .first()
    ):
        raise HTTPException(status_code=400, detail="CPF ja cadastrado")

    if (
        db.query(models.Patient)
        .filter(models.Patient.email == normalized["email"])
        .first()
    ) or (
        db.query(models.User)
        .filter(models.User.email == normalized["email"])
        .first()
    ):
        raise HTTPException(status_code=400, detail="Email ja cadastrado")

    db_patient = models.Patient(
        full_name=normalized["full_name"],
        owner_user_id=user.id,
        cpf=normalized["cpf"],
        phone=normalized["phone"],
        email=normalized["email"],
        address_street=address["street"],
        address_number=address["number"],
        address_complement=address["complement"],
        address_district=address["district"],
        address_city=address["city"],
        address_state=address["state"],
        address_zip=address["zip_code"],
    )
    db.add(db_patient)
    try:
        db.commit()
        db.refresh(db_patient)
    except IntegrityError as exc:
        db.rollback()
        # Revalida campos unicos para responder com mensagem especifica.
        if (
            db.query(models.Patient)
            .filter(models.Patient.cpf == normalized["cpf"])
            .first()
        ) or (
            db.query(models.User)
            .filter(models.User.cpf == normalized["cpf"])
            .first()
        ):
            raise HTTPException(status_code=400, detail="CPF ja cadastrado") from exc
        if (
            db.query(models.Patient)
            .filter(models.Patient.email == normalized["email"])
            .first()
        ) or (
            db.query(models.User)
            .filter(models.User.email == normalized["email"])
            .first()
        ):
            raise HTTPException(status_code=400, detail="Email ja cadastrado") from exc
        # Retorna erro amigavel ao front para evitar "Failed to fetch" por CORS.
        raise HTTPException(
            status_code=400, detail=integrity_error_message(exc)
        ) from exc

    return {"message": "Paciente criado com sucesso", "id": str(db_patient.id)}


@app.get("/appointments")
def list_appointments(
    start_date: str | None = None,
    end_date: str | None = None,
    db: Session = Depends(get_db),
    x_user_id: str | None = Header(default=None, alias="X-User-Id"),
):
    user = get_request_user(db, x_user_id)

    start_dt: datetime | None = None
    end_dt: datetime | None = None
    if start_date:
        try:
            start_dt = datetime.combine(date.fromisoformat(start_date), datetime.min.time())
        except ValueError as exc:  # noqa: B904
            raise HTTPException(status_code=400, detail="Data inicial invalida") from exc
    if end_date:
        try:
            end_dt = datetime.combine(date.fromisoformat(end_date), datetime.max.time())
        except ValueError as exc:  # noqa: B904
            raise HTTPException(status_code=400, detail="Data final invalida") from exc
    if start_dt and not end_dt:
        end_dt = datetime.combine(start_dt.date(), datetime.max.time())
    if end_dt and not start_dt:
        start_dt = datetime.combine(end_dt.date(), datetime.min.time())

    query = (
        db.query(
            models.Appointment,
            models.Patient.full_name,
            models.Patient.email,
        )
        .join(models.Patient, models.Patient.id == models.Appointment.patient_id)
        .filter(
            models.Appointment.owner_user_id == user.id,
            models.Patient.owner_user_id == user.id,
        )
    )
    if start_dt and end_dt:
        query = query.filter(models.Appointment.starts_at.between(start_dt, end_dt))

    appointments = query.order_by(models.Appointment.starts_at.asc()).all()

    access_token: str | None = None
    needs_calendar_sync = any(
        appointment.calendar_event_id for appointment, _, _ in appointments
    )
    if needs_calendar_sync:
        try:
            access_token = get_calendar_access_token()
        except HTTPException as exc:
            print(f"Falha ao obter token do Google Calendar: {exc.detail}")

    updated = False
    if access_token:
        for appointment, _, patient_email in appointments:
            if not appointment.calendar_event_id or not patient_email:
                continue
            try:
                event = fetch_calendar_event(access_token, appointment.calendar_event_id)
            except HTTPException as exc:
                print(f"Falha ao buscar evento no Google Calendar: {exc.detail}")
                continue
            response_status = get_attendee_response_status(event, patient_email)
            new_status = map_calendar_status(event, response_status)
            if new_status and new_status != appointment.status:
                appointment.status = new_status
                db.add(appointment)
                updated = True
            meet_link = extract_meet_link(event)
            if meet_link and meet_link != appointment.meeting_url:
                appointment.meeting_url = meet_link
                db.add(appointment)
                updated = True

    if updated:
        db.commit()

    return [
        serialize_appointment(appointment, patient_name)
        for appointment, patient_name, _ in appointments
    ]


@app.post("/appointments")
def create_appointment(
    payload: schemas.AppointmentCreate,
    db: Session = Depends(get_db),
    x_user_id: str | None = Header(default=None, alias="X-User-Id"),
):
    user = get_request_user(db, x_user_id)
    patient = (
        db.query(models.Patient)
        .filter(
            models.Patient.id == payload.patient_id,
            models.Patient.owner_user_id == user.id,
        )
        .first()
    )
    if not patient:
        raise HTTPException(status_code=404, detail="Paciente nao encontrado")

    starts_at = payload.starts_at
    ends_at = payload.ends_at or (payload.starts_at + timedelta(minutes=60))
    if ends_at <= starts_at:
        raise HTTPException(status_code=400, detail="Horario final deve ser maior que o inicial")

    if payload.room:
        room_conflict = (
            db.query(models.Appointment)
            .filter(
                models.Appointment.room == payload.room,
                models.Appointment.starts_at < ends_at,
                models.Appointment.ends_at > starts_at,
            )
            .first()
        )
        if room_conflict:
            raise HTTPException(status_code=400, detail="Sala indisponivel neste horario")

    overlapping = (
        db.query(models.Appointment)
        .filter(
            models.Appointment.owner_user_id == user.id,
            models.Appointment.patient_id == patient.id,
            models.Appointment.starts_at < ends_at,
            models.Appointment.ends_at > starts_at,
        )
        .first()
    )
    if overlapping:
        raise HTTPException(status_code=400, detail="Paciente ja possui agendamento nesse horario")

    is_tele = payload.type.lower().startswith("tele")
    meeting_url = payload.meeting_url or ""

    appointment = models.Appointment(
        owner_user_id=user.id,
        patient_id=patient.id,
        starts_at=starts_at,
        ends_at=ends_at,
        type=payload.type,
        room=payload.room,
        notes=payload.notes,
        meeting_url=meeting_url,
        status=payload.status or "Em espera",
    )
    db.add(appointment)
    db.commit()
    db.refresh(appointment)

    try:
        if patient.email:
            event = create_calendar_invite(appointment, patient, user)
            meet_link = extract_meet_link(event)
            updated = False
            event_id = event.get("id")
            if event_id and event_id != appointment.calendar_event_id:
                appointment.calendar_event_id = event_id
                updated = True
            if meet_link and meet_link != appointment.meeting_url:
                appointment.meeting_url = meet_link
                updated = True
            response_status = get_attendee_response_status(event, patient.email)
            new_status = map_calendar_status(event, response_status)
            if new_status and new_status != appointment.status:
                appointment.status = new_status
                updated = True
            if updated:
                db.add(appointment)
                db.commit()
                db.refresh(appointment)
    except HTTPException as exc:
        print(f"Falha ao criar evento no Google Calendar: {exc.detail}")
    except Exception:
        print("Falha ao criar evento no Google Calendar")

    return serialize_appointment(appointment, patient.full_name)


@app.delete("/appointments/{appointment_id}")
def delete_appointment(
    appointment_id: UUID,
    db: Session = Depends(get_db),
    x_user_id: str | None = Header(default=None, alias="X-User-Id"),
):
    user = get_request_user(db, x_user_id)
    appointment = (
        db.query(models.Appointment)
        .filter(
            models.Appointment.id == appointment_id,
            models.Appointment.owner_user_id == user.id,
        )
        .first()
    )
    if not appointment:
        raise HTTPException(status_code=404, detail="Agendamento nao encontrado")

    db.delete(appointment)
    db.commit()
    return {"message": "Agendamento cancelado com sucesso", "id": str(appointment_id)}


@app.post("/auth/register/user")
def register_user(user: schemas.UserCreate, db: Session = Depends(get_db)):
    username_input = user.username.strip()
    normalized = normalize_identity_fields(
        full_name=user.full_name,
        cpf=user.cpf,
        phone=user.phone,
        email=user.email,
    )
    address = normalize_address(user.address)

    if db.query(models.User).filter(models.User.username == username_input).first():
        raise HTTPException(status_code=400, detail="Nome de usuario ja existe")
    if (
        db.query(models.User).filter(models.User.cpf == normalized["cpf"]).first()
        or db.query(models.Patient).filter(models.Patient.cpf == normalized["cpf"]).first()
    ):
        raise HTTPException(status_code=400, detail="CPF ja cadastrado")
    if (
        db.query(models.User).filter(models.User.email == normalized["email"]).first()
        or db.query(models.Patient).filter(models.Patient.email == normalized["email"]).first()
    ):
        raise HTTPException(status_code=400, detail="Email ja cadastrado")

    hashed_pw = auth.hash_password(user.password)
    db_user = models.User(
        full_name=normalized["full_name"],
        username=username_input,
        cpf=normalized["cpf"],
        phone=normalized["phone"],
        email=normalized["email"],
        account_type=user.account_type,
        address_street=address["street"],
        address_number=address["number"],
        address_complement=address["complement"],
        address_district=address["district"],
        address_city=address["city"],
        address_state=address["state"],
        address_zip=address["zip_code"],
        password_hash=hashed_pw,
    )
    db.add(db_user)
    try:
        db.commit()
        db.refresh(db_user)
    except IntegrityError as exc:
        db.rollback()
        if db.query(models.User).filter(models.User.username == username_input).first():
            raise HTTPException(status_code=400, detail="Nome de usuario ja existe") from exc
        if (
            db.query(models.User).filter(models.User.cpf == normalized["cpf"]).first()
            or db.query(models.Patient).filter(models.Patient.cpf == normalized["cpf"]).first()
        ):
            raise HTTPException(status_code=400, detail="CPF ja cadastrado") from exc
        if (
            db.query(models.User).filter(models.User.email == normalized["email"]).first()
            or db.query(models.Patient).filter(models.Patient.email == normalized["email"]).first()
        ):
            raise HTTPException(status_code=400, detail="Email ja cadastrado") from exc
        raise HTTPException(
            status_code=400, detail=integrity_error_message(exc)
        ) from exc

    return {"message": "Usuario criado com sucesso", "id": str(db_user.id)}
