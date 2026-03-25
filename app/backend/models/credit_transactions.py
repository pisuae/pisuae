from core.database import Base
from sqlalchemy import Column, DateTime, Integer, String


class Credit_transactions(Base):
    __tablename__ = "credit_transactions"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, index=True, autoincrement=True, nullable=False)
    user_id = Column(String, nullable=False)
    points = Column(Integer, nullable=False)
    type = Column(String, nullable=False)
    description = Column(String, nullable=True)
    reference_id = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=True)