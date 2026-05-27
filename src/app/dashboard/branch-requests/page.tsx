'use client'

import { useEffect, useState, useCallback } from 'react'
import { createBrowserClient } from '@supabase/ssr'

const createClient = () => createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const S = {
  navy: '#0A1628', navy2: '#0F2040', navy3: '#0C1A32',
  gold: '#C9A84C', gold2: '#E8C97A', gold3: 'rgba(201,168,76,0.12)', goldB: 'rgba(201,168,76,0.22)',
  white: '#FAFAF8', muted: '#8A9BB5', border: 'rgba(255,255,255,0.08)',
  green: '#22C55E', greenB: 'rgba(34,197,94,0.12)',
  red: '#EF4444', redB: 'rgba(239,68,68,0.12)',
  blue: '#3B82F6', blueB: 'rgba(59,130,246,0.12)',
  amber: '#F59E0B', amberB: 'rgba(245,158,11,0.12)',
  card: 'rgba(255,255,255,0.04)', card2: 'rgba(255,255,255,0.08)',
  purple: '#8B5CF6', purpleB: 'rgba(139,92,246,0.12)',
  teal: '#14B8A6', tealB: 'rgba(20,184,166,0.12)',
}

const inp: React.CSSProperties = {
  width: '100%', background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.10)',
  borderRadius: 10, padding: '10px 14px', fontSize: 13,
  color: '#FAFAF8', outline: 'none', fontFamily: 'Tajawal, sans-serif',
  boxSizing: 'border-box', direction: 'rtl',
}

const DEPARTMENTS = ['المطبخ', 'البار', 'الصالة', 'الحلويات', 'النظافة', 'الإدارة', 'أخرى']

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  pending:   { label: 'قيد الانتظار', color: S.amber,  bg: S.amberB,  icon: '⏳' },
  approved:  { label: 'معتمد',        color: S.green,  bg: S.greenB,  icon: '✅' },
  rejected:  { label: 'مرفوض',        color: S.red,    bg: S.redB,    icon: '❌' },
  delivered: { label: 'تم التسليم',   color: S.teal,   bg: S.tealB,   icon: '📦' },
  partial:   { label: 'تسليم جزئي',   color: S.purple, bg: S.purpleB, icon: '🔄' },
}

interface Branch { id: string; name: string; location: string }
interface Product { id: string; name: string; name_en?: string; current_stock: number; units?: { symbol: string } }
interface Unit { id: string; name: string; symbol: string }
interface RequestItem { product_id: string; quantity_requested: string; unit_id: string; notes: string }
interface BranchRequest {
  id: string; created_at: string; request_number: number
  branch_id: string; department: string; status: string
  notes: string; requested_by: string; approved_by: string; approved_at: string
  branches?: { name: string; location: string }
  branch_request_items?: {
    id: string; quantity_requested: number; quantity_approved: number; notes: string
    warehouse_products?: { name: string; name_en?: string }
    units?: { symbol: string }
  }[]
}

// ══ New Request Modal ══
function NewRequestModal({ branches, products, units, onClose, onSaved }: {
  branches: Branch[]; products: Product[]; units: Unit[]
  onClose: () => void; onSaved: () => void
}) {
  const supabase = createClient()
  const [saving, setSaving] = useState(false)
  const [items, setItems] = useState<RequestItem[]>([
    { product_id: '', quantity_requested: '', unit_id: '', notes: '' }
  ])
  const [form, setForm] = useState({ branch_id: '', department: '', requested_by: '', notes: '' })

  function addItem() {
    setItems(p => [...p, { product_id: '', quantity_requested: '', unit_id: '', notes: '' }])
  }

  function removeItem(i: number) { setItems(p => p.filter((_, idx) => idx !== i)) }

  function setItem(i: number, k: string, v: string) {
    setItems(p => p.map((it, idx) => {
      if (idx !== i) return it
      if (k === 'product_id') {
        const prod = products.find(p => p.id === v)
        const matchUnit = prod?.units ? units.find(u => u.symbol === prod.units?.symbol)?.id || '' : ''
        return { ...it, product_id: v, unit_id: matchUnit }
      }
      return { ...it, [k]: v }
    }))
  }

  async function save() {
    if (!form.branch_id || !form.department || !form.requested_by) {
      alert('يرجى إكمال: الفرع، القسم، واسم مقدم الطلب'); return
    }
    if (items.some(i => !i.product_id || !i.quantity_requested)) {
      alert('يرجى إكمال بيانات الأصناف'); return
    }
    setSaving(true)
    try {
      const { data: req, error: reqErr } = await supabase
        .from('branch_requests')
        .insert([{ ...form, status: 'pending' }])
        .select().single()
      if (reqErr) throw reqErr
      for (const item of items) {
        await supabase.from('branch_request_items').insert([{
          request_id: req.id, product_id: item.product_id,
          quantity_requested: parseFloat(item.quantity_requested),
          unit_id: item.unit_id || null, notes: item.notes || null,
        }])
      }
      onSaved()
    } catch (e: unknown) {
      alert('خطأ: ' + (e instanceof Error ? e.message : String(e)))
    } finally { setSaving(false) }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 300, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 20, overflowY: 'auto' }}>
      <div style={{ background: S.navy2, borderRadius: 20, border: `1px solid ${S.border}`, width: '100%', maxWidth: 720, padding: 32, margin: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div>
            <h2 style={{ color: S.white, fontSize: 18, fontWeight: 800, marginBottom: 4 }}>📦 طلب مستلزمات جديد</h2>
            <p style={{ fontSize: 12, color: S.muted }}>أدخل تفاصيل الطلب والأصناف المطلوبة</p>
          </div>
          <button onClick={onClose} style={{ background: S.card2, border: `1px solid ${S.border}`, borderRadius: 10, color: S.muted, fontSize: 18, cursor: 'pointer', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
          <div>
            <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>الفرع *</label>
            <select style={{ ...inp }} value={form.branch_id} onChange={e => setForm(p => ({ ...p, branch_id: e.target.value }))}>
              <option value="">اختر الفرع</option>
              {branches.map(b => <option key={b.id} value={b.id}>{b.name} — {b.location}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>القسم *</label>
            <select style={{ ...inp }} value={form.department} onChange={e => setForm(p => ({ ...p, department: e.target.value }))}>
              <option value="">اختر القسم</option>
              {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>مقدم الطلب *</label>
            <input style={inp} value={form.requested_by} onChange={e => setForm(p => ({ ...p, requested_by: e.target.value }))} placeholder="اسم الموظف" />
          </div>
          <div>
            <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>ملاحظات</label>
            <input style={inp} value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="أي ملاحظات..." />
          </div>
        </div>

        <div style={{ borderTop: `1px solid ${S.border}`, paddingTop: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ fontSize: 14, color: S.gold, fontWeight: 700 }}>📋 الأصناف المطلوبة</div>
            <button onClick={addItem} style={{ padding: '7px 14px', borderRadius: 8, border: `1px solid ${S.green}`, background: S.greenB, color: S.green, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', fontWeight: 600 }}>+ إضافة صنف</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '2.5fr 1fr 1fr auto', gap: 8, marginBottom: 8 }}>
            {['الصنف', 'الكمية', 'الوحدة', ''].map(h => (
              <div key={h} style={{ fontSize: 11, color: S.muted, fontWeight: 700 }}>{h}</div>
            ))}
          </div>
          {items.map((item, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '2.5fr 1fr 1fr auto', gap: 8, marginBottom: 8, alignItems: 'center' }}>
              <select style={{ ...inp }} value={item.product_id} onChange={e => setItem(i, 'product_id', e.target.value)}>
                <option value="">اختر الصنف</option>
                {products.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name}{p.name_en ? ` — ${p.name_en}` : ''} (متاح: {p.current_stock} {p.units?.symbol})
                  </option>
                ))}
              </select>
              <input style={inp} type="number" placeholder="0" value={item.quantity_requested} onChange={e => setItem(i, 'quantity_requested', e.target.value)} />
              <select style={{ ...inp }} value={item.unit_id} onChange={e => setItem(i, 'unit_id', e.target.value)}>
                <option value="">الوحدة</option>
                {units.map(u => <option key={u.id} value={u.id}>{u.symbol}</option>)}
              </select>
              {items.length > 1 && (
                <button onClick={() => removeItem(i)} style={{ background: S.redB, border: `1px solid ${S.red}`, borderRadius: 8, color: S.red, cursor: 'pointer', padding: '8px 10px', fontSize: 14 }}>✕</button>
              )}
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 24, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '11px 22px', borderRadius: 10, border: `1px solid ${S.muted}`, background: 'transparent', color: S.muted, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif' }}>إلغاء</button>
          <button onClick={save} disabled={saving} style={{ padding: '11px 28px', borderRadius: 10, border: `1px solid ${S.blue}`, background: S.blueB, color: S.blue, cursor: 'pointer', fontSize: 14, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
            {saving ? '⏳ جاري الإرسال...' : '📤 إرسال الطلب'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ══ Request Detail Modal ══
function RequestDetailModal({ request, onClose, onUpdate }: {
  request: BranchRequest; onClose: () => void; onUpdate: () => void
}) {
  const supabase = createClient()
  const [updating, setUpdating] = useState(false)
  const [approvedBy, setApprovedBy] = useState(request.approved_by || '')
  const status = STATUS_CONFIG[request.status] || STATUS_CONFIG.pending

  async function updateStatus(newStatus: string) {
    if ((newStatus === 'approved' || newStatus === 'delivered') && !approvedBy) {
      alert('يرجى إدخال اسم المعتمد / المسلّم'); return
    }
    setUpdating(true)
    await supabase.from('branch_requests').update({
      status: newStatus,
      approved_by: approvedBy || null,
      approved_at: ['approved', 'delivered'].includes(newStatus) ? new Date().toISOString() : null,
    }).eq('id', request.id)
    setUpdating(false)
    onUpdate()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, overflowY: 'auto' }}>
      <div style={{ background: S.navy2, borderRadius: 20, border: `1px solid ${S.border}`, width: '100%', maxWidth: 600, padding: 28, margin: 'auto' }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <h3 style={{ color: S.gold, fontSize: 17, fontWeight: 800 }}>طلب #{request.request_number}</h3>
              <span style={{ background: status.bg, color: status.color, borderRadius: 20, padding: '3px 12px', fontSize: 12, fontWeight: 700 }}>
                {status.icon} {status.label}
              </span>
            </div>
            <p style={{ fontSize: 12, color: S.muted }}>
              {new Date(request.created_at).toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: S.muted, fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>

        {/* Info Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
          {[
            { label: 'الفرع', value: request.branches?.name || '—', icon: '🏪' },
            { label: 'الموقع', value: request.branches?.location || '—', icon: '📍' },
            { label: 'القسم', value: request.department || '—', icon: '🏷️' },
            { label: 'مقدم الطلب', value: request.requested_by || '—', icon: '👤' },
            { label: 'المعتمد', value: request.approved_by || '—', icon: '✅' },
            { label: 'ملاحظات', value: request.notes || '—', icon: '📝' },
          ].map((row, i) => (
            <div key={i} style={{ background: S.card, borderRadius: 10, padding: '10px 14px' }}>
              <div style={{ fontSize: 11, color: S.muted, marginBottom: 3 }}>{row.icon} {row.label}</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: S.white }}>{row.value}</div>
            </div>
          ))}
        </div>

        {/* Items */}
        <div style={{ background: S.navy3, borderRadius: 12, overflow: 'hidden', marginBottom: 20 }}>
          <div style={{ padding: '10px 16px', borderBottom: `1px solid ${S.border}`, fontSize: 13, fontWeight: 700, color: S.gold }}>
            الأصناف المطلوبة ({request.branch_request_items?.length || 0})
          </div>
          {(request.branch_request_items || []).map((item, i) => (
            <div key={i} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '12px 16px',
              borderBottom: i < (request.branch_request_items?.length || 0) - 1 ? `1px solid ${S.border}` : 'none'
            }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: S.white }}>{item.warehouse_products?.name}</div>
                {item.warehouse_products?.name_en && (
                  <div style={{ fontSize: 11, color: S.muted, fontStyle: 'italic' }}>{item.warehouse_products.name_en}</div>
                )}
              </div>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: S.blue }}>{item.quantity_requested} {item.units?.symbol}</div>
                {item.quantity_approved && (
                  <div style={{ fontSize: 11, color: S.green }}>معتمد: {item.quantity_approved} {item.units?.symbol}</div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Actions */}
        {['pending', 'approved'].includes(request.status) && (
          <div style={{ background: S.card, borderRadius: 12, padding: 16, marginBottom: 16 }}>
            <div style={{ fontSize: 12, color: S.muted, marginBottom: 6 }}>اسم المعتمد / المسلّم</div>
            <input style={{ ...inp, marginBottom: 12 }} value={approvedBy} onChange={e => setApprovedBy(e.target.value)} placeholder="أدخل اسمك..." />
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {request.status === 'pending' && <>
                <button onClick={() => updateStatus('approved')} disabled={updating} style={{ flex: 1, padding: '10px', borderRadius: 10, border: `1px solid ${S.green}`, background: S.greenB, color: S.green, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>✅ اعتماد</button>
                <button onClick={() => updateStatus('rejected')} disabled={updating} style={{ flex: 1, padding: '10px', borderRadius: 10, border: `1px solid ${S.red}`, background: S.redB, color: S.red, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>❌ رفض</button>
              </>}
              {['pending', 'approved'].includes(request.status) && <>
                <button onClick={() => updateStatus('delivered')} disabled={updating} style={{ flex: 1, padding: '10px', borderRadius: 10, border: `1px solid ${S.teal}`, background: S.tealB, color: S.teal, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>📦 تسليم كامل</button>
                <button onClick={() => updateStatus('partial')} disabled={updating} style={{ flex: 1, padding: '10px', borderRadius: 10, border: `1px solid ${S.purple}`, background: S.purpleB, color: S.purple, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>🔄 تسليم جزئي</button>
              </>}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '9px 18px', borderRadius: 10, border: `1px solid ${S.muted}`, background: 'transparent', color: S.muted, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif' }}>إغلاق</button>
        </div>
      </div>
    </div>
  )
}

// ══ الصفحة الرئيسية ══
export default function BranchRequestsPage() {
  const supabase = createClient()
  const [requests, setRequests] = useState<BranchRequest[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [units, setUnits] = useState<Unit[]>([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [selected, setSelected] = useState<BranchRequest | null>(null)
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterBranch, setFilterBranch] = useState('all')
  const [filterDept, setFilterDept] = useState('all')
  const [search, setSearch] = useState('')

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const [req, br, prod, un] = await Promise.all([
      supabase.from('branch_requests')
        .select('*, branches(name,location), branch_request_items(*, warehouse_products(name,name_en), units(symbol))')
        .order('created_at', { ascending: false }),
      supabase.from('branches').select('*').eq('is_active', true).order('name'),
      supabase.from('warehouse_products').select('*, units(symbol)').eq('is_active', true).order('name'),
      supabase.from('units').select('*').order('name'),
    ])
    setRequests(req.data || [])
    setBranches(br.data || [])
    setProducts(prod.data || [])
    setUnits(un.data || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  // Stats
  const thisMonth = new Date().toISOString().slice(0, 7)
  const monthReqs = requests.filter(r => r.created_at?.startsWith(thisMonth))
  const statusCounts = Object.keys(STATUS_CONFIG).reduce((acc, s) => {
    acc[s] = requests.filter(r => r.status === s).length
    return acc
  }, {} as Record<string, number>)

  // Filter
  const filtered = requests.filter(r => {
    const matchStatus = filterStatus === 'all' || r.status === filterStatus
    const matchBranch = filterBranch === 'all' || r.branch_id === filterBranch
    const matchDept = filterDept === 'all' || r.department === filterDept
    const matchSearch = !search ||
      r.requested_by?.includes(search) ||
      r.branches?.name?.includes(search) ||
      String(r.request_number).includes(search)
    return matchStatus && matchBranch && matchDept && matchSearch
  })

  return (
    <div style={{ fontFamily: 'Tajawal, sans-serif', direction: 'rtl', color: S.white }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&display=swap');
        select option { background: #0F2040; color: #FAFAF8; }
        .req-row:hover td { background: rgba(255,255,255,0.03) !important; }
      `}</style>

      {/* ══ Header ══ */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: S.white, marginBottom: 4 }}>📦 طلبات الفروع</h1>
          <p style={{ fontSize: 13, color: S.muted }}>إدارة طلبات المستلزمات من الفروع والأقسام المختلفة</p>
        </div>
        <button onClick={() => setShowNew(true)} style={{ padding: '11px 22px', borderRadius: 12, border: `1px solid ${S.blue}`, background: S.blueB, color: S.blue, cursor: 'pointer', fontSize: 14, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
          ➕ طلب جديد
        </button>
      </div>

      {/* ══ Stats Row ══ */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12, marginBottom: 20 }}>
        <div style={{ background: S.card2, borderRadius: 14, border: `1px solid ${S.border}`, padding: '16px 18px' }}>
          <div style={{ fontSize: 22, marginBottom: 6 }}>📊</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: S.white, marginBottom: 2 }}>{requests.length}</div>
          <div style={{ fontSize: 12, color: S.muted }}>إجمالي الطلبات</div>
        </div>
        <div style={{ background: S.gold3, borderRadius: 14, border: `1px solid rgba(201,168,76,0.2)`, padding: '16px 18px' }}>
          <div style={{ fontSize: 22, marginBottom: 6 }}>📅</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: S.gold, marginBottom: 2 }}>{monthReqs.length}</div>
          <div style={{ fontSize: 12, color: S.muted }}>هذا الشهر</div>
        </div>
        {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
          <div key={key} onClick={() => setFilterStatus(filterStatus === key ? 'all' : key)}
            style={{ background: filterStatus === key ? cfg.bg : S.card2, borderRadius: 14, border: `1px solid ${filterStatus === key ? cfg.color + '50' : S.border}`, padding: '16px 18px', cursor: 'pointer', transition: 'all .2s' }}>
            <div style={{ fontSize: 22, marginBottom: 6 }}>{cfg.icon}</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: cfg.color, marginBottom: 2 }}>{statusCounts[key] || 0}</div>
            <div style={{ fontSize: 12, color: S.muted }}>{cfg.label}</div>
          </div>
        ))}
      </div>

      {/* ══ Branch Cards ══ */}
      {branches.length > 0 && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
          <button onClick={() => setFilterBranch('all')} style={{ padding: '8px 16px', borderRadius: 20, border: `1px solid ${filterBranch === 'all' ? S.gold : S.border}`, background: filterBranch === 'all' ? S.gold3 : 'transparent', color: filterBranch === 'all' ? S.gold : S.muted, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', fontWeight: 600 }}>
            كل الفروع ({requests.length})
          </button>
          {branches.map(b => {
            const count = requests.filter(r => r.branch_id === b.id).length
            const pending = requests.filter(r => r.branch_id === b.id && r.status === 'pending').length
            return (
              <button key={b.id} onClick={() => setFilterBranch(filterBranch === b.id ? 'all' : b.id)}
                style={{ padding: '8px 16px', borderRadius: 20, border: `1px solid ${filterBranch === b.id ? S.blue : S.border}`, background: filterBranch === b.id ? S.blueB : 'transparent', color: filterBranch === b.id ? S.blue : S.muted, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', display: 'flex', alignItems: 'center', gap: 8 }}>
                🏪 {b.name}
                <span style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 10, padding: '1px 7px', fontSize: 11, color: S.white, fontWeight: 700 }}>{count}</span>
                {pending > 0 && <span style={{ background: S.amberB, borderRadius: 10, padding: '1px 7px', fontSize: 11, color: S.amber, fontWeight: 700 }}>⏳{pending}</span>}
              </button>
            )
          })}
        </div>
      )}

      {/* ══ Filters ══ */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <input style={{ ...inp, flex: 1, minWidth: 200 }} value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 بحث برقم الطلب أو مقدم الطلب أو الفرع..." />
        <select style={{ ...inp, width: 'auto', minWidth: 140 }} value={filterDept} onChange={e => setFilterDept(e.target.value)}>
          <option value="all">كل الأقسام</option>
          {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        {(search || filterStatus !== 'all' || filterBranch !== 'all' || filterDept !== 'all') && (
          <button onClick={() => { setSearch(''); setFilterStatus('all'); setFilterBranch('all'); setFilterDept('all') }} style={{ padding: '10px 14px', borderRadius: 10, border: `1px solid ${S.red}`, background: S.redB, color: S.red, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif' }}>✕ مسح</button>
        )}
      </div>

      {/* ══ Table ══ */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: S.muted }}>⏳ جاري التحميل...</div>
      ) : (
        <div style={{ background: S.navy2, borderRadius: 16, border: `1px solid ${S.border}`, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: `1px solid ${S.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 700, fontSize: 14, color: S.white }}>سجل الطلبات</span>
            <span style={{ fontSize: 12, color: S.muted }}>{filtered.length} طلب</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 750 }}>
              <thead>
                <tr style={{ background: S.navy3 }}>
                  {['#', 'الفرع', 'القسم', 'مقدم الطلب', 'الأصناف', 'الحالة', 'التاريخ', ''].map(h => (
                    <th key={h} style={{ padding: '12px 16px', textAlign: 'right', fontSize: 12, color: S.muted, fontWeight: 700, borderBottom: `1px solid ${S.border}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={8} style={{ textAlign: 'center', padding: 60, color: S.muted }}>
                    <div style={{ fontSize: 40, marginBottom: 12 }}>📦</div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: S.white, marginBottom: 6 }}>لا توجد طلبات</div>
                    <div style={{ fontSize: 13 }}>اضغط "طلب جديد" لإضافة أول طلب</div>
                  </td></tr>
                ) : filtered.map(req => {
                  const st = STATUS_CONFIG[req.status] || STATUS_CONFIG.pending
                  const itemCount = req.branch_request_items?.length || 0
                  return (
                    <tr key={req.id} className="req-row" onClick={() => setSelected(req)} style={{ borderBottom: `1px solid ${S.border}`, cursor: 'pointer' }}>
                      <td style={{ padding: '14px 16px', color: S.gold, fontWeight: 800, fontSize: 15 }}>#{req.request_number}</td>
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: S.white }}>{req.branches?.name || '—'}</div>
                        <div style={{ fontSize: 11, color: S.muted }}>📍 {req.branches?.location}</div>
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <span style={{ background: S.card2, borderRadius: 20, padding: '3px 10px', fontSize: 12, color: S.muted }}>{req.department || '—'}</span>
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 28, height: 28, borderRadius: '50%', background: S.blueB, border: `1px solid ${S.blue}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: S.blue, fontWeight: 700, flexShrink: 0 }}>
                            {req.requested_by?.charAt(0)?.toUpperCase() || '?'}
                          </div>
                          <span style={{ fontSize: 13, color: S.white }}>{req.requested_by || '—'}</span>
                        </div>
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <span style={{ background: S.blueB, color: S.blue, borderRadius: 20, padding: '3px 10px', fontSize: 12, fontWeight: 700 }}>
                          {itemCount} {itemCount === 1 ? 'صنف' : 'أصناف'}
                        </span>
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <span style={{ background: st.bg, color: st.color, borderRadius: 20, padding: '4px 12px', fontSize: 12, fontWeight: 700 }}>
                          {st.icon} {st.label}
                        </span>
                      </td>
                      <td style={{ padding: '14px 16px', fontSize: 12, color: S.muted }}>
                        {new Date(req.created_at).toLocaleDateString('ar-SA', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td style={{ padding: '14px 16px', color: S.muted, fontSize: 18 }}>←</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showNew && (
        <NewRequestModal branches={branches} products={products} units={units}
          onClose={() => setShowNew(false)} onSaved={() => { setShowNew(false); fetchAll() }} />
      )}
      {selected && (
        <RequestDetailModal request={selected}
          onClose={() => setSelected(null)} onUpdate={() => { setSelected(null); fetchAll() }} />
      )}
    </div>
  )
}
