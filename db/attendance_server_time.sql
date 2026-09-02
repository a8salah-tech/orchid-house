-- ══════════════════════════════════════════════════════════════════════════════
--  توقيت الحضور والانصراف من السيرفر (توقيت ماليزيا الثابت UTC+8)
-- ══════════════════════════════════════════════════════════════════════════════
--
--  المشكلة: صفحة الحضور تأخذ وقت الدخول/الخروج من ساعة جهاز الموظف وتحسب التأخير
--  منها. موظف يرجّع ساعته للخلف → يظهر في الميعاد.
--
--  الحل: BEFORE trigger على attendance. عندما تكون الكتابة من موظف عادي مسجَّل دخول
--  لنفسه فقط — يُستبدل وقت الجهاز بوقت السيرفر now()، ويُعاد حساب التأخير/الخروج المبكر/
--  تاريخ اليوم في السيرفر بتوقيت ماليزيا. وقت الجهاز المُدّعى يُحفَظ في عمود منفصل.
--
--  لا يمسّ: تعديلات المدير اليدوية، auto-checkout (service_role)، تصحيح الحضور
--  في صفحة الطلبات، الاستيراد — كلها تمرّ بلا تغيير.
--
--  لا يتطلب أي تغيير في كود الواجهة. يعتمد على app_is_basic_employee() من
--  db/rls_stage_a.sql.
--
--  التشغيل: انسخ الملف كله في Supabase SQL Editor → Run مرة واحدة.
-- ══════════════════════════════════════════════════════════════════════════════

begin;

-- ──────────────────────────────────────────────────────────────────────────────
-- (1) عمودا وقت الجهاز المُدّعى (للتدقيق وكشف انحراف الساعة)
-- ──────────────────────────────────────────────────────────────────────────────
alter table attendance
  add column if not exists client_check_in_time  timestamptz,
  add column if not exists client_check_out_time timestamptz;

-- ──────────────────────────────────────────────────────────────────────────────
-- (2) دوال حساب الشيفت/التأخير — ترجمة src/lib/attendanceCalc.ts
-- ──────────────────────────────────────────────────────────────────────────────

-- تاريخ اليوم بتوقيت ماليزيا
create or replace function app_my_date(p_ts timestamptz)
returns date language sql stable security definer set search_path = public, pg_temp as $$
  select (p_ts at time zone 'Asia/Kuala_Lumpur')::date
$$;

-- تاريخ صف الحضور: اليوم، أو أمس لو شيفت أمس ليلي وما زال جارياً
create or replace function app_attendance_date(p_emp uuid, p_now timestamptz)
returns date language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_today date := (p_now at time zone 'Asia/Kuala_Lumpur')::date;
  v_yest  date := v_today - 1;
  y_start time; y_end time;
  v_end_of_night timestamptz;
begin
  select coalesce(ss.custom_start, sh.start_time)::time,
         coalesce(ss.custom_end,   sh.end_time)::time
    into y_start, y_end
  from shift_schedules ss
  left join shifts sh on sh.id = ss.shift_id
  where ss.employee_id = p_emp and ss.date = v_yest
  limit 1;

  if y_start is not null and y_end is not null and y_end <= y_start then
    v_end_of_night := (v_today + y_end) at time zone 'Asia/Kuala_Lumpur';
    if p_now < v_end_of_night then
      return v_yest;
    end if;
  end if;
  return v_today;
end $$;

-- نافذة الشيفت المطابقة لبصمة (تفحص أمس/اليوم/غداً وتختار الأقرب)
create or replace function app_resolve_shift_window(p_emp uuid, p_date date, p_anchor timestamptz)
returns table(start_ts timestamptz, end_ts timestamptz, duration_mins int)
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  r record;
  st time; en time;
  v_start timestamptz; v_end timestamptz; v_dist interval;
  v_best_dist interval := null;
  v_best_start timestamptz := null;
  v_best_end timestamptz := null;
begin
  for r in
    select ss.date as sdate,
           coalesce(ss.custom_start, sh.start_time) as start_time,
           coalesce(ss.custom_end,   sh.end_time)   as end_time
    from shift_schedules ss
    left join shifts sh on sh.id = ss.shift_id
    where ss.employee_id = p_emp
      and ss.date between p_date - 1 and p_date + 1
  loop
    if r.start_time is null or r.end_time is null then continue; end if;
    st := r.start_time::time; en := r.end_time::time;
    v_start := (r.sdate + st) at time zone 'Asia/Kuala_Lumpur';
    if en <= st then
      v_end := ((r.sdate + 1) + en) at time zone 'Asia/Kuala_Lumpur';
    else
      v_end := (r.sdate + en) at time zone 'Asia/Kuala_Lumpur';
    end if;
    if p_anchor < v_start then
      v_dist := v_start - p_anchor;
    elsif p_anchor > v_end then
      v_dist := p_anchor - v_end;
    else
      v_dist := interval '0';
    end if;
    if v_best_dist is null or v_dist < v_best_dist then
      v_best_dist := v_dist; v_best_start := v_start; v_best_end := v_end;
    end if;
  end loop;

  if v_best_start is null then return; end if;
  start_ts := v_best_start;
  end_ts := v_best_end;
  duration_mins := round(extract(epoch from (v_best_end - v_best_start)) / 60)::int;
  return next;
end $$;

-- دقائق التأخير + الحالة
create or replace function app_compute_late(p_emp uuid, p_date date, p_checkin timestamptz)
returns table(status text, late_minutes int)
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  w record;
  v_start timestamptz;
  v_dur int := null;
  v_diff int;
begin
  select * into w from app_resolve_shift_window(p_emp, p_date, p_checkin);
  if found then
    v_start := w.start_ts; v_dur := w.duration_mins;
  else
    v_start := (p_date + time '09:00') at time zone 'Asia/Kuala_Lumpur';
  end if;
  v_diff := floor(extract(epoch from (p_checkin - v_start)) / 60)::int;
  if v_dur is not null and v_diff >= v_dur then
    status := 'present'; late_minutes := 0; return next; return;
  end if;
  if v_diff > 10 then
    status := 'late'; late_minutes := v_diff;
  else
    status := 'present'; late_minutes := 0;
  end if;
  return next;
end $$;

-- دقائق الخروج المبكر
create or replace function app_compute_early(p_emp uuid, p_date date, p_checkout timestamptz, p_checkin timestamptz)
returns int language plpgsql stable security definer set search_path = public, pg_temp as $$
declare w record; v_diff int;
begin
  select * into w from app_resolve_shift_window(p_emp, p_date, coalesce(p_checkin, p_checkout));
  if not found then return 0; end if;
  v_diff := floor(extract(epoch from (w.end_ts - p_checkout)) / 60)::int;
  if v_diff >= w.duration_mins then return 0; end if;
  if v_diff > 10 then return v_diff; else return 0; end if;
end $$;

grant execute on function
  app_my_date(timestamptz),
  app_attendance_date(uuid, timestamptz),
  app_resolve_shift_window(uuid, date, timestamptz),
  app_compute_late(uuid, date, timestamptz),
  app_compute_early(uuid, date, timestamptz, timestamptz)
to authenticated;

-- ──────────────────────────────────────────────────────────────────────────────
-- (3) الـ trigger
-- ──────────────────────────────────────────────────────────────────────────────
create or replace function app_attendance_guard()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_caller uuid;
  v_status text;
  v_late int;
  v_shift_end timestamptz;
  v_is_checkin boolean;
  v_is_checkout boolean;
  v_date date;
begin
  -- service_role (أداة auto-checkout، الاستيراد بمفتاح الخدمة) → بلا تغيير
  if auth.uid() is null then return new; end if;

  select id into v_caller from employees where auth_user_id = auth.uid() limit 1;

  -- "تسجيل دخول/خروج ذاتي حقيقي" = الموظف يكتب صفه هو + الصف يحمل إحداثيات GPS
  -- (زر البصمة في صفحة الحضور دائمًا يرسل الإحداثيات). أي كتابة بلا إحداثيات = تعديل مدير
  -- يدوي / إضافة سجل / تصحيح حضور / استيراد → تمرّ بلا تغيير. يشمل هذا كل الأدوار (مدير النظام أيضًا).
  v_is_checkin := (v_caller is not null and new.employee_id = v_caller
                   and new.check_in_lat is not null and new.check_in_time is not null
                   and (tg_op = 'INSERT' or old.check_in_time is null));

  v_is_checkout := (v_caller is not null and new.employee_id = v_caller
                    and new.check_out_lat is not null and new.check_out_time is not null
                    and (tg_op = 'INSERT' or old.check_out_time is null));

  -- ── تسجيل دخول: وقت السيرفر يغلب وقت الجهاز ──
  if v_is_checkin then
    new.client_check_in_time := new.check_in_time;
    new.check_in_time := now();
    new.date := app_attendance_date(new.employee_id, now());
    select cl.status, cl.late_minutes into v_status, v_late
      from app_compute_late(new.employee_id, new.date, now()) cl;
    new.status := v_status;
    new.late_minutes := v_late;
  end if;

  -- ── تسجيل خروج: وقت السيرفر (مع معالجة نسيان الخروج > 16 ساعة) ──
  if v_is_checkout then
    v_date := coalesce(new.date, app_my_date(now()));
    new.client_check_out_time := new.check_out_time;
    if new.check_in_time is not null and now() - new.check_in_time > interval '16 hours' then
      select w.end_ts into v_shift_end
        from app_resolve_shift_window(new.employee_id, v_date, new.check_in_time) w;
      new.check_out_time := least(
        coalesce(v_shift_end + interval '1 hour', new.check_in_time + interval '10 hours'),
        now());
    else
      new.check_out_time := now();
    end if;
    new.early_minutes := app_compute_early(new.employee_id, v_date, new.check_out_time, new.check_in_time);
  end if;

  -- ── منع الموظف من تعديل وقت مثبَّت لصفه هو لاحقًا (مثلاً من الـConsole) ──
  -- تعديلات المدير المشروعة تُعلَّم is_manual=true من الواجهة فتمرّ.
  if tg_op = 'UPDATE' and v_caller is not null and new.employee_id = v_caller
     and coalesce(new.is_manual, false) = false then
    if old.check_in_time is not null and new.check_in_time is distinct from old.check_in_time then
      new.check_in_time := old.check_in_time;
    end if;
    if old.check_out_time is not null and new.check_out_time is distinct from old.check_out_time then
      new.check_out_time := old.check_out_time;
    end if;
  end if;

  return new;
end $$;

drop trigger if exists za_attendance_guard on attendance;
create trigger za_attendance_guard
before insert or update on attendance
for each row execute function app_attendance_guard();

-- ──────────────────────────────────────────────────────────────────────────────
-- (4) بوابة تحقق
-- ──────────────────────────────────────────────────────────────────────────────
do $$
declare n int;
begin
  if not exists (select 1 from pg_proc p join pg_namespace ns on ns.oid=p.pronamespace
                 where ns.nspname='public' and p.proname='app_is_basic_employee') then
    raise exception 'FAIL: app_is_basic_employee() غير موجودة — شغّل db/rls_stage_a.sql أولاً';
  end if;

  if (select count(*) from information_schema.columns
      where table_schema='public' and table_name='attendance'
        and column_name in ('client_check_in_time','client_check_out_time')) <> 2 then
    raise exception 'FAIL: client_check_* columns missing';
  end if;

  select count(*) into n from pg_proc p join pg_namespace ns on ns.oid=p.pronamespace
  where ns.nspname='public' and p.prosecdef and p.proname in (
    'app_my_date','app_attendance_date','app_resolve_shift_window',
    'app_compute_late','app_compute_early','app_attendance_guard');
  if n <> 6 then raise exception 'FAIL: expected 6 SECURITY DEFINER functions, found %', n; end if;

  if not exists (
    select 1 from pg_trigger tg join pg_class c on c.oid=tg.tgrelid
    where tg.tgname='za_attendance_guard' and c.relname='attendance') then
    raise exception 'FAIL: trigger za_attendance_guard missing';
  end if;

  -- تنفيذ تجريبي (لا يجب أن يرمي خطأ)
  perform app_my_date(now());
  perform * from app_compute_late(gen_random_uuid(), current_date, now());
  perform app_compute_early(gen_random_uuid(), current_date, now(), now());

  raise notice '════════════════════════════════════';
  raise notice 'ALL CHECKS PASSED — COMMIT below saves';
  raise notice '════════════════════════════════════';
end $$;

commit;


-- ══════════════════════════════════════════════════════════════════════════════
--  اختبار ما بعد الحفظ (بحساب موظف عادي على جهاز)
-- ══════════════════════════════════════════════════════════════════════════════
--  1) دخول عادي وقت الشيفت → check_in_time = وقت السيرفر، client_check_in_time = وقت الجهاز.
--  2) رجّع ساعة الجهاز 30 دقيقة للخلف ثم دخول → check_in_time لا يزال وقت السيرفر؛
--     الفرق ظاهر في client_check_in_time؛ إن كان الشيفت بدأ → status='late'.
--  3) خروج عادي → check_out_time = وقت السيرفر؛ early_minutes صحيح.
--  4) شيفت ليلي (دخول 11م، خروج 5ص) → date = يوم البداية.
--
--  عدم الانكسار:
--  - المدير: تعديل وقت دخول/خروج يدوي من صفحة الحضور → يُحفَظ كما أُدخِل.
--  - auto-checkout (GET /api/auto-checkout?dryRun=false) → يكتب وقت الخروج المحسوب بلا تعديل.
--  - صفحة الطلبات: اعتماد "تصحيح حضور" بواسطة مدير قسم → late_hours في الرواتب تتحدّث.
--
--  استعلام كشف انحراف الساعة (لاحقاً، دورياً):
--  select e.name, e.employee_number, a.date,
--         a.check_in_time, a.client_check_in_time,
--         round(extract(epoch from (a.check_in_time - a.client_check_in_time))/60) as minutes_off
--  from attendance a join employees e on e.id = a.employee_id
--  where a.client_check_in_time is not null
--    and abs(extract(epoch from (a.check_in_time - a.client_check_in_time))) > 180
--  order by a.check_in_time desc;


-- ══════════════════════════════════════════════════════════════════════════════
--  التراجع
-- ══════════════════════════════════════════════════════════════════════════════
-- begin;
-- drop trigger if exists za_attendance_guard on attendance;
-- drop function if exists app_attendance_guard();
-- drop function if exists app_compute_early(uuid, date, timestamptz, timestamptz);
-- drop function if exists app_compute_late(uuid, date, timestamptz);
-- drop function if exists app_resolve_shift_window(uuid, date, timestamptz);
-- drop function if exists app_attendance_date(uuid, timestamptz);
-- drop function if exists app_my_date(timestamptz);
-- -- العمودان client_check_*_time يبقيان (بيانات مفيدة)
-- commit;
