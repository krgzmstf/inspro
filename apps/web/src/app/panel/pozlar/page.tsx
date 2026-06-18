"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  type Poz,
  type PozKaynak,
  type LibId,
  ensurePozlarSeeded,
  loadPozlar,
  pozKategoriler,
  etkinFiyat,
  updateResmiFiyat,
  applyPiyasaFiyatlari,
  upsertPozlar,
  deletePoz,
  resetPozlar,
  yeniOzelPoz,
  pozKutuphaneAdi,
  POZ_KUTUPHANELER,
  DEFAULT_LIB,
} from "@/lib/pozlar";
import { parsePozRows } from "@/lib/pozImport";
import { yetkiGetir } from "@/lib/rol";
import { excelOku, excelYaz, pdfYazdir } from "@/lib/disaAktar";
import { formatTL } from "@/lib/projects";

const CITIES = [
  "Türkiye geneli", "İstanbul", "Ankara", "İzmir", "Bursa", "Antalya",
  "Adana", "Konya", "Gaziantep", "Trabzon",
];

const KAYNAK_RENK: Record<PozKaynak, string> = {
  ÇŞB: "bg-emerald-100 text-emerald-700",
  KGM: "bg-sky-100 text-sky-700",
  DSİ: "bg-cyan-100 text-cyan-700",
  İLBANK: "bg-indigo-100 text-indigo-700",
  Piyasa: "bg-amber-100 text-amber-700",
  Özel: "bg-slate-200 text-slate-700",
};

const SAYFA = 60;

export default function PozlarPage() {
  const [pozlar, setPozlar] = useState<Poz[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [arama, setArama] = useState("");
  const [kategori, setKategori] = useState("");
  const [limit, setLimit] = useState(SAYFA);
  const fileRef = useRef<HTMLInputElement>(null);

  const [importKaynak, setImportKaynak] = useState<PozKaynak>("ÇŞB");
  const [importYil, setImportYil] = useState(2026);
  const [importMsg, setImportMsg] = useState("");

  const [il, setIl] = useState("Türkiye geneli");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiMsg, setAiMsg] = useState("");

  // Hangi kütüphane? ?lib=kut1 / kut2 / kut3
  const [libId, setLibId] = useState<LibId>(DEFAULT_LIB);
  const [rol, setRol] = useState<string>("yonetici");
  // TÜM POZLAR (kut2) yalnızca yöneticiye açık; diğerleri herkese.
  const saltOkunur = libId === "kut2" && rol !== "yonetici";

  // Özel poz ekleme formu
  const [ozelAcik, setOzelAcik] = useState(false);
  const [oKod, setOKod] = useState("");
  const [oAd, setOAd] = useState("");
  const [oBirim, setOBirim] = useState("m²");
  const [oKategori, setOKategori] = useState("Özel");
  const [oFiyat, setOFiyat] = useState("");
  const [ozelMsg, setOzelMsg] = useState("");

  // Başka kütüphaneden kopyalama
  const [kopyaAcik, setKopyaAcik] = useState(false);
  const [kaynakLib, setKaynakLib] = useState<LibId>("kut2");
  const [kaynakAra, setKaynakAra] = useState("");
  const [kopyaMsg, setKopyaMsg] = useState("");

  function handleOzelEkle(e: React.FormEvent) {
    e.preventDefault();
    if (saltOkunur) return;
    setOzelMsg("");
    const f = parseFloat(oFiyat);
    if (!oKod.trim() || !oAd.trim()) { setOzelMsg("❌ Poz kodu ve adı gerekli."); return; }
    if (!f || f <= 0) { setOzelMsg("❌ Geçerli fiyat girin."); return; }
    setPozlar(upsertPozlar(libId, [yeniOzelPoz(oKod.trim(), oAd.trim(), oBirim, oKategori.trim(), f)]));
    setOzelMsg(`✓ "${oKod.trim()}" eklendi.`);
    setOKod(""); setOAd(""); setOFiyat("");
  }

  const kaynakEslesen = (() => {
    const q = kaynakAra.toLocaleLowerCase("tr").trim();
    if (!q || kaynakLib === libId) return [];
    return loadPozlar(kaynakLib)
      .filter((p) => p.kod.toLocaleLowerCase("tr").includes(q) || p.ad.toLocaleLowerCase("tr").includes(q))
      .slice(0, 25);
  })();
  function kopyala(p: Poz) {
    if (saltOkunur) return;
    setPozlar(upsertPozlar(libId, [{ ...p }]));
    setKopyaMsg(`✓ "${p.kod}" bu kütüphaneye kopyalandı.`);
  }

  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("lib");
    const lib: LibId = q === "kut1" || q === "kut3" ? q : "kut2";
    setLibId(lib);
    setYukleniyor(true);
    yetkiGetir().then((y) => setRol(y.rol));
    ensurePozlarSeeded(lib).then((p) => {
      setPozlar(p);
      setYukleniyor(false);
    });
  }, []);

  const kategoriler = useMemo(() => pozKategoriler(pozlar).sort((a, b) => a.localeCompare(b, "tr")), [pozlar]);

  const filtreli = useMemo(() => {
    const q = arama.toLocaleLowerCase("tr").trim();
    return pozlar.filter(
      (p) =>
        (!kategori || p.kategori === kategori) &&
        (!q ||
          p.kod.toLocaleLowerCase("tr").includes(q) ||
          p.ad.toLocaleLowerCase("tr").includes(q)),
    );
  }, [pozlar, arama, kategori]);

  const gosterilen = filtreli.slice(0, limit);

  function handleResmiDuzelt(kod: string, value: string) {
    if (saltOkunur) return;
    const f = parseFloat(value);
    if (!f || f <= 0) return;
    setPozlar(updateResmiFiyat(libId, kod, f, "Resmî fiyat elle düzeltildi"));
  }

  function handleDelete(kod: string) {
    if (saltOkunur) return;
    if (!confirm(`${kod} pozu silinsin mi?`)) return;
    setPozlar(deletePoz(libId, kod));
  }

  async function handleReset() {
    if (saltOkunur) return;
    if (!confirm("Bu kütüphanedeki TÜM pozlar silinsin mi? Bu işlem geri alınamaz.")) return;
    setYukleniyor(true);
    setPozlar(await resetPozlar(libId));
    setYukleniyor(false);
  }

  /** Toplu aktarma için örnek Excel şablonu indir. */
  function sablonIndir() {
    const basliklar = ["Poz No", "Tanım", "Birim", "Birim Fiyat"];
    const ornek = [
      ["15.150.1001", "Hazır beton C30 (pompalı)", "m³", 4950],
      ["23.014", "Nervürlü inşaat demiri", "kg", 39],
      ["OZ.001", "Örnek özel poz", "m²", 250],
    ];
    excelYaz("poz-sablonu", "Pozlar", basliklar, ornek);
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    if (saltOkunur) return;
    const file = e.target.files?.[0];
    if (!file) return;
    setImportMsg("Okunuyor…");
    try {
      const rows = await excelOku(file); // .xlsx / .xls / .csv hepsi
      const sonuc = parsePozRows(rows, importKaynak, importYil);
      if (sonuc.pozlar.length === 0) {
        setImportMsg(`❌ ${sonuc.hatalar[0] ?? "Poz bulunamadı."}`);
      } else {
        setPozlar(upsertPozlar(libId, sonuc.pozlar));
        setImportMsg(
          `✓ ${sonuc.pozlar.length} poz içe aktarıldı` +
            (sonuc.hatalar.length ? `, ${sonuc.hatalar.length} satır atlandı` : "") + ".",
        );
      }
    } catch {
      setImportMsg("❌ Dosya okunamadı (xlsx/csv olmalı).");
    }
    if (fileRef.current) fileRef.current.value = "";
  }

  // ── Excel / PDF çıktı (görüntülenen filtreli liste) ──
  function disaAktarVeri() {
    const basliklar = ["Poz No", "Tanım", "Birim", "Kategori", "Kaynak", "Resmî Fiyat", "Piyasa Min", "Piyasa Max", "Maliyet (en düşük)"];
    const satirlar = filtreli.map((p) => [
      p.kod, p.ad, p.birim, p.kategori, `${p.kaynak} ${p.yil}`,
      p.resmiFiyat, p.piyasaMin ?? "", p.piyasaMax ?? "", etkinFiyat(p),
    ]);
    return { basliklar, satirlar };
  }
  function excelIndir() {
    const { basliklar, satirlar } = disaAktarVeri();
    excelYaz(`${pozKutuphaneAdi(libId)}-pozlar`, "Pozlar", basliklar, satirlar);
  }
  function pdfIndir() {
    const { basliklar, satirlar } = disaAktarVeri();
    pdfYazdir(`${pozKutuphaneAdi(libId)} — Poz Listesi`, basliklar, satirlar,
      "Fiyatlar ₺. Maliyet en düşük geçerli fiyatla hesaplanır.");
  }

  async function handleAiGuncelle() {
    if (saltOkunur) return;
    const hedef = filtreli.slice(0, 40);
    if (hedef.length === 0) return;
    setAiBusy(true);
    setAiMsg(`${hedef.length} poz için piyasa fiyatları araştırılıyor…`);
    try {
      const res = await fetch("/api/fiyat-guncelle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          il,
          pozlar: hedef.map((p) => ({
            kod: p.kod, ad: p.ad, birim: p.birim, resmiFiyat: p.resmiFiyat, yil: p.yil,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAiMsg(`❌ ${data.error ?? "Güncelleme başarısız."}`);
        return;
      }
      setPozlar(
        applyPiyasaFiyatlari(
          libId,
          data.guncellemeler.map((g: { kod: string; min: number; max: number; not: string }) => ({
            kod: g.kod, min: g.min, max: g.max,
            not: data.demoMode ? g.not : `AI · ${il} · ${g.not}`,
          })),
        ),
      );
      setAiMsg(
        (data.demoMode ? "⚠️ DEMO modu (anahtar yok): " : "✓ ") +
          `${data.guncellemeler.length} poza piyasa fiyat aralığı eklendi.`,
      );
    } catch (err) {
      setAiMsg(`❌ ${err instanceof Error ? err.message : "Bağlantı hatası"}`);
    } finally {
      setAiBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl">
      {saltOkunur && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
          🔒 <b>TÜM POZLAR</b> kütüphanesini yalnızca <b>yönetici</b> düzenleyebilir. Listeyi görüntüleyip projelerinde kullanabilirsin; ekleme/düzenleme/silme kapalıdır.
        </div>
      )}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">
            {libId === "kut1" ? "📙" : libId === "kut3" ? "📗" : "📚"} {pozKutuphaneAdi(libId)}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {yukleniyor ? "Yükleniyor…" : `${pozlar.length.toLocaleString("tr-TR")} poz`} ·{" "}
            Pozları <b>Excel/CSV ile toplu aktarın</b> veya elle ekleyin.{" "}
            Maliyet <b>en düşük fiyatla</b> hesaplanır; bu kütüphane yalnızca bunu seçen projelerde kullanılır.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={excelIndir} className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-emerald-700">⬇ Excel</button>
          <button onClick={pdfIndir} className="rounded-xl bg-red-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-red-700">⬇ PDF</button>
          <button
            onClick={handleReset}
            className="rounded-xl border-2 border-slate-200 px-4 py-2 text-xs font-bold text-slate-500 transition hover:border-red-300 hover:text-red-500"
          >
            {libId === "kut3" ? "Boşalt" : "Sıfırla"}
          </button>
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-extrabold text-slate-900">⬆ Poz Listesi İçe Aktar (Excel / CSV)</h2>
          <p className="mt-1 text-xs text-slate-500">
            <b>.xlsx, .xls veya .csv</b> dosyası yükleyin (KGM/İLBANK resmî listeler veya kendi
            pozlarınız). Sütunlar: Poz No · Tanım · Birim · Birim Fiyat (başlıklar esnek eşleşir).
          </p>
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <label className="text-xs font-semibold text-slate-600">
              Kaynak
              <select value={importKaynak} onChange={(e) => setImportKaynak(e.target.value as PozKaynak)}
                className="mt-1 block rounded-lg border-2 border-slate-200 bg-white px-3 py-1.5 text-sm outline-none focus:border-brand-500">
                {(["ÇŞB", "KGM", "DSİ", "İLBANK", "Piyasa", "Özel"] as PozKaynak[]).map((k) => (<option key={k}>{k}</option>))}
              </select>
            </label>
            <label className="text-xs font-semibold text-slate-600">
              Yıl
              <input type="number" value={importYil} onChange={(e) => setImportYil(parseInt(e.target.value) || importYil)}
                className="mt-1 block w-24 rounded-lg border-2 border-slate-200 px-3 py-1.5 text-sm outline-none focus:border-brand-500" />
            </label>
            <button onClick={() => fileRef.current?.click()}
              className="rounded-lg bg-ink-900 px-4 py-2 text-sm font-bold text-white transition hover:bg-ink-800">📂 Dosya Seç & Aktar</button>
            <button onClick={sablonIndir} type="button"
              className="rounded-lg border-2 border-slate-200 px-4 py-2 text-sm font-bold text-slate-600 transition hover:border-brand-500 hover:text-brand-600">⬇ Örnek Şablon</button>
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv" onChange={handleFile} className="hidden" />
          </div>
          {importMsg && <p className="mt-3 text-xs font-semibold text-slate-600">{importMsg}</p>}
        </div>

        <div className="rounded-2xl border-2 border-brand-500/40 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-extrabold text-slate-900">🤖 AI Piyasa Fiyat Asistanı</h2>
          <p className="mt-1 text-xs text-slate-500">
            Listelenen pozların güncel <b>piyasa fiyat aralığını</b> (min–max) araştırıp ekler.
            Aramayla daralttığınız ilk 40 poz güncellenir.
          </p>
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <label className="text-xs font-semibold text-slate-600">
              Bölge / İl
              <select value={il} onChange={(e) => setIl(e.target.value)}
                className="mt-1 block rounded-lg border-2 border-slate-200 bg-white px-3 py-1.5 text-sm outline-none focus:border-brand-500">
                {CITIES.map((c) => (<option key={c}>{c}</option>))}
              </select>
            </label>
            <button onClick={handleAiGuncelle} disabled={aiBusy}
              className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-brand-600 disabled:opacity-50">
              {aiBusy ? "Araştırılıyor…" : "Piyasa Fiyatı Topla →"}
            </button>
          </div>
          {aiMsg && <p className="mt-3 text-xs font-semibold text-slate-600">{aiMsg}</p>}
        </div>
      </div>

      {/* Özel poz ekle + başka kütüphaneden kopyala */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {/* Yeni özel poz */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <button onClick={() => setOzelAcik((v) => !v)} className="flex w-full items-center justify-between text-sm font-extrabold text-slate-900">
            ➕ Kendi Pozunu Ekle
            <span className="text-xs text-slate-400">{ozelAcik ? "▴" : "▾"}</span>
          </button>
          {ozelAcik && (
            <form onSubmit={handleOzelEkle} className="mt-3 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <input value={oKod} onChange={(e) => setOKod(e.target.value)} placeholder="Poz kodu (ör: OZ.001)" className="rounded-lg border-2 border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500" />
                <input value={oBirim} onChange={(e) => setOBirim(e.target.value)} placeholder="Birim (m²/ad/mt)" className="rounded-lg border-2 border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500" />
              </div>
              <input value={oAd} onChange={(e) => setOAd(e.target.value)} placeholder="Poz adı / açıklama" className="w-full rounded-lg border-2 border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500" />
              <div className="grid grid-cols-2 gap-2">
                <input value={oKategori} onChange={(e) => setOKategori(e.target.value)} placeholder="Kategori" className="rounded-lg border-2 border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500" />
                <input type="number" min="0" value={oFiyat} onChange={(e) => setOFiyat(e.target.value)} placeholder="Birim fiyat ₺" className="rounded-lg border-2 border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500" />
              </div>
              <button type="submit" className="w-full rounded-lg bg-brand-500 py-2 text-sm font-bold text-white transition hover:bg-brand-600">Poz Ekle</button>
              {ozelMsg && <p className="text-xs font-semibold text-slate-600">{ozelMsg}</p>}
            </form>
          )}
        </div>

        {/* Başka kütüphaneden kopyala */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <button onClick={() => setKopyaAcik((v) => !v)} className="flex w-full items-center justify-between text-sm font-extrabold text-slate-900">
            ⇄ Başka Kütüphaneden Poz Al
            <span className="text-xs text-slate-400">{kopyaAcik ? "▴" : "▾"}</span>
          </button>
          {kopyaAcik && (
            <div className="mt-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-slate-600">Kaynak:</span>
                <select value={kaynakLib} onChange={(e) => setKaynakLib(e.target.value as LibId)}
                  className="rounded-lg border-2 border-slate-200 bg-white px-3 py-1.5 text-sm outline-none focus:border-brand-500">
                  {POZ_KUTUPHANELER.filter((k) => k.id !== libId).map((k) => <option key={k.id} value={k.id}>{k.ad}</option>)}
                </select>
              </div>
              <input value={kaynakAra} onChange={(e) => setKaynakAra(e.target.value)} placeholder="Kaynak kütüphanede ara…"
                className="mt-2 w-full rounded-lg border-2 border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500" />
              {kaynakEslesen.length > 0 && (
                <ul className="mt-2 max-h-52 space-y-1 overflow-auto">
                  {kaynakEslesen.map((p) => (
                    <li key={p.kod}>
                      <button onClick={() => kopyala(p)} className="flex w-full items-baseline gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition hover:bg-brand-500/10">
                        <span className="shrink-0 font-mono font-bold text-ink-800">{p.kod}</span>
                        <span className="min-w-0 flex-1 truncate text-slate-600">{p.ad}</span>
                        <span className="shrink-0 text-[10px] font-bold text-brand-600">+ Al</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {kopyaMsg && <p className="mt-2 text-xs font-semibold text-slate-600">{kopyaMsg}</p>}
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <input value={arama} onChange={(e) => { setArama(e.target.value); setLimit(SAYFA); }}
          placeholder="Poz kodu (ör: 15.100) veya ad ara…"
          className="min-w-56 flex-1 rounded-xl border-2 border-slate-200 px-4 py-2.5 text-sm outline-none transition focus:border-brand-500" />
        <select value={kategori} onChange={(e) => { setKategori(e.target.value); setLimit(SAYFA); }}
          className="max-w-64 rounded-xl border-2 border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold outline-none focus:border-brand-500">
          <option value="">Tüm kategoriler</option>
          {kategoriler.map((k) => (<option key={k} value={k}>{k.length > 40 ? k.slice(0, 40) + "…" : k}</option>))}
        </select>
      </div>
      <p className="mt-2 text-xs text-slate-500">
        {filtreli.length.toLocaleString("tr-TR")} sonuç{filtreli.length > limit ? ` · ilk ${limit} gösteriliyor` : ""}
      </p>

      <div className="mt-3 overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[860px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3">Poz</th>
              <th className="px-3 py-3 text-right">Resmî (ÇŞB)</th>
              <th className="px-3 py-3 text-right">Piyasa Min–Max</th>
              <th className="px-3 py-3 text-right">Maliyette</th>
              <th className="px-2 py-3" />
            </tr>
          </thead>
          <tbody>
            {gosterilen.map((p) => {
              const etkin = etkinFiyat(p);
              return (
                <tr key={p.kod} className="border-b border-slate-100 hover:bg-slate-50/60">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-ink-800">{p.kod}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${KAYNAK_RENK[p.kaynak]}`}>{p.kaynak}</span>
                    </div>
                    <div className="max-w-md text-slate-600">{p.ad}</div>
                    <div className="text-[10px] text-slate-400">{p.kategori}</div>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <input type="number" defaultValue={p.resmiFiyat} onBlur={(e) => handleResmiDuzelt(p.kod, e.target.value)}
                      className="w-24 rounded-lg border border-slate-200 px-2 py-1 text-right text-sm outline-none focus:border-brand-500" />
                    <span className="ml-1 text-[10px] text-slate-400">/{p.birim}</span>
                  </td>
                  <td className="px-3 py-2.5 text-right text-xs">
                    {p.piyasaMin != null ? (
                      <span className="font-semibold text-slate-700">
                        {formatTL(p.piyasaMin)}
                        <span className="text-slate-400"> – {formatTL(p.piyasaMax ?? p.piyasaMin)}</span>
                      </span>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <span className="font-bold text-emerald-700">{formatTL(etkin)}</span>
                    {p.piyasaMin != null && etkin < p.resmiFiyat && (
                      <div className="text-[9px] font-bold text-emerald-600">piyasa ↓</div>
                    )}
                  </td>
                  <td className="px-2 py-2.5 text-center">
                    <button onClick={() => handleDelete(p.kod)}
                      className="rounded-lg px-2 py-1 text-slate-300 transition hover:bg-red-50 hover:text-red-500">🗑</button>
                  </td>
                </tr>
              );
            })}
            {!yukleniyor && gosterilen.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-sm text-slate-400">Eşleşen poz yok.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {filtreli.length > limit && (
        <button onClick={() => setLimit((l) => l + SAYFA)}
          className="mt-4 w-full rounded-xl border-2 border-slate-200 py-2.5 text-sm font-bold text-slate-600 transition hover:border-brand-500 hover:text-brand-600">
          Daha fazla göster ({filtreli.length - limit} kaldı)
        </button>
      )}

      <p className="mt-3 text-xs text-slate-500">
        💡 <b>Maliyette</b> sütunu, resmî ile piyasa-min arasından <b>en düşüğünü</b> gösterir;
        keşif ve maliyet bu değerle hesaplanır. Resmî fiyatı hücreye tıklayıp elle düzeltebilirsiniz.
      </p>

      <div className="mt-8 text-sm">
        <Link href="/panel" className="font-semibold text-slate-500 transition hover:text-ink-800">← Panele dön</Link>
      </div>
    </div>
  );
}
