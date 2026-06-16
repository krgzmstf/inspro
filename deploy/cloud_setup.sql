-- ===== 20260615120000_init.sql =====
-- insPRO başlangıç şeması (Faz 1): profiller + projeler + RLS
-- Lokal Supabase (Docker) start/db reset sırasında otomatik uygulanır.

-- ── Profiller ───────────────────────────────────────────────
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  ad_soyad    text,
  firma       text,
  telefon     text,
  rol         text not null default 'sahip',
  created_at  timestamptz not null default now()
);
alter table public.profiles enable row level security;
drop policy if exists "profil sahibi" on public.profiles;
create policy "profil sahibi" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, ad_soyad, firma)
  values (new.id, new.raw_user_meta_data->>'ad_soyad', new.raw_user_meta_data->>'firma')
  on conflict (id) do nothing;
  return new;
end; $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── Projeler ────────────────────────────────────────────────
create table if not exists public.projects (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name          text not null,
  city          text,
  type          text,
  area          numeric,
  floors        integer,
  budget        numeric,
  phases        jsonb default '[]'::jsonb,
  katlar        jsonb,
  bina          jsonb,
  kendi_fiyat   jsonb,
  poz_kutuphane text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
alter table public.projects enable row level security;
drop policy if exists "proje sahibi" on public.projects;
create policy "proje sahibi" on public.projects
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create index if not exists projects_owner_idx on public.projects(owner_id);

-- ── Rol yetkileri (RLS satır erişimini; GRANT tablo erişimini kontrol eder) ──
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.projects to authenticated;

-- ===== 20260616110000_muhasebe.sql =====
-- insPRO Muhasebe semasi (Faz 2): accounting tablosu (proje bazli gelir/gider)
create table if not exists public.accounting (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null default auth.uid() references auth.users(id) on delete cascade,
  project_id      uuid not null references public.projects(id) on delete cascade,
  tip             text not null,
  kategori        text not null,
  aciklama        text,
  taraf           text,
  belge_no        text,
  matrah          numeric not null default 0,
  kdv_oran        integer not null default 0,
  kdv_tutar       numeric not null default 0,
  tevkifat_oran   numeric not null default 0,
  tevkifat_tutar  numeric not null default 0,
  tutar           numeric not null default 0,
  net             numeric not null default 0,
  tarih           date not null default current_date,
  vade_tarihi     date,
  durum           text not null default 'odendi',
  odenen_tutar    numeric not null default 0,
  hesap_id        text,
  created_at      timestamptz not null default now()
);
alter table public.accounting enable row level security;
drop policy if exists "muhasebe sahibi" on public.accounting;
create policy "muhasebe sahibi" on public.accounting
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create index if not exists accounting_owner_idx on public.accounting(owner_id);
create index if not exists accounting_project_idx on public.accounting(project_id);
grant select, insert, update, delete on public.accounting to authenticated;

-- ===== 20260616120000_modul_veri.sql =====
-- insPRO — Genel modül verisi (JSONB blob senkronu)
-- metraj, iş süreçleri, saha, personel, puantaj, teklif, hakediş,
-- aşama kalemleri, kasa/banka, firma, bilgi tabanı — her biri sahip
-- başına tek satırda (veri jsonb) tutulur. Cihazlar arası kalıcılık.

create table if not exists public.modul_veri (
  owner_id   uuid not null default auth.uid() references auth.users(id) on delete cascade,
  modul      text not null,
  veri       jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (owner_id, modul)
);

alter table public.modul_veri enable row level security;
drop policy if exists "modul sahibi" on public.modul_veri;
create policy "modul sahibi" on public.modul_veri
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

grant select, insert, update, delete on public.modul_veri to authenticated;

-- ===== 20260616130000_storage_saha.sql =====
-- insPRO — Saha fotoğrafları için Storage bucket (resimler DB yerine burada)
insert into storage.buckets (id, name, public)
values ('saha-foto', 'saha-foto', true)
on conflict (id) do nothing;

drop policy if exists "saha-foto oku" on storage.objects;
create policy "saha-foto oku" on storage.objects
  for select using (bucket_id = 'saha-foto');

drop policy if exists "saha-foto yukle" on storage.objects;
create policy "saha-foto yukle" on storage.objects
  for insert to authenticated with check (bucket_id = 'saha-foto');

drop policy if exists "saha-foto guncelle" on storage.objects;
create policy "saha-foto guncelle" on storage.objects
  for update to authenticated using (bucket_id = 'saha-foto');

drop policy if exists "saha-foto sil" on storage.objects;
create policy "saha-foto sil" on storage.objects
  for delete to authenticated using (bucket_id = 'saha-foto');

-- ===== 20260616140000_profiles_yetkiler.sql =====
-- insPRO — profiles tablosuna kişiye özel modül izinleri (yetkiler)
alter table public.profiles add column if not exists yetkiler jsonb;

