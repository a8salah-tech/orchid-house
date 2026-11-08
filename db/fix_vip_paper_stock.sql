-- ══════════════════════════════════════════════════════════════════════════════
--  تصحيح مخزون «ورق صالة vip» (OR1360) في المستودع الرئيسي: 5,000,000 كرتون ← 20 كرتونًا
-- ══════════════════════════════════════════════════════════════════════════════
--  السبب: فاتورة شراء بتاريخ 2026-11-06 فيها 10,000 «قطعة» بسعر 0.38 للقطعة، ووحدة مخزون الصنف «كرتون».
--  عند تحديد معامل التحويل من نموذج الفاتورة كُتب 500 في صيغة «1 قطعة = 500 كرتون» (معكوسة)،
--  فضُربت الكمية: 10,000 × 500 = 5,000,000 بدل 10,000 ÷ 500 = 20 كرتونًا.
--  (المعامل الصحيح «1 كرتون = 500 قطعة» أُضيف لاحقًا لكن الكمية المخزّنة لم تُصحَّح.)
--
--  ما يفعله هذا الملف (لهذا الصنف فقط، ومرة واحدة):
--    • حركة الإدخال: الكمية 5,000,000 → 20، وسعر الوحدة 0.38 → 190 (سعر الكرتون = 0.38 × 500)
--    • مخزون الصنف current_stock → 20، وآخر سعر شراء → 190
--    • الفاتورة نفسها وبنودها لا تُمسّ (10,000 قطعة × 0.38 = 3,800 كما هي)
--  التشغيل: انسخ الملف كله في Supabase SQL Editor → Run. معاملة واحدة؛ يتوقف بخطأ إن تغيّر الوضع
--  (مثلًا لو صُحّحت الكمية يدويًا أو سُجّلت حركات أخرى على الصنف) فلا يكتب فوق شيء غير متوقع.
-- ══════════════════════════════════════════════════════════════════════════════

begin;

do $$
declare
  v_product  constant uuid := '6bc500b5-e006-4c99-b8eb-317bbadc3333';
  v_movement constant uuid := '1450ee80-5aa1-4a3d-a833-9b6e751ff569';
  v_qty      numeric;
  v_moves    int;
begin
  select quantity into v_qty from public.stock_movements where id = v_movement and product_id = v_product;
  if v_qty is null then raise exception 'FAIL: حركة المخزون المتوقعة غير موجودة'; end if;

  select count(*) into v_moves from public.stock_movements where product_id = v_product;
  if v_moves <> 1 then raise exception 'FAIL: على الصنف % حركات (المتوقع حركة واحدة) — راجع قبل التصحيح', v_moves; end if;

  if v_qty = 20 then
    raise notice 'الحركة مصحّحة سابقًا (الكمية 20) — لا تغيير في الحركة';
  elsif v_qty = 5000000 then
    update public.stock_movements set quantity = 20, unit_price = 190 where id = v_movement;
  else
    raise exception 'FAIL: كمية الحركة % غير متوقعة', v_qty;
  end if;

  -- المخزون = مجموع الحركات (حركة واحدة = 20) — نثبّته صراحةً سواء عدّله المشغّل (trigger) تلقائيًا أم لا
  update public.warehouse_products set current_stock = 20, last_purchase_price = 190 where id = v_product;
end $$;

-- ── بوابة التحقق ──
do $$
declare s numeric; p numeric; m numeric;
begin
  select current_stock, last_purchase_price into s, p from public.warehouse_products where id = '6bc500b5-e006-4c99-b8eb-317bbadc3333';
  select quantity into m from public.stock_movements where id = '1450ee80-5aa1-4a3d-a833-9b6e751ff569';
  if s <> 20 or p <> 190 or m <> 20 then raise exception 'FAIL: المخزون % / السعر % / الحركة %', s, p, m; end if;
end $$;

commit;
