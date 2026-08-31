import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// ✅ عميل service-role — صفحة المنيو عامة. تسجيل العميل وربط الطلب يمرّان من هنا بحيث
// تُضبط نقاط الولاء في السيرفر ولا يتحكم بها المتصفح.
const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const WELCOME_POINTS = 50

function cleanPhone(v: unknown): string {
  return String(v || '').trim()
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const action: string = body?.action

    // ─────────────────────────────────────────────────────────────
    // action: 'join' — شاشة الترحيب: بحث بالجوال فقط، أو تسجيل جديد بـ50 نقطة
    // ─────────────────────────────────────────────────────────────
    if (action === 'join') {
      const phone = cleanPhone(body?.phone)
      const name = String(body?.name || '').trim() || 'Guest'
      if (phone.length < 8) return NextResponse.json({ error: 'رقم جوال غير صالح' }, { status: 400 })

      const { data: existing, error: findErr } = await sb
        .from('customers').select('id, name, loyalty_points').eq('phone', phone).maybeSingle()
      if (findErr) return NextResponse.json({ error: findErr.message }, { status: 500 })

      if (existing) {
        return NextResponse.json({
          customerId: existing.id,
          name: existing.name,
          points: existing.loyalty_points || 0,
          isNew: false,
        })
      }

      const { data: created, error: insErr } = await sb
        .from('customers')
        .insert([{ name, phone, loyalty_points: WELCOME_POINTS, notes: '🌸 Joined via Menu Welcome Screen' }])
        .select('id, name, loyalty_points')
        .single()
      if (insErr || !created) return NextResponse.json({ error: insErr?.message || 'فشل التسجيل' }, { status: 500 })

      return NextResponse.json({
        customerId: created.id,
        name: created.name,
        points: created.loyalty_points || WELCOME_POINTS,
        isNew: true,
      })
    }

    // ─────────────────────────────────────────────────────────────
    // action: 'game' — لعبة "مين يدفع": عميل بلا نقاط + ربط اختياري بطلب
    // ─────────────────────────────────────────────────────────────
    if (action === 'game') {
      const phone = cleanPhone(body?.phone)
      const firstName = String(body?.firstName || '').trim()
      const orderId: string | null = body?.orderId || null
      if (phone.length < 8 || !firstName) return NextResponse.json({ error: 'بيانات ناقصة' }, { status: 400 })

      const { data: existing } = await sb
        .from('customers').select('id').eq('phone', phone).maybeSingle()
      let customerId = existing?.id
      if (!customerId) {
        const { data: created, error: insErr } = await sb
          .from('customers')
          .insert([{ name: firstName, phone, loyalty_points: 0, notes: '🎲 Added via "Who\'s Paying the Bill?" game' }])
          .select('id')
          .single()
        if (insErr || !created) return NextResponse.json({ error: insErr?.message || 'فشل التسجيل' }, { status: 500 })
        customerId = created.id
      }

      if (customerId && orderId) {
        await sb.from('orders').update({ customer_id: customerId }).eq('id', orderId)
      }

      return NextResponse.json({ customerId: customerId || null })
    }

    return NextResponse.json({ error: 'action غير معروف' }, { status: 400 })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'خطأ في الخادم' }, { status: 500 })
  }
}
