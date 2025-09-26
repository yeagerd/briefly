"""
Delta token model for User Management Service.

Defines the model for storing email delta tokens per user and scope.
These tokens enable incremental sync for email data.
"""

from datetime import datetime, timezone
from typing import TYPE_CHECKING, Optional

from sqlalchemy import func
from sqlmodel import Column, DateTime, Field, Relationship, SQLModel

if TYPE_CHECKING:
    from services.user.models.user import User


class DeltaToken(SQLModel, table=True):
    """
    Delta token model for storing email sync tokens per user and scope.

    Each record represents a delta token for a specific user and email scope
    (combination of folder, query, etc.). The token is used for incremental
    sync to avoid re-fetching all emails on each sync.
    """

    __tablename__ = "delta_tokens"  # type: ignore[assignment]

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.id", ondelete="CASCADE", index=True)

    # Scope identifier: userId+folderId(+query) format
    scope_key: str = Field(max_length=500, index=True)

    # Provider-specific delta token
    delta_token: str = Field(max_length=1000)

    # Provider name (google, microsoft)
    provider: str = Field(max_length=50, index=True)

    # Last successful sync timestamp
    last_successful_sync_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_column=Column(DateTime(timezone=True), server_default=func.now()),
    )

    # Timestamps
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_column=Column(DateTime(timezone=True), server_default=func.now()),
    )
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_column=Column(
            DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
        ),
    )

    # Relationships
    user: Optional["User"] = Relationship(back_populates="delta_tokens")
