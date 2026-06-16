"""Güvenlik sertleştirme testleri."""
import pytest

from app.core import security
from app.core.config import settings
from app.main import uretim_guvenlik_kontrolu


def test_dosya_token_roundtrip():
    t = security.dosya_token("abc.png")
    assert security.dosya_token_dogrula(t, "abc.png") is True
    # Başka dosya adına geçersiz
    assert security.dosya_token_dogrula(t, "baska.png") is False
    # Sahte jeton geçersiz
    assert security.dosya_token_dogrula("sahte-jeton", "abc.png") is False


def test_uretim_guard_zayif_ayarla_durur(monkeypatch):
    monkeypatch.setattr(settings, "app_env", "production")
    monkeypatch.setattr(settings, "jwt_secret", "degistir-bu-gizli-anahtari")
    with pytest.raises(RuntimeError):
        uretim_guvenlik_kontrolu()


def test_uretim_guard_acik_arkakapi_durur(monkeypatch):
    monkeypatch.setattr(settings, "app_env", "production")
    monkeypatch.setattr(settings, "jwt_secret", "x" * 40)
    monkeypatch.setattr(settings, "yerel_giris_sifre", "Yaze.12345")
    monkeypatch.setattr(settings, "cors_origins", "https://a.com")
    with pytest.raises(RuntimeError):
        uretim_guvenlik_kontrolu()


def test_uretim_guard_guclu_ayar_gecer(monkeypatch):
    monkeypatch.setattr(settings, "app_env", "production")
    monkeypatch.setattr(settings, "jwt_secret", "x" * 40)
    monkeypatch.setattr(settings, "yerel_giris_sifre", "")
    monkeypatch.setattr(settings, "cors_origins", "https://a.com")
    uretim_guvenlik_kontrolu()  # hata atmamalı


def test_gelistirmede_guard_pasif(monkeypatch):
    monkeypatch.setattr(settings, "app_env", "development")
    monkeypatch.setattr(settings, "jwt_secret", "degistir-bu-gizli-anahtari")
    uretim_guvenlik_kontrolu()  # dev'de hiç kontrol yapılmaz
