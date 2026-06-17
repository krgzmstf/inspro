import { adminDogrula, yanit } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

interface Satir { id: string; owner_id: string; baslik: string; ek?: string; created_at?: string | null }

const BUCKET = "saha-foto";

/** GET ?tip=projeler|muhasebe|modul|dosyalar — yönetilebilir kayıt listesi. */
export async function GET(req: Request) {
  const d = await adminDogrula(req);
  if (!d.ok) return d.resp;
  const sb = d.sb;
  const tip = new URL(req.url).searchParams.get("tip") ?? "projeler";

  if (tip === "dosyalar") {
    const satirlar = await dosyalariListele(sb);
    return Response.json({ satirlar });
  }

  const { data: rows } = await sb.from("modul_veri").select("owner_id, modul, veri, updated_at");
  const satirlar: Satir[] = [];

  if (tip === "projeler" || tip === "muhasebe") {
    const modul = tip === "projeler" ? "projects" : "accounting";
    for (const r of rows ?? []) {
      if (r.modul !== modul) continue;
      const dizi = Array.isArray(r.veri) ? r.veri : [];
      for (const it of dizi as Record<string, unknown>[]) {
        satirlar.push(tip === "projeler"
          ? { id: String(it.id), owner_id: r.owner_id, baslik: String(it.name ?? "—"), ek: (it.city as string) ?? "", created_at: (it.createdAt as string) ?? null }
          : { id: String(it.id), owner_id: r.owner_id, baslik: String(it.aciklama || it.kategori || "—"), ek: it.tutar != null ? `${it.tutar} ₺` : "", created_at: (it.tarih as string) ?? null });
      }
    }
  } else if (tip === "modul") {
    for (const r of rows ?? []) {
      if (r.modul === "projects" || r.modul === "accounting") continue;
      const n = Array.isArray(r.veri) ? r.veri.length : 0;
      satirlar.push({ id: `${r.owner_id}|${r.modul}`, owner_id: r.owner_id, baslik: r.modul, ek: `${n} kayıt`, created_at: r.updated_at ?? null });
    }
  }

  return Response.json({ satirlar });
}

/** DELETE ?tip=&id= — kaydı sil. */
export async function DELETE(req: Request) {
  const d = await adminDogrula(req);
  if (!d.ok) return d.resp;
  const sb = d.sb;
  const url = new URL(req.url);
  const tip = url.searchParams.get("tip") ?? "";
  const id = url.searchParams.get("id") ?? "";
  if (!tip || !id) return yanit("tip ve id gerekli.", 400);

  if (tip === "dosyalar") {
    const { error } = await sb.storage.from(BUCKET).remove([id]);
    if (error) return yanit(error.message, 500);
    return Response.json({ ok: true });
  }

  if (tip === "modul") {
    const [owner, modul] = id.split("|");
    const { error } = await sb.from("modul_veri").delete().eq("owner_id", owner).eq("modul", modul);
    if (error) return yanit(error.message, 500);
    return Response.json({ ok: true });
  }

  // projeler / muhasebe → ilgili sahibin JSONB dizisinden öğeyi çıkar
  const modul = tip === "projeler" ? "projects" : "accounting";
  const { data: rows } = await sb.from("modul_veri").select("owner_id, veri").eq("modul", modul);
  for (const r of rows ?? []) {
    const dizi = (Array.isArray(r.veri) ? r.veri : []) as Record<string, unknown>[];
    if (dizi.some((it) => String(it.id) === id)) {
      const yeni = dizi.filter((it) => String(it.id) !== id);
      const { error } = await sb.from("modul_veri").update({ veri: yeni, updated_at: new Date().toISOString() }).eq("owner_id", r.owner_id).eq("modul", modul);
      if (error) return yanit(error.message, 500);
      return Response.json({ ok: true });
    }
  }
  return yanit("Kayıt bulunamadı.", 404);
}

async function dosyalariListele(sb: SupabaseClient): Promise<Satir[]> {
  try {
    const { data: objs } = await sb.schema("storage").from("objects").select("name, owner, metadata, created_at").eq("bucket_id", BUCKET);
    return (objs ?? []).map((o) => ({
      id: o.name as string,
      owner_id: (o.owner as string) ?? "",
      baslik: (o.name as string).split("/").pop() ?? (o.name as string),
      ek: byteBicim(Number((o.metadata as { size?: number } | null)?.size ?? 0)),
      created_at: (o.created_at as string) ?? null,
    }));
  } catch {
    return [];
  }
}

function byteBicim(b: number): string {
  if (!b) return "";
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}
