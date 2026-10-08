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
      // ✅ Fix per user request: العميل لم يعد يختار طاولة بعينها من صفحة الحجز (كان يلخبط العملاء) —
      // table_id لم يعد مطلوباً، الموظف يحدد الطاولة الفعلية لاحقاً من صفحة الحجوزات
      const required = ['customer_name', 'customer_email', 'customer_phone', 'booking_date', 'booking_time', 'section']
      for (const k of required) {
        if (!f[k]) return NextResponse.json({ error: `حقل مفقود: ${k}` }, { status: 400 })
      }

      // ✅ جديد: منع الحجز لو الأدمن أغلق هذا اليوم لهذا الفرع (booking_closed_days) — تحقق سيرفري
      // إجباري، بغض النظر عن أي فحص عميل، حتى لا يمكن تجاوز الإغلاق بتعديل الطلب مباشرة
      if (f.branch_id) {
        const { data: closed } = await sb
          .from('booking_closed_days')
          .select('id')
          .eq('branch_id', f.branch_id)
          .eq('closed_date', f.booking_date)
          .maybeSingle()
        if (closed) return NextResponse.json({ error: 'هذا اليوم غير متاح للحجز في هذا الفرع' }, { status: 400 })
      }

      // ✅ جديد: نفس الشيء لو القسم المطلوب مغلق في هذا اليوم لهذا الفرع (booking_closed_sections)
      if (f.branch_id) {
        const { data: closedSec } = await sb
          .from('booking_closed_sections')
          .select('id')
          .eq('branch_id', f.branch_id)
          .eq('closed_date', f.booking_date)
          .eq('section', f.section)
          .maybeSingle()
        if (closedSec) return NextResponse.json({ error: 'هذا القسم غير متاح للحجز في هذا اليوم' }, { status: 400 })
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

      // ✅ جديد: إشعار مدير الصالة ومشرف الصالة التابعَين لنفس فرع الحجز بحجز جديد — كل حجز جديد كان
      // بيروح للنظام من غير أي إشعار لأي حد. الإشعار اختياري (fail-open): لو فشل لأي سبب، الحجز يكون
      // خلص فعلاً وما نوقفوش أو نرجّع خطأ للعميل بسببه
      if (f.branch_id) {
        try {
          const { data: staff } = await sb
            .from('employees')
            .select('id')
            .eq('branch_id', f.branch_id)
            .eq('is_active', true)
            .in('role', ['hall_manager', 'hall_supervisor'])
          if (staff && staff.length > 0) {
            const title = 'حجز جديد / New Booking'
            const bodyText =
              `حجز جديد من ${f.customer_name} بتاريخ ${f.booking_date} الساعة ${f.booking_time} لعدد ${f.guests || '—'} أشخاص.\n` +
              `New booking from ${f.customer_name} on ${f.booking_date} at ${f.booking_time} for ${f.guests || '—'} guests.`
            await sb.from('notifications').insert(staff.map((s: { id: string }) => ({
              type: 'booking', title, body: bodyText,
              link: '/dashboard/bookings',
              target_employee_id: s.id, target_role: null,
            })))
          }
        } catch { /* الإشعار اختياري — لا يوقف نجاح الحجز */ }
      }

      return NextResponse.json({ id: data.id })
    }

    return NextResponse.json({ error: 'action غير معروف' }, { status: 400 })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'خطأ في الخادم' }, { status: 500 })
  }
}
