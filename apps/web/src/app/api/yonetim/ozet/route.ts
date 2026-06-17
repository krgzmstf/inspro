import { adminDogrula, rolNormalize } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const d = await adminDogrula(req);
  if (!d.ok) return d.resp;
  const sb = d.sb;

  // Kullanıcılar
  const { data: liste } = await sb.auth.admin.listUsers({ perPage: 1000 });
  const kullaniciSay = liste?.users.length ?? 0;

  // modul_veri → proje / muhasebe / diğer modüller + grafik toplamları
  const { data: rows } = await sb.from("modul_veri").select("modul, veri");
  let proje = 0, muhasebe = 0, modulSay = 0;

  const projeTip: Record<string, number> = { konut: 0, villa: 0, ticari: 0, diger: 0 };
  // Son 6 ay gelir/gider
  const aylar: string[] = [];
  const simdi = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(simdi.getFullYear(), simdi.getMonth() - i, 1);
    aylar.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  const aylikMap: Record<string, { gelir: number; gider: number }> = {};
  for (const a of aylar) aylikMap[a] = { gelir: 0, gider: 0 };

  for (const r of rows ?? []) {
    const dizi = Array.isArray(r.veri) ? (r.veri as Record<string, unknown>[]) : [];
    if (r.modul === "projects") {
      proje += dizi.length;
      for (const p of dizi) {
        const t = String(p.type ?? "diger");
        if (t in projeTip) projeTip[t] += 1; else projeTip.diger += 1;
      }
    } else if (r.modul === "accounting") {
      muhasebe += dizi.length;
      for (const k of dizi) {
        const ay = String(k.tarih ?? "").slice(0, 7);
        if (aylikMap[ay]) {
          const tutar = Number(k.tutar ?? 0);
          if (String(k.tip) === "gider") aylikMap[ay].gider += tutar;
          else aylikMap[ay].gelir += tutar;
        }
      }
    } else {
      modulSay += 1;
    }
  }
  const aylik_finans = aylar.map((a) => ({ ay: a, gelir: aylikMap[a].gelir, gider: aylikMap[a].gider }));

  // Storage (saha-foto)
  let dosya = 0, boyut = 0;
  try {
    const { data: objs } = await sb.schema("storage").from("objects").select("bucket_id, metadata");
    for (const o of objs ?? []) {
      if (o.bucket_id !== "saha-foto") continue;
      dosya += 1;
      boyut += Number((o.metadata as { size?: number } | null)?.size ?? 0);
    }
  } catch { /* storage şeması erişilemezse 0 */ }

  // Rol dağılımı
  const { data: profs } = await sb.from("profiles").select("rol");
  const dagilim: Record<string, number> = { yonetici: 0, sefi: 0, taseron: 0, muhasebeci: 0 };
  for (const p of profs ?? []) {
    const r = rolNormalize(p.rol);
    dagilim[r] = (dagilim[r] ?? 0) + 1;
  }

  return Response.json({
    surum: "2.0-supabase",
    ortam: process.env.NODE_ENV === "production" ? "production" : "local",
    sayilar: { kullanici: kullaniciSay, proje, muhasebe, modul: modulSay, dosya },
    dosya_boyut_bayt: boyut,
    rol_dagilimi: dagilim,
    proje_tip: projeTip,
    aylik_finans,
  });
}
