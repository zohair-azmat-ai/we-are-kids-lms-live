from datetime import datetime, timedelta, timezone

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from app.config import ACCESS_TOKEN_EXPIRE_MINUTES, JWT_SECRET_KEY
from app.db import get_db
from app.models import User
from app.services import get_user_by_email_and_role, normalize_email


ALGORITHM = "HS256"
password_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
bearer_scheme = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    return password_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return password_context.verify(plain_password, hashed_password)
    except ValueError:
        return False


def password_needs_rehash(password_value: str) -> bool:
    return not password_value.startswith("$2")


def create_access_token(*, subject: str, role: str) -> tuple[str, datetime]:
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {
        "sub": subject,
        "role": role,
        "exp": expires_at,
    }
    return jwt.encode(payload, JWT_SECRET_KEY, algorithm=ALGORITHM), expires_at


def decode_access_token(token: str) -> dict[str, str]:
    try:
        return jwt.decode(token, JWT_SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Your session is invalid or has expired. Please sign in again.",
        ) from exc


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    if not credentials or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication is required.",
        )

    payload = decode_access_token(credentials.credentials)
    email = str(payload.get("sub", "")).strip().lower()
    role = str(payload.get("role", "")).strip()

    if not email or not role:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication is required.",
        )

    user = get_user_by_email_and_role(db, email, role)

    if not user or user.status != "active":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Your account is not available right now.",
        )

    return user


def require_role(expected_role: str):
    def dependency(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role != expected_role:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have access to this area.",
            )

        return current_user

    return dependency


def authenticate_user(db: Session, email: str, password: str, role: str) -> User | None:
    normalized_email = normalize_email(email)
    user = get_user_by_email_and_role(db, normalized_email, role)

    if not user or user.status != "active":
        return None

    if password_needs_rehash(user.password):
        if user.password != password:
            return None

        user.password = hash_password(password)
        db.commit()
        db.refresh(user)
        return user

    if not verify_password(password, user.password):
        return None

    return user
