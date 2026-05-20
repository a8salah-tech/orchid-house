'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
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
  teal: '#14B8A6', tealB: 'rgba(20,184,166,0.12)',
  purple: '#8B5CF6', purpleB: 'rgba(139,92,246,0.12)',
  card: 'rgba(255,255,255,0.04)', card2: 'rgba(255,255,255,0.08)',
}

const SERVICE_CHARGE_RATE = 0.10
const SST_RATE = 0.06

type TableRow = { id: string; number: number; name: string; status: string; occupied_since?: string; current_order_id?: string }
type OrderItem = { id: string; quantity: number; unit_price: number; notes: string; destination: string; status: string; menu_items: { name: string; name_en: string } }
type Order = {
  id: string; table_id: string; status: string; total_amount: number
  discount_amount: number; discount_type: string; payment_method: string
  service_charge: number; sst_amount: number; shift: string
  notes: string; created_at: string; confirmed_at: string; paid_at?: string
  tables: { number: number; name: string }
  order_items: OrderItem[]
}
type MenuItem = { id: string; name: string; name_en: string; price: number; category_id: string; menu_categories?: { name: string } }
type Category = { id: string; name: string; name_en: string }

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string; emoji: string }> = {
  confirmed:  { label: 'جديد',        color: S.blue,   bg: S.blueB,   emoji: '🆕' },
  preparing:  { label: 'قيد التحضير', color: S.amber,  bg: S.amberB,  emoji: '👨‍🍳' },
  ready:      { label: 'جاهز',        color: S.green,  bg: S.greenB,  emoji: '✅' },
  done:       { label: 'مُسلَّم',      color: S.muted,  bg: S.card,    emoji: '📦' },
  paid:       { label: 'مدفوع',       color: S.teal,   bg: S.tealB,   emoji: '💰' },
  cancelled:  { label: 'ملغي',        color: S.red,    bg: S.redB,    emoji: '❌' },
}

function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60) return `${diff}ث`
  if (diff < 3600) return `${Math.floor(diff / 60)}د`
  return `${Math.floor(diff / 3600)}س ${Math.floor((diff % 3600) / 60)}د`
}

function elapsed(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  const h = Math.floor(diff / 3600)
  const m = Math.floor((diff % 3600) / 60)
  const s = diff % 60
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
}

// ══ Payment Modal ══
function PaymentModal({ order, onClose, onPaid }: { order: Order; onClose: () => void; onPaid: () => void }) {
  const sb = createClient()
  const [method, setMethod] = useState<'cash' | 'visa' | 'online' | 'free'>('cash')
  const [discountType, setDiscountType] = useState<'none' | 'amount' | 'percent' | 'free'>('none')
  const [discountValue, setDiscountValue] = useState('')
  const [saving, setSaving] = useState(false)

  const subtotal = order.order_items.reduce((s, i) => s + i.unit_price * i.quantity, 0)
  const discountAmt = discountType === 'none' ? 0
    : discountType === 'free' ? subtotal
    : discountType === 'percent' ? subtotal * (parseFloat(discountValue) || 0) / 100
    : parseFloat(discountValue) || 0
  const afterDiscount = Math.max(0, subtotal - discountAmt)
  const serviceCharge = discountType === 'free' ? 0 : afterDiscount * SERVICE_CHARGE_RATE
  const sst = discountType === 'free' ? 0 : afterDiscount * SST_RATE
  const total = afterDiscount + serviceCharge + sst

  async function pay() {
    setSaving(true)
    await sb.from('orders').update({
      status: 'paid',
      payment_method: discountType === 'free' ? 'free' : method,
      discount_amount: discountAmt,
      discount_type: discountType === 'free' ? 'free' : discountType,
      service_charge: serviceCharge,
      sst_amount: sst,
      total_amount: total,
      paid_at: new Date().toISOString(),
    }).eq('id', order.id)
    await sb.from('tables').update({ status: 'available', current_order_id: null, occupied_since: null }).eq('id', order.table_id)
    setSaving(false)
    onPaid()
  }

  function printReceipt() {
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
    <style>
      body{font-family:monospace;font-size:12px;width:300px;margin:0 auto;padding:20px;}
      .center{text-align:center;} .line{border-top:1px dashed #000;margin:8px 0;}
      .row{display:flex;justify-content:space-between;margin:4px 0;}
      .bold{font-weight:bold;} .big{font-size:16px;}
      @media print{@page{margin:0;}}
    </style></head><body>
    <div class="center"><div class="big bold">🌸 ORCHID HOUSE</div>
    <div>Fine Dining Restaurant</div>
    <div style="font-size:10px;color:#666">${new Date().toLocaleString('en-GB')}</div></div>
    <div class="line"></div>
    <div class="row"><span>Table:</span><span>${order.tables?.name || 'Table ' + order.tables?.number}</span></div>
    <div class="row"><span>Order #:</span><span>${order.id.slice(-6).toUpperCase()}</span></div>
    <div class="line"></div>
    ${order.order_items.map(i => `
    <div class="row"><span>${i.menu_items?.name} ×${i.quantity}</span><span>MYR ${(i.unit_price * i.quantity).toFixed(2)}</span></div>
    ${i.notes ? `<div style="font-size:10px;color:#666;padding-right:10px">* ${i.notes}</div>` : ''}
    `).join('')}
    <div class="line"></div>
    <div class="row"><span>Subtotal</span><span>MYR ${subtotal.toFixed(2)}</span></div>
    ${discountAmt > 0 ? `<div class="row"><span>Discount</span><span>- MYR ${discountAmt.toFixed(2)}</span></div>` : ''}
    ${discountType !== 'free' ? `
    <div class="row"><span>Service Charge (10%)</span><span>MYR ${serviceCharge.toFixed(2)}</span></div>
    <div class="row"><span>SST (6%)</span><span>MYR ${sst.toFixed(2)}</span></div>
    ` : ''}
    <div class="line"></div>
    <div class="row bold big"><span>TOTAL</span><span>MYR ${total.toFixed(2)}</span></div>
    <div class="line"></div>
    <div class="row"><span>Payment</span><span>${discountType === 'free' ? 'COMPLIMENTARY' : method.toUpperCase()}</span></div>
    <div class="line"></div>
    <div class="center" style="font-size:10px;margin-top:10px">
      Thank you for dining with us!<br>
      All prices subject to 10% service charge & 6% SST
    </div>
    <script>window.onload=()=>window.print()<\/script>
    </body></html>`)
    win.document.close()
  }

  const inp: React.CSSProperties = { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: '9px 14px', fontSize: 13, color: S.white, outline: 'none', fontFamily: 'Tajawal, sans-serif', width: '100%', boxSizing: 'border-box' as const }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 400, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 20, overflowY: 'auto' }}>
      <div style={{ background: S.navy2, borderRadius: 20, border: `1px solid ${S.border}`, width: '100%', maxWidth: 480, padding: 28, margin: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ color: S.white, fontSize: 18, fontWeight: 800 }}>💰 تسوية الفاتورة</h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: S.muted, fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>

        {/* Order Summary */}
        <div style={{ background: S.card, borderRadius: 12, padding: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: S.muted, marginBottom: 10 }}>{order.tables?.name || `طاولة ${order.tables?.number}`} · #{order.id.slice(-6).toUpperCase()}</div>
          {order.order_items.map(i => (
            <div key={i.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: `1px solid ${S.border}`, fontSize: 13 }}>
              <span style={{ color: S.white }}>{i.menu_items?.name} <span style={{ color: S.muted }}>×{i.quantity}</span></span>
              <span style={{ color: S.gold }}>MYR {(i.unit_price * i.quantity).toFixed(2)}</span>
            </div>
          ))}
        </div>

        {/* Discount */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: S.muted, marginBottom: 8 }}>الخصم</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 10 }}>
            {[
              { k: 'none', label: 'بدون' },
              { k: 'amount', label: 'مبلغ' },
              { k: 'percent', label: '%' },
              { k: 'free', label: '🎁 مجاني' },
            ].map(d => (
              <button key={d.k} onClick={() => setDiscountType(d.k as any)}
                style={{ padding: '8px', borderRadius: 8, border: `1px solid ${discountType === d.k ? S.amber : S.border}`, background: discountType === d.k ? S.amberB : 'transparent', color: discountType === d.k ? S.amber : S.muted, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', fontWeight: discountType === d.k ? 700 : 400 }}>
                {d.label}
              </button>
            ))}
          </div>
          {(discountType === 'amount' || discountType === 'percent') && (
            <input style={inp} type="number" value={discountValue} onChange={e => setDiscountValue(e.target.value)}
              placeholder={discountType === 'percent' ? 'نسبة الخصم %' : 'مبلغ الخصم MYR'} />
          )}
        </div>

        {/* Payment Method */}
        {discountType !== 'free' && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, color: S.muted, marginBottom: 8 }}>طريقة الدفع</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {[
                { k: 'cash', label: '💵 كاش', color: S.green },
                { k: 'visa', label: '💳 فيزا', color: S.blue },
                { k: 'online', label: '📱 أونلاين', color: S.purple },
              ].map(m => (
                <button key={m.k} onClick={() => setMethod(m.k as any)}
                  style={{ padding: '10px', borderRadius: 10, border: `1px solid ${method === m.k ? m.color : S.border}`, background: method === m.k ? m.color + '20' : 'transparent', color: method === m.k ? m.color : S.muted, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: method === m.k ? 700 : 400 }}>
                  {m.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Totals */}
        <div style={{ background: S.card, borderRadius: 12, padding: 16, marginBottom: 20 }}>
          {[
            { label: 'الإجمالي الفرعي', value: subtotal, color: S.white },
            discountAmt > 0 ? { label: 'الخصم', value: -discountAmt, color: S.red } : null,
            discountType !== 'free' ? { label: 'رسوم الخدمة 10%', value: serviceCharge, color: S.muted } : null,
            discountType !== 'free' ? { label: 'SST 6%', value: sst, color: S.muted } : null,
          ].filter(Boolean).map((row, i) => row && (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: 13 }}>
              <span style={{ color: S.muted }}>{row.label}</span>
              <span style={{ color: row.color }}>{row.value < 0 ? '- ' : ''}MYR {Math.abs(row.value).toFixed(2)}</span>
            </div>
          ))}
          <div style={{ borderTop: `1px solid ${S.border}`, marginTop: 10, paddingTop: 10, display: 'flex', justifyContent: 'space-between', fontSize: 18, fontWeight: 900 }}>
            <span style={{ color: S.white }}>الإجمالي</span>
            <span style={{ color: S.gold }}>MYR {total.toFixed(2)}</span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={printReceipt} style={{ padding: '12px 18px', borderRadius: 12, border: `1px solid ${S.blue}`, background: S.blueB, color: S.blue, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>🖨️ طباعة</button>
          <button onClick={pay} disabled={saving} style={{ flex: 1, padding: '12px', borderRadius: 12, border: 'none', background: `linear-gradient(135deg, ${S.gold}, ${S.gold2})`, color: S.navy, cursor: 'pointer', fontSize: 15, fontFamily: 'Tajawal, sans-serif', fontWeight: 800, opacity: saving ? 0.7 : 1 }}>
            {saving ? '⏳...' : discountType === 'free' ? '🎁 وجبة مجانية' : '✅ تأكيد الدفع'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ══ Add Order Modal ══
function AddOrderModal({ tableId, tableName, onClose, onSaved }: { tableId: string; tableName: string; onClose: () => void; onSaved: () => void }) {
  const sb = createClient()
  const [categories, setCategories] = useState<Category[]>([])
  const [items, setItems] = useState<MenuItem[]>([])
  const [cart, setCart] = useState<{ item: MenuItem; qty: number; notes: string }[]>([])
  const [selectedCat, setSelectedCat] = useState('all')
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    Promise.all([
      sb.from('menu_categories').select('id,name,name_en').eq('is_active', true).order('sort_order'),
      sb.from('menu_items').select('id,name,name_en,price,category_id,menu_categories(name)').eq('is_available', true).order('name'),
    ]).then(([cats, itms]) => {
      setCategories(cats.data || [])
      setItems(itms.data || [])
    })
  }, [])

  const filtered = items.filter(i => {
    const matchCat = selectedCat === 'all' || i.category_id === selectedCat
    const matchSearch = !search || i.name.includes(search) || i.name_en.toLowerCase().includes(search.toLowerCase())
    return matchCat && matchSearch
  })

  function addItem(item: MenuItem) {
    setCart(p => {
      const ex = p.find(c => c.item.id === item.id)
      if (ex) return p.map(c => c.item.id === item.id ? { ...c, qty: c.qty + 1 } : c)
      return [...p, { item, qty: 1, notes: '' }]
    })
  }

  function removeItem(id: string) {
    setCart(p => {
      const ex = p.find(c => c.item.id === id)
      if (!ex) return p
      if (ex.qty === 1) return p.filter(c => c.item.id !== id)
      return p.map(c => c.item.id === id ? { ...c, qty: c.qty - 1 } : c)
    })
  }

  const total = cart.reduce((s, c) => s + c.item.price * c.qty, 0)

  async function placeOrder() {
    if (cart.length === 0) return
    setSaving(true)
    const { data: order } = await sb.from('orders').insert([{
      table_id: tableId, status: 'confirmed',
      total_amount: total, confirmed_at: new Date().toISOString(),
    }]).select('id').single()
    if (!order) { setSaving(false); return }
    await sb.from('order_items').insert(cart.map(c => ({
      order_id: order.id, menu_item_id: c.item.id,
      quantity: c.qty, unit_price: c.item.price,
      notes: c.notes || null, status: 'pending',
      destination: 'kitchen',
    })))
    await sb.from('tables').update({ status: 'occupied', current_order_id: order.id, occupied_since: new Date().toISOString() }).eq('id', tableId)
    setSaving(false)
    onSaved()
  }

  const inp: React.CSSProperties = { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: '8px 12px', fontSize: 12, color: S.white, outline: 'none', fontFamily: 'Tajawal, sans-serif', width: '100%', boxSizing: 'border-box' as const }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 400, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 20, overflowY: 'auto' }}>
      <div style={{ background: S.navy2, borderRadius: 20, border: `1px solid ${S.border}`, width: '100%', maxWidth: 700, padding: 24, margin: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ color: S.white, fontSize: 16, fontWeight: 800 }}>➕ إضافة طلب — {tableName}</h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: S.muted, fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>
        <input style={inp} placeholder="🔍 بحث..." value={search} onChange={e => setSearch(e.target.value)} />
        <div style={{ display: 'flex', gap: 6, marginTop: 10, marginBottom: 12, overflowX: 'auto' }}>
          <button onClick={() => setSelectedCat('all')} style={{ padding: '5px 12px', borderRadius: 20, border: `1px solid ${selectedCat === 'all' ? S.gold : S.border}`, background: selectedCat === 'all' ? S.gold3 : 'transparent', color: selectedCat === 'all' ? S.gold : S.muted, cursor: 'pointer', fontSize: 11, whiteSpace: 'nowrap', fontFamily: 'Tajawal, sans-serif' }}>الكل</button>
          {categories.map(c => (
            <button key={c.id} onClick={() => setSelectedCat(c.id)} style={{ padding: '5px 12px', borderRadius: 20, border: `1px solid ${selectedCat === c.id ? S.gold : S.border}`, background: selectedCat === c.id ? S.gold3 : 'transparent', color: selectedCat === c.id ? S.gold : S.muted, cursor: 'pointer', fontSize: 11, whiteSpace: 'nowrap', fontFamily: 'Tajawal, sans-serif' }}>{c.name}</button>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 8, maxHeight: 300, overflowY: 'auto', marginBottom: 16 }}>
          {filtered.map(item => {
            const qty = cart.find(c => c.item.id === item.id)?.qty || 0
            return (
              <div key={item.id} style={{ background: qty > 0 ? S.gold3 : S.card, border: `1px solid ${qty > 0 ? S.gold : S.border}`, borderRadius: 10, padding: 10, cursor: 'pointer' }} onClick={() => addItem(item)}>
                <div style={{ fontSize: 12, fontWeight: 700, color: S.white, marginBottom: 4 }}>{item.name}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: S.gold, fontWeight: 700 }}>MYR {item.price.toFixed(2)}</span>
                  {qty > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }} onClick={e => e.stopPropagation()}>
                      <button onClick={() => removeItem(item.id)} style={{ width: 22, height: 22, borderRadius: 6, border: `1px solid ${S.red}`, background: S.redB, color: S.red, cursor: 'pointer', fontSize: 14, fontWeight: 700 }}>−</button>
                      <span style={{ color: S.gold, fontWeight: 800, fontSize: 13 }}>{qty}</span>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
        {cart.length > 0 && (
          <div style={{ background: S.card, borderRadius: 12, padding: 14, marginBottom: 16 }}>
            {cart.map(c => (
              <div key={c.item.id} style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                  <span style={{ color: S.white }}>{c.item.name} ×{c.qty}</span>
                  <span style={{ color: S.gold }}>MYR {(c.item.price * c.qty).toFixed(2)}</span>
                </div>
                <input style={{ ...inp, fontSize: 11 }} placeholder="ملاحظة..." value={c.notes} onChange={e => setCart(p => p.map(ci => ci.item.id === c.item.id ? { ...ci, notes: e.target.value } : ci))} />
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 15, marginTop: 10, paddingTop: 10, borderTop: `1px solid ${S.border}` }}>
              <span style={{ color: S.white }}>الإجمالي</span>
              <span style={{ color: S.gold }}>MYR {total.toFixed(2)}</span>
            </div>
          </div>
        )}
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ padding: '11px 20px', borderRadius: 10, border: `1px solid ${S.muted}`, background: 'transparent', color: S.muted, cursor: 'pointer', fontFamily: 'Tajawal, sans-serif' }}>إلغاء</button>
          <button onClick={placeOrder} disabled={saving || cart.length === 0} style={{ flex: 1, padding: '11px', borderRadius: 10, border: 'none', background: cart.length === 0 ? S.card : `linear-gradient(135deg, ${S.gold}, ${S.gold2})`, color: S.navy, cursor: cart.length === 0 ? 'not-allowed' : 'pointer', fontFamily: 'Tajawal, sans-serif', fontWeight: 800, fontSize: 14 }}>
            {saving ? '⏳...' : `✅ إرسال الطلب (${cart.reduce((s, c) => s + c.qty, 0)} صنف)`}
          </button>
        </div>
      </div>
    </div>
  )
}

// ══ Main ══
export default function CashierPage() {
  const sbRef = useRef(createClient())
  const sb = sbRef.current
  const { employee } = useAuth()

  const [orders, setOrders] = useState<Order[]>([])
  const [tables, setTables] = useState<TableRow[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'active' | 'all' | 'done'>('active')
  const [shift, setShift] = useState<'shift1' | 'shift2'>('shift1')
  const [shiftStarted, setShiftStarted] = useState(false)
  const [shiftStart, setShiftStart] = useState<Date | null>(null)
  const [tick, setTick] = useState(0)
  const [notif, setNotif] = useState<string | null>(null)
  const [payOrder, setPayOrder] = useState<Order | null>(null)
  const [addOrderTable, setAddOrderTable] = useState<TableRow | null>(null)
  const [view, setView] = useState<'orders' | 'tables'>('tables')

  const fetchAll = useCallback(async () => {
    const [ordersRes, tablesRes] = await Promise.all([
      sb.from('orders').select(`id,table_id,status,total_amount,discount_amount,discount_type,payment_method,service_charge,sst_amount,shift,notes,created_at,confirmed_at,paid_at,tables(number,name),order_items(id,quantity,unit_price,notes,destination,status,menu_items(name,name_en))`).not('status', 'in', '("pending")').order('created_at', { ascending: false }).limit(100),
      sb.from('tables').select('*').order('number'),
    ])
    setOrders((ordersRes.data as any) || [])
    setTables(tablesRes.data || [])
    setLoading(false)
  }, [sb])

  useEffect(() => { fetchAll() }, [fetchAll])

  useEffect(() => {
    const channel = sb.channel('cashier-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, payload => {
        fetchAll()
        if (payload.eventType === 'INSERT') {
          setNotif('🆕 طلب جديد وصل!')
          setTimeout(() => setNotif(null), 5000)
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, () => fetchAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tables' }, () => fetchAll())
      .subscribe()
    return () => { sb.removeChannel(channel) }
  }, [sb, fetchAll])

  useEffect(() => {
    const t = setInterval(() => setTick(p => p + 1), 1000)
    return () => clearInterval(t)
  }, [])

  async function sendToStation(orderId: string) {
    await sb.from('order_items').update({ status: 'preparing' }).eq('order_id', orderId)
    await sb.from('orders').update({ status: 'preparing' }).eq('id', orderId)
    fetchAll()
  }

  async function updateStatus(orderId: string, status: string) {
    await sb.from('orders').update({ status }).eq('id', orderId)
    fetchAll()
  }

  async function cancelOrder(order: Order) {
    if (!confirm('هل تريد إلغاء هذا الطلب؟')) return
    await sb.from('orders').update({ status: 'cancelled' }).eq('id', order.id)
    await sb.from('tables').update({ status: 'available', current_order_id: null, occupied_since: null }).eq('id', order.table_id)
    fetchAll()
  }

  const filtered = orders.filter(o => {
    const matchShift = o.shift === shift || !o.shift
    const matchFilter = filter === 'active' ? ['confirmed','preparing','ready'].includes(o.status)
      : filter === 'done' ? ['done','paid','cancelled'].includes(o.status)
      : true
    return matchFilter
  })

  const activeCount = orders.filter(o => ['confirmed','preparing','ready'].includes(o.status)).length
  const shiftElapsed = shiftStart ? elapsed(shiftStart.toISOString()) : null

  return (
    <div style={{ fontFamily: 'Tajawal, sans-serif', direction: 'rtl', color: S.white, minHeight: '100vh', background: S.navy }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700;800;900&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        select option { background: #0F2040; color: #FAFAF8; }
      `}</style>

      {/* Notification */}
      {notif && (
        <div style={{ position: 'fixed', top: 80, left: '50%', transform: 'translateX(-50%)', background: S.blue, color: S.white, padding: '12px 24px', borderRadius: 12, fontWeight: 700, fontSize: 14, zIndex: 999, boxShadow: '0 4px 20px rgba(0,0,0,0.4)', whiteSpace: 'nowrap' }}>
          {notif}
        </div>
      )}

      {/* Header */}
      <div style={{ background: S.navy2, borderBottom: `1px solid ${S.border}`, padding: '0 20px', display: 'flex', alignItems: 'center', height: 60, gap: 12, position: 'sticky', top: 0, zIndex: 100, flexWrap: 'wrap' }}>
        <h1 style={{ color: S.gold, fontSize: 17, fontWeight: 900 }}>🏧 الكاشير</h1>

        {/* Shift Control */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <select value={shift} onChange={e => setShift(e.target.value as any)} style={{ background: S.navy3, border: `1px solid ${S.border}`, borderRadius: 8, padding: '5px 10px', color: S.white, fontSize: 12, fontFamily: 'Tajawal, sans-serif', cursor: 'pointer' }}>
            <option value="shift1">شيفت 1</option>
            <option value="shift2">شيفت 2</option>
          </select>
          {!shiftStarted ? (
            <button onClick={() => { setShiftStarted(true); setShiftStart(new Date()) }} style={{ padding: '5px 12px', borderRadius: 8, border: `1px solid ${S.green}`, background: S.greenB, color: S.green, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>▶ بدء الشيفت</button>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, color: S.green, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>⏱ {shiftElapsed}</span>
              <button onClick={() => { setShiftStarted(false); setShiftStart(null) }} style={{ padding: '5px 12px', borderRadius: 8, border: `1px solid ${S.red}`, background: S.redB, color: S.red, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>⏹ إنهاء الشيفت</button>
            </div>
          )}
        </div>

        {activeCount > 0 && (
          <div style={{ background: S.redB, border: `1px solid ${S.red}`, borderRadius: 20, padding: '3px 10px', fontSize: 12, color: S.red, fontWeight: 700 }}>{activeCount} طلب نشط</div>
        )}

        <div style={{ marginRight: 'auto', display: 'flex', gap: 6 }}>
          {/* View Toggle */}
          <button onClick={() => setView('tables')} style={{ padding: '6px 12px', borderRadius: 8, border: `1px solid ${view === 'tables' ? S.gold : S.border}`, background: view === 'tables' ? S.gold3 : 'transparent', color: view === 'tables' ? S.gold : S.muted, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif' }}>🪑 الطاولات</button>
          <button onClick={() => setView('orders')} style={{ padding: '6px 12px', borderRadius: 8, border: `1px solid ${view === 'orders' ? S.gold : S.border}`, background: view === 'orders' ? S.gold3 : 'transparent', color: view === 'orders' ? S.gold : S.muted, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif' }}>📋 الطلبات</button>
        </div>
      </div>

      <div style={{ padding: 16, maxWidth: 1200, margin: '0 auto' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: S.muted }}>⏳ جاري التحميل...</div>
        ) : view === 'tables' ? (
          /* ══ TABLES VIEW ══ */
          <div>
            <div style={{ fontSize: 13, color: S.muted, marginBottom: 16 }}>اضغط على الطاولة لإضافة طلب أو عرض الطلب الحالي</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 12 }}>
              {tables.filter(t => t.is_active).map(table => {
                const activeOrder = orders.find(o => o.table_id === table.id && ['confirmed','preparing','ready'].includes(o.status))
                const status = table.status || 'available'
                const statusColors: Record<string, { color: string; bg: string; border: string }> = {
                  available: { color: S.green, bg: S.greenB, border: S.green + '60' },
                  reserved:  { color: S.amber, bg: S.amberB, border: S.amber + '60' },
                  occupied:  { color: S.red,   bg: S.redB,   border: S.red + '60' },
                }
                const sc = statusColors[status] || statusColors.available
                return (
                  <div key={table.id}
                    onClick={() => activeOrder ? setPayOrder(activeOrder) : setAddOrderTable(table)}
                    style={{ background: sc.bg, border: `2px solid ${sc.border}`, borderRadius: 16, padding: '16px 12px', cursor: 'pointer', textAlign: 'center', transition: 'all .2s', position: 'relative' }}>
                    {/* Table number in circle */}
                    <div style={{ width: 52, height: 52, borderRadius: '50%', background: S.navy2, border: `2px solid ${sc.color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px', fontSize: 20, fontWeight: 900, color: sc.color }}>
                      {table.number}
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: S.white, marginBottom: 4 }}>{table.name || `طاولة ${table.number}`}</div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: sc.color }}>
                      {status === 'available' ? '🟢 فاضية' : status === 'reserved' ? '🟡 محجوزة' : '🔴 مشغولة'}
                    </div>
                    {activeOrder && table.occupied_since && (
                      <div style={{ fontSize: 10, color: S.amber, marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>⏱ {elapsed(table.occupied_since)}</div>
                    )}
                    {activeOrder && (
                      <div style={{ fontSize: 10, color: S.gold, marginTop: 2 }}>MYR {(activeOrder.total_amount || 0).toFixed(2)}</div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ) : (
          /* ══ ORDERS VIEW ══ */
          <div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              {[
                { key: 'active', label: 'النشطة' },
                { key: 'all',    label: 'الكل' },
                { key: 'done',   label: 'المنتهية' },
              ].map(f => (
                <button key={f.key} onClick={() => setFilter(f.key as any)}
                  style={{ padding: '6px 14px', borderRadius: 20, border: `1px solid ${filter === f.key ? S.gold : S.border}`, background: filter === f.key ? S.gold3 : 'transparent', color: filter === f.key ? S.gold : S.muted, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: filter === f.key ? 700 : 400 }}>
                  {f.label}
                </button>
              ))}
            </div>

            {filtered.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 60, color: S.muted }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>🎉</div>
                <div>لا توجد طلبات</div>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
                {filtered.map(order => {
                  const st = STATUS_LABELS[order.status] || STATUS_LABELS['confirmed']
                  const table = tables.find(t => t.id === order.table_id)
                  return (
                    <div key={order.id} style={{ background: S.navy2, borderRadius: 16, border: `1px solid ${order.status === 'confirmed' ? S.blue + '60' : S.border}`, overflow: 'hidden' }}>
                      <div style={{ padding: '14px 16px', borderBottom: `1px solid ${S.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                            <span style={{ color: S.white, fontWeight: 800, fontSize: 15 }}>{order.tables?.name || `طاولة ${order.tables?.number}`}</span>
                            <span style={{ background: st.bg, color: st.color, borderRadius: 8, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>{st.emoji} {st.label}</span>
                          </div>
                          <div style={{ fontSize: 11, color: S.muted }}>#{order.id.slice(-6).toUpperCase()} · منذ {timeAgo(order.created_at)}</div>
                          {table?.occupied_since && ['confirmed','preparing','ready'].includes(order.status) && (
                            <div style={{ fontSize: 11, color: S.amber, marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>⏱ {elapsed(table.occupied_since)}</div>
                          )}
                        </div>
                        <div style={{ textAlign: 'left' }}>
                          <div style={{ color: S.gold, fontWeight: 800, fontSize: 15 }}>MYR {(order.total_amount || 0).toFixed(2)}</div>
                          {order.payment_method && order.status === 'paid' && (
                            <div style={{ fontSize: 10, color: S.teal }}>{order.payment_method === 'cash' ? '💵' : order.payment_method === 'visa' ? '💳' : '📱'} {order.payment_method}</div>
                          )}
                        </div>
                      </div>

                      <div style={{ padding: '10px 16px' }}>
                        {order.order_items.map(i => (
                          <div key={i.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontSize: 12, borderBottom: `1px solid ${S.border}` }}>
                            <span style={{ color: S.white }}>{i.menu_items?.name} <span style={{ color: S.muted }}>×{i.quantity}</span></span>
                            {i.notes && <span style={{ color: S.muted, fontSize: 10 }}>({i.notes})</span>}
                          </div>
                        ))}
                      </div>

                      <div style={{ padding: '10px 16px', borderTop: `1px solid ${S.border}`, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {order.status === 'confirmed' && (
                          <button onClick={() => sendToStation(order.id)} style={{ flex: 1, padding: '9px', borderRadius: 8, border: `1px solid ${S.amber}`, background: S.amberB, color: S.amber, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>👨‍🍳 أرسل للمحطة</button>
                        )}
                        {order.status === 'preparing' && (
                          <button onClick={() => updateStatus(order.id, 'ready')} style={{ flex: 1, padding: '9px', borderRadius: 8, border: `1px solid ${S.green}`, background: S.greenB, color: S.green, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>✅ جاهز</button>
                        )}
                        {['confirmed','preparing','ready'].includes(order.status) && (
                          <button onClick={() => setPayOrder(order)} style={{ flex: 1, padding: '9px', borderRadius: 8, border: `1px solid ${S.gold}`, background: S.gold3, color: S.gold, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>💰 دفع</button>
                        )}
                        {['confirmed','preparing'].includes(order.status) && (
                          <button onClick={() => cancelOrder(order)} style={{ padding: '9px 12px', borderRadius: 8, border: `1px solid ${S.red}`, background: S.redB, color: S.red, cursor: 'pointer', fontSize: 12 }}>❌</button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modals */}
      {payOrder && <PaymentModal order={payOrder} onClose={() => setPayOrder(null)} onPaid={() => { setPayOrder(null); fetchAll() }} />}
      {addOrderTable && <AddOrderModal tableId={addOrderTable.id} tableName={addOrderTable.name || `طاولة ${addOrderTable.number}`} onClose={() => setAddOrderTable(null)} onSaved={() => { setAddOrderTable(null); fetchAll() }} />}
    </div>
  )
}
