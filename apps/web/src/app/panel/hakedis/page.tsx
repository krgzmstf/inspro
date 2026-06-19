"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { type Project, loadProjects, getProject, formatTL } from "@/lib/projects";
import { type Poz, ensurePozlarSeeded } from "@/lib/pozlar";
import { kesifHesapla } from "@/lib/kesifEslesme";
import {
  type Hakedis,
  type HakedisKalem,
  loadHakedisler,
  yeniHakedis,
  saveHakedis,
  deleteHakedis,
  hakedisHesapla,
  hakedisKalemleriTekliften,
} from "@/lib/hakedis";
import { type Teklif, loadTeklifler, teklifToplam } from "@/lib/teklif";
import { type IsimOneri, isimOnerileri, firmaYakala } from "@/lib/firma";
import { excelYaz, pdfBelge } from "@/lib/disaAktar";

type Baz = "piyasa" | "csb" | "kendi";
const BAZ_LABEL: Record<Baz, string> = { piyasa: "Piyasa", csb: "ÇŞB (kamu)", kendi: "Kendi fiyatımız" };

export default function HakedisPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState("");
  const [list, setList] = useState<Hakedis[]>([]);
  const [h, setH] = useState<Hakedis | null>(null);
  const [pozlar, setPozlar] = useState<Poz[]>([]);
  const [baz, setBaz] = useState<Baz>("piyasa");
  const [msg, setMsg] = useState("");
  const [teklifler, setTeklifler] = useState<Teklif[]>([]);
  const [seciliTeklif, setSeciliTeklif] = useState("");
  const [oneriler, setOneriler] = useState<IsimOneri[]>([]);

  useEffect(() => { setOneriler(isimOnerileri()); }, []);

  useEffect(() => {
    const ps = loadProjects();
    setProjects(ps);
    const id = new URLSearchParams(window.location.search).get("proje");
    const initial = id && ps.some((p) => p.id === id) ? id : (ps[0]?.id ?? "");
    if (initial) seçProje(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function seçProje(id: string) {
    setProjectId(id);
    setList(loadHakedisler(id));
    setTeklifler(loadTeklifler(id));
    setSeciliTeklif("");
    setH(null);
    const p = getProject(id);
    const lib = p?.pozKutuphane === "kut1" ? "kut1" : p?.pozKutuphane === "kut3" ? "kut3" : "kut2";
    ensurePozlarSeeded(lib).then(setPozlar);
  }

  const proje = useMemo(() => (projectId ? getProject(projectId) : undefined), [projectId]);
  const kesif = useMemo(() => (proje && pozlar.length ? kesifHesapla(proje, pozlar) : []), [proje, pozlar]);

  function yeni() { setH(yeniHakedis(projectId)); setMsg(""); }
  function duzenle(x: Hakedis) { setH({ ...x }); setMsg(""); }
  function kaydet() {
    if (!h) return;
    saveHakedis(h);
    if (h.taseron.trim()) { firmaYakala(h.taseron.trim(), "taseron"); setOneriler(isimOnerileri()); }
    setList(loadHakedisler(projectId));
    setMsg("✓ Hakediş kaydedildi.");
  }
  function sil(id: string) {
    if (!confirm("Hakediş silinsin mi?")) return;
    deleteHakedis(id);
    setList(loadHakedisler(projectId));
    if (h?.id === id) setH(null);
  }

  // Sözleşme kalemlerini keşiften yükle (yalnız ilk hakedişte/boşken mantıklı)
  function kesiftenYukle() {
    if (!h) return;
    if (kesif.length === 0) { setMsg("Bu projede keşif kalemi yok."); return; }
    if (h.kalemler.length > 0 && !confirm("Mevcut sözleşme kalemleri değiştirilsin mi?")) return;
    const kalemler: HakedisKalem[] = kesif.map((r) => {
      const bf = baz === "csb" ? (r.csbBirim ?? 0)
        : baz === "kendi" ? (proje?.kendiFiyat?.[r.kalem.key] ?? r.piyasaBirim ?? 0)
        : (r.piyasaBirim ?? r.csbBirim ?? 0);
      return { id: crypto.randomUUID(), aciklama: r.kalem.proje, birim: r.kalem.birim, sozlesmeMiktar: r.kalem.miktar, birimFiyat: Math.round(bf), kumulatifMiktar: 0, oncekiKumulatif: 0 };
    });
    setH({ ...h, kalemler });
    setMsg(`✓ ${kalemler.length} sözleşme kalemi yüklendi (${BAZ_LABEL[baz]}).`);
  }

  // Sözleşme kalemlerini kabul edilen teklif­ten yükle (zincir: teklif → hakediş)
  function tekliftenYukle() {
    if (!h) return;
    const t = teklifler.find((x) => x.id === seciliTeklif);
    if (!t) { setMsg("Önce bir teklif seçin."); return; }
    if (t.kalemler.length === 0) { setMsg("Seçilen teklifte kalem yok."); return; }
    if (h.kalemler.length > 0 && !confirm("Mevcut sözleşme kalemleri değiştirilsin mi?")) return;
    const kalemler = hakedisKalemleriTekliften(t.kalemler);
    setH({ ...h, kalemler, taseron: h.taseron || t.musteriFirma || t.musteriAd });
    setMsg(`✓ ${kalemler.length} sözleşme kalemi "${t.no}" teklifinden yüklendi (sözleşme bedeli ${formatTL(teklifToplam(t).araToplam)}).`);
  }

  function kalemGuncelle(id: string, patch: Partial<HakedisKalem>) {
    if (!h) return;
    setH({ ...h, kalemler: h.kalemler.map((k) => (k.id === id ? { ...k, ...patch } : k)) });
  }
  function kalemEkle() {
    if (!h) return;
    setH({ ...h, kalemler: [...h.kalemler, { id: crypto.randomUUID(), aciklama: "", birim: "ad", sozlesmeMiktar: 0, birimFiyat: 0, kumulatifMiktar: 0, oncekiKumulatif: 0 }] });
  }
  function kalemSil(id: string) {
    if (!h) return;
    setH({ ...h, kalemler: h.kalemler.filter((k) => k.id !== id) });
  }
  function tumunuTamamla() {
    if (!h) return;
    setH({ ...h, kalemler: h.kalemler.map((k) => ({ ...k, kumulatifMiktar: k.sozlesmeMiktar })) });
  }

  const hes = useMemo(() => (h ? hakedisHesapla(h) : null), [h]);

  function excelIndir() {
    if (!h || !hes) return;
    const head = ["Açıklama", "Birim", "Sözleşme Mik.", "Birim Fiyat", "Önceki Küm.", "Bu Hakediş Küm.", "Bu Dönem Mik.", "Bu Dönem Tutar", "İlerleme %"];
    const rows = hes.kalemler.map((k) => [k.aciklama, k.birim, k.sozlesmeMiktar, k.birimFiyat, k.oncekiKumulatif, k.kumulatifMiktar, k.buDonemMiktar, Math.round(k.buDonemTutar), Math.round(k.ilerlemeYuzde)]);
    const T = hes.toplam;
    rows.push(["", "", "", "", "", "", "BU DÖNEM BRÜT", Math.round(T.buDonemBrut), ""]);
    rows.push(["", "", "", "", "", "", `KDV %${h.kdvOran}`, Math.round(T.kdv), ""]);
    rows.push(["", "", "", "", "", "", `Teminat %${h.teminatOran}`, -Math.round(T.teminat), ""]);
    rows.push(["", "", "", "", "", "", `Stopaj %${h.stopajOran}`, -Math.round(T.stopaj), ""]);
    rows.push(["", "", "", "", "", "", "Avans Mahsubu", -Math.round(T.avans), ""]);
    rows.push(["", "", "", "", "", "", "NET ÖDEME", Math.round(T.netOdeme), ""]);
    excelYaz(`hakedis-${h.no}-${proje?.name ?? ""}`, `Hakediş ${h.no}`, head, rows);
  }

  function pdfIndir() {
    if (!h || !hes) return;
    const esc = (s: unknown) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const tl = (n: number) => formatTL(n);
    const T = hes.toplam;
    const satirlar = hes.kalemler.map((k, i) => `<tr>
      <td style="padding:5px 7px;border-bottom:1px solid #eef0f3;text-align:center">${i + 1}</td>
      <td style="padding:5px 7px;border-bottom:1px solid #eef0f3">${esc(k.aciklama)}</td>
      <td style="padding:5px 7px;border-bottom:1px solid #eef0f3;text-align:right">${esc(k.sozlesmeMiktar)} ${esc(k.birim)}</td>
      <td style="padding:5px 7px;border-bottom:1px solid #eef0f3;text-align:right">${tl(k.birimFiyat)}</td>
      <td style="padding:5px 7px;border-bottom:1px solid #eef0f3;text-align:right">${esc(k.oncekiKumulatif)}</td>
      <td style="padding:5px 7px;border-bottom:1px solid #eef0f3;text-align:right">${esc(k.kumulatifMiktar)}</td>
      <td style="padding:5px 7px;border-bottom:1px solid #eef0f3;text-align:right">${esc(Math.round(k.buDonemMiktar * 100) / 100)}</td>
      <td style="padding:5px 7px;border-bottom:1px solid #eef0f3;text-align:right;font-weight:bold">${tl(k.buDonemTutar)}</td>
    </tr>`).join("");
    const kesintiSatir = (ad: string, val: number, neg = true) => `<tr><td style="padding:4px 8px;color:#6b7280">${ad}</td><td style="padding:4px 8px;text-align:right;color:${neg ? "#b91c1c" : "#1f2937"}">${neg ? "−" : ""}${tl(val)}</td></tr>`;
    const govde = `
      <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #126b85;padding-bottom:10px">
        <div class="logo">ins<b>PRO</b><div style="font-size:11px;color:#6b7280;font-weight:normal">İnşaat Süreç Yönetimi</div></div>
        <div style="text-align:right;font-size:12px">
          <div style="font-size:18px;font-weight:800;color:#126b85">HAKEDİŞ RAPORU</div>
          <div>Hakediş No: <b>${h.no}</b></div>
          <div>Tarih: ${esc(h.tarih)}</div>
        </div>
      </div>
      <div style="display:flex;justify-content:space-between;margin-top:14px;font-size:12px">
        <div><div style="font-size:10px;text-transform:uppercase;color:#9ca3af;font-weight:bold">Taşeron / Yüklenici</div>
          <div style="font-weight:bold;font-size:14px">${esc(h.taseron || "—")}</div></div>
        <div style="text-align:right"><div style="font-size:10px;text-transform:uppercase;color:#9ca3af;font-weight:bold">Proje</div>
          <div style="font-weight:bold">${esc(proje?.name ?? "")}</div>
          <div style="color:#6b7280">${esc(proje?.city ?? "")} · Genel ilerleme %${Math.round(T.genelIlerleme)}</div></div>
      </div>
      <table style="margin-top:16px;font-size:11px">
        <thead><tr style="background:#f3f4f6">
          ${["#", "İmalat Açıklaması", "Sözleşme", "B.Fiyat", "Önceki Küm.", "Bu Küm.", "Bu Dönem", "Bu Dönem Tutar"]
            .map((b) => `<th style="padding:6px 7px;text-align:${b === "İmalat Açıklaması" ? "left" : b === "#" ? "center" : "right"};font-size:9px;text-transform:uppercase;color:#374151">${b}</th>`).join("")}
        </tr></thead>
        <tbody>${satirlar}</tbody>
      </table>
      <div style="display:flex;justify-content:flex-end;margin-top:12px">
        <table style="width:320px;font-size:12px">
          <tr><td style="padding:4px 8px;color:#6b7280">Bu Dönem Brüt</td><td style="padding:4px 8px;text-align:right;font-weight:bold">${tl(T.buDonemBrut)}</td></tr>
          ${kesintiSatir(`KDV (%${h.kdvOran})`, T.kdv, false)}
          ${kesintiSatir(`Teminat Kesintisi (%${h.teminatOran})`, T.teminat)}
          ${h.stopajOran ? kesintiSatir(`Stopaj (%${h.stopajOran})`, T.stopaj) : ""}
          ${h.avansMahsup ? kesintiSatir("Avans Mahsubu", T.avans) : ""}
          <tr style="border-top:2px solid #126b85"><td style="padding:6px 8px;font-weight:800">NET ÖDEME</td><td style="padding:6px 8px;text-align:right;font-weight:800;color:#126b85;font-size:15px">${tl(T.netOdeme)}</td></tr>
        </table>
      </div>
      ${h.not ? `<div style="margin-top:14px;font-size:11px;color:#4b5563"><b>Not:</b> ${esc(h.not).replace(/\n/g, "<br>")}</div>` : ""}
      <div style="margin-top:34px;display:flex;justify-content:space-between;font-size:12px;color:#6b7280">
        <div>Düzenleyen<br><br>_____________________</div>
        <div style="text-align:center">Kontrol<br><br>_____________________</div>
        <div style="text-align:right">Onay<br><br>_____________________</div>
      </div>`;
    pdfBelge(`Hakediş ${h.no} — ${proje?.name ?? ""}`, govde);
  }

  if (projects.length === 0) {
    return (
      <div className="mx-auto max-w-6xl">
        <h1 className="text-2xl font-extrabold text-slate-900">🧾 Hakediş</h1>
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
      <datalist id="cari-rehber">
        {oneriler.map((o) => <option key={o.ad} value={o.ad}>{o.etiket}</option>)}
      </datalist>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">🧾 Hakediş</h1>
          <p className="mt-1 text-sm text-slate-500">Taşeron dönemsel istihkak: kümülatif imalat, teminat/stopaj/avans kesintileri, net ödeme.</p>
        </div>
        <select value={projectId} onChange={(e) => seçProje(e.target.value)}
          className="rounded-xl border-2 border-sky-200 bg-[#f2f8fd] px-4 py-2.5 text-sm font-semibold outline-none focus:border-brand-500">
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[280px_1fr]">
        {/* Hakediş listesi */}
        <div>
          <button onClick={yeni} className="w-full rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-brand-600">+ Yeni Hakediş</button>
          <div className="mt-3 space-y-2">
            {list.length === 0 && <p className="text-xs text-slate-400">Henüz hakediş yok.</p>}
            {list.map((x) => {
              const t = hakedisHesapla(x).toplam;
              return (
                <button key={x.id} onClick={() => duzenle(x)}
                  className={`block w-full rounded-xl border-2 p-3 text-left transition ${h?.id === x.id ? "border-brand-500 bg-brand-500/5" : "border-sky-200 bg-[#f2f8fd] hover:border-slate-300"}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-ink-800">Hakediş #{x.no}</span>
                    <span className="text-xs text-slate-400">{x.tarih}</span>
                  </div>
                  <div className="mt-0.5 truncate text-sm font-semibold text-slate-700">{x.taseron || "(taşeron yok)"}</div>
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(100, t.genelIlerleme)}%` }} />
                  </div>
                  <div className="mt-1 flex items-center justify-between text-xs">
                    <span className="text-slate-400">%{Math.round(t.genelIlerleme)}</span>
                    <span className="font-bold text-emerald-700">{formatTL(t.netOdeme)}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Editör */}
        {!h || !hes ? (
          <div className="flex min-h-60 items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-white/60 text-center text-sm text-slate-500">
            Soldan hakediş seçin veya &quot;Yeni Hakediş&quot; oluşturun.
          </div>
        ) : (
          <div className="space-y-5">
            {/* Üst bilgi */}
            <div className="rounded-2xl border border-sky-200 bg-[#f2f8fd] p-5 shadow-sm">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Fld label="Hakediş No"><input type="number" value={h.no} onChange={(e) => setH({ ...h, no: parseInt(e.target.value) || 1 })} className={inp} /></Fld>
                <Fld label="Tarih"><input type="date" value={h.tarih} onChange={(e) => setH({ ...h, tarih: e.target.value })} className={inp} /></Fld>
                <Fld label="Taşeron / Yüklenici"><input list="cari-rehber" value={h.taseron} onChange={(e) => setH({ ...h, taseron: e.target.value })} className={inp} /></Fld>
                <Fld label="Avans Mahsubu (TL)"><input type="number" value={h.avansMahsup} onChange={(e) => setH({ ...h, avansMahsup: parseFloat(e.target.value) || 0 })} className={inp} /></Fld>
                <Fld label="Teminat (%)"><input type="number" value={h.teminatOran} onChange={(e) => setH({ ...h, teminatOran: parseFloat(e.target.value) || 0 })} className={inp} /></Fld>
                <Fld label="Stopaj (%)"><input type="number" value={h.stopajOran} onChange={(e) => setH({ ...h, stopajOran: parseFloat(e.target.value) || 0 })} className={inp} /></Fld>
                <Fld label="KDV (%)"><input type="number" value={h.kdvOran} onChange={(e) => setH({ ...h, kdvOran: parseFloat(e.target.value) || 0 })} className={inp} /></Fld>
              </div>
            </div>

            {/* Sözleşme kalemlerini yükle (kalem boşken öne çıkar) */}
            {h.kalemler.length === 0 && (
              <div className="rounded-2xl border-2 border-brand-500/40 bg-white p-5 shadow-sm">
                <h2 className="text-sm font-extrabold text-slate-900">Sözleşme Kalemlerini Yükle</h2>

                {/* Tekliften (zincir: keşif → teklif → hakediş) */}
                <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50/60 p-3">
                  <div className="text-xs font-bold text-emerald-700">📄 Kabul edilen teklif­ten (önerilen)</div>
                  <p className="mt-0.5 text-[11px] text-slate-500">Sözleşme bedeli, müşterinin onayladığı teklif fiyatlarıyla gelir.</p>
                  <div className="mt-2 flex flex-wrap items-end gap-3">
                    <Fld label="Teklif">
                      <select value={seciliTeklif} onChange={(e) => setSeciliTeklif(e.target.value)} className={inp}>
                        <option value="">— Teklif seç —</option>
                        {teklifler.map((t) => (
                          <option key={t.id} value={t.id}>{t.no} · {t.musteriFirma || t.musteriAd || "müşteri"} · {formatTL(teklifToplam(t).araToplam)}</option>
                        ))}
                      </select>
                    </Fld>
                    <button onClick={tekliftenYukle} disabled={!seciliTeklif}
                      className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:opacity-50">
                      ↻ Teklif­ten Yükle
                    </button>
                  </div>
                  {teklifler.length === 0 && (
                    <p className="mt-2 text-[11px] text-amber-600">Bu projede henüz teklif yok. Önce Teklif modülünden keşiften teklif oluşturun.</p>
                  )}
                </div>

                {/* Keşiften (taslak) */}
                <div className="mt-3 border-t border-slate-100 pt-3">
                  <div className="text-xs font-bold text-slate-600">📐 Doğrudan keşiften (taslak)</div>
                  <div className="mt-2 flex flex-wrap items-end gap-3">
                    <Fld label="Birim Fiyat Bazı">
                      <select value={baz} onChange={(e) => setBaz(e.target.value as Baz)} className={inp}>
                        {(["piyasa", "csb", "kendi"] as Baz[]).map((b) => <option key={b} value={b}>{BAZ_LABEL[b]}</option>)}
                      </select>
                    </Fld>
                    <button onClick={kesiftenYukle} className="rounded-xl bg-ink-900 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-ink-800">↻ Keşiften Yükle ({kesif.length})</button>
                  </div>
                  <p className="mt-2 text-[11px] text-slate-400">Sözleşme miktarı = keşif metrajı. Sonraki hakedişlerde bu kalemler otomatik devreder.</p>
                </div>
              </div>
            )}

            {/* Kalemler */}
            <div className="rounded-2xl border border-sky-200 bg-[#f2f8fd] p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-extrabold text-slate-900">İmalat Kalemleri ({h.kalemler.length})</h2>
                <div className="flex gap-2">
                  <button onClick={tumunuTamamla} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 transition hover:border-emerald-300 hover:text-emerald-600">%100 yap</button>
                  <button onClick={kalemEkle} className="rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-brand-600">+ Satır</button>
                </div>
              </div>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[820px] text-sm">
                  <thead><tr className="text-left text-[11px] font-bold uppercase text-slate-500">
                    <th className="px-2 py-2">İmalat</th><th className="px-2 py-2 w-16">Birim</th><th className="px-2 py-2 w-24 text-right">Sözleşme</th><th className="px-2 py-2 w-28 text-right">B.Fiyat</th><th className="px-2 py-2 w-24 text-right">Önceki Küm.</th><th className="px-2 py-2 w-24 text-right">Bu Küm.</th><th className="px-2 py-2 w-28 text-right">Bu Dönem ₺</th><th className="px-2 py-2 w-20">İlerleme</th><th /></tr></thead>
                  <tbody>
                    {hes.kalemler.map((k) => (
                      <tr key={k.id} className="border-t border-slate-100">
                        <td className="px-2 py-1"><input value={k.aciklama} onChange={(e) => kalemGuncelle(k.id, { aciklama: e.target.value })} className="w-full rounded-lg border border-slate-200 px-2 py-1 text-sm outline-none focus:border-brand-500" /></td>
                        <td className="px-2 py-1"><input value={k.birim} onChange={(e) => kalemGuncelle(k.id, { birim: e.target.value })} className="w-full rounded-lg border border-slate-200 px-2 py-1 text-sm outline-none focus:border-brand-500" /></td>
                        <td className="px-2 py-1"><input type="number" value={k.sozlesmeMiktar} onChange={(e) => kalemGuncelle(k.id, { sozlesmeMiktar: parseFloat(e.target.value) || 0 })} className="w-full rounded-lg border border-slate-200 px-2 py-1 text-right text-sm outline-none focus:border-brand-500" /></td>
                        <td className="px-2 py-1"><input type="number" value={k.birimFiyat} onChange={(e) => kalemGuncelle(k.id, { birimFiyat: parseFloat(e.target.value) || 0 })} className="w-full rounded-lg border border-slate-200 px-2 py-1 text-right text-sm outline-none focus:border-brand-500" /></td>
                        <td className="px-2 py-1 text-right text-slate-400">{k.oncekiKumulatif}</td>
                        <td className="px-2 py-1"><input type="number" value={k.kumulatifMiktar} onChange={(e) => kalemGuncelle(k.id, { kumulatifMiktar: parseFloat(e.target.value) || 0 })} className={`w-full rounded-lg border px-2 py-1 text-right text-sm outline-none focus:border-brand-500 ${k.kumulatifMiktar < k.oncekiKumulatif || k.kumulatifMiktar > k.sozlesmeMiktar ? "border-red-300 bg-red-50" : "border-slate-200"}`} /></td>
                        <td className="px-2 py-1 text-right font-bold text-slate-900">{formatTL(k.buDonemTutar)}</td>
                        <td className="px-2 py-1">
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(100, k.ilerlemeYuzde)}%` }} /></div>
                          <div className="mt-0.5 text-center text-[10px] text-slate-400">%{Math.round(k.ilerlemeYuzde)}</div>
                        </td>
                        <td className="px-1 py-1 text-center"><button onClick={() => kalemSil(k.id)} className="text-slate-300 transition hover:text-red-500">✕</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Özet */}
              <div className="mt-4 flex justify-end">
                <div className="w-72 space-y-1 text-sm">
                  <div className="flex justify-between text-slate-500"><span>Sözleşme Bedeli</span><b>{formatTL(hes.toplam.sozlesme)}</b></div>
                  <div className="flex justify-between text-slate-500"><span>Kümülatif İmalat</span><b>{formatTL(hes.toplam.kumulatif)}</b></div>
                  <div className="flex justify-between border-t border-slate-100 pt-1 text-slate-700"><span>Bu Dönem Brüt</span><b>{formatTL(hes.toplam.buDonemBrut)}</b></div>
                  <div className="flex justify-between text-slate-500"><span>+ KDV (%{h.kdvOran})</span><span>{formatTL(hes.toplam.kdv)}</span></div>
                  <div className="flex justify-between text-red-600"><span>− Teminat (%{h.teminatOran})</span><span>{formatTL(hes.toplam.teminat)}</span></div>
                  {h.stopajOran > 0 && <div className="flex justify-between text-red-600"><span>− Stopaj (%{h.stopajOran})</span><span>{formatTL(hes.toplam.stopaj)}</span></div>}
                  {h.avansMahsup > 0 && <div className="flex justify-between text-red-600"><span>− Avans Mahsubu</span><span>{formatTL(hes.toplam.avans)}</span></div>}
                  <div className="flex justify-between border-t-2 border-ink-900 pt-1 text-base"><span className="font-extrabold">NET ÖDEME</span><b className="font-extrabold text-brand-600">{formatTL(hes.toplam.netOdeme)}</b></div>
                </div>
              </div>
            </div>

            {/* Not */}
            <div className="rounded-2xl border border-sky-200 bg-[#f2f8fd] p-5 shadow-sm">
              <Fld label="Not (opsiyonel)"><textarea value={h.not} onChange={(e) => setH({ ...h, not: e.target.value })} rows={2} className={inp} /></Fld>
            </div>

            {/* Aksiyonlar */}
            <div className="flex flex-wrap items-center gap-2">
              <button onClick={kaydet} className="rounded-xl bg-ink-900 px-6 py-2.5 text-sm font-bold text-white transition hover:bg-ink-800">💾 Kaydet</button>
              <button onClick={pdfIndir} className="rounded-xl bg-red-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-red-700">⬇ PDF Hakediş</button>
              <button onClick={excelIndir} className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-700">⬇ Excel</button>
              <button onClick={() => sil(h.id)} className="rounded-xl border-2 border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-500 transition hover:border-red-300 hover:text-red-500">Sil</button>
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
