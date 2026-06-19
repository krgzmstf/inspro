-- insPRO — Sohbet kişi rehberi
-- profiles RLS yalnız sahibe açık; sohbet için tüm kullanıcıların
-- id + görünen ad bilgisine ihtiyaç var. Güvenli bir VIEW ile sadece
-- bu iki/üç alanı authenticated kullanıcılara açıyoruz (diğer profil
-- alanları — telefon, vergi no vb. — sızmaz).
--
-- NOT: Sohbet mesajları SUNUCUDA SAKLANMAZ. İletim Supabase Realtime
-- broadcast ile yapılır (DB'ye yazmadan); mesajlar yalnız kullanıcıların
-- kendi cihazlarında durur. Bu view sadece "kiminle konuşabilirim"
-- rehberi içindir.

create or replace view public.kisi_rehberi as
  select
    id,
    coalesce(nullif(ad_soyad, ''), 'Kullanıcı') as ad,
    firma
  from public.profiles;

-- View varsayılan olarak tanımlayan rol haklarıyla çalışır (security definer
-- benzeri) → profiles RLS'ini baypas eder ama yalnız 3 alanı gösterir.
grant select on public.kisi_rehberi to authenticated;
