-- ══════════════════════════════════════════════════════════════════════════════
--  المرحلة 4 — إغلاق الزائر المجهول (anon) عن قاعدة البيانات
-- ══════════════════════════════════════════════════════════════════════════════
--
--  المشكلة: كل سياسات RLS تقريباً "FOR ALL TO public" — والدور public يشمل anon
--  (مفتاح المتصفح العام). فأي زائر بلا تسجيل دخول يقرأ/يكتب كل جدول: الرواتب،
--  بيانات الموظفين، صور الهويات، الصلاحيات، المحاسبة.
--
--  ما يفعله هذا الملف (كله داخل معاملة واحدة):
--    1. يُسقط كل سياسة تخص public أو anon على كل جداول public.
--    2. يُفعّل RLS على كل جدول + سياسة كاملة للدور authenticated فقط.
--    3. يعيد للزائر سماحاً ضيّقاً: قراءة جداول عرض المنيو/الطاولة، وإضافة
--       التسجيل/التقييم/سجل اللعبة فقط.
--    4. يجعل دالة رقم الموظف SECURITY DEFINER (تحتاجها /register كزائر).
--    5. بوابة تحقق: لو أي شرط فشل → RAISE EXCEPTION → تتراجع المعاملة كلها
--       ولا يتغيّر شيء. لو نجح كل شيء → COMMIT في آخر الملف يحفظ.
--
--  طريقة التشغيل: انسخ الملف كله في Supabase SQL Editor واضغط Run مرة واحدة.
--    • لو ظهرت رسالة FAIL... → لا شيء تغيّر، ابعتها لي.
--    • لو ظهر "ALL CHECKS PASSED" ثم "COMMIT" → تم بنجاح.
--
-- ══════════════════════════════════════════════════════════════════════════════

begin;

-- ──────────────────────────────────────────────────────────────────────────────
-- (1) التحويل
-- ──────────────────────────────────────────────────────────────────────────────
do $$
declare
  r record;

  -- الزائر المجهول: قراءة فقط
  anon_read text[] := array[
    'tables', 'branches',
    'menu_categories', 'menu_items', 'menu_item_sizes', 'menu_item_reviews',
    'orders', 'order_items'
  ];

  -- الزائر المجهول: إضافة فقط
  anon_insert text[] := array[
    'employee_registrations', 'menu_item_reviews', 'game_link_debug_log'
  ];
  newly_staff_readable text[];
begin
  -- جداول RLS مفعّل عليها بلا أي سياسة = مقفولة حالياً حتى عن الموظف؛ هذا الملف يمنح الموظف وصولاً إليها
  select array_agg(t.tablename order by t.tablename) into newly_staff_readable
  from pg_tables t
  where t.schemaname = 'public' and t.rowsecurity = true
    and not exists (select 1 from pg_policies p where p.schemaname='public' and p.tablename=t.tablename);
  raise notice 'جداول ستصبح متاحة للموظف المسجَّل (كانت مقفولة): %',
    coalesce(array_to_string(newly_staff_readable, ', '), '(لا شيء)');

  -- (أ) أسقط كل سياسة تخص public أو anon
  for r in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and (roles && array['public','anon']::name[])
  loop
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;

  -- (ب) لكل جدول: RLS + سياسة الموظف المسجَّل + سماح الزائر عند اللزوم
  for r in
    select tablename from pg_tables where schemaname = 'public'
  loop
    execute format('alter table public.%I enable row level security', r.tablename);

    if not exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = r.tablename and policyname = 'authenticated_all'
    ) then
      execute format(
        'create policy authenticated_all on public.%I for all to authenticated using (true) with check (true)',
        r.tablename
      );
    end if;

    if r.tablename = any(anon_read) then
      execute format('drop policy if exists anon_read on public.%I', r.tablename);
      execute format('create policy anon_read on public.%I for select to anon using (true)', r.tablename);
    end if;

    if r.tablename = any(anon_insert) then
      execute format('drop policy if exists anon_insert on public.%I', r.tablename);
      execute format('create policy anon_insert on public.%I for insert to anon with check (true)', r.tablename);
    end if;
  end loop;
end $$;


-- ──────────────────────────────────────────────────────────────────────────────
-- (2) دالة رقم الموظف التالي — تستدعيها /register كزائر مجهول
-- ──────────────────────────────────────────────────────────────────────────────
alter function public.preview_next_employee_number(p_branch_id uuid, p_prefix text)
  security definer set search_path = public, pg_temp;


-- ──────────────────────────────────────────────────────────────────────────────
-- (3) بوابة التحقق — أي فشل هنا يُلغي المعاملة كلها
-- ──────────────────────────────────────────────────────────────────────────────
do $$
declare
  bad_anon   int;
  no_policy  int;
  rls_off    int;
  rpc_secdef boolean;
  allowlist  text[] := array[
    'branches','employee_registrations','game_link_debug_log','menu_categories',
    'menu_items','menu_item_reviews','menu_item_sizes','order_items','orders','tables'
  ];
begin
  select count(*) into bad_anon
  from pg_policies
  where schemaname = 'public'
    and (roles && array['public','anon']::name[])
    and tablename <> all (allowlist);

  select count(*) into no_policy
  from pg_tables t
  where t.schemaname = 'public'
    and not exists (select 1 from pg_policies p where p.schemaname='public' and p.tablename=t.tablename);

  select count(*) into rls_off
  from pg_tables
  where schemaname = 'public' and rowsecurity = false;

  select prosecdef into rpc_secdef
  from pg_proc where proname = 'preview_next_employee_number';

  if bad_anon > 0 then
    raise exception 'FAIL: % table(s) still expose anon/public outside the allowlist', bad_anon;
  end if;
  if no_policy > 0 then
    raise exception 'FAIL: % table(s) end up with no policy at all', no_policy;
  end if;
  if rls_off > 0 then
    raise exception 'FAIL: % table(s) still have RLS disabled', rls_off;
  end if;
  if rpc_secdef is distinct from true then
    raise exception 'FAIL: preview_next_employee_number is not SECURITY DEFINER';
  end if;

  raise notice '════════════════════════════════════════════';
  raise notice 'ALL CHECKS PASSED — the COMMIT below will save';
  raise notice '  anon policies kept: % (expected 11)',
    (select count(*) from pg_policies
     where schemaname='public' and (roles && array['public','anon']::name[]));
  raise notice '════════════════════════════════════════════';
end $$;


-- ──────────────────────────────────────────────────────────────────────────────
-- (4) الحفظ — لا يصل هنا إلا لو كل الفحوصات نجحت
-- ──────────────────────────────────────────────────────────────────────────────
commit;


-- ══════════════════════════════════════════════════════════════════════════════
--  اختبار ما بعد الحفظ (بعد نجاح الملف — استعلامات قراءة آمنة)
-- ══════════════════════════════════════════════════════════════════════════════
--  ما الذي بقي للزائر؟ يجب أن يكون فقط القائمة البيضاء:
-- select tablename, policyname, cmd
-- from pg_policies
-- where schemaname='public' and (roles && array['public','anon']::name[])
-- order by tablename, policyname;
--
--  ثم في التطبيق:
--   ✅ موظف مسجَّل: صفحات الرواتب / المخالفات / HR / الحضور / المخزون / الكاشير تُحمِّل
--   ✅ /menu/<طاولة>: المنيو + طلب كامل + "اطلب المزيد" + شاشة النقاط
--   ✅ /register: تسجيل تجريبي يُحفظ، وإيميل مكرر يُرفض
--   ✅ /bookings: حجز تجريبي يُحفظ وتظهر الطاولات المحجوزة
--   ✅ اختبار الاختراق (نافذة خفية، console صفحة المنيو):
--        await sb.from('payroll_records').select('*')   → صفر صفوف / خطأ


-- ══════════════════════════════════════════════════════════════════════════════
--  التراجع الكامل للطوارئ (لو انكسر وصول الموظفين بعد الحفظ)
-- ══════════════════════════════════════════════════════════════════════════════
-- begin;
-- do $$
-- declare r record;
-- begin
--   for r in select tablename from pg_tables where schemaname = 'public' loop
--     execute format('drop policy if exists authenticated_all on public.%I', r.tablename);
--     execute format('drop policy if exists anon_read on public.%I', r.tablename);
--     execute format('drop policy if exists anon_insert on public.%I', r.tablename);
--     execute format('create policy emergency_open on public.%I for all to public using (true) with check (true)', r.tablename);
--   end loop;
-- end $$;
-- commit;

-- التراجع لجدول واحد:
-- drop policy if exists authenticated_all on public.<الجدول>;
-- create policy emergency_open on public.<الجدول> for all to public using (true) with check (true);
