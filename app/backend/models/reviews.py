from core.database import Base
from sqlalchemy import Column, DateTime, Integer, String


class Reviews(Base):
    __tablename__ = "reviews"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, index=True, autoincrement=True, nullable=False)
    user_id = Column(String, nullable=False)
    product_id = Column(Integer, nullable=False)
    rating = Column(Integer, nullable=False)
    review_text = Column(String, nullable=True)
    reviewer_name = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=True)