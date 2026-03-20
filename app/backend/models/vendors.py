from core.database import Base
from sqlalchemy import Column, DateTime, Float, Integer, String


class Vendors(Base):
    __tablename__ = "vendors"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, index=True, autoincrement=True, nullable=False)
    user_id = Column(String, nullable=False)
    business_name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    commission_rate = Column(Float, nullable=False)
    status = Column(String, nullable=False)
    total_sales = Column(Float, nullable=True)
    total_earnings = Column(Float, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=True)