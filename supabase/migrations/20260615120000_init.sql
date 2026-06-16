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
