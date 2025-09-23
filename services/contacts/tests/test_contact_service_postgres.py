"""
Integration tests for ContactService using real PostgreSQL database.

This test file demonstrates how to use gocept.testdb to test the ContactService
with a real PostgreSQL database instead of mocks.
"""

import asyncio
from datetime import datetime, timezone

import pytest
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlmodel import select

from services.common.test_util import PostgresTestDB
from services.contacts.database import metadata
from services.contacts.models.contact import Contact
from services.contacts.services.contact_service import ContactService


class TestContactServicePostgres(PostgresTestDB):
    """Test ContactService with real PostgreSQL database."""

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

    @pytest.fixture
    def contact_service(self):
        """Create ContactService instance."""
        return ContactService()

    @pytest.fixture
    def sample_contact_data(self):
        """Sample contact data for testing."""
        import uuid

        unique_id = str(uuid.uuid4())[:8]
        return {
            "user_id": f"test_user_{unique_id}",
            "email_address": f"test_{unique_id}@example.com",
            "display_name": f"Test User {unique_id}",
            "given_name": "Test",
            "family_name": "User",
            "tags": ["test", "example"],
            "notes": "A test contact",
        }

    @pytest.mark.asyncio
    async def test_create_contact_real_database(
        self,
        session: AsyncSession,
        contact_service: ContactService,
        sample_contact_data: dict,
    ):
        """Test creating a contact in the real database."""
        # Create contact data
        contact = Contact(
            user_id=sample_contact_data["user_id"],
            email_address=sample_contact_data["email_address"],
            display_name=sample_contact_data["display_name"],
            given_name=sample_contact_data["given_name"],
            family_name=sample_contact_data["family_name"],
            first_seen=datetime.now(timezone.utc),
            last_seen=datetime.now(timezone.utc),
            tags=sample_contact_data["tags"],
            notes=sample_contact_data["notes"],
        )

        # Add to database
        session.add(contact)
        await session.commit()
        await session.refresh(contact)

        # Verify contact was created
        assert contact.id is not None
        assert contact.user_id == sample_contact_data["user_id"]
        assert contact.email_address == sample_contact_data["email_address"]
        assert contact.display_name == sample_contact_data["display_name"]

        # Query from database to verify persistence
        result = await session.execute(
            select(Contact).where(
                Contact.email_address == sample_contact_data["email_address"]
            )
        )
        db_contact = result.scalar_one_or_none()

        assert db_contact is not None
        assert db_contact.id == contact.id
        assert db_contact.email_address == sample_contact_data["email_address"]

    @pytest.mark.asyncio
    async def test_get_contact_by_email_real_database(
        self,
        session: AsyncSession,
        contact_service: ContactService,
        sample_contact_data: dict,
    ):
        """Test retrieving a contact by email from the real database."""
        # Create and save a contact
        contact = Contact(
            user_id=sample_contact_data["user_id"],
            email_address=sample_contact_data["email_address"],
            display_name=sample_contact_data["display_name"],
            given_name=sample_contact_data["given_name"],
            family_name=sample_contact_data["family_name"],
            first_seen=datetime.now(timezone.utc),
            last_seen=datetime.now(timezone.utc),
            tags=sample_contact_data["tags"],
            notes=sample_contact_data["notes"],
        )

        session.add(contact)
        await session.commit()
        await session.refresh(contact)

        # Test the service method with real database
        retrieved_contact = await contact_service.get_contact_by_email(
            session,
            sample_contact_data["user_id"],
            sample_contact_data["email_address"],
        )

        # Verify the contact was retrieved correctly
        assert retrieved_contact is not None
        assert retrieved_contact.id == contact.id
        assert retrieved_contact.email_address == sample_contact_data["email_address"]
        assert retrieved_contact.display_name == sample_contact_data["display_name"]

    @pytest.mark.asyncio
    async def test_update_contact_real_database(
        self,
        session: AsyncSession,
        contact_service: ContactService,
        sample_contact_data: dict,
    ):
        """Test updating a contact in the real database."""
        # Create test data
        # Create initial contact
        contact = Contact(
            user_id=sample_contact_data["user_id"],
            email_address=sample_contact_data["email_address"],
            display_name=sample_contact_data["display_name"],
            given_name=sample_contact_data["given_name"],
            family_name=sample_contact_data["family_name"],
            first_seen=datetime.now(timezone.utc),
            last_seen=datetime.now(timezone.utc),
            tags=sample_contact_data["tags"],
            notes=sample_contact_data["notes"],
        )

        session.add(contact)
        await session.commit()
        await session.refresh(contact)

        # Update the contact
        new_display_name = "Updated Test User"
        contact.display_name = new_display_name
        contact.notes = "Updated notes"

        await session.commit()
        await session.refresh(contact)

        # Verify the update
        assert contact.display_name == new_display_name
        assert contact.notes == "Updated notes"

        # Query from database to verify persistence
        result = await session.execute(select(Contact).where(Contact.id == contact.id))
        updated_contact = result.scalar_one_or_none()

        assert updated_contact is not None
        assert updated_contact.display_name == new_display_name
        assert updated_contact.notes == "Updated notes"

    @pytest.mark.asyncio
    async def test_delete_contact_real_database(
        self,
        session: AsyncSession,
        contact_service: ContactService,
        sample_contact_data: dict,
    ):
        """Test deleting a contact from the real database."""
        # Create test data
        # Create a contact
        contact = Contact(
            user_id=sample_contact_data["user_id"],
            email_address=sample_contact_data["email_address"],
            display_name=sample_contact_data["display_name"],
            given_name=sample_contact_data["given_name"],
            family_name=sample_contact_data["family_name"],
            first_seen=datetime.now(timezone.utc),
            last_seen=datetime.now(timezone.utc),
            tags=sample_contact_data["tags"],
            notes=sample_contact_data["notes"],
        )

        session.add(contact)
        await session.commit()
        await session.refresh(contact)

        contact_id = contact.id
        assert contact_id is not None

        # Delete the contact
        await session.delete(contact)
        await session.commit()

        # Verify the contact was deleted
        result = await session.execute(select(Contact).where(Contact.id == contact_id))
        deleted_contact = result.scalar_one_or_none()

        assert deleted_contact is None

    @pytest.mark.asyncio
    async def test_contact_search_real_database(
        self, session: AsyncSession, contact_service: ContactService
    ):
        """Test searching contacts in the real database."""
        # Create test data
        # Create multiple contacts
        contacts_data = [
            {
                "user_id": "user1",
                "email_address": "alice@example.com",
                "display_name": "Alice Smith",
                "given_name": "Alice",
                "family_name": "Smith",
                "tags": ["work", "colleague"],
            },
            {
                "user_id": "user2",
                "email_address": "bob@example.com",
                "display_name": "Bob Johnson",
                "given_name": "Bob",
                "family_name": "Johnson",
                "tags": ["personal", "friend"],
            },
            {
                "user_id": "user3",
                "email_address": "charlie@example.com",
                "display_name": "Charlie Brown",
                "given_name": "Charlie",
                "family_name": "Brown",
                "tags": ["work", "manager"],
            },
        ]

        for data in contacts_data:
            contact = Contact(
                user_id=data["user_id"],
                email_address=data["email_address"],
                display_name=data["display_name"],
                given_name=data["given_name"],
                family_name=data["family_name"],
                first_seen=datetime.now(timezone.utc),
                last_seen=datetime.now(timezone.utc),
                tags=data["tags"],
            )
            session.add(contact)

        await session.commit()

        # Search for contacts with "work" tag using proper JSON query
        from sqlalchemy import text

        result = await session.execute(
            text(
                "SELECT * FROM contacts WHERE tags::text LIKE '%work%' AND user_id IN ('user1', 'user2', 'user3')"
            )
        )
        work_contacts = result.fetchall()

        assert len(work_contacts) == 2
        work_emails = {row.email_address for row in work_contacts}
        assert "alice@example.com" in work_emails
        assert "charlie@example.com" in work_emails

        # Search by display name
        result = await session.execute(
            select(Contact).where(Contact.display_name.contains("Alice"))
        )
        alice_contacts = result.scalars().all()

        assert len(alice_contacts) == 1
        assert alice_contacts[0].email_address == "alice@example.com"
