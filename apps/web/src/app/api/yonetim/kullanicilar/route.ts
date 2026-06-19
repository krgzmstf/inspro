import { adminDogrula, rolNormalize, yanit } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** GET — tüm kullanıcılar (auth + profiles birleşik). */
export async function GET(req: Request) {
  const d = await adminDogrula(req);
  if (!d.ok) return d.resp;
  const sb = d.sb;

  const { data: liste, error } = await sb.auth.admin.listUsers({ perPage: 1000 });
  if (error) return yanit(error.message, 500);

  const { data: profs } = await sb.from("profiles").select("*");
  const profMap = new Map((profs ?? []).map((p) => [p.id, p]));

  const now = Date.now();
  const users = (liste?.users ?? [])
    // Gizli süper adminler listede görünmez
    .filter((u) => !(profMap.get(u.id) as Record<string, unknown> | undefined)?.gizli)
    .map((u) => {
    const p = profMap.get(u.id) as Record<string, unknown> | undefined;
    const banUntil = (u as { banned_until?: string }).banned_until;
    const aktif = !banUntil || new Date(banUntil).getTime() <= now;
    return {
      id: u.id,
      email: u.email ?? "",
      ad_soyad: (p?.ad_soyad as string) ?? "",
      firma: (p?.firma as string) ?? "",
      rol: rolNormalize(p?.rol as string),
      yetkiler: Array.isArray(p?.yetkiler) ? (p?.yetkiler as string[]) : null,
      proje_limiti: (p?.proje_limiti as number) ?? null,
      aktif,
      created_at: u.created_at,
      son_giris: u.last_sign_in_at ?? null,
    };
  });
  return Response.json({ users });
}

/** POST — kullanıcı güncelle {id, rol?, yetkiler?, ad_soyad?, firma?, proje_limiti?}. */
export async function POST(req: Request) {
  const d = await adminDogrula(req);
  if (!d.ok) return d.resp;
  const body = await req.json().catch(() => ({}));
  const { id, rol, yetkiler, ad_soyad, firma, proje_limiti } = body as {
    id?: string; rol?: string; yetkiler?: string[] | null;
    ad_soyad?: string; firma?: string; proje_limiti?: number | null;
  };
  if (!id) return yanit("id gerekli.", 400);
  const guncelle: Record<string, unknown> = {};
  if (rol !== undefined) guncelle.rol = rol;
  if (yetkiler !== undefined) guncelle.yetkiler = yetkiler;
  if (ad_soyad !== undefined) guncelle.ad_soyad = ad_soyad;
  if (firma !== undefined) guncelle.firma = firma;
  if (proje_limiti !== undefined) guncelle.proje_limiti = proje_limiti;
  if (Object.keys(guncelle).length === 0) return yanit("Güncellenecek alan yok.", 400);
  const { error } = await d.sb.from("profiles").update(guncelle).eq("id", id);
  if (error) return yanit(error.message, 500);
  return Response.json({ ok: true });
}

/** PUT — yeni kullanıcı oluştur {email, ad_soyad, firma, rol}. */
export async function PUT(req: Request) {
  const d = await adminDogrula(req);
  if (!d.ok) return d.resp;
  const sb = d.sb;
  const body = await req.json().catch(() => ({}));
  const { email, ad_soyad, firma, rol } = body as { email?: string; ad_soyad?: string; firma?: string; rol?: string };
  if (!email || !email.includes("@")) return yanit("Geçerli e-posta gerekli.", 400);

  const geciciSifre = "Ins" + crypto.randomUUID().replace(/-/g, "").slice(0, 10) + "!9";
  const { data: yeni, error } = await sb.auth.admin.createUser({
    email: email.trim(),
    password: geciciSifre,
    email_confirm: true,
    user_metadata: { ad_soyad: ad_soyad ?? "" },
  });
  if (error || !yeni.user) return yanit(error?.message ?? "Kullanıcı oluşturulamadı.", 500);

  // Trigger profiles satırını oluşturur; rol/firma/ad_soyad güncelle
  await sb.from("profiles").update({
    rol: rol ?? "sefi",
    ad_soyad: ad_soyad ?? null,
    firma: firma ?? null,
    profil_tamam: true,
  }).eq("id", yeni.user.id);

  return Response.json({ ok: true, gecici_sifre: geciciSifre });
}

/** PATCH — aktif/pasif {id, aktif}. */
export async function PATCH(req: Request) {
  const d = await adminDogrula(req);
  if (!d.ok) return d.resp;
  const body = await req.json().catch(() => ({}));
  const { id, aktif } = body as { id?: string; aktif?: boolean };
  if (!id) return yanit("id gerekli.", 400);
  const { error } = await d.sb.auth.admin.updateUserById(id, {
    ban_duration: aktif ? "none" : "876000h",
  });
  if (error) return yanit(error.message, 500);
  return Response.json({ ok: true });
}

/** DELETE — kullanıcıyı sil (?id=). Verileri FK cascade ile silinir. */
export async function DELETE(req: Request) {
  const d = await adminDogrula(req);
  if (!d.ok) return d.resp;
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return yanit("id gerekli.", 400);
  if (id === d.uid) return yanit("Kendi hesabınızı silemezsiniz.", 400);
  const { error } = await d.sb.auth.admin.deleteUser(id);
  if (error) return yanit(error.message, 500);
  return Response.json({ ok: true });
}
