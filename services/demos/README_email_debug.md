# Email Debug Script

A comprehensive email debugging tool that retrieves emails directly from provider APIs (Microsoft, Google) bypassing Vespa for faster debugging of email classification, folder mapping, and priority issues.

## Features

- **Direct API Access**: Uses the same APIs as the backfill process for consistency
- **Multi-Provider Support**: Microsoft Graph API and Gmail API
- **Comprehensive Filtering**: Thread, category, priority, and folder filters
- **Detailed Output**: Shows both normalized fields and raw API data
- **Fast Debugging**: No need to run full backfill processes

## Usage

### Basic Usage
```bash
python -m services.demos.email_debug user@example.com
```

### Filtering Options

#### Folder Filtering
```bash
# Show only emails from specific folder
python -m services.demos.email_debug user@example.com --folder "Inbox"
python -m services.demos.email_debug user@example.com --folder "Sent Items"
python -m services.demos.email_debug user@example.com --folder "Junk Email"
```

#### Priority Filtering
```bash
# Show only priority emails
python -m services.demos.email_debug user@example.com --priority true

# Show only non-priority emails
python -m services.demos.email_debug user@example.com --priority false
```

#### Category Filtering
```bash
# Show only personal emails
python -m services.demos.email_debug user@example.com --category "CATEGORY_PERSONAL"

# Show only other emails
python -m services.demos.email_debug user@example.com --category "CATEGORY_OTHER"
```

#### Thread Filtering
```bash
# Show emails from specific thread
python -m services.demos.email_debug user@example.com --thread "thread_id_here"
```

#### Provider Selection
```bash
# Show emails from specific provider
python -m services.demos.email_debug user@example.com --providers microsoft
python -m services.demos.email_debug user@example.com --providers google
python -m services.demos.email_debug user@example.com --providers microsoft google
```

#### Limit Results
```bash
# Limit number of emails per provider
python -m services.demos.email_debug user@example.com --max-emails 5
```

### Combined Filters
```bash
# Show priority emails from Inbox only
python -m services.demos.email_debug user@example.com --folder "Inbox" --priority true

# Show personal emails from Microsoft only
python -m services.demos.email_debug user@example.com --providers microsoft --category "CATEGORY_PERSONAL"
```

## Output Format

The script displays comprehensive email information:

```
📄 Email ID: outlook_...
🧵 Thread: outlook_...
📝 Subject: Email subject
📧 From: sender@example.com
📮 To: recipient@example.com
📅 Date: 2025-08-13T22:30:41+00:00
📂 Folder: Inbox
⭐ Priority: True
🏷️  Category: CATEGORY_PERSONAL
📖 Read: True
📎 Attachments: False
🏷️  Labels: []
🔍 Raw parentFolderId: AQMkADAwATM0MDAAMi05MGNmLWZiZGItMDACLTAwCgAuAAADq8DmtUVEn0eL8EPGIzGukQEAuKEZks-7lUOmL1ahLfB9LQAAAgEMAAAA
🔍 Raw inferenceClassification: focused
```

## Debugging Use Cases

### 1. Folder Mapping Issues
```bash
# Check if emails have correct folder information
python -m services.demos.email_debug user@example.com --folder "Junk Email"
```

### 2. Priority Classification Issues
```bash
# Check priority classification for focused emails
python -m services.demos.email_debug user@example.com --priority true

# Check non-priority emails
python -m services.demos.email_debug user@example.com --priority false
```

### 3. Category Classification Issues
```bash
# Check if Microsoft emails are correctly categorized
python -m services.demos.email_debug user@example.com --providers microsoft --category "CATEGORY_PERSONAL"
```

### 4. Junk Email Filtering
```bash
# Check if junk emails are properly filtered
python -m services.demos.email_debug user@example.com --folder "Junk Email" --priority false
```

## Requirements

- Office service running and accessible
- Valid OAuth tokens for email providers
- Python dependencies: httpx, asyncio, structlog

## User ID Resolution

The script resolves user IDs by calling the user service API:
- Makes a request to `/v1/internal/users/exists` with the email address
- Retrieves the corresponding user ID from the response
- Uses this user ID for all subsequent API calls

**Requirements:**
- User service must be running and accessible
- The email address must exist in the user database
- Proper authentication may be required depending on your setup

If user ID resolution fails, the script will exit with a clear error message
indicating that the user needs to exist in the system.
