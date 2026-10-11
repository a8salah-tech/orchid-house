-- ══════════════════════════════════════════════════════════════════════════════
--  نداءات النادل: "تم الرد" متزامن بين أجهزة الكاشير + بثّ لحظي لجدول waiter_calls
-- ══════════════════════════════════════════════════════════════════════════════
--  • waiter_calls.handled_at / handled_by_name: من رد على النداء ومتى. تاب "Waiter Calls" في صفحة الكاشير يستخدمهما،
--    فلو رد الكاشير يختفي النداء من "بانتظار الرد" عند مساعد الكاشير وباقي الأجهزة. (بدونهما يعمل التاب لكن "تم الرد" يُحفظ على الجهاز نفسه فقط.)
--  • إضافة الجدول لقناة realtime حتى يصل النداء لشاشة الكاشير لحظيًا (وإن لم يكن مضافًا يبقى الفحص الدوري كل 4 ثوانٍ).
--  التشغيل: انسخ الملف كله في Supabase SQL Editor → Run. آمن لإعادة التشغيل.
-- ══════════════════════════════════════════════════════════════════════════════

alter table waiter_calls add column if not exists handled_at timestamptz;
alter table waiter_calls add column if not exists handled_by_name text;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'waiter_calls'
  ) then
    alter publication supabase_realtime add table waiter_calls;
  end if;
exception when others then
  null;  -- لو الـpublication غير موجود/غير مسموح، نكمل بدون خطأ
end $$;

notify pgrst, 'reload schema';
