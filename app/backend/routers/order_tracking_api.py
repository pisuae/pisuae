import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from dependencies.auth import get_current_user
from schemas.auth import UserResponse
from services.order_tracking_service import OrderTrackingService
from services.orders import OrdersService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/order-tracking", tags=["order-tracking"])


class TrackingEvent(BaseModel):
    id: int
    order_id: int
    status: str
    title: str
    description: Optional[str] = None
    timestamp: Optional[str] = None


class TrackingResponse(BaseModel):
    order_id: int
    events: List[TrackingEvent]


class BulkTrackingRequest(BaseModel):
    order_ids: str  # comma-separated order IDs


class BulkTrackingResponse(BaseModel):
    tracking: dict


@router.get("/order/{order_id}", response_model=TrackingResponse)
async def get_order_tracking(
    order_id: int,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get tracking events for a specific order, auto-generating if needed."""
    try:
        # Verify the order belongs to the user
        order_service = OrdersService(db)
        order = await order_service.get_by_id(order_id, user_id=current_user.id)
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")

        tracking_service = OrderTrackingService(db)
        events = await tracking_service.ensure_tracking_for_order(
            order_id=order_id,
            user_id=current_user.id,
            order_status=order.status,
            order_created_at=order.created_at,
        )

        return TrackingResponse(
            order_id=order_id,
            events=[TrackingEvent(**e) for e in events],
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting order tracking: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/bulk")
async def get_bulk_tracking(
    order_ids: str,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get tracking events for multiple orders at once."""
    try:
        ids = [int(x.strip()) for x in order_ids.split(",") if x.strip()]
        if not ids:
            return {"tracking": {}}

        # First ensure tracking exists for each order
        order_service = OrdersService(db)
        tracking_service = OrderTrackingService(db)

        for oid in ids:
            order = await order_service.get_by_id(oid, user_id=current_user.id)
            if order:
                await tracking_service.ensure_tracking_for_order(
                    order_id=oid,
                    user_id=current_user.id,
                    order_status=order.status,
                    order_created_at=order.created_at,
                )

        # Now fetch all tracking at once
        tracking_map = await tracking_service.get_tracking_for_orders(
            ids, current_user.id
        )

        return {"tracking": tracking_map}
    except Exception as e:
        logger.error(f"Error getting bulk tracking: {e}")
        raise HTTPException(status_code=500, detail=str(e))