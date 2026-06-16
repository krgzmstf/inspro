"""Sağlık ve hazırlık uçları."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from ...core.config import settings
from ...core.database import get_db

router = APIRouter(tags=["sistem"])


@router.get("/health")
async def health():
    return {"ok": True, "servis": settings.app_name, "surum": settings.app_version}


@router.get("/health/db")
async def health_db(db: AsyncSession = Depends(get_db)):
    await db.execute(text("SELECT 1"))
    return {"ok": True, "db": "bağlı"}
