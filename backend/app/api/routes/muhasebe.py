"""Muhasebe uçları — sahibine özel CRUD."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ...core.database import get_db
from ...core.security import get_current_user
from ...models.accounting import Accounting
from ...models.base import yeni_id
from ...models.user import User

router = APIRouter(prefix="/muhasebe", tags=["muhasebe"])


@router.get("")
async def listele(u: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(Accounting).where(Accounting.owner_id == u.id))).scalars().all()
    return [r.veri for r in rows]


@router.post("")
async def kaydet(veri: dict, u: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    kid = str(veri.get("id") or yeni_id())
    veri["id"] = kid
    row = await db.get(Accounting, kid)
    if row:
        if row.owner_id != u.id:
            raise HTTPException(403, "Bu kayıt size ait değil.")
        row.veri = veri
    else:
        db.add(Accounting(id=kid, owner_id=u.id, veri=veri))
    await db.commit()
    return veri


@router.delete("/{kid}")
async def sil(kid: str, u: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    row = await db.get(Accounting, kid)
    if row and row.owner_id == u.id:
        await db.delete(row)
        await db.commit()
    return {"ok": True}
