-- ══════════════════════════════════════════════════════════════════════════════
--  فصل رواتب الموظفين في جدول مقفول — employee_compensation
-- ══════════════════════════════════════════════════════════════════════════════
--
--  المشكلة: عمود employees.salary (+ insurance / work_insurance) مقروء لأي موظف
--  مسجَّل — الجدول authenticated_all — فأي موظف من الـConsole يقدر يجيب رواتب الجميع.
--  RLS في Supabase على مستوى الصف، فمينفعش نخفي عموداً واحداً.
--
--  الحل: ننقل الأعمدة الثلاثة لجدول منفصل عليه RLS صارم:
--    • القراءة: صف الموظف نفسه فقط، أو مدير النظام.
--    • الكتابة: مدير النظام فقط.
--  ثم نحذف الأعمدة من employees.
--
--  ⚠️ لازم يُنشَر كود الواجهة الجديد أولاً (يقرأ/يكتب من الجدول الجديد)، ثم يُشغَّل هذا الملف.
--
--  دالة مساعدة: app_employee_base_pay(uuid) — SECURITY DEFINER، ترجع الراتب لعملية
--  إنشاء سجل الراتب عند اعتماد سلفة (لا تُعرض للمستخدم). مقصورة على مدير النظام أو
--  صاحب صلاحية "الرواتب".
--
--  التشغيل: انسخ الملف كله في Supabase SQL Editor → Run مرة واحدة.
-- ══════════════════════════════════════════════════════════════════════════════

begin;

-- ── (1) الجدول ──
create table if not exists employee_compensation (
  employee_id     uuid primary key references employees(id) on delete cascade,
  salary          numeric,
  insurance       numeric default 0,
  work_insurance  numeric default 0,
  updated_at      timestamptz default now()
);

-- ── (2) نقل البيانات الحالية (idempotent) ──
insert into employee_compensation (employee_id, salary, insurance, work_insurance)
select id, salary, insurance, work_insurance from employees
on conflict (employee_id) do update
  set salary         = excluded.salary,
      insurance      = excluded.insurance,
      work_insurance = excluded.work_insurance;

-- ── (3) RLS ──
alter table employee_compensation enable row level security;
drop policy if exists ec_select on employee_compensation;
drop policy if exists ec_ins    on employee_compensation;
drop policy if exists ec_upd    on employee_compensation;
drop policy if exists ec_del    on employee_compensation;

create policy ec_select on employee_compensation for select to authenticated
  using (employee_id = app_current_employee_id() or app_is_super_admin());
create policy ec_ins on employee_compensation for insert to authenticated
  with check (app_is_super_admin());
create policy ec_upd on employee_compensation for update to authenticated
  using (app_is_super_admin()) with check (app_is_super_admin());
create policy ec_del on employee_compensation for delete to authenticated
  using (app_is_super_admin());

-- ── (4) دالة داخلية لإنشاء سجل الراتب عند اعتماد سلفة (لا تُعرض للمستخدم) ──
create or replace function app_employee_base_pay(p_emp uuid)
returns table(salary numeric, insurance numeric, work_insurance numeric)
language sql stable security definer set search_path = public, pg_temp as $$
  select c.salary, c.insurance, c.work_insurance
  from employee_compensation c
  where c.employee_id = p_emp
    and (app_is_super_admin() or app_has_perm('payroll'))
$$;
revoke all on function app_employee_base_pay(uuid) from public;
grant execute on function app_employee_base_pay(uuid) to authenticated;

-- ── (5) حذف الأعمدة من employees ──
alter table employees drop column if exists salary;
alter table employees drop column if exists insurance;
alter table employees drop column if exists work_insurance;

-- ── (6) بوابة تحقق — أي فشل يُلغي المعاملة كلها ──
do $$
declare n int;
begin
  if not exists (select 1 from pg_proc p join pg_namespace ns on ns.oid=p.pronamespace
                 where ns.nspname='public' and p.proname='app_is_super_admin') then
    raise exception 'FAIL: app_is_super_admin() غير موجودة — شغّل db/rls_stage_a.sql أولاً';
  end if;

  select count(*) into n from pg_policies where schemaname='public'
    and tablename='employee_compensation'
    and policyname in ('ec_select','ec_ins','ec_upd','ec_del');
  if n <> 4 then raise exception 'FAIL: expected 4 ec_* policies, found %', n; end if;

  if exists (select 1 from information_schema.columns
             where table_schema='public' and table_name='employees'
               and column_name in ('salary','insurance','work_insurance')) then
    raise exception 'FAIL: أعمدة الراتب ما زالت في جدول employees';
  end if;

  if (select count(*) from employee_compensation) < (select count(*) from employees) then
    raise exception 'FAIL: نقل بيانات employee_compensation ناقص';
  end if;

  perform app_employee_base_pay(gen_random_uuid());

  raise notice '════════════════════════════════════';
  raise notice 'ALL CHECKS PASSED — COMMIT below saves';
  raise notice '════════════════════════════════════';
end $$;

commit;


-- ══════════════════════════════════════════════════════════════════════════════
--  اختبار ما بعد الحفظ
-- ══════════════════════════════════════════════════════════════════════════════
--  • موظف عادي (Console): await sb.from('employee_compensation').select('*')
--      → صفه هو فقط (أو صفر لو مش موجود)
--  • كاشير / مدير فرع / مشرف (Console): نفس الاستعلام → صفهم هم فقط
--  • مدير النظام: صفحة الرواتب + إدارة الموظفين تعرض/تعدّل الرواتب عادي
--  • الموظف: صفحة "راتبي" تعرض صافي راتبه
--  • عدم انكسار: زيادة راتب (أدمن)، إضافة موظف جديد (أدمن)، اعتماد سلفة راتب
--    (أدمن → basic_salary صحيح؛ مدير فرع → basic_salary=0 ويُصلَّح عند توليد الرواتب)
--  • auto-checkout: GET /api/auto-checkout?dryRun=true (بحساب أدمن) → يعمل


-- ══════════════════════════════════════════════════════════════════════════════
--  التراجع
-- ══════════════════════════════════════════════════════════════════════════════
-- begin;
-- alter table employees add column if not exists salary numeric;
-- alter table employees add column if not exists insurance numeric default 0;
-- alter table employees add column if not exists work_insurance numeric default 0;
-- update employees e set salary = c.salary, insurance = c.insurance, work_insurance = c.work_insurance
--   from employee_compensation c where c.employee_id = e.id;
-- drop function if exists app_employee_base_pay(uuid);
-- drop table if exists employee_compensation;
-- commit;
