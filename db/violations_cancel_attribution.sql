-- ══════════════════════════════════════════════════════════════════════════════
--  المخالفات: تسجيل من ألغى المخالفة ومتى (ويظهر في صفحة المخالفات لكل من يراها)
-- ══════════════════════════════════════════════════════════════════════════════
--  • أعمدة جديدة في violations: cancelled_by (معرّف الموظف) + cancelled_by_name (الاسم الكامل) + cancelled_at.
--  • تريغر يملؤها تلقائيًا عند أي تحويل حالة المخالفة إلى "cancelled" (من أي مصدر)، وتُسجَّل الكتابات الداخلية بلا مستخدم باسم "⚙️ system".
--  • تعبئة تلقائية للمخالفات الملغاة سابقًا من سجل التدقيق audit_log (الذي يعمل منذ 31 أغسطس 2026).
--    المخالفات التي أُلغيت قبل بدء سجل التدقيق لا يوجد لها أي أثر يدل على من ألغاها، فتبقى بلا اسم ويظهر عليها "غير مسجّل".
--  التشغيل: انسخ الملف كله في Supabase SQL Editor → Run. آمن لإعادة التشغيل.
-- ══════════════════════════════════════════════════════════════════════════════

alter table violations add column if not exists cancelled_by uuid references employees(id) on delete set null;
alter table violations add column if not exists cancelled_by_name text;
alter table violations add column if not exists cancelled_at timestamptz;

create or replace function app_violations_cancel_attribution()
returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_id uuid;
  v_name text;
begin
  if new.status = 'cancelled' and old.status is distinct from 'cancelled' then
    if auth.uid() is null then
      v_name := '⚙️ system';
    else
      select e.id, nullif(trim(coalesce(e.name,'') || ' ' || coalesce(e.name_en,'')), '')
        into v_id, v_name
        from employees e where e.auth_user_id = auth.uid() limit 1;
    end if;
    new.cancelled_by := v_id;
    new.cancelled_by_name := coalesce(v_name, 'Unknown');
    new.cancelled_at := now();
  elsif new.status is distinct from 'cancelled' and old.status = 'cancelled' then
    -- أُعيدت من الإلغاء: نمسح بيانات الإلغاء
    new.cancelled_by := null; new.cancelled_by_name := null; new.cancelled_at := null;
  end if;
  return new;
end $$;

drop trigger if exists zc_violations_cancel_attribution on violations;
create trigger zc_violations_cancel_attribution
  before update on violations
  for each row execute function app_violations_cancel_attribution();

-- تعبئة المخالفات الملغاة سابقًا من سجل التدقيق (آخر إلغاء لكل مخالفة)
update violations v
   set cancelled_by = (select e.id from employees e where e.id = a.actor_employee_id),
       cancelled_by_name = coalesce(a.actor_name, 'Unknown'),
       cancelled_at = a.changed_at
  from (
    select distinct on (row_id) row_id, actor_employee_id, actor_name, changed_at
      from audit_log
     where table_name = 'violations' and action = 'UPDATE'
       and new_row->>'status' = 'cancelled'
       and (old_row->>'status') is distinct from 'cancelled'
     order by row_id, changed_at desc
  ) a
 where v.id::text = a.row_id
   and v.status = 'cancelled'
   and v.cancelled_by_name is null;

notify pgrst, 'reload schema';
