-- ══════════════════════════════════════════════════════════════════════════════
--  المخالفات: إلغاء أي مخالفة لمدير النظام فقط (تشديد على مستوى قاعدة البيانات)
-- ══════════════════════════════════════════════════════════════════════════════
--  • أي محاولة لتغيير حالة مخالفة إلى "cancelled" من غير مدير النظام تُرفض برسالة واضحة، مهما كان مصدرها (الواجهة أو الـAPI).
--  • الواجهة تخفي زر الإلغاء عن غير مدير النظام أصلًا. المدراء يقدرون يعيدون المخالفة المعلّقة للمراجعة (draft) فقط.
--  • الأدوات الداخلية (service_role / SQL Editor) لا تتأثر.
--  التشغيل: انسخ الملف كله في Supabase SQL Editor → Run. آمن لإعادة التشغيل.
-- ══════════════════════════════════════════════════════════════════════════════

create or replace function app_violations_cancel_admin_only()
returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is null then return new; end if;
  if new.status = 'cancelled' and old.status is distinct from 'cancelled' and not app_is_super_admin() then
    raise exception 'إلغاء المخالفات لمدير النظام فقط';
  end if;
  return new;
end $$;

drop trigger if exists zb_violations_cancel_admin_only on violations;
create trigger zb_violations_cancel_admin_only
  before update on violations
  for each row execute function app_violations_cancel_admin_only();

notify pgrst, 'reload schema';
