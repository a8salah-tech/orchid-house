import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// ✅ سيرفر بس (مش من المتصفح) عشان نقدر نقرا هيدر الـ IP الحقيقي اللي Vercel بيحطه تلقائي
// ✅ يستخدم مفتاح service-role — يبقى المسار يشتغل حتى بعد إغلاق صلاحيات الزائر المجهول (anon)
// على جدول order_client_meta. المسار يُستدعى من صفحة المنيو العامة ويكتب صفاً واحداً غير حساس
// (جهاز/متصفح/IP) مرتبطاً بـ order_id موجود فقط.
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function POST(request: NextRequest) {
  try {
    const { order_id, user_agent, device_model } = await request.json()
    if (!order_id) {
      return NextResponse.json({ error: 'order_id is required' }, { status: 400 })
    }

    // ✅ Vercel بيحط الـ IP الحقيقي بتاع الزائر في الهيدر ده
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      'unknown'

    const { error } = await supabase.from('order_client_meta').insert([{
      order_id,
      ip_address: ip,
      user_agent: user_agent || request.headers.get('user-agent') || null,
      device_model: device_model || null,
    }])

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unknown error' }, { status: 500 })
  }
}
