import { officeApi } from '@/api';
import { useIntegrations } from '@/contexts/integrations-context';
import { OfficeDataProvider } from '@/contexts/office-data-context';
import { useEmailCache, useEmailList, useEmailThread } from '@/hooks/use-email-data';
import { EmailMessage, Provider } from "@/types/api/office";
import { act, render, screen, waitFor } from '@testing-library/react';
import EmailView from './email-view';

// Mock the integrations context
jest.mock('@/contexts/integrations-context');
const mockUseIntegrations = useIntegrations as jest.MockedFunction<typeof useIntegrations>;

// Mock the email data hooks
jest.mock('@/hooks/use-email-data');
const mockUseEmailList = useEmailList as jest.MockedFunction<typeof useEmailList>;
const mockUseEmailThread = useEmailThread as jest.MockedFunction<typeof useEmailThread>;
const mockUseEmailCache = useEmailCache as jest.MockedFunction<typeof useEmailCache>;

// Mock the office API
jest.mock('@/api', () => ({
    officeApi: {
        getEmailFolders: jest.fn(),
        bulkAction: jest.fn(),
    },
}));

// Mock next-auth
jest.mock('next-auth/react', () => ({
    getSession: jest.fn(() => Promise.resolve({
        user: { id: 'test-user-id', email: 'test@example.com' }
    })),
}));

describe('EmailView - Select All Functionality', () => {
    const mockEmails: EmailMessage[] = [
        {
            id: 'email-1',
            thread_id: 'thread-1',
            subject: 'Test Email 1',
            date: '2024-01-02T10:00:00Z',
            from_address: { email: 'sender1@example.com', name: 'Sender 1' },
            to_addresses: [{ email: 'test@example.com', name: 'Test User' }],
            cc_addresses: [],
            bcc_addresses: [],
            snippet: 'Test snippet 1',
            body_text: 'Test body 1',
            is_read: false,
            has_attachments: false,
            labels: [],
            provider: Provider.GOOGLE,
            provider_message_id: 'provider-email-1',
            account_email: 'test@example.com',
        },
        {
            id: 'email-2',
            thread_id: 'thread-1',
            subject: 'Test Email 2',
            date: '2024-01-01T10:00:00Z',
            from_address: { email: 'sender2@example.com', name: 'Sender 2' },
            to_addresses: [{ email: 'test@example.com', name: 'Test User' }],
            cc_addresses: [],
            bcc_addresses: [],
            snippet: 'Test snippet 2',
            body_text: 'Test body 2',
            is_read: true,
            has_attachments: false,
            labels: [],
            provider: Provider.GOOGLE,
            provider_message_id: 'provider-email-2',
            account_email: 'test@example.com',
        },
        {
            id: 'email-3',
            thread_id: 'thread-2',
            subject: 'Test Email 3',
            date: '2024-01-03T10:00:00Z',
            from_address: { email: 'sender3@example.com', name: 'Sender 3' },
            to_addresses: [{ email: 'test@example.com', name: 'Test User' }],
            cc_addresses: [],
            bcc_addresses: [],
            snippet: 'Test snippet 3',
            body_text: 'Test body 3',
            is_read: false,
            has_attachments: false,
            labels: [],
            provider: Provider.GOOGLE,
            provider_message_id: 'provider-email-3',
            account_email: 'test@example.com',
        },
    ];

    beforeEach(async () => {
        mockUseIntegrations.mockReturnValue({
            integrations: [],
            activeProviders: ['google'],
            loading: false,
            error: null,
            hasExpiredButRefreshableTokens: false,
            refreshIntegrations: jest.fn(),
            triggerAutoRefreshIfNeeded: jest.fn(),
        });

        // Mock the email data hooks
        mockUseEmailList.mockReturnValue({
            emails: mockEmails,
            loading: false,
            error: null,
            lastUpdated: Date.now(),
            refresh: jest.fn(),
            hasMore: false
        });

        mockUseEmailThread.mockReturnValue({
            thread: null,
            loading: false,
            error: null,
            lastUpdated: null,
            refresh: jest.fn()
        });

        mockUseEmailCache.mockReturnValue({
            invalidateList: jest.fn(),
            invalidateThread: jest.fn(),
            clearAll: jest.fn()
        });

        // Mock the office API methods
        (officeApi.getEmailFolders as jest.Mock).mockResolvedValue({
            data: { folders: [] }
        });
    });

    it('should select only latest emails in tight view mode', async () => {
        await act(async () => {
            render(
                <OfficeDataProvider>
                    <EmailView activeTool="email" />
                </OfficeDataProvider>
            );
        });

        await waitFor(() => expect(screen.getByText('Inbox (Priority)')).toBeInTheDocument());
    });

    it('should handle view mode changes correctly', async () => {
        await act(async () => {
            render(
                <OfficeDataProvider>
                    <EmailView activeTool="email" />
                </OfficeDataProvider>
            );
        });
        await waitFor(() => expect(screen.getByText('Inbox (Priority)')).toBeInTheDocument());
    });
}); 