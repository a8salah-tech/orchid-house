-- ══════════════════════════════════════════════════════════════════════════════
--  إشعارات مساعد مدير الصالة: أي حدث لموظف من قسم الصالة في فرعه يصله إشعار
-- ══════════════════════════════════════════════════════════════════════════════
--  الأحداث المغطّاة (عبر تريغرات في قاعدة البيانات، فتشمل أي مصدر: الواجهة، الكاشير، الدوام التلقائي):
--    • مخالفة جديدة على موظف صالة                → جدول violations
--    • غياب بدون عذر جديد لموظف صالة             → جدول absences
--    • طلب جديد من موظف صالة (إجازة، إذن، ...)    → جدول employee_requests
--      (يُستثنى: طلبات زيادة/سلفة الراتب لسريتها، وإشعارات الشيفت وتصحيح الحضور التلقائية)
--  المستلم: كل مساعد مدير صالة نشط في نفس فرع الموظف (ولا يُشعَر بحدث يخصّه هو).
--  فشل الإشعار لأي سبب لا يمنع أبدًا حفظ المخالفة/الغياب/الطلب الأصلي.
--  التشغيل: انسخ الملف كله في Supabase SQL Editor → Run. آمن لإعادة التشغيل.
-- ══════════════════════════════════════════════════════════════════════════════

create or replace function app_notify_hall_assistants(
  p_employee_id uuid, p_type text, p_title text, p_body text
) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_branch uuid;
  v_dept text;
  v_name text;
  v_full text;
begin
  select branch_id, department, name, nullif(trim(coalesce(name,'') || ' ' || coalesce(name_en,'')), '')
    into v_branch, v_dept, v_name, v_full
    from employees where id = p_employee_id;
  if v_branch is null then return; end if;
  if lower(trim(coalesce(v_dept,''))) not in ('الصالة','hall') then return; end if;

  begin
    insert into notifications (type, title, body, link, target_role, target_employee_id, is_read)
    select p_type, p_title, coalesce(v_full, v_name, '') || ' — ' || coalesce(p_body,''),
           '/dashboard/hr/violations', null, a.id, false
      from employees a
     where a.role = 'hall_assistant_manager' and a.is_active = true
       and a.branch_id = v_branch and a.id <> p_employee_id;
  exception when others then
    -- لو نوع الإشعار غير مسموح في جدول notifications نرجع للنوع العام "request"
    begin
      insert into notifications (type, title, body, link, target_role, target_employee_id, is_read)
      select 'request', p_title, coalesce(v_full, v_name, '') || ' — ' || coalesce(p_body,''),
             '/dashboard/hr/violations', null, a.id, false
        from employees a
       where a.role = 'hall_assistant_manager' and a.is_active = true
         and a.branch_id = v_branch and a.id <> p_employee_id;
    exception when others then null;
    end;
  end;
end $$;

-- ── مخالفة جديدة ──
create or replace function trg_notify_hall_assistants_violation()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  begin
    perform app_notify_hall_assistants(
      new.employee_id, 'violation', '⚠️ مخالفة جديدة لموظف في قسمك',
      coalesce(new.reason, 'مخالفة') || case when new.amount is not null then ' (MYR ' || new.amount::text || ')' else '' end
    );
  exception when others then null;
  end;
  return new;
end $$;

drop trigger if exists zb_notify_hall_assistants_violation on violations;
create trigger zb_notify_hall_assistants_violation
  after insert on violations
  for each row execute function trg_notify_hall_assistants_violation();

-- ── غياب بدون عذر ──
create or replace function trg_notify_hall_assistants_absence()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  begin
    perform app_notify_hall_assistants(
      new.employee_id, 'request', '🚫 غياب بدون عذر لموظف في قسمك',
      'بتاريخ ' || coalesce(new.date::text, '')
    );
  exception when others then null;
  end;
  return new;
end $$;

drop trigger if exists zb_notify_hall_assistants_absence on absences;
create trigger zb_notify_hall_assistants_absence
  after insert on absences
  for each row execute function trg_notify_hall_assistants_absence();

-- ── طلب جديد من موظف ──
create or replace function trg_notify_hall_assistants_request()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.request_type in ('salary_increase','salary_advance','shift_assigned','attendance_correction') then
    return new;
  end if;
  begin
    perform app_notify_hall_assistants(
      new.employee_id, 'request', '📋 طلب جديد من موظف في قسمك',
      coalesce(nullif(new.title, ''), new.request_type, 'طلب')
    );
  exception when others then null;
  end;
  return new;
end $$;

drop trigger if exists zb_notify_hall_assistants_request on employee_requests;
create trigger zb_notify_hall_assistants_request
  after insert on employee_requests
  for each row execute function trg_notify_hall_assistants_request();

notify pgrst, 'reload schema';
