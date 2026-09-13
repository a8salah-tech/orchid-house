-- ══════════════════════════════════════════════════════════════════════════════
--  ترجمة الأصناف للروسية - دفعة ٤: المعجنات التركية + الكبة + شاورما + معكرونة + المشاوي
--  يعتمد على db/menu_i18n_ru.sql. آمن لإعادة التشغيل.
-- ══════════════════════════════════════════════════════════════════════════════

-- المعجنات التركية
update menu_items set name_ru = 'Сыр моцарелла', description_ru = 'Расплавленный сыр моцарелла' where id = 'b5049b47-f7f7-4a15-b1d5-3cdb20576284';
update menu_items set name_ru = 'Турецкий лахмаджун', description_ru = 'Рубленая баранина со специальными специями' where id = '035a212a-253e-4a3b-9586-870a12c85e35';
update menu_items set name_ru = 'Сыр с яйцом', description_ru = 'Расплавленный сыр моцарелла с яйцом' where id = '285c39ca-ea74-4b5a-8a34-94c18b095b3a';
update menu_items set name_ru = 'Курица с сыром', description_ru = 'Курица с сыром моцарелла' where id = '25ccb53c-2d19-4767-8bb5-ad1d65e23d44';
update menu_items set name_ru = 'Тунец с сыром', description_ru = 'Расплавленный сыр моцарелла с тунцом' where id = '8bbf4c23-8116-49a9-9b59-05fd9c42d2e1';
update menu_items set name_ru = 'Баранина с сыром', description_ru = 'Рубленая баранина с сыром моцарелла' where id = 'a9804f79-a16c-4c24-8a94-2740a661e5b3';
update menu_items set name_ru = 'Лабне с тимьяном', description_ru = 'Лабне с зелёным тимьяном' where id = '9e5920c1-51a1-4775-a74b-48aa1346862f';

-- الكبة
update menu_items set name_ru = 'Жареное кеббе', description_ru = 'Рубленая баранина с белой крупой и луком, обжаренная' where id = '8c26e5b0-95d4-42bd-80eb-822bc613d41f';
update menu_items set name_ru = 'Кеббе Саджия', description_ru = 'Белая крупа с рубленой бараниной, луком, орехами ассорти, жиром, приготовлено на садже' where id = '87b23a7e-0cf2-43d6-b2b4-a847867ccd89';
update menu_items set name_ru = 'Кеббе на гриле', description_ru = 'Рубленая баранина с белой крупой, луком, зёрнами граната, приготовлено на гриле' where id = 'd1b6f200-19d0-45c7-a9db-c355f106ab08';
update menu_items set name_ru = 'Кеббе в духовке', description_ru = 'Белая крупа с рубленой бараниной, луком, орехами ассорти, запечённое в духовке' where id = 'd3caf25c-4a7d-4ae2-8599-b5ea8b76ace5';

-- شاورما
update menu_items set name_ru = 'Тарелка шаурмы', description_ru = 'Полоски куриной шаурмы с картофелем фри, овощами и чесночным соусом' where id = 'a18ce3bc-c01c-4359-91f0-e91b2fab7577';
update menu_items set name_ru = 'Арабская шаурма', description_ru = 'Нарезанный сэндвич с куриной шаурмой, подаётся с картофелем фри, овощами и чесночным соусом' where id = 'a12845b8-fa40-484c-97d7-f700f266b664';
update menu_items set name_ru = 'Шаурма с рисом', description_ru = 'Полоски куриной шаурмы с белым рисом, подаются с арабским салатом, овощами и чесночным соусом' where id = '1e0ccb0a-a097-4fea-a270-6e0f38cedb86';
update menu_items set name_ru = 'Сет шаурмы', description_ru = 'Обычный куриный сэндвич с картофелем фри, помидорами, солёными огурцами, морковью и чесночным соусом' where id = '6d5a34ba-e5b3-4f4c-9b86-d44904eaaeed';
update menu_items set name_ru = 'Шаурма Панне', description_ru = 'Хрустящий сырный сэндвич с куриной шаурмой, подаётся с чесночным соусом и овощами' where id = 'fa770984-4202-40b4-b0f9-b3ff35908db2';

-- معكرونة
update menu_items set name_ru = 'Паста в сливочном соусе с курицей', description_ru = 'Паста пенне, сливочный соус, курица и травы ассорти' where id = '93e7929a-dcf8-4dc7-b1ed-245d0cf84c85';
update menu_items set name_ru = 'Овощная паста', description_ru = 'Паста, грибы, томатный соус, перец ассорти, лук и травы' where id = '61dfc8bf-6f62-416d-b6cf-251161ff7896';
update menu_items set name_ru = 'Паста с курицей', description_ru = 'Паста, томатный соус, лук, перец ассорти, чеснок и травы ассорти' where id = '96931c09-41db-4d0c-8457-e783a3f84ae0';
update menu_items set name_ru = 'Паста с мясом', description_ru = 'Паста, томатный соус, лук, рубленое мясо, чеснок' where id = '02bbb49d-e2d8-4137-b633-405c3358d266';
update menu_items set name_ru = 'Паста Карбонара', description_ru = 'Паста, грибы, чеснок, с ассорти отборных морепродуктов' where id = '075705a8-5e3f-4f2d-85ea-e0a10e7a7d29';

-- المشاوي
update menu_items set name_ru = 'Кофта с картофелем', description_ru = 'Свежий картофель и баранина, запечённые в духовке, с помидорами, перцем чили и луковыми кольцами' where id = '01f84dd8-62f6-4473-a420-ccc22c3d4be6';
update menu_items set name_ru = 'Арайес «Орхидея»', description_ru = 'Традиционный жареный хлеб, свёрнутый с рубленой бараниной, луком, помидорами, перцем, сыром моцарелла и чесночным соусом' where id = 'af4b780b-133a-429b-bfd4-3f9e9e64db11';
update menu_items set name_ru = 'Кебаб с баклажанами', description_ru = 'Баклажаны, покрытые слоем рубленой баранины, подаются с чесночным соусом и разноцветным перцем в особом соусе' where id = 'd6b2b142-78ff-45bc-b349-b5de70f1ff17';
update menu_items set name_ru = 'Курица гриль без костей', description_ru = 'Курица гриль без костей, маринованная в лимоне, чесноке и специях, подаётся с картофелем фри и чесночным соусом' where id = 'ffd0cc48-16de-4e21-a118-30ef483d5897';
update menu_items set name_ru = 'Кебаб из баранины', description_ru = 'Маринованный кебаб из баранины на шампурах, подаётся с соусом тахини, картофелем фри и чесночным соусом' where id = '6368717e-9f93-4dc6-ad64-7b4cbf9cd17a';
update menu_items set name_ru = 'Ассорти гриль', description_ru = 'По одной порции: кебаб из говядины, кебаб из курицы, шиш-тавук, кубики баранины' where id = 'c7bd505b-0edb-44a7-8ed2-2ac753a64f61';
update menu_items set name_ru = 'Ассорти гриль «Орхидея»', description_ru = 'По две порции: кебаб из баранины, кебаб из курицы, шиш-тавук, кубики баранины, крылышки, арайес с бараниной' where id = '1f8e7192-3292-44db-8c3c-743c3e5e4735';
update menu_items set name_ru = 'Шиш-тавук', description_ru = 'Шампуры из куриной грудки на гриле, подаются с картофелем фри и чесночным соусом' where id = '673869c1-91b9-4782-bf43-31e24a15db6e';
update menu_items set name_ru = 'Шиш в глиняном горшке', description_ru = 'Кубики курицы, сыр и сливочный соус с овощами' where id = '59f6e3f3-473b-4578-8d02-0ff6a5dd81e1';
update menu_items set name_ru = 'Арайес с бараниной', description_ru = 'Рубленая баранина, запечённая на ливанском хлебе, подаётся с чесночным соусом' where id = 'a980f5cb-2be2-448e-a233-6f60f25eca99';
update menu_items set name_ru = 'Кофта с сыром', description_ru = 'Маринованная баранина на гриле, смешанная со специями и сыром моцарелла, подаётся с картофелем фри и чесночным соусом' where id = 'c865b0f5-c831-4bbf-b0f8-cfdbc520f4ee';
update menu_items set name_ru = 'Кофта «Орхидея»', description_ru = 'Баклажаны, запечённые в духовке с мясом, помидорами, перцем чили и луковыми кольцами' where id = '9fca0d9f-585a-4e51-b004-6d0a9dbab609';
update menu_items set name_ru = 'Арайес с курицей', description_ru = 'Рубленая курица, запечённая на ливанском хлебе, подаётся с чесночным соусом' where id = 'c7238758-4db5-416e-bbf7-c76b3fa45cd1';
update menu_items set name_ru = 'Кофта с тахини', description_ru = 'Запечённая рубленая баранина, тахини' where id = '6809faf4-6d9a-45f0-a5f3-e72c3ba6babc';
update menu_items set name_ru = 'Куриные крылышки', description_ru = 'Крылышки на гриле, маринованные в лимоне, чесноке и специях, подаются с чесночным соусом' where id = '0f75a347-4c66-4594-b8bf-21d88caa56e3';
update menu_items set name_ru = 'Кубики говядины', description_ru = 'Говяжья вырезка на гриле, подаётся с чесночным соусом и картофелем фри' where id = '47ed653c-a868-4d70-a41e-c350fb21ea8d';
update menu_items set name_ru = 'Кебаб Байти', description_ru = 'Маринованная баранина на гриле, подаётся с соусом тахини и картофелем фри' where id = '7c87c113-749f-4ce8-89fc-789b653b6d1f';
update menu_items set name_ru = 'Бараньи рёбрышки', description_ru = 'Сочные маринованные бараньи рёбрышки, подаются со смесью лимонного и чесночного соуса' where id = '776208f9-ce3d-4626-9903-6da341f549af';
update menu_items set name_ru = 'Кебаб из курицы', description_ru = 'Маринованный кебаб из курицы на шампурах, подаётся с чесночным соусом и картофелем фри' where id = '2b7c5b6e-c297-4099-84e4-bdfa8aa169ef';
update menu_items set name_ru = 'Гриль-ассорти 1/2 метра', description_ru = 'Кебаб из курицы, кебаб из баранины, кубики говядины, шиш-тавук, куриные крылышки на гриле' where id = 'a13a4e34-32ca-4d60-89cc-aed2607dd580';
update menu_items set name_ru = 'Кофта на противне', description_ru = 'Рубленая баранина, запечённая в духовке, с помидорами, перцем чили и луковыми кольцами' where id = 'ada7acae-ca41-4e8a-89c5-a3790fd1aabd';
update menu_items set name_ru = 'Кебаб Каш-Каш', description_ru = 'Кусочки кебаба из рубленой баранины на гриле, подаются на подушке из острого томатного соуса' where id = '8fa1c009-ee7c-4541-9371-ea233bb7a20e';
update menu_items set name_ru = 'Курица гриль', description_ru = 'Половина курицы гриль, маринованной в лимоне, чесноке и специях, подаётся с картофелем фри и чесночным соусом' where id = '12f68b58-89ef-4349-afbe-95bcdaa69fcf';
update menu_items set name_ru = 'Гриль-ассорти 1 метр', description_ru = 'Кебаб из курицы, кебаб из баранины, кубики говядины, шиш-тавук, куриные крылышки на гриле, арайес «Орхидея»' where id = '6b6776b2-3dc4-4509-982e-fc780db86989';

notify pgrst, 'reload schema';
