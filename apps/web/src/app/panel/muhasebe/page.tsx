"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  type Project,
  loadProjects,
  getProject,
  formatTL,
  saveProjects,
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
  updateMuhasebe,
  odemeKaydet,
  hesaplaTutarlar,
  muhasebeOzeti,
  cariHesaplar,
  cariEkstre,
  yaslandirma,
  kdvOzeti,
  gelirTablosu,
  nakitAkis,
  loadAllMuhasebe,
  saveMuhasebe,
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
import {
  type BekleyenMuh,
  senkronAsamaMuhasebe, bekleyenMuhasebelestirme,
} from "@/lib/entegrasyon";
import { type IsimOneri, isimOnerileri, firmaYakala } from "@/lib/firma";
import { projeleriSenkronla } from "@/lib/projeSenkron";
import { muhasebeSenkronla } from "@/lib/muhasebeSenkron";

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
  const [bekleyenler, setBekleyenler] = useState<BekleyenMuh[]>([]);
  const [oneriler, setOneriler] = useState<IsimOneri[]>([]);
  // Muhasebeleştirme modalı (eksik alanları doldurup onayla)
  const [muhMod, setMuhMod] = useState<BekleyenMuh | null>(null);
  const [mMatrah, setMMatrah] = useState("");
  const [mKdv, setMKdv] = useState(20);
  const [mTevkifat, setMTevkifat] = useState(0);
  const [mKategori, setMKategori] = useState<string>(GIDER_KATEGORILERI[0]);
  const [mTaraf, setMTaraf] = useState("");
  const [mBelge, setMBelge] = useState("");
  const [mTarih, setMTarih] = useState(bugun());
  const [mHesap, setMHesap] = useState("");

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
    setOneriler(isimOnerileri());
    const id = new URLSearchParams(window.location.search).get("proje");
    const initial = id && list.some((p) => p.id === id) ? id : (list[0]?.id ?? "");   
    if (initial) {
      setProjectId(initial);
      senkronAsamaMuhasebe(initial);
      setKayitlar(loadMuhasebe(initial));
      setBekleyenler(bekleyenMuhasebelestirme(initial));
    }

    // Bulut senkronu
    projeleriSenkronla(list).then((bulut) => {
      if (bulut) {
        saveProjects(bulut);
        setProjects(bulut);
        const current = initial || (bulut[0]?.id ?? "");
        if (current) setKayitlar(loadMuhasebe(current));
      }
      
      const yerelMuhasebe = loadAllMuhasebe();
      muhasebeSenkronla(yerelMuhasebe).then((bulutMu) => {
        if (bulutMu) {
          saveMuhasebe(bulutMu);
          const current = projectId || initial || (list[0]?.id ?? "");
          if (current) setKayitlar(loadMuhasebe(current));
        }
      });
    });
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
    if (id) senkronAsamaMuhasebe(id);
    setKayitlar(id ? loadMuhasebe(id) : []);
    setBekleyenler(id ? bekleyenMuhasebelestirme(id) : []);
    setSeciliCari(null);
  }

  // Muhasebeleştirme modalını aç — kayıttaki mevcut değerleri yükle
  function muhAc(b: BekleyenMuh) {
    const kayit = kayitlar.find((k) => k.id === b.muhasebeId);
    setMuhMod(b);
    setMMatrah(String(kayit?.matrah ?? b.matrah));
    setMKdv(kayit?.kdvOran ?? 20);
    setMTevkifat(kayit?.tevkifatOran ?? 0);
    setMKategori(kayit?.kategori ?? GIDER_KATEGORILERI[0]);
    setMTaraf(kayit?.taraf ?? b.kisi ?? "");
    setMBelge("");
    setMTarih(kayit?.tarih ?? bugun());
    setMHesap(kayit?.hesapId ?? hesaplar[0]?.id ?? "");
  }

  function muhOnayla() {
    if (!muhMod || !projectId) return;
    const matrah = parseFloat(mMatrah);
    if (!matrah || matrah <= 0) return;
    updateMuhasebe(muhMod.muhasebeId, {
      matrah, kdvOran: mKdv, tevkifatOran: mTevkifat,
      kategori: mKategori, taraf: mTaraf.trim(),
      aciklama: `${muhMod.asama} — ${muhMod.ad}${mBelge.trim() ? ` (${mBelge.trim()})` : ""}`,
      tarih: mTarih, hesapId: mHesap || undefined,
      durum: "odendi",
    });
    if (mTaraf.trim()) { firmaYakala(mTaraf.trim(), "tedarikci"); setOneriler(isimOnerileri()); }
    setKayitlar(loadMuhasebe(projectId));
    setBekleyenler(bekleyenMuhasebelestirme(projectId));
    setMuhMod(null);
  }

  const muhOnizleme = useMemo(
    () => hesaplaTutarlar(parseFloat(mMatrah) || 0, mKdv, mTevkifat),
    [mMatrah, mKdv, mTevkifat],
  );

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
    if (taraf.trim()) { firmaYakala(taraf.trim(), tip === "gelir" ? "musteri" : "tedarikci"); setOneriler(isimOnerileri()); }
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

  /* —— Raporlar: PDF / Excel —— */
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

  /* —— Kasa/Banka —— */
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
        <h1 className="text-2xl font-extrabold text-slate-900">📑 Muhasebe</h1>     
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
          <h1 className="text-2xl font-extrabold text-slate-900">📑 Muhasebe</h1>   
          <p className="mt-1 text-sm text-slate-500">KDV/tevkifat, cari hesaplar, vade takibi, kasa/banka ve raporlar.</p>
        </div>
        <select value={projectId} onChange={(e) => switchProject(e.target.value)}     
          className="rounded-xl border-2 border-sky-200 bg-[#f2f8fd] px-4 py-2.5 text-sm font-semibold outline-none focus:border-brand-500">
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}    
        </select>
      </div>

      {/* Cari/firma rehberi — autocomplete */}
      <datalist id="cari-rehber">
        {oneriler.map((o) => <option key={o.ad} value={o.ad}>{o.etiket}</option>)}    
      </datalist>

      {/* Muhasebeleştirme bekleyenler — turuncu, yanıp sönen kutucuklar */}     
      {bekleyenler.length > 0 && (
        <div className="mt-5 rounded-2xl border-2 border-orange-300 bg-orange-50 p-4 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-lg">🔔</span>
            <h2 className="text-sm font-extrabold text-orange-800">Muhasebeleştirme bekliyor ({bekleyenler.length})</h2>
          </div>
          <p className="mt-1 text-xs text-orange-700">
            İş Takibi&apos;nde ödenen bu işler <b>henüz muhasebeleşmedi</b>. Eksik bilgileri (KDV, tevkifat, kategori, hesap) doldurup onaylayın.
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {bekleyenler.map((b) => (
              <button
                key={b.muhasebeId}
                onClick={() => muhAc(b)}
                className="flex animate-pulse items-center gap-2 rounded-xl border-2 border-orange-400 bg-orange-100 p-3 text-left transition hover:animate-none hover:bg-orange-200"
              >
                <span className="text-lg">🟠</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold text-orange-900">{b.ad}</div>
                  <div className="truncate text-[11px] text-orange-700">{b.asama}{b.kisi ? ` · ${b.kisi}` : ""}</div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-sm font-extrabold text-orange-900">{formatTL(b.matrah)}</div>
                  <div className="text-[10px] font-bold text-orange-600">Muhasebeleştir  →</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

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

      {/* HAREKETLER SEKMESİ */}
      {sekme === "hareketler" && (
        <>
          {/* Keşif maliyet vs Muhasebe gider özeti */}
          {projeObj && (
            <div className="mt-5 rounded-2xl bg-slate-900 p-5 text-white shadow-xl">
              <h2 className="text-sm font-bold text-brand-400">📊 Proje Finansal Sağlık (Canlı)</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                <MiniKart baslik="Hedef Bütçe" deger={projeObj.budget} />
                <MiniKart baslik="Keşif (CSB)" deger={kesifCsb} />
                <MiniKart baslik="Keşif (Piyasa)" deger={kesifPiyasa} gider={ozet.toplamGider} />
              </div>
            </div>
          )}

          <div className="mt-5 grid gap-6 lg:grid-cols-[380px_1fr]">
            {/* Kayıt ekleme */}
            <form onSubmit={handleEkle} className="h-fit rounded-2xl border border-sky-200 bg-[#f2f8fd] p-5 shadow-sm">
              <h2 className="text-sm font-extrabold text-slate-700">Yeni Hareket</h2> 
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button type="button" onClick={() => handleTipDegis("gider")}
                  className={`rounded-xl border-2 py-2 text-sm font-bold transition ${tip === "gider" ? "border-red-400 bg-red-50 text-red-600" : "border-slate-200 text-slate-500"}`}>− Gider</button>
                <button type="button" onClick={() => handleTipDegis("gelir")}
                  className={`rounded-xl border-2 py-2 text-sm font-bold transition ${tip === "gelir" ? "border-emerald-400 bg-emerald-50 text-emerald-600" : "border-slate-200 text-slate-500"}`}>+ Gelir</button>
              </div>

              <label className="mt-3 block text-sm font-semibold text-slate-700">Kategori
                <select value={kategori} onChange={(e) => setKategori(e.target.value)}
                  className="mt-1 w-full rounded-xl border-2 border-sky-200 bg-[#f2f8fd] px-3 py-2 text-sm outline-none focus:border-brand-500">
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
                    className="mt-1 w-full rounded-xl border-2 border-sky-200 bg-[#f2f8fd] px-3 py-2 text-sm outline-none focus:border-brand-500">
                    {KDV_ORANLARI.map((o) => <option key={o} value={o}>%{o}</option>)}
                  </select>
                </label>
              </div>

              <label className="mt-3 block text-sm font-semibold text-slate-700">KDV Tevkifatı
                <select value={tevkifatOran} onChange={(e) => setTevkifatOran(Number(e.target.value))}
                  className="mt-1 w-full rounded-xl border-2 border-sky-200 bg-[#f2f8fd] px-3 py-2 text-sm outline-none focus:border-brand-500">
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
                <input list="cari-rehber" value={taraf} onChange={(e) => setTaraf(e.target.value)} placeholder="rehberden seç / yaz"
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
                  className="mt-1 w-full rounded-xl border-2 border-sky-200 bg-[#f2f8fd] px-3 py-2 text-sm outline-none focus:border-brand-500">
                  <option value="odendi">{tip === "gider" ? "Ödendi" : "Tahsil edildi"}</option>
                  <option value="acik">Açık (vadeli)</option>
                </select>
              </label>
              {durum === "odendi" && hesaplar.length > 0 && (
                <label className="mt-3 block text-sm font-semibold text-slate-700">{tip === "gider" ? "Ödendiği hesap" : "Tahsil edilen hesap"}
                  <select value={hesapId} onChange={(e) => setHesapId(e.target.value)}
                    className="mt-1 w-full rounded-xl border-2 border-sky-200 bg-[#f2f8fd] px-3 py-2 text-sm outline-none focus:border-brand-500">
                    <option value="">— Belirtilmedi —</option>
                    {hesaplar.map((h) => <option key={h.id} value={h.id}>{h.ad}</option>)}
                  </select>
                </label>
              )}

              {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm font-bold text-red-600">{error}</p>}
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
                <div className="mt-3 overflow-x-auto rounded-2xl border border-sky-200 bg-[#f2f8fd] shadow-sm">
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
                                  className="rounded-lg px-2 py-1 text-xs font-bold text-brand-600 transition hover:bg-brand-50">💸</button>
                              )}
                              <button onClick={() => handleSil(k.id)} className="rounded-lg px-2 py-1 text-slate-300 transition hover:bg-red-50 hover:text-red-500">🗑️</button>
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

      {/* CARİ HESAPLAR SEKMESİ */}
      {sekme === "cari" && (
        <div className="mt-5 grid gap-6 lg:grid-cols-2">
          {/* Cari Liste */}
          <div>
            <h2 className="text-sm font-extrabold text-slate-700">Taraf Bazlı Bakiyeler ({cariler.length})</h2>
            <div className="mt-3 overflow-hidden rounded-2xl border border-sky-200 bg-[#f2f8fd] shadow-sm">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-bold uppercase text-slate-500">
                    <th className="px-3 py-2.5">Cari / Firma</th>
                    <th className="px-3 py-2.5 text-right">Bakiye</th>
                    <th className="px-2 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {cariler.map((c) => (
                    <tr key={c.taraf} className={`border-b border-slate-100 transition ${seciliCari === c.taraf ? "bg-brand-50" : "hover:bg-slate-50"}`}>
                      <td className="px-3 py-2">
                        <div className="font-bold text-slate-800">{c.taraf}</div>
                        <div className="text-[10px] text-slate-500">{c.hareketSayisi} hareket</div>
                      </td>
                      <td className={`px-3 py-2 text-right font-extrabold ${c.bakiye >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                        {formatTL(c.bakiye)}
                      </td>
                      <td className="px-2 py-2 text-right">
                        <button onClick={() => setSeciliCari(c.taraf)}
                          className="rounded-lg bg-white px-2 py-1 text-xs font-bold shadow-sm ring-1 ring-slate-200 transition hover:bg-brand-500 hover:text-white hover:ring-brand-500">Seç</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h3 className="mt-8 text-sm font-extrabold text-slate-700">⌛ Vade Yaşlandırma</h3>
            <div className="mt-3 overflow-hidden rounded-2xl border border-sky-200 bg-[#f2f8fd] shadow-sm">
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
              <div className="mt-3 overflow-x-auto rounded-2xl border border-sky-200 bg-[#f2f8fd] shadow-sm">
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

      {/* KASA & BANKA SEKMESİ */}
      {sekme === "kasa" && (
        <KasaSekme hesaplar={hesaplar} onEkle={handleHesapEkle} onSil={handleHesapSil} />
      )}

      {/* RAPORLAR SEKMESİ */}
      {sekme === "raporlar" && (
        <div className="mt-5 grid gap-6 md:grid-cols-2">
          {/* Gelir Tablosu */}
          <div className="rounded-2xl border border-sky-200 bg-[#f2f8fd] p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900">Gelir Tablosu (KDV Hariç)</h2>
              <div className="flex gap-1">
                <button onClick={() => raporGelirTablosu("pdf")} className="rounded-lg bg-slate-100 p-1.5 text-xs font-bold text-slate-600 hover:bg-slate-200">PDF</button>
                <button onClick={() => raporGelirTablosu("excel")} className="rounded-lg bg-slate-100 p-1.5 text-xs font-bold text-slate-600 hover:bg-slate-200">Excel</button>
              </div>
            </div>
            <div className="mt-5 space-y-3">
              <div className="flex justify-between text-sm font-bold border-b border-slate-100 pb-2">
                <span className="text-emerald-600">Toplam Gelir</span>
                <span>{formatTL(gt.toplamGelir)}</span>
              </div>
              <div className="flex justify-between text-sm font-bold border-b border-slate-100 pb-2">
                <span className="text-red-600">Toplam Gider</span>
                <span>{formatTL(gt.toplamGider)}</span>
              </div>
              <div className="flex justify-between text-lg font-extrabold pt-2">
                <span className="text-slate-900">Brüt Kar / Zarar</span>
                <span className={gt.brutKar >= 0 ? "text-emerald-600" : "text-red-600"}>{formatTL(gt.brutKar)}</span>
              </div>
            </div>
            <div className="mt-6">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Gider Dağılımı</h3>
              <div className="mt-3 space-y-2">
                {gt.gider.slice(0, 5).map((g) => {
                  const yuzde = gt.toplamGider ? Math.round((g.tutar / gt.toplamGider) * 100) : 0;
                  return (
                    <div key={g.kategori}>
                      <div className="flex justify-between text-xs font-semibold text-slate-600 mb-1">
                        <span>{g.kategori}</span>
                        <span>%{yuzde}</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-slate-100">
                        <div className="h-full rounded-full bg-slate-400" style={{ width: `${yuzde}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Nakit Akış & KDV */}
          <div className="space-y-6">
            <div className="rounded-2xl border border-sky-200 bg-[#f2f8fd] p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-slate-900">KDV Özeti</h2>
                <div className="flex gap-1">
                  <button onClick={() => raporKdv("pdf")} className="rounded-lg bg-slate-100 p-1.5 text-xs font-bold text-slate-600 hover:bg-slate-200">PDF</button>
                  <button onClick={() => raporKdv("excel")} className="rounded-lg bg-slate-100 p-1.5 text-xs font-bold text-slate-600 hover:bg-slate-200">Excel</button>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-4">
                <div className="rounded-xl bg-slate-50 p-3">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Hesaplanan</div>
                  <div className="text-sm font-bold text-emerald-600">{formatTL(kdv.hesaplananKdv)}</div>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">İndirilecek</div>
                  <div className="text-sm font-bold text-red-600">{formatTL(kdv.indirilecekKdv)}</div>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between rounded-xl bg-brand-50 p-3">
                <span className="text-xs font-bold text-brand-900">Ödenecek / Devreden KDV</span>
                <span className={`text-sm font-extrabold ${kdv.odenecekKdv >= 0 ? "text-brand-600" : "text-emerald-600"}`}>
                  {formatTL(kdv.odenecekKdv)}
                </span>
              </div>
            </div>

            <div className="rounded-2xl border border-sky-200 bg-[#f2f8fd] p-6 shadow-sm">
              <h2 className="text-base font-bold text-slate-900">Aylık Nakit Akış</h2>
              <div className="mt-4 space-y-3">
                {nakit.slice(-4).map((n) => (
                  <div key={n.ay} className="flex items-center justify-between gap-4 border-b border-slate-50 pb-2 text-xs">
                    <span className="font-bold text-slate-500">{n.ay}</span>
                    <div className="flex flex-1 justify-end gap-3">
                      <span className="text-emerald-600">+{formatTL(n.tahsilat)}</span>
                      <span className="text-red-600">−{formatTL(n.odeme)}</span>
                    </div>
                    <span className={`w-20 text-right font-extrabold ${n.net >= 0 ? "text-slate-900" : "text-red-700"}`}>{formatTL(n.net)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODALLAR */}
      {muhMod && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h2 className="text-lg font-extrabold text-slate-900">Muhasebeleştir</h2>
            <p className="mt-1 text-sm text-slate-500">
              {muhMod.asama} &gt; <b>{muhMod.ad}</b> kalemini kesinleştirin.
            </p>

            <div className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-xs font-bold text-slate-500">Matrah (₺)
                  <input type="number" value={mMatrah} onChange={(e) => setMMatrah(e.target.value)}
                    className="mt-1 w-full rounded-xl border-2 border-slate-100 bg-slate-50 px-3 py-2 text-sm font-bold outline-none focus:border-brand-500" />
                </label>
                <label className="block text-xs font-bold text-slate-500">KDV Oranı
                  <select value={mKdv} onChange={(e) => setMKdv(Number(e.target.value))}
                    className="mt-1 w-full rounded-xl border-2 border-slate-100 bg-slate-50 px-3 py-2 text-sm font-bold outline-none focus:border-brand-500">
                    {KDV_ORANLARI.map((o) => <option key={o} value={o}>%{o}</option>)}
                  </select>
                </label>
              </div>
              <label className="block text-xs font-bold text-slate-500">KDV Tevkifatı
                <select value={mTevkifat} onChange={(e) => setMTevkifat(Number(e.target.value))}
                  className="mt-1 w-full rounded-xl border-2 border-slate-100 bg-slate-50 px-3 py-2 text-sm font-bold outline-none focus:border-brand-500">
                  {TEVKIFAT_ORANLARI.map((t) => <option key={t.etiket} value={t.oran}>{t.etiket}</option>)}
                </select>
              </label>

              <div className="rounded-xl bg-brand-50 p-3 text-xs">
                <div className="flex justify-between font-bold text-brand-900">
                  <span>Ödenen Net Tutar</span>
                  <span>{formatTL(muhOnizleme.net)}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="block text-xs font-bold text-slate-500">Kategori
                  <select value={mKategori} onChange={(e) => setMKategori(e.target.value)}
                    className="mt-1 w-full rounded-xl border-2 border-slate-100 bg-slate-50 px-3 py-2 text-sm font-bold outline-none focus:border-brand-500">
                    {GIDER_KATEGORILERI.map((k) => <option key={k}>{k}</option>)}
                  </select>
                </label>
                <label className="block text-xs font-bold text-slate-500">Taraf
                  <input list="cari-rehber" value={mTaraf} onChange={(e) => setMTaraf(e.target.value)}
                    className="mt-1 w-full rounded-xl border-2 border-slate-100 bg-slate-50 px-3 py-2 text-sm font-bold outline-none focus:border-brand-500" />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="block text-xs font-bold text-slate-500">Tarih
                  <input type="date" value={mTarih} onChange={(e) => setMTarih(e.target.value)}
                    className="mt-1 w-full rounded-xl border-2 border-slate-100 bg-slate-50 px-3 py-2 text-sm font-bold outline-none focus:border-brand-500" />
                </label>
                <label className="block text-xs font-bold text-slate-500">Ödenen Hesap
                  <select value={mHesap} onChange={(e) => setMHesap(e.target.value)}
                    className="mt-1 w-full rounded-xl border-2 border-slate-100 bg-slate-50 px-3 py-2 text-sm font-bold outline-none focus:border-brand-500">
                    {hesaplar.map((h) => <option key={h.id} value={h.id}>{h.ad}</option>)}
                  </select>
                </label>
              </div>
            </div>

            <div className="mt-6 flex gap-2">
              <button onClick={() => setMuhMod(null)} className="flex-1 rounded-xl bg-slate-100 py-2.5 text-sm font-bold text-slate-600 transition hover:bg-slate-200">Vazgeç</button>
              <button onClick={muhOnayla} className="flex-1 rounded-xl bg-brand-500 py-2.5 text-sm font-bold text-white transition hover:bg-brand-600">Onayla ve Kaydet</button>
            </div>
          </div>
        </div>
      )}

      {odemeKayit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <h2 className="text-lg font-extrabold text-slate-900">{odemeKayit.tip === "gider" ? "Ödeme Kaydet" : "Tahsilat Kaydet"}</h2>
            <p className="mt-1 text-sm text-slate-500">{odemeKayit.taraf} — {odemeKayit.aciklama}</p>

            <div className="mt-4 space-y-4">
              <label className="block text-xs font-bold text-slate-500">Tutar (₺)
                <input type="number" step="0.01" value={odemeMiktar} onChange={(e) => setOdemeMiktar(e.target.value)}
                  className="mt-1 w-full rounded-xl border-2 border-slate-100 bg-slate-50 px-4 py-3 text-lg font-extrabold text-slate-900 outline-none focus:border-brand-500" />
              </label>

              <label className="block text-xs font-bold text-slate-500">İşlemin Yapıldığı Hesap
                <select value={odemeHesap} onChange={(e) => setOdemeHesap(e.target.value)}
                  className="mt-1 w-full rounded-xl border-2 border-slate-100 bg-slate-50 px-3 py-2 text-sm font-bold outline-none focus:border-brand-500">
                  {hesaplar.map((h) => <option key={h.id} value={h.id}>{h.ad}</option>)}
                </select>
              </label>
            </div>

            <div className="mt-6 flex gap-2">
              <button onClick={() => setOdemeKayit(null)} className="flex-1 rounded-xl bg-slate-100 py-2.5 text-sm font-bold text-slate-600 transition hover:bg-slate-200">Vazgeç</button>
              <button onClick={odemeOnayla} className="flex-1 rounded-xl bg-brand-500 py-2.5 text-sm font-bold text-white transition hover:bg-brand-600">Kaydet</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Kart({ renk, baslik, deger, altKisim }: { renk: string, baslik: string, deger: number, altKisim: string }) {
  const renkSinif: Record<string, string> = {
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
    red: "border-red-200 bg-red-50 text-red-700",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
    ink: "border-sky-200 bg-[#f2f8fd] text-slate-900 shadow-sm",
  };
  return (
    <div className={`rounded-2xl border p-4 ${renkSinif[renk] || renkSinif.ink}`}>
      <div className="text-[10px] font-extrabold uppercase tracking-widest opacity-70">{baslik}</div>
      <div className="mt-1 text-lg font-extrabold">{formatTL(deger)}</div>
      <div className="mt-1 text-[10px] font-semibold opacity-60">{altKisim}</div>
    </div>
  );
}

function MiniKart({ baslik, deger, gider }: { baslik: string, deger: number | null, gider?: number }) {
  const asim = deger != null && gider != null && gider > deger;
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
      <div className="text-[10px] font-bold text-slate-400 uppercase">{baslik}</div>
      <div className={`text-sm font-extrabold ${asim ? "text-red-400" : "text-white"}`}>
        {deger != null ? formatTL(deger) : "—"}
      </div>
      {gider != null && (
        <div className="mt-1 h-1 w-full rounded-full bg-white/10 overflow-hidden">
          <div className={`h-full ${asim ? "bg-red-400" : "bg-brand-500"}`} style={{ width: `${deger ? Math.min(100, (gider/deger)*100) : 0}%` }} />
        </div>
      )}
    </div>
  );
}

function Satir({ k, v, kalin, renk }: { k: string, v: number, kalin?: boolean, renk?: string }) {
  return (
    <div className={`flex justify-between py-0.5 ${kalin ? "font-bold text-slate-800" : "text-slate-500"} ${renk === "brand" ? "text-brand-600" : ""}`}>
      <span>{k}</span>
      <span>{formatTL(v)}</span>
    </div>
  );
}

function KasaSekme({ hesaplar, onEkle, onSil }: { hesaplar: FinansHesap[], onEkle: any, onSil: any }) {
  const [tip, setTip] = useState<HesapTipi>("kasa");
  const [ad, setAd] = useState("");
  const [iban, setIban] = useState("");
  const [acilis, setAcilis] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ad) return;
    onEkle(ad, tip, iban, parseFloat(acilis) || 0);
    setAd(""); setIban(""); setAcilis("");
  };

  const toplam = hesaplar.reduce((s, h) => s + hesapBakiyesi(h.id, h.acilisBakiye), 0);

  return (
    <div className="mt-5 grid gap-6 lg:grid-cols-[340px_1fr]">
      <form onSubmit={handleSubmit} className="h-fit rounded-2xl border border-sky-200 bg-[#f2f8fd] p-5 shadow-sm">
        <h2 className="text-sm font-extrabold text-slate-700">Yeni Hesap</h2>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button type="button" onClick={() => setTip("kasa")}
            className={`rounded-xl border-2 py-2 text-xs font-bold transition ${tip === "kasa" ? "border-brand-500 bg-brand-50 text-brand-600" : "border-slate-100 text-slate-400"}`}>💵 Kasa</button>
          <button type="button" onClick={() => setTip("banka")}
            className={`rounded-xl border-2 py-2 text-xs font-bold transition ${tip === "banka" ? "border-brand-500 bg-brand-50 text-brand-600" : "border-slate-100 text-slate-400"}`}>🏦 Banka</button>    
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
                <div key={h.id} className="rounded-2xl border border-sky-200 bg-[#f2f8fd] p-4 shadow-sm">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-xs font-semibold uppercase text-slate-400">{h.tip === "kasa" ? "💵 Kasa" : "🏦 Banka"}</div>
                      <div className="font-bold text-slate-800">{h.ad}</div>
                      {h.iban && <div className="text-[11px] text-slate-400">{h.iban}</div>}
                    </div>
                    <button onClick={() => onSil(h.id)} className="rounded-lg px-2 py-1 text-slate-300 transition hover:bg-red-50 hover:text-red-500">🗑️</button>
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
