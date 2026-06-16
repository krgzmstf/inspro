"""Kimlik doğrulama istek/yanıt şemaları."""
from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, EmailStr


# ── Eski saf-OTP (geriye uyumluluk) ──
class KodIstek(BaseModel):
    email: EmailStr
    kayit: bool = False
    ad_soyad: str = ""
    firma: str = ""


class KodDogrula(BaseModel):
    email: EmailStr
    kod: str


# ── Yeni: parola + 2 adımlı doğrulama ──
class KayitBasla(BaseModel):
    email: EmailStr
    sifre: str


class KayitDogrula(BaseModel):
    email: EmailStr
    kod: str


class Giris(BaseModel):
    email: EmailStr
    sifre: str


class GirisDogrula(BaseModel):
    email: EmailStr
    kod: str          # e-posta kodu VEYA Google Authenticator kodu


class ProfilTamamla(BaseModel):
    ad: str
    soyad: str
    telefon: str = ""
    dogum_tarihi: str = ""
    meslek: str = ""
    sirket_mi: bool = False
    sirket_adi: str = ""
    vergi_dairesi: str = ""
    vergi_no: str = ""


class IkiAdimYontem(BaseModel):
    yontem: str       # "email" | "totp"


class TotpAktif(BaseModel):
    kod: str


class TokenYenile(BaseModel):
    refresh_token: str


class YerelGiris(BaseModel):
    sifre: str
