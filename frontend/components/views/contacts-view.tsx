import { contactsApi } from '@/api';
import ContactDetailModal from '@/components/contacts/contact-detail-modal';
import ContactForm from '@/components/contacts/contact-form';
import ContactListItem from '@/components/contacts/contact-list-item';
import DiscoverySettings from '@/components/contacts/discovery-settings';
import EditContactForm from '@/components/contacts/edit-contact-form';
import SourceFilter from '@/components/contacts/source-filter';
import TagsFilter from '@/components/contacts/tags-filter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useContacts } from '@/contexts/contacts-context';
import type { Contact, ContactCreate, EmailContactUpdate } from '@/types/api/contacts';
import { Plus, RefreshCw, Settings } from 'lucide-react';
import { getSession } from 'next-auth/react';
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
        availableSources
    } = useContacts();
    const [refreshing, setRefreshing] = useState(false);
    const [search, setSearch] = useState('');
    const [sourceFilter, setSourceFilter] = useState<string[] | undefined>(undefined);
    const [tagFilter, setTagFilter] = useState<string[] | undefined>(undefined);

    // Modal state management
    const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
    const [isContactDetailModalOpen, setIsContactDetailModalOpen] = useState(false);
    const [isContactFormModalOpen, setIsContactFormModalOpen] = useState(false);
    const [isDiscoverySettingsModalOpen, setIsDiscoverySettingsModalOpen] = useState(false);



    const handleRefresh = useCallback(async () => {
        setRefreshing(true);
        try {
            await refreshContacts();
        } finally {
            setRefreshing(false);
        }
    }, [refreshContacts]);

    const handleCloseModals = useCallback(() => {
        setIsContactDetailModalOpen(false);
        setIsContactFormModalOpen(false);
        setIsDiscoverySettingsModalOpen(false);
        setSelectedContact(null);
    }, []);

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

    const handleContactFormSubmit = useCallback(async (contactData: ContactCreate | EmailContactUpdate) => {
        try {
            const session = await getSession();
            const userId = session?.user?.id;
            if (!userId) throw new Error('No user id found in session');

            if (selectedContact && selectedContact.id) {
                // Update existing contact
                await contactsApi.updateContact(selectedContact.id.toString(), contactData as EmailContactUpdate);
            } else {
                // Create new contact
                await contactsApi.createContact({
                    ...contactData,
                    user_id: userId
                } as ContactCreate);
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
            await contactsApi.deleteContact(contact.id.toString());
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

    const handleContactDownload = useCallback((contact: Contact) => {
        // Create a vCard format for download
        const fullName = contact.display_name ||
            [contact.given_name, contact.family_name].filter(Boolean).join(' ') ||
            contact.email_address;

        const vCard = [
            'BEGIN:VCARD',
            'VERSION:3.0',
            `FN:${fullName}`,
            contact.given_name || contact.family_name ? `N:${contact.family_name || ''};${contact.given_name || ''};;;` : '',
            `EMAIL:${contact.email_address}`,
            ...(contact.phone_numbers?.map(phone => `TEL:${phone.number}`) || []),
            contact.notes ? `NOTE:${contact.notes}` : '',
            'END:VCARD'
        ].filter(line => line).join('\n');

        // Create and download the file
        const blob = new Blob([vCard], { type: 'text/vcard' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${contact.display_name || contact.email_address}.vcf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }, []);

    const handleAddContact = useCallback(() => {
        setSelectedContact(null);
        setIsContactFormModalOpen(true);
    }, []);

    const handleOpenDiscoverySettings = useCallback(() => {
        setIsDiscoverySettingsModalOpen(true);
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
                        <TagsFilter
                            tagFilter={tagFilter}
                            onTagFilterChange={setTagFilter}
                            availableTags={allTags}
                        />



                        <Button variant="ghost" size="sm" onClick={handleRefresh} disabled={refreshing || loading} title="Refresh">
                            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                        </Button>

                        <Button variant="outline" size="sm" title="Add Contact" onClick={handleAddContact}>
                            <Plus className="w-4 h-4" />
                        </Button>

                        <Button variant="outline" size="sm" title="Discovery Settings" onClick={handleOpenDiscoverySettings}>
                            <Settings className="w-4 h-4" />
                        </Button>

                    </div>
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
                    <div className="p-4">
                        {/* Column Headers */}
                        <div className="bg-gray-50 border rounded px-4 py-2 mb-2 flex items-center justify-between">
                            <div className="flex items-center gap-4 flex-1">
                                <div className="font-medium text-gray-700 text-sm" style={{ width: '32px' }}>
                                    {/* Avatar space */}
                                </div>
                                <div className="font-medium text-gray-700 text-sm" style={{ width: '180px' }}>
                                    Name
                                </div>
                                <div className="font-medium text-gray-700 text-sm" style={{ width: '250px' }}>
                                    Email
                                </div>
                                <div className="font-medium text-gray-700 text-sm" style={{ width: '150px' }}>
                                    Phone
                                </div>
                            </div>
                            <div className="font-medium text-gray-700 text-sm">
                                Actions
                            </div>
                        </div>

                        {/* Contact List */}
                        <div className="space-y-1">
                            {filteredContacts.map((contact) => (
                                <ContactListItem
                                    key={contact.id}
                                    contact={contact}
                                    onClick={handleContactClick}
                                    onEdit={handleContactEdit}
                                    onDelete={handleContactDelete}
                                    onDownload={handleContactDownload}
                                />
                            ))}
                        </div>
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
                selectedContact ? (
                    <EditContactForm
                        contact={selectedContact}
                        onSubmit={(id, contactData) => handleContactFormSubmit(contactData)}
                        onCancel={handleCloseModals}
                        onMerge={handleContactMerge}
                    />
                ) : (
                    <ContactForm
                        onSubmit={handleContactFormSubmit}
                        onCancel={handleCloseModals}
                    />
                )
            )}

            {isDiscoverySettingsModalOpen && (
                <DiscoverySettings
                    onClose={handleCloseModals}
                />
            )}

        </div>
    );
};

export default ContactsView;