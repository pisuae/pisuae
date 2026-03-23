from core.database import Base
from sqlalchemy import Column, DateTime, Float, Integer, String


class Orders(Base):
    __tablename__ = "orders"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, index=True, autoincrement=True, nullable=False)
    user_id = Column(String, nullable=False)
    product_id = Column(Integer, nullable=False)
    seller_id = Column(String, nullable=True)
    quantity = Column(Integer, nullable=False)
    total_price = Column(Float, nullable=False)
    status = Column(String, nullable=False)
    payment_method = Column(String, nullable=True)
    stripe_session_id = Column(String, nullable=True)
    shipping_address = Column(String, nullable=True)
    phone_number = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=True)