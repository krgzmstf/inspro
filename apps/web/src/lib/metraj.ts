/* ──────────────────────────────────────────────────────────
   insPRO — Metraj veri katmanı (geçici: localStorage)
   Supabase'e geçişte yalnızca bu dosya API çağrılarına
   dönüştürülecek.
   ────────────────────────────────────────────────────────── */

export interface MetrajItem {
  id: string;
  projectId: string;
  pozKod: string;
  mahal: string; // ör: "Zemin Kat", "A Blok Cephe", "Daire 5 Banyo"
  miktar: number;
  createdAt: string;
}

const STORAGE_KEY = "inspro-metraj";

function loadAll(): MetrajItem[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveAll(items: MetrajItem[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export function loadMetraj(projectId: string): MetrajItem[] {
  return loadAll().filter((m) => m.projectId === projectId);
}

export function addMetrajItem(
  data: Omit<MetrajItem, "id" | "createdAt">,
): MetrajItem {
  const item: MetrajItem = {
    ...data,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };
  saveAll([...loadAll(), item]);
  return item;
}

export function updateMetrajMiktar(id: string, miktar: number) {
  saveAll(loadAll().map((m) => (m.id === id ? { ...m, miktar } : m)));
}

export function deleteMetrajItem(id: string) {
  saveAll(loadAll().filter((m) => m.id !== id));
}
