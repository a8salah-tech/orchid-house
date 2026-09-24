-- ══════════════════════════════════════════════════════════════════════════════
--  إذن الخروج المبكر
-- ══════════════════════════════════════════════════════════════════════════════
--  • employee_requests.permit_time: ساعة الخروج المطلوبة في طلب "إذن خروج مبكر" (request_type = 'early_exit_permit').
--  • attendance.permit_minutes: الدقائق المغطاة بإذن معتمد يوم ذلك الحضور (تُخصم بسعر ساعة الموظف الحقيقي).
--    early_minutes يفضل للجزء بلا إذن فقط (يُخصم بالمبلغ الثابت 20 MYR للساعة) — فلا يتكرر الخصم.
--  • payroll_records.exit_permit_hours: مجموع ساعات الإذن في الشهر (تُحسب تلقائياً من الحضور عند إعادة حساب الشهر).
--  • لو فيه قيد CHECK على employee_requests.request_type يُستبدل بقيد يقبل النوع الجديد (بنفس الأنواع الموجودة فعلاً).
--  التشغيل: انسخ الملف كله في Supabase SQL Editor → Run. آمن لإعادة التشغيل.
-- ══════════════════════════════════════════════════════════════════════════════

alter table employee_requests add column if not exists permit_time time;
alter table attendance add column if not exists permit_minutes integer not null default 0;
alter table payroll_records add column if not exists exit_permit_hours numeric not null default 0;

do $$
declare
  c record;
  had_constraint boolean := false;
  allowed text[];
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'employee_requests'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%request_type%'
  loop
    had_constraint := true;
    execute format('alter table employee_requests drop constraint %I', c.conname);
  end loop;

  if had_constraint then
    select array_agg(distinct t) into allowed from (
      select request_type as t from employee_requests
      union select unnest(array[
        'leave_sick', 'leave_emergency', 'extra_meal', 'complaint', 'suggestion', 'other',
        'attendance_correction', 'salary_increase', 'salary_advance', 'shift_assigned', 'early_exit_permit'
      ])
    ) s;
    execute format(
      'alter table employee_requests add constraint employee_requests_request_type_check check (request_type = any (%L::text[]))',
      allowed
    );
  end if;
end $$;

notify pgrst, 'reload schema';
