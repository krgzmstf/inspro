# insPRO — İnşaat Süreç Yönetim Platformu

**Master Plan ve Ürün Tanım Belgesi**

| | |
|---|---|
| **Ürün Adı** | insPRO |
| **Tarih** | 11 Haziran 2026 |
| **Hedef Platformlar** | Web (tarayıcı) + iOS (App Store) + Android (Google Play) |
| **Versiyon** | Plan v1.0 |

---

## 1. Vizyon

insPRO, bir inşaat projesinin **fikir aşamasından anahtar teslimine kadar** tüm yaşam döngüsünü tek çatı altında yöneten, yapay zeka destekli bir platformdur:

> Proje dosyasını (PDF/DWG) yükle → keşif-metraj otomatik çıksın → güncel piyasa fiyatlarıyla maliyet hesaplansın → yapay zeka riskleri önceden söylesin → 3D görseller üretilsin → inşaat başlayınca her aşama adım adım takip edilsin → gelir-gider muhasebesi anlık görünsün.

Hedef kullanıcılar: müteahhitler, mühendislik/mimarlık ofisleri, şantiye şefleri, kendi evini yaptıran bireyler.

---

## 2. İncelenen 8 Projeden Çıkarılan Dersler

Bu plan, GitHub'da incelediğimiz 8 benzer projenin güçlü yanları ve hatalarının sentezidir:

| Kaynak Proje | Alınacak Ders / Özellik | Kaçınılacak Hata |
|---|---|---|
| insaat-saha-takip (React+Firebase) | ✅ Güvenlik kuralları, sunucu taraflı admin işlemleri, rol modeli | users koleksiyonunu herkese açık bırakmak |
| SantiyeTakipOtomasyon (ASP.NET) | ✅ Domain modeli: puantaj, fatura+detay, tedarikçi, ödeme, izin, KDV, döviz | `[Authorize]` olmadan yayına çıkmak, şifreleri düz metin tutmak, DB şifresini commit'lemek |
| InsaatMetrajPro (PyQt6) | ✅ Özellik fikirleri: hakediş, fiyat farkı, EKAP, Gantt/PERT, SGK işçilik, DXF analizi | 8.000 satırlık dosyalar, kırık çekirdek modülle yayın, .bak dosyaları commit'lemek |
| insaat-maliyet-pro (PWA) | ✅ Bölge/kalite/tip çarpanlı hesap motoru, abonelik kurgusu | Paywall'ı istemcide tutmak (localStorage ile abonelik = bedava abonelik) |
| insaat_takip (Flutter+Supabase) | ✅ Saha foto-onay akışı, proje→kat→eleman hiyerarşisi | RLS'siz veritabanı, UUID önekiyle davet kodu, istemcide zincirleme silme |
| insaat-hesaplayici (statik) | ✅ Temiz tek-amaçlı hesap fonksiyonları, TR para formatı | Alanı kat sayısıyla iki kez çarpmak (test edilmemiş formül) |
| maliyethesap (AI Studio) | ✅ SEO/blog içerik hunisi pazarlama fikri | Kullanılmayan bağımlılıklar, şablonsuz 30 kopya HTML |
| INSAAT-MALIYET-HESABI (MATLAB) | ✅ Maliyet kalemi yüzde dağılımı yaklaşımı | — |

**Altın kurallar (bu projede taviz yok):**
1. Her tablo/koleksiyon ilk günden satır düzeyi güvenlik (RLS) ile doğar.
2. Para ve yetki kararları **asla** istemcide verilmez — abonelik, rol, fiyat hep sunucuda doğrulanır.
3. Hiçbir sır (API key, DB şifresi) repoya girmez; `.env` + secret yönetimi ilk commit'te kurulur.
4. Her hesap formülünün birim testi yazılır (çift çarpım hatası dersi).
5. Dosyalar 300-400 satırı geçmeden bölünür.

---

## 3. Teknoloji Mimarisi

### 3.1 Önerilen Stack

```
┌─────────────────────────────────────────────────────────────┐
│  İSTEMCİLER                                                  │
│  ┌──────────────────┐  ┌──────────────────────────────────┐ │
│  │ Web: Next.js 15  │  │ Mobil: Flutter (iOS + Android)   │ │
│  │ (React + TS)     │  │ → App Store & Google Play        │ │
│  └────────┬─────────┘  └────────────────┬─────────────────┘ │
└───────────┼─────────────────────────────┼───────────────────┘
            │         REST / Realtime     │
┌───────────▼─────────────────────────────▼───────────────────┐
│  BACKEND: Supabase (PostgreSQL + Auth + Storage + Realtime) │
│  • RLS politikaları (rol bazlı erişim)                       │
│  • Edge Functions (hassas işlemler, ödeme doğrulama)         │
└───────────┬──────────────────────────────────────────────────┘
            │
┌───────────▼──────────────────────────────────────────────────┐
│  SERVİS KATMANI (Python — FastAPI, ayrı konteyner)           │
│  • DXF/DWG analiz servisi (ezdxf)                            │
│  • PDF plan okuma servisi (pdfplumber + vision AI)           │
│  • 3D görsel üretim kuyruğu                                  │
│  • Fiyat araştırma ajanı (zamanlanmış tarama)                │
└───────────┬──────────────────────────────────────────────────┘
            │
┌───────────▼──────────────────────────────────────────────────┐
│  YAPAY ZEKA                                                   │
│  • Claude API (analiz, risk, metraj yorumlama, ajan)         │
│  • Görüntü üretimi (3D konsept görseller)                    │
└───────────────────────────────────────────────────────────────┘
```

**Neden bu seçimler:**
- **PostgreSQL (Supabase), Firestore'a tercih edildi** çünkü muhasebe, hakediş, puantaj gibi modüller ilişkisel ve raporlama ağırlıklı — SantiyeTakipOtomasyon'un 25 tabloluk domain'i belge veritabanına sığmaz.
- **Flutter** tek kod tabanından iki mağazaya da native kalitede çıkış sağlar (insaat_takip deneyimi: Flutter bu iş için uygun, sorun backend'deydi).
- **Next.js web tarafında** SEO de sağlar → maliyethesap'tan alınan ders: blog/içerik hunisi organik müşteri getirir.
- **Python servis katmanı** zorunlu: DXF okuma (ezdxf), PDF analizi (pdfplumber) ve kuyruk işleri Python ekosisteminde olgun (InsaatMetrajPro'nun doğru tercihiydi).

### 3.2 Depo Yapısı (monorepo)

```
inspro/
├── apps/
│   ├── web/            # Next.js — vitrin + web uygulaması + admin paneli
│   └── mobile/         # Flutter — saha uygulaması
├── services/
│   ├── cad-analyzer/   # FastAPI: DXF/PDF analiz
│   ├── render-engine/  # 3D görsel üretim kuyruğu
│   └── price-agent/    # Fiyat araştırma ajanı
├── packages/
│   ├── shared-types/   # Ortak tip tanımları
│   └── calc-engine/    # Hesap formülleri (TEK kaynak + birim testler)
├── supabase/
│   ├── migrations/     # Veritabanı şeması (versiyonlu)
│   └── policies/       # RLS politikaları
└── docs/
```

---

## 4. Modüller (Özellik Haritası)

### M1 — Proje Dosyası Analizi 📐
- PDF mimari/statik/tesisat projesi yükleme
- DXF/DWG yükleme → katman, ölçü, mahal listesi çıkarımı (ezdxf)
- AI ile plan okuma: "Bu projede kaç daire var, brüt alanlar ne?"
- **Eksik bilgi diyaloğu:** Sistem plandan çıkaramadığını kullanıcıya sorar (kat yüksekliği, zemin sınıfı, cephe malzemesi...) — kullanıcının istediği "bizden bilgi isteyen" akış
- Proje türleri: mimari / statik / mekanik tesisat / elektrik tesisat

### M2 — Keşif & Metraj 📏
- Plan analizinden otomatik metraj taslağı (duvar, döşeme, kalıp, demir, beton, sıva, boya, seramik, doğrama...)
- Manuel metraj editörü (tablo tabanlı, mahal bazlı)
- Poz/birim fiyat kütüphanesi (Çevre ve Şehircilik Bakanlığı birim fiyatları + özel pozlar)
- Metraj → keşif özeti → BOQ (Bill of Quantities) çıktısı (PDF/Excel)

### M3 — Maliyet Hesaplama 💰
- Keşiften otomatik maliyet (poz × miktar × güncel birim fiyat)
- Hızlı tahmin modu: m² × yapı tipi × kalite × il çarpanı (maliyet-pro motorunun doğru hali)
- Maliyet kalemi dağılımı (kaba yapı %, ince iş %, tesisat %, ...)
- Senaryo karşılaştırma (ekonomik/standart/lüks), döviz ve enflasyon projeksiyonu
- **Tüm formüller `packages/calc-engine`'de, birim testli**

### M4 — Türkiye Fiyat Araştırma Ajanı 🔍
- Demir, çimento, hazır beton, tuğla, işçilik vb. için güncel piyasa fiyatı takibi
- Kaynaklar: kamu birim fiyatları, borsa/endeks verileri, tedarikçi ilan siteleri
- Zamanlanmış tarama + kullanıcı talebiyle anlık araştırma ("bugün İzmir'de C30 beton kaç para?")
- Fiyat geçmişi grafikleri, bölgesel karşılaştırma
- ⚠️ Hukuki not: kaynak sitelerin kullanım şartlarına uygun tarama; resmi/halka açık veri öncelikli

### M5 — Yapay Zeka Risk Danışmanı 🧠
- Proje + lokasyon + takvim verisinden risk analizi: zemin riski, deprem bölgesi, hava koşulları (kış betonu!), tedarik gecikmesi, kur riski, ruhsat süreç riskleri
- Aşama bazlı uyarılar: "Kalıp sökme süresi C25 için min X gün", "bu ilde kasım-mart arası dış cephe boyası riskli"
- Maliyet aşım erken uyarısı (planlanan vs gerçekleşen sapma analizi)
- Sohbet ajanı: projenin tüm verisine hâkim, soru-cevap (Claude API)

### M6 — 3D Görselleştirme 🎨
- **Faz 1:** Plan + kullanıcı tercihleri (cephe rengi, malzeme) → AI ile konsept JPEG görseller (dış cephe, iç mekan)
- **Faz 2:** DXF'ten basit 3D kütle modeli (Three.js web görüntüleyici)
- **Faz 3 (araştırma):** Kısa animasyonlu turlar (AI video üretimi olgunlaştıkça)
- Beklenti yönetimi: bunlar **konsept görseller**, render bürosu çıktısı değil — UI'da açıkça belirtilecek

### M7 — İnşaat Yol Haritası & Saha Takibi 🏗️
Şablon iş kalemleri (proje türüne göre otomatik Gantt taslağı):

1. Hazırlık: arsa/tapu, zemin etüdü, projelendirme, ruhsat, yapı denetim sözleşmesi
2. Şantiye kurulumu: elektrik/su abonelikleri, şantiye binası, güvenlik/İSG planı
3. Kazı & istinat: hafriyat, iksa, drenaj, grobeton
4. Temel: kalıp, demir, beton, su yalıtımı, topraklama
5. Kaba yapı: kat kat kolon-perde-döşeme döngüsü, merdivenler, asansör kuyusu
6. Çatı: konstrüksiyon, örtü, yalıtım, yağmur iniş sistemleri
7. Duvarlar & şap
8. Mekanik tesisat: sıhhi tesisat, kalorifer/doğalgaz, havalandırma, yangın
9. Elektrik tesisatı: boru-kablo, pano, zayıf akım, asansör montajı
10. İç ince işler: alçı/sıva, macun-boya, seramik, parke, asma tavan, iç doğrama, mutfak/banyo
11. Dış cephe: iskele kurulumu (İSG!), mantolama, kaplama/boya, dış doğrama, cam
12. Çevre düzenlemesi: peyzaj, otopark, çevre duvarı
13. Teslim: iskan ruhsatı, abonelik devirleri, eksik listesi (punch-list), kesin hesap

Her iş kalemi için: sorumlu, tarih aralığı, bağımlılıklar, ilerleme %, **fotoğraflı saha kaydı** (insaat-saha-takip modeli: işçi çeker, yetkili onaylar), hava durumu entegrasyonu, kritik yol uyarıları.

### M8 — Muhasebe (Gelir / Gider) 📒
SantiyeTakipOtomasyon domain'inin modern hali:
- Gider kalemleri: malzeme faturaları (+ fatura detay satırları, KDV, döviz), işçilik/puantaj, taşeron hakedişleri, makine-ekipman, genel giderler
- Gelir kalemleri: satışlar/kaporalar, hakediş tahsilatları, kat karşılığı anlaşma kayıtları
- Tedarikçi cari hesapları, ödeme planları, çek/senet takibi
- Puantaj: personel, günlük yevmiye, resmi tatil/izin, SGK maliyet hesabı
- Bütçe vs gerçekleşen raporu (M3'teki keşif maliyetiyle canlı karşılaştırma — platformun katil özelliği)
- Excel/PDF dışa aktarma; e-fatura entegrasyonu (faz 3+)

### M9 — Kullanıcı, Rol ve Abonelik 👥
- Roller: **Sahip** (firma admini) / **Ofis** (mühendis-muhasebe) / **Şantiye Şefi** / **Saha Personeli** (kısıtlı: foto+puantaj) / **Müşteri-İzleyici** (salt okunur ilerleme)
- Çoklu proje, çoklu firma (multi-tenant) yapısı
- Abonelik: ücretsiz (1 proje, temel hesap) / Pro (sınırsız proje, AI analiz) / Kurumsal
- Ödeme doğrulama **sunucuda**: web→iyzico/Stripe, mobil→RevenueCat (App Store/Play faturalandırması)

---

## 5. Veri Modeli (Çekirdek Tablolar)

```
firmalar ─┬─ kullanicilar (rol, firma_id)
          ├─ projeler ─┬─ proje_dosyalari (pdf/dxf, analiz_sonucu jsonb)
          │            ├─ metrajlar ── metraj_satirlari (poz_id, mahal, miktar)
          │            ├─ kesifler ── kesif_kalemleri
          │            ├─ is_kalemleri (gantt: baslangic, bitis, bagimlilik, ilerleme)
          │            ├─ saha_kayitlari (foto, not, konum, onay_durumu)
          │            ├─ riskler (ai_uretimi, durum)
          │            └─ gorseller (3d konsept çıktılar)
          ├─ muhasebe ─┬─ faturalar ── fatura_detaylari
          │            ├─ odemeler / tahsilatlar
          │            ├─ tedarikciler (cari)
          │            ├─ personeller ── puantajlar ── izinler
          │            └─ butce_kalemleri
          ├─ pozlar (resmi + özel birim fiyatlar, versiyonlu)
          └─ fiyat_gozlemleri (ajan çıktısı: malzeme, il, fiyat, kaynak, tarih)
```

Her tabloda: `firma_id` üzerinden RLS izolasyonu (bir firma diğerinin verisini **hiçbir koşulda** göremez), `created_by`, `created_at`, soft-delete (`deleted_at`).

---

## 6. Yol Haritası (Fazlar)

### Faz 0 — Temel (2-3 hafta)
- [ ] Monorepo + CI kurulumu, Supabase şema v1 + RLS politikaları
- [ ] Auth (e-posta + Google), firma/rol yapısı
- [ ] Web vitrin ana sayfası (pazarlama) ← **bir sonraki adımımız**

### Faz 1 — MVP: Hesap Çekirdeği (4-6 hafta)
- [ ] Hızlı maliyet tahmini (m² bazlı) — web + mobil
- [ ] Manuel metraj editörü + keşif çıktısı (PDF/Excel)
- [ ] Poz kütüphanesi v1
- [ ] Proje oluşturma, temel yol haritası şablonu
- 🎯 Mağazalara ilk sürüm bu fazla çıkar (basit ama kusursuz — hesap motoru birim testli)

### Faz 2 — Saha & Muhasebe (6-8 hafta)
- [ ] Fotoğraflı saha takibi + onay akışı, Gantt görünümü
- [ ] Muhasebe: fatura, gider, tedarikçi cari, puantaj
- [ ] Bütçe vs gerçekleşen raporu
- [ ] Abonelik altyapısı (RevenueCat + Stripe/iyzico)

### Faz 3 — Yapay Zeka (paralel başlar, 8+ hafta)
- [ ] PDF plan analizi + eksik bilgi diyaloğu
- [ ] DXF metraj çıkarımı (önce duvar/alan, kademeli genişleme)
- [ ] Risk danışmanı + proje sohbet ajanı
- [ ] Fiyat araştırma ajanı v1
- [ ] AI konsept görseller (JPEG)

### Faz 4 — İleri Seviye
- [ ] 3D kütle modeli (Three.js), animasyonlu turlar
- [ ] EKAP/ihale modülü, e-fatura, hakediş-fiyat farkı otomasyonu
- [ ] Çok dilli destek, bayi/taşeron portali

---

## 7. Riskler ve Dürüst Notlar

| Risk | Gerçeklik | Önlem |
|---|---|---|
| DWG okuma | DWG kapalı format; doğrudan okumak lisanslı SDK ister | Kullanıcıdan DXF istenir (AutoCAD'den tek tıkla çevrilir); DWG→DXF dönüşüm servisi faz 4 |
| PDF'ten otomatik metraj | %100 otomatik metraj sektörde çözülmemiş problem | "AI taslak çıkarır + insan düzeltir" akışı; asla "tam otomatik" vaadi verilmez |
| AI görsel kalitesi | Konsept düzeyindedir, fotorealistik render değildir | UI'da net etiketleme; beklenti yönetimi |
| Fiyat verisi güncelliği | Kaynaklar değişken, tarama kırılgan | Çoklu kaynak + resmi endeks taban + "son güncelleme" damgası |
| Kapsam büyüklüğü | Bu 8 projenin toplamından büyük bir iş | Faz disiplini: her faz tek başına yayınlanabilir ürün |

---

## 8. Sıradaki Adımlar

1. ✅ Bu master plan belgesi
2. ⏭️ **Web sitesi ana sayfası** (insPRO vitrin: hero, özellik kartları, fiyatlandırma, SSS, CTA)
3. ⏭️ Admin panel iskeletleri (adım adım: proje yönetimi → metraj → muhasebe → ...)
4. ⏭️ Supabase şema + RLS migration'ları
5. ⏭️ Flutter mobil iskelet

---

*Bu belge insPRO'nun yaşayan ana planıdır; her fazda güncellenir.*
