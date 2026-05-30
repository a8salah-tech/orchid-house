'use client'

import { useEffect, useState, useCallback } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useAuth } from '../../components/AuthProvider'

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
  orange: '#F97316', orangeB: 'rgba(249,115,22,0.12)',
}

const inp: React.CSSProperties = {
  width: '100%', background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.10)',
  borderRadius: 10, padding: '10px 14px', fontSize: 13,
  color: '#FAFAF8', outline: 'none', fontFamily: 'Tajawal, sans-serif',
  boxSizing: 'border-box', direction: 'rtl',
}

const DEPARTMENTS = ['المطبخ', 'البار', 'الصالة', 'الحلويات', 'النظافة', 'الإدارة', 'أخرى']

// ══ Workflow Statuses ══
const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: string; step: number }> = {
  pending:              { label: 'قيد الانتظار',         color: S.amber,  bg: S.amberB,  icon: '⏳', step: 1 },
  manager_approved:     { label: 'معتمد من مدير القسم',  color: S.blue,   bg: S.blueB,   icon: '👨‍💼', step: 2 },
  branch_approved:      { label: 'معتمد من مدير الفرع',  color: S.purple, bg: S.purpleB, icon: '🏪', step: 3 },
  warehouse_processing: { label: 'قيد التجهيز بالمستودع',color: S.orange, bg: S.orangeB, icon: '🏭', step: 4 },
  manager_received:     { label: 'استلم مدير القسم',      color: S.teal,   bg: S.tealB,   icon: '✅', step: 5 },
  supervisor_received:  { label: 'استلم المشرف',          color: S.green,  bg: S.greenB,  icon: '🎉', step: 6 },
  rejected:             { label: 'مرفوض',                 color: S.red,    bg: S.redB,    icon: '❌', step: 0 },
}

// دور المستخدم وما يحق له
const SUPERVISOR_ROLES = ['kitchen_supervisor', 'hall_supervisor', 'bar_supervisor']
const MANAGER_ROLES = ['kitchen_manager', 'hall_manager', 'bar_manager']
const SENIOR_ROLES = ['admin', 'branch_manager']

function canCreate(role: string) {
  return [...SUPERVISOR_ROLES, ...MANAGER_ROLES, ...SENIOR_ROLES].includes(role)
}

function canDoManagerApproval(role: string) {
  return [...MANAGER_ROLES, ...SENIOR_ROLES].includes(role)
}

function canDoBranchApproval(role: string) {
  return [...SENIOR_ROLES].includes(role)
}

function canDoWarehouseAction(role: string) {
  return role === 'warehouse_keeper' || SENIOR_ROLES.includes(role)
}

interface Branch { id: string; name: string; location: string }
interface Product { id: string; name: string; name_en?: string; current_stock: number; units?: { symbol: string } }
interface Unit { id: string; name: string; symbol: string }
interface RequestItem { product_id: string; quantity_requested: string; unit_id: string; notes: string }
interface BranchRequest {
  id: string; created_at: string; request_number: number
  branch_id: string; department: string; status: string
  notes: string; requested_by: string
  approved_by?: string; approved_at?: string
  manager_approved_by?: string; manager_approved_at?: string
  branch_manager_approved_by?: string; branch_manager_approved_at?: string
  warehouse_received_by?: string; warehouse_received_at?: string
  manager_received_by?: string; manager_received_at?: string
  supervisor_received_by?: string; supervisor_received_at?: string
  branches?: { name: string; location: string }
  branch_request_items?: {
    id: string; quantity_requested: number; quantity_approved: number; notes: string
    warehouse_products?: { name: string; name_en?: string }
    units?: { symbol: string }
  }[]
}

// ══ Workflow Steps Display ══
function WorkflowSteps({ request }: { request: BranchRequest }) {
  const currentStep = STATUS_CONFIG[request.status]?.step || 0
  const steps = [
    { step: 1, label: 'طلب المشرف', icon: '👷', done: currentStep >= 1, by: request.requested_by, at: request.created_at },
    { step: 2, label: 'اعتماد مدير القسم', icon: '👨‍💼', done: currentStep >= 2, by: request.manager_approved_by, at: request.manager_approved_at },
    { step: 3, label: 'اعتماد مدير الفرع', icon: '🏪', done: currentStep >= 3, by: request.branch_manager_approved_by, at: request.branch_manager_approved_at },
    { step: 4, label: 'تجهيز المستودع', icon: '🏭', done: currentStep >= 4, by: request.warehouse_received_by, at: request.warehouse_received_at },
    { step: 5, label: 'استلام مدير القسم', icon: '✅', done: currentStep >= 5, by: request.manager_received_by, at: request.manager_received_at },
    { step: 6, label: 'استلام المشرف', icon: '🎉', done: currentStep >= 6, by: request.supervisor_received_by, at: request.supervisor_received_at },
  ]

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 12, color: S.gold, fontWeight: 700, marginBottom: 10 }}>📋 مراحل الطلب</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {steps.map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 10, background: s.done ? (request.status === 'rejected' && s.step === currentStep ? S.redB : 'rgba(34,197,94,0.08)') : S.card, border: `1px solid ${s.done ? (request.status === 'rejected' && s.step === currentStep ? S.red + '40' : S.green + '30') : S.border}` }}>
            <div style={{ fontSize: 18, opacity: s.done ? 1 : 0.3 }}>{s.icon}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: s.done ? S.white : S.muted }}>{s.label}</div>
              {s.done && s.by && <div style={{ fontSize: 10, color: S.muted }}>{s.by} {s.at ? `· ${new Date(s.at).toLocaleDateString('ar-SA')}` : ''}</div>}
            </div>
            <div style={{ fontSize: 14 }}>{s.done ? (request.status === 'rejected' && s.step === currentStep ? '❌' : '✅') : '⭕'}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ══ New Request Modal ══
function NewRequestModal({ branches, products, units, currentEmployee, onClose, onSaved }: {
  branches: Branch[]; products: Product[]; units: Unit[]
  currentEmployee: any; onClose: () => void; onSaved: () => void
}) {
  const supabase = createClient()
  const [saving, setSaving] = useState(false)
  const [items, setItems] = useState<RequestItem[]>([
    { product_id: '', quantity_requested: '', unit_id: '', notes: '' }
  ])

  // Auto-set department based on role
  const autoDetectDept = () => {
    const role = currentEmployee?.role || ''
    if (role.includes('kitchen')) return 'المطبخ'
    if (role.includes('hall')) return 'الصالة'
    if (role.includes('bar')) return 'البار'
    return currentEmployee?.department || ''
  }

  const [form, setForm] = useState({
    branch_id: currentEmployee?.branch_id || '',
    department: autoDetectDept(),
    requested_by: currentEmployee?.name || '',
    notes: ''
  })

  function addItem() { setItems(p => [...p, { product_id: '', quantity_requested: '', unit_id: '', notes: '' }]) }
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

  const sel: React.CSSProperties = { ...inp, cursor: 'pointer' }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 300, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 20, overflowY: 'auto' }}>
      <div style={{ background: S.navy2, borderRadius: 20, border: `1px solid ${S.border}`, width: '100%', maxWidth: 720, padding: 32, margin: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div>
            <h2 style={{ color: S.white, fontSize: 18, fontWeight: 800, marginBottom: 4 }}>📦 طلب مستلزمات جديد</h2>
            <p style={{ fontSize: 12, color: S.muted }}>سيتم إرسال الطلب لمدير القسم للاعتماد أولاً</p>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: S.muted, fontSize: 22, cursor: 'pointer' }}>✕</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
          <div>
            <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>الفرع *</label>
            <select style={sel} value={form.branch_id} onChange={e => setForm(p => ({ ...p, branch_id: e.target.value }))}>
              <option value="">-- اختر الفرع --</option>
              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>القسم *</label>
            <select style={sel} value={form.department} onChange={e => setForm(p => ({ ...p, department: e.target.value }))}>
              <option value="">-- اختر القسم --</option>
              {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>مقدم الطلب *</label>
            <input style={inp} value={form.requested_by} onChange={e => setForm(p => ({ ...p, requested_by: e.target.value }))} placeholder="اسمك..." />
          </div>
          <div>
            <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>ملاحظات</label>
            <input style={inp} value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="أي ملاحظات إضافية..." />
          </div>
        </div>

        <div style={{ background: S.navy3, borderRadius: 14, padding: 18, marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: S.gold }}>الأصناف المطلوبة</div>
            <button onClick={addItem} style={{ padding: '6px 14px', borderRadius: 8, border: `1px solid ${S.blue}`, background: S.blueB, color: S.blue, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>+ إضافة صنف</button>
          </div>
          {items.map((item, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: 8, marginBottom: 8, alignItems: 'center' }}>
              <select style={sel} value={item.product_id} onChange={e => setItem(i, 'product_id', e.target.value)}>
                <option value="">-- اختر الصنف --</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <input style={{ ...inp, direction: 'ltr' }} type="number" value={item.quantity_requested} onChange={e => setItem(i, 'quantity_requested', e.target.value)} placeholder="الكمية" />
              <select style={sel} value={item.unit_id} onChange={e => setItem(i, 'unit_id', e.target.value)}>
                <option value="">الوحدة</option>
                {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
              {items.length > 1 && (
                <button onClick={() => removeItem(i)} style={{ padding: '8px 10px', borderRadius: 8, border: `1px solid ${S.red}`, background: S.redB, color: S.red, cursor: 'pointer', fontSize: 14 }}>🗑️</button>
              )}
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button onClick={onClose} style={{ padding: '11px 20px', borderRadius: 10, border: `1px solid ${S.muted}`, background: 'transparent', color: S.muted, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif' }}>إلغاء</button>
          <button onClick={save} disabled={saving} style={{ padding: '11px 28px', borderRadius: 10, border: `1px solid ${S.blue}`, background: S.blueB, color: S.blue, cursor: 'pointer', fontSize: 14, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
            {saving ? '⏳ جاري الإرسال...' : '📤 إرسال الطلب'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ══ Request Detail Modal ══
function RequestDetailModal({ request, currentEmployee, onClose, onUpdate }: {
  request: BranchRequest; currentEmployee: any; onClose: () => void; onUpdate: () => void
}) {
  const supabase = createClient()
  const [updating, setUpdating] = useState(false)
  const [actionBy, setActionBy] = useState(currentEmployee?.name || '')
  const status = STATUS_CONFIG[request.status] || STATUS_CONFIG.pending
  const role = currentEmployee?.role || ''

  async function doAction(newStatus: string, extraFields: Record<string, string> = {}) {
    if (!actionBy.trim()) { alert('يرجى إدخال اسمك'); return }
    setUpdating(true)
    const now = new Date().toISOString()
    await supabase.from('branch_requests').update({
      status: newStatus,
      ...extraFields,
    }).eq('id', request.id)
    setUpdating(false)
    onUpdate()
  }

  // ما يحق للمستخدم الحالي
  const showManagerApproval = canDoManagerApproval(role) && request.status === 'pending'
  const showBranchApproval = canDoBranchApproval(role) && request.status === 'manager_approved'
  const showWarehouseAction = canDoWarehouseAction(role) && request.status === 'branch_approved'
  const showManagerReceived = canDoManagerApproval(role) && request.status === 'warehouse_processing'
  const showSupervisorReceived = SUPERVISOR_ROLES.includes(role) && request.status === 'manager_received'
  const showReject = (canDoManagerApproval(role) || canDoBranchApproval(role)) && ['pending', 'manager_approved'].includes(request.status)

  const hasAction = showManagerApproval || showBranchApproval || showWarehouseAction || showManagerReceived || showSupervisorReceived

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, overflowY: 'auto' }}>
      <div style={{ background: S.navy2, borderRadius: 20, border: `1px solid ${S.border}`, width: '100%', maxWidth: 640, padding: 28, margin: 'auto' }}>

        {/* Header */}
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

        {/* Info */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
          {[
            { label: 'الفرع', value: request.branches?.name || '—', icon: '🏪' },
            { label: 'القسم', value: request.department || '—', icon: '🏷️' },
            { label: 'مقدم الطلب', value: request.requested_by || '—', icon: '👷' },
            { label: 'ملاحظات', value: request.notes || '—', icon: '📝' },
          ].map((row, i) => (
            <div key={i} style={{ background: S.card, borderRadius: 10, padding: '10px 14px' }}>
              <div style={{ fontSize: 11, color: S.muted, marginBottom: 3 }}>{row.icon} {row.label}</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: S.white }}>{row.value}</div>
            </div>
          ))}
        </div>

        {/* Workflow */}
        <WorkflowSteps request={request} />

        {/* Items */}
        <div style={{ background: S.navy3, borderRadius: 12, overflow: 'hidden', marginBottom: 20 }}>
          <div style={{ padding: '10px 16px', borderBottom: `1px solid ${S.border}`, fontSize: 13, fontWeight: 700, color: S.gold }}>
            الأصناف المطلوبة ({request.branch_request_items?.length || 0})
          </div>
          {(request.branch_request_items || []).map((item, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: i < (request.branch_request_items?.length || 0) - 1 ? `1px solid ${S.border}` : 'none' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: S.white }}>{item.warehouse_products?.name}</div>
                {item.warehouse_products?.name_en && <div style={{ fontSize: 11, color: S.muted, fontStyle: 'italic' }}>{item.warehouse_products.name_en}</div>}
              </div>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: S.blue }}>{item.quantity_requested} {item.units?.symbol}</div>
                {item.quantity_approved > 0 && <div style={{ fontSize: 11, color: S.green }}>معتمد: {item.quantity_approved} {item.units?.symbol}</div>}
              </div>
            </div>
          ))}
        </div>

        {/* Actions */}
        {hasAction && (
          <div style={{ background: S.card, borderRadius: 12, padding: 16, marginBottom: 16 }}>
            <div style={{ fontSize: 12, color: S.muted, marginBottom: 6 }}>اسمك *</div>
            <input style={{ ...inp, marginBottom: 12 }} value={actionBy} onChange={e => setActionBy(e.target.value)} placeholder="أدخل اسمك..." />
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>

              {/* مدير القسم — اعتماد أولي */}
              {showManagerApproval && (
                <button onClick={() => doAction('manager_approved', { manager_approved_by: actionBy, manager_approved_at: new Date().toISOString() })}
                  disabled={updating} style={{ flex: 1, padding: '10px', borderRadius: 10, border: `1px solid ${S.blue}`, background: S.blueB, color: S.blue, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
                  👨‍💼 اعتماد مدير القسم
                </button>
              )}

              {/* مدير الفرع — اعتماد ثاني */}
              {showBranchApproval && (
                <button onClick={() => doAction('branch_approved', { branch_manager_approved_by: actionBy, branch_manager_approved_at: new Date().toISOString() })}
                  disabled={updating} style={{ flex: 1, padding: '10px', borderRadius: 10, border: `1px solid ${S.purple}`, background: S.purpleB, color: S.purple, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
                  🏪 اعتماد مدير الفرع
                </button>
              )}

              {/* أمين المستودع — بدء التجهيز */}
              {showWarehouseAction && (
                <button onClick={() => doAction('warehouse_processing', { warehouse_received_by: actionBy, warehouse_received_at: new Date().toISOString() })}
                  disabled={updating} style={{ flex: 1, padding: '10px', borderRadius: 10, border: `1px solid ${S.orange}`, background: S.orangeB, color: S.orange, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
                  🏭 بدء التجهيز
                </button>
              )}

              {/* مدير القسم — تأكيد استلام */}
              {showManagerReceived && (
                <button onClick={() => doAction('manager_received', { manager_received_by: actionBy, manager_received_at: new Date().toISOString() })}
                  disabled={updating} style={{ flex: 1, padding: '10px', borderRadius: 10, border: `1px solid ${S.teal}`, background: S.tealB, color: S.teal, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
                  ✅ تأكيد استلام مدير القسم
                </button>
              )}

              {/* المشرف — تأكيد استلام نهائي */}
              {showSupervisorReceived && (
                <button onClick={() => doAction('supervisor_received', { supervisor_received_by: actionBy, supervisor_received_at: new Date().toISOString() })}
                  disabled={updating} style={{ flex: 1, padding: '10px', borderRadius: 10, border: `1px solid ${S.green}`, background: S.greenB, color: S.green, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
                  🎉 تأكيد استلام المشرف
                </button>
              )}

              {/* رفض */}
              {showReject && (
                <button onClick={() => doAction('rejected')} disabled={updating}
                  style={{ padding: '10px 16px', borderRadius: 10, border: `1px solid ${S.red}`, background: S.redB, color: S.red, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
                  ❌ رفض
                </button>
              )}
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
  const { employee } = useAuth()
  const [requests, setRequests] = useState<BranchRequest[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [units, setUnits] = useState<Unit[]>([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [selected, setSelected] = useState<BranchRequest | null>(null)
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterDept, setFilterDept] = useState('all')
  const [search, setSearch] = useState('')

  const role = employee?.role || ''

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const [reqRes, branchRes, prodRes, unitRes] = await Promise.all([
      supabase.from('branch_requests')
        .select(`*, branches(name, location), branch_request_items(id, quantity_requested, quantity_approved, notes, warehouse_products(name, name_en), units(symbol))`)
        .order('created_at', { ascending: false }),
      supabase.from('branches').select('*').order('name'),
      supabase.from('warehouse_products').select('id, name, name_en, current_stock, units(symbol)').eq('is_active', true).order('name'),
      supabase.from('units').select('*').order('name'),
    ])
    setRequests(reqRes.data || [])
    setBranches(branchRes.data || [])
    setProducts(prodRes.data || [])
    setUnits(unitRes.data || [])
    setLoading(false)
  }, [supabase])

  useEffect(() => { fetchAll() }, [fetchAll])

  const filtered = requests.filter(r => {
    const matchStatus = filterStatus === 'all' || r.status === filterStatus
    const matchDept = filterDept === 'all' || r.department === filterDept
    const matchSearch = !search || r.requested_by?.includes(search) || String(r.request_number).includes(search)
    return matchStatus && matchDept && matchSearch
  })

  // حساب الإحصائيات
  const stats = Object.entries(STATUS_CONFIG).map(([key, cfg]) => ({
    key, ...cfg, count: requests.filter(r => r.status === key).length
  })).filter(s => s.count > 0 || ['pending', 'manager_approved', 'branch_approved'].includes(s.key))

  const sel: React.CSSProperties = { ...inp, width: 'auto', minWidth: 140 }

  return (
    <div style={{ fontFamily: 'Tajawal, sans-serif', direction: 'rtl', color: S.white }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: S.white, marginBottom: 4 }}>📦 طلبات الفروع</h1>
          <p style={{ fontSize: 13, color: S.muted }}>نظام طلب المستلزمات من المستودع — متعدد المراحل</p>
        </div>
        {canCreate(role) && (
          <button onClick={() => setShowNew(true)} style={{ padding: '10px 20px', borderRadius: 12, border: `1px solid ${S.gold}`, background: S.gold3, color: S.gold, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
            ➕ طلب جديد
          </button>
        )}
      </div>

      {/* Workflow Guide */}
      <div style={{ background: S.navy2, borderRadius: 14, border: `1px solid ${S.border}`, padding: '14px 18px', marginBottom: 20 }}>
        <div style={{ fontSize: 12, color: S.gold, fontWeight: 700, marginBottom: 10 }}>🔄 مراحل الطلب</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {[
            { icon: '👷', label: 'المشرف يطلب', color: S.muted },
            { icon: '→', label: '', color: S.muted },
            { icon: '👨‍💼', label: 'مدير القسم يعتمد', color: S.blue },
            { icon: '→', label: '', color: S.muted },
            { icon: '🏪', label: 'مدير الفرع يعتمد', color: S.purple },
            { icon: '→', label: '', color: S.muted },
            { icon: '🏭', label: 'المستودع يجهز', color: S.orange },
            { icon: '→', label: '', color: S.muted },
            { icon: '✅', label: 'مدير القسم يستلم', color: S.teal },
            { icon: '→', label: '', color: S.muted },
            { icon: '🎉', label: 'المشرف يستلم', color: S.green },
          ].map((s, i) => (
            <span key={i} style={{ fontSize: s.icon === '→' ? 16 : 12, color: s.color, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
              {s.icon !== '→' && <span>{s.icon}</span>}
              {s.icon === '→' ? <span style={{ color: S.muted }}>→</span> : <span>{s.label}</span>}
            </span>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12, marginBottom: 20 }}>
        {stats.map(s => (
          <div key={s.key} style={{ background: s.bg, border: `1px solid ${s.color}30`, borderRadius: 12, padding: '14px 16px', cursor: 'pointer', transition: 'all .2s' }}
            onClick={() => setFilterStatus(filterStatus === s.key ? 'all' : s.key)}>
            <div style={{ fontSize: 20, marginBottom: 4 }}>{s.icon}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.count}</div>
            <div style={{ fontSize: 11, color: S.muted, marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <input style={{ ...inp, flex: 1, minWidth: 200 }} value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 بحث باسم أو رقم الطلب..." />
        <select style={sel} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="all">كل الحالات</option>
          {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
        </select>
        <select style={sel} value={filterDept} onChange={e => setFilterDept(e.target.value)}>
          <option value="all">كل الأقسام</option>
          {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>

      {/* Requests List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: S.muted }}>⏳ جاري التحميل...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📦</div>
          <div style={{ fontSize: 15, color: S.muted }}>لا توجد طلبات</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(req => {
            const st = STATUS_CONFIG[req.status] || STATUS_CONFIG.pending
            const itemCount = req.branch_request_items?.length || 0
            // هل فيه إجراء مطلوب من المستخدم الحالي؟
            const needsAction =
              (canDoManagerApproval(role) && req.status === 'pending') ||
              (canDoBranchApproval(role) && req.status === 'manager_approved') ||
              (canDoWarehouseAction(role) && req.status === 'branch_approved') ||
              (canDoManagerApproval(role) && req.status === 'warehouse_processing') ||
              (SUPERVISOR_ROLES.includes(role) && req.status === 'manager_received')

            return (
              <div key={req.id} onClick={() => setSelected(req)}
                style={{ background: needsAction ? `rgba(245,158,11,0.06)` : S.card2, border: `1px solid ${needsAction ? S.amber + '50' : S.border}`, borderRadius: 14, padding: '16px 20px', cursor: 'pointer', transition: 'all .2s', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}
                onMouseEnter={e => (e.currentTarget.style.border = `1px solid ${st.color}60`)}
                onMouseLeave={e => (e.currentTarget.style.border = `1px solid ${needsAction ? S.amber + '50' : S.border}`)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 10, background: st.bg, border: `1px solid ${st.color}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>
                    {st.icon}
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                      <span style={{ fontSize: 15, fontWeight: 800, color: S.white }}>طلب #{req.request_number}</span>
                      <span style={{ background: st.bg, color: st.color, borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 700 }}>{st.label}</span>
                      {needsAction && <span style={{ background: S.amberB, color: S.amber, borderRadius: 20, padding: '2px 8px', fontSize: 10, fontWeight: 700, animation: 'pulse 1.5s infinite' }}>⚡ يحتاج إجراء</span>}
                    </div>
                    <div style={{ fontSize: 12, color: S.muted }}>
                      {req.branches?.name} · {req.department} · {req.requested_by}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: S.blue }}>{itemCount}</div>
                    <div style={{ fontSize: 10, color: S.muted }}>صنف</div>
                  </div>
                  <div style={{ fontSize: 12, color: S.muted }}>
                    {new Date(req.created_at).toLocaleDateString('ar-SA', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </div>
                  <div style={{ fontSize: 18, color: S.muted }}>←</div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modals */}
      {showNew && (
        <NewRequestModal
          branches={branches} products={products} units={units}
          currentEmployee={employee}
          onClose={() => setShowNew(false)}
          onSaved={() => { setShowNew(false); fetchAll() }}
        />
      )}
      {selected && (
        <RequestDetailModal
          request={selected}
          currentEmployee={employee}
          onClose={() => setSelected(null)}
          onUpdate={() => { setSelected(null); fetchAll() }}
        />
      )}

      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.6}}`}</style>
    </div>
  )
}
