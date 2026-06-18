-- insPRO — kalıcı süper admin garantisi
-- Allow-list'teki e-postalarla açılan/güncellenen hesap, hangi yöntemle
-- giriş yaparsa yapsın (parola ya da Google OAuth) HER ZAMAN gizli süper
-- admin olur. Böylece OAuth ile girişte yetki asla kaybolmaz.

create or replace function public.super_admin_isaretle()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
begin
  select lower(email) into v_email from auth.users where id = new.id;
  if v_email = any (array['krgzmstf@gmail.com', 'yazeinspro@gmail.com']) then
    new.gizli := true;
    new.rol := 'yonetici';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_super_admin_isaretle on public.profiles;
create trigger trg_super_admin_isaretle
before insert or update on public.profiles
for each row execute function public.super_admin_isaretle();

-- Mevcut hesaplar için bir kez uygula (zaten true olanları teyit eder).
update public.profiles p
set gizli = true, rol = 'yonetici'
from auth.users u
where u.id = p.id
  and lower(u.email) = any (array['krgzmstf@gmail.com', 'yazeinspro@gmail.com']);
