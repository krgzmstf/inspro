#!/bin/sh
set -e

echo "→ Veritabanı migrasyonları uygulanıyor (alembic upgrade head)..."
alembic upgrade head

echo "→ insPRO API başlatılıyor..."
exec uvicorn app.main:app --host 0.0.0.0 --port 4400 --proxy-headers --forwarded-allow-ips="*"
