import { useIntegrations } from '@/contexts/integrations-context';
import { useUserPreferences } from '@/contexts/settings-context';
import { officeApi } from '@/api';
import type { CalendarEvent } from '@/types/api/office';
import { getSession } from 'next-auth/react';
import React, { useCallback, useEffect, useState } from 'react';
import CalendarGridView from './calendar-grid-view';

interface CalendarViewProps {
    toolDataLoading?: boolean;
    activeTool?: string;
}

const CalendarView: React.FC<CalendarViewProps> = ({ toolDataLoading = false, activeTool }) => {
    const [events, setEvents] = useState<CalendarEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [noIntegrations, setNoIntegrations] = useState(false);
    const { loading: integrationsLoading, activeProviders } = useIntegrations();
    const { effectiveTimezone } = useUserPreferences();

    const fetchCalendarEvents = useCallback(async (forceRefresh = false) => {
        if (!activeProviders || activeProviders.length === 0) {
            setNoIntegrations(true);
            setLoading(false);
            return;
        }
        setNoIntegrations(false);

        try {
            const session = await getSession();
            const userId = session?.user?.id;
            if (!userId) throw new Error('No user id found in session');

            const response = await officeApi.getCalendarEvents(
                activeProviders,
                10,
                new Date().toISOString().split('T')[0],
                new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                undefined,
                undefined,
                effectiveTimezone,
                forceRefresh
            );

            if (response.success && response.data) {
                const events = Array.isArray(response.data) ? response.data : [];
                setEvents(events);
                setError(null);
            } else {
                setError('Failed to fetch calendar events');
            }
        } catch (e: unknown) {
            setError((e && typeof e === 'object' && 'message' in e) ? (e as { message?: string }).message || 'Failed to load calendar events' : 'Failed to load calendar events');
        }
    }, [activeProviders, effectiveTimezone]);

    const handleRefresh = useCallback(async () => {
        setRefreshing(true);
        try {
            await fetchCalendarEvents(true); // Pass true to bypass cache
        } finally {
            setRefreshing(false);
        }
    }, [fetchCalendarEvents]);

    useEffect(() => {
        if (toolDataLoading || integrationsLoading) {
            setLoading(true);
            return;
        }

        if (activeTool !== 'calendar') {
            setLoading(false);
            return;
        }

        if ((!activeProviders || activeProviders.length === 0)) {
            setNoIntegrations(true);
            setEvents([]);
            setLoading(false);
            setError(null);
            return;
        } else {
            setNoIntegrations(false);
        }

        let isMounted = true;
        setLoading(true);
        (async () => {
            try {
                await fetchCalendarEvents(false); // Use cached data for initial load
            } finally {
                if (isMounted) setLoading(false);
            }
        })();
        return () => { isMounted = false; };
    }, [activeProviders, integrationsLoading, toolDataLoading, activeTool, fetchCalendarEvents]);

    return (
        <div className="h-full flex flex-col">
            {/* Content */}
            <div className="flex-1 overflow-hidden">
                <CalendarGridView
                    toolDataLoading={toolDataLoading}
                    activeTool={activeTool}
                    events={events}
                    loading={loading || integrationsLoading}
                    refreshing={refreshing}
                    error={error}
                    noIntegrations={noIntegrations}
                    onRefresh={handleRefresh}
                />
            </div>
        </div>
    );
};

export default CalendarView; 