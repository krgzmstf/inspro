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
    sifre_hash: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    ad_soyad: Mapped[str] = mapped_column(String, default="")
    firma: Mapped[str] = mapped_column(String, default="")
    rol: Mapped[str] = mapped_column(String, default="yonetici")
    yetkiler: Mapped[Optional[Any]] = mapped_column(JSONB, nullable=True)
    aktif: Mapped[bool] = mapped_column(Boolean, default=True)

    # Profil (kayıt ekranı)
    ad: Mapped[str] = mapped_column(String, default="")
    soyad: Mapped[str] = mapped_column(String, default="")
    telefon: Mapped[str] = mapped_column(String, default="")        # E.164 (+90…)
    dogum_tarihi: Mapped[str] = mapped_column(String, default="")   # ISO (YYYY-MM-DD)
    meslek: Mapped[str] = mapped_column(String, default="")
    sirket_mi: Mapped[bool] = mapped_column(Boolean, default=False)
    sirket_adi: Mapped[str] = mapped_column(String, default="")
    vergi_dairesi: Mapped[str] = mapped_column(String, default="")
    vergi_no: Mapped[str] = mapped_column(String, default="")
    profil_tamam: Mapped[bool] = mapped_column(Boolean, default=False)

    # İki adımlı doğrulama (2FA): "email" (e-posta kodu) veya "totp" (Google Authenticator)
    iki_adim_yontem: Mapped[str] = mapped_column(String, default="email")
    totp_secret: Mapped[Optional[str]] = mapped_column(String, nullable=True)

    son_giris: Mapped[Optional[dt.datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
