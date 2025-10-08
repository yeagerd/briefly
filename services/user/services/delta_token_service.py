"""
Delta Token Service for User Management Service.

Handles storage and retrieval of delta tokens for email incremental sync.
"""

from datetime import datetime, timedelta, timezone
from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from services.common.logging_config import get_logger
from services.user.models.delta_token import DeltaToken
from services.user.models.user import User

logger = get_logger(__name__)


class DeltaTokenService:
    """Service for managing delta tokens for email sync."""

    def __init__(self, db_session: AsyncSession):
        self.db_session = db_session

    async def get_delta_token(
        self, user_id: int, scope_key: str, provider: str
    ) -> Optional[DeltaToken]:
        """
        Get delta token for a specific user, scope, and provider.

        Args:
            user_id: User ID
            scope_key: Scope identifier (userId+folderId+query format)
            provider: Provider name (google, microsoft)

        Returns:
            DeltaToken if found, None otherwise
        """
        try:
            stmt = (
                select(DeltaToken)
                .where(DeltaToken.user_id == user_id)
                .where(DeltaToken.scope_key == scope_key)
                .where(DeltaToken.provider == provider)
            )
            result = await self.db_session.execute(stmt)
            return result.scalar_one_or_none()
        except Exception as e:
            logger.error(
                f"Error getting delta token for user {user_id}, scope {scope_key}: {e}"
            )
            return None

    async def store_delta_token(
        self,
        user_id: int,
        scope_key: str,
        provider: str,
        delta_token: str,
        last_successful_sync_at: Optional[datetime] = None,
    ) -> Optional[DeltaToken]:
        """
        Store or update delta token for a specific user, scope, and provider.

        Args:
            user_id: User ID
            scope_key: Scope identifier (userId+folderId+query format)
            provider: Provider name (google, microsoft)
            delta_token: Provider-specific delta token
            last_successful_sync_at: Last successful sync timestamp

        Returns:
            Stored DeltaToken if successful, None otherwise
        """
        try:
            # Check if token already exists
            existing_token = await self.get_delta_token(user_id, scope_key, provider)

            if existing_token:
                # Update existing token
                existing_token.delta_token = delta_token
                existing_token.last_successful_sync_at = (
                    last_successful_sync_at or datetime.now(timezone.utc)
                )
                existing_token.updated_at = datetime.now(timezone.utc)
                await self.db_session.commit()
                await self.db_session.refresh(existing_token)
                logger.info(
                    f"Updated delta token for user {user_id}, scope {scope_key}"
                )
                return existing_token
            else:
                # Create new token
                new_token = DeltaToken(
                    user_id=user_id,
                    scope_key=scope_key,
                    provider=provider,
                    delta_token=delta_token,
                    last_successful_sync_at=(
                        last_successful_sync_at or datetime.now(timezone.utc)
                    ),
                )
                self.db_session.add(new_token)
                await self.db_session.commit()
                await self.db_session.refresh(new_token)
                logger.info(
                    f"Created delta token for user {user_id}, scope {scope_key}"
                )
                return new_token
        except Exception as e:
            logger.error(
                f"Error storing delta token for user {user_id}, scope {scope_key}: {e}"
            )
            await self.db_session.rollback()
            return None

    async def delete_delta_token(
        self, user_id: int, scope_key: str, provider: str
    ) -> bool:
        """
        Delete delta token for a specific user, scope, and provider.

        Args:
            user_id: User ID
            scope_key: Scope identifier (userId+folderId+query format)
            provider: Provider name (google, microsoft)

        Returns:
            True if deleted successfully, False otherwise
        """
        try:
            token = await self.get_delta_token(user_id, scope_key, provider)
            if token:
                await self.db_session.delete(token)
                await self.db_session.commit()
                logger.info(
                    f"Deleted delta token for user {user_id}, scope {scope_key}"
                )
                return True
            return False
        except Exception as e:
            logger.error(
                f"Error deleting delta token for user {user_id}, scope {scope_key}: {e}"
            )
            await self.db_session.rollback()
            return False

    async def get_user_delta_tokens(self, user_id: int) -> List[DeltaToken]:
        """
        Get all delta tokens for a specific user.

        Args:
            user_id: User ID

        Returns:
            List of DeltaToken objects
        """
        try:
            stmt = select(DeltaToken).where(DeltaToken.user_id == user_id)
            result = await self.db_session.execute(stmt)
            return list(result.scalars().all())
        except Exception as e:
            logger.error(f"Error getting delta tokens for user {user_id}: {e}")
            return []

    async def cleanup_old_tokens(self, days_old: int = 30) -> int:
        """
        Clean up delta tokens older than specified days.

        Args:
            days_old: Number of days to keep tokens

        Returns:
            Number of tokens deleted
        """
        try:
            cutoff_date = datetime.now(timezone.utc) - timedelta(days=days_old)
            stmt = select(DeltaToken).where(DeltaToken.updated_at < cutoff_date)
            result = await self.db_session.execute(stmt)
            old_tokens = list(result.scalars().all())

            for token in old_tokens:
                await self.db_session.delete(token)

            await self.db_session.commit()
            logger.info(f"Cleaned up {len(old_tokens)} old delta tokens")
            return len(old_tokens)
        except Exception as e:
            logger.error(f"Error cleaning up old delta tokens: {e}")
            await self.db_session.rollback()
            return 0
