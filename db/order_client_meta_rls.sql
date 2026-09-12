-- ══════════════════════════════════════════════════════════════════════════════
--  قصر قراءة بيانات جهاز/IP العميل (order_client_meta) على مدير النظام فقط
--
--  بيانات جهاز العميل وعنوان IP بيانات حسّاسة تحدِّد هويته تقريبيًا، وكانت مقروءة —
--  نظريًا — من أي حساب موظف نشِط عبر واجهة Supabase مباشرة، رغم أن صفحة "مراقبة الطلبات"
--  في التطبيق مقصورة على مدير النظام فقط. هذا الملف يقفل القراءة على مستوى قاعدة البيانات
--  نفسها عبر app_is_super_admin()، بصرف النظر عن أي قيد في واجهة التطبيق.
--
--  لا صلاحية كتابة لأي دور: الكتابة تتم بمفتاح service-role من /api/log-order-meta حصرًا،
--  وهذا المفتاح يتجاوز RLS تلقائيًا فلا يحتاج أي سياسة صريحة.
--
--  يعتمد على app_is_super_admin() من db/rls_stage_a.sql.
--  التشغيل: انسخ الملف كله في محرِّر SQL في Supabase ثم نفِّذه. آمن لإعادة التشغيل.
-- ══════════════════════════════════════════════════════════════════════════════

begin;

alter table order_client_meta enable row level security;

-- ✅ إزالة أي سياسة سابقة غير موثَّقة على هذا الجدول، لضمان أن الحالة النهائية بعد هذا الملف
-- هي سياسة واحدة فقط: قراءة مقصورة على مدير النظام
do $$
declare pol text;
begin
  for pol in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'order_client_meta'
  loop
    execute format('drop policy if exists %I on public.order_client_meta', pol);
  end loop;
end $$;

create policy order_client_meta_admin_read on order_client_meta
  for select to authenticated
  using (app_is_super_admin());

-- ──────────────────────────────────────────────────────────────────────────────
--  بوابة تحقق
-- ──────────────────────────────────────────────────────────────────────────────
do $$
begin
  if not exists (
    select 1 from pg_tables t
    join pg_class c on c.relname = t.tablename
    where t.schemaname = 'public' and t.tablename = 'order_client_meta' and c.relrowsecurity
  ) then
    raise exception 'FAIL: RLS غير مفعَّل على order_client_meta';
  end if;

  if (select count(*) from pg_policies where schemaname = 'public' and tablename = 'order_client_meta') <> 1 then
    raise exception 'FAIL: يجب أن توجد سياسة واحدة بالضبط على order_client_meta';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'order_client_meta'
      and policyname = 'order_client_meta_admin_read' and cmd = 'SELECT'
  ) then
    raise exception 'FAIL: سياسة order_client_meta_admin_read مفقودة';
  end if;

  raise notice '════════════════════════════════════';
  raise notice 'ALL CHECKS PASSED — COMMIT أدناه يحفظ التغييرات';
  raise notice '════════════════════════════════════';
end $$;

commit;

notify pgrst, 'reload schema';


-- ══════════════════════════════════════════════════════════════════════════════
--  تحقُّق يدوي
-- ══════════════════════════════════════════════════════════════════════════════
-- select policyname, cmd, roles from pg_policies
-- where schemaname = 'public' and tablename = 'order_client_meta';


-- ══════════════════════════════════════════════════════════════════════════════
--  التراجع
-- ══════════════════════════════════════════════════════════════════════════════
-- begin;
-- drop policy if exists order_client_meta_admin_read on order_client_meta;
-- alter table order_client_meta disable row level security;
-- commit;
