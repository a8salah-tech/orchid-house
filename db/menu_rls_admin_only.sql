-- ══════════════════════════════════════════════════════════════════════════════
--  حصر تعديل الأصناف وأحجامها بأصحاب صلاحية menu_manage (مدير النظام) على مستوى قاعدة البيانات
-- ══════════════════════════════════════════════════════════════════════════════
--  المشكلة: السياسة الحالية authenticated_all تسمح لأي حساب موظف مسجّل الدخول بتعديل/حذف أي صنف
--  (الواجهة وحدها تمنع). هذا الملف يقصر التعديل والحذف وإضافة الأحجام على من يملك menu_manage.
--  ما يبقى كما هو:
--    • القراءة للجميع (الزبون يقرأ المنيو بلا تسجيل دخول، والموظفون يقرؤونه).
--    • إضافة «صنف مفتوح» من شاشة الكاشير (is_active = false) تبقى مسموحة لأي موظف.
--    • مسارات الـAPI التي تستخدم service_role (تتجاوز RLS) لا تتأثر.
--  ⚠️ شغّله بعد db/menu_audit.sql، وبعد التشغيل جرّب كمدير نظام: تعديل وصف صنف + إضافة حجم، ومن الكاشير: إضافة صنف مفتوح.
--  للتراجع (لو حصل أي خلل): create policy authenticated_all on menu_items for all to authenticated using (true) with check (true);
--                          وكذلك لـ menu_item_sizes.
--  التشغيل: انسخ الملف كله في Supabase SQL Editor → Run.
-- ══════════════════════════════════════════════════════════════════════════════

begin;

do $$
begin
  if not exists (select 1 from pg_proc where proname = 'app_has_perm') then
    raise exception 'شغّل db/rls_stage_a.sql أولًا (دالة app_has_perm غير موجودة)';
  end if;
end $$;

-- ── menu_items ────────────────────────────────────────────────────────────────
drop policy if exists authenticated_all on public.menu_items;
drop policy if exists menu_items_read on public.menu_items;
drop policy if exists menu_items_insert on public.menu_items;
drop policy if exists menu_items_update on public.menu_items;
drop policy if exists menu_items_delete on public.menu_items;

create policy menu_items_read   on public.menu_items for select to authenticated using (true);
create policy menu_items_insert on public.menu_items for insert to authenticated
  with check (app_has_perm('menu_manage') or is_active = false);   -- is_active=false = «صنف مفتوح» من الكاشير
create policy menu_items_update on public.menu_items for update to authenticated
  using (app_has_perm('menu_manage')) with check (app_has_perm('menu_manage'));
create policy menu_items_delete on public.menu_items for delete to authenticated
  using (app_has_perm('menu_manage'));

-- ── menu_item_sizes ───────────────────────────────────────────────────────────
drop policy if exists authenticated_all on public.menu_item_sizes;
drop policy if exists menu_item_sizes_read on public.menu_item_sizes;
drop policy if exists menu_item_sizes_write on public.menu_item_sizes;

create policy menu_item_sizes_read  on public.menu_item_sizes for select to authenticated using (true);
create policy menu_item_sizes_write on public.menu_item_sizes for all to authenticated
  using (app_has_perm('menu_manage')) with check (app_has_perm('menu_manage'));

-- بوابة تحقق: يجب أن تبقى قراءة الزبون المجهول (anon_read) على الجدولين
do $$
declare n int;
begin
  select count(*) into n from pg_policies
   where schemaname = 'public' and tablename in ('menu_items', 'menu_item_sizes') and policyname = 'anon_read';
  if n <> 2 then
    raise exception 'FAIL: سياسة anon_read مفقودة (قراءة المنيو للزبون) — أُلغيت المعاملة';
  end if;
end $$;

commit;

notify pgrst, 'reload schema';
