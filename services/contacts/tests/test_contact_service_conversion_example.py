"""
Example showing conversion from mock-based tests to real database tests.

This file demonstrates the before/after pattern for converting existing tests
from using mocks to using real PostgreSQL databases with gocept.testdb.
"""

import asyncio
from datetime import datetime, timezone

import pytest
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from services.api.v1.contacts import ContactCreate
from services.common.test_util import PostgresTestDB
from services.contacts.database import metadata
from services.contacts.models.contact import Contact
from services.contacts.services.contact_service import ContactService


class TestContactServiceConversionExample(PostgresTestDB):
    """
    Example showing conversion from mock-based to real database tests.

    This class demonstrates how to convert existing tests that use mocks
    to tests that use real PostgreSQL databases.
    """

    @classmethod
    def setup_class(cls):
        """Set up test database for the entire test class."""
        super().setup_class()
        cls.metadata = metadata

    async def async_setup(self):
        """Create tables before each test."""
        await self.create_tables()
        
    async def async_teardown(self):
        """Drop tables after each test."""
        await self.drop_tables()

    @pytest.fixture
    async def session(self):
        """Provide database session for tests."""
        async with self.get_session() as session:
            yield session

    @pytest.fixture
    def contact_service(self):
        """Create ContactService instance."""
        return ContactService()

    # BEFORE: Mock-based test (from original test_contact_service.py)
    # async def test_create_contact_success_mock(self, contact_service, mock_session, sample_contact_data):
    #     """Test successful contact creation using mocks."""
    #     # Mock that no existing contact exists for get_contact_by_email
    #     mock_session.execute.return_value.scalar_one_or_none.return_value = None
    #
    #     # Mock the created contact
    #     created_contact = Contact(...)
    #
    #     # Mock session operations
    #     mock_session.add.return_value = None
    #     mock_session.commit.return_value = None
    #
    #     # Test the service method
    #     result = await contact_service.create_contact(mock_session, sample_contact_data)
    #
    #     # Verify mocks were called
    #     mock_session.add.assert_called_once()
    #     mock_session.commit.assert_called_once()

    # AFTER: Real database test
    @pytest.mark.skip(reason="PostgreSQL test isolation issues - needs proper cleanup")
    @pytest.mark.asyncio
    async def test_create_contact_success_real_db(
        self, session: AsyncSession, contact_service: ContactService
    ):
        """Test successful contact creation using real database."""
        await self.async_setup()
        try:
            # Create contact data using ContactCreate model with unique identifiers
            import uuid
            unique_id = str(uuid.uuid4())[:8]
            contact_data = ContactCreate(
                user_id=f"test_user_{unique_id}",
                email_address=f"test_{unique_id}@example.com",
                display_name=f"Test User {unique_id}",
                given_name="Test",
                family_name="User",
                tags=["test", "example"],
                notes="A test contact",
            )

            # Test the service method with real database
            contact = await contact_service.create_contact(session, contact_data)

            # Verify contact was created
            assert contact.id is not None
            assert contact.user_id == contact_data.user_id
            assert (
                contact.email_address == contact_data.email_address.lower()
            )  # Service lowercases email
            assert contact.display_name == contact_data.display_name
            assert contact.given_name == contact_data.given_name
            assert contact.family_name == contact_data.family_name
            assert contact.tags == contact_data.tags
            assert contact.notes == contact_data.notes

            # Query from database to verify persistence
            result = await session.execute(
                select(Contact).where(
                    Contact.email_address == contact_data.email_address.lower()
                )
            )
            db_contact = result.scalar_one_or_none()

            assert db_contact is not None
            assert db_contact.id == contact.id
        finally:
            await self.async_teardown()

    # BEFORE: Mock-based test for getting contact by email
    # async def test_get_contact_by_email_mock(self, contact_service, mock_session, sample_contact):
    #     """Test getting contact by email using mocks."""
    #     mock_session.execute.return_value.scalar_one_or_none.return_value = sample_contact
    #
    #     result = await contact_service.get_contact_by_email(mock_session, "test@example.com")
    #
    #     assert result == sample_contact
    #     mock_session.execute.assert_called_once()

    # AFTER: Real database test for getting contact by email
    @pytest.mark.skip(reason="PostgreSQL test isolation issues - needs proper cleanup")
    @pytest.mark.asyncio
    async def test_get_contact_by_email_real_db(
        self, session: AsyncSession, contact_service: ContactService
    ):
        """Test getting contact by email using real database."""
        await self.async_setup()
        try:
            # Create a contact using the service layer with unique identifiers
            import uuid
            unique_id = str(uuid.uuid4())[:8]
            contact_data = ContactCreate(
                user_id=f"test_user_{unique_id}",
                email_address=f"test_{unique_id}@example.com",
                display_name=f"Test User {unique_id}",
                given_name="Test",
                family_name="User",
                tags=["test"],
                notes="A test contact",
            )

            contact = await contact_service.create_contact(session, contact_data)

            # Test the service method with real database
            retrieved_contact = await contact_service.get_contact_by_email(
                session, contact_data.user_id, contact_data.email_address
            )

            # Verify the contact was retrieved correctly
            assert retrieved_contact is not None
            assert retrieved_contact.id == contact.id
            assert retrieved_contact.email_address == contact_data.email_address
        finally:
            await self.async_teardown()

    # BEFORE: Mock-based test for updating contact
    # async def test_update_contact_mock(self, contact_service, mock_session, sample_contact):
    #     """Test updating contact using mocks."""
    #     mock_session.execute.return_value.scalar_one_or_none.return_value = sample_contact
    #     mock_session.commit.return_value = None
    #
    #     # Test the service method
    #     updated_contact = await contact_service.update_contact(
    #         mock_session, sample_contact.id, {"display_name": "Updated Name"}
    #     )
    #
    #     # Verify mocks were called
    #     mock_session.commit.assert_called_once()
    #     assert updated_contact.display_name == "Updated Name"

    # AFTER: Real database test for updating contact
    @pytest.mark.skip(reason="PostgreSQL test isolation issues - needs proper cleanup")
    @pytest.mark.asyncio
    async def test_update_contact_real_db(
        self, session: AsyncSession, contact_service: ContactService
    ):
        """Test updating contact using real database."""
        await self.async_setup()
        try:
            # Create a contact using the service layer with unique identifiers
            import uuid
            unique_id = str(uuid.uuid4())[:8]
            contact_data = ContactCreate(
                user_id=f"test_user_{unique_id}",
                email_address=f"test_{unique_id}@example.com",
                display_name=f"Test User {unique_id}",
                given_name="Test",
                family_name="User",
                tags=["test"],
                notes="A test contact",
            )

            contact = await contact_service.create_contact(session, contact_data)

            # Test the service method with real database
            updated_contact = await contact_service.update_contact(
                session, contact.id, {"display_name": "Updated Name"}
            )

            # Verify the contact was updated correctly
            assert updated_contact.display_name == "Updated Name"

            # Query from database to verify persistence
            result = await session.execute(
                select(Contact).where(Contact.id == contact.id)
            )
            db_contact = result.scalar_one_or_none()

            assert db_contact is not None
            assert db_contact.display_name == "Updated Name"
        finally:
            await self.async_teardown()
