-- ══════════════════════════════════════════════════════════════════════════════
--  سجل التدقيق (Audit Log) — من غيّر ماذا ومتى على الجداول الحساسة
-- ══════════════════════════════════════════════════════════════════════════════
--
--  يضيف:
--    • جدول audit_log (يقرأه مدير النظام فقط، ولا يُعدَّل أو يُحذَف من أي أحد)
--    • دالة trigger عامة تسجّل كل INSERT/UPDATE/DELETE مع:
--        - من: auth.uid() + معرّف/اسم/دور الموظف
--        - متى: changed_at
--        - ماذا: الصف القديم + الجديد + قائمة الأعمدة التي تغيّرت فعلاً
--    • triggers على: payroll_records, violations, absences, salary_increases,
--                     roles_permissions, employees
--
--  كتابات service_role (مسارات API، auto-checkout) تُسجَّل باسم "⚙️ system".
--  يعتمد على app_is_super_admin() من db/rls_stage_a.sql.
--
--  التشغيل: انسخ الملف كله في Supabase SQL Editor → Run مرة واحدة.
-- ══════════════════════════════════════════════════════════════════════════════

begin;

-- ──────────────────────────────────────────────────────────────────────────────
-- (1) الجدول
-- ──────────────────────────────────────────────────────────────────────────────
create table if not exists audit_log (
  id                bigint generated always as identity primary key,
  changed_at        timestamptz not null default now(),
  table_name        text not null,
  row_id            text,
  action            text not null,            -- INSERT | UPDATE | DELETE
  actor_auth_uid    uuid,                     -- من JWT؛ NULL لكتابات service_role
  actor_employee_id uuid,
  actor_name        text,
  actor_role        text,
  changed_fields    text[],                   -- للـ UPDATE فقط
  old_row           jsonb,
  new_row           jsonb
);

create index if not exists idx_audit_changed_at on audit_log (changed_at desc);
create index if not exists idx_audit_table      on audit_log (table_name, changed_at desc);
create index if not exists idx_audit_actor      on audit_log (actor_employee_id, changed_at desc);
create index if not exists idx_audit_row        on audit_log (table_name, row_id);

-- القراءة لمدير النظام فقط؛ لا سياسة كتابة/حذف → الجدول غير قابل للتعديل من أحد
-- (الـ trigger أدناه SECURITY DEFINER فيكتب فيه رغم غياب سياسة الكتابة)
alter table audit_log enable row level security;
drop policy if exists audit_read on audit_log;
create policy audit_read on audit_log for select to authenticated using (app_is_super_admin());

-- ──────────────────────────────────────────────────────────────────────────────
-- (2) دالة الـ trigger العامة
-- ──────────────────────────────────────────────────────────────────────────────
create or replace function app_audit_trigger()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_emp_id     uuid;
  v_emp_name   text;
  v_emp_role   text;
  v_old        jsonb := null;
  v_new        jsonb := null;
  v_row_id     text;
  v_changed    text[] := null;
begin
  select e.id,
         nullif(trim(coalesce(e.name,'') || ' ' || coalesce(e.name_en,'')), ''),
         e.role
    into v_emp_id, v_emp_name, v_emp_role
  from employees e
  where e.auth_user_id = auth.uid()
  limit 1;

  if (tg_op = 'DELETE') then
    v_old := to_jsonb(old);
    v_row_id := (v_old->>'id');
  elsif (tg_op = 'INSERT') then
    v_new := to_jsonb(new);
    v_row_id := (v_new->>'id');
  else
    v_old := to_jsonb(old);
    v_new := to_jsonb(new);
    v_row_id := (v_new->>'id');
    select array_agg(n.key order by n.key) into v_changed
    from jsonb_each(v_new) n
    where n.value is distinct from (v_old -> n.key);
    -- لا تسجّل تحديثاً لم يغيّر أي عمود فعلياً
    if v_changed is null then
      return new;
    end if;
  end if;

  insert into audit_log(
    table_name, row_id, action,
    actor_auth_uid, actor_employee_id, actor_name, actor_role,
    changed_fields, old_row, new_row
  ) values (
    tg_table_name, v_row_id, tg_op,
    auth.uid(), v_emp_id,
    coalesce(v_emp_name, case when auth.uid() is null then '⚙️ system' else '(unknown)' end),
    v_emp_role,
    v_changed, v_old, v_new
  );

  if (tg_op = 'DELETE') then return old; else return new; end if;
end $$;

-- ──────────────────────────────────────────────────────────────────────────────
-- (3) ربط الـ triggers  (zz_ لكي تعمل بعد أي trigger آخر وتلتقط الحالة النهائية)
-- ──────────────────────────────────────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array[
    'payroll_records','violations','absences','salary_increases',
    'roles_permissions','employees'
  ] loop
    execute format('drop trigger if exists zz_audit on public.%I', t);
    execute format(
      'create trigger zz_audit after insert or update or delete on public.%I
       for each row execute function app_audit_trigger()', t);
  end loop;
end $$;

-- ──────────────────────────────────────────────────────────────────────────────
-- (4) بوابة تحقق
-- ──────────────────────────────────────────────────────────────────────────────
do $$
declare n int;
begin
  if not exists (select 1 from information_schema.tables
                 where table_schema='public' and table_name='audit_log') then
    raise exception 'FAIL: audit_log not created';
  end if;

  select count(*) into n
  from pg_trigger tg
  join pg_class c on c.oid = tg.tgrelid
  where tg.tgname = 'zz_audit'
    and c.relname in ('payroll_records','violations','absences','salary_increases','roles_permissions','employees');
  if n <> 6 then raise exception 'FAIL: expected 6 audit triggers, found %', n; end if;

  if not exists (select 1 from pg_proc p join pg_namespace ns on ns.oid=p.pronamespace
                 where ns.nspname='public' and p.proname='app_audit_trigger' and p.prosecdef) then
    raise exception 'FAIL: app_audit_trigger missing or not SECURITY DEFINER';
  end if;

  raise notice '════════════════════════════════════';
  raise notice 'ALL CHECKS PASSED — COMMIT below saves';
  raise notice '════════════════════════════════════';
end $$;

commit;


-- ══════════════════════════════════════════════════════════════════════════════
--  اختبار
-- ══════════════════════════════════════════════════════════════════════════════
--  عدّل أي مخالفة من صفحة إدارة المخالفات، ثم (كمدير نظام):
--    select changed_at, table_name, action, actor_name, actor_role, changed_fields
--    from audit_log order by changed_at desc limit 20;


-- ══════════════════════════════════════════════════════════════════════════════
--  استعلامات جاهزة (شغّلها كمدير نظام)
-- ══════════════════════════════════════════════════════════════════════════════

-- آخر 50 تعديلاً على الجداول الحساسة
-- select changed_at, table_name, action,
--        actor_name, actor_role, row_id, changed_fields
-- from audit_log order by changed_at desc limit 50;

-- كل ما فعله موظف معيّن
-- select changed_at, table_name, action, row_id, changed_fields, old_row, new_row
-- from audit_log
-- where actor_employee_id = '<employee id>'
-- order by changed_at desc;

-- كل التعديلات على كشف راتب معيّن، ومن أجراها
-- select changed_at, action, actor_name, actor_role, changed_fields, old_row, new_row
-- from audit_log
-- where table_name = 'payroll_records' and row_id = '<payroll_record id>'
-- order by changed_at desc;

-- تعديلات مشبوهة: تغيير مبلغ مخالفة أو قيمة راتب من شخص غير مدير النظام
-- select changed_at, table_name, actor_name, actor_role, changed_fields,
--        old_row->>'amount' as old_amount, new_row->>'amount' as new_amount,
--        old_row->>'amount_due' as old_due, new_row->>'amount_due' as new_due
-- from audit_log
-- where action = 'UPDATE'
--   and (changed_fields && array['amount','amount_due','late_hours','absence_days',
--        'deduction_1','deduction_2','deduction_3','advance','permissions','role','salary'])
--   and coalesce(actor_role,'') <> 'admin'
-- order by changed_at desc;


-- ══════════════════════════════════════════════════════════════════════════════
--  التراجع
-- ══════════════════════════════════════════════════════════════════════════════
-- begin;
-- do $$ declare t text; begin
--   foreach t in array array['payroll_records','violations','absences',
--     'salary_increases','roles_permissions','employees'] loop
--     execute format('drop trigger if exists zz_audit on public.%I', t);
--   end loop;
-- end $$;
-- drop function if exists app_audit_trigger();
-- drop table if exists audit_log;
-- commit;
