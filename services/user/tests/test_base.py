"""
Base classes for User Management tests.

Provides common setup and teardown for all user management tests,
including required settings and HTTP call prevention.
"""

from services.common.test_utils import BaseSelectiveHTTPIntegrationTest


class BaseUserManagementTest(BaseSelectiveHTTPIntegrationTest):
    """Base class for all User Management tests with HTTP call prevention."""

    def setup_method(self, method: object) -> None:
        """Set up User Management test environment with required settings."""
        # Call parent setup to enable HTTP call detection
        super().setup_method(method)

        # Import user settings module
        import services.user.settings as user_settings

        # Store original settings singleton for cleanup
        self._original_settings = user_settings._settings

        # Create test settings instance
        from services.user.settings import Settings

        test_settings = Settings(
            db_url_user="sqlite:///:memory:",
            api_frontend_user_key="test-frontend-user-key",
            api_chat_user_key="test-chat-user-key",
            api_office_user_key="test-office-user-key",
            api_meetings_user_key="test-meetings-user-key",
            pagination_secret_key="test-pagination-secret-key",
            token_encryption_salt="dGVzdC1zYWx0LTE2Ynl0ZQ==",
            environment="test",
            debug=False,
        )

        # Set the test settings as the singleton
        user_settings._settings = test_settings

    def teardown_method(self, method: object) -> None:
        """Clean up User Management test environment."""
        # Call parent teardown to clean up HTTP patches
        super().teardown_method(method)

        # Restore original settings singleton
        import services.user.settings as user_settings

        user_settings._settings = self._original_settings


class BaseUserManagementIntegrationTest(BaseUserManagementTest):
    """Base class for User Management integration tests with full app setup."""

    def setup_method(self, method: object) -> None:
        """Set up User Management integration test environment."""
        # Call parent setup for settings and HTTP patches
        super().setup_method(method)

        # Import app after settings are configured
        from fastapi.testclient import TestClient

        from services.user.main import app

        self.app = app
        self.client = TestClient(app)

        # Set up authentication overrides
        self._override_auth()

    def _override_auth(self):
        """Override authentication for testing."""
        from services.user.auth.nextauth import get_current_user

        async def mock_get_current_user():
            return "user_123"

        self.app.dependency_overrides[get_current_user] = mock_get_current_user

    def teardown_method(self, method: object) -> None:
        """Clean up User Management integration test environment."""
        # Clear app overrides
        if hasattr(self, "app"):
            self.app.dependency_overrides.clear()

        # Call parent teardown
        super().teardown_method(method)
