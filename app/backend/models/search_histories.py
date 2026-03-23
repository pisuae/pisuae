from core.database import Base
from sqlalchemy import Column, DateTime, Integer, String


class Search_histories(Base):
    __tablename__ = "search_histories"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, index=True, autoincrement=True, nullable=False)
    user_id = Column(String, nullable=False)
    query = Column(String, nullable=False)
    searched_at = Column(DateTime(timezone=True), nullable=False)