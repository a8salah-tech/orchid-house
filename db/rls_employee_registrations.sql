-- ══════════════════════════════════════════════════════════════════════════════
--  قفل قراءة employee_registrations — يحتوي كلمات سر نصية وصور هويات
-- ══════════════════════════════════════════════════════════════════════════════
--
--  المشكلة: بعد المرحلة 4 الجدول authenticated_all — أي موظف مسجَّل يقرأ:
--    • password_hint : كلمة السر النصية التي أدخلها المتقدّم في صفحة /register
--    • national_id_url / photo_url : روابط صور الهوية والصورة الشخصية
--    • email / phone : بيانات تواصل كل المتقدّمين
--
--  الحل: القراءة/التعديل/الحذف لمدير النظام فقط (app_is_super_admin() = app_has_perm('all')) —
--  نفس ما تفعله صفحة إدارة الموظفين في الواجهة (canSeeRegs = permissions.all).
--  إضافة الزائر المجهول (anon_insert من db/security_anon_lockdown.sql) تبقى كما هي —
--  صفحة /register تنشئ الطلب كزائر.
--
--  الكود المصاحب (منشور): صفحة إدارة الموظفين تمسح password_hint = null فور اعتماد
--  أو رفض الطلب، فلا تبقى كلمة السر مخزَّنة إلا لطلب "pending" واحد يراه مدير النظام فقط.
--
--  التشغيل: انسخ الملف كله في Supabase SQL Editor → Run مرة واحدة.
-- ══════════════════════════════════════════════════════════════════════════════

begin;

-- ── (1) تنظيف بأثر رجعي: امسح كلمات السر النصية لكل طلب لم يعد "pending" ──
update employee_registrations
   set password_hint = null
 where password_hint is not null
   and coalesce(status, 'pending') <> 'pending';

-- ── (2) استبدال authenticated_all بسياسات محصورة بمدير النظام ──
drop policy if exists authenticated_all on employee_registrations;
drop policy if exists er_select on employee_registrations;
drop policy if exists er_ins    on employee_registrations;
drop policy if exists er_upd    on employee_registrations;
drop policy if exists er_del    on employee_registrations;

create policy er_select on employee_registrations for select to authenticated
  using (app_is_super_admin());
create policy er_ins on employee_registrations for insert to authenticated
  with check (app_is_super_admin());
create policy er_upd on employee_registrations for update to authenticated
  using (app_is_super_admin()) with check (app_is_super_admin());
create policy er_del on employee_registrations for delete to authenticated
  using (app_is_super_admin());

-- (anon_insert لم تُمسّ — الزائر المجهول لا يزال يقدر ينشئ طلب تسجيل)

-- ── (3) بوابة تحقق — أي فشل يُلغي المعاملة كلها ──
do $$
declare n int;
begin
  if not exists (select 1 from pg_proc p join pg_namespace ns on ns.oid=p.pronamespace
                 where ns.nspname='public' and p.proname='app_is_super_admin') then
    raise exception 'FAIL: app_is_super_admin() غير موجودة — شغّل db/rls_stage_a.sql أولاً';
  end if;

  if exists (select 1 from pg_policies where schemaname='public'
             and tablename='employee_registrations' and policyname='authenticated_all') then
    raise exception 'FAIL: authenticated_all لا يزال موجوداً على employee_registrations';
  end if;

  select count(*) into n from pg_policies where schemaname='public'
    and tablename='employee_registrations'
    and policyname in ('er_select','er_ins','er_upd','er_del');
  if n <> 4 then raise exception 'FAIL: expected 4 er_* policies, found %', n; end if;

  if not exists (select 1 from pg_policies where schemaname='public'
                 and tablename='employee_registrations' and policyname='anon_insert') then
    raise exception 'FAIL: anon_insert مفقودة — صفحة /register لن تعمل. شغّل db/security_anon_lockdown.sql';
  end if;

  if exists (select 1 from employee_registrations
             where password_hint is not null and coalesce(status,'pending') <> 'pending') then
    raise exception 'FAIL: ما زالت هناك كلمات سر نصية لطلبات غير pending';
  end if;

  raise notice '════════════════════════════════════';
  raise notice 'ALL CHECKS PASSED — COMMIT below saves';
  raise notice '════════════════════════════════════';
end $$;

commit;


-- ══════════════════════════════════════════════════════════════════════════════
--  اختبار ما بعد الحفظ
-- ══════════════════════════════════════════════════════════════════════════════
--  • موظف عادي (Console في أي صفحة داشبورد):
--      await sb.from('employee_registrations').select('*')        → صفر صفوف
--  • مدير النظام: صفحة إدارة الموظفين → قسم "طلبات التسجيل" يُحمّل الطلبات المعلّقة ✅
--  • صفحة /register (بدون تسجيل دخول): إرسال طلب جديد ينجح ✅
--  • بعد اعتماد/رفض طلب من صفحة إدارة الموظفين → password_hint للطلب يصبح null ✅


-- ══════════════════════════════════════════════════════════════════════════════
--  التراجع
-- ══════════════════════════════════════════════════════════════════════════════
-- begin;
-- drop policy if exists er_select on employee_registrations;
-- drop policy if exists er_ins    on employee_registrations;
-- drop policy if exists er_upd    on employee_registrations;
-- drop policy if exists er_del    on employee_registrations;
-- create policy authenticated_all on employee_registrations for all to authenticated using (true) with check (true);
-- commit;
