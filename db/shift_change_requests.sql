-- ══════════════════════════════════════════════════════════════════════════════
--  طلب "تعيين شيفت": الموظف يطلب تغيير شيفته، والمدير يوافق فيتعدّل جدوله تلقائياً
-- ══════════════════════════════════════════════════════════════════════════════
--  عند إنشاء الطلب (request_type = 'shift_assigned') يُحفظ الشيفت المطلوب في هذه الأعمدة:
--    • requested_shift_id: شيفت من جدول shifts
--    • requested_custom_start / requested_custom_end: أو وقت مخصص (بدون شيفت جاهز)
--    • requested_day_off: أو إجازة (يوم بلا شيفت)
--  عند موافقة المدير يكتب النظام الشيفت في shift_schedules لكل أيام الطلب (من start_date إلى end_date).
--  الصفوف القديمة (إشعارات "جدول شهر كذا" التلقائية) تبقى بلا هذه الأعمدة ولا يتأثر بها شيء.
--  التشغيل: انسخ الملف كله في Supabase SQL Editor → Run. آمن لإعادة التشغيل.
-- ══════════════════════════════════════════════════════════════════════════════

alter table employee_requests add column if not exists requested_shift_id uuid references shifts(id) on delete set null;
alter table employee_requests add column if not exists requested_custom_start time;
alter table employee_requests add column if not exists requested_custom_end time;
alter table employee_requests add column if not exists requested_day_off boolean not null default false;

notify pgrst, 'reload schema';
