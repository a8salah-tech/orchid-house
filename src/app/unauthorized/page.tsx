'use client'

import { useRouter } from 'next/navigation'

const S = { navy: '#0A1628', gold: '#C9A84C', white: '#FAFAF8', muted: '#8A9BB5' }

export default function UnauthorizedPage() {
  const router = useRouter()
  return (
    <div style={{ minHeight: '100vh', background: S.navy, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Tajawal, sans-serif', direction: 'rtl' }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700;800&display=swap');`}</style>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 80, marginBottom: 20 }}>🔐</div>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: S.white, marginBottom: 10 }}>غير مصرح بالدخول</h1>
        <p style={{ fontSize: 14, color: S.muted, marginBottom: 30 }}>ليس لديك صلاحية للوصول لهذه الصفحة</p>
        <button onClick={() => router.back()} style={{ padding: '12px 28px', borderRadius: 12, border: `1px solid ${S.gold}`, background: 'rgba(201,168,76,0.12)', color: S.gold, cursor: 'pointer', fontSize: 14, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>← رجوع</button>
      </div>
    </div>
  )
}
