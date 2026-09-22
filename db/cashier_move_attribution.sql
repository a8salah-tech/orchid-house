-- ══════════════════════════════════════════════════════════════════════════════
--  من نقل الطلب لطاولة "Staff" أو "Cancellation" — الهوية الحقيقية (اسم بداية الشيفت)
-- ══════════════════════════════════════════════════════════════════════════════
--  حساب الكاشير غالباً مشترك بين أكتر من موظف، فالاسم الحقيقي هو الاسم المُختار وقت بدء
--  الشيفت (activeShiftCashierName) لا اسم الحساب نفسه. عند نقل طلب (كل أو جزء منه) لطاولة
--  "Staff" أو "Cancellation" عبر لوحة "📤 Move"، يُسجَّل هذا الاسم ووقت النقل والطاولة المصدر.
--  التشغيل: انسخ الملف كله في Supabase SQL Editor → Run. آمن لإعادة التشغيل.
-- ══════════════════════════════════════════════════════════════════════════════

alter table orders add column if not exists moved_by_name text;
alter table orders add column if not exists moved_at timestamptz;
alter table orders add column if not exists moved_from_table_name text;

notify pgrst, 'reload schema';
