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

interface EmailScope {
    userId: string;
    folderId?: string;
    query?: string;
    pageSize?: number;
    labels?: string[];
}

interface OfficeDataContextType {
    // Contacts
    contacts: Contact[];
    loading: boolean;
    error: string | null;
    refreshContacts: (providers?: string[], opts?: { q?: string; company?: string; noCache?: boolean; limit?: number }) => Promise<void>;
    detectCompanyFromEmail: (email?: string) => string | undefined;

    // Email Lists
    getEmailList: (scope: EmailScope, providers: string[], noCache?: boolean) => Promise<EmailMessage[]>;
    getEmailListLoading: (scope: EmailScope) => boolean;
    getEmailListError: (scope: EmailScope) => string | null;
    refreshEmailList: (scope: EmailScope, providers: string[]) => Promise<void>;
    getEmailListLastUpdated: (scope: EmailScope) => number | null;

    // Email Threads
    getEmailThread: (threadId: string, includeBody?: boolean, noCache?: boolean) => Promise<EmailThread | null>;
    getEmailThreadLoading: (threadId: string) => boolean;
    getEmailThreadError: (threadId: string) => string | null;
    refreshEmailThread: (threadId: string, includeBody?: boolean) => Promise<void>;
    getEmailThreadLastUpdated: (threadId: string) => number | null;

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

    // Email cache state
    const [listCache, setListCache] = useState<Map<string, EmailListCacheEntry>>(new Map());
    const [threadCache, setThreadCache] = useState<Map<string, EmailThreadCacheEntry>>(new Map());
    const [listLoading, setListLoading] = useState<Map<string, boolean>>(new Map());
    const [threadLoading, setThreadLoading] = useState<Map<string, boolean>>(new Map());
    const [listErrors, setListErrors] = useState<Map<string, string>>(new Map());
    const [threadErrors, setThreadErrors] = useState<Map<string, string>>(new Map());

    // Inflight requests for de-duplication
    const inflightRequests = useRef<Map<string, Promise<any>>>(new Map());

    // Cache configuration
    const LIST_TTL = 60 * 1000; // 60 seconds
    const THREAD_TTL = 120 * 1000; // 120 seconds
    const MAX_LIST_CACHE_SIZE = 10;
    const MAX_THREAD_CACHE_SIZE = 50;

    // Helper functions
    const createCacheKey = (scope: EmailScope): string => {
        const parts = [
            scope.userId,
            scope.folderId || 'default',
            scope.query || '',
            scope.pageSize?.toString() || '50',
            (scope.labels || []).sort().join(',')
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

    const refreshContacts = useCallback(async (providers?: string[], opts?: { q?: string; company?: string; noCache?: boolean; limit?: number }) => {
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
    const getEmailList = useCallback(async (scope: EmailScope, providers: string[], noCache = false): Promise<EmailMessage[]> => {
        const cacheKey = createCacheKey(scope);

        // Check cache first
        if (!noCache) {
            const cached = listCache.get(cacheKey);
            if (cached && isCacheValid(cached)) {
                return cached.data;
            }
        }

        // Check for inflight request
        const inflightKey = `list:${cacheKey}`;
        if (inflightRequests.current.has(inflightKey)) {
            return inflightRequests.current.get(inflightKey)!;
        }

        // Start new request
        const requestPromise = (async () => {
            setListLoading(prev => new Map(prev).set(cacheKey, true));
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
                    0, // offset
                    noCache,
                    labels,
                    folderId
                );

                if (response.success && response.data?.messages) {
                    const messages = response.data.messages;

                    // Update cache
                    const cacheEntry: EmailListCacheEntry = {
                        data: messages,
                        timestamp: Date.now(),
                        ttl: LIST_TTL,
                        hasMore: response.data.has_more || false,
                        pageToken: (response.data as any).page_token
                    };

                    setListCache(prev => {
                        const newCache = new Map(prev);
                        newCache.set(cacheKey, cacheEntry);
                        evictLRU(newCache, MAX_LIST_CACHE_SIZE);
                        return newCache;
                    });

                    return messages;
                } else {
                    throw new Error('Failed to fetch email list');
                }
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Failed to fetch email list';
                setListErrors(prev => new Map(prev).set(cacheKey, errorMessage));
                throw error;
            } finally {
                setListLoading(prev => {
                    const newMap = new Map(prev);
                    newMap.delete(cacheKey);
                    return newMap;
                });
                inflightRequests.current.delete(inflightKey);
            }
        })();

        inflightRequests.current.set(inflightKey, requestPromise);
        return requestPromise;
    }, [listCache]);

    const getEmailListLoading = useCallback((scope: EmailScope): boolean => {
        const cacheKey = createCacheKey(scope);
        return listLoading.get(cacheKey) || false;
    }, [listLoading]);

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
    const getEmailThread = useCallback(async (threadId: string, includeBody = false, noCache = false): Promise<EmailThread | null> => {
        const cacheKey = createThreadCacheKey(threadId, includeBody);

        // Check cache first
        if (!noCache) {
            const cached = threadCache.get(cacheKey);
            if (cached && isCacheValid(cached)) {
                return cached.data;
            }
        }

        // Check for inflight request
        const inflightKey = `thread:${cacheKey}`;
        if (inflightRequests.current.has(inflightKey)) {
            return inflightRequests.current.get(inflightKey)!;
        }

        // Start new request
        const requestPromise = (async () => {
            setThreadLoading(prev => new Map(prev).set(threadId, true));
            setThreadErrors(prev => {
                const newMap = new Map(prev);
                newMap.delete(threadId);
                return newMap;
            });

            try {
                const response = await officeApi.getThread(threadId, includeBody, noCache);

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
                setThreadLoading(prev => {
                    const newMap = new Map(prev);
                    newMap.delete(threadId);
                    return newMap;
                });
                inflightRequests.current.delete(inflightKey);
            }
        })();

        inflightRequests.current.set(inflightKey, requestPromise);
        return requestPromise;
    }, [threadCache]);

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
        inflightRequests.current.clear();
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