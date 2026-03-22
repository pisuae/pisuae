from core.database import Base
from sqlalchemy import Boolean, Column, DateTime, Integer, String


class User_preferences(Base):
    __tablename__ = "user_preferences"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, index=True, autoincrement=True, nullable=False)
    user_id = Column(String, nullable=False)
    display_name = Column(String, nullable=True)
    theme = Column(String, nullable=True)
    language = Column(String, nullable=True)
    notifications_enabled = Column(Boolean, nullable=True)
    newsletter_subscribed = Column(Boolean, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=True)
    updated_at = Column(DateTime(timezone=True), nullable=True)