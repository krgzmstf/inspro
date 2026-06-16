"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { type Rol, ROL_ETIKET, rolGetir } from "@/lib/rol";
import { supabaseVar } from "@/lib/supabase/auth";

interface Kullanici {
  id: string; email: string; ad_soyad: string; firma: string;
  rol: Rol; created_at: string; son_giris: string | null;
}

const ROLLER: Rol[] = ["sahip", "ofis", "sefi", "usta"];

export default function YonetimPage() {
  const [rolum, setRolum] = useState<Rol>("sahip");
  const [hazir, setHazir] = useState(false);
  const [kullanicilar, setKullanicilar] = useState<Kullanici[]>([]);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [hata, setHata] = useState("");
  const [mesaj, setMesaj] = useState("");

  useEffect(() => {
    rolGetir().then((r) => { setRolum(r); setHazir(true); });
    yukle();
  }, []);

  async function yukle() {
    setYukleniyor(true); setHata("");
    try {
      const res = await fetch("/api/yonetim/kullanicilar");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Liste alınamadı.");
      setKullanicilar(data.users ?? []);
    } catch (e) {
      setHata((e as Error).message);
    } finally {
      setYukleniyor(false);
    }
  }

  async function rolDegistir(id: string, rol: Rol) {
    setMesaj(""); setHata("");
    setKullanicilar((list) => list.map((k) => (k.id === id ? { ...k, rol } : k)));
    try {
      const res = await fetch("/api/yonetim/kullanicilar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, rol }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Güncellenemedi.");
      setMesaj("✓ Rol güncellendi. (Kullanıcı yeniden giriş yapınca menüsü güncellenir.)");
    } catch (e) {
      setHata((e as Error).message);
      yukle();
    }
  }

  if (!supabaseVar()) {
    return (
      <div className="mx-auto max-w-3xl">
        <h1 className="text-2xl font-extrabold text-slate-900">👤 Yönetim</h1>
        <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700">
          Backend (Supabase) bağlı değil. Kullanıcı yönetimi için e-posta ile giriş yapılan kurulum gerekir.
        </p>
      </div>
    );
  }

  if (hazir && rolum !== "sahip") {
    return (
      <div className="mx-auto max-w-3xl">
        <h1 className="text-2xl font-extrabold text-slate-900">👤 Yönetim</h1>
        <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">
          Bu sayfaya yalnızca <b>Sahip/Yönetici</b> erişebilir.
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
          <p className="mt-1 text-sm text-slate-500">Kayıtlı kullanıcıları gör, rollerini buradan değiştir. Kod gerekmez.</p>
        </div>
        <button onClick={yukle} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600 transition hover:bg-slate-50">↻ Yenile</button>
      </div>

      {mesaj && <p className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">{mesaj}</p>}
      {hata && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-600">{hata}</p>}

      {/* Rol açıklaması */}
      <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Sahip / Yönetici", "Her şeyi görür (finans, ilerleme, yönetim)"],
          ["Ofis", "Tüm modüller (web)"],
          ["Şantiye Şefi", "Saha, iş süreçleri, metraj, personel"],
          ["Taşeron / Usta", "Sadece iş süreçleri ve saha"],
        ].map(([ad, aciklama]) => (
          <div key={ad} className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="text-xs font-bold text-ink-900">{ad}</div>
            <div className="mt-0.5 text-[11px] text-slate-500">{aciklama}</div>
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
        <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-[11px] font-bold uppercase text-slate-500">
                <th className="px-4 py-3">Kullanıcı</th>
                <th className="px-4 py-3">Firma</th>
                <th className="px-4 py-3">Rol</th>
                <th className="px-4 py-3">Kayıt</th>
                <th className="px-4 py-3">Son Giriş</th>
              </tr>
            </thead>
            <tbody>
              {kullanicilar.map((k) => (
                <tr key={k.id} className="border-b border-slate-100 hover:bg-slate-50/60">
                  <td className="px-4 py-2.5">
                    <div className="font-semibold text-slate-800">{k.ad_soyad || "—"}</div>
                    <div className="text-[11px] text-slate-400">{k.email}</div>
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">{k.firma || "—"}</td>
                  <td className="px-4 py-2.5">
                    <select value={k.rol} onChange={(e) => rolDegistir(k.id, e.target.value as Rol)}
                      className="rounded-lg border-2 border-slate-200 bg-white px-2 py-1 text-sm font-semibold outline-none focus:border-brand-500">
                      {ROLLER.map((r) => <option key={r} value={r}>{ROL_ETIKET[r]}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-slate-500">{k.created_at?.slice(0, 10)}</td>
                  <td className="px-4 py-2.5 text-xs text-slate-500">{k.son_giris?.slice(0, 10) ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-4 text-[11px] text-slate-400">
        💡 Daha ileri ayarlar için Supabase Studio: <a href="http://127.0.0.1:4323" target="_blank" rel="noopener noreferrer" className="font-semibold text-brand-600 hover:underline">127.0.0.1:4323</a>
      </p>
      <div className="mt-6 text-sm">
        <Link href="/panel" className="font-semibold text-slate-500 transition hover:text-ink-800">← Projelere dön</Link>
      </div>
    </div>
  );
}
