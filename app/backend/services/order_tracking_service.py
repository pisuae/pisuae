import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.order_tracking import Order_tracking

logger = logging.getLogger(__name__)

# Define the standard order flow with default titles and descriptions
ORDER_FLOW = [
    {
        "status": "confirmed",
        "title": "Order Confirmed",
        "description": "Your order has been confirmed and is being prepared.",
    },
    {
        "status": "shipped",
        "title": "Shipped",
        "description": "Your order has been shipped and is on its way.",
    },
    {
        "status": "out_for_delivery",
        "title": "Out for Delivery",
        "description": "Your order is out for delivery and will arrive soon.",
    },
    {
        "status": "delivered",
        "title": "Delivered",
        "description": "Your order has been delivered. Enjoy!",
    },
]

# Map order status to how many tracking steps should exist
STATUS_TO_STEP_COUNT = {
    "pending": 0,
    "confirmed": 1,
    "paid": 1,
    "processing": 1,
    "shipped": 2,
    "out_for_delivery": 3,
    "delivered": 4,
    "completed": 4,
    "cancelled": 0,
}


class OrderTrackingService:
    """Service for managing order tracking events."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_tracking_for_order(
        self, order_id: int, user_id: str
    ) -> List[Dict[str, Any]]:
        """Get all tracking events for a specific order."""
        stmt = (
            select(Order_tracking)
            .where(
                Order_tracking.order_id == order_id,
                Order_tracking.user_id == user_id,
            )
            .order_by(Order_tracking.timestamp.asc())
        )
        result = await self.db.execute(stmt)
        items = result.scalars().all()
        return [
            {
                "id": item.id,
                "order_id": item.order_id,
                "status": item.status,
                "title": item.title,
                "description": item.description,
                "timestamp": item.timestamp.isoformat() if item.timestamp else None,
            }
            for item in items
        ]

    async def get_tracking_for_orders(
        self, order_ids: List[int], user_id: str
    ) -> Dict[int, List[Dict[str, Any]]]:
        """Get tracking events for multiple orders at once."""
        if not order_ids:
            return {}
        stmt = (
            select(Order_tracking)
            .where(
                Order_tracking.order_id.in_(order_ids),
                Order_tracking.user_id == user_id,
            )
            .order_by(Order_tracking.timestamp.asc())
        )
        result = await self.db.execute(stmt)
        items = result.scalars().all()

        tracking_map: Dict[int, List[Dict[str, Any]]] = {}
        for item in items:
            oid = item.order_id
            if oid not in tracking_map:
                tracking_map[oid] = []
            tracking_map[oid].append(
                {
                    "id": item.id,
                    "order_id": item.order_id,
                    "status": item.status,
                    "title": item.title,
                    "description": item.description,
                    "timestamp": item.timestamp.isoformat() if item.timestamp else None,
                }
            )
        return tracking_map

    async def ensure_tracking_for_order(
        self,
        order_id: int,
        user_id: str,
        order_status: str,
        order_created_at: Optional[datetime] = None,
    ) -> List[Dict[str, Any]]:
        """
        Ensure tracking events exist for an order based on its current status.
        Creates missing tracking events with realistic timestamps.
        """
        existing = await self.get_tracking_for_order(order_id, user_id)
        existing_statuses = {e["status"] for e in existing}

        step_count = STATUS_TO_STEP_COUNT.get(order_status, 0)
        steps_to_create = ORDER_FLOW[:step_count]

        base_time = order_created_at or datetime.now(timezone.utc)
        if isinstance(base_time, str):
            try:
                base_time = datetime.fromisoformat(base_time.replace("Z", "+00:00"))
            except (ValueError, TypeError):
                base_time = datetime.now(timezone.utc)

        # Make sure base_time is timezone-aware
        if base_time.tzinfo is None:
            base_time = base_time.replace(tzinfo=timezone.utc)

        created_any = False
        for i, step in enumerate(steps_to_create):
            if step["status"] not in existing_statuses:
                # Space out timestamps: each step is ~hours apart
                step_time = base_time + timedelta(hours=(i + 1) * 4, minutes=i * 17)
                tracking = Order_tracking(
                    user_id=user_id,
                    order_id=order_id,
                    status=step["status"],
                    title=step["title"],
                    description=step["description"],
                    timestamp=step_time,
                    created_at=datetime.now(timezone.utc),
                )
                self.db.add(tracking)
                created_any = True

        if created_any:
            await self.db.commit()

        return await self.get_tracking_for_order(order_id, user_id)