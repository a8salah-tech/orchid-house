-- ══════════════════════════════════════════════════════════════════════════════
--  طلبات الاستقالة: يراها (للاطلاع فقط) مدير الصالة ومدير المطبخ، والموافقة لمدير النظام وحده
-- ══════════════════════════════════════════════════════════════════════════════
--  قبل هذا الملف: سياسة resignation_confidential (RESTRICTIVE، لكل العمليات) تقصر طلب الاستقالة على صاحبه ومدير النظام.
--  بعده:
--    • القراءة (SELECT): صاحب الطلب، ومدير النظام، ومدير الصالة (hall_manager) لموظفي «الصالة» في فرعه،
--      ومدير المطبخ (kitchen_manager) لموظفي «المطبخ والبار والحلويات» في فرعه (نفس نطاقه في باقي الصفحات).
--    • الإدراج/التعديل/الحذف: كما كانت تمامًا (صاحب الطلب يُدرج طلبه هو؛ التعديل والاعتماد لمدير النظام فقط).
--      وحارس za_resignation_guard يمنع أي تعديل لغير مدير النظام على مستوى قاعدة البيانات أيضًا.
--  لا يغيّر أي سياسات أخرى. يعتمد على دوال db/rls_stage_a.sql.
--  التشغيل: انسخ الملف كله في Supabase SQL Editor → Run. معاملة واحدة وآمن لإعادة التشغيل.
--  التراجع: أعد تشغيل db/resignation_requests.sql (القسم 3 يعيد السياسة الواحدة).
-- ══════════════════════════════════════════════════════════════════════════════

begin;

do $$
begin
  if not exists (select 1 from pg_proc where proname = 'app_current_branch_id')
     or not exists (select 1 from pg_proc where proname = 'app_current_role')
     or not exists (select 1 from pg_proc where proname = 'app_is_super_admin') then
    raise exception 'شغّل db/rls_stage_a.sql أولًا (الدوال المساعدة غير موجودة)';
  end if;
end $$;

-- هل يحق للمستدعي (مدير الصالة/المطبخ) رؤية استقالة هذا الموظف؟ (نفس الفرع + نطاق القسم)
create or replace function app_can_view_resignation_of(p_employee uuid)
returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.employees e
    where e.id = p_employee
      and app_current_branch_id() is not null
      and e.branch_id = app_current_branch_id()
      and (
        (app_current_role() = 'hall_manager' and e.department = 'الصالة')
        or (app_current_role() = 'kitchen_manager' and e.department in ('المطبخ', 'البار', 'الحلويات'))
      )
  )
$$;
grant execute on function app_can_view_resignation_of(uuid) to authenticated;

-- استبدال السياسة الواحدة (لكل العمليات) بأربع سياسات: القراءة أوسع، وغيرها كما كانت
drop policy if exists resignation_confidential on public.employee_requests;
drop policy if exists resignation_confidential_select on public.employee_requests;
drop policy if exists resignation_confidential_insert on public.employee_requests;
drop policy if exists resignation_confidential_update on public.employee_requests;
drop policy if exists resignation_confidential_delete on public.employee_requests;

create policy resignation_confidential_select on public.employee_requests
  as restrictive for select to authenticated
  using (request_type <> 'resignation' or employee_id = (select app_current_employee_id()) or (select app_is_super_admin())
         or app_can_view_resignation_of(employee_id));

create policy resignation_confidential_insert on public.employee_requests
  as restrictive for insert to authenticated
  with check (request_type <> 'resignation' or employee_id = (select app_current_employee_id()) or (select app_is_super_admin()));

create policy resignation_confidential_update on public.employee_requests
  as restrictive for update to authenticated
  using (request_type <> 'resignation' or employee_id = (select app_current_employee_id()) or (select app_is_super_admin()))
  with check (request_type <> 'resignation' or employee_id = (select app_current_employee_id()) or (select app_is_super_admin()));

create policy resignation_confidential_delete on public.employee_requests
  as restrictive for delete to authenticated
  using (request_type <> 'resignation' or employee_id = (select app_current_employee_id()) or (select app_is_super_admin()));

-- ── بوابة التحقق ──
do $$
declare bad text := '';
begin
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'employee_requests' and policyname = 'resignation_confidential') then bad := bad || 'السياسة القديمة ما زالت موجودة؛ '; end if;
  if (select count(*) from pg_policies where schemaname = 'public' and tablename = 'employee_requests' and policyname like 'resignation\_confidential\_%') <> 4 then bad := bad || 'عدد السياسات الجديدة؛ '; end if;
  if not exists (select 1 from pg_proc where proname = 'app_can_view_resignation_of') then bad := bad || 'الدالة؛ '; end if;
  if not exists (select 1 from pg_trigger where tgname = 'za_resignation_guard') then bad := bad || 'حارس الاستقالة (شغّل db/resignation_requests.sql)؛ '; end if;
  if bad <> '' then raise exception 'FAIL: %', bad; end if;
end $$;

commit;

notify pgrst, 'reload schema';
