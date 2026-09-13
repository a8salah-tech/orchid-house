-- ══════════════════════════════════════════════════════════════════════════════
--  ترجمة الأصناف للروسية - دفعة ١: وقت الغداء + الشوربة + المقبلات الساخنة + إضافات
--  يعتمد على db/menu_i18n_ru.sql. آمن لإعادة التشغيل.
-- ══════════════════════════════════════════════════════════════════════════════

-- وقت الغداء
update menu_items set name_ru = '(Обед) Куриный шиш-тавук с рисом', description_ru = 'Куриный шиш-тавук с рисом' where id = 'e840a1a2-a34d-4f28-82a8-973db6d1a085';
update menu_items set name_ru = '(Обед) Шаурма с рисом', description_ru = 'Шаурма с рисом + бесплатный холодный чай с лимоном' where id = 'a967eac6-11d4-4f46-9917-acd15e74687c';
update menu_items set name_ru = '(Обед) Куриный манди с рисом', description_ru = 'Куриный манди с рисом + бесплатный холодный чай с лимоном' where id = 'd17fc7bb-9ce9-40cf-85d3-e357559817d3';
update menu_items set name_ru = '(Обед) Куриный кебаб с рисом', description_ru = 'Куриный кебаб с рисом + бесплатный холодный чай с лимоном' where id = '28f639ab-accf-40f4-9841-aa6124f5bd17';
update menu_items set name_ru = '(Обед) Сет шаурмы', description_ru = 'Куриная шаурма сет + бесплатный холодный чай с лимоном' where id = '66fb785b-62ba-4604-8a39-53bd29ff5ff5';
update menu_items set name_ru = '(Обед) Бараний кебаб с рисом', description_ru = 'Бараний кебаб с рисом + бесплатный холодный чай с лимоном' where id = 'c1d20e8b-cc78-4017-878f-62c99052b1a2';

-- الشوربة
update menu_items set name_ru = 'Чечевичный суп', description_ru = 'Красная чечевица с луком, морковью и картофелем, с соком свежего лимона, приправлено нашими фирменными специями' where id = '3135a3d5-fdc6-4fc8-8b62-356a120a9c91';
update menu_items set name_ru = 'Грибной суп', description_ru = 'Грибы, лук и сливочное молоко, приправлено солью и перцем' where id = 'd3ea932b-02d8-408d-9ccc-781b8e26c2cf';
update menu_items set name_ru = 'Суп «Орхидея» с морепродуктами', description_ru = 'Морепродукты в прозрачном ароматном бульоне со специями, подаётся с дольками лимона' where id = '05272e63-d834-43d4-b14f-86fae6afaa4a';
update menu_items set name_ru = 'Куриный суп', description_ru = 'Курица и сливочное молоко, приправлено солью и перцем' where id = '69c78e70-c96b-4e5b-b760-c4a83d2f28c8';
update menu_items set name_ru = 'Овощной суп', description_ru = 'Лук, картофель, морковь, приправлено солью и сушёными специями' where id = '141bdb5d-e77c-4e08-b49c-6d905bacff10';

-- المقبلات الساخنة
update menu_items set name_ru = 'Баранья фатта', description_ru = 'Рубленая баранина, хрустящий хлеб, зёрна граната, петрушка, тахини, топлёное масло, орехи' where id = '1addac81-7a16-4e19-8b76-ec0c7a72fd7b';
update menu_items set name_ru = 'Куриная фатта', description_ru = 'Отварная курица, тахини, поджаренный хлеб, чеснок, зёрна граната, орехи и топлёное масло' where id = '7e417fda-16cb-4773-b8ba-8236639868e6';
update menu_items set name_ru = 'Фуль с тахини', description_ru = 'Бобы фуль, тахини, лимонный сок, чеснок, с петрушкой и помидорами, оливковое масло' where id = 'f4ee7e78-af47-4ce7-9768-36dc1a789440';
update menu_items set name_ru = 'Тарелка фалафеля', description_ru = 'Молотый нут, чеснок, лук, петрушка, подаётся с соусом тахини' where id = 'a0da3014-9533-45df-a74a-d4487baa1067';
update menu_items set name_ru = 'Фуль с оливковым маслом', description_ru = 'Бобы фуль, лимонный сок, чеснок, с петрушкой и помидорами, оливковое масло' where id = '0016a175-2300-465a-a0a7-7cfca76c17a5';
update menu_items set name_ru = 'Колбаски', description_ru = 'Колбаски, обжаренные на сливочном масле, с болгарским перцем и особыми специями' where id = '4e4be480-4761-4eb6-8bf3-ca0ba54cb7ac';
update menu_items set name_ru = 'Цветная капуста таратур', description_ru = 'Жареная цветная капуста с соусом тахини и свежим болгарским перцем' where id = '01e044ea-f331-4eab-aec8-4123f5a8abe5';
update menu_items set name_ru = 'Фатта с шаурмой', description_ru = 'Полоски куриной шаурмы, хрустящий хлеб, зёрна граната, петрушка, тахини, топлёное масло, орехи' where id = '0413d703-f8c1-4441-a4da-399c69d36624';
update menu_items set name_ru = 'Спринг-роллы', description_ru = 'Хрустящие ломтики мягкого теста с сырной начинкой' where id = 'bc9fa27f-0592-40c5-9204-2e6a711421a6';
update menu_items set name_ru = 'Картофель фри' where id = '186c32d3-5bb4-4e73-b423-da652482fcaf';
update menu_items set name_ru = 'Ливанские колбаски', description_ru = 'Колбаски, обжаренные на сливочном масле, с лимоном и чесноком' where id = 'aeee633c-8994-4379-a510-99f674bc398a';
update menu_items set name_ru = 'Муфарака с грибами', description_ru = 'Рубленая баранина, грибы, кинза, лук и лимонный сок' where id = '4d2c60aa-e782-4f31-bd76-c25802e70f25';
update menu_items set name_ru = 'Фатта «Орхидея»', description_ru = 'Баклажаны, тахини, топлёное масло, орехи, зёрна граната, томатный соус, петрушка' where id = 'e984c7db-26a3-45e3-b5db-8ce2008b90b9';
update menu_items set name_ru = 'Острый картофель (Харра)', description_ru = 'Хрустящий картофель с острым перцем, чесноком и лимоном' where id = 'd16713c3-1747-419b-8d66-fbb92528dac4';
update menu_items set name_ru = 'Макмур с баклажанами', description_ru = 'Печёные баклажаны, тушёные со свежими помидорами, чесноком и нутом' where id = '4d3a5ef9-926d-4f4a-97c9-7d19e756e210';
update menu_items set name_ru = 'Фатта с хумусом', description_ru = 'Хумус, хрустящий хлеб, зёрна граната, петрушка, тахини, топлёное масло, орехи' where id = 'b17ee8a0-f4da-48a8-8fe4-ee61959353d2';
update menu_items set name_ru = 'Хумус с бараниной', description_ru = 'Хумус с рубленой бараниной, соусом тахини, лимонным соком и оливковым маслом' where id = '646a371a-1ed8-4b36-936e-91c27087713a';

-- إضافات
update menu_items set name_ru = 'Ледяная вода' where id = '1c261566-3858-4d0c-9b9f-3632953770ba';
update menu_items set name_ru = 'Холодный чай с лимоном (кувшин)' where id = 'fab461d2-3be5-40a8-a9db-f220d81037ad';
update menu_items set name_ru = 'Ледяная вода (кувшин)' where id = 'fcba83c6-b1da-4f6e-9fda-35027b394253';
update menu_items set name_ru = 'Хлеб' where id = '0ab7c8ff-0fa4-4694-9bde-51e1ae801474';
update menu_items set name_ru = 'Холодный чай (кувшин)' where id = 'c33f33cf-a081-478c-9380-ec42bd9efd37';
update menu_items set name_ru = 'Горячая вода' where id = '0971f4c4-3f06-4a9d-8815-8095ffd13fe1';
update menu_items set name_ru = 'Тёплая вода' where id = 'c395e28b-ff26-4ee6-be56-8e3c6aee53b8';
update menu_items set name_ru = 'Только рис', description_ru = 'Рис без курицы и без баранины' where id = '03085b35-c175-4464-9bef-8433bd4bd54b';
update menu_items set name_ru = 'Вимто (кувшин)' where id = '570928db-55e0-4000-a1af-0f22fcefa134';

notify pgrst, 'reload schema';
