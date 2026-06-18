-- insPRO — kişiye özel proje limiti (süper adminler kısıtlar/artırır)
--   null  → varsayılan limit (3 proje)
--   0     → sınırsız
--   N>0   → en fazla N proje
-- Süper adminler (gizli=true) her durumda sınırsızdır (limit yok sayılır).
alter table public.profiles add column if not exists proje_limiti int;
