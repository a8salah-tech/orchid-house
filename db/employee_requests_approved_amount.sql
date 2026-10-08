-- ══════════════════════════════════════════════════════════════════════════════
--  سلف الموظفين: حفظ المبلغ المعتمد قبل التسليم + حصر حذف الطلبات بمدير النظام
-- ══════════════════════════════════════════════════════════════════════════════
--  1) عمود employee_requests.approved_amount: المبلغ الذي يحفظه المعتمِد (زر "حفظ المبلغ فقط") دون اعتماد ولا خصم.
--     عمود amount يبقى المبلغ المطلوب إلى أن يضغط المعتمِد "اعتماد وخصم" عند تسليم السلفة، فيُثبَّت المبلغ النهائي ويُخصم من الراتب.
--  2) تريغر يمنع حذف أي طلب من جدول employee_requests إلا من مدير النظام (تشديد على مستوى قاعدة البيانات؛
--     الواجهة تخفي زر الحذف عن غيره أصلًا). الأدوات الداخلية (service_role / SQL Editor) لا تتأثر.
--  التشغيل: انسخ الملف كله في Supabase SQL Editor → Run. آمن لإعادة التشغيل.
-- ══════════════════════════════════════════════════════════════════════════════

alter table employee_requests add column if not exists approved_amount numeric;

create or replace function app_employee_requests_delete_guard()
returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  -- service_role / SQL Editor (لا يوجد مستخدم مسجَّل) → بلا تغيير
  if auth.uid() is null then return old; end if;
  if not app_is_super_admin() then
    raise exception 'حذف الطلبات لمدير النظام فقط';
  end if;
  return old;
end;
$$;

drop trigger if exists za_employee_requests_delete_guard on employee_requests;
create trigger za_employee_requests_delete_guard
  before delete on employee_requests
  for each row execute function app_employee_requests_delete_guard();

notify pgrst, 'reload schema';
