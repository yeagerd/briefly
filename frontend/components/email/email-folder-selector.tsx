'use client';

import { officeApi } from '@/api';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useIntegrations } from '@/contexts/integrations-context';
import type { EmailFolder } from '@/types/api/office';
import { Provider } from '@/types/api/office';
import { Archive, Inbox, Mail, Menu, Send, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

// Fallback folders in case API fails
const FALLBACK_FOLDERS: EmailFolder[] = [
    { label: 'inbox', name: 'Inbox', provider: Provider.GOOGLE, account_email: '', is_system: true },
    { label: 'inbox', name: 'Inbox', provider: Provider.MICROSOFT, account_email: '', is_system: true },
    { label: 'sent', name: 'Sent', provider: Provider.GOOGLE, account_email: '', is_system: true },
    { label: 'sent', name: 'Sent', provider: Provider.MICROSOFT, account_email: '', is_system: true },
    { label: 'draft', name: 'Drafts', provider: Provider.GOOGLE, account_email: '', is_system: true },
    { label: 'draft', name: 'Drafts', provider: Provider.MICROSOFT, account_email: '', is_system: true },
    { label: 'spam', name: 'Spam', provider: Provider.GOOGLE, account_email: '', is_system: true },
    { label: 'spam', name: 'Spam', provider: Provider.MICROSOFT, account_email: '', is_system: true },
    { label: 'trash', name: 'Trash', provider: Provider.GOOGLE, account_email: '', is_system: true },
    { label: 'trash', name: 'Trash', provider: Provider.MICROSOFT, account_email: '', is_system: true },
];

interface EmailFolderSelectorProps {
    onFolderSelect: (folder: EmailFolder) => void;
    selectedFolder?: EmailFolder;
    selectedClassification?: string;
    onClassificationSelect?: (classification: string) => void;
}

export function EmailFolderSelector({
    onFolderSelect,
    selectedFolder,
    selectedClassification,
    onClassificationSelect
}: EmailFolderSelectorProps) {
    const { activeProviders } = useIntegrations();
    const [folders, setFolders] = useState<EmailFolder[]>(FALLBACK_FOLDERS);
    const [error, setError] = useState<string | null>(null);

    const fetchFolders = useCallback(async () => {
        if (!activeProviders || activeProviders.length === 0) {
            setFolders(FALLBACK_FOLDERS);
            return;
        }

        setError(null);

        try {
            const response = await officeApi.getEmailFolders(activeProviders, true);

            if (response.success && response.data) {
                // The response data contains the folder structure
                const foldersData = response.data;
                if (foldersData.folders && Array.isArray(foldersData.folders)) {
                    let apiFolders = foldersData.folders;

                    // Ensure inbox folder exists for Microsoft
                    if (activeProviders?.includes('microsoft') || activeProviders?.includes(Provider.MICROSOFT)) {
                        const hasInboxFolder = apiFolders.some(f =>
                            f.label === 'inbox' &&
                            f.provider === Provider.MICROSOFT
                        );

                        if (!hasInboxFolder) {
                            apiFolders = [
                                {
                                    label: 'inbox',
                                    name: 'Inbox',
                                    provider: Provider.MICROSOFT,
                                    account_email: '',
                                    is_system: true,
                                    provider_folder_id: 'inbox' // Use a simple identifier
                                },
                                ...apiFolders
                            ];
                        }
                    }

                    setFolders(apiFolders);

                    // Auto-select inbox folder if it exists and we're using the default folder
                    // Check if selectedFolder is the default inbox folder (no provider_folder_id)
                    const isDefaultFolder = selectedFolder &&
                        selectedFolder.label === 'inbox' &&
                        !selectedFolder.provider_folder_id;

                    const inboxFolder = apiFolders.find(f => f.label === 'inbox' && f.provider === activeProviders[0]);
                    if (inboxFolder && isDefaultFolder) {
                        onFolderSelect(inboxFolder);
                    }
                } else {
                    console.warn('Unexpected folder data structure, using fallback:', response);
                    setFolders(FALLBACK_FOLDERS);
                }
            } else {
                console.warn('Failed to fetch folders, using fallback:', response);
                setFolders(FALLBACK_FOLDERS);
            }
        } catch (err) {
            if (process.env.NODE_ENV !== 'test') {
                // Avoid noisy console.error during unit tests
                // eslint-disable-next-line no-console
                console.error('Error fetching email folders:', err);
            }
            setError('Failed to load folders');
            setFolders(FALLBACK_FOLDERS);
        }
    }, [activeProviders, onFolderSelect, selectedFolder]);

    useEffect(() => {
        fetchFolders();
    }, [fetchFolders]);

    const getFolderIcon = (label: string) => {
        switch (label) {
            case 'inbox':
                return <Inbox className="h-4 w-4" />;
            case 'sent':
                return <Send className="h-4 w-4" />;
            case 'draft':
                return <Mail className="h-4 w-4" />;
            case 'spam':
                return <Trash2 className="h-4 w-4" />;
            case 'trash':
                return <Trash2 className="h-4 w-4" />;
            case 'archive':
                return <Archive className="h-4 w-4" />;
            default:
                return <Mail className="h-4 w-4" />;
        }
    };

    // Sort folders in the specified order
    const sortFolders = (folders: EmailFolder[]): EmailFolder[] => {
        // Define the order for system folders
        const systemFolderOrder = ['inbox', 'draft', 'archive', 'sent', 'trash'];

        // Separate system and user folders
        const systemFolders: EmailFolder[] = [];
        const userFolders: EmailFolder[] = [];

        folders.forEach(folder => {
            if (folder.is_system) {
                systemFolders.push(folder);
            } else {
                userFolders.push(folder);
            }
        });

        // Sort system folders by the defined order
        const sortedSystemFolders = systemFolders.sort((a, b) => {
            const aIndex = systemFolderOrder.indexOf(a.label);
            const bIndex = systemFolderOrder.indexOf(b.label);
            // If both are in the order list, sort by their position
            if (aIndex !== -1 && bIndex !== -1) {
                return aIndex - bIndex;
            }
            // If only one is in the order list, prioritize it
            if (aIndex !== -1) return -1;
            if (bIndex !== -1) return 1;
            // If neither is in the order list, sort alphabetically
            return a.name.localeCompare(b.name);
        });

        // Sort user folders alphabetically
        const sortedUserFolders = userFolders.sort((a, b) =>
            a.name.localeCompare(b.name)
        );

        return [...sortedSystemFolders, ...sortedUserFolders];
    };

    const sortedFolders = sortFolders(folders);
    const systemFolderCount = sortedFolders.filter(f => f.is_system).length;

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                    <Menu className="h-4 w-4" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
                {/* Regular folders */}
                {sortedFolders.map((folder, index) => (
                    <div key={folder.label}>
                        <DropdownMenuItem
                            onClick={() => {
                                onFolderSelect(folder);
                                // Reset classification to 'all' for all folders
                                // This ensures regular inbox shows all emails, not just focused/priority
                                onClassificationSelect?.('all');
                            }}
                            className="flex items-center gap-2 cursor-pointer"
                        >
                            {getFolderIcon(folder.label)}
                            <span className={`flex-1 ${selectedFolder?.label === folder.label &&
                                (!selectedClassification || selectedClassification === 'all') ? 'font-bold' : ''
                                }`}>
                                {folder.name}
                            </span>
                            {folder.message_count !== undefined && (
                                <span className="text-xs text-muted-foreground">
                                    {folder.message_count}
                                </span>
                            )}
                        </DropdownMenuItem>
                        {/* Add separator after system folders if there are user folders */}
                        {folder.is_system && index === systemFolderCount - 1 && sortedFolders.some(f => !f.is_system) && (
                            <DropdownMenuSeparator />
                        )}
                    </div>
                ))}
                {error && (
                    <div className="px-2 py-1 text-xs text-muted-foreground">
                        {error}
                    </div>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
