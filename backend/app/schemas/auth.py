"""Kimlik doğrulama istek/yanıt şemaları."""
from __future__ import annotations

from pydantic import BaseModel, EmailStr


class KodIstek(BaseModel):
    email: EmailStr
    kayit: bool = False
    ad_soyad: str = ""
    firma: str = ""


class KodDogrula(BaseModel):
    email: EmailStr
    kod: str


class TokenYenile(BaseModel):
    refresh_token: str


class TokenYanit(BaseModel):
    access_token: str
    refresh_token: str
    user: dict
