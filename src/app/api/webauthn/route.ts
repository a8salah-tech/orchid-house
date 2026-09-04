import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  generateRegistrationOptions, verifyRegistrationResponse,
  generateAuthenticationOptions, verifyAuthenticationResponse,
} from '@simplewebauthn/server'
import { getCaller } from '../../../lib/apiAuth'

export const runtime = 'nodejs'

// ✅ الدومين الرسمي اللي الموظفون يفتحون منه النظام — البصمة مربوطة به. للتطوير المحلي:
// WEBAUTHN_RP_ID=localhost  WEBAUTHN_ORIGIN=http://localhost:3000
const RP_NAME = 'Orchid Group'
const RP_ID   = process.env.WEBAUTHN_RP_ID || 'orchid.bidlx.com'
const ORIGIN  = process.env.WEBAUTHN_ORIGIN || `https://${RP_ID}`

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const b64FromU8 = (u: Uint8Array) => Buffer.from(u).toString('base64')
const u8FromB64 = (s: string) => new Uint8Array(Buffer.from(s, 'base64'))
const in5min = () => new Date(Date.now() + 5 * 60 * 1000).toISOString()

export async function POST(req: NextRequest) {
  let action = ''
  try {
    const caller = await getCaller()
    if (!caller) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })

    const body = await req.json()
    action = body.action || ''

    // ── تسجيل جهاز جديد: توليد الخيارات ──
    if (action === 'register-options') {
      const { data: existing } = await admin.from('webauthn_credentials')
        .select('credential_id, transports').eq('employee_id', caller.id)
      // ✅ جهاز واحد فقط لكل موظف — لتغيير الجهاز يحذف الأدمن القديم أولاً (إعادة تعيين)
      if (existing && existing.length > 0) {
        return NextResponse.json({ error: 'لديك جهاز بصمة مسجَّل بالفعل. لتغيير الجهاز راجع الإدارة لإعادة التعيين.' }, { status: 409 })
      }
      const options = await generateRegistrationOptions({
        rpName: RP_NAME,
        rpID: RP_ID,
        userName: caller.id,
        userID: new TextEncoder().encode(caller.id),
        attestationType: 'none',
        excludeCredentials: (existing || []).map(c => ({
          id: c.credential_id, transports: (c.transports as any) || undefined,
        })),
        authenticatorSelection: { residentKey: 'preferred', userVerification: 'required' },
      })
      const { error: chErr } = await admin.from('webauthn_challenges').upsert({
        employee_id: caller.id, challenge: options.challenge, kind: 'register', expires_at: in5min(),
      })
      if (chErr) return NextResponse.json({ error: 'تعذّر حفظ الطلب: ' + chErr.message }, { status: 500 })
      return NextResponse.json(options)
    }

    // ── تسجيل جهاز جديد: التحقق والحفظ ──
    if (action === 'register-verify') {
      const { data: ch, error: chSelErr } = await admin.from('webauthn_challenges')
        .select('*').eq('employee_id', caller.id).eq('kind', 'register').maybeSingle()
      if (chSelErr) return NextResponse.json({ error: 'تعذّر قراءة الطلب: ' + chSelErr.message }, { status: 500 })
      if (!ch) return NextResponse.json({ error: 'لم يُعثر على طلب تسجيل — ابدأ من جديد' }, { status: 400 })
      if (new Date(ch.expires_at) < new Date()) {
        return NextResponse.json({ error: 'انتهت صلاحية الطلب — حاول مرة أخرى' }, { status: 400 })
      }
      const verification = await verifyRegistrationResponse({
        response: body.response,
        expectedChallenge: ch.challenge,
        expectedOrigin: ORIGIN,
        expectedRPID: RP_ID,
        requireUserVerification: true,
      })
      if (!verification.verified || !verification.registrationInfo) {
        return NextResponse.json({ error: 'فشل التحقق من البصمة' }, { status: 400 })
      }
      // ✅ جهاز واحد فقط لكل موظف (فحص ثانٍ ضد أي سباق طلبات)
      const { count: existingCount } = await admin.from('webauthn_credentials')
        .select('id', { count: 'exact', head: true }).eq('employee_id', caller.id)
      if ((existingCount || 0) > 0) {
        await admin.from('webauthn_challenges').delete().eq('employee_id', caller.id)
        return NextResponse.json({ error: 'لديك جهاز بصمة مسجَّل بالفعل. لتغيير الجهاز راجع الإدارة.' }, { status: 409 })
      }
      const cred = verification.registrationInfo.credential
      const { error: insErr } = await admin.from('webauthn_credentials').insert({
        employee_id: caller.id,
        credential_id: cred.id,
        public_key: b64FromU8(cred.publicKey),
        counter: cred.counter,
        transports: (cred.transports as any) || null,
        device_label: (body.deviceLabel || '').toString().slice(0, 60) || null,
      })
      await admin.from('webauthn_challenges').delete().eq('employee_id', caller.id)
      if (insErr) {
        if (insErr.code === '23505') return NextResponse.json({ error: 'هذا الجهاز مسجَّل بالفعل' }, { status: 409 })
        return NextResponse.json({ error: insErr.message }, { status: 500 })
      }
      return NextResponse.json({ verified: true })
    }

    // ── التحقق بالبصمة (وقت تسجيل الحضور): توليد الخيارات ──
    if (action === 'auth-options') {
      const { data: creds } = await admin.from('webauthn_credentials')
        .select('credential_id, transports').eq('employee_id', caller.id)
      if (!creds || creds.length === 0) {
        return NextResponse.json({ error: 'لا توجد بصمة مسجّلة لهذا الحساب' }, { status: 404 })
      }
      const options = await generateAuthenticationOptions({
        rpID: RP_ID,
        allowCredentials: creds.map(c => ({
          id: c.credential_id, transports: (c.transports as any) || undefined,
        })),
        userVerification: 'required',
      })
      const { error: chErr } = await admin.from('webauthn_challenges').upsert({
        employee_id: caller.id, challenge: options.challenge, kind: 'auth', expires_at: in5min(),
      })
      if (chErr) return NextResponse.json({ error: 'تعذّر حفظ الطلب: ' + chErr.message }, { status: 500 })
      return NextResponse.json(options)
    }

    // ── التحقق بالبصمة: التحقق ──
    if (action === 'auth-verify') {
      const { data: ch, error: chSelErr } = await admin.from('webauthn_challenges')
        .select('*').eq('employee_id', caller.id).eq('kind', 'auth').maybeSingle()
      if (chSelErr) return NextResponse.json({ error: 'تعذّر قراءة الطلب: ' + chSelErr.message }, { status: 500 })
      if (!ch || new Date(ch.expires_at) < new Date()) {
        return NextResponse.json({ error: 'انتهت صلاحية الطلب — حاول مرة أخرى' }, { status: 400 })
      }
      const credId = body.response?.id
      const { data: cred } = await admin.from('webauthn_credentials')
        .select('*').eq('employee_id', caller.id).eq('credential_id', credId).maybeSingle()
      if (!cred) return NextResponse.json({ error: 'بصمة غير معروفة' }, { status: 400 })
      const verification = await verifyAuthenticationResponse({
        response: body.response,
        expectedChallenge: ch.challenge,
        expectedOrigin: ORIGIN,
        expectedRPID: RP_ID,
        requireUserVerification: true,
        credential: {
          id: cred.credential_id,
          publicKey: u8FromB64(cred.public_key),
          counter: Number(cred.counter),
          transports: (cred.transports as any) || undefined,
        },
      })
      await admin.from('webauthn_challenges').delete().eq('employee_id', caller.id)
      if (!verification.verified) return NextResponse.json({ error: 'فشل التحقق من البصمة' }, { status: 400 })
      await admin.from('webauthn_credentials').update({
        counter: verification.authenticationInfo.newCounter,
        last_used_at: new Date().toISOString(),
      }).eq('id', cred.id)
      return NextResponse.json({ verified: true })
    }

    return NextResponse.json({ error: 'إجراء غير معروف' }, { status: 400 })
  } catch (e: any) {
    console.error('webauthn error:', action, e?.message)
    return NextResponse.json({ error: e?.message || 'خطأ في الخادم' }, { status: 500 })
  }
}
