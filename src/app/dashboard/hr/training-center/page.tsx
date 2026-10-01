'use client'

import { useLang } from '../../../components/LanguageContext'

const S = {
  gold: '#C9A84C', gold2: '#E8C97A', gold3: 'rgba(201,168,76,0.12)',
  white: '#FAFAF8', muted: '#8A9BB5', border: 'rgba(255,255,255,0.08)',
  teal: '#14B8A6', tealB: 'rgba(20,184,166,0.12)',
  card: 'rgba(255,255,255,0.04)',
}

export default function TrainingCenterPage() {
  const { isAr } = useLang()

  return (
    <div style={{ fontFamily: 'Tajawal, sans-serif', direction: isAr ? 'rtl' : 'ltr', color: S.white }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700;800&display=swap');`}</style>

      <div style={{
        maxWidth: 560, margin: '40px auto', textAlign: 'center',
        background: S.card, border: `1px solid ${S.border}`, borderRadius: 20, padding: '48px 32px',
      }}>
        <div style={{
          width: 76, height: 76, borderRadius: '50%', margin: '0 auto 20px',
          background: S.gold3, border: `2px solid ${S.gold}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 34,
        }}>🎓</div>

        <h1 style={{ fontSize: 24, fontWeight: 800, color: S.white, marginBottom: 6 }}>
          {isAr ? 'مركز التدريب' : 'Training Center'}
        </h1>
        {!isAr && <div style={{ fontSize: 15, color: S.muted, marginBottom: 18 }}>مركز التدريب</div>}
        {isAr && <div style={{ fontSize: 14, color: S.muted, marginBottom: 18 }}>Training Center</div>}

        <span style={{
          display: 'inline-block', background: S.tealB, color: S.teal, border: `1px solid ${S.teal}50`,
          borderRadius: 20, padding: '6px 18px', fontSize: 13, fontWeight: 700, marginBottom: 28,
        }}>🚀 {isAr ? 'قريباً' : 'Coming Soon'}</span>

        <div style={{ borderTop: `1px solid ${S.border}`, paddingTop: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <p style={{ fontSize: 14, color: S.white, lineHeight: 1.9, margin: 0 }}>
            نحن دائماً نسعى للأفضل. نعمل حالياً على مركز تدريب متكامل لصقل مهارات فريقنا وتطوير خبراتهم باستمرار — لأن تميّزكم هو أساس تميّزنا.
          </p>
          <p style={{ fontSize: 13, color: S.muted, lineHeight: 1.8, margin: 0, direction: 'ltr' }}>
            We always strive for better. We are building a complete training center to sharpen our team&apos;s skills and grow their expertise — because your excellence is the foundation of ours.
          </p>
        </div>
      </div>
    </div>
  )
}
