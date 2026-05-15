'use client'

import { useAuth } from './AuthProvider'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

const S = {
  navy: '#0A1628', gold: '#C9A84C', gold2: '#E8C97A',
  white: '#FAFAF8', muted: '#8A9BB5',
  red: '#EF4444', redB: 'rgba(239,68,68,0.12)',
}

interface ProtectedRouteProps {
  children: React.ReactNode
  permission?: string // مفتاح الصلاحية المطلوبة
}

export function ProtectedRoute({ children, permission }: ProtectedRouteProps) {
  const { employee, loading, hasPermission } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !employee) router.push('/login')
  }, [loading, employee])

  // Loading
  if (loading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        minHeight: '60vh', fontFamily: 'Tajawal, sans-serif', direction: 'rtl',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🌸</div>
          <div style={{ fontSize: 14, color: S.muted }}>جاري التحميل...</div>
        </div>
      </div>
    )
  }

  // مش مسجل دخول
  if (!employee) return null

  // تحقق من الصلاحية
  if (permission && !hasPermission(permission)) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        minHeight: '60vh', fontFamily: 'Tajawal, sans-serif', direction: 'rtl',
      }}>
        <div style={{ textAlign: 'center', maxWidth: 400 }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>🔐</div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: S.white, marginBottom: 8 }}>غير مصرح بالدخول</h2>
          <p style={{ fontSize: 13, color: S.muted, marginBottom: 24, lineHeight: 1.6 }}>
            ليس لديك صلاحية الوصول لهذه الصفحة.<br />تواصل مع مدير النظام لطلب الصلاحية.
          </p>
          <button
            onClick={() => router.back()}
            style={{ padding: '10px 24px', borderRadius: 10, border: `1px solid ${S.gold}`, background: 'rgba(201,168,76,0.12)', color: S.gold, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}
          >← رجوع</button>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
