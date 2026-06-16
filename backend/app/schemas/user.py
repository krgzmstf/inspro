"""Kullanıcı şemaları + DTO yardımcıları."""
from __future__ import annotations

from typing import Optional

from pydantic import BaseModel

from ..models.user import User


class UserDTO(BaseModel):
    id: str
    email: str
    ad_soyad: str
    firma: str
    rol: str
    yetkiler: Optional[list[str]] = None


class RolGuncelle(BaseModel):
    id: str
    rol: str
    yetkiler: Optional[list[str]] = None


class KullaniciOlustur(BaseModel):
    email: str
    ad_soyad: str = ""
    firma: str = ""
    rol: str = "sefi"


class KullaniciGuncelle(BaseModel):
    ad_soyad: Optional[str] = None
    firma: Optional[str] = None
    aktif: Optional[bool] = None


def user_dto(u: User) -> dict:
    return {
        "id": u.id,
        "email": u.email,
        "ad_soyad": u.ad_soyad,
        "firma": u.firma,
        "rol": u.rol,
        "yetkiler": u.yetkiler,
        "ad": u.ad,
        "soyad": u.soyad,
        "telefon": u.telefon,
        "dogum_tarihi": u.dogum_tarihi,
        "meslek": u.meslek,
        "sirket_mi": u.sirket_mi,
        "sirket_adi": u.sirket_adi,
        "vergi_dairesi": u.vergi_dairesi,
        "vergi_no": u.vergi_no,
        "profil_tamam": u.profil_tamam,
        "iki_adim_yontem": u.iki_adim_yontem,
    }


def user_dto_detayli(u: User) -> dict:
    return {
        **user_dto(u),
        "aktif": u.aktif,
        "created_at": u.created_at.isoformat() if u.created_at else None,
        "son_giris": u.son_giris.isoformat() if u.son_giris else None,
    }
