import SourceFilter from '@/components/contacts/source-filter';
import ContactListItem from '@/components/contacts/contact-list-item';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useContacts } from '@/contexts/contacts-context';
import { BarChart3, Plus, RefreshCw, Settings } from 'lucide-react';
import React, { useCallback, useMemo, useState } from 'react';

interface ContactsViewProps {
    toolDataLoading?: boolean;
    activeTool?: string;
}

const ContactsView: React.FC<ContactsViewProps> = () => {
    const {
        contacts,
        loading,
        error,
        refreshContacts,
        filterContacts,
        availableSources,
        sourceStats
    } = useContacts();
    const [refreshing, setRefreshing] = useState(false);
    const [search, setSearch] = useState('');
    const [sourceFilter, setSourceFilter] = useState<string[] | undefined>(undefined);
    const [tagFilter, setTagFilter] = useState<string[]>([]);



    const handleRefresh = useCallback(async () => {
        setRefreshing(true);
        try {
            await refreshContacts();
        } finally {
            setRefreshing(false);
        }
    }, [refreshContacts]);

    // Client-side filtering
    const filteredContacts = useMemo(() => {
        return filterContacts({
            search,
            sourceServices: sourceFilter,
            tags: tagFilter
        });
    }, [filterContacts, search, sourceFilter, tagFilter]);

    // Get unique tags from contacts
    const allTags = useMemo(() => {
        const tagSet = new Set<string>();
        contacts.forEach(contact => {
            if (contact.tags) {
                contact.tags.forEach((tag: string) => tagSet.add(tag));
            }
        });
        return Array.from(tagSet).sort();
    }, [contacts]);

    // Get provider information for contacts
    const providerInfo = useMemo(() => {
        const info: Record<string, string> = {};
        contacts.forEach(contact => {
            if ((contact.source_services?.includes('contacts') || contact.source_services?.includes('office')) && contact.provider) {
                info['contacts'] = contact.provider;
            }
        });
        return info;
    }, [contacts]);

    return (
        <div className="flex flex-col h-full">
            <div className="p-4 border-b bg-white">
                <div className="flex items-center gap-3">
                    <h1 className="text-xl font-semibold">Contacts</h1>
                    <div className="flex items-center gap-2 ml-4">
                        <Input
                            placeholder="Search name, email, or notes"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="w-64"
                        />

                        {/* Source Filter */}
                        <SourceFilter
                            sourceFilter={sourceFilter}
                            onSourceFilterChange={(sources) => {
                                setSourceFilter(sources);
                            }}
                            availableSources={availableSources}
                            providerInfo={providerInfo}
                        />

                        {/* Tags Filter */}
                        <select
                            value={tagFilter}
                            onChange={(e) => {
                                const selectedOptions = Array.from(e.target.selectedOptions, option => option.value);
                                setTagFilter(selectedOptions);
                            }}
                            className="border rounded px-2 py-1 text-sm"
                            multiple
                        >
                            <option value="">All Tags</option>
                            {allTags.map(tag => (
                                <option key={tag} value={tag}>{tag}</option>
                            ))}
                        </select>



                        <Button variant="ghost" size="sm" onClick={handleRefresh} disabled={refreshing || loading} title="Refresh">
                            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                        </Button>

                        <Button variant="outline" size="sm" title="Add Contact">
                            <Plus className="w-4 h-4" />
                        </Button>

                        <Button variant="outline" size="sm" title="Discovery Settings">
                            <Settings className="w-4 h-4" />
                        </Button>

                        <Button variant="outline" size="sm" title="Analytics">
                            <BarChart3 className="w-4 h-4" />
                        </Button>
                    </div>
                </div>

                {/* Source Statistics */}
                <div className="flex gap-4 mt-3 text-sm text-gray-600">
                    <span>Total: {contacts.length}</span>
                    <span>Contacts: {sourceStats.contacts}</span>
                    <span>Discovered: {sourceStats.discovered}</span>
                    <span>Both: {sourceStats.both}</span>
                </div>
            </div>

            <div className="flex-1 overflow-auto">
                {loading ? (
                    <div className="p-8 text-center text-muted-foreground">Loading…</div>
                ) : error ? (
                    <div className="p-8 text-center text-red-500">{error}</div>
                ) : filteredContacts.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground">No contacts found.</div>
                ) : (
                    <div className="p-4 space-y-2">
                        {filteredContacts.map((contact) => (
                            <ContactListItem
                                key={contact.id}
                                contact={contact}
                                onClick={(contact) => {
                                    // TODO: Open contact detail modal
                                    console.log('Contact clicked:', contact);
                                }}
                                onEdit={(contact) => {
                                    // TODO: Open edit modal
                                    console.log('Edit contact:', contact);
                                }}
                                onDelete={(contact) => {
                                    // TODO: Implement delete functionality
                                    console.log('Delete contact:', contact);
                                }}
                                onMerge={(contact) => {
                                    // TODO: Open merge modal
                                    console.log('Merge contact:', contact);
                                }}
                                onViewDetails={(contact) => {
                                    // TODO: Open detail modal
                                    console.log('View details:', contact);
                                }}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ContactsView;