-- ══════════════════════════════════════════════════════════════════════════════
--  تسجيل زيادة راتب Fraidon Haidari (ORH-52) المعتمدة في الطلب #3134: من 2,000 إلى 2,100 (+100) بسريان من أكتوبر 2026
-- ══════════════════════════════════════════════════════════════════════════════
--  الطلب اعتُمد بنسبة 5% لكن الزيادة لم تُسجَّل على الراتب (التسجيل خطوة يدوية من ملف الموظف).
--  هذا الملف يفعل ما يفعله زر «💰 زيادة راتب» في ملف الموظف:
--    • سطر في salary_increases (يظهر في «📊 آخر زيادة راتب»): +100 بتاريخ 2026-10-01، من 2,000 إلى 2,100
--    • تحديث الراتب في employee_compensation إلى 2,100
--  ⚠️ شغّله **بعد** رفع نسخة الكود الجديدة (التي تُجمّد الأشهر السابقة لأكتوبر وتُطبّق تاريخ السريان)، وإلا ظهر الراتب
--     الجديد عند فتح أشهر قديمة غير معتمدة (أغسطس/سبتمبر) بأثر رجعي.
--  بعد التشغيل: افتح الرواتب ← أكتوبر ثم نوفمبر ليُعاد حساب الكشف (2,100 بدل 2,000) ويُحفظ تلقائيًا، ثم اضغط «تأكيد الاكتمال» على الطلب.
--  التشغيل: انسخ الملف كله في Supabase SQL Editor → Run. معاملة واحدة وآمن لإعادة التشغيل (يتخطى إن سُجّلت الزيادة).
-- ══════════════════════════════════════════════════════════════════════════════

begin;

do $$
declare
  c_emp   constant uuid := '5c78bf7b-651d-4928-b3d4-da5c8cc682ae';
  c_admin constant uuid := 'e51f4f08-4986-450a-92b3-c2fa193ac794'; -- Dr.Alaa (مدير النظام الذي اعتمد الطلب)
  v_salary numeric;
begin
  select salary into v_salary from public.employee_compensation where employee_id = c_emp;
  if v_salary is null then raise exception 'FAIL: لا يوجد راتب مسجَّل للموظف'; end if;

  if exists (select 1 from public.salary_increases where employee_id = c_emp and effective_date = '2026-10-01') then
    raise notice 'الزيادة مسجَّلة سابقًا — لا تغيير';
  elsif v_salary <> 2000 then
    raise exception 'FAIL: الراتب الحالي % وليس 2000 كما هو متوقع — راجع قبل التسجيل', v_salary;
  else
    insert into public.salary_increases (employee_id, amount, effective_date, salary_before, salary_after, created_by, notes)
    values (c_emp, 100, '2026-10-01', 2000, 2100, c_admin, 'طلب زيادة راتب #3134 — اعتُمدت بنسبة 5% (من 2,000 إلى 2,100) بسريان من أكتوبر 2026');
    update public.employee_compensation set salary = 2100, updated_at = now() where employee_id = c_emp;
  end if;
end $$;

-- ── بوابة التحقق ──
do $$
begin
  if not exists (select 1 from public.employee_compensation where employee_id = '5c78bf7b-651d-4928-b3d4-da5c8cc682ae' and salary = 2100) then
    raise exception 'FAIL: الراتب لم يصبح 2100';
  end if;
  if not exists (select 1 from public.salary_increases where employee_id = '5c78bf7b-651d-4928-b3d4-da5c8cc682ae' and effective_date = '2026-10-01' and amount = 100 and salary_after = 2100) then
    raise exception 'FAIL: سجل الزيادة غير موجود';
  end if;
end $$;

commit;
