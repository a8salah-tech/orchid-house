'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
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
  card: 'rgba(255,255,255,0.04)', card2: 'rgba(255,255,255,0.08)',
}

const inp: React.CSSProperties = {
  width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)',
  borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#FAFAF8', outline: 'none',
  fontFamily: 'Tajawal, sans-serif', boxSizing: 'border-box', direction: 'rtl',
}

const STATUS_CFG: Record<string, { label: string; icon: string; color: string; bg: string }> = {
  pending:   { label: 'قيد الانتظار', icon: '⏳', color: S.amber, bg: S.amberB },
  purchased: { label: 'تم الشراء',    icon: '🛒', color: S.blue,  bg: S.blueB },
  delivered: { label: 'تم التسليم',   icon: '✅', color: S.green, bg: S.greenB },
  rejected:  { label: 'مرفوض',        icon: '❌', color: S.red,   bg: S.redB },
}

interface Product { id: string; name: string; name_en?: string; current_stock: number; unit_id?: string; units?: { symbol: string } }
interface RequestItem {
  id: string; product_id: string | null; item_name: string | null; requested_quantity: number; requested_unit_id: string
  purchased_quantity: number | null; purchased_unit_id: string | null; unit_price: number | null; total_price: number | null; notes: string | null
  warehouse_products?: { name: string; name_en?: string }
  req_unit?: { symbol: string }; pur_unit?: { symbol: string }
}
interface PurchaseRequest {
  id: string; branch_id: string; requested_by: string; status: string
  request_number?: string | null
  requested_at: string; purchased_at: string | null; purchased_by: string | null
  delivered_at: string | null; delivered_image_url: string | null
  received_by: string | null; received_at: string | null; total_amount: number; notes: string | null
  branches?: { name: string }
  requester?: { name: string; name_en?: string; employee_number?: string }
  market_purchase_request_items?: RequestItem[]
}

// ✅ جديد: عرض التاريخ والوقت بتوقيت ماليزيا (Asia/Kuala_Lumpur) بغض النظر عن توقيت جهاز المستخدم
function fmtMYTime(iso: string) {
  return new Date(iso).toLocaleString('ar-MY', {
    timeZone: 'Asia/Kuala_Lumpur', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true,
  })
}

export default function MarketPurchasesPage() {
  const sb = createClient()
  const { employee: currentUser, permissions } = useAuth()
  const isAdmin = permissions?.all === true
  // ✅ Fix: مسؤولو المستودع (أمين المستودع/مدير المستودعات) هم من يراجعون الطلبات، مش أي حد عنده صلاحية market_purchases عامة فقط
  const isPurchaser = isAdmin || permissions?.market_purchases === true || ['warehouse_keeper', 'warehouse_manager'].includes(currentUser?.role || '')
  // ✅ Fix: المشرفون ومديرو الأقسام هم من يطلبون (مش أمين المستودع، ده بيراجع مش بيطلب)
  const SUPERVISOR_ROLES = ['kitchen_supervisor', 'hall_supervisor', 'bar_supervisor']
  const MANAGER_ROLES = ['kitchen_manager', 'hall_manager', 'bar_manager']
  const canRequest = isAdmin || [...SUPERVISOR_ROLES, ...MANAGER_ROLES].includes(currentUser?.role || '')

  const [tab, setTab] = useState<'new' | 'mine' | 'purchaser' | 'calendar'>(canRequest ? 'new' : 'purchaser')
  const [requests, setRequests] = useState<PurchaseRequest[]>([])
  // ✅ جديد: اختيار الفرع للإدارة - يشوف الفرعين ويقدر يختار بينهم
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([])
  const [adminBranchFilter, setAdminBranchFilter] = useState('')
  const [products, setProducts] = useState<Product[]>([])
  const [units, setUnits] = useState<{ id: string; symbol: string }[]>([])
  const [loading, setLoading] = useState(true)

  // ── New request form state ──
  // ✅ Fix: السلة بقت مصفوفة أصناف نصية حرة (اسم + كمية + وحدة) بدل الاختيار من أصناف المستودع فقط،
  // لأن مشتريات السوق أصلًا أصناف غير موجودة بالمستودع
  const [cart, setCart] = useState<{ tempId: string; name: string; quantity: string; unit_id: string }[]>([])
  const [newItemName, setNewItemName] = useState('')
  // ✅ جديد: اقتراحات البحث عن الأصناف الموجودة في المستودع أثناء الكتابة
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [newItemQty, setNewItemQty] = useState('')
  const [newItemUnit, setNewItemUnit] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // ── Purchaser editing state ──
  const [editingReq, setEditingReq] = useState<PurchaseRequest | null>(null)
  const [purchaseEdits, setPurchaseEdits] = useState<Record<string, { quantity: string; unit_id: string }>>({})
  const [saving, setSaving] = useState(false)

  // ── Receive confirmation state ──
  const [receivingReq, setReceivingReq] = useState<PurchaseRequest | null>(null)
  const [receiveImg, setReceiveImg] = useState<File | null>(null)
  const [receiveImgPreview, setReceiveImgPreview] = useState('')
  const [confirming, setConfirming] = useState(false)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const baseSelect = `*, branches(name), requester:requested_by(name, name_en, employee_number), market_purchase_request_items(*, warehouse_products(name, name_en), req_unit:units!market_purchase_request_items_requested_unit_id_fkey(symbol), pur_unit:units!market_purchase_request_items_purchased_unit_id_fkey(symbol))`
    let q = sb.from('market_purchase_requests').select(baseSelect).order('requested_at', { ascending: false })
    const [reqRes, unitsRes, branchesRes] = await Promise.all([
      q,
      sb.from('units').select('id, symbol').order('name'),
      sb.from('branches').select('id, name').eq('is_active', true).order('name'),
    ])
    setRequests((reqRes.data as any) || [])
    setUnits(unitsRes.data || [])
    setBranches(branchesRes.data || [])
    setLoading(false)
  }, [])

  useEffect(() => { if (currentUser?.id) fetchAll() }, [currentUser?.id, fetchAll])

  // جلب أصناف مستودع فرع الموظف الحالي بالذات (لمنع bug اختيار المستودع الخاطئ)
  useEffect(() => {
    if (!currentUser?.branch_id) return
    sb.from('warehouses').select('id').eq('branch_id', currentUser.branch_id).maybeSingle()
      .then(({ data: wh }) => {
        if (!wh?.id) return
        sb.from('warehouse_products').select('id, name, name_en, current_stock, unit_id, units(symbol)')
          .eq('warehouse_id', wh.id).eq('is_active', true).order('name')
          .then(({ data }) => setProducts((data as any) || []))
      })
  }, [currentUser?.branch_id])

  // ✅ Fix: دوال إدارة سلة الأصناف الحرة - إضافة وحذف
  function addToCart() {
    if (!newItemName.trim()) { alert('يرجى كتابة اسم الصنف'); return }
    if (!newItemQty || parseFloat(newItemQty) <= 0) { alert('يرجى إدخال كمية صحيحة'); return }
    if (!newItemUnit) { alert('يرجى اختيار الوحدة'); return }
    setCart(prev => [...prev, {
      tempId: `${Date.now()}-${Math.random()}`,
      name: newItemName.trim(), quantity: newItemQty, unit_id: newItemUnit,
    }])
    setNewItemName(''); setNewItemQty(''); setNewItemUnit('')
  }
  function removeFromCart(tempId: string) {
    setCart(prev => prev.filter(c => c.tempId !== tempId))
  }

  // ✅ جديد: حذف الطلب بالكامل - متاح للأدمن فقط، مع تأكيد صريح
  async function deleteRequest(reqId: string, reqNumber: string | null | undefined) {
    if (!confirm(`⚠️ هل أنت متأكد من حذف الطلب #${reqNumber || '—'} نهائيًا؟\n\nسيتم حذف كل أصنافه معه. هذا الإجراء لا يمكن التراجع عنه.`)) return
    // نحذف الأصناف أولاً ثم الطلب نفسه، لضمان عدم بقاء أي بيانات معلّقة
    await sb.from('market_purchase_request_items').delete().eq('request_id', reqId)
    const { error } = await sb.from('market_purchase_requests').delete().eq('id', reqId)
    if (error) { alert('حصل خطأ أثناء الحذف: ' + error.message); return }
    await fetchAll()
  }

  async function submitRequest() {
    if (cart.length === 0) { alert('يرجى إضافة صنف واحد على الأقل'); return }
    setSubmitting(true)
    // ✅ جديد: توليد رقم طلب تلقائي بصيغة ORK-{رقم تسلسلي}
    const { count } = await sb.from('market_purchase_requests').select('id', { count: 'exact', head: true })
    const requestNumber = `ORK-${(count || 0) + 1}`
    const { data: newReq, error } = await sb.from('market_purchase_requests')
      .insert([{ branch_id: currentUser?.branch_id, requested_by: currentUser?.id, status: 'pending', request_number: requestNumber }])
      .select('id').single()
    if (error || !newReq) { alert('حدث خطأ: ' + (error?.message || '')); setSubmitting(false); return }

    await sb.from('market_purchase_request_items').insert(
      cart.map(c => ({
        request_id: newReq.id, item_name: c.name,
        requested_quantity: parseFloat(c.quantity), requested_unit_id: c.unit_id,
      }))
    )
    await fetchAll()
    setSubmitting(false)
    setCart([])
    setTab('mine')
  }

  function startEditingPurchase(req: PurchaseRequest) {
    // ✅ Fix: أزلنا السعر - سيُدخَل لاحقًا في فاتورة مشتريات منفصلة بقسم المشتريات
    const init: Record<string, { quantity: string; unit_id: string }> = {}
    req.market_purchase_request_items?.forEach(it => {
      init[it.id] = {
        quantity: String(it.purchased_quantity ?? it.requested_quantity),
        unit_id: it.purchased_unit_id || it.requested_unit_id,
      }
    })
    setPurchaseEdits(init)
    setEditingReq(req)
  }

  async function savePurchase() {
    if (!editingReq) return
    setSaving(true)
    // ✅ Fix: مفيش سعر هنا خالص - بس نسجل الكمية والوحدة الفعلية بعد المراجعة
    for (const [itemId, edit] of Object.entries(purchaseEdits)) {
      const qty = parseFloat(edit.quantity) || 0
      await sb.from('market_purchase_request_items').update({
        purchased_quantity: qty, purchased_unit_id: edit.unit_id,
      }).eq('id', itemId)
    }
    await sb.from('market_purchase_requests').update({
      status: 'purchased', purchased_at: new Date().toISOString(),
      purchased_by: currentUser?.id,
    }).eq('id', editingReq.id)
    await fetchAll()
    setSaving(false)
    setEditingReq(null)
    setPurchaseEdits({})
  }

  function handleReceiveImgSelect(file: File) {
    setReceiveImg(file)
    const reader = new FileReader()
    reader.onload = () => setReceiveImgPreview(reader.result as string)
    reader.readAsDataURL(file)
  }

  async function confirmReceive() {
    if (!receivingReq) return
    if (!receiveImg) { alert('يرجى رفع صورة إثبات الاستلام'); return }
    setConfirming(true)
    const fileName = `market-purchases/${receivingReq.id}-${Date.now()}.jpg`
    const { data: upData } = await sb.storage.from('employees').upload(fileName, receiveImg, { upsert: true })
    let imgUrl = ''
    if (upData) { const { data: urlData } = sb.storage.from('employees').getPublicUrl(upData.path); imgUrl = urlData.publicUrl }

    await sb.from('market_purchase_requests').update({
      status: 'delivered', delivered_at: new Date().toISOString(), delivered_image_url: imgUrl,
      received_by: currentUser?.id, received_at: new Date().toISOString(),
    }).eq('id', receivingReq.id)
    await fetchAll()
    setConfirming(false)
    setReceivingReq(null)
    setReceiveImg(null)
    setReceiveImgPreview('')
  }

  // ✅ جديد: تصفية اقتراحات الأصناف من قائمة أصناف المستودع حسب ما يكتبه المستخدم
  const productSuggestions = useMemo(() => {
    const q = newItemName.trim().toLowerCase()
    if (!q) return []
    return products.filter(p => p.name.toLowerCase().includes(q) || (p.name_en || '').toLowerCase().includes(q)).slice(0, 8)
  }, [products, newItemName])

  const myRequests = requests.filter(r => r.requested_by === currentUser?.id)
  // ✅ Fix: أمين المستودع ومدير المستودعات يشوفوا كل الفروع الآن (زي الأدمن بالظبط)، مش مقيدين بفرعهم بس
  const purchaserRequests = requests
    .filter(r => r.status === 'pending' || r.status === 'purchased')
    .filter(r => !adminBranchFilter || r.branch_id === adminBranchFilter)
  const pendingCount = requests.filter(r => r.status === 'pending').length

  // ✅ جديد: منطق التقويم الشهري - يعرض عدد الطلبات ووضعها لكل يوم
  const [calendarMonth, setCalendarMonth] = useState(() => { const d = new Date(); d.setDate(1); return d })
  const calendarRequests = requests.filter(r => {
    if (!isAdmin) return r.branch_id === currentUser?.branch_id
    return !adminBranchFilter || r.branch_id === adminBranchFilter
  })
  const dayStats = useMemo(() => {
    const map: Record<string, { total: number; received: number; pending: number; purchased: number }> = {}
    for (const r of calendarRequests) {
      const dateKey = new Date(r.requested_at).toISOString().split('T')[0]
      if (!map[dateKey]) map[dateKey] = { total: 0, received: 0, pending: 0, purchased: 0 }
      map[dateKey].total++
      if (r.status === 'delivered') map[dateKey].received++
      else if (r.status === 'purchased') map[dateKey].purchased++
      else if (r.status === 'pending') map[dateKey].pending++
    }
    return map
  }, [calendarRequests])

  const calendarDays = useMemo(() => {
    const year = calendarMonth.getFullYear()
    const month = calendarMonth.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const startOffset = firstDay.getDay() // 0 = الأحد
    const days: (Date | null)[] = []
    for (let i = 0; i < startOffset; i++) days.push(null)
    for (let d = 1; d <= lastDay.getDate(); d++) days.push(new Date(year, month, d))
    return days
  }, [calendarMonth])

  function itemDisplay(it: RequestItem) {
    const name = it.item_name || it.warehouse_products?.name || '—'
    return `${name} — ${it.requested_quantity} ${it.req_unit?.symbol || ''}`
  }

  return (
    <div style={{ fontFamily: 'Tajawal, sans-serif', direction: 'rtl', color: S.white, maxWidth: 900, margin: '0 auto' }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&display=swap'); select option { background: ${S.navy2}; color: ${S.white}; }`}</style>

      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: S.white, marginBottom: 4 }}>🛒 مشتريات السوق</h1>
        <p style={{ fontSize: 13, color: S.muted }}>طلب وشراء وتسليم مشتريات السوق اليومية للفروع</p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {canRequest && (
          <>
            <button onClick={() => setTab('new')}
              style={{ padding: '9px 16px', borderRadius: 12, border: `1px solid ${tab === 'new' ? S.gold : S.border}`, background: tab === 'new' ? S.gold3 : 'transparent', color: tab === 'new' ? S.gold : S.muted, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: tab === 'new' ? 700 : 400 }}>
              ➕ طلب جديد
            </button>
            <button onClick={() => setTab('mine')}
              style={{ padding: '9px 16px', borderRadius: 12, border: `1px solid ${tab === 'mine' ? S.gold : S.border}`, background: tab === 'mine' ? S.gold3 : 'transparent', color: tab === 'mine' ? S.gold : S.muted, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: tab === 'mine' ? 700 : 400 }}>
              📋 طلباتي ({myRequests.length})
            </button>
          </>
        )}
        {isPurchaser && (
          <button onClick={() => setTab('purchaser')}
            style={{ padding: '9px 16px', borderRadius: 12, border: `1px solid ${tab === 'purchaser' ? S.gold : S.border}`, background: tab === 'purchaser' ? S.gold3 : 'transparent', color: tab === 'purchaser' ? S.gold : S.muted, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: tab === 'purchaser' ? 700 : 400, position: 'relative' }}>
            🛒 طلبات الشراء ({purchaserRequests.length})
            {pendingCount > 0 && (
              <span style={{ position: 'absolute', top: -6, right: -6, background: S.red, color: '#fff', borderRadius: '50%', width: 18, height: 18, fontSize: 10, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{pendingCount}</span>
            )}
          </button>
        )}
        {/* ✅ جديد: تاب التقويم للإدارة */}
        {isAdmin && (
          <button onClick={() => setTab('calendar')}
            style={{ padding: '9px 16px', borderRadius: 12, border: `1px solid ${tab === 'calendar' ? S.gold : S.border}`, background: tab === 'calendar' ? S.gold3 : 'transparent', color: tab === 'calendar' ? S.gold : S.muted, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: tab === 'calendar' ? 700 : 400 }}>
            📅 التقويم
          </button>
        )}
      </div>

      {/* ── New Request Tab ── */}
      {tab === 'new' && canRequest && (
        <div>
          {/* ✅ جديد: ملاحظة واضحة وثابتة عن الموعد النهائي للطلبات */}
          <div style={{ background: S.redB, border: `1.5px solid ${S.red}`, borderRadius: 14, padding: '14px 18px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 24 }}>⏰</span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: S.red }}>آخر موعد لتقديم طلبات مشتريات السوق هو الساعة 12:00 ظهرًا بتوقيت ماليزيا يوميًا</div>
              <div style={{ fontSize: 11, color: S.white, marginTop: 2 }}>أي طلب يُقدَّم بعد هذا الموعد قد لا يُلبَّى في نفس اليوم</div>
            </div>
          </div>

          {/* ✅ جديد: نموذج إضافة صنف - بحث ذكي في أصناف المستودع + إمكانية كتابة صنف حر جديد في نفس المكان */}
          <div style={{ background: S.navy2, borderRadius: 16, border: `1px solid ${S.border}`, padding: 20, marginBottom: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>➕ إضافة صنف للطلب</div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div style={{ flex: 2, minWidth: 160, position: 'relative' }}>
                <label style={{ fontSize: 11, color: S.muted, display: 'block', marginBottom: 4 }}>اسم الصنف</label>
                <input style={inp} placeholder="ابحث أو اكتب اسم صنف جديد..." value={newItemName}
                  onChange={e => { setNewItemName(e.target.value); setShowSuggestions(true) }}
                  onFocus={() => setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                  onKeyDown={e => { if (e.key === 'Enter') { setShowSuggestions(false); addToCart() } }} />
                {/* ✅ قائمة اقتراحات من أصناف المستودع الموجودة فعليًا - تظهر وتختفي في نفس مكان الكتابة، من غير أي انتقال لصفحة تانية */}
                {showSuggestions && newItemName.trim().length > 0 && productSuggestions.length > 0 && (
                  <div style={{ position: 'absolute', top: '100%', right: 0, left: 0, marginTop: 4, background: S.navy3, border: `1px solid ${S.border}`, borderRadius: 10, maxHeight: 200, overflowY: 'auto', zIndex: 50, boxShadow: '0 8px 20px rgba(0,0,0,0.4)' }}>
                    {productSuggestions.map(p => (
                      <div key={p.id} onMouseDown={() => {
                        setNewItemName(p.name)
                        if (p.unit_id) setNewItemUnit(p.unit_id)
                        setShowSuggestions(false)
                      }}
                        style={{ padding: '9px 12px', cursor: 'pointer', fontSize: 12, color: S.white, borderBottom: `1px solid ${S.border}` }}>
                        📦 {p.name} {p.name_en && <span style={{ color: S.muted }}>({p.name_en})</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ width: 100 }}>
                <label style={{ fontSize: 11, color: S.muted, display: 'block', marginBottom: 4 }}>الكمية</label>
                <input type="number" min={0} step="0.01" style={inp} placeholder="0" value={newItemQty}
                  onChange={e => setNewItemQty(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') addToCart() }} />
              </div>
              <div style={{ width: 110 }}>
                <label style={{ fontSize: 11, color: S.muted, display: 'block', marginBottom: 4 }}>الوحدة</label>
                <select style={inp} value={newItemUnit} onChange={e => setNewItemUnit(e.target.value)}>
                  <option value="">اختر</option>
                  {units.map(u => <option key={u.id} value={u.id}>{u.symbol}</option>)}
                </select>
              </div>
              <button onClick={addToCart}
                style={{ padding: '10px 18px', borderRadius: 10, border: `1px solid ${S.gold}`, background: S.gold3, color: S.gold, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700, whiteSpace: 'nowrap' }}>
                ➕ إضافة للسلة
              </button>
            </div>
          </div>

          {cart.length > 0 && (
            <div style={{ background: S.navy2, borderRadius: 16, border: `1px solid ${S.border}`, padding: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>🛒 سلة الطلب ({cart.length} صنف)</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {cart.map(c => (
                  <div key={c.tempId} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', background: S.card, borderRadius: 10, padding: '10px 12px' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, minWidth: 110, flex: 1 }}>{c.name}</div>
                    <div style={{ fontSize: 13, color: S.gold, fontWeight: 700 }}>{c.quantity} {units.find(u => u.id === c.unit_id)?.symbol}</div>
                    <button onClick={() => removeFromCart(c.tempId)} style={{ background: 'transparent', border: 'none', color: S.red, cursor: 'pointer', fontSize: 16 }}>✕</button>
                  </div>
                ))}
              </div>
              <button onClick={submitRequest} disabled={submitting}
                style={{ width: '100%', marginTop: 16, padding: '12px', borderRadius: 12, border: `1px solid ${S.gold}`, background: S.gold3, color: S.gold, cursor: submitting ? 'not-allowed' : 'pointer', fontSize: 14, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
                {submitting ? '⏳ جاري الإرسال...' : '✅ إرسال الطلب'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── My Requests Tab ── */}
      {tab === 'mine' && canRequest && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {loading ? <div style={{ textAlign: 'center', padding: 40, color: S.muted }}>⏳ جاري التحميل...</div>
          : myRequests.length === 0 ? <div style={{ textAlign: 'center', padding: 40, background: S.navy2, borderRadius: 16, border: `1px solid ${S.border}`, color: S.muted }}>لا توجد طلبات سابقة</div>
          : myRequests.map(req => {
            const st = STATUS_CFG[req.status] || STATUS_CFG.pending
            return (
              <div key={req.id} style={{ background: S.navy2, borderRadius: 14, border: `1px solid ${S.border}`, padding: '16px 18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: S.gold }}>#{req.request_number || '—'}</div>
                    <div style={{ fontSize: 11, color: S.muted }}>📅 {fmtMYTime(req.requested_at)}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ background: st.bg, color: st.color, borderRadius: 20, padding: '3px 12px', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>{st.icon} {st.label}</span>
                    {/* ✅ جديد: حذف الطلب - أدمن فقط */}
                    {isAdmin && (
                      <button onClick={() => deleteRequest(req.id, req.request_number)} title="حذف الطلب"
                        style={{ background: S.redB, border: `1px solid ${S.red}`, borderRadius: 8, color: S.red, cursor: 'pointer', fontSize: 12, padding: '4px 8px' }}>
                        🗑️
                      </button>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
                  {(req.market_purchase_request_items || []).map(it => (
                    <div key={it.id} style={{ fontSize: 12, color: S.white }}>
                      • {it.item_name || it.warehouse_products?.name} —
                      {it.purchased_quantity != null
                        ? <span> طُلب {it.requested_quantity} {it.req_unit?.symbol} / اشتُري <b style={{ color: S.blue }}>{it.purchased_quantity} {it.pur_unit?.symbol}</b></span>
                        : <span> {it.requested_quantity} {it.req_unit?.symbol}</span>}
                    </div>
                  ))}
                </div>
                {/* ✅ Fix: تم إخفاء السعر والإجمالي عن الموظف الطالب بناءً على الطلب - يبقى ظاهرًا فقط لمسؤول المستودع والإدارة في تاب طلبات الشراء */}
                {req.status === 'purchased' && (
                  <button onClick={() => setReceivingReq(req)}
                    style={{ width: '100%', padding: '10px', borderRadius: 10, border: `1px solid ${S.green}`, background: S.greenB, color: S.green, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
                    ✅ تأكيد الاستلام + رفع صورة
                  </button>
                )}
                {req.status === 'delivered' && req.delivered_image_url && (
                  <img src={req.delivered_image_url} alt="إثبات الاستلام" style={{ width: 80, height: 80, borderRadius: 10, objectFit: 'cover', border: `1px solid ${S.border}` }} />
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── Purchaser Tab ── */}
      {tab === 'purchaser' && isPurchaser && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* ✅ جديد: اختيار الفرع - يظهر للإدارة فقط */}
          {isPurchaser && branches.length > 0 && (
            <div style={{ display: 'flex', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
              <button onClick={() => setAdminBranchFilter('')}
                style={{ padding: '8px 16px', borderRadius: 10, border: `1px solid ${!adminBranchFilter ? S.gold : S.border}`, background: !adminBranchFilter ? S.gold3 : 'transparent', color: !adminBranchFilter ? S.gold : S.muted, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', fontWeight: !adminBranchFilter ? 700 : 400 }}>
                🌐 كل الفروع
              </button>
              {branches.map(b => (
                <button key={b.id} onClick={() => setAdminBranchFilter(b.id)}
                  style={{ padding: '8px 16px', borderRadius: 10, border: `1px solid ${adminBranchFilter === b.id ? S.gold : S.border}`, background: adminBranchFilter === b.id ? S.gold3 : 'transparent', color: adminBranchFilter === b.id ? S.gold : S.muted, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', fontWeight: adminBranchFilter === b.id ? 700 : 400 }}>
                  🏪 {b.name}
                </button>
              ))}
            </div>
          )}
          {loading ? <div style={{ textAlign: 'center', padding: 40, color: S.muted }}>⏳ جاري التحميل...</div>
          : purchaserRequests.length === 0 ? <div style={{ textAlign: 'center', padding: 40, background: S.navy2, borderRadius: 16, border: `1px solid ${S.border}`, color: S.muted }}>لا توجد طلبات حالية</div>
          : purchaserRequests.map(req => {
            const st = STATUS_CFG[req.status] || STATUS_CFG.pending
            return (
              <div key={req.id} style={{ background: S.navy2, borderRadius: 14, border: `1px solid ${req.status === 'pending' ? S.amber + '40' : S.border}`, padding: '16px 18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: S.gold }}>#{req.request_number || '—'}</div>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{req.branches?.name} — {req.requester?.name} {req.requester?.name_en} {req.requester?.employee_number && <span style={{ color: S.gold, fontSize: 12 }}>(#{req.requester.employee_number})</span>}</div>
                    <div style={{ fontSize: 11, color: S.muted, marginTop: 2 }}>📅 {fmtMYTime(req.requested_at)}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ background: st.bg, color: st.color, borderRadius: 20, padding: '3px 12px', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>{st.icon} {st.label}</span>
                    {/* ✅ جديد: حذف الطلب - أدمن فقط */}
                    {isAdmin && (
                      <button onClick={() => deleteRequest(req.id, req.request_number)} title="حذف الطلب"
                        style={{ background: S.redB, border: `1px solid ${S.red}`, borderRadius: 8, color: S.red, cursor: 'pointer', fontSize: 12, padding: '4px 8px' }}>
                        🗑️
                      </button>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                  {(req.market_purchase_request_items || []).map(it => (
                    <span key={it.id} style={{ background: S.card, borderRadius: 10, padding: '5px 10px', fontSize: 12 }}>{itemDisplay(it)}</span>
                  ))}
                </div>
                {req.status === 'pending' && (
                  <button onClick={() => startEditingPurchase(req)}
                    style={{ width: '100%', padding: '10px', borderRadius: 10, border: `1px solid ${S.blue}`, background: S.blueB, color: S.blue, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
                    🛒 تسجيل الشراء
                  </button>
                )}
                {req.status === 'purchased' && <div style={{ fontSize: 12, color: S.muted }}>في انتظار استلام الفرع</div>}
              </div>
            )
          })}
        </div>
      )}

      {/* ── Calendar Tab ── */}
      {tab === 'calendar' && isAdmin && (
        <div>
          {branches.length > 0 && (
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
              <button onClick={() => setAdminBranchFilter('')}
                style={{ padding: '8px 16px', borderRadius: 10, border: `1px solid ${!adminBranchFilter ? S.gold : S.border}`, background: !adminBranchFilter ? S.gold3 : 'transparent', color: !adminBranchFilter ? S.gold : S.muted, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', fontWeight: !adminBranchFilter ? 700 : 400 }}>
                🌐 كل الفروع
              </button>
              {branches.map(b => (
                <button key={b.id} onClick={() => setAdminBranchFilter(b.id)}
                  style={{ padding: '8px 16px', borderRadius: 10, border: `1px solid ${adminBranchFilter === b.id ? S.gold : S.border}`, background: adminBranchFilter === b.id ? S.gold3 : 'transparent', color: adminBranchFilter === b.id ? S.gold : S.muted, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', fontWeight: adminBranchFilter === b.id ? 700 : 400 }}>
                  🏪 {b.name}
                </button>
              ))}
            </div>
          )}

          {/* شريط التنقل بين الشهور */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <button onClick={() => setCalendarMonth(m => { const d = new Date(m); d.setMonth(d.getMonth() - 1); return d })}
              style={{ padding: '8px 14px', borderRadius: 10, border: `1px solid ${S.border}`, background: 'transparent', color: S.white, cursor: 'pointer', fontSize: 13 }}>
              ← الشهر السابق
            </button>
            <div style={{ fontSize: 16, fontWeight: 800, color: S.gold }}>
              {calendarMonth.toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' })}
            </div>
            <button onClick={() => setCalendarMonth(m => { const d = new Date(m); d.setMonth(d.getMonth() + 1); return d })}
              style={{ padding: '8px 14px', borderRadius: 10, border: `1px solid ${S.border}`, background: 'transparent', color: S.white, cursor: 'pointer', fontSize: 13 }}>
              الشهر التالي →
            </button>
          </div>

          {/* شبكة التقويم */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
            {['أحد', 'اثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'].map(d => (
              <div key={d} style={{ textAlign: 'center', fontSize: 11, color: S.muted, fontWeight: 700, padding: '4px 0' }}>{d}</div>
            ))}
            {calendarDays.map((day, i) => {
              if (!day) return <div key={i} />
              const key = day.toISOString().split('T')[0]
              const stats = dayStats[key]
              const isToday = key === new Date().toISOString().split('T')[0]
              return (
                <div key={i} style={{
                  background: isToday ? S.gold3 : S.navy2, border: `1px solid ${isToday ? S.gold : S.border}`,
                  borderRadius: 10, padding: '8px 6px', minHeight: 72, display: 'flex', flexDirection: 'column', gap: 4,
                }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: isToday ? S.gold : S.white }}>{day.getDate()}</div>
                  {stats && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <div style={{ fontSize: 10, color: S.white }}>📦 {stats.total} طلب</div>
                      {stats.received > 0 && <div style={{ fontSize: 10, color: S.green }}>✅ {stats.received} مُستلَم</div>}
                      {stats.pending > 0 && <div style={{ fontSize: 10, color: S.amber }}>⏳ {stats.pending} معلّق</div>}
                      {stats.purchased > 0 && <div style={{ fontSize: 10, color: S.blue }}>🛒 {stats.purchased} تم الشراء</div>}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Purchase Editing Modal ── */}
      {editingReq && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: S.navy2, borderRadius: 20, border: `1px solid ${S.border}`, width: '100%', maxWidth: 560, maxHeight: '88vh', overflowY: 'auto', padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 18 }}>
              <h2 style={{ fontSize: 16, fontWeight: 800 }}>🛒 تسجيل الشراء — {editingReq.branches?.name}</h2>
              <button onClick={() => { setEditingReq(null); setPurchaseEdits({}) }} style={{ background: 'transparent', border: 'none', color: S.muted, fontSize: 20, cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {(editingReq.market_purchase_request_items || []).map(it => {
                const edit = purchaseEdits[it.id] || { quantity: '', unit_id: '' }
                return (
                  <div key={it.id} style={{ background: S.card, borderRadius: 12, padding: 14 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>{it.item_name || it.warehouse_products?.name} <span style={{ color: S.muted, fontSize: 11 }}>(مطلوب: {it.requested_quantity} {it.req_unit?.symbol})</span></div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <div>
                        <label style={{ fontSize: 10, color: S.muted, display: 'block', marginBottom: 4 }}>الكمية المتاحة فعليًا</label>
                        <input type="number" min={0} step="0.01" value={edit.quantity} onChange={e => setPurchaseEdits(p => ({ ...p, [it.id]: { ...edit, quantity: e.target.value } }))}
                          style={{ width: 90, background: S.navy3, border: `1px solid ${S.border}`, borderRadius: 8, padding: '6px 8px', fontSize: 12, color: S.white, outline: 'none' }} />
                      </div>
                      <div>
                        <label style={{ fontSize: 10, color: S.muted, display: 'block', marginBottom: 4 }}>الوحدة</label>
                        <select value={edit.unit_id} onChange={e => setPurchaseEdits(p => ({ ...p, [it.id]: { ...edit, unit_id: e.target.value } }))}
                          style={{ background: S.navy3, border: `1px solid ${S.border}`, borderRadius: 8, padding: '6px 8px', fontSize: 12, color: S.white, outline: 'none', cursor: 'pointer' }}>
                          {units.map(u => <option key={u.id} value={u.id}>{u.symbol}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
            <button onClick={savePurchase} disabled={saving}
              style={{ width: '100%', marginTop: 18, padding: '12px', borderRadius: 12, border: `1px solid ${S.green}`, background: S.greenB, color: S.green, cursor: saving ? 'not-allowed' : 'pointer', fontSize: 14, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
              {saving ? '⏳ جاري الحفظ...' : '✅ حفظ وإتمام الشراء'}
            </button>
          </div>
        </div>
      )}

      {/* ── Receive Confirmation Modal ── */}
      {receivingReq && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: S.navy2, borderRadius: 20, border: `1px solid ${S.border}`, width: '100%', maxWidth: 420, padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 18 }}>
              <h2 style={{ fontSize: 16, fontWeight: 800 }}>✅ تأكيد الاستلام</h2>
              <button onClick={() => { setReceivingReq(null); setReceiveImg(null); setReceiveImgPreview('') }} style={{ background: 'transparent', border: 'none', color: S.muted, fontSize: 20, cursor: 'pointer' }}>✕</button>
            </div>
            <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 8 }}>📷 صورة إثبات الاستلام *</label>
            <input type="file" accept="image/*" onChange={e => e.target.files?.[0] && handleReceiveImgSelect(e.target.files[0])} style={{ marginBottom: 14, fontSize: 12, color: S.white }} />
            {receiveImgPreview && <img src={receiveImgPreview} alt="معاينة" style={{ width: '100%', maxHeight: 200, objectFit: 'cover', borderRadius: 10, marginBottom: 14 }} />}
            <button onClick={confirmReceive} disabled={confirming}
              style={{ width: '100%', padding: '12px', borderRadius: 12, border: `1px solid ${S.green}`, background: S.greenB, color: S.green, cursor: confirming ? 'not-allowed' : 'pointer', fontSize: 14, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
              {confirming ? '⏳ جاري التأكيد...' : '✅ تأكيد الاستلام'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
