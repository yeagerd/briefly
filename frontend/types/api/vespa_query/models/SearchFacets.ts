/* generated using openapi-typescript-codegen -- do no edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * Search result facets for aggregation.
 */
export type SearchFacets = {
    /**
     * Count by source type
     */
    source_types?: Record<string, number>;
    /**
     * Count by provider
     */
    providers?: Record<string, number>;
    /**
     * Count by folder
     */
    folders?: Record<string, number>;
    /**
     * Count by date range
     */
    date_ranges?: Record<string, number>;
};

