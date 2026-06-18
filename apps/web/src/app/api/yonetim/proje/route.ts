import { adminDogrula, yanit } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * Süper admin tek proje inceleme/düzenleme.
 * Projeler modul_veri (modul='projects') tablosunda her sahibin altında
 * JSONB dizi olarak tutulur. service_role ile sahibinin kaydı okunur/güncellenir.
 */

/** GET ?owner=<uid>&id=<projectId> — tam proje nesnesi + sahip e-postası. */
export async function GET(req: Request) {
  const d = await adminDogrula(req);
  if (!d.ok) return d.resp;
  const sb = d.sb;
  const url = new URL(req.url);
  const owner = url.searchParams.get("owner") ?? "";
  const id = url.searchParams.get("id") ?? "";
  if (!owner || !id) return yanit("owner ve id gerekli.", 400);

  const { data: row } = await sb.from("modul_veri").select("veri").eq("owner_id", owner).eq("modul", "projects").maybeSingle();
  const dizi = (Array.isArray(row?.veri) ? row?.veri : []) as Record<string, unknown>[];
  const proje = dizi.find((it) => String(it.id) === id);
  if (!proje) return yanit("Proje bulunamadı.", 404);

  let owner_email = "";
  try {
    const { data: u } = await sb.auth.admin.getUserById(owner);
    owner_email = u?.user?.email ?? "";
  } catch { /* yok */ }

  return Response.json({ proje, owner_email });
}

/** POST {owner, id, alanlar} — projenin verilen alanlarını günceller. */
export async function POST(req: Request) {
  const d = await adminDogrula(req);
  if (!d.ok) return d.resp;
  const sb = d.sb;
  const body = await req.json().catch(() => ({}));
  const { owner, id, alanlar } = body as { owner?: string; id?: string; alanlar?: Record<string, unknown> };
  if (!owner || !id || !alanlar || typeof alanlar !== "object") return yanit("owner, id ve alanlar gerekli.", 400);

  const { data: row } = await sb.from("modul_veri").select("veri").eq("owner_id", owner).eq("modul", "projects").maybeSingle();
  const dizi = (Array.isArray(row?.veri) ? row?.veri : []) as Record<string, unknown>[];
  const i = dizi.findIndex((it) => String(it.id) === id);
  if (i < 0) return yanit("Proje bulunamadı.", 404);

  // id ve createdAt değiştirilemez
  const { id: _id, createdAt: _c, ...izinli } = alanlar as Record<string, unknown>;
  void _id; void _c;
  dizi[i] = { ...dizi[i], ...izinli };

  const { error } = await sb.from("modul_veri")
    .update({ veri: dizi, updated_at: new Date().toISOString() })
    .eq("owner_id", owner).eq("modul", "projects");
  if (error) return yanit(error.message, 500);
  return Response.json({ ok: true, proje: dizi[i] });
}
