# insPRO Backend

Kendi kontrolümüzde, kurumsal yapıda **FastAPI + PostgreSQL** backend.
Tüm veri kendi veritabanımızda; Docker'da çalışır, istenen sunucuya deploy edilir.

## Mimari

```
app/
  core/           # config, database, security (JWT), logging, errors
  models/         # SQLAlchemy modelleri (tablo başına dosya)
  schemas/        # Pydantic istek/yanıt şemaları
  services/       # iş mantığı: otp, email, dosya
  api/routes/     # uç noktalar: health, auth, projeler, muhasebe, moduller, yonetim, dosya
  main.py         # uygulama fabrikası (middleware, router, statik dosya)
alembic/          # veritabanı migrasyonları
tests/            # pytest testleri
```

## Çalıştırma (Docker)

```bash
cp .env.example .env      # değerleri doldur (JWT_SECRET, DB_PASSWORD, SMTP_*)
docker compose up -d --build
```

- API: http://localhost:4400
- Dokümantasyon: http://localhost:4400/docs
- Migrasyonlar konteyner açılışında otomatik uygulanır (`alembic upgrade head`).

## Testler

```bash
docker compose exec api pytest          # konteyner içinde
# veya yerelde:  pip install -r requirements.txt && pytest
```

## Migrasyon (şema değişikliği)

```bash
docker compose exec api alembic revision --autogenerate -m "açıklama"
docker compose exec api alembic upgrade head
```

## Uçlar (özet)

| Yöntem | Yol | Açıklama |
|---|---|---|
| GET  | /health, /health/db | sağlık / DB hazırlık |
| POST | /auth/kod-gonder | e-posta doğrulama kodu gönder |
| POST | /auth/kod-dogrula | kod doğrula → access + refresh token |
| POST | /auth/token-yenile | refresh ile yeni access token |
| GET  | /auth/ben | aktif kullanıcı |
| GET/POST/DELETE | /projeler | proje CRUD (sahibe özel) |
| GET/POST/DELETE | /muhasebe | muhasebe CRUD |
| GET/PUT | /modul/{ad} | genel modül blob (metraj, saha, personel…) |
| GET/POST | /yonetim/kullanicilar | kullanıcı + rol yönetimi (yönetici) |
| POST | /yukle | dosya/fotoğraf yükle (base64 → URL) |
| GET  | /dosyalar/{ad} | yüklenen dosyayı sun (statik) |
