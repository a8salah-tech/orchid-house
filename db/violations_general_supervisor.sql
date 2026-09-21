-- ══════════════════════════════════════════════════════════════════════════════
--  مخالفات المشرف العام: لا تُعتمد إلا من مدير النظام (تشديد على مستوى قاعدة البيانات)
-- ══════════════════════════════════════════════════════════════════════════════
--  • أي مخالفة يُدرجها المشرف العام بحالة "active" تتحوّل تلقائياً إلى "submitted" (بانتظار اعتماد مدير النظام).
--  • مخالفة سجّلها مشرف عام وحالتها "submitted": لا يغيّر حالتها (اعتماد/إلغاء/إعادة) إلا مدير النظام.
--  الواجهة تخفي الأزرار أصلاً، لكن سياسة التعديل الحالية تسمح لأي دور بصلاحية "المخالفات"
--  بالتعديل عبر الـAPI، فهذا التريغر يقفلها فعلياً.
--  التشغيل: انسخ الملف كله في Supabase SQL Editor → Run. آمن لإعادة التشغيل.
-- ══════════════════════════════════════════════════════════════════════════════

create or replace function app_violations_gs_guard()
returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_creator_role text;
begin
  -- service_role (أدوات داخلية) → بلا تغيير
  if auth.uid() is null then return new; end if;

  if tg_op = 'INSERT' then
    if app_current_role() = 'general_supervisor' and new.status = 'active' then
      new.status := 'submitted';
      new.submitted_at := coalesce(new.submitted_at, now());
    end if;
    return new;
  end if;

  if old.status = 'submitted' and new.status is distinct from old.status and not app_is_super_admin() then
    select role into v_creator_role from employees where id = old.created_by;
    if v_creator_role = 'general_supervisor' then
      raise exception 'مخالفات المشرف العام يعتمدها أو يلغيها مدير النظام فقط';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists za_violations_gs_guard on violations;
create trigger za_violations_gs_guard
  before insert or update on violations
  for each row execute function app_violations_gs_guard();

notify pgrst, 'reload schema';
