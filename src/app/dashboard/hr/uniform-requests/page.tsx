'use client'

import { useEffect, useState, useCallback } from 'react'
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
  card: 'rgba(255,255,255,0.04)', card2: 'rgba(255,255,255,0.08)',
}

const ITEM_TYPES = [
  { key: 'jacket', label: 'Jackets', label_ar: 'جاكيت', icon: '👨🏻‍🍳' },
  { key: 'tshirt', label: 'T-shirts', label_ar: 'تيشيرت', icon: '👕' },
  { key: 'cap',    label: 'Cap',      label_ar: 'كاب',     icon: '🧢' },
  { key: 'apron',  label: 'Apron',    label_ar: 'مريول',   icon: '🎽' },
]
const SIZES = ['S', 'M', 'L', 'XL', 'XXL']

const STATUS_CFG: Record<string, { label: string; icon: string; color: string; bg: string }> = {
  pending:   { label: 'قيد الانتظار', icon: '⏳', color: S.amber, bg: S.amberB },
  delivered: { label: 'تم التسليم',   icon: '✅', color: S.green, bg: S.greenB },
  rejected:  { label: 'مرفوض',        icon: '❌', color: S.red,   bg: S.redB },
}

interface RequestItem { id: string; item_type: string; size: string; quantity: number }
interface UniformRequest {
  id: string; employee_id: string; status: string
  requested_at: string; delivered_at: string | null; delivered_by: string | null; notes: string | null
  employees?: { name: string; name_en?: string; employee_number?: string; department?: string }
  uniform_request_items?: RequestItem[]
}
// ✅ جديد: سجل إدخال كمية مخزون يونيفورم — من أدخلها، ولأي فرع
interface StockEntry {
  id: string; item_type: string; size: string; quantity: number; branch_id: string; created_at: string
  branches?: { name: string }
  added_by_employee?: { name: string; name_en?: string }
}

export default function UniformRequestsPage() {
  const sb = createClient()
  const { employee: currentUser, permissions } = useAuth()
  const isAdmin = permissions?.all === true
  // ✅ مدير الفرع يقدر يشوف ويعتمد طلبات يونيفورم موظفي فرعه بس (بنفس صلاحيات الأدمن، لكن محدودة بفرعه)
  const isBranchManager = currentUser?.role === 'branch_manager'
  const canManage = isAdmin || isBranchManager

  const [selections, setSelections] = useState<Record<string, { size: string; quantity: number }>>({})
  const [submitting, setSubmitting] = useState(false)
  const [myRequests, setMyRequests] = useState<UniformRequest[]>([])
  const [allRequests, setAllRequests] = useState<UniformRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'new' | 'mine' | 'admin' | 'stock'>('new')
  // ✅ ترقيم صفحات تاب "كل الطلبات" — 20 طلب في الصفحة الواحدة
  const [adminPage, setAdminPage] = useState(1)
  const REQUESTS_PER_PAGE = 20

  // ✅ جديد: حالة تاب "المخزون" — إدخال كميات جديدة وعرض سجل من أدخل كل كمية ولأي فرع
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([])
  const [stockEntries, setStockEntries] = useState<StockEntry[]>([])
  const [loadingStock, setLoadingStock] = useState(false)
  const [stockForm, setStockForm] = useState<{ item_type: string; size: string; quantity: number; branch_id: string }>({
    item_type: 'jacket', size: 'M', quantity: 1, branch_id: '',
  })
  const [savingStock, setSavingStock] = useState(false)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const baseSelect = `*, employees:employee_id(name, name_en, employee_number, department, branch_id), uniform_request_items(*)`
    let allQuery = null as any
    if (isAdmin) {
      // ✅ الأدمن يشوف كل الطلبات من كل الفروع
      allQuery = sb.from('uniform_requests').select(baseSelect).order('requested_at', { ascending: false })
    } else if (isBranchManager && currentUser?.branch_id) {
      // ✅ مدير الفرع: نجيب أولاً موظفي فرعه، ثم نحصر الطلبات عليهم فقط — نفس نمط تحديد النطاق
      // المستخدم في صفحة طلبات الموظفين الأخرى (سلفة الراتب)
      const { data: branchEmps } = await sb.from('employees').select('id').eq('branch_id', currentUser.branch_id)
      const ids = (branchEmps || []).map(e => e.id)
      allQuery = ids.length > 0
        ? sb.from('uniform_requests').select(baseSelect).in('employee_id', ids).order('requested_at', { ascending: false })
        : Promise.resolve({ data: [] })
    } else {
      allQuery = Promise.resolve({ data: [] })
    }
    const [mine, all] = await Promise.all([
      sb.from('uniform_requests').select(baseSelect).eq('employee_id', currentUser?.id || '').order('requested_at', { ascending: false }),
      allQuery,
    ])
    setMyRequests((mine.data as any) || [])
    setAllRequests((all.data as any) || [])
    setLoading(false)
  }, [currentUser?.id, currentUser?.branch_id, isAdmin, isBranchManager])

  useEffect(() => { if (currentUser?.id) fetchAll() }, [currentUser?.id, fetchAll])

  // ✅ جلب الفروع (للأدمن يختار أي فرع، ولمدير الفرع نعرض اسم فرعه فقط) — مرة واحدة عند تحميل الصفحة
  useEffect(() => {
    sb.from('branches').select('id, name').order('name').then(({ data }) => {
      setBranches(data || [])
      // ✅ نضبط فرع مدير الفرع تلقائياً كقيمة افتراضية ثابتة في الفورم (لا يمكنه تغييره)
      if (isBranchManager && currentUser?.branch_id) {
        setStockForm(prev => ({ ...prev, branch_id: currentUser.branch_id || '' }))
      }
    })
  }, [isBranchManager, currentUser?.branch_id])

  const fetchStock = useCallback(async () => {
    if (!canManage) return
    setLoadingStock(true)
    let q = sb.from('uniform_stock_entries')
      .select('*, branches(name), added_by_employee:added_by(name, name_en)')
      .order('created_at', { ascending: false })
    // ✅ مدير الفرع يشوف سجل فرعه بس، الأدمن يشوف كل الفروع
    if (!isAdmin && isBranchManager && currentUser?.branch_id) {
      q = q.eq('branch_id', currentUser.branch_id)
    }
    const { data } = await q
    setStockEntries((data as any) || [])
    setLoadingStock(false)
  }, [canManage, isAdmin, isBranchManager, currentUser?.branch_id])

  useEffect(() => { if (tab === 'stock') fetchStock() }, [tab, fetchStock])

  async function addStockEntry() {
    if (!stockForm.branch_id) { alert('يرجى اختيار الفرع'); return }
    if (stockForm.quantity <= 0) { alert('يرجى إدخال كمية أكبر من صفر'); return }
    setSavingStock(true)
    // ✅ نسجّل من أضاف الكمية (added_by) تلقائياً من هوية المستخدم الحالي — بلا أي إدخال يدوي منه
    const { error } = await sb.from('uniform_stock_entries').insert([{
      item_type: stockForm.item_type,
      size: stockForm.size,
      quantity: stockForm.quantity,
      branch_id: stockForm.branch_id,
      added_by: currentUser?.id || null,
    }])
    setSavingStock(false)
    if (error) { alert('حدث خطأ: ' + error.message); return }
    setStockForm(prev => ({ ...prev, quantity: 1 }))
    await fetchStock()
  }

  // ✅ إجمالي الكمية المتاحة حالياً لكل صنف/مقاس/فرع — مجموع كل الإدخالات لنفس التركيبة
  const stockTotals = stockEntries.reduce((acc, e) => {
    const key = `${e.item_type}|${e.size}|${e.branch_id}`
    if (!acc[key]) acc[key] = { item_type: e.item_type, size: e.size, branch_id: e.branch_id, branchName: e.branches?.name || '', total: 0 }
    acc[key].total += e.quantity
    return acc
  }, {} as Record<string, { item_type: string; size: string; branch_id: string; branchName: string; total: number }>)

  function toggleItem(key: string) {
    setSelections(prev => {
      const next = { ...prev }
      if (next[key]) delete next[key]
      else next[key] = { size: 'M', quantity: 1 }
      return next
    })
  }
  function updateSelection(key: string, field: 'size' | 'quantity', value: any) {
    setSelections(prev => ({ ...prev, [key]: { ...prev[key], [field]: value } }))
  }

  async function submitRequest() {
    const items = Object.entries(selections)
    if (items.length === 0) { alert('يرجى اختيار صنف واحد على الأقل'); return }
    setSubmitting(true)
    const { data: newReq, error } = await sb.from('uniform_requests')
      .insert([{ employee_id: currentUser?.id, status: 'pending' }])
      .select('id').single()
    if (error || !newReq) { alert('حدث خطأ: ' + (error?.message || '')); setSubmitting(false); return }

    await sb.from('uniform_request_items').insert(
      items.map(([item_type, sel]) => ({ request_id: newReq.id, item_type, size: sel.size, quantity: sel.quantity }))
    )
    await fetchAll()
    setSubmitting(false)
    setSelections({})
    setTab('mine')
  }

  async function markDelivered(requestId: string) {
    await sb.from('uniform_requests').update({
      status: 'delivered',
      delivered_at: new Date().toISOString(),
      delivered_by: currentUser?.id,
    }).eq('id', requestId)
    await fetchAll()
  }

  async function markRejected(requestId: string) {
    if (!confirm('تأكيد رفض الطلب؟')) return
    await sb.from('uniform_requests').update({ status: 'rejected' }).eq('id', requestId)
    await fetchAll()
  }

  // ✅ حذف نهائي للطلب — أدمن فقط. نحذف أصناف الطلب المرتبطة أولاً (uniform_request_items) قبل حذف الطلب نفسه
  async function deleteRequest(requestId: string) {
    if (!confirm('⚠️ هل أنت متأكد من حذف هذا الطلب نهائياً؟ لا يمكن التراجع عن هذا الإجراء.')) return
    await sb.from('uniform_request_items').delete().eq('request_id', requestId)
    const { error } = await sb.from('uniform_requests').delete().eq('id', requestId)
    if (error) { alert('حدث خطأ أثناء الحذف: ' + error.message); return }
    await fetchAll()
  }

  function itemLabel(type: string) {
    const t = ITEM_TYPES.find(i => i.key === type)
    return t ? `${t.icon} ${t.label_ar}` : type
  }

  const pendingCount = allRequests.filter(r => r.status === 'pending').length

  return (
    <div style={{ fontFamily: 'Tajawal, sans-serif', direction: 'rtl', color: S.white, maxWidth: 820, margin: '0 auto' }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&display=swap');`}</style>

      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: S.white, marginBottom: 4 }}>👔 طلب يونيفورم</h1>
        <p style={{ fontSize: 13, color: S.muted }}>طلب الزي الموحّد — جاكيت، تيشيرت، كاب، مريول</p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        <button onClick={() => setTab('new')}
          style={{ padding: '9px 16px', borderRadius: 12, border: `1px solid ${tab === 'new' ? S.gold : S.border}`, background: tab === 'new' ? S.gold3 : 'transparent', color: tab === 'new' ? S.gold : S.muted, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: tab === 'new' ? 700 : 400 }}>
          ➕ طلب جديد
        </button>
        <button onClick={() => setTab('mine')}
          style={{ padding: '9px 16px', borderRadius: 12, border: `1px solid ${tab === 'mine' ? S.gold : S.border}`, background: tab === 'mine' ? S.gold3 : 'transparent', color: tab === 'mine' ? S.gold : S.muted, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: tab === 'mine' ? 700 : 400 }}>
          📋 طلباتي ({myRequests.length})
        </button>
        {canManage && (
          <button onClick={() => setTab('admin')}
            style={{ padding: '9px 16px', borderRadius: 12, border: `1px solid ${tab === 'admin' ? S.gold : S.border}`, background: tab === 'admin' ? S.gold3 : 'transparent', color: tab === 'admin' ? S.gold : S.muted, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: tab === 'admin' ? 700 : 400, position: 'relative' }}>
            🔐 كل الطلبات ({allRequests.length})
            {pendingCount > 0 && (
              <span style={{ position: 'absolute', top: -6, right: -6, background: S.red, color: '#fff', borderRadius: '50%', width: 18, height: 18, fontSize: 10, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{pendingCount}</span>
            )}
          </button>
        )}
        {/* ✅ جديد: تاب المخزون — أدمن ومدير الفرع فقط */}
        {canManage && (
          <button onClick={() => setTab('stock')}
            style={{ padding: '9px 16px', borderRadius: 12, border: `1px solid ${tab === 'stock' ? S.gold : S.border}`, background: tab === 'stock' ? S.gold3 : 'transparent', color: tab === 'stock' ? S.gold : S.muted, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: tab === 'stock' ? 700 : 400 }}>
            📦 إدارة المخزون
          </button>
        )}
      </div>

      {/* ── New Request Tab ── */}
      {tab === 'new' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 14, marginBottom: 20 }}>
            {ITEM_TYPES.map(item => {
              const selected = !!selections[item.key]
              return (
                <div key={item.key} onClick={() => toggleItem(item.key)}
                  style={{ background: selected ? S.gold3 : S.card, border: `2px solid ${selected ? S.gold : S.border}`, borderRadius: 16, padding: '20px 14px', textAlign: 'center', cursor: 'pointer', transition: 'all .2s', position: 'relative' }}>
                  {selected && <div style={{ position: 'absolute', top: 8, right: 8, color: S.gold, fontSize: 16 }}>✓</div>}
                  <div style={{ fontSize: 36, marginBottom: 8 }}>{item.icon}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: selected ? S.gold : S.white }}>{item.label}</div>
                  <div style={{ fontSize: 11, color: S.muted, marginTop: 2 }}>{item.label_ar}</div>
                </div>
              )
            })}
          </div>

          {Object.keys(selections).length > 0 && (
            <div style={{ background: S.navy2, borderRadius: 16, border: `1px solid ${S.border}`, padding: 20, marginBottom: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: S.white, marginBottom: 16 }}>تفاصيل الأصناف المختارة</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {Object.entries(selections).map(([key, sel]) => (
                  <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', background: S.card, borderRadius: 12, padding: '12px 14px' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: S.white, minWidth: 90 }}>{itemLabel(key)}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <label style={{ fontSize: 11, color: S.muted }}>المقاس</label>
                      <select value={sel.size} onChange={e => updateSelection(key, 'size', e.target.value)}
                        style={{ background: S.navy3, border: `1px solid ${S.border}`, borderRadius: 8, padding: '6px 10px', fontSize: 12, color: S.white, outline: 'none', fontFamily: 'Tajawal, sans-serif', cursor: 'pointer' }}>
                        {SIZES.map(s => <option key={s} value={s} style={{ background: S.navy2 }}>{s}</option>)}
                      </select>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <label style={{ fontSize: 11, color: S.muted }}>الكمية</label>
                      <input type="number" min={1} value={sel.quantity} onChange={e => updateSelection(key, 'quantity', Math.max(1, parseInt(e.target.value) || 1))}
                        style={{ width: 60, background: S.navy3, border: `1px solid ${S.border}`, borderRadius: 8, padding: '6px 10px', fontSize: 12, color: S.white, outline: 'none', fontFamily: 'Tajawal, sans-serif', textAlign: 'center' }} />
                    </div>
                    <button onClick={() => toggleItem(key)} style={{ marginRight: 'auto', background: 'transparent', border: 'none', color: S.red, cursor: 'pointer', fontSize: 16 }}>✕</button>
                  </div>
                ))}
              </div>
              <button onClick={submitRequest} disabled={submitting}
                style={{ width: '100%', marginTop: 18, padding: '12px', borderRadius: 12, border: `1px solid ${S.gold}`, background: S.gold3, color: S.gold, cursor: submitting ? 'not-allowed' : 'pointer', fontSize: 14, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
                {submitting ? '⏳ جاري الإرسال...' : '✅ إرسال الطلب'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── My Requests Tab ── */}
      {tab === 'mine' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: S.muted }}>⏳ جاري التحميل...</div>
          ) : myRequests.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, background: S.navy2, borderRadius: 16, border: `1px solid ${S.border}`, color: S.muted }}>
              لا توجد طلبات سابقة
            </div>
          ) : myRequests.map(req => {
            const st = STATUS_CFG[req.status] || STATUS_CFG.pending
            return (
              <div key={req.id} style={{ background: S.navy2, borderRadius: 14, border: `1px solid ${S.border}`, padding: '16px 18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
                  <div style={{ fontSize: 12, color: S.muted }}>📅 تاريخ الطلب: {new Date(req.requested_at).toLocaleDateString('ar-SA')}</div>
                  <span style={{ background: st.bg, color: st.color, borderRadius: 20, padding: '3px 12px', fontSize: 11, fontWeight: 700 }}>{st.icon} {st.label}</span>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: req.delivered_at ? 10 : 0 }}>
                  {(req.uniform_request_items || []).map(it => (
                    <span key={it.id} style={{ background: S.card, borderRadius: 10, padding: '5px 10px', fontSize: 12, color: S.white }}>
                      {itemLabel(it.item_type)} · {it.size} · ×{it.quantity}
                    </span>
                  ))}
                </div>
                {req.delivered_at && (
                  <div style={{ fontSize: 12, color: S.green }}>✅ تاريخ الاستلام: {new Date(req.delivered_at).toLocaleDateString('ar-SA')}</div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── Admin Tab ── */}
      {tab === 'admin' && canManage && (() => {
        // ✅ ترقيم الصفحات: 20 طلب في كل صفحة — نحسب هنا بدل تكرار نفس المنطق أكتر من مرة
        const totalPages = Math.max(1, Math.ceil(allRequests.length / REQUESTS_PER_PAGE))
        const safePage = Math.min(adminPage, totalPages)
        const pageRequests = allRequests.slice((safePage - 1) * REQUESTS_PER_PAGE, safePage * REQUESTS_PER_PAGE)
        return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: S.muted }}>⏳ جاري التحميل...</div>
          ) : allRequests.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, background: S.navy2, borderRadius: 16, border: `1px solid ${S.border}`, color: S.muted }}>
              لا توجد طلبات
            </div>
          ) : pageRequests.map(req => {
            const st = STATUS_CFG[req.status] || STATUS_CFG.pending
            return (
              <div key={req.id} style={{ background: S.navy2, borderRadius: 14, border: `1px solid ${req.status === 'pending' ? S.amber + '40' : S.border}`, padding: '16px 18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: S.white }}>
                      {req.employees?.name} {req.employees?.name_en} <span style={{ color: S.muted, fontWeight: 400, fontSize: 12 }}>({req.employees?.employee_number})</span>
                    </div>
                    <div style={{ fontSize: 11, color: S.muted, marginTop: 2 }}>{req.employees?.department} · 📅 {new Date(req.requested_at).toLocaleDateString('ar-SA')}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ background: st.bg, color: st.color, borderRadius: 20, padding: '3px 12px', fontSize: 11, fontWeight: 700 }}>{st.icon} {st.label}</span>
                    {/* ✅ زرار حذف الطلب نهائياً — أدمن فقط (مش مدير الفرع)، بجانب حالة الطلب مباشرة */}
                    {isAdmin && (
                      <button onClick={() => deleteRequest(req.id)}
                        title="حذف الطلب نهائياً"
                        style={{ background: 'transparent', border: `1px solid ${S.red}50`, borderRadius: '50%', width: 26, height: 26, color: S.red, cursor: 'pointer', fontSize: 13, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        ✕
                      </button>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                  {(req.uniform_request_items || []).map(it => (
                    <span key={it.id} style={{ background: S.card, borderRadius: 10, padding: '5px 10px', fontSize: 12, color: S.white }}>
                      {itemLabel(it.item_type)} · {it.size} · ×{it.quantity}
                    </span>
                  ))}
                </div>
                {req.status === 'pending' ? (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => markDelivered(req.id)}
                      style={{ flex: 1, padding: '9px', borderRadius: 10, border: `1px solid ${S.green}`, background: S.greenB, color: S.green, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
                      ✅ تم التسليم
                    </button>
                    <button onClick={() => markRejected(req.id)}
                      style={{ flex: 1, padding: '9px', borderRadius: 10, border: `1px solid ${S.red}`, background: S.redB, color: S.red, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
                      ❌ رفض
                    </button>
                  </div>
                ) : req.delivered_at && (
                  <div style={{ fontSize: 12, color: S.green }}>✅ تاريخ الاستلام: {new Date(req.delivered_at).toLocaleDateString('ar-SA')}</div>
                )}
              </div>
            )
          })}
          {/* ✅ أزرار التنقل بين الصفحات — تظهر فقط لو فيه أكتر من صفحة واحدة */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 14, marginTop: 8 }}>
              <button onClick={() => setAdminPage(p => Math.max(1, p - 1))} disabled={safePage === 1}
                style={{ padding: '8px 16px', borderRadius: 10, border: `1px solid ${S.border}`, background: safePage === 1 ? 'transparent' : S.card, color: safePage === 1 ? S.muted : S.white, cursor: safePage === 1 ? 'not-allowed' : 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', opacity: safePage === 1 ? 0.5 : 1 }}>
                ← السابق
              </button>
              <span style={{ fontSize: 13, color: S.muted }}>صفحة {safePage} من {totalPages} ({allRequests.length} طلب)</span>
              <button onClick={() => setAdminPage(p => Math.min(totalPages, p + 1))} disabled={safePage === totalPages}
                style={{ padding: '8px 16px', borderRadius: 10, border: `1px solid ${S.border}`, background: safePage === totalPages ? 'transparent' : S.card, color: safePage === totalPages ? S.muted : S.white, cursor: safePage === totalPages ? 'not-allowed' : 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', opacity: safePage === totalPages ? 0.5 : 1 }}>
                التالي →
              </button>
            </div>
          )}
        </div>
        )
      })()}

      {/* ── Stock Management Tab ── */}
      {tab === 'stock' && canManage && (
        <div>
          {/* فورم إضافة كمية جديدة */}
          <div style={{ background: S.navy2, borderRadius: 16, border: `1px solid ${S.border}`, padding: 20, marginBottom: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: S.white, marginBottom: 16 }}>➕ إضافة كمية للمخزون</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 12, marginBottom: 14 }}>
              <div>
                <label style={{ fontSize: 11, color: S.muted, display: 'block', marginBottom: 5 }}>الصنف</label>
                <select value={stockForm.item_type} onChange={e => setStockForm(p => ({ ...p, item_type: e.target.value }))}
                  style={{ width: '100%', background: S.navy3, border: `1px solid ${S.border}`, borderRadius: 8, padding: '8px 10px', fontSize: 13, color: S.white, outline: 'none', fontFamily: 'Tajawal, sans-serif', cursor: 'pointer' }}>
                  {ITEM_TYPES.map(it => <option key={it.key} value={it.key} style={{ background: S.navy2 }}>{it.icon} {it.label_ar}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, color: S.muted, display: 'block', marginBottom: 5 }}>المقاس</label>
                <select value={stockForm.size} onChange={e => setStockForm(p => ({ ...p, size: e.target.value }))}
                  style={{ width: '100%', background: S.navy3, border: `1px solid ${S.border}`, borderRadius: 8, padding: '8px 10px', fontSize: 13, color: S.white, outline: 'none', fontFamily: 'Tajawal, sans-serif', cursor: 'pointer' }}>
                  {SIZES.map(s => <option key={s} value={s} style={{ background: S.navy2 }}>{s}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, color: S.muted, display: 'block', marginBottom: 5 }}>الكمية</label>
                <input type="number" min={1} value={stockForm.quantity}
                  onChange={e => setStockForm(p => ({ ...p, quantity: Math.max(1, parseInt(e.target.value) || 1) }))}
                  style={{ width: '100%', background: S.navy3, border: `1px solid ${S.border}`, borderRadius: 8, padding: '8px 10px', fontSize: 13, color: S.white, outline: 'none', fontFamily: 'Tajawal, sans-serif' }} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: S.muted, display: 'block', marginBottom: 5 }}>الفرع</label>
                {isAdmin ? (
                  // ✅ الأدمن يقدر يختار أي فرع
                  <select value={stockForm.branch_id} onChange={e => setStockForm(p => ({ ...p, branch_id: e.target.value }))}
                    style={{ width: '100%', background: S.navy3, border: `1px solid ${S.border}`, borderRadius: 8, padding: '8px 10px', fontSize: 13, color: S.white, outline: 'none', fontFamily: 'Tajawal, sans-serif', cursor: 'pointer' }}>
                    <option value="">-- اختر الفرع --</option>
                    {branches.map(b => <option key={b.id} value={b.id} style={{ background: S.navy2 }}>{b.name}</option>)}
                  </select>
                ) : (
                  // ✅ مدير الفرع: فرعه ثابت ولا يمكن تغييره — عرض فقط
                  <div style={{ width: '100%', background: S.card, border: `1px solid ${S.border}`, borderRadius: 8, padding: '8px 10px', fontSize: 13, color: S.muted, boxSizing: 'border-box' }}>
                    {branches.find(b => b.id === stockForm.branch_id)?.name || '—'}
                  </div>
                )}
              </div>
            </div>
            <button onClick={addStockEntry} disabled={savingStock}
              style={{ padding: '10px 24px', borderRadius: 10, border: `1px solid ${S.gold}`, background: S.gold3, color: S.gold, cursor: savingStock ? 'not-allowed' : 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
              {savingStock ? '⏳ جاري الإضافة...' : '✅ إضافة الكمية'}
            </button>
          </div>

          {/* ملخص الكميات الحالية المتاحة */}
          {Object.keys(stockTotals).length > 0 && (
            <div style={{ background: S.navy2, borderRadius: 16, border: `1px solid ${S.border}`, padding: 20, marginBottom: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: S.white, marginBottom: 14 }}>📊 إجمالي الكميات المتاحة حالياً</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 10 }}>
                {Object.values(stockTotals).map((t, i) => (
                  <div key={i} style={{ background: S.card, borderRadius: 10, padding: '10px 14px' }}>
                    <div style={{ fontSize: 12, color: S.white, fontWeight: 700 }}>{itemLabel(t.item_type)} · {t.size}</div>
                    <div style={{ fontSize: 11, color: S.muted, marginTop: 2 }}>{t.branchName}</div>
                    <div style={{ fontSize: 18, fontWeight: 900, color: S.gold, marginTop: 4 }}>{t.total}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* سجل كل عمليات الإضافة — مين أضاف وإمتى ولأي فرع */}
          <div style={{ fontSize: 14, fontWeight: 700, color: S.white, marginBottom: 12 }}>📜 سجل الإضافات</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {loadingStock ? (
              <div style={{ textAlign: 'center', padding: 40, color: S.muted }}>⏳ جاري التحميل...</div>
            ) : stockEntries.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, background: S.navy2, borderRadius: 16, border: `1px solid ${S.border}`, color: S.muted }}>
                لا توجد إضافات مسجَّلة بعد
              </div>
            ) : stockEntries.map(entry => (
              <div key={entry.id} style={{ background: S.navy2, borderRadius: 12, border: `1px solid ${S.border}`, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: S.white }}>
                    {itemLabel(entry.item_type)} · {entry.size} · <span style={{ color: S.gold }}>+{entry.quantity}</span>
                  </div>
                  <div style={{ fontSize: 11, color: S.muted, marginTop: 3 }}>
                    🏪 {entry.branches?.name || '—'} · 👤 {entry.added_by_employee ? `${entry.added_by_employee.name}${entry.added_by_employee.name_en ? ' ' + entry.added_by_employee.name_en : ''}` : 'غير معروف'}
                  </div>
                </div>
                <div style={{ fontSize: 11, color: S.muted }}>
                  📅 {new Date(entry.created_at).toLocaleString('ar-SA', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
