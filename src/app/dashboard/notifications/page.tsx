'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useRef, useCallback } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useAuth } from '../../components/AuthProvider'

const createClient = () => createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const S = {
  navy: '#0A1628', navy2: '#0F2040', navy3: '#0C1A32',
  gold: '#C9A84C', gold3: 'rgba(201,168,76,0.12)',
  white: '#FAFAF8', muted: '#8A9BB5', border: 'rgba(255,255,255,0.08)',
  green: '#22C55E', greenB: 'rgba(34,197,94,0.12)',
  red: '#EF4444', redB: 'rgba(239,68,68,0.12)',
  blue: '#3B82F6', blueB: 'rgba(59,130,246,0.12)',
  amber: '#F59E0B', amberB: 'rgba(245,158,11,0.12)',
  purple: '#8B5CF6', purpleB: 'rgba(139,92,246,0.12)',
  teal: '#14B8A6', tealB: 'rgba(20,184,166,0.12)',
  card: 'rgba(255,255,255,0.04)', card2: 'rgba(255,255,255,0.07)',
}

type Notif = {
  id: string; type: string; title: string; body: string
  link?: string; target_role?: string; target_employee_id?: string
  is_read: boolean; created_at: string
}

const TYPE_CFG: Record<string, { icon: string; color: string; bg: string }> = {
  order:       { icon: '🍽️', color: S.gold,   bg: S.gold3   },
  waiter_call: { icon: '🔔', color: S.amber,  bg: S.amberB  },
  kitchen:     { icon: '👨‍🍳', color: S.teal,  bg: S.tealB   },
  booking:     { icon: '📅', color: S.purple, bg: S.purpleB },
  leave:       { icon: '🏖️', color: S.blue,   bg: S.blueB   },
  leave_reply: { icon: '✅', color: S.green,  bg: S.greenB  },
  stock:       { icon: '📦', color: S.red,    bg: S.redB    },
  payroll:     { icon: '💰', color: S.gold,   bg: S.gold3   },
  shift:       { icon: '🕐', color: S.blue,   bg: S.blueB   },
  system:      { icon: '⚙️', color: S.muted,  bg: S.card    },
  request:     { icon: '📋', color: S.purple, bg: S.purpleB },
}

function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60) return 'الآن'
  if (diff < 3600) return `${Math.floor(diff/60)} دقيقة`
  if (diff < 86400) return `${Math.floor(diff/3600)} ساعة`
  return `${Math.floor(diff/86400)} يوم`
}

// ══ Send Notification Modal ══
function SendModal({ employees, onClose, onSent }: {
  employees: any[]; onClose: () => void; onSent: () => void
}) {
  const sbRef = useRef(createClient())
  const sb = sbRef.current
  const [form, setForm] = useState({
    type: 'system', title: '', body: '', link: '',
    target: 'all', target_role: 'all', target_employee_id: '',
  })
  const [attachment, setAttachment] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [sending, setSending] = useState(false)

  const ROLES = [
    { k: 'all', l: 'الجميع' },
    { k: 'admin', l: 'مدير النظام' },
    { k: 'branch_manager', l: 'مدير الفرع' },
    { k: 'cashier', l: 'الكاشير' },
    { k: 'kitchen_supervisor', l: 'مشرف المطبخ' },
    { k: 'hall_supervisor', l: 'مشرف الصالة' },
    { k: 'employee', l: 'موظف' },
  ]

  async function send() {
    if (!form.title.trim() || !form.body.trim()) { alert('العنوان والمحتوى مطلوبان'); return }
    setSending(true)
    let attachmentUrl = form.link || null
    // Upload attachment if exists
    if (attachment) {
      setUploading(true)
      const ext = attachment.name.split('.').pop()
      const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      const { data: uploadData, error: uploadError } = await sb.storage
        .from('notification-attachments')
        .upload(path, attachment, { contentType: attachment.type })
      setUploading(false)
      if (uploadError) { alert('خطأ في رفع الملف: ' + uploadError.message); setSending(false); return }
      const { data: urlData } = sb.storage.from('notification-attachments').getPublicUrl(path)
      attachmentUrl = urlData.publicUrl
    }
    const payload: any = {
      type: form.type, title: form.title, body: form.body,
      link: attachmentUrl,
    }
    if (form.target === 'employee') {
      payload.target_employee_id = form.target_employee_id
      payload.target_role = null
    } else {
      payload.target_role = form.target_role
      payload.target_employee_id = null
    }
    await sb.from('notifications').insert([payload])
    setSending(false)
    onSent()
  }

  const inp: React.CSSProperties = { width: '100%', background: 'rgba(255,255,255,.04)', border: `1px solid ${S.border}`, borderRadius: 10, padding: '10px 14px', fontSize: 13, color: S.white, outline: 'none', fontFamily: 'Tajawal, sans-serif', boxSizing: 'border-box' as const }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.85)', zIndex: 400, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 20, overflowY: 'auto' }}>
      <div style={{ background: S.navy2, borderRadius: 20, border: `1px solid ${S.border}`, width: '100%', maxWidth: 500, padding: 28, margin: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ color: S.white, fontSize: 17, fontWeight: 800 }}>📢 إرسال إشعار جديد</h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: S.muted, fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Type */}
          <div>
            <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 6 }}>نوع الإشعار</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
              {Object.entries(TYPE_CFG).map(([k, cfg]) => (
                <button key={k} onClick={() => setForm(p => ({ ...p, type: k }))}
                  style={{ padding: '12px 6px', borderRadius: 12, border: `2px solid ${form.type===k?cfg.color:S.border}`, background: form.type===k?cfg.bg:'rgba(255,255,255,0.03)', color: form.type===k?cfg.color:S.white, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: form.type===k?700:500, textAlign: 'center', transition: 'all .2s' }}>
                  <div style={{ fontSize: 22, marginBottom: 4 }}>{cfg.icon}</div>
                  <div style={{ fontSize: 10, color: form.type===k?cfg.color:S.white, opacity: form.type===k?1:0.7 }}>{k}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div>
            <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>العنوان *</label>
            <input style={inp} placeholder="عنوان الإشعار..." value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} />
          </div>

          {/* Body */}
          <div>
            <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>المحتوى *</label>
            <textarea style={{ ...inp, minHeight: 80, resize: 'vertical' as const }} placeholder="محتوى الإشعار..." value={form.body} onChange={e => setForm(p => ({ ...p, body: e.target.value }))} />
          </div>

          {/* Target */}
          <div>
            <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 8 }}>المستلم</label>
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              {[['all', 'حسب الدور'], ['employee', 'موظف محدد']].map(([k, l]) => (
                <button key={k} onClick={() => setForm(p => ({ ...p, target: k }))}
                  style={{ flex: 1, padding: '9px', borderRadius: 10, border: `1px solid ${form.target===k?S.gold:S.border}`, background: form.target===k?S.gold3:'transparent', color: form.target===k?S.gold:S.muted, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: form.target===k?700:400 }}>
                  {l}
                </button>
              ))}
            </div>
            {form.target === 'all' ? (
              <select style={{ ...inp, cursor: 'pointer' }} value={form.target_role} onChange={e => setForm(p => ({ ...p, target_role: e.target.value }))}>
                {ROLES.map(r => <option key={r.k} value={r.k}>{r.l}</option>)}
              </select>
            ) : (
              <select style={{ ...inp, cursor: 'pointer' }} value={form.target_employee_id} onChange={e => setForm(p => ({ ...p, target_employee_id: e.target.value }))}>
                <option value="">اختر موظف...</option>
                {employees.map(e => <option key={e.id} value={e.id}>{e.name} — {e.role}</option>)}
              </select>
            )}
          </div>

          {/* Attachment */}
          <div>
            <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 6 }}>📎 مرفق (صورة أو PDF)</label>
            <label style={{ display: 'block', cursor: 'pointer' }}>
              <div style={{ border: `2px dashed ${attachment ? S.green : S.border}`, borderRadius: 12, padding: '14px 16px', textAlign: 'center', background: attachment ? S.greenB : 'rgba(255,255,255,0.02)', transition: 'all .2s' }}>
                {attachment ? (
                  <div>
                    <div style={{ fontSize: 22, marginBottom: 4 }}>{attachment.type.includes('pdf') ? '📄' : '🖼️'}</div>
                    <div style={{ fontSize: 12, color: S.green, fontWeight: 700 }}>{attachment.name}</div>
                    <div style={{ fontSize: 10, color: S.muted, marginTop: 2 }}>{(attachment.size / 1024).toFixed(0)} KB</div>
                  </div>
                ) : (
                  <div>
                    <div style={{ fontSize: 28, marginBottom: 6 }}>📎</div>
                    <div style={{ fontSize: 12, color: S.muted }}>اضغط لرفع صورة أو PDF</div>
                    <div style={{ fontSize: 10, color: S.muted, marginTop: 2 }}>JPG, PNG, PDF — حد أقصى 5MB</div>
                  </div>
                )}
              </div>
              <input type="file" accept="image/*,.pdf" style={{ display: 'none' }}
                onChange={e => {
                  const file = e.target.files?.[0]
                  if (file && file.size > 5 * 1024 * 1024) { alert('الملف أكبر من 5MB'); return }
                  setAttachment(file || null)
                }} />
            </label>
            {attachment && (
              <button onClick={() => setAttachment(null)} style={{ marginTop: 6, fontSize: 11, color: S.red, background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'Tajawal, sans-serif' }}>✕ إزالة المرفق</button>
            )}
          </div>
          {/* Link fallback */}
          <div>
            <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>أو رابط خارجي</label>
            <input style={inp} placeholder="https://..." value={form.link} onChange={e => setForm(p => ({ ...p, link: e.target.value }))} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button onClick={onClose} style={{ padding: '11px 20px', borderRadius: 10, border: `1px solid ${S.muted}`, background: 'transparent', color: S.muted, cursor: 'pointer', fontFamily: 'Tajawal, sans-serif' }}>إلغاء</button>
          <button onClick={send} disabled={sending} style={{ flex: 1, padding: '11px', borderRadius: 10, border: 'none', background: `linear-gradient(135deg,${S.gold},${S.gold})`, color: S.navy, cursor: 'pointer', fontWeight: 800, fontSize: 14, fontFamily: 'Tajawal, sans-serif' }}>
            {uploading ? '📤 جاري رفع المرفق...' : sending ? '⏳ جاري الإرسال...' : '📢 إرسال الإشعار'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ══ Main Page ══
export default function NotificationsSystemPage() {
  const sbRef = useRef(createClient())
  const sb = sbRef.current
  const { employee } = useAuth()
  const isAdmin = employee?.role === 'admin' || employee?.role === 'branch_manager'

  const [notifs, setNotifs] = useState<Notif[]>([])
  const [employees, setEmployees] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'unread'>('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [showSend, setShowSend] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)

  const fetchNotifs = useCallback(async () => {
    let q = sb.from('notifications').select('*').order('created_at', { ascending: false }).limit(100)

    // Filter by employee or role
    if (!isAdmin && employee?.id) {
      q = q.or(`target_employee_id.eq.${employee.id},target_role.eq.all,target_role.eq.${employee.role}`)
    }

    const { data } = await q
    setNotifs((data as Notif[]) || [])
    setLoading(false)
  }, [sb, employee, isAdmin])

  useEffect(() => { fetchNotifs() }, [fetchNotifs])

  useEffect(() => {
    if (isAdmin) {
      sb.from('employees').select('id,name,role').eq('is_active', true).order('name')
        .then(({ data }) => setEmployees(data || []))
    }
  }, [isAdmin])

  // Real-time
  useEffect(() => {
    const ch = sb.channel('notifs-rt')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, () => fetchNotifs())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'notifications' }, () => fetchNotifs())
      .subscribe()
    return () => { sb.removeChannel(ch) }
  }, [sb, fetchNotifs])

  async function markRead(id: string) {
    await sb.from('notifications').update({ is_read: true }).eq('id', id)
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
  }

  async function markAllRead() {
    const ids = notifs.filter(n => !n.is_read).map(n => n.id)
    if (ids.length === 0) return
    await sb.from('notifications').update({ is_read: true }).in('id', ids)
    setNotifs(prev => prev.map(n => ({ ...n, is_read: true })))
  }

  async function deleteNotif(id: string) {
    await sb.from('notifications').delete().eq('id', id)
    setNotifs(prev => prev.filter(n => n.id !== id))
  }

  async function clearAll() {
    if (!confirm('حذف جميع الإشعارات؟')) return
    await sb.from('notifications').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    setNotifs([])
  }

  const filtered = notifs.filter(n => {
    const matchRead = filter === 'all' || !n.is_read
    const matchType = typeFilter === 'all' || n.type === typeFilter
    return matchRead && matchType
  })

  const unreadCount = notifs.filter(n => !n.is_read).length

  return (
    <div style={{ fontFamily: 'Tajawal, sans-serif', color: S.white, direction: 'rtl' }}>
      <style>{`select option{background:#0F2040;color:#FAFAF8}`}</style>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
            <h1 style={{ fontSize: 22, fontWeight: 900 }}>🔔 مركز الإشعارات</h1>
            {unreadCount > 0 && (
              <span style={{ background: S.red, color: S.white, borderRadius: 20, padding: '3px 10px', fontSize: 13, fontWeight: 800 }}>{unreadCount}</span>
            )}
          </div>
          <p style={{ fontSize: 13, color: S.muted }}>جميع إشعارات النظام في مكان واحد</p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {unreadCount > 0 && (
            <button onClick={markAllRead} style={{ padding: '10px 16px', borderRadius: 12, border: `1px solid ${S.green}`, background: S.greenB, color: S.green, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>✅ قراءة الكل</button>
          )}
          {isAdmin && (
            <>
              <button onClick={clearAll} style={{ padding: '10px 16px', borderRadius: 12, border: `1px solid ${S.red}`, background: S.redB, color: S.red, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>🗑️ مسح الكل</button>
              <button onClick={() => setShowSend(true)} style={{ padding: '10px 20px', borderRadius: 12, border: 'none', background: `linear-gradient(135deg,${S.gold},${S.gold})`, color: S.navy, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 800 }}>📢 إرسال إشعار</button>
            </>
          )}
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'إجمالي الإشعارات', value: notifs.length, color: S.white },
          { label: 'غير مقروءة', value: unreadCount, color: S.red },
          { label: 'مقروءة', value: notifs.length - unreadCount, color: S.green },
        ].map((s, i) => (
          <div key={i} style={{ background: S.card2, borderRadius: 14, border: `1px solid ${S.border}`, padding: '14px 16px', textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: s.color, marginBottom: 4 }}>{s.value}</div>
            <div style={{ fontSize: 11, color: S.muted }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', background: S.navy3, borderRadius: 10, padding: 4, gap: 4 }}>
          {[['all', 'الكل'], ['unread', 'غير مقروءة']].map(([k, l]) => (
            <button key={k} onClick={() => setFilter(k as any)} style={{ padding: '7px 14px', borderRadius: 8, border: 'none', background: filter===k?S.gold3:'transparent', color: filter===k?S.gold:S.muted, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', fontWeight: filter===k?700:400 }}>{l}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={() => setTypeFilter('all')} style={{ padding: '7px 14px', borderRadius: 20, border: `1px solid ${typeFilter==='all'?S.gold:S.border}`, background: typeFilter==='all'?S.gold3:'transparent', color: typeFilter==='all'?S.gold:S.muted, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif' }}>الكل</button>
          {Object.entries(TYPE_CFG).map(([k, cfg]) => (
            <button key={k} onClick={() => setTypeFilter(k)} style={{ padding: '7px 12px', borderRadius: 20, border: `1px solid ${typeFilter===k?cfg.color:S.border}`, background: typeFilter===k?cfg.bg:'transparent', color: typeFilter===k?cfg.color:S.muted, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif' }}>
              {cfg.icon}
            </button>
          ))}
        </div>
      </div>

      {/* Notifications List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: S.muted }}>⏳ جاري التحميل...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 80 }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>🔔</div>
          <div style={{ color: S.white, fontSize: 18, fontWeight: 700, marginBottom: 8 }}>لا توجد إشعارات</div>
          <div style={{ color: S.muted, fontSize: 13 }}>ستظهر هنا جميع إشعارات النظام</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(notif => {
            const cfg = TYPE_CFG[notif.type] || TYPE_CFG.system
            return (
              <div key={notif.id} style={{ background: notif.is_read ? S.navy2 : S.card2, borderRadius: 14, border: `1px solid ${notif.is_read ? S.border : cfg.color + '40'}`, padding: '14px 18px', display: 'flex', gap: 14, alignItems: 'flex-start', transition: 'all .2s' }}>
                {/* Icon */}
                <div style={{ width: 44, height: 44, borderRadius: 12, background: cfg.bg, border: `1px solid ${cfg.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
                  {cfg.icon}
                </div>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 800, fontSize: 14, color: notif.is_read ? S.muted : S.white }}>{notif.title}</span>
                    {!notif.is_read && <span style={{ width: 8, height: 8, borderRadius: '50%', background: cfg.color, flexShrink: 0, display: 'inline-block' }} />}
                    <span style={{ background: cfg.bg, color: cfg.color, borderRadius: 20, padding: '2px 8px', fontSize: 10, fontWeight: 700 }}>{notif.type}</span>
                  </div>
                  <div style={{ fontSize: 13, color: S.muted, marginBottom: 6, lineHeight: 1.5 }}>{notif.body}</div>
                  <div style={{ fontSize: 11, color: S.muted }}>{timeAgo(notif.created_at)}</div>
                  {notif.link && (
                    <button onClick={() => setPreview(notif.link!)}
                      style={{ fontSize: 11, color: cfg.color, background: 'transparent', border: `1px solid ${cfg.color}40`, borderRadius: 8, padding: '4px 10px', cursor: 'pointer', marginTop: 6, fontFamily: 'Tajawal, sans-serif', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      📎 عرض المرفق
                    </button>
                  )}
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  {!notif.is_read && (
                    <button onClick={() => markRead(notif.id)} style={{ padding: '6px 10px', borderRadius: 8, border: `1px solid ${S.green}`, background: S.greenB, color: S.green, cursor: 'pointer', fontSize: 11 }}>✓</button>
                  )}
                  {isAdmin && (
                    <button onClick={() => deleteNotif(notif.id)} style={{ padding: '6px 10px', borderRadius: 8, border: `1px solid ${S.red}`, background: S.redB, color: S.red, cursor: 'pointer', fontSize: 11 }}>🗑️</button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showSend && (
        <SendModal employees={employees} onClose={() => setShowSend(false)} onSent={() => { setShowSend(false); fetchNotifs() }} />
      )}

      {/* Preview Modal */}
      {preview && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.9)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={() => setPreview(null)}>
          <div style={{ background: S.navy2, borderRadius: 20, border: `1px solid ${S.border}`, maxWidth: 700, width: '100%', overflow: 'hidden' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', borderBottom: `1px solid ${S.border}` }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: S.white }}>📎 المرفق</span>
              <button onClick={() => setPreview(null)} style={{ background: 'transparent', border: 'none', color: S.muted, fontSize: 22, cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ padding: 20, textAlign: 'center' }}>
              {preview.match(/\.(jpg|jpeg|png|webp|gif)$/i) || preview.includes('supabase') ? (
                <img src={preview} alt="attachment" style={{ maxWidth: '100%', maxHeight: '60vh', borderRadius: 12, objectFit: 'contain' }} />
              ) : preview.match(/\.pdf$/i) ? (
                <iframe src={preview} style={{ width: '100%', height: '60vh', border: 'none', borderRadius: 12 }} />
              ) : (
                <div style={{ padding: 40, color: S.muted }}>
                  <div style={{ fontSize: 48, marginBottom: 16 }}>📄</div>
                  <a href={preview} target="_blank" rel="noreferrer" style={{ color: S.blue, fontSize: 14 }}>فتح الملف في تبويب جديد</a>
                </div>
              )}
            </div>
            <div style={{ padding: '12px 20px', borderTop: `1px solid ${S.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <a href={preview} download onClick={async e => {
               e.preventDefault()
               const res = await fetch(preview)
               const blob = await res.blob()
               const url = URL.createObjectURL(blob)
               const a = document.createElement('a')
               a.href = url; a.download = preview.split('/').pop() || 'attachment'
               a.click(); URL.revokeObjectURL(url)
               }} style={{ fontSize: 12, color: S.gold, textDecoration: 'none', fontFamily: 'Tajawal, sans-serif', cursor: 'pointer' }}>⬇️ تحميل</a>
              <button onClick={() => setPreview(null)} style={{ padding: '8px 18px', borderRadius: 10, border: `1px solid ${S.red}`, background: S.redB, color: S.red, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>إغلاق</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
