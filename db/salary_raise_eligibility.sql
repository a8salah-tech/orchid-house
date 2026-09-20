-- ══════════════════════════════════════════════════════════════════════════════
--  طلب زيادة الراتب المنظَّم: فحص الاستحقاق + تقديم إجباري الحقول
-- ══════════════════════════════════════════════════════════════════════════════
--  • app_salary_raise_check()  — يحسب استحقاق الموظف الحالي (نفسه فقط) من بياناته الفعلية.
--  • app_submit_salary_raise() — يعيد الفحص على السيرفر ثم يسجّل الطلب (كل الحقول إجبارية).
--  • تريغر يمنع إنشاء طلب "زيادة راتب" بأي طريقة أخرى غير الدالة أعلاه.
--  الشروط: شهر خدمة على الأقل، متوسط آخر 3 تقييمات معتمدة ≥ 80، غياب ≤ يومين،
--          تأخير ≤ 5 ساعات (آخر 3 أشهر أو منذ التعيين)، بلا مخالفات فعّالة، ومرة كل 3 أشهر.
--  النسبة المتوقعة من الدرجة: أقل من 80 ← 5%، من 80 إلى 89 ← 7.5%، من 90 ← 10%.
--  التشغيل: انسخ الملف كله في Supabase SQL Editor → Run. آمن لإعادة التشغيل.
-- ══════════════════════════════════════════════════════════════════════════════

alter table employee_requests add column if not exists raise_percent numeric;
alter table employee_requests add column if not exists raise_approved_percent numeric;
alter table employee_requests add column if not exists raise_snapshot jsonb;
alter table employee_requests add column if not exists raise_achievements jsonb;

-- ── فحص الاستحقاق للموظف الحالي ──
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
  v_abs_auto int := 0;
  v_abs_man  int := 0;
  v_abs     int := 0;
  v_viol    int := 0;
  v_last_req timestamptz;
  v_last_raise date;
  v_salary  numeric;
  v_ok_tenure boolean; v_ok_eval boolean; v_ok_abs boolean; v_ok_late boolean; v_ok_viol boolean; v_ok_lock boolean;
  v_att_score numeric;
  p_eval numeric; p_att numeric; p_viol numeric; p_ten numeric;
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

  select count(distinct s.date) into v_abs_auto
  from shift_schedules s
  where s.employee_id = v_emp and s.status = 'confirmed'
    and (s.shift_id is not null or s.custom_start is not null)
    and s.date between v_start and v_today - 1
    and not exists (select 1 from attendance a
                    where a.employee_id = s.employee_id and a.date = s.date and a.check_in_time is not null);
  select count(*) into v_abs_man from absences
  where employee_id = v_emp and status = 'active' and date between v_start and v_today;
  v_abs := greatest(v_abs_auto, v_abs_man);

  select count(*) into v_viol from violations
  where employee_id = v_emp and status = 'active' and date >= v_start;

  select max(created_at) into v_last_req from employee_requests
  where employee_id = v_emp and request_type = 'salary_increase';

  select max(effective_date) into v_last_raise from salary_increases where employee_id = v_emp;

  v_ok_tenure := v_join is not null and v_today >= (v_join + interval '1 month')::date;
  v_ok_eval   := v_evals > 0 and v_avg >= 80;
  v_ok_abs    := v_abs <= 2;
  v_ok_late   := v_late <= 5;
  v_ok_viol   := v_viol = 0;
  v_ok_lock   := v_last_req is null or v_last_req <= now() - interval '3 months';

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
    'next_allowed_at', case when v_last_req is null then null else (v_last_req + interval '3 months') end,
    'tenure_opens_at', case when v_join is null then null else (v_join + interval '1 month')::date end,
    'last_raise_at', v_last_raise,
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

-- ── تقديم الطلب (كل الحقول إجبارية، ويُعاد الفحص هنا على السيرفر) ──
create or replace function app_submit_salary_raise(p_percent numeric, p_reason text, p_achievements jsonb)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_emp    uuid := app_current_employee_id();
  v_check  jsonb;
  v_labels jsonb;
  v_items  jsonb := '[]'::jsonb;
  v_yes    int := 0;
  v_i      int;
  v_item   jsonb;
  v_details text;
  v_base   numeric; v_ach numeric; v_total numeric; v_expected numeric;
  v_salary numeric; v_new numeric; v_id text; v_num int;
  v_emp_row record;
begin
  if v_emp is null then raise exception 'NO_EMPLOYEE'; end if;

  v_check := app_salary_raise_check();
  if not (v_check->>'eligible')::boolean then raise exception 'NOT_ELIGIBLE'; end if;

  if p_percent is null or p_percent < 5 or p_percent > 10 then raise exception 'BAD_PERCENT'; end if;
  if p_reason is null or length(trim(p_reason)) < 10 then raise exception 'REASON_REQUIRED'; end if;
  if p_achievements is null or jsonb_typeof(p_achievements) <> 'array' or jsonb_array_length(p_achievements) <> 12 then
    raise exception 'ACHIEVEMENTS_REQUIRED';
  end if;

  v_labels := v_check->'achievements';
  for v_i in 0..11 loop
    v_item := p_achievements->v_i;
    if v_item->'applies' is null or jsonb_typeof(v_item->'applies') <> 'boolean' then
      raise exception 'ACHIEVEMENT_UNANSWERED_%', v_i + 1;
    end if;
    v_details := trim(coalesce(v_item->>'details', ''));
    if (v_item->>'applies')::boolean then
      if length(v_details) < 10 then raise exception 'ACHIEVEMENT_DETAILS_%', v_i + 1; end if;
      v_yes := v_yes + 1;
    else
      v_details := '';
    end if;
    v_items := v_items || jsonb_build_array(jsonb_build_object(
      'label', v_labels->>v_i, 'applies', (v_item->>'applies')::boolean, 'details', v_details));
  end loop;

  v_salary := (v_check->>'salary')::numeric;
  if v_salary is null or v_salary <= 0 then raise exception 'NO_SALARY'; end if;

  v_base  := (v_check->'points'->>'base')::numeric;
  v_ach   := round(v_yes::numeric / 12 * 25, 1);
  v_total := v_base + v_ach;
  v_expected := case when v_total >= 90 then 10 when v_total >= 80 then 7.5 else 5 end;
  v_new := round(v_salary * (1 + p_percent / 100), 2);

  select name, name_en, employee_number, department, role into v_emp_row from employees where id = v_emp;

  perform set_config('app.raise_rpc', '1', true);
  insert into employee_requests (employee_id, request_type, title, description, amount, status,
                                 raise_percent, raise_snapshot, raise_achievements)
  values (
    v_emp, 'salary_increase', 'Salary Increase Request',
    'طلب زيادة راتب' || E'\n' ||
    'الموظف: ' || coalesce(v_emp_row.name, '') || ' ' || coalesce(v_emp_row.name_en, '') ||
      ' (' || coalesce(v_emp_row.employee_number, '—') || ')' || E'\n' ||
    'الراتب الحالي: ' || v_salary || E'\n' ||
    'النسبة المطلوبة: ' || p_percent || '% — الراتب الجديد: ' || v_new || E'\n' ||
    'درجة الاستحقاق: ' || v_total || ' / 100 (الزيادة المتوقعة ' || v_expected || '%)' || E'\n' ||
    'السبب: ' || trim(p_reason),
    v_new, 'pending', p_percent,
    v_check || jsonb_build_object(
      'requested_percent', p_percent, 'expected_percent', v_expected,
      'achievements_points', v_ach, 'total_score', v_total,
      'current_salary', v_salary, 'new_salary', v_new, 'reason', trim(p_reason)),
    v_items)
  returning id::text, request_number into v_id, v_num;

  return jsonb_build_object('id', v_id, 'request_number', v_num, 'total_score', v_total, 'expected_percent', v_expected);
end;
$$;
revoke all on function app_submit_salary_raise(numeric, text, jsonb) from public;
grant execute on function app_submit_salary_raise(numeric, text, jsonb) to authenticated;

-- ── منع إنشاء طلب زيادة راتب بغير الدالة أعلاه ──
create or replace function app_block_direct_raise()
returns trigger language plpgsql as $$
begin
  if new.request_type = 'salary_increase' and coalesce(current_setting('app.raise_rpc', true), '') <> '1' then
    raise exception 'استخدم نموذج طلب الزيادة (فحص الاستحقاق)';
  end if;
  return new;
end;
$$;
drop trigger if exists trg_block_direct_raise on employee_requests;
create trigger trg_block_direct_raise before insert on employee_requests
  for each row execute function app_block_direct_raise();

notify pgrst, 'reload schema';
