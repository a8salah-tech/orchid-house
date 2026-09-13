-- ══════════════════════════════════════════════════════════════════════════════
--  ترجمة الأصناف للروسية - دفعة ٥: الوجبات العائلية + المأكولات البحرية + المشروبات الساخنة
--  + بيتزا + السلطة + الكاتو + المقبلات الباردة
--  يعتمد على db/menu_i18n_ru.sql. آمن لإعادة التشغيل.
-- ══════════════════════════════════════════════════════════════════════════════

-- الوجبات العائلية
update menu_items set name_ru = 'Семейный сет «Куриный манди»', description_ru = 'Куриный манди + рис на выбор + арабский салат + сахавик + кунафа + арабский чай' where id = '456ab99b-a900-4295-8853-911e403a8588';
update menu_items set name_ru = 'Целая баранья лопатка', description_ru = 'Целая баранья лопатка / рис на выбор / арабский салат / сахавик / кунафа / арабский чай' where id = '24cab84f-f86b-4c7d-94a7-ccdb552daf2e';
update menu_items set name_ru = 'Ассорти гриль (семейный)', description_ru = 'Ассорти гриль / рис на выбор / арабский салат / сахавик / кунафа / арабский чай' where id = 'e143c4db-e0a0-4144-9f86-1a809d54375b';
update menu_items set name_ru = 'Семейный сет манди с бараниной и курицей', description_ru = 'Манди с бараниной и курицей + рис на выбор + арабский салат + сахавик + кунафа + арабский чай' where id = '013d26ce-23bb-4c1e-b630-08d515a790cb';

-- المأكولات البحرية
update menu_items set name_ru = 'Морепродукты-ассорти 1 метр', description_ru = 'Жареные креветки, креветки на гриле, рыбные палочки, лобстер, рыба на гриле, жареная рыба, креветки, рис' where id = '65725ae6-d0b7-4be2-9e17-85d72570041f';
update menu_items set name_ru = 'Креветки на гриле', description_ru = 'Маринованные креветки на гриле, подаются с картофелем фри, петрушкой и луком' where id = 'd1275013-b207-42ee-b8d2-df848f7232b1';
update menu_items set name_ru = 'Жареные креветки', description_ru = 'Жареные креветки с картофелем фри и зелёными овощами' where id = 'cac16e69-e678-4f41-8306-519cb16cb2ab';
update menu_items set name_ru = 'Жареное рыбное филе', description_ru = 'Рыбное филе, маринованное в особых специях, обжаренное до золотистой хрустящей корочки, подаётся с картофелем фри' where id = 'c9e19e46-d307-49c9-8b5a-60c3d17922dc';
update menu_items set name_ru = 'Рыба на гриле', description_ru = 'Морской окунь, маринованный в особых специях, подаётся с картофелем фри' where id = '352a20ab-cb0d-4c77-9e57-48b518f8a756';
update menu_items set name_ru = 'Жареная рыба', description_ru = 'Морской окунь, маринованный в особых специях, обжаренный до золотистой хрустящей корочки' where id = 'b0bf6ad5-0828-413f-9b11-84325c057e40';
update menu_items set name_ru = 'Морепродукты-ассорти 1/2 метра', description_ru = 'Жареная рыба, жареные креветки, жареные крупные креветки, рис' where id = '2cc6c167-a90b-4320-9bba-30cd78c3d913';

-- المشروبات الساخنة
update menu_items set name_ru = 'Американо' where id = '37d97443-c1a9-402e-ac25-b1fc9c308486';
update menu_items set name_ru = 'Мокко' where id = '86d17b20-22d7-4825-babc-eab3a6d64e0a';
update menu_items set name_ru = 'Лимон, имбирь и мёд' where id = '43b979b5-2764-47b3-b460-07cec83c47f8';
update menu_items set name_ru = 'Чай с молоком', description_ru = 'Чайник RM18 / Чашка RM7' where id = '24402b18-b722-4504-a7f7-663fed37d6eb';
update menu_items set name_ru = 'Зхурат (травяной чай)' where id = '808f3cb8-5d0d-4738-a281-473e4ea76d23';
update menu_items set name_ru = 'Эспрессо одинарный' where id = '25bf4376-287e-4a24-bce4-97b0d7162343';
update menu_items set name_ru = 'Кафе латте' where id = '703fcbf4-5974-49da-98f1-f08fe4cc460f';
update menu_items set name_ru = 'Турецкий кофе' where id = '27e86d2e-79bb-43b0-a523-abc600de9071';
update menu_items set name_ru = 'Свежее молоко' where id = '93e746d6-7ad6-4ec8-9229-18630237012c';
update menu_items set name_ru = 'Эспрессо двойной' where id = '02c97204-1747-491f-8efd-c686336ed6c1';
update menu_items set name_ru = 'Зелёный чай', description_ru = 'Чайник RM16 / Чашка RM6' where id = 'c4a4887c-e4f1-47ad-8686-84f06af2221e';
update menu_items set name_ru = 'Красный чай' where id = '0487b62f-1313-4af3-b02d-2fe75dfa2c39';
update menu_items set name_ru = 'Капучино' where id = '112516f6-9752-4204-8dda-e5404a241026';
update menu_items set name_ru = 'Горячий Нескафе' where id = '46da0b4a-dd0d-4746-954f-ad603640f0ec';
update menu_items set name_ru = 'Каркаде' where id = '19fb5a66-7d08-4d47-90c4-e538640871f2';
update menu_items set name_ru = 'Горячий Мило' where id = '43b9a20f-93ee-416e-9c98-86a3e8a48a36';

-- بيتزا
update menu_items set name_ru = 'Пицца «Пепперони»' where id = '3c02fa92-e31d-4465-a8a0-7ad28165f578';
update menu_items set name_ru = 'Пицца «Маргарита»', description_ru = 'Тесто, запечённое в каменной печи, с томатным соусом, свежим сыром моцарелла, ароматными листьями базилика и оливковым маслом' where id = '4394710d-5832-450e-ba9e-ba0ec5e756a7';
update menu_items set name_ru = 'Пицца с бараниной', description_ru = 'Мягкое тесто для пиццы, фирменный томатный соус Orchid House, расплавленный сыр моцарелла, ломтики стейка на гриле, красный лук и чёрные оливки' where id = 'd26f7aea-bc37-412d-a27b-120e30fdfcae';
update menu_items set name_ru = 'Гавайская пицца', description_ru = 'Классический томатный соус, сыр моцарелла, свежие ломтики ананаса' where id = '027fa3f5-bf55-47b0-8d07-398419e26add';
update menu_items set name_ru = 'Пицца с курицей', description_ru = 'Тесто для пиццы с фирменным томатным соусом Orchid House, сыром моцарелла, полосками курицы, маринованной в восточных и западных специях, болгарским перцем, луком и оливками' where id = '42fbffa0-cd38-4f0e-a156-64c29eea14b0';
update menu_items set name_ru = 'Овощная пицца', description_ru = 'Секретный томатный соус Orchid House, сыр моцарелла, болгарский перец, чёрные оливки, грибы, лук и сладкая кукуруза' where id = 'd264ca42-e925-40ea-bb61-dbabd69ac1cd';
update menu_items set name_ru = 'Пицца «Орхидея»', description_ru = 'Итальянское тесто с томатным соусом, сыр моцарелла, фирменное маринованное мясо Orchid House, ломтики лука, болгарский перец, грибы и дополнительное оливковое масло' where id = '447e8168-4cc0-481b-86de-2e7b0784d8ff';

-- السلطة
update menu_items set name_ru = 'Табуле', description_ru = 'Дроблёная пшеница с рубленой петрушкой, помидорами, луком, заправленная оливковым маслом и свежим лимоном' where id = '384360cf-91e4-4e38-8187-e71d586f3d12';
update menu_items set name_ru = 'Фаттуш «Орхидея»', description_ru = 'Жареный питта-хлеб, баклажаны, огурцы, помидоры, салат, мята, разноцветный перец и оливки, заправлено гранатовой патокой' where id = 'ec1d5e58-53a8-42fc-ae4a-da64dcab77dc';
update menu_items set name_ru = 'Салат «Орхидея»', description_ru = 'Черри-помидоры, луковые кольца, петрушка, маринованный халапеньо' where id = 'cb4c95c1-094d-46b2-b6a3-199dfd4eda1f';
update menu_items set name_ru = 'Салат с креветками', description_ru = 'Свежие креветки, кукуруза, салат, свежий лимон, поджаренный хлеб' where id = 'b4af33ef-f2e4-4e3a-adef-1903631df23e';
update menu_items set name_ru = 'Салат с оливками', description_ru = 'Тёртая морковь, ломтики зелёных оливок, заправленные лимонным соком, оливковым маслом и гранатовой патокой' where id = '56cf1f23-6fea-4d43-b5c3-93b53954b75a';
update menu_items set name_ru = 'Свекольный салат', description_ru = 'Свёкла, сыр, лук, чеснок, свежая петрушка, заправлено лимонным соком и оливковым маслом' where id = '17a36d1f-6fbd-498a-a11f-3074d5d3af32';
update menu_items set name_ru = 'Салат с тунцом', description_ru = 'Нарезанный тунец, свежий салат, кукуруза, майонез, заправлено горчицей' where id = '26d0bb2e-c25a-4675-87ad-74ad60935049';
update menu_items set name_ru = 'Салат «Цезарь»', description_ru = 'Салат, поджаренный хлеб, курица, соус «Цезарь»' where id = '29a4083e-4ea4-4b38-a8cc-ac0cfa4cf95b';
update menu_items set name_ru = 'Арабский салат', description_ru = 'Огурцы, салат, помидоры, лук, петрушка, заправлено свежим лимонным соком и оливковым маслом' where id = '60cdd4a0-5874-4650-8f43-f7bc98c98bf9';
update menu_items set name_ru = 'Фаттуш', description_ru = 'Жареный питта-хлеб, баклажаны, огурцы, помидоры, салат, мята, разноцветный перец и оливки, заправлено гранатовой патокой' where id = '2bfe7744-2f13-41ed-bf61-d0d13a01ffdf';

-- الكاتو
update menu_items set name_ru = 'Торт-шоу с барабанами 🎂🥁', description_ru = 'Ваш любимый торт с энергичным барабанным шоу от нашей команды' where id = '23e8ad5e-5c15-429c-9ebe-c5b98c5e6a6d';

-- المقبلات الباردة
update menu_items set name_ru = 'Мухаммара', description_ru = 'Красный перец, панировочные сухари, гранатовая патока, грецкие орехи и оливковое масло' where id = '37dd827a-f5fb-4651-850a-bf316c42fb0f';
update menu_items set name_ru = 'Баба гануш «Орхидея»', description_ru = 'Печёные баклажаны, помидоры, зелёный и красный перец, лук, чеснок, тахини, петрушка, заправлено свежим лимоном и оливковым маслом' where id = '95ba75db-cf49-4d7a-8085-7045f7723dda';
update menu_items set name_ru = 'Хумус «Орхидея»', description_ru = 'Хумус, фисташки, тахини, лимонный сок, петрушка, лук, оливковое масло' where id = '34ffff87-fea2-46a9-a95a-cc397930517f';
update menu_items set name_ru = 'Свекольный хумус', description_ru = 'Хумус, свёкла, тахини, лимонный сок, оливковое масло' where id = '7b59ce8f-0d3d-47ca-a573-af85626d2987';
update menu_items set name_ru = 'Кишк', description_ru = 'Свежее лабне с белой крупой и луком, заправлено оливковым маслом и грецкими орехами' where id = '598cd42d-d1b9-4753-a1f0-bb46864085a2';
update menu_items set name_ru = 'Виноградные листья', description_ru = 'Виноградные листья, фаршированные пряным рисом, маринованные в лимоне и оливковом масле' where id = 'ca78d2cc-491f-49ee-ab0c-7fa9a3fdd3c6';
update menu_items set name_ru = 'Хумус с фисташками', description_ru = 'Хумус, фисташки, тахини, лимонный сок, оливковое масло' where id = '4a57c079-18f8-4e3e-9137-5637f76924d8';
update menu_items set name_ru = 'Свекольный мутабаль', description_ru = 'Печёные баклажаны, свёкла, тахини, йогурт, чеснок, оливковое масло и лимонный сок' where id = 'dba45a58-c89f-498d-abb2-ae6da5aa344d';
update menu_items set name_ru = 'Хумус', description_ru = 'Хумус, тахини, лимонный сок, оливковое масло' where id = '45861f1b-e6f7-4719-bd12-72fd1425eb7a';
update menu_items set name_ru = 'Закуски ассорти (B)', description_ru = 'Свекольный мутабаль, хумус, мухаммара, баба гануш' where id = '860f2c82-c28d-4815-b544-d7bfeff9c13d';
update menu_items set name_ru = 'Баклажанный мутабаль', description_ru = 'Баклажаны, тахини, йогурт, зёрна граната, чеснок, оливковое масло и лимонный сок' where id = '3d871bdc-c9f9-429d-9385-8080c2f09853';
update menu_items set name_ru = 'Баба гануш', description_ru = 'Печёные баклажаны, помидоры, зелёный и красный перец, свежий лимон и оливковое масло' where id = '724bf53b-1338-4376-bdd7-516cb55cbe10';
update menu_items set name_ru = 'Закуски ассорти (A)', description_ru = 'Хумус, виноградные листья, арабский салат' where id = '42f58c16-d316-4fe2-b64f-3ea106bf4d2b';

notify pgrst, 'reload schema';
