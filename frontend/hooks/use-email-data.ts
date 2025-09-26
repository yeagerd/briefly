import { useOfficeData } from '@/contexts/office-data-context';
import type { EmailMessage, EmailThread } from '@/types/api/office';
import { getSession } from 'next-auth/react';
import { useCallback, useEffect, useRef, useState } from 'react';

interface EmailScope {
    userId: string;
    folderId?: string;
    folderLabel?: string;
    query?: string;
    pageSize?: number;
    labels?: string[];
}

interface UseEmailListOptions {
    folderId?: string;
    folderLabel?: string;
    query?: string;
    pageSize?: number;
    labels?: string[];
    providers?: string[];
    autoFetch?: boolean;
}

interface UseEmailListReturn {
    emails: EmailMessage[];
    loading: boolean;
    error: string | null;
    lastUpdated: number | null;
    refresh: () => Promise<void>;
    hasMore: boolean;
}

interface UseEmailThreadOptions {
    includeBody?: boolean;
    autoFetch?: boolean;
}

interface UseEmailThreadReturn {
    thread: EmailThread | null;
    loading: boolean;
    error: string | null;
    lastUpdated: number | null;
    refresh: () => Promise<void>;
}

/**
 * Hook for accessing email list data with caching
 */
export function useEmailList(options: UseEmailListOptions = {}): UseEmailListReturn {
    const {
        folderId,
        folderLabel,
        query,
        pageSize = 50,
        labels,
        providers = ['google', 'microsoft'],
        autoFetch = true
    } = options;

    const {
        getEmailList,
        getEmailListLoading,
        getEmailListError,
        refreshEmailList,
        getEmailListLastUpdated,
        runDelta
    } = useOfficeData();

    const [emails, setEmails] = useState<EmailMessage[]>([]);
    const [hasMore, setHasMore] = useState(false);
    const [scope, setScope] = useState<EmailScope | null>(null);

    // Store latest function references to avoid circular dependencies
    const getEmailListRef = useRef(getEmailList);
    const refreshEmailListRef = useRef(refreshEmailList);
    const runDeltaRef = useRef(runDelta);

    // Update refs when functions change
    getEmailListRef.current = getEmailList;
    refreshEmailListRef.current = refreshEmailList;
    runDeltaRef.current = runDelta;

    // Create scope when user session is available
    useEffect(() => {
        const createScope = async () => {
            const session = await getSession();
            if (session?.user?.id) {
                const newScope: EmailScope = {
                    userId: session.user.id,
                    folderId,
                    folderLabel,
                    query,
                    pageSize,
                    labels
                };
                setScope(newScope);
            }
        };
        createScope();
    }, [folderId, folderLabel, query, pageSize, labels]);

    // Fetch emails when scope changes
    useEffect(() => {
        if (scope && autoFetch) {
            const fetchEmails = async () => {
                try {
                    const result = await getEmailListRef.current(scope, providers);
                    setEmails(result);
                } catch (error) {
                    console.error('Failed to fetch emails:', error);
                }
            };
            fetchEmails();
        }
    }, [scope, providers, autoFetch]);

    const refresh = useCallback(async () => {
        if (scope) {
            try {
                // Use delta sync for background refresh - no loading state
                await runDeltaRef.current(scope, providers);
                // runDelta automatically updates the cache, so we don't need to call getEmailList
                // The UI will re-render automatically when the cache updates
            } catch (error) {
                console.error('Failed to refresh emails:', error);
            }
        }
    }, [scope, providers]);

    const loading = scope ? getEmailListLoading(scope) : false;
    const error = scope ? getEmailListError(scope) : null;
    const lastUpdated = scope ? getEmailListLastUpdated(scope) : null;

    return {
        emails,
        loading,
        error,
        lastUpdated,
        refresh,
        hasMore
    };
}

/**
 * Hook for accessing individual email thread data with caching
 */
export function useEmailThread(threadId: string | null, options: UseEmailThreadOptions = {}): UseEmailThreadReturn {
    const {
        includeBody = false,
        autoFetch = true
    } = options;

    const {
        getEmailThread,
        getEmailThreadLoading,
        getEmailThreadError,
        refreshEmailThread,
        getEmailThreadLastUpdated
    } = useOfficeData();

    const [thread, setThread] = useState<EmailThread | null>(null);

    // Store latest function references to avoid circular dependencies
    const getEmailThreadRef = useRef(getEmailThread);
    const refreshEmailThreadRef = useRef(refreshEmailThread);

    // Update refs when functions change
    getEmailThreadRef.current = getEmailThread;
    refreshEmailThreadRef.current = refreshEmailThread;

    // Fetch thread when threadId changes
    useEffect(() => {
        if (threadId && autoFetch) {
            const fetchThread = async () => {
                try {
                    const result = await getEmailThreadRef.current(threadId, includeBody);
                    setThread(result);
                } catch (error) {
                    console.error('Failed to fetch thread:', error);
                }
            };
            fetchThread();
        }
    }, [threadId, includeBody, autoFetch]);

    const refresh = useCallback(async () => {
        if (threadId) {
            try {
                await refreshEmailThreadRef.current(threadId, includeBody);
                const result = await getEmailThreadRef.current(threadId, includeBody);
                setThread(result);
            } catch (error) {
                console.error('Failed to refresh thread:', error);
            }
        }
    }, [threadId, includeBody]);

    const loading = threadId ? getEmailThreadLoading(threadId) : false;
    const error = threadId ? getEmailThreadError(threadId) : null;
    const lastUpdated = threadId ? getEmailThreadLastUpdated(threadId) : null;

    return {
        thread,
        loading,
        error,
        lastUpdated,
        refresh
    };
}

/**
 * Hook for managing email cache invalidation
 */
export function useEmailCache() {
    const { invalidateEmailCache, clearEmailCache } = useOfficeData();

    const invalidateList = useCallback(async (folderId?: string, query?: string, pageSize?: number, labels?: string[]) => {
        try {
            const session = await getSession();
            if (session?.user?.id) {
                const scope: EmailScope = {
                    userId: session.user.id,
                    folderId,
                    query,
                    pageSize,
                    labels
                };
                invalidateEmailCache(scope);
            }
        } catch (error) {
            console.error('Failed to invalidate email list cache:', error);
        }
    }, [invalidateEmailCache]);

    const invalidateThread = useCallback((threadId: string) => {
        invalidateEmailCache(undefined, threadId);
    }, [invalidateEmailCache]);

    const clearAll = useCallback(() => {
        clearEmailCache();
    }, [clearEmailCache]);

    return {
        invalidateList,
        invalidateThread,
        clearAll
    };
}
