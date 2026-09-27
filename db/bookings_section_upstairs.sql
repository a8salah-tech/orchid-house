-- ══════════════════════════════════════════════════════════════════════════════
--  إصلاح: خيار "الطابق العلوي (Upstairs)" في صفحة الحجز كان يفشل دائماً
-- ══════════════════════════════════════════════════════════════════════════════
--  صفحة /bookings تعرض 3 خيارات للقسم: outdoor / indoor / upstairs.
--  لكن قيد (CHECK) قديم على جدول bookings كان يسمح فقط بـ outdoor و indoor —
--  فأي عميل يختار "Upstairs" كان حجزه يُرفض برسالة عامة "Error submitting booking"
--  من غير أي سبب واضح. هذا خلل قديم سابق لأي تعديل حديث على صفحة الحجز.
--  التشغيل: انسخ الملف كله في Supabase SQL Editor → Run. آمن لإعادة التشغيل.
-- ══════════════════════════════════════════════════════════════════════════════

alter table bookings drop constraint if exists bookings_section_check;
alter table bookings add constraint bookings_section_check
  check (section in ('outdoor', 'indoor', 'upstairs'));

notify pgrst, 'reload schema';
