-- ══════════════════════════════════════════════════════════════════════════════
--  السلف المعتمدة من مدير الفرع لا تنزل في كشف الراتب — إصلاح + تصحيح الأشهر المتأثرة
-- ══════════════════════════════════════════════════════════════════════════════
--  السبب: خصم السلفة من الراتب يتم من متصفح المعتمِد (يكتب في payroll_records). وبعد تقييد صلاحيات الرواتب (RLS) صار مدير الفرع
--  لا يقرأ ولا يكتب في payroll_records، فتفشل الكتابة بصمت ويبقى حقل السلفة 0 رغم اعتماد الطلب. السلف التي يعتمدها مدير النظام
--  أو صاحب صلاحية الرواتب تعمل بشكل سليم.
--
--  (1) تريغر: عند تحويل طلب سلفة راتب إلى "completed" من غير مدير النظام/صاحب صلاحية الرواتب، تُضاف السلفة تلقائيًا من قاعدة
--      البيانات إلى سجل راتب شهر الاعتماد (بتوقيت ماليزيا). مدير النظام وصاحب الرواتب لا يتأثران لأن الواجهة تكتب لهم أصلًا
--      (فلا يحدث خصم مزدوج).
--  (2) تصحيح: لكل موظف، لو كان حقل السلفة في سجل راتب شهر (غير مُعتمَد نهائيًا) أقل من مجموع السلف المعتمدة له في ذلك الشهر
--      منذ 1 سبتمبر 2026، يُرفع إلى المجموع. لا يُنقَص أي مبلغ ولا يُلمَس الشهر المُعتمَد (finalized).
--  التشغيل: انسخ الملف كله في Supabase SQL Editor → Run. آمن لإعادة التشغيل.
-- ══════════════════════════════════════════════════════════════════════════════

create or replace function app_apply_advance_to_payroll()
returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_month int;
  v_year int;
  v_pm uuid;
  v_rec uuid;
  v_basic numeric := 0;
  v_ins numeric := 0;
  v_work_ins numeric := 0;
begin
  if new.request_type is distinct from 'salary_advance' or new.status is distinct from 'completed'
     or old.status = 'completed' or coalesce(new.amount, 0) <= 0 then
    return new;
  end if;
  -- مدير النظام / صاحب صلاحية الرواتب / الأدوات الداخلية: الواجهة تضيف المبلغ بنفسها، فلا نكرر
  if auth.uid() is null or app_is_super_admin() or app_has_perm('payroll') then
    return new;
  end if;

  v_month := extract(month from (now() at time zone 'Asia/Kuala_Lumpur'));
  v_year  := extract(year  from (now() at time zone 'Asia/Kuala_Lumpur'));

  select id into v_pm from payroll_months where month = v_month and year = v_year limit 1;
  if v_pm is null then
    insert into payroll_months (month, year, status) values (v_month, v_year, 'draft') returning id into v_pm;
  end if;

  select id into v_rec from payroll_records where payroll_month_id = v_pm and employee_id = new.employee_id limit 1;
  if v_rec is not null then
    update payroll_records set advance = coalesce(advance, 0) + new.amount where id = v_rec;
  else
    -- لا يوجد سجل لهذا الشهر: نُنشئه ناقلين الراتب والتأمينات من آخر سجل للموظف (وتُعاد حسابات الشهر عند فتح صفحة الرواتب)
    select coalesce(basic_salary, 0), coalesce(insurance, 0), coalesce(work_insurance, 0)
      into v_basic, v_ins, v_work_ins
      from payroll_records where employee_id = new.employee_id order by created_at desc limit 1;
    insert into payroll_records (
      payroll_month_id, employee_id, basic_salary, insurance, working_days, days_worked, overtime_days, overtime_hours,
      allowance_1, allowance_1_label, allowance_2, allowance_2_label, allowance_3, allowance_3_label,
      absence_days, late_hours, early_exit_hours, tax,
      deduction_1, deduction_1_label, deduction_2, deduction_2_label, deduction_3, deduction_3_label,
      advance, advance_balance, carried_forward, amount_due, amount_paid, work_insurance
    ) values (
      v_pm, new.employee_id, coalesce(v_basic, 0), coalesce(v_ins, 0), 30, 30, 0, 0,
      0, 'Allowance 1', 0, 'Allowance 2', 0, 'Allowance 3',
      0, 0, 0, 0,
      0, 'Deduction 1', 0, 'Deduction 2', 0, 'Deduction 3',
      new.amount, 0, 0, 0, 0, coalesce(v_work_ins, 0)
    );
  end if;
  return new;
end $$;

drop trigger if exists zd_employee_requests_advance_to_payroll on employee_requests;
create trigger zd_employee_requests_advance_to_payroll
  after update on employee_requests
  for each row execute function app_apply_advance_to_payroll();

-- (2) تصحيح السلف التي لم تنزل (من 1 سبتمبر 2026): رفع الحقل إلى مجموع السلف المعتمدة في شهر الاعتماد
update payroll_records pr
   set advance = x.expected
  from (
    select r.employee_id,
           pm.id as pm_id,
           sum(r.amount) as expected
      from employee_requests r
      join payroll_months pm
        on pm.year  = extract(year  from (r.approved_at at time zone 'Asia/Kuala_Lumpur'))
       and pm.month = extract(month from (r.approved_at at time zone 'Asia/Kuala_Lumpur'))
     where r.request_type = 'salary_advance'
       and r.status = 'completed'
       and r.approved_at >= '2026-09-01'
       and coalesce(r.amount, 0) > 0
       and pm.status is distinct from 'finalized'
     group by r.employee_id, pm.id
  ) x
 where pr.employee_id = x.employee_id
   and pr.payroll_month_id = x.pm_id
   and coalesce(pr.advance, 0) < x.expected;
