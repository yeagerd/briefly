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


class RankingMode(Enum):
    """Supported ranking modes for search."""

    HYBRID = "hybrid"
    SEMANTIC = "semantic"


class UserDataSearchTool:
    """Unified search tool for all user data types with configurable ranking."""

    def __init__(self, vespa_endpoint: str, user_id: str):
        self.search_engine = SearchEngine(vespa_endpoint)
        self.user_id = user_id
        self.tool_name = "search_user_data"
        self.description = "Search user data by type, query, and ranking mode"

    async def debug_user_data(self) -> Dict[str, Any]:
        """Debug method to check what data exists for this user."""
        try:
            # Check if any data exists for this user
            debug_query = {
                "yql": "select * from briefly_document",
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
        self,
        query: str,
        data_type: DataType = DataType.ANY,
        ranking_mode: RankingMode = RankingMode.HYBRID,
        max_results: int = 20,
    ) -> Dict[str, Any]:
        """Search user data with configurable parameters.

        Args:
            query: Search query string
            data_type: Type of data to search (DataType enum)
            ranking_mode: Ranking mode to use (RankingMode enum)
            max_results: Maximum number of results to return

        Returns:
            Dict containing search results and metadata
        """
        try:
            # Since user_id is already set as streaming.groupname, we do not need to filter by user_id in the YQL query.
            if data_type == DataType.ANY:
                yql_query = f'select * from briefly_document where (search_text contains "{query}" or content contains "{query}" or title contains "{query}")'
            else:
                yql_query = f'select * from briefly_document where source_type contains "{data_type.value}" and (search_text contains "{query}" or content contains "{query}" or title contains "{query}")'

            search_query = {
                "yql": yql_query,
                "hits": max_results,
                "ranking": ranking_mode.value,
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
                "ranking_mode": ranking_mode.value,
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
                "ranking_mode": ranking_mode.value,
                "error": str(e),
                "results": [],
                "total_found": 0,
            }
