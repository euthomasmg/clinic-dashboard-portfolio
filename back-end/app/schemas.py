from datetime import datetime
from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel, EmailStr, constr


class Address(BaseModel):
    street: Optional[constr(strip_whitespace=True, min_length=1, max_length=120)] = None
    number: Optional[constr(strip_whitespace=True, min_length=1, max_length=10)] = None
    complement: Optional[constr(strip_whitespace=True, max_length=60)] = None
    district: Optional[constr(strip_whitespace=True, min_length=1, max_length=80)] = None
    city: Optional[constr(strip_whitespace=True, min_length=1, max_length=80)] = None
    state: Optional[constr(strip_whitespace=True, min_length=2, max_length=2)] = None
    zip_code: Optional[constr(strip_whitespace=True, min_length=8, max_length=8)] = None


NonPatientAccountType = Literal["Administrativa", "Estagiario", "Financeiro", "Profissional"]


class UserCreate(BaseModel):
    full_name: constr(strip_whitespace=True, min_length=1, max_length=100)
    username: constr(strip_whitespace=True, min_length=1, max_length=50)
    password: constr(min_length=6)
    cpf: constr(strip_whitespace=True, min_length=11, max_length=14)
    phone: constr(strip_whitespace=True, min_length=11, max_length=20)
    email: EmailStr
    address: Optional[Address] = None
    account_type: NonPatientAccountType


class PatientCreate(BaseModel):
    full_name: constr(strip_whitespace=True, min_length=1, max_length=100)
    cpf: constr(strip_whitespace=True, min_length=11, max_length=14)
    phone: constr(strip_whitespace=True, min_length=11, max_length=20)
    email: EmailStr
    address: Optional[Address] = None


class PatientUpdate(BaseModel):
    full_name: Optional[constr(strip_whitespace=True, min_length=1, max_length=100)] = None
    cpf: Optional[constr(strip_whitespace=True, min_length=11, max_length=14)] = None
    phone: Optional[constr(strip_whitespace=True, min_length=10, max_length=20)] = None
    email: Optional[EmailStr] = None
    address: Optional[Address] = None


class UserLogin(BaseModel):
    username: str
    password: str


class UserUpdate(BaseModel):
    full_name: Optional[constr(strip_whitespace=True, min_length=1, max_length=100)] = None
    cpf: Optional[constr(strip_whitespace=True, min_length=11, max_length=14)] = None
    address: Optional[Address] = None


class UserPasswordUpdate(BaseModel):
    new_password: constr(min_length=8)


class UserUsernameUpdate(BaseModel):
    new_username: constr(strip_whitespace=True, min_length=1, max_length=50)


class DocumentOut(BaseModel):
    id: str
    patient_id: str
    original_name: str
    content_type: str
    size: int
    download_url: str
    created_at: datetime


AppointmentStatus = Literal["Confirmado", "Em espera", "Cancelado", "Reagendar", "Recusado"]


class AppointmentCreate(BaseModel):
    patient_id: UUID
    starts_at: datetime
    ends_at: Optional[datetime] = None
    type: constr(strip_whitespace=True, min_length=3, max_length=20)
    room: Optional[constr(strip_whitespace=True, max_length=80)] = None
    notes: Optional[constr(strip_whitespace=True, max_length=1000)] = None
    meeting_url: Optional[constr(strip_whitespace=True, max_length=255)] = None
    status: Optional[AppointmentStatus] = "Em espera"


class AppointmentOut(BaseModel):
    id: str
    patient_id: str
    patient_name: str
    starts_at: datetime
    ends_at: datetime
    type: str
    room: Optional[str] = None
    notes: Optional[str] = None
    meeting_url: Optional[str] = None
    status: AppointmentStatus
