"""Dosya/fotoğraf kaydetme servisi (base64 data URL → diskte dosya)."""
from __future__ import annotations

import base64
import re
from pathlib import Path

from fastapi import HTTPException

from ..core.config import settings
from ..models.base import yeni_id

_DATA_URL = re.compile(r"^data:([^;,]+);base64,(.+)$", re.DOTALL)
_UZANTI = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "application/pdf": "pdf",
}


def upload_dizini() -> Path:
    p = Path(settings.upload_dir)
    p.mkdir(parents=True, exist_ok=True)
    return p


def data_url_kaydet(data_url: str, owner_id: str) -> tuple[str, str, int]:
    """data:...;base64,... çözer, diske yazar. (dosya_adı, mime, boyut) döner."""
    m = _DATA_URL.match(data_url.strip())
    if not m:
        raise HTTPException(400, "Geçersiz dosya verisi (data URL bekleniyor).")
    mime, b64 = m.group(1).lower(), m.group(2)
    try:
        ham = base64.b64decode(b64, validate=True)
    except Exception:
        raise HTTPException(400, "Dosya verisi çözülemedi.")

    sinir = settings.max_upload_mb * 1024 * 1024
    if len(ham) > sinir:
        raise HTTPException(413, f"Dosya çok büyük (en fazla {settings.max_upload_mb} MB).")

    uzanti = _UZANTI.get(mime)
    if not uzanti:
        raise HTTPException(415, "Desteklenmeyen dosya türü.")

    ad = f"{owner_id[:8]}_{yeni_id()}.{uzanti}"
    (upload_dizini() / ad).write_bytes(ham)
    return ad, mime, len(ham)
