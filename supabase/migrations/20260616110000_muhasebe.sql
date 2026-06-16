-- insPRO Muhasebe ÅŸemasÄ± (Faz 2)
-- Proje bazlÄ± gelir/gider hareketleri

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
