"""Password hashing primitives for the administrative identity boundary."""

import base64
import binascii
import hashlib
import hmac
import secrets
from dataclasses import dataclass


PASSWORD_HASH_ALGORITHM = "sha256"
PASSWORD_ITERATIONS = 600_000
PASSWORD_SALT_BYTES = 16
PASSWORD_DIGEST_BYTES = 32
PASSWORD_MIN_LENGTH = 12


@dataclass(frozen=True)
class PasswordHash:
    """Persistable password metadata that never contains the cleartext."""

    algorithm: str
    iterations: int
    salt_b64: str
    digest_b64: str


def validate_new_password(password: str) -> None:
    """Reject passwords that do not meet the local administrative minimum."""

    if not isinstance(password, str) or len(password) < PASSWORD_MIN_LENGTH or not password.strip():
        raise ValueError(f"A senha deve ter pelo menos {PASSWORD_MIN_LENGTH} caracteres.")


def create_password_hash(
    password: str,
    *,
    iterations: int = PASSWORD_ITERATIONS,
) -> PasswordHash:
    """Create a salted PBKDF2-HMAC-SHA256 record."""

    validate_new_password(password)
    if iterations < 1:
        raise ValueError("O número de iterações deve ser positivo.")
    salt = secrets.token_bytes(PASSWORD_SALT_BYTES)
    digest = hashlib.pbkdf2_hmac(
        PASSWORD_HASH_ALGORITHM,
        password.encode("utf-8"),
        salt,
        iterations,
        dklen=PASSWORD_DIGEST_BYTES,
    )
    return PasswordHash(
        algorithm=PASSWORD_HASH_ALGORITHM,
        iterations=iterations,
        salt_b64=base64.b64encode(salt).decode("ascii"),
        digest_b64=base64.b64encode(digest).decode("ascii"),
    )


def verify_password(password: str, password_hash: PasswordHash) -> bool:
    """Verify a password while failing closed for malformed metadata."""

    if password_hash.algorithm != PASSWORD_HASH_ALGORITHM or password_hash.iterations < 1:
        return False
    try:
        salt = base64.b64decode(password_hash.salt_b64, validate=True)
        expected_digest = base64.b64decode(password_hash.digest_b64, validate=True)
        candidate_digest = hashlib.pbkdf2_hmac(
            PASSWORD_HASH_ALGORITHM,
            password.encode("utf-8"),
            salt,
            password_hash.iterations,
            dklen=len(expected_digest),
        )
    except (TypeError, ValueError, UnicodeError, binascii.Error):
        return False
    return hmac.compare_digest(candidate_digest, expected_digest)
