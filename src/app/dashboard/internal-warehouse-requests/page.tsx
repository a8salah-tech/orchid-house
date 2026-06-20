'use client'

import { useEffect, useState, useCallback } from 'react'
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
const SUPERVISOR_ROLES = ['kitchen_supervisor', 'hall_supervisor', 'bar_supervisor']
const MANAGER_ROLES = ['kitchen_manager', 'hall_manager', 'bar_manager']
const SENIOR_ROLES = ['admin', 'branch_manager']

// ✅ بعض الموظفين القدامى مسجل قسمهم بالإنجليزي في قاعدة البيانات (Hall/Kitchen/Bar)
// بدل العربي (الصالة/المطبخ/البار) — هذه الدالة توحّد القيمتين كمتساويتين
function normalizeDept(dept: string | null | undefined): string {
  const map: Record<string, string> = {
    'hall': 'الصالة', 'kitchen': 'المطبخ', 'bar': 'البار',
    'desserts': 'الحلويات', 'cleaning': 'النظافة', 'admin': 'الإدارة',
  }
  const key = (dept || '').trim().toLowerCase()
  return map[key] || (dept || '').trim()
}

interface InternalRequest {
  id: string; created_at: string; request_number: number
  branch_id: string; department: string; status: string
  notes?: string; requested_by: string
  approved_by?: string; approved_at?: string
  rejected_by?: string; rejected_at?: string; rejection_reason?: string
  branches?: { name: string }
  internal_warehouse_request_items?: {
    id: string; quantity_requested: number; quantity_approved?: number
    notes?: string
    warehouse_products?: { name: string; name_en?: string }
    units?: { symbol: string }
  }[]
}

// ══ Request Card ══
function RequestCard({ req, role, onOpen }: { req: InternalRequest; role: string; onOpen: () => void }) {
  const statusColors: Record<string,{color:string;bg:string;icon:string;label:string}> = {
    pending:   { color: S.amber, bg: S.amberB, icon: '⏳', label: 'قيد الانتظار' },
    approved:  { color: S.green, bg: S.greenB, icon: '✅', label: 'تمت الموافقة والخصم' },
    rejected:  { color: S.red,   bg: S.redB,   icon: '❌', label: 'مرفوض' },
  }
  const st = statusColors[req.status] || statusColors.pending
  const needsAction = role === 'warehouse_keeper' && req.status === 'pending'

  return (
    <div onClick={onOpen} style={{ background: needsAction ? 'rgba(245,158,11,0.05)' : S.card2, border: `1px solid ${needsAction ? S.amber+'50' : S.border}`, borderRadius: 14, padding: '14px 18px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 42, height: 42, borderRadius: 10, background: st.bg, border: `1px solid ${st.color}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>{st.icon}</div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
            <span style={{ fontSize: 14, fontWeight: 800, color: S.white }}>طلب #{req.request_number}</span>
            <span style={{ background: st.bg, color: st.color, borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 700 }}>{st.label}</span>
            {needsAction && <span style={{ background: S.amberB, color: S.amber, borderRadius: 20, padding: '2px 8px', fontSize: 10, fontWeight: 700 }}>⚡ يحتاج إجراء</span>}
          </div>
          <div style={{ fontSize: 12, color: S.muted }}>{req.branches?.name} · {req.department} · {req.requested_by}</div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: S.blue }}>{req.internal_warehouse_request_items?.length || 0}</div>
          <div style={{ fontSize: 10, color: S.muted }}>صنف</div>
        </div>
        <div style={{ fontSize: 11, color: S.muted }}>{new Date(req.created_at).toLocaleDateString('ar-SA', { month: 'short', day: 'numeric' })}</div>
        <div style={{ fontSize: 16, color: S.muted }}>←</div>
      </div>
    </div>
  )
}

function NewRequestModal({ onClose, onSaved, currentEmployee }: { onClose: () => void; onSaved: () => void; currentEmployee: any }) {
  const sb = createClient()
  const [saving, setSaving] = useState(false)
  const [allDeptProducts, setAllDeptProducts] = useState<Record<string, any[]>>({ المطبخ: [], البار: [], الصالة: [] })
  const [branchWarehouseProductIds, setBranchWarehouseProductIds] = useState<Set<string>>(new Set())
  const [units, setUnits] = useState<any[]>([])
  const [items, setItems] = useState([{ product_id: '', product_name: '', available_locally: true, qty: '', unit_id: '', notes: '' }])
  const [search, setSearch] = useState('')
  const [activeDeptTab, setActiveDeptTab] = useState('المطبخ')
  const [monthlyConsumption, setMonthlyConsumption] = useState<Record<string, number>>({})
  const role = currentEmployee?.role || ''
  const autoDept = role.includes('kitchen') ? 'المطبخ' : role.includes('hall') ? 'الصالة' : role.includes('bar') ? 'البار' : normalizeDept(currentEmployee?.department)
  const [form, setForm] = useState({ department: autoDept, requested_by: currentEmployee?.name || '', notes: '' })

  useEffect(() => {
    const branchId = currentEmployee?.branch_id
    if (!branchId) return

    // 1) جلب id مستودع الفرع، ثم أصنافه (لتحديد ما هو متوفر محليًا)
    sb.from('warehouses').select('id').eq('branch_id', branchId).maybeSingle()
      .then(({ data: wh }) => {
        if (wh?.id) {
          sb.from('warehouse_products').select('id').eq('is_active', true).eq('warehouse_id', wh.id)
            .then(({ data }) => setBranchWarehouseProductIds(new Set((data || []).map((p: any) => p.id))))
        }
      })

    // 2) جلب كل أصناف كل الأقسام (من أي مستودع)، موحدة بالاسم بدون تكرار
    Promise.all(['المطبخ', 'البار', 'الصالة'].map(dept =>
      sb.from('department_products')
        .select('product_id, warehouse_products(id,name,name_en,product_code,current_stock,unit_id,units(symbol))')
        .eq('department', dept)
        .then(({ data }) => ({ dept, data: data || [] }))
    )).then(results => {
      const grouped: Record<string, any[]> = { المطبخ: [], البار: [], الصالة: [] }
      for (const { dept, data } of results) {
        const seen = new Map<string, any>() // مفتاح: الاسم بعد التنظيف، قيمة: أول نسخة من الصنف
        for (const row of data) {
          const wp = (row as any).warehouse_products
          if (!wp) continue
          const cleanName = (wp.name || '').trim()
          if (!cleanName) continue
          if (!seen.has(cleanName)) {
            seen.set(cleanName, wp)
          }
        }
        grouped[dept] = Array.from(seen.values()).sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ar'))
      }
      setAllDeptProducts(grouped)
    })

    sb.from('units').select('*').order('name').then(({ data }) => setUnits(data || []))

    // متوسط الاستهلاك الشهري لكل صنف من حركات الصرف (out) خلال آخر 30 يوم
    const since = new Date(); since.setDate(since.getDate() - 30)
    sb.from('stock_movements').select('product_id, quantity').eq('movement_type', 'out').gte('movement_date', since.toISOString().slice(0,10))
      .then(({ data }) => {
        const totals: Record<string, number> = {}
        for (const m of (data || [])) {
          totals[m.product_id] = (totals[m.product_id] || 0) + (m.quantity || 0)
        }
        setMonthlyConsumption(totals)
      })
  }, [])

  const currentDeptProducts = allDeptProducts[activeDeptTab] || []

  async function save() {
    const branchId = currentEmployee?.branch_id
    if (!branchId || !form.department || !form.requested_by) { alert('يرجى إكمال البيانات'); return }
    if (items.some(i => !i.product_id || !i.qty)) { alert('يرجى إكمال الأصناف'); return }
    setSaving(true)
    const { data: req, error } = await sb.from('internal_warehouse_requests').insert([{
      branch_id: branchId, department: form.department, requested_by: form.requested_by, notes: form.notes || null, status: 'pending'
    }]).select().single()
    if (error) { alert('خطأ: ' + error.message); setSaving(false); return }
    for (const item of items) {
      await sb.from('internal_warehouse_request_items').insert([{ request_id: req.id, product_id: item.product_id, quantity_requested: parseFloat(item.qty), unit_id: item.unit_id || null, notes: item.notes || null }])
    }
    setSaving(false); onSaved()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 300, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 20, overflowY: 'auto' }}>
      <div style={{ background: S.navy2, borderRadius: 20, border: `1px solid ${S.border}`, width: '100%', maxWidth: 680, padding: 28, margin: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <h2 style={{ color: S.white, fontSize: 17, fontWeight: 800 }}>🏭 طلب من المستودع الداخلي</h2>
            <p style={{ fontSize: 12, color: S.muted }}>سيُرسل الطلب لأمين المستودع في الفرع للاعتماد المباشر</p>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: S.muted, fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
          <div>
            <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 4 }}>القسم *</label>
            <select style={{ ...inp, cursor: 'pointer', background: S.navy3 }} value={form.department} onChange={e => setForm(p => ({ ...p, department: e.target.value }))}>
              <option value="">-- اختر --</option>
              {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 4 }}>مقدم الطلب *</label>
            <input style={inp} value={form.requested_by} onChange={e => setForm(p => ({ ...p, requested_by: e.target.value }))} />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 4 }}>ملاحظات</label>
            <input style={inp} value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="أي ملاحظات..." />
          </div>
        </div>
        {/* تابات الأقسام */}
        <div style={{ background: S.navy3, borderRadius: 12, padding: 14, marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: S.gold, marginBottom: 12 }}>📦 اختر الأصناف من القسم</div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
            {['المطبخ','البار','الصالة'].map(dept => (
              <button key={dept} onClick={() => setActiveDeptTab(dept)}
                style={{ padding: '7px 16px', borderRadius: 10, border: `1px solid ${activeDeptTab===dept ? S.gold : S.border}`, background: activeDeptTab===dept ? S.gold3 : 'transparent', color: activeDeptTab===dept ? S.gold : S.muted, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', fontWeight: activeDeptTab===dept ? 700 : 400 }}>
                {dept==='المطبخ'?'🍳':dept==='البار'?'🍹':'🪑'} {dept}
              </button>
            ))}
          </div>
          <input style={{ ...inp, marginBottom: 12, fontSize: 12 }} value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 بحث بالاسم أو الكود (مثال: OR001)..." />
          {currentDeptProducts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 20, color: S.muted, fontSize: 12 }}>لا توجد أصناف محددة لهذا القسم</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: 8, maxHeight: 300, overflowY: 'auto' }}>
              {currentDeptProducts
                .filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase()) || (p.product_code || '').toLowerCase().includes(search.toLowerCase()))
                .map(p => {
                const isSelected = items.some(it => it.product_id === p.id)
                const availableLocally = branchWarehouseProductIds.has(p.id)
                return (
                  <div key={p.id} onClick={() => {
                    if (isSelected) setItems(prev => prev.filter(it => it.product_id !== p.id))
                    else {
                      const unitId = p.unit_id || (p.units ? units.find((u:any) => u.symbol === p.units?.symbol)?.id||'' : '')
                      setItems(prev => [...prev.filter(it => it.product_id !== ''), { product_id: p.id, product_name: p.name, available_locally: availableLocally, qty: '', unit_id: unitId, notes: '' }])
                    }
                  }} style={{ background: isSelected ? S.gold3 : 'rgba(255,255,255,0.03)', borderRadius: 10, border: `1px solid ${isSelected ? S.gold : !availableLocally ? S.amber+'40' : S.border}`, padding: '10px 12px', cursor: 'pointer' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                      <div style={{ flex: 1 }}>
                        {p.product_code && (
                          <span style={{ display: 'inline-block', background: S.gold3, color: S.gold, borderRadius: 6, padding: '1px 6px', fontSize: 9, fontWeight: 700, fontFamily: 'system-ui', marginBottom: 3 }}>{p.product_code}</span>
                        )}
                        <div style={{ fontSize: 11, fontWeight: 700, color: isSelected ? S.gold : S.white }}>{p.name}</div>
                      </div>
                      {isSelected && <span style={{ color: S.gold, fontSize: 13 }}>✓</span>}
                    </div>
                    {!availableLocally && (
                      <div style={{ fontSize: 9, color: S.amber, fontWeight: 700, marginBottom: 3 }}>⚠️ غير متوفر محليًا</div>
                    )}
                    <div style={{ fontSize: 10, color: S.muted }}>
                      📦 المخزون: {availableLocally ? (p.current_stock ?? 0) : '—'} {p.units?.symbol} · 📊 استهلاك شهري: {(monthlyConsumption[p.id] || 0).toFixed(0)} {p.units?.symbol}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
        {items.filter(it => it.product_id).length > 0 && (
          <div style={{ background: S.navy3, borderRadius: 12, padding: 14, marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: S.blue, marginBottom: 12 }}>📋 الأصناف المختارة ({items.filter(it => it.product_id).length})</div>
            {items.map((item, i) => {
              if (!item.product_id) return null
              return (
                <div key={i} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: '10px 12px', marginBottom: 8, border: `1px solid ${item.available_locally ? S.border : S.amber+'40'}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: S.white }}>{item.product_name}</div>
                      {!item.available_locally && <div style={{ fontSize: 10, color: S.amber, fontWeight: 700 }}>⚠️ غير متوفر محليًا — يحتاج تأكيد من أمين المستودع</div>}
                    </div>
                    <button onClick={() => setItems(p => p.filter((_,idx) => idx!==i))} style={{ padding: '3px 8px', borderRadius: 6, border: `1px solid ${S.red}`, background: S.redB, color: S.red, cursor: 'pointer', fontSize: 11 }}>🗑️</button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <input type="number" style={{ ...inp, direction: 'ltr', fontSize: 12 }} value={item.qty} onChange={e => setItems(p => p.map((it,idx) => idx===i ? { ...it, qty: e.target.value } : it))} placeholder="الكمية" />
                    <select style={{ ...inp, cursor: 'pointer', background: S.navy3, fontSize: 12 }} value={item.unit_id} onChange={e => setItems(p => p.map((it,idx) => idx===i ? { ...it, unit_id: e.target.value } : it))}>
                      <option value="">الوحدة</option>
                      {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>
                  </div>
                  <input style={{ ...inp, fontSize: 11, marginTop: 6 }} value={item.notes} onChange={e => setItems(p => p.map((it,idx) => idx===i ? { ...it, notes: e.target.value } : it))} placeholder="📝 ملاحظات للصنف..." />
                </div>
              )
            })}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '10px 20px', borderRadius: 10, border: `1px solid ${S.muted}`, background: 'transparent', color: S.muted, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif' }}>إلغاء</button>
          <button onClick={save} disabled={saving} style={{ padding: '10px 24px', borderRadius: 10, border: `1px solid ${S.blue}`, background: S.blueB, color: S.blue, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
            {saving ? '⏳...' : '📤 إرسال الطلب'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ══ Request Detail Modal ══
function RequestDetailModal({ request, currentEmployee, onClose, onUpdate }: { request: InternalRequest; currentEmployee: any; onClose: () => void; onUpdate: () => void }) {
  const sb = createClient()
  const { isAr } = useLang()
  const [updating, setUpdating] = useState(false)
  const [actionBy, setActionBy] = useState(currentEmployee?.name || '')
  const [rejectReason, setRejectReason] = useState('')
  const [showReject, setShowReject] = useState(false)
  const [approvedQtys, setApprovedQtys] = useState<Record<string, number>>(
    Object.fromEntries((request.internal_warehouse_request_items || []).map(i => [i.id, i.quantity_requested]))
  )
  const role = currentEmployee?.role || ''

  const canApprove = role === 'warehouse_keeper' && request.status === 'pending'

  async function approve() {
    if (!actionBy.trim()) { alert('يرجى إدخال اسمك'); return }
    setUpdating(true)

    // 1) جلب مستودع الفرع الخاص بهذا الطلب
    const { data: wh, error: whErr } = await sb.from('warehouses').select('id').eq('branch_id', request.branch_id).maybeSingle()
    if (whErr || !wh?.id) { alert('لم يتم العثور على مستودع لهذا الفرع'); setUpdating(false); return }

    // 2) لكل صنف: خصم الكمية المعتمدة من المخزون + تسجيل حركة صرف
    for (const item of (request.internal_warehouse_request_items || [])) {
      const qty = approvedQtys[item.id] ?? item.quantity_requested
      const { data: wp } = await sb.from('warehouse_products')
        .select('id, current_stock')
        .eq('warehouse_id', wh.id)
        .eq('id', (item as any).product_id)
        .maybeSingle()
      if (wp) {
        const newStock = Math.max(0, (wp.current_stock || 0) - qty)
        await sb.from('warehouse_products').update({ current_stock: newStock }).eq('id', wp.id)
        await sb.from('stock_movements').insert([{
          product_id: (item as any).product_id,
          warehouse_id: wh.id,
          movement_type: 'out',
          quantity: qty,
          movement_date: new Date().toISOString().slice(0, 10),
          notes: `طلب مستودع داخلي #${request.request_number} — ${request.department}`,
        }])
      }
      await sb.from('internal_warehouse_request_items').update({ quantity_approved: qty }).eq('id', item.id)
    }

    // 3) تحديث حالة الطلب
    await sb.from('internal_warehouse_requests').update({
      status: 'approved', approved_by: actionBy, approved_at: new Date().toISOString(),
    }).eq('id', request.id)

    setUpdating(false)
    onUpdate()
  }

  async function reject() {
    if (!actionBy.trim()) { alert('يرجى إدخال اسمك'); return }
    if (!rejectReason.trim()) { alert('يرجى إدخال سبب الرفض'); return }
    setUpdating(true)
    await sb.from('internal_warehouse_requests').update({
      status: 'rejected', rejected_by: actionBy, rejected_at: new Date().toISOString(), rejection_reason: rejectReason,
    }).eq('id', request.id)
    setUpdating(false)
    onUpdate()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, overflowY: 'auto' }}>
      <div style={{ background: S.navy2, borderRadius: 20, border: `1px solid ${S.border}`, width: '100%', maxWidth: 620, padding: 24, margin: 'auto', maxHeight: '90vh', overflowY: 'auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div>
            <h3 style={{ color: S.gold, fontSize: 16, fontWeight: 800, marginBottom: 4 }}>طلب #{request.request_number}</h3>
            <div style={{ fontSize: 11, color: S.muted }}>
              {new Date(request.created_at).toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: S.muted, fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>

        {/* Info Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
          {[
            { icon: '🏪', label: 'الفرع', value: request.branches?.name },
            { icon: '🏷️', label: 'القسم', value: request.department },
            { icon: '👷', label: 'مقدم الطلب', value: request.requested_by },
            { icon: '📝', label: 'ملاحظات', value: request.notes || '—' },
          ].map((row, i) => (
            <div key={i} style={{ background: S.card, borderRadius: 10, padding: '10px 12px' }}>
              <div style={{ fontSize: 11, color: S.muted, marginBottom: 2 }}>{row.icon} {row.label}</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: S.white }}>{row.value || '—'}</div>
            </div>
          ))}
        </div>

        {/* Items */}
        <div style={{ background: S.navy3, borderRadius: 12, overflow: 'hidden', marginBottom: 16 }}>
          <div style={{ padding: '10px 14px', borderBottom: `1px solid ${S.border}`, fontSize: 13, fontWeight: 700, color: S.gold }}>
            الأصناف ({request.internal_warehouse_request_items?.length || 0})
          </div>
          {(request.internal_warehouse_request_items || []).map((item, i) => (
            <div key={i} style={{ padding: '12px 14px', borderBottom: i < (request.internal_warehouse_request_items?.length||0)-1 ? `1px solid ${S.border}` : 'none' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: S.white }}>{item.warehouse_products?.name}</div>
                  {item.warehouse_products?.name_en && <div style={{ fontSize: 11, color: S.muted }}>{item.warehouse_products.name_en}</div>}
                  {item.notes && <div style={{ fontSize: 11, color: S.amber, marginTop: 3 }}>📝 {item.notes}</div>}
                </div>
                <div style={{ textAlign: 'left', flexShrink: 0 }}>
                  {canApprove ? (
                    <input type="number" min="0" value={approvedQtys[item.id] ?? item.quantity_requested}
                      onChange={e => setApprovedQtys(p => ({ ...p, [item.id]: parseFloat(e.target.value) || 0 }))}
                      style={{ width: 80, textAlign: 'center', background: 'rgba(255,255,255,0.04)', border: `1px solid ${S.blue}40`, borderRadius: 8, padding: '6px 8px', fontSize: 13, color: S.white, outline: 'none', fontFamily: 'Tajawal, sans-serif', direction: 'ltr' }} />
                  ) : (
                    <div style={{ fontSize: 13, fontWeight: 700, color: S.blue }}>{item.quantity_requested} {item.units?.symbol}</div>
                  )}
                  {(item.quantity_approved||0) > 0 && request.status === 'approved' && <div style={{ fontSize: 11, color: S.green, marginTop: 4 }}>تم خصم: {item.quantity_approved} {item.units?.symbol}</div>}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* حالة الرفض */}
        {request.status === 'rejected' && (
          <div style={{ background: S.redB, border: `1px solid ${S.red}40`, borderRadius: 12, padding: 14, marginBottom: 16 }}>
            <div style={{ fontSize: 12, color: S.red, fontWeight: 700, marginBottom: 4 }}>❌ مرفوض بواسطة {request.rejected_by}</div>
            <div style={{ fontSize: 12, color: S.muted }}>السبب: {request.rejection_reason}</div>
          </div>
        )}

        {/* حالة الموافقة */}
        {request.status === 'approved' && (
          <div style={{ background: S.greenB, border: `1px solid ${S.green}40`, borderRadius: 12, padding: 14, marginBottom: 16 }}>
            <div style={{ fontSize: 12, color: S.green, fontWeight: 700 }}>✅ تمت الموافقة والخصم من المخزون بواسطة {request.approved_by}</div>
          </div>
        )}

        {/* Actions */}
        {canApprove && !showReject && (
          <div style={{ background: S.card, borderRadius: 12, padding: 14, marginBottom: 14 }}>
            <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 6 }}>اسمك (أمين المستودع) *</label>
            <input style={{ ...inp, marginBottom: 12 }} value={actionBy} onChange={e => setActionBy(e.target.value)} placeholder="أدخل اسمك..." />
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={approve} disabled={updating}
                style={{ flex: 1, padding: '10px', borderRadius: 10, border: `1px solid ${S.green}`, background: S.greenB, color: S.green, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
                {updating ? '⏳...' : '✅ موافقة وخصم من المخزون'}
              </button>
              <button onClick={() => setShowReject(true)} disabled={updating}
                style={{ padding: '10px 16px', borderRadius: 10, border: `1px solid ${S.red}`, background: S.redB, color: S.red, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
                ❌ رفض
              </button>
            </div>
          </div>
        )}

        {canApprove && showReject && (
          <div style={{ background: S.card, borderRadius: 12, padding: 14, marginBottom: 14 }}>
            <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 6 }}>اسمك *</label>
            <input style={{ ...inp, marginBottom: 12 }} value={actionBy} onChange={e => setActionBy(e.target.value)} placeholder="أدخل اسمك..." />
            <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 6 }}>سبب الرفض *</label>
            <input style={{ ...inp, marginBottom: 12 }} value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="اكتب سبب الرفض..." />
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setShowReject(false)} style={{ padding: '10px 16px', borderRadius: 10, border: `1px solid ${S.muted}`, background: 'transparent', color: S.muted, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif' }}>
                رجوع
              </button>
              <button onClick={reject} disabled={updating}
                style={{ flex: 1, padding: '10px', borderRadius: 10, border: `1px solid ${S.red}`, background: S.redB, color: S.red, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
                {updating ? '⏳...' : '❌ تأكيد الرفض'}
              </button>
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
export default function InternalWarehouseRequestsPage() {
  const sb = createClient()
  const { employee } = useAuth()
  const { isAr } = useLang()
  const [requests, setRequests] = useState<InternalRequest[]>([])
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [selected, setSelected] = useState<InternalRequest|null>(null)
  const [activeTab, setActiveTab] = useState(0)
  const [activeBranch, setActiveBranch] = useState<string>('') // '' = الإجمالي (admin فقط)، أو branch_id محدد
  const [showReport, setShowReport] = useState(false)
  const [search, setSearch] = useState('')

  const role = employee?.role || ''
  const myBranchId = employee?.branch_id || ''
  const isAdmin = role === 'admin'

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const { data } = await sb.from('internal_warehouse_requests')
      .select('*, branches(name), internal_warehouse_request_items(id,product_id,quantity_requested,quantity_approved,unit_id,notes,warehouse_products(name,name_en),units(symbol))')
      .order('created_at', { ascending: false })
    setRequests(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])
  useEffect(() => {
    sb.from('branches').select('id,name').eq('is_active', true).then(({ data }) => setBranches(data || []))
  }, [])
  useEffect(() => {
    // الأدوار غير admin تتقفل على فرعها تلقائيًا
    if (!isAdmin && myBranchId) setActiveBranch(myBranchId)
  }, [isAdmin, myBranchId])

  const isBranchManager = role === 'branch_manager'
  const isWarehouseKeeper = role === 'warehouse_keeper'
  const canCreate = [...SUPERVISOR_ROLES, ...MANAGER_ROLES, ...SENIOR_ROLES].includes(role)

  // طلبات الفرع النشط (أو كل الفروع لو activeBranch فاضي و admin)
  const branchRequests = activeBranch ? requests.filter(r => r.branch_id === activeBranch) : requests
  // الأدوار غير admin تشوف بس تاب فرعها
  const visibleBranches = isAdmin ? branches : branches.filter(b => b.id === myBranchId)

  // تعريف التابات (الحالة: قيد الانتظار/معتمدة/مرفوضة)
  const allTabs = [
    { label: isAr ? 'قيد الانتظار' : 'Pending', icon: '⏳', show: true, filter: (r: InternalRequest) => r.status === 'pending' },
    { label: isAr ? 'معتمدة' : 'Approved', icon: '✅', show: true, filter: (r: InternalRequest) => r.status === 'approved' },
    { label: isAr ? 'مرفوضة' : 'Rejected', icon: '❌', show: true, filter: (r: InternalRequest) => r.status === 'rejected' },
  ]
  const visibleTabs = allTabs.filter(t => t.show)
  const currentTab = visibleTabs[activeTab] || visibleTabs[0]

  const filtered = branchRequests.filter(r => {
    const tabMatch = currentTab?.filter(r) || false
    const searchMatch = !search || r.requested_by?.includes(search) || String(r.request_number).includes(search) || r.department?.includes(search)
    return tabMatch && searchMatch
  })

  // تقرير مقارن لكل فرع (admin فقط)
  const comparisonReport = branches.map(b => {
    const brReqs = requests.filter(r => r.branch_id === b.id)
    return {
      id: b.id, name: b.name,
      total: brReqs.length,
      pending: brReqs.filter(r => r.status === 'pending').length,
      approved: brReqs.filter(r => r.status === 'approved').length,
      rejected: brReqs.filter(r => r.status === 'rejected').length,
    }
  })

  return (
    <div style={{ fontFamily: 'Tajawal, sans-serif', direction: isAr ? 'rtl' : 'ltr', color: S.white }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700;800&display=swap'); @keyframes pulse{0%,100%{opacity:1}50%{opacity:.6}} select option{background:#0F2040}`}</style>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: S.white, marginBottom: 4 }}>🏭 طلبات المستودع الداخلي</h1>
          <p style={{ fontSize: 13, color: S.muted }}>{isAr ? 'طلب مستلزمات مباشرة من مستودع الفرع — يحتاج موافقة أمين المستودع' : 'Direct requests from the branch internal warehouse'}</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {isAdmin && (
            <button onClick={() => setShowReport(true)} style={{ padding: '10px 18px', borderRadius: 12, border: `1px solid ${S.purple}`, background: S.purpleB, color: S.purple, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
              📊 {isAr ? 'تقرير مقارن' : 'Comparison Report'}
            </button>
          )}
          {canCreate && (
            <button onClick={() => setShowNew(true)} style={{ padding: '10px 20px', borderRadius: 12, border: `1px solid ${S.gold}`, background: S.gold3, color: S.gold, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
              ➕ {isAr ? 'طلب جديد' : 'New Request'}
            </button>
          )}
        </div>
      </div>

      {/* Branch Tabs */}
      {visibleBranches.length > 1 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          {isAdmin && (
            <button onClick={() => setActiveBranch('')}
              style={{ padding: '9px 16px', borderRadius: 12, border: `1px solid ${activeBranch === '' ? S.gold : S.border}`, background: activeBranch === '' ? S.gold3 : 'transparent', color: activeBranch === '' ? S.gold : S.muted, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: activeBranch === '' ? 700 : 400 }}>
              🌐 {isAr ? 'الإجمالي (الكل)' : 'All Branches'}
            </button>
          )}
          {visibleBranches.map(b => (
            <button key={b.id} onClick={() => setActiveBranch(b.id)}
              style={{ padding: '9px 16px', borderRadius: 12, border: `1px solid ${activeBranch === b.id ? S.gold : S.border}`, background: activeBranch === b.id ? S.gold3 : 'transparent', color: activeBranch === b.id ? S.gold : S.muted, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: activeBranch === b.id ? 700 : 400 }}>
              🏪 {b.name}
            </button>
          ))}
        </div>
      )}

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 10, marginBottom: 20 }}>
        {[
          { label: isAr ? 'قيد الانتظار' : 'Pending', count: branchRequests.filter(r=>r.status==='pending').length, color: S.amber, bg: S.amberB, icon: '⏳' },
          { label: isAr ? 'معتمدة' : 'Approved', count: branchRequests.filter(r=>r.status==='approved').length, color: S.green, bg: S.greenB, icon: '✅' },
          { label: isAr ? 'مرفوضة' : 'Rejected', count: branchRequests.filter(r=>r.status==='rejected').length, color: S.red, bg: S.redB, icon: '❌' },
        ].map((s, i) => (
          <div key={i} style={{ background: s.bg, borderRadius: 12, padding: '12px 14px', border: `1px solid ${s.color}30` }}>
            <div style={{ fontSize: 18, marginBottom: 4 }}>{s.icon}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: s.color }}>{s.count}</div>
            <div style={{ fontSize: 11, color: S.muted }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {visibleTabs.map((tab, i) => {
          const count = branchRequests.filter(tab.filter).length
          return (
            <button key={i} onClick={() => setActiveTab(i)}
              style={{ padding: '9px 16px', borderRadius: 10, border: `1px solid ${activeTab===i ? S.gold : S.border}`, background: activeTab===i ? S.gold3 : 'transparent', color: activeTab===i ? S.gold : S.muted, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: activeTab===i ? 700 : 400, display: 'flex', alignItems: 'center', gap: 6 }}>
              {tab.icon} {tab.label}
              {count > 0 && <span style={{ background: activeTab===i ? S.gold : S.amber, color: S.navy, borderRadius: 20, padding: '1px 7px', fontSize: 10, fontWeight: 800 }}>{count}</span>}
            </button>
          )
        })}
      </div>

      {/* Search */}
      <div style={{ marginBottom: 16 }}>
        <input style={{ ...inp, maxWidth: 400 }} value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 بحث بالاسم أو رقم الطلب أو القسم..." />
      </div>

      {/* List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: S.muted }}>⏳ جاري التحميل...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, background: S.navy2, borderRadius: 16, border: `1px solid ${S.border}` }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🏭</div>
          <div style={{ fontSize: 14, color: S.muted }}>{isAr ? 'لا توجد طلبات في هذا التاب' : 'No requests in this tab'}</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(req => (
            <RequestCard key={req.id} req={req} role={role} onOpen={() => setSelected(req)} />
          ))}
        </div>
      )} 
      {showNew && <NewRequestModal onClose={() => setShowNew(false)} onSaved={() => { setShowNew(false); fetchAll() }} currentEmployee={employee} />}
      {selected && <RequestDetailModal request={selected} currentEmployee={employee} onClose={() => setSelected(null)} onUpdate={() => { setSelected(null); fetchAll() }} />}

      {/* Comparison Report Modal */}
      {showReport && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: S.navy2, borderRadius: 20, border: `1px solid ${S.border}`, width: '100%', maxWidth: 600, padding: 28, maxHeight: '85vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 style={{ color: S.white, fontSize: 18, fontWeight: 800 }}>📊 {isAr ? 'تقرير مقارن — كل الفروع' : 'Comparison Report — All Branches'}</h2>
              <button onClick={() => setShowReport(false)} style={{ background: 'transparent', border: 'none', color: S.muted, fontSize: 20, cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ background: S.navy3, borderRadius: 14, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: S.card2 }}>
                    {[isAr ? 'الفرع' : 'Branch', isAr ? 'الإجمالي' : 'Total', isAr ? 'قيد الانتظار' : 'Pending', isAr ? 'معتمدة' : 'Approved', isAr ? 'مرفوضة' : 'Rejected'].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'right', fontSize: 12, color: S.muted, fontWeight: 700, borderBottom: `1px solid ${S.border}` }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {comparisonReport.map(r => (
                    <tr key={r.id} style={{ borderBottom: `1px solid ${S.border}` }}>
                      <td style={{ padding: '12px 14px', fontSize: 13, color: S.white, fontWeight: 700 }}>🏪 {r.name}</td>
                      <td style={{ padding: '12px 14px', fontSize: 13, color: S.blue, fontWeight: 700 }}>{r.total}</td>
                      <td style={{ padding: '12px 14px', fontSize: 13, color: S.amber }}>{r.pending}</td>
                      <td style={{ padding: '12px 14px', fontSize: 13, color: S.green }}>{r.approved}</td>
                      <td style={{ padding: '12px 14px', fontSize: 13, color: S.red }}>{r.rejected}</td>
                    </tr>
                  ))}
                  <tr style={{ background: S.gold3 }}>
                    <td style={{ padding: '12px 14px', fontSize: 13, color: S.gold, fontWeight: 800 }}>🌐 {isAr ? 'الإجمالي الكلي' : 'Grand Total'}</td>
                    <td style={{ padding: '12px 14px', fontSize: 14, color: S.gold, fontWeight: 800 }}>{comparisonReport.reduce((s,r)=>s+r.total,0)}</td>
                    <td style={{ padding: '12px 14px', fontSize: 13, color: S.gold, fontWeight: 800 }}>{comparisonReport.reduce((s,r)=>s+r.pending,0)}</td>
                    <td style={{ padding: '12px 14px', fontSize: 13, color: S.gold, fontWeight: 800 }}>{comparisonReport.reduce((s,r)=>s+r.approved,0)}</td>
                    <td style={{ padding: '12px 14px', fontSize: 13, color: S.gold, fontWeight: 800 }}>{comparisonReport.reduce((s,r)=>s+r.rejected,0)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <button onClick={() => setShowReport(false)} style={{ width: '100%', marginTop: 16, padding: '10px', borderRadius: 10, border: `1px solid ${S.muted}`, background: 'transparent', color: S.muted, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif' }}>{isAr ? 'إغلاق' : 'Close'}</button>
          </div>
        </div>
      )}
    </div> 
  )  
}  
