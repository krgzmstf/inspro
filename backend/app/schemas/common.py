"""Ortak/jenerik şemalar."""
from __future__ import annotations

from typing import Any

from pydantic import BaseModel


class Onay(BaseModel):
    ok: bool = True


class ModulGovde(BaseModel):
    veri: list[Any] = []


class DosyaIstek(BaseModel):
    dataUrl: str
