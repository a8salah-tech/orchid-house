'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useAuth } from '../../components/AuthProvider'
import { useLang } from '../../components/LanguageContext'

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
  pink: '#EC4899', pinkB: 'rgba(236,72,153,0.12)',
  card: 'rgba(255,255,255,0.04)', card2: 'rgba(255,255,255,0.08)',
}

const inp: React.CSSProperties = {
  width: '100%', background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.10)',
  borderRadius: 10, padding: '10px 14px', fontSize: 13,
  color: '#FAFAF8', outline: 'none', fontFamily: 'Tajawal, sans-serif',
  boxSizing: 'border-box', direction: 'rtl',
}

const PLATFORMS = [
  { key: 'instagram', label: 'Instagram', icon: '📸', color: '#E1306C' },
  { key: 'tiktok',    label: 'TikTok',    icon: '🎵', color: '#69C9D0' },
  { key: 'facebook',  label: 'Facebook',  icon: '👥', color: '#1877F2' },
  { key: 'google',    label: 'Google Maps', icon: '📍', color: '#34A853' },
  { key: 'zomato',    label: 'Zomato',    icon: '🍽️', color: '#E23744' },
  { key: 'talabat',   label: 'Talabat',   icon: '🛵', color: '#FF6B00' },
  { key: 'whatsapp',  label: 'WhatsApp',  icon: '💬', color: '#25D366' },
  { key: 'other',     label: 'أخرى',      icon: '🌐', color: '#8B5CF6' },
]

const CONTENT_TYPES = ['صورة', 'فيديو', 'ريلز', 'ستوري', 'إعلان مدفوع', 'تعاون مع مؤثر', 'عرض خاص', 'أخرى']
const MONTHS_AR = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر']

export default function MarketingPage() {
  const sb = createClient()
  const { employee, permissions } = useAuth()
  const { isAr } = useLang()
  const isAdmin = permissions?.all === true
  const isBranchManager = employee?.role === 'branch_manager'
  const canManage = isAdmin || isBranchManager

  const [activeTab, setActiveTab] = useState(canManage ? 'overview' : 'suggestions')
  const [suggestions, setSuggestions] = useState<any[]>([])
  const [campaigns, setCampaigns] = useState<any[]>([])
  const [calendar, setCalendar] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // Modals
  const [showSuggest, setShowSuggest] = useState(false)
  const [showCampaign, setShowCampaign] = useState(false)
  const [showCalendar, setShowCalendar] = useState(false)
  const [editCampaign, setEditCampaign] = useState<any>(null)

  // Forms
  const [suggestForm, setSuggestForm] = useState({ title: '', description: '', platform: '' })
  const [campForm, setCampForm] = useState({ name: '', platform: '', start_date: '', end_date: '', budget: '', reach: '', clicks: '', conversions: '', revenue_impact: '', notes: '', status: 'active' })
  const [calForm, setCalForm] = useState({ platform: '', content_type: '', title: '', scheduled_date: '', notes: '', status: 'planned' })
  const [saving, setSaving] = useState(false)

  // Social stats (manual)
  const [socialStats, setSocialStats] = useState<Record<string, { followers: string; engagement: string; link: string }>>({})

  const [calMonth, setCalMonth] = useState(new Date().getMonth())
  const [calYear, setCalYear] = useState(new Date().getFullYear())

  async function fetchAll() {
    setLoading(true)
    const [sugRes, campRes, calRes] = await Promise.all([
      sb.from('marketing_suggestions').select('*, employees(name,name_en,department)').order('created_at', { ascending: false }),
      sb.from('marketing_campaigns').select('*').order('start_date', { ascending: false }),
      sb.from('marketing_calendar').select('*').order('scheduled_date'),
    ])
    setSuggestions(sugRes.data || [])
    setCampaigns(campRes.data || [])
    setCalendar(calRes.data || [])
    setLoading(false)
  }

  useEffect(() => { if (employee?.id) fetchAll() }, [employee?.id])

  async function saveSuggestion() {
    if (!suggestForm.title) { alert('يرجى إدخال عنوان الاقتراح'); return }
    setSaving(true)
    await sb.from('marketing_suggestions').insert([{ ...suggestForm, employee_id: employee?.id, status: 'pending' }])
    setSaving(false)
    setShowSuggest(false)
    setSuggestForm({ title: '', description: '', platform: '' })
    fetchAll()
  }

  async function saveCampaign() {
    if (!campForm.name || !campForm.platform) { alert('يرجى إكمال البيانات'); return }
    setSaving(true)
    const payload = { ...campForm, budget: parseFloat(campForm.budget)||0, reach: parseInt(campForm.reach)||0, clicks: parseInt(campForm.clicks)||0, conversions: parseInt(campForm.conversions)||0, revenue_impact: parseFloat(campForm.revenue_impact)||0 }
    if (editCampaign) await sb.from('marketing_campaigns').update(payload).eq('id', editCampaign.id)
    else await sb.from('marketing_campaigns').insert([payload])
    setSaving(false)
    setShowCampaign(false)
    setEditCampaign(null)
    setCampForm({ name: '', platform: '', start_date: '', end_date: '', budget: '', reach: '', clicks: '', conversions: '', revenue_impact: '', notes: '', status: 'active' })
    fetchAll()
  }

  async function saveCalendar() {
    if (!calForm.title || !calForm.platform || !calForm.scheduled_date) { alert('يرجى إكمال البيانات'); return }
    setSaving(true)
    await sb.from('marketing_calendar').insert([calForm])
    setSaving(false)
    setShowCalendar(false)
    setCalForm({ platform: '', content_type: '', title: '', scheduled_date: '', notes: '', status: 'planned' })
    fetchAll()
  }

  async function updateSuggestionStatus(id: string, status: string, notes = '') {
    await sb.from('marketing_suggestions').update({ status, admin_notes: notes }).eq('id', id)
    fetchAll()
  }

  async function deleteCampaign(id: string) {
    if (!confirm('حذف هذه الحملة؟')) return
    await sb.from('marketing_campaigns').delete().eq('id', id)
    fetchAll()
  }

  async function updateCalStatus(id: string, status: string) {
    await sb.from('marketing_calendar').update({ status }).eq('id', id)
    fetchAll()
  }

  // Stats calculations
  const totalBudget = campaigns.reduce((s, c) => s + (c.budget || 0), 0)
  const totalRevenue = campaigns.reduce((s, c) => s + (c.revenue_impact || 0), 0)
  const totalReach = campaigns.reduce((s, c) => s + (c.reach || 0), 0)
  const roi = totalBudget > 0 ? ((totalRevenue - totalBudget) / totalBudget * 100).toFixed(1) : '0'
  const pendingSuggestions = suggestions.filter(s => s.status === 'pending').length
  const thisMonthCal = calendar.filter(c => {
    const d = new Date(c.scheduled_date)
    return d.getMonth() === calMonth && d.getFullYear() === calYear
  })

  const TABS = canManage ? [
    { key: 'overview',     label: '📊 نظرة عامة',        badge: 0 },
    { key: 'platforms',    label: '📱 المنصات',           badge: 0 },
    { key: 'campaigns',    label: '🚀 الحملات',           badge: 0 },
    { key: 'calendar',     label: '📅 التقويم',           badge: 0 },
    { key: 'suggestions',  label: '💡 اقتراحات الفريق',   badge: pendingSuggestions },
  ] : [
  ]

  return (
    <div style={{ fontFamily: 'Tajawal, sans-serif', direction: 'rtl', color: S.white }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700;800&display=swap');`}</style>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: S.white, marginBottom: 4 }}>📣 التسويق</h1>
          <p style={{ fontSize: 13, color: S.muted }}>إدارة الحملات والمنصات ومقترحات الفريق</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={() => setShowSuggest(true)} style={{ padding: '9px 16px', borderRadius: 10, border: `1px solid ${S.amber}`, background: S.amberB, color: S.amber, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>💡 اقتراح فكرة</button>
          {canManage && <>
            <button onClick={() => setShowCampaign(true)} style={{ padding: '9px 16px', borderRadius: 10, border: `1px solid ${S.purple}`, background: S.purpleB, color: S.purple, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>🚀 حملة جديدة</button>
            <button onClick={() => setShowCalendar(true)} style={{ padding: '9px 16px', borderRadius: 10, border: `1px solid ${S.blue}`, background: S.blueB, color: S.blue, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>📅 جدولة محتوى</button>
          </>}
          {!canManage && <p style={{ fontSize: 12, color: S.muted, alignSelf: 'center' }}>شاركنا أفكارك التسويقية 💡</p>}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            style={{ padding: '9px 16px', borderRadius: 10, border: `1px solid ${activeTab===t.key ? S.gold : S.border}`, background: activeTab===t.key ? S.gold3 : 'transparent', color: activeTab===t.key ? S.gold : S.muted, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: activeTab===t.key ? 700 : 400, display: 'flex', alignItems: 'center', gap: 6 }}>
            {t.label}
            {t.badge > 0 && <span style={{ background: S.amber, color: S.navy, borderRadius: 20, padding: '1px 7px', fontSize: 10, fontWeight: 800 }}>{t.badge}</span>}
          </button>
        ))}
      </div>

      {/* ══ نظرة عامة ══ */}
      {activeTab === 'overview' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12, marginBottom: 24 }}>
            {[
              { label: 'إجمالي الميزانية', value: `MYR ${totalBudget.toFixed(0)}`, color: S.red, bg: S.redB, icon: '💸' },
              { label: 'العائد من الحملات', value: `MYR ${totalRevenue.toFixed(0)}`, color: S.green, bg: S.greenB, icon: '💰' },
              { label: 'إجمالي الوصول', value: totalReach.toLocaleString(), color: S.blue, bg: S.blueB, icon: '👁️' },
              { label: 'ROI', value: `${roi}%`, color: parseFloat(roi) >= 0 ? S.green : S.red, bg: parseFloat(roi) >= 0 ? S.greenB : S.redB, icon: '📈' },
              { label: 'الحملات النشطة', value: campaigns.filter(c=>c.status==='active').length, color: S.purple, bg: S.purpleB, icon: '🚀' },
              { label: 'اقتراحات معلقة', value: pendingSuggestions, color: S.amber, bg: S.amberB, icon: '💡' },
            ].map((s, i) => (
              <div key={i} style={{ background: s.bg, borderRadius: 14, border: `1px solid ${s.color}30`, padding: '16px' }}>
                <div style={{ fontSize: 22, marginBottom: 6 }}>{s.icon}</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: 11, color: S.muted, marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* أفضل الحملات */}
          <div style={{ background: S.navy2, borderRadius: 16, border: `1px solid ${S.border}`, padding: 20, marginBottom: 20 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: S.white, marginBottom: 16 }}>🏆 أفضل الحملات أداءً</div>
            {campaigns.length === 0 ? <div style={{ color: S.muted, fontSize: 13 }}>لا توجد حملات بعد</div> :
              [...campaigns].sort((a,b) => (b.revenue_impact||0)-(a.revenue_impact||0)).slice(0,5).map(c => {
                const plat = PLATFORMS.find(p => p.key === c.platform)
                const campRoi = c.budget > 0 ? ((c.revenue_impact - c.budget) / c.budget * 100).toFixed(0) : '0'
                return (
                  <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: `1px solid ${S.border}`, flexWrap: 'wrap', gap: 8 }}>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      <span style={{ fontSize: 20 }}>{plat?.icon || '🌐'}</span>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: S.white }}>{c.name}</div>
                        <div style={{ fontSize: 11, color: S.muted }}>{c.start_date} — {c.end_date}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                      <div style={{ textAlign: 'center' }}><div style={{ fontSize: 12, fontWeight: 700, color: S.blue }}>{(c.reach||0).toLocaleString()}</div><div style={{ fontSize: 10, color: S.muted }}>وصول</div></div>
                      <div style={{ textAlign: 'center' }}><div style={{ fontSize: 12, fontWeight: 700, color: S.green }}>MYR {c.revenue_impact||0}</div><div style={{ fontSize: 10, color: S.muted }}>عائد</div></div>
                      <span style={{ fontSize: 12, fontWeight: 700, color: parseFloat(campRoi) >= 0 ? S.green : S.red, background: parseFloat(campRoi) >= 0 ? S.greenB : S.redB, borderRadius: 20, padding: '3px 10px' }}>ROI {campRoi}%</span>
                    </div>
                  </div>
                )
              })
            }
          </div>

          {/* محتوى قادم */}
          <div style={{ background: S.navy2, borderRadius: 16, border: `1px solid ${S.border}`, padding: 20 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: S.white, marginBottom: 16 }}>📅 محتوى قادم هذا الأسبوع</div>
            {calendar.filter(c => {
              const d = new Date(c.scheduled_date)
              const now = new Date()
              const diff = (d.getTime() - now.getTime()) / (1000*60*60*24)
              return diff >= 0 && diff <= 7
            }).length === 0 ? <div style={{ color: S.muted, fontSize: 13 }}>لا يوجد محتوى مجدول هذا الأسبوع</div> :
              calendar.filter(c => {
                const d = new Date(c.scheduled_date)
                const now = new Date()
                const diff = (d.getTime() - now.getTime()) / (1000*60*60*24)
                return diff >= 0 && diff <= 7
              }).map(c => {
                const plat = PLATFORMS.find(p => p.key === c.platform)
                return (
                  <div key={c.id} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '8px 0', borderBottom: `1px solid ${S.border}` }}>
                    <span style={{ fontSize: 18 }}>{plat?.icon || '🌐'}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: S.white }}>{c.title}</div>
                      <div style={{ fontSize: 11, color: S.muted }}>{c.content_type} · {c.scheduled_date}</div>
                    </div>
                    <span style={{ fontSize: 11, color: c.status==='published'?S.green:c.status==='in_progress'?S.amber:S.blue, background: c.status==='published'?S.greenB:c.status==='in_progress'?S.amberB:S.blueB, borderRadius: 20, padding: '2px 8px' }}>
                      {c.status==='published'?'✅ نُشر':c.status==='in_progress'?'⏳ جاري':'📋 مخطط'}
                    </span>
                  </div>
                )
              })
            }
          </div>
        </div>
      )}

      {/* ══ المنصات ══ */}
      {activeTab === 'platforms' && (
        <div>
          <div style={{ fontSize: 13, color: S.muted, marginBottom: 16 }}>أدخل بيانات منصاتك — يتم حفظها محلياً في المتصفح</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 16 }}>
            {PLATFORMS.map(p => {
              const stats = socialStats[p.key] || { followers: '', engagement: '', link: '' }
              return (
                <div key={p.key} style={{ background: S.navy2, borderRadius: 16, border: `1px solid ${p.color}30`, overflow: 'hidden' }}>
                  <div style={{ height: 4, background: p.color }} />
                  <div style={{ padding: '16px 18px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                      <span style={{ fontSize: 24 }}>{p.icon}</span>
                      <div style={{ fontSize: 15, fontWeight: 800, color: S.white }}>{p.label}</div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div>
                        <label style={{ fontSize: 11, color: S.muted, display: 'block', marginBottom: 3 }}>👥 عدد المتابعين</label>
                        <input style={inp} value={stats.followers} onChange={e => setSocialStats(prev => ({ ...prev, [p.key]: { ...stats, followers: e.target.value } }))} placeholder="مثال: 15,000" />
                      </div>
                      <div>
                        <label style={{ fontSize: 11, color: S.muted, display: 'block', marginBottom: 3 }}>📊 معدل التفاعل %</label>
                        <input style={inp} value={stats.engagement} onChange={e => setSocialStats(prev => ({ ...prev, [p.key]: { ...stats, engagement: e.target.value } }))} placeholder="مثال: 4.5%" />
                      </div>
                      <div>
                        <label style={{ fontSize: 11, color: S.muted, display: 'block', marginBottom: 3 }}>🔗 رابط الصفحة</label>
                        <input style={{ ...inp, direction: 'ltr' }} value={stats.link} onChange={e => setSocialStats(prev => ({ ...prev, [p.key]: { ...stats, link: e.target.value } }))} placeholder="https://..." />
                      </div>
                      {stats.link && <a href={stats.link} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: p.color, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}>🔗 فتح الصفحة ↗</a>}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ══ الحملات ══ */}
      {activeTab === 'campaigns' && (
        <div>
          {loading ? <div style={{ textAlign: 'center', padding: 60, color: S.muted }}>⏳</div>
          : campaigns.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, background: S.navy2, borderRadius: 16, border: `1px solid ${S.border}` }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🚀</div>
              <div style={{ color: S.muted }}>لا توجد حملات بعد</div>
            </div>
          ) : campaigns.map(c => {
            const plat = PLATFORMS.find(p => p.key === c.platform)
            const campRoi = c.budget > 0 ? ((c.revenue_impact - c.budget) / c.budget * 100).toFixed(1) : '0'
            return (
              <div key={c.id} style={{ background: S.navy2, borderRadius: 16, border: `1px solid ${S.border}`, padding: 20, marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <div style={{ width: 44, height: 44, borderRadius: 12, background: (plat?.color||S.gold)+'20', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>{plat?.icon||'🌐'}</div>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: S.white }}>{c.name}</div>
                      <div style={{ fontSize: 12, color: S.muted }}>{plat?.label} · {c.start_date} — {c.end_date}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ fontSize: 11, color: c.status==='active'?S.green:S.muted, background: c.status==='active'?S.greenB:S.card, borderRadius: 20, padding: '3px 10px' }}>{c.status==='active'?'✅ نشطة':'🏁 منتهية'}</span>
                    {canManage && <>
                      <button onClick={() => { setEditCampaign(c); setCampForm({ name:c.name, platform:c.platform, start_date:c.start_date||'', end_date:c.end_date||'', budget:c.budget||'', reach:c.reach||'', clicks:c.clicks||'', conversions:c.conversions||'', revenue_impact:c.revenue_impact||'', notes:c.notes||'', status:c.status }); setShowCampaign(true) }} style={{ padding: '5px 10px', borderRadius: 8, border: `1px solid ${S.gold}`, background: S.gold3, color: S.gold, cursor: 'pointer', fontSize: 12 }}>✏️</button>
                      <button onClick={() => deleteCampaign(c.id)} style={{ padding: '5px 10px', borderRadius: 8, border: `1px solid ${S.red}`, background: S.redB, color: S.red, cursor: 'pointer', fontSize: 12 }}>🗑️</button>
                    </>}
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(100px,1fr))', gap: 10 }}>
                  {[
                    { label: 'الميزانية', value: `MYR ${c.budget||0}`, color: S.red },
                    { label: 'العائد', value: `MYR ${c.revenue_impact||0}`, color: S.green },
                    { label: 'ROI', value: `${campRoi}%`, color: parseFloat(campRoi)>=0?S.green:S.red },
                    { label: 'الوصول', value: (c.reach||0).toLocaleString(), color: S.blue },
                    { label: 'النقرات', value: (c.clicks||0).toLocaleString(), color: S.purple },
                    { label: 'التحويلات', value: c.conversions||0, color: S.teal },
                  ].map((s,i) => (
                    <div key={i} style={{ background: S.card, borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}>
                      <div style={{ fontSize: 14, fontWeight: 800, color: s.color }}>{s.value}</div>
                      <div style={{ fontSize: 10, color: S.muted, marginTop: 2 }}>{s.label}</div>
                    </div>
                  ))}
                </div>
                {c.notes && <div style={{ marginTop: 12, fontSize: 12, color: S.muted, background: S.card, borderRadius: 8, padding: '8px 12px' }}>📝 {c.notes}</div>}
              </div>
            )
          })}
        </div>
      )}

      {/* ══ التقويم ══ */}
      {activeTab === 'calendar' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <button onClick={() => { if(calMonth===0){setCalMonth(11);setCalYear(y=>y-1)}else setCalMonth(m=>m-1) }} style={{ padding: '7px 14px', borderRadius: 8, border: `1px solid ${S.border}`, background: 'transparent', color: S.muted, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif' }}>← السابق</button>
            <span style={{ fontSize: 15, fontWeight: 800, color: S.white }}>{MONTHS_AR[calMonth]} {calYear}</span>
            <button onClick={() => { if(calMonth===11){setCalMonth(0);setCalYear(y=>y+1)}else setCalMonth(m=>m+1) }} style={{ padding: '7px 14px', borderRadius: 8, border: `1px solid ${S.border}`, background: 'transparent', color: S.muted, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif' }}>التالي →</button>
          </div>
          {thisMonthCal.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, background: S.navy2, borderRadius: 16, border: `1px solid ${S.border}` }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>📅</div>
              <div style={{ color: S.muted }}>لا يوجد محتوى مجدول هذا الشهر</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {thisMonthCal.map(c => {
                const plat = PLATFORMS.find(p => p.key === c.platform)
                return (
                  <div key={c.id} style={{ background: S.navy2, borderRadius: 14, border: `1px solid ${S.border}`, padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                      <div style={{ width: 40, height: 40, borderRadius: 10, background: (plat?.color||S.gold)+'20', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>{plat?.icon||'🌐'}</div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: S.white }}>{c.title}</div>
                        <div style={{ fontSize: 11, color: S.muted }}>{c.content_type} · 📅 {c.scheduled_date}</div>
                        {c.notes && <div style={{ fontSize: 11, color: S.muted }}>📝 {c.notes}</div>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span style={{ fontSize: 11, color: c.status==='published'?S.green:c.status==='in_progress'?S.amber:S.blue, background: c.status==='published'?S.greenB:c.status==='in_progress'?S.amberB:S.blueB, borderRadius: 20, padding: '3px 10px' }}>
                        {c.status==='published'?'✅ نُشر':c.status==='in_progress'?'⏳ جاري':'📋 مخطط'}
                      </span>
                      {canManage && c.status !== 'published' && (
                        <button onClick={() => updateCalStatus(c.id, c.status==='planned'?'in_progress':'published')}
                          style={{ padding: '5px 10px', borderRadius: 8, border: `1px solid ${S.green}`, background: S.greenB, color: S.green, cursor: 'pointer', fontSize: 11, fontFamily: 'Tajawal, sans-serif' }}>
                          {c.status==='planned'?'▶️ ابدأ':'✅ نشر'}
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ══ اقتراحات الفريق ══ */}
      {activeTab === 'suggestions' && (
        <div>
          {(canManage ? suggestions : suggestions.filter(s => s.employee_id === employee?.id)).length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, background: S.navy2, borderRadius: 16, border: `1px solid ${S.border}` }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>💡</div>
              <div style={{ color: S.muted }}>لا توجد اقتراحات بعد</div>
            </div>
          ) : (canManage ? suggestions : suggestions.filter(s => s.employee_id === employee?.id)).map(s => {
            const plat = PLATFORMS.find(p => p.key === s.platform)
            const ST: any = { pending: { label: '⏳ قيد المراجعة', color: S.amber, bg: S.amberB }, approved: { label: '✅ معتمد', color: S.green, bg: S.greenB }, rejected: { label: '❌ مرفوض', color: S.red, bg: S.redB } }
            const st = ST[s.status] || ST.pending
            return (
              <div key={s.id} style={{ background: S.navy2, borderRadius: 14, border: `1px solid ${S.border}`, padding: '16px 20px', marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                      {plat && <span style={{ fontSize: 16 }}>{plat.icon}</span>}
                      <div style={{ fontSize: 14, fontWeight: 700, color: S.white }}>{s.title}</div>
                    </div>
                    {s.description && <div style={{ fontSize: 12, color: S.muted, marginBottom: 6 }}>{s.description}</div>}
                    <div style={{ fontSize: 11, color: S.muted }}>👤 {s.employees?.name} · {new Date(s.created_at).toLocaleDateString('ar-SA')}</div>
                    {s.admin_notes && <div style={{ fontSize: 12, color: S.blue, marginTop: 6, background: S.blueB, borderRadius: 8, padding: '6px 10px' }}>💬 {s.admin_notes}</div>}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: st.color, background: st.bg, borderRadius: 20, padding: '3px 12px' }}>{st.label}</span>
                    {canManage && s.status === 'pending' && (
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => updateSuggestionStatus(s.id, 'approved')} style={{ padding: '5px 10px', borderRadius: 8, border: `1px solid ${S.green}`, background: S.greenB, color: S.green, cursor: 'pointer', fontSize: 11 }}>✅ موافقة</button>
                        <button onClick={() => { const n = prompt('سبب الرفض:'); if(n!==null) updateSuggestionStatus(s.id, 'rejected', n) }} style={{ padding: '5px 10px', borderRadius: 8, border: `1px solid ${S.red}`, background: S.redB, color: S.red, cursor: 'pointer', fontSize: 11 }}>❌ رفض</button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ══ Modal: اقتراح فكرة ══ */}
      {showSuggest && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: S.navy2, borderRadius: 20, border: `1px solid ${S.amber}40`, width: '100%', maxWidth: 460, padding: 28 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ color: S.amber, fontSize: 17, fontWeight: 800 }}>💡 اقتراح فكرة تسويقية</h2>
              <button onClick={() => setShowSuggest(false)} style={{ background: 'transparent', border: 'none', color: S.muted, fontSize: 20, cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 4 }}>عنوان الفكرة *</label>
                <input style={inp} value={suggestForm.title} onChange={e => setSuggestForm(p => ({ ...p, title: e.target.value }))} placeholder="مثال: حملة رمضان على إنستجرام" />
              </div>
              <div>
                <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 4 }}>المنصة</label>
                <select style={{ ...inp, cursor: 'pointer', background: S.navy3 }} value={suggestForm.platform} onChange={e => setSuggestForm(p => ({ ...p, platform: e.target.value }))}>
                  <option value="">-- اختر --</option>
                  {PLATFORMS.map(p => <option key={p.key} value={p.key}>{p.icon} {p.label}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 4 }}>تفاصيل الفكرة</label>
                <textarea style={{ ...inp, minHeight: 80, resize: 'none' } as React.CSSProperties} value={suggestForm.description} onChange={e => setSuggestForm(p => ({ ...p, description: e.target.value }))} placeholder="اشرح فكرتك بالتفصيل..." />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowSuggest(false)} style={{ padding: '10px 20px', borderRadius: 10, border: `1px solid ${S.muted}`, background: 'transparent', color: S.muted, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif' }}>إلغاء</button>
              <button onClick={saveSuggestion} disabled={saving} style={{ padding: '10px 24px', borderRadius: 10, border: `1px solid ${S.amber}`, background: S.amberB, color: S.amber, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
                {saving ? '⏳' : '💡 إرسال الاقتراح'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ Modal: حملة جديدة ══ */}
      {showCampaign && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 300, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 20, overflowY: 'auto' }}>
          <div style={{ background: S.navy2, borderRadius: 20, border: `1px solid ${S.purple}40`, width: '100%', maxWidth: 520, padding: 28, margin: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ color: S.purple, fontSize: 17, fontWeight: 800 }}>🚀 {editCampaign ? 'تعديل الحملة' : 'حملة جديدة'}</h2>
              <button onClick={() => { setShowCampaign(false); setEditCampaign(null) }} style={{ background: 'transparent', border: 'none', color: S.muted, fontSize: 20, cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 4 }}>اسم الحملة *</label>
                <input style={inp} value={campForm.name} onChange={e => setCampForm(p => ({ ...p, name: e.target.value }))} placeholder="مثال: حملة عيد الفطر" />
              </div>
              <div>
                <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 4 }}>المنصة *</label>
                <select style={{ ...inp, cursor: 'pointer', background: S.navy3 }} value={campForm.platform} onChange={e => setCampForm(p => ({ ...p, platform: e.target.value }))}>
                  <option value="">-- اختر --</option>
                  {PLATFORMS.map(p => <option key={p.key} value={p.key}>{p.icon} {p.label}</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 4 }}>تاريخ البداية</label>
                  <input type="date" style={inp} value={campForm.start_date} onChange={e => setCampForm(p => ({ ...p, start_date: e.target.value }))} />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 4 }}>تاريخ النهاية</label>
                  <input type="date" style={inp} value={campForm.end_date} onChange={e => setCampForm(p => ({ ...p, end_date: e.target.value }))} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 4 }}>💸 الميزانية (MYR)</label>
                  <input type="number" style={{ ...inp, direction: 'ltr' }} value={campForm.budget} onChange={e => setCampForm(p => ({ ...p, budget: e.target.value }))} placeholder="0.00" />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 4 }}>💰 العائد (MYR)</label>
                  <input type="number" style={{ ...inp, direction: 'ltr' }} value={campForm.revenue_impact} onChange={e => setCampForm(p => ({ ...p, revenue_impact: e.target.value }))} placeholder="0.00" />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 4 }}>👁️ الوصول</label>
                  <input type="number" style={{ ...inp, direction: 'ltr' }} value={campForm.reach} onChange={e => setCampForm(p => ({ ...p, reach: e.target.value }))} placeholder="0" />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 4 }}>🖱️ النقرات</label>
                  <input type="number" style={{ ...inp, direction: 'ltr' }} value={campForm.clicks} onChange={e => setCampForm(p => ({ ...p, clicks: e.target.value }))} placeholder="0" />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 4 }}>✅ التحويلات</label>
                  <input type="number" style={{ ...inp, direction: 'ltr' }} value={campForm.conversions} onChange={e => setCampForm(p => ({ ...p, conversions: e.target.value }))} placeholder="0" />
                </div>
              </div>
              <div>
                <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 4 }}>الحالة</label>
                <select style={{ ...inp, cursor: 'pointer', background: S.navy3 }} value={campForm.status} onChange={e => setCampForm(p => ({ ...p, status: e.target.value }))}>
                  <option value="active">✅ نشطة</option>
                  <option value="ended">🏁 منتهية</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 4 }}>ملاحظات</label>
                <textarea style={{ ...inp, minHeight: 60, resize: 'none' } as React.CSSProperties} value={campForm.notes} onChange={e => setCampForm(p => ({ ...p, notes: e.target.value }))} placeholder="أي ملاحظات..." />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
              <button onClick={() => { setShowCampaign(false); setEditCampaign(null) }} style={{ padding: '10px 20px', borderRadius: 10, border: `1px solid ${S.muted}`, background: 'transparent', color: S.muted, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif' }}>إلغاء</button>
              <button onClick={saveCampaign} disabled={saving} style={{ padding: '10px 24px', borderRadius: 10, border: `1px solid ${S.purple}`, background: S.purpleB, color: S.purple, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
                {saving ? '⏳' : (editCampaign ? '💾 حفظ' : '🚀 إضافة الحملة')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ Modal: جدولة محتوى ══ */}
      {showCalendar && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: S.navy2, borderRadius: 20, border: `1px solid ${S.blue}40`, width: '100%', maxWidth: 460, padding: 28 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ color: S.blue, fontSize: 17, fontWeight: 800 }}>📅 جدولة محتوى</h2>
              <button onClick={() => setShowCalendar(false)} style={{ background: 'transparent', border: 'none', color: S.muted, fontSize: 20, cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 4 }}>عنوان المحتوى *</label>
                <input style={inp} value={calForm.title} onChange={e => setCalForm(p => ({ ...p, title: e.target.value }))} placeholder="مثال: بوست ترويجي للمنيو الجديد" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 4 }}>المنصة *</label>
                  <select style={{ ...inp, cursor: 'pointer', background: S.navy3 }} value={calForm.platform} onChange={e => setCalForm(p => ({ ...p, platform: e.target.value }))}>
                    <option value="">-- اختر --</option>
                    {PLATFORMS.map(p => <option key={p.key} value={p.key}>{p.icon} {p.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 4 }}>نوع المحتوى</label>
                  <select style={{ ...inp, cursor: 'pointer', background: S.navy3 }} value={calForm.content_type} onChange={e => setCalForm(p => ({ ...p, content_type: e.target.value }))}>
                    <option value="">-- اختر --</option>
                    {CONTENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 4 }}>تاريخ النشر *</label>
                <input type="date" style={inp} value={calForm.scheduled_date} onChange={e => setCalForm(p => ({ ...p, scheduled_date: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 4 }}>ملاحظات</label>
                <textarea style={{ ...inp, minHeight: 60, resize: 'none' } as React.CSSProperties} value={calForm.notes} onChange={e => setCalForm(p => ({ ...p, notes: e.target.value }))} placeholder="أي تفاصيل إضافية..." />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowCalendar(false)} style={{ padding: '10px 20px', borderRadius: 10, border: `1px solid ${S.muted}`, background: 'transparent', color: S.muted, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif' }}>إلغاء</button>
              <button onClick={saveCalendar} disabled={saving} style={{ padding: '10px 24px', borderRadius: 10, border: `1px solid ${S.blue}`, background: S.blueB, color: S.blue, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
                {saving ? '⏳' : '📅 جدولة'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
