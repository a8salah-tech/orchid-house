'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useAuth } from '../../../components/AuthProvider'

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
  card: 'rgba(255,255,255,0.04)', card2: 'rgba(255,255,255,0.07)',
}

const CATEGORIES = [
  { key: 'general',    label: 'عام',              label_en: 'General',         icon: '📋' },
  { key: 'attendance', label: 'الحضور والدوام',   label_en: 'Attendance',      icon: '⏰' },
  { key: 'conduct',    label: 'سلوك العمل',       label_en: 'Conduct',         icon: '🤝' },
  { key: 'safety',     label: 'السلامة',          label_en: 'Safety',          icon: '🦺' },
  { key: 'hygiene',    label: 'النظافة الشخصية',  label_en: 'Hygiene',         icon: '🧼' },
  { key: 'uniform',    label: 'الزي الرسمي',      label_en: 'Uniform',         icon: '👔' },
  { key: 'leave',      label: 'الإجازات',         label_en: 'Leave',           icon: '🏖️' },
  { key: 'social',     label: 'التواصل الاجتماعي', label_en: 'Social Media',   icon: '📱' },
]

type Policy = {
  id: string; title: string; title_en: string; content: string; content_en: string
  category: string; is_active: boolean; is_mandatory: boolean; created_at: string; updated_at: string
  acknowledgments?: { employee_id: string }[]
  acknowledged?: boolean
}

// ══ Policy Modal (Add/Edit) ══
function PolicyModal({ policy, onClose, onSaved }: { policy?: Policy | null; onClose: () => void; onSaved: () => void }) {
  const sb = createClient()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    title: policy?.title || '',
    title_en: policy?.title_en || '',
    content: policy?.content || '',
    content_en: policy?.content_en || '',
    category: policy?.category || 'general',
    is_mandatory: policy?.is_mandatory !== false,
    is_active: policy?.is_active !== false,
  })

  async function save() {
    if (!form.title.trim() || !form.content.trim()) { alert('العنوان والمحتوى مطلوبان'); return }
    setSaving(true)
    const payload = { ...form, updated_at: new Date().toISOString() }
    if (policy) {
      await sb.from('work_policies').update(payload).eq('id', policy.id)
    } else {
      await sb.from('work_policies').insert([payload])
    }
    setSaving(false)
    onSaved()
  }

  const inp: React.CSSProperties = { width: '100%', background: 'rgba(255,255,255,.04)', border: `1px solid ${S.border}`, borderRadius: 10, padding: '10px 14px', fontSize: 13, color: S.white, outline: 'none', fontFamily: 'Tajawal, sans-serif', boxSizing: 'border-box' as const }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.85)', zIndex: 400, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 20, overflowY: 'auto' }}>
      <div style={{ background: S.navy2, borderRadius: 20, border: `1px solid ${S.border}`, width: '100%', maxWidth: 640, padding: 28, margin: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 22 }}>
          <h2 style={{ color: S.white, fontSize: 17, fontWeight: 800 }}>{policy ? '✏️ تعديل السياسة' : '➕ إضافة سياسة جديدة'}</h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: S.muted, fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Category */}
          <div>
            <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 6 }}>التصنيف</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {CATEGORIES.map(c => (
                <button key={c.key} onClick={() => setForm(p => ({ ...p, category: c.key }))}
                  style={{ padding: '6px 12px', borderRadius: 20, border: `1px solid ${form.category === c.key ? S.gold : S.border}`, background: form.category === c.key ? S.gold3 : 'transparent', color: form.category === c.key ? S.gold : S.muted, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif' }}>
                  {c.icon} {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Titles */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>العنوان (عربي) *</label>
              <input style={inp} value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="مثال: سياسة الحضور والانصراف" />
            </div>
            <div>
              <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>Title (English)</label>
              <input style={{ ...inp, direction: 'ltr' }} value={form.title_en} onChange={e => setForm(p => ({ ...p, title_en: e.target.value }))} placeholder="e.g. Attendance Policy" />
            </div>
          </div>

          {/* Content */}
          <div>
            <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>المحتوى (عربي) *</label>
            <textarea style={{ ...inp, minHeight: 120, resize: 'vertical' as const }} value={form.content} onChange={e => setForm(p => ({ ...p, content: e.target.value }))} placeholder="اكتب نص السياسة هنا..." />
          </div>
          <div>
            <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>Content (English)</label>
            <textarea style={{ ...inp, minHeight: 100, resize: 'vertical' as const, direction: 'ltr' }} value={form.content_en} onChange={e => setForm(p => ({ ...p, content_en: e.target.value }))} placeholder="Write policy content in English..." />
          </div>

          {/* Options */}
          <div style={{ display: 'flex', gap: 12 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', background: S.card, borderRadius: 10, padding: '10px 14px', flex: 1 }}>
              <input type="checkbox" checked={form.is_mandatory} onChange={e => setForm(p => ({ ...p, is_mandatory: e.target.checked }))} style={{ accentColor: S.red, width: 16, height: 16 }} />
              <div>
                <div style={{ fontSize: 12, color: S.white, fontWeight: 600 }}>إلزامية</div>
                <div style={{ fontSize: 10, color: S.muted }}>يجب على الكل قراءتها</div>
              </div>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', background: S.card, borderRadius: 10, padding: '10px 14px', flex: 1 }}>
              <input type="checkbox" checked={form.is_active} onChange={e => setForm(p => ({ ...p, is_active: e.target.checked }))} style={{ accentColor: S.green, width: 16, height: 16 }} />
              <div>
                <div style={{ fontSize: 12, color: S.white, fontWeight: 600 }}>نشطة</div>
                <div style={{ fontSize: 10, color: S.muted }}>ظاهرة للموظفين</div>
              </div>
            </label>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button onClick={onClose} style={{ padding: '11px 20px', borderRadius: 10, border: `1px solid ${S.muted}`, background: 'transparent', color: S.muted, cursor: 'pointer', fontFamily: 'Tajawal, sans-serif' }}>إلغاء</button>
          <button onClick={save} disabled={saving} style={{ flex: 1, padding: '11px', borderRadius: 10, border: 'none', background: `linear-gradient(135deg,${S.gold},${S.gold})`, color: S.navy, cursor: 'pointer', fontWeight: 800, fontSize: 14, fontFamily: 'Tajawal, sans-serif' }}>
            {saving ? '⏳ جاري الحفظ...' : '💾 حفظ السياسة'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ══ Acknowledgments Modal ══
function AckModal({ policy, onClose }: { policy: Policy; onClose: () => void }) {
  const sb = createClient()
  const [acks, setAcks] = useState<any[]>([])
  const [employees, setEmployees] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      sb.from('policy_acknowledgments').select('employee_id, acknowledged_at, employees(name, role)').eq('policy_id', policy.id),
      sb.from('employees').select('id, name, role').eq('is_active', true).order('name'),
    ]).then(([acksRes, empsRes]) => {
      setAcks(acksRes.data || [])
      setEmployees(empsRes.data || [])
      setLoading(false)
    })
  }, [])

  const ackedIds = new Set(acks.map((a: any) => a.employee_id))
  const notAcked = employees.filter(e => !ackedIds.has(e.id))

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.85)', zIndex: 400, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 20, overflowY: 'auto' }}>
      <div style={{ background: S.navy2, borderRadius: 20, border: `1px solid ${S.border}`, width: '100%', maxWidth: 560, padding: 28, margin: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <h2 style={{ color: S.white, fontSize: 16, fontWeight: 800, marginBottom: 4 }}>👁️ متابعة القراءة</h2>
            <p style={{ fontSize: 12, color: S.muted }}>{policy.title}</p>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: S.muted, fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 20 }}>
          {[
            { label: 'قرأوا', value: acks.length, color: S.green, bg: S.greenB },
            { label: 'لم يقرأوا', value: notAcked.length, color: S.red, bg: S.redB },
            { label: 'الإجمالي', value: employees.length, color: S.white, bg: S.card },
          ].map((s, i) => (
            <div key={i} style={{ background: s.bg, borderRadius: 12, padding: '12px 14px', textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 11, color: S.muted }}>{s.label}</div>
            </div>
          ))}
        </div>

        {loading ? <div style={{ textAlign: 'center', padding: 30, color: S.muted }}>⏳</div> : (
          <div>
            {/* قرأوا */}
            {acks.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: S.green, marginBottom: 8 }}>✅ قرأوا السياسة</div>
                {acks.map((a: any, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: S.greenB, borderRadius: 10, marginBottom: 6 }}>
                    <span style={{ fontSize: 13, color: S.white, fontWeight: 600 }}>{a.employees?.name}</span>
                    <span style={{ fontSize: 11, color: S.muted }}>{new Date(a.acknowledged_at).toLocaleDateString('ar-SA')}</span>
                  </div>
                ))}
              </div>
            )}

            {/* لم يقرأوا */}
            {notAcked.length > 0 && (
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: S.red, marginBottom: 8 }}>❌ لم يقرأوا بعد</div>
                {notAcked.map((e, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: S.redB, borderRadius: 10, marginBottom: 6 }}>
                    <span style={{ fontSize: 13, color: S.white }}>{e.name}</span>
                    <span style={{ fontSize: 11, color: S.muted }}>{e.role}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <button onClick={onClose} style={{ width: '100%', marginTop: 16, padding: '10px', borderRadius: 10, border: `1px solid ${S.border}`, background: 'transparent', color: S.muted, cursor: 'pointer', fontFamily: 'Tajawal, sans-serif' }}>إغلاق</button>
      </div>
    </div>
  )
}

// ══ Main Page ══
export default function PoliciesPage() {
  const sb = createClient()
  const { employee } = useAuth()
  const isAdmin = employee?.role === 'admin' || employee?.role === 'branch_manager'

  const [policies, setPolicies] = useState<Policy[]>([])
  const [loading, setLoading] = useState(true)
  const [catFilter, setCatFilter] = useState('all')
  const [showAdd, setShowAdd] = useState(false)
  const [editPolicy, setEditPolicy] = useState<Policy | null>(null)
  const [ackPolicy, setAckPolicy] = useState<Policy | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [acknowledging, setAcknowledging] = useState<string | null>(null)

  const fetchPolicies = useCallback(async () => {
    const q = sb.from('work_policies')
      .select('*, acknowledgments:policy_acknowledgments(employee_id)')
      .order('created_at', { ascending: false })

    if (!isAdmin) {
      q.eq('is_active', true)
    }

    const { data } = await q
    const policies = (data || []).map((p: any) => ({
      ...p,
      acknowledged: (p.acknowledgments || []).some((a: any) => a.employee_id === employee?.id)
    }))
    setPolicies(policies)
    setLoading(false)
  }, [sb, employee, isAdmin])

  useEffect(() => { fetchPolicies() }, [fetchPolicies])

  async function acknowledge(policyId: string) {
    setAcknowledging(policyId)
    await sb.from('policy_acknowledgments').upsert([{ policy_id: policyId, employee_id: employee?.id }], { onConflict: 'policy_id,employee_id' })
    setPolicies(prev => prev.map(p => p.id === policyId ? { ...p, acknowledged: true } : p))
    setAcknowledging(null)
  }

  async function deletePolicy(id: string) {
    if (!confirm('حذف هذه السياسة؟')) return
    await sb.from('work_policies').delete().eq('id', id)
    setPolicies(prev => prev.filter(p => p.id !== id))
  }

  async function toggleActive(policy: Policy) {
    await sb.from('work_policies').update({ is_active: !policy.is_active }).eq('id', policy.id)
    setPolicies(prev => prev.map(p => p.id === policy.id ? { ...p, is_active: !p.is_active } : p))
  }

  const filtered = policies.filter(p => catFilter === 'all' || p.category === catFilter)
  const mandatoryUnread = policies.filter(p => p.is_mandatory && p.is_active && !p.acknowledged).length

  return (
    <div style={{ fontFamily: 'Tajawal, sans-serif', color: S.white, direction: 'rtl' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 900, marginBottom: 4 }}>📜 سياسات العمل</h1>
          <p style={{ fontSize: 13, color: S.muted }}>Work Policies & Regulations</p>
        </div>
        {isAdmin && (
          <button onClick={() => setShowAdd(true)} style={{ padding: '10px 20px', borderRadius: 12, border: 'none', background: `linear-gradient(135deg,${S.gold},${S.gold})`, color: S.navy, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 800 }}>
            ➕ إضافة سياسة
          </button>
        )}
      </div>

      {/* Alert for unread mandatory */}
      {!isAdmin && mandatoryUnread > 0 && (
        <div style={{ background: S.redB, border: `1px solid ${S.red}40`, borderRadius: 14, padding: '14px 18px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 24 }}>⚠️</span>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: S.red }}>لديك {mandatoryUnread} سياسة إلزامية لم تقرأها بعد</div>
            <div style={{ fontSize: 12, color: S.muted }}>يرجى قراءة جميع السياسات والتأكيد عليها</div>
          </div>
        </div>
      )}

      {/* Stats (admin only) */}
      {isAdmin && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 12, marginBottom: 20 }}>
          {[
            { label: 'إجمالي السياسات', value: policies.length, color: S.white },
            { label: 'نشطة', value: policies.filter(p => p.is_active).length, color: S.green },
            { label: 'إلزامية', value: policies.filter(p => p.is_mandatory).length, color: S.red },
          ].map((s, i) => (
            <div key={i} style={{ background: S.card2, borderRadius: 14, border: `1px solid ${S.border}`, padding: '14px 16px', textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 11, color: S.muted }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Category Filter */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        <button onClick={() => setCatFilter('all')} style={{ padding: '7px 14px', borderRadius: 20, border: `1px solid ${catFilter === 'all' ? S.gold : S.border}`, background: catFilter === 'all' ? S.gold3 : 'transparent', color: catFilter === 'all' ? S.gold : S.muted, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif' }}>الكل</button>
        {CATEGORIES.map(c => (
          <button key={c.key} onClick={() => setCatFilter(c.key)} style={{ padding: '7px 14px', borderRadius: 20, border: `1px solid ${catFilter === c.key ? S.gold : S.border}`, background: catFilter === c.key ? S.gold3 : 'transparent', color: catFilter === c.key ? S.gold : S.muted, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif' }}>
            {c.icon} {c.label}
          </button>
        ))}
      </div>

      {/* Policies List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: S.muted }}>⏳ جاري التحميل...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 80 }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>📜</div>
          <div style={{ color: S.white, fontSize: 18, fontWeight: 700, marginBottom: 8 }}>لا توجد سياسات</div>
          {isAdmin && <div style={{ color: S.muted, fontSize: 13 }}>اضغط "إضافة سياسة" لإضافة أول سياسة عمل</div>}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filtered.map(policy => {
            const cat = CATEGORIES.find(c => c.key === policy.category) || CATEGORIES[0]
            const isExpanded = expanded === policy.id
            const ackCount = (policy.acknowledgments || []).length

            return (
              <div key={policy.id} style={{ background: S.navy2, borderRadius: 16, border: `1px solid ${policy.acknowledged ? S.green + '40' : !policy.is_active ? S.border : policy.is_mandatory ? S.amber + '30' : S.border}`, overflow: 'hidden', transition: 'all .2s' }}>
                {/* Header */}
                <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer' }} onClick={() => setExpanded(isExpanded ? null : policy.id)}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: S.card2, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
                    {cat.icon}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                      <span style={{ fontSize: 15, fontWeight: 800, color: S.white }}>{policy.title}</span>
                      {policy.is_mandatory && <span style={{ background: S.redB, color: S.red, borderRadius: 20, padding: '2px 8px', fontSize: 10, fontWeight: 700 }}>إلزامية</span>}
                      {!policy.is_active && <span style={{ background: S.card, color: S.muted, borderRadius: 20, padding: '2px 8px', fontSize: 10 }}>غير نشطة</span>}
                      {policy.acknowledged && <span style={{ background: S.greenB, color: S.green, borderRadius: 20, padding: '2px 8px', fontSize: 10, fontWeight: 700 }}>✅ تم القراءة</span>}
                    </div>
                    <div style={{ fontSize: 11, color: S.muted }}>{cat.label} · {new Date(policy.updated_at).toLocaleDateString('ar-SA')}</div>
                  </div>

                  {/* Admin actions */}
                  {isAdmin && (
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                      <button onClick={() => setAckPolicy(policy)} style={{ padding: '6px 10px', borderRadius: 8, border: `1px solid ${S.blue}`, background: S.blueB, color: S.blue, cursor: 'pointer', fontSize: 11 }}>
                        👁️ {ackCount}
                      </button>
                      <button onClick={() => setEditPolicy(policy)} style={{ padding: '6px 10px', borderRadius: 8, border: `1px solid ${S.gold}`, background: S.gold3, color: S.gold, cursor: 'pointer', fontSize: 11 }}>✏️</button>
                      <button onClick={() => toggleActive(policy)} style={{ padding: '6px 10px', borderRadius: 8, border: `1px solid ${policy.is_active ? S.amber : S.green}`, background: policy.is_active ? S.amberB : S.greenB, color: policy.is_active ? S.amber : S.green, cursor: 'pointer', fontSize: 11 }}>
                        {policy.is_active ? '⏸' : '▶'}
                      </button>
                      <button onClick={() => deletePolicy(policy.id)} style={{ padding: '6px 10px', borderRadius: 8, border: `1px solid ${S.red}`, background: S.redB, color: S.red, cursor: 'pointer', fontSize: 11 }}>🗑️</button>
                    </div>
                  )}

                  <span style={{ color: S.muted, fontSize: 16, flexShrink: 0 }}>{isExpanded ? '▲' : '▼'}</span>
                </div>

                {/* Expanded Content */}
                {isExpanded && (
                  <div style={{ padding: '0 20px 20px', borderTop: `1px solid ${S.border}` }}>
                    <div style={{ paddingTop: 16, fontSize: 14, color: S.white, lineHeight: 1.8, whiteSpace: 'pre-wrap', marginBottom: 16 }}>
                      {policy.content}
                    </div>
                    {policy.content_en && (
                      <div style={{ background: S.card, borderRadius: 10, padding: '12px 16px', marginBottom: 16, direction: 'ltr' }}>
                        <div style={{ fontSize: 11, color: S.muted, marginBottom: 6 }}>English</div>
                        <div style={{ fontSize: 13, color: S.muted, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{policy.content_en}</div>
                      </div>
                    )}

                    {/* Acknowledge Button */}
                    {!isAdmin && policy.is_active && (
                      policy.acknowledged ? (
                        <div style={{ background: S.greenB, border: `1px solid ${S.green}40`, borderRadius: 12, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontSize: 20 }}>✅</span>
                          <span style={{ fontSize: 13, color: S.green, fontWeight: 700 }}>لقد قرأت وفهمت هذه السياسة</span>
                        </div>
                      ) : (
                        <button onClick={() => acknowledge(policy.id)} disabled={acknowledging === policy.id}
                          style={{ width: '100%', padding: '13px', borderRadius: 12, border: 'none', background: `linear-gradient(135deg,${S.green},#14B8A6)`, color: S.white, cursor: 'pointer', fontWeight: 800, fontSize: 14, fontFamily: 'Tajawal, sans-serif' }}>
                          {acknowledging === policy.id ? '⏳...' : '✅ قرأت وفهمت هذه السياسة'}
                        </button>
                      )
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Modals */}
      {(showAdd || editPolicy) && (
        <PolicyModal policy={editPolicy} onClose={() => { setShowAdd(false); setEditPolicy(null) }} onSaved={() => { setShowAdd(false); setEditPolicy(null); fetchPolicies() }} />
      )}
      {ackPolicy && <AckModal policy={ackPolicy} onClose={() => setAckPolicy(null)} />}
    </div>
  )
}
