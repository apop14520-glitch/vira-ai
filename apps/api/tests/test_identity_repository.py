import hashlib
from datetime import UTC, datetime, timedelta

import pytest

from app.db.sqlite import SQLiteDatabase
from app.modules.identity.domain import AdminCredential, AdminSession
from app.modules.identity.repository import SQLiteIdentityRepository
from app.security.passwords import create_password_hash


@pytest.fixture
def identity_repository(tmp_path):
    database_path = (tmp_path / "identity.db").as_posix()
    database = SQLiteDatabase(f"sqlite:///{database_path}")
    database.initialize()
    repository = SQLiteIdentityRepository(database)
    repository.initialize_schema()
    yield repository, database
    database.close()


def test_credential_round_trip_keeps_only_password_hash_metadata(identity_repository) -> None:
    repository, _ = identity_repository
    now = datetime(2026, 9, 15, 12, 0, tzinfo=UTC)
    password = "Vira-admin-2026!"
    credential = AdminCredential(
        username="admin",
        organization_id="00000000-0000-4000-8000-000000000001",
        password_hash=create_password_hash(password),
        password_changed_at=now,
        updated_at=now,
    )

    repository.save_credential(credential)

    loaded = repository.get_credential("admin")
    assert loaded == credential
    assert password not in repr(loaded)


def test_initial_credential_is_created_only_when_repository_is_empty(identity_repository) -> None:
    repository, _ = identity_repository
    now = datetime(2026, 9, 15, 12, 0, tzinfo=UTC)
    first = AdminCredential(
        username="first-admin",
        organization_id="00000000-0000-4000-8000-000000000001",
        password_hash=create_password_hash("First-admin-2026!"),
        password_changed_at=now,
        updated_at=now,
    )
    second = AdminCredential(
        username="second-admin",
        organization_id="00000000-0000-4000-8000-000000000001",
        password_hash=create_password_hash("Second-admin-2026!"),
        password_changed_at=now,
        updated_at=now,
    )

    assert repository.create_initial_credential(first) is True
    assert repository.create_initial_credential(second) is False
    assert repository.get_any_credential() == first
    assert repository.get_credential(second.username) is None


def test_active_session_is_not_returned_after_expiration_or_revocation(identity_repository) -> None:
    repository, database = identity_repository
    created_at = datetime(2026, 9, 15, 12, 0, tzinfo=UTC)
    raw_token = "raw-session-token-that-must-not-be-persisted"
    token_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()
    session = AdminSession(
        session_id="session-1",
        token_hash=token_hash,
        username="admin",
        organization_id="00000000-0000-4000-8000-000000000001",
        created_at=created_at,
        expires_at=created_at + timedelta(hours=8),
    )

    repository.create_session(session)
    assert repository.get_active_session(token_hash, created_at + timedelta(minutes=1)) == session
    assert repository.get_active_session(token_hash, created_at + timedelta(hours=9)) is None

    repository.revoke_session(session.session_id, revoked_at=created_at + timedelta(hours=1))
    assert repository.get_active_session(token_hash, created_at + timedelta(hours=2)) is None

    with database.connect() as connection:
        row = connection.execute(
            "SELECT token_hash FROM identity_admin_sessions WHERE session_id = ?",
            (session.session_id,),
        ).fetchone()
    assert row["token_hash"] == token_hash
    assert raw_token not in row["token_hash"]


def test_revoke_all_sessions_is_scoped_to_the_organization(identity_repository) -> None:
    repository, _ = identity_repository
    created_at = datetime(2026, 9, 15, 12, 0, tzinfo=UTC)
    organization_a = "00000000-0000-4000-8000-000000000001"
    organization_b = "00000000-0000-4000-8000-000000000002"
    for session_id, organization_id in (("a-1", organization_a), ("a-2", organization_a), ("b-1", organization_b)):
        repository.create_session(
            AdminSession(
                session_id=session_id,
                token_hash=hashlib.sha256(session_id.encode()).hexdigest(),
                username="admin",
                organization_id=organization_id,
                created_at=created_at,
                expires_at=created_at + timedelta(hours=8),
            )
        )

    assert repository.revoke_all_sessions(organization_a, revoked_at=created_at + timedelta(minutes=5)) == 2
    assert repository.get_active_session(hashlib.sha256(b"a-1").hexdigest(), created_at + timedelta(minutes=6)) is None
    assert repository.get_active_session(hashlib.sha256(b"b-1").hexdigest(), created_at + timedelta(minutes=6)) is not None
