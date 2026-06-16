"""Genel ayar uçları — menü ve site içeriği (kodsuz yönetim).

Okuma: giriş yapmış herkes (menü/site render için gerekli).
Yazma: yalnız yönetici.
"""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from ...core.database import get_db
from ...core.security import get_admin, get_current_user
from ...models.ayar import Ayar
from ...models.user import User

router = APIRouter(prefix="/ayar", tags=["ayar"])


class AyarGovde(BaseModel):
    deger: Any


@router.get("/{anahtar}")
async def getir(anahtar: str, u: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    row = await db.get(Ayar, anahtar)
    return {"anahtar": anahtar, "deger": row.deger if row else None}


@router.put("/{anahtar}")
async def yaz(anahtar: str, g: AyarGovde, u: User = Depends(get_admin), db: AsyncSession = Depends(get_db)):
    row = await db.get(Ayar, anahtar)
    if row:
        row.deger = g.deger
    else:
        db.add(Ayar(anahtar=anahtar, deger=g.deger))
    await db.commit()
    return {"ok": True}
