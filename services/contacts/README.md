# Contacts Service

The Contacts Service provides a unified contact management system that aggregates contacts from multiple sources through a bi-source architecture.

## Overview

The Contacts Service implements a sophisticated contact management system that combines:

1. **Office Contacts** - Synced from Google People API and Microsoft Graph contacts
2. **Discovered Contacts** - Automatically discovered from email, calendar, and document events

## Architecture

### Data Flow
```
Frontend → Gateway → Contacts Service → Office Service (read-through)
                ↓
         Contact Discovery Service
                ↓
         Email/Calendar/Document Events
```

### Key Components

- **ContactService**: Core business logic for contact CRUD operations
- **ContactDiscoveryService**: Automatic contact discovery from events
- **OfficeIntegrationService**: Read-through integration with Office Service
- **Contact Models**: SQLModel-based contact data structures

## Features

### Contact Management
- **Unified Contact List**: All contacts from both sources in a single interface
- **Source Tracking**: Each contact tracks its source services (`office`, `email`, `calendar`, `documents`)
- **Relevance Scoring**: Automatic relevance calculation based on interaction frequency and recency
- **Event Counting**: Track interaction counts by event type (email, calendar, documents)

### Discovery System
- **Automatic Discovery**: Contacts are automatically discovered from various event types
- **Event Processing**: Email, calendar, and document events are processed to extract contact information
- **Deduplication**: Smart deduplication prevents duplicate contacts across sources
- **Relevance Calculation**: Contacts are scored based on interaction patterns

### Office Integration
- **Read-Through Pattern**: Contacts Service reads office integration data without storing it
- **Provider Support**: Supports both Google People API and Microsoft Graph contacts
- **Real-time Sync**: Office contacts are fetched on-demand with caching

## API Endpoints

### Contact Management
- `GET /api/v1/contacts/me` - List contacts with filtering
- `POST /api/v1/contacts/me` - Create new contact
- `GET /api/v1/contacts/me/{id}` - Get specific contact
- `PUT /api/v1/contacts/me/{id}` - Update contact
- `DELETE /api/v1/contacts/me/{id}` - Delete contact

### Search and Statistics
- `GET /api/v1/contacts/me/search` - Search contacts
- `GET /api/v1/contacts/me/stats` - Get contact statistics
- `POST /api/v1/contacts/me/sync` - Force sync from office services

### Internal APIs
- `GET /api/v1/contacts/internal/{id}` - Internal contact retrieval
- `POST /api/v1/contacts/internal/discover` - Trigger contact discovery

## Data Models

### Contact
```python
class Contact(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: str = Field(index=True)
    email_address: str = Field(index=True)
    display_name: Optional[str] = None
    given_name: Optional[str] = None
    family_name: Optional[str] = None
    source_services: List[str] = Field(default_factory=list)
    event_counts: Dict[str, EmailContactEventCount] = Field(default_factory=dict)
    total_event_count: int = Field(default=0)
    relevance_score: float = Field(default=0.0)
    tags: List[str] = Field(default_factory=list)
    notes: Optional[str] = None
    # ... additional fields
```

### Source Services
- `office`: Contact from Google People API or Microsoft Graph
- `email`: Contact discovered from email events
- `calendar`: Contact discovered from calendar events
- `documents`: Contact discovered from document events

## Configuration

### Environment Variables
- `DB_URL_CONTACTS`: Database connection URL
- `API_FRONTEND_CONTACTS_KEY`: Frontend API key
- `API_CONTACTS_USER_KEY`: User service API key
- `API_CONTACTS_OFFICE_KEY`: Office service API key
- `OFFICE_SERVICE_URL`: Office service URL
- `USER_SERVICE_URL`: User service URL

### Database
- Uses SQLModel with async SQLAlchemy
- Supports both SQLite (development) and PostgreSQL (production)
- Automatic schema migrations via Alembic

## Development

### Setup
```bash
cd services/contacts
uv sync
```

### Running Tests
```bash
# Run all tests
python -m pytest

# Run specific test file
python -m pytest tests/test_contact_service.py

# Run with coverage
python -m pytest --cov=services.contacts
```

### Running the Service
```bash
# Development
uv run uvicorn services.contacts.main:app --reload --port 8007

# Production
uv run uvicorn services.contacts.main:app --host 0.0.0.0 --port 8007
```

## Integration

### Frontend Integration
The frontend uses the `ContactsClient` to interact with this service:

```typescript
import { contactsApi } from '@/api';

// Get contacts with filtering
const contacts = await contactsApi.getContacts(100, 0, ['work'], ['office', 'email']);

// Create new contact
const newContact = await contactsApi.createContact({
  email_address: 'user@example.com',
  display_name: 'John Doe',
  tags: ['work']
});
```

### Office Service Integration
The Contacts Service integrates with the Office Service using a read-through pattern:

```python
# Get office integration data for contacts
office_integration_data = await office_integration_service.get_office_integration_data(
    contacts, current_user_id
)
```

## Monitoring and Observability

### Logging
- Structured logging with request/response tracking
- Contact discovery events and statistics
- Error tracking and alerting

### Metrics
- Contact counts by source service
- Discovery success/failure rates
- API response times and error rates

## Security

### Authentication
- All endpoints require valid authentication
- Service-to-service authentication via API keys
- User isolation ensures users only access their own contacts

### Data Privacy
- Contact data is user-scoped and isolated
- No cross-user data access
- Secure handling of sensitive contact information

## Future Enhancements

- **Contact Merging**: Advanced duplicate detection and merging
- **Contact Enrichment**: Additional data sources and enrichment
- **Bulk Operations**: Batch contact operations
- **Contact Analytics**: Advanced analytics and insights
- **Export/Import**: Contact data export and import functionality
