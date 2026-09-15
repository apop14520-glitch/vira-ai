import pytest

from app.security.passwords import (
    PASSWORD_HASH_ALGORITHM,
    PASSWORD_ITERATIONS,
    PasswordHash,
    create_password_hash,
    validate_new_password,
    verify_password,
)


def test_new_password_requires_at_least_twelve_characters() -> None:
    with pytest.raises(ValueError, match="12 caracteres"):
        validate_new_password("curta")


def test_password_hash_verifies_without_storing_plaintext() -> None:
    password = "Vira-admin-2026!"

    password_hash = create_password_hash(password)

    assert isinstance(password_hash, PasswordHash)
    assert password_hash.algorithm == PASSWORD_HASH_ALGORITHM
    assert password_hash.iterations == PASSWORD_ITERATIONS
    assert verify_password(password, password_hash) is True
    assert verify_password("outra-senha-2026!", password_hash) is False
    assert password not in password_hash.salt_b64
    assert password not in password_hash.digest_b64


def test_password_hash_uses_a_new_random_salt() -> None:
    first = create_password_hash("Vira-admin-2026!")
    second = create_password_hash("Vira-admin-2026!")

    assert first.salt_b64 != second.salt_b64
    assert first.digest_b64 != second.digest_b64


def test_invalid_hash_metadata_fails_closed() -> None:
    password_hash = create_password_hash("Vira-admin-2026!")
    invalid = PasswordHash(
        algorithm="md5",
        iterations=password_hash.iterations,
        salt_b64=password_hash.salt_b64,
        digest_b64=password_hash.digest_b64,
    )

    assert verify_password("Vira-admin-2026!", invalid) is False
