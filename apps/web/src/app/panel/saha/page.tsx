"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { type Project, loadProjects, getProject } from "@/lib/projects";
import {
  type SahaKaydi,
  type SahaTip,
  type SahaOncelik,
  type SahaDurum,
  SAHA_TIP,
  SAHA_ONCELIK,
  SAHA_DURUM,
  IMALAT_KATEGORILERI,
  loadSaha,
  addSaha,
  updateSaha,
  addYorum,
  deleteSaha,
  fotoKucult,
} from "@/lib/saha";

const DURUM_DONGU: SahaDurum[] = ["acik", "devam", "tamam"];

export default function SahaPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState("");
  const [kayitlar, setKayitlar] = useState<SahaKaydi[]>([]);
  const [katlar, setKatlar] = useState<string[]>([]);

  // filtreler
  const [fTip, setFTip] = useState<"hepsi" | SahaTip>("hepsi");
  const [fDurum, setFDurum] = useState<"hepsi" | SahaDurum>("hepsi");

  // form
  const [tip, setTip] = useState<SahaTip>("ilerleme");
  const [baslik, setBaslik] = useState("");
  const [kat, setKat] = useState("Genel");
  const [imalat, setImalat] = useState("Genel");
  const [oncelik, setOncelik] = useState<SahaOncelik>("orta");
  const [sorumlu, setSorumlu] = useState("");
  const [termin, setTermin] = useState("");
  const [aciklama, setAciklama] = useState("");
  const [kisi, setKisi] = useState("");
  const [fotograflar, setFotograflar] = useState<string[]>([]);
  const [fotoBusy, setFotoBusy] = useState(false);
  const [error, setError] = useState("");
  const [formAcik, setFormAcik] = useState(false);

  // yorum
  const [acikYorum, setAcikYorum] = useState<string | null>(null);
  const [yorumMetin, setYorumMetin] = useState("");

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
    setKayitlar(loadSaha(id));
    const p = getProject(id);
    setKatlar(["Genel", ...(p?.katlar ?? []).map((k) => k.ad)]);
  }

  async function handleFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setFotoBusy(true);
    try {
      const yeni = await Promise.all(files.map((f) => fotoKucult(f)));
      setFotograflar((g) => [...g, ...yeni].slice(0, 6));
    } catch {
      setError("Fotoğraf işlenemedi.");
    } finally {
      setFotoBusy(false);
      e.target.value = "";
    }
  }

  function temizle() {
    setBaslik(""); setAciklama(""); setSorumlu(""); setTermin(""); setFotograflar([]);
    setOncelik("orta"); setImalat("Genel"); setKat("Genel");
  }

  function handleEkle(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!projectId) return setError("Önce bir proje seçin.");
    if (!baslik.trim()) return setError("Başlık girin.");
    addSaha({
      projectId, tip, baslik: baslik.trim(), aciklama: aciklama.trim(),
      kat, imalat, oncelik, sorumlu: sorumlu.trim(), termin,
      durum: "acik", fotograflar, kisi: kisi.trim() || "Saha",
    });
    setKayitlar(loadSaha(projectId));
    temizle();
    setFormAcik(false);
  }

  function durumIlerlet(k: SahaKaydi) {
    const i = DURUM_DONGU.indexOf(k.durum);
    updateSaha(k.id, { durum: DURUM_DONGU[(i + 1) % DURUM_DONGU.length] });
    setKayitlar(loadSaha(projectId));
  }
  function durumAyarla(id: string, durum: SahaDurum) {
    updateSaha(id, { durum });
    setKayitlar(loadSaha(projectId));
  }
  function sil(id: string) {
    if (!confirm("Kayıt silinsin mi?")) return;
    deleteSaha(id);
    setKayitlar(loadSaha(projectId));
  }
  function yorumEkle(id: string) {
    if (!yorumMetin.trim()) return;
    addYorum(id, kisi.trim() || "Kullanıcı", yorumMetin.trim());
    setYorumMetin("");
    setKayitlar(loadSaha(projectId));
  }

  const bugun = new Date().toISOString().slice(0, 10);
  const gosterilen = useMemo(() => kayitlar.filter((k) =>
    (fTip === "hepsi" || k.tip === fTip) && (fDurum === "hepsi" || k.durum === fDurum),
  ), [kayitlar, fTip, fDurum]);

  const ozet = useMemo(() => ({
    toplam: kayitlar.length,
    acikIsEmri: kayitlar.filter((k) => k.tip === "isemri" && k.durum !== "tamam").length,
    acikKusur: kayitlar.filter((k) => k.tip === "kusur" && k.durum !== "tamam").length,
    geciken: kayitlar.filter((k) => k.termin && k.termin < bugun && k.durum !== "tamam").length,
  }), [kayitlar, bugun]);

  if (projects.length === 0) {
    return (
      <div className="mx-auto max-w-6xl">
        <h1 className="text-2xl font-extrabold text-slate-900">📸 Saha Takibi</h1>
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
          <h1 className="text-2xl font-extrabold text-slate-900">📸 Saha Takibi</h1>
          <p className="mt-1 text-sm text-slate-500">İş emri, kusur, ilerleme ve malzeme talepleri · fotoğraf, atama, termin, yorum.</p>
        </div>
        <select value={projectId} onChange={(e) => seçProje(e.target.value)}
          className="rounded-xl border-2 border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold outline-none focus:border-brand-500">
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      {/* Özet */}
      <div className="mt-6 grid gap-4 sm:grid-cols-4">
        {[
          ["Toplam Kayıt", ozet.toplam, "📸", false],
          ["Açık İş Emri", ozet.acikIsEmri, "📋", false],
          ["Açık Kusur", ozet.acikKusur, "⚠️", ozet.acikKusur > 0],
          ["Geciken (termin)", ozet.geciken, "⏰", ozet.geciken > 0],
        ].map(([l, v, i, kirmizi]) => (
          <div key={l as string} className={`flex items-center gap-3 rounded-2xl border p-4 shadow-sm ${kirmizi ? "border-red-200 bg-red-50" : "border-slate-200 bg-white"}`}>
            <div className="text-xl">{i as string}</div>
            <div>
              <div className="text-[10px] font-semibold uppercase text-slate-500">{l as string}</div>
              <div className={`text-xl font-extrabold ${kirmizi ? "text-red-600" : "text-slate-900"}`}>{v as number}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Yeni kayıt aç/kapa */}
      <div className="mt-6">
        {!formAcik ? (
          <button onClick={() => setFormAcik(true)} className="rounded-xl bg-brand-500 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-brand-600">+ Yeni Saha Kaydı</button>
        ) : (
          <form onSubmit={handleEkle} className="rounded-2xl border-2 border-brand-500/40 bg-white p-5 shadow-md">
            {/* Tip seçimi */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {(Object.keys(SAHA_TIP) as SahaTip[]).map((t) => (
                <button key={t} type="button" onClick={() => setTip(t)}
                  className={`rounded-xl border-2 py-2 text-xs font-bold transition ${tip === t ? "border-brand-500 bg-brand-500/10 text-brand-600" : "border-slate-200 text-slate-500"}`}>
                  {SAHA_TIP[t].icon} {SAHA_TIP[t].label}
                </button>
              ))}
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <L label="Başlık *"><input value={baslik} onChange={(e) => setBaslik(e.target.value)} placeholder="ör: 3. kat kolon demiri tamam" className={inp} /></L>
              <L label="Kat / Bölüm"><select value={kat} onChange={(e) => setKat(e.target.value)} className={inp}>{katlar.map((k) => <option key={k}>{k}</option>)}</select></L>
              <L label="İmalat"><select value={imalat} onChange={(e) => setImalat(e.target.value)} className={inp}>{IMALAT_KATEGORILERI.map((k) => <option key={k}>{k}</option>)}</select></L>
              <L label="Öncelik"><select value={oncelik} onChange={(e) => setOncelik(e.target.value as SahaOncelik)} className={inp}>{(Object.keys(SAHA_ONCELIK) as SahaOncelik[]).map((o) => <option key={o} value={o}>{SAHA_ONCELIK[o].label}</option>)}</select></L>
              <L label="Sorumlu"><input value={sorumlu} onChange={(e) => setSorumlu(e.target.value)} placeholder="atanan kişi" className={inp} /></L>
              {(tip === "isemri" || tip === "kusur") && (
                <L label="Termin (bitiş)"><input type="date" value={termin} onChange={(e) => setTermin(e.target.value)} className={inp} /></L>
              )}
              <L label="Kaydı Giren"><input value={kisi} onChange={(e) => setKisi(e.target.value)} placeholder="ör: M. Yılmaz" className={inp} /></L>
            </div>
            <L label="Açıklama"><textarea value={aciklama} onChange={(e) => setAciklama(e.target.value)} rows={2} className={inp} /></L>
            <div className="mt-3">
              <label className="cursor-pointer rounded-xl bg-ink-900 px-4 py-2 text-sm font-bold text-white transition hover:bg-ink-800">
                {fotoBusy ? "İşleniyor…" : "📷 Fotoğraf Ekle (çoklu)"}
                <input type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={handleFoto} />
              </label>
              {fotograflar.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {fotograflar.map((f, i) => (
                    <div key={i} className="relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={f} alt="" className="h-20 w-20 rounded-lg object-cover" />
                      <button type="button" onClick={() => setFotograflar((g) => g.filter((_, j) => j !== i))}
                        className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] text-white">✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-600">{error}</p>}
            <div className="mt-4 flex gap-2">
              <button type="submit" className="rounded-xl bg-brand-500 px-6 py-2.5 text-sm font-bold text-white transition hover:bg-brand-600">Kaydı Ekle</button>
              <button type="button" onClick={() => { setFormAcik(false); temizle(); }} className="rounded-xl border-2 border-slate-200 px-6 py-2.5 text-sm font-bold text-slate-600">Vazgeç</button>
            </div>
          </form>
        )}
      </div>

      {/* Filtreler */}
      <div className="mt-6 flex flex-wrap items-center gap-2">
        <span className="text-xs font-bold text-slate-400">TÜR:</span>
        <FiltreBtn aktif={fTip === "hepsi"} onClick={() => setFTip("hepsi")}>Tümü</FiltreBtn>
        {(Object.keys(SAHA_TIP) as SahaTip[]).map((t) => (
          <FiltreBtn key={t} aktif={fTip === t} onClick={() => setFTip(t)}>{SAHA_TIP[t].icon} {SAHA_TIP[t].label}</FiltreBtn>
        ))}
        <span className="ml-3 text-xs font-bold text-slate-400">DURUM:</span>
        <FiltreBtn aktif={fDurum === "hepsi"} onClick={() => setFDurum("hepsi")}>Tümü</FiltreBtn>
        {(Object.keys(SAHA_DURUM) as SahaDurum[]).map((d) => (
          <FiltreBtn key={d} aktif={fDurum === d} onClick={() => setFDurum(d)}>{SAHA_DURUM[d].label}</FiltreBtn>
        ))}
      </div>

      {/* Kayıtlar */}
      {gosterilen.length === 0 ? (
        <div className="mt-4 rounded-2xl border-2 border-dashed border-slate-300 bg-white/60 p-10 text-center text-sm text-slate-500">Kayıt yok.</div>
      ) : (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {gosterilen.map((k) => {
            const gecikti = k.termin && k.termin < bugun && k.durum !== "tamam";
            return (
              <div key={k.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                {k.fotograflar.length > 0 && (
                  <div className="flex gap-0.5 overflow-x-auto bg-slate-100">
                    {k.fotograflar.map((f, i) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={i} src={f} alt="" className="h-36 w-auto object-cover" />
                    ))}
                  </div>
                )}
                <div className="p-4">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${SAHA_TIP[k.tip].renk}`}>{SAHA_TIP[k.tip].icon} {SAHA_TIP[k.tip].label}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${SAHA_ONCELIK[k.oncelik].renk}`}>{SAHA_ONCELIK[k.oncelik].label}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${SAHA_DURUM[k.durum].renk}`}>{SAHA_DURUM[k.durum].label}</span>
                    {gecikti && <span className="rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold text-white">⏰ Gecikti</span>}
                  </div>
                  <h3 className="mt-2 font-bold text-slate-900">{k.baslik}</h3>
                  <div className="mt-0.5 text-xs text-slate-500">
                    {k.kat} · {k.imalat}{k.sorumlu && <> · 👤 {k.sorumlu}</>}{k.termin && <> · 🎯 {k.termin}</>}
                  </div>
                  {k.aciklama && <p className="mt-2 text-sm text-slate-600">{k.aciklama}</p>}
                  <div className="mt-1 text-[10px] text-slate-400">{k.kisi} · {new Date(k.tarih).toLocaleString("tr-TR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</div>

                  {/* Aksiyonlar */}
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button onClick={() => durumIlerlet(k)} className="rounded-lg bg-ink-900 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-ink-800">Durum ▸</button>
                    <select value={k.durum} onChange={(e) => durumAyarla(k.id, e.target.value as SahaDurum)} className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs outline-none focus:border-brand-500">
                      {(Object.keys(SAHA_DURUM) as SahaDurum[]).map((d) => <option key={d} value={d}>{SAHA_DURUM[d].label}</option>)}
                    </select>
                    <button onClick={() => setAcikYorum(acikYorum === k.id ? null : k.id)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-brand-500">💬 {k.yorumlar.length}</button>
                    <button onClick={() => sil(k.id)} className="ml-auto rounded-lg border border-slate-200 px-2 py-1.5 text-xs text-slate-400 transition hover:border-red-300 hover:text-red-500">🗑</button>
                  </div>

                  {/* Yorum akışı */}
                  {acikYorum === k.id && (
                    <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                      {k.yorumlar.length === 0 ? (
                        <p className="text-xs text-slate-400">Henüz yorum yok.</p>
                      ) : (
                        <div className="space-y-2">
                          {k.yorumlar.map((y) => (
                            <div key={y.id} className="text-xs">
                              <b className="text-slate-700">{y.kisi}</b>
                              <span className="ml-1 text-slate-400">{new Date(y.tarih).toLocaleString("tr-TR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                              <p className="text-slate-600">{y.metin}</p>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="mt-2 flex gap-2">
                        <input value={yorumMetin} onChange={(e) => setYorumMetin(e.target.value)} placeholder="Yorum yaz…"
                          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); yorumEkle(k.id); } }}
                          className="flex-1 rounded-lg border border-slate-200 px-2 py-1 text-xs outline-none focus:border-brand-500" />
                        <button onClick={() => yorumEkle(k.id)} className="rounded-lg bg-brand-500 px-3 py-1 text-xs font-bold text-white">Gönder</button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-8 text-sm">
        <Link href="/panel" className="font-semibold text-slate-500 transition hover:text-ink-800">← Projelere dön</Link>
      </div>
    </div>
  );
}

const inp = "w-full rounded-xl border-2 border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-brand-500";
function L({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="mt-3 block"><span className="text-xs font-semibold text-slate-600">{label}</span><div className="mt-1">{children}</div></label>;
}
function FiltreBtn({ aktif, onClick, children }: { aktif: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`rounded-full border-2 px-3 py-1 text-xs font-bold transition ${aktif ? "border-brand-500 bg-brand-500/10 text-brand-600" : "border-slate-200 text-slate-500"}`}>{children}</button>
  );
}
