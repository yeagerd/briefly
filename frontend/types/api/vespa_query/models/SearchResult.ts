/* generated using openapi-typescript-codegen -- do no edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * Individual search result document.
 */
export type SearchResult = {
    /**
     * Document ID
     */
    id: string;
    /**
     * User ID who owns this document
     */
    user_id: string;
    /**
     * Type of document (email, calendar, contact, etc.)
     */
    source_type: string;
    /**
     * Data provider (gmail, outlook, etc.)
     */
    provider: string;
    /**
     * Document title/subject
     */
    title?: string;
    /**
     * Document content
     */
    content?: string;
    /**
     * Searchable text content
     */
    search_text?: string;
    /**
     * Creation timestamp
     */
    created_at?: (number | null);
    /**
     * Last update timestamp
     */
    updated_at?: (number | null);
    /**
     * Search relevance score
     */
    relevance_score?: number;
    /**
     * Email sender address
     */
    sender?: (string | null);
    /**
     * Email recipients
     */
    recipients?: Array<string>;
    /**
     * Email thread ID
     */
    thread_id?: (string | null);
    /**
     * Email folder
     */
    folder?: (string | null);
    /**
     * Quoted content in email
     */
    quoted_content?: (string | null);
    /**
     * Thread summary
     */
    thread_summary?: (Record<string, any> | null);
    /**
     * Event start time
     */
    start_time?: (number | null);
    /**
     * Event end time
     */
    end_time?: (number | null);
    /**
     * Event attendees
     */
    attendees?: Array<string>;
    /**
     * Event location
     */
    location?: (string | null);
    /**
     * Whether event is all-day
     */
    is_all_day?: (boolean | null);
    /**
     * Whether event is recurring
     */
    recurring?: (boolean | null);
    /**
     * Contact display name
     */
    display_name?: (string | null);
    /**
     * Contact email addresses
     */
    email_addresses?: Array<string>;
    /**
     * Contact company
     */
    company?: (string | null);
    /**
     * Contact job title
     */
    job_title?: (string | null);
    /**
     * Contact phone numbers
     */
    phone_numbers?: Array<string>;
    /**
     * Contact address
     */
    address?: (string | null);
    /**
     * File name
     */
    file_name?: (string | null);
    /**
     * File size in bytes
     */
    file_size?: (number | null);
    /**
     * File MIME type
     */
    mime_type?: (string | null);
    /**
     * Additional metadata
     */
    metadata?: Record<string, any>;
    /**
     * Search highlights
     */
    highlights?: Array<string>;
    /**
     * Generated snippet
     */
    snippet?: (string | null);
    /**
     * Search method used
     */
    search_method?: (string | null);
    /**
     * Match confidence level
     */
    match_confidence?: (string | null);
    /**
     * Vector similarity score
     */
    vector_similarity?: (number | null);
    /**
     * Keyword match details
     */
    keyword_matches?: (Record<string, any> | null);
};

