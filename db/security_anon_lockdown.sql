-- ══════════════════════════════════════════════════════════════════════════════
--  المرحلة 4 — إغلاق الزائر المجهول (anon) عن قاعدة البيانات
-- ══════════════════════════════════════════════════════════════════════════════
--
--  المشكلة: كل سياسات RLS تقريباً كانت "FOR ALL TO public" — والدور public في
--  Postgres يشمل anon (مفتاح المتصفح العام). فأي زائر بلا تسجيل دخول كان يقرأ
--  ويكتب في كل جدول: الرواتب، بيانات الموظفين، صور الهويات، الصلاحيات، المحاسبة.
--
--  ما يفعله هذا الملف:
--    1. يُسقط كل سياسة تخص الدور public أو anon على كل جداول schema public.
--    2. يُفعّل RLS على كل جدول ويضيف سياسة كاملة للدور authenticated فقط
--       (الموظف المسجَّل دخول) — نفس مستوى الوصول الفعلي الحالي، بلا anon.
--    3. يعيد للزائر المجهول سماحاً ضيّقاً فقط لِما تحتاجه الصفحات العامة:
--         • قراءة: عرض المنيو / الطاولة / الفروع / عرض الطلب بعد إنشائه
--         • إضافة: تسجيل موظف جديد / تقييم صنف / سجل تشخيص لعبة المنيو
--       (إنشاء الطلبات والحجوزات وتسجيل العملاء انتقل كله لمسارات سيرفر في المرحلة 3.)
--
--  الترتيب: شغّل هذا داخل معاملة، نفّذ استعلامات الفحص في نهايته، ثم COMMIT.
--  لو أي شيء بدا خطأ: ROLLBACK — لا يتغيّر شيء.
--
-- ══════════════════════════════════════════════════════════════════════════════

begin;

-- ──────────────────────────────────────────────────────────────────────────────
-- (0) لقطة قبل التغيير — للمقارنة لاحقاً
-- ──────────────────────────────────────────────────────────────────────────────
select 'BEFORE' as phase, count(*) as public_or_anon_policies
from pg_policies
where schemaname = 'public' and (roles && array['public','anon']::name[]);


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

  -- الزائر المجهول: إضافة فقط (بلا قراءة/تعديل/حذف)
  anon_insert text[] := array[
    'employee_registrations', 'menu_item_reviews', 'game_link_debug_log'
  ];
begin
  -- (أ) أسقط كل سياسة تخص public أو anon على كل جداول public
  for r in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and (roles && array['public','anon']::name[])
  loop
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;

  -- (ب) لكل جدول: فعّل RLS + سياسة كاملة للموظف المسجَّل، وأضف سماح الزائر عند اللزوم
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
--     يجب أن تكون SECURITY DEFINER وإلا يفشل التسجيل بعد الإغلاق.
-- ──────────────────────────────────────────────────────────────────────────────
select
  p.proname,
  pg_get_function_identity_arguments(p.oid) as args,
  case when p.prosecdef then '✅ SECURITY DEFINER'
       else '⚠️ SECURITY INVOKER — ألغِ تعليق السطر المناسب تحت ونفّذه'
  end as status
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'preview_next_employee_number';

-- لو ظهر ⚠️ أعلاه، استخدم توقيع الدالة الظاهر في العمود args، مثلاً:
-- alter function public.preview_next_employee_number(p_branch_id uuid, p_prefix text) security definer;


-- ══════════════════════════════════════════════════════════════════════════════
--  استعلامات الفحص — شغّلها قبل COMMIT
-- ══════════════════════════════════════════════════════════════════════════════

-- (فحص 1) ما الذي بقي للزائر؟ يجب أن يكون فقط:
--   anon_read   على: tables, branches, menu_categories, menu_items,
--                     menu_item_sizes, menu_item_reviews, orders, order_items
--   anon_insert على: employee_registrations, menu_item_reviews, game_link_debug_log
select tablename, policyname, cmd, roles
from pg_policies
where schemaname = 'public' and (roles && array['public','anon']::name[])
order by tablename, policyname;

-- (فحص 2) جداول بلا أي سياسة — يجب أن تكون فارغة (وإلا حتى الموظف لن يصلها)
select t.tablename
from pg_tables t
where t.schemaname = 'public'
  and not exists (
    select 1 from pg_policies p
    where p.schemaname = 'public' and p.tablename = t.tablename
  );

-- (فحص 3) جداول RLS غير مفعّل عليها — يجب أن تكون فارغة
select tablename, rowsecurity
from pg_tables
where schemaname = 'public' and rowsecurity = false;

-- (فحص 4) عدّاد ما بعد التغيير
select 'AFTER' as phase, count(*) as public_or_anon_policies
from pg_policies
where schemaname = 'public' and (roles && array['public','anon']::name[]);


-- ══════════════════════════════════════════════════════════════════════════════
--  عند الرضا:  COMMIT;      وإلا:  ROLLBACK;
-- ══════════════════════════════════════════════════════════════════════════════
-- commit;
-- rollback;


-- ══════════════════════════════════════════════════════════════════════════════
--  اختبار ما بعد COMMIT (خارج المعاملة)
-- ══════════════════════════════════════════════════════════════════════════════
--   ✅ موظف مسجَّل دخول: افتح صفحات الرواتب / المخالفات / الموارد البشرية /
--      الحضور / المخزون / الكاشير — كلها تُحمِّل بيانات.
--   ✅ /menu/<طاولة>: يظهر المنيو، اعمل طلباً كاملاً، ثم "اطلب المزيد"، ثم
--      شاشة النقاط — كلها تعمل.
--   ✅ /register: أرسل تسجيلاً تجريبياً — يُحفظ. وجرّب إيميلاً مكرراً — يُرفض.
--   ✅ /bookings: أنشئ حجزاً تجريبياً — يُحفظ، وتظهر الطاولات المحجوزة.
--   ✅ اختبار الاختراق (نافذة خفية بلا تسجيل، على console صفحة المنيو):
--        await sb.from('employees').select('name, salary')      → صفر صفوف / خطأ
--        await sb.from('payroll_records').select('*')            → صفر صفوف / خطأ
--        await sb.from('roles_permissions').select('*')          → صفر صفوف / خطأ


-- ══════════════════════════════════════════════════════════════════════════════
--  التراجع الكامل (لو انكسر وصول الموظفين لأي سبب بعد COMMIT)
--  يعيد الوضع لِما كان عليه (مفتوح للجميع) — استخدمه للطوارئ فقط:
-- ══════════════════════════════════════════════════════════════════════════════
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

-- التراجع لجدول واحد فقط:
-- drop policy if exists authenticated_all on public.<الجدول>;
-- create policy emergency_open on public.<الجدول> for all to public using (true) with check (true);
