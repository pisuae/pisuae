import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from services.product_reviews import ProductReviewsService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/reviews", tags=["reviews"])


class ReviewItem(BaseModel):
    id: int
    product_id: int
    rating: int
    review_text: Optional[str] = None
    reviewer_name: Optional[str] = None
    created_at: Optional[str] = None


class ReviewsResponse(BaseModel):
    items: List[ReviewItem]
    total: int


class RatingResponse(BaseModel):
    average_rating: float
    review_count: int


class BulkRatingItem(BaseModel):
    product_id: int
    average_rating: float
    review_count: int


class BulkRatingsResponse(BaseModel):
    ratings: List[BulkRatingItem]


@router.get("/product/{product_id}", response_model=ReviewsResponse)
async def get_product_reviews(
    product_id: int,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    """Get all reviews for a specific product (public endpoint)"""
    try:
        service = ProductReviewsService(db)
        result = await service.get_reviews_by_product(product_id, skip, limit)
        return ReviewsResponse(**result)
    except Exception as e:
        logger.error(f"Error fetching reviews for product {product_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch reviews")


@router.get("/rating/{product_id}", response_model=RatingResponse)
async def get_product_rating(
    product_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Get average rating for a specific product (public endpoint)"""
    try:
        service = ProductReviewsService(db)
        result = await service.get_average_rating(product_id)
        return RatingResponse(**result)
    except Exception as e:
        logger.error(f"Error fetching rating for product {product_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch rating")


@router.get("/ratings/bulk", response_model=BulkRatingsResponse)
async def get_bulk_ratings(
    product_ids: str = Query(..., description="Comma-separated product IDs"),
    db: AsyncSession = Depends(get_db),
):
    """Get average ratings for multiple products at once (public endpoint)"""
    try:
        ids = [int(pid.strip()) for pid in product_ids.split(",") if pid.strip()]
        service = ProductReviewsService(db)
        ratings_map = await service.get_average_ratings_bulk(ids)
        ratings = []
        for pid in ids:
            data = ratings_map.get(pid, {"average_rating": 0, "review_count": 0})
            ratings.append(BulkRatingItem(product_id=pid, **data))
        return BulkRatingsResponse(ratings=ratings)
    except Exception as e:
        logger.error(f"Error fetching bulk ratings: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch ratings")