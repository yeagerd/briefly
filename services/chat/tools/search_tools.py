"""
Simplified Vespa-backed search tool for user data.

This module provides a single, clean search interface that allows the agent to
specify data type, query string, and max results.
"""

import logging
from enum import Enum
from typing import Any, Dict, List

from services.vespa_query.search_engine import SearchEngine

logger = logging.getLogger(__name__)


class DataType(Enum):
    """Supported data types for search."""

    ANY = "any"
    EMAIL = "email"
    CALENDAR = "calendar"
    DOCUMENT = "document"
    MEETING_POLL = "meeting_poll"
    CONTACT = "contact"


class VespaSearchTool:
    """Basic Vespa search tool for user data."""

    def __init__(self, vespa_endpoint: str, user_id: str):
        self.search_engine = SearchEngine(vespa_endpoint)
        self.user_id = user_id
        self.tool_name = "vespa_search"
        self.description = "Search user data using Vespa"

    async def search(self, query: str, max_results: int = 20) -> Dict[str, Any]:
        """Search user data with basic parameters."""
        try:
            yql_query = f'select * from briefly_document where user_id contains "{self.user_id}" and (search_text contains "{query}" or content contains "{query}" or title contains "{query}")'

            search_query = {
                "yql": yql_query,
                "hits": max_results,
                "ranking": "hybrid",
                "timeout": "5.0s",
                "streaming.groupname": self.user_id,
            }

            logger.info(f"Vespa search query: {search_query}")
            results = await self.search_engine.search(search_query)

            root = results.get("root", {})
            children = root.get("children", [])
            total_count = root.get("fields", {}).get("totalCount", 0)

            return {
                "status": "success",
                "query": query,
                "results": children,
                "total_found": total_count,
                "max_results": max_results,
            }

        except Exception as e:
            logger.error(f"Vespa search failed: {e}")
            return {
                "status": "error",
                "query": query,
                "error": str(e),
                "results": [],
                "total_found": 0,
            }

    async def cleanup(self) -> None:
        """Clean up resources."""
        if hasattr(self, "search_engine") and self.search_engine:
            await self.search_engine.close()


class SemanticSearchTool:
    """Semantic search tool for user data."""

    def __init__(self, vespa_endpoint: str, user_id: str):
        self.search_engine = SearchEngine(vespa_endpoint)
        self.user_id = user_id
        self.tool_name = "semantic_search"
        self.description = "Semantic search for user data"

    async def search(self, query: str, max_results: int = 20) -> Dict[str, Any]:
        """Perform semantic search on user data."""
        try:
            # Use semantic ranking for better relevance
            yql_query = f'select * from briefly_document where user_id contains "{self.user_id}" and (search_text contains "{query}" or content contains "{query}" or title contains "{query}")'

            search_query = {
                "yql": yql_query,
                "hits": max_results,
                "ranking": "semantic",
                "timeout": "5.0s",
                "streaming.groupname": self.user_id,
            }

            logger.info(f"Semantic search query: {search_query}")
            results = await self.search_engine.search(search_query)

            root = results.get("root", {})
            children = root.get("children", [])
            total_count = root.get("fields", {}).get("totalCount", 0)

            return {
                "status": "success",
                "query": query,
                "results": children,
                "total_found": total_count,
                "max_results": max_results,
                "search_type": "semantic",
            }

        except Exception as e:
            logger.error(f"Semantic search failed: {e}")
            return {
                "status": "error",
                "query": query,
                "error": str(e),
                "results": [],
                "total_found": 0,
            }

    async def cleanup(self) -> None:
        """Clean up resources."""
        if hasattr(self, "search_engine") and self.search_engine:
            await self.search_engine.close()


class UserDataSearchTool:
    """Simple, unified search tool for all user data types."""

    def __init__(self, vespa_endpoint: str, user_id: str):
        self.search_engine = SearchEngine(vespa_endpoint)
        self.user_id = user_id
        self.tool_name = "search_user_data"
        self.description = "Search user data by type and query"
        # Initialize vespa_search for compatibility
        self.vespa_search = VespaSearchTool(vespa_endpoint, user_id)

    async def debug_user_data(self) -> Dict[str, Any]:
        """Debug method to check what data exists for this user."""
        try:
            # Check if any data exists for this user
            debug_query = {
                "yql": f'select * from briefly_document where user_id contains "{self.user_id}"',
                "hits": 5,
                "timeout": "5.0s",
                "streaming.groupname": self.user_id,
            }

            logger.info(f"Debug query: {debug_query}")
            results = await self.search_engine.search(debug_query)

            root = results.get("root", {})
            children = root.get("children", [])
            total_count = root.get("fields", {}).get("totalCount", 0)

            return {
                "status": "success",
                "user_id": self.user_id,
                "total_documents": total_count,
                "sample_documents": children,
                "debug_info": "Check if data exists and what fields are populated",
            }

        except Exception as e:
            logger.error(f"Debug query failed: {e}")
            return {"status": "error", "user_id": self.user_id, "error": str(e)}

    async def cleanup(self) -> None:
        """Clean up resources, including closing the search engine session."""
        if hasattr(self, "search_engine") and self.search_engine:
            await self.search_engine.close()

    async def __aenter__(self) -> "UserDataSearchTool":
        """Async context manager entry."""
        return self

    async def __aexit__(self, exc_type: Any, exc_val: Any, exc_tb: Any) -> None:
        """Async context manager exit - ensure cleanup."""
        await self.cleanup()

    async def search(
        self, query: str, data_type: DataType = DataType.ANY, max_results: int = 20
    ) -> Dict[str, Any]:
        """Search user data with simple parameters.

        Args:
            query: Search query string
            data_type: Type of data to search (DataType enum)
            max_results: Maximum number of results to return

        Returns:
            Dict containing search results and metadata
        """
        try:
            # Build simple YQL query based on data_type
            if data_type == DataType.ANY:
                yql_query = f'select * from briefly_document where user_id contains "{self.user_id}" and (search_text contains "{query}" or content contains "{query}" or title contains "{query}")'
            else:
                yql_query = f'select * from briefly_document where user_id contains "{self.user_id}" and source_type contains "{data_type.value}" and (search_text contains "{query}" or content contains "{query}" or title contains "{query}")'

            search_query = {
                "yql": yql_query,
                "hits": max_results,
                "ranking": "hybrid",
                "timeout": "5.0s",
                "streaming.groupname": self.user_id,
            }

            logger.info(f"Search query: {search_query}")
            results = await self.search_engine.search(search_query)

            # Extract results from Vespa response
            root = results.get("root", {})
            children = root.get("children", [])
            total_count = root.get("fields", {}).get("totalCount", 0)

            return {
                "status": "success",
                "query": query,
                "data_type": data_type.value,
                "results": children,
                "total_found": total_count,
                "max_results": max_results,
            }

        except Exception as e:
            logger.error(f"Search failed: {e}")
            return {
                "status": "error",
                "query": query,
                "data_type": data_type.value,
                "error": str(e),
                "results": [],
                "total_found": 0,
            }

    async def search_all_data(
        self, query: str, max_results: int = 20
    ) -> Dict[str, Any]:
        """Search all user data types with comprehensive results.

        Args:
            query: Search query string
            max_results: Maximum number of results to return

        Returns:
            Dict containing search results grouped by type and metadata
        """
        try:
            # Search across all data types
            yql_query = f'select * from briefly_document where user_id contains "{self.user_id}" and (search_text contains "{query}" or content contains "{query}" or title contains "{query}")'

            search_query = {
                "yql": yql_query,
                "hits": max_results,
                "ranking": "hybrid",
                "timeout": "5.0s",
                "streaming.groupname": self.user_id,
            }

            logger.info(f"Comprehensive search query: {search_query}")
            results = await self.search_engine.search(search_query)

            root = results.get("root", {})
            children = root.get("children", [])
            total_count = root.get("fields", {}).get("totalCount", 0)

            # Group results by type
            grouped_results: Dict[str, List[Dict[str, Any]]] = {}
            for result in children:
                result_type = result.get("fields", {}).get("source_type", "unknown")
                if result_type not in grouped_results:
                    grouped_results[result_type] = []
                grouped_results[result_type].append(result)

            return {
                "status": "success",
                "query": query,
                "results": children,
                "grouped_results": grouped_results,
                "total_found": total_count,
                "total_messages": total_count,  # For compatibility with existing code
                "max_results": max_results,
                "summary": {
                    "total_documents": total_count,
                    "types_found": list(grouped_results.keys()),
                    "type_counts": {k: len(v) for k, v in grouped_results.items()},
                },
            }

        except Exception as e:
            logger.error(f"Comprehensive search failed: {e}")
            return {
                "status": "error",
                "query": query,
                "error": str(e),
                "results": [],
                "grouped_results": {},
                "total_found": 0,
                "total_messages": 0,
                "summary": {},
            }
