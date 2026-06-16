"""Kimlik doğrulama — JWT (access + refresh) + bağımlılıklar."""
from __future__ import annotations

import base64
import datetime as dt
import hashlib
import hmac
import secrets as _secrets
import struct
import time
from urllib.parse import quote

from fastapi import Depends, Header, HTTPException
from jose import JWTError, jwt
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.base import simdi
from ..models.user import User
from .config import settings
from .database import get_db


def _token(sub: str, tip: str, sure: dt.timedelta) -> str:
    payload = {"sub": sub, "tip": tip, "iat": simdi(), "exp": simdi() + sure}
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_alg)


def access_token(uid: str) -> str:
    return _token(uid, "access", dt.timedelta(minutes=settings.access_token_dakika))


def refresh_token(uid: str) -> str:
    return _token(uid, "refresh", dt.timedelta(days=settings.refresh_token_gun))


def dosya_token(ad: str) -> str:
    """Bir dosya için imzalı (taklit edilemez) uzun ömürlü erişim jetonu."""
    return _token(ad, "dosya", dt.timedelta(days=365))


def dosya_token_dogrula(token: str, ad: str) -> bool:
    """token bu dosya adına ait ve geçerli mi?"""
    try:
        return token_coz(token, "dosya") == ad
    except HTTPException:
        return False


def token_coz(token: str, tip: str = "access") -> str:
    try:
        p = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_alg])
    except JWTError:
        raise HTTPException(401, "Geçersiz oturum.")
    if p.get("tip") != tip:
        raise HTTPException(401, "Geçersiz token türü.")
    sub = p.get("sub")
    if not sub:
        raise HTTPException(401, "Geçersiz oturum.")
    return sub


async def get_current_user(
    authorization: str = Header(default=""),
    db: AsyncSession = Depends(get_db),
) -> User:
    if not authorization.startswith("Bearer "):
        raise HTTPException(401, "Oturum yok.")
    uid = token_coz(authorization[7:], "access")
    u = await db.get(User, uid)
    if not u or not u.aktif:
        raise HTTPException(401, "Kullanıcı bulunamadı veya pasif.")
    return u


async def get_admin(u: User = Depends(get_current_user)) -> User:
    if u.rol != "yonetici":
        raise HTTPException(403, "Bu işlem yalnız yönetici içindir.")
    return u


# ── Parola (şifre) — PBKDF2-SHA256, stdlib ────────────────
_PBKDF2_ITER = 200_000


def sifre_hashle(sifre: str) -> str:
    salt = _secrets.token_hex(16)
    dk = hashlib.pbkdf2_hmac("sha256", sifre.encode(), bytes.fromhex(salt), _PBKDF2_ITER)
    return f"pbkdf2_sha256${_PBKDF2_ITER}${salt}${dk.hex()}"


def sifre_dogrula(sifre: str, kayit: str | None) -> bool:
    if not kayit:
        return False
    try:
        _algo, iters, salt, h = kayit.split("$")
        dk = hashlib.pbkdf2_hmac("sha256", sifre.encode(), bytes.fromhex(salt), int(iters))
        return _secrets.compare_digest(dk.hex(), h)
    except Exception:
        return False


# ── TOTP (Google Authenticator) — RFC 6238, stdlib ────────
def totp_secret_uret() -> str:
    return base64.b32encode(_secrets.token_bytes(20)).decode().rstrip("=")


def _totp_at(key: bytes, sayac: int) -> str:
    h = hmac.new(key, struct.pack(">Q", sayac), hashlib.sha1).digest()
    o = h[-1] & 0x0F
    kod = (struct.unpack(">I", h[o : o + 4])[0] & 0x7FFFFFFF) % 1_000_000
    return f"{kod:06d}"


def totp_dogrula(secret: str, kod: str, pencere: int = 1) -> bool:
    if not secret or not kod:
        return False
    try:
        key = base64.b32decode(secret + "=" * (-len(secret) % 8), casefold=True)
    except Exception:
        return False
    simdi = int(time.time() // 30)
    kod = kod.strip()
    return any(_secrets.compare_digest(_totp_at(key, simdi + d), kod) for d in range(-pencere, pencere + 1))


def otpauth_uri(secret: str, email: str, issuer: str = "insPRO") -> str:
    return f"otpauth://totp/{quote(issuer)}:{quote(email)}?secret={secret}&issuer={quote(issuer)}&digits=6&period=30"
