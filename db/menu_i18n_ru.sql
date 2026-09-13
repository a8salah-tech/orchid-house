-- ══════════════════════════════════════════════════════════════════════════════
--  ترجمة المنيو للروسية (name_ru / description_ru) — إضافة الأعمدة فقط
--
--  نفس نمط أعمدة الصينية (name_zh / description_zh) المضافة في db/menu_i18n_zh.sql.
--  القيم نفسها تُملأ في ملفات db/menu_i18n_ru_data_*.sql المنفصلة (أقسام، أصناف، أحجام).
--
--  التشغيل: انسخ الملف كله في Supabase SQL Editor → Run مرة واحدة. آمن لإعادة التشغيل.
-- ══════════════════════════════════════════════════════════════════════════════

alter table menu_categories  add column if not exists name_ru text;
alter table menu_items       add column if not exists name_ru text;
alter table menu_items       add column if not exists description_ru text;
alter table menu_item_sizes  add column if not exists name_ru text;

notify pgrst, 'reload schema';
