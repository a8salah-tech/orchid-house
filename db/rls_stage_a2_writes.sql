-- ══════════════════════════════════════════════════════════════════════════════
--  المرحلة أ‑2 — تشديد الكتابة على payroll_records / violations / absences
-- ══════════════════════════════════════════════════════════════════════════════
--
--  في المرحلة أ تركنا الكتابة مفتوحة لأي موظف مسجَّل. النتيجة: موظف عادي يقدر من
--  الـConsole يعدّل كشف راتبه، أو يصفّر مبلغ مخالفته.
--
--  هذا الملف يقصر الكتابة على "الأدوار غير الأساسية" (كل من فوق الموظف العادي)،
--  مع استثناء واحد: الموظف يقدر يرفع مخالفة "قيد المراجعة" على نفسه فقط
--  (هذا ما يفعله تسجيل الخروج الذاتي في صفحة الحضور — self‑flag).
--
--  يعتمد على الدوال المساعدة المنشورة في db/rls_stage_a.sql.
--  الأدوار الأساسية = employee, kitchen_cleaner, hall_cleaner,
--  maintenance_worker, delivery_worker (app_is_basic_employee()).
--
--  التشغيل: انسخ الملف كله في Supabase SQL Editor → Run مرة واحدة.
--    • FAIL... → لا شيء تغيّر.  • "ALL CHECKS PASSED" + COMMIT → تم.
-- ══════════════════════════════════════════════════════════════════════════════

begin;

-- ── payroll_records: الكتابة للأدوار غير الأساسية فقط ──
drop policy if exists pr_ins on payroll_records;
drop policy if exists pr_upd on payroll_records;
drop policy if exists pr_del on payroll_records;

create policy pr_ins on payroll_records for insert to authenticated
  with check (not app_is_basic_employee());
create policy pr_upd on payroll_records for update to authenticated
  using (not app_is_basic_employee()) with check (not app_is_basic_employee());
create policy pr_del on payroll_records for delete to authenticated
  using (not app_is_basic_employee());

-- ── violations ──
drop policy if exists v_ins on violations;
drop policy if exists v_upd on violations;

-- إضافة: دور غير أساسي، أو الموظف يرفع مخالفة "submitted" على نفسه بمبلغ غير سالب
create policy v_ins on violations for insert to authenticated
  with check (
    not app_is_basic_employee()
    or (employee_id = app_current_employee_id()
        and status = 'submitted'
        and coalesce(amount, 0) >= 0)
  );
-- تعديل: صلاحية المخالفات / الموارد البشرية / مدير النظام فقط (يقفل تصفير المبلغ)
create policy v_upd on violations for update to authenticated
  using (app_is_super_admin() or app_has_perm('violations') or app_has_perm('hr'))
  with check (app_is_super_admin() or app_has_perm('violations') or app_has_perm('hr'));

-- ── absences ──
drop policy if exists a_ins on absences;
drop policy if exists a_upd on absences;

create policy a_ins on absences for insert to authenticated
  with check (not app_is_basic_employee());
create policy a_upd on absences for update to authenticated
  using (app_is_super_admin() or app_has_perm('violations') or app_has_perm('hr'))
  with check (app_is_super_admin() or app_has_perm('violations') or app_has_perm('hr'));

-- (v_del / a_del / *_select / si_all لم تتغيّر — من المرحلة أ)

-- ── بوابة تحقق ──
do $$
declare n int;
begin
  select count(*) into n from pg_policies where schemaname='public' and tablename='payroll_records'
    and policyname in ('pr_select','pr_ins','pr_upd','pr_del');
  if n <> 4 then raise exception 'FAIL: payroll_records policies = %', n; end if;

  select count(*) into n from pg_policies where schemaname='public' and tablename='violations'
    and policyname in ('v_select','v_ins','v_upd','v_del');
  if n <> 4 then raise exception 'FAIL: violations policies = %', n; end if;

  select count(*) into n from pg_policies where schemaname='public' and tablename='absences'
    and policyname in ('a_select','a_ins','a_upd','a_del');
  if n <> 4 then raise exception 'FAIL: absences policies = %', n; end if;

  -- ما زالت الكتابة "المفتوحة" (with check true) غير موجودة على الثلاثة
  if exists (
    select 1 from pg_policies
    where schemaname='public'
      and tablename in ('payroll_records','violations','absences')
      and cmd in ('INSERT','UPDATE')
      and coalesce(with_check,'') in ('true','(true)')
  ) then
    raise exception 'FAIL: an open write policy (check=true) is still present';
  end if;

  perform app_is_basic_employee();

  raise notice '════════════════════════════════════';
  raise notice 'ALL CHECKS PASSED — COMMIT below saves';
  raise notice '════════════════════════════════════';
end $$;

commit;


-- ══════════════════════════════════════════════════════════════════════════════
--  اختبار ما بعد الحفظ
-- ══════════════════════════════════════════════════════════════════════════════
--  • موظف عادي (Console في صفحة "راتبي"):
--      await sb.from('payroll_records').update({ amount_due: 9999 }).eq('employee_id','<id>')
--        → صفر صفوف متأثرة / خطأ RLS
--      await sb.from('violations').update({ amount: 0 }).eq('employee_id','<id>')
--        → صفر صفوف متأثرة / خطأ
--  • عدم انكسار:
--      - موظف يسجّل خروج "نسيان" في صفحة الحضور → مخالفة "submitted" تُرفع على نفسه ✅
--      - مدير فرع يعتمد "سلفة راتب" → payroll_records.advance يُحدَّث ✅
--      - مدير قسم (kitchen/hall/bar_manager) يعتمد "تصحيح حضور" → late_hours يُحدَّث ✅
--        (لو فشل: دوره ليس لديه صلاحية hr فعلياً — راجع roles_permissions)
--      - كاشير يسجّل خصم عجز على موظف → INSERT violations ✅
--      - مدير النظام: أداة "كشف الغياب" في صفحة الحضور → absences تُدرَج ✅
--      - صفحة إدارة المخالفات: اعتماد/إلغاء مخالفة أو غياب → status يتغيّر ✅


-- ══════════════════════════════════════════════════════════════════════════════
--  التراجع (يعيد الكتابة مفتوحة كما كانت بعد المرحلة أ)
-- ══════════════════════════════════════════════════════════════════════════════
-- begin;
-- drop policy if exists pr_ins on payroll_records;
-- drop policy if exists pr_upd on payroll_records;
-- drop policy if exists pr_del on payroll_records;
-- create policy pr_ins on payroll_records for insert to authenticated with check (true);
-- create policy pr_upd on payroll_records for update to authenticated using (true) with check (true);
-- create policy pr_del on payroll_records for delete to authenticated using (true);
-- drop policy if exists v_ins on violations;
-- drop policy if exists v_upd on violations;
-- create policy v_ins on violations for insert to authenticated with check (true);
-- create policy v_upd on violations for update to authenticated using (true) with check (true);
-- drop policy if exists a_ins on absences;
-- drop policy if exists a_upd on absences;
-- create policy a_ins on absences for insert to authenticated with check (true);
-- create policy a_upd on absences for update to authenticated using (true) with check (true);
-- commit;
