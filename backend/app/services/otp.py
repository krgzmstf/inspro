"""OTP üretme/doğrulama — rate-limit ve deneme kilidi ile."""
from __future__ import annotations

import datetime as dt
import secrets

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.config import settings
from ..models.base import simdi
from ..models.otp import OtpKod


def _kod_uret() -> str:
    return f"{secrets.randbelow(1_000_000):06d}"


async def kod_olustur(db: AsyncSession, email: str, ad_soyad: str, firma: str) -> str:
    """Yeni kod üretir; çok sık istenirse 429 atar. db.commit çağrı yerinde yapılır."""
    now = simdi()
    rec = await db.get(OtpKod, email)
    if rec and rec.olusturma and (now - rec.olusturma).total_seconds() < settings.otp_limit_saniye:
        kalan = int(settings.otp_limit_saniye - (now - rec.olusturma).total_seconds())
        raise HTTPException(429, f"Çok sık kod istediniz. {kalan} sn sonra tekrar deneyin.")

    kod = _kod_uret()
    son = now + dt.timedelta(minutes=settings.otp_gecerlilik_dk)
    if rec:
        rec.kod, rec.son, rec.olusturma, rec.deneme = kod, son, now, 0
        rec.ad_soyad, rec.firma = ad_soyad, firma
    else:
        db.add(OtpKod(email=email, kod=kod, son=son, olusturma=now, deneme=0,
                      ad_soyad=ad_soyad, firma=firma))
    return kod


async def kod_dogrula(db: AsyncSession, email: str, kod: str) -> OtpKod:
    """Kodu doğrular; başarısızsa uygun HTTP hatası atar, başarılıysa kaydı döner."""
    rec = await db.get(OtpKod, email)
    if not rec:
        raise HTTPException(400, "Önce kod isteyin.")
    if rec.son < simdi():
        raise HTTPException(400, "Kod süresi doldu. Tekrar kod isteyin.")
    if rec.deneme >= settings.otp_max_deneme:
        raise HTTPException(429, "Çok fazla yanlış deneme. Yeni kod isteyin.")
    if not secrets.compare_digest(rec.kod, kod.strip()):
        rec.deneme += 1
        await db.commit()
        raise HTTPException(400, "Kod hatalı.")
    return rec
