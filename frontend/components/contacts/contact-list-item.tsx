import { Button } from '@/components/ui/button';
import type { Contact } from '@/types/api/contacts';
import { Calendar, Edit, ExternalLink, FileText, Mail, Merge, Trash2 } from 'lucide-react';
import React from 'react';

interface ContactListItemProps {
    contact: Contact;
    onEdit?: (contact: Contact) => void;
    onDelete?: (contact: Contact) => void;
    onMerge?: (contact: Contact) => void;
    onViewDetails?: (contact: Contact) => void;
    onClick?: (contact: Contact) => void;
}

const ContactListItem: React.FC<ContactListItemProps> = ({
    contact,
    onEdit,
    onDelete,
    onMerge,
    onViewDetails,
    onClick,
}) => {
    const getSourceServiceIcon = (service: string) => {
        switch (service) {
            case 'office':
                return <ExternalLink className="w-3 h-3" />;
            case 'email':
                return <Mail className="w-3 h-3" />;
            case 'calendar':
                return <Calendar className="w-3 h-3" />;
            case 'documents':
                return <FileText className="w-3 h-3" />;
            default:
                return null;
        }
    };

    const getSourceServiceColor = (service: string) => {
        switch (service) {
            case 'office':
                return 'bg-blue-100 text-blue-800 border-blue-200';
            case 'email':
                return 'bg-green-100 text-green-800 border-green-200';
            case 'calendar':
                return 'bg-purple-100 text-purple-800 border-purple-200';
            case 'documents':
                return 'bg-orange-100 text-orange-800 border-orange-200';
            default:
                return 'bg-gray-100 text-gray-800 border-gray-200';
        }
    };

    const getPrimaryName = () => {
        if (contact.display_name) return contact.display_name;
        if (contact.given_name && contact.family_name) {
            return `${contact.given_name} ${contact.family_name}`;
        }
        if (contact.given_name) return contact.given_name;
        if (contact.family_name) return contact.family_name;
        return contact.email_address;
    };

    const getInitials = () => {
        const name = getPrimaryName();
        if (name === contact.email_address) {
            return contact.email_address.slice(0, 2).toUpperCase();
        }
        return name.slice(0, 2).toUpperCase();
    };

    const hasOfficeIntegration = contact.source_services?.includes('office') || false;
    const hasDiscoveredData = contact.source_services?.some(s => ['email', 'calendar', 'documents'].includes(s)) || false;

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
            className="bg-white border rounded-lg p-3 hover:shadow-md transition-all cursor-pointer hover:border-gray-300"
            onClick={handleClick}
        >
            <div className="flex items-center gap-3">
                {/* Avatar */}
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
                    {getInitials()}
                </div>

                {/* Main Content */}
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                        <h3 className="font-medium text-gray-900 truncate">
                            {getPrimaryName()}
                        </h3>
                        
                        {/* Source Services Badges */}
                        <div className="flex gap-1">
                            {contact.source_services?.map(service => (
                                <span
                                    key={service}
                                    className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full border ${getSourceServiceColor(service)}`}
                                >
                                    {getSourceServiceIcon(service)}
                                    {service}
                                </span>
                            ))}
                        </div>
                    </div>
                    
                    <p className="text-sm text-gray-600 truncate">
                        {contact.email_address}
                    </p>

                    {/* Event Counts and Tags */}
                    <div className="flex items-center gap-3 mt-1">
                        {/* Event Counts */}
                        {contact.event_counts && Object.keys(contact.event_counts).length > 0 && (
                            <div className="flex gap-1">
                                {Object.entries(contact.event_counts).map(([eventType, count]) => (
                                    <span
                                        key={eventType}
                                        className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs bg-gray-50 text-gray-600 rounded"
                                    >
                                        {getSourceServiceIcon(eventType)}
                                        {count.count}
                                    </span>
                                ))}
                            </div>
                        )}

                        {/* Tags */}
                        {contact.tags && contact.tags.length > 0 && (
                            <div className="flex gap-1">
                                {contact.tags.slice(0, 2).map(tag => (
                                    <span
                                        key={tag}
                                        className="px-1.5 py-0.5 text-xs bg-gray-100 text-gray-600 rounded-full"
                                    >
                                        {tag}
                                    </span>
                                ))}
                                {contact.tags.length > 2 && (
                                    <span className="px-1.5 py-0.5 text-xs bg-gray-100 text-gray-600 rounded-full">
                                        +{contact.tags.length - 2}
                                    </span>
                                )}
                            </div>
                        )}

                        {/* Relevance Score */}
                        {contact.relevance_score && (
                            <span className="text-xs text-gray-500">
                                Score: {Math.round(contact.relevance_score * 100)}%
                            </span>
                        )}
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-1 flex-shrink-0">
                    {onViewDetails && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => handleActionClick(e, () => onViewDetails(contact))}
                            className="h-8 px-2 text-xs"
                        >
                            View
                        </Button>
                    )}

                    {onEdit && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => handleActionClick(e, () => onEdit(contact))}
                            className="h-8 px-2 text-xs"
                        >
                            <Edit className="w-3 h-3" />
                        </Button>
                    )}

                    {onMerge && hasDiscoveredData && hasOfficeIntegration && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => handleActionClick(e, () => onMerge(contact))}
                            className="h-8 px-2 text-xs"
                        >
                            <Merge className="w-3 h-3" />
                        </Button>
                    )}

                    {onDelete && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => handleActionClick(e, () => onDelete(contact))}
                            className="h-8 px-2 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                            <Trash2 className="w-3 h-3" />
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ContactListItem;
