-- ══════════════════════════════════════════════════════════════════════════════
--  طلب زيادة الراتب: (1) منع الطلبات المكررة  (2) منع «تأكيد الاكتمال» قبل تسجيل الزيادة
-- ══════════════════════════════════════════════════════════════════════════════
--  المشكلة 1: القفل (6 أشهر) لا يبدأ إلا بعد تسجيل زيادة فعلية، ودالة التقديم لا تفحص الطلبات المفتوحة،
--             فكان الموظف المستحق يستطيع تقديم أكثر من طلب (وطلبه معلّق، أو معتمَد ولم تُسجَّل زيادته).
--  المشكلة 2: «تأكيد الاكتمال» لا يتحقق من تسجيل الزيادة من ملف الموظف، فيظهر الطلب مكتملًا والراتب لم يتغير.
--
--  «الزيادة مسجَّلة للطلب» = يوجد سطر في salary_increases لنفس الموظف أُنشئ بعد تقديم الطلب،
--  أو تاريخ سريانه من أول شهر تقديم الطلب فصاعدًا.
--  «طلب مفتوح» = pending، أو approved ولم تُسجَّل زيادته بعد.
--  لا يُعدِّل أي طلب قائم. SQL Editor / service_role لا يتأثران بفحص الاكتمال.
--  التشغيل: انسخ الملف كله في Supabase SQL Editor → Run. معاملة واحدة وآمن لإعادة التشغيل.
--  التراجع:  drop trigger if exists zc_raise_one_open on public.employee_requests;
--            drop trigger if exists zd_raise_complete_guard on public.employee_requests;
-- ══════════════════════════════════════════════════════════════════════════════

begin;

-- هل سُجّلت زيادة لهذا الموظف تخص طلبًا قُدِّم في p_since؟ (للاستعمال الداخلي فقط)
create or replace function app_raise_recorded(p_emp uuid, p_since timestamptz)
returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from salary_increases si
    where si.employee_id = p_emp
      and (si.created_at >= p_since
           or si.effective_date::date >= date_trunc('month', p_since at time zone 'Asia/Kuala_Lumpur')::date)
  );
$$;
revoke all on function app_raise_recorded(uuid, timestamptz) from public, anon, authenticated;

-- الطلب المفتوح للموظف الحالي (نفسه فقط) — تعرضه الواجهة بدل نموذج التقديم
create or replace function app_salary_raise_open_request()
returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object('request_number', r.request_number, 'status', r.status, 'created_at', r.created_at)
  from employee_requests r
  where r.employee_id = app_current_employee_id()
    and r.request_type = 'salary_increase'
    and (r.status = 'pending' or (r.status = 'approved' and not app_raise_recorded(r.employee_id, r.created_at)))
  order by r.created_at desc
  limit 1;
$$;
revoke all on function app_salary_raise_open_request() from public, anon;
grant execute on function app_salary_raise_open_request() to authenticated;

-- (1) طلب مفتوح واحد فقط لكل موظف
create or replace function app_raise_one_open()
returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.request_type <> 'salary_increase' then return new; end if;
  -- قفل على مستوى الموظف حتى لا يمرّ تقديمان متزامنان
  perform pg_advisory_xact_lock(hashtext('salary_raise:' || new.employee_id::text));
  if exists (
    select 1 from employee_requests r
    where r.employee_id = new.employee_id
      and r.request_type = 'salary_increase'
      and (r.status = 'pending' or (r.status = 'approved' and not app_raise_recorded(r.employee_id, r.created_at)))
  ) then
    raise exception 'OPEN_REQUEST';
  end if;
  return new;
end $$;

drop trigger if exists zc_raise_one_open on public.employee_requests;
create trigger zc_raise_one_open before insert on public.employee_requests
  for each row execute function app_raise_one_open();

-- (2) لا «مكتمل» لطلب زيادة قبل تسجيل الزيادة
create or replace function app_raise_complete_guard()
returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is not null
     and new.request_type = 'salary_increase'
     and new.status = 'completed' and old.status is distinct from 'completed'
     and not app_raise_recorded(new.employee_id, new.created_at) then
    raise exception 'RAISE_NOT_RECORDED';
  end if;
  return new;
end $$;

drop trigger if exists zd_raise_complete_guard on public.employee_requests;
create trigger zd_raise_complete_guard before update on public.employee_requests
  for each row execute function app_raise_complete_guard();

-- ── بوابة التحقق ──
do $$
declare bad text := '';
begin
  if not exists (select 1 from pg_trigger where tgname = 'zc_raise_one_open' and tgrelid = 'public.employee_requests'::regclass) then bad := bad || 'منع التكرار؛ '; end if;
  if not exists (select 1 from pg_trigger where tgname = 'zd_raise_complete_guard' and tgrelid = 'public.employee_requests'::regclass) then bad := bad || 'حارس الاكتمال؛ '; end if;
  if not exists (select 1 from pg_proc where proname = 'app_salary_raise_open_request') then bad := bad || 'دالة الطلب المفتوح؛ '; end if;
  if bad <> '' then raise exception 'FAIL: %', bad; end if;
  -- تأكد أن أعمدة الشرط موجودة بأنواع صالحة
  perform app_raise_recorded('00000000-0000-0000-0000-000000000000'::uuid, now());
end $$;

commit;

notify pgrst, 'reload schema';

-- ── للمراجعة فقط (لا يغيّر شيئًا): الموظفون الذين لديهم أكثر من طلب زيادة مفتوح الآن ──
select e.employee_number, e.name, count(*) as open_requests, string_agg('#' || r.request_number || ' (' || r.status || ')', '، ' order by r.created_at) as requests
from employee_requests r join employees e on e.id = r.employee_id
where r.request_type = 'salary_increase'
  and (r.status = 'pending' or (r.status = 'approved' and not app_raise_recorded(r.employee_id, r.created_at)))
group by e.employee_number, e.name
having count(*) > 1;
