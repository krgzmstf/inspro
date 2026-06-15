"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  type Project,
  loadProjects,
  getProject,
  formatTL,
} from "@/lib/projects";
import {
  type MuhasebeKayit,
  type KayitTipi,
  type OdemeDurumu,
  GIDER_KATEGORILERI,
  GELIR_KATEGORILERI,
  KDV_ORANLARI,
  TEVKIFAT_ORANLARI,
  loadMuhasebe,
  addMuhasebe,
  deleteMuhasebe,
  odemeKaydet,
  hesaplaTutarlar,
  muhasebeOzeti,
  cariHesaplar,
  cariEkstre,
  yaslandirma,
  kdvOzeti,
  gelirTablosu,
  nakitAkis,
} from "@/lib/muhasebe";
import {
  type FinansHesap,
  type HesapTipi,
  loadHesaplar,
  addHesap,
  deleteHesap,
  hesapBakiyesi,
} from "@/lib/finansHesap";
import { type Poz, ensurePozlarSeeded } from "@/lib/pozlar";
import { kesifHesapla } from "@/lib/kesifEslesme";
import { pdfYazdir, excelYaz } from "@/lib/disaAktar";

type Sekme = "hareketler" | "cari" | "kasa" | "raporlar";

function bugun() {
  return new Date().toISOString().slice(0, 10);
}

const DURUM_ETIKET: Record<OdemeDurumu, string> = {
  acik: "Açık", kismi: "Kısmi", odendi: "Ödendi",
};
const DURUM_RENK: Record<OdemeDurumu, string> = {
  acik: "bg-amber-100 text-amber-700",
  kismi: "bg-blue-100 text-blue-700",
  odendi: "bg-emerald-100 text-emerald-700",
};

export default function MuhasebePage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState("");
  const [kayitlar, setKayitlar] = useState<MuhasebeKayit[]>([]);
  const [pozlar, setPozlar] = useState<Poz[]>([]);
  const [hesaplar, setHesaplar] = useState<FinansHesap[]>([]);
  const [sekme, setSekme] = useState<Sekme>("hareketler");

  // form
  const [tip, setTip] = useState<KayitTipi>("gider");
  const [kategori, setKategori] = useState<string>(GIDER_KATEGORILERI[0]);
  const [aciklama, setAciklama] = useState("");
  const [taraf, setTaraf] = useState("");
  const [belgeNo, setBelgeNo] = useState("");
  const [matrah, setMatrah] = useState("");
  const [kdvOran, setKdvOran] = useState(20);
  const [tevkifatOran, setTevkifatOran] = useState(0);
  const [tarih, setTarih] = useState(bugun());
  const [vadeTarihi, setVadeTarihi] = useState("");
  const [durum, setDurum] = useState<OdemeDurumu>("odendi");
  const [hesapId, setHesapId] = useState("");
  const [error, setError] = useState("");

  // tahsilat/ödeme modalı
  const [odemeKayit, setOdemeKayit] = useState<MuhasebeKayit | null>(null);
  const [odemeMiktar, setOdemeMiktar] = useState("");
  const [odemeHesap, setOdemeHesap] = useState("");

  // cari ekstre seçimi
  const [seciliCari, setSeciliCari] = useState<string | null>(null);

  useEffect(() => {
    const list = loadProjects();
    setProjects(list);
    setHesaplar(loadHesaplar());
    const id = new URLSearchParams(window.location.search).get("proje");
    const initial = id && list.some((p) => p.id === id) ? id : (list[0]?.id ?? "");
    if (initial) {
      setProjectId(initial);
      setKayitlar(loadMuhasebe(initial));
    }
  }, []);

  const projeObj = useMemo(() => (projectId ? getProject(projectId) : undefined), [projectId, kayitlar]);

  useEffect(() => {
    const lib = projeObj?.pozKutuphane === "kut1" ? "kut1" : "kut2";
    ensurePozlarSeeded(lib).then(setPozlar);
  }, [projeObj?.pozKutuphane]);

  const kesif = useMemo(
    () => (projeObj && pozlar.length ? kesifHesapla(projeObj, pozlar) : []),
    [projeObj, pozlar],
  );
  const kesifCsb = kesif.reduce((s, r) => s + r.csbTutar, 0);
  const kesifPiyasa = kesif.reduce((s, r) => s + r.piyasaTutar, 0);

  const ozet = useMemo(() => muhasebeOzeti(kayitlar), [kayitlar]);
  const cariler = useMemo(() => cariHesaplar(kayitlar), [kayitlar]);
  const yaslar = useMemo(() => yaslandirma(kayitlar), [kayitlar]);
  const kdv = useMemo(() => kdvOzeti(kayitlar), [kayitlar]);
  const gt = useMemo(() => gelirTablosu(kayitlar), [kayitlar]);
  const nakit = useMemo(() => nakitAkis(kayitlar), [kayitlar]);
  const ekstre = useMemo(
    () => (seciliCari ? cariEkstre(kayitlar, seciliCari) : []),
    [kayitlar, seciliCari],
  );

  const kategoriler = tip === "gider" ? GIDER_KATEGORILERI : GELIR_KATEGORILERI;

  // canlı tutar önizleme
  const onizleme = useMemo(() => {
    const m = parseFloat(matrah) || 0;
    return hesaplaTutarlar(m, kdvOran, tevkifatOran);
  }, [matrah, kdvOran, tevkifatOran]);

  function switchProject(id: string) {
    setProjectId(id);
    setKayitlar(id ? loadMuhasebe(id) : []);
    setSeciliCari(null);
  }

  function handleTipDegis(t: KayitTipi) {
    setTip(t);
    setKategori((t === "gider" ? GIDER_KATEGORILERI : GELIR_KATEGORILERI)[0]);
  }

  function handleEkle(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const m = parseFloat(matrah);
    if (!projectId) return setError("Önce bir proje seçin.");
    if (!m || m <= 0) return setError("Geçerli bir matrah (KDV hariç tutar) girin.");
    addMuhasebe({
      projectId, tip, kategori,
      aciklama: aciklama.trim(), taraf: taraf.trim(), belgeNo: belgeNo.trim() || undefined,
      matrah: m, kdvOran, tevkifatOran,
      tarih, vadeTarihi: vadeTarihi || undefined,
      durum, odenenTutar: 0,
      hesapId: durum === "odendi" ? (hesapId || undefined) : undefined,
    });
    setKayitlar(loadMuhasebe(projectId));
    setAciklama(""); setTaraf(""); setBelgeNo(""); setMatrah("");
  }

  function handleSil(id: string) {
    deleteMuhasebe(id);
    setKayitlar(loadMuhasebe(projectId));
  }

  function odemeAc(k: MuhasebeKayit) {
    setOdemeKayit(k);
    setOdemeMiktar(String(+(k.net - k.odenenTutar).toFixed(2)));
    setOdemeHesap(k.hesapId ?? hesaplar[0]?.id ?? "");
  }

  function odemeOnayla() {
    if (!odemeKayit) return;
    const t = parseFloat(odemeMiktar);
    if (!t || t <= 0) return;
    odemeKaydet(odemeKayit.id, t, odemeHesap || undefined);
    setKayitlar(loadMuhasebe(projectId));
    setOdemeKayit(null);
  }

  /* ── Raporlar: PDF / Excel ── */
  function raporGelirTablosu(fmt: "pdf" | "excel") {
    const satirlar: (string | number)[][] = [
      ["GELİRLER (KDV hariç)", ""],
      ...gt.gelir.map((g) => [g.kategori, g.tutar]),
      ["Toplam Gelir", gt.toplamGelir],
      ["", ""],
      ["GİDERLER (KDV hariç)", ""],
      ...gt.gider.map((g) => [g.kategori, g.tutar]),
      ["Toplam Gider", gt.toplamGider],
      ["", ""],
      ["BRÜT KÂR / ZARAR", gt.brutKar],
    ];
    const ad = `gelir-tablosu-${projeObj?.name ?? ""}`.replaceAll(" ", "-");
    if (fmt === "pdf") pdfYazdir(`Gelir Tablosu — ${projeObj?.name ?? ""}`, ["Kalem", "Tutar (₺)"], satirlar, "KDV hariç matrah tutarlarıdır. insPRO DEMO.");
    else excelYaz(ad, "Gelir Tablosu", ["Kalem", "Tutar (TL)"], satirlar);
  }

  function raporKdv(fmt: "pdf" | "excel") {
    const satirlar: (string | number)[][] = [
      ["Hesaplanan KDV (satış)", kdv.hesaplananKdv],
      ["İndirilecek KDV (alış)", kdv.indirilecekKdv],
      ["Tevkif edilen KDV", kdv.tevkifEdilenKdv],
      ["Ödenecek / Devreden KDV", kdv.odenecekKdv],
    ];
    const ad = `kdv-ozeti-${projeObj?.name ?? ""}`.replaceAll(" ", "-");
    if (fmt === "pdf") pdfYazdir(`KDV Özeti — ${projeObj?.name ?? ""}`, ["Kalem", "Tutar (₺)"], satirlar, "Beyanname öncesi taslak özet. Resmî beyan için mali müşavirinize danışın.");
    else excelYaz(ad, "KDV Özeti", ["Kalem", "Tutar (TL)"], satirlar);
  }

  function raporCariEkstre(fmt: "pdf" | "excel") {
    if (!seciliCari) return;
    const satirlar: (string | number)[][] = ekstre.map((e) => [
      e.tarih, e.aciklama, e.belgeNo ?? "", e.borc || "", e.alacak || "", e.yuruyenBakiye,
    ]);
    const baslik = `Cari Ekstre — ${seciliCari}`;
    const head = ["Tarih", "Açıklama", "Belge No", "Borç (₺)", "Alacak (₺)", "Bakiye (₺)"];
    if (fmt === "pdf") pdfYazdir(baslik, head, satirlar, "Borç: bizim borcumuz · Alacak: bizim alacağımız. insPRO DEMO.");
    else excelYaz(`cari-ekstre-${seciliCari}`.replaceAll(" ", "-"), "Cari Ekstre", head, satirlar);
  }

  function hareketDisaAktar() {
    if (!projeObj) return;
    const head = ["Tarih", "Tip", "Kategori", "Açıklama", "Taraf", "Belge No", "Matrah", "KDV%", "KDV", "Tevkifat", "Brüt", "Net", "Vade", "Durum", "Ödenen"];
    const satirlar = kayitlar.map((k) => [
      k.tarih, k.tip === "gider" ? "Gider" : "Gelir", k.kategori, k.aciklama, k.taraf, k.belgeNo ?? "",
      k.matrah, k.kdvOran, k.kdvTutar, k.tevkifatTutar, k.tutar, k.net, k.vadeTarihi ?? "", DURUM_ETIKET[k.durum], k.odenenTutar,
    ]);
    excelYaz(`muhasebe-${projeObj.name}`.replaceAll(" ", "-"), "Hareketler", head, satirlar);
  }

  /* ── Kasa/Banka ── */
  function handleHesapEkle(ad: string, tip: HesapTipi, iban: string, acilis: number) {
    addHesap({ ad, tip, iban: iban || undefined, acilisBakiye: acilis });
    setHesaplar(loadHesaplar());
  }
  function handleHesapSil(id: string) {
    deleteHesap(id);
    setHesaplar(loadHesaplar());
  }

  if (projects.length === 0) {
    return (
      <div className="mx-auto max-w-6xl">
        <h1 className="text-2xl font-extrabold text-slate-900">📒 Muhasebe</h1>
        <div className="mt-8 rounded-2xl border-2 border-dashed border-slate-300 bg-white p-12 text-center">
          <div className="text-4xl">🏗️</div>
          <h3 className="mt-3 text-lg font-bold text-slate-900">Önce bir proje gerekli</h3>
          <Link href="/panel/yeni" className="mt-5 inline-block rounded-xl bg-brand-500 px-6 py-3 text-sm font-bold text-white transition hover:bg-brand-600">
            + Proje Oluştur
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">📒 Muhasebe</h1>
          <p className="mt-1 text-sm text-slate-500">KDV/tevkifat, cari hesaplar, vade takibi, kasa/banka ve raporlar.</p>
        </div>
        <select value={projectId} onChange={(e) => switchProject(e.target.value)}
          className="rounded-xl border-2 border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold outline-none focus:border-brand-500">
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      {/* Özet kartları */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kart renk="emerald" baslik="Toplam Gelir (brüt)" deger={ozet.toplamGelir} altKisim={`Tahsil: ${formatTL(ozet.tahsilEdilen)}`} />
        <Kart renk="red" baslik="Toplam Gider (brüt)" deger={ozet.toplamGider} altKisim={`Ödenen: ${formatTL(ozet.odenen)}`} />
        <Kart renk="amber" baslik="Açık Alacak" deger={ozet.acikAlacak} altKisim="Müşteriden tahsil edilecek" />
        <Kart renk="ink" baslik="Açık Borç" deger={ozet.acikBorc} altKisim="Tedarikçiye ödenecek" />
      </div>

      {/* Sekmeler */}
      <div className="mt-6 flex flex-wrap gap-1 border-b border-slate-200">
        {([
          ["hareketler", "🧾 Hareketler"],
          ["cari", "👥 Cari Hesaplar"],
          ["kasa", "🏦 Kasa & Banka"],
          ["raporlar", "📊 Raporlar"],
        ] as [Sekme, string][]).map(([k, l]) => (
          <button key={k} onClick={() => setSekme(k)}
            className={`-mb-px rounded-t-lg border-b-2 px-4 py-2.5 text-sm font-bold transition ${
              sekme === k ? "border-brand-500 text-brand-600" : "border-transparent text-slate-400 hover:text-slate-600"
            }`}>
            {l}
          </button>
        ))}
      </div>

      {/* ════════ HAREKETLER ════════ */}
      {sekme === "hareketler" && (
        <>
          {(kesifPiyasa > 0 || projeObj?.budget) && (
            <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-sm font-extrabold text-slate-700">📊 Bütçe vs Gerçekleşen</h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                {projeObj?.budget != null && <Karsilastir etiket="Planlanan Bütçe" deger={projeObj.budget} gider={ozet.toplamGider} />}
                {kesifCsb > 0 && <Karsilastir etiket="Keşif (ÇŞB)" deger={kesifCsb} gider={ozet.toplamGider} />}
                {kesifPiyasa > 0 && <Karsilastir etiket="Keşif (Piyasa)" deger={kesifPiyasa} gider={ozet.toplamGider} />}
              </div>
            </div>
          )}

          <div className="mt-5 grid gap-6 lg:grid-cols-[380px_1fr]">
            {/* Kayıt ekleme */}
            <form onSubmit={handleEkle} className="h-fit rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-sm font-extrabold text-slate-700">Yeni Hareket</h2>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button type="button" onClick={() => handleTipDegis("gider")}
                  className={`rounded-xl border-2 py-2 text-sm font-bold transition ${tip === "gider" ? "border-red-400 bg-red-50 text-red-600" : "border-slate-200 text-slate-500"}`}>− Gider</button>
                <button type="button" onClick={() => handleTipDegis("gelir")}
                  className={`rounded-xl border-2 py-2 text-sm font-bold transition ${tip === "gelir" ? "border-emerald-400 bg-emerald-50 text-emerald-600" : "border-slate-200 text-slate-500"}`}>+ Gelir</button>
              </div>

              <label className="mt-3 block text-sm font-semibold text-slate-700">Kategori
                <select value={kategori} onChange={(e) => setKategori(e.target.value)}
                  className="mt-1 w-full rounded-xl border-2 border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500">
                  {kategoriler.map((k) => <option key={k}>{k}</option>)}
                </select>
              </label>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <label className="block text-sm font-semibold text-slate-700">Matrah (₺, KDV hariç) *
                  <input type="number" min="0" step="0.01" value={matrah} onChange={(e) => setMatrah(e.target.value)}
                    placeholder="0" className="mt-1 w-full rounded-xl border-2 border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500" />
                </label>
                <label className="block text-sm font-semibold text-slate-700">KDV Oranı
                  <select value={kdvOran} onChange={(e) => setKdvOran(Number(e.target.value))}
                    className="mt-1 w-full rounded-xl border-2 border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500">
                    {KDV_ORANLARI.map((o) => <option key={o} value={o}>%{o}</option>)}
                  </select>
                </label>
              </div>

              <label className="mt-3 block text-sm font-semibold text-slate-700">KDV Tevkifatı
                <select value={tevkifatOran} onChange={(e) => setTevkifatOran(Number(e.target.value))}
                  className="mt-1 w-full rounded-xl border-2 border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500">
                  {TEVKIFAT_ORANLARI.map((t) => <option key={t.etiket} value={t.oran}>{t.etiket}</option>)}
                </select>
              </label>

              {/* Tutar önizleme */}
              <div className="mt-3 rounded-xl bg-slate-50 p-3 text-xs">
                <Satir k="KDV" v={onizleme.kdvTutar} />
                {tevkifatOran > 0 && <Satir k="Tevkifat (−)" v={-onizleme.tevkifatTutar} />}
                <Satir k="Brüt fatura" v={onizleme.tutar} kalin />
                <Satir k={tip === "gider" ? "Ödenecek (net)" : "Tahsil edilecek (net)"} v={onizleme.net} kalin renk="brand" />
              </div>

              <label className="mt-3 block text-sm font-semibold text-slate-700">{tip === "gider" ? "Tedarikçi / Usta" : "Müşteri / Taraf"}
                <input value={taraf} onChange={(e) => setTaraf(e.target.value)} placeholder="ör: Demir Yapı Ltd."
                  className="mt-1 w-full rounded-xl border-2 border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500" />
              </label>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <label className="block text-sm font-semibold text-slate-700">Belge / Fatura No
                  <input value={belgeNo} onChange={(e) => setBelgeNo(e.target.value)} placeholder="ör: A-001234"
                    className="mt-1 w-full rounded-xl border-2 border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500" />
                </label>
                <label className="block text-sm font-semibold text-slate-700">Açıklama
                  <input value={aciklama} onChange={(e) => setAciklama(e.target.value)} placeholder="ör: 12 ton demir"
                    className="mt-1 w-full rounded-xl border-2 border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500" />
                </label>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <label className="block text-sm font-semibold text-slate-700">İşlem Tarihi
                  <input type="date" value={tarih} onChange={(e) => setTarih(e.target.value)}
                    className="mt-1 w-full rounded-xl border-2 border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500" />
                </label>
                <label className="block text-sm font-semibold text-slate-700">Vade Tarihi
                  <input type="date" value={vadeTarihi} onChange={(e) => setVadeTarihi(e.target.value)}
                    className="mt-1 w-full rounded-xl border-2 border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500" />
                </label>
              </div>

              <label className="mt-3 block text-sm font-semibold text-slate-700">Ödeme Durumu
                <select value={durum} onChange={(e) => setDurum(e.target.value as OdemeDurumu)}
                  className="mt-1 w-full rounded-xl border-2 border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500">
                  <option value="odendi">{tip === "gider" ? "Ödendi" : "Tahsil edildi"}</option>
                  <option value="acik">Açık (vadeli)</option>
                </select>
              </label>
              {durum === "odendi" && hesaplar.length > 0 && (
                <label className="mt-3 block text-sm font-semibold text-slate-700">{tip === "gider" ? "Ödendiği hesap" : "Tahsil edilen hesap"}
                  <select value={hesapId} onChange={(e) => setHesapId(e.target.value)}
                    className="mt-1 w-full rounded-xl border-2 border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500">
                    <option value="">— Belirtilmedi —</option>
                    {hesaplar.map((h) => <option key={h.id} value={h.id}>{h.ad}</option>)}
                  </select>
                </label>
              )}

              {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-600">{error}</p>}
              <button type="submit"
                className={`mt-4 w-full rounded-xl py-2.5 text-sm font-bold text-white transition ${tip === "gider" ? "bg-red-500 hover:bg-red-600" : "bg-emerald-500 hover:bg-emerald-600"}`}>
                {tip === "gider" ? "Gider Ekle" : "Gelir Ekle"}
              </button>
            </form>

            {/* Hareket listesi */}
            <div>
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-extrabold text-slate-700">Hareketler ({kayitlar.length})</h2>
                <button onClick={hareketDisaAktar} disabled={kayitlar.length === 0}
                  className="rounded-xl bg-ink-900 px-4 py-2 text-xs font-bold text-white transition hover:bg-ink-800 disabled:opacity-40">⬇ Excel</button>
              </div>
              {kayitlar.length === 0 ? (
                <div className="mt-3 rounded-2xl border-2 border-dashed border-slate-300 bg-white/60 p-10 text-center text-sm text-slate-500">
                  Henüz hareket yok. Soldan gelir/gider ekleyin.
                </div>
              ) : (
                <div className="mt-3 overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <table className="w-full min-w-[760px] text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-bold uppercase text-slate-500">
                        <th className="px-3 py-2.5">Tarih</th>
                        <th className="px-3 py-2.5">Kategori / Taraf</th>
                        <th className="px-3 py-2.5 text-right">Net</th>
                        <th className="px-3 py-2.5 text-center">Durum</th>
                        <th className="px-2 py-2.5" />
                      </tr>
                    </thead>
                    <tbody>
                      {kayitlar.map((k) => {
                        const acik = +(k.net - k.odenenTutar).toFixed(2);
                        return (
                          <tr key={k.id} className="border-b border-slate-100 hover:bg-slate-50/60">
                            <td className="px-3 py-2 text-xs text-slate-500">
                              {k.tarih}
                              {k.vadeTarihi && <div className="text-[10px] text-slate-400">vade: {k.vadeTarihi}</div>}
                            </td>
                            <td className="px-3 py-2">
                              <span className={`mr-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${k.tip === "gider" ? "bg-red-100 text-red-600" : "bg-emerald-100 text-emerald-600"}`}>{k.kategori}</span>
                              <div className="text-xs text-slate-600">{k.taraf || "—"}{k.belgeNo ? ` · ${k.belgeNo}` : ""}</div>
                              {k.aciklama && <div className="text-[11px] text-slate-400">{k.aciklama}</div>}
                            </td>
                            <td className={`px-3 py-2 text-right font-bold ${k.tip === "gider" ? "text-red-600" : "text-emerald-600"}`}>
                              {k.tip === "gider" ? "−" : "+"}{formatTL(k.net)}
                              {acik > 0.005 && <div className="text-[10px] font-semibold text-amber-600">açık: {formatTL(acik)}</div>}
                            </td>
                            <td className="px-3 py-2 text-center">
                              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${DURUM_RENK[k.durum]}`}>{DURUM_ETIKET[k.durum]}</span>
                            </td>
                            <td className="px-2 py-2 text-center whitespace-nowrap">
                              {acik > 0.005 && (
                                <button onClick={() => odemeAc(k)} title={k.tip === "gider" ? "Ödeme kaydet" : "Tahsilat kaydet"}
                                  className="rounded-lg px-2 py-1 text-xs font-bold text-brand-600 transition hover:bg-brand-50">💵</button>
                              )}
                              <button onClick={() => handleSil(k.id)} className="rounded-lg px-2 py-1 text-slate-300 transition hover:bg-red-50 hover:text-red-500">🗑</button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ════════ CARİ HESAPLAR ════════ */}
      {sekme === "cari" && (
        <div className="mt-5 grid gap-6 lg:grid-cols-[1fr_1fr]">
          <div>
            <h2 className="text-sm font-extrabold text-slate-700">Cari Hesaplar ({cariler.length})</h2>
            {cariler.length === 0 ? (
              <p className="mt-3 rounded-2xl border-2 border-dashed border-slate-300 bg-white/60 p-8 text-center text-sm text-slate-500">Henüz cari yok.</p>
            ) : (
              <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-bold uppercase text-slate-500">
                      <th className="px-3 py-2.5">Cari</th>
                      <th className="px-3 py-2.5 text-right">Alacak</th>
                      <th className="px-3 py-2.5 text-right">Borç</th>
                      <th className="px-3 py-2.5 text-right">Bakiye</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cariler.map((c) => (
                      <tr key={c.taraf} onClick={() => setSeciliCari(c.taraf)}
                        className={`cursor-pointer border-b border-slate-100 transition hover:bg-brand-50/40 ${seciliCari === c.taraf ? "bg-brand-50" : ""}`}>
                        <td className="px-3 py-2 font-semibold text-slate-700">{c.taraf}<div className="text-[10px] font-normal text-slate-400">{c.hareketSayisi} hareket</div></td>
                        <td className="px-3 py-2 text-right text-emerald-600">{c.alacak ? formatTL(c.alacak) : "—"}</td>
                        <td className="px-3 py-2 text-right text-red-600">{c.borc ? formatTL(c.borc) : "—"}</td>
                        <td className={`px-3 py-2 text-right font-bold ${c.bakiye >= 0 ? "text-emerald-700" : "text-red-700"}`}>{formatTL(c.bakiye)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Yaşlandırma */}
            <h3 className="mt-6 text-sm font-extrabold text-slate-700">⏳ Vade Yaşlandırma</h3>
            <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-bold uppercase text-slate-500">
                    <th className="px-3 py-2.5">Dönem</th>
                    <th className="px-3 py-2.5 text-right">Alacak</th>
                    <th className="px-3 py-2.5 text-right">Borç</th>
                  </tr>
                </thead>
                <tbody>
                  {yaslar.map((y) => (
                    <tr key={y.etiket} className="border-b border-slate-100">
                      <td className="px-3 py-2 font-semibold text-slate-600">{y.etiket}</td>
                      <td className="px-3 py-2 text-right text-emerald-600">{y.alacak ? formatTL(y.alacak) : "—"}</td>
                      <td className="px-3 py-2 text-right text-red-600">{y.borc ? formatTL(y.borc) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Ekstre */}
          <div>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-extrabold text-slate-700">{seciliCari ? `Ekstre — ${seciliCari}` : "Cari Ekstresi"}</h2>
              {seciliCari && (
                <div className="flex gap-1">
                  <button onClick={() => raporCariEkstre("pdf")} className="rounded-lg bg-ink-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-ink-800">PDF</button>
                  <button onClick={() => raporCariEkstre("excel")} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700">Excel</button>
                </div>
              )}
            </div>
            {!seciliCari ? (
              <p className="mt-3 rounded-2xl border-2 border-dashed border-slate-300 bg-white/60 p-8 text-center text-sm text-slate-500">Soldan bir cari seçin.</p>
            ) : (
              <div className="mt-3 overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
                <table className="w-full min-w-[480px] text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-bold uppercase text-slate-500">
                      <th className="px-3 py-2.5">Tarih</th>
                      <th className="px-3 py-2.5">Açıklama</th>
                      <th className="px-3 py-2.5 text-right">Borç</th>
                      <th className="px-3 py-2.5 text-right">Alacak</th>
                      <th className="px-3 py-2.5 text-right">Bakiye</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ekstre.map((e, i) => (
                      <tr key={i} className="border-b border-slate-100">
                        <td className="px-3 py-2 text-xs text-slate-500">{e.tarih}</td>
                        <td className="px-3 py-2 text-xs text-slate-600">{e.aciklama}{e.belgeNo ? <span className="text-slate-400"> · {e.belgeNo}</span> : null}</td>
                        <td className="px-3 py-2 text-right text-red-600">{e.borc ? formatTL(e.borc) : ""}</td>
                        <td className="px-3 py-2 text-right text-emerald-600">{e.alacak ? formatTL(e.alacak) : ""}</td>
                        <td className={`px-3 py-2 text-right font-bold ${e.yuruyenBakiye >= 0 ? "text-emerald-700" : "text-red-700"}`}>{formatTL(e.yuruyenBakiye)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ════════ KASA & BANKA ════════ */}
      {sekme === "kasa" && (
        <KasaBanka hesaplar={hesaplar} onEkle={handleHesapEkle} onSil={handleHesapSil} />
      )}

      {/* ════════ RAPORLAR ════════ */}
      {sekme === "raporlar" && (
        <div className="mt-5 space-y-6">
          {/* Gelir tablosu */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-extrabold text-slate-700">📈 Gelir Tablosu <span className="font-normal text-slate-400">(KDV hariç)</span></h2>
              <div className="flex gap-1">
                <button onClick={() => raporGelirTablosu("pdf")} className="rounded-lg bg-ink-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-ink-800">PDF</button>
                <button onClick={() => raporGelirTablosu("excel")} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700">Excel</button>
              </div>
            </div>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <RaporListe baslik="Gelirler" satirlar={gt.gelir} toplam={gt.toplamGelir} renk="emerald" />
              <RaporListe baslik="Giderler" satirlar={gt.gider} toplam={gt.toplamGider} renk="red" />
            </div>
            <div className={`mt-3 rounded-xl p-4 text-center ${gt.brutKar >= 0 ? "bg-emerald-50" : "bg-red-50"}`}>
              <span className="text-xs font-semibold uppercase text-slate-500">Brüt Kâr / Zarar</span>
              <div className={`text-2xl font-extrabold ${gt.brutKar >= 0 ? "text-emerald-700" : "text-red-700"}`}>{formatTL(gt.brutKar)}</div>
            </div>
          </div>

          {/* KDV özeti */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-extrabold text-slate-700">🧮 KDV Özeti</h2>
              <div className="flex gap-1">
                <button onClick={() => raporKdv("pdf")} className="rounded-lg bg-ink-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-ink-800">PDF</button>
                <button onClick={() => raporKdv("excel")} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700">Excel</button>
              </div>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <MiniKart baslik="Hesaplanan KDV" deger={kdv.hesaplananKdv} />
              <MiniKart baslik="İndirilecek KDV" deger={kdv.indirilecekKdv} />
              <MiniKart baslik="Tevkif Edilen" deger={kdv.tevkifEdilenKdv} />
              <MiniKart baslik={kdv.odenecekKdv >= 0 ? "Ödenecek KDV" : "Devreden KDV"} deger={Math.abs(kdv.odenecekKdv)} vurgu />
            </div>
            <p className="mt-2 text-[11px] text-slate-400">Beyanname öncesi taslak. Resmî beyan için mali müşavirinize danışın.</p>
          </div>

          {/* Nakit akış */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-extrabold text-slate-700">💧 Nakit Akış <span className="font-normal text-slate-400">(gerçekleşen, aylık)</span></h2>
            {nakit.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">Henüz tahsilat/ödeme yok.</p>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[420px] text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-xs font-bold uppercase text-slate-500">
                      <th className="px-3 py-2">Ay</th>
                      <th className="px-3 py-2 text-right">Tahsilat</th>
                      <th className="px-3 py-2 text-right">Ödeme</th>
                      <th className="px-3 py-2 text-right">Net</th>
                    </tr>
                  </thead>
                  <tbody>
                    {nakit.map((n) => (
                      <tr key={n.ay} className="border-b border-slate-100">
                        <td className="px-3 py-2 font-semibold text-slate-600">{n.ay}</td>
                        <td className="px-3 py-2 text-right text-emerald-600">{formatTL(n.tahsilat)}</td>
                        <td className="px-3 py-2 text-right text-red-600">{formatTL(n.odeme)}</td>
                        <td className={`px-3 py-2 text-right font-bold ${n.net >= 0 ? "text-emerald-700" : "text-red-700"}`}>{formatTL(n.net)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tahsilat / Ödeme modalı */}
      {odemeKayit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setOdemeKayit(null)}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-extrabold text-slate-900">{odemeKayit.tip === "gider" ? "Ödeme Kaydet" : "Tahsilat Kaydet"}</h3>
            <p className="mt-1 text-sm text-slate-500">{odemeKayit.taraf || "—"} · Açık: {formatTL(odemeKayit.net - odemeKayit.odenenTutar)}</p>
            <label className="mt-4 block text-sm font-semibold text-slate-700">Tutar (₺)
              <input type="number" min="0" step="0.01" value={odemeMiktar} onChange={(e) => setOdemeMiktar(e.target.value)} autoFocus
                className="mt-1 w-full rounded-xl border-2 border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500" />
            </label>
            {hesaplar.length > 0 && (
              <label className="mt-3 block text-sm font-semibold text-slate-700">Hesap
                <select value={odemeHesap} onChange={(e) => setOdemeHesap(e.target.value)}
                  className="mt-1 w-full rounded-xl border-2 border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500">
                  <option value="">— Belirtilmedi —</option>
                  {hesaplar.map((h) => <option key={h.id} value={h.id}>{h.ad}</option>)}
                </select>
              </label>
            )}
            <div className="mt-5 flex gap-2">
              <button onClick={() => setOdemeKayit(null)} className="flex-1 rounded-xl border-2 border-slate-200 py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-50">Vazgeç</button>
              <button onClick={odemeOnayla} className="flex-1 rounded-xl bg-brand-500 py-2.5 text-sm font-bold text-white hover:bg-brand-600">Kaydet</button>
            </div>
          </div>
        </div>
      )}

      <div className="mt-8 text-sm">
        <Link href="/panel" className="font-semibold text-slate-500 transition hover:text-ink-800">← Projelere dön</Link>
      </div>
    </div>
  );
}

/* ── Yardımcı bileşenler ─────────────────────────────────── */

function Kart({ renk, baslik, deger, altKisim }: { renk: "emerald" | "red" | "amber" | "ink"; baslik: string; deger: number; altKisim: string }) {
  const stil = {
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
    red: "border-red-200 bg-red-50 text-red-700",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
    ink: "border-ink-900 bg-ink-950 text-brand-400",
  }[renk];
  const baslikRenk = {
    emerald: "text-emerald-600",
    red: "text-red-600",
    amber: "text-amber-600",
    ink: "text-white/60",
  }[renk];
  return (
    <div className={`rounded-2xl border p-5 shadow-sm ${stil}`}>
      <div className={`text-xs font-semibold uppercase ${baslikRenk}`}>{baslik}</div>
      <div className="mt-1 text-2xl font-extrabold">{formatTL(deger)}</div>
      <div className={`mt-1 text-[11px] ${renk === "ink" ? "text-white/50" : "opacity-70"}`}>{altKisim}</div>
    </div>
  );
}

function Satir({ k, v, kalin, renk }: { k: string; v: number; kalin?: boolean; renk?: "brand" }) {
  return (
    <div className={`flex justify-between ${kalin ? "font-bold" : ""} ${renk === "brand" ? "text-brand-600" : "text-slate-600"}`}>
      <span>{k}</span><span>{formatTL(v)}</span>
    </div>
  );
}

function MiniKart({ baslik, deger, vurgu }: { baslik: string; deger: number; vurgu?: boolean }) {
  return (
    <div className={`rounded-xl border p-3 ${vurgu ? "border-brand-300 bg-brand-50" : "border-slate-200 bg-slate-50"}`}>
      <div className="text-[10px] font-semibold uppercase text-slate-500">{baslik}</div>
      <div className={`mt-0.5 text-lg font-extrabold ${vurgu ? "text-brand-600" : "text-slate-800"}`}>{formatTL(deger)}</div>
    </div>
  );
}

function RaporListe({ baslik, satirlar, toplam, renk }: { baslik: string; satirlar: { kategori: string; tutar: number }[]; toplam: number; renk: "emerald" | "red" }) {
  return (
    <div>
      <h3 className={`text-xs font-extrabold uppercase ${renk === "emerald" ? "text-emerald-600" : "text-red-600"}`}>{baslik}</h3>
      <div className="mt-2 space-y-1">
        {satirlar.length === 0 ? <p className="text-xs text-slate-400">Kayıt yok.</p> : satirlar.map((s) => (
          <div key={s.kategori} className="flex justify-between text-xs">
            <span className="text-slate-600">{s.kategori}</span>
            <span className="font-semibold text-slate-800">{formatTL(s.tutar)}</span>
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between border-t border-slate-200 pt-1 text-sm font-bold">
        <span className="text-slate-700">Toplam</span>
        <span className={renk === "emerald" ? "text-emerald-700" : "text-red-700"}>{formatTL(toplam)}</span>
      </div>
    </div>
  );
}

/* Bütçe vs gerçekleşen kart */
function Karsilastir({ etiket, deger, gider }: { etiket: string; deger: number; gider: number }) {
  const fark = deger - gider;
  const asim = fark < 0;
  const pct = deger > 0 ? Math.min(100, Math.round((gider / deger) * 100)) : 0;
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="text-[10px] font-semibold uppercase text-slate-500">{etiket}</div>
      <div className="mt-0.5 text-sm font-bold text-slate-900">{formatTL(deger)}</div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-200">
        <div className={`h-full rounded-full ${asim ? "bg-red-500" : "bg-emerald-500"}`} style={{ width: `${pct}%` }} />
      </div>
      <div className={`mt-1 text-[11px] font-bold ${asim ? "text-red-600" : "text-emerald-600"}`}>
        Gerçekleşen %{pct} · {asim ? "Aşım" : "Kalan"} {formatTL(Math.abs(fark))}
      </div>
    </div>
  );
}

/* Kasa & Banka sekmesi */
function KasaBanka({ hesaplar, onEkle, onSil }: {
  hesaplar: FinansHesap[];
  onEkle: (ad: string, tip: HesapTipi, iban: string, acilis: number) => void;
  onSil: (id: string) => void;
}) {
  const [ad, setAd] = useState("");
  const [tip, setTip] = useState<HesapTipi>("kasa");
  const [iban, setIban] = useState("");
  const [acilis, setAcilis] = useState("");

  const toplam = hesaplar.reduce((s, h) => s + hesapBakiyesi(h.id, h.acilisBakiye), 0);

  function ekle(e: React.FormEvent) {
    e.preventDefault();
    if (!ad.trim()) return;
    onEkle(ad.trim(), tip, iban.trim(), parseFloat(acilis) || 0);
    setAd(""); setIban(""); setAcilis("");
  }

  return (
    <div className="mt-5 grid gap-6 lg:grid-cols-[320px_1fr]">
      <form onSubmit={ekle} className="h-fit rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-extrabold text-slate-700">Yeni Hesap</h2>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button type="button" onClick={() => setTip("kasa")} className={`rounded-xl border-2 py-2 text-sm font-bold transition ${tip === "kasa" ? "border-brand-400 bg-brand-50 text-brand-600" : "border-slate-200 text-slate-500"}`}>💵 Kasa</button>
          <button type="button" onClick={() => setTip("banka")} className={`rounded-xl border-2 py-2 text-sm font-bold transition ${tip === "banka" ? "border-brand-400 bg-brand-50 text-brand-600" : "border-slate-200 text-slate-500"}`}>🏦 Banka</button>
        </div>
        <label className="mt-3 block text-sm font-semibold text-slate-700">Hesap Adı
          <input value={ad} onChange={(e) => setAd(e.target.value)} placeholder={tip === "kasa" ? "Merkez Kasa" : "Ziraat TL"}
            className="mt-1 w-full rounded-xl border-2 border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500" />
        </label>
        {tip === "banka" && (
          <label className="mt-3 block text-sm font-semibold text-slate-700">IBAN
            <input value={iban} onChange={(e) => setIban(e.target.value)} placeholder="TR.."
              className="mt-1 w-full rounded-xl border-2 border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500" />
          </label>
        )}
        <label className="mt-3 block text-sm font-semibold text-slate-700">Açılış Bakiyesi (₺)
          <input type="number" step="0.01" value={acilis} onChange={(e) => setAcilis(e.target.value)} placeholder="0"
            className="mt-1 w-full rounded-xl border-2 border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500" />
        </label>
        <button type="submit" className="mt-4 w-full rounded-xl bg-brand-500 py-2.5 text-sm font-bold text-white transition hover:bg-brand-600">Hesap Ekle</button>
      </form>

      <div>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-extrabold text-slate-700">Hesaplar ({hesaplar.length})</h2>
          <div className="rounded-xl bg-ink-950 px-4 py-2 text-xs font-bold text-brand-400">Toplam: {formatTL(toplam)}</div>
        </div>
        {hesaplar.length === 0 ? (
          <p className="mt-3 rounded-2xl border-2 border-dashed border-slate-300 bg-white/60 p-8 text-center text-sm text-slate-500">Henüz hesap yok. Soldan kasa/banka ekleyin.</p>
        ) : (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {hesaplar.map((h) => {
              const bakiye = hesapBakiyesi(h.id, h.acilisBakiye);
              return (
                <div key={h.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-xs font-semibold uppercase text-slate-400">{h.tip === "kasa" ? "💵 Kasa" : "🏦 Banka"}</div>
                      <div className="font-bold text-slate-800">{h.ad}</div>
                      {h.iban && <div className="text-[11px] text-slate-400">{h.iban}</div>}
                    </div>
                    <button onClick={() => onSil(h.id)} className="rounded-lg px-2 py-1 text-slate-300 transition hover:bg-red-50 hover:text-red-500">🗑</button>
                  </div>
                  <div className={`mt-3 text-xl font-extrabold ${bakiye >= 0 ? "text-slate-900" : "text-red-600"}`}>{formatTL(bakiye)}</div>
                  <div className="text-[11px] text-slate-400">açılış: {formatTL(h.acilisBakiye)}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
