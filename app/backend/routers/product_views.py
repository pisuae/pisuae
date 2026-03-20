import json
import logging
from typing import List, Optional

from datetime import datetime, date

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from services.product_views import Product_viewsService

# Set up logging
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/entities/product_views", tags=["product_views"])


# ---------- Pydantic Schemas ----------
class Product_viewsData(BaseModel):
    """Entity data schema (for create/update)"""
    product_id: int
    seller_id: str
    viewer_ip: str = None
    viewed_at: datetime


class Product_viewsUpdateData(BaseModel):
    """Update entity data (partial updates allowed)"""
    product_id: Optional[int] = None
    seller_id: Optional[str] = None
    viewer_ip: Optional[str] = None
    viewed_at: Optional[datetime] = None


class Product_viewsResponse(BaseModel):
    """Entity response schema"""
    id: int
    product_id: int
    seller_id: str
    viewer_ip: Optional[str] = None
    viewed_at: datetime

    class Config:
        from_attributes = True


class Product_viewsListResponse(BaseModel):
    """List response schema"""
    items: List[Product_viewsResponse]
    total: int
    skip: int
    limit: int


class Product_viewsBatchCreateRequest(BaseModel):
    """Batch create request"""
    items: List[Product_viewsData]


class Product_viewsBatchUpdateItem(BaseModel):
    """Batch update item"""
    id: int
    updates: Product_viewsUpdateData


class Product_viewsBatchUpdateRequest(BaseModel):
    """Batch update request"""
    items: List[Product_viewsBatchUpdateItem]


class Product_viewsBatchDeleteRequest(BaseModel):
    """Batch delete request"""
    ids: List[int]


# ---------- Routes ----------
@router.get("", response_model=Product_viewsListResponse)
async def query_product_viewss(
    query: str = Query(None, description="Query conditions (JSON string)"),
    sort: str = Query(None, description="Sort field (prefix with '-' for descending)"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(20, ge=1, le=2000, description="Max number of records to return"),
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    db: AsyncSession = Depends(get_db),
):
    """Query product_viewss with filtering, sorting, and pagination"""
    logger.debug(f"Querying product_viewss: query={query}, sort={sort}, skip={skip}, limit={limit}, fields={fields}")
    
    service = Product_viewsService(db)
    try:
        # Parse query JSON if provided
        query_dict = None
        if query:
            try:
                query_dict = json.loads(query)
            except json.JSONDecodeError:
                raise HTTPException(status_code=400, detail="Invalid query JSON format")
        
        result = await service.get_list(
            skip=skip, 
            limit=limit,
            query_dict=query_dict,
            sort=sort,
        )
        logger.debug(f"Found {result['total']} product_viewss")
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error querying product_viewss: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/all", response_model=Product_viewsListResponse)
async def query_product_viewss_all(
    query: str = Query(None, description="Query conditions (JSON string)"),
    sort: str = Query(None, description="Sort field (prefix with '-' for descending)"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(20, ge=1, le=2000, description="Max number of records to return"),
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    db: AsyncSession = Depends(get_db),
):
    # Query product_viewss with filtering, sorting, and pagination without user limitation
    logger.debug(f"Querying product_viewss: query={query}, sort={sort}, skip={skip}, limit={limit}, fields={fields}")

    service = Product_viewsService(db)
    try:
        # Parse query JSON if provided
        query_dict = None
        if query:
            try:
                query_dict = json.loads(query)
            except json.JSONDecodeError:
                raise HTTPException(status_code=400, detail="Invalid query JSON format")

        result = await service.get_list(
            skip=skip,
            limit=limit,
            query_dict=query_dict,
            sort=sort
        )
        logger.debug(f"Found {result['total']} product_viewss")
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error querying product_viewss: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/{id}", response_model=Product_viewsResponse)
async def get_product_views(
    id: int,
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    db: AsyncSession = Depends(get_db),
):
    """Get a single product_views by ID"""
    logger.debug(f"Fetching product_views with id: {id}, fields={fields}")
    
    service = Product_viewsService(db)
    try:
        result = await service.get_by_id(id)
        if not result:
            logger.warning(f"Product_views with id {id} not found")
            raise HTTPException(status_code=404, detail="Product_views not found")
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching product_views {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("", response_model=Product_viewsResponse, status_code=201)
async def create_product_views(
    data: Product_viewsData,
    db: AsyncSession = Depends(get_db),
):
    """Create a new product_views"""
    logger.debug(f"Creating new product_views with data: {data}")
    
    service = Product_viewsService(db)
    try:
        result = await service.create(data.model_dump())
        if not result:
            raise HTTPException(status_code=400, detail="Failed to create product_views")
        
        logger.info(f"Product_views created successfully with id: {result.id}")
        return result
    except ValueError as e:
        logger.error(f"Validation error creating product_views: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating product_views: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("/batch", response_model=List[Product_viewsResponse], status_code=201)
async def create_product_viewss_batch(
    request: Product_viewsBatchCreateRequest,
    db: AsyncSession = Depends(get_db),
):
    """Create multiple product_viewss in a single request"""
    logger.debug(f"Batch creating {len(request.items)} product_viewss")
    
    service = Product_viewsService(db)
    results = []
    
    try:
        for item_data in request.items:
            result = await service.create(item_data.model_dump())
            if result:
                results.append(result)
        
        logger.info(f"Batch created {len(results)} product_viewss successfully")
        return results
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch create: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch create failed: {str(e)}")


@router.put("/batch", response_model=List[Product_viewsResponse])
async def update_product_viewss_batch(
    request: Product_viewsBatchUpdateRequest,
    db: AsyncSession = Depends(get_db),
):
    """Update multiple product_viewss in a single request"""
    logger.debug(f"Batch updating {len(request.items)} product_viewss")
    
    service = Product_viewsService(db)
    results = []
    
    try:
        for item in request.items:
            # Only include non-None values for partial updates
            update_dict = {k: v for k, v in item.updates.model_dump().items() if v is not None}
            result = await service.update(item.id, update_dict)
            if result:
                results.append(result)
        
        logger.info(f"Batch updated {len(results)} product_viewss successfully")
        return results
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch update: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch update failed: {str(e)}")


@router.put("/{id}", response_model=Product_viewsResponse)
async def update_product_views(
    id: int,
    data: Product_viewsUpdateData,
    db: AsyncSession = Depends(get_db),
):
    """Update an existing product_views"""
    logger.debug(f"Updating product_views {id} with data: {data}")

    service = Product_viewsService(db)
    try:
        # Only include non-None values for partial updates
        update_dict = {k: v for k, v in data.model_dump().items() if v is not None}
        result = await service.update(id, update_dict)
        if not result:
            logger.warning(f"Product_views with id {id} not found for update")
            raise HTTPException(status_code=404, detail="Product_views not found")
        
        logger.info(f"Product_views {id} updated successfully")
        return result
    except HTTPException:
        raise
    except ValueError as e:
        logger.error(f"Validation error updating product_views {id}: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error updating product_views {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.delete("/batch")
async def delete_product_viewss_batch(
    request: Product_viewsBatchDeleteRequest,
    db: AsyncSession = Depends(get_db),
):
    """Delete multiple product_viewss by their IDs"""
    logger.debug(f"Batch deleting {len(request.ids)} product_viewss")
    
    service = Product_viewsService(db)
    deleted_count = 0
    
    try:
        for item_id in request.ids:
            success = await service.delete(item_id)
            if success:
                deleted_count += 1
        
        logger.info(f"Batch deleted {deleted_count} product_viewss successfully")
        return {"message": f"Successfully deleted {deleted_count} product_viewss", "deleted_count": deleted_count}
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch delete: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch delete failed: {str(e)}")


@router.delete("/{id}")
async def delete_product_views(
    id: int,
    db: AsyncSession = Depends(get_db),
):
    """Delete a single product_views by ID"""
    logger.debug(f"Deleting product_views with id: {id}")
    
    service = Product_viewsService(db)
    try:
        success = await service.delete(id)
        if not success:
            logger.warning(f"Product_views with id {id} not found for deletion")
            raise HTTPException(status_code=404, detail="Product_views not found")
        
        logger.info(f"Product_views {id} deleted successfully")
        return {"message": "Product_views deleted successfully", "id": id}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting product_views {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")