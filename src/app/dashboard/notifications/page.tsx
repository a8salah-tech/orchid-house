'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useRef, useCallback } from 'react'
import { createBrowserClient } from '@supabase/ssr'

const createClient = () => createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const S = {
  navy: '#0A1628', navy2: '#0F2040', navy3: '#0C1A32',
  gold: '#C9A84C', gold2: '#E8C97A', gold3: 'rgba(201,168,76,0.12)',
  white: '#FAFAF8', muted: '#8A9BB5', border: 'rgba(255,255,255,0.08)',
  green: '#22C55E', greenB: 'rgba(34,197,94,0.12)',
  red: '#EF4444', redB: 'rgba(239,68,68,0.12)',
  blue: '#3B82F6', blueB: 'rgba(59,130,246,0.12)',
  amber: '#F59E0B', amberB: 'rgba(245,158,11,0.12)',
  purple: '#8B5CF6', purpleB: 'rgba(139,92,246,0.12)',
  teal: '#14B8A6', tealB: 'rgba(20,184,166,0.12)',
  card: 'rgba(255,255,255,0.04)', card2: 'rgba(255,255,255,0.08)',
}

type Contact = { id: string; name: string; phone?: string; email?: string; type: 'customer' | 'employee'; role?: string }

const TEMPLATES = {
  customers: [
    { label: 'ترحيب بعميل جديد', icon: '👋', body: 'مرحباً {name}! يسعدنا انضمامك لعائلة Orchid House. استمتع بأفضل تجربة طعام معنا!' },
    { label: 'عرض خاص', icon: '🎉', body: 'عزيزنا {name}، لدينا عرض خاص اليوم! خصم 20% على كل الطلبات. لا تفوّت الفرصة! 🌸' },
    { label: 'تذكير بالحجز', icon: '📅', body: 'تذكير: لديك حجز غداً في Orchid House. نتطلع لاستقبالك!' },
    { label: 'عيد ميلاد', icon: '🎂', body: 'عيد ميلاد سعيد {name}! 🎂 هدية منا: وجبة مجانية احتفالاً بيومك الخاص. تفضل بزيارتنا!' },
    { label: 'نقاط الولاء', icon: '🎁', body: 'مبروك {name}! لديك {points} نقطة في برنامج الولاء. يمكنك استبدالها بخصومات رائعة!' },
  ],
  employees: [
    { label: 'تذكير بالشيفت', icon: '⏰', body: 'تذكير: شيفتك يبدأ الساعة {time} غداً. يرجى الحضور في الموعد. شكراً!' },
    { label: 'إشعار راتب', icon: '💰', body: 'تم تحويل راتبك لشهر {month}. يرجى مراجعة حسابك البنكي.' },
    { label: 'اجتماع عام', icon: '📢', body: 'إشعار: اجتماع الفريق يوم {day} الساعة {time}. الحضور إلزامي.' },
    { label: 'تقييم الأداء', icon: '⭐', body: 'تم رفع تقييم أدائك الشهري. تفضل بمراجعة النتائج مع المدير المباشر.' },
    { label: 'عطلة رسمية', icon: '🏖️', body: 'إشعار: {date} عطلة رسمية. يرجى مراجعة جدول الشيفتات المعدّل.' },
  ],
}

type Tab = 'customers' | 'employees'
type Channel = 'whatsapp' | 'email' | 'sms'

export default function NotificationsPage() {
  const sbRef = useRef(createClient())
  const sb = sbRef.current

  const [tab, setTab] = useState<Tab>('customers')
  const [customers, setCustomers] = useState<Contact[]>([])
  const [employees, setEmployees] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [channel, setChannel] = useState<Channel>('whatsapp')
  const [message, setMessage] = useState('')
  const [subject, setSubject] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const [history, setHistory] = useState<{time:string;channel:string;count:number;preview:string}[]>([])

  const contacts = tab === 'customers' ? customers : employees
  const filtered = contacts.filter(c => !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.phone?.includes(search) || c.email?.toLowerCase().includes(search.toLowerCase()))

  useEffect(() => {
    Promise.all([
      sb.from('customers').select('id,name,phone,email').order('name'),
      sb.from('employees').select('id,name,phone,email,role').eq('is_active', true).order('name'),
    ]).then(([custRes, empRes]) => {
      setCustomers((custRes.data || []).map((c:any) => ({ ...c, type: 'customer' })))
      setEmployees((empRes.data || []).map((e:any) => ({ ...e, type: 'employee' })))
      setLoading(false)
    })
  }, [])

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function selectAll() { setSelected(new Set(filtered.map(c => c.id))) }
  function clearAll() { setSelected(new Set()) }

  function applyTemplate(body: string) { setMessage(body) }

  function canSend(c: Contact) {
    if (channel === 'whatsapp' || channel === 'sms') return !!c.phone
    if (channel === 'email') return !!c.email
    return false
  }

  function getLink(c: Contact) {
    const msg = message.replace('{name}', c.name).replace('{points}', '500')
    if (channel === 'whatsapp' && c.phone) {
      const num = c.phone.replace(/\D/g, '')
      return `https://wa.me/${num}?text=${encodeURIComponent(msg)}`
    }
    if (channel === 'email' && c.email) {
      return `mailto:${c.email}?subject=${encodeURIComponent(subject || 'Orchid House')}&body=${encodeURIComponent(msg)}`
    }
    if (channel === 'sms' && c.phone) {
      return `sms:${c.phone}?body=${encodeURIComponent(msg)}`
    }
    return null
  }

  async function sendAll() {
    if (!message.trim()) { alert('اكتب الرسالة أولاً'); return }
    if (selected.size === 0) { alert('اختر المستلمين أولاً'); return }
    setSending(true)
    const selectedContacts = contacts.filter(c => selected.has(c.id) && canSend(c))
    const sentList: string[] = []

    for (const c of selectedContacts) {
      const link = getLink(c)
      if (link) {
        window.open(link, '_blank')
        sentList.push(c.name)
        await new Promise(r => setTimeout(r, 600))
      }
    }

    setSent(sentList)
    setHistory(prev => [{
      time: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
      channel, count: sentList.length,
      preview: message.slice(0, 60) + '...'
    }, ...prev.slice(0, 9)])
    setSending(false)
  }

  const selectedContacts = contacts.filter(c => selected.has(c.id))
  const canSendCount = selectedContacts.filter(canSend).length

  const inp: React.CSSProperties = { width: '100%', background: 'rgba(255,255,255,.04)', border: `1px solid ${S.border}`, borderRadius: 10, padding: '10px 14px', fontSize: 13, color: S.white, outline: 'none', fontFamily: 'Tajawal, sans-serif', boxSizing: 'border-box' as const }

  const CHANNEL_CFG = {
    whatsapp: { label: 'WhatsApp', icon: '📱', color: '#25D366', bg: 'rgba(37,211,102,0.12)', need: 'phone' },
    email:    { label: 'Email',    icon: '📧', color: S.blue,    bg: S.blueB,                  need: 'email' },
    sms:      { label: 'SMS',      icon: '💬', color: S.purple,  bg: S.purpleB,                need: 'phone' },
  }

  return (
    <div style={{ fontFamily: 'Tajawal, sans-serif', color: S.white, direction: 'rtl' }}>
      <style>{`select option{background:#0F2040;color:#FAFAF8} textarea{resize:vertical}`}</style>

      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 900, marginBottom: 4 }}>📲 إرسال الإشعارات</h1>
        <p style={{ fontSize: 13, color: S.muted }}>إرسال رسائل للعملاء والموظفين عبر WhatsApp أو Email أو SMS</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 20, alignItems: 'start' }}>

        {/* Left: Contacts */}
        <div>
          {/* Tabs */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            {([['customers','👥 العملاء', customers.length], ['employees','👷 الموظفون', employees.length]] as const).map(([k,l,count]) => (
              <button key={k} onClick={() => { setTab(k); setSelected(new Set()) }}
                style={{ padding: '10px 20px', borderRadius: 12, border: `1px solid ${tab===k?S.gold:S.border}`, background: tab===k?S.gold3:'transparent', color: tab===k?S.gold:S.muted, cursor: 'pointer', fontSize: 14, fontFamily: 'Tajawal, sans-serif', fontWeight: tab===k?800:400 }}>
                {l} ({count})
              </button>
            ))}
          </div>

          {/* Search + Select */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
            <input style={{ ...inp, flex: 1 }} placeholder="🔍 بحث..." value={search} onChange={e => setSearch(e.target.value)} />
            <button onClick={selectAll} style={{ padding: '9px 14px', borderRadius: 10, border: `1px solid ${S.green}`, background: S.greenB, color: S.green, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', whiteSpace: 'nowrap' }}>تحديد الكل</button>
            <button onClick={clearAll} style={{ padding: '9px 14px', borderRadius: 10, border: `1px solid ${S.muted}`, background: 'transparent', color: S.muted, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', whiteSpace: 'nowrap' }}>إلغاء الكل</button>
          </div>

          {/* Selection info */}
          {selected.size > 0 && (
            <div style={{ background: S.gold3, border: `1px solid ${S.gold}40`, borderRadius: 10, padding: '8px 14px', marginBottom: 12, fontSize: 12, color: S.gold, display: 'flex', gap: 10 }}>
              <span>✅ {selected.size} محدد</span>
              <span>·</span>
              <span style={{ color: canSendCount === selected.size ? S.green : S.amber }}>{canSendCount} يمكن إرساله عبر {CHANNEL_CFG[channel].label}</span>
            </div>
          )}

          {/* Contacts List */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: S.muted }}>⏳</div>
          ) : (
            <div style={{ background: S.navy2, borderRadius: 14, border: `1px solid ${S.border}`, overflow: 'hidden', maxHeight: 520, overflowY: 'auto' }}>
              {filtered.length === 0 ? (
                <div style={{ padding: 40, textAlign: 'center', color: S.muted }}>لا يوجد نتائج</div>
              ) : filtered.map(c => {
                const isSelected = selected.has(c.id)
                const hasChannel = canSend(c)
                return (
                  <div key={c.id} onClick={() => toggleSelect(c.id)}
                    style={{ padding: '12px 16px', borderBottom: `1px solid ${S.border}`, display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', background: isSelected ? 'rgba(201,168,76,0.08)' : 'transparent', opacity: hasChannel ? 1 : 0.5 }}>
                    <div style={{ width: 20, height: 20, borderRadius: 6, border: `2px solid ${isSelected ? S.gold : S.muted}`, background: isSelected ? S.gold : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {isSelected && <span style={{ color: S.navy, fontSize: 12, fontWeight: 900 }}>✓</span>}
                    </div>
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: `linear-gradient(135deg,${tab==='customers'?S.blue:S.purple},${tab==='customers'?S.teal:S.blue})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 800, color: S.white, flexShrink: 0 }}>
                      {c.name.charAt(0)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: S.white }}>{c.name}</div>
                      <div style={{ fontSize: 11, color: S.muted, display: 'flex', gap: 10 }}>
                        {c.phone && <span>📱 {c.phone}</span>}
                        {c.email && <span>📧 {c.email}</span>}
                        {(c as any).role && <span>👤 {(c as any).role}</span>}
                      </div>
                    </div>
                    {!hasChannel && (
                      <span style={{ fontSize: 10, color: S.red, background: S.redB, borderRadius: 20, padding: '2px 8px' }}>لا يوجد {channel === 'email' ? 'إيميل' : 'موبايل'}</span>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Right: Compose */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Channel */}
          <div style={{ background: S.navy2, borderRadius: 16, border: `1px solid ${S.border}`, padding: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: S.white, marginBottom: 12 }}>قناة الإرسال</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(Object.entries(CHANNEL_CFG) as [Channel, typeof CHANNEL_CFG[Channel]][]).map(([k, cfg]) => (
                <button key={k} onClick={() => setChannel(k)}
                  style={{ padding: '12px 16px', borderRadius: 12, border: `1px solid ${channel===k?cfg.color:S.border}`, background: channel===k?cfg.bg:'transparent', color: channel===k?cfg.color:S.muted, cursor: 'pointer', fontFamily: 'Tajawal, sans-serif', fontWeight: channel===k?700:400, display: 'flex', alignItems: 'center', gap: 10, fontSize: 14 }}>
                  <span style={{ fontSize: 22 }}>{cfg.icon}</span>
                  <div style={{ textAlign: 'right' }}>
                    <div>{cfg.label}</div>
                    <div style={{ fontSize: 10, opacity: 0.7 }}>يحتاج {cfg.need === 'phone' ? 'رقم موبايل' : 'إيميل'}</div>
                  </div>
                  {channel === k && <span style={{ marginRight: 'auto', fontSize: 16 }}>●</span>}
                </button>
              ))}
            </div>
          </div>

          {/* Templates */}
          <div style={{ background: S.navy2, borderRadius: 16, border: `1px solid ${S.border}`, padding: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: S.white, marginBottom: 12 }}>قوالب جاهزة</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {TEMPLATES[tab].map((t, i) => (
                <button key={i} onClick={() => applyTemplate(t.body)}
                  style={{ padding: '8px 12px', borderRadius: 10, border: `1px solid ${S.border}`, background: 'transparent', color: S.white, cursor: 'pointer', fontFamily: 'Tajawal, sans-serif', fontSize: 12, textAlign: 'right', display: 'flex', alignItems: 'center', gap: 8 }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
                  <span>{t.icon}</span><span>{t.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Compose */}
          <div style={{ background: S.navy2, borderRadius: 16, border: `1px solid ${S.border}`, padding: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: S.white, marginBottom: 12 }}>✍️ اكتب الرسالة</div>

            {channel === 'email' && (
              <div style={{ marginBottom: 10 }}>
                <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>الموضوع</label>
                <input style={inp} placeholder="Orchid House — عرض خاص" value={subject} onChange={e => setSubject(e.target.value)} />
              </div>
            )}

            <div style={{ marginBottom: 8 }}>
              <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>
                نص الرسالة
                <span style={{ color: S.muted, marginRight: 8, fontSize: 10 }}>يمكن استخدام {'{name}'} لاسم المستلم</span>
              </label>
              <textarea style={{ ...inp, minHeight: 120 }} placeholder="اكتب رسالتك هنا..." value={message} onChange={e => setMessage(e.target.value)} />
              <div style={{ fontSize: 11, color: S.muted, textAlign: 'left', marginTop: 4 }}>{message.length} حرف</div>
            </div>

            {/* Preview */}
            {message && selected.size > 0 && (() => {
              const first = contacts.find(c => selected.has(c.id))
              const preview = first ? message.replace('{name}', first.name).replace('{points}', '500') : message
              return (
                <div style={{ background: channel === 'whatsapp' ? '#075E54' : S.navy3, borderRadius: 12, padding: 14, marginBottom: 12 }}>
                  <div style={{ fontSize: 10, color: channel === 'whatsapp' ? '#90EE90' : S.muted, marginBottom: 6 }}>معاينة للمستلم الأول</div>
                  <div style={{ fontSize: 12, color: S.white, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{preview}</div>
                </div>
              )
            })()}

            {/* Send Button */}
            <button onClick={sendAll} disabled={sending || selected.size === 0 || !message.trim()}
              style={{ width: '100%', padding: '14px', borderRadius: 14, border: 'none', background: selected.size > 0 && message.trim() ? `linear-gradient(135deg,${CHANNEL_CFG[channel].color},${CHANNEL_CFG[channel].color}dd)` : '#333', color: S.white, cursor: selected.size > 0 && message.trim() ? 'pointer' : 'not-allowed', fontWeight: 900, fontSize: 16, fontFamily: 'Tajawal, sans-serif', boxShadow: selected.size > 0 ? `0 6px 20px ${CHANNEL_CFG[channel].color}40` : 'none' }}>
              {sending ? '⏳ جاري الإرسال...' : `${CHANNEL_CFG[channel].icon} إرسال لـ ${canSendCount} ${tab === 'customers' ? 'عميل' : 'موظف'}`}
            </button>

            {sent.length > 0 && (
              <div style={{ marginTop: 12, background: S.greenB, border: `1px solid ${S.green}40`, borderRadius: 10, padding: '10px 14px', fontSize: 12, color: S.green }}>
                ✅ تم الإرسال لـ {sent.length} جهة: {sent.slice(0,3).join('، ')}{sent.length > 3 ? ` وآخرون...` : ''}
              </div>
            )}
          </div>

          {/* History */}
          {history.length > 0 && (
            <div style={{ background: S.navy2, borderRadius: 16, border: `1px solid ${S.border}`, padding: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: S.white, marginBottom: 12 }}>📜 آخر الإرسالات</div>
              {history.map((h, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, padding: '8px 0', borderBottom: i < history.length-1 ? `1px solid ${S.border}` : 'none', alignItems: 'flex-start' }}>
                  <span style={{ fontSize: 18 }}>{CHANNEL_CFG[h.channel as Channel]?.icon || '📨'}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, color: S.white }}>أُرسل لـ <strong>{h.count}</strong> جهة</div>
                    <div style={{ fontSize: 11, color: S.muted }}>{h.preview}</div>
                  </div>
                  <div style={{ fontSize: 11, color: S.muted, whiteSpace: 'nowrap' }}>{h.time}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
