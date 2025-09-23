'use client';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Command, CommandEmpty, CommandGroup, CommandItem } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { Check, ChevronsUpDown, Tag } from 'lucide-react';
import React from 'react';

export interface TagsFilterProps {
    tagFilter?: string[];
    onTagFilterChange: (tags: string[] | undefined) => void;
    availableTags: string[];
}

const TagsFilter: React.FC<TagsFilterProps> = ({
    tagFilter,
    onTagFilterChange,
    availableTags,
}) => {
    const [open, setOpen] = React.useState(false);

    // "All Tags" is selected when tagFilter is undefined
    const allTagsSelected = tagFilter === undefined;

    const handleAllTagsToggle = () => {
        if (allTagsSelected) {
            // If "All Tags" is selected, switch to explicit selection mode with none selected
            onTagFilterChange([]);
        } else {
            // Switch back to "All Tags" mode by sending undefined
            onTagFilterChange(undefined);
        }
    };

    const handleTagToggle = (tag: string) => {
        const current = tagFilter ?? [];
        if (current.includes(tag)) {
            // Remove tag from filter
            const newFilter = current.filter(t => t !== tag);
            onTagFilterChange(newFilter);
        } else {
            // Add tag to filter
            onTagFilterChange([...current, tag]);
        }
    };

    // Get display text for the trigger button
    const getTriggerText = () => {
        if (allTagsSelected) {
            return 'All Tags';
        }
        if (tagFilter && tagFilter.length > 0) {
            if (tagFilter.length === 1) {
                return tagFilter[0];
            }
            return `${tagFilter.length} tags`;
        }
        return 'No tags';
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="min-w-[140px] justify-between"
                >
                    {getTriggerText()}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[280px] p-0" align="start">
                <Command>
                    <CommandGroup>
                        {/* All Tags Option */}
                        <CommandItem
                            onSelect={handleAllTagsToggle}
                            className="flex items-center space-x-2 px-2 py-1.5"
                        >
                            <Checkbox
                                checked={allTagsSelected}
                                className="mr-2"
                            />
                            <span className="font-medium">All Tags</span>
                        </CommandItem>

                        {/* Individual Tag Options */}
                        {availableTags.map((tag) => {
                            const isSelected = (tagFilter ?? []).includes(tag);
                            const isDisabled = allTagsSelected;

                            return (
                                <CommandItem
                                    key={tag}
                                    onSelect={() => !isDisabled && handleTagToggle(tag)}
                                    className={cn(
                                        "flex items-center space-x-2 px-2 py-1.5",
                                        isDisabled && "opacity-50 cursor-not-allowed"
                                    )}
                                    disabled={isDisabled}
                                >
                                    <Checkbox
                                        checked={isSelected}
                                        disabled={isDisabled}
                                        className="mr-2"
                                    />
                                    <span className="text-sm flex items-center gap-1">
                                        <Tag className="w-3 h-3" />
                                        {tag}
                                    </span>
                                </CommandItem>
                            );
                        })}
                    </CommandGroup>

                    {tagFilter && tagFilter.length > 0 && (
                        <>
                            <CommandEmpty>No tags available</CommandEmpty>
                            <div className="border-t p-2">
                                <div className="flex items-center justify-between text-xs text-muted-foreground">
                                    <span>Selected:</span>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => onTagFilterChange([])}
                                        className="h-6 px-2 text-xs"
                                    >
                                        Clear all
                                    </Button>
                                </div>
                                <div className="flex flex-wrap gap-1 mt-1">
                                    {tagFilter.map(tag => (
                                        <span
                                            key={tag}
                                            className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-secondary text-secondary-foreground rounded-md"
                                        >
                                            <Tag className="w-3 h-3" />
                                            {tag}
                                            <button
                                                onClick={() => handleTagToggle(tag)}
                                                className="ml-1 hover:text-destructive"
                                            >
                                                <Check className="w-3 h-3" />
                                            </button>
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </>
                    )}
                </Command>
            </PopoverContent>
        </Popover>
    );
};

export default TagsFilter;
