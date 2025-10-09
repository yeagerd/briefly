import AuthSessionProvider from '@/components/auth/session-provider';
import { Toaster } from '@/components/ui/toaster';
import { ChatPanelProvider } from '@/contexts/chat-panel-context';
import { ContactsProvider } from '@/contexts/contacts-context';
import { IntegrationsProvider } from '@/contexts/integrations-context';
import { OfficeDataProvider } from '@/contexts/office-data-context';
import { UserPreferencesProvider } from '@/contexts/settings-context';
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
    title: 'Briefly',
    description: 'Calendar Intelligence',
    icons: {
        icon: '/favicon.svg?v=4',
    }
}

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode
}>) {
    return (
        <html lang="en">
            <body>
                <AuthSessionProvider>
                    <OfficeDataProvider>
                        <IntegrationsProvider>
                            <UserPreferencesProvider>
                                <ChatPanelProvider>
                                    <ContactsProvider>
                                        {children}
                                    </ContactsProvider>
                                </ChatPanelProvider>
                            </UserPreferencesProvider>
                        </IntegrationsProvider>
                    </OfficeDataProvider>
                </AuthSessionProvider>
                <Toaster />
            </body>
        </html>
    )
}
