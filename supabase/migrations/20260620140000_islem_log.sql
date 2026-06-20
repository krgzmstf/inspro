-- İşlem (denetim) günlüğü: kim ne yaptı (oluştur/sil/güncelle/içe-aktar/ödeme/giriş)
-- Normal kullanıcı SADECE kendi adına kayıt ekleyebilir; OKUMA yalnız süper admin
-- (service_role API üzerinden) — bu yüzden select policy yok (RLS varsayılan: kapalı).

create table if not exists public.islem_log (
  id          uuid primary key default gen_random_uuid(),
  kullanici_id uuid references auth.users(id) on delete set null,
  email       text,
  ad          text,
  eylem       text not null,
  modul       text not null,
  kayit       text,
  detay       jsonb,
  platform    text,
  created_at  timestamptz not null default now()
);

alter table public.islem_log enable row level security;

drop policy if exists islem_log_insert on public.islem_log;
create policy islem_log_insert on public.islem_log
  for insert to authenticated
  with check (auth.uid() = kullanici_id);

grant insert on public.islem_log to authenticated;

create index if not exists islem_log_created_idx on public.islem_log (created_at desc);
create index if not exists islem_log_user_idx on public.islem_log (kullanici_id);
