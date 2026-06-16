"""ORM temel sınıfı + ortak yardımcılar."""
from __future__ import annotations

import datetime as dt
import uuid

from sqlalchemy import DateTime
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


def yeni_id() -> str:
    return str(uuid.uuid4())


def simdi() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc)


class Base(DeclarativeBase):
    pass


class ZamanDamgasi:
    """created_at / updated_at sütunlarını ekleyen mixin."""

    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=simdi)
    updated_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), default=simdi, onupdate=simdi
    )
