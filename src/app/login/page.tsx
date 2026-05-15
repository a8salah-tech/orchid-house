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

  async function handleLogin() {
    if (!email || !password) { setError('يرجى إدخال البريد الإلكتروني وكلمة المرور'); return }
    setLoading(true)
    setError('')

    // تسجيل الدخول عبر Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password })

    if (authError || !authData.user) {
      setError('البريد الإلكتروني أو كلمة المرور غير صحيحة')
      setLoading(false)
      return
    }

    // التحقق من وجود الموظف وأنه نشط
    const { data: emp, error: empError } = await supabase
      .from('employees')
      .select('id, name, role, is_active')
      .eq('auth_user_id', authData.user.id)
      .single()

    if (empError || !emp) {
      setError('هذا الحساب غير مرتبط بأي موظف. تواصل مع مدير النظام')
      await supabase.auth.signOut()
      setLoading(false)
      return
    }

    if (!emp.is_active) {
      setError('حسابك موقف. تواصل مع مدير النظام')
      await supabase.auth.signOut()
      setLoading(false)
      return
    }

    // توجيه حسب الدور
    router.push('/dashboard/warehouse')
    router.refresh()
  }

  return (
    <div style={{
      minHeight: '100vh', background: S.navy,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'Tajawal, sans-serif', direction: 'rtl', padding: 20,
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #0A1628; }
        input:-webkit-autofill { -webkit-box-shadow: 0 0 0 100px #0F2040 inset !important; -webkit-text-fill-color: #FAFAF8 !important; }
      `}</style>

      {/* Background decoration */}
      <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', top: -100, right: -100, width: 400, height: 400, borderRadius: '50%', background: 'rgba(201,168,76,0.04)', filter: 'blur(60px)' }} />
        <div style={{ position: 'absolute', bottom: -100, left: -100, width: 400, height: 400, borderRadius: '50%', background: 'rgba(59,130,246,0.04)', filter: 'blur(60px)' }} />
      </div>

      <div style={{ width: '100%', maxWidth: 420, position: 'relative' }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{
            width: 72, height: 72, borderRadius: 20,
            background: `linear-gradient(135deg, ${S.gold}, ${S.gold2})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 36, margin: '0 auto 16px',
            boxShadow: `0 0 40px rgba(201,168,76,0.3)`,
          }}>🌸</div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: S.white, marginBottom: 6 }}>Orchid House</h1>
          <p style={{ fontSize: 13, color: S.muted }}>نظام إدارة المطعم</p>
        </div>

        {/* Card */}
        <div style={{
          background: S.navy2, borderRadius: 20,
          border: `1px solid ${S.border}`,
          padding: '32px 28px',
          boxShadow: '0 24px 64px rgba(0,0,0,0.4)',
        }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: S.white, marginBottom: 6 }}>تسجيل الدخول</h2>
          <p style={{ fontSize: 13, color: S.muted, marginBottom: 28 }}>أدخل بياناتك للدخول على النظام</p>

          {/* Error */}
          {error && (
            <div style={{ background: S.redB, border: `1px solid ${S.red}`, borderRadius: 10, padding: '10px 14px', marginBottom: 20, fontSize: 13, color: S.red, display: 'flex', alignItems: 'center', gap: 8 }}>
              ❌ {error}
            </div>
          )}

          {/* Email */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 6 }}>البريد الإلكتروني</label>
            <div style={{ position: 'relative' }}>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                placeholder="email@orchid.com"
                style={{
                  width: '100%', background: 'rgba(255,255,255,0.04)',
                  border: `1px solid ${error ? S.red + '50' : 'rgba(255,255,255,0.10)'}`,
                  borderRadius: 12, padding: '12px 14px 12px 44px', fontSize: 14,
                  color: S.white, outline: 'none', fontFamily: 'Tajawal, sans-serif',
                  boxSizing: 'border-box', direction: 'ltr', textAlign: 'left',
                  transition: 'border-color .2s',
                }}
                onFocus={e => e.target.style.borderColor = S.gold}
                onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.10)'}
              />
              <span style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 18 }}>📧</span>
            </div>
          </div>

          {/* Password */}
          <div style={{ marginBottom: 28 }}>
            <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 6 }}>كلمة المرور</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                placeholder="••••••••"
                style={{
                  width: '100%', background: 'rgba(255,255,255,0.04)',
                  border: `1px solid ${error ? S.red + '50' : 'rgba(255,255,255,0.10)'}`,
                  borderRadius: 12, padding: '12px 44px 12px 44px', fontSize: 14,
                  color: S.white, outline: 'none', fontFamily: 'Tajawal, sans-serif',
                  boxSizing: 'border-box', direction: 'ltr', textAlign: 'left',
                  transition: 'border-color .2s',
                }}
                onFocus={e => e.target.style.borderColor = S.gold}
                onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.10)'}
              />
              
              <span style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 18 }}>🔒</span>

            </div>
          </div>

          {/* Login Button */}
          <button
            onClick={handleLogin}
            disabled={loading}
            style={{
              width: '100%', padding: '14px',
              borderRadius: 12, border: 'none',
              background: loading ? 'rgba(201,168,76,0.4)' : `linear-gradient(135deg, ${S.gold}, ${S.gold2})`,
              color: S.navy, cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: 15, fontFamily: 'Tajawal, sans-serif', fontWeight: 800,
              transition: 'all .2s', letterSpacing: 0.5,
              boxShadow: loading ? 'none' : `0 4px 20px rgba(201,168,76,0.3)`,
            }}
          >
            {loading ? '⏳ جاري تسجيل الدخول...' : '🔓 دخول'}
          </button>

          {/* Footer note */}
          <p style={{ textAlign: 'center', fontSize: 11, color: S.muted, marginTop: 20 }}>
            نظام داخلي خاص بموظفي Orchid House فقط
          </p>
        </div>

        {/* Bottom */}
        <p style={{ textAlign: 'center', fontSize: 11, color: S.muted, marginTop: 20 }}>
          مشكلة في الدخول؟ تواصل مع مدير النظام
        </p>
      </div>
    </div>
  )
}
