"""Yönetim uçları — kullanıcı + rol yönetimi (yalnız yönetici)."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ...core.config import settings
from ...core.database import get_db
from ...core.security import get_admin
from ...models.accounting import Accounting
from ...models.dosya import Dosya
from ...models.modul import ModulVeri
from ...models.project import Project
from ...models.user import User
from ...schemas.user import (
    KullaniciGuncelle,
    KullaniciOlustur,
    RolGuncelle,
    user_dto_detayli,
)

router = APIRouter(prefix="/yonetim", tags=["yonetim"])

GECERLI_ROLLER = {"yonetici", "sefi", "taseron", "muhasebeci"}

# Veri yönetimi: tip → (model, başlık alanını üreten fonksiyon)
VERI_TIPLERI = {"projeler": Project, "muhasebe": Accounting, "modul": ModulVeri, "dosyalar": Dosya}


@router.get("/ozet")
async def ozet(u: User = Depends(get_admin), db: AsyncSession = Depends(get_db)):
    """Sistem paneli için görsel özet (sayılar, rol dağılımı, son kullanıcılar)."""

    async def say(model) -> int:
        return (await db.execute(select(func.count()).select_from(model))).scalar_one()

    # Rol dağılımı
    rol_satir = (await db.execute(select(User.rol, func.count()).group_by(User.rol))).all()
    rol_dagilimi = {r: a for r, a in rol_satir}
    for r in GECERLI_ROLLER:
        rol_dagilimi.setdefault(r, 0)

    # Yüklenen dosya toplam boyutu (bayt)
    toplam_boyut = (await db.execute(select(func.coalesce(func.sum(Dosya.boyut), 0)))).scalar_one()

    # Son 5 kullanıcı
    son = (await db.execute(select(User).order_by(User.created_at.desc()).limit(5))).scalars().all()

    return {
        "surum": settings.app_version,
        "ortam": settings.app_env,
        "sayilar": {
            "kullanici": await say(User),
            "proje": await say(Project),
            "muhasebe": await say(Accounting),
            "modul": await say(ModulVeri),
            "dosya": await say(Dosya),
        },
        "dosya_boyut_bayt": int(toplam_boyut),
        "rol_dagilimi": rol_dagilimi,
        "son_kullanicilar": [user_dto_detayli(k) for k in son],
    }


@router.get("/kullanicilar")
async def kullanicilar(u: User = Depends(get_admin), db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(User).order_by(User.created_at))).scalars().all()
    return {"users": [user_dto_detayli(r) for r in rows]}


@router.post("/kullanicilar")
async def rol_ata(g: RolGuncelle, u: User = Depends(get_admin), db: AsyncSession = Depends(get_db)):
    if g.rol not in GECERLI_ROLLER:
        raise HTTPException(400, "Geçersiz rol.")
    hedef = await db.get(User, g.id)
    if not hedef:
        raise HTTPException(404, "Kullanıcı bulunamadı.")
    hedef.rol = g.rol
    if g.yetkiler is not None:
        hedef.yetkiler = g.yetkiler
    await db.commit()
    return {"ok": True}


# ── Kullanıcı işlemleri ───────────────────────────────────
@router.post("/kullanici-olustur")
async def kullanici_olustur(g: KullaniciOlustur, u: User = Depends(get_admin), db: AsyncSession = Depends(get_db)):
    email = g.email.lower().strip()
    if not email or "@" not in email:
        raise HTTPException(400, "Geçerli bir e-posta girin.")
    if g.rol not in GECERLI_ROLLER:
        raise HTTPException(400, "Geçersiz rol.")
    var = (await db.execute(select(User).where(User.email == email))).scalar_one_or_none()
    if var:
        raise HTTPException(409, "Bu e-posta zaten kayıtlı.")
    yeni = User(email=email, ad_soyad=g.ad_soyad, firma=g.firma, rol=g.rol)
    db.add(yeni)
    await db.commit()
    await db.refresh(yeni)
    return user_dto_detayli(yeni)


@router.patch("/kullanicilar/{uid}")
async def kullanici_guncelle(uid: str, g: KullaniciGuncelle, u: User = Depends(get_admin), db: AsyncSession = Depends(get_db)):
    hedef = await db.get(User, uid)
    if not hedef:
        raise HTTPException(404, "Kullanıcı bulunamadı.")
    if g.ad_soyad is not None:
        hedef.ad_soyad = g.ad_soyad
    if g.firma is not None:
        hedef.firma = g.firma
    if g.aktif is not None:
        if hedef.id == u.id and not g.aktif:
            raise HTTPException(400, "Kendi hesabınızı pasifleştiremezsiniz.")
        hedef.aktif = g.aktif
    await db.commit()
    return user_dto_detayli(hedef)


@router.delete("/kullanicilar/{uid}")
async def kullanici_sil(uid: str, u: User = Depends(get_admin), db: AsyncSession = Depends(get_db)):
    if uid == u.id:
        raise HTTPException(400, "Kendi hesabınızı silemezsiniz.")
    hedef = await db.get(User, uid)
    if hedef:
        await db.delete(hedef)
        await db.commit()
    return {"ok": True}


# ── Veri yönetimi (tüm tablolar) ──────────────────────────
def _ozet_satir(tip: str, row) -> dict:
    """Listede gösterilecek kısa özet."""
    if tip == "dosyalar":
        return {"id": row.id, "owner_id": row.owner_id, "baslik": row.ad,
                "ek": f"{row.mime} · {row.boyut} B", "created_at": row.created_at.isoformat() if row.created_at else None}
    if tip == "modul":
        adet = len(row.veri) if isinstance(row.veri, list) else 0
        return {"id": f"{row.owner_id}:{row.modul}", "owner_id": row.owner_id,
                "baslik": row.modul, "ek": f"{adet} kayıt"}
    # projeler / muhasebe → JSONB veri
    veri = row.veri if isinstance(row.veri, dict) else {}
    baslik = veri.get("ad") or veri.get("baslik") or veri.get("aciklama") or row.id
    ek = ""
    if tip == "muhasebe":
        ek = f"{veri.get('tip', '')} · {veri.get('tutar', '')}".strip(" ·")
    return {"id": row.id, "owner_id": row.owner_id, "baslik": str(baslik), "ek": ek,
            "created_at": row.created_at.isoformat() if getattr(row, "created_at", None) else None}


@router.get("/veri/{tip}")
async def veri_listele(tip: str, u: User = Depends(get_admin), db: AsyncSession = Depends(get_db)):
    model = VERI_TIPLERI.get(tip)
    if not model:
        raise HTTPException(404, "Bilinmeyen veri tipi.")
    rows = (await db.execute(select(model))).scalars().all()
    return {"tip": tip, "satirlar": [_ozet_satir(tip, r) for r in rows]}


@router.get("/veri/{tip}/{kayit_id}")
async def veri_detay(tip: str, kayit_id: str, u: User = Depends(get_admin), db: AsyncSession = Depends(get_db)):
    model = VERI_TIPLERI.get(tip)
    if not model:
        raise HTTPException(404, "Bilinmeyen veri tipi.")
    if tip == "modul":
        owner, _, modul = kayit_id.partition(":")
        row = await db.get(ModulVeri, (owner, modul))
    else:
        row = await db.get(model, kayit_id)
    if not row:
        raise HTTPException(404, "Kayıt bulunamadı.")
    veri = getattr(row, "veri", None)
    return {"id": kayit_id, "owner_id": row.owner_id, "veri": veri}


@router.delete("/veri/{tip}/{kayit_id}")
async def veri_sil(tip: str, kayit_id: str, u: User = Depends(get_admin), db: AsyncSession = Depends(get_db)):
    model = VERI_TIPLERI.get(tip)
    if not model:
        raise HTTPException(404, "Bilinmeyen veri tipi.")
    if tip == "modul":
        owner, _, modul = kayit_id.partition(":")
        row = await db.get(ModulVeri, (owner, modul))
    else:
        row = await db.get(model, kayit_id)
    if row:
        await db.delete(row)
        await db.commit()
    return {"ok": True}
