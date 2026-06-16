import { createClient } from "@supabase/supabase-js";

/* ──────────────────────────────────────────────────────────
   insPRO — Yönetim: kullanıcı listesi + rol atama (sunucu tarafı)

   service_role anahtarı YALNIZ burada (sunucuda) kullanılır;
   tarayıcıya asla gönderilmez. Kodlama bilmeden, panelden
   kullanıcı/rol yönetimi için.

   GET  → tüm kullanıcılar (e-posta, ad, firma, rol, kayıt tarihi)
   POST → { id, rol } rolü günceller
   ────────────────────────────────────────────────────────── */

export const runtime = "nodejs";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const svc = process.env.SUPABASE_SERVICE_ROLE_KEY;

function admin() {
  return createClient(url!, svc!, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function GET() {
  if (!url || !svc) return Response.json({ error: "Supabase yapılandırılmamış." }, { status: 500 });
  try {
    const sb = admin();
    const { data, error } = await sb.auth.admin.listUsers({ perPage: 1000 });
    if (error) return Response.json({ error: error.message }, { status: 500 });
    const { data: profiller } = await sb.from("profiles").select("id, rol, ad_soyad, firma");
    const pmap = new Map((profiller ?? []).map((p) => [p.id, p]));
    const users = data.users.map((u) => {
      const p = pmap.get(u.id) as { rol?: string; ad_soyad?: string; firma?: string } | undefined;
      const meta = (u.user_metadata ?? {}) as { ad_soyad?: string; firma?: string };
      return {
        id: u.id,
        email: u.email ?? "",
        ad_soyad: p?.ad_soyad ?? meta.ad_soyad ?? "",
        firma: p?.firma ?? meta.firma ?? "",
        rol: p?.rol ?? "sahip",
        created_at: u.created_at,
        son_giris: u.last_sign_in_at ?? null,
      };
    });
    return Response.json({ users });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  if (!url || !svc) return Response.json({ error: "Supabase yapılandırılmamış." }, { status: 500 });
  let body: { id?: string; rol?: string };
  try { body = await req.json(); } catch { return Response.json({ error: "Geçersiz istek." }, { status: 400 }); }
  const { id, rol } = body;
  if (!id || !rol) return Response.json({ error: "id ve rol gerekli." }, { status: 400 });
  if (!["sahip", "ofis", "sefi", "usta"].includes(rol)) return Response.json({ error: "Geçersiz rol." }, { status: 400 });
  try {
    const sb = admin();
    const { error } = await sb.from("profiles").upsert({ id, rol }, { onConflict: "id" });
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
