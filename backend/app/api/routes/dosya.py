"""Dosya yükleme + korumalı sunum.

Yükleme: base64 data URL → diske yazılır, imzalı (signed) bir URL döner.
Sunum: /dosya/{ad}?t=<imza> — imza geçerli değilse erişim yok. Böylece
yüklenen dosyalar herkese açık değildir (tahmin/erişim engellenir).
"""
from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession

from ...core.config import settings
from ...core.database import get_db
from ...core.security import dosya_token, dosya_token_dogrula, get_current_user
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
    # İmzalı URL: dosyaya erişim ancak bu jeton ile mümkün
    return {"url": f"/dosya/{ad}?t={dosya_token(ad)}", "id": kayit.id, "boyut": boyut}


@router.get("/dosya/{ad}")
async def dosya_getir(ad: str, t: str = Query(default="")):
    if "/" in ad or "\\" in ad or ".." in ad:
        raise HTTPException(400, "Geçersiz dosya adı.")
    if not dosya_token_dogrula(t, ad):
        raise HTTPException(403, "Bu dosyaya erişim izniniz yok.")
    yol = Path(settings.upload_dir) / ad
    if not yol.is_file():
        raise HTTPException(404, "Dosya bulunamadı.")
    return FileResponse(str(yol))
