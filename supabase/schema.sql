-- ════════════════════════════════════════════════════════════
-- insPRO — Supabase şeması (Faz 1: Auth + Profiller + Projeler)
-- Supabase Dashboard → SQL Editor → bu dosyayı yapıştır → Run.
-- Güvenlik: RLS (Row Level Security) açık; her kullanıcı yalnız
-- kendi verisini görür/değiştirir.
-- ════════════════════════════════════════════════════════════

-- ── Profiller (auth.users'a bağlı) ──────────────────────────
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  ad_soyad    text,
  firma       text,
  telefon     text,
  rol         text not null default 'sahip',  -- sahip | ofis | sahaSefi | saha | izleyici
  created_at  timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profil sahibi okur" on public.profiles;
create policy "profil sahibi okur" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "profil sahibi yazar" on public.profiles;
create policy "profil sahibi yazar" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

-- Kayıt olan kullanıcıya otomatik profil oluştur
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, ad_soyad, firma)
  values (new.id, new.raw_user_meta_data->>'ad_soyad', new.raw_user_meta_data->>'firma')
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
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

drop policy if exists "proje sahibi tam yetki" on public.projects;
create policy "proje sahibi tam yetki" on public.projects
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create index if not exists projects_owner_idx on public.projects(owner_id);

-- ════════════════════════════════════════════════════════════
-- SONRAKİ FAZLAR (ayrı migration olarak eklenecek):
-- metraj, is_surecleri, asama_kalem, muhasebe, finans_hesap,
-- personel, puantaj, saha, teklif, hakedis, firma, bilgi_tabani
-- Her biri: owner_id + project_id (varsa) + RLS (owner = auth.uid()).
-- ════════════════════════════════════════════════════════════
-- â”€â”€ Muhasebe â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
create table if not exists public.accounting (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null default auth.uid() references auth.users(id) on delete cascade,
  project_id      uuid not null references public.projects(id) on delete cascade,
  tip             text not null, -- gelir | gider
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
  durum           text not null default 'odendi', -- acik | kismi | odendi
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
