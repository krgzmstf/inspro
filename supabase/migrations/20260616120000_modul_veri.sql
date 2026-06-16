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
