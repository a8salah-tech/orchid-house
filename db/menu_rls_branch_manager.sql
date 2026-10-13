-- ══════════════════════════════════════════════════════════════════════════════
--  تصحيح db/menu_rls_admin_only.sql: السماح لمدير الفرع بتعديل أصناف فرعه (كما تسمح له الواجهة)
-- ══════════════════════════════════════════════════════════════════════════════
--  الخطأ: ملف menu_rls_admin_only.sql قصر الكتابة على من يملك صلاحية menu_manage فقط، بينما واجهة «الأصناف (المنيو)»
--  تسمح أيضًا لمدير الفرع (branch_manager) بتعديل منيو فرعه. فصار تعديل مدير فرع KLCC يُرفض من قاعدة البيانات.
--  هذا الملف يعيد السياسات بحيث يكتب في الأصناف وأحجامها:
--    • من يملك menu_manage (مدير النظام) — كل الفروع
--    • مدير الفرع — أصناف فرعه فقط
--  القراءة للجميع كما هي، وإضافة «صنف مفتوح» من الكاشير (is_active=false) تبقى مسموحة.
--  التشغيل: انسخ الملف كله في Supabase SQL Editor → Run. آمن لإعادة التشغيل.
-- ══════════════════════════════════════════════════════════════════════════════

begin;

-- menu_items
drop policy if exists menu_items_insert on public.menu_items;
drop policy if exists menu_items_update on public.menu_items;
drop policy if exists menu_items_delete on public.menu_items;

create policy menu_items_insert on public.menu_items for insert to authenticated
  with check (
    app_has_perm('menu_manage')
    or (app_current_role() = 'branch_manager' and branch_id = app_current_branch_id())
    or is_active = false            -- «صنف مفتوح» من الكاشير
  );
create policy menu_items_update on public.menu_items for update to authenticated
  using (app_has_perm('menu_manage') or (app_current_role() = 'branch_manager' and branch_id = app_current_branch_id()))
  with check (app_has_perm('menu_manage') or (app_current_role() = 'branch_manager' and branch_id = app_current_branch_id()));
create policy menu_items_delete on public.menu_items for delete to authenticated
  using (app_has_perm('menu_manage') or (app_current_role() = 'branch_manager' and branch_id = app_current_branch_id()));

-- menu_item_sizes: تُحكم عبر الصنف الأب
drop policy if exists menu_item_sizes_write on public.menu_item_sizes;
create policy menu_item_sizes_write on public.menu_item_sizes for all to authenticated
  using (
    app_has_perm('menu_manage')
    or exists (select 1 from public.menu_items mi
                where mi.id = menu_item_sizes.menu_item_id
                  and app_current_role() = 'branch_manager' and mi.branch_id = app_current_branch_id())
  )
  with check (
    app_has_perm('menu_manage')
    or exists (select 1 from public.menu_items mi
                where mi.id = menu_item_sizes.menu_item_id
                  and app_current_role() = 'branch_manager' and mi.branch_id = app_current_branch_id())
  );

do $$
declare n int;
begin
  select count(*) into n from pg_policies
   where schemaname = 'public' and tablename in ('menu_items', 'menu_item_sizes') and policyname = 'anon_read';
  if n <> 2 then raise exception 'FAIL: سياسة anon_read مفقودة — أُلغيت المعاملة'; end if;
end $$;

commit;

notify pgrst, 'reload schema';
