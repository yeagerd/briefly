/* generated using openapi-typescript-codegen -- do no edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { EmailMessage } from './EmailMessage';

/**
 * Response model for email delta sync operations.
 */
export type EmailDeltaResponse = {
    /**
     * Newly created messages
     */
    created?: Array<EmailMessage>;
    /**
     * Updated messages
     */
    updated?: Array<EmailMessage>;
    /**
     * Deleted message IDs
     */
    deleted?: Array<string>;
    /**
     * Next delta token for subsequent requests
     */
    next_token: string;
    /**
     * Request ID for tracking
     */
    request_id: string;
};
