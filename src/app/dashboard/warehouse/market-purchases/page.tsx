'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
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
  id: string; product_id: string; requested_quantity: number; requested_unit_id: string
  purchased_quantity: number | null; purchased_unit_id: string | null; unit_price: number | null; total_price: number | null; notes: string | null
  warehouse_products?: { name: string; name_en?: string }
  req_unit?: { symbol: string }; pur_unit?: { symbol: string }
}
interface PurchaseRequest {
  id: string; branch_id: string; requested_by: string; status: string
  requested_at: string; purchased_at: string | null; purchased_by: string | null
  delivered_at: string | null; delivered_image_url: string | null
  received_by: string | null; received_at: string | null; total_amount: number; notes: string | null
  branches?: { name: string }
  requester?: { name: string; name_en?: string }
  market_purchase_request_items?: RequestItem[]
}

export default function MarketPurchasesPage() {
  const sb = createClient()
  const { employee: currentUser, permissions } = useAuth()
  const isAdmin = permissions?.all === true
  const isPurchaser = isAdmin || permissions?.market_purchases === true
  const canRequest = ['kitchen_supervisor', 'hall_supervisor', 'bar_supervisor', 'warehouse_keeper'].includes(currentUser?.role || '') || isAdmin

  const [tab, setTab] = useState<'new' | 'mine' | 'purchaser'>(canRequest ? 'new' : 'purchaser')
  const [requests, setRequests] = useState<PurchaseRequest[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [units, setUnits] = useState<{ id: string; symbol: string }[]>([])
  const [loading, setLoading] = useState(true)

  // ── New request form state ──
  const [cart, setCart] = useState<Record<string, { quantity: number; unit_id: string }>>({})
  const [productSearch, setProductSearch] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // ── Purchaser editing state ──
  const [editingReq, setEditingReq] = useState<PurchaseRequest | null>(null)
  const [purchaseEdits, setPurchaseEdits] = useState<Record<string, { quantity: string; unit_id: string; price: string }>>({})
  const [saving, setSaving] = useState(false)

  // ── Receive confirmation state ──
  const [receivingReq, setReceivingReq] = useState<PurchaseRequest | null>(null)
  const [receiveImg, setReceiveImg] = useState<File | null>(null)
  const [receiveImgPreview, setReceiveImgPreview] = useState('')
  const [confirming, setConfirming] = useState(false)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const baseSelect = `*, branches(name), requester:requested_by(name, name_en), market_purchase_request_items(*, warehouse_products(name, name_en), req_unit:units!market_purchase_request_items_requested_unit_id_fkey(symbol), pur_unit:units!market_purchase_request_items_purchased_unit_id_fkey(symbol))`
    let q = sb.from('market_purchase_requests').select(baseSelect).order('requested_at', { ascending: false })
    const [reqRes, unitsRes] = await Promise.all([q, sb.from('units').select('id, symbol').order('name')])
    setRequests((reqRes.data as any) || [])
    setUnits(unitsRes.data || [])
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

  const filteredProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase()
    if (!q) return products
    return products.filter(p => p.name.toLowerCase().includes(q) || (p.name_en || '').toLowerCase().includes(q))
  }, [products, productSearch])

  function toggleCartItem(p: Product) {
    setCart(prev => {
      const next = { ...prev }
      if (next[p.id]) delete next[p.id]
      else next[p.id] = { quantity: 1, unit_id: p.unit_id || '' }
      return next
    })
  }
  function updateCartItem(productId: string, field: 'quantity' | 'unit_id', value: any) {
    setCart(prev => ({ ...prev, [productId]: { ...prev[productId], [field]: value } }))
  }

  async function submitRequest() {
    const items = Object.entries(cart)
    if (items.length === 0) { alert('يرجى اختيار صنف واحد على الأقل'); return }
    setSubmitting(true)
    const { data: newReq, error } = await sb.from('market_purchase_requests')
      .insert([{ branch_id: currentUser?.branch_id, requested_by: currentUser?.id, status: 'pending' }])
      .select('id').single()
    if (error || !newReq) { alert('حدث خطأ: ' + (error?.message || '')); setSubmitting(false); return }

    await sb.from('market_purchase_request_items').insert(
      items.map(([product_id, sel]) => ({
        request_id: newReq.id, product_id,
        requested_quantity: sel.quantity, requested_unit_id: sel.unit_id,
      }))
    )
    await fetchAll()
    setSubmitting(false)
    setCart({})
    setTab('mine')
  }

  function startEditingPurchase(req: PurchaseRequest) {
    const init: Record<string, { quantity: string; unit_id: string; price: string }> = {}
    req.market_purchase_request_items?.forEach(it => {
      init[it.id] = {
        quantity: String(it.purchased_quantity ?? it.requested_quantity),
        unit_id: it.purchased_unit_id || it.requested_unit_id,
        price: String(it.unit_price ?? ''),
      }
    })
    setPurchaseEdits(init)
    setEditingReq(req)
  }

  async function savePurchase() {
    if (!editingReq) return
    setSaving(true)
    let totalAmount = 0
    for (const [itemId, edit] of Object.entries(purchaseEdits)) {
      const qty = parseFloat(edit.quantity) || 0
      const price = parseFloat(edit.price) || 0
      const total = qty * price
      totalAmount += total
      await sb.from('market_purchase_request_items').update({
        purchased_quantity: qty, purchased_unit_id: edit.unit_id,
        unit_price: price, total_price: total,
      }).eq('id', itemId)
    }
    await sb.from('market_purchase_requests').update({
      status: 'purchased', purchased_at: new Date().toISOString(),
      purchased_by: currentUser?.id, total_amount: totalAmount,
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

  const myRequests = requests.filter(r => r.requested_by === currentUser?.id)
  const purchaserRequests = requests.filter(r => r.status === 'pending' || r.status === 'purchased')
  const pendingCount = requests.filter(r => r.status === 'pending').length

  function itemDisplay(it: RequestItem) {
    return `${it.warehouse_products?.name || '—'} — ${it.requested_quantity} ${it.req_unit?.symbol || ''}`
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
      </div>

      {/* ── New Request Tab ── */}
      {tab === 'new' && canRequest && (
        <div>
          <input style={{ ...inp, marginBottom: 14 }} placeholder="🔍 بحث عن صنف..." value={productSearch} onChange={e => setProductSearch(e.target.value)} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 10, marginBottom: 20, maxHeight: 320, overflowY: 'auto' }}>
            {filteredProducts.map(p => {
              const selected = !!cart[p.id]
              return (
                <div key={p.id} onClick={() => toggleCartItem(p)}
                  style={{ background: selected ? S.gold3 : S.card, border: `1.5px solid ${selected ? S.gold : S.border}`, borderRadius: 12, padding: '10px 14px', cursor: 'pointer' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: selected ? S.gold : S.white }}>{p.name}</div>
                  {p.name_en && <div style={{ fontSize: 10, color: S.muted }}>{p.name_en}</div>}
                </div>
              )
            })}
          </div>

          {Object.keys(cart).length > 0 && (
            <div style={{ background: S.navy2, borderRadius: 16, border: `1px solid ${S.border}`, padding: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>الأصناف المطلوبة</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {Object.entries(cart).map(([pid, sel]) => {
                  const p = products.find(x => x.id === pid)
                  if (!p) return null
                  return (
                    <div key={pid} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', background: S.card, borderRadius: 10, padding: '10px 12px' }}>
                      <div style={{ fontSize: 13, fontWeight: 700, minWidth: 110 }}>{p.name}</div>
                      <input type="number" min={0} step="0.01" value={sel.quantity} onChange={e => updateCartItem(pid, 'quantity', parseFloat(e.target.value) || 0)}
                        style={{ width: 70, background: S.navy3, border: `1px solid ${S.border}`, borderRadius: 8, padding: '6px 8px', fontSize: 12, color: S.white, outline: 'none', textAlign: 'center' }} />
                      <select value={sel.unit_id} onChange={e => updateCartItem(pid, 'unit_id', e.target.value)}
                        style={{ background: S.navy3, border: `1px solid ${S.border}`, borderRadius: 8, padding: '6px 8px', fontSize: 12, color: S.white, outline: 'none', cursor: 'pointer' }}>
                        {units.map(u => <option key={u.id} value={u.id}>{u.symbol}</option>)}
                      </select>
                      <button onClick={() => toggleCartItem(p)} style={{ marginRight: 'auto', background: 'transparent', border: 'none', color: S.red, cursor: 'pointer', fontSize: 16 }}>✕</button>
                    </div>
                  )
                })}
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
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
                  <div style={{ fontSize: 12, color: S.muted }}>📅 {new Date(req.requested_at).toLocaleDateString('ar-SA')}</div>
                  <span style={{ background: st.bg, color: st.color, borderRadius: 20, padding: '3px 12px', fontSize: 11, fontWeight: 700 }}>{st.icon} {st.label}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
                  {(req.market_purchase_request_items || []).map(it => (
                    <div key={it.id} style={{ fontSize: 12, color: S.white }}>
                      • {it.warehouse_products?.name} —
                      {it.purchased_quantity != null
                        ? <span> طُلب {it.requested_quantity} {it.req_unit?.symbol} / اشتُري <b style={{ color: S.blue }}>{it.purchased_quantity} {it.pur_unit?.symbol}</b> بسعر {it.unit_price} MYR</span>
                        : <span> {it.requested_quantity} {it.req_unit?.symbol}</span>}
                    </div>
                  ))}
                </div>
                {req.total_amount > 0 && <div style={{ fontSize: 13, fontWeight: 700, color: S.gold, marginBottom: 10 }}>💰 الإجمالي: {req.total_amount.toFixed(2)} MYR</div>}
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
          {loading ? <div style={{ textAlign: 'center', padding: 40, color: S.muted }}>⏳ جاري التحميل...</div>
          : purchaserRequests.length === 0 ? <div style={{ textAlign: 'center', padding: 40, background: S.navy2, borderRadius: 16, border: `1px solid ${S.border}`, color: S.muted }}>لا توجد طلبات حالية</div>
          : purchaserRequests.map(req => {
            const st = STATUS_CFG[req.status] || STATUS_CFG.pending
            return (
              <div key={req.id} style={{ background: S.navy2, borderRadius: 14, border: `1px solid ${req.status === 'pending' ? S.amber + '40' : S.border}`, padding: '16px 18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{req.branches?.name} — {req.requester?.name} {req.requester?.name_en}</div>
                    <div style={{ fontSize: 11, color: S.muted, marginTop: 2 }}>📅 {new Date(req.requested_at).toLocaleDateString('ar-SA')}</div>
                  </div>
                  <span style={{ background: st.bg, color: st.color, borderRadius: 20, padding: '3px 12px', fontSize: 11, fontWeight: 700 }}>{st.icon} {st.label}</span>
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
                {req.status === 'purchased' && <div style={{ fontSize: 12, color: S.muted }}>💰 الإجمالي: {req.total_amount.toFixed(2)} MYR — في انتظار استلام الفرع</div>}
              </div>
            )
          })}
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
                const edit = purchaseEdits[it.id] || { quantity: '', unit_id: '', price: '' }
                return (
                  <div key={it.id} style={{ background: S.card, borderRadius: 12, padding: 14 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>{it.warehouse_products?.name} <span style={{ color: S.muted, fontSize: 11 }}>(مطلوب: {it.requested_quantity} {it.req_unit?.symbol})</span></div>
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
                      <div>
                        <label style={{ fontSize: 10, color: S.muted, display: 'block', marginBottom: 4 }}>سعر الوحدة (MYR)</label>
                        <input type="number" min={0} step="0.01" value={edit.price} onChange={e => setPurchaseEdits(p => ({ ...p, [it.id]: { ...edit, price: e.target.value } }))}
                          style={{ width: 90, background: S.navy3, border: `1px solid ${S.border}`, borderRadius: 8, padding: '6px 8px', fontSize: 12, color: S.white, outline: 'none' }} />
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
