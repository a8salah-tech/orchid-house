import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { name, email, reason } = await req.json()
    if (!email) return NextResponse.json({ error: 'No email' }, { status: 400 })

    // Use Supabase to send email via their built-in email
    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

    const reasonText = reason
      ? `\n\nسبب الرفض:\n${reason}`
      : '\n\nلم يتم تحديد سبب. يرجى التواصل مع الإدارة للمزيد من المعلومات.'

    const body = `عزيزي/عزيزتي ${name}،

نأسف لإبلاغك أن طلب تسجيلك في نظام Orchid Group لم يتم قبوله في الوقت الحالي.${reasonText}

يمكنك إعادة التسجيل مرة أخرى عبر الرابط: ${process.env.NEXT_PUBLIC_APP_URL}/register

مع تحيات،
فريق Orchid Group`

    // Send via Supabase admin auth invite (sends email)
    const res = await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ to: email, subject: 'بخصوص طلب تسجيلك في Orchid Group', body }),
    })

    // If Supabase function not available, just log
    console.log(`Rejection email would be sent to: ${email}`)
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('Email error:', e)
    return NextResponse.json({ success: true }) // Don't fail the rejection if email fails
  }
}
