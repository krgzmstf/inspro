/* ──────────────────────────────────────────────────────────
   insPRO — Sohbet (sunucusuz relay)

   TASARIM: Mesajlar SUNUCUDA SAKLANMAZ. İletim Supabase Realtime
   "broadcast" ile yapılır (DB'ye yazılmaz). Her mesaj yalnız
   gönderen ve alıcının KENDİ CİHAZINDA (localStorage) durur.

   - Alma: kullanıcı kendi gelen kutusu kanalına (dm-<myId>) abone olur.
   - Gönderme: alıcının kanalına (dm-<peerId>) broadcast atılır.
   - Çevrimdışı: mesaj outbox'a alınır; internet dönünce iletilir.
   - Kişi rehberi: public.kisi_rehberi view'ından (sadece id+ad+firma).
   ────────────────────────────────────────────────────────── */

import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "./supabase/client";
import { aktifKullaniciId } from "./sb";
import { cevrimici } from "./senkronKuyruk";

export interface SohbetMesaj {
  id: string; from: string; to: string; ad: string; metin: string;
  ts: number; benim: boolean; durum: "bekliyor" | "gonderildi";
}
export interface Kisi { id: string; ad: string; firma?: string | null }

const SOHBET_KEY = "inspro-sohbet";        // { [peerId]: SohbetMesaj[] }
const OUTBOX_KEY = "inspro-sohbet-outbox"; // SohbetMesaj[]
const KISI_KEY = "inspro-sohbet-kisiler";  // Kisi[] (önbellek)
const OKUNAN_KEY = "inspro-sohbet-okunan"; // { [peerId]: ts (son okunan) }

type Konusmalar = Record<string, SohbetMesaj[]>;

function jOku<T>(key: string, vars: T): T {
  if (typeof window === "undefined") return vars;
  try { const s = localStorage.getItem(key); return s ? (JSON.parse(s) as T) : vars; }
  catch { return vars; }
}
function jYaz(key: string, v: unknown) {
  try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* yok say */ }
}

// ── Yerel konuşma depolama ──
function tumKonusmalar(): Konusmalar { return jOku<Konusmalar>(SOHBET_KEY, {}); }
export function konusma(peerId: string): SohbetMesaj[] {
  return (tumKonusmalar()[peerId] ?? []).sort((a, b) => a.ts - b.ts);
}
function ekle(peerId: string, m: SohbetMesaj) {
  const k = tumKonusmalar();
  const dizi = k[peerId] ?? [];
  if (dizi.some((x) => x.id === m.id)) return; // çift kayıt önle
  k[peerId] = [...dizi, m];
  jYaz(SOHBET_KEY, k);
  bildir();
}
function durumGuncelle(peerId: string, id: string, durum: SohbetMesaj["durum"]) {
  const k = tumKonusmalar();
  const dizi = k[peerId]; if (!dizi) return;
  const i = dizi.findIndex((x) => x.id === id); if (i < 0) return;
  dizi[i] = { ...dizi[i], durum }; jYaz(SOHBET_KEY, k); bildir();
}

/** Konuşma listesi (kişi başına son mesaj + okunmamış sayısı). */
export function konusmaOzetleri(): { peerId: string; ad: string; son?: SohbetMesaj; okunmamis: number }[] {
  const k = tumKonusmalar();
  const okunan = jOku<Record<string, number>>(OKUNAN_KEY, {});
  return Object.entries(k).map(([peerId, dizi]) => {
    const sirali = [...dizi].sort((a, b) => a.ts - b.ts);
    const son = sirali[sirali.length - 1];
    const okunmamis = sirali.filter((m) => !m.benim && m.ts > (okunan[peerId] ?? 0)).length;
    return { peerId, ad: son?.ad || "Kullanıcı", son, okunmamis };
  }).sort((a, b) => (b.son?.ts ?? 0) - (a.son?.ts ?? 0));
}
export function okunduIsaretle(peerId: string) {
  const okunan = jOku<Record<string, number>>(OKUNAN_KEY, {});
  okunan[peerId] = Date.now(); jYaz(OKUNAN_KEY, okunan); bildir();
}

// ── Abonelik (UI'ı yenilemek için) ──
const aboneler = new Set<() => void>();
function bildir() { aboneler.forEach((f) => f()); }
export function sohbetAbone(f: () => void): () => void { aboneler.add(f); return () => aboneler.delete(f); }

// ── Kişi rehberi ──
export async function kisileriGetir(): Promise<Kisi[]> {
  const c = supabase(); const uid = await aktifKullaniciId();
  if (c && uid && cevrimici()) {
    try {
      const { data, error } = await c.from("kisi_rehberi").select("id, ad, firma");
      if (!error && Array.isArray(data)) {
        const liste = (data as Kisi[]).filter((k) => k.id !== uid);
        jYaz(KISI_KEY, liste);
        return liste;
      }
    } catch { /* offline → önbellek */ }
  }
  return jOku<Kisi[]>(KISI_KEY, []);
}

// ── Benim görünen adım (profil önbelleğinden) ──
function benimAd(): string {
  const p = jOku<{ ad_soyad?: string; email?: string } | null>("inspro-profil-cache", null);
  return p?.ad_soyad?.trim() || p?.email || "Kullanıcı";
}

// ── Realtime kanalları ──
let gelenKutusu: RealtimeChannel | null = null;
const gidenKanallar = new Map<string, RealtimeChannel>();

async function gidenKanal(peerId: string): Promise<RealtimeChannel | null> {
  const c = supabase(); if (!c) return null;
  let ch = gidenKanallar.get(peerId);
  if (ch) return ch;
  ch = c.channel(`dm-${peerId}`);
  await new Promise<void>((res) => {
    ch!.subscribe((s) => { if (s === "SUBSCRIBED") res(); });
    setTimeout(res, 4000); // güvenlik zaman aşımı
  });
  gidenKanallar.set(peerId, ch);
  return ch;
}

async function ilet(m: SohbetMesaj): Promise<boolean> {
  if (!cevrimici()) { outboxEkle(m); return false; }
  try {
    const ch = await gidenKanal(m.to);
    if (!ch) { outboxEkle(m); return false; }
    const sonuc = await ch.send({
      type: "broadcast", event: "mesaj",
      payload: { id: m.id, from: m.from, ad: m.ad, metin: m.metin, ts: m.ts },
    });
    if (sonuc === "ok") { durumGuncelle(m.to, m.id, "gonderildi"); outboxCikar(m.id); return true; }
    outboxEkle(m); return false;
  } catch { outboxEkle(m); return false; }
}

/** Mesaj gönder (yerel kaydet + ilet/kuyrukla). */
export async function gonder(peerId: string, metin: string): Promise<void> {
  const uid = await aktifKullaniciId();
  if (!uid || !metin.trim()) return;
  const m: SohbetMesaj = {
    id: crypto.randomUUID(), from: uid, to: peerId, ad: benimAd(),
    metin: metin.trim(), ts: Date.now(), benim: true, durum: "bekliyor",
  };
  ekle(peerId, m);
  await ilet(m);
}

// ── Outbox (bekleyen gönderiler) ──
function outboxEkle(m: SohbetMesaj) {
  const o = jOku<SohbetMesaj[]>(OUTBOX_KEY, []);
  if (!o.some((x) => x.id === m.id)) { o.push(m); jYaz(OUTBOX_KEY, o); }
}
function outboxCikar(id: string) {
  jYaz(OUTBOX_KEY, jOku<SohbetMesaj[]>(OUTBOX_KEY, []).filter((x) => x.id !== id));
}
async function outboxBosalt() {
  if (!cevrimici()) return;
  for (const m of jOku<SohbetMesaj[]>(OUTBOX_KEY, [])) await ilet(m);
}

/** Sohbeti başlat: gelen kutusuna abone ol + outbox'ı boşalt. */
export async function sohbetBaslat(): Promise<() => void> {
  const c = supabase(); const uid = await aktifKullaniciId();
  if (!c || !uid) return () => {};
  gelenKutusu = c.channel(`dm-${uid}`, { config: { broadcast: { self: false } } });
  gelenKutusu.on("broadcast", { event: "mesaj" }, ({ payload }) => {
    const p = payload as { id: string; from: string; ad: string; metin: string; ts: number };
    ekle(p.from, { id: p.id, from: p.from, to: uid, ad: p.ad, metin: p.metin, ts: p.ts, benim: false, durum: "gonderildi" });
  });
  gelenKutusu.subscribe();
  const online = () => void outboxBosalt();
  window.addEventListener("online", online);
  void outboxBosalt();
  return () => {
    window.removeEventListener("online", online);
    if (gelenKutusu) c.removeChannel(gelenKutusu);
    gidenKanallar.forEach((ch) => c.removeChannel(ch));
    gidenKanallar.clear(); gelenKutusu = null;
  };
}

/** Bekleyen (okunmamış) toplam — menü rozeti için. */
export function okunmamisToplam(): number {
  return konusmaOzetleri().reduce((s, k) => s + k.okunmamis, 0);
}
