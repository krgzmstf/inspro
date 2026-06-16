"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { type Rol, ROL_ETIKET, ROL_MENU, MENU_SECENEKLERI, rolGetir } from "@/lib/rol";
import { supabaseVar } from "@/lib/supabase/auth";
import { apiGet, apiPost } from "@/lib/api";

interface Kullanici {
  id: string; email: string; ad_soyad: string; firma: string;
  rol: Rol; yetkiler: string[] | null; created_at: string; son_giris: string | null;
}

const ROLLER: Rol[] = ["yonetici", "sefi", "taseron", "muhasebeci"];

const ROL_ACIKLAMA: Record<Rol, string> = {
  yonetici: "Her şey + SADECE yönetici proje (dosya) oluşturur",
  sefi: "Şantiye şefi — iş süreçleri, saha, metraj (yöneticinin verdiği)",
  taseron: "Taşeron — iş süreçleri ve saha (yöneticinin verdiği)",
  muhasebeci: "Personel, muhasebe, genel muhasebe, teklif, hakediş — tutarları düzenler",
};

export default function YonetimPage() {
  const [rolum, setRolum] = useState<Rol>("yonetici");
  const [hazir, setHazir] = useState(false);
  const [kullanicilar, setKullanicilar] = useState<Kullanici[]>([]);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [hata, setHata] = useState("");
  const [mesaj, setMesaj] = useState("");
  const [acikIzin, setAcikIzin] = useState<string | null>(null);

  useEffect(() => {
    rolGetir().then((r) => { setRolum(r); setHazir(true); });
    yukle();
  }, []);

  async function yukle() {
    setYukleniyor(true); setHata("");
    try {
      const data = await apiGet<{ users: Kullanici[] }>("/yonetim/kullanicilar");
      setKullanicilar(data.users ?? []);
    } catch (e) { setHata((e as Error).message); }
    finally { setYukleniyor(false); }
  }

  async function kaydet(id: string, rol: Rol, yetkiler: string[] | null | undefined) {
    setMesaj(""); setHata("");
    setKullanicilar((list) => list.map((k) => (k.id === id ? { ...k, rol, ...(yetkiler !== undefined ? { yetkiler } : {}) } : k)));
    try {
      await apiPost("/yonetim/kullanicilar", { id, rol, ...(yetkiler !== undefined ? { yetkiler } : {}) });
      setMesaj("✓ Kaydedildi. (Kullanıcı yeniden giriş yapınca menüsü güncellenir.)");
    } catch (e) { setHata((e as Error).message); yukle(); }
  }

  function etkinIzinler(k: Kullanici): string[] {
    if (k.yetkiler && k.yetkiler.length > 0) return k.yetkiler;
    const v = ROL_MENU[k.rol];
    return v === "*" ? MENU_SECENEKLERI.map((m) => m.href) : v;
  }

  function izinToggle(k: Kullanici, href: string) {
    const mevcut = etkinIzinler(k);
    const yeni = mevcut.includes(href) ? mevcut.filter((h) => h !== href) : [...mevcut, href];
    kaydet(k.id, k.rol, yeni);
  }

  if (!supabaseVar()) {
    return (
      <div className="mx-auto max-w-3xl">
        <h1 className="text-2xl font-extrabold text-slate-900">👤 Yönetim</h1>
        <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700">
          Backend bağlı değil. Kullanıcı yönetimi için e-posta ile giriş gerekir.
        </p>
      </div>
    );
  }
  if (hazir && rolum !== "yonetici") {
    return (
      <div className="mx-auto max-w-3xl">
        <h1 className="text-2xl font-extrabold text-slate-900">👤 Yönetim</h1>
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
          <h1 className="text-2xl font-extrabold text-slate-900">👤 Kullanıcı & Rol Yönetimi</h1>
          <p className="mt-1 text-sm text-slate-500">Rol ata, istersen kişiye özel modül izni ver. Kod gerekmez.</p>
        </div>
        <button onClick={yukle} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600 transition hover:bg-slate-50">↻ Yenile</button>
      </div>

      {mesaj && <p className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">{mesaj}</p>}
      {hata && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-600">{hata}</p>}

      {/* Roller açıklaması */}
      <div className="mt-5 grid gap-2 sm:grid-cols-2">
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
        <p className="mt-6 rounded-2xl border-2 border-dashed border-slate-300 bg-white/60 p-8 text-center text-sm text-slate-500">
          Henüz kayıtlı kullanıcı yok. Kullanıcılar /kayit'tan e-posta + kod ile kaydolur.
        </p>
      ) : (
        <div className="mt-6 space-y-3">
          {kullanicilar.map((k) => (
            <div key={k.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold text-slate-800">{k.ad_soyad || "—"} <span className="text-[11px] font-normal text-slate-400">{k.email}</span></div>
                  <div className="text-[11px] text-slate-400">{k.firma || ""}{k.firma ? " · " : ""}kayıt {k.created_at?.slice(0, 10)}</div>
                </div>
                <div className="flex items-center gap-2">
                  <select value={k.rol} onChange={(e) => kaydet(k.id, e.target.value as Rol, undefined)}
                    className="rounded-lg border-2 border-slate-200 bg-white px-2 py-1 text-sm font-semibold outline-none focus:border-brand-500">
                    {ROLLER.map((r) => <option key={r} value={r}>{ROL_ETIKET[r]}</option>)}
                  </select>
                  {k.rol !== "yonetici" && (
                    <button onClick={() => setAcikIzin(acikIzin === k.id ? null : k.id)}
                      className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-bold text-slate-600 hover:bg-slate-50">
                      {acikIzin === k.id ? "İzinleri gizle" : "Özel izinler"}
                    </button>
                  )}
                </div>
              </div>

              {/* Kişiye özel modül izinleri */}
              {acikIzin === k.id && k.rol !== "yonetici" && (
                <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50 p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-600">Bu kişinin görebileceği modüller</span>
                    {k.yetkiler && k.yetkiler.length > 0 && (
                      <button onClick={() => kaydet(k.id, k.rol, null)} className="text-[11px] font-semibold text-brand-600 hover:underline">Rol varsayılanına dön</button>
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
                  <p className="mt-1.5 text-[10px] text-slate-400">İşaretlediklerin bu kişiye özel olur (rol varsayılanını ezer). &quot;Projeler&quot; herkese açıktır.</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <p className="mt-4 text-[11px] text-slate-400">
        💡 Not: Proje (dosya) yalnız Yönetici oluşturur. Kullanıcılar /kayit&apos;tan e-posta + kod ile kaydolur; buradan rol ve modül izinleri verilir.
      </p>
      <div className="mt-6 text-sm">
        <Link href="/panel" className="font-semibold text-slate-500 transition hover:text-ink-800">← Projelere dön</Link>
      </div>
    </div>
  );
}
