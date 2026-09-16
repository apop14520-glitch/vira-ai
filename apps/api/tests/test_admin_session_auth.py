from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from uuid import UUID

import pytest
from fastapi import HTTPException
from starlette.requests import Request

from app.db.sqlite import SQLiteDatabase
from app.modules.identity.repository import SQLiteIdentityRepository
from app.security.auth import get_current_session_principal
from app.security.sessions import (
    AdminSessionService,
    InitialSetupAlreadyCompleted,
    InitialSetupNotConfigured,
    InitialSetupRejected,
    PasswordChangeError,
)
from app.settings import Settings


INITIAL_PASSWORD = "Vira-admin-2026!"
NEW_PASSWORD = "Vira-nova-2026!"
ORGANIZATION_ID = UUID("00000000-0000-4000-8000-000000000001")
SETUP_TOKEN = "codigo-ativacao-seguro-2026"


@pytest.fixture
def identity_service(tmp_path):
    now = datetime(2026, 9, 15, 12, 0, tzinfo=UTC)
    current_time = [now]
    database = SQLiteDatabase(f"sqlite:///{(tmp_path / 'identity.db').as_posix()}")
    database.initialize()
    repository = SQLiteIdentityRepository(database)
    repository.initialize_schema()
    settings = Settings(
        environment="development",
        allow_development_auth_bypass=False,
        admin_username="admin",
        admin_initial_password=INITIAL_PASSWORD,
        auth_organization_id=ORGANIZATION_ID,
    )
    service = AdminSessionService(
        credential_repository=repository,
        session_repository=repository,
        settings=settings,
        clock=lambda: current_time[0],
        token_generator=lambda: "raw-session-token",
    )
    yield service, repository, current_time
    database.close()


@pytest.fixture
def initial_setup_service(tmp_path):
    now = datetime(2026, 9, 15, 12, 0, tzinfo=UTC)
    database = SQLiteDatabase(f"sqlite:///{(tmp_path / 'initial-setup.db').as_posix()}")
    database.initialize()
    repository = SQLiteIdentityRepository(database)
    repository.initialize_schema()
    settings = Settings(
        environment="development",
        allow_development_auth_bypass=False,
        admin_initial_password=None,
        admin_setup_token=SETUP_TOKEN,
        auth_organization_id=ORGANIZATION_ID,
    )
    service = AdminSessionService(
        credential_repository=repository,
        session_repository=repository,
        settings=settings,
        clock=lambda: now,
    )
    yield service, repository
    database.close()


def test_initial_credential_is_created_once(identity_service) -> None:
    service, repository, _ = identity_service

    created = service.ensure_initial_credential()
    assert created is not None
    assert repository.get_credential("admin") == created

    service.settings.admin_initial_password = "another-password-2026!"
    second = service.ensure_initial_credential()
    assert second == created


def test_initial_password_does_not_replace_an_existing_different_admin(identity_service) -> None:
    service, repository, _ = identity_service
    service.settings.admin_setup_token = SETUP_TOKEN
    existing = service.create_initial_credential(
        "existing-admin",
        "Existing-admin-2026!",
        "Existing-admin-2026!",
        SETUP_TOKEN,
    )
    service.settings.admin_initial_password = "Replacement-admin-2026!"

    assert service.ensure_initial_credential() == existing
    assert repository.get_credential("admin") is None


def test_initial_setup_creates_an_authenticatable_credential(initial_setup_service) -> None:
    service, _ = initial_setup_service

    assert service.initial_setup_required() is True
    credential = service.create_initial_credential(
        "novo-admin",
        "Senha-segura-2026!",
        "Senha-segura-2026!",
        SETUP_TOKEN,
    )

    assert service.initial_setup_required() is False
    assert service.authenticate("novo-admin", "Senha-segura-2026!") == credential


@pytest.mark.parametrize(
    ("password", "confirmation", "setup_token"),
    [
        ("Senha-segura-2026!", "Senha-segura-2026!", "codigo-incorreto"),
        ("Senha-segura-2026!", "Outra-senha-2026!", SETUP_TOKEN),
        ("curta", "curta", SETUP_TOKEN),
    ],
)
def test_initial_setup_rejects_invalid_secrets_without_exposing_them(
    initial_setup_service,
    password: str,
    confirmation: str,
    setup_token: str,
) -> None:
    service, _ = initial_setup_service

    with pytest.raises(InitialSetupRejected) as error:
        service.create_initial_credential("novo-admin", password, confirmation, setup_token)

    message = str(error.value)
    assert password not in message
    assert confirmation not in message
    assert setup_token not in message


def test_initial_setup_rejects_a_second_creation(initial_setup_service) -> None:
    service, repository = initial_setup_service
    first = service.create_initial_credential(
        "primeiro-admin",
        "Primeiro-admin-2026!",
        "Primeiro-admin-2026!",
        SETUP_TOKEN,
    )

    with pytest.raises(InitialSetupAlreadyCompleted):
        service.create_initial_credential(
            "segundo-admin",
            "Segundo-admin-2026!",
            "Segundo-admin-2026!",
            SETUP_TOKEN,
        )

    assert repository.get_any_credential() == first
    assert repository.get_credential("segundo-admin") is None


def test_initial_setup_requires_a_configured_token(initial_setup_service) -> None:
    service, _ = initial_setup_service
    service.settings.admin_setup_token = None

    with pytest.raises(InitialSetupNotConfigured):
        service.create_initial_credential(
            "novo-admin",
            "Senha-segura-2026!",
            "Senha-segura-2026!",
            SETUP_TOKEN,
        )


def test_service_creates_and_resolves_an_active_session(identity_service) -> None:
    service, _, _ = identity_service
    credential = service.ensure_initial_credential()

    session, raw_token = service.create_session(credential)

    assert raw_token == "raw-session-token"
    assert service.resolve_session(raw_token) == session


def test_service_rejects_expired_session(identity_service) -> None:
    service, _, current_time = identity_service
    credential = service.ensure_initial_credential()
    _, raw_token = service.create_session(credential)

    current_time[0] += timedelta(hours=8, seconds=1)

    assert service.resolve_session(raw_token) is None


def test_password_change_replaces_hash_and_revokes_existing_session(identity_service) -> None:
    service, repository, _ = identity_service
    credential = service.ensure_initial_credential()
    session, raw_token = service.create_session(credential)

    changed = service.change_password(session, INITIAL_PASSWORD, NEW_PASSWORD, NEW_PASSWORD)

    assert changed.password_hash != credential.password_hash
    assert repository.get_credential("admin") == changed
    assert service.resolve_session(raw_token) is None
    assert service.authenticate("admin", INITIAL_PASSWORD) is None
    assert service.authenticate("admin", NEW_PASSWORD) == changed


def test_password_change_rejects_wrong_current_password(identity_service) -> None:
    service, _, _ = identity_service
    credential = service.ensure_initial_credential()
    session, _ = service.create_session(credential)

    with pytest.raises(PasswordChangeError, match="não pôde ser alterada"):
        service.change_password(session, "senha-incorreta", NEW_PASSWORD, NEW_PASSWORD)


def test_session_cookie_resolves_an_administrative_principal(identity_service) -> None:
    service, _, _ = identity_service
    credential = service.ensure_initial_credential()
    service.create_session(credential)
    request = Request(
        {
            "type": "http",
            "headers": [(b"cookie", b"vira_admin_session=raw-session-token")],
            "app": SimpleNamespace(settings=service.settings, admin_sessions=service),
        }
    )

    principal = get_current_session_principal(request)

    assert principal.organization_id == ORGANIZATION_ID
    assert principal.actor_id == service.settings.admin_actor_id
    assert principal.has_role("admin")


def test_session_dependency_rejects_an_invalid_cookie(identity_service) -> None:
    service, _, _ = identity_service
    request = Request(
        {
            "type": "http",
            "headers": [(b"cookie", b"vira_admin_session=invalid")],
            "app": SimpleNamespace(settings=service.settings, admin_sessions=service),
        }
    )

    with pytest.raises(HTTPException) as error:
        get_current_session_principal(request)

    assert error.value.status_code == 401


def test_production_cannot_enable_development_auth_bypass() -> None:
    with pytest.raises(ValueError, match="bypass de autenticação"):
        Settings(
            environment="production",
            api_access_token="operator-token",
            admin_access_token="admin-token",
            auth_organization_id=ORGANIZATION_ID,
            allow_development_auth_bypass=True,
        )
