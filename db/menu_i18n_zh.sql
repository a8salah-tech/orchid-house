-- ══════════════════════════════════════════════════════════════════════════════
--  ترجمة المنيو للصينية (name_zh / description_zh) — إضافة الأعمدة فقط
--
--  نفس نمط أعمدة الماليزية (name_ms / description_ms) الموجودة أصلاً. القيم نفسها
--  تُملأ في ملفات db/menu_i18n_zh_data_*.sql المنفصلة (أقسام، أصناف، أحجام).
--
--  التشغيل: انسخ الملف كله في Supabase SQL Editor → Run مرة واحدة. آمن لإعادة التشغيل.
-- ══════════════════════════════════════════════════════════════════════════════

alter table menu_categories  add column if not exists name_zh text;
alter table menu_items       add column if not exists name_zh text;
alter table menu_items       add column if not exists description_zh text;
alter table menu_item_sizes  add column if not exists name_zh text;

notify pgrst, 'reload schema';
