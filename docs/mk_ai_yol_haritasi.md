# mk_ai — Araştırma Bulguları & Yol Haritası

> Kaynak: research-agent taraması (EVM, LLM risk danışmanı desenleri, agentic+RAG, açık kaynak kütüphaneler). 13 Haziran 2026.

## Temel ilke (araştırma ile doğrulandı)
**Kural-motoru otorite, LLM yorumcu.** Tüm sayısal risk skorları (CPI/SPI/EAC) deterministik kural-motorundan (`lib/mkAi.ts`) gelir; Claude yalnızca açıklama + öneri üretir. Structured Outputs *format* garantisi verir, *doğruluk* garantisi vermez — bu yüzden sayılar asla LLM'den gelmez.

## EVM formülleri (uygulandı / uygulanacak)
- EV = bütçe × %tamam | AC = toplam gider | **CPI = EV/AC** | **EAC = BAC/CPI = AC/%tamam** ✅ uygulandı
- SPI = EV/PV (PV = bütçe × planlı%) — ⏳ takvim SPI eklenebilir
- Gecikme-maliyet bağlı: **EAC = AC + (BAC−EV)/(CPI×SPI)** — ⏳ SPI gelince
- Erken uyarı: **%20+ tamamlanmada CPI düşükse yüksek risk** (CPI nihai maliyetin güçlü erken göstergesi) ✅ uygulandı (butceAsimYuzde≥10 → yüksek)

## Yapıldı (bu oturum, v2)
- EAC / CPI / bütçe sapma projeksiyonu
- Takvim projeksiyonu (tahmini bitiş, gecikme gün)
- Harcama hızı (burn-rate, son 30 gün) + artış trendi
- Kategori bazlı skorlar (maliyet/takvim/kalite/nakit)
- EVM birim testleri (`mkAi.test.ts`)
- API promptu EVM-farkında + kategori-öncelikli

## Sıradaki adımlar (öncelik sıralı)
1. ✅ **Gerçek AI AÇILDI (2026-06-14)** — Anthropic yerine **çok-sağlayıcılı ücretsiz platform** kuruldu (`lib/aiSaglayici.ts`). Çalışan motor: **Groq** (`openai/gpt-oss-120b`, kart istemez). Router: groq→gemini→deepseek→github fallback. `/api/mk-ai` uçtan uca test edildi, gerçek yorum üretiyor (güven + kategoriOdak dahil). Not: Groq'ta yapılandırılmış çıktı için json_schema destekleyen model + `.chat()` modu şart.
2. ✅ **Structured Outputs (yapıldı)** — `/api/mk-ai` route'u **Vercel AI SDK v6** (`generateObject` + Zod) ile yeniden yazıldı. Şema: `{yorum, oneriler[], kategoriOdak, guven}`. Kırılgan regex JSON ayıklaması kaldırıldı; model şemaya uymak zorunda. Framework seçimi: Vercel AI SDK (Apache-2.0; TS AI framework'leri içinde üretimde açık ara en çok indirilen — 2.8M/hafta; Next.js'e birinci sınıf uyum). Sıradaki: `citations[]` ve `thinking` (provider options) eklemek.
3. **"Önce alıntı, sonra cevap" + "bilmiyorum" izni** — halüsinasyon azaltma; her öneriye `citations[]`.
4. **Monte Carlo takvim güveni** — min/olası/maks süre girişi eklenince triangular dağılımla "%X olasılıkla zamanında biter". (Şu an 3-nokta tahmin verisi yok; veri modeline eklenmeli.)
5. **Yönetmelik/standart RAG** — **LanceDB (Apache-2.0, gömülü, serverless-uyumlu)** veya Chroma + **Vercel AI SDK** orkestrasyon. **LangGraph KULLANMA** (serverless desteklemiyor).
6. **Tool use / agentic** — `get_evm_metrics`, `run_monte_carlo`, `query_regulations`, `get_critical_path` araçları; her tool açıklamasında *ne zaman çağrılacağı* belirtilsin. Vercel AI SDK `ToolLoopAgent`.
7. **Self-verification** — üretilen raporu hafif bir modele (Haiku) doğrulat: "her iddianın dayanağı var mı?".

## Lisans kuralı
Sadece **MIT / Apache-2.0 / BSD** kütüphane kullan. **Elastic License v2** (bazı Mastra sürümleri) izin verici değil — dikkat. **GPL** (DHTMLX Gantt) kaçın. Kod kopyalama yok; yaklaşım/paket olarak kullan.

## Önerilen kütüphaneler (lisans uygun)
| İhtiyaç | Kütüphane | Lisans |
|---|---|---|
| Gömülü vektör DB | LanceDB | Apache-2.0 |
| Vektör DB (alt.) | Chroma | Apache-2.0 |
| LLM orkestrasyon | Vercel AI SDK | Apache-2.0 |
| RAG ingestion | LlamaIndex.TS | MIT |
| Gantt görsel | Frappe Gantt | MIT |
| EVM / Monte Carlo | (kendin yaz — saf TS) | — |
