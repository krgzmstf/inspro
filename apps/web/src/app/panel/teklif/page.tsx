"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { type Project, loadProjects, getProject, formatTL } from "@/lib/projects";
import { type Poz, ensurePozlarSeeded } from "@/lib/pozlar";
import { kesifHesapla } from "@/lib/kesifEslesme";
import {
  type Teklif,
  type TeklifBaz,
  type TeklifKalem,
  loadTeklifler,
  yeniTeklif,
  saveTeklif,
  deleteTeklif,
  teklifToplam,
} from "@/lib/teklif";
import { excelYaz, pdfBelge } from "@/lib/disaAktar";

const BAZ_LABEL: Record<TeklifBaz, string> = {
  csb: "ÇŞB (kamu)", piyasa: "Piyasa", kendi: "Kendi fiyatımız", manuel: "Manuel",
};

export default function TeklifPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState("");
  const [teklifler, setTeklifler] = useState<Teklif[]>([]);
  const [t, setT] = useState<Teklif | null>(null); // düzenlenen teklif
  const [pozlar, setPozlar] = useState<Poz[]>([]);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    const list = loadProjects();
    setProjects(list);
    const id = new URLSearchParams(window.location.search).get("proje");
    const initial = id && list.some((p) => p.id === id) ? id : (list[0]?.id ?? "");
    if (initial) seçProje(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function seçProje(id: string) {
    setProjectId(id);
    setTeklifler(loadTeklifler(id));
    setT(null);
    const p = getProject(id);
    const lib = p?.pozKutuphane === "kut1" ? "kut1" : p?.pozKutuphane === "kut3" ? "kut3" : "kut2";
    ensurePozlarSeeded(lib).then(setPozlar);
  }

  const proje = useMemo(() => (projectId ? getProject(projectId) : undefined), [projectId]);
  const kesif = useMemo(() => (proje && pozlar.length ? kesifHesapla(proje, pozlar) : []), [proje, pozlar]);

  function yeni() { setT(yeniTeklif(projectId)); setMsg(""); }
  function duzenle(x: Teklif) { setT({ ...x }); setMsg(""); }
  function kaydet() {
    if (!t) return;
    saveTeklif(t);
    setTeklifler(loadTeklifler(projectId));
    setMsg("✓ Teklif kaydedildi.");
  }
  function sil(id: string) {
    if (!confirm("Teklif silinsin mi?")) return;
    deleteTeklif(id);
    setTeklifler(loadTeklifler(projectId));
    if (t?.id === id) setT(null);
  }

  // Keşiften kalemleri yükle (baz fiyat × kâr marjı)
  function kesiftenYukle() {
    if (!t) return;
    if (kesif.length === 0) { setMsg("Bu projede keşif kalemi yok."); return; }
    const carpan = 1 + (t.karMarji || 0) / 100;
    const kalemler: TeklifKalem[] = kesif.map((r) => {
      const baz = t.baz === "csb" ? (r.csbBirim ?? 0) : t.baz === "kendi"
        ? (proje?.kendiFiyat?.[r.kalem.key] ?? r.piyasaBirim ?? 0)
        : (r.piyasaBirim ?? r.csbBirim ?? 0);
      return { id: crypto.randomUUID(), aciklama: r.kalem.proje, miktar: r.kalem.miktar, birim: r.kalem.birim, birimFiyat: Math.round(baz * carpan) };
    });
    setT({ ...t, kalemler });
    setMsg(`✓ ${kalemler.length} kalem keşiften yüklendi (${BAZ_LABEL[t.baz]} + %${t.karMarji} kâr).`);
  }

  function kalemGuncelle(id: string, patch: Partial<TeklifKalem>) {
    if (!t) return;
    setT({ ...t, kalemler: t.kalemler.map((k) => (k.id === id ? { ...k, ...patch } : k)) });
  }
  function kalemEkle() {
    if (!t) return;
    setT({ ...t, kalemler: [...t.kalemler, { id: crypto.randomUUID(), aciklama: "", miktar: 1, birim: "ad", birimFiyat: 0 }] });
  }
  function kalemSil(id: string) {
    if (!t) return;
    setT({ ...t, kalemler: t.kalemler.filter((k) => k.id !== id) });
  }

  const top = t ? teklifToplam(t) : null;

  function excelIndir() {
    if (!t) return;
    const head = ["Açıklama", "Miktar", "Birim", "Birim Fiyat", "Tutar"];
    const rows = t.kalemler.map((k) => [k.aciklama, k.miktar, k.birim, k.birimFiyat, Math.round(k.miktar * k.birimFiyat)]);
    rows.push(["", "", "", "ARA TOPLAM", Math.round(top!.araToplam)]);
    rows.push(["", "", "", `KDV %${t.kdvOran}`, Math.round(top!.kdv)]);
    rows.push(["", "", "", "GENEL TOPLAM", Math.round(top!.genelToplam)]);
    excelYaz(`teklif-${t.no}`, "Teklif", head, rows);
  }

  function pdfIndir() {
    if (!t || !top) return;
    const esc = (s: unknown) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const tl = (n: number) => formatTL(n);
    const satirlar = t.kalemler.map((k, i) => `<tr>
      <td style="padding:5px 8px;border-bottom:1px solid #eef0f3;text-align:center">${i + 1}</td>
      <td style="padding:5px 8px;border-bottom:1px solid #eef0f3">${esc(k.aciklama)}</td>
      <td style="padding:5px 8px;border-bottom:1px solid #eef0f3;text-align:right">${esc(k.miktar)} ${esc(k.birim)}</td>
      <td style="padding:5px 8px;border-bottom:1px solid #eef0f3;text-align:right">${tl(k.birimFiyat)}</td>
      <td style="padding:5px 8px;border-bottom:1px solid #eef0f3;text-align:right;font-weight:bold">${tl(k.miktar * k.birimFiyat)}</td>
    </tr>`).join("");
    const govde = `
      <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #126b85;padding-bottom:10px">
        <div class="logo">ins<b>PRO</b><div style="font-size:11px;color:#6b7280;font-weight:normal">İnşaat Süreç Yönetimi</div></div>
        <div style="text-align:right;font-size:12px">
          <div style="font-size:18px;font-weight:800;color:#126b85">FİYAT TEKLİFİ</div>
          <div>No: <b>${esc(t.no)}</b></div>
          <div>Tarih: ${esc(t.tarih)}</div>
          <div>Geçerlilik: ${esc(t.gecerlilikGun)} gün</div>
        </div>
      </div>
      <div style="display:flex;justify-content:space-between;margin-top:14px;font-size:12px">
        <div><div style="font-size:10px;text-transform:uppercase;color:#9ca3af;font-weight:bold">Sayın</div>
          <div style="font-weight:bold;font-size:14px">${esc(t.musteriAd || "—")}</div>
          ${t.musteriFirma ? `<div>${esc(t.musteriFirma)}</div>` : ""}
          ${t.musteriAdres ? `<div style="color:#6b7280">${esc(t.musteriAdres)}</div>` : ""}
          ${t.musteriTel ? `<div style="color:#6b7280">${esc(t.musteriTel)}</div>` : ""}
        </div>
        <div style="text-align:right"><div style="font-size:10px;text-transform:uppercase;color:#9ca3af;font-weight:bold">Proje</div>
          <div style="font-weight:bold">${esc(proje?.name ?? "")}</div>
          <div style="color:#6b7280">${esc(proje?.city ?? "")} · ${proje ? proje.area.toLocaleString("tr-TR") : ""} m²</div>
        </div>
      </div>
      <table style="margin-top:16px;font-size:12px">
        <thead><tr style="background:#f3f4f6">
          <th style="padding:7px 8px;text-align:center;font-size:10px;text-transform:uppercase;color:#374151">#</th>
          <th style="padding:7px 8px;text-align:left;font-size:10px;text-transform:uppercase;color:#374151">Açıklama</th>
          <th style="padding:7px 8px;text-align:right;font-size:10px;text-transform:uppercase;color:#374151">Miktar</th>
          <th style="padding:7px 8px;text-align:right;font-size:10px;text-transform:uppercase;color:#374151">Birim Fiyat</th>
          <th style="padding:7px 8px;text-align:right;font-size:10px;text-transform:uppercase;color:#374151">Tutar</th>
        </tr></thead>
        <tbody>${satirlar}</tbody>
      </table>
      <div style="display:flex;justify-content:flex-end;margin-top:12px">
        <table style="width:300px;font-size:13px">
          <tr><td style="padding:4px 8px;color:#6b7280">Ara Toplam</td><td style="padding:4px 8px;text-align:right">${tl(top.araToplam)}</td></tr>
          <tr><td style="padding:4px 8px;color:#6b7280">KDV (%${t.kdvOran})</td><td style="padding:4px 8px;text-align:right">${tl(top.kdv)}</td></tr>
          <tr style="border-top:2px solid #126b85"><td style="padding:6px 8px;font-weight:800">GENEL TOPLAM</td><td style="padding:6px 8px;text-align:right;font-weight:800;color:#126b85;font-size:15px">${tl(top.genelToplam)}</td></tr>
        </table>
      </div>
      ${t.sartlar ? `<div style="margin-top:18px;font-size:11px;color:#4b5563"><b>Şartlar:</b><br>${esc(t.sartlar).replace(/\n/g, "<br>")}</div>` : ""}
      ${t.not ? `<div style="margin-top:8px;font-size:11px;color:#6b7280">${esc(t.not).replace(/\n/g, "<br>")}</div>` : ""}
      <div style="margin-top:30px;display:flex;justify-content:space-between;font-size:12px;color:#6b7280">
        <div>Teklifi Veren<br><br>_____________________</div>
        <div style="text-align:right">Kaşe / İmza<br><br>_____________________</div>
      </div>`;
    pdfBelge(`Teklif ${t.no}`, govde);
  }

  if (projects.length === 0) {
    return (
      <div className="mx-auto max-w-6xl">
        <h1 className="text-2xl font-extrabold text-slate-900">📄 Teklif</h1>
        <div className="mt-8 rounded-2xl border-2 border-dashed border-slate-300 bg-white p-12 text-center">
          <div className="text-4xl">🏗️</div>
          <h3 className="mt-3 text-lg font-bold text-slate-900">Önce bir proje gerekli</h3>
          <Link href="/panel/yeni" className="mt-5 inline-block rounded-xl bg-brand-500 px-6 py-3 text-sm font-bold text-white transition hover:bg-brand-600">+ Proje Oluştur</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">📄 Teklif</h1>
          <p className="mt-1 text-sm text-slate-500">Keşiften müşteriye profesyonel fiyat teklifi (PDF/Excel).</p>
        </div>
        <select value={projectId} onChange={(e) => seçProje(e.target.value)}
          className="rounded-xl border-2 border-sky-200 bg-[#f2f8fd] px-4 py-2.5 text-sm font-semibold outline-none focus:border-brand-500">
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[300px_1fr]">
        {/* Teklif listesi */}
        <div>
          <button onClick={yeni} className="w-full rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-brand-600">+ Yeni Teklif</button>
          <div className="mt-3 space-y-2">
            {teklifler.length === 0 && <p className="text-xs text-slate-400">Henüz teklif yok.</p>}
            {teklifler.map((x) => {
              const tt = teklifToplam(x);
              return (
                <button key={x.id} onClick={() => duzenle(x)}
                  className={`block w-full rounded-xl border-2 p-3 text-left transition ${t?.id === x.id ? "border-brand-500 bg-brand-500/5" : "border-sky-200 bg-[#f2f8fd] hover:border-slate-300"}`}>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-ink-800">{x.no}</span>
                    <span className="text-xs text-slate-400">{x.tarih}</span>
                  </div>
                  <div className="mt-0.5 truncate text-sm font-semibold text-slate-700">{x.musteriAd || x.musteriFirma || "(müşteri yok)"}</div>
                  <div className="mt-0.5 text-xs font-bold text-emerald-700">{formatTL(tt.genelToplam)}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Editör */}
        {!t ? (
          <div className="flex min-h-60 items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-white/60 text-center text-sm text-slate-500">
            Soldan teklif seçin veya &quot;Yeni Teklif&quot; oluşturun.
          </div>
        ) : (
          <div className="space-y-5">
            {/* Müşteri + teklif bilgileri */}
            <div className="rounded-2xl border border-sky-200 bg-[#f2f8fd] p-5 shadow-sm">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Fld label="Teklif No"><input value={t.no} onChange={(e) => setT({ ...t, no: e.target.value })} className={inp} /></Fld>
                <Fld label="Tarih"><input type="date" value={t.tarih} onChange={(e) => setT({ ...t, tarih: e.target.value })} className={inp} /></Fld>
                <Fld label="Geçerlilik (gün)"><input type="number" value={t.gecerlilikGun} onChange={(e) => setT({ ...t, gecerlilikGun: parseInt(e.target.value) || 0 })} className={inp} /></Fld>
                <Fld label="KDV (%)"><input type="number" value={t.kdvOran} onChange={(e) => setT({ ...t, kdvOran: parseFloat(e.target.value) || 0 })} className={inp} /></Fld>
                <Fld label="Müşteri Ad Soyad"><input value={t.musteriAd} onChange={(e) => setT({ ...t, musteriAd: e.target.value })} className={inp} /></Fld>
                <Fld label="Firma"><input value={t.musteriFirma} onChange={(e) => setT({ ...t, musteriFirma: e.target.value })} className={inp} /></Fld>
                <Fld label="Telefon"><input value={t.musteriTel} onChange={(e) => setT({ ...t, musteriTel: e.target.value })} className={inp} /></Fld>
                <Fld label="Adres"><input value={t.musteriAdres} onChange={(e) => setT({ ...t, musteriAdres: e.target.value })} className={inp} /></Fld>
              </div>
            </div>

            {/* Keşiften yükle */}
            <div className="rounded-2xl border-2 border-brand-500/40 bg-white p-5 shadow-sm">
              <h2 className="text-sm font-extrabold text-slate-900">Keşiften Kalem Yükle</h2>
              <div className="mt-3 flex flex-wrap items-end gap-3">
                <Fld label="Baz Fiyat">
                  <select value={t.baz} onChange={(e) => setT({ ...t, baz: e.target.value as TeklifBaz })} className={inp}>
                    {(["piyasa", "csb", "kendi"] as TeklifBaz[]).map((b) => <option key={b} value={b}>{BAZ_LABEL[b]}</option>)}
                  </select>
                </Fld>
                <Fld label="Kâr Marjı (%)"><input type="number" value={t.karMarji} onChange={(e) => setT({ ...t, karMarji: parseFloat(e.target.value) || 0 })} className={inp} /></Fld>
                <button onClick={kesiftenYukle} className="rounded-xl bg-ink-900 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-ink-800">↻ Keşiften Yükle ({kesif.length})</button>
              </div>
              <p className="mt-2 text-[11px] text-slate-400">Keşif kalemleri seçili baz fiyat × (1 + kâr marjı) ile yüklenir; sonra elle düzenleyebilirsiniz.</p>
            </div>

            {/* Kalemler */}
            <div className="rounded-2xl border border-sky-200 bg-[#f2f8fd] p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-extrabold text-slate-900">Teklif Kalemleri ({t.kalemler.length})</h2>
                <button onClick={kalemEkle} className="rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-brand-600">+ Satır</button>
              </div>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-0 text-[11px] sm:min-w-[640px] sm:text-sm">
                  <thead><tr className="text-left text-[11px] font-bold uppercase text-slate-500">
                    <th className="px-2 py-2">Açıklama</th><th className="px-2 py-2 w-24">Miktar</th><th className="px-2 py-2 w-20">Birim</th><th className="px-2 py-2 w-28 text-right">Birim Fiyat</th><th className="px-2 py-2 w-28 text-right">Tutar</th><th /></tr></thead>
                  <tbody>
                    {t.kalemler.map((k) => (
                      <tr key={k.id} className="border-t border-slate-100">
                        <td className="px-2 py-1"><input value={k.aciklama} onChange={(e) => kalemGuncelle(k.id, { aciklama: e.target.value })} className="w-full rounded-lg border border-slate-200 px-2 py-1 text-sm outline-none focus:border-brand-500" /></td>
                        <td className="px-2 py-1"><input type="number" value={k.miktar} onChange={(e) => kalemGuncelle(k.id, { miktar: parseFloat(e.target.value) || 0 })} className="w-full rounded-lg border border-slate-200 px-2 py-1 text-right text-sm outline-none focus:border-brand-500" /></td>
                        <td className="px-2 py-1"><input value={k.birim} onChange={(e) => kalemGuncelle(k.id, { birim: e.target.value })} className="w-full rounded-lg border border-slate-200 px-2 py-1 text-sm outline-none focus:border-brand-500" /></td>
                        <td className="px-2 py-1"><input type="number" value={k.birimFiyat} onChange={(e) => kalemGuncelle(k.id, { birimFiyat: parseFloat(e.target.value) || 0 })} className="w-full rounded-lg border border-slate-200 px-2 py-1 text-right text-sm outline-none focus:border-brand-500" /></td>
                        <td className="px-2 py-1 text-right font-bold text-slate-900">{formatTL(k.miktar * k.birimFiyat)}</td>
                        <td className="px-1 py-1 text-center"><button onClick={() => kalemSil(k.id)} className="text-slate-300 transition hover:text-red-500">✕</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {top && (
                <div className="mt-3 flex justify-end">
                  <div className="w-64 space-y-1 text-sm">
                    <div className="flex justify-between text-slate-600"><span>Ara Toplam</span><b>{formatTL(top.araToplam)}</b></div>
                    <div className="flex justify-between text-slate-600"><span>KDV (%{t.kdvOran})</span><b>{formatTL(top.kdv)}</b></div>
                    <div className="flex justify-between border-t-2 border-ink-900 pt-1 text-base"><span className="font-extrabold">GENEL TOPLAM</span><b className="font-extrabold text-brand-600">{formatTL(top.genelToplam)}</b></div>
                  </div>
                </div>
              )}
            </div>

            {/* Şartlar + not */}
            <div className="rounded-2xl border border-sky-200 bg-[#f2f8fd] p-5 shadow-sm">
              <Fld label="Şartlar"><textarea value={t.sartlar} onChange={(e) => setT({ ...t, sartlar: e.target.value })} rows={3} className={inp} /></Fld>
              <div className="mt-3"><Fld label="Not (opsiyonel)"><textarea value={t.not} onChange={(e) => setT({ ...t, not: e.target.value })} rows={2} className={inp} /></Fld></div>
            </div>

            {/* Aksiyonlar */}
            <div className="flex flex-wrap items-center gap-2">
              <button onClick={kaydet} className="rounded-xl bg-ink-900 px-6 py-2.5 text-sm font-bold text-white transition hover:bg-ink-800">💾 Kaydet</button>
              <button onClick={pdfIndir} className="rounded-xl bg-red-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-red-700">⬇ PDF Teklif</button>
              <button onClick={excelIndir} className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-700">⬇ Excel</button>
              <button onClick={() => sil(t.id)} className="rounded-xl border-2 border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-500 transition hover:border-red-300 hover:text-red-500">Sil</button>
              {msg && <span className="text-xs font-semibold text-emerald-600">{msg}</span>}
            </div>
          </div>
        )}
      </div>

      <div className="mt-8 text-sm">
        <Link href="/panel" className="font-semibold text-slate-500 transition hover:text-ink-800">← Projelere dön</Link>
      </div>
    </div>
  );
}

const inp = "w-full rounded-xl border-2 border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-brand-500";
function Fld({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="text-xs font-semibold text-slate-600">{label}</span><div className="mt-1">{children}</div></label>;
}
