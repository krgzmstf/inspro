"""Tek kullanımlık e-posta kodu (OTP) modeli."""
from __future__ import annotations

import datetime as dt
from typing import Optional

from sqlalchemy import DateTime, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base


class OtpKod(Base):
    __tablename__ = "otp_kodlar"

    email: Mapped[str] = mapped_column(String, primary_key=True)
    kod: Mapped[str] = mapped_column(String)
    ad_soyad: Mapped[str] = mapped_column(String, default="")
    firma: Mapped[str] = mapped_column(String, default="")
    sifre_hash: Mapped[Optional[str]] = mapped_column(String, nullable=True)  # bekleyen kayıt parolası
    amac: Mapped[str] = mapped_column(String, default="giris")  # "kayit" | "giris"
    deneme: Mapped[int] = mapped_column(Integer, default=0)
    olusturma: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True))
    son: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True))
