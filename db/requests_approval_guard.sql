-- ══════════════════════════════════════════════════════════════════════════════
--  حماية اعتماد طلبات الموظفين (employee_requests) في قاعدة البيانات + سجل تدقيق
-- ══════════════════════════════════════════════════════════════════════════════
--  المشكلة (موثّقة): قيد «لا يعتمد الموظف طلبه» ومن يحق له الاعتماد كانا في الصفحة فقط. أي موظف مسجّل دخوله يستطيع تعديل حالة
--  أي طلب مباشرة، وحقل «معتمَد بواسطة» نصّ يكتبه المتصفح (قابل للتزوير)، والجدول بلا سجل تدقيق. وُجد 70 طلباً معتمَداً
--  باسم صاحبه نفسه (مثل الإجازة الطارئة #1781).
--
--  ما يفعله هذا الملف:
--   1) تريغر حارس (BEFORE INSERT/UPDATE) لغير مدير النظام:
--      • الإدراج: الطلب يبدأ دائماً pending بلا معتمِد، عدا إشعار الجدول shift_assigned (يُدرجه المديرون بحالة approved).
--      • التعديل (= اعتماد/رفض/إكمال/حفظ مبلغ): يُرفض إلا إذا كان المنفِّذ
--          – ليس صاحب الطلب نفسه، وهو
--          – مدير فرع أو مدير مطبخ/صالة أو مساعد مدير مطبخ/صالة، وفي **فرع صاحب الطلب نفسه**،
--          – وأنواع الطلب المقصورة على مدير النظام (زيادة الراتب، تصحيح الحضور، الاستقالة) لا يعدّلها إلا مدير النظام،
--          – وسلفة الراتب لا يعتمدها إلا مدير الفرع (أو مدير النظام).
--      • اسم المعتمِد ووقت الاعتماد يكتبهما الخادم من حساب الدخول (لا يُوثَق بما يرسله المتصفح).
--   2) ربط الجدول بسجل التدقيق audit_log (من غيّر ماذا ومتى) من الآن فصاعداً.
--  لا يتغير شيء لمدير النظام ولا للتعديلات من SQL Editor/service_role.
--  لا يُعدِّل أي طلب قائم. (الطلبات الـ70 المعتمَدة بأسماء أصحابها تبقى كما هي لتراجعها.)
--  يعتمد على db/rls_stage_a.sql و db/audit_log.sql.
--  التشغيل: انسخ الملف كله في Supabase SQL Editor → Run. معاملة واحدة وآمن لإعادة التشغيل.
--  التراجع:  drop trigger if exists zb_requests_decision_guard on public.employee_requests;
--            drop trigger if exists zz_audit on public.employee_requests;
-- ══════════════════════════════════════════════════════════════════════════════

begin;

do $$
begin
  if not exists (select 1 from pg_proc where proname = 'app_is_super_admin')
     or not exists (select 1 from pg_proc where proname = 'app_current_employee_id') then
    raise exception 'شغّل db/rls_stage_a.sql أولًا';
  end if;
  if not exists (select 1 from pg_proc where proname = 'app_audit_trigger') then
    raise exception 'شغّل db/audit_log.sql أولًا (دالة app_audit_trigger غير موجودة)';
  end if;
end $$;

create or replace function app_requests_decision_guard()
returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  a_id uuid; a_name text; a_name_en text; a_role text; a_branch uuid;
  t_branch uuid;
  v_full text;
begin
  -- service_role / SQL Editor (auth.uid() = null) ومدير النظام لا يتأثران
  if auth.uid() is null or app_is_super_admin() then return new; end if;

  select e.id, e.name, e.name_en, e.role, e.branch_id
    into a_id, a_name, a_name_en, a_role, a_branch
    from employees e where e.auth_user_id = auth.uid() limit 1;

  -- ── إدراج طلب جديد ──
  if tg_op = 'INSERT' then
    -- إشعار جدول الشيفتات يُدرجه المديرون بحالة approved (كما تفعل صفحة الشيفتات)
    if new.request_type = 'shift_assigned' then
      new.approved_by := null; new.approved_at := null;
      return new;
    end if;
    -- أي طلب آخر لغير مدير النظام يبدأ قيد الانتظار بلا معتمِد (لا تزوير للاعتماد عند الإنشاء)
    new.status := 'pending';
    new.approved_by := null; new.approved_at := null; new.rejection_reason := null;
    return new;
  end if;

  -- ── تعديل طلب قائم (اعتماد / رفض / إكمال / حفظ مبلغ) ──
  if a_id is null then
    raise exception 'غير مسموح بتعديل الطلبات';
  end if;
  if a_id = old.employee_id then
    raise exception 'لا يمكنك اعتماد أو تعديل حالة طلبك بنفسك';
  end if;
  if old.request_type in ('salary_increase', 'attendance_correction', 'resignation') then
    raise exception 'هذا النوع من الطلبات لمدير النظام فقط';
  end if;
  if a_role is null or a_role not in ('branch_manager', 'kitchen_manager', 'hall_manager', 'kitchen_assistant_manager', 'hall_assistant_manager') then
    raise exception 'ليست لديك صلاحية اعتماد الطلبات';
  end if;
  if old.request_type = 'salary_advance' and a_role <> 'branch_manager' then
    raise exception 'سلفة الراتب يعتمدها مدير الفرع أو مدير النظام فقط';
  end if;
  select e.branch_id into t_branch from employees e where e.id = old.employee_id;
  if t_branch is distinct from a_branch then
    raise exception 'لا يمكنك اعتماد طلب موظف من فرع آخر';
  end if;

  -- اسم المعتمِد ووقته من الخادم (بنفس صيغة الواجهة: الاسم ثم (الاسم الإنجليزي))
  if new.status is distinct from old.status or new.approved_by is distinct from old.approved_by then
    v_full := coalesce(a_name, '') || case when coalesce(a_name_en, '') <> '' then ' (' || a_name_en || ')' else '' end;
    if new.status in ('approved', 'completed', 'rejected') then
      new.approved_by := v_full;
      if new.status in ('approved', 'completed') and new.status is distinct from old.status then
        new.approved_at := now();
      end if;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists zb_requests_decision_guard on public.employee_requests;
create trigger zb_requests_decision_guard before insert or update on public.employee_requests
  for each row execute function app_requests_decision_guard();

-- ── سجل التدقيق ──
drop trigger if exists zz_audit on public.employee_requests;
create trigger zz_audit after insert or update or delete on public.employee_requests
  for each row execute function app_audit_trigger();

-- ── بوابة التحقق ──
do $$
declare bad text := '';
begin
  if not exists (select 1 from pg_trigger where tgname = 'zb_requests_decision_guard') then bad := bad || 'الحارس؛ '; end if;
  if not exists (select 1 from pg_trigger where tgname = 'zz_audit' and tgrelid = 'public.employee_requests'::regclass) then bad := bad || 'التدقيق؛ '; end if;
  if bad <> '' then raise exception 'FAIL: %', bad; end if;
end $$;

commit;

notify pgrst, 'reload schema';
