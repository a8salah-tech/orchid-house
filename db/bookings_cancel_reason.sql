-- ══════════════════════════════════════════════════════════════════════════════
--  سبب إلغاء الحجز (إجباري من واجهة "حجوزات العملاء") + من ألغى ومتى
--  يظهر السبب في الجدول وفي أعلى نافذة تفاصيل الحجز الملغي.
-- ══════════════════════════════════════════════════════════════════════════════
--  التشغيل: انسخ الملف كله في Supabase SQL Editor → Run. آمن لإعادة التشغيل.
--  الحجوزات الملغاة قبل هذا التاريخ تبقى بلا سبب (تظهر "no reason recorded").
-- ══════════════════════════════════════════════════════════════════════════════

alter table bookings add column if not exists cancel_reason text;
alter table bookings add column if not exists cancelled_by_name text;
alter table bookings add column if not exists cancelled_at timestamptz;

notify pgrst, 'reload schema';
