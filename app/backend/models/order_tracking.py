from core.database import Base
from sqlalchemy import Column, DateTime, Integer, String


class Order_tracking(Base):
    __tablename__ = "order_tracking"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, index=True, autoincrement=True, nullable=False)
    user_id = Column(String, nullable=False)
    order_id = Column(Integer, nullable=False)
    status = Column(String, nullable=False)
    title = Column(String, nullable=False)
    description = Column(String, nullable=True)
    timestamp = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=True)