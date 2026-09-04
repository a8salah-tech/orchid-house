-- ══════════════════════════════════════════════════════════════════════════════
--  ترجمة محتوى المنيو إلى الماليزية (Bahasa Malaysia)
--  يضيف عمود ms جنب كل عمود ar/en موجود — نفس نمط name / name_en.
--  التشغيل: انسخ الملف كله في Supabase SQL Editor → Run. آمن لإعادة التشغيل.
-- ══════════════════════════════════════════════════════════════════════════════

alter table menu_categories   add column if not exists name_ms        text;
alter table menu_items        add column if not exists name_ms        text;
alter table menu_items        add column if not exists description_ms  text;
alter table menu_item_sizes   add column if not exists name_ms        text;

notify pgrst, 'reload schema';
