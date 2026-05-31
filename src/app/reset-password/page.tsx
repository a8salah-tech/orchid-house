'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'

const createClient = () => createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const S = {
  navy: '#0A1628', navy2: '#0F2040',
  gold: '#C9A84C', gold2: '#E8C97A', gold3: 'rgba(201,168,76,0.12)',
  white: '#FAFAF8', muted: '#8A9BB5', border: 'rgba(255,255,255,0.08)',
  red: '#EF4444', redB: 'rgba(239,68,68,0.12)',
  green: '#22C55E', greenB: 'rgba(34,197,94,0.12)',
}

export default function ResetPasswordPage() {
  const router = useRouter()
  const supabase = createClient()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [showPass, setShowPass] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    // Supabase يضيف access_token في الـ hash بعد الضغط على الرابط
    const hash = window.location.hash
    if (hash && hash.includes('access_token')) {
      setReady(true)
    } else {
      // تحقق من الـ session الحالية
      supabase.auth.getSession().then(({ data }) => {
        if (data.session) setReady(true)
        else router.push('/login')
      })
    }
  }, [])

  async function handleReset() {
    if (!password) { setError('يرجى إدخال كلمة المرور الجديدة'); return }
    if (password.length < 6) { setError('كلمة المرور يجب أن تكون 6 أحرف على الأقل'); return }
    if (password !== confirm) { setError('كلمتا المرور غير متطابقتين'); return }

    setLoading(true)
    setError('')

    const { error: updateError } = await supabase.auth.updateUser({ password })

    if (updateError) {
      setError('حدث خطأ: ' + updateError.message)
      setLoading(false)
      return
    }

    setSuccess(true)
    setTimeout(() => {
      router.push('/login')
    }, 3000)
  }

  const inp: React.CSSProperties = {
    width: '100%', background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.10)',
    borderRadius: 12, padding: '12px 44px 12px 14px',
    fontSize: 14, color: S.white, outline: 'none',
    fontFamily: 'Tajawal, sans-serif', boxSizing: 'border-box',
    direction: 'ltr', textAlign: 'left',
  }

  if (!ready) return (
    <div style={{ minHeight: '100vh', background: S.navy, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', color: S.muted, fontSize: 16 }}>⏳ جاري التحقق...</div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: S.navy, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Tajawal, sans-serif', direction: 'rtl', padding: 20 }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700;800&display=swap');* { box-sizing: border-box; margin: 0; padding: 0; }`}</style>

      <div style={{ width: '100%', maxWidth: 420 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 52, marginBottom: 12 }}>🔑</div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: S.white, marginBottom: 6 }}>إعادة تعيين كلمة المرور</h1>
          <p style={{ fontSize: 13, color: S.muted }}>أدخل كلمة المرور الجديدة</p>
        </div>

        <div style={{ background: S.navy2, borderRadius: 20, border: `1px solid ${S.border}`, padding: '32px 28px' }}>
          {success ? (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ fontSize: 52, marginBottom: 12 }}>✅</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: S.green, marginBottom: 8 }}>تم تغيير كلمة المرور!</div>
              <div style={{ fontSize: 13, color: S.muted }}>سيتم تحويلك لصفحة الدخول...</div>
            </div>
          ) : (
            <>
              {error && (
                <div style={{ background: S.redB, border: `1px solid ${S.red}`, borderRadius: 10, padding: '10px 14px', marginBottom: 20, fontSize: 13, color: S.red }}>
                  ❌ {error}
                </div>
              )}

              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 6 }}>كلمة المرور الجديدة *</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    style={inp}
                    onFocus={e => e.target.style.borderColor = S.gold}
                    onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.10)'}
                  />
                  <span style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 18 }}>🔒</span>
                  <button onClick={() => setShowPass(p => !p)} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', cursor: 'pointer', color: S.muted, fontSize: 16 }}>
                    {showPass ? '🙈' : '👁️'}
                  </button>
                </div>
              </div>

              <div style={{ marginBottom: 28 }}>
                <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 6 }}>تأكيد كلمة المرور *</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleReset()}
                    placeholder="••••••••"
                    style={{ ...inp, borderColor: confirm && confirm !== password ? S.red : 'rgba(255,255,255,0.10)' }}
                    onFocus={e => e.target.style.borderColor = S.gold}
                    onBlur={e => e.target.style.borderColor = confirm && confirm !== password ? S.red : 'rgba(255,255,255,0.10)'}
                  />
                  <span style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 18 }}>🔒</span>
                </div>
                {confirm && confirm !== password && (
                  <div style={{ fontSize: 11, color: S.red, marginTop: 4 }}>⚠ كلمتا المرور غير متطابقتين</div>
                )}
              </div>

              <button
                onClick={handleReset}
                disabled={loading}
                style={{ width: '100%', padding: '14px', borderRadius: 12, border: 'none', background: loading ? 'rgba(201,168,76,0.4)' : `linear-gradient(135deg, ${S.gold}, ${S.gold2})`, color: S.navy, cursor: loading ? 'not-allowed' : 'pointer', fontSize: 15, fontFamily: 'Tajawal, sans-serif', fontWeight: 800 }}
              >
                {loading ? '⏳ جاري الحفظ...' : '✅ حفظ كلمة المرور'}
              </button>

              <button
                onClick={() => router.push('/login')}
                style={{ width: '100%', marginTop: 12, padding: '11px', borderRadius: 12, border: `1px solid ${S.muted}`, background: 'transparent', color: S.muted, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif' }}
              >
                ← العودة لتسجيل الدخول
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
