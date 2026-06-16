"""
insPRO API — Kendi backend'imiz (FastAPI + PostgreSQL).

Modüler, kurumsal yapı:
  • core/      → config, database, security, logging, errors
  • models/    → SQLAlchemy modelleri (tablo başına dosya)
  • schemas/   → Pydantic istek/yanıt şemaları
  • services/  → iş mantığı (otp, e-posta, dosya)
  • api/routes → uç noktalar (auth, projeler, muhasebe, moduller, yonetim, dosya)

Şema Alembic ile yönetilir. Tüm veri kendi PostgreSQL'imizde; Docker'da
çalışır, istenen sunucuya deploy edilir.
"""
from __future__ import annotations

import logging
import time
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .api.routes import auth, ayar, dosya, health, moduller, muhasebe, projeler, yonetim
from .core.config import settings
from .core.errors import hata_yoneticileri_ekle
from .core.logging import setup_logging

setup_logging()
log = logging.getLogger("inspro")


@asynccontextmanager
async def lifespan(app: FastAPI):
    Path(settings.upload_dir).mkdir(parents=True, exist_ok=True)
    log.info("insPRO API başladı — ortam=%s sürüm=%s", settings.app_env, settings.app_version)
    yield
    log.info("insPRO API kapandı.")


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        lifespan=lifespan,
        docs_url="/docs",
        redoc_url="/redoc",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_list,
        allow_methods=["*"],
        allow_headers=["*"],
        allow_credentials=False,
    )

    @app.middleware("http")
    async def istek_logla(request: Request, call_next):
        baslangic = time.perf_counter()
        yanit = await call_next(request)
        sure_ms = (time.perf_counter() - baslangic) * 1000
        log.info("%s %s → %s (%.1f ms)", request.method, request.url.path, yanit.status_code, sure_ms)
        return yanit

    hata_yoneticileri_ekle(app)

    # Yüklenen dosyaları statik sun
    Path(settings.upload_dir).mkdir(parents=True, exist_ok=True)
    app.mount("/dosyalar", StaticFiles(directory=settings.upload_dir), name="dosyalar")

    # Route'lar
    for modul in (health, auth, projeler, muhasebe, moduller, yonetim, ayar, dosya):
        app.include_router(modul.router)

    return app


app = create_app()
