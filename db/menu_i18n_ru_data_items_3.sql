-- ══════════════════════════════════════════════════════════════════════════════
--  ترجمة الأصناف للروسية - دفعة ٣: الأطباق السورية + شيشة + الحلويات + الأطباق اليمنية + الأطباق الرئيسية
--  يعتمد على db/menu_i18n_ru.sql. آمن لإعادة التشغيل.
-- ══════════════════════════════════════════════════════════════════════════════

-- الأطباق السورية
update menu_items set name_ru = 'Дауд-паша', description_ru = 'Тефтели, тушённые в томатном соусе с красным и зелёным болгарским перцем' where id = '42d40ebb-0d08-4752-a261-db5a95ee4ac9';
update menu_items set name_ru = 'Саядия с рыбой', description_ru = 'Жареное рыбное филе с пряным рисом и луковыми кольцами' where id = 'd087a1fd-d860-4f7d-9741-42a4cc2c33a3';
update menu_items set name_ru = 'Курица в духовке', description_ru = 'Маринованная запечённая курица, подаётся с печёным картофелем и овощами' where id = '491e5583-5ef6-4f9f-817e-7d7b8b6dcada';
update menu_items set name_ru = 'Фрика с курицей', description_ru = 'Сирийская жареная пшеница с зелёным горошком и болгарским перцем, подаётся с курицей' where id = '5b8a2162-709d-48f3-b8c1-19cff2d5c23a';
update menu_items set name_ru = 'Фрика с бараниной', description_ru = 'Сирийская жареная пшеница с зелёным горошком и болгарским перцем, подаётся с бараниной' where id = 'c8b1f78c-6d6c-47d5-8545-bc96c67c79c1';
update menu_items set name_ru = 'Ябрак с бараниной', description_ru = 'Виноградные листья, фаршированные мясом, тушённые с чесноком и лимоном' where id = 'b30f232b-381c-4c54-8e4a-2decdd5c7fc2';
update menu_items set name_ru = 'Кеббе Лабания', description_ru = 'Жареное кеббе, тушённое в йогурте с чесноком и мятой, подаётся с белым рисом' where id = '1894560b-1a46-4561-a920-b7a733f3aa4c';
update menu_items set name_ru = 'Вишнёвый кебаб', description_ru = 'Восхитительная кисло-сладкая вишня с кебабом из рубленой баранины' where id = 'a74a63b6-35df-4caf-b9b8-af9c9be5bf26';
update menu_items set name_ru = 'Мансаф из баранины/курицы', description_ru = 'Рис с бараньей голенью и жареным кеббе, подаётся с соусом джамид' where id = '60149218-54eb-41d3-a8a3-5602c2d1ca9b';
update menu_items set name_ru = 'Молохия с бараниной', description_ru = 'Тушёные листья молохии, подаются с белым рисом' where id = '6873aed4-13fe-4c6d-bbd4-db1d502814a8';
update menu_items set name_ru = 'Шиш-барак «Орхидея»', description_ru = 'Шиш-барак, сыр и томатный соус' where id = '4291a5b7-8e82-44d9-8337-2846615f6a3c';
update menu_items set name_ru = 'Молохия с курицей', description_ru = 'Тушёные листья молохии, подаются с белым рисом' where id = 'a82767c9-501e-4220-b4a9-b0f8dc14d5e4';
update menu_items set name_ru = 'Махаши', description_ru = 'Фаршированные овощи ассорти (картофель, лук, баклажаны, перец, виноградные листья) с рисом и рубленым мясом' where id = 'c06b03e5-6e8b-4a25-b64d-c0ace3039114';
update menu_items set name_ru = 'Фасолия с бараниной', description_ru = 'Белая фасоль, тушённая в томатном соусе с бараниной, подаётся с белым рисом' where id = '3186c6db-e702-4975-97ac-b2a926e1a249';
update menu_items set name_ru = 'Кавзи с бараниной', description_ru = 'Слой теста, начинённый тщательно приготовленным рисом и зелёным горошком, смешанными с отборными жареными орехами и кусочками баранины' where id = '7e7a0a8b-c69b-49cc-9c78-e4215833be20';
update menu_items set name_ru = 'Шиш-барак', description_ru = 'Тесто с мясной начинкой, тушённое в йогурте с чесноком и кинзой, подаётся с белым рисом' where id = 'ca98c13f-6695-4804-a999-3823a882c257';
update menu_items set name_ru = 'Шакрия с бараниной', description_ru = 'Баранина, тушённая в йогурте, подаётся с белым рисом' where id = '84a0f6f6-2623-4b3c-ab0a-2dd8e8262afb';
update menu_items set name_ru = 'Шакрия с курицей', description_ru = 'Курица, тушённая в йогурте, подаётся с белым рисом' where id = '1f902750-caf6-4dfc-b7a1-f25ea5eb9ede';
update menu_items set name_ru = 'Баша ва Аскро', description_ru = 'Жареное кеббе и шиш-барак, тушённые в йогурте' where id = '9058a63b-5262-4659-8af6-21f8a614e183';

-- شيشة
update menu_items set name_ru = 'Кальян', description_ru = 'Кальян премиум-класса с высококачественными вкусами для приятного и мягкого опыта' where id = 'f61bd2e4-32e5-4b28-b2eb-23cf17a251c2';
update menu_items set name_ru = 'Супер-кальян', description_ru = 'Кальян с ананасовой чашей' where id = 'c59faee1-f771-404e-aec4-bf17565086da';

-- الحلويات
update menu_items set name_ru = 'Палочки с зефиром' where id = '20b4d291-353a-43fb-a5bb-3e5430d8d0f4';
update menu_items set name_ru = 'Вафли «Кит-Кат»' where id = '375664b5-5942-4c5b-ae08-9083672664f8';
update menu_items set name_ru = 'Кунафа с фисташками' where id = '023102a6-ceba-445e-9c75-63d6b6d6fa52';
update menu_items set name_ru = 'Фирменные брауни «Орхидея»' where id = '5256f26c-afb5-4445-9369-67876142704c';
update menu_items set name_ru = 'Кунафа «Лотус»' where id = '715a85be-6791-49d5-82c6-a83ca4e4d178';
update menu_items set name_ru = 'Блин «Орхидея» с фруктами' where id = '14e4a01b-ead7-4e69-bebb-1b8d3e0daae5';
update menu_items set name_ru = 'Кунафа с сыром' where id = '4b3a1e97-82db-4ba7-a67e-76faa3934251';
update menu_items set name_ru = 'Блин «Лотус»' where id = '7059027f-2936-49ae-9f1a-4246f83eb858';
update menu_items set name_ru = 'Арабские сладости' where id = 'bcbd8211-36f0-4dac-b652-2f31f7a47e06';
update menu_items set name_ru = 'Кунафа «Красный бархат»' where id = '66dead60-e9b5-4c4c-a3fd-df142722f017';
update menu_items set name_ru = 'Кунафа с мороженым' where id = '0a8e12a5-96da-47ac-af12-89a8f3389662';
update menu_items set name_ru = 'Вафли «Лотус»' where id = '26644047-1d06-4148-9dd8-788a70a2c702';
update menu_items set name_ru = 'Блин «Феттучини»' where id = '9230d99e-1e88-4bb9-9213-dcf65a29135e';
update menu_items set name_ru = 'Крем-карамель' where id = '30862a5b-7e06-43a5-9954-4800c90c0a26';
update menu_items set name_ru = 'Панкейк с брауни и фисташками' where id = '196d2d35-7e61-49c9-b3f8-1f0da23ed70f';
update menu_items set name_ru = 'Блин-рулет с бананом' where id = 'b424a676-8511-4fc0-8c1a-d2966dd89f6c';
update menu_items set name_ru = 'Банана-сплит' where id = '711a22ff-a279-4df1-b8e4-093e4892d878';
update menu_items set name_ru = 'Кунафа с шоколадом' where id = 'ce199ebe-c81b-4461-985b-be43eea4068d';
update menu_items set name_ru = 'Блин-рулет с фруктами' where id = '07d454a9-505d-4f22-b3aa-f1bc82ea2131';
update menu_items set name_ru = 'Вафли с фруктами' where id = '8a75d6c1-be3c-4ddd-b3ba-13a56003f327';
update menu_items set name_ru = 'Большая фруктовая тарелка' where id = '56a02fe8-cd9f-450a-908f-f198f6f0b128';
update menu_items set name_ru = 'Малая фруктовая тарелка' where id = '7f05126b-8eb5-4a5d-ad7f-08c3cea2a4d3';
update menu_items set name_ru = 'Мухаллабия' where id = '19d082bd-8ab0-44b7-82ab-6f04b642ea6c';
update menu_items set name_ru = 'Фирменный блин с кунафой' where id = '6beb8f6e-7288-4d3c-939a-71400270461a';
update menu_items set name_ru = 'Клубничные палочки' where id = '0e379317-cdc1-46f9-bc5d-ab6dc99e45f6';

-- الأطباق اليمنية
update menu_items set name_ru = 'Салона с бараниной', description_ru = 'Баранина, приготовленная со специальными специями, в глиняном горшке с хлебом' where id = 'a41d2266-0442-489c-bb75-6d4ec012bc78';
update menu_items set name_ru = 'Салона с овощами', description_ru = 'Свежие овощи, приготовленные со специями, в глиняном горшке с хлебом' where id = '640cbbc4-c6c9-4aff-abb3-56403a06ede9';
update menu_items set name_ru = 'Салона с рыбой', description_ru = 'Рыба, приготовленная со специальными специями, в глиняном горшке с хлебом' where id = '9b4af48c-8cb2-41ff-b576-b1cb41184c49';
update menu_items set name_ru = 'Фахса с бараниной', description_ru = 'Нежная тушёная баранина, маринованная в смеси специй, приготовленная в глиняном горшке с хлебом' where id = '3ae60fa8-e6fe-4dde-b63e-f85d393ab814';
update menu_items set name_ru = 'Окда с бараниной', description_ru = 'Нежные волокна тушёной баранины с картофелем и ароматным острым перцем, обжаренные, подаются с хлебом' where id = '2cc446db-a207-4ffc-8bc5-de8cab5d0a10';
update menu_items set name_ru = 'Фахса с курицей', description_ru = 'Нежная тушёная курица, маринованная в смеси специй, приготовленная в глиняном горшке с хлебом' where id = '2f211a4e-dba4-48a4-a302-f3b1e8e292cf';
update menu_items set name_ru = 'Салона с креветками', description_ru = 'Креветки, приготовленные со специальными специями, в глиняном горшке с хлебом' where id = '5b525ecc-e385-477a-bbc9-817c2ac8646a';
update menu_items set name_ru = 'Мокалькат с бараниной', description_ru = 'Баранина, обжаренная со специями, помидорами, луком, болгарским перцем и чесноком' where id = '7e956b05-abce-4eab-93cc-c3cc672e8db5';
update menu_items set name_ru = 'Салона с курицей', description_ru = 'Курица, приготовленная со специальными специями, в глиняном горшке с хлебом' where id = '57d9e6b1-2a92-4f82-a6b4-ffb1f893f204';
update menu_items set name_ru = 'Окда с курицей', description_ru = 'Нежные волокна тушёной курицы с картофелем и ароматным острым перцем, обжаренные, подаются с хлебом' where id = 'd5c56e70-4ae0-4107-a889-c9a0d1445237';
update menu_items set name_ru = 'Мокалькат с курицей', description_ru = 'Курица, обжаренная со специями, помидорами, луком, болгарским перцем и чесноком' where id = 'c798933f-c303-4335-858f-50b92fc88a34';

-- الأطباق الرئيسية
update menu_items set name_ru = 'Маклюба с бараниной', description_ru = 'Домашний рис со специальными специями, баклажанами, картофелем и бараниной' where id = '44c50f38-1e6f-472d-a465-431da9c8fd7b';
update menu_items set name_ru = 'Бухари с бараниной', description_ru = 'Ароматная баранина с рисом басмати и жареной морковью' where id = '47ec9599-3185-46c8-8069-c80c7e3c234a';
update menu_items set name_ru = 'Зурбиан с бараниной', description_ru = 'Ароматная баранина с рисом басмати и карамелизированным жареным луком' where id = 'c6d4073d-0a72-4744-bee6-f972fbea7625';
update menu_items set name_ru = 'Фирменное блюдо «Орхидея»', description_ru = 'Куриный манди, сыр маджука, ассорти гриль, кебаб из баклажанов, жареная курица, маклюба с бараниной, крылышки' where id = '4ac351ea-ef42-4ef1-8406-b1ac6d52b36e';
update menu_items set name_ru = 'Куриный манди', description_ru = 'Фирменное блюдо из курицы с копчёным рисом басмати' where id = '1de2422e-30ef-4cfe-804c-3a4a9d5d0beb';
update menu_items set name_ru = 'Манди с бараниной', description_ru = 'Фирменное блюдо из баранины с копчёным рисом басмати' where id = '2dc18b59-376b-4995-9abe-713a59238082';
update menu_items set name_ru = 'Баклажаны с бараниной', description_ru = 'Баклажаны, рубленая баранина, приготовленные со свежим томатным соусом и жареным луком' where id = '66f335e5-1cbb-40b1-b902-b5f9cd746ed2';
update menu_items set name_ru = 'Тажин с курицей', description_ru = 'Курица, картофель, морковь, лук, чеснок, разноцветный перец, оливковое масло, цукини' where id = '03d7c5cf-5e2f-416d-ae38-060bfe9f8d0d';
update menu_items set name_ru = 'Бирьяни с бараниной', description_ru = 'Ароматная баранина с рисом бирьяни, подаётся с соусом бирьяни' where id = '3bcb1025-b2d3-4fcb-8ca6-31c18df066a1';
update menu_items set name_ru = 'Маклюба с курицей', description_ru = 'Домашний рис со специальными специями, баклажанами, картофелем и курицей' where id = 'ace6f4c0-0ac4-4ce5-9da4-3ffcb11a1fd3';
update menu_items set name_ru = 'Бухари с курицей', description_ru = 'Ароматная курица с рисом басмати, луком и жареной морковью' where id = 'a10a8f92-eecb-47bd-8441-011aa4814d55';
update menu_items set name_ru = 'Бамия с бараниной', description_ru = 'Бамия, тушённая в томатной пасте с бараниной, подаётся с белым рисом' where id = '1948d237-f014-4dcd-bff1-4071b3f8dd24';
update menu_items set name_ru = 'Кабса с курицей', description_ru = 'Маринованная курица, приготовленная со смесью риса и овощей' where id = 'bcac1a31-1d9a-4178-bc63-29ad524a1acb';
update menu_items set name_ru = 'Тажин с бараниной', description_ru = 'Баранья голень, картофель, морковь, лук, чеснок, разноцветный перец, оливковое масло, цукини' where id = 'af6d3b56-0912-4002-b721-581860b02961';
update menu_items set name_ru = 'Бирьяни с курицей', description_ru = 'Ароматная курица с рисом бирьяни, подаётся с соусом бирьяни' where id = '7aa1381d-c899-45a2-b413-7b15e72dbe8a';
update menu_items set name_ru = 'Кабса с бараниной', description_ru = 'Маринованная баранина, приготовленная со смесью риса и овощей' where id = '57b0cd59-189f-435b-be6e-6c8b32087bb6';
update menu_items set name_ru = 'Тажин с рыбой', description_ru = 'Рыбное филе, картофель, морковь, лук, чеснок, разноцветный перец, оливковое масло, цукини' where id = '3383378f-d771-4fd9-95fb-3d2ff82a84d1';
update menu_items set name_ru = 'Зурбиан с курицей', description_ru = 'Ароматная курица с рисом басмати и карамелизированным жареным луком' where id = '6efbc9d0-0282-4941-95d7-45cef0f37402';

notify pgrst, 'reload schema';
