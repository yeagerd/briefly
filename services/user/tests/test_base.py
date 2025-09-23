"""
Base classes for User Management tests.

Provides common setup and teardown for all user management tests,
including required settings and HTTP call prevention.
"""

import os

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

        # Create temporary database file for tests that need file-based SQLite
        # Use tempfile.mkstemp for better control over file creation
        import os
        import tempfile

        # Create a unique temporary file in the system temp directory
        fd, self.db_path = tempfile.mkstemp(suffix=".db", prefix="briefly_test_")
        os.close(fd)  # Close the file descriptor immediately

        # Set required environment variables for User Management service
        # Standardize to sqlite+aiosqlite:// everywhere for consistency
        # Use absolute path and ensure proper URL encoding
        db_path_abs = os.path.abspath(self.db_path)
        os.environ["DB_URL_USER"] = f"sqlite+aiosqlite:///{db_path_abs}"
        os.environ["TOKEN_ENCRYPTION_SALT"] = "dGVzdC1zYWx0LTE2Ynl0ZQ=="
        os.environ["API_FRONTEND_USER_KEY"] = "test-frontend-key"
        os.environ["API_CHAT_USER_KEY"] = "test-chat-key"
        os.environ["API_OFFICE_USER_KEY"] = "test-office-key"
        os.environ["API_MEETINGS_USER_KEY"] = "test-meetings-key"
        os.environ["PAGINATION_SECRET_KEY"] = "test-pagination-secret-key"

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
            # OAuth credentials for testing
            google_client_id="test-google-client-id",
            google_client_secret="test-google-client-secret",
            azure_ad_client_id="test-microsoft-client-id",
            azure_ad_client_secret="test-microsoft-client-secret",
            oauth_redirect_uri="https://example.com/oauth/callback",
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

        # Clean up temporary database file
        if hasattr(self, "db_path") and os.path.exists(self.db_path):
            try:
                os.unlink(self.db_path)
            except OSError as e:
                # Log the error but don't fail the test
                print(
                    f"Warning: Could not remove temporary database file {self.db_path}: {e}"
                )


class BaseUserManagementIntegrationTest(BaseUserManagementTest):
    """Base class for User Management integration tests with full app setup."""

    def setup_method(self, method: object) -> None:
        """Set up User Management integration test environment."""
        # Call parent setup for settings and HTTP patches
        super().setup_method(method)

        # Initialize database tables for testing
        import asyncio

        from services.user.database import create_all_tables_for_testing

        try:
            asyncio.run(create_all_tables_for_testing())
        except RuntimeError:
            # If we're already in an event loop, create a task
            import concurrent.futures

            with concurrent.futures.ThreadPoolExecutor() as executor:
                future = executor.submit(asyncio.run, create_all_tables_for_testing())
                future.result()
        except Exception as e:
            # If database creation fails, provide more detailed error information
            print(f"Database creation failed: {e}")
            print(f"Database path: {self.db_path}")
            print(f"Database URL: {os.environ.get('DB_URL_USER')}")
            raise

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
