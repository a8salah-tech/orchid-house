import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// ✅ عميل service-role — صفحة /bookings عامة. جدول bookings فيه بيانات شخصية (اسم/إيميل/جوال)
// لكل حجز، فلا يجب أن يقرأه الزائر المجهول. كل تعامل مع الحجوزات يمرّ من هنا.
const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const action: string = body?.action

    // ── توفّر الطاولات ليوم/قسم معيّن — يرجّع معرّفات الطاولات المحجوزة فقط (بلا أي بيانات شخصية) ──
    if (action === 'availability') {
      const bookingDate: string = body?.bookingDate
      const section: string = body?.section
      if (!bookingDate || !section) return NextResponse.json({ error: 'بيانات ناقصة' }, { status: 400 })

      const { data, error } = await sb
        .from('bookings')
        .select('table_id')
        .eq('booking_date', bookingDate)
        .eq('section', section)
        .in('status', ['pending', 'confirmed'])
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })

      return NextResponse.json({ reservedTableIds: (data || []).map((b: any) => b.table_id) })
    }

    // ── إنشاء حجز ──
    if (action === 'submit') {
      const f = body?.booking || {}
      const required = ['customer_name', 'customer_email', 'customer_phone', 'booking_date', 'booking_time', 'section', 'table_id']
      for (const k of required) {
        if (!f[k]) return NextResponse.json({ error: `حقل مفقود: ${k}` }, { status: 400 })
      }

      const { data, error } = await sb
        .from('bookings')
        .insert([{
          customer_name: String(f.customer_name).slice(0, 200),
          customer_email: String(f.customer_email).slice(0, 200),
          customer_phone: String(f.customer_phone).slice(0, 50),
          booking_date: f.booking_date,
          booking_time: f.booking_time,
          guests: Math.max(1, Math.min(100, parseInt(f.guests) || 2)),
          branch_id: f.branch_id || null,
          section: f.section,
          table_id: f.table_id,
          table_number: f.table_number ?? null,
          notes: f.notes ? String(f.notes).slice(0, 1000) : null,
          status: 'pending',
        }])
        .select('id')
        .single()
      if (error || !data) return NextResponse.json({ error: error?.message || 'فشل الحجز' }, { status: 500 })

      return NextResponse.json({ id: data.id })
    }

    return NextResponse.json({ error: 'action غير معروف' }, { status: 400 })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'خطأ في الخادم' }, { status: 500 })
  }
}
