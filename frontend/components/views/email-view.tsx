import { officeApi } from '@/api';
import EmailFilters from '@/components/email/email-filters';
import { EmailFolderSelector } from '@/components/email/email-folder-selector';
import EmailListCard from '@/components/email/email-list-card';
import EmailThread from '@/components/email/email-thread';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/components/ui/use-toast';
import { useIntegrations } from '@/contexts/integrations-context';
import { useOfficeData } from '@/contexts/office-data-context';
import { useDraftState } from '@/hooks/use-draft-state';
import { useEmailList, useEmailThread } from '@/hooks/use-email-data';
import { listProviderDraftsForThread } from '@/lib/draft-utils';
import { safeParseDate } from '@/lib/utils';
import { EmailFolder, EmailMessage, Provider } from "@/types/api/office";
import { Archive, Check, ChevronLeft, Clock, List, ListTodo, PanelLeft, Proportions, RefreshCw, Square, Star, Trash2, X } from 'lucide-react';
import { getSession } from 'next-auth/react';
import React, { useCallback, useEffect, useState } from 'react';

interface EmailViewProps {
    toolDataLoading?: boolean;
    activeTool?: string;
}

type ViewMode = 'tight' | 'expanded';
type ReadingPaneMode = 'none' | 'right';

// Local enum for bulk actions since it's not defined in the backend
enum BulkActionType {
    ARCHIVE = 'archive',
    DELETE = 'delete',
    SNOOZE = 'snooze',
    MARK_READ = 'mark_read',
    MARK_UNREAD = 'mark_unread',
}

const EmailView: React.FC<EmailViewProps> = ({ toolDataLoading = false, activeTool }) => {
    // Helper function to get proper present participle form of action verbs
    const getPresentParticiple = (actionType: BulkActionType): string => {
        // Handle specific verb conjugations
        switch (actionType) {
            case BulkActionType.ARCHIVE:
                return 'Archiving';
            case BulkActionType.DELETE:
                return 'Deleting';
            case BulkActionType.SNOOZE:
                return 'Snoozing';
            case BulkActionType.MARK_READ:
                return 'Marking as Read';
            case BulkActionType.MARK_UNREAD:
                return 'Marking as Unread';
        }
    };

    // Helper function to get proper past tense form of action verbs
    const getPastTense = (actionType: BulkActionType): string => {
        switch (actionType) {
            case BulkActionType.ARCHIVE:
                return 'archived';
            case BulkActionType.DELETE:
                return 'deleted';
            case BulkActionType.SNOOZE:
                return 'snoozed';
            case BulkActionType.MARK_READ:
                return 'marked as read';
            case BulkActionType.MARK_UNREAD:
                return 'marked as unread';
        }
    };

    // Helper function to get proper infinitive form of action verbs
    const getInfinitive = (actionType: BulkActionType): string => {
        switch (actionType) {
            case BulkActionType.ARCHIVE:
                return 'archive';
            case BulkActionType.DELETE:
                return 'delete';
            case BulkActionType.SNOOZE:
                return 'snooze';
            case BulkActionType.MARK_READ:
                return 'mark as read';
            case BulkActionType.MARK_UNREAD:
                return 'mark as unread';
        }
    };

    // Helper function to get proper gerund form of action verbs (for "while X-ing")
    const getGerund = (actionType: BulkActionType): string => {
        switch (actionType) {
            case BulkActionType.ARCHIVE:
                return 'archiving';
            case BulkActionType.DELETE:
                return 'deleting';
            case BulkActionType.SNOOZE:
                return 'snoozing';
            case BulkActionType.MARK_READ:
                return 'marking as read';
            case BulkActionType.MARK_UNREAD:
                return 'marking as unread';
        }
    };

    const [filters, setFilters] = useState<Record<string, unknown>>({});
    const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<ViewMode>('tight');
    const [readingPaneMode, setReadingPaneMode] = useState<ReadingPaneMode>('right');
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [isInThreadView, setIsInThreadView] = useState(false);
    const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set());
    const [selectedClassification, setSelectedClassification] = useState<string>('all');

    const handleClassificationSelect = useCallback((classification: string) => {
        setSelectedClassification(classification);
    }, []);
    const { loading: integrationsLoading, activeProviders, hasExpiredButRefreshableTokens } = useIntegrations();
    const { toast } = useToast();
    const { setCurrentDraft, updateDraft, createNewDraft } = useDraftState();

    // Bulk action states
    const [bulkActionProgress, setBulkActionProgress] = useState<number>(0);
    const [isBulkActionRunning, setIsBulkActionRunning] = useState(false);
    const [bulkActionType, setBulkActionType] = useState<BulkActionType | null>(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);

    // Determine default provider from active integrations, fallback to 'google' if none available
    const defaultProvider = activeProviders && activeProviders.length > 0 ? activeProviders[0] as Provider : Provider.GOOGLE;

    const [selectedFolder, setSelectedFolder] = useState<EmailFolder>({
        label: 'inbox',
        name: 'Inbox',
        provider: defaultProvider,
        account_email: '',
        is_system: true
    });

    // Determine folder/label parameters for the provider
    const getFolderParams = useCallback(() => {
        const isSystemFolder = selectedFolder.is_system;
        let labels: string[] | undefined;
        let folderId: string | undefined;


        if (selectedFolder.provider === Provider.MICROSOFT) {
            // Microsoft: use folder_id when available, otherwise fall back to label
            if (selectedFolder.provider_folder_id) {
                folderId = selectedFolder.provider_folder_id;
                labels = undefined;
            } else {
                // Fallback to label if folder_id is not available (e.g., on initial mount)
                labels = [selectedFolder.label];
                folderId = undefined;
            }
        } else if (selectedFolder.provider === Provider.GOOGLE) {
            // Google: use folder_id for system folders, labels for user folders
            if (isSystemFolder && selectedFolder.provider_folder_id) {
                folderId = selectedFolder.provider_folder_id || undefined;
                labels = undefined;
            } else {
                labels = [selectedFolder.label];
                folderId = undefined;
            }
        }

        return { labels, folderId };
    }, [selectedFolder]);

    // Use provider hooks for email data
    const { labels, folderId } = React.useMemo(() => getFolderParams(), [getFolderParams]);

    const autoFetchCondition = activeTool === 'email' && !toolDataLoading && !integrationsLoading;

    const {
        emails: allThreads,
        loading,
        error,
        lastUpdated
    } = useEmailList({
        folderId,
        folderLabel: selectedFolder.label,
        labels,
        pageSize: 50,
        providers: activeProviders || ['google', 'microsoft'],
        classification: undefined, // Don't pass classification - we filter on frontend
        autoFetch: autoFetchCondition
    });

    // Filter threads based on classification (frontend filtering)
    // Now applies to all folders, not just inbox
    const threads = React.useMemo(() => {
        if (selectedClassification === 'all') {
            return allThreads;
        }

        // Filter by inference_classification
        return allThreads.filter(email => {
            if (selectedClassification === 'focused') {
                // Show only focused/priority emails
                return email.inference_classification === 'focused';
            } else if (selectedClassification === 'other') {
                // Show only non-focused emails
                return email.inference_classification !== 'focused';
            }
            return true; // 'all' - show everything
        });
    }, [allThreads, selectedClassification]);

    const { runDelta } = useOfficeData();

    const {
        thread: fullThread,
        loading: loadingThread,
        error: threadError
    } = useEmailThread(selectedThreadId, {
        includeBody: true,
        autoFetch: !!selectedThreadId
    });

    const handleRefresh = useCallback(async () => {
        // Background refresh - no loading state, just trigger the delta sync
        try {
            const session = await getSession();
            if (!session?.user?.id) {
                console.error('No user session found for refresh');
                return;
            }

            const scope = {
                userId: session.user.id,
                folderId,
                folderLabel: selectedFolder.label,
                labels,
                pageSize: 50,
                query: undefined
            };
            await runDelta(scope, activeProviders || ['google', 'microsoft']);
            // Clear email selections after refresh
            setSelectedEmails(new Set());
        } catch (error) {
            console.error('Background refresh failed:', error);
        }
    }, [runDelta, folderId, selectedFolder.label, labels, activeProviders]);

    const handleFolderSelect = useCallback((folder: EmailFolder) => {
        setSelectedFolder(folder);
        // Clear email selections when folder changes
        setSelectedEmails(new Set());
        // Reset classification to 'all' when switching folders
        setSelectedClassification('all');
    }, []);

    // Group emails by thread
    const groupedThreads = React.useMemo(() => {
        const threadMap = new Map<string, EmailMessage[]>();

        threads.forEach(email => {
            const threadId = email.thread_id || email.id;
            if (!threadMap.has(threadId)) {
                threadMap.set(threadId, []);
            }
            threadMap.get(threadId)!.push(email);
        });

        return Array.from(threadMap.entries()).map(([threadId, emails]) => ({
            id: threadId,
            // Use safeParseDate to handle invalid dates gracefully
            emails: emails.sort((a, b) => {
                const dateA = safeParseDate(a.date);
                const dateB = safeParseDate(b.date);

                // If both dates are invalid, maintain original order
                if (!dateA && !dateB) return 0;
                // If only dateA is invalid, put it at the end
                if (!dateA) return 1;
                // If only dateB is invalid, put it at the end
                if (!dateB) return -1;

                // Both dates are valid, compare them
                return dateB.getTime() - dateA.getTime();
            })
        }));
    }, [threads]);

    // Handle email selection (independent from thread viewing)
    const handleEmailSelect = useCallback((emailId: string, isSelected: boolean) => {
        setSelectedEmails(prev => {
            const newSet = new Set(prev);
            if (isSelected) {
                newSet.add(emailId);
            } else {
                newSet.delete(emailId);
            }
            return newSet;
        });
    }, []);

    // Handle select all emails in current view
    const handleSelectAll = useCallback(() => {
        const allEmailIds = new Set<string>();
        groupedThreads.forEach(thread => {
            if (viewMode === 'tight') {
                // In tight view mode, only select the latest email in each thread
                // since that's the only one with a visible checkbox
                const latestEmail = thread.emails[0]; // Assuming emails are sorted by date, latest first
                if (latestEmail) {
                    allEmailIds.add(latestEmail.id);
                }
            } else {
                // In expanded view mode, select all emails in each thread
                thread.emails.forEach(email => {
                    allEmailIds.add(email.id);
                });
            }
        });
        setSelectedEmails(allEmailIds);
    }, [groupedThreads, viewMode]);

    // Handle deselect all emails
    const handleSelectNone = useCallback(() => {
        setSelectedEmails(new Set());
    }, []);

    // Execute bulk action with progress tracking
    const executeBulkAction = useCallback(async (actionType: BulkActionType) => {
        if (selectedEmails.size === 0) return;

        setIsBulkActionRunning(true);
        setBulkActionProgress(0);
        setBulkActionType(actionType);

        const emailIds = Array.from(selectedEmails);
        const totalEmails = emailIds.length;
        let successCount = 0;
        let errorCount = 0;

        try {
            // Execute bulk action via API
            const response = await officeApi.bulkAction(actionType, emailIds, activeProviders);

            if (response.success) {
                // Handle successful response with or without detailed data
                if (response.data) {
                    successCount = response.data.success_count;
                    errorCount = response.data.error_count;
                } else {
                    // If no detailed data but success=true, assume all emails were processed successfully
                    successCount = totalEmails;
                    errorCount = 0;
                }

                // Update progress to 100% since the API handles all emails at once
                setBulkActionProgress(100);
            } else {
                // If the API call failed, treat all as errors
                errorCount = totalEmails;
                successCount = 0;
                setBulkActionProgress(100);
            }

            // Show success/error toast
            if (errorCount === 0) {
                toast({
                    title: `${getPresentParticiple(actionType)} Successful`,
                    description: `Successfully ${getPastTense(actionType)} ${successCount} email${successCount !== 1 ? 's' : ''}.`,
                    variant: "default",
                });
            } else if (successCount === 0) {
                toast({
                    title: `${getPresentParticiple(actionType)} Failed`,
                    description: `Failed to ${getInfinitive(actionType)} ${errorCount} email${errorCount !== 1 ? 's' : ''}.`,
                    variant: "destructive",
                });
            } else {
                toast({
                    title: `${getPresentParticiple(actionType)} Partially Complete`,
                    description: `Successfully ${getPastTense(actionType)} ${successCount} email${successCount !== 1 ? 's' : ''}, but failed to ${getInfinitive(actionType)} ${errorCount} email${errorCount !== 1 ? 's' : ''}.`,
                    variant: "default",
                });
            }

            // Clear selection after action
            setSelectedEmails(new Set());

        } catch {
            toast({
                title: `${getPresentParticiple(actionType)} Failed`,
                description: `An error occurred while ${getGerund(actionType)} emails. Please try again.`,
                variant: "destructive",
            });
        } finally {
            setIsBulkActionRunning(false);
            setBulkActionProgress(0);
            setBulkActionType(null);
        }
    }, [selectedEmails, toast, activeProviders]);

    // Handle bulk actions
    const handleBulkArchive = useCallback(() => {
        setShowArchiveConfirm(true);
    }, []);

    const handleBulkDelete = useCallback(() => {
        setShowDeleteConfirm(true);
    }, []);

    const handleBulkSnooze = useCallback(() => {
        setBulkActionType(BulkActionType.SNOOZE);
        executeBulkAction(BulkActionType.SNOOZE);
    }, [executeBulkAction]);

    // Confirmed bulk actions
    const handleConfirmedArchive = useCallback(() => {
        setShowArchiveConfirm(false);
        executeBulkAction(BulkActionType.ARCHIVE);
    }, [executeBulkAction]);

    const handleConfirmedDelete = useCallback(() => {
        setShowDeleteConfirm(false);
        executeBulkAction(BulkActionType.DELETE);
    }, [executeBulkAction]);

    // selectedThread was used for fallback logic that has been removed
    // Keeping this for potential future use or debugging

    // Function to load provider drafts for a thread
    const loadProviderDrafts = useCallback(async (threadId: string) => {
        try {
            const draftsResp = await listProviderDraftsForThread(threadId);
            // The API returns a single EmailDraftResult, not a list
            if (draftsResp?.data?.draft_id) {
                const provider = draftsResp.data.provider as 'google' | 'microsoft' | undefined;
                const session = await getSession();
                const local = createNewDraft('email', session?.user?.id || '');
                // Since we only get metadata, create a basic draft
                updateDraft({
                    id: local.id,
                    content: '',
                    metadata: {
                        subject: '',
                        recipients: [],
                        cc: [],
                        bcc: [],
                        provider,
                        providerDraftId: draftsResp.data.draft_id,
                    },
                    threadId,
                });
                setCurrentDraft({ ...local, content: '', metadata: { ...local.metadata, provider, providerDraftId: draftsResp.data.draft_id } });
            }
        } catch (e) {
            console.warn('No provider drafts for thread or failed to load:', e);
        }
    }, [createNewDraft, setCurrentDraft, updateDraft]);

    const handleThreadSelect = useCallback(async (threadId: string) => {
        setSelectedThreadId(threadId);

        // Load provider drafts for this thread
        await loadProviderDrafts(threadId);

        // Handle click behavior based on pane mode
        if (readingPaneMode === 'none') {
            // One-pane mode: navigate to thread view
            setIsInThreadView(true);
        }
        // Two-pane mode: thread will be shown in right pane automatically
    }, [readingPaneMode, loadProviderDrafts]);

    const handleBackToList = useCallback(() => {
        setIsInThreadView(false);
        setSelectedThreadId(null);
    }, []);

    // Update selectedFolder provider when activeProviders change
    useEffect(() => {
        if (activeProviders && activeProviders.length > 0) {
            const newProvider = activeProviders[0] as Provider;
            if (selectedFolder.provider !== newProvider) {
                setSelectedFolder(prev => ({
                    ...prev,
                    provider: newProvider
                }));
            }
        }
    }, [activeProviders]); // eslint-disable-line react-hooks/exhaustive-deps -- selectedFolder.provider intentionally omitted to prevent infinite loop


    // Reset thread view when reading pane mode changes
    useEffect(() => {
        if (readingPaneMode === 'right') {
            // When switching to two-pane mode, exit thread view
            setIsInThreadView(false);
        }
    }, [readingPaneMode]);



    // Clear email selections when folder changes
    useEffect(() => {
        setSelectedEmails(new Set());
    }, [selectedFolder]);

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="p-4 border-b bg-white">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1">
                        <EmailFolderSelector
                            onFolderSelect={handleFolderSelect}
                            selectedFolder={selectedFolder}
                            selectedClassification={selectedClassification}
                            onClassificationSelect={handleClassificationSelect}
                        />
                        <h1 className="text-xl font-semibold">
                            {selectedFolder.name}
                        </h1>
                        <div className="flex items-center border rounded-md">
                            <button
                                onClick={() => handleClassificationSelect('all')}
                                className={`px-3 py-1.5 text-sm font-medium transition-colors ${selectedClassification === 'all'
                                    ? 'bg-blue-100 text-blue-600'
                                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                                    }`}
                                title="Show all emails"
                            >
                                All
                            </button>
                            <button
                                onClick={() => handleClassificationSelect('focused')}
                                className={`px-3 py-1.5 text-sm font-medium transition-colors flex items-center gap-1.5 ${selectedClassification === 'focused'
                                    ? 'bg-blue-100 text-blue-600'
                                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                                    }`}
                                title="Show focused emails only"
                            >
                                <Star className={`h-3.5 w-3.5 ${selectedClassification === 'focused' ? 'fill-current' : ''}`} />
                                Focused
                            </button>
                        </div>
                        <div className="ml-4 flex-1 max-w-md">
                            <EmailFilters filters={filters} setFilters={setFilters} />
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleRefresh}
                            disabled={loading}
                            className="p-2 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                            onMouseEnter={(e) => {
                                if (lastUpdated) {
                                    const secondsAgo = Math.floor((Date.now() - lastUpdated) / 1000);
                                    e.currentTarget.title = `Updated ${secondsAgo}s ago`;
                                } else {
                                    e.currentTarget.title = "Refresh emails";
                                }
                            }}
                            title="Refresh emails"
                        >
                            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        </button>

                        {/* Settings dropdown */}
                        <DropdownMenu open={settingsOpen} onOpenChange={setSettingsOpen}>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="p-2 text-muted-foreground hover:text-foreground transition-colors"
                                    title="Settings"
                                >
                                    <Proportions className="w-4 h-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-64">
                                {/* Email Card View Mode */}
                                <DropdownMenuItem className="flex items-center justify-between p-3">
                                    <span className="text-sm font-medium">Email Card View</span>
                                    <div className="flex items-center border rounded-md">
                                        <button
                                            onClick={() => { setViewMode('tight'); setSettingsOpen(false); }}
                                            className={`p-1.5 ${viewMode === 'tight' ? 'bg-blue-100 text-blue-600' : 'text-gray-600'}`}
                                            title="Compact view"
                                        >
                                            <List className="w-3 h-3" />
                                        </button>
                                        <button
                                            onClick={() => { setViewMode('expanded'); setSettingsOpen(false); }}
                                            className={`p-1.5 ${viewMode === 'expanded' ? 'bg-blue-100 text-blue-600' : 'text-gray-600'}`}
                                            title="Expanded view"
                                        >
                                            <ListTodo className="w-3 h-3" />
                                        </button>
                                    </div>
                                </DropdownMenuItem>

                                <DropdownMenuSeparator />

                                {/* Reading Pane Mode */}
                                <DropdownMenuItem className="flex items-center justify-between p-3">
                                    <span className="text-sm font-medium">Reading Pane</span>
                                    <div className="flex items-center border rounded-md">
                                        <button
                                            onClick={() => {
                                                setReadingPaneMode('none');
                                                setSettingsOpen(false);
                                                setSelectedThreadId(null); // Clear selection when switching to one-pane
                                            }}
                                            className={`p-1.5 ${readingPaneMode === 'none' ? 'bg-blue-100 text-blue-600' : 'text-gray-600'}`}
                                            title="No reading pane"
                                        >
                                            <Square className="w-3 h-3" />
                                        </button>
                                        <button
                                            onClick={() => {
                                                setReadingPaneMode('right');
                                                setSettingsOpen(false);
                                            }}
                                            className={`p-1.5 ${readingPaneMode === 'right' ? 'bg-blue-100 text-blue-600' : 'text-gray-600'}`}
                                            title="Reading pane on right"
                                        >
                                            <PanelLeft className="w-3 h-3" />
                                        </button>
                                    </div>
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>
            </div>

            {/* Main content */}
            <div className="flex-1 flex overflow-hidden">
                {/* Email list or Thread view */}
                {isInThreadView && readingPaneMode === 'none' ? (
                    // One-pane thread view - show EmailCard for full email content
                    <div className="flex-1 overflow-y-auto">
                        {selectedThreadId && (
                            <div className="p-4">
                                <div className="flex items-center gap-3 mb-4">
                                    <button
                                        onClick={handleBackToList}
                                        className="p-2 text-muted-foreground hover:text-foreground transition-colors"
                                        title="Back to email list"
                                    >
                                        <ChevronLeft className="w-4 h-4" />
                                    </button>
                                    <h2 className="text-lg font-semibold">Thread</h2>
                                </div>
                                {loadingThread ? (
                                    <div className="p-8 text-center text-muted-foreground">Loading thread...</div>
                                ) : threadError ? (
                                    <div className="p-8 text-center text-red-500">
                                        {threadError}
                                    </div>
                                ) : fullThread ? (
                                    <EmailThread
                                        thread={fullThread}
                                    />
                                ) : (
                                    <div className="p-8 text-center text-muted-foreground">
                                        No thread data available
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                ) : (
                    // Email list (for both two-pane and one-pane modes)
                    <div className={`flex-1 flex flex-col overflow-y-auto ${readingPaneMode === 'right' ? 'border-r' : ''}`} style={{ minWidth: 0 }}>
                        {/* Selection Header */}
                        {selectedEmails.size > 0 && (
                            <div className="bg-blue-50 border-b border-blue-200 px-4 py-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <span className="text-sm font-medium text-blue-900">
                                            {selectedEmails.size} email{selectedEmails.size !== 1 ? 's' : ''} selected
                                        </span>
                                        <div className="flex items-center gap-2">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={handleSelectNone}
                                                className="text-blue-700 hover:text-blue-900 hover:bg-blue-100"
                                            >
                                                <X className="w-4 h-4 mr-1" />
                                                None
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={handleSelectAll}
                                                className="text-blue-700 hover:text-blue-900 hover:bg-blue-100"
                                            >
                                                <Check className="w-4 h-4 mr-1" />
                                                All
                                            </Button>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={handleBulkSnooze}
                                            className="text-blue-700 hover:text-blue-900 hover:bg-blue-100"
                                            title="Snooze"
                                        >
                                            <Clock className="w-4 h-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={handleBulkArchive}
                                            className="text-blue-700 hover:text-blue-900 hover:bg-blue-100"
                                            title="Archive"
                                        >
                                            <Archive className="w-4 h-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={handleBulkDelete}
                                            className="text-red-700 hover:text-red-900 hover:bg-red-100"
                                            title="Delete"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Email List Content */}
                        <div className="flex-1 overflow-y-auto">
                            {hasExpiredButRefreshableTokens ? (
                                <div className="p-8 text-center">
                                    <div className="text-amber-600">
                                        <p className="mb-4">Your email integration token has expired and is being refreshed. Please wait or try reconnecting.</p>
                                        <a
                                            href="/settings?page=integrations"
                                            className="inline-flex items-center gap-1 text-amber-700 hover:text-amber-900 font-medium"
                                        >
                                            <span>Go to Integrations</span>
                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                            </svg>
                                        </a>
                                    </div>
                                </div>
                            ) : error ? (
                                <div className="p-8 text-center">
                                    {error.includes('No active email integrations') ? (
                                        <div className="text-amber-600">
                                            <p className="mb-4">No active email integration found. Connect your Gmail or Microsoft Outlook to view your emails.</p>
                                            <a
                                                href="/settings?page=integrations"
                                                className="inline-flex items-center gap-1 text-amber-700 hover:text-amber-900 font-medium"
                                            >
                                                <span>Go to Integrations</span>
                                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                                </svg>
                                            </a>
                                        </div>
                                    ) : error.includes('expired and is being refreshed') ? (
                                        <div className="text-amber-600">
                                            <p className="mb-4">Your email integration token has expired and is being refreshed. Please wait or try reconnecting.</p>
                                            <a
                                                href="/settings?page=integrations"
                                                className="inline-flex items-center gap-1 text-amber-700 hover:text-amber-900 font-medium"
                                            >
                                                <span>Go to Integrations</span>
                                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                                </svg>
                                            </a>
                                        </div>
                                    ) : (
                                        <div className="text-red-500">{error}</div>
                                    )}
                                </div>
                            ) : groupedThreads.length === 0 ? (
                                <div className="p-8 text-center text-muted-foreground">No emails found.</div>
                            ) : (
                                <div className={viewMode === 'tight' ? '' : 'p-4'}>
                                    {groupedThreads.map((thread) => (
                                        <EmailListCard
                                            key={thread.id}
                                            thread={thread}
                                            mode={viewMode}
                                            isSelected={selectedThreadId === thread.id}
                                            onSelect={handleThreadSelect}
                                            showReadingPane={false}
                                            selectedEmails={selectedEmails}
                                            onEmailSelect={handleEmailSelect}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Reading pane */}
                {readingPaneMode === 'right' && selectedThreadId && (
                    <div className="flex-1 border-l bg-gray-50 overflow-y-auto" style={{ minWidth: 0 }}>
                        <div className="p-4">
                            {loadingThread ? (
                                <div className="p-8 text-center text-muted-foreground">Loading thread...</div>
                            ) : threadError ? (
                                <div className="p-8 text-center text-red-500">
                                    {threadError}
                                </div>
                            ) : fullThread ? (
                                <EmailThread
                                    thread={fullThread}
                                    onCloseReadingPane={() => setSelectedThreadId(null)}
                                />
                            ) : (
                                <div className="p-8 text-center text-muted-foreground">
                                    No thread data available
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Bulk Action Confirmation Dialogs */}
            <AlertDialog open={showArchiveConfirm} onOpenChange={setShowArchiveConfirm}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Confirm Archive</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to archive {selectedEmails.size} email{selectedEmails.size !== 1 ? 's' : ''}? This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setShowArchiveConfirm(false)}>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleConfirmedArchive}>Archive</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Confirm Delete</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete {selectedEmails.size} email{selectedEmails.size !== 1 ? 's' : ''}? This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setShowDeleteConfirm(false)}>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleConfirmedDelete}>Delete</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {isBulkActionRunning && (
                <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-blue-500 text-white p-3 rounded-lg shadow-lg z-50">
                    <Progress value={bulkActionProgress} className="h-2" />
                    <p className="text-sm text-white">
                        {bulkActionType ? getPresentParticiple(bulkActionType) : ''} {bulkActionProgress}%...
                    </p>
                </div>
            )}
        </div>
    );
};

export default EmailView; 