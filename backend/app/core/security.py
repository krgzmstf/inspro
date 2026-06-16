"""Kimlik doğrulama — JWT (access + refresh) + bağımlılıklar."""
from __future__ import annotations

import datetime as dt

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
