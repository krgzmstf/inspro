"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { type Rol, ROL_ETIKET, ROL_MENU, MENU_SECENEKLERI, yetkiGetir, VARSAYILAN_PROJE_LIMITI } from "@/lib/rol";
import { supabaseVar } from "@/lib/supabase/auth";
import {
  ozetGetir, kullanicilariGetir, kullaniciGuncelle, kullaniciDuzenle, kullaniciOlustur,
  kullaniciAktif, kullaniciSil as kullaniciSilApi, veriGetir, veriSilApi,
  projeGetir, projeGuncelle,
} from "@/lib/yonetimApi";
import { TYPE_LABELS, type ProjectType } from "@/lib/projects";
import { ayarGetir, ayarYaz, MENU_KATALOG, type MenuAyar, type SiteAyar } from "@/lib/ayar";
import { Spinner, Donut, AylikFinansGrafik, YatayBarlar, type DilimVeri } from "./grafikler";

const ROL_RENK: Record<Rol, string> = { yonetici: "#2563eb", sefi: "#f59e0b", taseron: "#10b981", muhasebeci: "#8b5cf6" };
const TIP_RENK: Record<string, string> = { konut: "#3b82f6", villa: "#f59e0b", ticari: "#10b981", diger: "#94a3b8" };
const TIP_ETIKET: Record<string, string> = { konut: "Konut", villa: "Villa", ticari: "Ticari", diger: "Diğer" };
const SAYFA_BOYUT = 10;

interface Kullanici {
  id: string; email: string; ad_soyad: string; firma: string;
  rol: Rol; yetkiler: string[] | null; proje_limiti?: number | null;
  aktif?: boolean; created_at: string; son_giris: string | null;
}

interface Ozet {
  surum: string;
  ortam: string;
  sayilar: { kullanici: number; proje: number; muhasebe: number; modul: number; dosya: number };
  dosya_boyut_bayt: number;
  rol_dagilimi: Record<string, number>;
  proje_tip: Record<string, number>;
  aylik_finans: { ay: string; gelir: number; gider: number }[];
}

interface VeriSatir { id: string; owner_id: string; owner_email?: string; baslik: string; ek?: string; created_at?: string | null }

const ROLLER: Rol[] = ["yonetici", "sefi", "taseron", "muhasebeci"];

const ROL_ACIKLAMA: Record<Rol, string> = {
  yonetici: "Her şey + SADECE yönetici proje (dosya) oluşturur",
  sefi: "Şantiye şefi — iş süreçleri, saha, metraj (yöneticinin verdiği)",
  taseron: "Taşeron — iş süreçleri ve saha (yöneticinin verdiği)",
  muhasebeci: "Personel, muhasebe, genel muhasebe, teklif, hakediş — tutarları düzenler",
};

const SEKMELER = [
  { id: "genel", etiket: "Genel", ikon: "📊" },
  { id: "kullanicilar", etiket: "Kullanıcılar", ikon: "👥" },
  { id: "veriler", etiket: "Veriler", ikon: "🗄️" },
  { id: "menu", etiket: "Menü", ikon: "🧭" },
  { id: "site", etiket: "Site", ikon: "🎨" },
] as const;
type SekmeId = (typeof SEKMELER)[number]["id"];

const VERI_TIPLERI = [
  { tip: "projeler", etiket: "Projeler", ikon: "🏗️" },
  { tip: "muhasebe", etiket: "Muhasebe", ikon: "🧾" },
  { tip: "modul", etiket: "Modül Verileri", ikon: "🗂️" },
  { tip: "dosyalar", etiket: "Dosyalar", ikon: "🖼️" },
];

function boyutBicim(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

export default function YonetimPage() {
  const [superAdmin, setSuperAdmin] = useState(false);
  const [hazir, setHazir] = useState(false);
  const [sekme, setSekme] = useState<SekmeId>("genel");
  const [hata, setHata] = useState("");
  const [mesaj, setMesaj] = useState("");

  // Genel
  const [ozet, setOzet] = useState<Ozet | null>(null);
  const [saglik, setSaglik] = useState<boolean | null>(null);

  // Kullanıcılar
  const [kullanicilar, setKullanicilar] = useState<Kullanici[]>([]);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [acikIzin, setAcikIzin] = useState<string | null>(null);
  const [acikDuzen, setAcikDuzen] = useState<string | null>(null);
  const [duzen, setDuzen] = useState({ ad_soyad: "", firma: "", proje_limiti: "" });
  const [yeniK, setYeniK] = useState({ email: "", ad_soyad: "", firma: "", rol: "sefi" as Rol });

  // Veriler
  const [veriTip, setVeriTip] = useState("projeler");
  const [veriler, setVeriler] = useState<VeriSatir[]>([]);
  const [veriYukleniyor, setVeriYukleniyor] = useState(false);
  const [arama, setArama] = useState("");
  const [siralama, setSiralama] = useState<{ alan: "baslik" | "ek"; yon: 1 | -1 }>({ alan: "baslik", yon: 1 });
  const [sayfa, setSayfa] = useState(1);

  // Proje inceleme/düzenleme modalı
  const [inceleAcik, setInceleAcik] = useState(false);
  const [inceleYuk, setInceleYuk] = useState(false);
  const [inceleMeta, setInceleMeta] = useState<{ owner: string; id: string; email: string; createdAt?: string; phases: { name: string; status: string }[]; binaOzet: string } | null>(null);
  const [inceleForm, setInceleForm] = useState({ name: "", city: "", type: "konut" as ProjectType, area: "", floors: "", budget: "" });

  // Menü
  const [menuAyar, setMenuAyar] = useState<MenuAyar>({ gizli: [], etiket: {}, sira: [] });

  // Site
  const [site, setSite] = useState<SiteAyar>({});

  useEffect(() => {
    yetkiGetir().then((y) => { setSuperAdmin(y.superAdmin); setHazir(true); });
    yukleKullanicilar();
    ozetGetir().then((o) => { setOzet(o); setSaglik(true); }).catch(() => setSaglik(false));
    ayarGetir<MenuAyar>("menu", { gizli: [], etiket: {}, sira: [] }).then((m) =>
      setMenuAyar({ gizli: m.gizli ?? [], etiket: m.etiket ?? {}, sira: m.sira ?? [] }));
    ayarGetir<SiteAyar>("site", {}).then(setSite);
  }, []);

  useEffect(() => {
    if (sekme === "veriler") yukleVeri(veriTip);
  }, [sekme, veriTip]);

  // Veri tipi/arama değişince ilk sayfaya dön
  useEffect(() => { setSayfa(1); }, [veriTip, arama]);

  // Toast otomatik kaybolma
  useEffect(() => {
    if (!mesaj && !hata) return;
    const t = setTimeout(() => { setMesaj(""); setHata(""); }, 5000);
    return () => clearTimeout(t);
  }, [mesaj, hata]);

  // Aranan + sıralı + sayfalı veri
  const filtreliVeri = veriler
    .filter((r) => {
      const q = arama.trim().toLocaleLowerCase("tr");
      return !q || r.baslik.toLocaleLowerCase("tr").includes(q) || (r.ek ?? "").toLocaleLowerCase("tr").includes(q);
    })
    .sort((a, b) => {
      const va = (a[siralama.alan] ?? "").toString();
      const vb = (b[siralama.alan] ?? "").toString();
      return va.localeCompare(vb, "tr") * siralama.yon;
    });
  const sayfaSayisi = Math.max(1, Math.ceil(filtreliVeri.length / SAYFA_BOYUT));
  const sayfaliVeri = filtreliVeri.slice((sayfa - 1) * SAYFA_BOYUT, sayfa * SAYFA_BOYUT);
  function siralamaDegis(alan: "baslik" | "ek") {
    setSiralama((s) => s.alan === alan ? { alan, yon: (s.yon === 1 ? -1 : 1) } : { alan, yon: 1 });
  }

  // ── Kullanıcılar ──
  async function yukleKullanicilar() {
    setYukleniyor(true); setHata("");
    try {
      const data = await kullanicilariGetir();
      setKullanicilar((data.users ?? []) as Kullanici[]);
    } catch (e) { setHata((e as Error).message); }
    finally { setYukleniyor(false); }
  }

  async function rolKaydet(id: string, rol: Rol, yetkiler: string[] | null | undefined) {
    setMesaj(""); setHata("");
    setKullanicilar((list) => list.map((k) => (k.id === id ? { ...k, rol, ...(yetkiler !== undefined ? { yetkiler } : {}) } : k)));
    try {
      await kullaniciGuncelle(id, rol, yetkiler);
      setMesaj("✓ Kaydedildi.");
    } catch (e) { setHata((e as Error).message); yukleKullanicilar(); }
  }

  async function kullaniciEkle() {
    setMesaj(""); setHata("");
    if (!yeniK.email.includes("@")) { setHata("Geçerli bir e-posta girin."); return; }
    try {
      const r = await kullaniciOlustur(yeniK);
      const mail = yeniK.email;
      setYeniK({ email: "", ad_soyad: "", firma: "", rol: "sefi" });
      setMesaj(`✓ ${mail} eklendi. Geçici şifre: ${r.gecici_sifre} — kişiye iletin, ilk girişte değiştirebilir.`);
      yukleKullanicilar();
    } catch (e) { setHata((e as Error).message); }
  }

  async function aktifDegistir(k: Kullanici) {
    try { await kullaniciAktif(k.id, !(k.aktif ?? true)); yukleKullanicilar(); }
    catch (e) { setHata((e as Error).message); }
  }

  async function kullaniciSil(k: Kullanici) {
    if (!confirm(`${k.email} silinsin mi? Bu kişinin tüm verileri de silinir.`)) return;
    try { await kullaniciSilApi(k.id); setMesaj("✓ Silindi."); yukleKullanicilar(); }
    catch (e) { setHata((e as Error).message); }
  }

  function etkinIzinler(k: Kullanici): string[] {
    if (k.yetkiler && k.yetkiler.length > 0) return k.yetkiler;
    const v = ROL_MENU[k.rol];
    return v === "*" ? MENU_SECENEKLERI.map((m) => m.href) : v;
  }
  function izinToggle(k: Kullanici, href: string) {
    const mevcut = etkinIzinler(k);
    const yeni = mevcut.includes(href) ? mevcut.filter((h) => h !== href) : [...mevcut, href];
    rolKaydet(k.id, k.rol, yeni);
  }

  // ── Üye bilgileri / proje limiti düzenleme ──
  function duzenAc(k: Kullanici) {
    if (acikDuzen === k.id) { setAcikDuzen(null); return; }
    setAcikIzin(null);
    setDuzen({
      ad_soyad: k.ad_soyad ?? "",
      firma: k.firma ?? "",
      proje_limiti: k.proje_limiti == null ? "" : String(k.proje_limiti),
    });
    setAcikDuzen(k.id);
  }
  async function duzenKaydet(id: string) {
    setMesaj(""); setHata("");
    const ham = duzen.proje_limiti.trim();
    let limit: number | null = null;
    if (ham !== "") {
      const n = parseInt(ham, 10);
      if (Number.isNaN(n) || n < 0) { setHata("Proje limiti 0 veya pozitif bir sayı olmalı (0 = sınırsız, boş = varsayılan)."); return; }
      limit = n;
    }
    try {
      await kullaniciDuzenle(id, { ad_soyad: duzen.ad_soyad.trim(), firma: duzen.firma.trim(), proje_limiti: limit });
      setMesaj("✓ Bilgiler kaydedildi.");
      setAcikDuzen(null);
      yukleKullanicilar();
    } catch (e) { setHata((e as Error).message); }
  }
  function limitEtiket(l: number | null | undefined): string {
    if (l == null) return `varsayılan (${VARSAYILAN_PROJE_LIMITI})`;
    return l === 0 ? "sınırsız" : String(l);
  }

  // ── Veriler ──
  async function yukleVeri(tip: string) {
    setVeriYukleniyor(true); setHata("");
    try {
      const d = await veriGetir(tip);
      setVeriler((d.satirlar ?? []) as VeriSatir[]);
    } catch (e) { setHata((e as Error).message); setVeriler([]); }
    finally { setVeriYukleniyor(false); }
  }
  async function veriSil(tip: string, id: string) {
    if (!confirm("Bu kayıt kalıcı olarak silinsin mi?")) return;
    try { await veriSilApi(tip, id); yukleVeri(tip); setMesaj("✓ Silindi."); }
    catch (e) { setHata((e as Error).message); }
  }

  // ── Proje incele / düzenle (süper admin, sahibi fark etmeksizin) ──
  async function inceleAc(r: VeriSatir) {
    setInceleAcik(true); setInceleYuk(true); setHata("");
    setInceleMeta(null);
    try {
      const { proje, owner_email } = await projeGetir(r.owner_id, r.id);
      const p = proje as Record<string, unknown>;
      const bina = (p.bina ?? {}) as Record<string, unknown>;
      const binaOzet = [
        p.floors != null ? `${p.floors} kat` : "",
        bina.toplamDaire != null ? `${bina.toplamDaire} bağımsız bölüm` : "",
        Array.isArray(p.katlar) ? `${(p.katlar as unknown[]).length} kat planı` : "",
      ].filter(Boolean).join(" · ") || "—";
      setInceleMeta({
        owner: r.owner_id, id: r.id, email: owner_email || r.owner_email || "",
        createdAt: p.createdAt as string | undefined,
        phases: Array.isArray(p.phases) ? (p.phases as { name: string; status: string }[]) : [],
        binaOzet,
      });
      setInceleForm({
        name: (p.name as string) ?? "",
        city: (p.city as string) ?? "",
        type: ((p.type as ProjectType) ?? "konut"),
        area: p.area != null ? String(p.area) : "",
        floors: p.floors != null ? String(p.floors) : "",
        budget: p.budget != null ? String(p.budget) : "",
      });
    } catch (e) { setHata((e as Error).message); setInceleAcik(false); }
    finally { setInceleYuk(false); }
  }
  async function inceleKaydet() {
    if (!inceleMeta) return;
    setHata("");
    const alanlar: Record<string, unknown> = {
      name: inceleForm.name.trim(),
      city: inceleForm.city.trim(),
      type: inceleForm.type,
    };
    const area = parseFloat(inceleForm.area); if (!Number.isNaN(area)) alanlar.area = area;
    const floors = parseInt(inceleForm.floors, 10); if (!Number.isNaN(floors)) alanlar.floors = floors;
    const b = inceleForm.budget.trim(); alanlar.budget = b === "" ? null : parseFloat(b);
    try {
      await projeGuncelle(inceleMeta.owner, inceleMeta.id, alanlar);
      setMesaj("✓ Proje güncellendi.");
      setInceleAcik(false);
      yukleVeri(veriTip);
    } catch (e) { setHata((e as Error).message); }
  }

  // ── Menü ──
  function menuGizliToggle(href: string) {
    setMenuAyar((m) => {
      const gizli = new Set(m.gizli ?? []);
      if (gizli.has(href)) gizli.delete(href); else gizli.add(href);
      return { ...m, gizli: [...gizli] };
    });
  }
  function menuEtiket(href: string, deger: string) {
    setMenuAyar((m) => ({ ...m, etiket: { ...(m.etiket ?? {}), [href]: deger } }));
  }
  async function menuKaydet() {
    setMesaj(""); setHata("");
    try { await ayarYaz("menu", menuAyar); setMesaj("✓ Menü kaydedildi. (Sayfayı yenileyince herkeste güncellenir.)"); }
    catch (e) { setHata((e as Error).message); }
  }

  // ── Site ──
  async function siteKaydet() {
    setMesaj(""); setHata("");
    try { await ayarYaz("site", site); setMesaj("✓ Site ayarları kaydedildi."); }
    catch (e) { setHata((e as Error).message); }
  }

  // ── Kapılar ──
  if (!supabaseVar()) {
    return (
      <div className="mx-auto max-w-3xl">
        <h1 className="text-2xl font-extrabold text-slate-900">⚙️ Yönetim Merkezi</h1>
        <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700">
          Backend bağlı değil. Yönetim için e-posta ile giriş gerekir.
        </p>
      </div>
    );
  }
  if (hazir && !superAdmin) {
    return (
      <div className="mx-auto max-w-3xl">
        <h1 className="text-2xl font-extrabold text-slate-900">⚙️ Yönetim Merkezi</h1>
        <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">
          Bu sayfaya yalnızca <b>süper admin</b> erişebilir.
        </p>
        <Link href="/panel" className="mt-4 inline-block text-sm font-semibold text-slate-500 hover:text-ink-800">← Panele dön</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">⚙️ Yönetim Merkezi</h1>
          <p className="mt-1 text-sm text-slate-500">Backend&apos;in tamamını kodsuz yönet: kullanıcılar, veriler, menü ve site.</p>
        </div>
        <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${saglik ? "bg-emerald-50 text-emerald-700" : saglik === false ? "bg-red-50 text-red-600" : "bg-slate-100 text-slate-400"}`}>
          <span className={`h-2 w-2 rounded-full ${saglik ? "animate-pulse bg-emerald-500" : saglik === false ? "bg-red-500" : "bg-slate-300"}`} />
          {saglik ? "Backend bağlı" : saglik === false ? "Backend kapalı" : "Kontrol…"}
        </span>
      </div>

      {/* Sekmeler */}
      <div className="mt-5 flex flex-wrap gap-1.5 border-b border-slate-200">
        {SEKMELER.map((s) => (
          <button key={s.id} onClick={() => { setSekme(s.id); setMesaj(""); setHata(""); }}
            className={`rounded-t-lg px-4 py-2 text-sm font-bold transition ${sekme === s.id ? "border-b-2 border-brand-500 text-brand-600" : "text-slate-500 hover:text-slate-800"}`}>
            {s.ikon} {s.etiket}
          </button>
        ))}
      </div>

      {/* Toast bildirimleri (sağ altta, otomatik kaybolur) */}
      {(mesaj || hata) && (
        <div className="fixed bottom-5 right-5 z-50 max-w-sm animate-[toastIn_0.25s_ease-out]">
          {mesaj && (
            <div className="mb-2 flex items-start gap-2 rounded-xl border border-emerald-200 bg-white px-4 py-3 text-sm font-semibold text-emerald-700 shadow-lg">
              <span>✓</span><span className="flex-1">{mesaj}</span>
              <button onClick={() => setMesaj("")} className="text-emerald-400 hover:text-emerald-700">✕</button>
            </div>
          )}
          {hata && (
            <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-white px-4 py-3 text-sm font-semibold text-red-600 shadow-lg">
              <span>⚠</span><span className="flex-1">{hata}</span>
              <button onClick={() => setHata("")} className="text-red-400 hover:text-red-700">✕</button>
            </div>
          )}
        </div>
      )}
      <style>{`@keyframes toastIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}`}</style>

      {/* ── GENEL ── */}
      {sekme === "genel" && (
        <div className="mt-5">
          {ozet ? (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {[
                  { etiket: "Kullanıcı", deger: ozet.sayilar.kullanici, ikon: "👤", renk: "from-blue-500 to-blue-600" },
                  { etiket: "Proje", deger: ozet.sayilar.proje, ikon: "🏗️", renk: "from-amber-500 to-orange-600" },
                  { etiket: "Muhasebe", deger: ozet.sayilar.muhasebe, ikon: "🧾", renk: "from-emerald-500 to-green-600" },
                  { etiket: "Modül Verisi", deger: ozet.sayilar.modul, ikon: "🗂️", renk: "from-violet-500 to-purple-600" },
                  { etiket: "Dosya", deger: ozet.sayilar.dosya, ikon: "🖼️", alt: boyutBicim(ozet.dosya_boyut_bayt), renk: "from-rose-500 to-pink-600" },
                ].map((k) => (
                  <div key={k.etiket} className="rounded-xl border border-sky-200 bg-[#f2f8fd] p-3 shadow-sm">
                    <div className={`flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br ${k.renk} text-base`}>{k.ikon}</div>
                    <div className="mt-2 text-2xl font-extrabold text-ink-900">{k.deger}</div>
                    <div className="text-[11px] font-semibold text-slate-500">{k.etiket}{k.alt ? ` · ${k.alt}` : ""}</div>
                  </div>
                ))}
              </div>
              <div className="mt-4 grid gap-3 lg:grid-cols-2">
                <Donut baslik="ROL DAĞILIMI"
                  veri={ROLLER.map((r): DilimVeri => ({ etiket: ROL_ETIKET[r], deger: ozet.rol_dagilimi[r] ?? 0, renk: ROL_RENK[r] }))} />
                <YatayBarlar baslik="PROJE TİPİ DAĞILIMI"
                  veri={Object.keys(TIP_ETIKET).map((t): DilimVeri => ({ etiket: TIP_ETIKET[t], deger: ozet.proje_tip?.[t] ?? 0, renk: TIP_RENK[t] }))} />
              </div>
              <div className="mt-3">
                <AylikFinansGrafik veri={ozet.aylik_finans ?? []} />
              </div>
              <p className="mt-3 text-[11px] text-slate-400">Sürüm v{ozet.surum} · ortam {ozet.ortam}</p>
            </>
          ) : <Spinner etiket="Özet yükleniyor…" />}
        </div>
      )}

      {/* ── KULLANICILAR ── */}
      {sekme === "kullanicilar" && (
        <div className="mt-5">
          {/* Yeni kullanıcı */}
          <div className="rounded-2xl border border-sky-200 bg-[#f2f8fd] p-4 shadow-sm">
            <div className="text-sm font-bold text-ink-900">➕ Yeni kullanıcı ekle</div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
              <input value={yeniK.email} onChange={(e) => setYeniK({ ...yeniK, email: e.target.value })} placeholder="e-posta" className="rounded-lg border-2 border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500" />
              <input value={yeniK.ad_soyad} onChange={(e) => setYeniK({ ...yeniK, ad_soyad: e.target.value })} placeholder="ad soyad" className="rounded-lg border-2 border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500" />
              <input value={yeniK.firma} onChange={(e) => setYeniK({ ...yeniK, firma: e.target.value })} placeholder="firma" className="rounded-lg border-2 border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500" />
              <select value={yeniK.rol} onChange={(e) => setYeniK({ ...yeniK, rol: e.target.value as Rol })} className="rounded-lg border-2 border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:border-brand-500">
                {ROLLER.map((r) => <option key={r} value={r}>{ROL_ETIKET[r]}</option>)}
              </select>
              <button onClick={kullaniciEkle} className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-brand-600">Ekle</button>
            </div>
          </div>

          {/* Roller açıklaması */}
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {ROLLER.map((r) => (
              <div key={r} className="rounded-xl border border-sky-200 bg-[#f2f8fd] p-3">
                <div className="text-xs font-bold text-ink-900">{ROL_ETIKET[r]}</div>
                <div className="mt-0.5 text-[11px] text-slate-500">{ROL_ACIKLAMA[r]}</div>
              </div>
            ))}
          </div>

          {yukleniyor ? (
            <div className="mt-6"><Spinner /></div>
          ) : kullanicilar.length === 0 ? (
            <p className="mt-6 rounded-2xl border-2 border-dashed border-slate-300 bg-white/60 p-8 text-center text-sm text-slate-500">Henüz kullanıcı yok.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {kullanicilar.map((k) => (
                <div key={k.id} className={`rounded-2xl border bg-white p-4 shadow-sm ${k.aktif === false ? "border-red-200 opacity-70" : "border-slate-200"}`}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-800">
                        {k.ad_soyad || "—"} <span className="text-[11px] font-normal text-slate-400">{k.email}</span>
                        {k.aktif === false && <span className="ml-2 rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-600">PASİF</span>}
                      </div>
                      <div className="text-[11px] text-slate-400">{k.firma || ""}{k.firma ? " · " : ""}kayıt {k.created_at?.slice(0, 10)} · proje limiti: <b className="text-slate-500">{limitEtiket(k.proje_limiti)}</b></div>
                    </div>
                    <div className="flex items-center gap-2">
                      <select value={k.rol} onChange={(e) => rolKaydet(k.id, e.target.value as Rol, undefined)}
                        className="rounded-lg border-2 border-sky-200 bg-[#f2f8fd] px-2 py-1 text-sm font-semibold outline-none focus:border-brand-500">
                        {ROLLER.map((r) => <option key={r} value={r}>{ROL_ETIKET[r]}</option>)}
                      </select>
                      {k.rol !== "yonetici" && (
                        <button onClick={() => setAcikIzin(acikIzin === k.id ? null : k.id)} className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-bold text-slate-600 hover:bg-slate-50">
                          {acikIzin === k.id ? "İzinleri gizle" : "Özel izinler"}
                        </button>
                      )}
                      <button onClick={() => duzenAc(k)} className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-bold text-slate-600 hover:bg-slate-50">
                        {acikDuzen === k.id ? "Kapat" : "✏️ Bilgiler"}
                      </button>
                      <button onClick={() => aktifDegistir(k)} className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-bold text-slate-600 hover:bg-slate-50">
                        {k.aktif === false ? "Aktifleştir" : "Pasifleştir"}
                      </button>
                      <button onClick={() => kullaniciSil(k)} className="rounded-lg border border-red-200 px-2.5 py-1 text-xs font-bold text-red-600 hover:bg-red-50">Sil</button>
                    </div>
                  </div>

                  {acikIzin === k.id && k.rol !== "yonetici" && (
                    <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50 p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-600">Bu kişinin görebileceği modüller</span>
                        {k.yetkiler && k.yetkiler.length > 0 && (
                          <button onClick={() => rolKaydet(k.id, k.rol, null)} className="text-[11px] font-semibold text-brand-600 hover:underline">Rol varsayılanına dön</button>
                        )}
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                        {MENU_SECENEKLERI.map((m) => {
                          const secili = etkinIzinler(k).includes(m.href);
                          return (
                            <label key={m.href} className="flex items-center gap-1.5 rounded-lg px-1.5 py-1 text-xs text-slate-700 hover:bg-white">
                              <input type="checkbox" checked={secili} onChange={() => izinToggle(k, m.href)} className="h-3.5 w-3.5 accent-[var(--color-brand-500)]" />
                              {m.label}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {acikDuzen === k.id && (
                    <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50 p-3">
                      <div className="grid gap-2 sm:grid-cols-3">
                        <label className="text-xs font-semibold text-slate-600">Ad soyad
                          <input value={duzen.ad_soyad} onChange={(e) => setDuzen({ ...duzen, ad_soyad: e.target.value })}
                            className="mt-1 w-full rounded-lg border-2 border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-brand-500" />
                        </label>
                        <label className="text-xs font-semibold text-slate-600">Firma
                          <input value={duzen.firma} onChange={(e) => setDuzen({ ...duzen, firma: e.target.value })}
                            className="mt-1 w-full rounded-lg border-2 border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-brand-500" />
                        </label>
                        <label className="text-xs font-semibold text-slate-600">Proje limiti
                          <input value={duzen.proje_limiti} onChange={(e) => setDuzen({ ...duzen, proje_limiti: e.target.value })}
                            inputMode="numeric" placeholder={`varsayılan (${VARSAYILAN_PROJE_LIMITI})`}
                            className="mt-1 w-full rounded-lg border-2 border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-brand-500" />
                        </label>
                      </div>
                      <p className="mt-2 text-[11px] text-slate-400">
                        Proje limiti: <b>boş</b> = varsayılan ({VARSAYILAN_PROJE_LIMITI}) · <b>0</b> = sınırsız · <b>sayı</b> = en fazla o kadar proje. (Süper adminler her zaman sınırsızdır.)
                      </p>
                      <div className="mt-2 flex justify-end gap-2">
                        <button onClick={() => setAcikDuzen(null)} className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-bold text-slate-500 hover:bg-white">Vazgeç</button>
                        <button onClick={() => duzenKaydet(k.id)} className="rounded-lg bg-brand-500 px-4 py-1 text-xs font-bold text-white hover:bg-brand-600">Kaydet</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── VERİLER ── */}
      {sekme === "veriler" && (
        <div className="mt-5">
          <div className="flex flex-wrap gap-1.5">
            {VERI_TIPLERI.map((v) => (
              <button key={v.tip} onClick={() => setVeriTip(v.tip)}
                className={`rounded-lg px-3 py-1.5 text-sm font-bold transition ${veriTip === v.tip ? "bg-ink-900 text-white" : "border border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
                {v.ikon} {v.etiket}
              </button>
            ))}
          </div>
          {/* Arama */}
          <div className="mt-3 flex items-center gap-2">
            <div className="relative flex-1">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
              <input value={arama} onChange={(e) => setArama(e.target.value)} placeholder="Ara (başlık veya detay)…"
                className="w-full rounded-lg border-2 border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-brand-500" />
            </div>
            <span className="shrink-0 text-xs font-semibold text-slate-400">{filtreliVeri.length} kayıt</span>
          </div>

          {veriYukleniyor ? (
            <div className="mt-4"><Spinner /></div>
          ) : filtreliVeri.length === 0 ? (
            <p className="mt-4 rounded-2xl border-2 border-dashed border-slate-300 bg-white/60 p-8 text-center text-sm text-slate-500">
              {arama ? "Aramayla eşleşen kayıt yok." : "Kayıt yok."}
            </p>
          ) : (
            <>
              <div className="mt-3 overflow-hidden rounded-2xl border border-sky-200 bg-[#f2f8fd] shadow-sm">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-left text-[11px] uppercase text-slate-400">
                    <tr>
                      <th className="cursor-pointer select-none px-4 py-2 hover:text-slate-700" onClick={() => siralamaDegis("baslik")}>
                        Başlık {siralama.alan === "baslik" ? (siralama.yon === 1 ? "▲" : "▼") : ""}
                      </th>
                      <th className="cursor-pointer select-none px-4 py-2 hover:text-slate-700" onClick={() => siralamaDegis("ek")}>
                        Detay {siralama.alan === "ek" ? (siralama.yon === 1 ? "▲" : "▼") : ""}
                      </th>
                      <th className="px-4 py-2">Oluşturan</th>
                      <th className="px-4 py-2 text-right">İşlem</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {sayfaliVeri.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50">
                        <td className="px-4 py-2 font-semibold text-slate-800">{r.baslik}</td>
                        <td className="px-4 py-2 text-xs text-slate-500">{r.ek || ""}{r.created_at ? ` · ${r.created_at.slice(0, 10)}` : ""}</td>
                        <td className="px-4 py-2 text-xs text-slate-500">{r.owner_email || "—"}</td>
                        <td className="px-4 py-2 text-right">
                          <div className="flex justify-end gap-1.5">
                            {veriTip === "projeler" && (
                              <button onClick={() => inceleAc(r)} className="rounded-lg border border-brand-200 px-2.5 py-1 text-xs font-bold text-brand-600 hover:bg-brand-50">İncele</button>
                            )}
                            <button onClick={() => veriSil(veriTip, r.id)} className="rounded-lg border border-red-200 px-2.5 py-1 text-xs font-bold text-red-600 hover:bg-red-50">Sil</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Sayfalama */}
              {sayfaSayisi > 1 && (
                <div className="mt-3 flex items-center justify-center gap-2 text-sm">
                  <button disabled={sayfa <= 1} onClick={() => setSayfa((s) => s - 1)}
                    className="rounded-lg border border-slate-200 px-3 py-1 font-bold text-slate-600 disabled:opacity-40 hover:bg-slate-50">← Önceki</button>
                  <span className="text-xs font-semibold text-slate-500">{sayfa} / {sayfaSayisi}</span>
                  <button disabled={sayfa >= sayfaSayisi} onClick={() => setSayfa((s) => s + 1)}
                    className="rounded-lg border border-slate-200 px-3 py-1 font-bold text-slate-600 disabled:opacity-40 hover:bg-slate-50">Sonraki →</button>
                </div>
              )}
            </>
          )}
          <p className="mt-3 text-[11px] text-slate-400">💡 Buradaki kayıtlar tüm kullanıcılara aittir. Silme geri alınamaz.</p>
        </div>
      )}

      {/* ── MENÜ ── */}
      {sekme === "menu" && (
        <div className="mt-5">
          <div className="rounded-2xl border border-sky-200 bg-[#f2f8fd] p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="text-sm font-bold text-ink-900">🧭 Ana panel menüsü</div>
              <button onClick={menuKaydet} className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-brand-600">Kaydet</button>
            </div>
            <p className="mt-1 text-[11px] text-slate-500">Görünürlüğü kapat, istersen adını değiştir. (Projeler ve Yönetim her zaman açık kalmalı.)</p>
            <div className="mt-3 divide-y divide-slate-100">
              {MENU_KATALOG.map((m) => {
                const gizliMi = (menuAyar.gizli ?? []).includes(m.href);
                const kilitli = m.href === "/panel" || m.href === "/panel/yonetim";
                return (
                  <div key={m.href} className="flex items-center gap-3 py-2">
                    <span className="w-6 text-center">{m.icon}</span>
                    <input
                      value={menuAyar.etiket?.[m.href] ?? m.label}
                      onChange={(e) => menuEtiket(m.href, e.target.value)}
                      className="min-w-0 flex-1 rounded-lg border border-slate-200 px-2 py-1 text-sm outline-none focus:border-brand-500"
                    />
                    <label className={`flex items-center gap-1.5 text-xs font-semibold ${kilitli ? "text-slate-300" : "text-slate-600"}`}>
                      <input type="checkbox" disabled={kilitli} checked={!gizliMi} onChange={() => menuGizliToggle(m.href)} className="h-4 w-4 accent-[var(--color-brand-500)]" />
                      Görünür
                    </label>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── SİTE ── */}
      {sekme === "site" && (
        <div className="mt-5">
          <div className="max-w-lg rounded-2xl border border-sky-200 bg-[#f2f8fd] p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="text-sm font-bold text-ink-900">🎨 Site / firma bilgileri</div>
              <button onClick={siteKaydet} className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-brand-600">Kaydet</button>
            </div>
            <div className="mt-3 space-y-3">
              {([
                ["siteAdi", "Site / firma adı"],
                ["slogan", "Slogan"],
                ["telefon", "Telefon"],
                ["eposta", "E-posta"],
                ["adres", "Adres"],
              ] as [keyof SiteAyar, string][]).map(([alan, etiket]) => (
                <div key={alan}>
                  <label className="text-xs font-semibold text-slate-500">{etiket}</label>
                  <input
                    value={site[alan] ?? ""}
                    onChange={(e) => setSite({ ...site, [alan]: e.target.value })}
                    className="mt-1 w-full rounded-lg border-2 border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500"
                  />
                </div>
              ))}
            </div>
            <p className="mt-3 text-[11px] text-slate-400">Bu bilgiler ileride vitrin ve panelde otomatik kullanılır.</p>
          </div>
        </div>
      )}

      <div className="mt-8 text-sm">
        <Link href="/panel" className="font-semibold text-slate-500 transition hover:text-ink-800">← Projelere dön</Link>
      </div>

      {/* ── PROJE İNCELE / DÜZENLE MODALI ── */}
      {inceleAcik && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setInceleAcik(false)}>
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-extrabold text-ink-900">🏗️ Proje incele / düzenle</h3>
              <button onClick={() => setInceleAcik(false)} className="text-slate-400 hover:text-ink-900">✕</button>
            </div>
            {inceleYuk || !inceleMeta ? (
              <div className="py-10"><Spinner etiket="Proje yükleniyor…" /></div>
            ) : (
              <>
                <p className="mt-1 text-xs text-slate-500">Oluşturan: <b>{inceleMeta.email || "—"}</b>{inceleMeta.createdAt ? ` · ${inceleMeta.createdAt.slice(0, 10)}` : ""}</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="text-xs font-semibold text-slate-600 sm:col-span-2">Proje adı
                    <input value={inceleForm.name} onChange={(e) => setInceleForm({ ...inceleForm, name: e.target.value })}
                      className="mt-1 w-full rounded-lg border-2 border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500" />
                  </label>
                  <label className="text-xs font-semibold text-slate-600">Şehir
                    <input value={inceleForm.city} onChange={(e) => setInceleForm({ ...inceleForm, city: e.target.value })}
                      className="mt-1 w-full rounded-lg border-2 border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500" />
                  </label>
                  <label className="text-xs font-semibold text-slate-600">Tip
                    <select value={inceleForm.type} onChange={(e) => setInceleForm({ ...inceleForm, type: e.target.value as ProjectType })}
                      className="mt-1 w-full rounded-lg border-2 border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:border-brand-500">
                      {(Object.keys(TYPE_LABELS) as ProjectType[]).map((t) => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
                    </select>
                  </label>
                  <label className="text-xs font-semibold text-slate-600">İnşaat alanı (m²)
                    <input value={inceleForm.area} onChange={(e) => setInceleForm({ ...inceleForm, area: e.target.value })} inputMode="numeric"
                      className="mt-1 w-full rounded-lg border-2 border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500" />
                  </label>
                  <label className="text-xs font-semibold text-slate-600">Kat sayısı
                    <input value={inceleForm.floors} onChange={(e) => setInceleForm({ ...inceleForm, floors: e.target.value })} inputMode="numeric"
                      className="mt-1 w-full rounded-lg border-2 border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500" />
                  </label>
                  <label className="text-xs font-semibold text-slate-600 sm:col-span-2">Tahmini bütçe (₺) — boş = belirsiz
                    <input value={inceleForm.budget} onChange={(e) => setInceleForm({ ...inceleForm, budget: e.target.value })} inputMode="numeric"
                      className="mt-1 w-full rounded-lg border-2 border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500" />
                  </label>
                </div>
                <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs text-slate-600">
                  <div><b>Bina:</b> {inceleMeta.binaOzet}</div>
                  {inceleMeta.phases.length > 0 && (
                    <div className="mt-2">
                      <b>Aşamalar:</b>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {inceleMeta.phases.map((f, idx) => (
                          <span key={idx} className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${f.status === "tamam" ? "bg-emerald-100 text-emerald-700" : f.status === "devam" ? "bg-amber-100 text-amber-700" : "bg-slate-200 text-slate-500"}`}>{f.name}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <p className="mt-2 text-[11px] text-slate-400">Not: Detaylı kat/daire metrajı sahibinin proje editöründen düzenlenir; buradan projenin ana bilgileri güncellenir.</p>
                <div className="mt-4 flex justify-end gap-2">
                  <button onClick={() => setInceleAcik(false)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-bold text-slate-500 hover:bg-slate-50">Kapat</button>
                  <button onClick={inceleKaydet} className="rounded-lg bg-brand-500 px-5 py-2 text-sm font-bold text-white hover:bg-brand-600">Kaydet</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
