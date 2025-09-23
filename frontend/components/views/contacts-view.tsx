import SourceFilter from '@/components/contacts/source-filter';
import ContactListItem from '@/components/contacts/contact-list-item';
import ContactDetailModal from '@/components/contacts/contact-detail-modal';
import ContactForm from '@/components/contacts/contact-form';
import DiscoverySettings from '@/components/contacts/discovery-settings';
import AnalyticsDashboard from '@/components/contacts/analytics-dashboard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useContacts } from '@/contexts/contacts-context';
import { contactsApi } from '@/api';
import type { Contact } from '@/types/api/contacts';
import { getSession } from 'next-auth/react';
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

    // Modal state management
    const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
    const [isContactDetailModalOpen, setIsContactDetailModalOpen] = useState(false);
    const [isContactFormModalOpen, setIsContactFormModalOpen] = useState(false);
    const [isDiscoverySettingsModalOpen, setIsDiscoverySettingsModalOpen] = useState(false);
    const [isAnalyticsModalOpen, setIsAnalyticsModalOpen] = useState(false);



    const handleRefresh = useCallback(async () => {
        setRefreshing(true);
        try {
            await refreshContacts();
        } finally {
            setRefreshing(false);
        }
    }, [refreshContacts]);

    // Modal handlers
    const handleContactClick = useCallback((contact: Contact) => {
        setSelectedContact(contact);
        setIsContactDetailModalOpen(true);
    }, []);

    const handleContactEdit = useCallback((contact: Contact) => {
        setSelectedContact(contact);
        setIsContactDetailModalOpen(false);
        setIsContactFormModalOpen(true);
    }, []);

    const handleContactFormSubmit = useCallback(async (contactData: any) => {
        try {
            const session = await getSession();
            const userId = session?.user?.id;
            if (!userId) throw new Error('No user id found in session');

            if (selectedContact) {
                // Update existing contact
                await contactsApi.updateContact(selectedContact.id!, contactData);
            } else {
                // Create new contact
                await contactsApi.createContact({
                    ...contactData,
                    user_id: userId
                });
            }
            handleCloseModals();
            await refreshContacts();
        } catch (error) {
            console.error('Failed to save contact:', error);
            // TODO: Show error message to user
        }
    }, [selectedContact, refreshContacts, handleCloseModals]);

    const handleContactDelete = useCallback(async (contact: Contact) => {
        if (!contact.id) return;
        
        try {
            await contactsApi.deleteContact(contact.id);
            handleCloseModals();
            await refreshContacts();
        } catch (error) {
            console.error('Failed to delete contact:', error);
            // TODO: Show error message to user
        }
    }, [refreshContacts, handleCloseModals]);

    const handleContactMerge = useCallback((contact: Contact) => {
        // TODO: Implement merge functionality
        console.log('Merge contact:', contact);
    }, []);

    const handleAddContact = useCallback(() => {
        setSelectedContact(null);
        setIsContactFormModalOpen(true);
    }, []);

    const handleOpenDiscoverySettings = useCallback(() => {
        setIsDiscoverySettingsModalOpen(true);
    }, []);

    const handleOpenAnalytics = useCallback(() => {
        setIsAnalyticsModalOpen(true);
    }, []);

    const handleCloseModals = useCallback(() => {
        setIsContactDetailModalOpen(false);
        setIsContactFormModalOpen(false);
        setIsDiscoverySettingsModalOpen(false);
        setIsAnalyticsModalOpen(false);
        setSelectedContact(null);
    }, []);

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

                        <Button variant="outline" size="sm" title="Add Contact" onClick={handleAddContact}>
                            <Plus className="w-4 h-4" />
                        </Button>

                        <Button variant="outline" size="sm" title="Discovery Settings" onClick={handleOpenDiscoverySettings}>
                            <Settings className="w-4 h-4" />
                        </Button>

                        <Button variant="outline" size="sm" title="Analytics" onClick={handleOpenAnalytics}>
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
                                onClick={handleContactClick}
                                onEdit={handleContactEdit}
                                onDelete={handleContactDelete}
                                onMerge={handleContactMerge}
                                onViewDetails={handleContactClick}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Modals */}
            {selectedContact && isContactDetailModalOpen && (
                <ContactDetailModal
                    contact={selectedContact}
                    isOpen={isContactDetailModalOpen}
                    onClose={handleCloseModals}
                    onEdit={handleContactEdit}
                    onDelete={handleContactDelete}
                    onMerge={handleContactMerge}
                />
            )}

            {isContactFormModalOpen && (
                <ContactForm
                    onSubmit={handleContactFormSubmit}
                    onCancel={handleCloseModals}
                    initialData={selectedContact ? {
                        email_address: selectedContact.email_address,
                        display_name: selectedContact.display_name,
                        given_name: selectedContact.given_name,
                        family_name: selectedContact.family_name,
                        tags: selectedContact.tags,
                        notes: selectedContact.notes
                    } : undefined}
                />
            )}

            {isDiscoverySettingsModalOpen && (
                <DiscoverySettings
                    onClose={handleCloseModals}
                />
            )}

            {isAnalyticsModalOpen && (
                <AnalyticsDashboard
                    onClose={handleCloseModals}
                    contacts={contacts}
                />
            )}
        </div>
    );
};

export default ContactsView;