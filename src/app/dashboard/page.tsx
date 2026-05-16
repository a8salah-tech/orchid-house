'use client'
import { useAuth } from '../components/AuthProvider'

const S = { navy: '#0A1628', gold: '#C9A84C', white: '#FAFAF8', muted: '#8A9BB5', card: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.08)' }

const ROLE_LABELS: Record<string, { label: string; icon: string }> = {
  admin:               { label: 'مدير النظام',   icon: '👑' },
  branch_manager:      { label: 'مدير الفرع',    icon: '🏪' },
  kitchen_supervisor:  { label: 'مشرف المطبخ',   icon: '👨‍🍳' },
  hall_supervisor:     { label: 'مشرف الصالة',   icon: '🍽️' },
  bar_supervisor:      { label: 'مشرف البار',    icon: '☕' },
  cashier:             { label: 'كاشير',           icon: '💰' },
  employee:            { label: 'موظف',            icon: '👤' },
}

export default function DashboardPage() {
  const { employee } = useAuth()
  const role = ROLE_LABELS[employee?.role || 'employee'] || ROLE_LABELS.employee
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'صباح الخير' : hour < 17 ? 'مساء الخير' : 'مساء النور'

  return (
    <div style={{ fontFamily: 'Tajawal, sans-serif', direction: 'rtl', color: S.white, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '70vh', textAlign: 'center' }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700;800&display=swap');`}</style>
      <div style={{ fontSize: 72, marginBottom: 20 }}>🌸</div>
      <h1 style={{ fontSize: 28, fontWeight: 800, color: S.gold, marginBottom: 8 }}>
        {greeting}، {employee?.name || 'مرحباً'}!
      </h1>
      <div style={{ fontSize: 16, color: S.muted, marginBottom: 32 }}>
        {role.icon} {role.label}{employee?.department ? ` • ${employee.department}` : ''}
      </div>
      <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 16, padding: '20px 32px' }}>
        <div style={{ fontSize: 14, color: S.muted, marginBottom: 8 }}>
          {new Date().toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </div>
        <div style={{ fontSize: 13, color: S.white }}>اختر من القائمة الجانبية للبدء ←</div>
      </div>
    </div>
  )
}