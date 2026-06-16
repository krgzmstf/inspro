"""Genel ayar (anahtar→değer) — menü, site içeriği vb. kodsuz yönetim için."""
from __future__ import annotations

from typing import Any

from sqlalchemy import String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base, ZamanDamgasi


class Ayar(Base, ZamanDamgasi):
    __tablename__ = "ayarlar"

    anahtar: Mapped[str] = mapped_column(String, primary_key=True)
    deger: Mapped[Any] = mapped_column(JSONB)
