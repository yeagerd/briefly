import { Button } from '@/components/ui/button';
import type { Contact } from '@/types/api/contacts';
import { Download, Edit, Phone, Trash2 } from 'lucide-react';
import React from 'react';

interface ContactListItemProps {
    contact: Contact;
    onEdit?: (contact: Contact) => void;
    onDelete?: (contact: Contact) => void;
    onDownload?: (contact: Contact) => void;
    onClick?: (contact: Contact) => void;
}

const ContactListItem: React.FC<ContactListItemProps> = ({
    contact,
    onEdit,
    onDelete,
    onDownload,
    onClick,
}) => {
    const getPrimaryName = () => {
        if (contact.display_name) return contact.display_name;
        if (contact.given_name && contact.family_name) {
            return `${contact.given_name} ${contact.family_name}`;
        }
        if (contact.given_name) return contact.given_name;
        if (contact.family_name) return contact.family_name;
        return contact.email_address;
    };

    const getPrimaryPhone = () => {
        return contact.phone_numbers && contact.phone_numbers.length > 0
            ? contact.phone_numbers[0]
            : 'No phone';
    };

    const getInitials = () => {
        const name = getPrimaryName();
        if (name === contact.email_address) {
            return contact.email_address.slice(0, 2).toUpperCase();
        }
        return name.slice(0, 2).toUpperCase();
    };

    const handleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (onClick) {
            onClick(contact);
        }
    };

    const handleActionClick = (e: React.MouseEvent, action: () => void) => {
        e.stopPropagation();
        action();
    };

    return (
        <div
            className="bg-white border rounded px-4 py-3 hover:shadow-sm transition-all cursor-pointer hover:border-gray-300 flex items-center justify-between"
            onClick={handleClick}
        >
            {/* Contact Info - Single Line */}
            <div className="flex items-center gap-4 flex-1 min-w-0">
                {/* Avatar */}
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold text-xs flex-shrink-0">
                    {getInitials()}
                </div>

                {/* Name */}
                <div className="font-medium text-gray-900 min-w-0 flex-shrink-0" style={{ width: '180px' }}>
                    <span className="truncate block">{getPrimaryName()}</span>
                </div>

                {/* Email */}
                <div className="text-gray-600 min-w-0 flex-shrink-0" style={{ width: '250px' }}>
                    <span className="truncate block">{contact.email_address}</span>
                </div>

                {/* Phone */}
                <div className="text-gray-600 min-w-0 flex-shrink-0 flex items-center gap-1" style={{ width: '150px' }}>
                    <Phone className="w-3 h-3 text-gray-400" />
                    <span className="truncate">{getPrimaryPhone()}</span>
                </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-1 flex-shrink-0">
                {onDownload && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => handleActionClick(e, () => onDownload(contact))}
                        className="h-8 px-2 text-xs"
                        title="Download contact"
                    >
                        <Download className="w-3 h-3" />
                    </Button>
                )}

                {onEdit && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => handleActionClick(e, () => onEdit(contact))}
                        className="h-8 px-2 text-xs"
                        title="Edit contact"
                    >
                        <Edit className="w-3 h-3" />
                    </Button>
                )}

                {onDelete && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => handleActionClick(e, () => onDelete(contact))}
                        className="h-8 px-2 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                        title="Delete contact"
                    >
                        <Trash2 className="w-3 h-3" />
                    </Button>
                )}
            </div>
        </div>
    );
};

export default ContactListItem;
