'use client'

import { useEffect, useState, useRef } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useAuth } from '../../components/AuthProvider'
import { useLang } from '../../components/LanguageContext'

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
  orange: '#F97316', orangeB: 'rgba(249,115,22,0.12)',
  purple: '#8B5CF6', purpleB: 'rgba(139,92,246,0.12)',
  teal: '#14B8A6', tealB: 'rgba(20,184,166,0.12)',
  card: 'rgba(255,255,255,0.04)',
}

const WASTE_TYPES = [
  { key: 'food',     labelAr: 'هدر وجبات',     labelEn: 'Food Waste',     icon: '🍽️', color: S.red,    bg: S.redB },
  { key: 'raw',      labelAr: 'مواد خام تالفة', labelEn: 'Raw Material',   icon: '🥩', color: S.orange, bg: S.orangeB },
  { key: 'breakage', labelAr: 'تكسير وكسر',     labelEn: 'Breakage',       icon: '💔', color: S.purple, bg: S.purpleB },
  { key: 'prep',     labelAr: 'هدر التحضير',    labelEn: 'Prep Waste',     icon: '⚗️', color: S.amber,  bg: S.amberB },
  { key: 'storage',  labelAr: 'هدر التخزين',    labelEn: 'Storage Loss',   icon: '🌡️', color: S.blue,   bg: S.blueB },
  { key: 'other',    labelAr: 'أخرى',           labelEn: 'Other',          icon: '📦', color: S.teal,   bg: S.tealB },
]

const DEPARTMENTS = ['المطبخ', 'الصالة', 'البار', 'الحلويات', 'الكاشير', 'التوصيل', 'المستودع']
const UNITS = ['كيلو جرام', 'جرام', 'لتر', 'مل', 'قطعة', 'علبة', 'طبق', 'كوب', 'كرتون']

const REASONS: Record<string, string[]> = {
  food:     ['طلب رجع من الزبون', 'وجبة خاطئة', 'انتهت صلاحية الطبق', 'جودة غير مقبولة', 'طلب ملغي'],
  raw:      ['انتهاء الصلاحية', 'تلف أثناء التخزين', 'سقوط وتلف', 'جودة غير مقبولة عند الاستلام', 'تلف أثناء النقل'],
  breakage: ['سقوط عرضي', 'تلف أثناء الغسيل', 'تلف أثناء النقل', 'استهلاك طبيعي'],
  prep:     ['قشر وبذور', 'نفايات التقطيع', 'فائض التحضير', 'اختبار وتذوق', 'هدر طبيعي'],
  storage:  ['انقطاع كهرباء', 'عطل ثلاجة', 'تجمد خاطئ', 'رطوبة زائدة', 'خطأ في الترتيب'],
  other:    ['سبب آخر'],
}

const inp: React.CSSProperties = {
  width: '100%', background: '#0F2040',
  border: '1px solid rgba(255,255,255,0.10)',
  borderRadius: 10, padding: '10px 14px', fontSize: 13,
  color: '#FAFAF8', outline: 'none', fontFamily: 'Tajawal, sans-serif',
  boxSizing: 'border-box', direction: 'rtl',
}

interface WasteLog {
  id: string
  waste_date: string
  waste_type: string
  item_name: string
  quantity: number
  unit: string
  cost: number
  reason: string
  notes: string
  department: string
  created_at: string
  image_url?: string
  status?: string
  estimated_cost?: number
  approved_by?: string
  approved_at?: string
  employees?: { name: string; name_en: string }
}

export default function WastePage() {
  const sb = useRef(createClient()).current
  const { employee } = useAuth()
  const { lang } = useLang()
  const isAr = lang !== 'en'

  const role = employee?.role || ''
  const isAdmin = role === 'admin' || (employee as any)?.permissions?.all === true
  const canRecord = isAdmin || ['kitchen_manager','hall_manager','bar_manager','kitchen_supervisor','hall_supervisor','bar_supervisor','branch_manager'].includes(role)
  const isBranchManager = role === 'branch_manager'
  const isDeptManager   = ['kitchen_manager','hall_manager','bar_manager'].includes(role)
  const isSupervisor    = ['kitchen_supervisor','hall_supervisor','bar_supervisor'].includes(role)

  const [logs, setLogs] = useState<WasteLog[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [saving, setSaving] = useState(false)
  const [filterType, setFilterType] = useState('all')
  const [filterMonth, setFilterMonth] = useState(new Date().toISOString().slice(0, 7))
  const [imgFile, setImgFile] = useState<File | null>(null)
  const [imgPreview, setImgPreview] = useState<string | null>(null)
  const [previewImg, setPreviewImg] = useState<string | null>(null)
  const [approvalModal, setApprovalModal] = useState<any | null>(null)
  const [estimatedCost, setEstimatedCost] = useState('')
  const [approvingSaving, setApprovingSaving] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const canApprove = isAdmin || isBranchManager || isDeptManager

  const [form, setForm] = useState({
    waste_date: new Date().toISOString().split('T')[0],
    waste_type: '',
    item_name: '',
    quantity: '',
    unit: '',
    cost: '',
    reason: '',
    notes: '',
    department: employee?.department || '',
  })

  async function fetchLogs() {
    if (!employee?.id) return
    setLoading(true)
    const [year, month] = filterMonth.split('-').map(Number)
    const start = new Date(year, month - 1, 1).toISOString().split('T')[0]
    const end   = new Date(year, month, 0).toISOString().split('T')[0]
    console.log('fetchLogs:', { isAdmin, start, end, employeeId: employee?.id })

    let q = sb.from('waste_logs')
      .select('*, employees!waste_logs_recorded_by_fkey(name,name_en), approver:employees!waste_logs_approved_by_fkey(name)')
      .gte('waste_date', start)
      .lte('waste_date', end)
      .order('waste_date', { ascending: false })
      .order('created_at', { ascending: false })

    if (!isAdmin) q = q.eq('branch_id', employee?.branch_id || '')
    // مدير الصالة يشوف الصالة فقط
    if (role === 'hall_manager') q = q.in('department', ['الصالة', 'Hall', 'hall'])
    // المشرف يشوف هدره هو فقط
    if (isSupervisor) q = q.eq('recorded_by', employee?.id || '')
    if (filterType !== 'all') q = q.eq('waste_type', filterType)

    const { data, error } = await q
    console.log('waste_logs result:', data?.length, 'error:', error, 'isAdmin:', isAdmin, 'branch_id:', employee?.branch_id)
    setLogs(data || [])
    setLoading(false)
  }

  useEffect(() => { if (employee?.id) fetchLogs() }, [employee?.id, filterMonth, filterType, isAdmin])

  async function save() {
    if (!form.waste_type || !form.item_name || !form.quantity) {
      alert(isAr ? 'يرجى إكمال الحقول المطلوبة' : 'Please fill required fields'); return
    }
    setSaving(true)
    let image_url = ''
    if (imgFile) {
      const ext = imgFile.name.split('.').pop()
      const path = `waste/${Date.now()}.${ext}`
      const { data: up } = await sb.storage.from('employees').upload(path, imgFile, { upsert: true })
      if (up) { const { data: u } = sb.storage.from('employees').getPublicUrl(up.path); image_url = u.publicUrl }
    }
    const { error } = await sb.from('waste_logs').insert([{
      waste_date: form.waste_date,
      waste_type: form.waste_type,
      item_name: form.item_name,
      quantity: parseFloat(form.quantity) || 0,
      unit: form.unit,
      cost: parseFloat(form.cost) || 0,
      reason: form.reason,
      notes: form.notes,
      department: form.department,
      branch_id: employee?.branch_id,
      recorded_by: employee?.id,
      image_url: image_url || null,
    }])
    setSaving(false)
    if (error) { alert('خطأ: ' + error.message); return }
    setShowAdd(false)
    setForm({ waste_date: new Date().toISOString().split('T')[0], waste_type: '', item_name: '', quantity: '', unit: '', cost: '', reason: '', notes: '', department: employee?.department || '' })
    setImgFile(null); setImgPreview(null)
    fetchLogs()
  }

  // ── Stats ──
  const totalCost  = logs.reduce((s, l) => s + (l.cost || 0), 0)
  const totalItems = logs.length
  const byType     = WASTE_TYPES.map(t => ({ ...t, count: logs.filter(l => l.waste_type === t.key).length, cost: logs.filter(l => l.waste_type === t.key).reduce((s, l) => s + (l.cost || 0), 0) }))
  const topType    = byType.sort((a, b) => b.cost - a.cost)[0]

  const wt = (key: string) => WASTE_TYPES.find(t => t.key === key)

  return (
    <div style={{ minHeight: '100vh', background: S.navy, fontFamily: 'Tajawal, sans-serif', direction: 'rtl', color: S.white, padding: '24px' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: S.white, marginBottom: 4 }}>🗑️ {isAr ? 'سجل الهدر' : 'Waste Log'}</h1>
          <p style={{ fontSize: 13, color: S.muted }}>{isAr ? 'تتبع وتحليل الهدر في المطعم' : 'Track and analyze restaurant waste'}</p>
        </div>
        {canRecord && (
          <button onClick={() => setShowAdd(true)} style={{ padding: '10px 20px', borderRadius: 12, border: '1px solid ' + S.red, background: S.redB, color: S.red, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
            ➕ {isAr ? 'تسجيل هدر' : 'Log Waste'}
          </button>
        )}
      </div>

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 20 }}>
        {[
          { label: isAr ? 'إجمالي الخسائر' : 'Total Loss', value: `MYR ${totalCost.toFixed(2)}`, color: S.red, bg: S.redB, icon: '💸' },
          { label: isAr ? 'عدد السجلات' : 'Records', value: totalItems, color: S.amber, bg: S.amberB, icon: '📋' },
          { label: isAr ? 'أعلى نوع هدر' : 'Top Waste', value: topType ? (isAr ? topType.labelAr : topType.labelEn) : '—', color: S.orange, bg: S.orangeB, icon: topType?.icon || '📊' },
          { label: isAr ? 'متوسط يومي' : 'Daily Avg', value: `MYR ${(totalCost / (new Date(parseInt(filterMonth.split('-')[0]), parseInt(filterMonth.split('-')[1]), 0).getDate()) || 0).toFixed(1)}`, color: S.purple, bg: S.purpleB, icon: '📈' },
        ].map((s, i) => (
          <div key={i} style={{ background: s.bg, borderRadius: 14, padding: '14px 16px', border: `1px solid ${s.color}30` }}>
            <div style={{ fontSize: 22, marginBottom: 6 }}>{s.icon}</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 11, color: S.muted, marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Type Filter Pills */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16, alignItems: 'center' }}>
        <input type="month" value={filterMonth} onChange={e => setFilterMonth(e.target.value)} style={{ ...inp, width: 'auto', padding: '8px 12px', fontSize: 12 }} />
        {[{ key: 'all', labelAr: 'الكل', icon: '🗂️' }, ...WASTE_TYPES].map(t => (
          <button key={t.key} onClick={() => setFilterType(t.key)}
            style={{ padding: '6px 14px', borderRadius: 20, border: `1px solid ${filterType === t.key ? ((t as any).color || S.gold) : S.border}`, background: filterType === t.key ? ((t as any).bg || S.gold3) : 'transparent', color: filterType === t.key ? ((t as any).color || S.gold) : S.muted, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', fontWeight: filterType === t.key ? 700 : 400 }}>
            {t.icon} {isAr ? (t as any).labelAr : ((t as any).labelEn || 'All')}
          </button>
        ))}
      </div>

      {/* Type Breakdown */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8, marginBottom: 20 }}>
        {WASTE_TYPES.map(t => {
          const stat = byType.find(b => b.key === t.key)
          return (
            <div key={t.key} style={{ background: S.card, borderRadius: 12, padding: '10px 12px', border: `1px solid ${S.border}`, cursor: 'pointer' }} onClick={() => setFilterType(t.key)}>
              <div style={{ fontSize: 20, marginBottom: 4 }}>{t.icon}</div>
              <div style={{ fontSize: 11, color: S.muted, marginBottom: 4 }}>{isAr ? t.labelAr : t.labelEn}</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: t.color }}>{stat?.count || 0}</div>
              <div style={{ fontSize: 10, color: S.muted }}>MYR {(stat?.cost || 0).toFixed(0)}</div>
            </div>
          )
        })}
      </div>

      {/* Logs List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: S.muted }}>⏳</div>
      ) : logs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, background: S.navy2, borderRadius: 16, border: `1px solid ${S.border}` }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
          <div style={{ color: S.muted }}>{isAr ? 'لا يوجد هدر مسجل في هذه الفترة' : 'No waste logged this period'}</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {logs.map(log => {
            const type = wt(log.waste_type)
            return (
              <div key={log.id} style={{ background: S.navy2, borderRadius: 14, border: `1px solid ${type?.color || S.border}22`, padding: '14px 18px', display: 'flex', gap: 14, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: type?.bg || S.card, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>{type?.icon || '📦'}</div>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: S.white, marginBottom: 2 }}>{log.item_name}</div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 11, background: type?.bg, color: type?.color, borderRadius: 8, padding: '2px 8px', fontWeight: 600 }}>{isAr ? type?.labelAr : type?.labelEn}</span>
                        {log.department && <span style={{ fontSize: 11, background: S.card, color: S.muted, borderRadius: 8, padding: '2px 8px' }}>{log.department}</span>}
                      </div>
                    </div>
                    <div style={{ textAlign: 'left' }}>
                      <div style={{ fontSize: 16, fontWeight: 800, color: log.cost > 0 ? S.red : S.muted }}>{log.cost > 0 ? `MYR ${log.cost.toFixed(2)}` : '—'}</div>
                      <div style={{ fontSize: 11, color: S.muted }}>{log.quantity} {log.unit}</div>
                    </div>
                  </div>
                  <div style={{ marginTop: 8, display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 11, color: S.muted }}>
                    {log.reason && <span>📌 {log.reason}</span>}
                    <span>📅 {log.waste_date}</span>
                    {log.employees?.name && <span>👤 {log.employees.name} {log.employees.name_en ? `(${log.employees.name_en})` : ''}</span>}
                  </div>
                  {log.notes && <div style={{ marginTop: 6, fontSize: 12, color: S.muted, background: S.card, borderRadius: 8, padding: '6px 10px' }}>💬 {log.notes}</div>}
                  {log.image_url && (
                    <img src={log.image_url} alt="مرفق" style={{ marginTop: 8, maxWidth: 160, maxHeight: 100, borderRadius: 8, border: `1px solid ${S.border}`, cursor: 'pointer' }} onClick={() => setPreviewImg(log.image_url!)} />
                  )}
                  {/* زر الاعتماد */}
                  {(isAdmin || isBranchManager || (isDeptManager && ['المطبخ','البار','الحلويات','Kitchen','Bar','Desserts'].includes(log.department))) && !log.approved_by && (
                    <button onClick={() => { setApprovalModal(log); setEstimatedCost(log.estimated_cost ? String(log.estimated_cost) : '') }}
                      style={{ marginTop: 8, padding: '5px 12px', borderRadius: 8, border: `1px solid ${S.green}`, background: S.greenB, color: S.green, cursor: 'pointer', fontSize: 11, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
                      ✅ اعتماد الهدر
                    </button>
                  )}
                  {log.approved_by && (
                    <div style={{ marginTop: 6, fontSize: 11, color: S.green }}>✅ معتمد بواسطة: {(log as any).approver?.name || '—'} {log.estimated_cost ? `· تقدير: ${log.estimated_cost} MYR` : ''}</div>
                  )}
                  {isAdmin && (
                    <button onClick={async () => {
                      if (!confirm('حذف هذا السجل؟')) return
                      await sb.from('waste_logs').delete().eq('id', log.id)
                      fetchLogs()
                    }} style={{ marginTop: 6, padding: '4px 10px', borderRadius: 8, border: `1px solid ${S.red}`, background: S.redB, color: S.red, cursor: 'pointer', fontSize: 11, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
                      🗑️ حذف
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Add Modal */}
      {showAdd && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, overflowY: 'auto' }}>
          <div style={{ background: S.navy2, borderRadius: 20, border: `1px solid ${S.border}`, width: '100%', maxWidth: 520, padding: 28, margin: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ color: S.red, fontSize: 17, fontWeight: 800 }}>🗑️ {isAr ? 'تسجيل هدر جديد' : 'Log New Waste'}</h2>
              <button onClick={() => setShowAdd(false)} style={{ background: 'transparent', border: 'none', color: S.muted, fontSize: 20, cursor: 'pointer' }}>✕</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

              {/* نوع الهدر */}
              <div>
                <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 8 }}>{isAr ? 'نوع الهدر *' : 'Waste Type *'}</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                  {WASTE_TYPES.map(t => (
                    <div key={t.key} onClick={() => setForm(p => ({ ...p, waste_type: t.key, reason: '' }))}
                      style={{ padding: '10px 8px', borderRadius: 10, border: `1px solid ${form.waste_type === t.key ? t.color : S.border}`, background: form.waste_type === t.key ? t.bg : 'transparent', cursor: 'pointer', textAlign: 'center' }}>
                      <div style={{ fontSize: 20 }}>{t.icon}</div>
                      <div style={{ fontSize: 11, color: form.waste_type === t.key ? t.color : S.muted, marginTop: 4, fontWeight: form.waste_type === t.key ? 700 : 400 }}>{isAr ? t.labelAr : t.labelEn}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* اسم الصنف */}
              <div>
                <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>{isAr ? 'اسم الصنف / العنصر *' : 'Item Name *'}</label>
                <input style={inp} value={form.item_name} onChange={e => setForm(p => ({ ...p, item_name: e.target.value }))} placeholder={isAr ? 'مثال: لحم بقري، كوب زجاجي...' : 'e.g. Beef, Glass cup...'} />
              </div>

              {/* الكمية والوحدة */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>{isAr ? 'الكمية *' : 'Quantity *'}</label>
                  <input style={{ ...inp, direction: 'ltr', textAlign: 'left' }} type="number" min="0" step="0.1" value={form.quantity} onChange={e => setForm(p => ({ ...p, quantity: e.target.value }))} placeholder="0" />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>{isAr ? 'الوحدة' : 'Unit'}</label>
                  <select style={{ ...inp, cursor: 'pointer' }} value={form.unit} onChange={e => setForm(p => ({ ...p, unit: e.target.value }))}>
                    <option value="">{isAr ? '-- اختر --' : '-- Select --'}</option>
                    {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </div>

              {/* التكلفة والقسم */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>{isAr ? 'التكلفة المقدرة (MYR)' : 'Estimated Cost (MYR)'}</label>
                  <input style={{ ...inp, direction: 'ltr', textAlign: 'left' }} type="number" min="0" step="0.01" value={form.cost} onChange={e => setForm(p => ({ ...p, cost: e.target.value }))} placeholder="0.00" />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>{isAr ? 'القسم' : 'Department'}</label>
                  <select style={{ ...inp, cursor: 'pointer' }} value={form.department} onChange={e => setForm(p => ({ ...p, department: e.target.value }))}>
                    <option value="">{isAr ? '-- اختر --' : '-- Select --'}</option>
                    {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
              </div>

              {/* السبب */}
              {form.waste_type && (
                <div>
                  <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>{isAr ? 'السبب' : 'Reason'}</label>
                  <select style={{ ...inp, cursor: 'pointer' }} value={form.reason} onChange={e => setForm(p => ({ ...p, reason: e.target.value }))}>
                    <option value="">{isAr ? '-- اختر السبب --' : '-- Select Reason --'}</option>
                    {(REASONS[form.waste_type] || []).map(r => <option key={r} value={r}>{r}</option>)}
                    <option value="other">{isAr ? 'سبب آخر' : 'Other'}</option>
                  </select>
                </div>
              )}

              {/* التاريخ */}
              <div>
                <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>{isAr ? 'التاريخ' : 'Date'}</label>
                <input style={{ ...inp, direction: 'ltr', textAlign: 'left' }} type="date" value={form.waste_date} onChange={e => setForm(p => ({ ...p, waste_date: e.target.value }))} />
              </div>

              {/* ملاحظات */}
              <div>
                <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>{isAr ? 'ملاحظات إضافية' : 'Notes'}</label>
                <textarea style={{ ...inp, minHeight: 70, resize: 'none' } as React.CSSProperties} value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder={isAr ? 'أي تفاصيل إضافية...' : 'Any additional details...'} />
              </div>

              {/* صورة */}
              <div>
                <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>{isAr ? 'صورة (اختياري)' : 'Photo (optional)'}</label>
                <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => {
                  const f = e.target.files?.[0]
                  if (f) { setImgFile(f); setImgPreview(URL.createObjectURL(f)) }
                }} />
                {imgPreview ? (
                  <div style={{ position: 'relative', display: 'inline-block' }}>
                    <img src={imgPreview} alt="preview" style={{ width: 120, height: 80, objectFit: 'cover', borderRadius: 8, border: `1px solid ${S.border}` }} />
                    <button onClick={() => { setImgFile(null); setImgPreview(null) }} style={{ position: 'absolute', top: -8, right: -8, width: 22, height: 22, borderRadius: '50%', background: S.red, border: 'none', color: '#fff', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                  </div>
                ) : (
                  <button onClick={() => fileRef.current?.click()} style={{ ...inp, cursor: 'pointer', textAlign: 'center', color: S.muted, padding: '12px' } as React.CSSProperties}>
                    📷 {isAr ? 'إرفاق صورة' : 'Attach Photo'}
                  </button>
                )}
              </div>

              {/* Buttons */}
              <div style={{ display: 'flex', gap: 10, marginTop: 6, justifyContent: 'flex-end' }}>
                <button onClick={() => setShowAdd(false)} style={{ padding: '10px 20px', borderRadius: 10, border: `1px solid ${S.muted}`, background: 'transparent', color: S.muted, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif' }}>{isAr ? 'إلغاء' : 'Cancel'}</button>
                <button onClick={save} disabled={saving} style={{ padding: '10px 24px', borderRadius: 10, border: `1px solid ${S.red}`, background: S.redB, color: S.red, cursor: saving ? 'not-allowed' : 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
                  {saving ? '⏳' : `🗑️ ${isAr ? 'حفظ السجل' : 'Save Log'}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Image Preview Lightbox */}
      {previewImg && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.95)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={() => setPreviewImg(null)}>
          <div style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
            <button onClick={() => setPreviewImg(null)} style={{ position: 'absolute', top: -16, right: -16, width: 36, height: 36, borderRadius: '50%', background: S.red, border: 'none', color: '#fff', fontSize: 18, cursor: 'pointer', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>✕</button>
            <img src={previewImg} alt="مرفق" style={{ maxWidth: '85vw', maxHeight: '85vh', borderRadius: 12, objectFit: 'contain', boxShadow: '0 20px 60px rgba(0,0,0,0.8)' }} />
          </div>
        </div>
      )}

      {/* Approval Modal */}
      {approvalModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: S.navy2, borderRadius: 20, border: `1px solid ${S.green}40`, width: '100%', maxWidth: 420, padding: 28 }}>
            <h2 style={{ color: S.green, fontSize: 16, fontWeight: 800, marginBottom: 16 }}>✅ اعتماد سجل الهدر</h2>
            <div style={{ background: S.card, borderRadius: 12, padding: '12px 16px', marginBottom: 20, fontSize: 13 }}>
              <div style={{ color: S.white, fontWeight: 700 }}>{approvalModal.item_name}</div>
              <div style={{ color: S.muted, marginTop: 4 }}>{approvalModal.quantity} {approvalModal.unit} · {approvalModal.department}</div>
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 6 }}>التقدير المالي (MYR) — اختياري</label>
              <input type="number" style={{ width: '100%', background: '#0F2040', border: `1px solid ${S.border}`, borderRadius: 10, padding: '10px 14px', fontSize: 14, color: S.white, outline: 'none', fontFamily: 'Tajawal, sans-serif', boxSizing: 'border-box' as const }}
                placeholder="0.00" value={estimatedCost} onChange={e => setEstimatedCost(e.target.value)} />
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setApprovalModal(null)} style={{ padding: '10px 18px', borderRadius: 10, border: `1px solid ${S.muted}`, background: 'transparent', color: S.muted, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif' }}>إلغاء</button>
              <button disabled={approvingSaving} onClick={async () => {
                setApprovingSaving(true)
                await sb.from('waste_logs').update({
                  status: 'approved',
                  approved_by: employee?.id,
                  approved_at: new Date().toISOString(),
                  estimated_cost: parseFloat(estimatedCost) || 0,
                }).eq('id', approvalModal.id)
                setApprovingSaving(false)
                setApprovalModal(null)
                await fetchLogs()
              }} style={{ padding: '10px 24px', borderRadius: 10, border: `1px solid ${S.green}`, background: S.greenB, color: S.green, cursor: approvingSaving ? 'not-allowed' : 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
                {approvingSaving ? '⏳...' : '✅ اعتماد'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
