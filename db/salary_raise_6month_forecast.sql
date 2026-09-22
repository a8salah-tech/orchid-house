-- ══════════════════════════════════════════════════════════════════════════════
--  طلب زيادة الراتب: القفل صار 6 أشهر من آخر زيادة فعلية (بدل 3 أشهر من آخر طلب)،
--  + عرض آخر زيادة (تاريخ ومبلغ)، + تقدير "هيرجع مستحق إمتى" لكل شرط زمني فشل حالياً
-- ══════════════════════════════════════════════════════════════════════════════
--  • last_raise_amount: مبلغ آخر زيادة فعلية اتمنحت (من salary_increases).
--  • next_allowed_at صار = تاريخ آخر زيادة + 6 أشهر (بدل تاريخ آخر طلب + 3 أشهر).
--    طلب اتقدَّم به ورُفض لا يمنع التقديم من جديد — فقط زيادة فعلية اتمنحت تمنع لمدة 6 أشهر.
--  • abs_resolves_at / late_resolves_at / viol_resolves_at: تاريخ متوقَّع يرجع فيه هذا الشرط
--    مستوفياً وحده، بافتراض عدم تكرار غياب/تأخير/مخالفة جديدة (نافذة الـ3 أشهر المتحركة بتاخد
--    وقت النقاط الحالية تلقائياً برجوع الوقت للخلف).
--  • absence_days صار يُحسب من اتحاد تواريخ الغياب الفعلية (تلقائي + يدوي) بدل أكبر عدد بينهما —
--    أدق، ولازم للتقدير الزمني.
--  التشغيل: انسخ الملف كله في Supabase SQL Editor → Run. آمن لإعادة التشغيل.
-- ══════════════════════════════════════════════════════════════════════════════

create or replace function app_salary_raise_check()
returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_emp     uuid := app_current_employee_id();
  v_today   date := (now() at time zone 'Asia/Kuala_Lumpur')::date;
  v_join    date;
  v_start   date;
  v_months  numeric := 0;
  v_avg     numeric;
  v_evals   int := 0;
  v_late    numeric := 0;
  v_early   numeric := 0;
  v_abs     int := 0;
  v_viol    int := 0;
  v_last_req timestamptz;
  v_last_raise date;
  v_last_raise_amount numeric;
  v_salary  numeric;
  v_ok_tenure boolean; v_ok_eval boolean; v_ok_abs boolean; v_ok_late boolean; v_ok_viol boolean; v_ok_lock boolean;
  v_att_score numeric;
  p_eval numeric; p_att numeric; p_viol numeric; p_ten numeric;
  v_abs_dates date[];
  v_abs_resolves date;
  v_late_resolves date;
  v_viol_resolves date;
  v_next_allowed date;
  v_next_possible date;
  v_late_running numeric;
  r record;
begin
  if v_emp is null then raise exception 'NO_EMPLOYEE'; end if;

  select e.join_date into v_join from employees e where e.id = v_emp;
  select c.salary into v_salary from employee_compensation c where c.employee_id = v_emp;

  v_start  := greatest(coalesce(v_join, v_today), (v_today - interval '3 months')::date);
  v_months := case when v_join is null then 0 else round((v_today - v_join)::numeric / 30.44, 1) end;

  select avg(t.total_score), count(*) into v_avg, v_evals from (
    select total_score from employee_evaluations
    where employee_id = v_emp and status = 'approved'
    order by year desc, month desc limit 3
  ) t;

  select coalesce(sum(late_minutes), 0) / 60.0, coalesce(sum(early_minutes), 0) / 60.0
    into v_late, v_early
  from attendance where employee_id = v_emp and date between v_start and v_today;

  -- ✅ اتحاد تواريخ الغياب الفعلية (تلقائي من الشيفتات + يدوي) — أدق من "الأكبر بين عددين"، ولازم للتقدير الزمني تحت
  select array_agg(d order by d) into v_abs_dates from (
    select s.date as d
    from shift_schedules s
    where s.employee_id = v_emp and s.status = 'confirmed'
      and (s.shift_id is not null or s.custom_start is not null)
      and s.date between v_start and v_today - 1
      and not exists (select 1 from attendance a
                      where a.employee_id = s.employee_id and a.date = s.date and a.check_in_time is not null)
    union
    select date as d from absences where employee_id = v_emp and status = 'active' and date between v_start and v_today
  ) u;
  v_abs := coalesce(array_length(v_abs_dates, 1), 0);

  select count(*) into v_viol from violations
  where employee_id = v_emp and status = 'active' and date >= v_start;

  select max(created_at) into v_last_req from employee_requests
  where employee_id = v_emp and request_type = 'salary_increase';

  select si.effective_date, si.amount into v_last_raise, v_last_raise_amount
  from salary_increases si where si.employee_id = v_emp order by si.effective_date desc limit 1;

  v_ok_tenure := v_join is not null and v_today >= (v_join + interval '1 month')::date;
  v_ok_eval   := v_evals > 0 and v_avg >= 80;
  v_ok_abs    := v_abs <= 2;
  v_ok_late   := v_late <= 5;
  v_ok_viol   := v_viol = 0;
  -- ✅ القفل صار على أساس آخر زيادة فعلية اتمنحت (6 أشهر)، مش على أساس آخر طلب اتقدَّم به (كان 3 أشهر)
  v_ok_lock   := v_last_raise is null or v_today >= (v_last_raise + interval '6 months')::date;

  -- ── تقديرات "هيرجع مستحق إمتى" لكل شرط زمني فشل حالياً (التقييم مستثنى؛ لا يتحسَّن بمرور الوقت وحده) ──
  if not v_ok_abs then
    v_abs_resolves := v_abs_dates[v_abs - 2] + interval '3 months' + interval '1 day';
  end if;

  if not v_ok_late then
    v_late_running := v_late * 60;
    for r in (select date, late_minutes from attendance
              where employee_id = v_emp and date between v_start and v_today and late_minutes > 0
              order by date asc)
    loop
      v_late_running := v_late_running - r.late_minutes;
      if v_late_running <= 300 then
        v_late_resolves := r.date + interval '3 months' + interval '1 day';
        exit;
      end if;
    end loop;
  end if;

  if not v_ok_viol then
    select (max(date) + interval '3 months' + interval '1 day')::date into v_viol_resolves
    from violations where employee_id = v_emp and status = 'active' and date >= v_start;
  end if;

  v_next_allowed := case when v_last_raise is null then null else (v_last_raise + interval '6 months')::date end;

  v_next_possible := greatest(
    case when not v_ok_tenure then (v_join + interval '1 month')::date else v_today end,
    case when not v_ok_abs then v_abs_resolves else v_today end,
    case when not v_ok_late then v_late_resolves else v_today end,
    case when not v_ok_viol then v_viol_resolves else v_today end,
    case when not v_ok_lock then v_next_allowed else v_today end
  );
  if v_ok_tenure and v_ok_abs and v_ok_late and v_ok_viol and v_ok_lock then
    v_next_possible := null; -- كل الشروط الزمنية متحققة؛ المتبقي (لو موجود) تقييم جديد فقط، ومش مؤكَّد بمرور الوقت
  end if;

  v_att_score := greatest(0, 100 - v_late * 3 - v_early * 3 - v_abs * 15);
  p_eval := round(coalesce(v_avg, 0) / 100 * 40, 1);
  p_att  := round(v_att_score / 100 * 20, 1);
  p_viol := case when v_viol = 0 then 10 else 0 end;
  p_ten  := round(least(5, v_months * 5 / 12), 1);

  return jsonb_build_object(
    'eligible', (v_ok_tenure and v_ok_eval and v_ok_abs and v_ok_late and v_ok_viol and v_ok_lock),
    'salary', v_salary,
    'join_date', v_join,
    'service_months', v_months,
    'eval_avg', round(v_avg, 1),
    'eval_count', v_evals,
    'absence_days', v_abs,
    'late_hours', round(v_late, 2),
    'early_hours', round(v_early, 2),
    'violations', v_viol,
    'window_start', v_start,
    'last_request_at', v_last_req,
    'next_allowed_at', v_next_allowed,
    'tenure_opens_at', case when v_join is null then null else (v_join + interval '1 month')::date end,
    'last_raise_at', v_last_raise,
    'last_raise_amount', v_last_raise_amount,
    'abs_resolves_at', v_abs_resolves,
    'late_resolves_at', v_late_resolves,
    'viol_resolves_at', v_viol_resolves,
    'next_possible_at', v_next_possible,
    'ok', jsonb_build_object('tenure', v_ok_tenure, 'eval', v_ok_eval, 'absence', v_ok_abs,
                             'late', v_ok_late, 'violations', v_ok_viol, 'lock', v_ok_lock),
    'points', jsonb_build_object('eval', p_eval, 'attendance', p_att, 'violations', p_viol,
                                 'tenure', p_ten, 'base', p_eval + p_att + p_viol + p_ten),
    'achievements', jsonb_build_array(
      'تدريب موظف جديد', 'تغطية شيفت إضافي', 'اقترح تطويراً أفاد المطعم',
      'شكر أو تقييم إيجابي من عميل', 'صفر أخطاء في الطلبات', 'الالتزام بمعايير النظافة',
      'حل مشكلة عميل بنجاح', 'الالتزام بالزي والمظهر', 'المشاركة في أي شيء آخر',
      'جاهزية للعمل في أكثر من قسم', 'دورة أو شهادة أكملها', 'اختيار موظف الشهر')
  );
end;
$$;
revoke all on function app_salary_raise_check() from public;
grant execute on function app_salary_raise_check() to authenticated;

notify pgrst, 'reload schema';
