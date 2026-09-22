-- ══════════════════════════════════════════════════════════════════════════════
--  نسب الخدمة والضريبة والخصم لكل طاولة على حدة (بدل ثابت عام 10%/6%/0% لكل المطعم)
-- ══════════════════════════════════════════════════════════════════════════════
--  • tables.service_charge_percent (افتراضي 10) وtables.sst_percent (افتراضي 6):
--    تُطبَّقان على أي طلب في تلك الطاولة بدل الرقم الثابت في كود الكاشير.
--  • tables.discount_percent (افتراضي 0): لو أكبر من صفر يُفرض تلقائياً كخصم ثابت مقفول في شاشة الدفع.
--  • الطاولات الموجودة حالياً تُضبط بحيث لا يتغيّر سلوكها المُطبَّق فعلياً الآن:
--      - طاولات section='takeaway' → خدمة 0% (كما كانت مستثناة دائماً).
--      - طاولة section='staff'     → خدمة 0% وخصم 30% (نفس ما كان مفروضاً في كود الكاشير).
--      - كل الطاولات الأخرى (بما فيها section='cancel_hub' الوهمية) → 10%/6%/0% الافتراضي الحالي.
--  التشغيل: انسخ الملف كله في Supabase SQL Editor → Run. آمن لإعادة التشغيل.
-- ══════════════════════════════════════════════════════════════════════════════

alter table tables add column if not exists service_charge_percent numeric not null default 10;
alter table tables add column if not exists sst_percent numeric not null default 6;
alter table tables add column if not exists discount_percent numeric not null default 0;

update tables set service_charge_percent = 0 where section = 'takeaway';
update tables set service_charge_percent = 0, discount_percent = 30 where section = 'staff';

notify pgrst, 'reload schema';
