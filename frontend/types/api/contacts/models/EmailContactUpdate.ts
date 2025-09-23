/* generated using openapi-typescript-codegen -- do no edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ContactPhone } from './ContactPhone';
/**
 * Update model for email contacts.
 */
export type EmailContactUpdate = {
    display_name?: (string | null);
    given_name?: (string | null);
    family_name?: (string | null);
    phone_numbers?: (Array<ContactPhone> | null);
    tags?: (Array<string> | null);
    notes?: (string | null);
};

