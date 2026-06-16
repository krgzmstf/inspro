"""Basit bellek-içi hız sınırlayıcı (IP başına deneme limiti).

Tek örnekli (single instance) çalışma için yeterli. Çok örnekli/üretimde
Redis tabanlı bir sınırlayıcıya geçilebilir.
"""
from __future__ import annotations

import time
from collections import defaultdict

from fastapi import HTTPException, Request

_kayit: dict[str, list[float]] = defaultdict(list)


def istemci_ip(request: Request) -> str:
    # Uvicorn proxy-headers ile request.client zaten X-Forwarded-For'u yansıtır.
    return request.client.host if request.client else "bilinmeyen"


def limit_uygula(anahtar: str, limit: int, pencere_sn: int) -> None:
    """anahtar için pencere içinde limit aşıldıysa 429 atar."""
    now = time.time()
    kes = now - pencere_sn
    q = _kayit[anahtar]
    while q and q[0] < kes:
        q.pop(0)
    if len(q) >= limit:
        raise HTTPException(429, "Çok fazla deneme. Lütfen biraz bekleyin.")
    q.append(now)
