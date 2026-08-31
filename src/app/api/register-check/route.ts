import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// ✅ عميل service-role — صفحة /register عامة. بعد إغلاق صلاحيات الزائر المجهول لن يقدر
// المتصفح يقرأ employees / employee_registrations للتحقق من التكرار، فينتقل الفحص هنا.
const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function POST(req: NextRequest) {
  try {
    const { emailAccount } = await req.json()
    const email = String(emailAccount || '').trim()
    if (!email) return NextResponse.json({ error: 'بيانات ناقصة' }, { status: 400 })

    // نفس منطق الفحص الأصلي في صفحة التسجيل، لكن بمفتاح service-role
    const { data: reg } = await sb
      .from('employee_registrations')
      .select('id')
      .eq('email_account', email)
      .in('status', ['pending', 'approved'])
      .maybeSingle()
    if (reg) return NextResponse.json({ duplicate: true, where: 'registration' })

    const { data: emp } = await sb
      .from('employees')
      .select('id')
      .eq('email_account', email)
      .maybeSingle()
    if (emp) return NextResponse.json({ duplicate: true, where: 'employee' })

    return NextResponse.json({ duplicate: false })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'خطأ في الخادم' }, { status: 500 })
  }
}
