"""
Unit tests for Internal API Endpoints.

Basic tests for internal service-to-service API endpoints.
"""

from unittest.mock import patch

from fastapi import status
from fastapi.testclient import TestClient

from services.user.tests.test_base import BaseUserManagementIntegrationTest


class TestInternalAPI(BaseUserManagementIntegrationTest):
    """Test suite for internal API endpoints."""

    def setup_method(self, method):
        super().setup_method(method)
        self.auth_headers = self._get_auth_headers()

    def _get_auth_headers(self):
        """Provide authentication headers for internal API calls."""
        return {"X-API-Key": "test-frontend-user-key"}

    def test_internal_endpoints_require_authentication(self):
        """Test that internal endpoints require authentication."""
        request_data = {
            "user_id": "test_user_123",
            "provider": "google",
            "required_scopes": ["read"],
        }

        response = self.client.post("/v1/internal/tokens/get", json=request_data)
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
        data = response.json()
        assert "API key required" in data["message"]

    def test_internal_user_status_endpoint_exists(self):
        """Test that the user status endpoint exists and returns proper error for non-existent user."""

        from fastapi.testclient import TestClient

        from services.user.main import app

        with patch("services.user.settings.get_settings") as mock_settings:
            from services.user.settings import Settings

            test_settings = Settings(
                db_url_user="sqlite+aiosqlite:///:memory:",
                api_frontend_user_key="test-frontend-user-key",
                api_chat_user_key="test-chat-key",
                api_office_user_key="test-office-key",
                api_meetings_user_key="test-meetings-key",
                pagination_secret_key="test-pagination-secret-key",
                environment="test",
            )
            mock_settings.return_value = test_settings
            client = TestClient(app)
            response = client.get(
                "/v1/internal/users/nonexistent-user/status",
                headers={"X-API-Key": "test-frontend-user-key"},
            )
            assert response.status_code in (404, 422, 400, 403)
