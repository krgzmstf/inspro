"""Proje modeli (içerik JSONB)."""
from __future__ import annotations

from typing import Any

from sqlalchemy import ForeignKey, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base, ZamanDamgasi, yeni_id


class Project(Base, ZamanDamgasi):
    __tablename__ = "projects"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=yeni_id)
    owner_id: Mapped[str] = mapped_column(
        String, ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    veri: Mapped[Any] = mapped_column(JSONB)
