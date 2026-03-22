import logging
from typing import Optional, Dict, Any, List
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from models.reviews import Reviews

logger = logging.getLogger(__name__)


class ProductReviewsService:
    """Service for querying reviews by product (public access)"""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_reviews_by_product(
        self, product_id: int, skip: int = 0, limit: int = 50
    ) -> Dict[str, Any]:
        """Get all reviews for a specific product"""
        # Count total
        count_stmt = select(func.count(Reviews.id)).where(
            Reviews.product_id == product_id
        )
        total_result = await self.db.execute(count_stmt)
        total = total_result.scalar() or 0

        # Get reviews
        stmt = (
            select(Reviews)
            .where(Reviews.product_id == product_id)
            .order_by(Reviews.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        result = await self.db.execute(stmt)
        reviews = result.scalars().all()

        return {
            "items": [
                {
                    "id": r.id,
                    "product_id": r.product_id,
                    "rating": r.rating,
                    "review_text": r.review_text,
                    "reviewer_name": r.reviewer_name,
                    "created_at": r.created_at.isoformat() if r.created_at else None,
                }
                for r in reviews
            ],
            "total": total,
        }

    async def get_average_rating(self, product_id: int) -> Dict[str, Any]:
        """Get average rating for a product"""
        stmt = select(
            func.avg(Reviews.rating).label("avg_rating"),
            func.count(Reviews.id).label("review_count"),
        ).where(Reviews.product_id == product_id)
        result = await self.db.execute(stmt)
        row = result.one_or_none()
        avg = float(row.avg_rating) if row and row.avg_rating else 0
        count = int(row.review_count) if row and row.review_count else 0
        return {"average_rating": round(avg, 1), "review_count": count}

    async def get_average_ratings_bulk(self, product_ids: List[int]) -> Dict[int, Dict[str, Any]]:
        """Get average ratings for multiple products at once"""
        if not product_ids:
            return {}
        stmt = (
            select(
                Reviews.product_id,
                func.avg(Reviews.rating).label("avg_rating"),
                func.count(Reviews.id).label("review_count"),
            )
            .where(Reviews.product_id.in_(product_ids))
            .group_by(Reviews.product_id)
        )
        result = await self.db.execute(stmt)
        rows = result.all()
        ratings = {}
        for row in rows:
            ratings[row.product_id] = {
                "average_rating": round(float(row.avg_rating), 1),
                "review_count": int(row.review_count),
            }
        return ratings