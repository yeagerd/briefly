/**
 * Hook for managing delta sync triggers and intervals.
 * 
 * Provides automatic delta sync on folder focus, interval-based sync,
 * manual refresh, and debounced rapid re-entry.
 */

import type { EmailScope } from '@/contexts/office-data-context';
import { useOfficeData } from '@/contexts/office-data-context';
import { useCallback, useEffect, useRef } from 'react';

interface UseDeltaSyncOptions {
    scope: EmailScope;
    providers: string[];
    intervalMs?: number; // Default 60 seconds
    debounceMs?: number; // Default 2 seconds
    enabled?: boolean;
}

export function useDeltaSync({
    scope,
    providers,
    intervalMs = 60000, // 60 seconds
    debounceMs = 2000, // 2 seconds
    enabled = true
}: UseDeltaSyncOptions) {
    const { seedScope, runDelta, getDeltaToken, getDeltaLoading } = useOfficeData();

    const intervalRef = useRef<NodeJS.Timeout | null>(null);
    const debounceRef = useRef<NodeJS.Timeout | null>(null);
    const lastTriggerRef = useRef<number>(0);

    // Debounced delta trigger
    const triggerDelta = useCallback(() => {
        if (!enabled) return;

        const now = Date.now();
        lastTriggerRef.current = now;

        // Clear existing debounce
        if (debounceRef.current) {
            clearTimeout(debounceRef.current);
        }

        // Set new debounce
        debounceRef.current = setTimeout(async () => {
            // Check if this is still the latest trigger
            if (lastTriggerRef.current !== now) {
                return;
            }

            try {
                const deltaToken = getDeltaToken(scope);
                if (deltaToken) {
                    await runDelta(scope, providers);
                } else {
                    // No token, need to seed first
                    await seedScope(scope, providers);
                }
            } catch (error) {
                console.error('Delta sync failed:', error);
            }
        }, debounceMs);
    }, [enabled, scope, providers, debounceMs, getDeltaToken, runDelta, seedScope]);

    // Manual refresh (immediate, no debounce)
    const refresh = useCallback(async () => {
        if (!enabled) return;

        try {
            const deltaToken = getDeltaToken(scope);
            if (deltaToken) {
                await runDelta(scope, providers);
            } else {
                await seedScope(scope, providers);
            }
        } catch (error) {
            console.error('Manual refresh failed:', error);
        }
    }, [enabled, scope, providers, getDeltaToken, runDelta, seedScope]);

    // Start interval-based sync
    const startInterval = useCallback(() => {
        if (!enabled || intervalRef.current) return;

        intervalRef.current = setInterval(() => {
            triggerDelta();
        }, intervalMs);
    }, [enabled, intervalMs, triggerDelta]);

    // Stop interval-based sync
    const stopInterval = useCallback(() => {
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
    }, []);

    // Handle folder focus (when component mounts or scope changes)
    useEffect(() => {
        if (!enabled) return;

        // Trigger initial sync on focus
        triggerDelta();

        // Start interval
        startInterval();

        return () => {
            stopInterval();
        };
    }, [enabled, scope.userId, scope.folderId, scope.query, triggerDelta, startInterval, stopInterval]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
            if (debounceRef.current) {
                clearTimeout(debounceRef.current);
            }
        };
    }, []);

    return {
        triggerDelta,
        refresh,
        startInterval,
        stopInterval,
        isLoading: getDeltaLoading(scope),
        hasToken: !!getDeltaToken(scope)
    };
}
