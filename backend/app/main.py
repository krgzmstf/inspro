"""
insPRO API — Kendi backend'imiz (FastAPI + PostgreSQL).

Modüler, kurumsal yapı:
  • core/      → config, database, security, logging, errors, ratelimit
  • models/    → SQLAlchemy modelleri (tablo başına dosya)
  • schemas/   → Pydantic istek/yanıt şemaları
  • services/  → iş mantığı (otp, e-posta, dosya)
  • api/routes → uç noktalar (auth, projeler, muhasebe, moduller, yonetim, ayar, dosya)

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

from .api.routes import auth, ayar, dosya, health, moduller, muhasebe, projeler, yonetim
from .core.config import settings
from .core.errors import hata_yoneticileri_ekle
from .core.logging import setup_logging

setup_logging()
log = logging.getLogger("inspro")


def uretim_guvenlik_kontrolu() -> None:
    """Üretimde (APP_ENV=production) zayıf/güvensiz ayarlarla başlatmayı engeller."""
    if not settings.uretim_mi:
        return
    sorunlar: list[str] = []
    if settings.jwt_secret in ("", "degistir-bu-gizli-anahtari") or len(settings.jwt_secret) < 32:
        sorunlar.append("JWT_SECRET güçlü değil (en az 32 karakter, varsayılan olamaz)")
    if settings.yerel_giris_sifre:
        sorunlar.append("YEREL_GIRIS_SIFRE üretimde AÇIK olamaz (boş bırakın)")
    if "*" in settings.cors_list:
        sorunlar.append("CORS_ORIGINS '*' olamaz; kendi alan adınızı yazın")
    if sorunlar:
        raise RuntimeError("ÜRETİM GÜVENLİK KONTROLÜ BAŞARISIZ → " + " | ".join(sorunlar))


@asynccontextmanager
async def lifespan(app: FastAPI):
    uretim_guvenlik_kontrolu()
    Path(settings.upload_dir).mkdir(parents=True, exist_ok=True)
    log.info("insPRO API başladı — ortam=%s sürüm=%s", settings.app_env, settings.app_version)
    yield
    log.info("insPRO API kapandı.")


def create_app() -> FastAPI:
    # Üretimde API dokümanı (uç yüzeyi) kapalı
    docs = None if settings.uretim_mi else "/docs"
    redoc = None if settings.uretim_mi else "/redoc"

    app = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        lifespan=lifespan,
        docs_url=docs,
        redoc_url=redoc,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_list,
        allow_methods=["*"],
        allow_headers=["*"],
        allow_credentials=False,
    )

    @app.middleware("http")
    async def istek_ve_guvenlik(request: Request, call_next):
        baslangic = time.perf_counter()
        yanit = await call_next(request)
        sure_ms = (time.perf_counter() - baslangic) * 1000
        log.info("%s %s → %s (%.1f ms)", request.method, request.url.path, yanit.status_code, sure_ms)
        # Güvenlik başlıkları
        yanit.headers["X-Content-Type-Options"] = "nosniff"
        yanit.headers["X-Frame-Options"] = "DENY"
        yanit.headers["Referrer-Policy"] = "no-referrer"
        if settings.uretim_mi:
            yanit.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains"
        return yanit

    hata_yoneticileri_ekle(app)

    Path(settings.upload_dir).mkdir(parents=True, exist_ok=True)

    # Route'lar (dosya sunumu artık imzalı /dosya/{ad} ile — statik açık değil)
    for modul in (health, auth, projeler, muhasebe, moduller, yonetim, ayar, dosya):
        app.include_router(modul.router)

    return app


app = create_app()
