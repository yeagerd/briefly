"""
Database configuration for User Management Service.

Sets up database connection using SQLModel and SQLAlchemy.
"""

from typing import Any, AsyncGenerator, Optional

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlmodel import SQLModel

from services.common import get_async_database_url
from services.user.models.audit import AuditLog  # noqa: F401
from services.user.models.integration import Integration  # noqa: F401
from services.user.models.preferences import UserPreferences  # noqa: F401
from services.user.models.token import EncryptedToken  # noqa: F401

# Import all models so SQLModel can find them for table creation
from services.user.models.user import User  # noqa: F401

# Global engine and session factory - created once and reused
_engine: Optional[AsyncEngine] = None
_session_factory: Optional[async_sessionmaker[AsyncSession]] = None
_settings = None


def get_settings() -> Any:
    """Get or create the settings singleton."""
    global _settings
    if _settings is None:
        from services.user.settings import get_settings as _get_settings

        _settings = _get_settings()
    return _settings


def get_engine() -> AsyncEngine:
    """Get or create the shared database engine."""
    global _engine
    if _engine is None:
        settings = get_settings()
        db_url = settings.db_url_user

        # Prepare engine configuration based on database type
        connect_args: dict[str, float] = {}
        engine_kwargs = {
            "echo": settings.debug,
            "connect_args": connect_args,
        }

        if db_url.startswith("postgresql"):
            # asyncpg supports these timeout parameters directly
            # command_timeout sets the default timeout for operations (equivalent to statement_timeout)
            connect_args["command_timeout"] = 10.0  # 10 seconds
            # timeout sets the connection timeout
            connect_args["timeout"] = 30.0  # 30 seconds

            # Add connection pool settings for PostgreSQL
            engine_kwargs.update(
                {
                    "pool_size": 10,
                    "max_overflow": 20,
                    "pool_timeout": 30,
                    "pool_recycle": 3600,
                }
            )

        _engine = create_async_engine(get_async_database_url(db_url), **engine_kwargs)
    return _engine


def get_async_session() -> async_sessionmaker[AsyncSession]:
    """Get or create the shared session factory."""
    global _session_factory
    if _session_factory is None:
        engine = get_engine()
        _session_factory = async_sessionmaker(
            engine,
            class_=AsyncSession,
            expire_on_commit=False,
        )
    return _session_factory


# Database lifecycle management
async def get_session() -> AsyncGenerator[AsyncSession, None]:
    """Get async database session for dependency injection."""
    async_session = get_async_session()
    async with async_session() as session:
        yield session


# FastAPI-compatible dependency (alias for consistency with other services)
async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Get async database session for FastAPI dependency injection."""
    async_session = get_async_session()
    async with async_session() as session:
        yield session


# Database initialization is now handled by Alembic migrations
# Use 'alembic upgrade head' to initialize or update the database schema


# Export metadata for Alembic
metadata = SQLModel.metadata


async def create_all_tables_for_testing() -> None:
    """
    Create all database tables for testing. Creates tables if they don't exist.
    Use Alembic migrations in production.
    """
    engine = get_engine()
    async with engine.begin() as conn:
        # Just create tables - SQLAlchemy will skip if they already exist
        await conn.run_sync(SQLModel.metadata.create_all)


async def close_db() -> None:
    """Close database connections."""
    global _engine, _session_factory
    if _engine:
        await _engine.dispose()
        _engine = None
        _session_factory = None


async def reset_db() -> None:
    """Reset database connections (useful for testing)."""
    global _engine, _session_factory, _settings
    if _engine:
        await _engine.dispose()
        _engine = None
        _session_factory = None
        _settings = None


def reset_settings() -> None:
    """Reset settings singleton (useful for testing)."""
    global _settings
    _settings = None
