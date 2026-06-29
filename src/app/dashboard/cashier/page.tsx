'use client'


import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useAuth } from '../../components/AuthProvider'

// ══ Sound System ══
const ORDER_SOUND_URL = 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3'
const WAITER_SOUND_URL = 'https://assets.mixkit.co/active_storage/sfx/1362/1362-preview.mp3'

// Global AudioContext - shared across calls
let _audioCtx: AudioContext | null = null
function getCtx() {
  if (!_audioCtx || _audioCtx.state === 'closed') {
    _audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
  }
  return _audioCtx
}

function beep(freqs: number[], duration = 0.18) {
  try {
    const ctx = getCtx()
    if (ctx.state === 'suspended') ctx.resume()
    freqs.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain); gain.connect(ctx.destination)
      osc.type = 'sine'; osc.frequency.value = freq
      const t = ctx.currentTime + i * (duration + 0.04)
      gain.gain.setValueAtTime(0.4, t)
      gain.gain.exponentialRampToValueAtTime(0.001, t + duration)
      osc.start(t); osc.stop(t + duration)
    })
  } catch(e) {}
}

const createClient = () => createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const S = {
  navy: '#FFFFFF', navy2: '#FFFFFF', navy3: '#EAF6F4',
  gold: '#14B8A6', gold2: '#2DD4BF', gold3: 'rgba(20,184,166,0.12)', goldB: 'rgba(20,184,166,0.22)',
  white: '#0B2B33', muted: '#6B8389', border: 'rgba(15,60,60,0.12)',
  green: '#22C55E', greenB: 'rgba(34,197,94,0.12)',
  red: '#EF4444', redB: 'rgba(239,68,68,0.12)',
  blue: '#3B82F6', blueB: 'rgba(59,130,246,0.12)',
  amber: '#F59E0B', amberB: 'rgba(245,158,11,0.12)',
  teal: '#14B8A6', tealB: 'rgba(20,184,166,0.12)',
  purple: '#8B5CF6', purpleB: 'rgba(139,92,246,0.12)',
  card: '#F2F9F8', card2: '#E6F4F2',
  pageBg: '#F4FAF9',
}

const SERVICE_CHARGE_RATE = 0.10
const SST_RATE = 0.06

type TableRow = { id: string; number: number; name: string; status: string; is_active: boolean; branch_id?: string; occupied_since?: string | null; current_order_id?: string | null }
type OrderItem = { id: string; quantity: number; unit_price: number; notes: string; destination: string; status: string; menu_items: { name: string; name_en: string } }
type Order = {
  id: string; table_id: string; status: string; total_amount: number
  discount_amount: number; discount_type: string; payment_method: string
  service_charge: number; sst_amount: number; shift: string
  notes: string; created_at: string; confirmed_at: string; paid_at?: string
  tables: { number: number; name: string }
  order_items: OrderItem[]
}
type MenuItem = { id: string; name: string; name_en: string; price: number; category_id: string; menu_categories?: { name: string } | { name: string }[] }
type Category = { id: string; name: string; name_en: string }

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string; emoji: string }> = {
  confirmed:  { label: 'New',        color: S.blue,   bg: S.blueB,   emoji: '🆕' },
  preparing:  { label: 'Preparing', color: S.amber,  bg: S.amberB,  emoji: '👨‍🍳' },
  ready:      { label: 'Ready',        color: S.green,  bg: S.greenB,  emoji: '✅' },
  done:       { label: 'Delivered',      color: S.muted,  bg: S.card,    emoji: '📦' },
  paid:       { label: 'Paid',       color: S.teal,   bg: S.tealB,   emoji: '💰' },
  cancelled:  { label: 'Cancelled',        color: S.red,    bg: S.redB,    emoji: '❌' },
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
  const [customers, setCustomers] = useState<any[]>([])
  const [customerSearch, setCustomerSearch] = useState('')
  const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null)
  const [showCustomerDrop, setShowCustomerDrop] = useState(false)

  useEffect(() => {
    sb.from('customers').select('id,name,phone,email,loyalty_points').order('name').limit(200)
      .then(({ data }) => setCustomers(data || []))
  }, [])

  const filteredCustomers = customers.filter(c =>
    !customerSearch ||
    c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
    c.phone?.includes(customerSearch) ||
    c.email?.toLowerCase().includes(customerSearch.toLowerCase())
  ).slice(0, 8)

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

    // 1. Mark all active orders for this table as paid
    await sb.from('orders').update({
      status: 'paid',
      payment_method: discountType === 'free' ? 'free' : method,
      discount_amount: discountAmt,
      discount_type: discountType === 'free' ? 'free' : discountType,
      service_charge: serviceCharge,
      sst_amount: sst,
      total_amount: total,
      paid_at: new Date().toISOString(),
      customer_id: selectedCustomer?.id || null,
    }).eq('table_id', order.table_id).in('status', ['confirmed','preparing','ready'])

    // 2. Reset table to available
    await sb.from('tables').update({
      status: 'available',
      current_order_id: null,
      occupied_since: null,
    }).eq('id', order.table_id)

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
    <div class="row"><span>${i.menu_items?.name_en || i.menu_items?.name} ×${i.quantity}</span><span>MYR ${(i.unit_price * i.quantity).toFixed(2)}</span></div>
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

  const inp: React.CSSProperties = { background: '#F4FAF9', border: '1px solid rgba(15,60,60,0.15)', borderRadius: 10, padding: '9px 14px', fontSize: 13, color: S.white, outline: 'none', fontFamily: 'Tajawal, sans-serif', width: '100%', boxSizing: 'border-box' as const }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 400, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 20, overflowY: 'auto' }}>
      <div style={{ background: S.navy2, borderRadius: 20, border: `1px solid ${S.border}`, width: '100%', maxWidth: 480, padding: 28, margin: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ color: S.white, fontSize: 18, fontWeight: 800 }}>💰 Settle Bill</h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: S.muted, fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>

        {/* Order Summary */}
        <div style={{ background: S.card, borderRadius: 12, padding: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: S.muted, marginBottom: 10 }}>{order.tables?.name || `Table ${order.tables?.number}`} · #{order.id.slice(-6).toUpperCase()}</div>
          {order.order_items.map(i => (
            <div key={i.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: `1px solid ${S.border}`, fontSize: 13 }}>
              <span style={{ color: S.white }}>{i.menu_items?.name_en || i.menu_items?.name} <span style={{ color: S.muted }}>×{i.quantity}</span></span>
              <span style={{ color: S.gold }}>MYR {(i.unit_price * i.quantity).toFixed(2)}</span>
            </div>
          ))}
        </div>

        {/* Customer Selector */}
        <div style={{ marginBottom: 16, position: 'relative' }}>
          <div style={{ fontSize: 12, color: S.muted, marginBottom: 8 }}>👤 Customer (optional — for loyalty points)</div>
          {selectedCustomer ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: S.greenB, border: `1px solid ${S.green}40`, borderRadius: 10, padding: '10px 14px' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: S.white }}>{selectedCustomer.name}</div>
                <div style={{ fontSize: 11, color: S.muted }}>{selectedCustomer.phone || selectedCustomer.email} · 🎁 {selectedCustomer.loyalty_points} pts</div>
              </div>
              <button onClick={() => setSelectedCustomer(null)} style={{ background: 'transparent', border: 'none', color: S.red, cursor: 'pointer', fontSize: 16 }}>✕</button>
            </div>
          ) : (
            <div style={{ position: 'relative' }}>
              <input style={{ ...inp }}
                placeholder="🔍 Search customer by name, phone, email..."
                value={customerSearch}
                onChange={e => { setCustomerSearch(e.target.value); setShowCustomerDrop(true) }}
                onFocus={() => setShowCustomerDrop(true)}
              />
              {showCustomerDrop && customerSearch && filteredCustomers.length > 0 && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: S.navy2, border: `1px solid ${S.border}`, borderRadius: 10, zIndex: 100, marginTop: 4, maxHeight: 200, overflowY: 'auto' }}>
                  {filteredCustomers.map(c => (
                    <div key={c.id}
                      onClick={() => { setSelectedCustomer(c); setCustomerSearch(''); setShowCustomerDrop(false) }}
                      style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: `1px solid ${S.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#EEF7F6'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: S.white }}>{c.name}</div>
                        <div style={{ fontSize: 11, color: S.muted }}>{c.phone || c.email}</div>
                      </div>
                      <div style={{ fontSize: 11, color: S.gold }}>🎁 {c.loyalty_points} pts</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          {selectedCustomer && (
            <div style={{ fontSize: 11, color: S.green, marginTop: 6 }}>
              ✅ Will earn {Math.floor(total / 100)} points after payment (MYR 100 = 1 point)
            </div>
          )}
        </div>

        {/* Discount */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: S.muted, marginBottom: 8 }}>Discount</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 10 }}>
            {[
              { k: 'none', label: 'None' },
              { k: 'amount', label: 'Amount' },
              { k: 'percent', label: '%' },
              { k: 'free', label: '🎁 Free' },
            ].map(d => (
              <button key={d.k} onClick={() => setDiscountType(d.k as any)}
                style={{ padding: '8px', borderRadius: 8, border: `1px solid ${discountType === d.k ? S.amber : S.border}`, background: discountType === d.k ? S.amberB : 'transparent', color: discountType === d.k ? S.amber : S.muted, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', fontWeight: discountType === d.k ? 700 : 400 }}>
                {d.label}
              </button>
            ))}
          </div>
          {(discountType === 'amount' || discountType === 'percent') && (
            <input style={inp} type="number" value={discountValue} onChange={e => setDiscountValue(e.target.value)}
              placeholder={discountType === 'percent' ? 'Discount %' : 'Amount Discount MYR'} />
          )}
        </div>

        {/* Payment Method */}
        {discountType !== 'free' && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, color: S.muted, marginBottom: 8 }}>Payment Method</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {[
                { k: 'cash', label: '💵 Cash', color: S.green },
                { k: 'visa', label: '💳 Visa', color: S.blue },
                { k: 'online', label: '📱 Online', color: S.purple },
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
            { label: 'Subtotal', value: subtotal, color: S.white },
            discountAmt > 0 ? { label: 'Discount', value: -discountAmt, color: S.red } : null,
            discountType !== 'free' ? { label: 'Service Charge (10%)', value: serviceCharge, color: S.muted } : null,
            discountType !== 'free' ? { label: 'SST 6%', value: sst, color: S.muted } : null,
          ].filter(Boolean).map((row, i) => row && (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: 13 }}>
              <span style={{ color: S.muted }}>{row.label}</span>
              <span style={{ color: row.color }}>{row.value < 0 ? '- ' : ''}MYR {Math.abs(row.value).toFixed(2)}</span>
            </div>
          ))}
          <div style={{ borderTop: `1px solid ${S.border}`, marginTop: 10, paddingTop: 10, display: 'flex', justifyContent: 'space-between', fontSize: 18, fontWeight: 900 }}>
            <span style={{ color: S.white }}>Total</span>
            <span style={{ color: S.gold }}>MYR {total.toFixed(2)}</span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={printReceipt} style={{ padding: '12px 18px', borderRadius: 12, border: `1px solid ${S.blue}`, background: S.blueB, color: S.blue, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>🖨️ Print</button>
          <button onClick={pay} disabled={saving} style={{ flex: 1, padding: '12px', borderRadius: 12, border: 'none', background: `linear-gradient(135deg, ${S.gold}, ${S.gold2})`, color: S.navy, cursor: 'pointer', fontSize: 15, fontFamily: 'Tajawal, sans-serif', fontWeight: 800, opacity: saving ? 0.7 : 1 }}>
            {saving ? '⏳...' : discountType === 'free' ? '🎁 Complimentaryة' : '✅ Confirm Payment'}
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

  const inp: React.CSSProperties = { background: '#F4FAF9', border: '1px solid rgba(15,60,60,0.15)', borderRadius: 10, padding: '8px 12px', fontSize: 12, color: S.white, outline: 'none', fontFamily: 'Tajawal, sans-serif', width: '100%', boxSizing: 'border-box' as const }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 400, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 20, overflowY: 'auto' }}>
      <div style={{ background: S.navy2, borderRadius: 20, border: `1px solid ${S.border}`, width: '100%', maxWidth: 700, padding: 24, margin: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ color: S.white, fontSize: 16, fontWeight: 800 }}>➕ Add Order — {tableName}</h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: S.muted, fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>
        <input style={inp} placeholder="🔍 Search..." value={search} onChange={e => setSearch(e.target.value)} />
        <div style={{ display: 'flex', gap: 6, marginTop: 10, marginBottom: 12, overflowX: 'auto' }}>
          <button onClick={() => setSelectedCat('all')} style={{ padding: '5px 12px', borderRadius: 20, border: `1px solid ${selectedCat === 'all' ? S.gold : S.border}`, background: selectedCat === 'all' ? S.gold3 : 'transparent', color: selectedCat === 'all' ? S.gold : S.muted, cursor: 'pointer', fontSize: 11, whiteSpace: 'nowrap', fontFamily: 'Tajawal, sans-serif' }}>All</button>
          {categories.map(c => (
            <button key={c.id} onClick={() => setSelectedCat(c.id)} style={{ padding: '5px 12px', borderRadius: 20, border: `1px solid ${selectedCat === c.id ? S.gold : S.border}`, background: selectedCat === c.id ? S.gold3 : 'transparent', color: selectedCat === c.id ? S.gold : S.muted, cursor: 'pointer', fontSize: 11, whiteSpace: 'nowrap', fontFamily: 'Tajawal, sans-serif' }}>{c.name}</button>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 8, maxHeight: 300, overflowY: 'auto', marginBottom: 16 }}>
          {filtered.map(item => {
            const qty = cart.find(c => c.item.id === item.id)?.qty || 0
            return (
              <div key={item.id} style={{ background: qty > 0 ? S.gold3 : S.card, border: `1px solid ${qty > 0 ? S.gold : S.border}`, borderRadius: 10, padding: 10, cursor: 'pointer' }} onClick={() => addItem(item)}>
                <div style={{ fontSize: 12, fontWeight: 700, color: S.white, marginBottom: 4 }}>{item.name_en || item.name}</div>
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
                <input style={{ ...inp, fontSize: 11 }} placeholder="Note..." value={c.notes} onChange={e => setCart(p => p.map(ci => ci.item.id === c.item.id ? { ...ci, notes: e.target.value } : ci))} />
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 15, marginTop: 10, paddingTop: 10, borderTop: `1px solid ${S.border}` }}>
              <span style={{ color: S.white }}>Total</span>
              <span style={{ color: S.gold }}>MYR {total.toFixed(2)}</span>
            </div>
          </div>
        )}
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ padding: '11px 20px', borderRadius: 10, border: `1px solid ${S.muted}`, background: 'transparent', color: S.muted, cursor: 'pointer', fontFamily: 'Tajawal, sans-serif' }}>Cancel</button>
          <button onClick={placeOrder} disabled={saving || cart.length === 0} style={{ flex: 1, padding: '11px', borderRadius: 10, border: 'none', background: cart.length === 0 ? S.card : `linear-gradient(135deg, ${S.gold}, ${S.gold2})`, color: S.navy, cursor: cart.length === 0 ? 'not-allowed' : 'pointer', fontFamily: 'Tajawal, sans-serif', fontWeight: 800, fontSize: 14 }}>
            {saving ? '⏳...' : `✅ Place Order (${cart.reduce((s, c) => s + c.qty, 0)} items)`}
          </button>
        </div>
      </div>
    </div>
  )
}


// ══ Shift Report Modal ══
function ShiftReportModal({ orders, shift, shiftStart, fetchPaid, onClose }: { orders: Order[]; shift: string; shiftStart: Date | null; fetchPaid: () => Promise<Order[]>; onClose: () => void }) {
  const [paidOrders, setPaidOrders] = useState<Order[]>([])
  useEffect(() => { fetchPaid().then(setPaidOrders) }, [])
  const shiftOrders = paidOrders
  const totalCash   = shiftOrders.filter(o => o.payment_method === 'cash').reduce((s, o) => s + (o.total_amount || 0), 0)
  const totalVisa   = shiftOrders.filter(o => o.payment_method === 'visa').reduce((s, o) => s + (o.total_amount || 0), 0)
  const totalOnline = shiftOrders.filter(o => o.payment_method === 'online').reduce((s, o) => s + (o.total_amount || 0), 0)
  const totalFree   = shiftOrders.filter(o => o.payment_method === 'free').length
  const grandTotal  = shiftOrders.reduce((s, o) => s + (o.total_amount || 0), 0)
  const totalService = shiftOrders.reduce((s, o) => s + (o.service_charge || 0), 0)
  const totalSST    = shiftOrders.reduce((s, o) => s + (o.sst_amount || 0), 0)
  const totalDiscount = shiftOrders.reduce((s, o) => s + (o.discount_amount || 0), 0)
  const now = new Date()

  function printShiftReport() {
    const win = window.open('', '_blank')
    if (!win) return
    const rows = shiftOrders.map((o, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${o.tables?.name || 'Table ' + o.tables?.number}</td>
        <td>#${o.id.slice(-6).toUpperCase()}</td>
        <td>${o.order_items?.map(i => (i.menu_items?.name_en || i.menu_items?.name) + ' ×' + i.quantity).join(', ')}</td>
        <td>${o.payment_method?.toUpperCase() || '—'}</td>
        <td>${o.discount_amount > 0 ? 'MYR ' + o.discount_amount.toFixed(2) : '—'}</td>
        <td>${o.service_charge > 0 ? 'MYR ' + o.service_charge.toFixed(2) : '—'}</td>
        <td>${o.sst_amount > 0 ? 'MYR ' + o.sst_amount.toFixed(2) : '—'}</td>
        <td><b>MYR ${(o.total_amount || 0).toFixed(2)}</b></td>
        <td>${o.paid_at ? new Date(o.paid_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
      </tr>`).join('')

    win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
    <title>Shift Report — ${shift} — ${now.toLocaleDateString('en-GB')}</title>
    <style>
      body { font-family: Arial, sans-serif; font-size: 11px; margin: 15px; color: #000; }
      h2 { text-align: center; font-size: 16px; margin-bottom: 4px; }
      h3 { text-align: center; font-size: 12px; color: #555; margin-bottom: 14px; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
      th { background: #0A1628; color: #fff; padding: 6px 8px; text-align: left; font-size: 10px; }
      td { padding: 5px 8px; border-bottom: 1px solid #ddd; font-size: 10px; }
      tr:nth-child(even) { background: #f9f9f9; }
      .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-top: 16px; }
      .summary-box { border: 1px solid #ddd; border-radius: 8px; padding: 10px; text-align: center; }
      .summary-box .label { font-size: 10px; color: #666; margin-bottom: 4px; }
      .summary-box .value { font-size: 16px; font-weight: bold; color: #000; }
      .total-row { background: #C9A84C !important; font-weight: bold; color: #000; }
      @media print { @page { size: A4 landscape; margin: 10mm; } }
    </style></head><body>
    <h2>🌸 Orchid House — Shift Report</h2>
    <h3>${shift === 'shift1' ? 'Shift 1' : 'Shift 2'} · ${now.toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
    ${shiftStart ? ' · Started: ' + shiftStart.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : ''}
    · Closed: ${now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</h3>
    <table>
      <thead><tr>
        <th>#</th><th>Table</th><th>Order #</th><th>Items</th>
        <th>Payment</th><th>Discount</th><th>Service</th><th>SST</th>
        <th>Total</th><th>Time</th>
      </tr></thead>
      <tbody>${rows}
        <tr class="total-row">
          <td colspan="5">TOTAL — ${shiftOrders.length} orders</td>
          <td>MYR ${totalDiscount.toFixed(2)}</td>
          <td>MYR ${totalService.toFixed(2)}</td>
          <td>MYR ${totalSST.toFixed(2)}</td>
          <td>MYR ${grandTotal.toFixed(2)}</td>
          <td>—</td>
        </tr>
      </tbody>
    </table>
    <div class="summary">
      <div class="summary-box"><div class="label">💵 Cash</div><div class="value">MYR ${totalCash.toFixed(2)}</div></div>
      <div class="summary-box"><div class="label">💳 Visa</div><div class="value">MYR ${totalVisa.toFixed(2)}</div></div>
      <div class="summary-box"><div class="label">📱 Online</div><div class="value">MYR ${totalOnline.toFixed(2)}</div></div>
      <div class="summary-box"><div class="label">🎁 Complimentary</div><div class="value">${totalFree} orders</div></div>
    </div>
    <script>window.onload=()=>window.print()<\/script>
    </body></html>`)
    win.document.close()
  }

  const thStyle: React.CSSProperties = { padding: '8px 12px', fontSize: 11, color: '#fff', background: S.navy3, border: `1px solid ${S.border}`, textAlign: 'left' as const }
  const tdStyle: React.CSSProperties = { padding: '8px 12px', fontSize: 12, color: S.white, borderBottom: `1px solid ${S.border}` }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 500, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 20, overflowY: 'auto' }}>
      <div style={{ background: S.navy2, borderRadius: 20, border: `1px solid ${S.border}`, width: '100%', maxWidth: 900, padding: 28, margin: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <h2 style={{ color: S.white, fontSize: 18, fontWeight: 800, marginBottom: 4 }}>📊 Shift Report</h2>
            <p style={{ fontSize: 12, color: S.muted }}>{shift === 'shift1' ? 'Shift 1' : 'Shift 2'} · {new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={printShiftReport} style={{ padding: '10px 18px', borderRadius: 10, border: `1px solid ${S.blue}`, background: S.blueB, color: S.blue, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>🖨️ Print</button>
            <button onClick={onClose} style={{ padding: '10px 18px', borderRadius: 10, border: `1px solid ${S.red}`, background: S.redB, color: S.red, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>⏹ End Shift</button>
          </div>
        </div>

        {/* Summary Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12, marginBottom: 20 }}>
          {[
            { label: 'Total Orders', value: shiftOrders.length, color: S.white, icon: '📋' },
            { label: 'Grand Total', value: `MYR ${grandTotal.toFixed(2)}`, color: S.gold, icon: '💰' },
            { label: 'Cash', value: `MYR ${totalCash.toFixed(2)}`, color: S.green, icon: '💵' },
            { label: 'Visa', value: `MYR ${totalVisa.toFixed(2)}`, color: S.blue, icon: '💳' },
            { label: 'Online', value: `MYR ${totalOnline.toFixed(2)}`, color: S.purple, icon: '📱' },
            { label: 'Discount', value: `MYR ${totalDiscount.toFixed(2)}`, color: S.red, icon: '🏷️' },
            { label: 'Service 10%', value: `MYR ${totalService.toFixed(2)}`, color: S.amber, icon: '⚡' },
            { label: 'SST 6%', value: `MYR ${totalSST.toFixed(2)}`, color: S.teal, icon: '🧾' },
          ].map((s, i) => (
            <div key={i} style={{ background: S.card, borderRadius: 12, padding: '12px 14px', border: `1px solid ${S.border}` }}>
              <div style={{ fontSize: 11, color: S.muted, marginBottom: 4 }}>{s.icon} {s.label}</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Orders Table */}
        <div style={{ background: S.navy3, borderRadius: 12, overflow: 'hidden', border: `1px solid ${S.border}` }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
              <thead>
                <tr>
                  {['#', 'Table', 'Order #', 'Payment', 'Discount', 'Service', 'SST', 'Total', 'Time'].map(h => (
                    <th key={h} style={thStyle}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {shiftOrders.map((o, i) => (
                  <tr key={o.id} style={{ background: i % 2 === 0 ? 'transparent' : '#F6FBFA' }}>
                    <td style={tdStyle}>{i + 1}</td>
                    <td style={tdStyle}>{o.tables?.name || 'Table ' + o.tables?.number}</td>
                    <td style={{ ...tdStyle, color: S.gold }}>#{o.id.slice(-6).toUpperCase()}</td>
                    <td style={tdStyle}>
                      <span style={{ background: o.payment_method === 'cash' ? S.greenB : o.payment_method === 'visa' ? S.blueB : o.payment_method === 'free' ? S.amberB : S.purpleB, color: o.payment_method === 'cash' ? S.green : o.payment_method === 'visa' ? S.blue : o.payment_method === 'free' ? S.amber : S.purple, borderRadius: 20, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>
                        {o.payment_method?.toUpperCase() || '—'}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, color: S.red }}>{o.discount_amount > 0 ? `MYR ${o.discount_amount.toFixed(2)}` : '—'}</td>
                    <td style={{ ...tdStyle, color: S.amber }}>{o.service_charge > 0 ? `MYR ${o.service_charge.toFixed(2)}` : '—'}</td>
                    <td style={{ ...tdStyle, color: S.teal }}>{o.sst_amount > 0 ? `MYR ${o.sst_amount.toFixed(2)}` : '—'}</td>
                    <td style={{ ...tdStyle, color: S.gold, fontWeight: 800 }}>MYR {(o.total_amount || 0).toFixed(2)}</td>
                    <td style={{ ...tdStyle, color: S.muted }}>{o.paid_at ? new Date(o.paid_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                  </tr>
                ))}
                {shiftOrders.length === 0 && (
                  <tr><td colSpan={9} style={{ ...tdStyle, textAlign: 'center', color: S.muted, padding: 30 }}>No paid orders in this shift</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

// ══ Main ══
export default function CashierPage() {
  const sbRef = useRef(createClient())
  const sb = sbRef.current
  const { employee, permissions } = useAuth()
  const isAdmin = permissions?.all === true

  const [orders, setOrders] = useState<Order[]>([])
  const [tables, setTables] = useState<TableRow[]>([])
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([])
  const tablesRef = useRef<TableRow[]>([])
  useEffect(() => { tablesRef.current = tables }, [tables])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'active' | 'all' | 'done'>('active')
  const [shift, setShift] = useState<'shift1' | 'shift2'>('shift1')
  const [shiftStarted, setShiftStarted] = useState(false)
  const [shiftStart, setShiftStart] = useState<Date | null>(null)
  const [shiftOrders, setShiftOrders] = useState<Order[]>([])
  const [showShiftReport, setShowShiftReport] = useState(false)
  const [soundEnabled, setSoundEnabled] = useState(false)


  // Init notifications + restore sound state
  useEffect(() => {
    if (localStorage.getItem('cashier_sound') === '1') setSoundEnabled(true)
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [])

  // Load branches (for admin grouping labels)
  useEffect(() => {
    sb.from('branches').select('id,name').eq('is_active', true).order('name')
      .then(({ data }) => setBranches(data || []))
  }, [])

  // Polling for waiter calls every 5s
  useEffect(() => {
    let lastId = ''
    const interval = setInterval(async () => {
      const { data } = await sb.from('waiter_calls')
        .select('id,table_id,created_at')
        .order('created_at', { ascending: false })
        .limit(1)
      if (data?.[0]) {
        const isNew = new Date(data[0].created_at) > new Date(Date.now() - 8000)
        if (isNew && lastId !== '' && data[0].id !== lastId) {
          const { data: tbl } = await sb.from('tables').select('name,number').eq('id', data[0].table_id).single()
          const name = tbl?.name || `Table ${tbl?.number || ''}`
          setNotif(`🔔 Waiter called — ${name}!`)
          setTimeout(() => setNotif(null), 8000)
          playSound('waiter')
          sendNotification('🔔 Waiter Call!', `${name} is calling`)
        }
        lastId = data[0].id
      }
    }, 4000)
    return () => clearInterval(interval)
  }, [sb])

  function sendNotification(title: string, body: string) {
    try {
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(title, { body, icon: '/favicon.ico' })
      }
    } catch(e) {}
  }

  function playSound(type: 'order' | 'waiter') {
    if (type === 'order') beep([880, 1100])
    else beep([660, 880, 1100])
  }

  // Restore shift from localStorage
  useEffect(() => {
    const active = localStorage.getItem('cashier_shift_active')
    const start  = localStorage.getItem('cashier_shift_start')
    const sv     = localStorage.getItem('cashier_shift_value')
    if (active === 'true' && start) {
      setShiftStarted(true)
      setShiftStart(new Date(start))
    }
    if (sv) setShift(sv as 'shift1' | 'shift2')
  }, [])
  const [tick, setTick] = useState(0)
  const [notif, setNotif] = useState<string | null>(null)
  const [newOrderAlert, setNewOrderAlert] = useState<{ tableName: string; itemsCount: number; total: number } | null>(null)
  const [payOrder, setPayOrder] = useState<Order | null>(null)
  const [addOrderTable, setAddOrderTable] = useState<TableRow | null>(null)
  const [view, setView] = useState<'orders' | 'tables'>('tables')
  const [adminBranchFilter, setAdminBranchFilter] = useState<string>('')

  // أول ما الفروع توصل، الأدمن يبدأ بأول فرع تلقائيًا
  useEffect(() => {
    if (isAdmin && branches.length > 0 && !adminBranchFilter) setAdminBranchFilter(branches[0].id)
  }, [isAdmin, branches, adminBranchFilter])

  const fetchAll = useCallback(async () => {
    const SEL = `id,table_id,status,total_amount,discount_amount,discount_type,payment_method,service_charge,sst_amount,shift,notes,created_at,confirmed_at,paid_at,tables(number,name),order_items(id,quantity,unit_price,notes,destination,status,menu_items(name,name_en))`
    let tablesQuery = sb.from('tables').select('*').order('number')
    // ✅ غير الأدمن يشوف بس طاولات فرعه
    if (!isAdmin && employee?.branch_id) tablesQuery = tablesQuery.eq('branch_id', employee.branch_id)
    const [activeRes, tablesRes] = await Promise.all([
      sb.from('orders').select(SEL).in('status', ['confirmed','preparing','ready']).order('created_at', { ascending: false }).limit(100),
      tablesQuery,
    ])
    const allowedTables = tablesRes.data || []
    const allowedTableIds = new Set(allowedTables.map((t: any) => t.id))
    // ✅ غير الأدمن: نستثني طلبات الفروع التانية حتى لو رجعت في نفس الاستعلام (orders مفيهاش branch_id مباشر)
    const filteredOrders = isAdmin
      ? (activeRes.data as any) || []
      : ((activeRes.data as any) || []).filter((o: any) => allowedTableIds.has(o.table_id))
    setOrders(filteredOrders)
    setTables(allowedTables)
    setLoading(false)
  }, [sb, isAdmin, employee?.branch_id])

  // Separate fetch for shift report (paid orders)
  const fetchPaidOrders = useCallback(async () => {
    const SEL = `id,table_id,status,total_amount,discount_amount,discount_type,payment_method,service_charge,sst_amount,shift,notes,created_at,confirmed_at,paid_at,tables(number,name),order_items(id,quantity,unit_price,notes,destination,status,menu_items(name,name_en))`
    const { data } = await sb.from('orders').select(SEL).eq('status', 'paid').order('paid_at', { ascending: false }).limit(200)
    return (data as any) || []
  }, [sb])

  useEffect(() => { fetchAll() }, [fetchAll])

  useEffect(() => {
    const channel = sb.channel('cashier-rt')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, async (payload: any) => {
        fetchAll()
        const tableId = payload.new?.table_id
        const tbl = tablesRef.current.find(t => t.id === tableId)
        let tableName = tbl?.name || (tbl?.number ? `Table ${tbl.number}` : 'New Table')
        let itemsCount = 0
        // لو الطاولة لسه مش في الـ state المحلي (طلب جاي قبل أول fetch)، نجيب اسمها من القاعدة مباشرة
        if (!tbl && tableId) {
          const { data: tblData } = await sb.from('tables').select('name,number').eq('id', tableId).single()
          if (tblData) tableName = tblData.name || `Table ${tblData.number}`
        }
        const { data: itemsData } = await sb.from('order_items').select('id').eq('order_id', payload.new?.id)
        itemsCount = itemsData?.length || 0
        setNewOrderAlert({ tableName, itemsCount, total: payload.new?.total_amount || 0 })
        setTimeout(() => setNewOrderAlert(null), 7000)
        setNotif('🆕 New order received!')
        setTimeout(() => setNotif(null), 5000)
        playSound('order')
        sendNotification('🆕 New Order!', `${tableName} — ${itemsCount} item(s)`)
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, payload => {
        const newStatus = (payload.new as any)?.status
        // لو الطلب اتدفع مش نعمل fetchAll عشان متبقاش حمرا
        if (newStatus !== 'paid') fetchAll()
      })

      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'waiter_calls' }, async (payload: any) => {
        const { data: tblData } = await sb.from('tables').select('name,number').eq('id', payload.new?.table_id).single()
        const tblName = tblData?.name || `Table ${tblData?.number}` || 'Table'
        setNotif(`🔔 Waiter called — ${tblName}!`)
        setTimeout(() => setNotif(null), 6000)
        playSound('waiter')
        sendNotification('🔔 Waiter Call!', `${tblName} is calling for a waiter`)
      })
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
    if (!confirm('Are you sure you want to cancel this order?')) return
    // إلغاء كل الطلبات النشطة للطاولة
    await sb.from('orders').update({ status: 'cancelled' }).eq('table_id', order.table_id).in('status', ['confirmed','preparing','ready'])
    await sb.from('tables').update({ status: 'available', current_order_id: null, occupied_since: null, reserved_at: null }).eq('id', order.table_id)
    fetchAll()
  }

  // ✅ إحصائية حالة الطاولات — للفرع المختار (الأدمن يختار من التابات، غير الأدمن مفلتر على فرعه already)
  const activeTables = tables.filter(t => t.is_active)
  const displayedTables = (isAdmin && adminBranchFilter) ? activeTables.filter(t => t.branch_id === adminBranchFilter) : activeTables
  const displayedTableIds = new Set(displayedTables.map(t => t.id))
  function computeBranchStats(tblList: TableRow[]) {
    const occupied  = tblList.filter(t => orders.some(o => o.table_id === t.id && ['confirmed','preparing','ready'].includes(o.status))).length
    const reserved  = tblList.filter(t => t.status === 'reserved' && !orders.some(o => o.table_id === t.id && ['confirmed','preparing','ready'].includes(o.status))).length
    const available = tblList.length - occupied - reserved
    return { total: tblList.length, occupied, available, reserved }
  }
  const tableStats = computeBranchStats(displayedTables)
  const currentBranchName = isAdmin ? (branches.find(b => b.id === adminBranchFilter)?.name || '') : ''

  const filtered = orders.filter(o => {
    const matchFilter = filter === 'active' ? ['confirmed','preparing','ready'].includes(o.status)
      : filter === 'done' ? ['done','paid','cancelled'].includes(o.status)
      : !['paid'].includes(o.status)
    const matchBranch = !isAdmin || displayedTableIds.has(o.table_id)
    return matchFilter && matchBranch
  })

  const activeCount = orders.filter(o => ['confirmed','preparing','ready'].includes(o.status) && (!isAdmin || displayedTableIds.has(o.table_id))).length
  const shiftElapsed = shiftStart ? elapsed(shiftStart.toISOString()) : null

  return (
    <div style={{ fontFamily: 'Tajawal, sans-serif', direction: 'ltr', color: S.white, minHeight: '100vh', background: S.pageBg }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700;800;900&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        select option { background: #FFFFFF; color: #0B2B33; }
        @keyframes popIn { from { opacity: 0; transform: scale(0.85); } to { opacity: 1; transform: scale(1); } }
      `}</style>

      {/* Notification (top banner — waiter calls etc.) */}
      {notif && (
        <div style={{ position: 'fixed', top: 80, left: '50%', transform: 'translateX(-50%)', background: S.blue, color: S.white, padding: '12px 24px', borderRadius: 12, fontWeight: 700, fontSize: 14, zIndex: 999, boxShadow: '0 4px 20px rgba(0,0,0,0.4)', whiteSpace: 'nowrap' }}>
          {notif}
        </div>
      )}

      {/* New Order Center Alert */}
      {newOrderAlert && (
        <div onClick={() => setNewOrderAlert(null)}
          style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(10,22,40,0.6)', backdropFilter: 'blur(2px)', cursor: 'pointer' }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: S.navy2, border: `2px solid ${S.gold}`, borderRadius: 24, padding: '36px 48px', textAlign: 'center', boxShadow: '0 12px 50px rgba(0,0,0,0.55)', animation: 'popIn .25s ease-out', minWidth: 280 }}>
            <div style={{ fontSize: 52, marginBottom: 10 }}>🆕</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: S.gold, marginBottom: 8 }}>New Order!</div>
            <div style={{ fontSize: 17, fontWeight: 700, color: S.white, marginBottom: 4 }}>{newOrderAlert.tableName}</div>
            <div style={{ fontSize: 13, color: S.muted, marginBottom: 18 }}>{newOrderAlert.itemsCount} item(s) · MYR {newOrderAlert.total.toFixed(2)}</div>
            <button onClick={() => setNewOrderAlert(null)}
              style={{ padding: '10px 28px', borderRadius: 10, border: 'none', background: `linear-gradient(135deg, ${S.gold}, ${S.gold2})`, color: S.navy, cursor: 'pointer', fontSize: 14, fontFamily: 'Tajawal, sans-serif', fontWeight: 800 }}>
              OK
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ background: S.navy2, borderBottom: `1px solid ${S.border}`, padding: '10px 16px', zIndex: 10 }}>
        {/* Row 1 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <h1 style={{ color: S.gold, fontSize: 17, fontWeight: 900 }}>🏧 Cashier</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={() => {
              try {
                const ctx = getCtx()
                ctx.resume().then(() => {
                  beep([880, 1100])
                  setSoundEnabled(true)
                  localStorage.setItem('cashier_sound','1')
                })
              } catch(e) {}
            }}
              style={{ padding: '5px 10px', borderRadius: 8, border: `1px solid ${soundEnabled ? S.green : S.amber}`, background: soundEnabled ? S.greenB : S.amberB, color: soundEnabled ? S.green : S.amber, cursor: 'pointer', fontSize: 11, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
              {soundEnabled ? '🔊 Sound On' : '🔔 Enable Sound'}
            </button>
            {activeCount > 0 && (
              <div style={{ background: S.redB, border: `1px solid ${S.red}`, borderRadius: 20, padding: '3px 10px', fontSize: 12, color: S.red, fontWeight: 700 }}>{activeCount} active</div>
            )}
            <button onClick={() => setView('tables')} style={{ padding: '6px 12px', borderRadius: 8, border: `1px solid ${view === 'tables' ? S.gold : S.border}`, background: view === 'tables' ? S.gold3 : 'transparent', color: view === 'tables' ? S.gold : S.muted, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif' }}>🪑 Tables</button>
            <button onClick={() => setView('orders')} style={{ padding: '6px 12px', borderRadius: 8, border: `1px solid ${view === 'orders' ? S.gold : S.border}`, background: view === 'orders' ? S.gold3 : 'transparent', color: view === 'orders' ? S.gold : S.muted, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif' }}>📋 Orders</button>
            <button onClick={() => setView('shift' as any)} style={{ padding: '6px 12px', borderRadius: 8, border: `1px solid ${(view as string) === 'shift' ? S.teal : S.border}`, background: (view as string) === 'shift' ? S.tealB : 'transparent', color: (view as string) === 'shift' ? S.teal : S.muted, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif' }}>📊 Shift</button>
          </div>
        </div>
        {/* Row 2: Shift */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <select value={shift} onChange={e => setShift(e.target.value as any)} style={{ background: S.navy3, border: `1px solid ${S.border}`, borderRadius: 8, padding: '5px 10px', color: S.white, fontSize: 12, fontFamily: 'Tajawal, sans-serif', cursor: 'pointer' }}>
            <option value="shift1">Shift 1</option>
            <option value="shift2">Shift 2</option>
          </select>
          {!shiftStarted ? (
            <button onClick={() => { const now = new Date(); setShiftStarted(true); setShiftStart(now); localStorage.setItem('cashier_shift_active','true'); localStorage.setItem('cashier_shift_start', now.toISOString()); localStorage.setItem('cashier_shift_value', shift) }} style={{ padding: '5px 14px', borderRadius: 8, border: `1px solid ${S.green}`, background: S.greenB, color: S.green, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>▶ Start Shift</button>
          ) : (
            <>
              <span style={{ fontSize: 13, color: S.green, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>⏱ {shiftElapsed}</span>
              <button onClick={() => { setShowShiftReport(true) }} style={{ padding: '5px 14px', borderRadius: 8, border: `1px solid ${S.red}`, background: S.redB, color: S.red, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>⏹ End Shift</button>
            </>
          )}
        </div>
      </div>

      {/* Row 3: Branch Selector (Admin only) */}
      {isAdmin && branches.length > 0 && (
        <div style={{ background: S.navy2, borderBottom: `1px solid ${S.border}`, padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, color: S.muted, fontWeight: 700 }}>🏪 Branch:</span>
          {branches.map(b => (
            <button key={b.id} onClick={() => setAdminBranchFilter(b.id)}
              style={{ padding: '6px 16px', borderRadius: 20, border: `1px solid ${adminBranchFilter === b.id ? S.gold : S.border}`, background: adminBranchFilter === b.id ? S.gold3 : 'transparent', color: adminBranchFilter === b.id ? S.gold : S.muted, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', fontWeight: adminBranchFilter === b.id ? 700 : 400 }}>
              {b.name}
            </button>
          ))}
        </div>
      )}

      <div style={{ padding: 16, maxWidth: 1200, margin: '0 auto' }}>
        {/* Tables Stats Bar — for the currently displayed branch */}
        <div style={{ marginBottom: 16 }}>
          {currentBranchName && (
            <div style={{ fontSize: 12, fontWeight: 700, color: S.gold, marginBottom: 6 }}>🏪 {currentBranchName}</div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 10 }}>
            {[
              { label: 'Total Tables', value: tableStats.total,     color: S.white, icon: '🪑' },
              { label: 'Occupied',     value: tableStats.occupied,  color: S.red,   icon: '🔴' },
              { label: 'Available',    value: tableStats.available, color: S.green, icon: '🟢' },
              { label: 'Reserved',     value: tableStats.reserved,  color: S.amber, icon: '🟡' },
            ].map((s, i) => (
              <div key={i} style={{ background: S.card, borderRadius: 12, padding: '10px 12px', border: `1px solid ${S.border}`, textAlign: 'center' }}>
                <div style={{ fontSize: 10, color: S.muted, marginBottom: 2 }}>{s.icon} {s.label}</div>
                <div style={{ fontSize: 20, fontWeight: 900, color: s.color }}>{s.value}</div>
              </div>
            ))}
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: S.muted }}>⏳ Loading...</div>
        ) : view === 'tables' ? (
          /* ══ TABLES VIEW ══ */
          <div>
            <div style={{ fontSize: 13, color: S.muted, marginBottom: 16 }}>Tap a table to add order or view current order</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 12 }}>
              {displayedTables.map(table => {
                const activeOrder = orders.find(o => o.table_id === table.id && ['confirmed','preparing','ready'].includes(o.status))
                const status = activeOrder ? 'occupied' : (table.status || 'available')
                const statusColors: Record<string, { color: string; bg: string; border: string }> = {
                  available: { color: S.green, bg: S.greenB, border: S.green + '60' },
                  reserved:  { color: S.amber, bg: S.amberB, border: S.amber + '60' },
                  occupied:  { color: S.red,   bg: S.redB,   border: S.red + '60' },
                }
                const sc = statusColors[status] || statusColors.available
                return (
                  <div key={table.id}
                    onClick={() => {
                      if (activeOrder) {
                        // جيب كل الطلبات النشطة للطاولة
                        const tableOrders = orders.filter(o => o.table_id === table.id && ['confirmed','preparing','ready'].includes(o.status))
                        if (tableOrders.length > 1) {
                          // دمج الطلبات في طلب واحد للعرض
                          const merged = { ...tableOrders[0], order_items: tableOrders.flatMap(o => o.order_items), total_amount: tableOrders.reduce((s,o) => s + (o.total_amount||0), 0) }
                          setPayOrder(merged as any)
                        } else {
                          setPayOrder(activeOrder)
                        }
                      } else {
                        setAddOrderTable(table)
                      }
                    }}
                    style={{ background: sc.bg, border: `2px solid ${sc.border}`, borderRadius: 16, padding: '16px 12px', cursor: 'pointer', textAlign: 'center', transition: 'all .2s', position: 'relative' }}>
                    {/* Table number in circle */}
                    <div style={{ width: 52, height: 52, borderRadius: '50%', background: S.navy2, border: `2px solid ${sc.color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px', fontSize: 20, fontWeight: 900, color: sc.color }}>
                      {table.number}
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: S.white, marginBottom: 4 }}>{table.name || `Table ${table.number}`}</div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: sc.color }}>
                      {status === 'available' ? '🟢 Available' : status === 'reserved' ? '🟡 Reserved' : '🔴 Occupied'}
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
                { key: 'active', label: 'Active' },
                { key: 'all',    label: 'All' },
                { key: 'done',   label: 'Closed' },
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
                <div>No orders found</div>
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
                            <span style={{ color: S.white, fontWeight: 800, fontSize: 15 }}>{order.tables?.name || `Table ${order.tables?.number}`}</span>
                            <span style={{ background: st.bg, color: st.color, borderRadius: 8, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>{st.emoji} {st.label}</span>
                          </div>
                          <div style={{ fontSize: 11, color: S.muted }}>#{order.id.slice(-6).toUpperCase()} · ago {timeAgo(order.created_at)}</div>
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
                            <span style={{ color: S.white }}>{i.menu_items?.name_en || i.menu_items?.name} <span style={{ color: S.muted }}>×{i.quantity}</span></span>
                            {i.notes && <span style={{ color: S.muted, fontSize: 10 }}>({i.notes})</span>}
                          </div>
                        ))}
                      </div>

                      <div style={{ padding: '10px 16px', borderTop: `1px solid ${S.border}`, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {order.status === 'confirmed' && (
                          <button onClick={() => sendToStation(order.id)} style={{ flex: 1, padding: '9px', borderRadius: 8, border: `1px solid ${S.amber}`, background: S.amberB, color: S.amber, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>👨‍🍳 Send to Kitchen</button>
                        )}
                        {order.status === 'preparing' && (
                          <button onClick={() => updateStatus(order.id, 'ready')} style={{ flex: 1, padding: '9px', borderRadius: 8, border: `1px solid ${S.green}`, background: S.greenB, color: S.green, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>✅ Ready</button>
                        )}
                        {['confirmed','preparing','ready'].includes(order.status) && (
                          <button onClick={() => setPayOrder(order)} style={{ flex: 1, padding: '9px', borderRadius: 8, border: `1px solid ${S.gold}`, background: S.gold3, color: S.gold, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>💰 Pay</button>
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
      {payOrder && <PaymentModal order={payOrder} onClose={() => setPayOrder(null)} onPaid={() => {
        const paidTableId = payOrder.table_id
        setPayOrder(null)
        // فوراً امسح الطلبات المدفوعة من الـ state
        setOrders(prev => prev.filter(o => !(o.table_id === paidTableId && ['confirmed','preparing','ready'].includes(o.status))))
        // وحدّث الطاولة في الـ state مباشرة
        setTables(prev => prev.map(t => t.id === paidTableId ? { ...t, status: 'available', current_order_id: null, occupied_since: null } : t))
        // بعدين fetch من DB
        setTimeout(() => fetchAll(), 1000)
      }} />}
      {addOrderTable && <AddOrderModal tableId={addOrderTable.id} tableName={addOrderTable.name || `Table ${addOrderTable.number}`} onClose={() => setAddOrderTable(null)} onSaved={() => { setAddOrderTable(null); fetchAll() }} />}
      {showShiftReport && <ShiftReportModal orders={orders} shift={shift} shiftStart={shiftStart} fetchPaid={fetchPaidOrders} onClose={() => { setShowShiftReport(false); setShiftStarted(false); setShiftStart(null); localStorage.removeItem('cashier_shift_active'); localStorage.removeItem('cashier_shift_start') }} />}
    </div>
  )
}
