import logging
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from models.search_histories import Search_histories

logger = logging.getLogger(__name__)


class TrendingSearchesService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_trending(self, limit: int = 10) -> list[dict]:
        """Get the most popular search queries across all users."""
        try:
            stmt = (
                select(
                    Search_histories.query,
                    func.count(Search_histories.id).label("search_count"),
                )
                .group_by(func.lower(Search_histories.query))
                .group_by(Search_histories.query)
                .order_by(func.count(Search_histories.id).desc())
                .limit(limit)
            )
            result = await self.db.execute(stmt)
            rows = result.all()
            return [
                {"query": row.query, "search_count": row.search_count}
                for row in rows
            ]
        except Exception as e:
            logger.error(f"Error fetching trending searches: {e}", exc_info=True)
            return []