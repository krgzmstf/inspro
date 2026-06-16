"""Dosya yükleme ucu — saha fotoğrafları (base64) → kalıcı dosya + URL."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from ...core.database import get_db
from ...core.security import get_current_user
from ...models.dosya import Dosya
from ...models.user import User
from ...schemas.common import DosyaIstek
from ...services.dosya import data_url_kaydet

router = APIRouter(tags=["dosya"])


@router.post("/yukle")
async def yukle(g: DosyaIstek, u: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    ad, mime, boyut = data_url_kaydet(g.dataUrl, u.id)
    kayit = Dosya(owner_id=u.id, ad=ad, mime=mime, boyut=boyut)
    db.add(kayit)
    await db.commit()
    # /dosyalar statik kök altından sunulur (StaticFiles mount)
    return {"url": f"/dosyalar/{ad}", "id": kayit.id, "boyut": boyut}
