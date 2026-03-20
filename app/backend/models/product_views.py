from core.database import Base
from sqlalchemy import Column, DateTime, Integer, String


class Product_views(Base):
    __tablename__ = "product_views"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, index=True, autoincrement=True, nullable=False)
    product_id = Column(Integer, nullable=False)
    seller_id = Column(String, nullable=False)
    viewer_ip = Column(String, nullable=True)
    viewed_at = Column(DateTime(timezone=True), nullable=False)