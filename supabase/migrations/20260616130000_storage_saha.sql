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
