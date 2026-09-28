-- ══════════════════════════════════════════════════════════════════════════════
--  إصلاح: خصم الخروج المبكر بيتضاعف مع خصم إذن الخروج المبكر
-- ══════════════════════════════════════════════════════════════════════════════
--  السبب الجذري (تأكدت منه من بيانات حقيقية): تريغر توقيت السيرفر
--  (db/attendance_server_time.sql) عنده نسخة مبسّطة من حساب "الخروج المبكر"
--  (app_compute_early) بلا أي وعي بإذن الخروج المعتمد. عند تسجيل الخروج الذاتي
--  (الموظف نفسه، من موبايله، بإحداثيات GPS)، التريغر يعيد كتابة early_minutes
--  بالقيمة الكاملة كأنه مفيش إذن أصلاً — بينما permit_minutes اللي حسبته الواجهة
--  (وهي عارفة بالإذن) بيتسجّل صح جنبه. النتيجة: خصم الساعة الكاملة (20 رنجت/ساعة)
--  + خصم الإذن بسعر الساعة الحقيقي، على نفس الوقت تقريبًا.
--
--  الإصلاح: نفس منطق computeEarlyInfo (src/lib/attendanceCalc.ts) بالضبط، جوه
--  قاعدة البيانات — كما طلب المستخدم: ساعات الإذن نفسها تُخصم بسعر الساعة الحقيقي
--  كما هي، وأي وقت قبل موعد الإذن (لو خرج قبله فعلاً) يُخصم بالسعر الثابت 20
--  رنجت/ساعة فقط — الاثنان لا يتداخلان أبدًا.
--
--  يتطلب تشغيل db/attendance_server_time.sql و db/early_exit_permit.sql قبله.
--  التشغيل: انسخ الملف كله في Supabase SQL Editor → Run. آمن لإعادة التشغيل.
-- ══════════════════════════════════════════════════════════════════════════════

begin;

do $$
begin
  if not exists (select 1 from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
                 where ns.nspname = 'public' and p.proname = 'app_attendance_guard') then
    raise exception 'FAIL: شغّل db/attendance_server_time.sql أولاً';
  end if;
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'employee_requests' and column_name = 'permit_time') then
    raise exception 'FAIL: شغّل db/early_exit_permit.sql أولاً';
  end if;
end $$;

-- إذن خروج مبكر معتمد يقع داخل نافذة الشيفت — يرجّع لحظة ساعة الإذن (أو NULL لو مفيش)
-- ترجمة لدالة findExitPermitMs في src/lib/attendanceCalc.ts
create or replace function app_find_exit_permit_ms(p_emp uuid, p_date date, p_win_start timestamptz, p_win_end timestamptz)
returns timestamptz language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  r record;
  v_ms timestamptz;
begin
  for r in
    select start_date, permit_time from employee_requests
    where employee_id = p_emp and request_type = 'early_exit_permit'
      and status in ('approved', 'completed')
      and start_date between p_date - 1 and p_date + 1
      and permit_time is not null
  loop
    v_ms := (r.start_date::timestamp + r.permit_time::time) at time zone 'Asia/Kuala_Lumpur';
    if v_ms > p_win_start and v_ms < p_win_end then return v_ms; end if;
    v_ms := ((r.start_date + 1)::timestamp + r.permit_time::time) at time zone 'Asia/Kuala_Lumpur';
    if v_ms > p_win_start and v_ms < p_win_end then return v_ms; end if;
  end loop;
  return null;
end $$;

grant execute on function app_find_exit_permit_ms(uuid, date, timestamptz, timestamptz) to authenticated;

-- دقائق الخروج المبكر + دقائق إذن الخروج مع بعض (بدل early_minutes لوحدها) —
-- نفس منطق computeEarlyInfo بالضبط، فلا يتداخل الاتنين أبدًا لنفس الدقائق
drop function if exists app_compute_early(uuid, date, timestamptz, timestamptz);
create function app_compute_early(p_emp uuid, p_date date, p_checkout timestamptz, p_checkin timestamptz)
returns table(early_minutes int, permit_minutes int)
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  w record;
  v_diff int;
  v_permit_ms timestamptz;
  v_permit_mins int;
  v_before int;
begin
  select * into w from app_resolve_shift_window(p_emp, p_date, coalesce(p_checkin, p_checkout));
  if not found then early_minutes := 0; permit_minutes := 0; return next; return; end if;

  v_diff := floor(extract(epoch from (w.end_ts - p_checkout)) / 60)::int;
  if v_diff >= w.duration_mins then early_minutes := 0; permit_minutes := 0; return next; return; end if;

  v_permit_ms := app_find_exit_permit_ms(p_emp, p_date, w.start_ts, w.end_ts);
  if v_permit_ms is null then
    early_minutes := (case when v_diff > 10 then v_diff else 0 end);
    permit_minutes := 0;
    return next; return;
  end if;

  if v_diff <= 10 then early_minutes := 0; permit_minutes := 0; return next; return; end if;

  v_permit_mins := floor(extract(epoch from (w.end_ts - v_permit_ms)) / 60)::int;
  if p_checkout >= v_permit_ms then
    early_minutes := 0;
    permit_minutes := least(v_permit_mins, v_diff);
  else
    v_before := floor(extract(epoch from (v_permit_ms - p_checkout)) / 60)::int;
    early_minutes := (case when v_before > 10 then v_before else 0 end);
    permit_minutes := v_permit_mins;
  end if;
  return next;
end $$;

grant execute on function app_compute_early(uuid, date, timestamptz, timestamptz) to authenticated;

-- التريغر: يقرأ early_minutes و permit_minutes مع بعض دلوقتي (كان بيحسب early_minutes لوحدها
-- ويتجاهل الإذن تمامًا، فيمسح تصحيح الواجهة الصحيح ويرجّع خصم الساعة الكاملة زيادة على خصم الإذن)
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
  v_early int;
  v_permit int;
begin
  if auth.uid() is null then return new; end if;

  select id into v_caller from employees where auth_user_id = auth.uid() limit 1;

  v_is_checkin := (v_caller is not null and new.employee_id = v_caller
                   and new.check_in_lat is not null and new.check_in_time is not null
                   and (tg_op = 'INSERT' or old.check_in_time is null));

  v_is_checkout := (v_caller is not null and new.employee_id = v_caller
                    and new.check_out_lat is not null and new.check_out_time is not null
                    and (tg_op = 'INSERT' or old.check_out_time is null));

  if v_is_checkin then
    new.client_check_in_time := new.check_in_time;
    new.check_in_time := now();
    new.date := app_attendance_date(new.employee_id, now());
    select cl.status, cl.late_minutes into v_status, v_late
      from app_compute_late(new.employee_id, new.date, now()) cl;
    new.status := v_status;
    new.late_minutes := v_late;
  end if;

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
    select ce.early_minutes, ce.permit_minutes into v_early, v_permit
      from app_compute_early(new.employee_id, v_date, new.check_out_time, new.check_in_time) ce;
    new.early_minutes := v_early;
    new.permit_minutes := v_permit;
  end if;

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

-- ── بوابة تحقق ──
do $$
begin
  perform * from app_compute_early(gen_random_uuid(), current_date, now(), now());
  perform app_find_exit_permit_ms(gen_random_uuid(), current_date, now(), now());
  raise notice '════════════════════════════════════';
  raise notice 'ALL CHECKS PASSED — COMMIT below saves';
  raise notice '════════════════════════════════════';
end $$;

commit;

notify pgrst, 'reload schema';

-- ══════════════════════════════════════════════════════════════════════════════
--  إصلاح البيانات القديمة المتأثرة (اختياري لكن مُستحسَن): يعيد حساب دقائق الخروج
--  المبكر/الإذن لكل شهر تشغّل عليه "إعادة حساب دقائق التأخير بأثر رجعي" في صفحة
--  الحضور، بنفس المنطق المصحَّح أعلاه. شغّله بعد هذا الملف من صفحة الحضور، مش SQL.
-- ══════════════════════════════════════════════════════════════════════════════
