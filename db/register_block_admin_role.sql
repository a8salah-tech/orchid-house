-- ══════════════════════════════════════════════════════════════════════════════
--  منع طلب دور "admin" من التسجيل الذاتي العام (/register)
-- ══════════════════════════════════════════════════════════════════════════════
--
--  المشكلة: صفحة /register تُدرج في employee_registrations كزائر مجهول، وسياسة
--  anon_insert كانت with check (true) — أي شخص يقدر يرسل طلباً بـ role='admin'،
--  ولو اعتُمد بالخطأ يحصل على صلاحية النظام الكاملة. (شيلنا الخيار من الواجهة كمان.)
--
--  الحل: تشديد شرط anon_insert ليرفض role = 'admin'. باقي الأدوار تمرّ عادي —
--  مدير الفرع/الكاشير/الموظف يسجّلون ذاتياً ثم يعتمدهم مدير النظام.
--
--  التشغيل: انسخ الملف كله في Supabase SQL Editor → Run مرة واحدة.
-- ══════════════════════════════════════════════════════════════════════════════

begin;

drop policy if exists anon_insert on employee_registrations;
create policy anon_insert on employee_registrations for insert to anon
  with check (coalesce(role, '') <> 'admin');

-- بوابة تحقق
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='employee_registrations' and policyname='anon_insert'
  ) then
    raise exception 'FAIL: anon_insert مفقودة';
  end if;

  if exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='employee_registrations'
      and policyname='anon_insert' and coalesce(with_check,'') in ('true','(true)')
  ) then
    raise exception 'FAIL: anon_insert ما زالت with check (true)';
  end if;

  raise notice '════════════════════════════════════';
  raise notice 'ALL CHECKS PASSED — COMMIT below saves';
  raise notice '════════════════════════════════════';
end $$;

commit;

-- ══════════════════════════════════════════════════════════════════════════════
--  اختبار ما بعد الحفظ (Console بدون تسجيل دخول)
-- ══════════════════════════════════════════════════════════════════════════════
--   await sb.from('employee_registrations').insert({ name:'x', role:'admin' })     → خطأ RLS
--   await sb.from('employee_registrations').insert({ name:'x', role:'employee' })   → ينجح
--
--  التراجع:
--   begin;
--   drop policy if exists anon_insert on employee_registrations;
--   create policy anon_insert on employee_registrations for insert to anon with check (true);
--   commit;
