-- ══════════════════════════════════════════════════════════════════════════════
--  ترجمة محتوى المنيو إلى الماليزية — البيانات
--  شغّل db/menu_i18n_ms.sql أولاً (لإضافة الأعمدة)، ثم هذا الملف.
--  الترجمة: الأسماء ذات الطابع الخاص منقحرة (Shawarma, Kunafah…)، والباقي مترجم.
--  آمن لإعادة التشغيل. لا يشمل الأحجام (menu_item_sizes) — تُرسَل لاحقاً.
-- ══════════════════════════════════════════════════════════════════════════════

-- ── الأقسام ──
update menu_categories set name_ms = 'Sup'                          where id = '1f45370f-6ca2-412b-81f3-b322a7acafba';
update menu_categories set name_ms = 'Waktu Makan Tengah Hari'      where id = '0d8e7562-00c5-4b07-b8cd-6ff0331f4370';
update menu_categories set name_ms = 'Pasta'                        where id = '87f2daec-3604-44ea-8b8e-42af5e47b0ac';
update menu_categories set name_ms = 'Hidangan Yaman'              where id = '5a92d1ca-edb3-4ce4-b923-7fb70841cb9c';
update menu_categories set name_ms = 'Pembuka Selera Panas'         where id = '25b16458-0c32-41f8-9730-b4bbaeb1e03b';
update menu_categories set name_ms = 'Tambahan'                     where id = '35a90bf6-478e-4281-972d-efa1d6d859d3';
update menu_categories set name_ms = 'Pencuci Mulut'               where id = '5805f3bd-b0a9-4ab2-aea7-649726fb1a07';
update menu_categories set name_ms = 'Kek'                          where id = 'c349a109-48e3-4e13-af7f-c3bfe381b335';
update menu_categories set name_ms = 'Shawarma'                     where id = '84eb88b8-6aea-453e-8cb9-a977d8822310';
update menu_categories set name_ms = 'Minuman Panas'               where id = 'a9ed00f9-9a94-4f61-b747-0bb3d805d6da';
update menu_categories set name_ms = 'Hidangan Syria'             where id = '50bae98f-b5bd-414c-9d36-78b6c8be0924';
update menu_categories set name_ms = 'Makanan Laut'               where id = 'a2235d56-f9ec-4d71-9c1b-28d114823c77';
update menu_categories set name_ms = 'Set Keluarga'               where id = '99020816-226e-414c-9f16-32a6bbafb487';
update menu_categories set name_ms = 'Hidangan Utama'             where id = '68ba66a8-c9b9-4aa0-a462-d475d0900cf0';
update menu_categories set name_ms = 'Panggangan'                 where id = '9345c645-88fb-42f9-9a69-d15842cab805';
update menu_categories set name_ms = 'Salad'                       where id = 'b72ec4e3-e6b2-43d4-bd1d-e464469d3ced';
update menu_categories set name_ms = 'Shisha'                      where id = '56f7d261-1228-44f4-951e-a479cbeb42d7';
update menu_categories set name_ms = 'Pembuka Selera Sejuk'        where id = 'e3d3f290-b51b-4413-a25a-63e0ae77243c';
update menu_categories set name_ms = 'Minuman Sejuk'              where id = '356d7ac4-a5a6-4758-8105-41b5475908ae';
update menu_categories set name_ms = 'Pide Turki'                 where id = '70634780-5b5b-41e6-98b5-361198987391';
update menu_categories set name_ms = 'Kibbeh'                      where id = '84be299f-9720-4f18-8e74-e704e18c1613';
update menu_categories set name_ms = 'Piza'                        where id = 'b3c151ba-bb8c-46a4-ba44-39d620364bd3';

-- ── الأصناف ──
update menu_items set name_ms = 'Wafel Lotus'                       where id = '26644047-1d06-4148-9dd8-788a70a2c702';
update menu_items set name_ms = 'Krep Fettuccine'                   where id = '9230d99e-1e88-4bb9-9213-dcf65a29135e';
update menu_items set name_ms = 'Cucuk Marshmallow'                 where id = '20b4d291-353a-43fb-a5bb-3e5430d8d0f4';
update menu_items set name_ms = 'Keju dengan Telur',        description_ms = 'Keju mozarella cair dengan telur'                                                                        where id = '285c39ca-ea74-4b5a-8a34-94c18b095b3a';
update menu_items set name_ms = 'Tajine Ayam',              description_ms = 'Ayam dimasak, kentang, lobak merah, bawang, bawang putih, lada berwarna, minyak zaitun, zukini'             where id = '03d7c5cf-5e2f-416d-ae38-060bfe9f8d0d';
update menu_items set name_ms = 'Mahashi',                  description_ms = 'Pelbagai sayur disumbat — kentang, bawang, terung, lada benggala, daun anggur — dengan nasi dan daging cincang' where id = 'c06b03e5-6e8b-4a25-b64d-c0ace3039114';
update menu_items set name_ms = 'Aneka Panggangan',         description_ms = 'Satu setiap satu: kebab daging lembu, kebab ayam, shish tawook, ketulan daging kambing'                    where id = 'c7bd505b-0edb-44a7-8ed2-2ac753a64f61';
update menu_items set name_ms = 'Mojito 3D'                         where id = '51e54cbf-e1fc-4cdd-ac9b-4bedd8c3d4fb';
update menu_items set name_ms = 'Makanek',                  description_ms = 'Sosej goreng mentega dengan lemon dan bawang putih'                                                        where id = 'aeee633c-8994-4379-a510-99f674bc398a';
update menu_items set name_ms = 'Kofta Bil Siniyah',        description_ms = 'Daging kambing cincang dibakar dalam ketuhar dengan tomato, cili dan hirisan bawang'                      where id = 'ada7acae-ca41-4e8a-89c5-a3790fd1aabd';
update menu_items set name_ms = 'Krep Lotus'                        where id = '7059027f-2936-49ae-9f1a-4246f83eb858';
update menu_items set name_ms = 'Manisan Arab'                      where id = 'bcbd8211-36f0-4dac-b652-2f31f7a47e06';
update menu_items set name_ms = 'Kunafah Red Velvet'               where id = '66dead60-e9b5-4c4c-a3fd-df142722f017';
update menu_items set name_ms = 'Kentang Pedas (Harrah)',   description_ms = 'Kentang rangup dengan serbuk cili, bawang putih dan lemon'                                                where id = 'd16713c3-1747-419b-8d66-fbb92528dac4';
update menu_items set name_ms = 'Jus Nanas'                         where id = '9e248f97-7284-4c50-9a6c-eac8cec4f87b';
update menu_items set name_ms = 'Ayam Berkeju',             description_ms = 'Ayam dengan keju mozarella'                                                                               where id = '25ccb53c-2d19-4767-8bb5-ad1d65e23d44';
update menu_items set name_ms = 'Wafel Kit-Kat'                     where id = '375664b5-5942-4c5b-ae08-9083672664f8';
update menu_items set name_ms = 'Mocktail Orchid',          description_ms = 'Aiskrim vanila, mangga, pisang, avokado, kacang'                                                          where id = 'c2c8bd10-ec08-475f-b313-facfee97fa59';
update menu_items set name_ms = 'Nasi Shawarma',            description_ms = 'Hirisan shawarma ayam dengan nasi putih, dihidang dengan salad Arab, sayur dan sos bawang putih'          where id = '1e0ccb0a-a097-4fea-a270-6e0f38cedb86';
update menu_items set name_ms = 'Kunafah Pistasio'                 where id = '023102a6-ceba-445e-9c75-63d6b6d6fa52';
update menu_items set name_ms = 'Piza Hawaii',              description_ms = 'Sos tomato klasik, keju mozzarella, hirisan nanas segar'                                                  where id = '027fa3f5-bf55-47b0-8d07-398419e26add';
update menu_items set name_ms = 'Krep Orchid'                       where id = '14e4a01b-ead7-4e69-bebb-1b8d3e0daae5';
update menu_items set name_ms = 'Kunafah Keju'                     where id = '4b3a1e97-82db-4ba7-a67e-76faa3934251';
update menu_items set name_ms = 'Pasta Carbonara',          description_ms = 'Pasta spageti, cendawan, bawang putih, dengan campuran makanan laut premium'                              where id = '075705a8-5e3f-4f2d-85ea-e0a10e7a7d29';
update menu_items set name_ms = 'Kunafah Aiskrim'                  where id = '0a8e12a5-96da-47ac-af12-89a8f3389662';
update menu_items set name_ms = 'Milkshake Lotus'                   where id = 'c892529d-4ea3-4a66-ac41-6defe8ffb7b4';
update menu_items set name_ms = 'Milkshake Oreo'                    where id = '7a4f76e6-4563-4505-af3d-35823e07b899';
update menu_items set name_ms = 'Muhammara',                description_ms = 'Lada merah, serbuk roti, sos delima, walnut dan minyak zaitun'                                            where id = '37dd827a-f5fb-4651-850a-bf316c42fb0f';
update menu_items set name_ms = 'Shisha Istimewa',          description_ms = 'Shisha dengan kepala nanas'                                                                               where id = 'c59faee1-f771-404e-aec4-bf17565086da';
update menu_items set name_ms = 'Kibbeh Saj',               description_ms = 'Daging kambing cincang dengan gandum putih, bawang, campuran kacang, lemak, dihidang dari saj'             where id = '87b23a7e-0cf2-43d6-b2b4-a847867ccd89';
update menu_items set name_ms = 'Maqlubah Kambing',         description_ms = 'Nasi masakan rumah dengan rempah istimewa, terung, kentang dan daging kambing'                            where id = '44c50f38-1e6f-472d-a465-431da9c8fd7b';
update menu_items set name_ms = 'Zurbian Ayam',             description_ms = 'Ayam berperisa dengan nasi basmati dan bawang goreng berkaramel'                                          where id = '6efbc9d0-0282-4941-95d7-45cef0f37402';
update menu_items set name_ms = 'Pancake Brownie Pistasio'          where id = '196d2d35-7e61-49c9-b3f8-1f0da23ed70f';
update menu_items set name_ms = 'Fasolia Kambing',          description_ms = 'Kacang putih dimasak dengan sos tomato dan daging kambing, dihidang dengan nasi putih'                     where id = '3186c6db-e702-4975-97ac-b2a926e1a249';
update menu_items set name_ms = 'Daging Kambing Berkeju',   description_ms = 'Daging kambing cincang dengan keju mozarella'                                                             where id = 'a9804f79-a16c-4c24-8a94-2740a661e5b3';
update menu_items set name_ms = 'Yabrak Kambing',           description_ms = 'Daun anggur disumbat dengan daging, bawang putih dan lemon, dimasak'                                       where id = 'b30f232b-381c-4c54-8e4a-2decdd5c7fc2';
update menu_items set name_ms = 'Lahmacun Turki',           description_ms = 'Daging kambing cincang digaul dengan rempah istimewa'                                                     where id = '035a212a-253e-4a3b-9586-870a12c85e35';
update menu_items set name_ms = 'Nasi Sahaja',              description_ms = 'Nasi sahaja tanpa ayam atau daging kambing'                                                               where id = '03085b35-c175-4464-9bef-8433bd4bd54b';
update menu_items set name_ms = 'Kofta Tahini',             description_ms = 'Daging kambing cincang dibakar, tahini'                                                                   where id = '6809faf4-6d9a-45f0-a5f3-e72c3ba6babc';
update menu_items set name_ms = 'Kebab Kambing',            description_ms = 'Cucuk daging kambing perap panggang, dihidang dengan sos tahini, kentang goreng dan sos bawang putih'      where id = '6368717e-9f93-4dc6-ad64-7b4cbf9cd17a';
update menu_items set name_ms = 'Kebab Ayam',               description_ms = 'Cucuk daging ayam perap panggang, dihidang dengan sos bawang putih dan kentang goreng'                     where id = '2b7c5b6e-c297-4099-84e4-bdfa8aa169ef';
update menu_items set name_ms = 'Rahsia Cinta',             description_ms = 'Mangga, kiwi, susu, aiskrim'                                                                              where id = '6fdcc492-b18d-4950-9f1c-5bbd38c8b0a6';
update menu_items set name_ms = 'Kofta Kentang',            description_ms = 'Kentang segar dan daging kambing dibakar dalam ketuhar dengan tomato, cili dan hirisan bawang'            where id = '01f84dd8-62f6-4473-a420-ccc22c3d4be6';
update menu_items set name_ms = 'Udang Panggang',           description_ms = 'Udang perap dipanggang, dihidang dengan kentang goreng, pasli dan bawang'                                 where id = 'd1275013-b207-42ee-b8d2-df848f7232b1';
update menu_items set name_ms = 'Mango Passion'                     where id = 'a9f45983-b1be-435d-b002-dc54f31a8451';
update menu_items set name_ms = 'Biryani Ayam',             description_ms = 'Ayam berperisa dengan nasi biryani, dihidang dengan sos biryani'                                          where id = '7aa1381d-c899-45a2-b413-7b15e72dbe8a';
update menu_items set name_ms = 'Milo Panas'                        where id = '43b9a20f-93ee-416e-9c98-86a3e8a48a36';
update menu_items set name_ms = 'Biskut'                            where id = 'c84ebdb3-7b5c-4800-adbb-f7d079c49858';
update menu_items set name_ms = 'Maqlubah Ayam',            description_ms = 'Nasi masakan rumah dengan rempah istimewa, terung, kentang dan ayam'                                       where id = 'ace6f4c0-0ac4-4ce5-9da4-3ffcb11a1fd3';
update menu_items set name_ms = 'Kibbeh Labaniyah',         description_ms = 'Kibbeh goreng dimasak dengan yogurt, bawang putih dan pudina, dihidang dengan nasi putih'                  where id = '1894560b-1a46-4561-a920-b7a733f3aa4c';
update menu_items set name_ms = 'Salonah Kambing',          description_ms = 'Daging kambing dimasak dengan rempah istimewa, dihidang dalam periuk tanah liat bersama roti'             where id = 'a41d2266-0442-489c-bb75-6d4ec012bc78';
update menu_items set name_ms = 'Freekeh Ayam',             description_ms = 'Gandum bakar Syria dengan kacang pea hijau dan lada benggala, dihidang dengan ayam'                        where id = '5b8a2162-709d-48f3-b8c1-19cff2d5c23a';
update menu_items set name_ms = 'Hummus Kambing',           description_ms = 'Kacang kuda dilenyek dengan daging kambing cincang, sos tahini, jus lemon dan minyak zaitun'              where id = '646a371a-1ed8-4b36-936e-91c27087713a';
update menu_items set name_ms = 'Udang Goreng',             description_ms = 'Udang goreng dihidang dengan kentang goreng dan sayur hijau'                                              where id = 'cac16e69-e678-4f41-8306-519cb16cb2ab';
update menu_items set name_ms = 'Shawarma Arab',            description_ms = 'Sandwic shawarma ayam dipotong hiris, dihidang dengan kentang goreng, sayur dan sos bawang putih'         where id = 'a12845b8-fa40-484c-97d7-f700f266b664';
update menu_items set name_ms = 'Pinggan Shawarma',         description_ms = 'Hirisan shawarma ayam dihidang dengan kentang goreng, sayur dan sos bawang putih'                         where id = 'a18ce3bc-c01c-4359-91f0-e91b2fab7577';
update menu_items set name_ms = '(Makan Tengah Hari) Kebab Kambing dengan Nasi', description_ms = 'Kebab kambing dengan nasi + teh lemon ais percuma'                                       where id = 'c1d20e8b-cc78-4017-878f-62c99052b1a2';
update menu_items set name_ms = 'Dragonov',                 description_ms = 'Buah naga, anggur, strawberi'                                                                             where id = 'd1df601d-8e2a-4938-b3c3-93373bb6e714';
update menu_items set name_ms = 'Kibbeh Panggang',          description_ms = 'Daging kambing cincang dengan gandum putih, bawang dan delima, dihidang panggang'                         where id = 'd1b6f200-19d0-45c7-a9db-c355f106ab08';
update menu_items set name_ms = 'Pasta Sayur',              description_ms = 'Pasta spageti, cendawan, sos tomato, campuran lada, bawang dan herba'                                     where id = '61dfc8bf-6f62-416d-b6cf-251161ff7896';
update menu_items set name_ms = 'Tuna Berkeju',             description_ms = 'Keju mozarella cair dengan tuna'                                                                          where id = '8bbf4c23-8116-49a9-9b59-05fd9c42d2e1';
update menu_items set name_ms = 'Keju Mozzarella',          description_ms = 'Keju mozarella cair'                                                                                      where id = 'b5049b47-f7f7-4a15-b1d5-3cdb20576284';
update menu_items set name_ms = 'Labneh & Zaatar',          description_ms = 'Labneh dengan zaatar hijau'                                                                               where id = '9e5920c1-51a1-4775-a74b-48aa1346862f';
update menu_items set name_ms = 'Kentang Goreng'                    where id = '186c32d3-5bb4-4e73-b423-da652482fcaf';
update menu_items set name_ms = 'Shawarma Pane',            description_ms = 'Sandwic shawarma ayam rangup dan berkeju, dihidang dengan sos bawang putih dan sayur'                     where id = 'fa770984-4202-40b4-b0f9-b3ff35908db2';
update menu_items set name_ms = 'Brownie Istimewa Orchid'           where id = '5256f26c-afb5-4445-9369-67876142704c';
update menu_items set name_ms = 'Panggangan 1 Meter',       description_ms = 'Kebab ayam, kebab kambing, ketulan daging lembu, shish tawook, kepak ayam panggang, arayes Orchid'         where id = '6b6776b2-3dc4-4509-982e-fc780db86989';
update menu_items set name_ms = 'Krim Karamel'                      where id = '30862a5b-7e06-43a5-9954-4800c90c0a26';
update menu_items set name_ms = 'Kebab Kash-Kash',          description_ms = 'Ketulan cucuk daging kambing cincang panggang, dihidang atas lapisan sos tomato pedas'                    where id = '8fa1c009-ee7c-4541-9371-ea233bb7a20e';
update menu_items set name_ms = 'Kabsah Kambing',           description_ms = 'Daging kambing perap dimasak dengan campuran nasi dan sayur'                                              where id = '57b0cd59-189f-435b-be6e-6c8b32087bb6';
update menu_items set name_ms = 'Milkshake Vanila'                  where id = '73d3d3dc-c70c-4d87-863f-99ac3b85bcd4';
update menu_items set name_ms = 'Orchid Istimewa',          description_ms = 'Ayam mandi, keju majouka, aneka panggangan, kebab terung, ayam panggang, maqlubah kambing, kepak ayam'     where id = '4ac351ea-ef42-4ef1-8406-b1ac6d52b36e';
update menu_items set name_ms = 'Salad Bit',                description_ms = 'Bit, keju, bawang, bawang putih, pasli segar, diperisa dengan jus lemon dan minyak zaitun'                where id = '17a36d1f-6fbd-498a-a11f-3074d5d3af32';
update menu_items set name_ms = 'Mocktail Arayes',          description_ms = 'Mangga, betik, Vimto dan kacang'                                                                          where id = '325d4d3d-c405-4da6-8605-0a464a7215d6';
update menu_items set name_ms = 'Sup Lentil',               description_ms = 'Lentil merah dengan bawang, lobak merah dan kentang, dengan perahan lemon segar dan rempah pilihan kami'   where id = '3135a3d5-fdc6-4fc8-8b62-356a120a9c91';
update menu_items set name_ms = 'Kibbeh Ketuhar',           description_ms = 'Daging kambing cincang dengan gandum putih, bawang dan campuran kacang, dari ketuhar'                      where id = 'd3caf25c-4a7d-4ae2-8599-b5ea8b76ace5';
update menu_items set name_ms = 'Arayes Ayam',              description_ms = 'Ayam cincang dibakar dalam roti Lubnan, dihidang dengan sos bawang putih'                                 where id = 'c7238758-4db5-416e-bbf7-c76b3fa45cd1';
update menu_items set name_ms = 'Freekeh Kambing',          description_ms = 'Gandum bakar Syria dengan kacang pea hijau dan lada benggala, dihidang dengan daging kambing'             where id = 'c8b1f78c-6d6c-47d5-8545-bc96c67c79c1';

notify pgrst, 'reload schema';
