-- ══════════════════════════════════════════════════════════════════════════════
--  إصلاح بطء سياسات RLS (ما يجعل بحث العملاء عند الكاشير يفشل بخطأ 500)
-- ══════════════════════════════════════════════════════════════════════════════
--  الأعراض: كاشير يكتب اسم أو رقم عميل في «Settle Bill» فيبقى «Searching…» نحو 10 ثوانٍ ثم «No customer found»
--  حتى لو العميل موجود، وفي سجل المتصفح: Failed to load resource: status 500 (انتهت مهلة الاستعلام).
--
--  السبب (جُرِّب مباشرة بحساب كاشير): سياسة customers (cust_all) تستدعي
--      app_is_super_admin() OR app_has_perm('customers') OR app_has_perm('loyalty') OR app_has_perm('sales')
--  لكل صف من جدول فيه 3125 عميلاً، وكل استدعاء دالة بمستويين من البحث في جدولي الموظفين والصلاحيات.
--  مدير النظام يتخطاها لأن أول شرط عنده صحيح فيتوقف فوراً، أما الكاشير فيمرّ على الشروط الأربعة لكل صف،
--  فيتجاوز الاستعلام مهلة قاعدة البيانات. النتيجة: لا يجد العميل ولا عربونه ولا يربط النقاط.
--
--  الإصلاح: لفّ الدوال بـ (select ...) فتُحسب مرة واحدة للاستعلام كله (InitPlan) بدل مرة لكل صف.
--  المنطق والصلاحيات كما هي بالضبط — الشروط نفسها، تغيير في طريقة التنفيذ فقط.
--  يشمل الجداول الكبيرة المقفولة بدوال: customers و journal_entries و journal_entry_lines
--  (الكاشير يقرأ عدّاد القيود عند كل دفع) و daily_cash_expenses و daily_reports و order_client_meta.
--  التشغيل: انسخ الملف كله في Supabase SQL Editor → Run. معاملة واحدة وآمن لإعادة التشغيل.
--  التراجع: أعد تشغيل db/rls_stage_a3_customers_accounting.sql و db/order_client_meta_rls.sql.
-- ══════════════════════════════════════════════════════════════════════════════

begin;

do $$
begin
  if not exists (select 1 from pg_proc where proname = 'app_has_perm')
     or not exists (select 1 from pg_proc where proname = 'app_is_basic_employee') then
    raise exception 'شغّل db/rls_stage_a.sql أولًا';
  end if;
end $$;

-- ── customers ──
drop policy if exists cust_all on public.customers;
create policy cust_all on public.customers for all to authenticated
  using ((select app_is_super_admin()) or (select app_has_perm('customers')) or (select app_has_perm('loyalty')) or (select app_has_perm('sales')))
  with check ((select app_is_super_admin()) or (select app_has_perm('customers')) or (select app_has_perm('loyalty')) or (select app_has_perm('sales')));

-- ── journal_entries + journal_entry_lines ──
do $$
declare t text;
begin
  foreach t in array array['journal_entries', 'journal_entry_lines'] loop
    execute format('drop policy if exists %I on public.%I', t || '_sel', t);
    execute format('drop policy if exists %I on public.%I', t || '_ins', t);
    execute format('drop policy if exists %I on public.%I', t || '_upd', t);
    execute format('drop policy if exists %I on public.%I', t || '_del', t);
    execute format('create policy %I on public.%I for select to authenticated using (not (select app_is_basic_employee()))', t || '_sel', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (not (select app_is_basic_employee()))', t || '_ins', t);
    execute format('create policy %I on public.%I for update to authenticated using ((select app_is_super_admin()) or (select app_has_perm(''accounting''))) with check ((select app_is_super_admin()) or (select app_has_perm(''accounting'')))', t || '_upd', t);
    execute format('create policy %I on public.%I for delete to authenticated using ((select app_is_super_admin()) or (select app_has_perm(''accounting'')))', t || '_del', t);
  end loop;
end $$;

-- ── daily_cash_expenses + daily_reports ──
do $$
declare t text;
begin
  foreach t in array array['daily_cash_expenses', 'daily_reports'] loop
    execute format('drop policy if exists %I on public.%I', t || '_all', t);
    execute format('create policy %I on public.%I for all to authenticated using (not (select app_is_basic_employee())) with check (not (select app_is_basic_employee()))', t || '_all', t);
  end loop;
end $$;

-- ── order_client_meta (31 ألف صف): قراءة مدير النظام فقط ──
drop policy if exists order_client_meta_admin_read on public.order_client_meta;
create policy order_client_meta_admin_read on public.order_client_meta
  for select to authenticated
  using ((select app_is_super_admin()));

-- ── بوابة التحقق: العدد المتوقع من السياسات كما في الملفات الأصلية ──
do $$
declare bad text := '';
begin
  if (select count(*) from pg_policies where schemaname = 'public' and tablename = 'customers') <> 1 then bad := bad || 'customers؛ '; end if;
  if (select count(*) from pg_policies where schemaname = 'public' and tablename = 'journal_entries' and policyname like 'journal_entries\_%') <> 4 then bad := bad || 'journal_entries؛ '; end if;
  if (select count(*) from pg_policies where schemaname = 'public' and tablename = 'journal_entry_lines' and policyname like 'journal_entry_lines\_%') <> 4 then bad := bad || 'journal_entry_lines؛ '; end if;
  if (select count(*) from pg_policies where schemaname = 'public' and tablename in ('daily_cash_expenses', 'daily_reports')) < 2 then bad := bad || 'daily؛ '; end if;
  if bad <> '' then raise exception 'FAIL: %', bad; end if;
end $$;

commit;

notify pgrst, 'reload schema';
