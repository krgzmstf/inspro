"""Merkezi yapılandırma — tüm ayarlar .env'den okunur (pydantic-settings)."""
from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore", case_sensitive=False)

    # ── Uygulama ──
    app_name: str = "insPRO API"
    app_env: str = "development"        # development | production
    app_version: str = "1.0.0"
    debug: bool = False

    # ── Veritabanı ──
    database_url: str = "postgresql+asyncpg://inspro:inspro_local@db:5432/inspro"

    # ── JWT ──
    jwt_secret: str = "degistir-bu-gizli-anahtari"
    jwt_alg: str = "HS256"
    access_token_dakika: int = 60 * 24 * 7   # 7 gün
    refresh_token_gun: int = 30

    # ── OTP (e-posta kodu) ──
    otp_gecerlilik_dk: int = 10
    otp_limit_saniye: int = 60          # aynı e-postaya en az 60 sn arayla kod
    otp_max_deneme: int = 5             # üst üste yanlış deneme limiti

    # ── SMTP ──
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = "İNŞPRO <yazeinspro@gmail.com>"

    # ── CORS ──
    cors_origins: str = "*"             # virgülle ayrılmış liste veya *

    # ── Dosya yükleme ──
    upload_dir: str = "/data/yuklemeler"
    max_upload_mb: int = 8

    @property
    def cors_list(self) -> list[str]:
        if not self.cors_origins or self.cors_origins.strip() == "*":
            return ["*"]
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def uretim_mi(self) -> bool:
        return self.app_env.lower() == "production"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
