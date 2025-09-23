/* generated using openapi-typescript-codegen -- do no edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * Search performance metrics.
 */
export type SearchPerformance = {
    /**
     * Query execution time in milliseconds
     */
    query_time_ms?: number;
    /**
     * Total response time in milliseconds
     */
    total_time_ms?: number;
    /**
     * Search processing time
     */
    search_time_ms?: number;
    /**
     * Match processing time
     */
    match_time_ms?: number;
    /**
     * Document fetch time
     */
    fetch_time_ms?: number;
};

