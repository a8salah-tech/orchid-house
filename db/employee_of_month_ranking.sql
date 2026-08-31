-- ══════════════════════════════════════════════════════════════════════════════
--  دالة ترتيب "الموظف المثالي" — نفس معادلة صفحة "دور استلام المرتب"
-- ══════════════════════════════════════════════════════════════════════════════
--
--  المشكلة: صفحة "الموظف المثالي" كانت ترتّب حسب عدد أيام الحضور فقط (موظف يتأخر
--  كل يوم لكنه يحضر = 100%)، فتختلف عن صفحة "دور استلام المرتب" التي تخصم على
--  ساعات التأخير والغياب.
--
--  الحل: دالة SECURITY DEFINER تحسب الترتيب في السيرفر بنفس معادلة دور الاستلام:
--    attendance_score = 100 − (late_hours×3 + absence_days×15 + خصم غياب ? 10 : 0)
--    combined         = attendance_score×0.5 + eval_score×0.5
--  وتبقى تتطلّب تقييماً معتمداً للشهر نفسه.
--
--  التشغيل: انسخ الملف كله في Supabase SQL Editor → Run مرة واحدة.
-- ══════════════════════════════════════════════════════════════════════════════

begin;

drop function if exists app_month_recognition(int, int);

create function app_month_recognition(p_month int, p_year int)
returns table (
  employee_id      uuid,
  name             text,
  name_en          text,
  photo_url        text,
  department       text,
  branch_name      text,
  eval_score       numeric,
  attendance_score numeric,
  combined         numeric,
  has_attended     boolean
)
language sql stable security definer set search_path = public, pg_temp as $$
  with pm as (
    select id from payroll_months where month = p_month and year = p_year limit 1
  ),
  ev as (
    select distinct on (ee.employee_id)
      ee.employee_id,
      coalesce(ee.total_score, 0)::numeric as eval_score
    from employee_evaluations ee
    where ee.month = p_month and ee.year = p_year and ee.status = 'approved'
    order by ee.employee_id, ee.created_at desc nulls last
  ),
  att as (
    select distinct a.employee_id
    from attendance a
    where a.check_in_time is not null
      and a.date between make_date(p_year, p_month, 1)
                     and (make_date(p_year, p_month, 1) + interval '1 month - 1 day')::date
  ),
  pr as (
    select r.employee_id,
           coalesce(r.late_hours, 0)::numeric        as late_hours,
           coalesce(r.early_exit_hours, 0)::numeric  as early_hours,
           coalesce(r.absence_days, 0)::numeric      as absence_days,
           (coalesce(r.deduction_2, 0)::numeric > 0) as has_ded2
    from payroll_records r
    join pm on pm.id = r.payroll_month_id
  ),
  scored as (
    select
      ev.employee_id,
      round(ev.eval_score, 1) as eval_score,
      (att.employee_id is not null) as has_attended,
      round(
        case when att.employee_id is not null then
          greatest(0::numeric, 100
            - coalesce(pr.late_hours, 0)   * 3
            - coalesce(pr.early_hours, 0)  * 3
            - coalesce(pr.absence_days, 0) * 15
            - (case when coalesce(pr.has_ded2, false) then 10 else 0 end))
        else 0::numeric end
      , 1) as attendance_score
    from ev
    left join att on att.employee_id = ev.employee_id
    left join pr  on pr.employee_id  = ev.employee_id
  )
  select
    e.id, e.name, e.name_en, e.photo_url,
    e.department, b.name,
    s.eval_score,
    s.attendance_score,
    round(s.attendance_score * 0.5 + s.eval_score * 0.5, 1) as combined,
    s.has_attended
  from scored s
  join employees e on e.id = s.employee_id
  left join branches b on b.id = e.branch_id
  where coalesce(e.is_active, true)
  order by round(s.attendance_score * 0.5 + s.eval_score * 0.5, 1) desc
$$;

grant execute on function app_month_recognition(int, int) to authenticated;

do $$
begin
  if not exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
                 where n.nspname='public' and p.proname='app_month_recognition' and p.prosecdef) then
    raise exception 'FAIL: app_month_recognition missing or not SECURITY DEFINER';
  end if;
  perform * from app_month_recognition(
    extract(month from current_date)::int, extract(year from current_date)::int);
  raise notice 'ALL CHECKS PASSED — COMMIT below saves';
end $$;

commit;


-- ══════════════════════════════════════════════════════════════════════════════
--  اختبار بعد الحفظ (بدّل الشهر/السنة):
--    select * from app_month_recognition(8, 2026) order by combined desc;
--
--  التراجع:
--    drop function if exists app_month_recognition(int, int);
-- ══════════════════════════════════════════════════════════════════════════════
