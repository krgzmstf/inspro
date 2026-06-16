"""Yapısal loglama kurulumu."""
from __future__ import annotations

import logging
import sys

from .config import settings


def setup_logging() -> None:
    seviye = logging.DEBUG if settings.debug else logging.INFO
    bicim = "%(asctime)s | %(levelname)-7s | %(name)s | %(message)s"
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(logging.Formatter(bicim, datefmt="%Y-%m-%d %H:%M:%S"))

    kok = logging.getLogger()
    kok.handlers.clear()
    kok.addHandler(handler)
    kok.setLevel(seviye)

    # Gürültülü kütüphaneleri sustur
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)


log = logging.getLogger("inspro")
