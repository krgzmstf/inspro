"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { type Project, loadProjects, formatTL } from "@/lib/projects";
import { loadMuhasebe, muhasebeOzeti } from "@/lib/muhasebe";
import { excelYaz, pdfYazdir } from "@/lib/disaAktar";

interface DosyaSatir {
  id: string;
  ad: string;
  sehir: string;
  gelir: number;
  gider: number;
  bakiye: number;
  acikAlacak: number;
  acikBorc: number;
}

export default function GenelMuhasebePage() {
  const [projects, setProjects] = useState<Project[]>([]);

  useEffect(() => { setProjects(loadProjects()); }, []);

  const satirlar = useMemo<DosyaSatir[]>(
    () =>
      projects.map((p) => {
        const o = muhasebeOzeti(loadMuhasebe(p.id));
        return {
          id: p.id, ad: p.name, sehir: p.city,
          gelir: o.toplamGelir, gider: o.toplamGider, bakiye: o.bakiye,
          acikAlacak: o.acikAlacak, acikBorc: o.acikBorc,
        };
      }),
    [projects],
  );

  const toplam = useMemo(
    () => satirlar.reduce(
      (a, s) => ({
        gelir: a.gelir + s.gelir, gider: a.gider + s.gider, bakiye: a.bakiye + s.bakiye,
        acikAlacak: a.acikAlacak + s.acikAlacak, acikBorc: a.acikBorc + s.acikBorc,
      }),
      { gelir: 0, gider: 0, bakiye: 0, acikAlacak: 0, acikBorc: 0 },
    ),
    [satirlar],
  );

  function disaAktar(fmt: "pdf" | "excel") {
    const head = ["Dosya", "Şehir", "Toplam Gelir", "Toplam Gider", "Bakiye", "Açık Alacak", "Açık Borç"];
    const rows: (string | number)[][] = satirlar.map((s) => [
      s.ad, s.sehir, Math.round(s.gelir), Math.round(s.gider), Math.round(s.bakiye), Math.round(s.acikAlacak), Math.round(s.acikBorc),
    ]);
    rows.push(["GENEL TOPLAM", "", Math.round(toplam.gelir), Math.round(toplam.gider), Math.round(toplam.bakiye), Math.round(toplam.acikAlacak), Math.round(toplam.acikBorc)]);
    if (fmt === "excel") excelYaz("genel-muhasebe", "Tüm Dosyalar", head, rows);
    else pdfYazdir("Genel Muhasebe — Tüm Dosyalar", head, rows, "Tutarlar ₺. Her dosya (proje) kendi muhasebesinden toplanır.");
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">📊 Genel Muhasebe</h1>
          <p className="mt-1 text-sm text-slate-500">Tüm dosyaların (projelerin) toplam gelir, gider ve bakiyesi — tek tabloda.</p>
        </div>
        {satirlar.length > 0 && (
          <div className="flex gap-2">
            <button onClick={() => disaAktar("excel")} className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-emerald-700">⬇ Excel</button>
            <button onClick={() => disaAktar("pdf")} className="rounded-xl bg-red-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-red-700">⬇ PDF</button>
          </div>
        )}
      </div>

      {/* Genel toplam kartları */}
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase text-emerald-600">Genel Toplam Gelir</div>
          <div className="mt-1 text-2xl font-extrabold text-emerald-700">{formatTL(toplam.gelir)}</div>
        </div>
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase text-red-600">Genel Toplam Gider</div>
          <div className="mt-1 text-2xl font-extrabold text-red-700">{formatTL(toplam.gider)}</div>
        </div>
        <div className={`rounded-2xl border-2 p-5 shadow-sm ${toplam.bakiye >= 0 ? "border-ink-900 bg-ink-950 text-white" : "border-red-400 bg-red-100"}`}>
          <div className={`text-xs font-semibold uppercase ${toplam.bakiye >= 0 ? "text-white/60" : "text-red-600"}`}>Genel Bakiye</div>
          <div className={`mt-1 text-2xl font-extrabold ${toplam.bakiye >= 0 ? "text-brand-400" : "text-red-700"}`}>{formatTL(toplam.bakiye)}</div>
        </div>
      </div>

      {/* Dosya dosya tablo */}
      {satirlar.length === 0 ? (
        <div className="mt-8 rounded-2xl border-2 border-dashed border-slate-300 bg-white p-12 text-center">
          <div className="text-4xl">🗂️</div>
          <h3 className="mt-3 text-lg font-bold text-slate-900">Henüz dosya (proje) yok</h3>
          <Link href="/panel/yeni" className="mt-5 inline-block rounded-xl bg-brand-500 px-6 py-3 text-sm font-bold text-white transition hover:bg-brand-600">+ Proje Oluştur</Link>
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-2xl border border-sky-200 bg-[#f2f8fd] shadow-sm">
          <table className="w-full min-w-0 text-[11px] sm:min-w-[720px] sm:text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-[11px] font-bold uppercase text-slate-500">
                <th className="px-4 py-3">Dosya</th>
                <th className="px-4 py-3 text-right">Toplam Gelir</th>
                <th className="px-4 py-3 text-right">Toplam Gider</th>
                <th className="px-4 py-3 text-right">Bakiye</th>
                <th className="px-4 py-3 text-right">Açık Alacak</th>
                <th className="px-4 py-3 text-right">Açık Borç</th>
              </tr>
            </thead>
            <tbody>
              {satirlar.map((s) => (
                <tr key={s.id} className="border-b border-slate-100 hover:bg-slate-50/60">
                  <td className="px-4 py-2.5">
                    <Link href={`/panel/muhasebe?proje=${s.id}`} className="font-semibold text-ink-900 hover:text-brand-600">{s.ad}</Link>
                    {s.sehir && <div className="text-[11px] text-slate-400">{s.sehir}</div>}
                  </td>
                  <td className="px-4 py-2.5 text-right font-semibold text-emerald-700">{formatTL(s.gelir)}</td>
                  <td className="px-4 py-2.5 text-right font-semibold text-red-600">{formatTL(s.gider)}</td>
                  <td className={`px-4 py-2.5 text-right font-bold ${s.bakiye >= 0 ? "text-slate-900" : "text-red-700"}`}>{formatTL(s.bakiye)}</td>
                  <td className="px-4 py-2.5 text-right text-amber-600">{s.acikAlacak ? formatTL(s.acikAlacak) : "—"}</td>
                  <td className="px-4 py-2.5 text-right text-amber-600">{s.acikBorc ? formatTL(s.acikBorc) : "—"}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-200 bg-slate-50 font-extrabold">
                <td className="px-4 py-3 text-xs uppercase text-slate-500">Genel Toplam ({satirlar.length} dosya)</td>
                <td className="px-4 py-3 text-right text-emerald-700">{formatTL(toplam.gelir)}</td>
                <td className="px-4 py-3 text-right text-red-600">{formatTL(toplam.gider)}</td>
                <td className={`px-4 py-3 text-right ${toplam.bakiye >= 0 ? "text-ink-900" : "text-red-700"}`}>{formatTL(toplam.bakiye)}</td>
                <td className="px-4 py-3 text-right text-amber-600">{formatTL(toplam.acikAlacak)}</td>
                <td className="px-4 py-3 text-right text-amber-600">{formatTL(toplam.acikBorc)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <div className="mt-8 text-sm">
        <Link href="/panel" className="font-semibold text-slate-500 transition hover:text-ink-800">← Projelere dön</Link>
      </div>
    </div>
  );
}
