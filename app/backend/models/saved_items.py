from core.database import Base
from sqlalchemy import Column, DateTime, Integer, String


class Saved_items(Base):
    __tablename__ = "saved_items"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, index=True, autoincrement=True, nullable=False)
    user_id = Column(String, nullable=False)
    product_id = Column(Integer, nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=True)