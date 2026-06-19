"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { YonetmelikKayit } from "@/lib/yonetmelik";
import { YONETMELIK } from "@/lib/yonetmelik";
import { loadBilgiler, bosBilgi, saveBilgi, deleteBilgi } from "@/lib/bilgiTabani";
import { dokumandanBilgiler } from "@/lib/dokumanMetni";

export default function BilgiTabaniPage() {
  const [liste, setListe] = useState<YonetmelikKayit[]>([]);
  const [form, setForm] = useState<YonetmelikKayit | null>(null);
  const [etiketMetni, setEtiketMetni] = useState("");
  const [dokYukleniyor, setDokYukleniyor] = useState(false);
  const [dokDurum, setDokDurum] = useState("");

  async function dokumanYukle(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setDokYukleniyor(true);
    setDokDurum(`"${f.name}" işleniyor…`);
    try {
      const kayitlar = await dokumandanBilgiler(f);
      for (const k of kayitlar) saveBilgi(k);
      setDokDurum(`✓ "${f.name}" eklendi — ${kayitlar.length} bölüm. mk_ai artık (çevrimdışı da) bu dökümandan yanıtlayabilir.`);
      yenile();
    } catch (err) {
      setDokDurum("⚠️ " + (err as Error).message);
    } finally {
      setDokYukleniyor(false);
    }
  }

  useEffect(() => { setListe(loadBilgiler()); }, []);

  function yenile() { setListe(loadBilgiler()); }

  function duzenle(k: YonetmelikKayit) {
    setForm({ ...k });
    setEtiketMetni(k.etiketler.join(", "));
  }
  function yeni() {
    setForm(bosBilgi());
    setEtiketMetni("");
  }
  function kaydet(e: React.FormEvent) {
    e.preventDefault();
    if (!form || !form.baslik.trim() || !form.metin.trim()) return;
    saveBilgi({ ...form, etiketler: etiketMetni.split(",").map((x) => x.trim()).filter(Boolean) });
    setForm(null);
    yenile();
  }
  function sil(id: string) {
    if (!confirm("Bu bilgi silinsin mi?")) return;
    deleteBilgi(id);
    if (form?.id === id) setForm(null);
    yenile();
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">📚 mk_ai Bilgi Tabanı</h1>
          <p className="mt-1 text-sm text-slate-500">
            Kendi yönetmelik, şartname, şirket kuralı ve teknik notlarınızı ekleyin; mk_ai
            sohbette bunları <b>yerleşik mevzuatla birlikte</b> arar ve kaynak göstererek yanıtlar.
          </p>
        </div>
        {!form && (
          <div className="flex flex-wrap gap-2">
            <label className={`cursor-pointer rounded-xl border-2 border-brand-500/50 px-5 py-2.5 text-sm font-bold text-brand-600 transition hover:bg-brand-50 ${dokYukleniyor ? "pointer-events-none opacity-60" : ""}`}>
              {dokYukleniyor ? "İşleniyor…" : "📄 Doküman Yükle"}
              <input type="file" accept=".pdf,.docx,.txt,.md,application/pdf,text/plain" onChange={dokumanYukle} disabled={dokYukleniyor} className="hidden" />
            </label>
            <button onClick={yeni} className="rounded-xl bg-brand-500 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-brand-600">
              + Bilgi Ekle
            </button>
          </div>
        )}
      </div>

      {dokDurum && (
        <p className={`mt-3 rounded-xl px-3 py-2 text-sm font-semibold ${dokDurum.startsWith("⚠️") ? "bg-red-50 text-red-600" : dokDurum.startsWith("✓") ? "bg-emerald-50 text-emerald-700" : "bg-sky-50 text-sky-700"}`}>
          {dokDurum}
        </p>
      )}
      <p className="mt-2 text-xs text-slate-400">
        PDF, Word (.docx), TXT veya MD yükleyin. Metin <b>cihazınızda</b> çıkarılır (dosya sunucuya gitmez), bölümlere ayrılıp bilgi tabanına eklenir; mk_ai çevrimdışı da bu dökümanlardan kaynak göstererek yanıtlar.
      </p>

      {/* Form */}
      {form && (
        <form onSubmit={kaydet} className="mt-5 rounded-2xl border-2 border-brand-500/40 bg-white p-5 shadow-md">
          <h2 className="text-base font-bold text-slate-900">{form.baslik ? "Bilgiyi Düzenle" : "Yeni Bilgi"}</h2>
          <label className="mt-3 block text-sm font-semibold text-slate-700">Başlık *
            <input value={form.baslik} onChange={(e) => setForm({ ...form, baslik: e.target.value })}
              placeholder="ör: Şirket beton döküm prosedürü"
              className="mt-1 w-full rounded-xl border-2 border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500" />
          </label>
          <label className="mt-3 block text-sm font-semibold text-slate-700">Kaynak / Dayanak
            <input value={form.kaynak} onChange={(e) => setForm({ ...form, kaynak: e.target.value })}
              placeholder="ör: Şirket içi talimat 2026 / TS xxx / sözleşme md.7"
              className="mt-1 w-full rounded-xl border-2 border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500" />
          </label>
          <label className="mt-3 block text-sm font-semibold text-slate-700">Anahtar Kelimeler (virgülle)
            <input value={etiketMetni} onChange={(e) => setEtiketMetni(e.target.value)}
              placeholder="beton, döküm, kür, kış şartı"
              className="mt-1 w-full rounded-xl border-2 border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500" />
            <span className="mt-0.5 block text-[11px] text-slate-400">Arama isabetini artırır; soru bu kelimeleri içerince bu kayıt öne çıkar.</span>
          </label>
          <label className="mt-3 block text-sm font-semibold text-slate-700">Bilgi Metni *
            <textarea value={form.metin} onChange={(e) => setForm({ ...form, metin: e.target.value })} rows={5}
              placeholder="mk_ai'nin cevaplarda kullanacağı bilginin tamamını buraya yazın…"
              className="mt-1 w-full rounded-xl border-2 border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500" />
          </label>
          <div className="mt-4 flex gap-2">
            <button type="submit" className="rounded-xl bg-ink-900 px-6 py-2.5 text-sm font-bold text-white transition hover:bg-ink-800">Kaydet</button>
            <button type="button" onClick={() => setForm(null)} className="rounded-xl border-2 border-slate-200 px-6 py-2.5 text-sm font-bold text-slate-600">Vazgeç</button>
          </div>
        </form>
      )}

      {/* Kullanıcı bilgileri */}
      <h2 className="mt-8 text-sm font-extrabold uppercase tracking-wide text-slate-500">Eklediğiniz Bilgiler ({liste.length})</h2>
      {liste.length === 0 ? (
        <div className="mt-3 rounded-2xl border-2 border-dashed border-slate-300 bg-white/60 p-8 text-center text-sm text-slate-500">
          Henüz bilgi eklemediniz. &quot;+ Bilgi Ekle&quot; ile başlayın; mk_ai anında kullanır.
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          {liste.map((k) => (
            <div key={k.id} className="rounded-2xl border border-sky-200 bg-[#f2f8fd] p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-slate-900">{k.baslik}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-slate-600">{k.metin}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600">📑 {k.kaynak}</span>
                    {k.etiketler.map((e) => (
                      <span key={e} className="rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-semibold text-sky-700">{e}</span>
                    ))}
                  </div>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button onClick={() => duzenle(k)} className="rounded-lg px-2 py-1 text-slate-400 transition hover:bg-slate-100" title="Düzenle">✎</button>
                  <button onClick={() => sil(k.id)} className="rounded-lg px-2 py-1 text-slate-300 transition hover:bg-red-50 hover:text-red-500">🗑</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Yerleşik mevzuat (salt okunur) */}
      <h2 className="mt-8 text-sm font-extrabold uppercase tracking-wide text-slate-500">Yerleşik Mevzuat ({YONETMELIK.length}) · salt okunur</h2>
      <p className="mt-1 text-xs text-slate-400">Bunlar mk_ai ile birlikte gelir; sizin eklediğiniz bilgilerle birlikte aranır.</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {YONETMELIK.map((k) => (
          <div key={k.id} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
            <div className="text-xs font-bold text-slate-700">{k.baslik}</div>
            <div className="mt-0.5 text-[11px] text-slate-400">📑 {k.kaynak}</div>
          </div>
        ))}
      </div>

      <div className="mt-8 text-sm">
        <Link href="/panel/mk-ai" className="font-semibold text-brand-600 transition hover:text-brand-700">→ mk_ai&apos;ye sor (eklediğin bilgiler kullanılır)</Link>
        <span className="mx-2 text-slate-300">·</span>
        <Link href="/panel" className="font-semibold text-slate-500 transition hover:text-ink-800">← Projelere dön</Link>
      </div>
    </div>
  );
}
