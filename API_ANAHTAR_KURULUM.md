# Anthropic API Anahtarı Kurulumu (mk_ai gerçek AI modu)

mk_ai ve fiyat asistanı **anahtar olmadan da çalışır** (kural-bazlı + demo yorum). Gerçek Claude analizini açmak için:

## 1. Anahtarı al
1. https://console.anthropic.com adresine gir → giriş yap
2. Sol menü **API Keys** → **Create Key** → isim ver (örn. "inspro-local")
3. Anahtarı kopyala — `sk-ant-...` ile başlar (bir daha gösterilmez, hemen kaydet)
4. **Billing** kısmından küçük bir bakiye yükle (kullandıkça öder; birkaç dolar test için yeter)

## 2. Anahtarı projeye ekle
`apps/web/.env.local` dosyasını aç, şu satırı **birebir** doldur (tırnak/boşluk yok):

```
ANTHROPIC_API_KEY=sk-ant-buraya-anahtar
```

> ⚠️ `=` işaretinin etrafında boşluk **olmasın**. Doğru: `ANTHROPIC_API_KEY=sk-ant-...`

Dilersen bu dosyayı bana açtırmak yerine kendin Not Defteri ile düzenleyebilirsin:
- Dosya: `D:\yazılım\insPRO\apps\web\.env.local`

## 3. Dev sunucusunu yeniden başlat
Anahtar ancak sunucu yeniden başlayınca okunur. Bana **"yeniden başlat"** de, ya da terminalde sunucuyu durdurup `npm run dev` ile yeniden başlat.

## 4. Doğrula
mk_ai panelinde **"🤖 mk_ai yorumu al"** butonuna bas. Artık **"DEMO — anahtar yok"** rozeti **çıkmamalı**; gerçek Claude (claude-opus-4-8) yorumu gelmeli.

## Güvenlik
- Anahtar **yalnızca sunucuda** (`.env.local`) tutulur, tarayıcıya/istemciye asla gönderilmez.
- `.env.local` git'e girmez (`.gitignore`'da).
- Anahtarı sohbete/koda yapıştırma; sadece `.env.local`'e yaz.
