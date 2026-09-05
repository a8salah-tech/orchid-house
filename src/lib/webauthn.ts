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
    // ✅ نفس الاستثناء (NotAllowedError) بيطلع في حالتين مختلفتين: (أ) المستخدم لغى/الوقت خلص، أو
    // (ب) الجهاز فقد بصمة الويب المحفوظة فعليًا (تسجيل خروج من حساب جوجل، مسح بيانات التطبيق...) وظهرله
    // "No passkeys available" من المتصفح نفسه. مفيش طريقة نفرّق بينهم برمجيًا، فبنوضّح الاحتمالين مع بعض
    if (e?.name === 'NotAllowedError') throw new Error('فشل التحقّق بالبصمة — يمكن تكون ألغيتها أو انتهت المهلة، أو أن الجهاز فقَد بصمة الويب المحفوظة (مثلاً بعد تسجيل خروج من حساب جوجل أو مسح بيانات المتصفح). جرّب مرة أخرى، ولو استمرت راجع الإدارة لإعادة تسجيل جهازك.\nBiometric check failed — this can happen if it was cancelled/timed out, or if the device lost its saved passkey (e.g. after signing out of a Google account or clearing browser data). Try again, and if it persists, contact management to re-register your device.')
    throw new Error('تعذّر قراءة البصمة من الجهاز\nCould not read the biometric from this device')
  }
  const r = await call('auth-verify', { response: asrResp })
  return !!r.verified
}
