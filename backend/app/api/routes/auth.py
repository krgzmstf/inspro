"""Kimlik doğrulama uçları — parola + 2 adımlı doğrulama (e-posta kodu / TOTP).

Kayıt akışı:  kayit-basla(email,sifre) → e-posta kodu → kayit-dogrula → profil-tamamla
Giriş akışı:  giris(email,sifre) → 2. adım (e-posta kodu VEYA Google Authenticator) → giris-dogrula
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ...core.config import settings
from ...core.database import get_db
from ...core.ratelimit import istemci_ip, limit_uygula
from ...core.security import (
    access_token,
    get_current_user,
    otpauth_uri,
    refresh_token,
    sifre_dogrula,
    sifre_hashle,
    token_coz,
    totp_dogrula,
    totp_secret_uret,
)
from ...models.base import simdi
from ...models.user import User
from ...schemas.auth import (
    Giris,
    GirisDogrula,
    KayitBasla,
    KayitDogrula,
    ProfilTamamla,
    TokenYenile,
    TotpAktif,
    YerelGiris,
)
from ...schemas.user import user_dto
from ...services import otp as otp_servis
from ...services.email import kod_maili_gonder

router = APIRouter(prefix="/auth", tags=["kimlik"])

EN_AZ_SIFRE = 6


async def _kullanici(db: AsyncSession, email: str) -> User | None:
    return (await db.execute(select(User).where(User.email == email))).scalar_one_or_none()


def _token_yaniti(u: User) -> dict:
    return {"access_token": access_token(u.id), "refresh_token": refresh_token(u.id), "user": user_dto(u)}


# ── KAYIT (parola + e-posta kodu doğrulama) ───────────────
@router.post("/kayit-basla")
async def kayit_basla(g: KayitBasla, request: Request, db: AsyncSession = Depends(get_db)):
    limit_uygula(f"kayit:{istemci_ip(request)}", limit=8, pencere_sn=600)
    if len(g.sifre) < EN_AZ_SIFRE:
        raise HTTPException(400, f"Şifre en az {EN_AZ_SIFRE} karakter olmalı.")
    email = g.email.lower().strip()
    mevcut = await _kullanici(db, email)
    if mevcut and mevcut.sifre_hash:
        raise HTTPException(409, "Bu e-posta zaten kayıtlı. Giriş yapın.")
    kod = await otp_servis.kod_olustur(db, email, sifre_hash=sifre_hashle(g.sifre), amac="kayit")
    await db.commit()
    try:
        await kod_maili_gonder(email, kod)
    except Exception as e:
        raise HTTPException(500, f"E-posta gönderilemedi: {e}")
    return {"ok": True}


@router.post("/kayit-dogrula")
async def kayit_dogrula(g: KayitDogrula, request: Request, db: AsyncSession = Depends(get_db)):
    limit_uygula(f"kayit-dogrula:{istemci_ip(request)}", limit=12, pencere_sn=600)
    email = g.email.lower().strip()
    rec = await otp_servis.kod_dogrula(db, email, g.kod)
    if rec.amac != "kayit":
        raise HTTPException(400, "Bu kod kayıt için değil.")
    u = await _kullanici(db, email)
    if u:
        u.sifre_hash = rec.sifre_hash
    else:
        u = User(email=email, sifre_hash=rec.sifre_hash, profil_tamam=False)
        db.add(u)
    u.son_giris = simdi()
    await db.delete(rec)
    await db.commit()
    await db.refresh(u)
    return _token_yaniti(u)


@router.post("/profil-tamamla")
async def profil_tamamla(g: ProfilTamamla, u: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if not g.ad.strip() or not g.soyad.strip():
        raise HTTPException(400, "Ad ve soyad gerekli.")
    if g.telefon and not _telefon_gecerli(g.telefon):
        raise HTTPException(400, "Telefon numarası uluslararası biçimde olmalı (örn. +905321234567).")
    u.ad = g.ad.strip()
    u.soyad = g.soyad.strip()
    u.telefon = g.telefon.strip()
    u.dogum_tarihi = g.dogum_tarihi.strip()
    u.meslek = g.meslek.strip()
    u.sirket_mi = g.sirket_mi
    u.sirket_adi = g.sirket_adi.strip()
    u.vergi_dairesi = g.vergi_dairesi.strip()
    u.vergi_no = g.vergi_no.strip()
    u.ad_soyad = f"{u.ad} {u.soyad}".strip()
    if g.sirket_mi and g.sirket_adi.strip():
        u.firma = g.sirket_adi.strip()
    u.profil_tamam = True
    await db.commit()
    await db.refresh(u)
    return user_dto(u)


def _telefon_gecerli(t: str) -> bool:
    t = t.strip()
    return t.startswith("+") and t[1:].isdigit() and 7 <= len(t[1:]) <= 15


# ── GİRİŞ (parola → 2. adım: e-posta kodu veya TOTP) ──────
@router.post("/giris")
async def giris(g: Giris, request: Request, db: AsyncSession = Depends(get_db)):
    limit_uygula(f"giris:{istemci_ip(request)}", limit=10, pencere_sn=600)
    email = g.email.lower().strip()
    u = await _kullanici(db, email)
    if not u or not u.sifre_hash or not sifre_dogrula(g.sifre, u.sifre_hash):
        raise HTTPException(401, "E-posta veya şifre hatalı.")
    if not u.aktif:
        raise HTTPException(403, "Hesabınız pasif. Yönetici ile görüşün.")
    if u.iki_adim_yontem == "totp" and u.totp_secret:
        return {"asama": "totp", "mesaj": "Google Authenticator kodunu girin."}
    # e-posta kodu
    kod = await otp_servis.kod_olustur(db, email, amac="giris")
    await db.commit()
    try:
        await kod_maili_gonder(email, kod)
    except Exception as e:
        raise HTTPException(500, f"E-posta gönderilemedi: {e}")
    return {"asama": "email", "mesaj": "E-posta adresinize kod gönderildi."}


@router.post("/giris-dogrula")
async def giris_dogrula(g: GirisDogrula, request: Request, db: AsyncSession = Depends(get_db)):
    limit_uygula(f"giris-dogrula:{istemci_ip(request)}", limit=12, pencere_sn=600)
    email = g.email.lower().strip()
    u = await _kullanici(db, email)
    if not u or not u.sifre_hash:
        raise HTTPException(401, "Önce giriş yapın.")
    if u.iki_adim_yontem == "totp" and u.totp_secret:
        if not totp_dogrula(u.totp_secret, g.kod):
            raise HTTPException(400, "Authenticator kodu hatalı.")
    else:
        rec = await otp_servis.kod_dogrula(db, email, g.kod)
        if rec.amac != "giris":
            raise HTTPException(400, "Bu kod giriş için değil.")
        await db.delete(rec)
    u.son_giris = simdi()
    await db.commit()
    await db.refresh(u)
    return _token_yaniti(u)


# ── Google Authenticator (TOTP) kurulum ───────────────────
@router.post("/totp/kur")
async def totp_kur(u: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    secret = totp_secret_uret()
    u.totp_secret = secret  # henüz aktif değil; aktif olması için kod doğrulanmalı
    await db.commit()
    return {"secret": secret, "otpauth": otpauth_uri(secret, u.email)}


@router.post("/totp/aktif")
async def totp_aktiflestir(g: TotpAktif, u: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if not u.totp_secret:
        raise HTTPException(400, "Önce TOTP kurun.")
    if not totp_dogrula(u.totp_secret, g.kod):
        raise HTTPException(400, "Kod hatalı. Authenticator uygulamasındaki kodu girin.")
    u.iki_adim_yontem = "totp"
    await db.commit()
    return {"ok": True, "yontem": "totp"}


@router.post("/totp/kapat")
async def totp_kapat(u: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    u.iki_adim_yontem = "email"
    u.totp_secret = None
    await db.commit()
    return {"ok": True, "yontem": "email"}


# ── Yardımcılar ───────────────────────────────────────────
@router.post("/token-yenile")
async def token_yenile(g: TokenYenile, db: AsyncSession = Depends(get_db)):
    uid = token_coz(g.refresh_token, "refresh")
    u = await db.get(User, uid)
    if not u or not u.aktif:
        raise HTTPException(401, "Kullanıcı bulunamadı.")
    return {"access_token": access_token(u.id)}


@router.post("/yerel-giris")
async def yerel_giris(g: YerelGiris, request: Request, db: AsyncSession = Depends(get_db)):
    """Tek ortak şifreyle hızlı yerel giriş (kod/e-posta beklemeden).

    Yalnız .env'de YEREL_GIRIS_SIFRE tanımlıysa açıktır; üretimde kapalı.
    """
    import secrets as _s

    limit_uygula(f"yerel-giris:{istemci_ip(request)}", limit=8, pencere_sn=600)
    if not settings.yerel_giris_sifre:
        raise HTTPException(404, "Yerel giriş kapalı.")
    if not _s.compare_digest(g.sifre, settings.yerel_giris_sifre):
        raise HTTPException(401, "Şifre hatalı.")
    email = settings.yerel_giris_email.lower().strip()
    u = await _kullanici(db, email)
    if not u:
        u = User(email=email, ad_soyad="Yerel Yönetici", firma="insPRO", rol="yonetici", profil_tamam=True)
        db.add(u)
    u.son_giris = simdi()
    await db.commit()
    await db.refresh(u)
    return _token_yaniti(u)


@router.get("/ben")
async def ben(u: User = Depends(get_current_user)):
    return user_dto(u)
