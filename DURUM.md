# insPRO — Proje Durumu

**Son güncelleme:** 13 Haziran 2026
**Konum:** `D:\yazılım\insPRO\apps\web` (Next.js 16 + TS + Tailwind v4)
**Çalıştırma:** `cd apps/web && npm run dev` → http://localhost:3000
**Veri:** localStorage (DEMO) — tüm veri katmanı `src/lib/*.ts`'de, Supabase'e taşımaya hazır.
**Build:** ✓ temiz · **Test:** 12/12 (vitest)

## Panel modülleri (15)
| Modül | Yol | Durum |
|---|---|---|
| Projeler / Dashboard | `/panel` | ✓ KPI + uyarılar |
| İş Süreçleri (Gantt + bağımlılık) | `/panel/is-surecleri` | ✓ |
| Keşif & Metraj | `/panel/metraj` | ✓ otomatik poz eşleşme |
| Maliyet | `/panel/maliyet` | ✓ |
| **Teklif** | `/panel/teklif` | ✓ keşiften kalem, PDF/Excel |
| **Hakediş** | `/panel/hakedis` | ✓ dönemsel istihkak, kesintiler, PDF/Excel |
| Poz Kütüphaneleri (Küt-1/2/3) | `/panel/pozlar?lib=` | ✓ Excel içe/dışa |
| Personel & Puantaj | `/panel/personel` | ✓ SGK + aylık puantaj |
| Muhasebe | `/panel/muhasebe` | ✓ gelir/gider |
| Saha Takibi | `/panel/saha` | ✓ iş emri/kusur/foto |
| **3B Görselleştirme** | `/panel/3d` | ✓ kat verisinden bina kütlesi (three.js) |
| **Plan → 3B Stüdyo** | `/panel/plan3d` | ✓ BETA: PDF/DXF/JPEG → 3B + animasyon + WebM video |
| **mk_ai (Risk Asistanı)** | `/panel/mk-ai` | ✓ kural-bazlı risk + Claude yorumu |

## 12-13 Haziran oturumunda eklenenler
1. **Teklif** — `lib/teklif.ts`, baz fiyat (piyasa/ÇŞB/kendi) × kâr marjı, keşiften otomatik kalem, KDV, logolu PDF + Excel.
2. **Hakediş** — `lib/hakedis.ts`, kümülatif imalat, önceki hakedişten otomatik devir, teminat/stopaj/avans kesintileri, ilerleme barları, PDF + Excel.
3. **3B Görselleştirme** — `lib/bina3d.ts` + `/panel/3d`, kat alanı/benzer adet/kullanımdan otomatik kütle, OrbitControls, kata tıkla → detay.
4. **Plan → 3B Stüdyo** — `lib/plan3d.ts` + `/panel/plan3d`. DXF vektör doğrudan extrude; PDF/JPEG/PNG üzerine fareyle duvar çizimi + ölçek kalibrasyonu; duvar yükseklik/kalınlık ayarı; **animasyonlar:** döndür / inşa (duvarlar yükselir) / yürüyüş turu; **WebM video kaydı** (MediaRecorder). DWG → CAD'den DXF'e çevirme uyarısı.
5. **mk_ai** — AI asistanının adı (kullanıcı verdi). `lib/mkAi.ts` kural-bazlı risk motoru (bütçe aşımı, nakit akışı, takvim gecikmesi, ilerleme-süre sapması, kusur, iş emri, bağımlılık ihlali) → 0-100 skor + faktör + öneri. `/api/mk-ai` Claude (claude-opus-4-8) ile yönetici yorumu; **anahtar yoksa demo yorum.**

## Yeni bağımlılıklar
`three` + `@types/three`, `dxf-parser`, `pdfjs-dist` (PDF ilk sayfa render; worker CDN: unpkg).

## Bilinen sınırlar / sonraki adımlar
- **ANTHROPIC_API_KEY** hâlâ DEMO modda → mk_ai ve fiyat asistanı kural-bazlı/demo çalışıyor. Anahtar `apps/web/.env.local`'e eklenince gerçek AI devreye girer.
- Plan→3B raster akışı duvarları **elle çizmeye** dayanır (otomatik görüntü işleme ile duvar tanıma yok). DWG doğrudan okunamıyor.
- WebM çıktıyı MP4'e dönüştürmek harici araç gerektirir.
- Büyük mimari adım: **Supabase + Auth** (çok kullanıcı, güvenli admin paneli) — henüz başlanmadı.
