'use client';

import { useSession } from 'next-auth/react';

interface DashboardViewProps {
    toolDataLoading?: boolean;
    activeTool?: string;
}

export function DashboardView({ }: DashboardViewProps) {
    const { data: session } = useSession();

    const getTimeBasedGreeting = () => {
        const hour = new Date().getHours();

        if (hour < 12) {
            return 'Good morning';
        } else if (hour < 17) {
            return 'Good afternoon';
        } else {
            return 'Good evening';
        }
    };

    return (
        <div className="p-8">
            <div className="mb-6">
                <h1 className="text-xl font-medium text-gray-900">
                    {getTimeBasedGreeting()}, {session?.user?.name || 'User'}
                </h1>
            </div>
        </div>
    );
}
