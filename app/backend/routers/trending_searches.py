import logging
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from services.trending_searches import TrendingSearchesService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/trending-searches", tags=["trending-searches"])


class TrendingSearchItem(BaseModel):
    query: str
    search_count: int


class TrendingSearchesResponse(BaseModel):
    items: List[TrendingSearchItem]


@router.get("", response_model=TrendingSearchesResponse)
async def get_trending_searches(
    limit: int = Query(10, ge=1, le=50, description="Max number of trending searches to return"),
    db: AsyncSession = Depends(get_db),
):
    """Get the most popular search queries across all users. No auth required."""
    logger.debug(f"Fetching trending searches, limit={limit}")
    service = TrendingSearchesService(db)
    try:
        items = await service.get_trending(limit=limit)
        return TrendingSearchesResponse(items=items)
    except Exception as e:
        logger.error(f"Error fetching trending searches: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")