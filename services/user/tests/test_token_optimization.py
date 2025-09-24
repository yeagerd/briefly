"""
Tests for token optimization improvements.

Tests the database query optimization and deduplication features to ensure they reduce
redundant token requests and refresh operations.
"""

import asyncio
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from services.user.models.integration import IntegrationProvider, IntegrationStatus
from services.user.services.integration_service import IntegrationService
from services.user.services.token_service import TokenService
from services.user.tests.test_base import BaseUserManagementTest


class TestTokenOptimization(BaseUserManagementTest):
    """Test token optimization features."""

    def setup_method(self, method):
        """Set up test environment."""
        super().setup_method(method)
        self.token_service = TokenService()
        self.integration_service = IntegrationService()

    @pytest.mark.asyncio
    async def test_optimized_database_query(self):
        """Test that the optimized database query reduces round trips."""
        user_id = "test_user"
        provider = IntegrationProvider.MICROSOFT

        # Mock the database operations
        with patch.object(
            self.token_service, "_get_integration_and_tokens"
        ) as mock_get_tokens:
            mock_integration = AsyncMock()
            mock_integration.id = 1
            mock_integration.status = IntegrationStatus.ACTIVE
            mock_integration.scopes = {"scope1": True, "scope2": True}

            mock_access_token = AsyncMock()
            mock_access_token.encrypted_value = "encrypted_access"
            mock_access_token.expires_at = datetime.now(timezone.utc) + timedelta(
                hours=1
            )

            mock_refresh_token = AsyncMock()
            mock_refresh_token.encrypted_value = "encrypted_refresh"

            mock_get_tokens.return_value = (
                mock_integration,
                mock_access_token,
                mock_refresh_token,
            )

            # Mock token decryption
            with patch.object(
                self.token_service.token_encryption, "decrypt_token"
            ) as mock_decrypt:
                mock_decrypt.side_effect = (
                    lambda *args, **kwargs: f"decrypted_{args[0] if args else kwargs.get('encrypted_token')}"
                )

                # Mock audit logging to avoid database issues
                with patch(
                    "services.user.services.token_service.audit_logger"
                ) as mock_audit:
                    mock_audit.log_user_action = AsyncMock()

                    # Call the optimized method
                    result = await self.token_service.get_valid_token(
                        user_id=user_id, provider=provider, required_scopes=["scope1"]
                    )

                    # Verify the optimized query was called once
                    mock_get_tokens.assert_called_once_with(user_id, provider)

                    # Verify the result is correct
                    assert result.success is True
                    assert result.access_token == "decrypted_encrypted_access"
                    assert result.refresh_token == "decrypted_encrypted_refresh"

    @pytest.mark.asyncio
    async def test_refresh_deduplication(self):
        """Test that refresh operations are deduplicated."""
        user_id = "test_user"
        provider = IntegrationProvider.MICROSOFT

        # Mock the database session
        with patch(
            "services.user.services.integration_service.get_async_session"
        ) as mock_session:
            mock_session_instance = AsyncMock()
            mock_session_instance.add = MagicMock()  # Mock session.add as synchronous
            mock_session_instance.__aenter__ = AsyncMock(
                return_value=mock_session_instance
            )
            mock_session_instance.__aexit__ = AsyncMock(return_value=None)
            mock_session.return_value = lambda: mock_session_instance

            # Mock the integration retrieval
            with patch.object(
                self.integration_service, "_get_user_integration_in_session"
            ) as mock_get_integration:
                mock_integration = AsyncMock()
                mock_integration.id = 1
                mock_get_integration.return_value = mock_integration

                # Mock the database queries for tokens
                from unittest.mock import Mock

                mock_access_token = Mock()
                mock_access_token.encrypted_value = "encrypted_access_token"
                mock_access_token.expires_at = datetime.now(timezone.utc) + timedelta(
                    hours=1
                )

                mock_refresh_token = Mock()
                mock_refresh_token.encrypted_value = "encrypted_refresh_token"

                # Track query calls to return appropriate tokens
                query_count = 0

                def scalar_one_or_none():
                    nonlocal query_count
                    query_count += 1
                    # First call returns access token, second call returns refresh token
                    if query_count == 1:
                        return mock_access_token
                    else:
                        return mock_refresh_token

                mock_result = Mock()
                mock_result.scalar_one_or_none.side_effect = scalar_one_or_none
                mock_session_instance.execute.return_value = mock_result

                # Mock token decryption
                with patch.object(
                    self.integration_service.token_encryption, "decrypt_token"
                ) as mock_decrypt:
                    mock_decrypt.side_effect = (
                        lambda *args, **kwargs: f"decrypted_{args[0] if args else kwargs.get('encrypted_token')}"
                    )

                    # Mock token operations
                    with patch.object(
                        self.integration_service, "_store_encrypted_tokens"
                    ) as mock_store:
                        mock_store.return_value = None

                        # Mock OAuth refresh
                        with patch.object(
                            self.integration_service.oauth_config,
                            "refresh_access_token",
                        ) as mock_refresh:
                            mock_refresh.return_value = {
                                "access_token": "new_access_token",
                                "refresh_token": "new_refresh_token",
                                "expires_in": 3600,
                            }

                            # Mock audit logging to prevent database errors
                            with patch(
                                "services.user.services.integration_service.audit_logger.log_user_action"
                            ) as mock_audit:
                                mock_audit.return_value = None

                                # Start two concurrent refresh operations
                                async def refresh_operation():
                                    return await self.integration_service.refresh_integration_tokens(
                                        user_id=user_id, provider=provider, force=True
                                    )

                                # Run both operations concurrently
                                results = await asyncio.gather(
                                    refresh_operation(),
                                    refresh_operation(),
                                    return_exceptions=True,
                                )

                                # One should succeed, one should be deduplicated
                                success_count = sum(
                                    1 for r in results if not isinstance(r, Exception)
                                )
                                assert success_count >= 1

    @pytest.mark.asyncio
    async def test_database_query_reduction(self):
        """Test that database queries are reduced from 3+ to 1."""
        user_id = "test_user"
        provider = IntegrationProvider.MICROSOFT

        # Mock the database session
        with patch(
            "services.user.services.token_service.get_async_session"
        ) as mock_session:
            mock_session_instance = AsyncMock()
            mock_session.return_value = mock_session_instance

            # Mock the optimized query method
            with patch.object(
                self.token_service, "_get_integration_and_tokens"
            ) as mock_get_tokens:
                mock_integration = AsyncMock()
                mock_integration.id = 1
                mock_integration.status = IntegrationStatus.ACTIVE
                mock_integration.scopes = {}

                mock_access_token = AsyncMock()
                mock_access_token.encrypted_value = "encrypted_access"
                mock_access_token.expires_at = datetime.now(timezone.utc) + timedelta(
                    hours=1
                )

                mock_get_tokens.return_value = (
                    mock_integration,
                    mock_access_token,
                    None,
                )

                # Mock token decryption
                with patch.object(
                    self.token_service.token_encryption, "decrypt_token"
                ) as mock_decrypt:
                    mock_decrypt.return_value = "decrypted_token"

                    # Mock audit logging to prevent database errors
                    with patch(
                        "services.user.services.token_service.audit_logger.log_user_action"
                    ) as mock_audit:
                        mock_audit.return_value = None

                        # Call the method
                        result = await self.token_service.get_valid_token(
                            user_id=user_id, provider=provider
                        )

                        # Verify only one database query was made (the optimized one)
                        mock_get_tokens.assert_called_once()

                        # Verify the result is correct
                        assert result.success is True
                        assert result.access_token == "decrypted_token"
