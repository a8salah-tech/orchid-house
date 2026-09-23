-- ══════════════════════════════════════════════════════════════════════════════
--  فصل "وجبات الموظفين من الكاشير" عن المخالفات العادية
-- ══════════════════════════════════════════════════════════════════════════════
--  الكاشير كان يسجّل الوجبة الشخصية وخطأ الطلب في جدول المخالفات بحالة "active"، بلا أي عمود يميّزها.
--  • violations.kind: 'violation' (الافتراضي — مخالفة عادية أو خصم نظام) | 'personal_meal' (وجبة شخصية) | 'order_mistake' (خطأ في الطلب)
--  • تعبئة القديم تلقائياً حسب بداية نص السبب اللي كتبه الكاشير ("🍽️ خصم كاشير - وجبة شخصية" / "… - خطأ في الطلب").
--  • payroll_records.personal_meal_deduction / order_mistake_deduction: خصمان منفصلان في كشف الراتب
--    (deduction_1 يبقى للمخالفات العادية فقط). تُحسبان تلقائياً من المخالفات النشطة عند إعادة حساب الشهر.
--  التشغيل: انسخ الملف كله في Supabase SQL Editor → Run. آمن لإعادة التشغيل.
-- ══════════════════════════════════════════════════════════════════════════════

alter table violations add column if not exists kind text not null default 'violation';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'violations_kind_check') then
    alter table violations add constraint violations_kind_check
      check (kind in ('violation', 'personal_meal', 'order_mistake'));
  end if;
end $$;

update violations set kind = 'personal_meal'
where kind = 'violation' and reason like '🍽️ خصم كاشير - وجبة شخصية%';

update violations set kind = 'order_mistake'
where kind = 'violation' and reason like '🍽️ خصم كاشير - خطأ في الطلب%';

create index if not exists violations_kind_idx on violations (kind);

alter table payroll_records add column if not exists personal_meal_deduction numeric not null default 0;
alter table payroll_records add column if not exists order_mistake_deduction numeric not null default 0;

notify pgrst, 'reload schema';
