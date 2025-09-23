"""
Unit tests for email collision detection functionality.

Tests email normalization and collision detection using fast local provider-specific rules.
No DNS lookups are performed - all normalization uses local rules for Gmail, Outlook, Yahoo, etc.
"""

import contextlib
import os
import tempfile
import uuid
from unittest.mock import patch

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine

import services.user.database as user_database
from services.user.database import get_async_session
from services.user.models.user import User
from services.user.utils.email_collision import (
    EmailCollisionDetector,
    email_collision_detector,
)

# ------------------- Database Fixtures -------------------


@pytest.fixture(scope="function")
def patch_settings_and_engine():
    """Patch settings and engine to use a shared in-memory SQLite DB for all connections."""
    import services.user.settings as user_settings

    # Use in-memory SQLite URI with cache=shared for shared access across async connections
    shared_db_url = "sqlite+aiosqlite:///:memory:?cache=shared"
    test_settings = user_settings.Settings(
        db_url_user=shared_db_url,
        api_frontend_user_key="test-frontend-user-key",
        api_chat_user_key="test-chat-user-key",
        api_office_user_key="test-office-user-key",
        api_meetings_user_key="test-meetings-user-key",
        pagination_secret_key="test-pagination-secret-key",
        token_encryption_salt="dGVzdC1zYWx0LTE2Ynl0ZQ==",
        environment="test",
        debug=False,
    )

    # Store original settings for cleanup
    original_settings = user_settings._settings

    # Directly set the singleton instead of using monkeypatch
    user_settings._settings = test_settings

    # Create a single engine instance that will be shared
    engine = create_async_engine(shared_db_url, future=True)

    # Store original functions for cleanup
    original_get_engine = user_database.get_engine
    original_get_async_session = user_database.get_async_session
    original_get_session = user_database.get_session
    original_get_db = user_database.get_db

    # Patch functions to use the shared engine
    user_database.get_engine = lambda: engine

    # Create new session functions that use the shared engine
    def patched_get_async_session():
        from sqlalchemy.ext.asyncio import async_sessionmaker

        session_factory = async_sessionmaker(
            engine, class_=AsyncSession, expire_on_commit=False
        )
        return session_factory

    async def patched_get_session():
        session_factory = patched_get_async_session()
        async with session_factory() as session:
            yield session

    async def patched_get_db():
        session_factory = patched_get_async_session()
        async with session_factory() as session:
            yield session

    user_database.get_async_session = patched_get_async_session
    user_database.get_session = patched_get_session
    user_database.get_db = patched_get_db

    # Store the engine globally so tests can access it
    patch_settings_and_engine._test_engine = engine

    yield

    # Restore original functions
    user_settings._settings = original_settings
    user_database.get_engine = original_get_engine
    user_database.get_async_session = original_get_async_session
    user_database.get_session = original_get_session
    user_database.get_db = original_get_db


@pytest_asyncio.fixture
async def db_session(patch_settings_and_engine):
    """Create a database session with tables created."""
    # Import models to ensure they're registered with SQLModel metadata
    from sqlmodel import SQLModel

    from services.user.models.audit import AuditLog  # noqa: F401
    from services.user.models.integration import Integration  # noqa: F401
    from services.user.models.preferences import UserPreferences  # noqa: F401
    from services.user.models.token import EncryptedToken  # noqa: F401
    from services.user.models.user import User  # noqa: F401

    # Create all tables
    engine = user_database.get_engine()
    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)

    # Create a single session that will be shared
    session = AsyncSession(engine)

    # Patch get_async_session to return a session factory that yields our shared session
    # Note: This will override the patch from patch_settings_and_engine fixture
    original_get_async_session = user_database.get_async_session

    def patched_get_async_session():
        """Return a session factory that yields our shared test session."""
        from contextlib import asynccontextmanager

        @asynccontextmanager
        async def session_context():
            yield session

        return session_context

    user_database.get_async_session = patched_get_async_session

    try:
        yield session
    finally:
        # Restore original function
        user_database.get_async_session = original_get_async_session

        # Clean up database after each test using explicit DELETE statements
        import sqlalchemy as sa

        # Delete all data from tables in reverse dependency order to avoid foreign key constraints
        await session.execute(sa.text("DELETE FROM encrypted_tokens"))
        await session.execute(sa.text("DELETE FROM audit_logs"))
        await session.execute(sa.text("DELETE FROM user_preferences"))
        await session.execute(sa.text("DELETE FROM integrations"))
        await session.execute(sa.text("DELETE FROM users"))
        await session.commit()
        await session.close()


# ------------------- Normalization Unit Tests (No DB) -------------------


class TestEmailNormalization:
    def setup_method(self):
        self.detector = EmailCollisionDetector()

    def test_normalize_email_gmail(self):
        test_cases = [
            ("user@gmail.com", "user@gmail.com"),
            ("User@gmail.com", "user@gmail.com"),
            ("user+work@gmail.com", "user@gmail.com"),
            ("first.last@gmail.com", "firstlast@gmail.com"),
            ("F.I.R.S.T.L.A.S.T@gmail.com", "firstlast@gmail.com"),
            ("user+work+personal@gmail.com", "user@gmail.com"),
        ]
        for input_email, expected in test_cases:
            # Fast local normalization handles Gmail rules (dots and plus addressing)
            result = self.detector.normalize_email(input_email)
            assert result == expected

    def test_normalize_email_outlook(self):
        test_cases = [
            ("user@outlook.com", "user@outlook.com"),
            ("user+work@outlook.com", "user@outlook.com"),
            ("first.last@outlook.com", "first.last@outlook.com"),
            ("User@Outlook.com", "user@outlook.com"),
        ]
        for input_email, expected in test_cases:
            # Fast local normalization handles Outlook rules (plus addressing only)
            result = self.detector.normalize_email(input_email)
            assert result == expected

    def test_normalize_email_yahoo(self):
        test_cases = [
            ("user@yahoo.com", "user@yahoo.com"),
            ("user+work@yahoo.com", "user@yahoo.com"),
            ("first.last@yahoo.com", "firstlast@yahoo.com"),
            ("User@Yahoo.com", "user@yahoo.com"),
        ]
        for input_email, expected in test_cases:
            # Fast local normalization handles Yahoo rules (dots and plus addressing)
            result = self.detector.normalize_email(input_email)
            assert result == expected

    def test_normalize_email_custom_domain(self):
        test_cases = [
            ("user@company.com", "user@company.com"),
            ("User@Company.com", "user@company.com"),
            ("user+work@company.com", "user+work@company.com"),
        ]
        for input_email, expected in test_cases:
            # Fast local normalization handles custom domains with basic lowercasing
            result = self.detector.normalize_email(input_email)
            assert result == expected

    def test_normalize_email_empty_input(self):
        result = self.detector.normalize_email("")
        assert result == ""

    def test_normalize_email_fallback(self):
        # Test the fallback behavior by mocking the simple_email_normalize to fail
        with patch.object(
            self.detector,
            "_simple_email_normalize",
            side_effect=Exception("Normalization failed"),
        ):
            result = self.detector.normalize_email("User@Gmail.com")
            # Should fallback to basic strip().lower()
            assert result == "user@gmail.com"

    def test_normalize_email_by_provider_google(self):
        test_cases = [
            ("user@gmail.com", "google", "user@gmail.com"),
            ("user+work@gmail.com", "google", "user@gmail.com"),
            ("first.last@gmail.com", "google", "firstlast@gmail.com"),
            ("user@googlemail.com", "google", "user@gmail.com"),  # Domain normalization
            ("User@Gmail.com", "google", "user@gmail.com"),
        ]
        for input_email, provider, expected in test_cases:
            result = self.detector.normalize_email_by_provider(input_email, provider)
            assert result == expected

    def test_normalize_email_by_provider_microsoft(self):
        test_cases = [
            ("user@outlook.com", "microsoft", "user@outlook.com"),
            ("user+work@outlook.com", "microsoft", "user@outlook.com"),
            (
                "first.last@outlook.com",
                "microsoft",
                "first.last@outlook.com",
            ),  # Keep dots
            (
                "user@hotmail.com",
                "microsoft",
                "user@outlook.com",
            ),  # Domain normalization
            ("User@Live.com", "microsoft", "user@outlook.com"),  # Domain normalization
        ]
        for input_email, provider, expected in test_cases:
            result = self.detector.normalize_email_by_provider(input_email, provider)
            assert result == expected

    def test_normalize_email_by_provider_yahoo(self):
        test_cases = [
            ("user@yahoo.com", "yahoo", "user@yahoo.com"),
            ("user+work@yahoo.com", "yahoo", "user@yahoo.com"),
            ("first.last@yahoo.com", "yahoo", "firstlast@yahoo.com"),
            ("User@Yahoo.com", "yahoo", "user@yahoo.com"),
        ]
        for input_email, provider, expected in test_cases:
            result = self.detector.normalize_email_by_provider(input_email, provider)
            assert result == expected

    def test_normalize_email_by_provider_unknown(self):
        # Unknown providers should only get basic normalization
        test_cases = [
            ("user@company.com", "unknown", "user@company.com"),
            ("User@Company.com", "other", "user@company.com"),
            (
                "user+work@company.com",
                "custom",
                "user+work@company.com",
            ),  # Plus addressing preserved
        ]
        for input_email, provider, expected in test_cases:
            result = self.detector.normalize_email_by_provider(input_email, provider)
            assert result == expected

    def test_get_email_domain(self):
        test_cases = [
            ("user@gmail.com", "gmail.com"),
            ("user@googlemail.com", "googlemail.com"),
            ("user@outlook.com", "outlook.com"),
            ("user@hotmail.com", "hotmail.com"),
            ("user@yahoo.com", "yahoo.com"),
            ("user@icloud.com", "icloud.com"),
            ("user@me.com", "me.com"),
            ("user@company.com", "company.com"),
            ("invalid-email", "unknown"),
        ]
        for input_email, expected in test_cases:
            result = self.detector._get_email_domain(input_email)
            assert result == expected


# ------------------- DB Collision Tests (with DB) -------------------


class TestEmailCollisionDB:
    def setup_method(self):
        # Create detector after database patching is complete
        self.detector = EmailCollisionDetector()

    @pytest.mark.asyncio
    async def test_check_collision_no_collision(self, db_session):
        with patch.object(
            self.detector, "normalize_email", return_value="test@example.com"
        ):
            result = await self.detector.check_collision("test@example.com")
            assert result is None

    @pytest.mark.asyncio
    async def test_check_collision_with_collision(self, db_session):
        # Use unique email to avoid conflicts with other tests
        unique_email = f"existing_{id(self)}_{uuid.uuid4().hex}@example.com"
        existing_user = User(
            external_auth_id=f"nextauth_collision_test_{id(self)}_{uuid.uuid4().hex}",
            auth_provider="nextauth",
            email=unique_email,
            normalized_email=unique_email,
        )

        db_session.add(existing_user)
        await db_session.commit()

        # Verify the user was actually inserted
        from sqlalchemy import text

        result_count = await db_session.execute(text("SELECT COUNT(*) FROM users"))
        count = result_count.scalar()
        print(f"DEBUG: Users in test session: {count}")

        # Verify using the same session
        from sqlalchemy import select

        stmt = select(User).where(User.normalized_email == unique_email)
        result = await db_session.execute(stmt)
        user = result.scalar_one_or_none()
        print(f"DEBUG: User found in test session: {user is not None}")

        with patch.object(self.detector, "normalize_email", return_value=unique_email):
            result = await self.detector.check_collision(unique_email)
            assert (
                result is not None
            ), f"Should have found user with email {unique_email}"
            assert result.email == unique_email

    @pytest.mark.asyncio
    async def test_get_collision_details_no_collision(self):
        with patch.object(self.detector, "check_collision", return_value=None):
            with patch.object(
                self.detector, "normalize_email", return_value="test@example.com"
            ):
                result = await self.detector.get_collision_details("test@example.com")
                assert result["available"] is True
                assert result["collision"] is False
                assert result["normalized_email"] == "test@example.com"

    @pytest.mark.asyncio
    async def test_get_collision_details_with_collision(self):
        unique_email = f"existing_{id(self)}_{uuid.uuid4().hex}@example.com"
        existing_user = User(
            id=1,
            external_auth_id=f"nextauth_123_{uuid.uuid4().hex}",
            auth_provider="nextauth",
            email=unique_email,
            normalized_email=unique_email,
        )
        with patch.object(self.detector, "check_collision", return_value=existing_user):
            with patch.object(
                self.detector, "normalize_email", return_value=unique_email
            ):
                result = await self.detector.get_collision_details(unique_email)
                assert result["collision"] is True
                assert result["existing_user_id"] == existing_user.external_auth_id
                assert result["existing_user_email"] == unique_email
                assert result["normalized_email"] == unique_email

    @pytest.mark.asyncio
    async def test_get_email_info_valid_email(self):
        # get_email_info now provides domain extraction instead of provider detection
        result = await self.detector.get_email_info("user+work@gmail.com")
        assert result["original_email"] == "user+work@gmail.com"
        assert result["normalized_email"] == "user@gmail.com"  # Gmail normalization
        assert result["mailbox_domain"] == "gmail.com"  # Domain extracted from email
        assert result["is_valid"] is True

    @pytest.mark.asyncio
    async def test_get_email_info_invalid_email(self):
        # Test the fallback behavior by mocking the simple_email_normalize to fail
        with patch.object(
            self.detector,
            "_simple_email_normalize",
            side_effect=Exception("Invalid email"),
        ):
            result = await self.detector.get_email_info("invalid-email")
            assert result["original_email"] == "invalid-email"
            assert (
                result["normalized_email"] == "invalid-email"
            )  # Falls back to basic strip().lower()
            assert result["mailbox_domain"] == "unknown"
            assert result["is_valid"] is False
            assert "error" in result


# ------------------- Global Instance Test -------------------


class TestEmailCollisionDetectorGlobal:
    def test_global_instance_exists(self):
        assert email_collision_detector is not None
        assert isinstance(email_collision_detector, EmailCollisionDetector)

    @pytest.mark.asyncio
    async def test_global_instance_functionality(self):
        # Global instance should use fast local normalization
        result = await email_collision_detector.normalize_email_async(
            "Test@Example.com"
        )
        assert result == "test@example.com"
