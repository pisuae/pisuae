from core.database import Base
from sqlalchemy import Column, DateTime, Integer, String


class Credit_scores(Base):
    __tablename__ = "credit_scores"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, index=True, autoincrement=True, nullable=False)
    user_id = Column(String, nullable=False)
    points = Column(Integer, nullable=False)
    total_earned = Column(Integer, nullable=True)
    total_redeemed = Column(Integer, nullable=True)
    tier = Column(String, nullable=True)
    account_status = Column(String, nullable=True)
    last_activity = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=True)