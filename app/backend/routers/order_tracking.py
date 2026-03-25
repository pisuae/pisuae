import json
import logging
from typing import List, Optional

from datetime import datetime, date

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from services.order_tracking import Order_trackingService
from dependencies.auth import get_current_user
from schemas.auth import UserResponse

# Set up logging
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/entities/order_tracking", tags=["order_tracking"])


# ---------- Pydantic Schemas ----------
class Order_trackingData(BaseModel):
    """Entity data schema (for create/update)"""
    order_id: int
    status: str
    title: str
    description: str = None
    timestamp: datetime
    created_at: Optional[datetime] = None


class Order_trackingUpdateData(BaseModel):
    """Update entity data (partial updates allowed)"""
    order_id: Optional[int] = None
    status: Optional[str] = None
    title: Optional[str] = None
    description: Optional[str] = None
    timestamp: Optional[datetime] = None
    created_at: Optional[datetime] = None


class Order_trackingResponse(BaseModel):
    """Entity response schema"""
    id: int
    user_id: str
    order_id: int
    status: str
    title: str
    description: Optional[str] = None
    timestamp: datetime
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class Order_trackingListResponse(BaseModel):
    """List response schema"""
    items: List[Order_trackingResponse]
    total: int
    skip: int
    limit: int


class Order_trackingBatchCreateRequest(BaseModel):
    """Batch create request"""
    items: List[Order_trackingData]


class Order_trackingBatchUpdateItem(BaseModel):
    """Batch update item"""
    id: int
    updates: Order_trackingUpdateData


class Order_trackingBatchUpdateRequest(BaseModel):
    """Batch update request"""
    items: List[Order_trackingBatchUpdateItem]


class Order_trackingBatchDeleteRequest(BaseModel):
    """Batch delete request"""
    ids: List[int]


# ---------- Routes ----------
@router.get("", response_model=Order_trackingListResponse)
async def query_order_trackings(
    query: str = Query(None, description="Query conditions (JSON string)"),
    sort: str = Query(None, description="Sort field (prefix with '-' for descending)"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(20, ge=1, le=2000, description="Max number of records to return"),
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Query order_trackings with filtering, sorting, and pagination (user can only see their own records)"""
    logger.debug(f"Querying order_trackings: query={query}, sort={sort}, skip={skip}, limit={limit}, fields={fields}")
    
    service = Order_trackingService(db)
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
            user_id=str(current_user.id),
        )
        logger.debug(f"Found {result['total']} order_trackings")
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error querying order_trackings: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/all", response_model=Order_trackingListResponse)
async def query_order_trackings_all(
    query: str = Query(None, description="Query conditions (JSON string)"),
    sort: str = Query(None, description="Sort field (prefix with '-' for descending)"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(20, ge=1, le=2000, description="Max number of records to return"),
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    db: AsyncSession = Depends(get_db),
):
    # Query order_trackings with filtering, sorting, and pagination without user limitation
    logger.debug(f"Querying order_trackings: query={query}, sort={sort}, skip={skip}, limit={limit}, fields={fields}")

    service = Order_trackingService(db)
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
        logger.debug(f"Found {result['total']} order_trackings")
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error querying order_trackings: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/{id}", response_model=Order_trackingResponse)
async def get_order_tracking(
    id: int,
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a single order_tracking by ID (user can only see their own records)"""
    logger.debug(f"Fetching order_tracking with id: {id}, fields={fields}")
    
    service = Order_trackingService(db)
    try:
        result = await service.get_by_id(id, user_id=str(current_user.id))
        if not result:
            logger.warning(f"Order_tracking with id {id} not found")
            raise HTTPException(status_code=404, detail="Order_tracking not found")
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching order_tracking {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("", response_model=Order_trackingResponse, status_code=201)
async def create_order_tracking(
    data: Order_trackingData,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new order_tracking"""
    logger.debug(f"Creating new order_tracking with data: {data}")
    
    service = Order_trackingService(db)
    try:
        result = await service.create(data.model_dump(), user_id=str(current_user.id))
        if not result:
            raise HTTPException(status_code=400, detail="Failed to create order_tracking")
        
        logger.info(f"Order_tracking created successfully with id: {result.id}")
        return result
    except ValueError as e:
        logger.error(f"Validation error creating order_tracking: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating order_tracking: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("/batch", response_model=List[Order_trackingResponse], status_code=201)
async def create_order_trackings_batch(
    request: Order_trackingBatchCreateRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create multiple order_trackings in a single request"""
    logger.debug(f"Batch creating {len(request.items)} order_trackings")
    
    service = Order_trackingService(db)
    results = []
    
    try:
        for item_data in request.items:
            result = await service.create(item_data.model_dump(), user_id=str(current_user.id))
            if result:
                results.append(result)
        
        logger.info(f"Batch created {len(results)} order_trackings successfully")
        return results
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch create: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch create failed: {str(e)}")


@router.put("/batch", response_model=List[Order_trackingResponse])
async def update_order_trackings_batch(
    request: Order_trackingBatchUpdateRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update multiple order_trackings in a single request (requires ownership)"""
    logger.debug(f"Batch updating {len(request.items)} order_trackings")
    
    service = Order_trackingService(db)
    results = []
    
    try:
        for item in request.items:
            # Only include non-None values for partial updates
            update_dict = {k: v for k, v in item.updates.model_dump().items() if v is not None}
            result = await service.update(item.id, update_dict, user_id=str(current_user.id))
            if result:
                results.append(result)
        
        logger.info(f"Batch updated {len(results)} order_trackings successfully")
        return results
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch update: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch update failed: {str(e)}")


@router.put("/{id}", response_model=Order_trackingResponse)
async def update_order_tracking(
    id: int,
    data: Order_trackingUpdateData,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update an existing order_tracking (requires ownership)"""
    logger.debug(f"Updating order_tracking {id} with data: {data}")

    service = Order_trackingService(db)
    try:
        # Only include non-None values for partial updates
        update_dict = {k: v for k, v in data.model_dump().items() if v is not None}
        result = await service.update(id, update_dict, user_id=str(current_user.id))
        if not result:
            logger.warning(f"Order_tracking with id {id} not found for update")
            raise HTTPException(status_code=404, detail="Order_tracking not found")
        
        logger.info(f"Order_tracking {id} updated successfully")
        return result
    except HTTPException:
        raise
    except ValueError as e:
        logger.error(f"Validation error updating order_tracking {id}: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error updating order_tracking {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.delete("/batch")
async def delete_order_trackings_batch(
    request: Order_trackingBatchDeleteRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete multiple order_trackings by their IDs (requires ownership)"""
    logger.debug(f"Batch deleting {len(request.ids)} order_trackings")
    
    service = Order_trackingService(db)
    deleted_count = 0
    
    try:
        for item_id in request.ids:
            success = await service.delete(item_id, user_id=str(current_user.id))
            if success:
                deleted_count += 1
        
        logger.info(f"Batch deleted {deleted_count} order_trackings successfully")
        return {"message": f"Successfully deleted {deleted_count} order_trackings", "deleted_count": deleted_count}
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch delete: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch delete failed: {str(e)}")


@router.delete("/{id}")
async def delete_order_tracking(
    id: int,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a single order_tracking by ID (requires ownership)"""
    logger.debug(f"Deleting order_tracking with id: {id}")
    
    service = Order_trackingService(db)
    try:
        success = await service.delete(id, user_id=str(current_user.id))
        if not success:
            logger.warning(f"Order_tracking with id {id} not found for deletion")
            raise HTTPException(status_code=404, detail="Order_tracking not found")
        
        logger.info(f"Order_tracking {id} deleted successfully")
        return {"message": "Order_tracking deleted successfully", "id": id}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting order_tracking {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")