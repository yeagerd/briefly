# Briefly Demos

This directory contains various demonstration scripts and tools for testing and debugging the Briefly system.

## Available Demos

### Email & Office Integration
- **[email_debug.py](README_email_debug.md)** - Direct API email retrieval and debugging tool
- **[office.py](README_office.md)** - Office service integration demo
- **[office_full.py](README_office_full.md)** - Comprehensive office service demo

### Search & Indexing
- **[vespa_search.py](README_vespa.md)** - Vespa search and content dumping
- **[vespa_backfill.py](README_vespa.md)** - Vespa data backfill and ingestion
- **[vespa_synthetic.py](README_vespa.md)** - Synthetic data generation for Vespa

### Authentication & User Management
- **[user_management_demo.py](README_user_management.md)** - User management operations
- **[nextauth_test_server.py](README_nextauth_testing.md)** - NextAuth integration testing
- **[oauth_callback_handler.py](README_nextauth_testing.md)** - OAuth callback handling

### Chat & AI
- **[chat.py](README_chat.md)** - Chat service integration demo

### Utilities
- **demo_jwt_utils.py** - JWT utility functions for demos
- **nextauth_demo_utils.py** - NextAuth demo utilities
- **settings_demos.py** - Settings management demos
- **setup_pubsub_simple.py** - Simple Pub/Sub setup

## Quick Start

### Email Debugging
```bash
# Debug email classification and folder mapping
# Note: User must exist in the system and user service must be accessible
python -m services.demos.email_debug user@example.com --folder "Inbox" --priority true
```

### Vespa Operations
```bash
# Search and dump Vespa content
python -m services.demos.vespa_search user@example.com --dump

# Backfill data to Vespa
python -m services.demos.vespa_backfill user@example.com --max-emails 10
```

### Office Integration
```bash
# Test office service integration
python -m services.demos.office user@example.com
```

## Requirements

Most demos require:
- Office service running on port 8001
- User service running on port 8001
- Valid OAuth tokens for email providers
- Vespa running on port 8080 (for search demos)
- Pub/Sub emulator on port 8085 (for backfill demos)

## Getting Help

Each demo has its own detailed README with specific usage instructions and examples. Check the individual README files for comprehensive documentation.

## Common Use Cases

### Debugging Email Issues
1. Use `email_debug.py` to check email classification
2. Use `vespa_search.py` to verify Vespa indexing
3. Use `vespa_backfill.py` to re-index data

### Testing Office Integration
1. Use `office.py` for basic integration testing
2. Use `office_full.py` for comprehensive testing
3. Use `user_management_demo.py` for user operations

### Search and Indexing
1. Use `vespa_synthetic.py` to generate test data
2. Use `vespa_backfill.py` to ingest real data
3. Use `vespa_search.py` to query and debug
