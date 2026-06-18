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
}

const inp: React.CSSProperties = {
  width: '100%', background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.10)',
  borderRadius: 10, padding: '10px 14px', fontSize: 13,
  color: '#FAFAF8', outline: 'none', fontFamily: 'Tajawal, sans-serif',
  boxSizing: 'border-box', direction: 'rtl',
}

const DEPARTMENTS = [
  { key: 'المطبخ', label: 'المطبخ', icon: '🍳' },
  { key: 'البار',  label: 'البار',  icon: '🍹' },
  { key: 'الصالة', label: 'الصالة/الحلويات', icon: '🍰' },
]

function daysUntil(dateStr: string) {
  const today = new Date(); today.setHours(0,0,0,0)
  const target = new Date(dateStr); target.setHours(0,0,0,0)
  return Math.round((target.getTime() - today.getTime()) / 86400000)
}

function expiryStatus(dateStr: string) {
  const d = daysUntil(dateStr)
  if (d < 0) return { label: 'منتهي الصلاحية', color: S.red, bg: S.redB, icon: '⛔' }
  if (d === 0) return { label: 'ينتهي اليوم', color: S.red, bg: S.redB, icon: '🔴' }
  if (d <= 2) return { label: `ينتهي خلال ${d} يوم`, color: S.amber, bg: S.amberB, icon: '⚠️' }
  return { label: `صالح (${d} يوم)`, color: S.green, bg: S.greenB, icon: '✅' }
}

interface PrepProduct { id: string; name: string; name_en?: string; department: string; unit_id?: string; units?: { symbol: string } }
interface PrepBatch {
  id: string; batch_number: number; prep_product_id: string; department: string
  quantity_produced: number; quantity_remaining: number
  production_date: string; expiry_date: string; produced_by: string; notes?: string; status: string
  prep_products?: PrepProduct
}

// ══ مودال صرف/استخدام من دفعة ══
function UseBatchModal({ batch, currentEmployee, onClose, onUpdated }: { batch: PrepBatch; currentEmployee: any; onClose: () => void; onUpdated: () => void }) {
  const sb = createClient()
  const [qty, setQty] = useState('')
  const [usedBy, setUsedBy] = useState(currentEmployee?.name || '')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  async function save() {
    const used = parseFloat(qty)
    if (!used || used <= 0) { alert('يرجى إدخال كمية صحيحة'); return }
    if (used > batch.quantity_remaining) { alert(`الكمية المتاحة في هذه الدفعة هي ${batch.quantity_remaining} فقط`); return }
    if (!usedBy.trim()) { alert('يرجى إدخال اسمك'); return }
    setSaving(true)
    const newRemaining = batch.quantity_remaining - used
    await sb.from('prep_production_batches').update({
      quantity_remaining: newRemaining,
      status: newRemaining <= 0 ? 'depleted' : 'active',
    }).eq('id', batch.id)
    await sb.from('prep_stock_usage').insert([{ batch_id: batch.id, quantity_used: used, used_by: usedBy, notes: notes || null }])
    setSaving(false)
    onUpdated()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: S.navy2, borderRadius: 20, border: `1px solid ${S.border}`, width: '100%', maxWidth: 420, padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <h3 style={{ color: S.white, fontSize: 15, fontWeight: 800 }}>📤 صرف من الدفعة #{batch.batch_number}</h3>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: S.muted, fontSize: 18, cursor: 'pointer' }}>✕</button>
        </div>
        <div style={{ background: S.card, borderRadius: 10, padding: 12, marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: S.white, marginBottom: 4 }}>{batch.prep_products?.name}</div>
          <div style={{ fontSize: 12, color: S.muted }}>المتاح حاليًا: <strong style={{ color: S.gold }}>{batch.quantity_remaining} {batch.prep_products?.units?.symbol}</strong></div>
        </div>
        <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 4 }}>الكمية المُستخدمة *</label>
        <input type="number" style={{ ...inp, direction: 'ltr', marginBottom: 12 }} value={qty} onChange={e => setQty(e.target.value)} placeholder="0" />
        <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 4 }}>اسمك *</label>
        <input style={{ ...inp, marginBottom: 12 }} value={usedBy} onChange={e => setUsedBy(e.target.value)} />
        <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 4 }}>ملاحظات</label>
        <input style={{ ...inp, marginBottom: 16 }} value={notes} onChange={e => setNotes(e.target.value)} placeholder="اختياري..." />
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onClose} style={{ padding: '10px 16px', borderRadius: 10, border: `1px solid ${S.muted}`, background: 'transparent', color: S.muted, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif' }}>إلغاء</button>
          <button onClick={save} disabled={saving} style={{ flex: 1, padding: '10px', borderRadius: 10, border: `1px solid ${S.blue}`, background: S.blueB, color: S.blue, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
            {saving ? '⏳...' : '✅ تأكيد الصرف'}
          </button>
        </div>
      </div>
    </div>
  )
}

function NewBatchModal({ onClose, onSaved, currentEmployee, branchId }: { onClose: () => void; onSaved: () => void; currentEmployee: any; branchId: string }) {
  const sb = createClient()
  const [saving, setSaving] = useState(false)
  const [units, setUnits] = useState<any[]>([])
  const [rawProducts, setRawProducts] = useState<any[]>([])
  const [existingPrepProducts, setExistingPrepProducts] = useState<PrepProduct[]>([])
  const [search, setSearch] = useState('')

  const role = currentEmployee?.role || ''
  const autoDept = role.includes('kitchen') ? 'المطبخ' : role.includes('hall') ? 'الصالة' : role.includes('bar') ? 'البار' : 'المطبخ'

  const [form, setForm] = useState({
    department: autoDept,
    prep_product_name: '',
    prep_product_id: '', // لو اختار من منتج موجود
    quantity_produced: '',
    unit_id: '',
    expiry_date: '',
    produced_by: currentEmployee?.name || '',
    notes: '',
  })
  const [consumed, setConsumed] = useState<{ product_id: string; qty: string; unit_id: string }[]>([
    { product_id: '', qty: '', unit_id: '' }
  ])

  useEffect(() => {
    sb.from('units').select('*').order('name').then(({ data }) => setUnits(data || []))
    // أصناف خام من مستودع الفرع الداخلي
    sb.from('warehouses').select('id').eq('branch_id', branchId).maybeSingle().then(({ data: wh }) => {
      if (wh?.id) {
        sb.from('warehouse_products').select('id,name,name_en,current_stock,unit_id,units(symbol)').eq('is_active', true).eq('warehouse_id', wh.id).order('name')
          .then(({ data }) => setRawProducts(data || []))
      }
    })
    // منتجات نصف مصنّعة سابقة لهذا الفرع (لاختيار سريع)
    sb.from('prep_products').select('*, units(symbol)').eq('branch_id', branchId).eq('is_active', true).order('name')
      .then(({ data }) => setExistingPrepProducts(data || []))
  }, [])

  function addConsumedRow() {
    setConsumed(prev => [...prev, { product_id: '', qty: '', unit_id: '' }])
  }
  function removeConsumedRow(i: number) {
    setConsumed(prev => prev.filter((_, idx) => idx !== i))
  }
  function updateConsumedRow(i: number, patch: Partial<{ product_id: string; qty: string; unit_id: string }>) {
    setConsumed(prev => prev.map((row, idx) => {
      if (idx !== i) return row
      const updated = { ...row, ...patch }
      if (patch.product_id) {
        const prod = rawProducts.find(p => p.id === patch.product_id)
        if (prod?.unit_id) updated.unit_id = prod.unit_id
      }
      return updated
    }))
  }

  function selectExistingProduct(pid: string) {
    const p = existingPrepProducts.find(pp => pp.id === pid)
    if (p) {
      setForm(prev => ({ ...prev, prep_product_id: p.id, prep_product_name: p.name, unit_id: p.unit_id || '', department: p.department }))
    }
  }

  async function save() {
    if (!form.prep_product_name.trim()) { alert('يرجى إدخال اسم المنتج النصف مصنّع'); return }
    if (!form.quantity_produced || parseFloat(form.quantity_produced) <= 0) { alert('يرجى إدخال الكمية الناتجة'); return }
    if (!form.expiry_date) { alert('يرجى إدخال تاريخ انتهاء الصلاحية'); return }
    if (!form.produced_by.trim()) { alert('يرجى إدخال اسم المسؤول عن التصنيع'); return }
    const validConsumed = consumed.filter(c => c.product_id && c.qty && parseFloat(c.qty) > 0)
    if (validConsumed.length === 0) { alert('يرجى إضافة المكونات الخام المستخدمة على الأقل'); return }

    // تأكد من توفر المخزون الكافي قبل أي عملية
    for (const c of validConsumed) {
      const prod = rawProducts.find(p => p.id === c.product_id)
      if (prod && (prod.current_stock || 0) < parseFloat(c.qty)) {
        if (!confirm(`تنبيه: المخزون المتاح من "${prod.name}" هو ${prod.current_stock} فقط، أقل من الكمية المطلوبة (${c.qty}). هل تريد الاستمرار؟`)) return
      }
    }

    setSaving(true)

    // 1) تحديد/إنشاء prep_product
    let prepProductId = form.prep_product_id
    if (!prepProductId) {
      const { data: newPP, error: ppErr } = await sb.from('prep_products').insert([{
        branch_id: branchId, department: form.department, name: form.prep_product_name.trim(), unit_id: form.unit_id || null,
      }]).select().single()
      if (ppErr) { alert('خطأ في إنشاء المنتج: ' + ppErr.message); setSaving(false); return }
      prepProductId = newPP.id
    }

    // 2) إنشاء دفعة التصنيع
    const { data: batch, error: batchErr } = await sb.from('prep_production_batches').insert([{
      branch_id: branchId, prep_product_id: prepProductId, department: form.department,
      quantity_produced: parseFloat(form.quantity_produced),
      quantity_remaining: parseFloat(form.quantity_produced),
      expiry_date: form.expiry_date, produced_by: form.produced_by, notes: form.notes || null, status: 'active',
    }]).select().single()
    if (batchErr) { alert('خطأ في إنشاء الدفعة: ' + batchErr.message); setSaving(false); return }

    // 3) خصم المكونات الخام من مستودع الفرع + تسجيل المستهلك + حركة مخزون
    const { data: wh } = await sb.from('warehouses').select('id').eq('branch_id', branchId).maybeSingle()
    for (const c of validConsumed) {
      const prod = rawProducts.find(p => p.id === c.product_id)
      const qty = parseFloat(c.qty)
      if (prod) {
        const newStock = Math.max(0, (prod.current_stock || 0) - qty)
        await sb.from('warehouse_products').update({ current_stock: newStock }).eq('id', prod.id)
        if (wh?.id) {
          await sb.from('stock_movements').insert([{
            product_id: prod.id, warehouse_id: wh.id, movement_type: 'out', quantity: qty,
            movement_date: new Date().toISOString().slice(0, 10),
            notes: `تصنيع تجهيزات: ${form.prep_product_name} (دفعة #${batch.batch_number})`,
          }])
        }
      }
      await sb.from('prep_batch_consumed_items').insert([{
        batch_id: batch.id, product_id: c.product_id, quantity_used: qty, unit_id: c.unit_id || null,
      }])
    }

    setSaving(false)
    onSaved()
  }

  const filteredRaw = rawProducts.filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 300, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 20, overflowY: 'auto' }}>
      <div style={{ background: S.navy2, borderRadius: 20, border: `1px solid ${S.border}`, width: '100%', maxWidth: 700, padding: 28, margin: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <h2 style={{ color: S.white, fontSize: 17, fontWeight: 800 }}>🏭 تصنيع دفعة تجهيز جديدة</h2>
            <p style={{ fontSize: 12, color: S.muted }}>المكونات الخام تُخصم فورًا من مستودع الفرع</p>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: S.muted, fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>

        {/* القسم */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
          {DEPARTMENTS.map(d => (
            <button key={d.key} onClick={() => setForm(p => ({ ...p, department: d.key }))}
              style={{ padding: '8px 16px', borderRadius: 10, border: `1px solid ${form.department === d.key ? S.gold : S.border}`, background: form.department === d.key ? S.gold3 : 'transparent', color: form.department === d.key ? S.gold : S.muted, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', fontWeight: form.department === d.key ? 700 : 400 }}>
              {d.icon} {d.label}
            </button>
          ))}
        </div>

        {/* اسم المنتج النصف مصنّع */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 4 }}>اسم المنتج النصف مصنّع *</label>
          <input style={inp} value={form.prep_product_name} onChange={e => setForm(p => ({ ...p, prep_product_id: '', prep_product_name: e.target.value }))} placeholder="مثال: كبة جاهزة" />
          {existingPrepProducts.filter(pp => pp.department === form.department).length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
              <span style={{ fontSize: 11, color: S.muted, alignSelf: 'center' }}>منتجات سابقة:</span>
              {existingPrepProducts.filter(pp => pp.department === form.department).map(pp => (
                <button key={pp.id} onClick={() => selectExistingProduct(pp.id)}
                  style={{ padding: '4px 10px', borderRadius: 8, border: `1px solid ${form.prep_product_id === pp.id ? S.gold : S.border}`, background: form.prep_product_id === pp.id ? S.gold3 : 'transparent', color: form.prep_product_id === pp.id ? S.gold : S.muted, cursor: 'pointer', fontSize: 11, fontFamily: 'Tajawal, sans-serif' }}>
                  {pp.name}
                </button>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
          <div>
            <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 4 }}>الكمية الناتجة *</label>
            <input type="number" style={{ ...inp, direction: 'ltr' }} value={form.quantity_produced} onChange={e => setForm(p => ({ ...p, quantity_produced: e.target.value }))} placeholder="0" />
          </div>
          <div>
            <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 4 }}>الوحدة</label>
            <select style={{ ...inp, cursor: 'pointer', background: S.navy3 }} value={form.unit_id} onChange={e => setForm(p => ({ ...p, unit_id: e.target.value }))}>
              <option value="">-- اختر --</option>
              {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 4 }}>تاريخ انتهاء الصلاحية *</label>
            <input type="date" style={{ ...inp, direction: 'ltr' }} value={form.expiry_date} onChange={e => setForm(p => ({ ...p, expiry_date: e.target.value }))} />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
          <div>
            <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 4 }}>المسؤول عن التصنيع *</label>
            <input style={inp} value={form.produced_by} onChange={e => setForm(p => ({ ...p, produced_by: e.target.value }))} />
          </div>
          <div>
            <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 4 }}>ملاحظات</label>
            <input style={inp} value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="اختياري..." />
          </div>
        </div>

        {/* المكونات الخام المستخدمة */}
        <div style={{ background: S.navy3, borderRadius: 12, padding: 14, marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: S.gold }}>📦 المكونات الخام المستخدمة (تُخصم من مستودع الفرع)</div>
            <button onClick={addConsumedRow} style={{ padding: '5px 12px', borderRadius: 8, border: `1px solid ${S.blue}`, background: S.blueB, color: S.blue, cursor: 'pointer', fontSize: 11, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>+ إضافة</button>
          </div>
          <input style={{ ...inp, marginBottom: 10, fontSize: 12 }} value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 بحث سريع لتسهيل الاختيار..." />
          {consumed.map((row, i) => {
            const prod = rawProducts.find(p => p.id === row.product_id)
            return (
              <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                <select style={{ ...inp, cursor: 'pointer', background: S.navy2, flex: 2 }} value={row.product_id} onChange={e => updateConsumedRow(i, { product_id: e.target.value })}>
                  <option value="">-- اختر الصنف الخام --</option>
                  {filteredRaw.map(p => <option key={p.id} value={p.id}>{p.name} (متاح: {p.current_stock ?? 0} {p.units?.symbol})</option>)}
                </select>
                <input type="number" style={{ ...inp, direction: 'ltr', flex: 1 }} value={row.qty} onChange={e => updateConsumedRow(i, { qty: e.target.value })} placeholder="الكمية" />
                <button onClick={() => removeConsumedRow(i)} style={{ padding: '8px 10px', borderRadius: 8, border: `1px solid ${S.red}`, background: S.redB, color: S.red, cursor: 'pointer', fontSize: 12 }}>🗑️</button>
              </div>
            )
          })}
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '10px 20px', borderRadius: 10, border: `1px solid ${S.muted}`, background: 'transparent', color: S.muted, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif' }}>إلغاء</button>
          <button onClick={save} disabled={saving} style={{ padding: '10px 24px', borderRadius: 10, border: `1px solid ${S.green}`, background: S.greenB, color: S.green, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
            {saving ? '⏳...' : '✅ تسجيل الدفعة وخصم المكونات'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ══ الصفحة الرئيسية ══
export default function PrepWarehousePage() {
  const sb = createClient()
  const { employee, permissions } = useAuth()
  const { isAr } = useLang()

  const [batches, setBatches] = useState<PrepBatch[]>([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [useBatch, setUseBatch] = useState<PrepBatch | null>(null)
  const [activeDept, setActiveDept] = useState('المطبخ')
  const [statusFilter, setStatusFilter] = useState<'active' | 'depleted' | 'all'>('active')
  const [search, setSearch] = useState('')

  const role = employee?.role || ''
  const branchId = employee?.branch_id || ''
  const canUse = permissions?.all === true || ['admin', 'branch_manager', 'kitchen_manager', 'hall_manager', 'bar_manager', 'kitchen_supervisor', 'hall_supervisor', 'bar_supervisor'].includes(role)

  const fetchAll = useCallback(async () => {
    if (!branchId) return
    setLoading(true)
    const { data } = await sb.from('prep_production_batches')
      .select('*, prep_products(id,name,name_en,department,unit_id,units(symbol))')
      .eq('branch_id', branchId)
      .order('expiry_date', { ascending: true })
    setBatches(data || [])
    setLoading(false)
  }, [branchId])

  useEffect(() => { fetchAll() }, [fetchAll])

  if (!canUse) return (
    <div style={{ fontFamily: 'Tajawal, sans-serif', direction: 'rtl', color: S.white, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', flexDirection: 'column', gap: 16 }}>
      <div style={{ fontSize: 64 }}>🔒</div>
      <div style={{ fontSize: 20, fontWeight: 800, color: S.red }}>غير مصرح بالوصول</div>
    </div>
  )

  const deptBatches = batches.filter(b => b.department === activeDept)
  const filtered = deptBatches.filter(b => {
    const statusMatch = statusFilter === 'all' ? true : statusFilter === 'active' ? b.status === 'active' : b.status === 'depleted'
    const searchMatch = !search || b.prep_products?.name?.toLowerCase().includes(search.toLowerCase())
    return statusMatch && searchMatch
  })

  const expiringSoonCount = deptBatches.filter(b => b.status === 'active' && daysUntil(b.expiry_date) <= 2).length
  const activeCount = deptBatches.filter(b => b.status === 'active').length
  const totalProductsCount = new Set(deptBatches.map(b => b.prep_product_id)).size

  return (
    <div style={{ fontFamily: 'Tajawal, sans-serif', direction: 'rtl', color: S.white }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700;800&display=swap'); select option{background:#0F2040}`}</style>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: S.white, marginBottom: 4 }}>🏭 مستودع التجهيزات</h1>
          <p style={{ fontSize: 13, color: S.muted }}>تصنيع المنتجات النصف مصنّعة وتتبع دفعاتها وصلاحيتها</p>
        </div>
        <button onClick={() => setShowNew(true)} style={{ padding: '10px 20px', borderRadius: 12, border: `1px solid ${S.gold}`, background: S.gold3, color: S.gold, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
          ➕ تصنيع دفعة جديدة
        </button>
      </div>

      {/* تابات الأقسام */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {DEPARTMENTS.map(d => (
          <button key={d.key} onClick={() => setActiveDept(d.key)}
            style={{ padding: '9px 18px', borderRadius: 10, border: `1px solid ${activeDept === d.key ? S.gold : S.border}`, background: activeDept === d.key ? S.gold3 : 'transparent', color: activeDept === d.key ? S.gold : S.muted, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: activeDept === d.key ? 700 : 400 }}>
            {d.icon} {d.label}
          </button>
        ))}
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 10, marginBottom: 20 }}>
        {[
          { label: 'منتجات نشطة', count: totalProductsCount, color: S.blue, bg: S.blueB, icon: '📦' },
          { label: 'دفعات نشطة', count: activeCount, color: S.green, bg: S.greenB, icon: '✅' },
          { label: 'قاربت على الانتهاء', count: expiringSoonCount, color: S.amber, bg: S.amberB, icon: '⚠️' },
        ].map((s, i) => (
          <div key={i} style={{ background: s.bg, borderRadius: 12, padding: '12px 14px', border: `1px solid ${s.color}30` }}>
            <div style={{ fontSize: 18, marginBottom: 4 }}>{s.icon}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: s.color }}>{s.count}</div>
            <div style={{ fontSize: 11, color: S.muted }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* فلاتر */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <input style={{ ...inp, maxWidth: 300 }} value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 بحث باسم المنتج..." />
        <div style={{ display: 'flex', gap: 6 }}>
          {[
            { key: 'active', label: 'نشطة' },
            { key: 'depleted', label: 'منتهية الكمية' },
            { key: 'all', label: 'الكل' },
          ].map(f => (
            <button key={f.key} onClick={() => setStatusFilter(f.key as any)}
              style={{ padding: '6px 14px', borderRadius: 20, border: `1px solid ${statusFilter === f.key ? S.gold : S.border}`, background: statusFilter === f.key ? S.gold3 : 'transparent', color: statusFilter === f.key ? S.gold : S.muted, cursor: 'pointer', fontSize: 11, fontFamily: 'Tajawal, sans-serif', fontWeight: statusFilter === f.key ? 700 : 400 }}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* قائمة الدفعات */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: S.muted }}>⏳ جاري التحميل...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, background: S.navy2, borderRadius: 16, border: `1px solid ${S.border}` }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🏭</div>
          <div style={{ fontSize: 14, color: S.muted }}>لا توجد دفعات في هذا القسم</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 12 }}>
          {filtered.map(b => {
            const exp = expiryStatus(b.expiry_date)
            const pct = b.quantity_produced > 0 ? Math.round((b.quantity_remaining / b.quantity_produced) * 100) : 0
            return (
              <div key={b.id} style={{ background: S.navy2, borderRadius: 14, border: `1px solid ${S.border}`, padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: S.white }}>{b.prep_products?.name}</div>
                    <div style={{ fontSize: 11, color: S.muted }}>دفعة #{b.batch_number} · {b.produced_by}</div>
                  </div>
                  <span style={{ background: exp.bg, color: exp.color, borderRadius: 20, padding: '3px 10px', fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap' }}>{exp.icon} {exp.label}</span>
                </div>

                <div style={{ background: S.card, borderRadius: 10, padding: '10px 12px', marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 11, color: S.muted }}>المتبقي</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: S.gold }}>{b.quantity_remaining} / {b.quantity_produced} {b.prep_products?.units?.symbol}</span>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 6, height: 6, overflow: 'hidden' }}>
                    <div style={{ background: pct > 30 ? S.green : pct > 0 ? S.amber : S.red, height: '100%', width: `${pct}%`, transition: 'width .2s' }} />
                  </div>
                </div>

                <div style={{ fontSize: 11, color: S.muted, marginBottom: 12 }}>
                  📅 إنتاج: {new Date(b.production_date).toLocaleDateString('ar-SA')} · انتهاء: {new Date(b.expiry_date).toLocaleDateString('ar-SA')}
                </div>

                {b.notes && <div style={{ fontSize: 11, color: S.amber, marginBottom: 10 }}>📝 {b.notes}</div>}

                {b.status === 'active' && b.quantity_remaining > 0 && (
                  <button onClick={() => setUseBatch(b)} style={{ width: '100%', padding: '9px', borderRadius: 10, border: `1px solid ${S.blue}`, background: S.blueB, color: S.blue, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
                    📤 تسجيل صرف/استخدام
                  </button>
                )}
                {b.status === 'depleted' && (
                  <div style={{ textAlign: 'center', padding: '8px', borderRadius: 10, background: S.card, color: S.muted, fontSize: 12 }}>انتهت الكمية</div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {showNew && <NewBatchModal onClose={() => setShowNew(false)} onSaved={() => { setShowNew(false); fetchAll() }} currentEmployee={employee} branchId={branchId} />}
      {useBatch && <UseBatchModal batch={useBatch} currentEmployee={employee} onClose={() => setUseBatch(null)} onUpdated={() => { setUseBatch(null); fetchAll() }} />}
    </div>
  )
}
