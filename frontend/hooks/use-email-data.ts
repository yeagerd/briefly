import { useOfficeData, type EmailScope } from '@/contexts/office-data-context';
import type { EmailMessage, EmailThread } from '@/types/api/office';
import { getSession } from 'next-auth/react';
import { useCallback, useEffect, useRef, useState } from 'react';

interface UseEmailListOptions {
    folderId?: string;
    folderLabel?: string;
    query?: string;
    pageSize?: number;
    labels?: string[];
    providers?: string[];
    classification?: string;
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
 * 
 * Cache Separation Strategy:
 * - The underlying cache (in office-data-context) separates data by:
 *   - userId: Each user has their own cache
 *   - folderId/folderLabel: Each folder is cached separately
 *   - query: Different search queries are cached separately
 *   - pageSize: Different page sizes are cached separately
 *   - labels: Different label combinations are cached separately
 * 
 * NOTE: classification is NOT part of the cache key. All emails for a folder
 * are cached together, and filtering by classification (focused/other/all) is
 * done in the email-view component based on the inference_classification field.
 * This works around Microsoft Graph API limitations and makes switching between
 * Priority Inbox and regular Inbox instant.
 * 
 * Race Condition Prevention:
 * - Uses cleanup functions to prevent stale background refreshes from
 *   overwriting current data when the scope changes
 * - Checks both the isActive flag (effect cleanup) and lastScopeKeyRef
 *   (scope hasn't changed) before updating state
 */
export function useEmailList(options: UseEmailListOptions = {}): UseEmailListReturn {
    const {
        folderId,
        folderLabel,
        query,
        pageSize = 50,
        labels,
        providers = ['google', 'microsoft'],
        classification,
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

    // Track if we're currently fetching to prevent duplicate requests
    const fetchingRef = useRef(false);
    const lastScopeKeyRef = useRef<string | null>(null);

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
                    labels,
                    classification
                };
                setScope(newScope);
            }
        };
        createScope();
    }, [folderId, folderLabel, query, pageSize, labels, classification]);

    // Fetch emails when scope changes - cache first strategy
    useEffect(() => {
        if (scope && autoFetch) {
            // Create a unique key for this scope+providers combination
            const scopeKey = JSON.stringify({ scope, providers });

            // Skip if we're already fetching for this exact scope
            if (fetchingRef.current && lastScopeKeyRef.current === scopeKey) {
                return;
            }

            // Note: We don't clear emails here anymore since classification filtering
            // happens in the email-view component. The cache contains all emails for
            // a folder and we filter on the frontend for instant switching.

            lastScopeKeyRef.current = scopeKey;
            fetchingRef.current = true;

            // Track if this effect is still active to prevent stale updates
            let isActive = true;

            const fetchEmails = async () => {
                try {
                    // First, get cached data immediately (non-blocking)
                    // This returns instantly with cache or empty array
                    const cachedResult = await getEmailListRef.current(scope, providers, false, false);

                    // Only update state if this effect is still active
                    if (isActive) {
                        setEmails(cachedResult);
                    }

                    // Always trigger a background refresh to get latest data
                    // Don't await this - let it run in background
                    getEmailListRef.current(scope, providers, true, true).then(freshResult => {
                        // Only update state if this effect is still active and scope hasn't changed
                        if (isActive && lastScopeKeyRef.current === scopeKey) {
                            setEmails(freshResult);
                        }
                        // Only reset fetching flag if this is still the current scope
                        if (lastScopeKeyRef.current === scopeKey) {
                            fetchingRef.current = false;
                        }
                    }).catch(error => {
                        console.error('Background refresh failed:', error);
                        // Only reset fetching flag if this is still the current scope
                        if (lastScopeKeyRef.current === scopeKey) {
                            fetchingRef.current = false;
                        }
                    });
                } catch (error) {
                    console.error('Failed to fetch emails:', error);
                    if (lastScopeKeyRef.current === scopeKey) {
                        fetchingRef.current = false;
                    }
                }
            };
            fetchEmails();

            // Cleanup function to prevent stale updates when scope changes
            return () => {
                isActive = false;
            };
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
 * 
 * Cache Separation Strategy:
 * - Threads are cached separately by threadId and includeBody flag
 * - This ensures that requests with/without body content don't interfere
 * 
 * Race Condition Prevention:
 * - Uses cleanup functions to prevent stale background refreshes from
 *   overwriting current data when the threadId or includeBody changes
 * - Only updates state if the effect is still active (not cleaned up)
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
            // Create a unique key for this thread request
            const requestKey = `${threadId}|${includeBody}`;

            // Track if this effect is still active to prevent stale updates
            let isActive = true;

            const fetchThread = async () => {
                try {
                    // First, get cached data immediately (non-blocking)
                    // This returns instantly with cache or null
                    const cachedResult = await getEmailThreadRef.current(threadId, includeBody, false, false);

                    // Only update state if this effect is still active
                    if (isActive) {
                        setThread(cachedResult);
                    }

                    // Always trigger background refresh to get latest data
                    // Don't await this - let it run in background
                    getEmailThreadRef.current(threadId, includeBody, true, true).then(freshResult => {
                        // Only update state if this effect is still active
                        if (isActive) {
                            setThread(freshResult);
                        }
                    }).catch(error => {
                        console.error('Background refresh failed:', error);
                    });
                } catch (error) {
                    console.error('Failed to fetch thread:', error);
                }
            };
            fetchThread();

            // Cleanup function to prevent stale updates when threadId or includeBody changes
            return () => {
                isActive = false;
            };
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
