-- insPRO — profiles zengin profil alanları + genel ayarlar tablosu
-- Tam-Supabase geçişi (frontend doğrudan Supabase'e konuşur).

-- ── profiles: zengin profil alanları ──
alter table public.profiles add column if not exists ad           text;
alter table public.profiles add column if not exists soyad        text;
alter table public.profiles add column if not exists dogum_tarihi date;
alter table public.profiles add column if not exists meslek       text;
alter table public.profiles add column if not exists sirket_mi    boolean default false;
alter table public.profiles add column if not exists sirket_adi   text;
alter table public.profiles add column if not exists vergi_dairesi text;
alter table public.profiles add column if not exists vergi_no     text;
alter table public.profiles add column if not exists profil_tamam boolean not null default false;
alter table public.profiles alter column rol set default 'yonetici';

-- ── Genel ayarlar (menü / site içeriği) — admin yazar, herkes okur ──
create table if not exists public.ayarlar (
  anahtar    text primary key,
  deger      jsonb,
  updated_at timestamptz not null default now()
);
alter table public.ayarlar enable row level security;

drop policy if exists "ayar oku" on public.ayarlar;
create policy "ayar oku" on public.ayarlar
  for select to authenticated using (true);

drop policy if exists "ayar yaz" on public.ayarlar;
create policy "ayar yaz" on public.ayarlar
  for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.rol in ('yonetici','sahip','ofis')))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.rol in ('yonetici','sahip','ofis')));

grant select, insert, update, delete on public.ayarlar to authenticated;
