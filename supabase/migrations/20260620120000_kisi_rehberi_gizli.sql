-- insPRO — Sohbet kişi rehberinden gizli süper adminleri çıkar
-- Güvenlik: gizli=true hesaplar (platform süper adminleri) sohbet
-- rehberinde normal kullanıcılara görünmemeli. View'ı yeniden tanımlar.

create or replace view public.kisi_rehberi as
  select
    id,
    coalesce(nullif(ad_soyad, ''), 'Kullanıcı') as ad,
    firma
  from public.profiles
  where coalesce(gizli, false) = false;

grant select on public.kisi_rehberi to authenticated;
