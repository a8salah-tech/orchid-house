-- ══════════════════════════════════════════════════════════════════════════════
--  تصحيح حضور موظفين اثنين بعد تصحيح مدير النظام لشيفتيهما (تطبيق خطة المدير بدل الخطوات اليدوية)
-- ══════════════════════════════════════════════════════════════════════════════
--  1) علي زياد (ORH-10) — 4 نوفمبر 2026:
--     الشيفت صُحّح إلى 09:00–19:00 لكن السجل بقي بتأخير 46 د وخروج مبكر 715 د محسوبين على شيفت خاطئ سابق.
--     ← يُعاد حسابهما على الشيفت الصحيح (دخول 08:46 وخروج 19:04): التأخير 0 والخروج المبكر 0.
--  2) عبد الله سيف (ORH-149) — 21 و22 أكتوبر 2026:
--     كان شيفته مسجَّلًا بالخطأ 14:00–14:00 فأُغلق سجله تلقائيًا وتشوّهت الصفوف (صفوف مكررة ومعكوسة).
--     • سجل 21/10 (دخول 13:24): يُعدَّل الخروج إلى 22/10 الساعة 01:55
--     • سجل 22/10 01:55 → 13:38 : يُحذف     • سجل 22/10 13:39 → 21/10 15:00 : يُحذف
--     • سجل 22/10 (دخول 01:59 / خروج 02:00): يُعدَّل إلى دخول 22/10 13:39 وخروج 23/10 01:59
--     ثم يُحسب التأخير والخروج المبكر لهذين اليومين على الشيفت الصحيح (14:00–02:00) = صفر.
--  3) تُحدَّث ساعات التأخير/الخروج المبكر/إذن الخروج في كشف راتب الشهر (أكتوبر لعبد الله، نوفمبر لعلي) لو لم يكن معتمدًا (Finalized).
--     المتوقع: عبد الله أكتوبر تأخير 1.18 ساعة وخروج مبكر 0 (والمستحق نحو 1,447 مع بقاء مخالفتي النظام 15+15)، وعلي نوفمبر تأخير وخروج مبكر 0.
--  كل الأوقات أدناه بتوقيت ماليزيا (UTC+8) محوّلة إلى UTC، وبثواني البصمة الأصلية (مأخوذة من الصفين المعكوسين نفسيهما). المخالفتان التلقائيتان (15 رينغيت × 2 ليوم 21/10) لا تُمسّان.
--  التشغيل: انسخ الملف كله في Supabase SQL Editor → Run. معاملة واحدة وآمن لإعادة التشغيل (يتخطى ما صُحّح).
--  يتوقف بخطأ ويتراجع كله إن لم تطابق الصفوف ما هو متوقع (حتى لا يحذف أو يعدّل صفًا غير مقصود).
-- ══════════════════════════════════════════════════════════════════════════════

begin;

do $$
declare
  c_ali  constant uuid := '771009a0-3eb4-49c7-bb04-4210e225e7c5';
  c_abd  constant uuid := '8618338a-54c9-4c1a-862c-cc63daaacca0';
  v_note_ali constant text := '🔄 أُعيد حساب التأخير/الخروج المبكر بعد تصحيح مدير النظام لشيفت 4 نوفمبر / Recalculated after the admin corrected the shift';
  v_note_abd constant text := '✏️ تصحيح بطلب مدير النظام: كان شيفت هذا اليوم مسجَّلًا خطأً (14:00–14:00) فأُغلق السجل تلقائيًا؛ الأوقات المعروضة هي الفعلية / Corrected by system admin request (shift was mis-set)';
  n int;
begin
  -- ── 1) علي زياد: 4 نوفمبر
  update public.attendance
     set late_minutes = 0, early_minutes = 0, permit_minutes = 0, status = 'present',
         notes = case when coalesce(notes, '') = '' then v_note_ali else notes || ' | ' || v_note_ali end
   where id = '7bf04b58-3b09-4a6e-9666-5989eae8cf82' and employee_id = c_ali
     and (late_minutes = 46 or early_minutes = 715);

  -- ── 2) عبد الله سيف
  -- سجل 21/10: الخروج الفعلي 22/10 01:55 (= 21/10 17:55 UTC)
  update public.attendance
     set check_out_time = '2026-10-21 17:55:38.735336+00', status = 'present',
         late_minutes = 0, early_minutes = 0, permit_minutes = 0, is_manual = true, notes = v_note_abd
   where id = '5314e796-3d34-4854-9d30-9fd791f418e2' and employee_id = c_abd
     and check_out_time is distinct from '2026-10-21 17:55:38.735336+00';

  -- حذف الصفين المعكوسين (بشرط مطابقة وقت دخول كل منهما حتى لا يُحذف صف آخر)
  delete from public.attendance
   where id = '90bdb077-ff68-4eb3-9a54-d9c3f9d14a97' and employee_id = c_abd and date_trunc('minute', check_in_time) = '2026-10-21 17:55:00+00';
  delete from public.attendance
   where id = 'f63af4be-d1da-4af3-806d-15b542897147' and employee_id = c_abd and date_trunc('minute', check_in_time) = '2026-10-22 05:39:00+00';

  -- سجل 22/10: دخول 22/10 13:39 (= 05:39 UTC) وخروج 23/10 01:59 (= 22/10 17:59 UTC)
  update public.attendance
     set check_in_time = '2026-10-22 05:39:12.252498+00', check_out_time = '2026-10-22 17:59:28.066539+00', status = 'present',
         late_minutes = 0, early_minutes = 0, permit_minutes = 0, is_manual = true, notes = v_note_abd
   where id = 'c1a46d0c-58b0-45ce-8ec7-2b79242b60da' and employee_id = c_abd
     and (check_in_time is distinct from '2026-10-22 05:39:12.252498+00' or check_out_time is distinct from '2026-10-22 17:59:28.066539+00');

  -- ── 3) كشف الراتب: مجموع الدقائق ÷ 60 (نفس معادلة صفحة الرواتب)، للأشهر غير المعتمدة فقط
  update public.payroll_records pr
     set late_hours = round(coalesce((select sum(a.late_minutes) from public.attendance a where a.employee_id = pr.employee_id and a.date between '2026-10-01' and '2026-10-31'), 0) / 60.0, 2),
         early_exit_hours = round(coalesce((select sum(a.early_minutes) from public.attendance a where a.employee_id = pr.employee_id and a.date between '2026-10-01' and '2026-10-31'), 0) / 60.0, 2),
         exit_permit_hours = case when e.fixed_salary then 0 else round(coalesce((select sum(a.permit_minutes) from public.attendance a where a.employee_id = pr.employee_id and a.date between '2026-10-01' and '2026-10-31'), 0) / 60.0, 2) end
    from public.payroll_months pm, public.employees e
   where pr.payroll_month_id = pm.id and pm.year = 2026 and pm.month = 10 and pm.status <> 'finalized'
     and pr.employee_id = c_abd and e.id = pr.employee_id;

  update public.payroll_records pr
     set late_hours = round(coalesce((select sum(a.late_minutes) from public.attendance a where a.employee_id = pr.employee_id and a.date between '2026-11-01' and '2026-11-30'), 0) / 60.0, 2),
         early_exit_hours = round(coalesce((select sum(a.early_minutes) from public.attendance a where a.employee_id = pr.employee_id and a.date between '2026-11-01' and '2026-11-30'), 0) / 60.0, 2),
         exit_permit_hours = case when e.fixed_salary then 0 else round(coalesce((select sum(a.permit_minutes) from public.attendance a where a.employee_id = pr.employee_id and a.date between '2026-11-01' and '2026-11-30'), 0) / 60.0, 2) end
    from public.payroll_months pm, public.employees e
   where pr.payroll_month_id = pm.id and pm.year = 2026 and pm.month = 11 and pm.status <> 'finalized'
     and pr.employee_id = c_ali and e.id = pr.employee_id;
end $$;

-- ── بوابة التحقق ──
do $$
declare bad text := '';
begin
  if not exists (select 1 from public.attendance where id = '7bf04b58-3b09-4a6e-9666-5989eae8cf82' and late_minutes = 0 and early_minutes = 0) then bad := bad || 'سجل علي؛ '; end if;
  if exists (select 1 from public.attendance where id in ('90bdb077-ff68-4eb3-9a54-d9c3f9d14a97', 'f63af4be-d1da-4af3-806d-15b542897147')) then bad := bad || 'الصفان لم يُحذفا؛ '; end if;
  if not exists (select 1 from public.attendance where id = '5314e796-3d34-4854-9d30-9fd791f418e2' and check_out_time = '2026-10-21 17:55:38.735336+00' and late_minutes = 0 and early_minutes = 0) then bad := bad || 'سجل 21/10؛ '; end if;
  if not exists (select 1 from public.attendance where id = 'c1a46d0c-58b0-45ce-8ec7-2b79242b60da' and check_in_time = '2026-10-22 05:39:12.252498+00' and check_out_time = '2026-10-22 17:59:28.066539+00' and late_minutes = 0 and early_minutes = 0) then bad := bad || 'سجل 22/10؛ '; end if;
  if (select coalesce(sum(early_minutes), 0) from public.attendance where employee_id = '8618338a-54c9-4c1a-862c-cc63daaacca0' and date between '2026-10-01' and '2026-10-31') <> 0 then bad := bad || 'الخروج المبكر لعبد الله؛ '; end if;
  if bad <> '' then raise exception 'FAIL: %', bad; end if;
end $$;

commit;
