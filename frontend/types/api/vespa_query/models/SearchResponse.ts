/* generated using openapi-typescript-codegen -- do no edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { SearchFacets } from './SearchFacets';
import type { SearchPerformance } from './SearchPerformance';
import type { SearchResult } from './SearchResult';
/**
 * Complete search response.
 */
export type SearchResponse = {
    /**
     * Original search query
     */
    query: string;
    /**
     * User ID who performed the search
     */
    user_id: string;
    /**
     * Total number of matching documents
     */
    total_hits?: number;
    /**
     * Search results
     */
    documents?: Array<SearchResult>;
    /**
     * Search facets
     */
    facets?: SearchFacets;
    /**
     * Performance metrics
     */
    performance?: SearchPerformance;
    /**
     * Search coverage information
     */
    coverage?: (Record<string, any> | null);
    /**
     * Processing timestamp
     */
    processed_at?: string;
};

