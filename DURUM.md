# insPRO — Proje Durumu

**Son güncelleme:** 15 Haziran 2026
**Konum:** `D:\yazılım\insPRO\apps\web` (Next.js 16 + TS + Tailwind v4)
**Çalıştırma:** `cd apps/web && npm run dev` → http://localhost:3000
**Veri:** localStorage (DEMO) — tüm veri katmanı `src/lib/*.ts`'de, Supabase'e taşımaya hazır.
**Build:** ✓ temiz (26 sayfa) · **Test:** 20/20 (vitest)

## Panel modülleri (13)
| Modül | Yol | Durum |
|---|---|---|
| Projeler / Dashboard | `/panel` | ✓ KPI + uyarılar + **veri yedekleme** |
| İş Süreçleri (Gantt + bağımlılık) | `/panel/is-surecleri` | ✓ |
| Keşif & Metraj | `/panel/metraj` | ✓ otomatik poz eşleşme |
| Maliyet | `/panel/maliyet` | ✓ poz bazlı + m² tahmin |
| Teklif | `/panel/teklif` | ✓ keşiften kalem, PDF/Excel |
| Hakediş | `/panel/hakedis` | ✓ dönemsel istihkak, kesintiler, PDF/Excel |
| Poz Kütüphaneleri (Küt-1/2/3) | `/panel/pozlar?lib=` | ✓ Excel içe/dışa |
| Personel & Puantaj | `/panel/personel` | ✓ SGK + aylık puantaj |
| Muhasebe (profesyonel) | `/panel/muhasebe` | ✓ KDV/tevkifat · cari hesap · vade/yaşlandırma · kasa-banka · raporlar |
| Saha Takibi | `/panel/saha` | ✓ iş emri/kusur/foto |
| 3B Görselleştirme | `/panel/3d` | ✓ kat verisinden bina kütlesi (three.js) |
| Plan → 3B Stüdyo | `/panel/plan3d` | ✓ BETA: PDF/DXF/JPEG → 3B + animasyon + WebM |
| **mk_ai (Risk Asistanı)** | `/panel/mk-ai` | ✓ kural risk + AI yorum + agentic sohbet + görsel |

## mk_ai — güncel mimari (14-15 Haziran)
- **Çok-sağlayıcılı ücretsiz AI platformu** (`lib/aiSaglayici.ts`): Groq → Gemini → DeepSeek → GitHub Models, env'de hangi anahtar varsa otomatik + fallback. Paralı Anthropic bırakıldı. Çalışan motor: **Groq** (`openai/gpt-oss-120b`).
- **Risk motoru** (`lib/mkAi.ts`): EVM (CPI/EAC), takvim projeksiyonu, harcama hızı, kategori skorları → 0-100 skor + faktör + öneri. API anahtarı GEREKMEZ.
- **AI yorum** (`/api/mk-ai`): generateObject + Zod yapılandırılmış çıktı (yorum/öneri/kategoriOdak/güven).
- **Agentic sohbet + Yönetmelik RAG** (`/api/mk-ai/danis` + `lib/yonetmelik.ts`): mk_ai gerektiğinde `yonetmelik_ara` aracını çağırır (imar/deprem/yangın/İSG/enerji/yapı denetimi, 12 madde), cevabını **kaynak göstererek** verir. Keyword tabanlı RAG (vektör DB yok).
- **Görsel üretim** (`/api/mk-ai/gorsel-uret`): **Hugging Face** (FLUX.1-schnell, ücretsiz) → Gemini → **Pollinations** yedeği. Yükleme butonu var; img2img (yüklenen görseli dönüştürme) HF ücretsiz tier'da sağlayıcısız → şimdilik metinden üretime düşer.

## Bu oturumda eklenenler (14-15 Haziran)
1. mk_ai agentic + yönetmelik RAG (`lib/yonetmelik.ts`, `/api/mk-ai/danis`, `yonetmelik.test.ts`).
2. mk_ai görsel: HF entegrasyonu + yükleme butonu + Pollinations yedeği.
3. mk_ai paneli logolu (a1.jpg → `public/mk-ai-logo.jpg`); sohbet cilası (hızlı sorular, kaynak rozetleri, oto-kaydırma).
4. **Veri yedekleme/geri yükleme** (`lib/yedek.ts` + dashboard `YedekKart`): tüm inspro-* verisini JSON indir/geri yükle.
5. **Fiyat Ajanı çok-sağlayıcıya taşındı** (`/api/fiyat-guncelle`): Anthropic kaldırıldı → router + generateObject. (Not: ücretsiz sağlayıcı web araması yapamaz → "AI tahmini" aralık.)

## mk_ai Yerel Beyin + Modül Entegrasyonu (15 Haziran — yeni)
`lib/mkAiYerel.ts` — **hiçbir yapay zekâ servisine bağlanmadan** tüm modülleri birleştirir:
- `projeOzet()` — projeler + iş süreçleri + keşif/metraj + personel + muhasebe + saha + aşama kalemleri + hakediş + teklif tek bütünleşik resimde (tek doğruluk kaynağı).
- `mkAiSorgu()` — kural-bazlı soru-cevap (Türkçe anahtar eşleme): bütçe, nakit/ödeme, takvim/gecikme, saha/kusur, personel, risk, teklif/hakediş, yol haritası kalemleri.
- `mkAiTespitler()` + `uygulaTespit()` — modüller arası tutarsızlık tespiti ve **mk_ai'nin kendi başına düzeltmesi**: (1) keşiften bütçe yaz, (2) ödenmiş aşama kalemlerini muhasebeye gider olarak aktar (belgeNo `ASAMA:<id>` ile izlenir), (3) aşama durumlarını kalem onayına göre eşitle.
- mk-ai panelinde "🧠 Yerel Asistan (AI'sız · anında · çevrimdışı)" bölümü: hızlı sorular + tespit/düzelt butonları. Mevcut harici-AI sohbeti/görseli aynen duruyor.

## Profesyonel Muhasebe (15 Haziran — yeni)
`lib/muhasebe.ts` (yeniden yazıldı, eski kayıtlarla geriye uyumlu) + `lib/finansHesap.ts` (yeni) + sekmeli sayfa:
- **KDV + tevkifat motoru**: matrah/oran/tutar + KDV tevkifatı (yapı işleri 4/10 ön tanımlı), brüt/net otomatik.
- **Cari hesaplar**: taraf bazında borç/alacak + kronolojik **ekstre** (yürüyen bakiye) + **vade yaşlandırma** (0-30/31-60/61-90/90+).
- **Vade & ödeme durumu**: açık/kısmi/ödendi; tahsilat/ödeme modalı (`odemeKaydet`).
- **Kasa & Banka**: çoklu hesap, hareketlere bağlı canlı bakiye (proje-üstü).
- **Raporlar + PDF/Excel**: gelir tablosu (KDV hariç), KDV özeti (beyanname taslağı), nakit akış (aylık), cari ekstre. `disaAktar.ts` (pdfYazdir/excelYaz) kullanır.
- Açık: çift taraflı muhasebe (TDHP), çek/senet portföyü, e-Fatura/e-Arşiv (GİB) — ileri seviye, sonraya.

## Bilinen sınırlar / sonraki adımlar
- **Kimlik doğrulama + roller YOK.** Anasayfa "Ekip & Roller" vaat ediyor; giriş ekranı yok. → Supabase Auth gerek.
- **Kalıcı backend YOK (Supabase).** Veri yalnız tarayıcıda (localStorage); cihazlar arası senkron/paylaşım yok. En büyük mimari adım. Geçici güvence: dashboard'daki Veri Yedekleme.
- **`/api/plan-oku` hâlâ Anthropic'e bağlı** (PDF→daire okuma). Vision/doküman modeli gerektirir; ücretsiz metin sağlayıcıları yapamaz (Gemini bölgede free=0). Anahtar yoksa demo. → vision-yetkili ücretsiz yol gerekli.
- **mk_ai dış veri kullanmıyor** (hava/kur/tedarik). Sadece proje içi veri.
- **Görsel img2img/iç mekân** ücretsiz tier'da yok.
- **DWG** doğrudan okunamıyor (DXF'e çevir); raster otomatik duvar tanıma kaba. WebM→MP4 yok.
- **Mobil (Flutter)** planlı, başlanmadı.

## Bağımlılıklar
`three` + `@types/three`, `dxf-parser`, `pdfjs-dist`, `ai` (Vercel AI SDK v6) + `@ai-sdk/openai|google|deepseek`, `@huggingface/inference`, `zod`, `xlsx`. (`@anthropic-ai/sdk` yalnız `plan-oku`'da kaldı.)
