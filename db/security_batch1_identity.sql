-- ══════════════════════════════════════════════════════════════════════════════
--  تأمين — الدفعة 1: الهوية والصلاحيات والإحداثيات وأشهر الرواتب
-- ══════════════════════════════════════════════════════════════════════════════
--  المشكلة (مؤكَّدة من pg_policies): الجداول employees و roles_permissions و branches و payroll_months عليها
--  authenticated_all، أي موظف مسجّل (حتى عامل نظافة) يقدر من متصفحه:
--    • يغيّر دوره إلى admin أو يعدّل صلاحيات أي دور  ← يفتح له كل الرواتب والمخالفات.
--    • يغيّر إحداثيات الفرع ونطاق الحضور  ← يلغي حماية الموقع.
--    • يغيّر حالة شهر الرواتب (إقفال/اعتماد).
--
--  المسارات التي تكتب في هذه الجداول (فُحصت في الكود) ولن تتأثر:
--    • employees         : صفحة الموظفين + الهيكل التنظيمي (كلتاهما لمدير النظام)، ومسارات الخادم (service_role تتجاوز RLS).
--    • roles_permissions : صفحة إدارة الصلاحيات (مدير النظام).
--    • branches          : صفحة صور الفروع (مدير النظام).
--    • payroll_months    : صفحة الرواتب (مدير النظام: إنشاء وإقفال)، وصفحة طلبات الموظفين تنشئ شهرًا مبدئيًا (draft) عند
--                          اعتماد سلفة من مدير فرع — لذلك نُبقي الإضافة المبدئية مفتوحة للأدوار غير الأساسية.
--
--  ما يتغيّر:
--    employees         : القراءة للجميع كما هي. الإضافة والحذف لمدير النظام فقط. التعديل لمدير النظام، أو الموظف على صفّه هو
--                        وفي ثلاثة أعمدة فقط (photo_url, phone, email) — أي عمود آخر يُرفض بتريغر.
--    roles_permissions : القراءة للجميع (الواجهة تحتاجها)، والكتابة لمدير النظام أو من يملك صلاحية permissions.
--    branches          : القراءة للجميع (والزائر المجهول كما هو)، والكتابة لمدير النظام.
--    payroll_months    : القراءة للجميع، الإضافة بحالة draft لغير الأساسيين، والتعديل/الحذف لمدير النظام.
--
--  التراجع (لو حصل خلل): نفّذ بالترتيب
--    drop trigger if exists employees_guard on employees;
--    create policy authenticated_all on employees for all to authenticated using (true) with check (true);
--    create policy authenticated_all on roles_permissions for all to authenticated using (true) with check (true);
--    create policy authenticated_all on branches for all to authenticated using (true) with check (true);
--    create policy authenticated_all on payroll_months for all to authenticated using (true) with check (true);
--
--  يعتمد على دوال db/rls_stage_a.sql (app_is_super_admin, app_has_perm, app_is_basic_employee, app_current_employee_id).
--  التشغيل: انسخ الملف كله في Supabase SQL Editor → Run. معاملة واحدة: أي فشل في بوابة التحقق يُلغي كل شيء.
-- ══════════════════════════════════════════════════════════════════════════════

begin;

do $$
begin
  if not exists (select 1 from pg_proc where proname = 'app_is_super_admin')
     or not exists (select 1 from pg_proc where proname = 'app_has_perm')
     or not exists (select 1 from pg_proc where proname = 'app_is_basic_employee')
     or not exists (select 1 from pg_proc where proname = 'app_current_employee_id') then
    raise exception 'شغّل db/rls_stage_a.sql أولًا (الدوال المساعدة غير موجودة)';
  end if;
end $$;

-- ── 1) employees ──────────────────────────────────────────────────────────────
drop policy if exists authenticated_all on public.employees;
drop policy if exists emp_select on public.employees;
drop policy if exists emp_ins on public.employees;
drop policy if exists emp_upd on public.employees;
drop policy if exists emp_del on public.employees;

create policy emp_select on public.employees for select to authenticated using (true);
create policy emp_ins    on public.employees for insert to authenticated with check (app_is_super_admin());
create policy emp_upd    on public.employees for update to authenticated
  using (app_is_super_admin() or id = app_current_employee_id())
  with check (app_is_super_admin() or id = app_current_employee_id());
create policy emp_del    on public.employees for delete to authenticated using (app_is_super_admin());

-- غير مدير النظام (الموظف على صفّه هو): لا يغيّر إلا photo_url و phone و email. service_role / SQL Editor (auth.uid() = null) لا تتأثر
create or replace function app_employees_guard()
returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is null or app_is_super_admin() then return new; end if;
  if (to_jsonb(new) - array['photo_url', 'phone', 'email']) is distinct from (to_jsonb(old) - array['photo_url', 'phone', 'email']) then
    raise exception 'غير مسموح بتعديل هذه البيانات — لمدير النظام فقط';
  end if;
  return new;
end $$;

drop trigger if exists employees_guard on public.employees;
create trigger employees_guard before update on public.employees
  for each row execute function app_employees_guard();

-- ── 2) roles_permissions ──────────────────────────────────────────────────────
drop policy if exists authenticated_all on public.roles_permissions;
drop policy if exists rp_select on public.roles_permissions;
drop policy if exists rp_write on public.roles_permissions;

create policy rp_select on public.roles_permissions for select to authenticated using (true);
create policy rp_write  on public.roles_permissions for all to authenticated
  using (app_is_super_admin() or app_has_perm('permissions'))
  with check (app_is_super_admin() or app_has_perm('permissions'));

-- ── 3) branches (anon_read تبقى كما هي) ────────────────────────────────────────
drop policy if exists authenticated_all on public.branches;
drop policy if exists branches_read on public.branches;
drop policy if exists branches_write on public.branches;

create policy branches_read  on public.branches for select to authenticated using (true);
create policy branches_write on public.branches for all to authenticated
  using (app_is_super_admin()) with check (app_is_super_admin());

-- ── 4) payroll_months ─────────────────────────────────────────────────────────
drop policy if exists authenticated_all on public.payroll_months;
drop policy if exists pm_select on public.payroll_months;
drop policy if exists pm_ins on public.payroll_months;
drop policy if exists pm_admin on public.payroll_months;

create policy pm_select on public.payroll_months for select to authenticated using (true);
create policy pm_ins    on public.payroll_months for insert to authenticated
  with check (not app_is_basic_employee() and status = 'draft');
create policy pm_admin  on public.payroll_months for all to authenticated
  using (app_is_super_admin()) with check (app_is_super_admin());

-- ── بوابة التحقق ──────────────────────────────────────────────────────────────
do $$
declare bad text := '';
begin
  if exists (select 1 from pg_policies where schemaname = 'public'
              and tablename in ('employees', 'roles_permissions', 'branches', 'payroll_months')
              and policyname = 'authenticated_all') then
    bad := bad || 'authenticated_all ما زالت موجودة؛ ';
  end if;
  if (select count(*) from pg_policies where schemaname = 'public' and tablename = 'employees') <> 4 then bad := bad || 'employees؛ '; end if;
  if (select count(*) from pg_policies where schemaname = 'public' and tablename = 'roles_permissions') <> 2 then bad := bad || 'roles_permissions؛ '; end if;
  if (select count(*) from pg_policies where schemaname = 'public' and tablename = 'branches' and policyname in ('anon_read', 'branches_read', 'branches_write')) <> 3 then bad := bad || 'branches؛ '; end if;
  if (select count(*) from pg_policies where schemaname = 'public' and tablename = 'payroll_months') <> 3 then bad := bad || 'payroll_months؛ '; end if;
  if not exists (select 1 from pg_trigger where tgname = 'employees_guard') then bad := bad || 'employees_guard؛ '; end if;
  if bad <> '' then raise exception 'FAIL: %', bad; end if;
end $$;

commit;

notify pgrst, 'reload schema';
