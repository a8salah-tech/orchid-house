'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useAuth } from './AuthProvider'
import { useRouter } from 'next/navigation'

const createClient = () => createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const S = {
  navy2: '#0F2040', navy3: '#0C1A32',
  gold: '#C9A84C', gold3: 'rgba(201,168,76,0.12)',
  white: '#FAFAF8', muted: '#8A9BB5', border: 'rgba(255,255,255,0.08)',
  green: '#22C55E', greenB: 'rgba(34,197,94,0.12)',
  red: '#EF4444', redB: 'rgba(239,68,68,0.12)',
  amber: '#F59E0B', amberB: 'rgba(245,158,11,0.12)',
  card: 'rgba(255,255,255,0.04)',
}

const TYPE_ICONS: Record<string, string> = {
  order: '🍽️', waiter_call: '🔔', kitchen: '👨‍🍳', booking: '📅',
  leave: '🏖️', leave_reply: '✅', stock: '📦', payroll: '💰',
  shift: '🕐', system: '⚙️', request: '📋', maintenance: '🔧',
}

function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60) return 'الآن'
  if (diff < 3600) return `${Math.floor(diff/60)}د`
  if (diff < 86400) return `${Math.floor(diff/3600)}س`
  return `${Math.floor(diff/86400)}ي`
}

export default function NotificationBell() {
  const sbRef = useRef(createClient())
  const sb = sbRef.current
  const { employee } = useAuth()
  const router = useRouter()
  const [notifs, setNotifs] = useState<any[]>([])
  const [open, setOpen] = useState(false)
  const dropRef = useRef<HTMLDivElement>(null)

  // ✅ جديد: كشف الموبايل عشان نغيّر طريقة عرض القائمة المنسدلة بحيث تفضل ظاهرة بالكامل دائمًا
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 860)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const fetchNotifs = useCallback(async () => {
    if (!employee?.id) return
let q = sb.from('notifications').select('*').order('created_at', { ascending: false }).limit(20)
if (employee.role === 'admin' || employee.role === 'branch_manager') {
  q = q.or(`target_role.eq.all,target_role.eq.admin,target_employee_id.eq.${employee.id}`)
} else {
  q = q.or(`target_employee_id.eq.${employee.id},target_role.eq.all,target_role.eq.${employee.role}`)
}
    const { data } = await q
    setNotifs(data || [])
  }, [sb, employee])

  useEffect(() => { fetchNotifs() }, [fetchNotifs])

  useEffect(() => {
    const ch = sb.channel('bell-notifs')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, () => {
        fetchNotifs()
        // Browser notification
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('🔔 إشعار جديد', { icon: '/favicon.ico' })
        }
      })
      .subscribe()
    return () => { sb.removeChannel(ch) }
  }, [sb, fetchNotifs])

  // Close on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  const unread = notifs.filter(n => !n.is_read).length

  async function markRead(id: string, link?: string) {
    await sb.from('notifications').update({ is_read: true }).eq('id', id)
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
    if (link) { setOpen(false); router.push(link) }
  }

  async function markAllRead() {
    const ids = notifs.filter(n => !n.is_read).map(n => n.id)
    if (ids.length === 0) return
    await sb.from('notifications').update({ is_read: true }).in('id', ids)
    setNotifs(prev => prev.map(n => ({ ...n, is_read: true })))
  }

  return (
    <div ref={dropRef} style={{ position: 'relative' }}>
      <button onClick={() => setOpen(!open)} style={{ position: 'relative', background: 'transparent', border: 'none', cursor: 'pointer', padding: 8, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: 22 }}>🔔</span>
        {unread > 0 && (
          <span style={{ position: 'absolute', top: 2, right: 2, background: S.red, color: S.white, borderRadius: '50%', width: 18, height: 18, fontSize: 10, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Tajawal, sans-serif' }}>
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div style={isMobile ? {
          // ✅ Fix: على الموبايل، القائمة تصبح لوحة ثابتة أعلى الشاشة بعرض متجاوب بدل صندوق 340px ثابت كان بيخرج عن حدود الشاشة
          position: 'fixed', top: 64, right: 12, left: 12, width: 'auto',
          background: S.navy2, border: `1px solid ${S.border}`, borderRadius: 16,
          boxShadow: '0 20px 60px rgba(0,0,0,.6)', zIndex: 999, overflow: 'hidden',
        } : {
          position: 'absolute', top: '100%', left: 0, width: 340, background: S.navy2, border: `1px solid ${S.border}`, borderRadius: 16, boxShadow: '0 20px 60px rgba(0,0,0,.6)', zIndex: 999, overflow: 'hidden', marginTop: 8,
        }}>
          {/* Header */}
          <div style={{ padding: '14px 16px', borderBottom: `1px solid ${S.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontWeight: 800, fontSize: 14, color: S.white, fontFamily: 'Tajawal, sans-serif' }}>
              🔔 الإشعارات {unread > 0 && <span style={{ color: S.red, fontSize: 12 }}>({unread} جديد)</span>}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {unread > 0 && (
                <button onClick={markAllRead} style={{ fontSize: 11, color: S.green, background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'Tajawal, sans-serif' }}>قراءة الكل</button>
              )}
              <button onClick={() => { setOpen(false); router.push('/dashboard/notifications') }} style={{ fontSize: 11, color: S.gold, background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'Tajawal, sans-serif' }}>عرض الكل</button>
            </div>
          </div>

          {/* Notifications */}
          <div style={{ maxHeight: isMobile ? 'calc(100vh - 220px)' : 380, overflowY: 'auto' }}>
            {notifs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 30, color: S.muted, fontSize: 13, fontFamily: 'Tajawal, sans-serif' }}>لا توجد إشعارات</div>
            ) : notifs.slice(0, 10).map(n => (
              <div key={n.id} onClick={() => markRead(n.id, n.link)}
                style={{ padding: '12px 16px', borderBottom: `1px solid ${S.border}`, display: 'flex', gap: 10, cursor: 'pointer', background: n.is_read ? 'transparent' : 'rgba(201,168,76,0.05)', transition: 'background .2s' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = n.is_read ? 'transparent' : 'rgba(201,168,76,0.05)'}>
                <div style={{ fontSize: 22, flexShrink: 0 }}>{TYPE_ICONS[n.type] || '🔔'}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: n.is_read ? 400 : 700, color: n.is_read ? S.muted : S.white, fontFamily: 'Tajawal, sans-serif', lineHeight: 1.3 }}>{n.title}</span>
                    <span style={{ fontSize: 10, color: S.muted, flexShrink: 0, fontFamily: 'Tajawal, sans-serif' }}>{timeAgo(n.created_at)}</span>
                  </div>
                  <div style={{ fontSize: 11, color: S.muted, marginTop: 3, fontFamily: 'Tajawal, sans-serif', lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.body}</div>
                </div>
                {!n.is_read && <div style={{ width: 8, height: 8, borderRadius: '50%', background: S.gold, flexShrink: 0, marginTop: 6 }} />}
              </div>
            ))}
          </div>

          {/* Footer */}
          <div style={{ padding: '10px 16px', borderTop: `1px solid ${S.border}`, textAlign: 'center' }}>
            <button onClick={() => { setOpen(false); router.push('/dashboard/notifications') }} style={{ fontSize: 12, color: S.gold, background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
              عرض جميع الإشعارات ←
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
