"""Genel modül uçları — JSONB blob (metraj, saha, personel, teklif…)."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from ...core.database import get_db
from ...core.security import get_current_user
from ...models.modul import ModulVeri
from ...models.user import User
from ...schemas.common import ModulGovde

router = APIRouter(prefix="/modul", tags=["moduller"])


@router.get("/{modul}")
async def getir(modul: str, u: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    row = await db.get(ModulVeri, (u.id, modul))
    return {"veri": row.veri if row else []}


@router.put("/{modul}")
async def yaz(modul: str, govde: ModulGovde, u: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    row = await db.get(ModulVeri, (u.id, modul))
    if row:
        row.veri = govde.veri
    else:
        db.add(ModulVeri(owner_id=u.id, modul=modul, veri=govde.veri))
    await db.commit()
    return {"ok": True}
