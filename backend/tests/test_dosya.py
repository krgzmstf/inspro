"""Dosya servisi birim testleri."""
import base64

import pytest
from fastapi import HTTPException

from app.core.config import settings
from app.services.dosya import data_url_kaydet


def _data_url(icerik: bytes, mime: str = "image/png") -> str:
    return f"data:{mime};base64," + base64.b64encode(icerik).decode()


def test_gecerli_dosya_kaydedilir(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "upload_dir", str(tmp_path))
    ad, mime, boyut = data_url_kaydet(_data_url(b"merhaba"), owner_id="abc123")
    assert ad.endswith(".png")
    assert mime == "image/png"
    assert boyut == 7
    assert (tmp_path / ad).read_bytes() == b"merhaba"


def test_gecersiz_data_url_hata(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "upload_dir", str(tmp_path))
    with pytest.raises(HTTPException) as e:
        data_url_kaydet("dosya-degil", owner_id="abc")
    assert e.value.status_code == 400


def test_desteklenmeyen_tur_hata(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "upload_dir", str(tmp_path))
    with pytest.raises(HTTPException) as e:
        data_url_kaydet(_data_url(b"x", mime="application/zip"), owner_id="abc")
    assert e.value.status_code == 415


def test_buyuk_dosya_reddedilir(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "upload_dir", str(tmp_path))
    monkeypatch.setattr(settings, "max_upload_mb", 1)
    buyuk = b"0" * (2 * 1024 * 1024)
    with pytest.raises(HTTPException) as e:
        data_url_kaydet(_data_url(buyuk), owner_id="abc")
    assert e.value.status_code == 413
