"use client";

import { contactsApi, officeApi } from '@/api';
import type { Contact } from '@/types/api/contacts';
import type { EmailMessage, EmailThread } from '@/types/api/office';
import { getSession } from 'next-auth/react';
import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

// Cache entry interfaces
interface CacheEntry<T> {
    data: T;
    timestamp: number;
    ttl: number;
}

interface EmailListCacheEntry extends CacheEntry<EmailMessage[]> {
    hasMore: boolean;
    pageToken?: string;
}

interface EmailThreadCacheEntry extends CacheEntry<EmailThread> {
    includeBody: boolean;
}

export interface EmailScope {
    userId: string;
    folderId?: string;
    folderLabel?: string;
    query?: string;
    pageSize?: number;
    labels?: string[];
    classification?: string;
}

interface DeltaTokenData {
    token: string;
    lastSuccessfulSyncAt: number;
}

interface DeltaMetrics {
    duration: number;
    createdCount: number;
    updatedCount: number;
    deletedCount: number;
    tokenInvalidations: number;
    avoidedFullFetches: number;
}

interface DeltaResponse {
    created: EmailMessage[];
    updated: EmailMessage[];
    deleted: string[]; // message IDs
    nextToken: string;
}

interface OfficeDataContextType {
    // Contacts
    contacts: Contact[];
    loading: boolean;
    error: string | null;
    refreshContacts: (providers?: string[], opts?: { q?: string; company?: string; forceRefresh?: boolean; limit?: number }) => Promise<void>;
    detectCompanyFromEmail: (email?: string) => string | undefined;

    // Email Lists
    getEmailList: (scope: EmailScope, providers: string[], forceRefresh?: boolean, isBackground?: boolean) => Promise<EmailMessage[]>;
    getEmailListLoading: (scope: EmailScope) => boolean;
    getEmailListError: (scope: EmailScope) => string | null;
    refreshEmailList: (scope: EmailScope, providers: string[]) => Promise<void>;
    getEmailListLastUpdated: (scope: EmailScope) => number | null;

    // Email Threads
    getEmailThread: (threadId: string, includeBody?: boolean, forceRefresh?: boolean, isBackground?: boolean) => Promise<EmailThread | null>;
    getEmailThreadLoading: (threadId: string) => boolean;
    getEmailThreadError: (threadId: string) => string | null;
    refreshEmailThread: (threadId: string, includeBody?: boolean) => Promise<void>;
    getEmailThreadLastUpdated: (threadId: string) => number | null;

    // Delta Sync
    seedScope: (scope: EmailScope, providers: string[]) => Promise<void>;
    runDelta: (scope: EmailScope, providers: string[]) => Promise<void>;
    getDeltaToken: (scope: EmailScope) => DeltaTokenData | null;
    getDeltaLoading: (scope: EmailScope) => boolean;
    getDeltaMetrics: (scope: EmailScope) => DeltaMetrics | null;

    // Cache Management
    invalidateEmailCache: (scope?: EmailScope, threadId?: string) => void;
    clearEmailCache: () => void;
}

const OfficeDataContext = createContext<OfficeDataContextType | undefined>(undefined);

export const OfficeDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    // Contacts state
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const lastQueryRef = useRef<{ providers?: string[]; q?: string; company?: string; limit?: number }>({});

    // Email cache state - use refs to avoid stale closures
    const listCacheRef = useRef<Map<string, EmailListCacheEntry>>(new Map());
    const threadCacheRef = useRef<Map<string, EmailThreadCacheEntry>>(new Map());
    const [listCache, setListCache] = useState<Map<string, EmailListCacheEntry>>(new Map());
    const [threadCache, setThreadCache] = useState<Map<string, EmailThreadCacheEntry>>(new Map());
    const [listLoading, setListLoading] = useState<Map<string, boolean>>(new Map());
    const [threadLoading, setThreadLoading] = useState<Map<string, boolean>>(new Map());
    const [listErrors, setListErrors] = useState<Map<string, string>>(new Map());
    const [threadErrors, setThreadErrors] = useState<Map<string, string>>(new Map());
    const [backgroundRefreshing, setBackgroundRefreshing] = useState<Map<string, boolean>>(new Map());

    // Keep refs in sync with state
    listCacheRef.current = listCache;
    threadCacheRef.current = threadCache;

    // Delta sync state
    const [deltaTokenByScope, setDeltaTokenByScope] = useState<Map<string, DeltaTokenData>>(new Map());
    const [deltaLoading, setDeltaLoading] = useState<Map<string, boolean>>(new Map());
    const [deltaMetrics, setDeltaMetrics] = useState<Map<string, DeltaMetrics>>(new Map());

    // Inflight requests for de-duplication
    const inflightRequests = useRef<Map<string, Promise<any>>>(new Map());
    const deltaInflightByScope = useRef<Map<string, Promise<any>>>(new Map());

    // Cache configuration
    const LIST_TTL = 60 * 1000; // 60 seconds
    const THREAD_TTL = 120 * 1000; // 120 seconds
    const MAX_LIST_CACHE_SIZE = 10;
    const MAX_THREAD_CACHE_SIZE = 50;

    // Helper functions
    /**
     * Creates a unique cache key for an email list scope.
     * 
     * Cache Separation Strategy:
     * Each unique combination of these parameters gets its own cache entry:
     * - userId: Separate cache per user
     * - folderId: Separate cache per folder (inbox, sent, etc.)
     * - folderLabel: Additional folder identification
     * - query: Separate cache per search query
     * - pageSize: Separate cache per page size
     * - labels: Separate cache per label combination
     * 
     * NOTE: classification is NOT part of the cache key.
     * We cache ALL emails for a folder together and do frontend filtering based on
     * the inference_classification field. This approach:
     * 1. Works around Microsoft Graph API limitation (can't filter by folder AND classification)
     * 2. Makes switching between Priority Inbox and regular Inbox instant (no API call)
     * 3. Reduces cache complexity and prevents race conditions
     * 4. Simplifies the caching logic
     */
    const createCacheKey = (scope: EmailScope): string => {
        const parts = [
            scope.userId,
            scope.folderId || 'default',
            scope.folderLabel || '',
            scope.query || '',
            scope.pageSize?.toString() || '50',
            (scope.labels || []).sort().join(',')
            // classification removed - we filter in the UI
        ];
        return parts.join('|');
    };

    const createThreadCacheKey = (threadId: string, includeBody: boolean): string => {
        return `${threadId}|${includeBody}`;
    };

    const isCacheValid = <T,>(entry: CacheEntry<T>): boolean => {
        return Date.now() - entry.timestamp < entry.ttl;
    };

    const evictLRU = <K, V extends CacheEntry<any>>(cache: Map<K, V>, maxSize: number): void => {
        if (cache.size <= maxSize) return;

        const entries = Array.from(cache.entries());
        entries.sort((a, b) => a[1].timestamp - b[1].timestamp);

        const toRemove = entries.slice(0, entries.length - maxSize);
        toRemove.forEach(([key]) => cache.delete(key));
    };

    const detectCompanyFromEmail = useCallback((email?: string) => {
        if (!email) return undefined;
        const at = email.indexOf('@');
        if (at === -1) return undefined;
        const domain = email.slice(at + 1).toLowerCase();
        const parts = domain.split('.');
        const core = parts.length >= 2 ? parts[parts.length - 2] : parts[0];
        if (!core) return undefined;
        return core.charAt(0).toUpperCase() + core.slice(1);
    }, []);

    const refreshContacts = useCallback(async (providers?: string[], opts?: { q?: string; company?: string; forceRefresh?: boolean; limit?: number }) => {
        setLoading(true);
        setError(null);
        try {
            lastQueryRef.current = { providers, q: opts?.q, company: opts?.company, limit: opts?.limit };

            // Use the new contacts API for fetching contacts
            // Convert old provider-based logic to new source_services logic
            let sourceServices: string[] | undefined;
            if (providers && providers.length > 0) {
                // Map old providers to new source services
                sourceServices = providers.map(provider => {
                    if (provider === 'google' || provider === 'microsoft') {
                        return 'office';
                    }
                    return provider;
                });
            }

            const resp = await contactsApi.getContacts(
                opts?.limit ?? 200,
                0, // offset
                undefined, // tags
                sourceServices,
                opts?.q // query
            );

            if (resp.success) {
                setContacts(resp.contacts || []);
            } else {
                setError('Failed to fetch contacts');
            }
        } catch (e: unknown) {
            setError((e && typeof e === 'object' && 'message' in e) ? (e as { message?: string }).message || 'Failed to load contacts' : 'Failed to load contacts');
        } finally {
            setLoading(false);
        }
    }, []);

    // Email list functions
    const getEmailList = useCallback(async (scope: EmailScope, providers: string[], forceRefresh = false, isBackground = false): Promise<EmailMessage[]> => {
        const cacheKey = createCacheKey(scope);

        // Check cache first - return immediately if exists and forceRefresh is false
        if (!forceRefresh) {
            const cached = listCacheRef.current.get(cacheKey);
            if (cached) {
                // Return cached data immediately, regardless of TTL
                return cached.data;
            }
            // If no cache and not forcing refresh, return empty array immediately
            // The caller should trigger a background refresh
            return [];
        }

        // Check for inflight request
        const inflightKey = `list:${cacheKey}`;
        if (inflightRequests.current.has(inflightKey)) {
            return inflightRequests.current.get(inflightKey)!;
        }

        // Start new request
        const requestPromise = (async () => {
            // Set appropriate loading state
            if (isBackground) {
                setBackgroundRefreshing(prev => new Map(prev).set(cacheKey, true));
            } else {
                setListLoading(prev => new Map(prev).set(cacheKey, true));
            }
            setListErrors(prev => {
                const newMap = new Map(prev);
                newMap.delete(cacheKey);
                return newMap;
            });

            try {
                const session = await getSession();
                const userId = session?.user?.id;
                if (!userId) throw new Error('No user id found in session');

                // Determine folder/label parameters
                let labels: string[] | undefined;
                let folderId: string | undefined;

                if (scope.folderId) {
                    folderId = scope.folderId;
                } else if (scope.labels && scope.labels.length > 0) {
                    labels = scope.labels;
                }

                const response = await officeApi.getEmails(
                    providers,
                    scope.pageSize || 50,
                    undefined, // offset
                    forceRefresh,
                    labels,
                    folderId,
                    undefined, // inboxOnly
                    undefined  // importanceLevel
                );

                if (response.success && response.data?.messages) {
                    let messages = response.data.messages;

                    // Apply client-side filtering for inbox and sent folders
                    if (scope.folderLabel === 'inbox' || scope.folderLabel === 'sent') {
                        const userEmail = session.user.email;
                        if (userEmail) {
                            messages = messages.filter(msg => {
                                if (scope.folderLabel === 'inbox') {
                                    // For inbox: show messages where user is recipient (in "to" field, not "from")
                                    const isInToField = msg.to_addresses?.some(addr => addr.email === userEmail) || false;
                                    const isFromUser = msg.from_address?.email === userEmail;
                                    return isInToField && !isFromUser;
                                } else if (scope.folderLabel === 'sent') {
                                    // For sent: show messages where user is sender (in "from" field)
                                    const isFromUser = msg.from_address?.email === userEmail;
                                    return isFromUser;
                                }
                                return true;
                            });
                        }
                    }

                    // Update cache
                    const cacheEntry: EmailListCacheEntry = {
                        data: messages,
                        timestamp: Date.now(),
                        ttl: LIST_TTL,
                        hasMore: response.data.has_next || false,
                        pageToken: response.data.next_cursor || undefined
                    };

                    setListCache(prev => {
                        const newCache = new Map(prev);
                        newCache.set(cacheKey, cacheEntry);
                        evictLRU(newCache, MAX_LIST_CACHE_SIZE);
                        return newCache;
                    });

                    // Store cursor token for future delta sync
                    if (response.data?.next_cursor) {
                        setDeltaTokenByScope(prev => {
                            const newMap = new Map(prev);
                            newMap.set(cacheKey, {
                                token: response.data!.next_cursor!,
                                lastSuccessfulSyncAt: Date.now()
                            });
                            return newMap;
                        });
                    }

                    return messages;
                } else {
                    throw new Error('Failed to fetch email list');
                }
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Failed to fetch email list';
                setListErrors(prev => new Map(prev).set(cacheKey, errorMessage));
                throw error;
            } finally {
                // Clear appropriate loading state
                if (isBackground) {
                    setBackgroundRefreshing(prev => {
                        const newMap = new Map(prev);
                        newMap.delete(cacheKey);
                        return newMap;
                    });
                } else {
                    setListLoading(prev => {
                        const newMap = new Map(prev);
                        newMap.delete(cacheKey);
                        return newMap;
                    });
                }
                inflightRequests.current.delete(inflightKey);
            }
        })();

        inflightRequests.current.set(inflightKey, requestPromise);
        return requestPromise;
    }, []);

    const getEmailListLoading = useCallback((scope: EmailScope): boolean => {
        const cacheKey = createCacheKey(scope);
        return listLoading.get(cacheKey) || backgroundRefreshing.get(cacheKey) || false;
    }, [listLoading, backgroundRefreshing]);

    const getEmailListError = useCallback((scope: EmailScope): string | null => {
        const cacheKey = createCacheKey(scope);
        return listErrors.get(cacheKey) || null;
    }, [listErrors]);

    const refreshEmailList = useCallback(async (scope: EmailScope, providers: string[]): Promise<void> => {
        await getEmailList(scope, providers, true);
    }, [getEmailList]);

    const getEmailListLastUpdated = useCallback((scope: EmailScope): number | null => {
        const cacheKey = createCacheKey(scope);
        const cached = listCache.get(cacheKey);
        return cached ? cached.timestamp : null;
    }, [listCache]);

    // Email thread functions
    const getEmailThread = useCallback(async (threadId: string, includeBody = false, forceRefresh = false, isBackground = false): Promise<EmailThread | null> => {
        const cacheKey = createThreadCacheKey(threadId, includeBody);

        // Check cache first - return immediately if exists and forceRefresh is false
        if (!forceRefresh) {
            const cached = threadCacheRef.current.get(cacheKey);
            if (cached) {
                // Return cached data immediately, regardless of TTL
                return cached.data;
            }
            // If no cache and not forcing refresh, return null immediately
            // The caller should trigger a background refresh
            return null;
        }

        // Check for inflight request
        const inflightKey = `thread:${cacheKey}`;
        if (inflightRequests.current.has(inflightKey)) {
            return inflightRequests.current.get(inflightKey)!;
        }

        // Start new request
        const requestPromise = (async () => {
            // Only set loading state if not a background refresh
            if (!isBackground) {
                setThreadLoading(prev => new Map(prev).set(threadId, true));
            }
            setThreadErrors(prev => {
                const newMap = new Map(prev);
                newMap.delete(threadId);
                return newMap;
            });

            try {
                const response = await officeApi.getThread(threadId, includeBody, forceRefresh);

                if (response.success && response.data?.threads && response.data.threads.length > 0) {
                    const thread = response.data.threads[0];

                    // Update cache
                    const cacheEntry: EmailThreadCacheEntry = {
                        data: thread,
                        timestamp: Date.now(),
                        ttl: THREAD_TTL,
                        includeBody
                    };

                    setThreadCache(prev => {
                        const newCache = new Map(prev);
                        newCache.set(cacheKey, cacheEntry);
                        evictLRU(newCache, MAX_THREAD_CACHE_SIZE);
                        return newCache;
                    });

                    return thread;
                } else {
                    throw new Error('Failed to fetch email thread');
                }
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Failed to fetch email thread';
                setThreadErrors(prev => new Map(prev).set(threadId, errorMessage));
                throw error;
            } finally {
                // Only clear loading state if it was set (not a background refresh)
                if (!isBackground) {
                    setThreadLoading(prev => {
                        const newMap = new Map(prev);
                        newMap.delete(threadId);
                        return newMap;
                    });
                }
                inflightRequests.current.delete(inflightKey);
            }
        })();

        inflightRequests.current.set(inflightKey, requestPromise);
        return requestPromise;
    }, []);

    const getEmailThreadLoading = useCallback((threadId: string): boolean => {
        return threadLoading.get(threadId) || false;
    }, [threadLoading]);

    const getEmailThreadError = useCallback((threadId: string): string | null => {
        return threadErrors.get(threadId) || null;
    }, [threadErrors]);

    const refreshEmailThread = useCallback(async (threadId: string, includeBody = false): Promise<void> => {
        await getEmailThread(threadId, includeBody, true);
    }, [getEmailThread]);

    const getEmailThreadLastUpdated = useCallback((threadId: string): number | null => {
        // Check both body and non-body versions
        const bodyKey = createThreadCacheKey(threadId, true);
        const noBodyKey = createThreadCacheKey(threadId, false);

        const bodyCached = threadCache.get(bodyKey);
        const noBodyCached = threadCache.get(noBodyKey);

        if (bodyCached && noBodyCached) {
            return Math.max(bodyCached.timestamp, noBodyCached.timestamp);
        } else if (bodyCached) {
            return bodyCached.timestamp;
        } else if (noBodyCached) {
            return noBodyCached.timestamp;
        }

        return null;
    }, [threadCache]);

    // Delta sync functions
    const seedScope = useCallback(async (scope: EmailScope, providers: string[]): Promise<void> => {
        const scopeKey = createCacheKey(scope);

        // Check if already seeding
        if (deltaInflightByScope.current.has(scopeKey)) {
            return deltaInflightByScope.current.get(scopeKey)!;
        }

        const seedPromise = (async () => {
            setDeltaLoading(prev => new Map(prev).set(scopeKey, true));

            try {
                const session = await getSession();
                if (!session?.user?.id) {
                    throw new Error('No session found');
                }

                // Use messages endpoint for initial sync (no page token provided)
                const response = await officeApi.getEmailMessages(
                    providers,
                    scope.pageSize || 50,
                    scope.labels,
                    scope.folderId,
                    scope.query,
                    undefined, // no page token for initial sync
                    "next", // forward direction
                    true // no cache for fresh data
                );

                let allMessages: EmailMessage[] = [];
                let nextCursor: string | undefined;

                if (response.data) {
                    allMessages = response.data.messages;
                    nextCursor = response.data.next_cursor || undefined;
                }

                // Update cache with seeded data
                setListCache(prev => {
                    const newCache = new Map(prev);
                    newCache.set(scopeKey, {
                        data: allMessages,
                        timestamp: Date.now(),
                        ttl: LIST_TTL,
                        hasMore: !!nextCursor,
                        pageToken: nextCursor
                    });
                    return newCache;
                });

                // Store cursor token if received
                if (nextCursor) {
                    setDeltaTokenByScope(prev => {
                        const newMap = new Map(prev);
                        newMap.set(scopeKey, {
                            token: nextCursor,
                            lastSuccessfulSyncAt: Date.now()
                        });
                        return newMap;
                    });
                }

            } catch (error) {
                console.error('Error seeding scope:', error);
                setListErrors(prev => {
                    const newMap = new Map(prev);
                    newMap.set(scopeKey, error instanceof Error ? error.message : 'Unknown error');
                    return newMap;
                });
            } finally {
                setDeltaLoading(prev => {
                    const newMap = new Map(prev);
                    newMap.delete(scopeKey);
                    return newMap;
                });
                deltaInflightByScope.current.delete(scopeKey);
            }
        })();

        deltaInflightByScope.current.set(scopeKey, seedPromise);
        return seedPromise;
    }, [createCacheKey, LIST_TTL]);

    const runDelta = useCallback(async (scope: EmailScope, providers: string[]): Promise<void> => {
        const scopeKey = createCacheKey(scope);

        // Check if already running delta
        if (deltaInflightByScope.current.has(scopeKey)) {
            return deltaInflightByScope.current.get(scopeKey)!;
        }

        const deltaToken = deltaTokenByScope.get(scopeKey);
        if (!deltaToken) {
            // No token available, need to seed first
            return seedScope(scope, providers);
        }

        const deltaPromise = (async () => {
            setDeltaLoading(prev => new Map(prev).set(scopeKey, true));
            const startTime = Date.now();

            try {
                const session = await getSession();
                if (!session?.user?.id) {
                    throw new Error('No session found');
                }

                // Call messages endpoint with stored cursor for incremental sync
                const response = await officeApi.getEmailMessages(
                    providers,
                    scope.pageSize || 50,
                    scope.labels,
                    scope.folderId,
                    scope.query,
                    deltaToken.token, // use stored cursor as page token
                    "next", // forward direction
                    true // no cache for fresh data
                );

                if (response.data) {
                    const { messages, next_cursor } = response.data;
                    const duration = Date.now() - startTime;

                    // Update metrics
                    setDeltaMetrics(prev => {
                        const newMap = new Map(prev);
                        const currentMetrics = newMap.get(scopeKey) || {
                            duration: 0,
                            createdCount: 0,
                            updatedCount: 0,
                            deletedCount: 0,
                            tokenInvalidations: 0,
                            avoidedFullFetches: 1
                        };

                        newMap.set(scopeKey, {
                            ...currentMetrics,
                            duration: currentMetrics.duration + duration,
                            createdCount: currentMetrics.createdCount + messages.length,
                            updatedCount: currentMetrics.updatedCount + 0, // No separate updated count
                            deletedCount: currentMetrics.deletedCount + 0, // No separate deleted count
                            avoidedFullFetches: currentMetrics.avoidedFullFetches + 1
                        });
                        return newMap;
                    });

                    // Update cache with new messages (replace existing data for incremental sync)
                    setListCache(prev => {
                        const newCache = new Map(prev);
                        const currentEntry = newCache.get(scopeKey);

                        // For incremental sync, we replace the existing data with the new messages
                        // since the pagination endpoint returns the next set of messages
                        const updatedMessages = messages.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

                        newCache.set(scopeKey, {
                            ...currentEntry,
                            data: updatedMessages,
                            timestamp: Date.now(),
                            ttl: currentEntry?.ttl || LIST_TTL,
                            pageToken: next_cursor || undefined,
                            hasMore: !!next_cursor
                        });
                        return newCache;
                    });

                    // Update cursor token
                    setDeltaTokenByScope(prev => {
                        const newMap = new Map(prev);
                        newMap.set(scopeKey, {
                            token: next_cursor || '',
                            lastSuccessfulSyncAt: Date.now()
                        });
                        return newMap;
                    });
                }

            } catch (error) {
                console.error('Error running delta:', error);

                // Check if token is invalid (410/expired)
                if (error instanceof Error && error.message.includes('410')) {
                    // Token invalid, need to re-seed
                    console.log('Delta token invalid, re-seeding scope');

                    // Update metrics for token invalidation
                    setDeltaMetrics(prev => {
                        const newMap = new Map(prev);
                        const currentMetrics = newMap.get(scopeKey) || {
                            duration: 0,
                            createdCount: 0,
                            updatedCount: 0,
                            deletedCount: 0,
                            tokenInvalidations: 0,
                            avoidedFullFetches: 0
                        };

                        newMap.set(scopeKey, {
                            ...currentMetrics,
                            tokenInvalidations: currentMetrics.tokenInvalidations + 1
                        });
                        return newMap;
                    });

                    setDeltaTokenByScope(prev => {
                        const newMap = new Map(prev);
                        newMap.delete(scopeKey);
                        return newMap;
                    });
                    return seedScope(scope, providers);
                }

                setListErrors(prev => {
                    const newMap = new Map(prev);
                    newMap.set(scopeKey, error instanceof Error ? error.message : 'Unknown error');
                    return newMap;
                });
            } finally {
                setDeltaLoading(prev => {
                    const newMap = new Map(prev);
                    newMap.delete(scopeKey);
                    return newMap;
                });
                deltaInflightByScope.current.delete(scopeKey);
            }
        })();

        deltaInflightByScope.current.set(scopeKey, deltaPromise);
        return deltaPromise;
    }, [createCacheKey, deltaTokenByScope, seedScope]);

    const getDeltaToken = useCallback((scope: EmailScope): DeltaTokenData | null => {
        const scopeKey = createCacheKey(scope);
        return deltaTokenByScope.get(scopeKey) || null;
    }, [createCacheKey, deltaTokenByScope]);

    const getDeltaLoading = useCallback((scope: EmailScope): boolean => {
        const scopeKey = createCacheKey(scope);
        return deltaLoading.get(scopeKey) || false;
    }, [createCacheKey, deltaLoading]);

    const getDeltaMetrics = useCallback((scope: EmailScope): DeltaMetrics | null => {
        const scopeKey = createCacheKey(scope);
        return deltaMetrics.get(scopeKey) || null;
    }, [createCacheKey, deltaMetrics]);

    // Cache management functions
    const invalidateEmailCache = useCallback((scope?: EmailScope, threadId?: string): void => {
        if (scope) {
            const cacheKey = createCacheKey(scope);
            setListCache(prev => {
                const newCache = new Map(prev);
                newCache.delete(cacheKey);
                return newCache;
            });
        }

        if (threadId) {
            setThreadCache(prev => {
                const newCache = new Map(prev);
                // Remove both body and non-body versions
                newCache.delete(createThreadCacheKey(threadId, true));
                newCache.delete(createThreadCacheKey(threadId, false));
                return newCache;
            });
        }
    }, []);

    const clearEmailCache = useCallback((): void => {
        setListCache(new Map());
        setThreadCache(new Map());
        setListErrors(new Map());
        setThreadErrors(new Map());
        setDeltaTokenByScope(new Map());
        setDeltaLoading(new Map());
        setDeltaMetrics(new Map());
        inflightRequests.current.clear();
        deltaInflightByScope.current.clear();
    }, []);

    const value = useMemo(() => ({
        // Contacts
        contacts,
        loading,
        error,
        refreshContacts,
        detectCompanyFromEmail,

        // Email Lists
        getEmailList,
        getEmailListLoading,
        getEmailListError,
        refreshEmailList,
        getEmailListLastUpdated,

        // Email Threads
        getEmailThread,
        getEmailThreadLoading,
        getEmailThreadError,
        refreshEmailThread,
        getEmailThreadLastUpdated,

        // Delta Sync
        seedScope,
        runDelta,
        getDeltaToken,
        getDeltaLoading,
        getDeltaMetrics,

        // Cache Management
        invalidateEmailCache,
        clearEmailCache
    }), [
        contacts,
        loading,
        error,
        refreshContacts,
        detectCompanyFromEmail,
        getEmailList,
        getEmailListLoading,
        getEmailListError,
        refreshEmailList,
        getEmailListLastUpdated,
        getEmailThread,
        getEmailThreadLoading,
        getEmailThreadError,
        refreshEmailThread,
        getEmailThreadLastUpdated,
        seedScope,
        runDelta,
        getDeltaToken,
        getDeltaLoading,
        getDeltaMetrics,
        invalidateEmailCache,
        clearEmailCache
    ]);

    return (
        <OfficeDataContext.Provider value={value}>
            {children}
        </OfficeDataContext.Provider>
    );
};

export function useOfficeData() {
    const ctx = useContext(OfficeDataContext);
    if (!ctx) throw new Error('useOfficeData must be used within an OfficeDataProvider');
    return ctx;
}