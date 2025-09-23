# Frontend Contact Components

This directory contains React components for the bi-source contact management system.

## Overview

The contact components provide a comprehensive interface for managing contacts from multiple sources:

1. **Office Contacts** - Synced from Google People API and Microsoft Graph
2. **Discovered Contacts** - Automatically discovered from email, calendar, and document events

## Component Structure

```
components/contacts/
├── contact-card.tsx          # Individual contact display (legacy)
├── contact-list-item.tsx     # Compact contact list item
├── contact-filters.tsx       # Filtering and search controls
├── contact-actions.tsx       # Bulk actions and buttons
├── contact-form.tsx          # Create new contact form
├── edit-contact-form.tsx     # Edit existing contact form
├── contact-detail-modal.tsx  # Full contact details modal
├── discovery-settings.tsx    # Discovery management
├── contact-merger.tsx        # Duplicate merging interface
├── analytics-dashboard.tsx   # Contact analytics
├── source-filter.tsx         # Source service filtering
└── tags-filter.tsx           # Tag-based filtering
```

## Key Components

### ContactListItem
Compact list item component for displaying contacts in a vertical list.

**Features:**
- Contact avatar with initials
- Name, email, and phone display
- Source service indicators
- Action buttons (edit, delete, download)
- Click handler for opening detail modal

**Props:**
```typescript
interface ContactListItemProps {
  contact: Contact;
  onEdit?: (contact: Contact) => void;
  onDelete?: (contact: Contact) => void;
  onDownload?: (contact: Contact) => void;
  onClick?: (contact: Contact) => void;
}
```

### ContactForm
Form component for creating new contacts.

**Features:**
- Contact details input (name, email, phone, notes)
- Tag management with autocomplete
- Form validation and error handling
- Source selection (Office sync vs Local only)

**Props:**
```typescript
interface ContactFormProps {
  onSubmit: (contactData: ContactCreate) => void;
  onCancel: () => void;
  isLoading?: boolean;
  initialData?: Partial<ContactCreate>;
}
```

### EditContactForm
Form component for editing existing contacts.

**Features:**
- Pre-populated form with existing contact data
- Source service information display
- Merge options for duplicate contacts
- Conflict resolution for office vs discovered data

**Props:**
```typescript
interface EditContactFormProps {
  contact: Contact;
  onSubmit: (id: string, contactData: EmailContactUpdate) => void;
  onCancel: () => void;
  onMerge?: (contact: Contact) => void;
  isLoading?: boolean;
}
```

### ContactDetailModal
Modal component displaying full contact information.

**Features:**
- Complete contact information display
- Event history and counts
- Office integration status
- Edit and delete actions
- Source service breakdown

### ContactFilters
Filtering component for contact list.

**Features:**
- Source service filter (Office, Discovered, Both)
- Provider filter (Google, Microsoft)
- Relevance score range slider
- Event type filter (Email, Calendar, Documents)
- Tags filter with multi-select
- Search input for name/email/notes

### DiscoverySettings
Settings component for contact discovery management.

**Features:**
- Enable/disable discovery for specific event types
- Discovery frequency settings
- Discovery history and logs
- Manual discovery trigger
- Discovery performance metrics

### ContactMerger
Interface for merging duplicate contacts.

**Features:**
- Duplicate detection and suggestions
- Manual merge interface
- Merge conflict resolution
- Merge history tracking
- Bulk merge operations

### AnalyticsDashboard
Analytics component for contact insights.

**Features:**
- Contact source distribution charts
- Discovery trends over time
- Relevance score analysis
- Office sync status dashboard
- Contact growth metrics

## Data Flow

### Contact Loading
1. `ContactsView` component loads contacts via `useContacts` hook
2. `contactsApi.getContacts()` calls the Contacts Service
3. Contacts Service fetches discovered contacts from database
4. Contacts Service calls Office Service for office integration data
5. Data is merged and returned to frontend

### Contact Management
1. User interactions trigger appropriate handlers
2. API calls are made via `contactsApi` client
3. Success/error states are managed in component state
4. UI updates reflect the current state

### Source Service Mapping
The frontend handles source services as follows:

- `['office']` - Pure office contact (Google/Microsoft)
- `['email']` - Discovered from email events
- `['calendar']` - Discovered from calendar events
- `['documents']` - Discovered from document events
- `['office', 'email']` - Office contact also found in email events
- `['email', 'calendar']` - Contact found in multiple event types

## State Management

### ContactsContext
The `useContacts` hook provides:

```typescript
interface ContactsContextType {
  contacts: Contact[];
  loading: boolean;
  error: string | null;
  refreshContacts: () => Promise<void>;
  filterContacts: (filters: ContactFilters) => Contact[];
  availableSources: string[];
  sourceStats: { contacts: number; discovered: number; both: number };
}
```

### Modal State Management
Each view component manages modal state:

```typescript
const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
const [isContactDetailModalOpen, setIsContactDetailModalOpen] = useState(false);
const [isContactFormModalOpen, setIsContactFormModalOpen] = useState(false);
const [isDiscoverySettingsModalOpen, setIsDiscoverySettingsModalOpen] = useState(false);
```

## Styling

### Design System
Components use the existing design system:

- **Tailwind CSS** for styling
- **shadcn/ui** components for consistent UI
- **Lucide React** icons for actions and indicators
- **Responsive design** for mobile and desktop

### Source Service Indicators
Each source service has a distinct color scheme:

- **Office**: Blue (`bg-blue-100 text-blue-800`)
- **Email**: Green (`bg-green-100 text-green-800`)
- **Calendar**: Purple (`bg-purple-100 text-purple-800`)
- **Documents**: Orange (`bg-orange-100 text-orange-800`)

## Testing

### Component Testing
Components should be tested with:

- **React Testing Library** for component behavior
- **Jest** for unit tests
- **Mock API responses** for consistent testing
- **User interaction testing** for form validation and actions

### Test Structure
```typescript
// Example test structure
describe('ContactListItem', () => {
  it('displays contact information correctly', () => {
    // Test contact display
  });
  
  it('handles click events', () => {
    // Test click handlers
  });
  
  it('shows source service indicators', () => {
    // Test source service display
  });
});
```

## Performance Considerations

### Optimization
- **Memoization**: Use `useMemo` and `useCallback` for expensive operations
- **Virtualization**: Consider virtual scrolling for large contact lists
- **Lazy Loading**: Load contact details on demand
- **Debouncing**: Debounce search and filter inputs

### Caching
- **API Response Caching**: Cache contact data in context
- **Search Results**: Cache search results for repeated queries
- **Source Statistics**: Cache source statistics to avoid repeated calculations

## Accessibility

### ARIA Support
- **Semantic HTML**: Use proper HTML elements
- **ARIA Labels**: Provide descriptive labels for screen readers
- **Keyboard Navigation**: Support full keyboard navigation
- **Focus Management**: Proper focus management in modals

### Screen Reader Support
- **Contact Information**: Clear structure for screen readers
- **Action Buttons**: Descriptive button labels
- **Status Messages**: Announce state changes
- **Error Messages**: Clear error descriptions

## Future Enhancements

### Planned Features
- **Bulk Operations**: Select multiple contacts for bulk actions
- **Advanced Search**: Full-text search across all contact fields
- **Contact Import/Export**: CSV and vCard import/export
- **Contact Templates**: Predefined contact templates
- **Contact Sharing**: Share contacts with team members

### Performance Improvements
- **Infinite Scrolling**: Load contacts progressively
- **Search Suggestions**: Autocomplete for contact search
- **Offline Support**: Cache contacts for offline access
- **Real-time Updates**: WebSocket updates for contact changes
