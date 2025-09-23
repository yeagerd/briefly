"""
Simple working PostgreSQL test for Contacts Service.

This is a minimal viable prototype that demonstrates real database testing.
"""

import asyncio
import os
from datetime import datetime, timezone

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from services.contacts.database import metadata
from services.contacts.models.contact import Contact


class TestSimplePostgres:
    """Simple PostgreSQL test that actually works."""

    @classmethod
    def setup_class(cls):
        """Set up test database once for the entire test class."""
        # Get PostgreSQL connection details
        cls.user = os.environ.get("POSTGRES_USER", "postgres")
        cls.password = os.environ.get("POSTGRES_PASSWORD", "postgres")
        cls.host = os.environ.get("POSTGRES_HOST", "localhost")
        cls.port = os.environ.get("POSTGRES_PORT", "5432")

        # Use a single test database for all tests
        cls.db_name = "testdb_simple"

        # Create the test database if it doesn't exist
        asyncio.run(cls._ensure_test_database())

        # Create engine for the test database
        cls.database_url = f"postgresql+asyncpg://{cls.user}:{cls.password}@{cls.host}:{cls.port}/{cls.db_name}"
        cls.engine = create_async_engine(cls.database_url, echo=False, future=True)

        # Create session factory
        cls.session_factory = sessionmaker(
            cls.engine, class_=AsyncSession, expire_on_commit=False
        )

        # Set metadata
        cls.metadata = metadata

    @classmethod
    def teardown_class(cls):
        """Clean up test database."""
        # Don't dispose the engine to avoid event loop conflicts
        # The engine will be cleaned up when the process exits
        print("ℹ️  Keeping engine alive to avoid event loop conflicts")

    @classmethod
    async def _ensure_test_database(cls):
        """Ensure the test database exists."""
        try:
            # Connect to default database to create test database if needed
            temp_engine = create_async_engine(
                f"postgresql+asyncpg://{cls.user}:{cls.password}@{cls.host}:{cls.port}/postgres",
                echo=False,
                future=True,
                isolation_level="AUTOCOMMIT",
            )

            async with temp_engine.connect() as conn:
                # Check if database exists
                result = await conn.execute(
                    text("SELECT 1 FROM pg_database WHERE datname = :db_name"),
                    {"db_name": cls.db_name},
                )
                if not result.scalar():
                    await conn.execute(text(f"CREATE DATABASE {cls.db_name}"))

            await temp_engine.dispose()

        except Exception as e:
            print(f"Warning: Could not ensure test database: {e}")

    @pytest.fixture
    async def session(self):
        """Provide database session for tests."""
        if self.session_factory is None:
            pytest.skip("Session factory not available")
        async with self.session_factory() as session:
            yield session

    @pytest.mark.asyncio
    async def test_create_contact_simple(self, session: AsyncSession):
        """Test creating a contact in the real database - simple version."""
        # Create tables with checkfirst to avoid enum conflicts
        async with self.engine.begin() as conn:
            await conn.run_sync(self.metadata.create_all, checkfirst=True)

        try:
            # Create a simple contact with unique identifiers
            import uuid

            unique_id = str(uuid.uuid4())[:8]
            contact = Contact(
                user_id=f"test_user_{unique_id}",
                email_address=f"simple_{unique_id}@example.com",
                display_name=f"Simple Test User {unique_id}",
                first_seen=datetime.now(timezone.utc),
                last_seen=datetime.now(timezone.utc),
                tags=["simple", "test"],
            )

            # Add to database
            session.add(contact)
            await session.commit()
            await session.refresh(contact)

            # Verify contact was created
            assert contact.id is not None
            assert contact.email_address == f"simple_{unique_id}@example.com"
            assert contact.display_name == f"Simple Test User {unique_id}"

            print(f"✅ Contact created successfully with ID: {contact.id}")

        finally:
            # Skip table cleanup to avoid timeouts
            # The test database persists between tests, which is fine for development
            print("ℹ️  Skipping table cleanup to avoid timeouts")

    @pytest.mark.asyncio
    async def test_query_contact_simple(self, session: AsyncSession):
        """Test querying a contact from the real database."""
        # Create tables with checkfirst to avoid enum conflicts
        async with self.engine.begin() as conn:
            await conn.run_sync(self.metadata.create_all, checkfirst=True)

        # Create a simple contact with unique identifiers
        import uuid

        unique_id = str(uuid.uuid4())[:8]
        contact = Contact(
            user_id=f"test_user_{unique_id}",
            email_address=f"simple_{unique_id}@example.com",
            display_name=f"Simple Test User {unique_id}",
            first_seen=datetime.now(timezone.utc),
            last_seen=datetime.now(timezone.utc),
            tags=["simple", "test"],
        )

        # Add to database
        session.add(contact)
        await session.commit()
        await session.refresh(contact)

        # Query the contact
        from sqlmodel import select

        result = await session.execute(
            select(Contact).where(
                Contact.email_address == f"simple_{unique_id}@example.com"
            )
        )
        queried_contact = result.scalar_one_or_none()

        # Verify the query worked
        assert queried_contact is not None
        assert queried_contact.id == contact.id
        assert queried_contact.email_address == f"simple_{unique_id}@example.com"
        assert queried_contact.display_name == f"Simple Test User {unique_id}"

        print(f"✅ Contact queried successfully: {queried_contact.display_name}")
