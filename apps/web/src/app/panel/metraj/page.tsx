"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  type Project,
  loadProjects,
  getProject,
  setKendiFiyat,
  formatTL,
} from "@/lib/projects";
import {
  type MetrajItem,
  loadMetraj,
  addMetrajItem,
  updateMetrajMiktar,
  deleteMetrajItem,
} from "@/lib/metraj";
import { type Poz, ensurePozlarSeeded, pozIndex, etkinFiyat, POZ_DATA_DATE } from "@/lib/pozlar";
import { kesifOzeti } from "@/lib/calc/kesif";
import { type KesifSatir, kesifHesapla } from "@/lib/kesifEslesme";
import { type AsamaKalem, projeTumKalemler, asamaToplamFiyat } from "@/lib/asamaKalem";
import { excelYaz, pdfYazdir } from "@/lib/disaAktar";

export default function MetrajPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState("");
  const [items, setItems] = useState<MetrajItem[]>([]);
  const [pozlar, setPozlar] = useState<Poz[]>([]);
  const [asamaKalemler, setAsamaKalemler] = useState<AsamaKalem[]>([]);

  // yeni satır formu
  const [mahal, setMahal] = useState("");
  const [pozKod, setPozKod] = useState(""); // seçili pozun kodu
  const [pozArama, setPozArama] = useState(""); // arama kutusu metni
  const [pozAcik, setPozAcik] = useState(false);
  const [miktar, setMiktar] = useState("");
  const [error, setError] = useState("");

  const POZ_INDEX = useMemo(() => pozIndex(pozlar), [pozlar]);

  // Poz no/ad araması — en fazla 30 eşleşme
  const eslesenler = useMemo(() => {
    const q = pozArama.toLocaleLowerCase("tr").trim();
    if (!q) return [];
    return pozlar
      .filter(
        (p) =>
          p.kod.toLocaleLowerCase("tr").includes(q) ||
          p.ad.toLocaleLowerCase("tr").includes(q),
      )
      .slice(0, 30);
  }, [pozlar, pozArama]);

  const seciliPoz = pozKod ? POZ_INDEX[pozKod] : undefined;

  // Otomatik keşif (proje metrajından) — kendi fiyat düzenlemesinde yenilenir
  const [projeRev, setProjeRev] = useState(0);
  const projeObj = useMemo(
    () => (projectId ? getProject(projectId) : undefined),
    [projectId, projeRev],
  );
  const kesifSatirlar = useMemo(
    () => (projeObj && pozlar.length ? kesifHesapla(projeObj, pozlar) : []),
    [projeObj, pozlar],
  );

  function kendiFiyatYaz(kalemKey: string, value: string) {
    if (!projectId) return;
    const v = value === "" ? undefined : parseFloat(value);
    setKendiFiyat(projectId, kalemKey, v);
    setProjeRev((r) => r + 1);
  }

  useEffect(() => {
    const list = loadProjects();
    setProjects(list);
    const id = new URLSearchParams(window.location.search).get("proje");
    const initial = id && list.some((p) => p.id === id) ? id : (list[0]?.id ?? "");
    if (initial) {
      setProjectId(initial);
      setItems(loadMetraj(initial));
      setAsamaKalemler(Object.values(projeTumKalemler(initial)).flat());
    }
  }, []);

  // Seçili projenin poz kütüphanesini yükle
  useEffect(() => {
    const lib = projeObj?.pozKutuphane === "kut1" ? "kut1" : "kut2";
    ensurePozlarSeeded(lib).then(setPozlar);
  }, [projeObj?.pozKutuphane]);

  function pozSec(p: Poz) {
    setPozKod(p.kod);
    setPozArama(`${p.kod} — ${p.ad}`);
    setPozAcik(false);
  }

  function switchProject(id: string) {
    setProjectId(id);
    setItems(id ? loadMetraj(id) : []);
    setAsamaKalemler(id ? Object.values(projeTumKalemler(id)).flat() : []);
    setError("");
  }

  const asamaToplam = useMemo(() => asamaToplamFiyat(asamaKalemler), [asamaKalemler]);

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const m = parseFloat(miktar);
    if (!projectId) return setError("Önce bir proje seçin.");
    if (!mahal.trim()) return setError("Mahal girin (ör: Zemin Kat, A Blok Cephe).");
    if (!pozKod || !POZ_INDEX[pozKod]) return setError("Listeden bir poz seçin.");
    if (!m || m <= 0) return setError("Geçerli bir miktar girin.");

    addMetrajItem({ projectId, pozKod, mahal: mahal.trim(), miktar: m });
    setItems(loadMetraj(projectId));
    setMiktar("");
    setPozKod("");
    setPozArama("");
  }

  function handleMiktarChange(id: string, value: string) {
    const m = parseFloat(value);
    if (!m || m <= 0) return;
    updateMetrajMiktar(id, m);
    setItems(loadMetraj(projectId));
  }

  function handleDelete(id: string) {
    deleteMetrajItem(id);
    setItems(loadMetraj(projectId));
  }

  const ozet = useMemo(
    () =>
      kesifOzeti(
        items
          .filter((i) => POZ_INDEX[i.pozKod]) // silinmiş poza bağlı satırları atla
          .map((i) => ({ pozKod: i.pozKod, miktar: i.miktar })),
        POZ_INDEX,
      ),
    [items, POZ_INDEX],
  );

  const project = projects.find((p) => p.id === projectId);
  const mahaller = [...new Set(items.map((i) => i.mahal))];

  // Mahale göre sıralı görünüm
  const sortedItems = [...items].sort(
    (a, b) => a.mahal.localeCompare(b.mahal, "tr") || a.pozKod.localeCompare(b.pozKod),
  );

  function downloadCsv() {
    if (!project) return;
    const header = "Mahal;Poz Kodu;Poz Adı;Birim;Miktar;Birim Fiyat - en düşük (TL);Tutar (TL)";
    const rows = sortedItems
      .filter((i) => POZ_INDEX[i.pozKod])
      .map((i) => {
        const poz = POZ_INDEX[i.pozKod];
        const f = etkinFiyat(poz);
        return [
          i.mahal,
          poz.kod,
          poz.ad,
          poz.birim,
          i.miktar.toString().replace(".", ","),
          f.toString().replace(".", ","),
          (i.miktar * f).toFixed(2).replace(".", ","),
        ].join(";");
      });
    const toplam = `;;;;;GENEL TOPLAM;${ozet.genelToplam.toFixed(2).replace(".", ",")}`;
    // ﻿ (BOM): Excel'in Türkçe karakterleri doğru açması için
    const csv = "﻿" + [header, ...rows, toplam].join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `kesif-${project.name.replaceAll(" ", "-")}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">
            📏 Keşif &amp; Metraj
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Projeye girdiğiniz tüm metrajlar pozlara otomatik bağlanır. Poz birim
            fiyatları: <b>{POZ_DATA_DATE}</b>
          </p>
        </div>
        {projects.length > 0 && (
          <select
            value={projectId}
            onChange={(e) => switchProject(e.target.value)}
            className="rounded-xl border-2 border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold outline-none transition focus:border-brand-500"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* ═══ Otomatik Keşif Tablosu (proje metrajından) ═══ */}
      {projeObj && kesifSatirlar.length > 0 && (
        <AutoKesif satirlar={kesifSatirlar} kendiFiyat={projeObj.kendiFiyat ?? {}} onKendiFiyat={kendiFiyatYaz} />
      )}
      {projeObj && kesifSatirlar.length === 0 && (
        <div className="mt-6 rounded-2xl border-2 border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
          Bu projede henüz eşleştirilebilir metraj yok. Proje sihirbazında daire/bina detaylarını
          girin; buraya otomatik gelsin. (Aşağıdan elle de poz ekleyebilirsiniz.)
        </div>
      )}

      {/* ═══ İş Takibi Kalemleri (yol haritası) — keşfe dahil ═══ */}
      {asamaKalemler.length > 0 && (
        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-extrabold text-slate-900">🗂️ İş Takibi Kalemleri</h2>
              <p className="text-xs text-slate-500">
                Yol haritası aşamalarına eklediğiniz işler/bedeller (ruhsat, harç, proje, taşeron…). Keşif maliyetine eklenir.
              </p>
            </div>
            <div className="rounded-xl bg-ink-950 px-4 py-2 text-right">
              <div className="text-[10px] font-semibold uppercase text-white/60">İş Takibi Toplamı</div>
              <div className="text-lg font-extrabold text-brand-400">{formatTL(asamaToplam)}</div>
            </div>
          </div>
          <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="bg-slate-50 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-2">Aşama</th>
                  <th className="px-3 py-2">İş Kalemi</th>
                  <th className="px-3 py-2">Kişi/Firma</th>
                  <th className="px-3 py-2 text-center">Durum</th>
                  <th className="px-3 py-2 text-right">Planlanan</th>
                </tr>
              </thead>
              <tbody>
                {asamaKalemler.filter((k) => (k.fiyat ?? 0) > 0).map((k) => (
                  <tr key={k.id} className="border-t border-slate-100 hover:bg-slate-50/60">
                    <td className="px-3 py-2 text-xs text-slate-500">{k.asama}</td>
                    <td className="px-3 py-2 font-semibold text-slate-800">{k.ad}</td>
                    <td className="px-3 py-2 text-xs text-slate-600">{k.personelAd || "—"}</td>
                    <td className="px-3 py-2 text-center">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${k.durum === "tamam" ? "bg-emerald-100 text-emerald-700" : k.durum === "devam" ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-500"}`}>
                        {k.durum === "tamam" ? "Tamam" : k.durum === "devam" ? "Devam" : "Bekliyor"}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right font-bold text-slate-900">{formatTL(k.fiyat ?? 0)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-200 bg-slate-50 font-extrabold">
                  <td colSpan={4} className="px-3 py-2.5 text-right text-xs uppercase text-slate-500">İş Takibi Toplamı</td>
                  <td className="px-3 py-2.5 text-right text-brand-600">{formatTL(asamaToplam)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="mt-2 text-[11px] text-slate-400">
            Bu kalemler İş Takibi&apos;nde (proje detayı → yol haritası) yönetilir; tutar değişince keşif buradan güncellenir.
          </p>
        </section>
      )}

      {projects.length === 0 ? (
        <div className="mt-8 rounded-2xl border-2 border-dashed border-slate-300 bg-white p-12 text-center">
          <div className="text-4xl">🏗️</div>
          <h3 className="mt-3 text-lg font-bold text-slate-900">Önce bir proje gerekli</h3>
          <p className="mt-1 text-sm text-slate-500">
            Metraj, bir projeye bağlı tutulur. Önce projenizi oluşturun.
          </p>
          <Link
            href="/panel"
            className="mt-5 inline-block rounded-xl bg-brand-500 px-6 py-3 text-sm font-bold text-white transition hover:bg-brand-600"
          >
            + Proje Oluştur
          </Link>
        </div>
      ) : (
        <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_340px]">
          {/* ── Sol: giriş + tablo ── */}
          <div className="min-w-0">
            {/* Yeni satır */}
            <form
              onSubmit={handleAdd}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="grid gap-3 sm:grid-cols-[1fr_2fr_auto_auto]">
                <div>
                  <input
                    value={mahal}
                    onChange={(e) => setMahal(e.target.value)}
                    placeholder="Mahal (ör: Zemin Kat)"
                    list="mahal-listesi"
                    className="w-full rounded-xl border-2 border-slate-200 px-3.5 py-2.5 text-sm outline-none transition focus:border-brand-500"
                  />
                  <datalist id="mahal-listesi">
                    {mahaller.map((m) => (
                      <option key={m} value={m} />
                    ))}
                  </datalist>
                </div>

                {/* Poz no otomatik tamamlama */}
                <div className="relative">
                  <input
                    value={pozArama}
                    onChange={(e) => {
                      setPozArama(e.target.value);
                      setPozKod("");
                      setPozAcik(true);
                    }}
                    onFocus={() => pozArama && !pozKod && setPozAcik(true)}
                    onBlur={() => setTimeout(() => setPozAcik(false), 150)}
                    placeholder="Poz no veya ad yazın (ör: 15.100)…"
                    className="w-full rounded-xl border-2 border-slate-200 px-3.5 py-2.5 text-sm outline-none transition focus:border-brand-500"
                  />
                  {pozAcik && eslesenler.length > 0 && (
                    <ul className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-xl border border-slate-200 bg-white shadow-xl">
                      {eslesenler.map((p) => (
                        <li key={p.kod}>
                          <button
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => pozSec(p)}
                            className="flex w-full items-baseline gap-2 px-3 py-2 text-left text-sm transition hover:bg-brand-500/10"
                          >
                            <span className="shrink-0 font-mono text-xs font-bold text-ink-800">
                              {p.kod}
                            </span>
                            <span className="min-w-0 flex-1 truncate text-slate-600">{p.ad}</span>
                            <span className="shrink-0 text-xs font-bold text-emerald-700">
                              {formatTL(etkinFiyat(p))}/{p.birim}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  {seciliPoz && (
                    <span className="mt-1 block text-[11px] font-semibold text-emerald-700">
                      ✓ {formatTL(etkinFiyat(seciliPoz))}/{seciliPoz.birim}
                      {seciliPoz.piyasaMin != null && etkinFiyat(seciliPoz) < seciliPoz.resmiFiyat
                        ? " (piyasa fiyatı)"
                        : " (resmî)"}
                    </span>
                  )}
                </div>

                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={miktar}
                  onChange={(e) => setMiktar(e.target.value)}
                  placeholder={`Miktar (${seciliPoz?.birim ?? "birim"})`}
                  className="h-fit w-36 rounded-xl border-2 border-slate-200 px-3.5 py-2.5 text-sm outline-none transition focus:border-brand-500"
                />
                <button
                  type="submit"
                  className="h-fit rounded-xl bg-brand-500 px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-brand-500/20 transition hover:bg-brand-600"
                >
                  + Ekle
                </button>
              </div>
              {error && (
                <p className="mt-3 rounded-lg bg-red-50 px-4 py-2 text-sm font-semibold text-red-600">
                  {error}
                </p>
              )}
            </form>

            {/* Tablo */}
            {sortedItems.length === 0 ? (
              <div className="mt-5 rounded-2xl border-2 border-dashed border-slate-300 bg-white/60 p-10 text-center text-sm text-slate-500">
                Henüz metraj satırı yok — yukarıdan mahal, poz ve miktar girip{" "}
                <b>Ekle</b>&apos;ye basın.
              </div>
            ) : (
              <div className="mt-5 overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
                <table className="w-full min-w-[640px] text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                      <th className="px-4 py-3">Mahal</th>
                      <th className="px-4 py-3">Poz</th>
                      <th className="px-4 py-3 text-right">Miktar</th>
                      <th className="px-4 py-3 text-right">Birim Fiyat</th>
                      <th className="px-4 py-3 text-right">Tutar</th>
                      <th className="px-2 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {sortedItems.map((item, idx) => {
                      const poz = POZ_INDEX[item.pozKod];
                      if (!poz) return null;
                      const yeniMahal =
                        idx === 0 || sortedItems[idx - 1].mahal !== item.mahal;
                      return (
                        <tr
                          key={item.id}
                          className="border-b border-slate-100 transition hover:bg-slate-50/60"
                        >
                          <td className="px-4 py-2.5 font-semibold text-slate-800">
                            {yeniMahal ? item.mahal : ""}
                          </td>
                          <td className="px-4 py-2.5">
                            <span className="font-mono text-xs font-bold text-ink-800">
                              {poz.kod}
                            </span>{" "}
                            <span className="text-slate-600">{poz.ad}</span>
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <input
                              type="number"
                              step="0.01"
                              min="0.01"
                              defaultValue={item.miktar}
                              onBlur={(e) =>
                                handleMiktarChange(item.id, e.target.value)
                              }
                              className="w-24 rounded-lg border border-slate-200 px-2 py-1 text-right text-sm outline-none transition focus:border-brand-500"
                            />{" "}
                            <span className="text-xs text-slate-400">
                              {poz.birim}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-right text-slate-600">
                            {formatTL(etkinFiyat(poz))}
                          </td>
                          <td className="px-4 py-2.5 text-right font-bold text-slate-900">
                            {formatTL(item.miktar * etkinFiyat(poz))}
                          </td>
                          <td className="px-2 py-2.5 text-center">
                            <button
                              onClick={() => handleDelete(item.id)}
                              className="rounded-lg px-2 py-1 text-slate-300 transition hover:bg-red-50 hover:text-red-500"
                              title="Satırı sil"
                            >
                              🗑
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ── Sağ: keşif özeti ── */}
          <aside className="h-fit space-y-4">
            <div className="rounded-2xl bg-ink-950 p-6 text-white shadow-lg">
              <div className="text-xs font-semibold uppercase tracking-wide text-white/60">
                Keşif Toplamı
              </div>
              <div className="mt-1 text-3xl font-extrabold text-brand-400">
                {formatTL(ozet.genelToplam)}
              </div>
              <div className="mt-1 text-xs text-white/60">
                {items.length} satır · {mahaller.length} mahal
              </div>

              {asamaToplam > 0 && (
                <div className="mt-3 space-y-1 rounded-xl border border-white/10 bg-white/5 p-3 text-xs">
                  <div className="flex justify-between"><span className="text-white/60">Metraj keşfi</span><b>{formatTL(ozet.genelToplam)}</b></div>
                  <div className="flex justify-between"><span className="text-white/60">İş Takibi kalemleri</span><b>{formatTL(asamaToplam)}</b></div>
                  <div className="mt-1 flex justify-between border-t border-white/10 pt-1 text-sm">
                    <span className="text-white/80">Toplam proje maliyeti</span>
                    <b className="text-brand-400">{formatTL(ozet.genelToplam + asamaToplam)}</b>
                  </div>
                </div>
              )}

              {project?.budget != null && project.budget > 0 && (
                <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3 text-xs">
                  <div className="flex justify-between">
                    <span className="text-white/60">Proje bütçesi</span>
                    <b>{formatTL(project.budget)}</b>
                  </div>
                  <div className="mt-1 flex justify-between">
                    <span className="text-white/60">Fark</span>
                    <b
                      className={
                        ozet.genelToplam > project.budget
                          ? "text-red-300"
                          : "text-emerald-300"
                      }
                    >
                      {ozet.genelToplam > project.budget ? "+" : ""}
                      {formatTL(ozet.genelToplam - project.budget)}
                    </b>
                  </div>
                </div>
              )}

              <button
                onClick={downloadCsv}
                disabled={items.length === 0}
                className="mt-4 w-full rounded-xl bg-brand-500 py-2.5 text-sm font-bold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-40"
              >
                ⬇ Keşif Özetini İndir (CSV)
              </button>
            </div>

            {ozet.kategoriToplamlari.length > 0 && (
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-xs font-extrabold uppercase tracking-wide text-slate-600">
                  Kategori Dağılımı
                </h2>
                <div className="mt-3 space-y-3">
                  {ozet.kategoriToplamlari.map((k) => {
                    const pct = ozet.genelToplam
                      ? Math.round((k.tutar / ozet.genelToplam) * 100)
                      : 0;
                    return (
                      <div key={k.kategori}>
                        <div className="flex justify-between text-xs">
                          <span className="font-semibold text-slate-700">
                            {k.kategori}
                          </span>
                          <span className="font-bold text-slate-900">
                            {formatTL(k.tutar)}{" "}
                            <span className="text-slate-400">%{pct}</span>
                          </span>
                        </div>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-ink-700 to-brand-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-800">
              💡 Poz fiyatları yerleşik kütüphaneden gelir ({POZ_DATA_DATE}).
              İleride fiyat ajanı güncel tutacak; kendi özel pozlarınızı da
              ekleyebileceksiniz.
            </p>
          </aside>
        </div>
      )}

      <div className="mt-8 text-sm">
        <Link
          href="/panel"
          className="font-semibold text-slate-500 transition hover:text-ink-800"
        >
          ← Projelere dön
        </Link>
      </div>
    </div>
  );
}

/* ── Otomatik Keşif Tablosu (3 fiyat: ÇŞB / Piyasa / Kendi) ── */
function AutoKesif({
  satirlar,
  kendiFiyat,
  onKendiFiyat,
}: {
  satirlar: KesifSatir[];
  kendiFiyat: Record<string, number>;
  onKendiFiyat: (key: string, value: string) => void;
}) {
  const csbToplam = satirlar.reduce((s, r) => s + r.csbTutar, 0);
  const piyasaToplam = satirlar.reduce((s, r) => s + r.piyasaTutar, 0);
  const kendiToplam = satirlar.reduce(
    (s, r) => s + (kendiFiyat[r.kalem.key] ?? 0) * r.kalem.miktar,
    0,
  );
  const eslesen = satirlar.filter((r) => r.poz).length;

  const BASLIK = ["Proje Kalemi", "Poz No", "Açıklama", "Miktar", "Birim", "ÇŞB Birim", "ÇŞB Tutar", "Piyasa Birim", "Piyasa Tutar", "Kendi Birim", "Kendi Tutar"];
  function tabloSatirlari(): (string | number)[][] {
    const r2 = (n: number | undefined) => (n == null ? "" : Math.round(n * 100) / 100);
    return satirlar.map((r) => {
      const kb = kendiFiyat[r.kalem.key];
      return [
        r.kalem.proje, r.poz?.kod ?? "", r.poz?.ad ?? "(eşleşme yok)",
        r.kalem.miktar, r.kalem.birim,
        r2(r.csbBirim), r2(r.csbTutar), r2(r.piyasaBirim), r2(r.piyasaTutar),
        r2(kb), r2((kb ?? 0) * r.kalem.miktar),
      ];
    });
  }
  function toplamSatiri(): (string | number)[] {
    return ["GENEL TOPLAM", "", "", "", "", "", Math.round(csbToplam), "", Math.round(piyasaToplam), "", Math.round(kendiToplam)];
  }
  function excelIndir() {
    excelYaz("kesif-3fiyat", "Keşif", BASLIK, [...tabloSatirlari(), toplamSatiri()]);
  }
  function pdfIndir() {
    pdfYazdir("Keşif & Maliyet — ÇŞB / Piyasa / Kendi", BASLIK, [...tabloSatirlari(), toplamSatiri()],
      "Fiyatlar ₺. Maliyet en düşük geçerli fiyatla hesaplanır.");
  }

  return (
    <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold text-slate-900">🧮 Otomatik Keşif & Maliyet</h2>
          <p className="text-xs text-slate-500">
            {satirlar.length} kalem · {eslesen} poza eşleşti · 3 fiyat: kamu (ÇŞB), piyasa, kendi
            (gerçekleşen). Maliyet en düşük geçerli fiyatla işlenir.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={excelIndir} className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-emerald-700">⬇ Excel</button>
          <button onClick={pdfIndir} className="rounded-xl bg-red-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-red-700">⬇ PDF</button>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500">
              <th className="px-3 py-2">Proje Kalemi</th>
              <th className="px-3 py-2">Poz No</th>
              <th className="px-3 py-2">Açıklama</th>
              <th className="px-3 py-2 text-right">Miktar</th>
              <th className="px-3 py-2 text-right">ÇŞB (kamu)</th>
              <th className="px-3 py-2 text-right">Piyasa</th>
              <th className="px-3 py-2 text-right">Kendi Fiyatımız</th>
            </tr>
          </thead>
          <tbody>
            {satirlar.map((r) => {
              const kb = kendiFiyat[r.kalem.key];
              return (
                <tr key={r.kalem.key} className="border-t border-slate-100 hover:bg-slate-50/60">
                  <td className="px-3 py-2 font-semibold text-slate-800">
                    {r.kalem.proje}
                    <div className="text-[10px] font-normal text-slate-400">
                      {r.kalem.miktar.toLocaleString("tr-TR")} {r.kalem.birim}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    {r.poz ? <span className="font-mono text-xs font-bold text-ink-800">{r.poz.kod}</span>
                      : <span className="text-[10px] font-bold text-amber-600">eşleşme yok</span>}
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-600">
                    <div className="max-w-xs truncate">{r.poz?.ad ?? "—"}</div>
                  </td>
                  <td className="px-3 py-2 text-right text-xs text-slate-500">
                    {r.kalem.miktar.toLocaleString("tr-TR")} {r.kalem.birim}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {r.csbBirim != null ? (
                      <>
                        <div className="font-bold text-slate-900">{formatTL(r.csbTutar)}</div>
                        <div className="text-[10px] text-slate-400">{formatTL(r.csbBirim)}/{r.kalem.birim}</div>
                      </>
                    ) : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {r.piyasaBirim != null ? (
                      <>
                        <div className="font-bold text-emerald-700">{formatTL(r.piyasaTutar)}</div>
                        <div className="text-[10px] text-slate-400">{formatTL(r.piyasaBirim)}/{r.kalem.birim}</div>
                      </>
                    ) : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <input type="number" min="0" placeholder="birim ₺" value={kb ?? ""}
                      onChange={(e) => onKendiFiyat(r.kalem.key, e.target.value)}
                      className="w-24 rounded-lg border border-slate-200 px-2 py-1 text-right text-sm outline-none focus:border-brand-500" />
                    {kb != null && (
                      <div className="text-[10px] font-bold text-ink-800">{formatTL(kb * r.kalem.miktar)}</div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-slate-200 bg-slate-50 font-extrabold">
              <td colSpan={4} className="px-3 py-2.5 text-right text-xs uppercase text-slate-500">Genel Toplam</td>
              <td className="px-3 py-2.5 text-right text-slate-900">{formatTL(csbToplam)}</td>
              <td className="px-3 py-2.5 text-right text-emerald-700">{formatTL(piyasaToplam)}</td>
              <td className="px-3 py-2.5 text-right text-brand-600">{formatTL(kendiToplam)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-center">
          <div className="text-[10px] font-semibold uppercase text-slate-500">Kamu (ÇŞB) Maliyeti</div>
          <div className="text-lg font-extrabold text-slate-900">{formatTL(csbToplam)}</div>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-center">
          <div className="text-[10px] font-semibold uppercase text-emerald-600">Piyasa Maliyeti</div>
          <div className="text-lg font-extrabold text-emerald-700">{formatTL(piyasaToplam)}</div>
        </div>
        <div className="rounded-xl border-2 border-brand-500/50 bg-brand-500/5 p-3 text-center">
          <div className="text-[10px] font-semibold uppercase text-brand-600">Kendi (Gerçekleşen) Maliyetimiz</div>
          <div className="text-lg font-extrabold text-brand-600">{formatTL(kendiToplam)}</div>
        </div>
      </div>
      <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800">
        💡 Poz eşleştirmesi otomatiktir (anahtar kelimeyle). "Eşleşme yok" satırlar için ilgili
        metrajı gözden geçirin. <b>Kendi Fiyatımız</b> sütununa inşaat sürecinde gerçekleşen birim
        fiyatları girdikçe 3. maliyet (gerçekleşen) oluşur.
      </p>
    </section>
  );
}
