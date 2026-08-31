import { NextRequest, NextResponse } from 'next/server'
import { getCaller, callerHasPermission } from '../../../lib/apiAuth'

// ✅ ترميز HTML — يمنع حقن وسوم/سكربتات عبر الاسم أو السبب داخل قالب الرسالة
function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export async function POST(req: NextRequest) {
  try {
    // ✅ حماية: مُرحِّل البريد كان مفتوحاً للعالم من نطاق noreply@bidlx.com.
    // الآن يتطلب موظفاً نشِطاً مسجَّلاً لديه صلاحية الموارد البشرية.
    const emp = await getCaller()
    if (!emp) return NextResponse.json({ error: 'غير مصرح — سجّل الدخول' }, { status: 401 })
    if (!(await callerHasPermission(emp, 'hr'))) {
      return NextResponse.json({ error: 'ليس لديك صلاحية الموارد البشرية' }, { status: 403 })
    }

    const { name, email, reason } = await req.json()
    if (!email) return NextResponse.json({ error: 'No email' }, { status: 400 })

    const key = process.env.RESEND_API_KEY
    if (!key) {
      console.error('RESEND_API_KEY is missing!')
      return NextResponse.json({ error: 'RESEND_API_KEY not set' }, { status: 500 })
    }

    const safeName = escapeHtml(name || 'Applicant')
    const safeReason = reason ? escapeHtml(reason) : ''

    const registerUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://orchid.bidlx.com'}/register`
    const reasonText = safeReason
      ? `<p style="color:#EF4444;"><strong>Reason:</strong><br/>${safeReason}</p>`
      : '<p style="color:#8A9BB5;">No specific reason was provided. Please contact management.</p>'

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'noreply@bidlx.com',
        to: email,
        subject: 'Regarding Your Registration Request – Orchid Group',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 580px; margin: 0 auto; background: #f5f5f5; padding: 20px;">
            <div style="background: #0A1628; border-radius: 12px; padding: 32px; color: white;">
              <div style="text-align: center; margin-bottom: 24px;">
                <h2 style="color: #C9A84C; margin: 0; font-size: 22px;">🌸 Orchid Group</h2>
              </div>
              <h3 style="color: #FAFAF8; margin-bottom: 16px;">Dear ${safeName},</h3>
              <p style="color: #8A9BB5; line-height: 1.8; margin-bottom: 20px;">
                Thank you for your interest in joining <strong style="color: #C9A84C;">Orchid Group</strong>. We regret to inform you that your registration request has not been approved at this time.
              </p>
              <div style="background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.3); border-radius: 10px; padding: 16px; margin-bottom: 24px;">
                ${reasonText}
              </div>
              <p style="color: #8A9BB5; line-height: 1.8; margin-bottom: 20px;">
                You are welcome to re-apply after addressing the above. Please use the link below:
              </p>
              <div style="text-align: center; margin-bottom: 24px;">
                <a href="${registerUrl}" style="display: inline-block; background: linear-gradient(135deg, #C9A84C, #E8C97A); color: #0A1628; padding: 14px 32px; border-radius: 10px; text-decoration: none; font-weight: bold; font-size: 15px;">
                  Apply Again
                </a>
              </div>
              <hr style="border: none; border-top: 1px solid rgba(255,255,255,0.08); margin: 24px 0;"/>
              <p style="color: #8A9BB5; font-size: 12px; text-align: center; margin: 0;">
                Best regards, Orchid Group Team 🌸
              </p>
            </div>
          </div>
        `,
      }),
    })

    const data = await res.json()

    if (!res.ok) {
      return NextResponse.json({ error: data.message || data.name || 'Resend error', details: data }, { status: 500 })
    }

    return NextResponse.json({ success: true, id: data.id })
  } catch (e: any) {
    console.error('Email route error:', e)
    return NextResponse.json({ error: e.message || 'Unknown error' }, { status: 500 })
  }
}
