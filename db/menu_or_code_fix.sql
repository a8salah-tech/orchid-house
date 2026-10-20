-- ══════════════════════════════════════════════════════════════════════════════
--  إصلاح توليد كود الصنف التلقائي (menu_items.or_code)
-- ══════════════════════════════════════════════════════════════════════════════
--  السبب: الدالة generate_or_code() كانت تكتب 'OR-' || lpad(nextval(seq)::text, 3, '0'). و lpad تقصّ الرقم من اليمين إذا
--  زاد طوله عن 3 خانات، والتسلسل وصل 2287 → 'OR-228'؛ فكل الأرقام 2280..2289 تعطي نفس الكود (تكرار على ~10 أصناف).
--  والتسلسل مشترك مع الأصناف الخفية التي ينشئها الكاشير («صنف مفتوح»، 1800+ صنف) فيستهلك أرقامها.
--
--  الإصلاح:
--    • صنف فعلي (نشط أو له قسم) بكود فارغ ← 'OR-' || (أعلى رقم موجود بين الأصناف الفعلية في كل الفروع + 1) بلا قصّ مهما كبر الرقم.
--      قفل استشاري يمنع أن يأخذ صنفان أُضيفا في اللحظة نفسها الرقم ذاته.
--    • صنف الكاشير الخفي (غير نشط وبلا قسم) ← بلا كود (NULL)، فلا يستهلك أرقام المنيو.
--    • كود يكتبه المستخدم بنفسه يبقى كما هو (فحص التكرار في الواجهة كما هو).
--  لا يغيّر أي بيانات قائمة (الأكواد المكررة القديمة على الأصناف الخفية تبقى كما هي).
--  التشغيل: انسخ الملف كله في Supabase SQL Editor → Run. آمن لإعادة التشغيل.
--  التراجع: أعد تعريف الدالة بنصّها القديم:
--    create or replace function public.generate_or_code() returns trigger language plpgsql as $$ begin
--      if NEW.or_code is null or NEW.or_code = '' then NEW.or_code := 'OR-' || lpad(nextval('menu_items_or_code_seq')::text, 3, '0'); end if;
--      return NEW; end; $$;
-- ══════════════════════════════════════════════════════════════════════════════

create or replace function public.generate_or_code()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_next bigint;
begin
  if NEW.or_code is null or btrim(NEW.or_code) = '' then
    -- صنف الكاشير المفتوح (مخفي وبلا قسم): بلا كود حتى لا يستهلك أرقام المنيو
    if coalesce(NEW.is_active, true) = false and NEW.category_id is null then
      NEW.or_code := null;
      return NEW;
    end if;

    perform pg_advisory_xact_lock(hashtext('menu_items_or_code'));

    select coalesce(max((substring(m.or_code from '(\d{1,9})'))::bigint), 0) + 1
      into v_next
      from public.menu_items m
     where substring(m.or_code from '(\d{1,9})') is not null
       and (m.is_active = true or m.category_id is not null);

    NEW.or_code := 'OR-' || lpad(v_next::text, greatest(3, length(v_next::text)), '0');
  end if;
  return NEW;
end;
$$;

-- تحقق: المُشغِّل ما زال مربوطاً بالدالة
do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trigger_or_code' and tgrelid = 'public.menu_items'::regclass) then
    raise exception 'FAIL: trigger_or_code غير موجود على menu_items';
  end if;
end $$;
