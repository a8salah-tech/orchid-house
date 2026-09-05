-- ══════════════════════════════════════════════════════════════════════════════
--  العربون يُنسب ليوم الحجز (يوم رجوع العميل)، مش ليوم أخذ العربون فعليًا
--  عميل يدفع عربون النهارده لحجز الأسبوع الجاي: العربون ما يظهرش في "توتال اليوم"
--  النهارده، يظهر في "توتال اليوم" بتاع يوم الحجز نفسه.
--  التشغيل: انسخ الملف كله في Supabase SQL Editor → Run.
-- ══════════════════════════════════════════════════════════════════════════════

alter table customer_deposits add column if not exists reservation_date date;

-- تعبئة العربونات القديمة: نعتبر يوم الحجز = يوم الأخذ نفسه (بتوقيت ماليزيا) - نفس السلوك القديم بالظبط
update customer_deposits
set reservation_date = (created_at at time zone 'Asia/Kuala_Lumpur')::date
where reservation_date is null;

notify pgrst, 'reload schema';
