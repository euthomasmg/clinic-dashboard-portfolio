from passlib.context import CryptContext

# Usa pbkdf2_sha256 para evitar dependencias nativas do bcrypt em Windows.
pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")


def hash_password(password: str):
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str):
    return pwd_context.verify(plain_password, hashed_password)
