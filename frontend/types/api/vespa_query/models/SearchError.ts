/* generated using openapi-typescript-codegen -- do no edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * Search error response.
 */
export type SearchError = {
    /**
     * Original search query
     */
    query: string;
    /**
     * User ID who performed the search
     */
    user_id: string;
    /**
     * Error message
     */
    error: string;
    /**
     * Error code if available
     */
    error_code?: (string | null);
    /**
     * Additional error details
     */
    details?: (Record<string, any> | null);
    /**
     * Error timestamp
     */
    processed_at?: string;
};

