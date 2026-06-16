/* ──────────────────────────────────────────────────────────
   insPRO — Kendi backend API istemcisi (FastAPI)

   Supabase yerine kendi backend'imize (FastAPI) bağlanır.
   Adres NEXT_PUBLIC_API_URL'den; JWT token localStorage'da.
   ────────────────────────────────────────────────────────── */

export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4400";
const TKEY = "inspro-token";

export function apiVar(): boolean {
  return !!API_URL;
}

export function tokenAl(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TKEY);
}
export function tokenSet(t: string) {
  localStorage.setItem(TKEY, t);
}
export function tokenSil() {
  localStorage.removeItem(TKEY);
}

async function istek<T = unknown>(method: string, yol: string, govde?: unknown): Promise<T> {
  const h: Record<string, string> = {};
  const t = tokenAl();
  if (t) h["Authorization"] = "Bearer " + t;
  if (govde !== undefined) h["Content-Type"] = "application/json";
  const res = await fetch(API_URL + yol, {
    method,
    headers: h,
    body: govde !== undefined ? JSON.stringify(govde) : undefined,
  });
  if (!res.ok) {
    let mesaj = "İstek başarısız.";
    try {
      const j = await res.json();
      mesaj = (j.detail ?? j.error ?? mesaj) as string;
      if (typeof mesaj !== "string") mesaj = JSON.stringify(mesaj);
    } catch { /* gövde yok */ }
    throw new Error(mesaj);
  }
  if (res.status === 204) return null as T;
  return res.json() as Promise<T>;
}

export const apiGet = <T = unknown>(yol: string) => istek<T>("GET", yol);
export const apiPost = <T = unknown>(yol: string, govde?: unknown) => istek<T>("POST", yol, govde);
export const apiPut = <T = unknown>(yol: string, govde?: unknown) => istek<T>("PUT", yol, govde);
export const apiDelete = <T = unknown>(yol: string) => istek<T>("DELETE", yol);

/** Oturum açık mı (token var mı)? */
export function oturumVar(): boolean {
  return !!tokenAl();
}
