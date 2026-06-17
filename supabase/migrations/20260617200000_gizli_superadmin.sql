-- insPRO — gizli süper admin desteği
-- profiles.gizli = true olan kullanıcılar yönetim panelindeki listede görünmez.
alter table public.profiles add column if not exists gizli boolean not null default false;
