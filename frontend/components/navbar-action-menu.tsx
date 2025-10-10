'use client';

import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useDraftContext } from '@/contexts/draft-context';
import { DraftType } from '@/types/draft';
import { Calendar, FileText, Mail, Plus } from 'lucide-react';
import { useSession } from 'next-auth/react';

export function NavbarActionMenu() {
    const { data: session } = useSession();
    const { createNewDraft } = useDraftContext();

    const handleCreateDraft = (type: DraftType) => {
        if (session?.user?.email) {
            createNewDraft(type, session.user.email);
        }
    };

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" title="Create New" className="gap-2">
                    <div className="w-4 h-4 rounded-full bg-gray-100 flex items-center justify-center">
                        <Plus className="h-3 w-3" />
                    </div>
                    New
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => handleCreateDraft('email')}>
                    <Mail className="h-4 w-4 mr-2" />
                    Email
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleCreateDraft('calendar')}>
                    <Calendar className="h-4 w-4 mr-2" />
                    Event
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleCreateDraft('document')}>
                    <FileText className="h-4 w-4 mr-2" />
                    Document
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
