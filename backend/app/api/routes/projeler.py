"""Proje uçları — sahibine özel CRUD."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ...core.database import get_db
from ...core.security import get_current_user
from ...models.base import yeni_id
from ...models.project import Project
from ...models.user import User

router = APIRouter(prefix="/projeler", tags=["projeler"])


@router.get("")
async def listele(u: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(Project).where(Project.owner_id == u.id))).scalars().all()
    return [r.veri for r in rows]


@router.post("")
async def kaydet(veri: dict, u: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    pid = str(veri.get("id") or yeni_id())
    veri["id"] = pid
    row = await db.get(Project, pid)
    if row:
        if row.owner_id != u.id:
            raise HTTPException(403, "Bu proje size ait değil.")
        row.veri = veri
    else:
        db.add(Project(id=pid, owner_id=u.id, veri=veri))
    await db.commit()
    return veri


@router.delete("/{pid}")
async def sil(pid: str, u: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    row = await db.get(Project, pid)
    if row and row.owner_id == u.id:
        await db.delete(row)
        await db.commit()
    return {"ok": True}
