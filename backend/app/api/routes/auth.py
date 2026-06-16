"""Kimlik doğrulama uçları — OTP kayıt/giriş + token yenileme."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ...core.database import get_db
from ...core.security import access_token, get_current_user, refresh_token, token_coz
from ...models.base import simdi
from ...models.user import User
from ...schemas.auth import KodDogrula, KodIstek, TokenYenile
from ...schemas.user import user_dto
from ...services import otp as otp_servis
from ...services.email import kod_maili_gonder

router = APIRouter(prefix="/auth", tags=["kimlik"])


@router.post("/kod-gonder")
async def kod_gonder(g: KodIstek, db: AsyncSession = Depends(get_db)):
    email = g.email.lower().strip()
    var = (await db.execute(select(User).where(User.email == email))).scalar_one_or_none()
    if not g.kayit and not var:
        raise HTTPException(400, "Bu e-posta kayıtlı değil; önce kayıt olun.")
    if g.kayit and var:
        # Zaten kayıtlı — yine de kod gönderir (giriş gibi davranır)
        pass
    kod = await otp_servis.kod_olustur(db, email, g.ad_soyad, g.firma)
    await db.commit()
    try:
        await kod_maili_gonder(email, kod)
    except Exception as e:  # SMTP hatası
        raise HTTPException(500, f"E-posta gönderilemedi: {e}")
    return {"ok": True}


@router.post("/kod-dogrula")
async def kod_dogrula(g: KodDogrula, db: AsyncSession = Depends(get_db)):
    email = g.email.lower().strip()
    rec = await otp_servis.kod_dogrula(db, email, g.kod)
    u = (await db.execute(select(User).where(User.email == email))).scalar_one_or_none()
    if not u:
        u = User(email=email, ad_soyad=rec.ad_soyad, firma=rec.firma)
        db.add(u)
    u.son_giris = simdi()
    await db.delete(rec)
    await db.commit()
    await db.refresh(u)
    return {
        "access_token": access_token(u.id),
        "refresh_token": refresh_token(u.id),
        "user": user_dto(u),
    }


@router.post("/token-yenile")
async def token_yenile(g: TokenYenile, db: AsyncSession = Depends(get_db)):
    uid = token_coz(g.refresh_token, "refresh")
    u = await db.get(User, uid)
    if not u or not u.aktif:
        raise HTTPException(401, "Kullanıcı bulunamadı.")
    return {"access_token": access_token(u.id)}


@router.get("/ben")
async def ben(u: User = Depends(get_current_user)):
    return user_dto(u)
