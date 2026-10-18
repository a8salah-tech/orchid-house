-- ══════════════════════════════════════════════════════════════════════════════
--  طلب الاستقالة (request_type = 'resignation')
-- ══════════════════════════════════════════════════════════════════════════════
--  الدورة:  pending (طلب مُرسَل، ليس استقالة معتمدة)
--           → approved (موافقة مبدئية من مدير النظام: تبدأ مدة الإشعار ويُحسب آخر يوم عمل)
--           → completed (يقرّر مدير النظام يدويًا: التزم بالمدة / لم يلتزم، ويُنهى التفعيل)
--           أو rejected.
--  • مدة الإشعار بعد القبول: الصالة 15 يومًا، المطبخ (والبار والحلويات) 30 يومًا، وباقي الأقسام 30 يومًا.
--  • من لم يلتزم بالمدة: لا راتب له عن الشهر الأخير وأي شهر لاحق غير مدفوع (تطبّقه صفحة الرواتب).
--  • سريّة تامة: لا يرى الطلب إلا صاحبه ومدير النظام (حتى مديرو الأقسام ومساعدوهم لا يرونه).
--  • الاعتماد والتعديل لمدير النظام فقط؛ الموظف يُرسل طلبه لنفسه فقط ولا يستطيع تعديله أو سحبه بعد الإرسال.
--  الأعمدة الجديدة (في employee_requests):
--    resignation_notice_days  مدة الإشعار بالأيام (تُثبَّت عند القبول)
--    resignation_last_day     آخر يوم عمل = تاريخ القبول + مدة الإشعار
--    resignation_outcome      complied | violated  (قرار مدير النظام اليدوي)
--  يعتمد على دوال db/rls_stage_a.sql (app_is_super_admin, app_current_employee_id).
--  التشغيل: انسخ الملف كله في Supabase SQL Editor → Run. معاملة واحدة، وآمن لإعادة التشغيل.
--  ⚠️ شغّله **قبل** رفع النسخة (الواجهة تكتب الأعمدة الجديدة).
--
--  التراجع:  drop policy if exists resignation_confidential on public.employee_requests;
--            drop trigger if exists za_resignation_guard on public.employee_requests;
-- ══════════════════════════════════════════════════════════════════════════════

begin;

do $$
begin
  if not exists (select 1 from pg_proc where proname = 'app_is_super_admin')
     or not exists (select 1 from pg_proc where proname = 'app_current_employee_id') then
    raise exception 'شغّل db/rls_stage_a.sql أولًا (الدوال المساعدة غير موجودة)';
  end if;
end $$;

-- ── 1) الأعمدة ────────────────────────────────────────────────────────────────
alter table public.employee_requests add column if not exists resignation_notice_days integer;
alter table public.employee_requests add column if not exists resignation_last_day date;
alter table public.employee_requests add column if not exists resignation_outcome text;

-- ── 2) قيد نوع الطلب يقبل 'resignation' (بنفس الأنواع الموجودة فعلًا) ──────────
do $$
declare
  c record;
  had_constraint boolean := false;
  allowed text[];
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.employee_requests'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%request_type%'
  loop
    had_constraint := true;
    execute format('alter table public.employee_requests drop constraint %I', c.conname);
  end loop;

  if had_constraint then
    select array_agg(distinct t) into allowed from (
      select request_type as t from public.employee_requests
      union select unnest(array[
        'leave_sick', 'leave_emergency', 'extra_meal', 'complaint', 'suggestion', 'other',
        'attendance_correction', 'salary_increase', 'salary_advance', 'shift_assigned', 'early_exit_permit',
        'resignation'
      ])
    ) s;
    execute format(
      'alter table public.employee_requests add constraint employee_requests_request_type_check check (request_type = any (%L::text[]))',
      allowed
    );
  end if;
end $$;

alter table public.employee_requests drop constraint if exists employee_requests_resignation_outcome_check;
alter table public.employee_requests add constraint employee_requests_resignation_outcome_check
  check (resignation_outcome is null or resignation_outcome in ('complied', 'violated'));

-- طلب استقالة واحد مفتوح فقط لكل موظف (قيد الانتظار أو مقبول)
create unique index if not exists employee_requests_one_open_resignation
  on public.employee_requests (employee_id)
  where request_type = 'resignation' and status in ('pending', 'approved');

-- ── 3) السريّة: لا يرى/يكتب طلبات الاستقالة إلا صاحبها أو مدير النظام ───────────
--  سياسة RESTRICTIVE تُضاف فوق أي سياسة قائمة (AND)، فلا تتأثر باقي أنواع الطلبات.
drop policy if exists resignation_confidential on public.employee_requests;
create policy resignation_confidential on public.employee_requests
  as restrictive for all to authenticated
  using (request_type <> 'resignation' or employee_id = app_current_employee_id() or app_is_super_admin())
  with check (request_type <> 'resignation' or employee_id = app_current_employee_id() or app_is_super_admin());

-- ── 4) حارس: غير مدير النظام يُدرج طلبه هو فقط بحالة pending، ولا يعدّل ولا يسحب ─
create or replace function app_resignation_guard()
returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  -- service_role / SQL Editor (auth.uid() = null) ومدير النظام لا يتأثران
  if auth.uid() is null or app_is_super_admin() then return new; end if;

  if tg_op = 'INSERT' then
    if new.request_type = 'resignation' then
      if new.employee_id is distinct from app_current_employee_id() then
        raise exception 'طلب الاستقالة يُقدَّم من الموظف نفسه فقط';
      end if;
      if new.status is distinct from 'pending'
         or new.resignation_outcome is not null
         or new.resignation_notice_days is not null
         or new.resignation_last_day is not null then
        raise exception 'طلب الاستقالة يبدأ دائمًا بحالة قيد الانتظار';
      end if;
    end if;
    return new;
  end if;

  -- UPDATE: أي تعديل على طلب استقالة (أو تحويل طلب إلى استقالة) لمدير النظام فقط
  if old.request_type = 'resignation' or new.request_type = 'resignation' then
    raise exception 'لا يمكن تعديل طلب الاستقالة أو سحبه — الاعتماد لمدير النظام فقط';
  end if;
  return new;
end $$;

drop trigger if exists za_resignation_guard on public.employee_requests;
create trigger za_resignation_guard before insert or update on public.employee_requests
  for each row execute function app_resignation_guard();

-- ── 5) إشعار مساعدي الصالة: يتجاهل الاستقالة (سريّة) ──────────────────────────
create or replace function trg_notify_hall_assistants_request()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.request_type in ('salary_increase','salary_advance','shift_assigned','attendance_correction','resignation') then
    return new;
  end if;
  begin
    perform app_notify_hall_assistants(
      new.employee_id, 'request', '📋 طلب جديد من موظف في قسمك',
      coalesce(nullif(new.title, ''), new.request_type, 'طلب')
    );
  exception when others then null;
  end;
  return new;
end $$;

-- ── 6) دالة لصفحة الرواتب: من فقد راتبه لعدم التزامه بمدة الإشعار، ومن أي شهر ──────
--  لا يقرأ جدول الطلبات مباشرة (سرّي) — الدالة تُرجع فقط (الموظف، شهر نهاية الخدمة) وفقط لمدير النظام ومدير الفرع.
create or replace function app_resignation_forfeits()
returns table (employee_id uuid, final_month date)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not (app_is_super_admin() or app_current_role() = 'branch_manager') then return; end if;
  return query
    select r.employee_id,
           date_trunc('month', coalesce(e.deactivated_at::text, r.resignation_last_day::text, r.approved_at::text)::date)::date
      from employee_requests r
      join employees e on e.id = r.employee_id
     where r.request_type = 'resignation' and r.resignation_outcome = 'violated';
end $$;
grant execute on function app_resignation_forfeits() to authenticated;

-- ── بوابة التحقق ──────────────────────────────────────────────────────────────
do $$
declare bad text := '';
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'employee_requests' and column_name = 'resignation_last_day') then bad := bad || 'الأعمدة؛ '; end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'employee_requests' and policyname = 'resignation_confidential') then bad := bad || 'سياسة السريّة؛ '; end if;
  if not exists (select 1 from pg_trigger where tgname = 'za_resignation_guard') then bad := bad || 'الحارس؛ '; end if;
  if bad <> '' then raise exception 'FAIL: %', bad; end if;
end $$;

commit;

notify pgrst, 'reload schema';
