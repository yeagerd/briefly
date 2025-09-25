#!/usr/bin/env python3
"""
Email Debug Script - Direct API Email Retrieval and Analysis

This script retrieves emails directly from the email provider APIs (Microsoft, Google)
using the same APIs that the backfill process uses, allowing for faster debugging
of email classification, folder mapping, and priority issues.

Usage:
    python -m services.demos.email_debug user@example.com
    python -m services.demos.email_debug user@example.com --thread "thread_id"
    python -m services.demos.email_debug user@example.com --category "CATEGORY_PERSONAL"
    python -m services.demos.email_debug user@example.com --priority true
    python -m services.demos.email_debug user@example.com --folder "Inbox"
    python -m services.demos.email_debug user@example.com --max-emails 5
    python -m services.demos.email_debug user@example.com --providers microsoft gmail
"""

import argparse
import asyncio
import json
import sys
from datetime import datetime
from typing import Any, Dict, List, Optional, Set

import structlog

# Add the project root to the Python path
sys.path.insert(0, ".")

from services.office.core.api_client_factory import APIClientFactory
from services.office.core.normalizer import normalize_google_email, normalize_microsoft_email
from services.office.core.clients.google import GoogleAPIClient
from services.office.core.clients.microsoft import MicrosoftAPIClient
from services.office.models import Provider

# Configure logging
logger = structlog.get_logger(__name__)


class EmailDebugger:
    """Email debugger for direct API retrieval and analysis."""

    def __init__(self, user_email: str):
        self.user_email = user_email
        self.user_id = None
        self.factory = APIClientFactory()

    async def resolve_user_id(self) -> str:
        """Resolve email address to user ID using the same approach as vespa_backfill.py."""
        try:
            # Import settings to get API keys
            from services.demos.settings_demos import get_demo_settings
            settings = get_demo_settings()
            api_keys = settings.get_api_keys()
            
            import httpx
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{settings.user_service_url}/v1/internal/users/exists",
                    params={"email": self.user_email},
                    headers={"X-API-Key": api_keys["user"]},
                    timeout=10.0,
                )
                
                if response.status_code == 200:
                    data = response.json()
                    if data.get("exists", False):
                        self.user_id = data.get("user_id")
                        logger.info(f"Resolved user ID: {self.user_id} for email: {self.user_email}")
                        return self.user_id
                    else:
                        raise ValueError(f"No user found for email: {self.user_email}")
                else:
                    raise ValueError(f"Failed to resolve email: HTTP {response.status_code}")
                    
        except Exception as e:
            logger.error(f"Failed to resolve user ID for {self.user_email}: {e}")
            raise ValueError(
                f"Could not resolve user ID for email '{self.user_email}'. "
                f"Please ensure the user exists in the system and the user service is accessible. "
                f"Error: {e}"
            )

    async def get_microsoft_emails(
        self,
        max_emails: int = 10,
        thread_id: Optional[str] = None,
        category: Optional[str] = None,
        priority: Optional[bool] = None,
        folder: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """Get emails from Microsoft Graph API."""
        if not self.user_id:
            await self.resolve_user_id()

        client = await self.factory.create_client(self.user_id, "microsoft")
        async with client:
            microsoft_client = client

            # Get folder mapping first
            logger.info("Fetching Microsoft folder mapping...")
            mailboxes_response = await microsoft_client.get_mailboxes()
            folder_mapping = {}
            if "value" in mailboxes_response:
                for folder_info in mailboxes_response["value"]:
                    folder_id = folder_info.get("id")
                    folder_name = folder_info.get("displayName")
                    if folder_id and folder_name:
                        folder_mapping[folder_id] = folder_name

            logger.info(f"Found {len(folder_mapping)} folders: {list(folder_mapping.values())}")
            logger.info(f"Full folder mapping: {folder_mapping}")

            # Build filter for Microsoft Graph API
            filters = []
            if thread_id:
                # Remove 'outlook_' prefix if present for Microsoft Graph API
                clean_thread_id = thread_id.replace('outlook_', '') if thread_id.startswith('outlook_') else thread_id
                filters.append(f"conversationId eq '{clean_thread_id}'")
            if priority is not None:
                if priority:
                    filters.append("inferenceClassification eq 'focused'")
                else:
                    filters.append("inferenceClassification ne 'focused'")
            if folder:
                # Find folder ID from folder name
                folder_id = None
                for fid, fname in folder_mapping.items():
                    if fname.lower() == folder.lower():
                        folder_id = fid
                        break
                if folder_id:
                    filters.append(f"parentFolderId eq '{folder_id}'")
                else:
                    logger.warning(f"Folder '{folder}' not found in mapping")

            filter_str = " and ".join(filters) if filters else None

            # Get messages
            logger.info(f"Fetching Microsoft emails with filter: {filter_str}")
            messages_response = await microsoft_client.get_messages(
                top=max_emails,
                filter=filter_str
            )

            emails = []
            if "value" in messages_response:
                for raw_email in messages_response["value"]:
                    try:
                        # Normalize the email
                        normalized_email = normalize_microsoft_email(
                            raw_email,
                            self.user_email,
                            None,  # account_name
                            folder_mapping
                        )

                        # Convert to dict for display
                        email_dict = {
                            "id": normalized_email.id,
                            "thread_id": normalized_email.thread_id,
                            "subject": normalized_email.subject,
                            "from_address": normalized_email.from_address,
                            "to_addresses": [str(addr) for addr in normalized_email.to_addresses],
                            "date": normalized_email.date.isoformat() if normalized_email.date else None,
                            "is_read": normalized_email.is_read,
                            "has_attachments": normalized_email.has_attachments,
                            "is_priority": normalized_email.is_priority,
                            "derived_category": normalized_email.derived_category,
                            "folder": normalized_email.folder,
                            "provider": normalized_email.provider.value,
                            "labels": normalized_email.labels,
                            # Raw data for debugging
                            "raw_parent_folder_id": raw_email.get("parentFolderId"),
                            "raw_inference_classification": raw_email.get("inferenceClassification"),
                        }

                        # Apply category filter if specified
                        if category and normalized_email.derived_category != category:
                            continue

                        emails.append(email_dict)

                    except Exception as e:
                        logger.error(f"Failed to normalize Microsoft email: {e}")
                        continue

            return emails

    async def get_google_emails(
        self,
        max_emails: int = 10,
        thread_id: Optional[str] = None,
        category: Optional[str] = None,
        priority: Optional[bool] = None,
        folder: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """Get emails from Gmail API."""
        if not self.user_id:
            await self.resolve_user_id()

        client = await self.factory.create_client(self.user_id, "google")
        async with client:
            google_client = client

            # Build query for Gmail API
            query_parts = []
            if thread_id:
                # Remove 'gmail_' prefix if present for Gmail API
                clean_thread_id = thread_id.replace('gmail_', '') if thread_id.startswith('gmail_') else thread_id
                query_parts.append(f"thread:{clean_thread_id}")
            if priority is not None:
                if priority:
                    query_parts.append("-category:promotions")
                else:
                    query_parts.append("category:promotions")
            if folder:
                query_parts.append(f"in:{folder}")

            query = " ".join(query_parts) if query_parts else None

            # Get messages
            logger.info(f"Fetching Google emails with query: {query}")
            messages_response = await google_client.get_messages(
                max_results=max_emails,
                q=query
            )

            emails = []
            if "messages" in messages_response:
                for message_ref in messages_response["messages"]:
                    try:
                        # Get full message details
                        message_id = message_ref["id"]
                        message_response = await google_client.get_message(message_id)
                        
                        # Normalize the email
                        normalized_email = normalize_google_email(
                            message_response,
                            self.user_email,
                            None  # account_name
                        )

                        # Convert to dict for display
                        email_dict = {
                            "id": normalized_email.id,
                            "thread_id": normalized_email.thread_id,
                            "subject": normalized_email.subject,
                            "from_address": normalized_email.from_address,
                            "to_addresses": [str(addr) for addr in normalized_email.to_addresses],
                            "date": normalized_email.date.isoformat() if normalized_email.date else None,
                            "is_read": normalized_email.is_read,
                            "has_attachments": normalized_email.has_attachments,
                            "is_priority": normalized_email.is_priority,
                            "derived_category": normalized_email.derived_category,
                            "folder": normalized_email.folder,
                            "provider": normalized_email.provider.value,
                            "labels": normalized_email.labels,
                            # Raw data for debugging
                            "raw_label_ids": message_response.get("labelIds", []),
                        }

                        # Apply category filter if specified
                        if category and normalized_email.derived_category != category:
                            continue

                        emails.append(email_dict)

                    except Exception as e:
                        logger.error(f"Failed to normalize Google email: {e}")
                        continue

            return emails

    async def debug_emails(
        self,
        providers: List[str] = None,
        max_emails: int = 10,
        thread_id: Optional[str] = None,
        category: Optional[str] = None,
        priority: Optional[bool] = None,
        folder: Optional[str] = None,
    ) -> None:
        """Debug emails from specified providers."""
        if providers is None:
            providers = ["microsoft", "google"]

        print("=" * 80)
        print(f"🔍 EMAIL DEBUG SESSION: {self.user_email}")
        print("=" * 80)
        print(f"📧 User Email: {self.user_email}")
        print(f"👤 User ID: {self.user_id or 'Not resolved yet'}")
        print(f"🔧 Providers: {', '.join(providers)}")
        print(f"📊 Max Emails: {max_emails}")
        if thread_id:
            print(f"🧵 Thread ID: {thread_id}")
        if category:
            print(f"🏷️  Category Filter: {category}")
        if priority is not None:
            print(f"⭐ Priority Filter: {priority}")
        if folder:
            print(f"📂 Folder Filter: {folder}")
        print("=" * 80)

        all_emails = []

        for provider in providers:
            print(f"\n🔍 FETCHING EMAILS FROM {provider.upper()}")
            print("-" * 50)

            try:
                if provider == "microsoft":
                    emails = await self.get_microsoft_emails(
                        max_emails=max_emails,
                        thread_id=thread_id,
                        category=category,
                        priority=priority,
                        folder=folder,
                    )
                elif provider == "google":
                    emails = await self.get_google_emails(
                        max_emails=max_emails,
                        thread_id=thread_id,
                        category=category,
                        priority=priority,
                        folder=folder,
                    )
                else:
                    logger.warning(f"Unknown provider: {provider}")
                    continue

                print(f"✅ Retrieved {len(emails)} emails from {provider}")
                all_emails.extend(emails)

            except Exception as e:
                logger.error(f"Failed to fetch emails from {provider}: {e}")
                print(f"❌ Failed to fetch emails from {provider}: {e}")
                continue

        # Display all emails
        print(f"\n📋 EMAIL SUMMARY")
        print("=" * 80)
        print(f"Total emails retrieved: {len(all_emails)}")

        if not all_emails:
            print("No emails found matching the criteria.")
            return

        # Group by provider
        by_provider = {}
        for email in all_emails:
            provider = email["provider"]
            if provider not in by_provider:
                by_provider[provider] = []
            by_provider[provider].append(email)

        for provider, emails in by_provider.items():
            print(f"\n📧 {provider.upper()} EMAILS ({len(emails)})")
            print("-" * 50)

            for i, email in enumerate(emails, 1):
                print(f"\n  {i}. 📄 Email ID: {email['id']}")
                print(f"     🧵 Thread: {email['thread_id']}")
                print(f"     📝 Subject: {email['subject'] or 'No subject'}")
                print(f"     📧 From: {email['from_address']}")
                print(f"     📮 To: {', '.join(email['to_addresses'])}")
                print(f"     📅 Date: {email['date']}")
                print(f"     📂 Folder: {email['folder'] or 'Unknown'}")
                print(f"     ⭐ Priority: {email['is_priority']}")
                print(f"     🏷️  Category: {email['derived_category'] or 'None'}")
                print(f"     📖 Read: {email['is_read']}")
                print(f"     📎 Attachments: {email['has_attachments']}")
                print(f"     🏷️  Labels: {email['labels']}")

                # Show raw data for debugging
                if provider == "microsoft":
                    print(f"     🔍 Raw parentFolderId: {email.get('raw_parent_folder_id')}")
                    print(f"     🔍 Raw inferenceClassification: {email.get('raw_inference_classification')}")
                elif provider == "google":
                    print(f"     🔍 Raw labelIds: {email.get('raw_label_ids')}")

        print(f"\n✅ Debug session completed for {self.user_email}")


async def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="Email Debug Script - Direct API Email Retrieval and Analysis",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python -m services.demos.email_debug user@example.com
  python -m services.demos.email_debug user@example.com --thread "thread_id"
  python -m services.demos.email_debug user@example.com --category "CATEGORY_PERSONAL"
  python -m services.demos.email_debug user@example.com --priority true
  python -m services.demos.email_debug user@example.com --folder "Inbox"
  python -m services.demos.email_debug user@example.com --max-emails 5
  python -m services.demos.email_debug user@example.com --providers microsoft gmail
        """
    )

    parser.add_argument(
        "email",
        help="Email address of the user to debug"
    )

    parser.add_argument(
        "--providers",
        nargs="+",
        choices=["microsoft", "google"],
        default=["microsoft"],
        help="Email providers to query (default: microsoft)"
    )

    parser.add_argument(
        "--max-emails",
        type=int,
        default=10,
        help="Maximum number of emails to retrieve per provider (default: 10)"
    )

    parser.add_argument(
        "--thread",
        help="Filter by specific thread ID"
    )

    parser.add_argument(
        "--category",
        choices=["CATEGORY_PERSONAL", "CATEGORY_SOCIAL", "CATEGORY_PROMOTIONS", "CATEGORY_UPDATES", "CATEGORY_FORUMS", "CATEGORY_OTHER"],
        help="Filter by derived category"
    )

    parser.add_argument(
        "--priority",
        type=lambda x: x.lower() == "true",
        help="Filter by priority status (true=priority only, false=non-priority only)"
    )

    parser.add_argument(
        "--folder",
        help="Filter by folder name (e.g., 'Inbox', 'Sent Items', 'Junk Email')"
    )

    args = parser.parse_args()

    try:
        debugger = EmailDebugger(args.email)
        await debugger.debug_emails(
            providers=args.providers,
            max_emails=args.max_emails,
            thread_id=args.thread,
            category=args.category,
            priority=args.priority,
            folder=args.folder,
        )
    except KeyboardInterrupt:
        print("\n⚠️  Debug session interrupted by user")
    except Exception as e:
        logger.error(f"Debug session failed: {e}")
        print(f"❌ Debug session failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
