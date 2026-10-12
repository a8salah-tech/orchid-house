-- ══════════════════════════════════════════════════════════════════════════════
--  تصحيح أوصاف أصناف خاطئة في الفرعين (أوركيد هاوس + KLCC)
-- ══════════════════════════════════════════════════════════════════════════════
--  • الأصناف محددة بالمعرّف (id) ولا يُغيَّر أي رقم صنف (or_code) ولا اسم ولا سعر — الأوصاف فقط.
--  • لكل صنف سطر لنسخة أوركيد هاوس ونسخة KLCC (نفس النص).
--  التشغيل: انسخ الملف كله في Supabase SQL Editor → Run. آمن لإعادة التشغيل.
-- ══════════════════════════════════════════════════════════════════════════════

begin;

-- شاي أحمر (Red Tea): الوصف كان وصف شوربة مأكولات بحرية
update menu_items set
  description = 'شاي أحمر طازج يُقدَّم ساخنًا',
  description_en = 'Freshly brewed black tea, served hot',
  description_ms = 'Teh merah segar, dihidang panas',
  description_zh = '现泡红茶，热饮',
  description_ru = 'Свежезаваренный чёрный чай, подаётся горячим'
 where id in ('0487b62f-1313-4af3-b02d-2fe75dfa2c39', 'c69646ca-28dd-462a-bd69-8cfd13b7ac37');

-- بيتزا بيبروني (Pepperoni Pizza): الوصف كان وصف سلطة الفتوش
update menu_items set
  description = 'عجينة بيتزا مغطاة بشرائح البيبروني والفلفل والزيتون وجبن الموتزاريلا',
  description_en = 'Pizza dough topped with pepperoni slices, peppers, olives and mozzarella cheese',
  description_ms = 'Doh piza dengan hirisan pepperoni, lada benggala, zaitun dan keju mozzarella',
  description_zh = '披萨饼底配意大利辣香肠片、甜椒、橄榄和马苏里拉芝士',
  description_ru = 'Тесто для пиццы с ломтиками пепперони, перцем, оливками и сыром моцарелла'
 where id in ('3c02fa92-e31d-4465-a8a0-7ad28165f578', '1af84b73-4096-4109-a3c7-8d66bb4741e3');

-- مقلوبة لحم (Lamb Makloubah): الوصف الإنجليزي كان يقول دجاج، والعربي فارغ (الملايو والصيني والروسي سليمة فلا تُلمس)
update menu_items set
  description = 'أرز مطبوخ منزليًا بالبهارات الخاصة مع الباذنجان والبطاطس ولحم الضأن',
  description_en = 'Home-cooked rice with special spices, eggplant, potato and lamb'
 where id in ('44c50f38-1e6f-472d-a465-431da9c8fd7b', '21414741-f3d6-40d5-bda4-7af69d55baf4');

-- ملوخية دجاج: الإنجليزي "cooked with Leaves" والعربي بلا ذكر الدجاج
update menu_items set
  description = 'أوراق الملوخية مطبوخة مع الدجاج، تُقدّم مع أرز أبيض',
  description_en = 'Molokhia leaves cooked with chicken, served with white rice'
 where id in ('a82767c9-501e-4220-b4a9-b0f8dc14d5e4', 'd122eac7-96f5-40cd-8dc4-d75831cc3c8c');

-- ملوخية لحم: نفس الخطأ
update menu_items set
  description = 'أوراق الملوخية مطبوخة مع لحم الضأن، تُقدّم مع أرز أبيض',
  description_en = 'Molokhia leaves cooked with lamb, served with white rice'
 where id in ('6873aed4-13fe-4c6d-bbd4-db1d502814a8', '8411f06d-0b3f-400c-8e2b-cba40e353801');

-- سر الحب (Love Secret): "ango" بدل "Mango"
update menu_items set
  description_en = 'Mango, Kiwi, Milk, Ice Cream'
 where id in ('6fdcc492-b18d-4950-9f1c-5bbd38c8b0a6', 'b68f6cea-da35-41f7-a789-6bb7bcdcf072');

-- شاي أخضر وشاي بالحليب: إزالة الأسعار من الوصف (السعر يؤخذ من الأحجام)
update menu_items set
  description_en = null,
  description_ms = null,
  description_zh = null,
  description_ru = null
 where id in ('c4a4887c-e4f1-47ad-8686-84f06af2221e', 'a4753ade-2e71-4c42-8018-d8533005c44a', '24402b18-b722-4504-a7f7-663fed37d6eb', '37025d2d-b3f2-4a8b-9f0f-b33079aebdf8');

-- طاجين الدجاج: تكرار كلمات في الوصف الإنجليزي
update menu_items set
  description_en = 'Cooked chicken, potato, carrots, onion, garlic, colored peppers, olive oil and zucchini'
 where id in ('03d7c5cf-5e2f-416d-ae38-060bfe9f8d0d', '713d666e-1cef-4d0b-80ef-18d61d968c4c');

-- فتوش: "pappr" → "pepper" (استبدال الكلمة فقط ويبقى باقي النص كما هو)
update menu_items set
  description_en = replace(description_en, 'colored pappr', 'colored pepper')
 where id in ('2bfe7744-2f13-41ed-bf61-d0d13a01ffdf', 'ff38a62d-847c-42d2-9f6d-9a8621e01d7e')
   and description_en like '%colored pappr%';

commit;

notify pgrst, 'reload schema';
