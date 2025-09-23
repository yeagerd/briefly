"""
Vespa service API models.

This module contains the consolidated Pydantic models for the vespa_loader and vespa_query services.
"""

from services.api.v1.vespa_query.document_chunking import (
    ChunkingResult,
    ChunkingRule,
    ChunkingStrategy,
    ChunkType,
    DocumentChunk,
    DocumentChunkingConfig,
)
from services.api.v1.vespa_query.search_models import (
    SearchError,
    SearchFacets,
    SearchPerformance,
    SearchQuery,
    SearchResponse,
    SearchResult,
    SearchSummary,
)
from services.api.v1.vespa_query.vespa_types import (
    DocumentIngestionResult,
    VespaDocumentType,
)

__all__ = [
    "ChunkType",
    "ChunkingResult",
    "ChunkingRule",
    "ChunkingStrategy",
    "DocumentChunk",
    "DocumentChunkingConfig",
    "DocumentIngestionResult",
    "VespaDocumentType",
    "SearchQuery",
    "SearchResult",
    "SearchFacets",
    "SearchPerformance",
    "SearchResponse",
    "SearchError",
    "SearchSummary",
]
