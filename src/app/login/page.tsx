'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'

const createClient = () => createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const S = {
  navy: '#0A1628', navy2: '#0F2040', navy3: '#0C1A32',
  gold: '#C9A84C', gold2: '#E8C97A', gold3: 'rgba(201,168,76,0.12)',
  white: '#FAFAF8', muted: '#8A9BB5', border: 'rgba(255,255,255,0.08)',
  red: '#EF4444', redB: 'rgba(239,68,68,0.12)',
  green: '#22C55E', greenB: 'rgba(34,197,94,0.12)',
}

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [tab, setTab] = useState<'login' | 'reset'>('login')
  const [resetEmail, setResetEmail] = useState('')
  const [resetSent, setResetSent] = useState(false)
  const [resetLoading, setResetLoading] = useState(false)

  async function handleLogin() {
    if (!email || !password) { setError('يرجى إدخال البريد الإلكتروني وكلمة المرور'); return }
    setLoading(true)
    setError('')
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password })
    if (authError || !authData.user) {
      setError('البريد الإلكتروني أو كلمة المرور غير صحيحة')
      setLoading(false)
      return
    }
    const { data: emp, error: empError } = await supabase
      .from('employees').select('id, name, role, is_active').eq('auth_user_id', authData.user.id).single()
    if (empError || !emp) {
      setError('هذا الحساب غير مرتبط بأي موظف. تواصل مع مدير النظام')
      await supabase.auth.signOut()
      setLoading(false)
      return
    }
    if (!emp.is_active) {
      setError('حسابك موقوف. تواصل مع مدير النظام')
      await supabase.auth.signOut()
      setLoading(false)
      return
    }
    // انتظر لحد ما الـ session تتسجل
    await new Promise(resolve => setTimeout(resolve, 500))
    window.location.href = '/dashboard'
  }

  async function handleResetPassword() {
    if (!resetEmail) { setError('يرجى إدخال البريد الإلكتروني'); return }
    setResetLoading(true)
    setError('')

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(resetEmail.trim().toLowerCase(), {
      redirectTo: `${window.location.origin}/reset-password`,
    })

    setResetLoading(false)
    if (resetError) { setError('حدث خطأ: ' + resetError.message); return }
    setResetSent(true)
  }

  const inputStyle: React.CSSProperties = { width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 12, padding: '12px 14px 12px 44px', fontSize: 14, color: S.white, outline: 'none', fontFamily: 'Tajawal, sans-serif', boxSizing: 'border-box', direction: 'ltr', textAlign: 'left' }

  return (
    <div style={{ minHeight: '100vh', background: S.navy, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Tajawal, sans-serif', direction: 'rtl', padding: 20 }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&display=swap');* { box-sizing: border-box; margin: 0; padding: 0; }body { background: #0A1628; }input:-webkit-autofill { -webkit-box-shadow: 0 0 0 100px #0F2040 inset !important; -webkit-text-fill-color: #FAFAF8 !important; }`}</style>
      <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', top: -100, right: -100, width: 400, height: 400, borderRadius: '50%', background: 'rgba(201,168,76,0.04)', filter: 'blur(60px)' }} />
        <div style={{ position: 'absolute', bottom: -100, left: -100, width: 400, height: 400, borderRadius: '50%', background: 'rgba(59,130,246,0.04)', filter: 'blur(60px)' }} />
      </div>
      <div style={{ width: '100%', maxWidth: 420, position: 'relative' }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ width: 72, height: 72, borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', overflow: 'hidden' }}>
            <img src="/logo.png" alt="Orchid" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: S.white, marginBottom: 6 }}>Orchid Group</h1>
          <p style={{ fontSize: 13, color: S.muted }}>نظام إدارة المطعم</p>
        </div>
        <div style={{ background: S.navy2, borderRadius: 20, border: `1px solid ${S.border}`, padding: '32px 28px', boxShadow: '0 24px 64px rgba(0,0,0,0.4)' }}>
          <div style={{ display: 'flex', background: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: 4, marginBottom: 24 }}>
            {(['login', 'reset'] as const).map(t => (
              <button key={t} onClick={() => { setTab(t); setError(''); setResetSent(false) }}
                style={{ flex: 1, padding: '9px', borderRadius: 9, border: 'none', cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: tab === t ? 700 : 400, background: tab === t ? S.gold3 : 'transparent', color: tab === t ? S.gold : S.muted, transition: 'all .2s', borderBottom: tab === t ? `2px solid ${S.gold}` : '2px solid transparent' }}>
                {t === 'login' ? '🔓 تسجيل الدخول' : '🔑 استعادة كلمة المرور'}
              </button>
            ))}
          </div>
          {error && <div style={{ background: S.redB, border: `1px solid ${S.red}`, borderRadius: 10, padding: '10px 14px', marginBottom: 20, fontSize: 13, color: S.red }}>❌ {error}</div>}
          {tab === 'login' ? (
            <>
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 6 }}>البريد الإلكتروني</label>
                <div style={{ position: 'relative' }}>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleLogin()} placeholder="email@orchid.com" style={inputStyle} onFocus={e => e.target.style.borderColor = S.gold} onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.10)'} />
                  <span style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 18 }}>📧</span>
                </div>
              </div>
              <div style={{ marginBottom: 28 }}>
                <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 6 }}>كلمة المرور</label>
                <div style={{ position: 'relative' }}>
                  <input type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleLogin()} placeholder="••••••••" style={{ ...inputStyle, padding: '12px 44px' }} onFocus={e => e.target.style.borderColor = S.gold} onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.10)'} />
                  <span style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 18 }}>🔒</span>
                  <button onClick={() => setShowPass(p => !p)} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', cursor: 'pointer', color: S.muted, fontSize: 16, padding: 4 }}>{showPass ? '🙈' : '👁️'}</button>
                </div>
              </div>
              <button onClick={handleLogin} disabled={loading} style={{ width: '100%', padding: '14px', borderRadius: 12, border: 'none', background: loading ? 'rgba(201,168,76,0.4)' : `linear-gradient(135deg, ${S.gold}, ${S.gold2})`, color: S.navy, cursor: loading ? 'not-allowed' : 'pointer', fontSize: 15, fontFamily: 'Tajawal, sans-serif', fontWeight: 800 }}>
                {loading ? '⏳ جاري تسجيل الدخول...' : '🔓 دخول'}
              </button>
            </>
          ) : (
            <>
              {resetSent ? (
                <div style={{ textAlign: 'center', padding: '20px 0' }}>
                  <div style={{ fontSize: 48, marginBottom: 12 }}>📨</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: S.green, marginBottom: 8 }}>تم إرسال رابط الاستعادة!</div>
                  <div style={{ fontSize: 13, color: S.muted, lineHeight: 1.7 }}>تفقد بريدك الإلكتروني<br /><strong style={{ color: S.white }}>{resetEmail}</strong><br />واضغط على الرابط لإعادة تعيين كلمة المرور</div>
                  <button onClick={() => { setTab('login'); setResetSent(false); setResetEmail('') }} style={{ marginTop: 20, padding: '10px 24px', borderRadius: 10, border: `1px solid ${S.gold}`, background: S.gold3, color: S.gold, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>← العودة لتسجيل الدخول</button>
                </div>
              ) : (
                <>
                  <p style={{ fontSize: 13, color: S.muted, marginBottom: 20, lineHeight: 1.7 }}>أدخل بريدك الإلكتروني المسجل في النظام وسنرسل لك رابطاً لإعادة تعيين كلمة المرور</p>
                  <div style={{ marginBottom: 24 }}>
                    <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 6 }}>البريد الإلكتروني</label>
                    <div style={{ position: 'relative' }}>
                      <input type="email" value={resetEmail} onChange={e => setResetEmail(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleResetPassword()} placeholder="email@orchid.com" style={inputStyle} onFocus={e => e.target.style.borderColor = S.gold} onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.10)'} />
                      <span style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 18 }}>📧</span>
                    </div>
                  </div>
                  <button onClick={handleResetPassword} disabled={resetLoading} style={{ width: '100%', padding: '14px', borderRadius: 12, border: 'none', background: resetLoading ? 'rgba(201,168,76,0.4)' : `linear-gradient(135deg, ${S.gold}, ${S.gold2})`, color: S.navy, cursor: resetLoading ? 'not-allowed' : 'pointer', fontSize: 15, fontFamily: 'Tajawal, sans-serif', fontWeight: 800 }}>
                    {resetLoading ? '⏳ جاري التحقق...' : '📨 إرسال رابط الاستعادة'}
                  </button>
                </>
              )}
            </>
          )}
          <p style={{ textAlign: 'center', fontSize: 11, color: S.muted, marginTop: 20 }}>نظام داخلي خاص بموظفي Orchid Group فقط</p>
        </div>
        <p style={{ textAlign: 'center', fontSize: 11, color: S.muted, marginTop: 20 }}>مشكلة في الدخول؟ تواصل مع مدير النظام</p>
      </div>
    </div>
  )
}
