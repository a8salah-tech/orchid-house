-- ══════════════════════════════════════════════════════════════════════════════
--  منيو مستقل لكل فرع — الخطوة (ب): تفعيل منيو KLCC (شغّلها **بعد** رفع النسخة ونجاح النشر)
-- ══════════════════════════════════════════════════════════════════════════════
--  • يفعّل الأقسام والأصناف المنسوخة لـ KLCC، فيراها عملاء KLCC ومدير الفرع.
--  • يُزيل الـ default المؤقت ويجعل branch_id إلزامياً.
--  التشغيل: انسخ الملف كله في Supabase SQL Editor → Run. آمن لإعادة التشغيل.
-- ══════════════════════════════════════════════════════════════════════════════

update menu_categories set is_active = true
where branch_id = '9375998c-0a98-48c8-be7a-485e0c616ae1' and cloned_from is not null and is_active = false;

update menu_items set is_active = true
where branch_id = '9375998c-0a98-48c8-be7a-485e0c616ae1' and cloned_from is not null and is_active = false;

update menu_categories set branch_id = '783bc0ec-16f5-4e6c-9148-9c30b12d42c2' where branch_id is null;
update menu_items      set branch_id = '783bc0ec-16f5-4e6c-9148-9c30b12d42c2' where branch_id is null;

alter table menu_categories alter column branch_id drop default;
alter table menu_items      alter column branch_id drop default;
alter table menu_categories alter column branch_id set not null;
alter table menu_items      alter column branch_id set not null;

notify pgrst, 'reload schema';
