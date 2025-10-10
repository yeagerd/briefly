import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Calendar, FileText, Mail, Play, Settings, Square, X } from 'lucide-react';
import React, { useState } from 'react';

interface DiscoverySettingsProps {
    onClose: () => void;
}

interface DiscoveryConfig {
    email: boolean;
    calendar: boolean;
    documents: boolean;
}

interface DiscoveryStats {
    lastRun: string;
    nextRun: string;
    totalContacts: number;
    newContacts: number;
    updatedContacts: number;
    errors: number;
    processingTime: number;
}

const ContactDiscoverySettings: React.FC<DiscoverySettingsProps> = ({ onClose }) => {
    const [config, setConfig] = useState<DiscoveryConfig>({
        email: true,
        calendar: true,
        documents: true,
    });

    const [stats] = useState<DiscoveryStats>({
        lastRun: '2024-01-15T10:30:00Z',
        nextRun: '2024-01-15T11:30:00Z',
        totalContacts: 1247,
        newContacts: 23,
        updatedContacts: 45,
        errors: 2,
        processingTime: 45,
    });

    const [isRunning, setIsRunning] = useState(false);

    const handleConfigChange = (field: keyof DiscoveryConfig, value: string | number | boolean) => {
        setConfig(prev => ({ ...prev, [field]: value }));
    };

    const handleStartDiscovery = () => {
        setIsRunning(true);

        // Simulate discovery process
        setTimeout(() => {
            setIsRunning(false);
        }, 3000);
    };

    const handleStopDiscovery = () => {
        setIsRunning(false);
    };


    const eventTypes = [
        { key: 'email', label: 'Email Events', icon: Mail, description: 'Discover contacts from email communications' },
        { key: 'calendar', label: 'Calendar Events', icon: Calendar, description: 'Discover contacts from calendar events' },
        { key: 'documents', label: 'Document Events', icon: FileText, description: 'Discover contacts from document interactions' },
    ];

    return (
        <div className="bg-white rounded-lg shadow-lg p-6 max-w-6xl mx-auto">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Contact Discovery Settings</h2>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={onClose}
                >
                    <X className="w-4 h-4" />
                </Button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Discovery Configuration */}
                <div className="space-y-6">
                    <div className="bg-gray-50 rounded-lg p-4">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Discovery Configuration</h3>

                        {/* Event Type Toggles */}
                        <div className="space-y-4">
                            {eventTypes.map(({ key, label, icon: Icon, description }) => (
                                <div key={key} className="flex items-start gap-3">
                                    <Switch
                                        checked={config[key as keyof DiscoveryConfig] as boolean}
                                        onCheckedChange={(checked) => handleConfigChange(key as keyof DiscoveryConfig, checked)}
                                    />
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <Icon className="w-4 h-4 text-gray-600" />
                                            <Label className="font-medium">{label}</Label>
                                        </div>
                                        <p className="text-sm text-gray-600">{description}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                </div>

                {/* Discovery Status & Controls */}
                <div className="space-y-6">
                    {/* Status Overview */}
                    <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                        <h3 className="text-lg font-semibold text-blue-900 mb-4">Discovery Status</h3>

                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <span className="text-blue-600">Last Run:</span>
                                <p className="font-medium text-blue-900">
                                    {new Date(stats.lastRun).toLocaleString()}
                                </p>
                            </div>
                            <div>
                                <span className="text-blue-600">Next Run:</span>
                                <p className="font-medium text-blue-900">
                                    {new Date(stats.nextRun).toLocaleString()}
                                </p>
                            </div>
                            <div>
                                <span className="text-blue-600">Status:</span>
                                <Badge variant={isRunning ? "default" : "secondary"} className="ml-2">
                                    {isRunning ? 'Running' : 'Idle'}
                                </Badge>
                            </div>
                            <div>
                                <span className="text-blue-600">Processing Time:</span>
                                <p className="font-medium text-blue-900">{stats.processingTime}s</p>
                            </div>
                        </div>
                    </div>

                    {/* Discovery Controls */}
                    <div className="bg-gray-50 rounded-lg p-4">
                        <h4 className="font-medium text-gray-900 mb-3">Discovery Controls</h4>

                        <div className="flex gap-3">
                            <Button
                                onClick={handleStartDiscovery}
                                disabled={isRunning}
                                className="flex-1"
                            >
                                <Play className="w-4 h-4 mr-2" />
                                {isRunning ? 'Running...' : 'Start Discovery'}
                            </Button>

                            <Button
                                onClick={handleStopDiscovery}
                                disabled={!isRunning}
                                variant="outline"
                                className="flex-1"
                            >
                                <Square className="w-4 h-4 mr-2" />
                                Stop
                            </Button>
                        </div>
                    </div>

                    {/* Statistics */}
                    <div className="bg-gray-50 rounded-lg p-4">
                        <h4 className="font-medium text-gray-900 mb-3">Discovery Statistics</h4>

                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div className="text-center p-3 bg-white rounded border">
                                <div className="text-2xl font-bold text-blue-600">{stats.totalContacts}</div>
                                <div className="text-gray-600">Total Contacts</div>
                            </div>
                            <div className="text-center p-3 bg-white rounded border">
                                <div className="text-2xl font-bold text-green-600">{stats.newContacts}</div>
                                <div className="text-gray-600">New This Run</div>
                            </div>
                            <div className="text-center p-3 bg-white rounded border">
                                <div className="text-2xl font-bold text-purple-600">{stats.updatedContacts}</div>
                                <div className="text-gray-600">Updated</div>
                            </div>
                            <div className="text-center p-3 bg-white rounded border">
                                <div className="text-2xl font-bold text-red-600">{stats.errors}</div>
                                <div className="text-gray-600">Errors</div>
                            </div>
                        </div>
                    </div>

                </div>
            </div>

            {/* Footer Actions */}
            <div className="flex justify-end gap-3 pt-6 border-t border-gray-200 mt-6">
                <Button
                    onClick={onClose}
                    variant="outline"
                >
                    Close
                </Button>

                <Button
                    onClick={() => {
                        // Save configuration
                        // Saving discovery configuration
                        onClose();
                    }}
                >
                    <Settings className="w-4 h-4 mr-2" />
                    Save Configuration
                </Button>
            </div>
        </div>
    );
};

export default ContactDiscoverySettings;
