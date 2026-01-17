from datetime import datetime
from uuid import uuid4

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID

from .database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    full_name = Column(String(100), nullable=False)
    username = Column(String(50), unique=True, nullable=False)
    cpf = Column(String(14), unique=True, nullable=False)
    phone = Column(String(20), nullable=True)
    email = Column(String(254), unique=True, nullable=False)
    account_type = Column(String(20), nullable=False)
    address_street = Column(String(120), nullable=True)
    address_number = Column(String(10), nullable=True)
    address_complement = Column(String(60), nullable=True)
    address_district = Column(String(80), nullable=True)
    address_city = Column(String(80), nullable=True)
    address_state = Column(String(2), nullable=True)
    address_zip = Column(String(8), nullable=True)
    password_hash = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class Patient(Base):
    __tablename__ = "patients"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    owner_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), index=True, nullable=True)
    full_name = Column(String(100), nullable=False)
    cpf = Column(String(14), unique=True, nullable=False)
    phone = Column(String(20), nullable=True)
    email = Column(String(254), unique=True, nullable=False)
    address_street = Column(String(120), nullable=True)
    address_number = Column(String(10), nullable=True)
    address_complement = Column(String(60), nullable=True)
    address_district = Column(String(80), nullable=True)
    address_city = Column(String(80), nullable=True)
    address_state = Column(String(2), nullable=True)
    address_zip = Column(String(8), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class PatientDocument(Base):
    __tablename__ = "patient_documents"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    patient_id = Column(UUID(as_uuid=True), ForeignKey("patients.id"), index=True, nullable=False)
    stored_name = Column(String(255), nullable=False)
    original_name = Column(String(255), nullable=False)
    content_type = Column(String(100), nullable=False)
    size = Column(Integer, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class Appointment(Base):
    __tablename__ = "appointments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    owner_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), index=True, nullable=False)
    patient_id = Column(UUID(as_uuid=True), ForeignKey("patients.id"), index=True, nullable=False)
    starts_at = Column(DateTime, nullable=False, index=True)
    ends_at = Column(DateTime, nullable=False)
    type = Column(String(20), nullable=False)
    room = Column(String(80), nullable=True)
    notes = Column(String, nullable=True)
    meeting_url = Column(String, nullable=True)
    calendar_event_id = Column(String(255), nullable=True)
    status = Column(String(20), nullable=False, default="Em espera")
    created_at = Column(DateTime, default=datetime.utcnow)
