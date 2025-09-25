import { officeApi } from '@/api';
import { useOfficeData } from '@/contexts/office-data-context';
import { useEmailList, useEmailThread } from '@/hooks/use-email-data';
import { safeParseDate } from '@/lib/utils';
import { EmailThread } from "@/types/api/office";
import { useCallback, useMemo, useState } from 'react';
import { toast } from 'sonner';

interface UseThreadsOptions {
    providers?: string[];
    limit?: number;
    includeBody?: boolean;
    labels?: string[];
    folderId?: string;
    q?: string;
    autoFetch?: boolean;
}

interface UseThreadsReturn {
    threads: EmailThread[];
    selectedThread: EmailThread | null;
    selectedMessageId: string | null;
    loading: boolean;
    error: string | null;
    hasMore: boolean;
    fetchThreads: (options?: Partial<UseThreadsOptions>) => Promise<void>;
    fetchThread: (threadId: string) => Promise<void>;
    fetchMessageThread: (messageId: string) => Promise<void>;
    selectThread: (threadId: string) => void;
    selectMessage: (messageId: string) => void;
    clearSelection: () => void;
    refreshThreads: () => Promise<void>;
}

export const useThreads = (initialOptions: UseThreadsOptions = {}): UseThreadsReturn => {
    const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
    const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
    const [options] = useState<UseThreadsOptions>({
        providers: ['google', 'microsoft'],
        limit: 50,
        includeBody: false,
        autoFetch: true,
        ...initialOptions,
    });

    // Use provider hooks for email data
    const {
        emails: emailMessages,
        loading,
        error,
        refresh: refreshEmails
    } = useEmailList({
        labels: options.labels,
        folderId: options.folderId,
        query: options.q,
        pageSize: options.limit,
        providers: options.providers,
        autoFetch: options.autoFetch
    });

    const {
        thread: selectedThread,
        loading: threadLoading,
        error: threadError,
        refresh: refreshThread
    } = useEmailThread(selectedThreadId, {
        includeBody: options.includeBody,
        autoFetch: !!selectedThreadId
    });

    const { refreshEmailThread } = useOfficeData();

    // Convert email messages to threads (group by thread_id)
    const threads = useMemo(() => {
        const threadMap = new Map<string, EmailThread>();

        emailMessages.forEach(message => {
            const threadId = message.thread_id || message.id;
            if (!threadMap.has(threadId)) {
                threadMap.set(threadId, {
                    id: threadId,
                    subject: message.subject,
                    messages: [],
                    participant_count: 0,
                    last_message_date: message.date,
                    is_read: message.is_read,
                    providers: [message.provider]
                });
            }

            const thread = threadMap.get(threadId)!;
            thread.messages.push(message);
            thread.participant_count = Math.max(thread.participant_count,
                (message.to_addresses?.length || 0) + (message.cc_addresses?.length || 0) + (message.bcc_addresses?.length || 0));

            // Update last message date if this message is newer
            const messageDate = safeParseDate(message.date);
            const threadDate = safeParseDate(thread.last_message_date);

            if (messageDate && threadDate && messageDate > threadDate) {
                thread.last_message_date = message.date;
            } else if (messageDate && !threadDate) {
                // If thread date is invalid but message date is valid, use message date
                thread.last_message_date = message.date;
            }

            // Aggregate is_read: thread is unread if ANY message is unread
            if (!message.is_read) {
                thread.is_read = false;
            }

            // Aggregate providers: add unique providers from all messages
            if (!thread.providers.includes(message.provider)) {
                thread.providers.push(message.provider);
            }
        });

        return Array.from(threadMap.values()).sort((a, b) => {
            const dateA = safeParseDate(a.last_message_date);
            const dateB = safeParseDate(b.last_message_date);

            // If both dates are valid, sort normally
            if (dateA && dateB) {
                return dateB.getTime() - dateA.getTime();
            }

            // If only one date is valid, prioritize it
            if (dateA && !dateB) return -1;
            if (!dateA && dateB) return 1;

            // If both dates are invalid, maintain original order
            return 0;
        });
    }, [emailMessages]);

    const fetchThreads = useCallback(async (fetchOptions?: Partial<UseThreadsOptions>) => {
        // This is now handled by the provider hooks automatically
        await refreshEmails();
    }, [refreshEmails]);

    const fetchThread = useCallback(async (threadId: string) => {
        setSelectedThreadId(threadId);
        // Use refreshEmailThread directly to avoid race condition
        await refreshEmailThread(threadId, options.includeBody);
    }, [refreshEmailThread, options.includeBody]);

    const fetchMessageThread = useCallback(async (messageId: string) => {
        try {
            // First get the thread ID from the message
            const response = await officeApi.getMessageThread(messageId, true);
            if (response.success && response.data?.threads && response.data.threads.length > 0) {
                const threadId = response.data.threads[0].id;
                setSelectedThreadId(threadId);
                // Use refreshEmailThread to get the thread with proper caching
                await refreshEmailThread(threadId, true);
            } else {
                const errorMessage = 'No thread found for message';
                toast.error(errorMessage);
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to fetch message thread';
            toast.error(errorMessage);
        }
    }, [refreshEmailThread]);

    const selectThread = useCallback((threadId: string) => {
        setSelectedThreadId(threadId);
        setSelectedMessageId(null);
    }, []);

    const selectMessage = useCallback((messageId: string) => {
        setSelectedMessageId(messageId);
    }, []);

    const clearSelection = useCallback(() => {
        setSelectedThreadId(null);
        setSelectedMessageId(null);
    }, []);

    const refreshThreads = useCallback(async () => {
        await refreshEmails();
    }, [refreshEmails]);

    return {
        threads,
        selectedThread,
        selectedMessageId,
        loading: loading || threadLoading,
        error: error || threadError,
        hasMore: false, // This would need to be implemented based on pagination
        fetchThreads,
        fetchThread,
        fetchMessageThread,
        selectThread,
        selectMessage,
        clearSelection,
        refreshThreads,
    };
}; 