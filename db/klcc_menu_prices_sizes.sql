-- ══════════════════════════════════════════════════════════════════════════════
--  أسعار وأحجام فرع Orchid KLCC لتطابق المنيو الجديد (ملف "Orchid - Menu KLCC New.pdf")
-- ══════════════════════════════════════════════════════════════════════════════
--  لفرع KLCC فقط (لا يمس Orchid House). الأصناف محددة بالمعرّف (id) وليس بالرقم، فيعمل قبل أو بعد db/klcc_menu_numbers.sql.
--  1) أسعار الأصناف:  كباب بيتي 32→35.5 · كنافة بالجبنة 24.99→25 · موكا ساخن 14→9 · حليب طازج 10→8 · مانجو شيك 18→20
--  2) الأحجام داخل الصنف كما في المنيو:
--     • الشاي الأخضر: الإبريق 17→16 (الكاسة 6 كما هي)
--     • ريش لحم ضأن: سعر الحجم الوحيد 35→39.5 (ليتطابق مع سعر المنيو، لأن سعر الحجم هو الذي يظهر للعميل)
--     • مانجو / فراولة / أفوكادو / موز: إضافة الحجمين  شيك (Shake) 20  ولسي (Lassi) 20
--  الأحجام الأخرى (مندي، بخاري، كبسة، مقلوبة، برياني، زوربيان، منسف، شاي أحمر، ليمون زنجبيل عسل، شاي بالحليب) مطابقة للمنيو أصلًا.
--  التشغيل: انسخ الملف كله في Supabase SQL Editor → Run. آمن لإعادة التشغيل.
-- ══════════════════════════════════════════════════════════════════════════════

begin;

-- 1) الأسعار
update menu_items set price = 35.5 where id = '6e7ba62f-dd85-47a8-b026-502a036b0ccf' and branch_id = '9375998c-0a98-48c8-be7a-485e0c616ae1';  -- Bayti Kebab
update menu_items set price = 25   where id = 'c44cafa2-8dfb-48a9-82d6-f3f4013c67c2' and branch_id = '9375998c-0a98-48c8-be7a-485e0c616ae1';  -- Kunafa Cheese
update menu_items set price = 9    where id = '89fbab7b-809a-43f6-82b0-7eebfadb701f' and branch_id = '9375998c-0a98-48c8-be7a-485e0c616ae1';  -- Mocha
update menu_items set price = 8    where id = '45e82f61-e4d5-438b-9871-1d3207f38abb' and branch_id = '9375998c-0a98-48c8-be7a-485e0c616ae1';  -- Fresh Milk
update menu_items set price = 20   where id = '2e1d5dd3-a74c-4b90-bd18-1f77168755b8' and branch_id = '9375998c-0a98-48c8-be7a-485e0c616ae1';  -- Mango Shake

-- 2) أحجام موجودة تحتاج تعديل سعر
update menu_item_sizes set price = 16   where id = '019800c6-67b9-4d23-8b1e-10fb29917bc0';  -- Green Tea · Pot
update menu_item_sizes set price = 39.5 where id = '5706bb07-4fbe-4138-903e-ef628de07b38';  -- Lamb Chops · Chops

-- 3) حجما الشيك/اللسي للأصناف الأربعة (إن لم يكونا موجودين)
insert into menu_item_sizes (menu_item_id, name, name_en, name_ms, name_zh, name_ru, price, is_active, sort_order)
select v.item_id, s.name, s.name_en, s.name_ms, s.name_zh, s.name_ru, 20, true, s.sort_order
  from (values
    ('2e1d5dd3-a74c-4b90-bd18-1f77168755b8'::uuid),  -- Mango
    ('200002eb-c541-4b23-adb5-a528e46862c6'::uuid),  -- Strawberry
    ('8acc3680-9f08-4d68-8287-5cf3b62b34c3'::uuid),  -- Avocado
    ('28959cfc-3344-4c36-9b8d-1ca367a0ba8d'::uuid)   -- Banana
  ) as v(item_id)
 cross join (values
    ('شيك', 'Shake', 'Shake', '奶昔',  'Шейк',  0),
    ('لسي', 'Lassi', 'Lassi', '拉西',  'Ласси', 1)
  ) as s(name, name_en, name_ms, name_zh, name_ru, sort_order)
 where not exists (
   select 1 from menu_item_sizes z where z.menu_item_id = v.item_id and z.name_en = s.name_en
 );

commit;

notify pgrst, 'reload schema';
