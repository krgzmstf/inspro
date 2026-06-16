"""Yüklenen dosya (saha fotoğrafı vb.) üstverisi."""
from __future__ import annotations

from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base, ZamanDamgasi, yeni_id


class Dosya(Base, ZamanDamgasi):
    __tablename__ = "dosyalar"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=yeni_id)
    owner_id: Mapped[str] = mapped_column(
        String, ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    ad: Mapped[str] = mapped_column(String)        # diskteki benzersiz dosya adı
    mime: Mapped[str] = mapped_column(String)
    boyut: Mapped[int] = mapped_column(Integer)    # bayt
