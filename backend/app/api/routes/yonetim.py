"""Yönetim uçları — kullanıcı + rol yönetimi (yalnız yönetici)."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ...core.database import get_db
from ...core.security import get_admin
from ...models.user import User
from ...schemas.user import RolGuncelle, user_dto_detayli

router = APIRouter(prefix="/yonetim", tags=["yonetim"])

GECERLI_ROLLER = {"yonetici", "sefi", "taseron", "muhasebeci"}


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
