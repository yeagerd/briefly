"""
Base test class for PostgreSQL-based tests using gocept.testdb.

This module provides a reusable base class that services can inherit from
to get PostgreSQL test database functionality without duplicating setup code.
"""

import os
from contextlib import asynccontextmanager
from typing import AsyncGenerator

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from sqlmodel import SQLModel


class PostgresTestDB:
    """
    Base class for PostgreSQL-based tests using gocept.testdb.

    This class provides:
    - Per-test database isolation using unique database names
    - Async database engine and session management
    - Proper cleanup and teardown
    - Session fixtures for pytest
    """

    # Class-level database connection - shared across all test classes
    _engine = None
    _session_factory = None
    _database_url = None
    _test_databases = set()  # Track created test databases for cleanup

    @classmethod
    def setup_class(cls):
        """Set up the test database connection once for all test classes."""
        if PostgresTestDB._engine is None:
            # Initialize metadata if not set
            if not hasattr(cls, "metadata"):
                cls.metadata = SQLModel.metadata

            # Use existing Docker PostgreSQL container
            # Get connection details from environment or use defaults
            user = os.environ.get("POSTGRES_USER", "postgres")
            password = os.environ.get("POSTGRES_PASSWORD", "postgres")
            host = os.environ.get("POSTGRES_HOST", "localhost")
            port = os.environ.get("POSTGRES_PORT", "5432")

            # Use a single test database for all tests
            db_name = "testdb"

            # Construct async database URL for the test database
            PostgresTestDB._database_url = (
                f"postgresql+asyncpg://{user}:{password}@{host}:{port}/{db_name}"
            )

            # Create async engine
            PostgresTestDB._engine = create_async_engine(
                PostgresTestDB._database_url,
                echo=False,
                future=True,
                pool_pre_ping=True,  # Verify connections before use
                pool_recycle=300,  # Recycle connections every 5 minutes
                pool_size=5,  # Smaller pool size for tests
                max_overflow=10,  # Limit overflow connections
            )

            # Create session factory
            PostgresTestDB._session_factory = sessionmaker(
                PostgresTestDB._engine, class_=AsyncSession, expire_on_commit=False
            )

        # Set instance attributes
        cls._engine = PostgresTestDB._engine
        cls._session_factory = PostgresTestDB._session_factory
        cls._database_url = PostgresTestDB._database_url

    @classmethod
    async def create_test_database(cls):
        """Create the test database if it doesn't exist."""
        try:
            # Connect to default database to create test database if needed
            temp_engine = create_async_engine(
                f"postgresql+asyncpg://"
                f"{os.environ.get('POSTGRES_USER', 'postgres')}:"
                f"{os.environ.get('POSTGRES_PASSWORD', 'postgres')}@"
                f"{os.environ.get('POSTGRES_HOST', 'localhost')}:"
                f"{os.environ.get('POSTGRES_PORT', '5432')}/postgres",
                echo=False,
                future=True,
                isolation_level="AUTOCOMMIT",
            )

            async with temp_engine.connect() as conn:
                # Check if database exists
                result = await conn.execute(
                    text("SELECT 1 FROM pg_database WHERE datname = :db_name"),
                    {"db_name": "testdb"},
                )
                if not result.scalar():
                    await conn.execute(text("CREATE DATABASE testdb"))

            await temp_engine.dispose()

        except Exception as e:
            print(f"Warning: Could not ensure test database: {e}")

    @classmethod
    def teardown_class(cls):
        """Clean up the test database connection after all tests."""
        # Only clean up if this is the last test class
        if PostgresTestDB._engine:
            import asyncio

            asyncio.run(PostgresTestDB._engine.dispose())
            PostgresTestDB._engine = None
            PostgresTestDB._session_factory = None
            PostgresTestDB._database_url = None

    @property
    def database_url(self) -> str:
        """Get the current database URL."""
        if not self._database_url:
            raise RuntimeError("Database not set up. Call setup_class() first.")
        return self._database_url

    @property
    def engine(self) -> AsyncEngine:
        """Get the current async engine."""
        if not self._engine:
            raise RuntimeError("Database not set up. Call setup_class() first.")
        return self._engine

    @property
    def session_factory(self) -> sessionmaker:
        """Get the current session factory."""
        if not self._session_factory:
            raise RuntimeError("Database not set up. Call setup_class() first.")
        return self._session_factory

    async def create_tables(self):
        """Create all tables defined in the metadata."""
        async with self.engine.begin() as conn:
            await conn.run_sync(self.metadata.create_all, checkfirst=True)

    async def drop_tables(self):
        """Drop all tables defined in the metadata."""
        async with self.engine.begin() as conn:
            await conn.run_sync(self.metadata.drop_all, checkfirst=True)

    async def cleanup_test_data(self):
        """Clean up test data from all tables."""
        async with self.engine.begin() as conn:
            # Get all table names from metadata
            table_names = list(self.metadata.tables.keys())

            # Disable foreign key checks temporarily
            await conn.execute(text("SET session_replication_role = replica"))

            # Delete from all tables in reverse dependency order
            for table_name in reversed(table_names):
                await conn.execute(text(f"DELETE FROM {table_name}"))

            # Re-enable foreign key checks
            await conn.execute(text("SET session_replication_role = DEFAULT"))

    @asynccontextmanager
    async def get_session(self) -> AsyncGenerator[AsyncSession, None]:
        """Get a database session for testing."""
        async with self.session_factory() as session:
            try:
                yield session
            finally:
                await session.close()

    def get_session_fixture(self):
        """
        Get a pytest fixture for database sessions.

        Returns:
            A pytest fixture function that provides database sessions
        """

        @pytest.fixture
        async def session():
            async with self.get_session() as session:
                yield session

        return session

    def get_engine_fixture(self):
        """
        Get a pytest fixture for database engine.

        Returns:
            A pytest fixture function that provides database engine
        """

        @pytest.fixture
        def engine():
            return self.engine

        return engine
