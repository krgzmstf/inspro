"""Tutarlı hata yönetimi — tüm hatalar {detail: "..."} biçiminde döner."""
from __future__ import annotations

import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

log = logging.getLogger("inspro")


def hata_yoneticileri_ekle(app: FastAPI) -> None:
    @app.exception_handler(StarletteHTTPException)
    async def http_hata(request: Request, exc: StarletteHTTPException):
        return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})

    @app.exception_handler(RequestValidationError)
    async def dogrulama_hata(request: Request, exc: RequestValidationError):
        ilk = exc.errors()[0] if exc.errors() else {}
        mesaj = ilk.get("msg", "Geçersiz veri.")
        return JSONResponse(status_code=422, content={"detail": mesaj, "alanlar": exc.errors()})

    @app.exception_handler(Exception)
    async def beklenmeyen_hata(request: Request, exc: Exception):
        log.exception("Beklenmeyen hata: %s %s", request.method, request.url.path)
        return JSONResponse(status_code=500, content={"detail": "Sunucu hatası."})
