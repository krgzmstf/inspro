"""Genel modül verisi (metraj, saha, personel, teklif… JSONB blob)."""
from __future__ import annotations

from typing import Any

from sqlalchemy import ForeignKey, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base, ZamanDamgasi


class ModulVeri(Base, ZamanDamgasi):
    __tablename__ = "modul_veri"

    owner_id: Mapped[str] = mapped_column(
        String, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    modul: Mapped[str] = mapped_column(String, primary_key=True)
    veri: Mapped[Any] = mapped_column(JSONB, default=list)
