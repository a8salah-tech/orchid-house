-- ══════════════════════════════════════════════════════════════════════════════
--  تفعيل التحديث الفوري لجدول الطاولات (Realtime)
-- ══════════════════════════════════════════════════════════════════════════════
--  صفحة الكاشير تستمع لتغييرات جدول tables (فتح/قفل/تحرير الطاولة) لتظهر فوراً على كل الأجهزة.
--  التشغيل: انسخ الملف كله في Supabase SQL Editor → Run. آمن لإعادة التشغيل.
-- ══════════════════════════════════════════════════════════════════════════════

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'tables'
  ) then
    alter publication supabase_realtime add table public.tables;
  end if;
end $$;
