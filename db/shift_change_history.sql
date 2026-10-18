-- ══════════════════════════════════════════════════════════════════════════════
--  سجل تعديلات الشيفت — يظهر في صفحة الحضور بجانب ساعة الدخول الفعلية
-- ══════════════════════════════════════════════════════════════════════════════
--  المشكلة: أي تعديل على الشيفت (صفحة الشيفتات أو موافقة طلب «تعيين شيفت») يحذف الصف القديم ويكتب الجديد،
--  فلا يبقى أي أثر للشيفت الأصلي ولا لوقت التعديل. صفحة الحضور لا ترى إلا الشيفت بعد التعديل.
--
--  الحل (يعمل تلقائياً من قاعدة البيانات فيشمل كل مسارات التعديل):
--    • تريغر على shift_schedules يلتقط الصف المحذوف مؤقتاً، وعند إدراج صف بنفس (الموظف، اليوم) خلال 5 دقائق
--      يقارن القديم بالجديد؛ إن اختلفا (وقت البداية أو النهاية أو إجازة↔عمل) يسجّل تعديلاً: القديم، الجديد،
--      الوقت الدقيق، ومن قام به. إعادة كتابة الجدول بنفس القيم (حفظ الشهر كاملاً) لا تُسجَّل.
--    • حذف يوم دون إعادة إدراجه (إلغاء الشيفت) يُسجَّل كـ«أُلغي الشيفت» بعد مرور 5 دقائق.
--    • تعديل UPDATE مباشر على الصف يُسجَّل أيضاً.
--  القراءة عبر الدالة app_shift_changes() فقط، وهي تُرجع صفاً فقط لغير الموظفين الأساسيين (مدير النظام والمديرون والمشرفون).
--
--  ⚠️ التسجيل يبدأ من لحظة تشغيل الملف؛ التعديلات السابقة لا يمكن استرجاعها.
--  ⚠️ لا يغيّر أي حساب للتأخير أو الرواتب — عرض وتسجيل فقط.
--  لا يتطلب شيئاً غير db/rls_stage_a.sql (app_is_basic_employee).
--  التشغيل: انسخ الملف كله في Supabase SQL Editor → Run. معاملة واحدة وآمن لإعادة التشغيل.
--  التراجع:  drop trigger if exists zz_shift_track on public.shift_schedules;
-- ══════════════════════════════════════════════════════════════════════════════

begin;

do $$
begin
  if not exists (select 1 from pg_proc where proname = 'app_is_basic_employee') then
    raise exception 'شغّل db/rls_stage_a.sql أولًا (الدوال المساعدة غير موجودة)';
  end if;
end $$;

-- ── الجداول ──────────────────────────────────────────────────────────────────
create table if not exists public.shift_schedule_changes (
  id                     bigint generated always as identity primary key,
  employee_id            uuid not null,
  date                   date not null,
  old_start              time, old_end time, old_leave boolean not null default false,
  new_start              time, new_end time, new_leave boolean not null default false,
  new_removed            boolean not null default false,
  changed_at             timestamptz not null default now(),
  changed_by_employee_id uuid,
  changed_by_name        text
);
create index if not exists idx_ssc_emp_date on public.shift_schedule_changes (employee_id, date);
create index if not exists idx_ssc_date on public.shift_schedule_changes (date);

create table if not exists public.shift_schedule_pending_deletes (
  id                     bigint generated always as identity primary key,
  employee_id            uuid not null,
  date                   date not null,
  old_start              time, old_end time, old_leave boolean not null default false,
  deleted_at             timestamptz not null default now(),
  actor_employee_id      uuid,
  actor_name             text
);
create index if not exists idx_sspd_emp_date on public.shift_schedule_pending_deletes (employee_id, date);

-- لا سياسات = لا وصول مباشر لأحد؛ التريغر والدالة SECURITY DEFINER فقط
alter table public.shift_schedule_changes enable row level security;
alter table public.shift_schedule_pending_deletes enable row level security;

-- ── التريغر ──────────────────────────────────────────────────────────────────
create or replace function app_shift_sched_track()
returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_emp uuid; v_name text;
  sh_s time; sh_e time;
  o_s time; o_e time; o_l boolean := false;
  n_s time; n_e time; n_l boolean := false;
  p record;
begin
  begin
    if auth.uid() is not null then
      select id, name into v_emp, v_name from employees where auth_user_id = auth.uid() limit 1;
    end if;

    if tg_op in ('DELETE', 'UPDATE') then
      sh_s := null; sh_e := null;
      select start_time::time, end_time::time into sh_s, sh_e from shifts where id = old.shift_id;
      o_s := coalesce(old.custom_start::time, sh_s);
      o_e := coalesce(old.custom_end::time, sh_e);
      o_l := (old.shift_id is null and old.custom_start is null);
    end if;
    if tg_op in ('INSERT', 'UPDATE') then
      sh_s := null; sh_e := null;
      select start_time::time, end_time::time into sh_s, sh_e from shifts where id = new.shift_id;
      n_s := coalesce(new.custom_start::time, sh_s);
      n_e := coalesce(new.custom_end::time, sh_e);
      n_l := (new.shift_id is null and new.custom_start is null);
    end if;

    if tg_op = 'DELETE' then
      -- نظافة: ما مرّ عليه أكثر من 5 دقائق دون إعادة إدراج = شيفت أُلغي فعلاً، نحوّله إلى تعديل «أُلغي»
      insert into shift_schedule_changes (employee_id, date, old_start, old_end, old_leave, new_removed, changed_at, changed_by_employee_id, changed_by_name)
        select employee_id, date, old_start, old_end, old_leave, true, deleted_at, actor_employee_id, actor_name
          from shift_schedule_pending_deletes where deleted_at < now() - interval '5 minutes';
      delete from shift_schedule_pending_deletes where deleted_at < now() - interval '5 minutes';
      insert into shift_schedule_pending_deletes (employee_id, date, old_start, old_end, old_leave, actor_employee_id, actor_name)
        values (old.employee_id, old.date, o_s, o_e, o_l, v_emp, v_name);
      return old;

    elsif tg_op = 'INSERT' then
      select * into p from shift_schedule_pending_deletes
        where employee_id = new.employee_id and date = new.date and deleted_at > now() - interval '5 minutes'
        order by deleted_at desc limit 1;
      if found then
        delete from shift_schedule_pending_deletes where employee_id = new.employee_id and date = new.date;
        if (p.old_start, p.old_end, p.old_leave) is distinct from (n_s, n_e, n_l) then
          insert into shift_schedule_changes (employee_id, date, old_start, old_end, old_leave, new_start, new_end, new_leave, changed_by_employee_id, changed_by_name)
            values (new.employee_id, new.date, p.old_start, p.old_end, p.old_leave, n_s, n_e, n_l, v_emp, v_name);
        end if;
      end if;
      return new;

    else -- UPDATE
      if (o_s, o_e, o_l) is distinct from (n_s, n_e, n_l) then
        insert into shift_schedule_changes (employee_id, date, old_start, old_end, old_leave, new_start, new_end, new_leave, changed_by_employee_id, changed_by_name)
          values (new.employee_id, new.date, o_s, o_e, o_l, n_s, n_e, n_l, v_emp, v_name);
      end if;
      return new;
    end if;
  exception when others then
    -- التسجيل لا يعطّل حفظ الجدول أبداً
    if tg_op = 'DELETE' then return old; else return new; end if;
  end;
end $$;

drop trigger if exists zz_shift_track on public.shift_schedules;
create trigger zz_shift_track after insert or update or delete on public.shift_schedules
  for each row execute function app_shift_sched_track();

-- ── القراءة: للمديرين والمشرفين ومدير النظام فقط ───────────────────────────────
create or replace function app_shift_changes(p_from date, p_to date, p_emp uuid default null)
returns table (
  employee_id uuid, date date,
  old_start time, old_end time, old_leave boolean,
  new_start time, new_end time, new_leave boolean, new_removed boolean,
  changed_at timestamptz, changed_by_name text
)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if app_is_basic_employee() then return; end if;
  return query
    select x.* from (
    select c.employee_id, c.date, c.old_start, c.old_end, c.old_leave,
           c.new_start, c.new_end, c.new_leave, c.new_removed, c.changed_at, c.changed_by_name
      from shift_schedule_changes c
     where c.date between p_from and p_to and (p_emp is null or c.employee_id = p_emp)
    union all
    -- محذوف لم يُعَد إدراجه ومرّت عليه 5 دقائق = شيفت أُلغي (لم يُحوَّل إلى سجل بعد)
    select d.employee_id, d.date, d.old_start, d.old_end, d.old_leave,
           null::time, null::time, false, true, d.deleted_at, d.actor_name
      from shift_schedule_pending_deletes d
     where d.date between p_from and p_to and (p_emp is null or d.employee_id = p_emp)
       and d.deleted_at < now() - interval '5 minutes'
    ) x order by x.changed_at;
end $$;
grant execute on function app_shift_changes(date, date, uuid) to authenticated;

-- ── بوابة التحقق ──────────────────────────────────────────────────────────────
do $$
declare bad text := '';
begin
  if not exists (select 1 from pg_trigger where tgname = 'zz_shift_track') then bad := bad || 'التريغر؛ '; end if;
  if not exists (select 1 from pg_proc where proname = 'app_shift_changes') then bad := bad || 'الدالة؛ '; end if;
  if bad <> '' then raise exception 'FAIL: %', bad; end if;
end $$;

commit;

notify pgrst, 'reload schema';
