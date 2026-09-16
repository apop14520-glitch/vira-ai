"""Administrative session service with opaque browser tokens."""

import hmac
from collections.abc import Callable
from datetime import UTC, datetime, timedelta
from hashlib import sha256
from secrets import token_urlsafe
from uuid import uuid4

from app.modules.identity.domain import AdminCredential, AdminSession
from app.modules.identity.ports import CredentialRepository, SessionRepository
from app.security.passwords import create_password_hash, validate_new_password, verify_password
from app.settings import Settings


class PasswordChangeError(Exception):
    """Raised when a password change cannot be completed safely."""


class InitialSetupAlreadyCompleted(Exception):
    """Raised when an administrative credential already exists."""


class InitialSetupNotConfigured(Exception):
    """Raised when the runtime has no initial setup token."""


class InitialSetupRejected(Exception):
    """Raised when initial setup input cannot be accepted safely."""


class AdminSessionService:
    """Coordinate credential and session state without exposing raw secrets."""

    def __init__(
        self,
        *,
        credential_repository: CredentialRepository,
        session_repository: SessionRepository,
        settings: Settings,
        clock: Callable[[], datetime] | None = None,
        token_generator: Callable[[], str] | None = None,
    ) -> None:
        self.credential_repository = credential_repository
        self.session_repository = session_repository
        self.settings = settings
        self._clock = clock or (lambda: datetime.now(UTC))
        self._token_generator = token_generator or (lambda: token_urlsafe(32))

    def _now(self) -> datetime:
        return self._clock().astimezone(UTC).replace(microsecond=0)

    def _initial_password(self) -> str | None:
        configured = self.settings.admin_initial_password
        if configured is None:
            return None
        return configured.get_secret_value() if hasattr(configured, "get_secret_value") else str(configured)

    def _setup_token(self) -> str | None:
        configured = self.settings.admin_setup_token
        if configured is None:
            return None
        return configured.get_secret_value() if hasattr(configured, "get_secret_value") else str(configured)

    def _organization_id(self) -> str:
        organization_id = self.settings.auth_organization_id or self.settings.development_organization_id
        return str(organization_id)

    def ensure_initial_credential(self) -> AdminCredential | None:
        """Create the first credential once, if the runtime supplied one."""

        existing = self.credential_repository.get_any_credential()
        if existing is not None:
            return existing
        initial_password = self._initial_password()
        if initial_password is None:
            return None
        validate_new_password(initial_password)
        now = self._now()
        credential = AdminCredential(
            username=self.settings.admin_username,
            organization_id=self._organization_id(),
            password_hash=create_password_hash(initial_password),
            password_changed_at=now,
            updated_at=now,
        )
        if self.credential_repository.create_initial_credential(credential):
            return credential
        return self.credential_repository.get_any_credential()

    def initial_setup_required(self) -> bool:
        """Return whether no administrative credential exists yet."""

        return self.credential_repository.get_any_credential() is None

    def create_initial_credential(
        self,
        username: str,
        password: str,
        confirmation: str,
        setup_token: str,
    ) -> AdminCredential:
        """Create the sole initial credential after validating runtime and input secrets."""

        if not self.initial_setup_required():
            raise InitialSetupAlreadyCompleted("O acesso administrativo inicial já foi criado.")
        expected_token = self._setup_token()
        if expected_token is None:
            raise InitialSetupNotConfigured("A ativação inicial não está configurada.")
        if not hmac.compare_digest(setup_token.encode("utf-8"), expected_token.encode("utf-8")):
            raise InitialSetupRejected("A ativação inicial não pôde ser concluída.")
        if password != confirmation:
            raise InitialSetupRejected("A ativação inicial não pôde ser concluída.")
        normalized_username = username.strip()
        if not normalized_username:
            raise InitialSetupRejected("A ativação inicial não pôde ser concluída.")
        try:
            validate_new_password(password)
        except ValueError as error:
            raise InitialSetupRejected("A ativação inicial não pôde ser concluída.") from error

        now = self._now()
        credential = AdminCredential(
            username=normalized_username,
            organization_id=self._organization_id(),
            password_hash=create_password_hash(password),
            password_changed_at=now,
            updated_at=now,
        )
        if not self.credential_repository.create_initial_credential(credential):
            raise InitialSetupAlreadyCompleted("O acesso administrativo inicial já foi criado.")
        return credential

    def authenticate(self, username: str, password: str) -> AdminCredential | None:
        """Return a credential only for an exact username/password match."""

        credential = self.credential_repository.get_credential(username)
        if credential is None or not verify_password(password, credential.password_hash):
            return None
        return credential

    def create_session(self, credential: AdminCredential) -> tuple[AdminSession, str]:
        """Create a session and return the raw token only to the HTTP boundary."""

        raw_token = self._token_generator()
        now = self._now()
        session = AdminSession(
            session_id=str(uuid4()),
            token_hash=sha256(raw_token.encode("utf-8")).hexdigest(),
            username=credential.username,
            organization_id=credential.organization_id,
            created_at=now,
            expires_at=now + timedelta(seconds=self.settings.admin_session_ttl_seconds),
        )
        self.session_repository.create_session(session)
        return session, raw_token

    def resolve_session(self, raw_token: str | None) -> AdminSession | None:
        """Resolve only a live session from a raw cookie value."""

        if not raw_token:
            return None
        token_hash = sha256(raw_token.encode("utf-8")).hexdigest()
        return self.session_repository.get_active_session(token_hash, self._now())

    def revoke_session(self, session: AdminSession) -> None:
        """Revoke one session without exposing its token."""

        self.session_repository.revoke_session(session.session_id, revoked_at=self._now())

    def change_password(
        self,
        session: AdminSession,
        current_password: str,
        new_password: str,
        confirmation: str,
    ) -> AdminCredential:
        """Replace the credential and revoke every session in its organization."""

        credential = self.credential_repository.get_credential(session.username)
        if credential is None or not verify_password(current_password, credential.password_hash):
            raise PasswordChangeError("A senha não pôde ser alterada.")
        if new_password != confirmation:
            raise PasswordChangeError("A senha não pôde ser alterada.")
        try:
            validate_new_password(new_password)
        except ValueError as error:
            raise PasswordChangeError("A senha não pôde ser alterada. Verifique os requisitos.") from error

        now = self._now()
        changed = AdminCredential(
            username=credential.username,
            organization_id=credential.organization_id,
            password_hash=create_password_hash(new_password),
            password_changed_at=now,
            updated_at=now,
        )
        self.credential_repository.save_credential(changed)
        self.session_repository.revoke_all_sessions(credential.organization_id, revoked_at=now)
        return changed
