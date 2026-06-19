import Link from "next/link";
import { YONETMELIK } from "@/lib/yonetmelik";

/* Ana sayfada öne çıkarılacak mevzuat başlıkları */
const MEVZUAT_VITRIN = [
  "deprem-tbdy", "betonarme-paspayi", "yangin", "otopark", "erisilebilirlik", "enerji-bep",
];

const ISTATISTIKLER = [
  { sayi: "1.876", etiket: "ÇŞB birim fiyat pozu" },
  { sayi: "13", etiket: "İnşaat süreç aşaması" },
  { sayi: "9", etiket: "Entegre modül" },
  { sayi: "%100", etiket: "Türkçe · KVKK uyumlu" },
];

/* ──────────────────────────────────────────────────────────
   insPRO Vitrin Ana Sayfası
   Bölümler: Navbar · Hero · Modüller · Nasıl Çalışır ·
   Süreç Şeridi · Fiyatlandırma · SSS · CTA · Footer
   ────────────────────────────────────────────────────────── */

const MODULES = [
  {
    icon: "📐",
    title: "Proje Analizi",
    desc: "Mimari, statik ve tesisat projelerini (PDF / DXF) yükleyin; insPRO planı okur, eksik bilgileri size sorar.",
  },
  {
    icon: "📏",
    title: "Keşif & Metraj",
    desc: "Plandan otomatik metraj taslağı: duvar, kalıp, demir, beton, sıva, boya… Düzenleyin, keşif özetini PDF/Excel alın.",
  },
  {
    icon: "💰",
    title: "Maliyet Hesaplama",
    desc: "Poz bazlı detaylı maliyet veya m² üzerinden hızlı tahmin; il, yapı tipi ve kalite çarpanlarıyla.",
  },
  {
    icon: "🔍",
    title: "Fiyat Araştırma Ajanı",
    desc: "Demir, çimento, beton ve işçilik fiyatlarını tüm Türkiye'de anlık araştıran yapay zeka ajanı.",
  },
  {
    icon: "🧠",
    title: "AI Risk Danışmanı",
    desc: "Zemin, hava, kur ve tedarik risklerini önceden bildirir: \"Bu ilde kasım ayında dış cephe boyası riskli.\"",
  },
  {
    icon: "🎨",
    title: "3D Konsept Görseller",
    desc: "Planınızdan ve tercihlerinizden yapay zeka ile dış cephe ve iç mekân konsept görselleri üretir.",
  },
  {
    icon: "🏗️",
    title: "Yol Haritası & Saha Takibi",
    desc: "Kazıdan teslime 13 aşamalı plan, Gantt görünümü, fotoğraflı saha kaydı ve onay akışı.",
  },
  {
    icon: "📒",
    title: "Gelir-Gider Muhasebesi",
    desc: "Fatura, puantaj, tedarikçi cari, hakediş ve bütçe-gerçekleşen karşılaştırması tek ekranda.",
  },
  {
    icon: "👥",
    title: "Ekip & Roller",
    desc: "Sahip, ofis, şantiye şefi, saha personeli ve müşteri-izleyici rolleri; herkes yetkisi kadarını görür.",
  },
];

const STEPS = [
  {
    no: "01",
    title: "Projenizi yükleyin",
    desc: "PDF veya DXF dosyanızı sürükleyin. insPRO katmanları, alanları ve mahalleri çıkarır.",
  },
  {
    no: "02",
    title: "Sorulara yanıt verin",
    desc: "Plandan okunamayan bilgileri (kat yüksekliği, zemin sınıfı, cephe tercihi…) sistem size sorar.",
  },
  {
    no: "03",
    title: "Keşif ve maliyeti alın",
    desc: "Metraj taslağı, keşif özeti ve güncel piyasa fiyatlarıyla maliyet raporu dakikalar içinde hazır.",
  },
  {
    no: "04",
    title: "İnşaatı yönetin",
    desc: "Yol haritasını takip edin, sahadan fotoğraf toplayın, gelir-gideri işleyin, riskleri önceden görün.",
  },
];

const PHASES = [
  "Zemin Etüdü & Ruhsat",
  "Şantiye Kurulumu",
  "Kazı & İksa",
  "Temel & Yalıtım",
  "Kaba Yapı",
  "Çatı",
  "Duvarlar & Şap",
  "Mekanik Tesisat",
  "Elektrik Tesisatı",
  "Alçı · Sıva · Boya",
  "Dış Cephe & İskele",
  "Çevre Düzenleme",
  "İskan & Teslim",
];

const FAQS = [
  {
    q: "DWG dosyalarımı yükleyebilir miyim?",
    a: "İlk sürümde DXF formatını destekliyoruz — AutoCAD'den 'Farklı Kaydet' ile tek tıkla DXF'e çevirebilirsiniz. PDF projeler doğrudan yüklenebilir. DWG desteği yol haritamızda.",
  },
  {
    q: "Metraj tamamen otomatik mi çıkıyor?",
    a: "insPRO plandan güçlü bir metraj taslağı çıkarır; siz kontrol eder, düzeltir ve onaylarsınız. %100 otomatik metraj vaadi veren araçlara şüpheyle yaklaşın — biz 'AI taslak çıkarır, uzman onaylar' ilkesiyle çalışıyoruz.",
  },
  {
    q: "Fiyatlar ne kadar güncel?",
    a: "Fiyat ajanımız resmi birim fiyatları ve piyasa kaynaklarını düzenli tarar; her fiyatın yanında kaynağı ve son güncelleme tarihi görünür. Dilerseniz kendi tedarikçi fiyatlarınızı da tanımlarsınız.",
  },
  {
    q: "3D görseller render kalitesinde mi?",
    a: "Ürettiğimiz görseller hızlı karar almanızı sağlayan yapay zeka destekli konsept görsellerdir; render bürosu çıktısının yerini almaz, ancak müşterinize fikri saniyeler içinde gösterir.",
  },
  {
    q: "Mobil uygulama hangi platformlarda?",
    a: "iOS (App Store) ve Android (Google Play) için native kalitede tek uygulama. Saha ekibiniz fotoğraf ve puantajı telefondan girer, ofis web panelinden anlık görür.",
  },
  {
    q: "Verilerim güvende mi?",
    a: "Her firmanın verisi satır düzeyinde izole edilir; bir firma diğerinin verisini hiçbir koşulda göremez. Yetki ve abonelik kontrolleri sunucu tarafında doğrulanır, şifreler asla düz metin tutulmaz.",
  },
];

const TIERS = [
  {
    name: "Ücretsiz",
    price: "0₺",
    period: "",
    desc: "Denemek ve küçük işler için",
    features: [
      "1 aktif proje",
      "Hızlı maliyet tahmini (m²)",
      "Temel metraj editörü",
      "Yol haritası şablonu",
      "Mobil uygulama",
    ],
    cta: "Ücretsiz Başla",
    highlight: false,
  },
  {
    name: "Pro",
    price: "Lansmana özel",
    period: "fiyatla duyurulacak",
    desc: "Profesyonel müteahhit ve ofisler için",
    features: [
      "Sınırsız proje",
      "PDF/DXF proje analizi",
      "AI risk danışmanı + sohbet ajanı",
      "Fiyat araştırma ajanı",
      "3D konsept görseller",
      "Tam muhasebe modülü",
      "Öncelikli destek",
    ],
    cta: "Erken Erişime Katıl",
    highlight: true,
  },
  {
    name: "Kurumsal",
    price: "Teklif",
    period: "ihtiyaca göre",
    desc: "Çok şantiyeli firmalar için",
    features: [
      "Çoklu firma / şube yapısı",
      "Özel poz kütüphanesi",
      "API erişimi & entegrasyonlar",
      "Eğitim ve kurulum desteği",
      "Sözleşmeli SLA",
    ],
    cta: "İletişime Geç",
    highlight: false,
  },
];

function Logo({ light = false }: { light?: boolean }) {
  return (
    <span className="inline-flex items-baseline text-2xl font-extrabold tracking-tight">
      <span className={light ? "text-white" : "text-ink-900"}>ins</span>
      <span className="text-brand-500">PRO</span>
    </span>
  );
}

export default function Home() {
  return (
    <main className="flex-1">
      {/* ── NAVBAR ─────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-ink-950/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link href="/" aria-label="İNŞPRO ana sayfa" className="leading-none">
            <span className="block text-3xl font-black tracking-tight sm:text-4xl">
              <span
                style={{
                  background: "linear-gradient(180deg,#eaf5ff 0%,#7cc0ff 38%,#2b8eff 64%,#15539c 100%)",
                  WebkitBackgroundClip: "text",
                  backgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  WebkitTextStroke: "0.6px #1d4ed8",
                  filter: "drop-shadow(0 2px 1px rgba(0,0,0,.35)) drop-shadow(0 4px 6px rgba(0,0,0,.25))",
                }}
              >
                İNŞ
              </span>
              <span
                style={{
                  background: "linear-gradient(180deg,#fff7d6 0%,#ffd24d 42%,#e0a300 70%,#9c6f00 100%)",
                  WebkitBackgroundClip: "text",
                  backgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  WebkitTextStroke: "0.6px #a87900",
                  filter: "drop-shadow(0 2px 1px rgba(0,0,0,.35)) drop-shadow(0 4px 6px rgba(0,0,0,.25))",
                }}
              >
                PRO
              </span>
            </span>
            <span className="mt-1 block text-[9px] font-bold uppercase tracking-[0.2em] text-white/60 sm:text-[10px]">
              İnşaat ve Proje Takip Programı
            </span>
          </Link>
          <nav className="hidden items-center gap-8 text-sm font-medium text-slate-300 md:flex">
            <a href="#moduller" className="transition hover:text-white">
              Özellikler
            </a>
            <a href="#nasil" className="transition hover:text-white">
              Nasıl Çalışır?
            </a>
            <a href="#surec" className="transition hover:text-white">
              İnşaat Süreci
            </a>
            <a href="#mevzuat" className="transition hover:text-white">
              Mevzuat
            </a>
            <a href="#fiyat" className="transition hover:text-white">
              Fiyatlandırma
            </a>
            <a href="#sss" className="transition hover:text-white">
              SSS
            </a>
          </nav>
          <div className="flex items-center gap-3">
            <Link
              href="/panel"
              className="hidden rounded-lg border border-white/30 px-4 py-2 text-sm font-semibold text-white transition hover:border-white/60 hover:bg-white/10 sm:block"
            >
              Panele Git
            </Link>
            <Link
              href="/giris"
              className="hidden rounded-lg bg-brand-500 px-3 py-1.5 text-sm font-semibold text-white shadow-lg shadow-brand-500/25 transition hover:bg-brand-600 md:block"
            >
              GİRİŞ
            </Link>
          </div>
        </div>
      </header>

      {/* Mobil: GİRİŞ butonu menü çubuğunun hemen altında */}
      <div className="flex justify-end border-b border-white/10 bg-ink-950/95 px-4 py-2 backdrop-blur md:hidden">
        <Link
          href="/giris"
          className="rounded-lg bg-brand-500 px-3 py-1.5 text-sm font-semibold text-white shadow-lg shadow-brand-500/25 transition hover:bg-brand-600"
        >
          GİRİŞ
        </Link>
      </div>

      {/* ── HERO ───────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-gradient-to-b from-slate-200 via-slate-100 to-white text-ink-900">
        {/* arka plan dokusu */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-50"
          style={{
            backgroundImage:
              "radial-gradient(60rem 30rem at 80% -10%, rgba(37,99,235,0.10), transparent), radial-gradient(50rem 25rem at 10% 110%, rgba(148,163,184,0.30), transparent)",
          }}
        />
        <div className="relative mx-auto grid max-w-7xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:items-center lg:py-28">
          <div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/inspro-logo.png"
              alt="insPRO"
              className="mb-6 h-28 w-auto object-contain drop-shadow-2xl sm:h-36"
            />
            <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-brand-500/40 bg-brand-500/10 px-4 py-1.5 text-xs font-semibold text-brand-400">
              <span className="h-2 w-2 animate-pulse rounded-full bg-brand-500" />
              Yapay zeka destekli inşaat platformu
            </p>
            <h1 className="text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
              İnşaatın <span className="text-brand-500">tüm süreçleri</span>,
              <br />
              tek platformda.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-slate-600">
              Proje dosyanızı yükleyin: keşif-metraj çıksın, güncel fiyatlarla
              maliyet hesaplansın, riskler önceden görünsün. Kazıdan teslime yol
              haritası, sahadan fotoğraflı takip ve tam muhasebe — web ve
              mobilde.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link
                href="/giris"
                className="rounded-xl bg-brand-500 px-7 py-3.5 text-base font-bold text-white shadow-xl shadow-brand-500/30 transition hover:bg-brand-600"
              >
                Ücretsiz Başla →
              </Link>
              <a
                href="#nasil"
                className="rounded-xl border border-slate-300 px-7 py-3.5 text-base font-semibold text-ink-900 transition hover:border-slate-400 hover:bg-slate-100"
              >
                Nasıl çalışır?
              </a>
            </div>
            <div className="mt-10 flex flex-wrap gap-x-8 gap-y-3 text-sm text-slate-500">
              <span>✓ Web + iOS + Android</span>
              <span>✓ PDF & DXF proje analizi</span>
              <span>✓ Türkiye geneli fiyat ajanı</span>
            </div>
          </div>

          {/* sahte panel önizlemesi (saf CSS) */}
          <div className="relative" aria-hidden>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl shadow-slate-300/40">
              <div className="mb-4 flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-700">
                  Gökkuşağı Konutları — A Blok
                </span>
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                  Kaba yapı · %62
                </span>
              </div>
              <div className="mb-4 h-2 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full w-[62%] rounded-full bg-gradient-to-r from-brand-500 to-sky-300" />
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                {[
                  ["Keşif Maliyeti", "₺48,2M"],
                  ["Gerçekleşen", "₺29,7M"],
                  ["Sapma", "−%1,8"],
                ].map(([k, v]) => (
                  <div
                    key={k}
                    className="rounded-xl border border-slate-200 bg-slate-50 p-3"
                  >
                    <div className="text-[11px] text-slate-500">{k}</div>
                    <div className="mt-1 text-base font-bold text-ink-900">
                      {v}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 rounded-xl border border-brand-500/30 bg-brand-500/10 p-3 text-xs leading-relaxed text-slate-700">
                <span className="font-bold text-brand-600">🧠 AI Uyarısı:</span>{" "}
                Önümüzdeki hafta don bekleniyor — C30 döşeme betonunu perşembeye
                çekmeniz ve kür süresini uzatmanız önerilir.
              </div>
              <div className="mt-3 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-500/15 text-base">
                  📸
                </div>
                <div className="text-xs text-slate-600">
                  <div className="font-semibold text-ink-900">
                    3. kat kolon demiri — onay bekliyor
                  </div>
                  Saha: M. Yılmaz · 14:32
                </div>
              </div>
            </div>
            <div className="absolute -bottom-5 -left-5 -z-10 h-full w-full rounded-2xl border border-brand-500/30" />
          </div>
        </div>
      </section>

      {/* ── İSTATİSTİK ŞERİDİ ──────────────────────────────── */}
      <section className="border-y border-slate-200 bg-white">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-px bg-slate-200 sm:grid-cols-4">
          {ISTATISTIKLER.map((s) => (
            <div key={s.etiket} className="bg-white px-4 py-8 text-center">
              <div className="text-3xl font-extrabold text-brand-600 sm:text-4xl">{s.sayi}</div>
              <div className="mt-1 text-xs font-semibold text-slate-500 sm:text-sm">{s.etiket}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── MODÜLLER ───────────────────────────────────────── */}
      <section id="moduller" className="scroll-mt-20 py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-extrabold tracking-tight text-ink-900 sm:text-4xl">
              Projeden teslime, <span className="text-brand-600">9 modül</span>
            </h2>
            <p className="mt-4 text-lg text-slate-600">
              Ayrı ayrı program kullanmayı bırakın. Keşiften muhasebeye her şey
              birbirine bağlı çalışır.
            </p>
          </div>
          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {MODULES.map((m) => (
              <div
                key={m.title}
                className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:border-brand-500/40 hover:shadow-lg"
              >
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-ink-900 text-2xl shadow-md transition group-hover:bg-brand-500">
                  {m.icon}
                </div>
                <h3 className="text-lg font-bold text-ink-900">{m.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  {m.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── NASIL ÇALIŞIR ──────────────────────────────────── */}
      <section id="nasil" className="scroll-mt-20 bg-slate-50 py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-extrabold tracking-tight text-ink-900 sm:text-4xl">
              4 adımda çalışan bir sistem
            </h2>
            <p className="mt-4 text-lg text-slate-600">
              Karmaşık yazılım eğitimleri yok — projenizi yükleyin, gerisini
              birlikte yürütelim.
            </p>
          </div>
          <div className="mt-14 grid gap-8 md:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s, i) => (
              <div key={s.no} className="relative">
                {i < STEPS.length - 1 && (
                  <div
                    aria-hidden
                    className="absolute left-full top-7 hidden h-px w-8 -translate-x-4 bg-slate-300 lg:block"
                  />
                )}
                <div className="text-5xl font-extrabold text-brand-500/20">
                  {s.no}
                </div>
                <h3 className="mt-2 text-lg font-bold text-ink-900">
                  {s.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  {s.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SÜREÇ ŞERİDİ ───────────────────────────────────── */}
      <section
        id="surec"
        className="scroll-mt-20 bg-slate-100 py-20 text-ink-900 sm:py-24"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
              Kazıdan teslime{" "}
              <span className="text-brand-600">13 aşama</span>, hiçbiri atlanmaz
            </h2>
            <p className="mt-4 text-lg text-slate-600">
              Her aşamanın sorumlusu, takvimi, fotoğraflı saha kaydı ve maliyeti
              tek zaman çizelgesinde.
            </p>
          </div>
          <ol className="mt-14 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {PHASES.map((p, i) => (
              <li
                key={p}
                className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 transition hover:border-brand-500/50 hover:bg-slate-50"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-500 text-sm font-extrabold text-white">
                  {i + 1}
                </span>
                <span className="text-sm font-semibold text-slate-700">
                  {p}
                </span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── MEVZUAT / YÖNETMELİK ───────────────────────────── */}
      <section id="mevzuat" className="scroll-mt-20 py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full bg-sky-100 px-4 py-1.5 text-xs font-bold text-sky-700">
              📚 mk_ai · mevzuat destekli
            </span>
            <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-ink-900 sm:text-4xl">
              İnşaat mevzuatı <span className="text-brand-600">parmaklarınızın ucunda</span>
            </h2>
            <p className="mt-4 text-lg text-slate-600">
              mk_ai; deprem, yangın, otopark, erişilebilirlik, enerji ve yapı denetimi
              gibi konularda <b>kaynak göstererek</b> yanıt verir. İşte bilgi tabanından örnekler:
            </p>
          </div>
          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {MEVZUAT_VITRIN.map((id) => {
              const m = YONETMELIK.find((y) => y.id === id);
              if (!m) return null;
              const ozet = m.metin.length > 180 ? m.metin.slice(0, 178) + "…" : m.metin;
              return (
                <div key={m.id} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-sky-300 hover:shadow-lg">
                  <h3 className="text-base font-bold text-ink-900">{m.baslik}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{ozet}</p>
                  <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-[11px] font-bold text-slate-600">
                    📑 {m.kaynak}
                  </div>
                </div>
              );
            })}
          </div>
          <p className="mx-auto mt-8 max-w-2xl text-center text-xs leading-relaxed text-slate-400">
            ⚠️ Özetler bilgilendirme amaçlıdır; uygulamadan önce resmî güncel metinle
            (mevzuat.gov.tr / ÇŞB) teyit edin. Sağ alttaki <b>mk&apos;ye Sor</b> balonundan hemen deneyebilirsiniz.
          </p>
        </div>
      </section>

      {/* ── MOBİL ──────────────────────────────────────────── */}
      <section className="overflow-hidden bg-slate-50 py-20 sm:py-24">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-brand-500/10 px-4 py-1.5 text-xs font-bold text-brand-600">
              📱 iOS & Android
            </span>
            <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-ink-900 sm:text-4xl">
              Şantiye cebinizde, ofis masanızda
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-slate-600">
              Saha ekibi fotoğrafı, puantajı ve iş emrini telefondan girer; ofis web
              panelinden anında görür. Tek hesap, her cihazda senkron.
            </p>
            <ul className="mt-6 space-y-3 text-sm text-slate-700">
              {[
                "Fotoğraflı saha kaydı ve kusur takibi",
                "Mobil puantaj — usta/işçi günlük giriş",
                "Yol haritası ilerlemesi ve onay akışı",
                "mk_ai'ye her yerden soru sorma",
              ].map((f) => (
                <li key={f} className="flex items-start gap-2.5">
                  <span className="mt-0.5 font-bold text-brand-500">✓</span>{f}
                </li>
              ))}
            </ul>
          </div>
          <div className="flex justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/mobil.png"
              alt="insPRO mobil uygulama"
              className="max-h-[520px] w-auto rounded-3xl object-contain drop-shadow-2xl"
            />
          </div>
        </div>
      </section>

      {/* ── FİYATLANDIRMA ──────────────────────────────────── */}
      <section id="fiyat" className="scroll-mt-20 py-20 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-extrabold tracking-tight text-ink-900 sm:text-4xl">
              Basit ve şeffaf fiyatlandırma
            </h2>
            <p className="mt-4 text-lg text-slate-600">
              Ücretsiz başlayın; işiniz büyüdükçe yükseltin. Sürpriz yok.
            </p>
          </div>
          <div className="mt-14 grid gap-8 lg:grid-cols-3">
            {TIERS.map((t) => (
              <div
                key={t.name}
                className={
                  t.highlight
                    ? "relative rounded-2xl border-2 border-brand-500 bg-ink-950 p-8 text-white shadow-2xl shadow-brand-500/10"
                    : "rounded-2xl border border-slate-200 bg-white p-8 shadow-sm"
                }
              >
                {t.highlight && (
                  <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-brand-500 px-4 py-1 text-xs font-bold text-white">
                    EN POPÜLER
                  </span>
                )}
                <h3
                  className={`text-lg font-bold ${t.highlight ? "text-brand-400" : "text-ink-900"}`}
                >
                  {t.name}
                </h3>
                <div className="mt-3 flex items-baseline gap-2">
                  <span
                    className={`text-3xl font-extrabold ${t.highlight ? "text-white" : "text-ink-900"}`}
                  >
                    {t.price}
                  </span>
                  {t.period && (
                    <span
                      className={`text-sm ${t.highlight ? "text-slate-400" : "text-slate-500"}`}
                    >
                      {t.period}
                    </span>
                  )}
                </div>
                <p
                  className={`mt-2 text-sm ${t.highlight ? "text-slate-300" : "text-slate-600"}`}
                >
                  {t.desc}
                </p>
                <ul
                  className={`mt-6 space-y-3 text-sm ${t.highlight ? "text-slate-200" : "text-slate-700"}`}
                >
                  {t.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5">
                      <span className="mt-0.5 font-bold text-brand-500">✓</span>
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/giris"
                  className={
                    t.highlight
                      ? "mt-8 block rounded-xl bg-brand-500 py-3 text-center text-sm font-bold text-white transition hover:bg-brand-600"
                      : "mt-8 block rounded-xl border-2 border-ink-900 py-3 text-center text-sm font-bold text-ink-900 transition hover:bg-ink-900 hover:text-white"
                  }
                >
                  {t.cta}
                </Link>
              </div>
            ))}
          </div>
          <p className="mt-8 text-center text-sm text-slate-500">
            Mobil abonelikler App Store / Google Play üzerinden, web abonelikleri
            kartla güvenli ödeme ile yönetilir.
          </p>
        </div>
      </section>

      {/* ── SSS ────────────────────────────────────────────── */}
      <section id="sss" className="scroll-mt-20 bg-slate-50 py-20 sm:py-24">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <h2 className="text-center text-3xl font-extrabold tracking-tight text-ink-900 sm:text-4xl">
            Sık sorulan sorular
          </h2>
          <div className="mt-12 space-y-4">
            {FAQS.map((f) => (
              <details
                key={f.q}
                className="group rounded-2xl border border-slate-200 bg-white px-6 py-5 shadow-sm"
              >
                <summary className="flex cursor-pointer items-center justify-between gap-4 font-semibold text-ink-900">
                  {f.q}
                  <span className="faq-chevron shrink-0 text-brand-500 transition-transform">
                    ▾
                  </span>
                </summary>
                <p className="mt-4 text-sm leading-relaxed text-slate-600">
                  {f.a}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ── KAPANIŞ CTA ────────────────────────────────────── */}
      <section className="bg-slate-100 py-20 text-center text-ink-900 sm:py-24">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
            Bir sonraki projenizi{" "}
            <span className="text-brand-600">insPRO</span> ile başlatın
          </h2>
          <p className="mt-4 text-lg text-slate-600">
            Keşiften muhasebeye, ofisten şantiyeye. Ücretsiz planla bugün
            deneyin — kurulum gerektirmez.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/kayit"
              className="rounded-xl bg-brand-500 px-8 py-4 text-base font-bold text-white shadow-xl shadow-brand-500/30 transition hover:bg-brand-600"
            >
              Ücretsiz Hesap Oluştur
            </Link>
            <span className="text-sm text-slate-500">
              Kredi kartı gerekmez · 2 dakikada kurulum
            </span>
          </div>
        </div>
      </section>

      {/* ── FOOTER ─────────────────────────────────────────── */}
      <footer className="border-t border-slate-200 bg-white py-12 text-sm text-slate-500">
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-6 px-4 sm:px-6 md:flex-row md:justify-between">
          <div className="flex flex-col items-center gap-2 md:items-start">
            <Logo />
            <p className="max-w-xs text-center text-xs leading-relaxed text-slate-500 md:text-left">
              İnşaatın tüm süreçlerini tek platformda yöneten yapay zeka
              destekli web ve mobil uygulama.
            </p>
          </div>
          <nav className="flex flex-wrap justify-center gap-x-6 gap-y-2">
            <a href="#moduller" className="transition hover:text-ink-900">
              Özellikler
            </a>
            <a href="#fiyat" className="transition hover:text-ink-900">
              Fiyatlandırma
            </a>
            <a href="#sss" className="transition hover:text-ink-900">
              SSS
            </a>
            <a href="#" className="transition hover:text-ink-900">
              Gizlilik
            </a>
            <a href="#" className="transition hover:text-ink-900">
              İletişim
            </a>
          </nav>
          <p className="text-xs text-slate-600">
            © {new Date().getFullYear()} insPRO. Tüm hakları saklıdır.
          </p>
        </div>
      </footer>

    </main>
  );
}
