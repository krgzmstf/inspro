# ── 1. Aşama: bağımlılıklar ──────────────────────────────
FROM python:3.12-slim AS builder

WORKDIR /app
ENV PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1

COPY requirements.txt .
RUN pip install --prefix=/install -r requirements.txt

# ── 2. Aşama: çalışma imajı ──────────────────────────────
FROM python:3.12-slim

WORKDIR /app
ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1

# curl healthcheck için
RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /install /usr/local

COPY app ./app
COPY alembic ./alembic
COPY alembic.ini entrypoint.sh ./
RUN chmod +x entrypoint.sh \
    && mkdir -p /data/yuklemeler \
    # root olmayan kullanıcı
    && adduser --disabled-password --gecos "" inspro \
    && chown -R inspro:inspro /app /data
USER inspro

EXPOSE 4400

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD curl -fsS http://localhost:4400/health || exit 1

ENTRYPOINT ["./entrypoint.sh"]
