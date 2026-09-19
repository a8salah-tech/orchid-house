-- ══════════════════════════════════════════════════════════════════════════════
--  احتساب أيام الغياب الحقيقية في ترتيب "راتبي" (توحيده مع "دور استلام الرواتب")
-- ══════════════════════════════════════════════════════════════════════════════
--  الغياب المحسوب تلقائياً من الشيفتات مخزَّن كنص داخل deduction_2_label
--  ("غياب بدون عذر (X يوم)")، بينما absence_days حقل يدوي يكاد يكون دائماً صفراً.
--  فنُرجع في absence_days المجموع: اليدوي + العدد المستخرج من النص.
--  نفس نوع الإرجاع السابق، فلا حاجة لـ DROP.
--  التشغيل: انسخ الملف كله في Supabase SQL Editor → Run. آمن لإعادة التشغيل.
-- ══════════════════════════════════════════════════════════════════════════════

create or replace function app_branch_payroll_peers(p_month_id uuid)
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
         (coalesce(pr.absence_days, 0)
           + coalesce((substring(pr.deduction_2_label from '(\d+)\s*يوم'))::numeric, 0))::numeric,
         coalesce(pr.deduction_2, 0) > 0
  from payroll_records pr
  join employees e on e.id = pr.employee_id
  where pr.payroll_month_id = p_month_id
    and e.is_active = true
    and e.branch_id = app_current_branch_id()
$$;

grant execute on function app_branch_payroll_peers(uuid) to authenticated;

notify pgrst, 'reload schema';
