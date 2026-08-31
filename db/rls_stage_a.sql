-- ══════════════════════════════════════════════════════════════════════════════
--  المرحلة أ — سياسات RLS الصفّية: سرّية الرواتب والمخالفات
-- ══════════════════════════════════════════════════════════════════════════════
--
--  بعد المرحلة 4 كل جدول عليه authenticated_all — أي موظف مسجَّل يقرأ/يكتب كل شيء.
--  هذا الملف:
--    • payroll_records : الموظف يرى كشف راتبه هو فقط؛ الاطّلاع الكامل لمدير النظام فقط.
--    • salary_increases: مدير النظام فقط.
--    • violations/absences: الموظف العادي يرى ما يخصّه فقط، ولا يقدر يحذف.
--    • دوال SECURITY DEFINER لِما تحتاجه صفحة "راتبي" (ترتيب الاستلام) و P&L (إجمالي الرواتب).
--
--  الكتابة على payroll_records / violations / absences تبقى مفتوحة للموظف المسجَّل
--  (تُشدَّد في المرحلة ب) — صفر خطر على مسارات الاعتماد الحالية.
--
--  طريقة التشغيل: انسخ الملف كله في Supabase SQL Editor واضغط Run مرة واحدة.
--    • رسالة FAIL... (خطأ) → لا شيء تغيّر، ابعتها لي.
--    • "ALL CHECKS PASSED" ثم COMMIT بلا أخطاء → تم.
--
--  ⚠️ انشر تعديلات الكود أولاً (صفحة "راتبي" و P&L تستدعيان الدوال أدناه).
-- ══════════════════════════════════════════════════════════════════════════════

begin;

-- ──────────────────────────────────────────────────────────────────────────────
-- (1) دوال مساعدة
-- ──────────────────────────────────────────────────────────────────────────────
create or replace function app_current_employee_id()
returns uuid language sql stable security definer set search_path = public, pg_temp as $$
  select id from employees where auth_user_id = auth.uid() limit 1
$$;

create or replace function app_current_role()
returns text language sql stable security definer set search_path = public, pg_temp as $$
  select role from employees where auth_user_id = auth.uid() limit 1
$$;

create or replace function app_current_branch_id()
returns uuid language sql stable security definer set search_path = public, pg_temp as $$
  select branch_id from employees where auth_user_id = auth.uid() limit 1
$$;

create or replace function app_has_perm(p_key text)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(
    (
      select (rp.permissions->>'all')::boolean or (rp.permissions->>p_key)::boolean
      from employees e
      join roles_permissions rp on rp.role = e.role
      where e.auth_user_id = auth.uid()
      limit 1
    ),
    false
  )
$$;

create or replace function app_is_super_admin()
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select app_has_perm('all')
$$;

-- الأدوار بلا أي صلاحية إشرافية (من ROLES_INFO في صفحة إدارة الصلاحيات)
create or replace function app_is_basic_employee()
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(
    (select role from employees where auth_user_id = auth.uid() limit 1)
      = any (array['employee','kitchen_cleaner','hall_cleaner','maintenance_worker','delivery_worker']),
    true
  )
$$;

grant execute on function
  app_current_employee_id(), app_current_role(), app_current_branch_id(),
  app_has_perm(text), app_is_super_admin(), app_is_basic_employee()
to authenticated;

-- ──────────────────────────────────────────────────────────────────────────────
-- (2) دوال RPC — ما تحتاجه الصفحات دون كشف الصفوف الفردية
-- ──────────────────────────────────────────────────────────────────────────────

-- أقران الفرع لترتيب استلام الراتب (صفحة "راتبي") — بيانات حضور فقط، لا مبالغ
create or replace function app_branch_payroll_peers(p_month_id uuid)
returns table (employee_id uuid, late_hours numeric, absence_days numeric, has_deduction_2 boolean)
language sql stable security definer set search_path = public, pg_temp as $$
  select pr.employee_id,
         pr.late_hours,
         pr.absence_days,
         coalesce(pr.deduction_2, 0) > 0
  from payroll_records pr
  join employees e on e.id = pr.employee_id
  where pr.payroll_month_id = p_month_id
    and e.is_active = true
    and e.branch_id = app_current_branch_id()
$$;

-- إجمالي تكلفة الرواتب لتقرير P&L — رقم واحد، لأصحاب صلاحية التقارير/المحاسبة/الرواتب فقط
create or replace function app_payroll_cost(p_month int, p_year int, p_branch uuid default null)
returns numeric language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v numeric;
begin
  if not (app_is_super_admin() or app_has_perm('reports')
          or app_has_perm('accounting') or app_has_perm('payroll')) then
    return null;
  end if;
  select coalesce(sum(pr.amount_due), 0) into v
  from payroll_records pr
  join payroll_months pm on pm.id = pr.payroll_month_id
  join employees e on e.id = pr.employee_id
  where pm.month = p_month and pm.year = p_year
    and (p_branch is null or e.branch_id = p_branch);
  return v;
end $$;

grant execute on function app_branch_payroll_peers(uuid), app_payroll_cost(int, int, uuid) to authenticated;

-- ──────────────────────────────────────────────────────────────────────────────
-- (3) payroll_records
-- ──────────────────────────────────────────────────────────────────────────────
drop policy if exists authenticated_all on payroll_records;
drop policy if exists pr_select on payroll_records;
drop policy if exists pr_ins on payroll_records;
drop policy if exists pr_upd on payroll_records;
drop policy if exists pr_del on payroll_records;

create policy pr_select on payroll_records for select to authenticated
  using (employee_id = app_current_employee_id() or app_is_super_admin());
create policy pr_ins on payroll_records for insert to authenticated with check (true);
create policy pr_upd on payroll_records for update to authenticated using (true) with check (true);
create policy pr_del on payroll_records for delete to authenticated using (true);

-- ──────────────────────────────────────────────────────────────────────────────
-- (4) salary_increases — مدير النظام فقط
-- ──────────────────────────────────────────────────────────────────────────────
drop policy if exists authenticated_all on salary_increases;
drop policy if exists si_all on salary_increases;

create policy si_all on salary_increases for all to authenticated
  using (app_is_super_admin()) with check (app_is_super_admin());

-- ──────────────────────────────────────────────────────────────────────────────
-- (5) violations
-- ──────────────────────────────────────────────────────────────────────────────
drop policy if exists authenticated_all on violations;
drop policy if exists v_select on violations;
drop policy if exists v_ins on violations;
drop policy if exists v_upd on violations;
drop policy if exists v_del on violations;

create policy v_select on violations for select to authenticated
  using (employee_id = app_current_employee_id() or not app_is_basic_employee());
create policy v_ins on violations for insert to authenticated with check (true);
create policy v_upd on violations for update to authenticated using (true) with check (true);
create policy v_del on violations for delete to authenticated
  using (app_is_super_admin() or app_has_perm('violations') or app_has_perm('hr'));

-- ──────────────────────────────────────────────────────────────────────────────
-- (6) absences
-- ──────────────────────────────────────────────────────────────────────────────
drop policy if exists authenticated_all on absences;
drop policy if exists a_select on absences;
drop policy if exists a_ins on absences;
drop policy if exists a_upd on absences;
drop policy if exists a_del on absences;

create policy a_select on absences for select to authenticated
  using (employee_id = app_current_employee_id() or not app_is_basic_employee());
create policy a_ins on absences for insert to authenticated with check (true);
create policy a_upd on absences for update to authenticated using (true) with check (true);
create policy a_del on absences for delete to authenticated
  using (app_is_super_admin() or app_has_perm('violations') or app_has_perm('hr'));

-- ──────────────────────────────────────────────────────────────────────────────
-- (7) بوابة التحقق — أي فشل يُلغي المعاملة كلها
-- ──────────────────────────────────────────────────────────────────────────────
do $$
declare bad text := '';
begin
  -- authenticated_all اختفت من الجداول الأربعة
  if exists (select 1 from pg_policies where schemaname='public'
             and tablename in ('payroll_records','salary_increases','violations','absences')
             and policyname='authenticated_all') then
    bad := bad || 'authenticated_all لا يزال موجوداً؛ ';
  end if;

  -- السياسات الجديدة موجودة بالعدد الصحيح
  if (select count(*) from pg_policies where schemaname='public' and tablename='payroll_records'
      and policyname in ('pr_select','pr_ins','pr_upd','pr_del')) <> 4 then bad := bad || 'payroll_records؛ '; end if;
  if (select count(*) from pg_policies where schemaname='public' and tablename='salary_increases'
      and policyname = 'si_all') <> 1 then bad := bad || 'salary_increases؛ '; end if;
  if (select count(*) from pg_policies where schemaname='public' and tablename='violations'
      and policyname in ('v_select','v_ins','v_upd','v_del')) <> 4 then bad := bad || 'violations؛ '; end if;
  if (select count(*) from pg_policies where schemaname='public' and tablename='absences'
      and policyname in ('a_select','a_ins','a_upd','a_del')) <> 4 then bad := bad || 'absences؛ '; end if;

  -- الدوال الثمانى موجودة وكلها SECURITY DEFINER
  if (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.prosecdef and p.proname in (
        'app_current_employee_id','app_current_role','app_current_branch_id',
        'app_has_perm','app_is_super_admin','app_is_basic_employee',
        'app_branch_payroll_peers','app_payroll_cost')) <> 8 then
    bad := bad || 'الدوال المساعدة؛ ';
  end if;

  -- تنفيذ تجريبي (لا يجب أن يرمي خطأ)
  perform app_current_employee_id();
  perform app_is_basic_employee();
  perform app_has_perm('payroll');

  if bad <> '' then
    raise exception 'FAIL: %', bad;
  end if;

  raise notice '════════════════════════════════════';
  raise notice 'ALL CHECKS PASSED — COMMIT below saves';
  raise notice '════════════════════════════════════';
end $$;

-- ──────────────────────────────────────────────────────────────────────────────
-- (8) الحفظ
-- ──────────────────────────────────────────────────────────────────────────────
commit;


-- ══════════════════════════════════════════════════════════════════════════════
--  اختبار ما بعد الحفظ
-- ══════════════════════════════════════════════════════════════════════════════
--  • مدير النظام: صفحة الرواتب + صفحة الموظفين تفتحان؛ P&L يعرض رقم الرواتب.
--  • branch_manager: الرواتب/الموظفين محجوبتان؛ "راتبي" تعرض كشفه + الترتيب؛ P&L سليم.
--  • موظف مطبخ: "راتبي" كشفه فقط + الترتيب؛ لا وصول للرواتب/الموظفين.
--  • Console داخل "راتبي" كموظف مطبخ:
--      await sb.from('payroll_records').select('*')                       // صفّه فقط
--      await sb.from('salary_increases').select('*')                      // صفر صفوف
--      await sb.from('violations').select('*').neq('employee_id','<id>')   // صفر صفوف
--      await sb.from('violations').delete().eq('id','<id>')               // صفر متأثرة / خطأ
--  • عدم انكسار: اعتماد "سلفة راتب" كـ branch_manager؛ كاشير يسجّل خصم عجز؛ صفحة الحضور لمشرف.


-- ══════════════════════════════════════════════════════════════════════════════
--  التراجع للطوارئ
-- ══════════════════════════════════════════════════════════════════════════════
-- begin;
-- do $$
-- declare t text;
-- begin
--   foreach t in array array['payroll_records','salary_increases','violations','absences'] loop
--     execute format('drop policy if exists pr_select on %I', t);
--     execute format('drop policy if exists pr_ins on %I', t);
--     execute format('drop policy if exists pr_upd on %I', t);
--     execute format('drop policy if exists pr_del on %I', t);
--     execute format('drop policy if exists si_all on %I', t);
--     execute format('drop policy if exists v_select on %I', t);
--     execute format('drop policy if exists v_ins on %I', t);
--     execute format('drop policy if exists v_upd on %I', t);
--     execute format('drop policy if exists v_del on %I', t);
--     execute format('drop policy if exists a_select on %I', t);
--     execute format('drop policy if exists a_ins on %I', t);
--     execute format('drop policy if exists a_upd on %I', t);
--     execute format('drop policy if exists a_del on %I', t);
--     execute format('create policy authenticated_all on %I for all to authenticated using (true) with check (true)', t);
--   end loop;
-- end $$;
-- commit;
