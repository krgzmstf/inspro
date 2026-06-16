-- insPRO — profiles tablosuna kişiye özel modül izinleri (yetkiler)
alter table public.profiles add column if not exists yetkiler jsonb;
