"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { type Rol, ROL_ETIKET, ROL_MENU, MENU_SECENEKLERI, rolGetir } from "@/lib/rol";
import { supabaseVar } from "@/lib/supabase/auth";
import { apiGet, apiPost, apiPatch, apiDelete, API_URL } from "@/lib/api";
import { ayarGetir, ayarYaz, MENU_KATALOG, type MenuAyar, type SiteAyar } from "@/lib/ayar";

interface Kullanici {
  id: string; email: string; ad_soyad: string; firma: string;
  rol: Rol; yetkiler: string[] | null; aktif?: boolean; created_at: string; son_giris: string | null;
}

interface Ozet {
  surum: string;
  ortam: string;
  sayilar: { kullanici: number; proje: number; muhasebe: number; modul: number; dosya: number };
  dosya_boyut_bayt: number;
  rol_dagilimi: Record<string, number>;
}

interface VeriSatir { id: string; owner_id: string; baslik: string; ek?: string; created_at?: string | null }

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
  const [rolum, setRolum] = useState<Rol>("yonetici");
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
  const [yeniK, setYeniK] = useState({ email: "", ad_soyad: "", firma: "", rol: "sefi" as Rol });

  // Veriler
  const [veriTip, setVeriTip] = useState("projeler");
  const [veriler, setVeriler] = useState<VeriSatir[]>([]);
  const [veriYukleniyor, setVeriYukleniyor] = useState(false);

  // Menü
  const [menuAyar, setMenuAyar] = useState<MenuAyar>({ gizli: [], etiket: {}, sira: [] });

  // Site
  const [site, setSite] = useState<SiteAyar>({});

  useEffect(() => {
    rolGetir().then((r) => { setRolum(r); setHazir(true); });
    fetch(API_URL + "/health").then((r) => setSaglik(r.ok)).catch(() => setSaglik(false));
    yukleKullanicilar();
    apiGet<Ozet>("/yonetim/ozet").then(setOzet).catch(() => {});
    ayarGetir<MenuAyar>("menu", { gizli: [], etiket: {}, sira: [] }).then((m) =>
      setMenuAyar({ gizli: m.gizli ?? [], etiket: m.etiket ?? {}, sira: m.sira ?? [] }));
    ayarGetir<SiteAyar>("site", {}).then(setSite);
  }, []);

  useEffect(() => {
    if (sekme === "veriler") yukleVeri(veriTip);
  }, [sekme, veriTip]);

  // ── Kullanıcılar ──
  async function yukleKullanicilar() {
    setYukleniyor(true); setHata("");
    try {
      const data = await apiGet<{ users: Kullanici[] }>("/yonetim/kullanicilar");
      setKullanicilar(data.users ?? []);
    } catch (e) { setHata((e as Error).message); }
    finally { setYukleniyor(false); }
  }

  async function rolKaydet(id: string, rol: Rol, yetkiler: string[] | null | undefined) {
    setMesaj(""); setHata("");
    setKullanicilar((list) => list.map((k) => (k.id === id ? { ...k, rol, ...(yetkiler !== undefined ? { yetkiler } : {}) } : k)));
    try {
      await apiPost("/yonetim/kullanicilar", { id, rol, ...(yetkiler !== undefined ? { yetkiler } : {}) });
      setMesaj("✓ Kaydedildi.");
    } catch (e) { setHata((e as Error).message); yukleKullanicilar(); }
  }

  async function kullaniciEkle() {
    setMesaj(""); setHata("");
    if (!yeniK.email.includes("@")) { setHata("Geçerli bir e-posta girin."); return; }
    try {
      await apiPost("/yonetim/kullanici-olustur", yeniK);
      setYeniK({ email: "", ad_soyad: "", firma: "", rol: "sefi" });
      setMesaj("✓ Kullanıcı eklendi. (Kişi e-posta + kod ile giriş yapabilir.)");
      yukleKullanicilar();
    } catch (e) { setHata((e as Error).message); }
  }

  async function aktifDegistir(k: Kullanici) {
    try { await apiPatch(`/yonetim/kullanicilar/${k.id}`, { aktif: !(k.aktif ?? true) }); yukleKullanicilar(); }
    catch (e) { setHata((e as Error).message); }
  }

  async function kullaniciSil(k: Kullanici) {
    if (!confirm(`${k.email} silinsin mi? Bu kişinin tüm verileri de silinir.`)) return;
    try { await apiDelete(`/yonetim/kullanicilar/${k.id}`); setMesaj("✓ Silindi."); yukleKullanicilar(); }
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

  // ── Veriler ──
  async function yukleVeri(tip: string) {
    setVeriYukleniyor(true); setHata("");
    try {
      const d = await apiGet<{ satirlar: VeriSatir[] }>(`/yonetim/veri/${tip}`);
      setVeriler(d.satirlar ?? []);
    } catch (e) { setHata((e as Error).message); setVeriler([]); }
    finally { setVeriYukleniyor(false); }
  }
  async function veriSil(tip: string, id: string) {
    if (!confirm("Bu kayıt kalıcı olarak silinsin mi?")) return;
    try { await apiDelete(`/yonetim/veri/${tip}/${encodeURIComponent(id)}`); yukleVeri(tip); setMesaj("✓ Silindi."); }
    catch (e) { setHata((e as Error).message); }
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
  if (hazir && rolum !== "yonetici") {
    return (
      <div className="mx-auto max-w-3xl">
        <h1 className="text-2xl font-extrabold text-slate-900">⚙️ Yönetim Merkezi</h1>
        <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">
          Bu sayfaya yalnızca <b>Yönetici</b> erişebilir.
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

      {mesaj && <p className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">{mesaj}</p>}
      {hata && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-600">{hata}</p>}

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
                  <div key={k.etiket} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                    <div className={`flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br ${k.renk} text-base`}>{k.ikon}</div>
                    <div className="mt-2 text-2xl font-extrabold text-ink-900">{k.deger}</div>
                    <div className="text-[11px] font-semibold text-slate-500">{k.etiket}{k.alt ? ` · ${k.alt}` : ""}</div>
                  </div>
                ))}
              </div>
              <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="text-[11px] font-bold text-slate-500">ROL DAĞILIMI</div>
                <div className="mt-2 space-y-1.5">
                  {ROLLER.map((r) => {
                    const adet = ozet.rol_dagilimi[r] ?? 0;
                    const toplam = Math.max(1, ozet.sayilar.kullanici);
                    const yuzde = Math.round((adet / toplam) * 100);
                    return (
                      <div key={r} className="flex items-center gap-2">
                        <span className="w-28 shrink-0 text-xs font-semibold text-slate-600">{ROL_ETIKET[r]}</span>
                        <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                          <div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${yuzde}%` }} />
                        </div>
                        <span className="w-8 shrink-0 text-right text-xs font-bold text-slate-700">{adet}</span>
                      </div>
                    );
                  })}
                </div>
                <p className="mt-3 text-[11px] text-slate-400">Sürüm v{ozet.surum} · ortam {ozet.ortam}</p>
              </div>
            </>
          ) : <p className="text-sm text-slate-500">Özet yükleniyor…</p>}
        </div>
      )}

      {/* ── KULLANICILAR ── */}
      {sekme === "kullanicilar" && (
        <div className="mt-5">
          {/* Yeni kullanıcı */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
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
              <div key={r} className="rounded-xl border border-slate-200 bg-white p-3">
                <div className="text-xs font-bold text-ink-900">{ROL_ETIKET[r]}</div>
                <div className="mt-0.5 text-[11px] text-slate-500">{ROL_ACIKLAMA[r]}</div>
              </div>
            ))}
          </div>

          {yukleniyor ? (
            <p className="mt-6 text-sm text-slate-500">Yükleniyor…</p>
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
                      <div className="text-[11px] text-slate-400">{k.firma || ""}{k.firma ? " · " : ""}kayıt {k.created_at?.slice(0, 10)}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <select value={k.rol} onChange={(e) => rolKaydet(k.id, e.target.value as Rol, undefined)}
                        className="rounded-lg border-2 border-slate-200 bg-white px-2 py-1 text-sm font-semibold outline-none focus:border-brand-500">
                        {ROLLER.map((r) => <option key={r} value={r}>{ROL_ETIKET[r]}</option>)}
                      </select>
                      {k.rol !== "yonetici" && (
                        <button onClick={() => setAcikIzin(acikIzin === k.id ? null : k.id)} className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-bold text-slate-600 hover:bg-slate-50">
                          {acikIzin === k.id ? "İzinleri gizle" : "Özel izinler"}
                        </button>
                      )}
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
          {veriYukleniyor ? (
            <p className="mt-4 text-sm text-slate-500">Yükleniyor…</p>
          ) : veriler.length === 0 ? (
            <p className="mt-4 rounded-2xl border-2 border-dashed border-slate-300 bg-white/60 p-8 text-center text-sm text-slate-500">Kayıt yok.</p>
          ) : (
            <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-[11px] uppercase text-slate-400">
                  <tr><th className="px-4 py-2">Başlık</th><th className="px-4 py-2">Detay</th><th className="px-4 py-2 text-right">İşlem</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {veriler.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2 font-semibold text-slate-800">{r.baslik}</td>
                      <td className="px-4 py-2 text-xs text-slate-500">{r.ek || ""}{r.created_at ? ` · ${r.created_at.slice(0, 10)}` : ""}</td>
                      <td className="px-4 py-2 text-right">
                        <button onClick={() => veriSil(veriTip, r.id)} className="rounded-lg border border-red-200 px-2.5 py-1 text-xs font-bold text-red-600 hover:bg-red-50">Sil</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="mt-3 text-[11px] text-slate-400">💡 Buradaki kayıtlar tüm kullanıcılara aittir. Silme geri alınamaz.</p>
        </div>
      )}

      {/* ── MENÜ ── */}
      {sekme === "menu" && (
        <div className="mt-5">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
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
          <div className="max-w-lg rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
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
    </div>
  );
}
