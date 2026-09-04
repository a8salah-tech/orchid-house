// ✅ بصمة اليد / بصمة الوجه لتسجيل الحضور — تغليف مراسم المتصفح (WebAuthn)
// الجهاز هو اللي يتحقق من البصمة؛ السيرفر يتحقق من التوقيع فقط، ولا يرى البصمة إطلاقاً.
import { startRegistration, startAuthentication, browserSupportsWebAuthn } from '@simplewebauthn/browser'

async function call(action: string, extra: Record<string, unknown> = {}) {
  const res = await fetch('/api/webauthn', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...extra }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.error || 'تعذّر التحقّق بالبصمة\nBiometric verification failed')
  return data
}

export function biometricSupported(): boolean {
  try { return browserSupportsWebAuthn() } catch { return false }
}

// تسجيل الجهاز الحالي (مرة واحدة) — يفتح Face ID / بصمة اليد لإنشاء المفتاح
export async function registerBiometric(deviceLabel: string): Promise<void> {
  const options = await call('register-options')
  let attResp
  try {
    attResp = await startRegistration({ optionsJSON: options })
  } catch (e: any) {
    if (e?.name === 'InvalidStateError') throw new Error('هذا الجهاز مسجَّل بالفعل\nThis device is already registered')
    if (e?.name === 'NotAllowedError') throw new Error('أُلغيت العملية أو انتهت مهلة الوقت\nThe operation was cancelled or timed out')
    throw new Error('تعذّر قراءة البصمة من الجهاز\nCould not read the biometric from this device')
  }
  await call('register-verify', { response: attResp, deviceLabel })
}

// التحقق بالبصمة (وقت تسجيل الحضور/الانصراف) — يرجع true فقط لو نجح
export async function verifyBiometric(): Promise<boolean> {
  const options = await call('auth-options')
  let asrResp
  try {
    asrResp = await startAuthentication({ optionsJSON: options })
  } catch (e: any) {
    if (e?.name === 'NotAllowedError') throw new Error('أُلغِي التحقّق بالبصمة أو انتهت مهلة الوقت\nBiometric verification was cancelled or timed out')
    throw new Error('تعذّر قراءة البصمة من الجهاز\nCould not read the biometric from this device')
  }
  const r = await call('auth-verify', { response: asrResp })
  return !!r.verified
}
