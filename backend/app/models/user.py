"""Kullanıcı modeli."""
from __future__ import annotations

import datetime as dt
from typing import Any, Optional

from sqlalchemy import Boolean, DateTime, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base, ZamanDamgasi, yeni_id


class User(Base, ZamanDamgasi):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=yeni_id)
    email: Mapped[str] = mapped_column(String, unique=True, index=True)
    ad_soyad: Mapped[str] = mapped_column(String, default="")
    firma: Mapped[str] = mapped_column(String, default="")
    rol: Mapped[str] = mapped_column(String, default="yonetici")
    yetkiler: Mapped[Optional[Any]] = mapped_column(JSONB, nullable=True)
    aktif: Mapped[bool] = mapped_column(Boolean, default=True)
    son_giris: Mapped[Optional[dt.datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
