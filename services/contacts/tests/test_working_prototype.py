"""
Working PostgreSQL test prototype for Contacts Service.

This demonstrates the core functionality without the cleanup issues.
"""

import asyncio
import os
from datetime import datetime, timezone

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from services.common.test_util import PostgresTestDB
from services.contacts.database import metadata
from services.contacts.models.contact import Contact


class TestWorkingPrototype(PostgresTestDB):
    """Working PostgreSQL test prototype."""

    @classmethod
    def setup_class(cls):
        """Set up test database for the entire test class."""
        super().setup_class()
        cls.metadata = metadata
        # Create the test database
        asyncio.run(cls.create_test_database())

    @classmethod
    def teardown_class(cls):
        """Clean up test database after the entire test class."""
        super().teardown_class()

    @pytest.fixture
    async def test_engine(self):
        """Create a fresh engine for each test."""
        engine = create_async_engine(
            self.database_url,
            echo=False,
            future=True,
            pool_pre_ping=True,
            pool_recycle=300,
            pool_size=1,  # Single connection for tests
            max_overflow=0,  # No overflow connections
        )

        # Create tables
        async with engine.begin() as conn:
            await conn.run_sync(self.metadata.create_all, checkfirst=True)

        yield engine

        # Cleanup
        await engine.dispose()

    @pytest.fixture
    async def session(self, test_engine):
        """Provide database session for tests."""
        from sqlalchemy.orm import sessionmaker

        # Create session factory with test engine
        session_factory = sessionmaker(
            test_engine, class_=AsyncSession, expire_on_commit=False
        )

        async with session_factory() as session:
            yield session

    @pytest.mark.asyncio
    async def test_create_contact_working(self, session: AsyncSession):
        """Test creating a contact - working version."""
        # Create a simple contact with unique identifiers
        import uuid

        unique_id = str(uuid.uuid4())[:8]
        contact = Contact(
            user_id=f"test_user_{unique_id}",
            email_address=f"working_{unique_id}@example.com",
            display_name=f"Working Test User {unique_id}",
            first_seen=datetime.now(timezone.utc),
            last_seen=datetime.now(timezone.utc),
            tags=["working", "test"],
        )

        # Add to database
        session.add(contact)
        await session.commit()
        await session.refresh(contact)

        # Verify contact was created
        assert contact.id is not None
        assert contact.email_address == f"working_{unique_id}@example.com"
        assert contact.display_name == f"Working Test User {unique_id}"

        print(f"✅ Contact created successfully with ID: {contact.id}")

    @pytest.mark.asyncio
    async def test_query_contact_working(self, session: AsyncSession):
        """Test querying a contact - working version."""
        # Create a contact with unique identifiers
        import uuid

        unique_id = str(uuid.uuid4())[:8]
        contact = Contact(
            user_id=f"query_user_{unique_id}",
            email_address=f"query_{unique_id}@example.com",
            display_name=f"Query Test User {unique_id}",
            first_seen=datetime.now(timezone.utc),
            last_seen=datetime.now(timezone.utc),
            tags=["query", "test"],
        )

        # Add to database
        session.add(contact)
        await session.commit()
        await session.refresh(contact)

        # Query the contact
        from sqlmodel import select

        result = await session.execute(
            select(Contact).where(
                Contact.email_address == f"query_{unique_id}@example.com"
            )
        )
        queried_contact = result.scalar_one_or_none()

        # Verify the query worked
        assert queried_contact is not None
        assert queried_contact.id == contact.id
        assert queried_contact.email_address == f"query_{unique_id}@example.com"

        print(f"✅ Contact queried successfully: {queried_contact.display_name}")
