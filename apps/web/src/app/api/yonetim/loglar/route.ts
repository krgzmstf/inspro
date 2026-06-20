import { adminDogrula, yanit } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** GET — işlem (denetim) günlüğü. Yalnız süper admin.
 *  ?kullanici=<id> ?eylem= ?modul= ?q= ?limit=  filtreleri.
 *  Dönüş: { loglar:[...], ozet:[{kullanici_id,email,adet,son,eylemler}] }
 */
export async function GET(req: Request) {
  const d = await adminDogrula(req);
  if (!d.ok) return d.resp;
  const sb = d.sb;
  const sp = new URL(req.url).searchParams;
  const kullanici = sp.get("kullanici");
  const eylem = sp.get("eylem");
  const modul = sp.get("modul");
  const q = (sp.get("q") ?? "").trim();
  const limit = Math.min(Math.max(Number(sp.get("limit")) || 300, 1), 1000);

  let sorgu = sb
    .from("islem_log")
    .select("id,kullanici_id,email,eylem,modul,kayit,detay,platform,created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (kullanici) sorgu = sorgu.eq("kullanici_id", kullanici);
  if (eylem) sorgu = sorgu.eq("eylem", eylem);
  if (modul) sorgu = sorgu.eq("modul", modul);
  if (q) sorgu = sorgu.or(`kayit.ilike.%${q}%,email.ilike.%${q}%`);

  const { data: loglar, error } = await sorgu;
  if (error) return yanit(error.message, 500);

  // Kişi bazında aktivite özeti (son ~3000 kayıttan)
  const { data: son } = await sb
    .from("islem_log")
    .select("kullanici_id,email,eylem,created_at")
    .order("created_at", { ascending: false })
    .limit(3000);

  const harita = new Map<string, { kullanici_id: string; email: string; adet: number; son: string; eylemler: Record<string, number> }>();
  for (const r of son ?? []) {
    const id = (r.kullanici_id as string) ?? "?";
    let o = harita.get(id);
    if (!o) { o = { kullanici_id: id, email: (r.email as string) ?? "", adet: 0, son: r.created_at as string, eylemler: {} }; harita.set(id, o); }
    o.adet++;
    o.eylemler[r.eylem as string] = (o.eylemler[r.eylem as string] ?? 0) + 1;
    if ((r.created_at as string) > o.son) o.son = r.created_at as string;
  }
  const ozet = [...harita.values()].sort((a, b) => b.adet - a.adet);

  return Response.json({ loglar: loglar ?? [], ozet });
}
