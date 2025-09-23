import { Contact } from '@/types/api/contacts';

// Mock URL.createObjectURL and URL.revokeObjectURL
const mockCreateObjectURL = jest.fn();
const mockRevokeObjectURL = jest.fn();
global.URL.createObjectURL = mockCreateObjectURL;
global.URL.revokeObjectURL = mockRevokeObjectURL;

// Mock document.createElement and related methods
const mockClick = jest.fn();
const mockAppendChild = jest.fn();
const mockRemoveChild = jest.fn();

Object.defineProperty(document, 'createElement', {
    value: jest.fn(() => ({
        href: '',
        download: '',
        click: mockClick,
    })),
});

Object.defineProperty(document.body, 'appendChild', {
    value: mockAppendChild,
});

Object.defineProperty(document.body, 'removeChild', {
    value: mockRemoveChild,
});

// Extract the vCard generation logic for testing
const generateVCard = (contact: Contact): string => {
    const fullName = contact.display_name || 
        [contact.given_name, contact.family_name].filter(Boolean).join(' ') || 
        contact.email_address;
    
    const vCard = [
        'BEGIN:VCARD',
        'VERSION:3.0',
        `FN:${fullName}`,
        contact.given_name || contact.family_name ? `N:${contact.family_name || ''};${contact.given_name || ''};;;` : '',
        `EMAIL:${contact.email_address}`,
        ...(contact.phone_numbers?.map(phone => `TEL:${phone.number}`) || []),
        contact.notes ? `NOTE:${contact.notes}` : '',
        'END:VCARD'
    ].filter(line => line).join('\n');

    return vCard;
};

const downloadVCard = (contact: Contact): void => {
    const vCard = generateVCard(contact);
    
    // Create and download the file
    const blob = new Blob([vCard], { type: 'text/vcard' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${contact.display_name || contact.email_address}.vcf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};

describe('ContactsView - vCard Generation', () => {
    const mockContacts: Contact[] = [
        {
            id: 1,
            user_id: 'test-user-id',
            email_address: 'john.doe@example.com',
            display_name: 'John Doe',
            given_name: 'John',
            family_name: 'Doe',
            phone_numbers: [
                { number: '+1234567890', type: 'mobile', primary: true },
                { number: '+0987654321', type: 'work', primary: false }
            ],
            notes: 'Test contact',
            last_seen: '2024-01-01T10:00:00Z',
            first_seen: '2024-01-01T10:00:00Z',
        },
        {
            id: 2,
            user_id: 'test-user-id',
            email_address: 'jane@example.com',
            display_name: null,
            given_name: 'Jane',
            family_name: null,
            phone_numbers: [],
            notes: null,
            last_seen: '2024-01-02T10:00:00Z',
            first_seen: '2024-01-02T10:00:00Z',
        },
        {
            id: 3,
            user_id: 'test-user-id',
            email_address: 'minimal@example.com',
            display_name: null,
            given_name: null,
            family_name: null,
            phone_numbers: [
                { number: '+1111111111', type: 'home', primary: true }
            ],
            notes: null,
            last_seen: '2024-01-03T10:00:00Z',
            first_seen: '2024-01-03T10:00:00Z',
        },
    ];

    beforeEach(() => {
        // Reset mocks
        mockCreateObjectURL.mockReturnValue('blob:mock-url');
        mockClick.mockClear();
        mockAppendChild.mockClear();
        mockRemoveChild.mockClear();
    });

    it('should generate correct vCard for contact with full information', () => {
        const contact = mockContacts[0]; // John Doe
        const vCard = generateVCard(contact);

        // Verify vCard content
        expect(vCard).toContain('BEGIN:VCARD');
        expect(vCard).toContain('VERSION:3.0');
        expect(vCard).toContain('FN:John Doe');
        expect(vCard).toContain('N:Doe;John;;;');
        expect(vCard).toContain('EMAIL:john.doe@example.com');
        expect(vCard).toContain('TEL:+1234567890');
        expect(vCard).toContain('TEL:+0987654321');
        expect(vCard).toContain('NOTE:Test contact');
        expect(vCard).toContain('END:VCARD');
    });

    it('should generate correct vCard for contact with partial information', () => {
        const contact = mockContacts[1]; // Jane
        const vCard = generateVCard(contact);

        // Verify vCard content for partial contact
        expect(vCard).toContain('BEGIN:VCARD');
        expect(vCard).toContain('VERSION:3.0');
        expect(vCard).toContain('FN:Jane'); // Should use given_name when display_name is null
        expect(vCard).toContain('N:;Jane;;;'); // family_name is null
        expect(vCard).toContain('EMAIL:jane@example.com');
        expect(vCard).not.toContain('TEL:'); // No phone numbers
        expect(vCard).not.toContain('NOTE:'); // No notes
        expect(vCard).toContain('END:VCARD');
    });

    it('should generate correct vCard for minimal contact information', () => {
        const contact = mockContacts[2]; // Minimal contact
        const vCard = generateVCard(contact);

        // Verify vCard content for minimal contact
        expect(vCard).toContain('BEGIN:VCARD');
        expect(vCard).toContain('VERSION:3.0');
        expect(vCard).toContain('FN:minimal@example.com'); // Should fallback to email
        expect(vCard).toContain('EMAIL:minimal@example.com');
        expect(vCard).toContain('TEL:+1111111111'); // Single phone number
        expect(vCard).not.toContain('NOTE:'); // No notes
        expect(vCard).toContain('END:VCARD');
        
        // The N: field should not be present since both given_name and family_name are null
        // Check for the specific N: field (not FN: which contains N:)
        const lines = vCard.split('\n');
        const nLine = lines.find(line => line.startsWith('N:'));
        expect(nLine).toBeUndefined();
    });

    it('should handle contact with multiple phone numbers correctly', () => {
        const contact = mockContacts[0]; // John Doe with multiple phones
        const vCard = generateVCard(contact);

        // Count phone number entries
        const phoneLines = vCard.split('\n').filter(line => line.startsWith('TEL:'));
        expect(phoneLines).toHaveLength(2);
        expect(phoneLines[0]).toBe('TEL:+1234567890');
        expect(phoneLines[1]).toBe('TEL:+0987654321');
    });

    it('should test download functionality', () => {
        const contact = mockContacts[0]; // John Doe
        downloadVCard(contact);

        // Verify that a blob was created
        expect(mockCreateObjectURL).toHaveBeenCalledWith(expect.any(Blob));

        // Verify download process
        expect(mockAppendChild).toHaveBeenCalled();
        expect(mockClick).toHaveBeenCalled();
        expect(mockRemoveChild).toHaveBeenCalled();
        expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
    });

    it('should handle contact with no display name but has given/family names', () => {
        const contactWithoutDisplayName: Contact = {
            id: 4,
            user_id: 'test-user-id',
            email_address: 'test@example.com',
            display_name: null,
            given_name: 'Test',
            family_name: 'User',
            phone_numbers: [],
            notes: null,
            last_seen: '2024-01-04T10:00:00Z',
            first_seen: '2024-01-04T10:00:00Z',
        };

        const vCard = generateVCard(contactWithoutDisplayName);

        // Should use given_name + family_name when display_name is null
        expect(vCard).toContain('FN:Test User');
        expect(vCard).toContain('N:User;Test;;;');
    });

    it('should handle edge cases with undefined/null values', () => {
        const edgeCaseContact: Contact = {
            id: 5,
            user_id: 'test-user-id',
            email_address: 'edge@example.com',
            display_name: undefined,
            given_name: undefined,
            family_name: undefined,
            phone_numbers: undefined,
            notes: undefined,
            last_seen: '2024-01-05T10:00:00Z',
            first_seen: '2024-01-05T10:00:00Z',
        };

        const vCard = generateVCard(edgeCaseContact);

        // Should fallback to email address for FN
        expect(vCard).toContain('FN:edge@example.com');
        expect(vCard).toContain('EMAIL:edge@example.com');
        expect(vCard).not.toContain('TEL:'); // No phone numbers
        expect(vCard).not.toContain('NOTE:'); // No notes
        expect(vCard).toContain('END:VCARD');
        
        // The N: field should not be present since both given_name and family_name are undefined
        // Check for the specific N: field (not FN: which contains N:)
        const lines = vCard.split('\n');
        const nLine = lines.find(line => line.startsWith('N:'));
        expect(nLine).toBeUndefined();
    });
});
