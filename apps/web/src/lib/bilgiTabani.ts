/* ──────────────────────────────────────────────────────────
   insPRO — Kullanıcı Bilgi Tabanı (mk_ai özel hafıza)

   Kullanıcının eklediği yönetmelik / şartname / şirket kuralı /
   teknik not kayıtları. mk_ai sohbeti (danış ucu) bu kayıtları
   yerleşik mevzuatla BİRLİKTE arar → kullanıcının verdiği bilgiler
   anında cevaplara yansır.

   Kayıt biçimi yerleşik mevzuatla aynıdır (YonetmelikKayit).
   Geçici: localStorage. Supabase'e geçişte tek bu katman döner.
   ────────────────────────────────────────────────────────── */

import type { YonetmelikKayit } from "./yonetmelik";

const STORAGE_KEY = "inspro-bilgi-tabani";

export function loadBilgiler(): YonetmelikKayit[] {
  if (typeof window === "undefined") return [];
  try {
    const list: YonetmelikKayit[] = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function saveAll(list: YonetmelikKayit[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  void import("./genelSenkron").then((m) => m.modulYaz("bilgi-tabani"));
}

export function bosBilgi(): YonetmelikKayit {
  return { id: crypto.randomUUID(), baslik: "", kaynak: "", etiketler: [], metin: "" };
}

export function saveBilgi(k: YonetmelikKayit) {
  const temiz: YonetmelikKayit = {
    ...k,
    baslik: k.baslik.trim(),
    kaynak: k.kaynak.trim() || "Kullanıcı bilgisi",
    etiketler: k.etiketler.map((e) => e.trim()).filter(Boolean),
    metin: k.metin.trim(),
  };
  const list = loadBilgiler();
  const i = list.findIndex((x) => x.id === temiz.id);
  if (i >= 0) list[i] = temiz; else list.push(temiz);
  saveAll(list);
}

export function deleteBilgi(id: string) {
  saveAll(loadBilgiler().filter((k) => k.id !== id));
}
