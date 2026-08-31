-- ══════════════════════════════════════════════════════════════════════════════
--  المرحلة أ‑3 — قفل قراءة: العملاء + المحاسبة
-- ══════════════════════════════════════════════════════════════════════════════
--
--  بعد المرحلة 4 هذه الجداول authenticated_all — أي موظف مسجَّل يقرأ:
--    • customers            : أسماء وتليفونات 1000+ عميل
--    • journal_entries / journal_entry_lines / chart_of_accounts : كل المحاسبة
--    • daily_cash_expenses / daily_reports : المصروفات والتقارير اليومية
--
--  هذا الملف يقصرها على الأدوار المعنيّة فقط.
--  يعتمد على دوال db/rls_stage_a.sql. الأدوار الأساسية = employee, kitchen_cleaner,
--  hall_cleaner, maintenance_worker, delivery_worker.
--
--  (attendance مؤجَّل للمرحلة ب — يحتاج دالة تجميع لصفحة "الموظف المثالي".)
--
--  التشغيل: انسخ الملف كله في Supabase SQL Editor → Run مرة واحدة.
-- ══════════════════════════════════════════════════════════════════════════════

begin;

-- ── customers: العملاء + الولاء + الكاشير ──
drop policy if exists authenticated_all on customers;
drop policy if exists cust_all on customers;
create policy cust_all on customers for all to authenticated
  using (app_is_super_admin() or app_has_perm('customers') or app_has_perm('loyalty') or app_has_perm('sales'))
  with check (app_is_super_admin() or app_has_perm('customers') or app_has_perm('loyalty') or app_has_perm('sales'));

-- ── journal_entries + journal_entry_lines ──
-- قراءة/إضافة: أي دور غير أساسي (الكاشير وقسم المشتريات يرحّلان قيوداً تلقائياً)
-- تعديل/حذف: المحاسبة أو مدير النظام فقط
do $$
declare t text;
begin
  foreach t in array array['journal_entries','journal_entry_lines'] loop
    execute format('drop policy if exists authenticated_all on %I', t);
    execute format('drop policy if exists %I on %I', t || '_sel', t);
    execute format('drop policy if exists %I on %I', t || '_ins', t);
    execute format('drop policy if exists %I on %I', t || '_upd', t);
    execute format('drop policy if exists %I on %I', t || '_del', t);
    execute format('create policy %I on %I for select to authenticated using (not app_is_basic_employee())', t || '_sel', t);
    execute format('create policy %I on %I for insert to authenticated with check (not app_is_basic_employee())', t || '_ins', t);
    execute format('create policy %I on %I for update to authenticated using (app_is_super_admin() or app_has_perm(''accounting'')) with check (app_is_super_admin() or app_has_perm(''accounting''))', t || '_upd', t);
    execute format('create policy %I on %I for delete to authenticated using (app_is_super_admin() or app_has_perm(''accounting''))', t || '_del', t);
  end loop;
end $$;

-- ── chart_of_accounts: قراءة لغير الأساسي؛ تعديل للمحاسبة فقط ──
drop policy if exists authenticated_all on chart_of_accounts;
drop policy if exists coa_all on chart_of_accounts;
drop policy if exists coa_sel on chart_of_accounts;
drop policy if exists coa_write on chart_of_accounts;
drop policy if exists coa_write_ins on chart_of_accounts;
drop policy if exists coa_write_upd on chart_of_accounts;
drop policy if exists coa_write_del on chart_of_accounts;
create policy coa_sel on chart_of_accounts for select to authenticated
  using (not app_is_basic_employee());
create policy coa_write_ins on chart_of_accounts for insert to authenticated
  with check (app_is_super_admin() or app_has_perm('accounting'));
create policy coa_write_upd on chart_of_accounts for update to authenticated
  using (app_is_super_admin() or app_has_perm('accounting')) with check (app_is_super_admin() or app_has_perm('accounting'));
create policy coa_write_del on chart_of_accounts for delete to authenticated
  using (app_is_super_admin() or app_has_perm('accounting'));

-- ── daily_cash_expenses + daily_reports: أي دور غير أساسي ──
do $$
declare t text;
begin
  foreach t in array array['daily_cash_expenses','daily_reports'] loop
    execute format('drop policy if exists authenticated_all on %I', t);
    execute format('drop policy if exists %I on %I', t || '_all', t);
    execute format('create policy %I on %I for all to authenticated using (not app_is_basic_employee()) with check (not app_is_basic_employee())', t || '_all', t);
  end loop;
end $$;

-- ── بوابة تحقق ──
do $$
declare bad text := '';
begin
  if exists (select 1 from pg_policies where schemaname='public'
             and tablename in ('customers','journal_entries','journal_entry_lines',
                               'chart_of_accounts','daily_cash_expenses','daily_reports')
             and policyname = 'authenticated_all') then
    bad := bad || 'authenticated_all لا يزال موجوداً؛ ';
  end if;

  if (select count(*) from pg_policies where schemaname='public' and tablename='customers') <> 1
     then bad := bad || 'customers؛ '; end if;
  if (select count(*) from pg_policies where schemaname='public' and tablename='journal_entries'
      and policyname in ('journal_entries_sel','journal_entries_ins','journal_entries_upd','journal_entries_del')) <> 4
     then bad := bad || 'journal_entries؛ '; end if;
  if (select count(*) from pg_policies where schemaname='public' and tablename='chart_of_accounts') <> 4
     then bad := bad || 'chart_of_accounts؛ '; end if;
  if (select count(*) from pg_policies where schemaname='public' and tablename='daily_cash_expenses') <> 1
     then bad := bad || 'daily_cash_expenses؛ '; end if;

  perform app_is_basic_employee();

  if bad <> '' then raise exception 'FAIL: %', bad; end if;

  raise notice '════════════════════════════════════';
  raise notice 'ALL CHECKS PASSED — COMMIT below saves';
  raise notice '════════════════════════════════════';
end $$;

commit;


-- ══════════════════════════════════════════════════════════════════════════════
--  اختبار ما بعد الحفظ
-- ══════════════════════════════════════════════════════════════════════════════
--  • موظف مطبخ (Console في أي صفحة داشبورد):
--      await sb.from('customers').select('name, phone')        → صفر صفوف
--      await sb.from('journal_entries').select('*')            → صفر صفوف
--      await sb.from('daily_cash_expenses').select('*')        → صفر صفوف
--  • عدم انكسار:
--      - صفحة "قاعدة بيانات العملاء" و"نقاط الولاء" تُحمِّل ✅
--      - الكاشير: إغلاق وردية → ترحيل قيد مبيعات ينجح ✅
--      - قسم المشتريات: تسجيل فاتورة → ترحيل قيد مشتريات ينجح ✅
--      - صفحة سندات القيد وشجرة الحسابات تعملان لصاحب صلاحية المحاسبة ✅
--      - صفحة التقارير اليومية (كاشير/تقارير) تُحمِّل وتحفظ ✅


-- ══════════════════════════════════════════════════════════════════════════════
--  التراجع
-- ══════════════════════════════════════════════════════════════════════════════
-- begin;
-- do $$ declare t text; begin
--   foreach t in array array['customers','journal_entries','journal_entry_lines',
--     'chart_of_accounts','daily_cash_expenses','daily_reports'] loop
--     execute format('drop policy if exists cust_all on %I', t);
--     execute format('drop policy if exists %I_sel on %I', t, t);
--     execute format('drop policy if exists %I_ins on %I', t, t);
--     execute format('drop policy if exists %I_upd on %I', t, t);
--     execute format('drop policy if exists %I_del on %I', t, t);
--     execute format('drop policy if exists %I_all on %I', t, t);
--     execute format('drop policy if exists coa_sel on %I', t);
--     execute format('drop policy if exists coa_write_ins on %I', t);
--     execute format('drop policy if exists coa_write_upd on %I', t);
--     execute format('drop policy if exists coa_write_del on %I', t);
--     execute format('create policy authenticated_all on %I for all to authenticated using (true) with check (true)', t);
--   end loop;
-- end $$;
-- commit;
