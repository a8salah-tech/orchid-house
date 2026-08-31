-- ══════════════════════════════════════════════════════════════════════════════
--  توحيد ترتيب "راتبي" مع "دور استلام المرتب"
--  إضافة early_exit_hours إلى دالة app_branch_payroll_peers
-- ══════════════════════════════════════════════════════════════════════════════
--  صفحة "راتبي" تستدعي هذه الدالة لحساب ترتيب استلام الموظف. أضفنا ساعات الانصراف
--  المبكر لتُخصم مثل التأخير (نفس معادلة صفحة دور الاستلام بالظبط).
--  تغيير نوع الإرجاع يتطلّب DROP ثم CREATE.
--  التشغيل: انسخ كله في Supabase SQL Editor → Run.
-- ══════════════════════════════════════════════════════════════════════════════

begin;

drop function if exists app_branch_payroll_peers(uuid);

create function app_branch_payroll_peers(p_month_id uuid)
returns table (
  employee_id      uuid,
  late_hours       numeric,
  early_hours      numeric,
  absence_days     numeric,
  has_deduction_2  boolean
)
language sql stable security definer set search_path = public, pg_temp as $$
  select pr.employee_id,
         coalesce(pr.late_hours, 0)::numeric,
         coalesce(pr.early_exit_hours, 0)::numeric,
         coalesce(pr.absence_days, 0)::numeric,
         coalesce(pr.deduction_2, 0) > 0
  from payroll_records pr
  join employees e on e.id = pr.employee_id
  where pr.payroll_month_id = p_month_id
    and e.is_active = true
    and e.branch_id = app_current_branch_id()
$$;

grant execute on function app_branch_payroll_peers(uuid) to authenticated;

do $$
begin
  if not exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
                 where n.nspname='public' and p.proname='app_branch_payroll_peers' and p.prosecdef) then
    raise exception 'FAIL: app_branch_payroll_peers missing';
  end if;
  raise notice 'ALL CHECKS PASSED — COMMIT below saves';
end $$;

commit;
