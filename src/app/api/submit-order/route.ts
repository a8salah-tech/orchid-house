import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// ✅ عميل service-role — صفحة المنيو عامة (زائر مجهول). كل الكتابة على الطلبات تمرّ من هنا
// بحيث تُحسب الأسعار من قاعدة البيانات ولا يُوثَق بأي قيمة قادمة من المتصفح.
const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const ACTIVE_ORDER_STATUSES = ['confirmed', 'preparing', 'ready']

type IncomingItem = { menuItemId: string; quantity: number; sizeId?: string | null; notes?: string | null }

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const tableId: string = body?.tableId
    const rawItems: IncomingItem[] = Array.isArray(body?.items) ? body.items : []
    const customerId: string | null = body?.customerId || null

    if (!tableId) return NextResponse.json({ error: 'رقم الطاولة مفقود' }, { status: 400 })
    if (rawItems.length === 0) return NextResponse.json({ error: 'السلة فارغة' }, { status: 400 })

    // ── تحقق الطاولة ──
    const { data: tableRow, error: tableErr } = await sb
      .from('tables').select('id').eq('id', tableId).maybeSingle()
    if (tableErr) return NextResponse.json({ error: tableErr.message }, { status: 500 })
    if (!tableRow) return NextResponse.json({ error: 'طاولة غير موجودة' }, { status: 404 })

    // ── تطبيع البنود الواردة ──
    const items = rawItems.map((it) => ({
      menuItemId: String(it.menuItemId),
      quantity: Math.floor(Number(it.quantity)),
      sizeId: it.sizeId ? String(it.sizeId) : null,
      notes: it.notes ? String(it.notes).slice(0, 500) : null,
    }))
    if (items.some((it) => !it.menuItemId || !Number.isFinite(it.quantity) || it.quantity < 1)) {
      return NextResponse.json({ error: 'بنود غير صالحة' }, { status: 400 })
    }

    const menuItemIds = [...new Set(items.map((i) => i.menuItemId))]
    const sizeIds = [...new Set(items.map((i) => i.sizeId).filter(Boolean) as string[])]

    // ── جلب الأسعار الرسمية من قاعدة البيانات ──
    const { data: menuItems, error: miErr } = await sb
      .from('menu_items')
      .select('id, name, name_en, price, discount_percent, category_id, is_available, is_active')
      .in('id', menuItemIds)
    if (miErr) return NextResponse.json({ error: miErr.message }, { status: 500 })
    const miMap = new Map((menuItems || []).map((m) => [m.id, m]))

    let sizeMap = new Map<string, any>()
    if (sizeIds.length > 0) {
      const { data: sizes, error: szErr } = await sb
        .from('menu_item_sizes')
        .select('id, menu_item_id, name, name_en, price, is_active')
        .in('id', sizeIds)
      if (szErr) return NextResponse.json({ error: szErr.message }, { status: 500 })
      sizeMap = new Map((sizes || []).map((s) => [s.id, s]))
    }

    const catIds = [...new Set((menuItems || []).map((m) => m.category_id).filter(Boolean))]
    const { data: cats } = await sb
      .from('menu_categories').select('id, destination').in('id', catIds)
    const catMap = new Map((cats || []).map((c) => [c.id, c.destination]))

    // ── حساب سعر كل سطر في السيرفر ──
    let serverTotal = 0
    const itemsPayload: any[] = []
    for (const line of items) {
      const mi = miMap.get(line.menuItemId)
      if (!mi) return NextResponse.json({ error: 'صنف غير موجود في المنيو' }, { status: 400 })
      if (mi.is_available === false || mi.is_active === false) {
        return NextResponse.json({ error: `الصنف "${mi.name_en || mi.name}" غير متاح حالياً` }, { status: 409 })
      }

      let unitPrice: number
      let sizeName: string | null = null
      if (line.sizeId) {
        const sz = sizeMap.get(line.sizeId)
        // نتحقق فقط أن المقاس يخص هذا الصنف — نفس تساهل الواجهة الحالية (لا تفلتر بـ is_active)
        if (!sz || sz.menu_item_id !== mi.id) {
          return NextResponse.json({ error: 'مقاس غير صالح لهذا الصنف' }, { status: 400 })
        }
        unitPrice = Number(sz.price)
        sizeName = sz.name_en || sz.name || null
      } else if (mi.discount_percent && mi.discount_percent > 0) {
        unitPrice = Number(mi.price) * (1 - mi.discount_percent / 100)
      } else {
        unitPrice = Number(mi.price)
      }
      if (!Number.isFinite(unitPrice) || unitPrice < 0) {
        return NextResponse.json({ error: 'سعر غير صالح' }, { status: 500 })
      }

      serverTotal += unitPrice * line.quantity
      itemsPayload.push({
        menu_item_id: mi.id,
        quantity: line.quantity,
        unit_price: unitPrice,
        notes: line.notes,
        size_name: sizeName,
        destination: catMap.get(mi.category_id) || 'kitchen',
        status: 'pending',
      })
    }
    serverTotal = parseFloat(serverTotal.toFixed(2))

    // ── طلب نشِط قائم على نفس الطاولة؟ ──
    const { data: existingOrders } = await sb
      .from('orders')
      .select('id, total_amount')
      .eq('table_id', tableId)
      .in('status', ACTIVE_ORDER_STATUSES)
      .order('created_at', { ascending: false })
      .limit(1)
    const existingOrder = existingOrders?.[0] || null

    const nowIso = new Date().toISOString()
    let orderId: string

    if (existingOrder) {
      orderId = existingOrder.id
      const { error: updErr } = await sb
        .from('orders')
        .update({ total_amount: (existingOrder.total_amount || 0) + serverTotal })
        .eq('id', orderId)
      if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })
    } else {
      const { data: order, error: insErr } = await sb
        .from('orders')
        .insert([{
          table_id: tableId,
          status: 'confirmed',
          total_amount: serverTotal,
          confirmed_at: nowIso,
          customer_id: customerId,
        }])
        .select('id')
        .single()
      if (insErr || !order) return NextResponse.json({ error: insErr?.message || 'فشل إنشاء الطلب' }, { status: 500 })
      orderId = order.id
    }

    // ── تصفير أي علم إعادة توجيه على الطاولة ──
    await sb.from('tables').update({ redirected_to_table_id: null, redirected_at: null }).eq('id', tableId)

    // ── إدراج البنود مع 3 محاولات ──
    const payloadWithOrder = itemsPayload.map((p) => ({ ...p, order_id: orderId }))
    let itemsError = (await sb.from('order_items').insert(payloadWithOrder)).error
    let attemptCount = 1
    while (itemsError && attemptCount < 3) {
      await sleep(500)
      attemptCount++
      itemsError = (await sb.from('order_items').insert(payloadWithOrder)).error
    }

    if (itemsError) {
      // تسجيل الخطأ للتشخيص
      try {
        await sb.from('order_submission_errors').insert([{
          table_id: tableId,
          attempt_count: attemptCount,
          error_message: itemsError.message || null,
          error_code: (itemsError as any).code || null,
          error_details: (itemsError as any).details || null,
          items_payload: payloadWithOrder,
        }])
      } catch { /* لا تُفشل الرد بسبب فشل التسجيل */ }

      // تراجع: لا نترك طلباً بإجمالي خاطئ وبلا بنود
      if (existingOrder) {
        await sb.from('orders').update({ total_amount: existingOrder.total_amount || 0 }).eq('id', orderId)
      } else {
        await sb.from('orders').update({ status: 'cancelled' }).eq('id', orderId)
      }
      return NextResponse.json({ error: 'ORDER_ITEMS_FAILED' }, { status: 500 })
    }

    // ── حالة الطاولة ──
    if (existingOrder) {
      await sb.from('tables').update({ status: 'occupied', current_order_id: orderId }).eq('id', tableId)
    } else {
      await sb.from('tables').update({
        status: 'occupied',
        occupied_since: nowIso,
        current_order_id: orderId,
      }).eq('id', tableId)
    }

    // ── البنود المتراكمة كاملة (كل الجولات) للرد ──
    const { data: live } = await sb
      .from('order_items')
      .select('id, quantity, unit_price, size_name, status, menu_items(name, name_en)')
      .eq('order_id', orderId)
      .neq('status', 'cancelled')

    return NextResponse.json({
      orderId,
      orderNumber: orderId.slice(-6).toUpperCase(),
      items: (live || []).map((i: any) => ({
        id: i.id,
        quantity: i.quantity,
        unit_price: i.unit_price,
        size_name: i.size_name,
        name: i.menu_items?.name_en || i.menu_items?.name || '',
      })),
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'خطأ في الخادم' }, { status: 500 })
  }
}
