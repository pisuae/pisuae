import logging
from typing import Optional, Dict, Any, List

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from models.product_views import Product_views

logger = logging.getLogger(__name__)


# ------------------ Service Layer ------------------
class Product_viewsService:
    """Service layer for Product_views operations"""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, data: Dict[str, Any]) -> Optional[Product_views]:
        """Create a new product_views"""
        try:
            obj = Product_views(**data)
            self.db.add(obj)
            await self.db.commit()
            await self.db.refresh(obj)
            logger.info(f"Created product_views with id: {obj.id}")
            return obj
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error creating product_views: {str(e)}")
            raise

    async def get_by_id(self, obj_id: int) -> Optional[Product_views]:
        """Get product_views by ID"""
        try:
            query = select(Product_views).where(Product_views.id == obj_id)
            result = await self.db.execute(query)
            return result.scalar_one_or_none()
        except Exception as e:
            logger.error(f"Error fetching product_views {obj_id}: {str(e)}")
            raise

    async def get_list(
        self, 
        skip: int = 0, 
        limit: int = 20, 
        query_dict: Optional[Dict[str, Any]] = None,
        sort: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Get paginated list of product_viewss"""
        try:
            query = select(Product_views)
            count_query = select(func.count(Product_views.id))
            
            if query_dict:
                for field, value in query_dict.items():
                    if hasattr(Product_views, field):
                        query = query.where(getattr(Product_views, field) == value)
                        count_query = count_query.where(getattr(Product_views, field) == value)
            
            count_result = await self.db.execute(count_query)
            total = count_result.scalar()

            if sort:
                if sort.startswith('-'):
                    field_name = sort[1:]
                    if hasattr(Product_views, field_name):
                        query = query.order_by(getattr(Product_views, field_name).desc())
                else:
                    if hasattr(Product_views, sort):
                        query = query.order_by(getattr(Product_views, sort))
            else:
                query = query.order_by(Product_views.id.desc())

            result = await self.db.execute(query.offset(skip).limit(limit))
            items = result.scalars().all()

            return {
                "items": items,
                "total": total,
                "skip": skip,
                "limit": limit,
            }
        except Exception as e:
            logger.error(f"Error fetching product_views list: {str(e)}")
            raise

    async def update(self, obj_id: int, update_data: Dict[str, Any]) -> Optional[Product_views]:
        """Update product_views"""
        try:
            obj = await self.get_by_id(obj_id)
            if not obj:
                logger.warning(f"Product_views {obj_id} not found for update")
                return None
            for key, value in update_data.items():
                if hasattr(obj, key):
                    setattr(obj, key, value)

            await self.db.commit()
            await self.db.refresh(obj)
            logger.info(f"Updated product_views {obj_id}")
            return obj
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error updating product_views {obj_id}: {str(e)}")
            raise

    async def delete(self, obj_id: int) -> bool:
        """Delete product_views"""
        try:
            obj = await self.get_by_id(obj_id)
            if not obj:
                logger.warning(f"Product_views {obj_id} not found for deletion")
                return False
            await self.db.delete(obj)
            await self.db.commit()
            logger.info(f"Deleted product_views {obj_id}")
            return True
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error deleting product_views {obj_id}: {str(e)}")
            raise

    async def get_by_field(self, field_name: str, field_value: Any) -> Optional[Product_views]:
        """Get product_views by any field"""
        try:
            if not hasattr(Product_views, field_name):
                raise ValueError(f"Field {field_name} does not exist on Product_views")
            result = await self.db.execute(
                select(Product_views).where(getattr(Product_views, field_name) == field_value)
            )
            return result.scalar_one_or_none()
        except Exception as e:
            logger.error(f"Error fetching product_views by {field_name}: {str(e)}")
            raise

    async def list_by_field(
        self, field_name: str, field_value: Any, skip: int = 0, limit: int = 20
    ) -> List[Product_views]:
        """Get list of product_viewss filtered by field"""
        try:
            if not hasattr(Product_views, field_name):
                raise ValueError(f"Field {field_name} does not exist on Product_views")
            result = await self.db.execute(
                select(Product_views)
                .where(getattr(Product_views, field_name) == field_value)
                .offset(skip)
                .limit(limit)
                .order_by(Product_views.id.desc())
            )
            return result.scalars().all()
        except Exception as e:
            logger.error(f"Error fetching product_viewss by {field_name}: {str(e)}")
            raise