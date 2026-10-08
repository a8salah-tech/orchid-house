-- ══════════════════════════════════════════════════════════════════════════════
--  رقم الحجز القصير: 3 حروف ثم 3 أرقام (مثل KDR482) بدل آخر 8 خانات من المعرّف (6EAE1975)
-- ══════════════════════════════════════════════════════════════════════════════
--  • عمود bookings.booking_ref فريد، يتولّد تلقائيًا عند إنشاء أي حجز (trigger) بحروف بدون I و O
--    (لتفادي الالتباس مع 1 و 0) وأرقام 0-9، مع إعادة المحاولة لو الرقم مكرر.
--  • يملأ الحجوزات الحالية كلها بأرقام جديدة (تُستبدل الأرقام القديمة المعروضة سابقًا).
--  • الواجهة تعرضه في شاشة تأكيد العميل، وفي الجدول وتفاصيل الحجز، وعلى بطاقة الحجز المطبوعة، وتبحث به.
--  التشغيل: انسخ الملف كله في Supabase SQL Editor → Run. آمن لإعادة التشغيل (لا يغيّر رقمًا موجودًا).
-- ══════════════════════════════════════════════════════════════════════════════

alter table bookings add column if not exists booking_ref text;

create or replace function app_gen_booking_ref()
returns text language plpgsql volatile as $$
declare
  letters constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ';  -- بدون I و O
  v_ref text;
  v_tries int := 0;
begin
  loop
    v_ref := substr(letters, 1 + floor(random() * 24)::int, 1)
          || substr(letters, 1 + floor(random() * 24)::int, 1)
          || substr(letters, 1 + floor(random() * 24)::int, 1)
          || lpad(floor(random() * 1000)::int::text, 3, '0');
    exit when not exists (select 1 from bookings where booking_ref = v_ref);
    v_tries := v_tries + 1;
    if v_tries > 200 then raise exception 'could not generate a unique booking ref'; end if;
  end loop;
  return v_ref;
end $$;

create or replace function trg_set_booking_ref()
returns trigger language plpgsql as $$
begin
  if new.booking_ref is null or new.booking_ref = '' then
    new.booking_ref := app_gen_booking_ref();
  end if;
  return new;
end $$;

drop trigger if exists bookings_set_ref on bookings;
create trigger bookings_set_ref before insert on bookings
  for each row execute function trg_set_booking_ref();

-- الحجوزات الحالية: رقم جديد لكل حجز (بالترتيب الزمني)
do $$
declare r record;
begin
  for r in select id from bookings where booking_ref is null or booking_ref = '' order by created_at loop
    update bookings set booking_ref = app_gen_booking_ref() where id = r.id;
  end loop;
end $$;

create unique index if not exists bookings_booking_ref_key on bookings (booking_ref);

notify pgrst, 'reload schema';
