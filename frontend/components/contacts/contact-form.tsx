import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { ContactCreate } from '@/types/api/contacts';
import type { ContactPhone } from '@/types/api/contacts/models/ContactPhone';
import { Mail, Phone, Plus, Tag, User, X } from 'lucide-react';
import React, { useState } from 'react';

interface ContactFormProps {
    onSubmit: (contactData: ContactCreate) => void;
    onCancel: () => void;
    isLoading?: boolean;
    initialData?: Partial<ContactCreate>;
}

const ContactForm: React.FC<ContactFormProps> = ({
    onSubmit,
    onCancel,
    isLoading = false,
    initialData,
}) => {
    const [formData, setFormData] = useState<ContactCreate>({
        user_id: initialData?.user_id || '',
        email_address: initialData?.email_address || '',
        display_name: initialData?.display_name || '',
        given_name: initialData?.given_name || '',
        family_name: initialData?.family_name || '',
        phone_numbers: initialData?.phone_numbers || [],
        tags: initialData?.tags || [],
        notes: initialData?.notes || '',
    });

    const [newTag, setNewTag] = useState('');
    const [errors, setErrors] = useState<Record<string, string>>({});

    const validateForm = (): boolean => {
        const newErrors: Record<string, string> = {};

        if (!formData.email_address) {
            newErrors.email_address = 'Email address is required';
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email_address)) {
            newErrors.email_address = 'Please enter a valid email address';
        }

        if (!formData.display_name && !formData.given_name && !formData.family_name) {
            newErrors.display_name = 'At least one name field is required';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (validateForm()) {
            onSubmit(formData);
        }
    };

    const handleInputChange = (field: keyof ContactCreate, value: string | string[] | ContactPhone[]) => {
        setFormData(prev => ({ ...prev, [field]: value }));

        // Clear error when user starts typing
        if (errors[field]) {
            setErrors(prev => ({ ...prev, [field]: '' }));
        }
    };

    const addTag = () => {
        if (newTag.trim() && formData.tags && !formData.tags.includes(newTag.trim())) {
            handleInputChange('tags', [...formData.tags, newTag.trim()]);
            setNewTag('');
        }
    };

    const removeTag = (tagToRemove: string) => {
        if (formData.tags) {
            handleInputChange('tags', formData.tags.filter(tag => tag !== tagToRemove));
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            addTag();
        }
    };

    // Phone number management functions
    const addPhoneNumber = () => {
        const newPhone: ContactPhone = {
            type: 'mobile',
            number: '',
            primary: false
        };
        handleInputChange('phone_numbers', [...(formData.phone_numbers || []), newPhone]);
    };

    const updatePhoneNumber = (index: number, field: keyof ContactPhone, value: string | boolean) => {
        const updatedPhones = [...(formData.phone_numbers || [])];
        updatedPhones[index] = { ...updatedPhones[index], [field]: value };

        // If setting primary to true, unset all other primary flags
        if (field === 'primary' && value === true) {
            updatedPhones.forEach((phone, i) => {
                if (i !== index) {
                    phone.primary = false;
                }
            });
        }

        handleInputChange('phone_numbers', updatedPhones);
    };

    const removePhoneNumber = (index: number) => {
        const updatedPhones = (formData.phone_numbers || []).filter((_, i) => i !== index);
        handleInputChange('phone_numbers', updatedPhones);
    };

    return (
        <div className="bg-white rounded-lg shadow-lg p-6 max-w-2xl mx-auto">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Add New Contact</h2>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={onCancel}
                    disabled={isLoading}
                >
                    <X className="w-4 h-4" />
                </Button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Email Address - Required */}
                <div className="space-y-2">
                    <Label htmlFor="email_address" className="flex items-center gap-2">
                        <Mail className="w-4 h-4" />
                        Email Address *
                    </Label>
                    <Input
                        id="email_address"
                        type="email"
                        placeholder="contact@example.com"
                        value={formData.email_address || ''}
                        onChange={(e) => handleInputChange('email_address', e.target.value)}
                        className={errors.email_address ? 'border-red-500' : ''}
                        disabled={isLoading}
                    />
                    {errors.email_address && (
                        <p className="text-sm text-red-600">{errors.email_address}</p>
                    )}
                </div>

                {/* Name Fields */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="display_name" className="flex items-center gap-2">
                            <User className="w-4 h-4" />
                            Display Name
                        </Label>
                        <Input
                            id="display_name"
                            placeholder="Full Name"
                            value={formData.display_name || ''}
                            onChange={(e) => handleInputChange('display_name', e.target.value)}
                            className={errors.display_name ? 'border-red-500' : ''}
                            disabled={isLoading}
                        />
                        {errors.display_name && (
                            <p className="text-sm text-red-600">{errors.display_name}</p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="given_name">First Name</Label>
                        <Input
                            id="given_name"
                            placeholder="First Name"
                            value={formData.given_name || ''}
                            onChange={(e) => handleInputChange('given_name', e.target.value)}
                            disabled={isLoading}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="family_name">Last Name</Label>
                        <Input
                            id="family_name"
                            placeholder="Last Name"
                            value={formData.family_name || ''}
                            onChange={(e) => handleInputChange('family_name', e.target.value)}
                            disabled={isLoading}
                        />
                    </div>
                </div>

                {/* Phone Numbers */}
                <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                        <Phone className="w-4 h-4" />
                        Phone Numbers
                    </Label>

                    {/* Existing phone numbers */}
                    {formData.phone_numbers && formData.phone_numbers.length > 0 && (
                        <div className="space-y-3">
                            {formData.phone_numbers.map((phone, index) => (
                                <div key={index} className="flex gap-2 items-center p-3 border rounded-lg">
                                    <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-2">
                                        <div>
                                            <Label htmlFor={`phone-type-${index}`}>Type</Label>
                                            <select
                                                id={`phone-type-${index}`}
                                                value={phone.type || ''}
                                                onChange={(e) => updatePhoneNumber(index, 'type', e.target.value)}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                disabled={isLoading}
                                            >
                                                <option value="">Select type</option>
                                                <option value="mobile">Mobile</option>
                                                <option value="home">Home</option>
                                                <option value="work">Work</option>
                                                <option value="other">Other</option>
                                            </select>
                                        </div>

                                        <div>
                                            <Label htmlFor={`phone-number-${index}`}>Number</Label>
                                            <Input
                                                id={`phone-number-${index}`}
                                                placeholder="Phone number"
                                                value={phone.number}
                                                onChange={(e) => updatePhoneNumber(index, 'number', e.target.value)}
                                                disabled={isLoading}
                                            />
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <Label htmlFor={`phone-primary-${index}`} className="flex items-center gap-2">
                                                <input
                                                    type="checkbox"
                                                    id={`phone-primary-${index}`}
                                                    checked={phone.primary || false}
                                                    onChange={(e) => updatePhoneNumber(index, 'primary', e.target.checked)}
                                                    disabled={isLoading}
                                                    className="rounded"
                                                />
                                                Primary
                                            </Label>
                                        </div>
                                    </div>

                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => removePhoneNumber(index)}
                                        disabled={isLoading}
                                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                    >
                                        <X className="w-4 h-4" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Add phone number button */}
                    <Button
                        type="button"
                        onClick={addPhoneNumber}
                        disabled={isLoading}
                        variant="outline"
                        size="sm"
                        className="flex items-center gap-2"
                    >
                        <Plus className="w-4 h-4" />
                        Add Phone Number
                    </Button>
                </div>

                {/* Tags */}
                <div className="space-y-2">
                    <Label htmlFor="tags" className="flex items-center gap-2">
                        <Tag className="w-4 h-4" />
                        Tags
                    </Label>
                    <div className="flex gap-2">
                        <Input
                            id="tags"
                            placeholder="Add tags (press Enter)"
                            value={newTag}
                            onChange={(e) => setNewTag(e.target.value)}
                            onKeyPress={handleKeyPress}
                            disabled={isLoading}
                        />
                        <Button
                            type="button"
                            onClick={addTag}
                            disabled={!newTag.trim() || isLoading}
                            variant="outline"
                            size="sm"
                        >
                            <Plus className="w-4 h-4" />
                        </Button>
                    </div>

                    {/* Display existing tags */}
                    {formData.tags && formData.tags.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                            {formData.tags.map((tag) => (
                                <Badge
                                    key={tag}
                                    variant="secondary"
                                    className="flex items-center gap-1"
                                >
                                    {tag}
                                    <button
                                        type="button"
                                        onClick={() => removeTag(tag)}
                                        className="hover:text-red-500"
                                        disabled={isLoading}
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                </Badge>
                            ))}
                        </div>
                    )}
                </div>

                {/* Notes */}
                <div className="space-y-2">
                    <Label htmlFor="notes">Notes</Label>
                    <Textarea
                        id="notes"
                        placeholder="Additional notes about this contact..."
                        value={formData.notes || ''}
                        onChange={(e) => handleInputChange('notes', e.target.value)}
                        rows={3}
                        disabled={isLoading}
                    />
                </div>

                {/* Form Actions */}
                <div className="flex gap-3 pt-4 border-t border-gray-200">
                    <Button
                        type="submit"
                        disabled={isLoading}
                        className="flex-1"
                    >
                        {isLoading ? 'Creating...' : 'Create Contact'}
                    </Button>

                    <Button
                        type="button"
                        variant="outline"
                        onClick={onCancel}
                        disabled={isLoading}
                        className="flex-1"
                    >
                        Cancel
                    </Button>
                </div>
            </form>

            {/* Help Text */}
            <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Tips:</h4>
                <ul className="text-xs text-gray-600 space-y-1">
                    <li>• Email address is required and must be unique</li>
                    <li>• At least one name field should be filled</li>
                    <li>• Phone numbers can be added with type and primary designation</li>
                    <li>• Tags help organize and find contacts later</li>
                    <li>• Notes can include any additional information</li>
                </ul>
            </div>
        </div>
    );
};

export default ContactForm;
