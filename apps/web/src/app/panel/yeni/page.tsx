"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/apiTaban";
import {
  type ProjectType,
  type FloorPlan,
  type FloorUsage,
  type Apartment,
  type ApartmentType,
  type RoomDetail,
  type BuildingDetails,
  type RoofType,
  TYPE_LABELS,
  FLOOR_USAGE_LABELS,
  ROOF_LABELS,
  APT_TYPES,
  APT_TYPE_LABELS,
  tipOdaSalon,
  isDaireTipi,
  createProject,
  getProject,
  updateProject,
  loadProjects,
  formatTL,
} from "@/lib/projects";

import { DOGRAMA_TIPLERI, HOL_MALZEME } from "@/lib/binaAlanlari";
import { type Poz, type LibId, ensurePozlarSeeded, POZ_KUTUPHANELER, DEFAULT_LIB } from "@/lib/pozlar";
import { aiMetrajPozKalemleri } from "@/lib/kesifEslesme";
import { projeLimitiGetir } from "@/lib/rol";

const CITIES = [
  "İstanbul", "Ankara", "İzmir", "Bursa", "Antalya", "Adana", "Konya",
  "Gaziantep", "Trabzon", "Muğla", "Kayseri", "Samsun", "Diğer",
];

function uid() {
  return crypto.randomUUID();
}

/** Bir tipe göre boş daire üret (oda/salon m² dizilerini hazırla). */
function bosDaire(tip: ApartmentType = "2+1"): Apartment {
  return { id: uid(), tip, adet: 1, detay: tipDetayHazirla(tip, {}) };
}

/** Tip değişince oda/salon dizilerini yeniden boyutlandır, eski m²'leri koru. */
function tipDetayHazirla(tip: ApartmentType, eski: RoomDetail): RoomDetail {
  if (!isDaireTipi(tip)) {
    // dükkan/depo/ofis: sadece alan + opsiyonel wc
    return {
      alan: eski.alan,
      wcVar: eski.wcVar,
      wcAlan: eski.wcAlan,
    };
  }
  const { oda, salon } = tipOdaSalon(tip);
  const boyutla = (arr: number[] | undefined, n: number) => {
    const out = (arr ?? []).slice(0, n);
    while (out.length < n) out.push(NaN); // boş = NaN
    return out.map((v) => (Number.isNaN(v) ? undefined : v)) as number[];
  };
  return {
    ...eski,
    odaAlanlar: boyutla(eski.odaAlanlar, oda),
    salonAlanlar: boyutla(eski.salonAlanlar, salon),
  };
}

export default function YeniProjePage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [yetkiHazir, setYetkiHazir] = useState(false);
  const [projeSayisi, setProjeSayisi] = useState(0);
  const [limit, setLimit] = useState(Infinity); // kişiye özel proje limiti (yüklenene kadar engelleme yok)

  useEffect(() => {
    projeLimitiGetir().then((l) => { setLimit(l); setYetkiHazir(true); });
    setProjeSayisi(loadProjects().length);
  }, []);

  // Temel bilgiler
  const [name, setName] = useState("");
  const [city, setCity] = useState("İstanbul");
  const [type, setType] = useState<ProjectType>("konut");
  const [area, setArea] = useState("");
  const [budget, setBudget] = useState("");
  const [katSayisi, setKatSayisi] = useState("4");
  const [bodrumAdet, setBodrumAdet] = useState("1");            // bodrum kat adedi
  const [bodrumGruplari, setBodrumGruplari] = useState<string[]>(["1"]); // her bodrum → grup
  const [normalKatSayisi, setNormalKatSayisi] = useState("3");  // zemin üstü normal kat sayısı
  const [katGruplari, setKatGruplari] = useState<string[]>(["1", "1", "1"]); // her normal kat → grup etiketi
  const [pozKutuphane, setPozKutuphane] = useState<LibId>(DEFAULT_LIB);

  // Bir grup dizisini hedef boy'a göre yeniden boyutla
  function boyutlaGrup(g: string[], n: number, yeniDeger: (i: number) => string): string[] {
    const out = g.slice(0, n);
    while (out.length < n) out.push(yeniDeger(out.length));
    return out;
  }
  // Bodrum adedi değişince grup dizisini boyutla (varsayılan: her bodrum farklı)
  function bodrumAdetAyarla(v: string) {
    setBodrumAdet(v);
    const n = Math.max(0, parseInt(v) || 0);
    setBodrumGruplari((g) => boyutlaGrup(g, n, (i) => String(i + 1)));
  }
  function bodrumGrupAyarla(i: number, deger: string) {
    setBodrumGruplari((g) => g.map((x, j) => (j === i ? deger : x)));
  }
  // Normal kat sayısı değişince grup dizisini boyutla (varsayılan: hepsi aynı grup)
  function normalKatSayisiAyarla(v: string) {
    setNormalKatSayisi(v);
    const n = Math.max(0, parseInt(v) || 0);
    setKatGruplari((g) => boyutlaGrup(g, n, () => "1"));
  }
  function katGrupAyarla(i: number, deger: string) {
    setKatGruplari((g) => g.map((x, j) => (j === i ? deger : x)));
  }
  function hepsiBenzer() { setKatGruplari((g) => g.map(() => "1")); }
  function hepsiFarkli() { setKatGruplari((g) => g.map((_, i) => String(i + 1))); }

  // Katlar + bina
  const [katlar, setKatlar] = useState<FloorPlan[]>([]);
  const [bina, setBina] = useState<BuildingDetails>({ yanginMerdiveni: false });

  const [error, setError] = useState("");
  const [busyKat, setBusyKat] = useState<string | null>(null);
  const [acikDetay, setAcikDetay] = useState<string | null>(null); // hangi bölümün detay paneli açık
  const [editId, setEditId] = useState<string | null>(null); // düzenleme modundaki proje id

  // Poz kütüphanesi + arama (işçilik ve ana kalem için)
  const [pozlar, setPozlar] = useState<Poz[]>([]);
  const [iscilikAra, setIscilikAra] = useState("");
  const [iscilikAcik, setIscilikAcik] = useState(false);
  const [anaKalemAra, setAnaKalemAra] = useState("");
  const [anaKalemAcik, setAnaKalemAcik] = useState(false);
  const [daireAra, setDaireAra] = useState(""); // açık daire detayı için poz arama

  // Seçilen kütüphaneyi yükle (kütüphane değişince yeniden)
  useEffect(() => {
    ensurePozlarSeeded(pozKutuphane).then(setPozlar);
  }, [pozKutuphane]);

  const pozAra = (q: string) => {
    const s = q.toLocaleLowerCase("tr").trim();
    if (!s) return [];
    return pozlar
      .filter((p) => p.kod.toLocaleLowerCase("tr").includes(s) || p.ad.toLocaleLowerCase("tr").includes(s))
      .slice(0, 25);
  };
  const iscilikEslesen = pozAra(iscilikAra);
  const anaKalemEslesen = pozAra(anaKalemAra);
  const daireEslesen = pozAra(daireAra);

  // ?duzenle=<id> varsa mevcut projeyi yükle (düzenleme modu)
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("duzenle");
    if (!id) return;
    const p = getProject(id);
    if (!p) return;
    setEditId(p.id);
    setName(p.name);
    setCity(p.city);
    setType(p.type);
    setArea(String(p.area));
    setBudget(p.budget != null ? String(p.budget) : "");
    setKatSayisi(String(p.floors));
    if (p.pozKutuphane === "kut1" || p.pozKutuphane === "kut2") setPozKutuphane(p.pozKutuphane);
    if (p.katlar && p.katlar.length > 0) {
      setKatlar(p.katlar);
      const bodrumlar = p.katlar.filter((k) => k.kullanim === "bodrum");
      const bGrupArr: string[] = [];
      bodrumlar.forEach((k, gi) => {
        const cnt = k.benzerAdet ?? 1;
        for (let j = 0; j < cnt; j++) bGrupArr.push(String(gi + 1));
      });
      setBodrumGruplari(bGrupArr);
      setBodrumAdet(String(bGrupArr.length));
      const normaller = p.katlar.filter((k) => k.kullanim === "normal");
      const grupArr: string[] = [];
      normaller.forEach((k, gi) => {
        const cnt = k.benzerAdet ?? 1;
        for (let j = 0; j < cnt; j++) grupArr.push(String(gi + 1));
      });
      setKatGruplari(grupArr);
      setNormalKatSayisi(String(grupArr.length));
    }
    if (p.bina) setBina(p.bina);
  }, []);

  // ── Kat satırlarını üret (bodrum adedi + normal kat gruplaması) ──
  function katlariUret() {
    const bod = Math.max(0, parseInt(bodrumAdet) || 0);
    const n = Math.max(0, parseInt(normalKatSayisi) || 0);
    const yeni: FloorPlan[] = [];

    // Bodrumlar: aynı grup etiketli bodrumlar TEK şablon (B1, B2…)
    const bGruplar = bodrumGruplari.slice(0, bod);
    const bGorulen = new Map<string, number[]>(); // grup → bodrum no
    bGruplar.forEach((g, i) => {
      const key = (g || String(i + 1)).trim() || String(i + 1);
      if (!bGorulen.has(key)) bGorulen.set(key, []);
      bGorulen.get(key)!.push(i + 1);
    });
    for (const [, bNolar] of bGorulen) {
      const ad = bNolar.length > 1
        ? `B${bNolar[0]}-B${bNolar[bNolar.length - 1]}`
        : `B${bNolar[0]}`;
      yeni.push({ id: uid(), ad, kullanim: "bodrum", benzerAdet: bNolar.length, daireler: [] });
    }

    yeni.push({ id: uid(), ad: "Zemin Kat", kullanim: "zemin", benzerAdet: 1, daireler: [] });

    // Normal katlar: aynı grup etiketli katlar TEK şablon
    const gruplar = katGruplari.slice(0, n);
    const gorulen = new Map<string, number[]>(); // grup → kat numaraları (1-bazlı)
    gruplar.forEach((g, i) => {
      const key = (g || "1").trim() || "1";
      if (!gorulen.has(key)) gorulen.set(key, []);
      gorulen.get(key)!.push(i + 1);
    });
    for (const [, katNolar] of gorulen) {
      const ad = katNolar.length > 1
        ? `${katNolar[0]}-${katNolar[katNolar.length - 1]}. Kat`
        : `${katNolar[0]}. Kat`;
      yeni.push({ id: uid(), ad, kullanim: "normal", benzerAdet: katNolar.length, daireler: [] });
    }

    setKatSayisi(String(bod + 1 + n)); // toplam fiziksel kat
    setKatlar(yeni);
  }

  // Kat ekle (farklı tipte bir kat şablonu daha)
  function katEkle() {
    setKatlar((ks) => [...ks, { id: uid(), ad: "Yeni Kat", kullanim: "normal", benzerAdet: 1, daireler: [] }]);
  }
  function katSil(id: string) {
    setKatlar((ks) => ks.filter((k) => k.id !== id));
  }

  function setKat(id: string, patch: Partial<FloorPlan>) {
    setKatlar((ks) => ks.map((k) => (k.id === id ? { ...k, ...patch } : k)));
  }

  // ── PDF yükleme → /api/plan-oku ──
  async function planYukle(katId: string, file: File) {
    setBusyKat(katId);
    setError("");
    try {
      const buf = await file.arrayBuffer();
      const base64 = arrayBufferToBase64(buf);
      const res = await apiFetch("/api/plan-oku", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pdfBase64: base64, dosyaAdi: file.name, kapsam: "kat" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "PDF okunamadı.");
        return;
      }
      const daireler: Apartment[] = (data.daireler ?? []).map(
        (d: {
          tip: string; adet?: number;
          ozet?: { alan?: number; oda?: number; salon?: number; banyo?: number; wc?: number; mutfak?: number };
          metraj?: Record<string, number>;
          pencereler?: { tip: string; alan?: number }[];
        }) => {
          const tip = (APT_TYPES.includes(d.tip as ApartmentType) ? d.tip : "diğer") as ApartmentType;
          const oz = d.ozet ?? {};
          // İMALAT METRAJI → poza bağlı kalemler (otomatik eşleştirme)
          const eslesen = aiMetrajPozKalemleri(d.metraj, pozlar);
          const pozKalemler = eslesen.map((k) => ({ id: uid(), ...k }));
          // ÖZET → oda/salon/mutfak/banyo/wc hızlı düzen (kullanıcı m² doldurur)
          const detay: RoomDetail = {
            alan: oz.alan,
            odaAlanlar: oz.oda ? Array(oz.oda).fill(undefined) : undefined,
            salonAlanlar: oz.salon ? Array(oz.salon).fill(undefined) : undefined,
            mutfakVar: oz.mutfak != null, mutfakAlan: oz.mutfak,
            banyoVar: oz.banyo != null && oz.banyo > 0,
            wcVar: oz.wc != null && oz.wc > 0,
            pencereler: (d.pencereler ?? [])
              .filter((p) => p.tip)
              .map((p) => ({ tip: p.tip, alan: p.alan })),
            pozKalemler,
          };
          return { id: uid(), tip, adet: d.adet ?? 1, detay };
        },
      );
      const toplamKalem = daireler.reduce((s, x) => s + (x.detay.pozKalemler?.length ?? 0), 0);
      setKat(katId, {
        pdfAdi: file.name,
        daireler,
        aiNot: data.demoMode
          ? "DEMO: elle girin (sunucuda anahtar yok)"
          : data.not || `${daireler.length} bölüm · ${toplamKalem} poz kalemi otomatik bağlandı`,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Yükleme hatası");
    } finally {
      setBusyKat(null);
    }
  }

  // ── Daire düzenleme (Adım 2) ──
  // Bir kartın adedini değiştir; TOPLAM bölüm sayısını sabit tut
  // (adet artarsa diğer kartlardan düşer, azalırsa yeni boş kart eklenir).
  function daireAdet(katId: string, daireId: string, yeniAdet: number) {
    setKatlar((ks) =>
      ks.map((k) => {
        if (k.id !== katId) return k;
        const idx = k.daireler.findIndex((d) => d.id === daireId);
        if (idx < 0) return k;
        const toplam = k.daireler.reduce((s, d) => s + (d.adet || 1), 0);
        const hedef = Math.max(1, Math.min(yeniAdet, toplam)); // toplamı aşamaz
        const kartlar = k.daireler.map((d, j) => ({ ...d, adet: j === idx ? hedef : (d.adet || 1) }));
        let sum = kartlar.reduce((s, d) => s + d.adet, 0);
        if (sum > toplam) {
          let fazla = sum - toplam;
          for (let j = kartlar.length - 1; j >= 0 && fazla > 0; j--) {
            if (j === idx) continue;
            const dus = Math.min(kartlar[j].adet, fazla);
            kartlar[j] = { ...kartlar[j], adet: kartlar[j].adet - dus };
            fazla -= dus;
          }
        }
        let sonuc = kartlar.filter((d, j) => j === idx || d.adet > 0);
        if (sum < toplam) {
          for (let n = 0; n < toplam - sum; n++) sonuc = [...sonuc, bosDaire()];
        }
        return { ...k, daireler: sonuc };
      }),
    );
  }
  function daireSil(katId: string, daireId: string) {
    setKatlar((ks) =>
      ks.map((k) =>
        k.id === katId ? { ...k, daireler: k.daireler.filter((d) => d.id !== daireId) } : k,
      ),
    );
  }
  function daireMap(katId: string, daireId: string, fn: (d: Apartment) => Apartment) {
    setKatlar((ks) =>
      ks.map((k) =>
        k.id === katId ? { ...k, daireler: k.daireler.map((d) => (d.id === daireId ? fn(d) : d)) } : k,
      ),
    );
  }

  // Tip değişince oda/salon dizilerini yeniden hazırla
  function tipDegistir(katId: string, daireId: string, tip: ApartmentType) {
    daireMap(katId, daireId, (d) => ({ ...d, tip, detay: tipDetayHazirla(tip, d.detay) }));
  }

  // Tek sayısal alan (alan, mutfakAlan, banyoAlan, wcAlan, dolap…)
  function detayNum(katId: string, daireId: string, key: keyof RoomDetail, value: string) {
    const v = value === "" ? undefined : parseFloat(value);
    daireMap(katId, daireId, (d) => ({ ...d, detay: { ...d.detay, [key]: v } }));
  }

  // var/yok toggle
  function detayBool(katId: string, daireId: string, key: "mutfakVar" | "banyoVar" | "wcVar", value: boolean) {
    daireMap(katId, daireId, (d) => ({ ...d, detay: { ...d.detay, [key]: value } }));
  }

  // oda/salon dizisindeki bir m²
  function detayDizi(katId: string, daireId: string, key: "odaAlanlar" | "salonAlanlar", i: number, value: string) {
    const v = value === "" ? undefined : parseFloat(value);
    daireMap(katId, daireId, (d) => {
      const arr = [...((d.detay[key] as (number | undefined)[]) ?? [])];
      arr[i] = v as number;
      return { ...d, detay: { ...d.detay, [key]: arr } };
    });
  }

  // Daire metraj kalemi (pozdan)
  function daireKalemEkle(katId: string, daireId: string, p: Poz) {
    daireMap(katId, daireId, (d) => ({
      ...d,
      detay: {
        ...d.detay,
        pozKalemler: [...(d.detay.pozKalemler ?? []), { id: uid(), pozKod: p.kod, kalem: p.ad, birim: p.birim }],
      },
    }));
    setDaireAra("");
  }
  function daireKalemMiktar(katId: string, daireId: string, kalemId: string, value: string) {
    const v = value === "" ? undefined : parseFloat(value);
    daireMap(katId, daireId, (d) => ({
      ...d,
      detay: {
        ...d.detay,
        pozKalemler: (d.detay.pozKalemler ?? []).map((k) => (k.id === kalemId ? { ...k, miktar: v } : k)),
      },
    }));
  }
  function daireKalemSil(katId: string, daireId: string, kalemId: string) {
    daireMap(katId, daireId, (d) => ({
      ...d,
      detay: { ...d.detay, pozKalemler: (d.detay.pozKalemler ?? []).filter((k) => k.id !== kalemId) },
    }));
  }
  // Pencere ekle / sil / güncelle
  function pencereEkle(katId: string, daireId: string) {
    daireMap(katId, daireId, (d) => ({
      ...d,
      detay: { ...d.detay, pencereler: [...(d.detay.pencereler ?? []), { tip: "pvc" }] },
    }));
  }
  function pencereSil(katId: string, daireId: string, i: number) {
    daireMap(katId, daireId, (d) => ({
      ...d,
      detay: { ...d.detay, pencereler: (d.detay.pencereler ?? []).filter((_, j) => j !== i) },
    }));
  }
  function pencereGuncelle(katId: string, daireId: string, i: number, patch: { tip?: string; alan?: number }) {
    daireMap(katId, daireId, (d) => ({
      ...d,
      detay: {
        ...d.detay,
        pencereler: (d.detay.pencereler ?? []).map((p, j) => (j === i ? { ...p, ...patch } : p)),
      },
    }));
  }

  function iscilikEklePoz(p: Poz) {
    setBina((b) => ({
      ...b,
      iscilikler: [...(b.iscilikler ?? []), { id: uid(), kalem: p.ad, pozKod: p.kod, birim: p.birim }],
    }));
    setIscilikAra("");
    setIscilikAcik(false);
  }
  function iscilikGuncelle(id: string, patch: Partial<{ adSoyad: string; telefon: string; tutar: number }>) {
    setBina((b) => ({
      ...b,
      iscilikler: (b.iscilikler ?? []).map((i) => (i.id === id ? { ...i, ...patch } : i)),
    }));
  }
  function iscilikSil(id: string) {
    setBina((b) => ({ ...b, iscilikler: (b.iscilikler ?? []).filter((i) => i.id !== id) }));
  }

  // ── Bina ana kalem (pozdan) ──
  function anaKalemEklePoz(p: Poz) {
    setBina((b) => ({
      ...b,
      anaKalemPoz: [...(b.anaKalemPoz ?? []), { id: uid(), pozKod: p.kod, kalem: p.ad, birim: p.birim }],
    }));
    setAnaKalemAra("");
    setAnaKalemAcik(false);
  }
  function anaKalemMiktar(id: string, value: string) {
    const v = value === "" ? undefined : parseFloat(value);
    setBina((b) => ({
      ...b,
      anaKalemPoz: (b.anaKalemPoz ?? []).map((k) => (k.id === id ? { ...k, miktar: v } : k)),
    }));
  }
  function anaKalemSil(id: string) {
    setBina((b) => ({ ...b, anaKalemPoz: (b.anaKalemPoz ?? []).filter((k) => k.id !== id) }));
  }

  // Kat içindeki bölüm/daire sayısını ayarla (kart ekle/çıkar)
  // "Kaç bölüm var?" = TOPLAM bağımsız bölüm; kartların adet toplamı buna eşit tutulur
  function bolumSayisiAyarla(katId: string, toplam: number) {
    setKatlar((ks) =>
      ks.map((k) => {
        if (k.id !== katId) return k;
        let daireler = k.daireler.map((d) => ({ ...d, adet: d.adet || 1 }));
        let mevcut = daireler.reduce((s, d) => s + d.adet, 0);
        if (toplam === mevcut) return k;
        if (toplam > mevcut) {
          for (let n = 0; n < toplam - mevcut; n++) daireler = [...daireler, bosDaire()];
        } else {
          let fazla = mevcut - toplam;
          for (let j = daireler.length - 1; j >= 0 && fazla > 0; j--) {
            const dus = Math.min(daireler[j].adet, fazla);
            daireler[j] = { ...daireler[j], adet: daireler[j].adet - dus };
            fazla -= dus;
          }
          daireler = daireler.filter((d) => d.adet > 0);
        }
        return { ...k, daireler };
      }),
    );
  }

  function adim1Ileri() {
    const areaNum = parseFloat(area);
    if (!name.trim()) return setError("Proje adı gerekli.");
    if (!areaNum || areaNum <= 0) return setError("Geçerli toplam alan (m²) girin.");
    if (katlar.length === 0) katlariUret();
    setError("");
    setStep(2);
  }

  function projeyiKaydet() {
    const areaNum = parseFloat(area);
    if (!name.trim()) { setStep(1); return setError("Proje adı gerekli."); }
    if (!areaNum || areaNum <= 0) { setStep(1); return setError("Geçerli toplam alan (m²) girin."); }

    const toplamDaire = katlar.reduce(
      (s, k) => s + (k.benzerAdet || 1) * k.daireler.reduce((ss, d) => ss + (d.adet || 0), 0),
      0,
    );
    const ortak = {
      name: name.trim(),
      city,
      type,
      area: areaNum,
      floors: parseInt(katSayisi) || katlar.length,
      budget: budget ? parseFloat(budget) : null,
      pozKutuphane,
      katlar,
      bina: { ...bina, toplamDaire: toplamDaire || bina.toplamDaire },
    };

    if (editId) {
      const mevcut = getProject(editId);
      if (mevcut) {
        updateProject({ ...mevcut, ...ortak }); // id, createdAt, phases korunur
        router.push(`/panel/proje?id=${editId}`);
        return;
      }
    }
    if (loadProjects().length >= limit) {
      alert(`En fazla ${limit} proje oluşturabilirsiniz. Yeni proje için bir projeyi silin.`);
      return;
    }
    const proje = createProject(ortak);
    router.push(`/panel/proje?id=${proje.id}`);
  }

  /* ─────────────── RENDER ─────────────── */

  if (yetkiHazir && !editId && projeSayisi >= limit) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
        <div className="text-4xl">📁</div>
        <h1 className="mt-3 text-lg font-bold text-slate-900">Proje limitine ulaştın</h1>
        <p className="mt-1 text-sm text-slate-500">Hesabın en fazla <b>{limit} proje</b> oluşturabilir. Yeni proje için önce mevcut bir projeyi silmelisin.</p>
        <Link href="/panel" className="mt-5 inline-block rounded-xl bg-ink-900 px-6 py-3 text-sm font-bold text-white transition hover:bg-ink-800">← Panele Dön</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl">
      <Link href="/panel" className="text-sm font-semibold text-slate-500 transition hover:text-ink-800">
        ← Projeler
      </Link>

      {/* Adım göstergesi */}
      <div className="mt-3 flex items-center gap-3">
        {[1, 2].map((s) => (
          <div key={s} className="flex items-center gap-3">
            <div
              className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-extrabold ${
                step >= s ? "bg-brand-500 text-white" : "bg-slate-200 text-slate-500"
              }`}
            >
              {s}
            </div>
            <span className={`text-sm font-bold ${step >= s ? "text-slate-900" : "text-slate-400"}`}>
              {s === 1 ? "Temel Bilgiler & Kat Planları" : "Bina Detayları & Daireler"}
            </span>
            {s === 1 && <div className="h-px w-8 bg-slate-300" />}
          </div>
        ))}
      </div>

      {error && (
        <p className="mt-4 rounded-lg bg-red-50 px-4 py-2 text-sm font-semibold text-red-600">{error}</p>
      )}

      {/* ═══════════ ADIM 1 ═══════════ */}
      {step === 1 && (
        <div className="mt-6 space-y-6">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900">Proje Bilgileri</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Proje Adı *">
                <input value={name} onChange={(e) => setName(e.target.value)}
                  placeholder="ör: Huzur Apartmanı" className={inputCls} />
              </Field>
              <Field label="Şehir">
                <select value={city} onChange={(e) => setCity(e.target.value)} className={inputCls}>
                  {CITIES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </Field>
              <Field label="Yapı Tipi">
                <select value={type} onChange={(e) => setType(e.target.value as ProjectType)} className={inputCls}>
                  {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </Field>
              <Field label="Poz Kütüphanesi *">
                <select value={pozKutuphane} onChange={(e) => setPozKutuphane(e.target.value as LibId)} className={inputCls}>
                  {POZ_KUTUPHANELER.map((k) => <option key={k.id} value={k.id}>{k.ad}</option>)}
                </select>
              </Field>
              <Field label="Toplam İnşaat Alanı (m²) *">
                <input type="number" min="1" value={area} onChange={(e) => setArea(e.target.value)}
                  placeholder="ör: 2400" className={inputCls} />
              </Field>
              <Field label="Tahmini Bütçe (₺) — opsiyonel">
                <input type="number" min="0" value={budget} onChange={(e) => setBudget(e.target.value)}
                  placeholder="ör: 48000000" className={inputCls} />
              </Field>
            </div>

            {/* Bina kat kurgusu + grup benzerliği */}
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
              <h3 className="text-sm font-extrabold text-slate-700">Kat Kurgusu</h3>
              <div className="mt-2 flex flex-wrap items-end gap-4">
                <label className="text-sm font-semibold text-slate-600">
                  Bodrum adedi
                  <input type="number" min="0" max="10" value={bodrumAdet}
                    onChange={(e) => bodrumAdetAyarla(e.target.value)}
                    className="ml-2 w-20 rounded-lg border-2 border-slate-200 px-3 py-1.5 text-sm font-bold outline-none focus:border-brand-500" />
                </label>
                <label className="text-sm font-semibold text-slate-600">
                  Normal kat sayısı (zemin üstü)
                  <input type="number" min="0" max="60" value={normalKatSayisi}
                    onChange={(e) => normalKatSayisiAyarla(e.target.value)}
                    className="ml-2 w-20 rounded-lg border-2 border-slate-200 px-3 py-1.5 text-sm font-bold outline-none focus:border-brand-500" />
                </label>
              </div>

              {/* Bodrum benzerlik grupları */}
              {bodrumGruplari.length > 0 && (
                <div className="mt-3">
                  <span className="text-xs font-semibold text-slate-600">
                    Bodrumlar (aynı grup numarası = benzer):
                  </span>
                  <div className="mt-1.5 flex flex-wrap gap-2">
                    {bodrumGruplari.map((g, i) => (
                      <label key={i} className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-600">
                        B{i + 1}
                        <input value={g} onChange={(e) => bodrumGrupAyarla(i, e.target.value)}
                          className="w-10 rounded border border-slate-200 px-1 py-0.5 text-center text-xs font-bold outline-none focus:border-brand-500"
                          title="Grup numarası (aynı numara = benzer bodrum)" />
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Kat benzerlik grupları */}
              {katGruplari.length > 0 && (
                <div className="mt-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold text-slate-600">
                      Her kata aynı <b>grup numarasını</b> verirseniz benzer (tek girilir) sayılır:
                    </span>
                    <button onClick={hepsiBenzer} className="rounded-lg bg-slate-200 px-2 py-1 text-[11px] font-bold text-slate-600 hover:bg-slate-300">Hepsi benzer</button>
                    <button onClick={hepsiFarkli} className="rounded-lg bg-slate-200 px-2 py-1 text-[11px] font-bold text-slate-600 hover:bg-slate-300">Hepsi farklı</button>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {katGruplari.map((g, i) => (
                      <label key={i} className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-600">
                        {i + 1}. Kat
                        <input value={g} onChange={(e) => katGrupAyarla(i, e.target.value)}
                          className="w-10 rounded border border-slate-200 px-1 py-0.5 text-center text-xs font-bold outline-none focus:border-brand-500"
                          title="Grup numarası (aynı numara = benzer kat)" />
                      </label>
                    ))}
                  </div>
                  <p className="mt-2 text-[11px] text-slate-500">
                    Örn: 2 ve 3&apos;e &quot;2&quot;, 4&apos;e &quot;3&quot;, 5 ve 6&apos;ya &quot;4&quot; verirseniz; 2-3 benzer, 4 ayrı, 5-6 benzer olur.
                  </p>
                </div>
              )}
            </div>

            <button onClick={katlariUret}
              className="mt-4 rounded-xl bg-ink-900 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-ink-800">
              Kat satırlarını oluştur →
            </button>
          </section>

          {/* Kat planı yükleme */}
          {katlar.length > 0 && (
            <section className="rounded-2xl border-2 border-brand-500/40 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-bold text-slate-900">📐 Kat Planları (PDF)</h2>
              <p className="mt-1 text-sm text-slate-500">
                Her kat için mimari kat planını (PDF) yükleyin; insPRO daire m², oda, ıslak hacim,
                mutfak dolabı, kapı/klozet/musluk adetlerini otomatik çıkarır. PDF yoksa bu adımı
                atlayıp bilgileri 2. adımda elle girebilirsiniz.
              </p>
              <div className="mt-4 space-y-3">
                {katlar.map((kat) => (
                  <div key={kat.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 p-3">
                    <input value={kat.ad} onChange={(e) => setKat(kat.id, { ad: e.target.value })}
                      className="w-36 rounded-lg border-2 border-slate-200 px-3 py-1.5 text-sm font-semibold outline-none focus:border-brand-500" />
                    <select value={kat.kullanim} onChange={(e) => setKat(kat.id, { kullanim: e.target.value as FloorUsage })}
                      className="rounded-lg border-2 border-slate-200 bg-white px-3 py-1.5 text-sm outline-none focus:border-brand-500">
                      {Object.entries(FLOOR_USAGE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                    {kat.benzerAdet && kat.benzerAdet > 1 && (
                      <span className="rounded-full bg-brand-500/15 px-2 py-1 text-xs font-bold text-brand-600">×{kat.benzerAdet} kat</span>
                    )}
                    <label className="cursor-pointer rounded-lg bg-brand-500 px-4 py-1.5 text-sm font-bold text-white transition hover:bg-brand-600">
                      {busyKat === kat.id ? "Okunuyor…" : kat.pdfAdi ? "PDF Değiştir" : "PDF Yükle"}
                      <input type="file" accept="application/pdf" className="hidden"
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) planYukle(kat.id, f); e.target.value = ""; }} />
                    </label>
                    {kat.pdfAdi && (
                      <span className="text-xs text-slate-500">
                        📎 {kat.pdfAdi}
                        {kat.daireler.length > 0 && <b className="ml-2 text-emerald-700">{kat.daireler.length} bölüm</b>}
                        {kat.aiNot && <span className="ml-2 italic text-slate-400">— {kat.aiNot}</span>}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          <div className="flex justify-end">
            <button onClick={adim1Ileri}
              className="rounded-xl bg-brand-500 px-7 py-3 text-sm font-bold text-white shadow-lg shadow-brand-500/25 transition hover:bg-brand-600">
              Devam → Bina Detayları
            </button>
          </div>
        </div>
      )}

      {/* ═══════════ ADIM 2 ═══════════ */}
      {step === 2 && (
        <div className="mt-6 space-y-6">
          {/* Bina geneli */}
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900">🏢 Bina Genel Bilgileri</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Kat Yüksekliği (m)">
                <input type="number" step="0.1" value={bina.katYuksekligi ?? ""} className={inputCls}
                  onChange={(e) => setBina({ ...bina, katYuksekligi: numOrU(e.target.value) })} />
              </Field>
              <Field label="Çatı Tipi">
                <select value={bina.catiTipi ?? ""} className={inputCls}
                  onChange={(e) => setBina({ ...bina, catiTipi: (e.target.value || undefined) as RoofType })}>
                  <option value="">— seçin —</option>
                  {Object.entries(ROOF_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </Field>
              <Field label="Çatı Alanı (m²)">
                <input type="number" value={bina.catiAlan ?? ""} className={inputCls}
                  onChange={(e) => setBina({ ...bina, catiAlan: numOrU(e.target.value) })} />
              </Field>
              <Field label="Bina Holü (m²)">
                <input type="number" value={bina.binaHol ?? ""} className={inputCls}
                  onChange={(e) => setBina({ ...bina, binaHol: numOrU(e.target.value) })} />
              </Field>
              <Field label="Asansör Adedi">
                <input type="number" value={bina.asansorAdet ?? ""} className={inputCls}
                  onChange={(e) => setBina({ ...bina, asansorAdet: numOrU(e.target.value) })} />
              </Field>
              <Field label="Asansör Durak Sayısı">
                <input type="number" value={bina.asansorDurak ?? ""} className={inputCls}
                  onChange={(e) => setBina({ ...bina, asansorDurak: numOrU(e.target.value) })} />
              </Field>
              <Field label="Asansör Cinsi">
                <input value={bina.asansorCins ?? ""} placeholder="ör: 6 kişilik elektrikli" className={inputCls}
                  onChange={(e) => setBina({ ...bina, asansorCins: e.target.value || undefined })} />
              </Field>
              <Field label="Merdiven Basamak Sayısı">
                <input type="number" value={bina.merdivenBasamak ?? ""} className={inputCls}
                  onChange={(e) => setBina({ ...bina, merdivenBasamak: numOrU(e.target.value) })} />
              </Field>
              <Field label="Merdiven Alanı (m²)">
                <input type="number" value={bina.merdivenAlan ?? ""} className={inputCls}
                  onChange={(e) => setBina({ ...bina, merdivenAlan: numOrU(e.target.value) })} />
              </Field>
            </div>
            <label className="mt-3 flex items-center gap-2 text-sm font-semibold text-slate-600">
              <input type="checkbox" checked={bina.yanginMerdiveni ?? false}
                onChange={(e) => setBina({ ...bina, yanginMerdiveni: e.target.checked })}
                className="h-4 w-4 accent-[var(--color-brand-500)]" />
              Yangın merdiveni var
            </label>
          </section>

          {/* Kat / daire editörü */}
          <section className="space-y-4">
            <h2 className="text-lg font-bold text-slate-900">🚪 Katlar ve Bölümler</h2>
            <p className="text-sm text-slate-500">
              Kattaki <b>toplam bölüm sayısını</b> girin; o kadar kart açılır. Benzer olanları
              tek kartta toplamak için &quot;benzer var&quot; işaretleyip <b>adet</b> verin — o adet
              kadar bölüm o karta sayılır, kalan kartlar otomatik düşer. (Örn: 4 bölüm → 2+1&apos;e
              adet 4 = tek daire; adet 3 = 3 aynı + 1 ayrı.)
            </p>
            {katlar.map((kat) => (
              <div key={kat.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-center gap-3">
                  <input value={kat.ad} onChange={(e) => setKat(kat.id, { ad: e.target.value })}
                    className="w-36 rounded-lg border-2 border-slate-200 px-3 py-1.5 text-sm font-bold outline-none focus:border-brand-500" />
                  <select value={kat.kullanim} onChange={(e) => setKat(kat.id, { kullanim: e.target.value as FloorUsage })}
                    className="rounded-lg border-2 border-slate-200 bg-white px-3 py-1.5 text-sm outline-none focus:border-brand-500">
                    {Object.entries(FLOOR_USAGE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                  {kat.benzerAdet && kat.benzerAdet > 1 && (
                    <span className="rounded-full bg-brand-500/15 px-2 py-1 text-xs font-bold text-brand-600">×{kat.benzerAdet} kat</span>
                  )}
                  {kat.pdfAdi && <span className="text-xs text-emerald-600">📎 PDF</span>}
                  <label className="ml-auto flex items-center gap-2 text-sm font-semibold text-slate-600">
                    Kaç bölüm var?
                    <input type="number" min="0" max="60" value={kat.daireler.reduce((s, d) => s + (d.adet || 1), 0)}
                      onChange={(e) => bolumSayisiAyarla(kat.id, Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-20 rounded-lg border-2 border-brand-500/50 px-3 py-1.5 text-sm font-bold outline-none focus:border-brand-500" />
                  </label>
                  <button onClick={() => katSil(kat.id)}
                    className="rounded-lg px-2 py-1 text-slate-300 transition hover:bg-red-50 hover:text-red-500" title="Katı sil">🗑</button>
                </div>

                {kat.daireler.length === 0 ? (
                  <p className="mt-3 text-xs text-slate-400">
                    Bölüm sayısını girince kartlar açılır.
                  </p>
                ) : (
                  <div className="mt-4 grid gap-3 lg:grid-cols-2">
                    {kat.daireler.map((d, di) => {
                      const daire = isDaireTipi(d.tip);
                      return (
                        <div key={d.id} className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-bold text-slate-400">#{di + 1}</span>
                            <select value={d.tip} onChange={(e) => tipDegistir(kat.id, d.id, e.target.value as ApartmentType)}
                              className="rounded-lg border-2 border-slate-200 bg-white px-3 py-1.5 text-sm font-bold outline-none focus:border-brand-500">
                              {APT_TYPES.map((t) => <option key={t} value={t}>{APT_TYPE_LABELS[t]}</option>)}
                            </select>
                            {/* Benzer var mı? → adet (tekrar girmeden çoğalt) */}
                            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                              <input type="checkbox" checked={(d.adet || 1) > 1}
                                onChange={(e) => daireAdet(kat.id, d.id, e.target.checked ? Math.max(2, d.adet || 2) : 1)}
                                className="h-4 w-4 accent-[var(--color-brand-500)]" />
                              benzer var
                            </label>
                            {(d.adet || 1) > 1 && (
                              <label className="flex items-center gap-1 text-xs font-semibold text-slate-600">
                                adet
                                <input type="number" min="2" max={kat.daireler.reduce((s, x) => s + (x.adet || 1), 0)} value={d.adet}
                                  onChange={(e) => daireAdet(kat.id, d.id, parseInt(e.target.value) || 1)}
                                  className="w-16 rounded-lg border-2 border-brand-500/40 px-2 py-1 text-center text-sm font-bold outline-none focus:border-brand-500" />
                                <span className="text-[10px] font-normal text-slate-400">/ {kat.daireler.reduce((s, x) => s + (x.adet || 1), 0)} bölüm</span>
                              </label>
                            )}
                            <button onClick={() => daireSil(kat.id, d.id)}
                              className="ml-auto rounded-lg px-2 py-1 text-slate-300 transition hover:bg-red-50 hover:text-red-500">🗑</button>
                          </div>

                          {!daire ? (
                            /* ── DÜKKAN / DEPO / OFİS: sadece alan + opsiyonel WC ── */
                            <div className="mt-3 flex flex-wrap items-end gap-3">
                              <MiniNum label="Alan (m²)" value={d.detay.alan}
                                onChange={(v) => detayNum(kat.id, d.id, "alan", v)} />
                              <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                                <input type="checkbox" checked={d.detay.wcVar ?? false}
                                  onChange={(e) => detayBool(kat.id, d.id, "wcVar", e.target.checked)}
                                  className="h-4 w-4 accent-[var(--color-brand-500)]" />
                                WC var
                              </label>
                              {d.detay.wcVar && (
                                <MiniNum label="WC (m²)" value={d.detay.wcAlan}
                                  onChange={(v) => detayNum(kat.id, d.id, "wcAlan", v)} />
                              )}
                            </div>
                          ) : (
                            /* ── DAİRE (X+Y): salon, oda, mutfak/banyo/wc koşullu ── */
                            <div className="mt-3 space-y-3">
                              <div className="flex flex-wrap gap-2">
                                {(d.detay.salonAlanlar ?? []).map((v, i) => (
                                  <MiniNum key={`s${i}`} label={`Salon ${i + 1} (m²)`} value={v}
                                    onChange={(val) => detayDizi(kat.id, d.id, "salonAlanlar", i, val)} />
                                ))}
                                {(d.detay.odaAlanlar ?? []).map((v, i) => (
                                  <MiniNum key={`o${i}`} label={`Oda ${i + 1} (m²)`} value={v}
                                    onChange={(val) => detayDizi(kat.id, d.id, "odaAlanlar", i, val)} />
                                ))}
                              </div>
                              <div className="flex flex-wrap items-end gap-x-4 gap-y-2 border-t border-slate-200 pt-3">
                                <Toggle label="Mutfak var mı?" checked={d.detay.mutfakVar ?? false}
                                  onChange={(c) => detayBool(kat.id, d.id, "mutfakVar", c)} />
                                {d.detay.mutfakVar && (
                                  <MiniNum label="Mutfak (m²)" value={d.detay.mutfakAlan}
                                    onChange={(v) => detayNum(kat.id, d.id, "mutfakAlan", v)} />
                                )}
                                <Toggle label="Banyo var mı?" checked={d.detay.banyoVar ?? false}
                                  onChange={(c) => detayBool(kat.id, d.id, "banyoVar", c)} />
                                {d.detay.banyoVar && (
                                  <MiniNum label="Banyo (m²)" value={d.detay.banyoAlan}
                                    onChange={(v) => detayNum(kat.id, d.id, "banyoAlan", v)} />
                                )}
                                <Toggle label="WC var mı?" checked={d.detay.wcVar ?? false}
                                  onChange={(c) => detayBool(kat.id, d.id, "wcVar", c)} />
                                {d.detay.wcVar && (
                                  <MiniNum label="WC (m²)" value={d.detay.wcAlan}
                                    onChange={(v) => detayNum(kat.id, d.id, "wcAlan", v)} />
                                )}
                              </div>
                            </div>
                          )}

                          {/* ── Detaylı metraj girişi (açılır) ── */}
                          <button
                            onClick={() => setAcikDetay(acikDetay === d.id ? null : d.id)}
                            className="mt-3 w-full rounded-lg border border-brand-500/40 bg-brand-500/5 py-1.5 text-xs font-bold text-brand-600 transition hover:bg-brand-500/10"
                          >
                            {acikDetay === d.id ? "▴ Detayı kapat" : "▾ Bölüm Detayına Gir (metraj)"}
                          </button>
                          {acikDetay === d.id && (
                            <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
                              {/* Pencereler (elektrik/su/kazan dışındaki bölümler için) */}
                              {!["elektrik", "su", "kazan"].includes(d.tip) && (
                                <div className="mb-3 border-b border-slate-100 pb-3">
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs font-extrabold text-slate-700">Pencereler (doğrama + m²)</span>
                                    <button onClick={() => pencereEkle(kat.id, d.id)}
                                      className="rounded-lg bg-ink-900 px-2.5 py-1 text-[11px] font-bold text-white transition hover:bg-ink-800">
                                      + Pencere
                                    </button>
                                  </div>
                                  {(d.detay.pencereler ?? []).length === 0 ? (
                                    <p className="mt-1 text-[11px] text-slate-400">Henüz pencere eklenmedi.</p>
                                  ) : (
                                    <div className="mt-2 space-y-1.5">
                                      {(d.detay.pencereler ?? []).map((p, i) => (
                                        <div key={i} className="flex items-center gap-2">
                                          <span className="text-[11px] font-bold text-slate-400">{i + 1}.</span>
                                          <select value={p.tip} onChange={(e) => pencereGuncelle(kat.id, d.id, i, { tip: e.target.value })}
                                            className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs outline-none focus:border-brand-500">
                                            {DOGRAMA_TIPLERI.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                                          </select>
                                          <input type="number" step="0.1" min="0" placeholder="m²" value={p.alan ?? ""}
                                            onChange={(e) => pencereGuncelle(kat.id, d.id, i, { alan: e.target.value === "" ? undefined : parseFloat(e.target.value) })}
                                            className="w-20 rounded-lg border border-slate-200 px-2 py-1 text-xs outline-none focus:border-brand-500" />
                                          <button onClick={() => pencereSil(kat.id, d.id, i)}
                                            className="text-slate-300 transition hover:text-red-500">✕</button>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )}
                              {/* Pozdan metraj kalemleri */}
                              <div>
                                <span className="text-xs font-extrabold text-slate-700">Metraj Kalemleri (pozdan)</span>
                                <div className="relative mt-1.5">
                                  <input
                                    value={acikDetay === d.id ? daireAra : ""}
                                    onChange={(e) => setDaireAra(e.target.value)}
                                    onBlur={() => setTimeout(() => setDaireAra(""), 150)}
                                    placeholder="İmalat ara (ör: parke, seramik, kapı, alçı)…"
                                    className="w-full rounded-lg border-2 border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500"
                                  />
                                  {acikDetay === d.id && daireAra && daireEslesen.length > 0 && (
                                    <ul className="absolute z-30 mt-1 max-h-60 w-full overflow-auto rounded-xl border border-slate-200 bg-white shadow-xl">
                                      {daireEslesen.map((p) => (
                                        <li key={p.kod}>
                                          <button type="button" onMouseDown={(e) => e.preventDefault()}
                                            onClick={() => daireKalemEkle(kat.id, d.id, p)}
                                            className="flex w-full items-baseline gap-2 px-3 py-1.5 text-left text-xs transition hover:bg-brand-500/10">
                                            <span className="shrink-0 font-mono font-bold text-ink-800">{p.kod}</span>
                                            <span className="min-w-0 flex-1 truncate text-slate-600">{p.ad}</span>
                                            <span className="shrink-0 text-[10px] text-slate-400">{p.birim}</span>
                                          </button>
                                        </li>
                                      ))}
                                    </ul>
                                  )}
                                </div>

                                {(d.detay.pozKalemler ?? []).length > 0 && (
                                  <div className="mt-2 space-y-1.5">
                                    {(d.detay.pozKalemler ?? []).map((k) => (
                                      <div key={k.id} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50/60 px-2 py-1.5">
                                        <span className="shrink-0 font-mono text-[10px] font-bold text-ink-800">{k.pozKod}</span>
                                        <span className="min-w-0 flex-1 truncate text-xs text-slate-600" title={k.kalem}>{k.kalem}</span>
                                        <input type="number" min="0" step="0.01" placeholder="miktar" value={k.miktar ?? ""}
                                          onChange={(e) => daireKalemMiktar(kat.id, d.id, k.id, e.target.value)}
                                          className="w-20 rounded-lg border border-slate-200 px-2 py-0.5 text-right text-xs outline-none focus:border-brand-500" />
                                        <span className="shrink-0 text-[10px] text-slate-400">{k.birim}</span>
                                        <button onClick={() => daireKalemSil(kat.id, d.id, k.id)}
                                          className="shrink-0 text-slate-300 transition hover:text-red-500">✕</button>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
            <button onClick={katEkle}
              className="w-full rounded-xl border-2 border-dashed border-slate-300 py-2.5 text-sm font-bold text-slate-500 transition hover:border-brand-500 hover:text-brand-600">
              + Farklı tipte kat ekle
            </button>
          </section>

          {/* ═══ Bina Ana Kalem Bilgileri (pozdan) ═══ */}
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900">🧱 Bina Ana Kalem Bilgileri</h2>
            <p className="mt-1 text-sm text-slate-500">
              Kaba yapı, cephe, çatı, çevre kalemlerini <b>poz kütüphanesinden arayıp</b> ekleyin
              (ör: &quot;hazır beton&quot;, &quot;nervürlü&quot;, &quot;mantolama&quot;, &quot;kazı&quot;) ve miktarını girin.
              Her kalem poza bağlı olduğu için keşife doğrudan işlenir.
            </p>

            {/* Poz arama */}
            <div className="relative mt-4 max-w-xl">
              <input
                value={anaKalemAra}
                onChange={(e) => { setAnaKalemAra(e.target.value); setAnaKalemAcik(true); }}
                onFocus={() => anaKalemAra && setAnaKalemAcik(true)}
                onBlur={() => setTimeout(() => setAnaKalemAcik(false), 150)}
                placeholder="Ana kalem / imalat ara (poz adı veya no)…"
                className="w-full rounded-xl border-2 border-slate-200 px-4 py-2.5 text-sm outline-none transition focus:border-brand-500"
              />
              {anaKalemAcik && anaKalemEslesen.length > 0 && (
                <ul className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-xl border border-slate-200 bg-white shadow-xl">
                  {anaKalemEslesen.map((p) => (
                    <li key={p.kod}>
                      <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => anaKalemEklePoz(p)}
                        className="flex w-full items-baseline gap-2 px-3 py-2 text-left text-sm transition hover:bg-brand-500/10">
                        <span className="shrink-0 font-mono text-xs font-bold text-ink-800">{p.kod}</span>
                        <span className="min-w-0 flex-1 truncate text-slate-600">{p.ad}</span>
                        <span className="shrink-0 text-[10px] text-slate-400">{p.birim}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Tablo */}
            {(bina.anaKalemPoz ?? []).length === 0 ? (
              <p className="mt-4 text-xs text-slate-400">Henüz ana kalem eklenmedi.</p>
            ) : (
              <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full min-w-[640px] text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-left text-[11px] font-bold uppercase text-slate-500">
                      <th className="px-3 py-2">Poz No</th>
                      <th className="px-3 py-2">Kalem (pozdan)</th>
                      <th className="px-3 py-2">Birim</th>
                      <th className="px-3 py-2 text-right">Miktar</th>
                      <th className="px-2 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {(bina.anaKalemPoz ?? []).map((k) => (
                      <tr key={k.id} className="border-t border-slate-100">
                        <td className="px-3 py-1.5"><span className="font-mono text-xs font-bold text-ink-800">{k.pozKod}</span></td>
                        <td className="px-3 py-1.5"><div className="max-w-md truncate font-semibold text-slate-700" title={k.kalem}>{k.kalem}</div></td>
                        <td className="px-3 py-1.5 text-xs text-slate-500">{k.birim}</td>
                        <td className="px-3 py-1.5 text-right">
                          <input type="number" min="0" step="0.01" value={k.miktar ?? ""} placeholder="0"
                            onChange={(e) => anaKalemMiktar(k.id, e.target.value)}
                            className="w-28 rounded-lg border border-slate-200 px-2 py-1 text-right text-sm outline-none focus:border-brand-500" />
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          <button onClick={() => anaKalemSil(k.id)}
                            className="rounded-lg px-2 py-1 text-slate-300 transition hover:bg-red-50 hover:text-red-500">🗑</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Kat bazlı: kat m², perde m², hol */}
            <h3 className="mt-6 text-sm font-extrabold text-slate-700">Kat Bazlı Metrajlar</h3>
            <div className="mt-2 overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="bg-slate-50 text-left text-[11px] font-bold uppercase text-slate-500">
                    <th className="px-3 py-2">Kat</th>
                    <th className="px-3 py-2">Kat Alanı (m²)</th>
                    <th className="px-3 py-2">Perde (m²)</th>
                    <th className="px-3 py-2">Hol Malzeme</th>
                    <th className="px-3 py-2">Hol (m²)</th>
                  </tr>
                </thead>
                <tbody>
                  {katlar.map((kat) => (
                    <tr key={kat.id} className="border-t border-slate-100">
                      <td className="px-3 py-1.5 font-semibold text-slate-700">{kat.ad}</td>
                      <td className="px-3 py-1.5">
                        <input type="number" value={kat.katAlani ?? ""} onChange={(e) => setKat(kat.id, { katAlani: numOrU(e.target.value) })}
                          className="w-24 rounded-lg border border-slate-200 px-2 py-1 text-sm outline-none focus:border-brand-500" />
                      </td>
                      <td className="px-3 py-1.5">
                        <input type="number" value={kat.perdeAlani ?? ""} onChange={(e) => setKat(kat.id, { perdeAlani: numOrU(e.target.value) })}
                          className="w-24 rounded-lg border border-slate-200 px-2 py-1 text-sm outline-none focus:border-brand-500" />
                      </td>
                      <td className="px-3 py-1.5">
                        <select value={kat.holMalzeme ?? ""} onChange={(e) => setKat(kat.id, { holMalzeme: e.target.value || undefined })}
                          className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm outline-none focus:border-brand-500">
                          <option value="">—</option>
                          {HOL_MALZEME.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      </td>
                      <td className="px-3 py-1.5">
                        <input type="number" value={kat.holM2 ?? ""} onChange={(e) => setKat(kat.id, { holM2: numOrU(e.target.value) })}
                          className="w-24 rounded-lg border border-slate-200 px-2 py-1 text-sm outline-none focus:border-brand-500" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* ═══ Bina İşçilikleri ═══ */}
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900">👷 Bina İşçilikleri</h2>
            <p className="mt-1 text-sm text-slate-500">
              İşçilik kalemini <b>poz kütüphanesinden arayıp</b> seçin (ör: &quot;saten alçı&quot;,
              &quot;laminat parke&quot;); altta usta/taşeron ad-soyad, telefon ve tutar girin.
            </p>

            {/* Poz arama kutusu */}
            <div className="relative mt-4 max-w-xl">
              <input
                value={iscilikAra}
                onChange={(e) => { setIscilikAra(e.target.value); setIscilikAcik(true); }}
                onFocus={() => iscilikAra && setIscilikAcik(true)}
                onBlur={() => setTimeout(() => setIscilikAcik(false), 150)}
                placeholder="İşçilik / imalat ara (poz adı veya no)…"
                className="w-full rounded-xl border-2 border-slate-200 px-4 py-2.5 text-sm outline-none transition focus:border-brand-500"
              />
              {iscilikAcik && iscilikEslesen.length > 0 && (
                <ul className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-xl border border-slate-200 bg-white shadow-xl">
                  {iscilikEslesen.map((p) => (
                    <li key={p.kod}>
                      <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => iscilikEklePoz(p)}
                        className="flex w-full items-baseline gap-2 px-3 py-2 text-left text-sm transition hover:bg-brand-500/10">
                        <span className="shrink-0 font-mono text-xs font-bold text-ink-800">{p.kod}</span>
                        <span className="min-w-0 flex-1 truncate text-slate-600">{p.ad}</span>
                        <span className="shrink-0 text-[10px] text-slate-400">{p.birim}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Tablo */}
            {(bina.iscilikler ?? []).length === 0 ? (
              <p className="mt-4 text-xs text-slate-400">Henüz işçilik eklenmedi.</p>
            ) : (
              <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full min-w-[720px] text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-left text-[11px] font-bold uppercase text-slate-500">
                      <th className="px-3 py-2">Poz No</th>
                      <th className="px-3 py-2">İşçilik Kalemi (pozdan)</th>
                      <th className="px-3 py-2">Ad Soyad</th>
                      <th className="px-3 py-2">Telefon</th>
                      <th className="px-3 py-2 text-right">Tutar (₺)</th>
                      <th className="px-2 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {(bina.iscilikler ?? []).map((i) => (
                      <tr key={i.id} className="border-t border-slate-100">
                        <td className="px-3 py-1.5">
                          <span className="font-mono text-xs font-bold text-ink-800">{i.pozKod ?? "—"}</span>
                        </td>
                        <td className="px-3 py-1.5">
                          <div className="max-w-xs truncate font-semibold text-slate-700" title={i.kalem}>{i.kalem}</div>
                        </td>
                        <td className="px-3 py-1.5">
                          <input value={i.adSoyad ?? ""} placeholder="Ad Soyad"
                            onChange={(e) => iscilikGuncelle(i.id, { adSoyad: e.target.value })}
                            className="w-40 rounded-lg border border-slate-200 px-2 py-1 text-sm outline-none focus:border-brand-500" />
                        </td>
                        <td className="px-3 py-1.5">
                          <input value={i.telefon ?? ""} placeholder="05.." inputMode="tel"
                            onChange={(e) => iscilikGuncelle(i.id, { telefon: e.target.value })}
                            className="w-32 rounded-lg border border-slate-200 px-2 py-1 text-sm outline-none focus:border-brand-500" />
                        </td>
                        <td className="px-3 py-1.5 text-right">
                          <input type="number" min="0" value={i.tutar ?? ""} placeholder="0"
                            onChange={(e) => iscilikGuncelle(i.id, { tutar: e.target.value === "" ? undefined : parseFloat(e.target.value) })}
                            className="w-28 rounded-lg border border-slate-200 px-2 py-1 text-right text-sm outline-none focus:border-brand-500" />
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          <button onClick={() => iscilikSil(i.id)}
                            className="rounded-lg px-2 py-1 text-slate-300 transition hover:bg-red-50 hover:text-red-500">🗑</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-slate-200 bg-slate-50">
                      <td colSpan={4} className="px-3 py-2 text-right text-xs font-bold uppercase text-slate-500">Toplam İşçilik</td>
                      <td className="px-3 py-2 text-right font-extrabold text-ink-900">
                        {formatTL((bina.iscilikler ?? []).reduce((s, i) => s + (i.tutar || 0), 0))}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </section>

          <div className="flex items-center justify-between">
            <button onClick={() => setStep(1)}
              className="rounded-xl border-2 border-slate-200 px-6 py-3 text-sm font-bold text-slate-600 transition hover:border-slate-300">
              ← Geri
            </button>
            <button onClick={projeyiKaydet}
              className="rounded-xl bg-brand-500 px-7 py-3 text-sm font-bold text-white shadow-lg shadow-brand-500/25 transition hover:bg-brand-600">
              {editId ? "✓ Değişiklikleri Kaydet" : "✓ Projeyi Oluştur"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── küçük yardımcılar ── */
const inputCls =
  "w-full rounded-xl border-2 border-slate-200 px-4 py-2.5 text-sm outline-none transition focus:border-brand-500";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-slate-700">{label}</span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

function numOrU(v: string): number | undefined {
  return v === "" ? undefined : parseFloat(v);
}

/** Etiketli küçük sayı girişi. `full` grid içinde tam genişlik. */
function MiniNum({
  label, value, onChange, full = false,
}: {
  label: string;
  value: number | undefined;
  onChange: (v: string) => void;
  full?: boolean;
}) {
  return (
    <label className="text-[11px] font-semibold text-slate-500">
      {label}
      <input
        type="number"
        step="0.1"
        min="0"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className={`mt-0.5 block rounded-lg border border-slate-200 px-2 py-1 text-sm outline-none focus:border-brand-500 ${full ? "w-full" : "w-24"}`}
      />
    </label>
  );
}

/** "… var mı?" onay kutusu. */
function Toggle({
  label, checked, onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (c: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 accent-[var(--color-brand-500)]"
      />
      {label}
    </label>
  );
}

function arrayBufferToBase64(buf: ArrayBuffer): string {
  let binary = "";
  const bytes = new Uint8Array(buf);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}
