"use client";

import type { AylikFinans } from "@/lib/yonetimApi";

/** Küçük dönen yükleniyor göstergesi. */
export function Spinner({ etiket }: { etiket?: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-slate-500">
      <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-brand-500" />
      {etiket ?? "Yükleniyor…"}
    </div>
  );
}

export interface DilimVeri { etiket: string; deger: number; renk: string }

/** Conic-gradient tabanlı donut grafik (harici kütüphane yok). */
export function Donut({ veri, baslik }: { veri: DilimVeri[]; baslik?: string }) {
  const toplam = veri.reduce((a, d) => a + d.deger, 0);
  let aci = 0;
  const parcalar = veri.map((d) => {
    const bas = aci;
    const yuzde = toplam > 0 ? (d.deger / toplam) * 100 : 0;
    aci += yuzde;
    return `${d.renk} ${bas}% ${aci}%`;
  });
  const gradient = toplam > 0 ? `conic-gradient(${parcalar.join(", ")})` : "conic-gradient(#e2e8f0 0% 100%)";

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      {baslik && <div className="text-[11px] font-bold text-slate-500">{baslik}</div>}
      <div className="mt-3 flex items-center gap-5">
        <div className="relative h-28 w-28 shrink-0 rounded-full" style={{ background: gradient }}>
          <div className="absolute inset-[18%] flex flex-col items-center justify-center rounded-full bg-white">
            <span className="text-xl font-extrabold text-ink-900">{toplam}</span>
            <span className="text-[10px] text-slate-400">toplam</span>
          </div>
        </div>
        <div className="space-y-1.5">
          {veri.map((d) => (
            <div key={d.etiket} className="flex items-center gap-2 text-xs">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: d.renk }} />
              <span className="font-semibold text-slate-600">{d.etiket}</span>
              <span className="font-bold text-slate-800">{d.deger}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Aylık gelir/gider gruplu çubuk grafik. */
export function AylikFinansGrafik({ veri }: { veri: AylikFinans[] }) {
  const enYuksek = Math.max(1, ...veri.flatMap((v) => [v.gelir, v.gider]));
  const ayKisa = (a: string) => {
    const [, m] = a.split("-");
    return ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"][Number(m) - 1] ?? a;
  };
  const bicim = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(0)}k` : `${n}`;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="text-[11px] font-bold text-slate-500">SON 6 AY · GELİR / GİDER (₺)</div>
        <div className="flex items-center gap-3 text-[10px] font-semibold">
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-emerald-500" />Gelir</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-rose-500" />Gider</span>
        </div>
      </div>
      <div className="mt-4 flex h-40 items-end justify-between gap-2">
        {veri.map((v) => (
          <div key={v.ay} className="flex flex-1 flex-col items-center gap-1">
            <div className="flex h-32 w-full items-end justify-center gap-1">
              <div className="w-1/2 rounded-t bg-emerald-500 transition-all" style={{ height: `${(v.gelir / enYuksek) * 100}%` }} title={`Gelir: ${v.gelir} ₺`} />
              <div className="w-1/2 rounded-t bg-rose-500 transition-all" style={{ height: `${(v.gider / enYuksek) * 100}%` }} title={`Gider: ${v.gider} ₺`} />
            </div>
            <span className="text-[10px] font-semibold text-slate-500">{ayKisa(v.ay)}</span>
          </div>
        ))}
      </div>
      <div className="mt-1 text-right text-[10px] text-slate-400">en yüksek: {bicim(enYuksek)} ₺</div>
    </div>
  );
}

/** Yatay oranlı çubuk listesi (proje tipi vb.). */
export function YatayBarlar({ veri, baslik }: { veri: DilimVeri[]; baslik?: string }) {
  const toplam = Math.max(1, veri.reduce((a, d) => a + d.deger, 0));
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      {baslik && <div className="text-[11px] font-bold text-slate-500">{baslik}</div>}
      <div className="mt-3 space-y-2">
        {veri.map((d) => (
          <div key={d.etiket} className="flex items-center gap-2">
            <span className="w-20 shrink-0 text-xs font-semibold text-slate-600">{d.etiket}</span>
            <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full transition-all" style={{ width: `${(d.deger / toplam) * 100}%`, background: d.renk }} />
            </div>
            <span className="w-7 shrink-0 text-right text-xs font-bold text-slate-700">{d.deger}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
