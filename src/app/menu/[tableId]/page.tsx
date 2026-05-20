'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useRef, useCallback } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useParams } from 'next/navigation'

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
  card: 'rgba(255,255,255,0.04)', card2: 'rgba(255,255,255,0.08)',
}

type Category = { id: string; name: string; name_en: string; destination: string }
type MenuItem  = { id: string; name: string; name_en: string; price: number; description: string; category_id: string; is_available: boolean; image_url?: string }
type CartItem  = { item: MenuItem; quantity: number; notes: string }
type Phase     = 'menu' | 'cart' | 'done'

export default function CustomerMenuPage() {
  const params  = useParams()
  const tableId = params?.tableId as string
  const sbRef   = useRef(createClient())
  const sb      = sbRef.current

  const [table, setTable]           = useState<{ id: string; number: number; name: string } | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [items, setItems]           = useState<MenuItem[]>([])
  const [loading, setLoading]       = useState(true)
  const [notFound, setNotFound]     = useState(false)
  const [activeCat, setActiveCat]   = useState<string>('all')
  const [search, setSearch]         = useState('')
  const [cart, setCart]             = useState<CartItem[]>([])
  const [phase, setPhase]           = useState<Phase>('menu')
  const [submitting, setSubmitting] = useState(false)
  const [orderNumber, setOrderNumber] = useState('')
  const [waiterCalled, setWaiterCalled] = useState(false)
  const [callingWaiter, setCallingWaiter] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: tbl } = await sb.from('tables').select('*').eq('id', tableId).single()
      if (!tbl) { setNotFound(true); setLoading(false); return }
      setTable(tbl)
      const [cats, itms] = await Promise.all([
        sb.from('menu_categories').select('id,name,name_en,destination').eq('is_active', true).order('sort_order'),
        sb.from('menu_items').select('id,name,name_en,price,description,category_id,is_available,image_url').eq('is_available', true).order('sort_order'),
      ])
      setCategories(cats.data || [])
      setItems(itms.data || [])
      setLoading(false)
    }
    if (tableId) load()
  }, [tableId, sb])

  const filteredItems = items.filter(i => {
    const matchCat    = activeCat === 'all' || i.category_id === activeCat
    const q           = search.trim()
    const matchSearch = !q || i.name.includes(q) || i.name_en.toLowerCase().includes(q.toLowerCase())
    return matchCat && matchSearch
  })

  function addToCart(item: MenuItem) {
    setCart(p => {
      const ex = p.find(c => c.item.id === item.id)
      if (ex) return p.map(c => c.item.id === item.id ? { ...c, quantity: c.quantity + 1 } : c)
      return [...p, { item, quantity: 1, notes: '' }]
    })
  }

  function removeFromCart(itemId: string) {
    setCart(p => {
      const ex = p.find(c => c.item.id === itemId)
      if (!ex) return p
      if (ex.quantity === 1) return p.filter(c => c.item.id !== itemId)
      return p.map(c => c.item.id === itemId ? { ...c, quantity: c.quantity - 1 } : c)
    })
  }

  function getQty(itemId: string) { return cart.find(c => c.item.id === itemId)?.quantity || 0 }

  const cartCount = cart.reduce((s, c) => s + c.quantity, 0)
  const cartTotal = cart.reduce((s, c) => s + c.item.price * c.quantity, 0)

  async function callWaiter() {
    setCallingWaiter(true)
    // يمكن إضافة notification للكاشير هنا
    await new Promise(r => setTimeout(r, 1000))
    setCallingWaiter(false)
    setWaiterCalled(true)
    setTimeout(() => setWaiterCalled(false), 5000)
  }

  async function confirmOrder() {
    if (!table || cart.length === 0) return
    setSubmitting(true)
    const { data: order, error } = await sb.from('orders').insert([{
      table_id: table.id, status: 'confirmed',
      total_amount: cartTotal, confirmed_at: new Date().toISOString(),
    }]).select('id').single()
    if (error || !order) { setSubmitting(false); alert('Error, please try again'); return }
    const catMap = Object.fromEntries(categories.map(c => [c.id, c.destination]))
    await sb.from('order_items').insert(cart.map(c => ({
      order_id: order.id, menu_item_id: c.item.id,
      quantity: c.quantity, unit_price: c.item.price,
      notes: c.notes || null,
      destination: catMap[c.item.category_id] || 'kitchen',
      status: 'pending',
    })))
    setOrderNumber(order.id.slice(-6).toUpperCase())
    setPhase('done')
    setSubmitting(false)
  }

  const inp: React.CSSProperties = {
    width: '100%', background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 10, padding: '10px 14px', fontSize: 13,
    color: S.white, outline: 'none', fontFamily: 'Tajawal, sans-serif',
    boxSizing: 'border-box',
  }

  // ══ Loading ══
  if (loading) return (
    <div style={{ minHeight: '100dvh', background: S.navy, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Tajawal, sans-serif' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>🌸</div>
        <div style={{ color: S.gold, fontSize: 16, fontWeight: 700 }}>Loading menu...</div>
      </div>
    </div>
  )

  if (notFound) return (
    <div style={{ minHeight: '100dvh', background: S.navy, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Tajawal, sans-serif', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 48 }}>❌</div>
      <div style={{ color: S.white, fontSize: 18, fontWeight: 700 }}>Table not found</div>
      <div style={{ color: S.muted, fontSize: 14 }}>Please check the QR code</div>
    </div>
  )

  // ══ Done Screen ══
  if (phase === 'done') return (
    <div style={{ minHeight: '100dvh', background: S.navy, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Tajawal, sans-serif', padding: 20 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700;800;900&display=swap');
        @keyframes fadeInUp { from { opacity:0; transform:translateY(30px); } to { opacity:1; transform:translateY(0); } }
        @keyframes chefBounce { 0%,100%{transform:translateY(0) rotate(-5deg);} 50%{transform:translateY(-12px) rotate(5deg);} }
        @keyframes shimmer { 0%{background-position:-200px 0;} 100%{background-position:200px 0;} }
        @keyframes pulse { 0%,100%{transform:scale(1);} 50%{transform:scale(1.05);} }
        .fade-up { animation: fadeInUp 0.6s ease forwards; }
        .chef-anim { animation: chefBounce 2s ease-in-out infinite; display:inline-block; }
        .pulse { animation: pulse 2s ease-in-out infinite; }
      `}</style>
      <div style={{ maxWidth: 400, width: '100%', textAlign: 'center' }}>

        {/* Chef Animation */}
        <div style={{ marginBottom: 24 }}>
          <div className="chef-anim" style={{ fontSize: 80 }}>👨‍🍳</div>
        </div>

        {/* Main Card */}
        <div className="fade-up" style={{ background: S.navy2, borderRadius: 24, border: `1px solid ${S.gold}40`, padding: '32px 28px', boxShadow: `0 0 40px rgba(201,168,76,0.1)` }}>
          <div style={{ fontSize: 13, color: S.gold, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 }}>Order Confirmed!</div>
          <h2 style={{ color: S.white, fontSize: 20, fontWeight: 800, marginBottom: 6 }}>Your order is being prepared</h2>
          <p style={{ color: S.muted, fontSize: 13, marginBottom: 24, lineHeight: 1.6 }}>Our kitchen team is working on your delicious meal. Sit back and relax! 🍽️</p>

          {/* Order Number */}
          <div className="pulse" style={{ background: `linear-gradient(135deg, ${S.gold}20, ${S.gold}10)`, border: `1px solid ${S.gold}40`, borderRadius: 16, padding: '20px', marginBottom: 20 }}>
            <div style={{ fontSize: 12, color: S.muted, marginBottom: 6, letterSpacing: 1 }}>ORDER NUMBER</div>
            <div style={{ fontSize: 48, fontWeight: 900, color: S.gold, letterSpacing: 6 }}>#{orderNumber}</div>
            <div style={{ fontSize: 12, color: S.muted, marginTop: 6 }}>{table?.name || `Table ${table?.number}`}</div>
          </div>

          {/* Order Summary — بدون إجمالي */}
          <div style={{ background: S.card, borderRadius: 14, padding: '16px', textAlign: 'left' }}>
            <div style={{ fontSize: 12, color: S.muted, marginBottom: 10, textAlign: 'center', letterSpacing: 1 }}>ORDER SUMMARY</div>
            {cart.map(c => (
              <div key={c.item.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${S.border}`, fontSize: 13 }}>
                <span style={{ color: S.white }}>{c.item.name_en} <span style={{ color: S.muted }}>×{c.quantity}</span></span>
                <span style={{ color: S.gold, fontWeight: 700 }}>MYR {(c.item.price * c.quantity).toFixed(2)}</span>
              </div>
            ))}
          </div>

          <p style={{ color: S.muted, fontSize: 12, marginTop: 20 }}>A team member will serve you shortly 🙏</p>
        </div>
      </div>
    </div>
  )

  // ══ Cart Screen ══
  if (phase === 'cart') return (
    <div style={{ minHeight: '100dvh', background: S.navy, fontFamily: 'Tajawal, sans-serif' }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700;800;900&display=swap'); * { box-sizing: border-box; margin: 0; padding: 0; }`}</style>
      <div style={{ background: S.navy2, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: `1px solid ${S.border}`, position: 'sticky', top: 0, zIndex: 50 }}>
        <button onClick={() => setPhase('menu')} style={{ background: 'transparent', border: 'none', color: S.gold, fontSize: 22, cursor: 'pointer' }}>←</button>
        <h1 style={{ color: S.white, fontSize: 17, fontWeight: 800 }}>🛒 Review Order</h1>
        <div style={{ marginLeft: 'auto', fontSize: 13, color: S.muted }}>{table?.name || `Table ${table?.number}`}</div>
      </div>

      <div style={{ padding: 20, maxWidth: 500, margin: '0 auto' }}>
        {cart.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: S.muted }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🛒</div>
            <div style={{ color: S.white, fontSize: 15 }}>Your cart is empty</div>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
              {cart.map(c => (
                <div key={c.item.id} style={{ background: S.card, borderRadius: 16, padding: '16px', border: `1px solid ${S.border}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <div>
                      <div style={{ color: S.white, fontWeight: 700, fontSize: 15 }}>{c.item.name}</div>
                      <div style={{ color: S.muted, fontSize: 12 }}>{c.item.name_en}</div>
                    </div>
                    <div style={{ color: S.gold, fontWeight: 800 }}>MYR {(c.item.price * c.quantity).toFixed(2)}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                    <button onClick={() => removeFromCart(c.item.id)} style={{ width: 34, height: 34, borderRadius: 10, border: `1px solid ${S.red}`, background: S.redB, color: S.red, cursor: 'pointer', fontSize: 18, fontWeight: 700 }}>−</button>
                    <span style={{ color: S.white, fontWeight: 800, fontSize: 16, minWidth: 24, textAlign: 'center' }}>{c.quantity}</span>
                    <button onClick={() => addToCart(c.item)} style={{ width: 34, height: 34, borderRadius: 10, border: `1px solid ${S.green}`, background: S.greenB, color: S.green, cursor: 'pointer', fontSize: 18, fontWeight: 700 }}>+</button>
                    <span style={{ color: S.muted, fontSize: 12 }}>× MYR {c.item.price.toFixed(2)}</span>
                  </div>
                  <input style={{ ...inp, fontSize: 12, padding: '8px 12px' }}
                    placeholder="Special request (optional)... e.g. no onion"
                    value={c.notes}
                    onChange={e => setCart(p => p.map(ci => ci.item.id === c.item.id ? { ...ci, notes: e.target.value } : ci))}
                  />
                </div>
              ))}
            </div>

            {/* Confirm Button — بدون إجمالي */}
            <button onClick={confirmOrder} disabled={submitting}
              style={{ width: '100%', background: S.gold, border: 'none', borderRadius: 14, padding: '16px', cursor: submitting ? 'not-allowed' : 'pointer', fontFamily: 'Tajawal, sans-serif', fontWeight: 800, fontSize: 16, color: S.navy, opacity: submitting ? 0.7 : 1, boxShadow: `0 4px 20px rgba(201,168,76,0.3)` }}>
              {submitting ? '⏳ Placing order...' : `✅ Confirm Order (${cartCount} items)`}
            </button>
          </>
        )}
      </div>
    </div>
  )

  // ══ Menu Screen ══
  return (
    <div style={{ minHeight: '100dvh', background: S.navy, fontFamily: 'Tajawal, sans-serif', paddingBottom: cartCount > 0 ? 90 : 0 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700;800;900&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { display: none; }
        .item-card { transition: transform .15s; }
        .item-card:active { transform: scale(0.98); }
        @keyframes waiterPop { 0%{opacity:0;transform:scale(0.8);} 50%{transform:scale(1.05);} 100%{opacity:1;transform:scale(1);} }
        .waiter-pop { animation: waiterPop 0.3s ease forwards; }
      `}</style>

      {/* Header */}
      <div style={{ background: S.navy2, padding: '14px 16px', borderBottom: `1px solid ${S.border}`, position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div>
            <div style={{ color: S.gold, fontSize: 18, fontWeight: 900 }}>🌸 Orchid House</div>
            <div style={{ color: S.muted, fontSize: 11 }}>{table?.name || `Table ${table?.number}`}</div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {/* Call Waiter Button */}
            <button onClick={callWaiter} disabled={callingWaiter || waiterCalled}
              style={{ padding: '8px 12px', borderRadius: 10, border: `1px solid ${waiterCalled ? S.green : 'rgba(255,255,255,0.15)'}`, background: waiterCalled ? S.greenB : 'rgba(255,255,255,0.05)', color: waiterCalled ? S.green : S.muted, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', fontWeight: 700, transition: 'all .3s' }}>
              {callingWaiter ? '⏳' : waiterCalled ? '✅ On the way!' : '🔔 Call Waiter'}
            </button>
            {cartCount > 0 && (
              <button onClick={() => setPhase('cart')}
                style={{ background: S.gold, border: 'none', borderRadius: 10, padding: '8px 14px', cursor: 'pointer', fontFamily: 'Tajawal, sans-serif', fontWeight: 800, fontSize: 13, color: S.navy }}>
                🛒 {cartCount}
              </button>
            )}
          </div>
        </div>
        <input style={inp} placeholder="🔍 Search..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* Categories */}
      <div style={{ display: 'flex', gap: 8, padding: '10px 14px', overflowX: 'auto', background: S.navy3, borderBottom: `1px solid ${S.border}` }}>
        <button onClick={() => setActiveCat('all')}
          style={{ padding: '7px 14px', borderRadius: 20, border: `1px solid ${activeCat === 'all' ? S.gold : S.border}`, background: activeCat === 'all' ? S.gold3 : 'transparent', color: activeCat === 'all' ? S.gold : S.muted, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', whiteSpace: 'nowrap', fontWeight: activeCat === 'all' ? 700 : 400 }}>
          All
        </button>
        {categories.map(c => (
          <button key={c.id} onClick={() => setActiveCat(c.id)}
            style={{ padding: '7px 14px', borderRadius: 20, border: `1px solid ${activeCat === c.id ? S.gold : S.border}`, background: activeCat === c.id ? S.gold3 : 'transparent', color: activeCat === c.id ? S.gold : S.muted, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', whiteSpace: 'nowrap', fontWeight: activeCat === c.id ? 700 : 400 }}>
            {c.name_en || c.name}
          </button>
        ))}
      </div>

      {/* Items */}
      <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 600, margin: '0 auto' }}>
        {filteredItems.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: S.muted }}>No items found</div>
        ) : filteredItems.map(item => {
          const qty = getQty(item.id)
          return (
            <div key={item.id} className="item-card"
              style={{ background: S.card, borderRadius: 16, border: qty > 0 ? `1px solid ${S.gold}50` : `1px solid ${S.border}`, overflow: 'hidden' }}>
              {/* صورة الصنف في الأعلى دائرة */}
              {item.image_url && (
                <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 16, paddingBottom: 4 }}>
                  <div style={{ width: 80, height: 80, borderRadius: '50%', overflow: 'hidden', border: `2px solid ${qty > 0 ? S.gold : S.border}`, boxShadow: qty > 0 ? `0 0 12px rgba(201,168,76,0.3)` : 'none', flexShrink: 0 }}>
                    <img src={item.image_url} alt={item.name_en} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                </div>
              )}

              <div style={{ padding: '12px 16px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ color: S.white, fontWeight: 800, fontSize: 15, marginBottom: 2 }}>{item.name_en}</div>
                  <div style={{ color: S.muted, fontSize: 11, marginBottom: 4 }}>{item.name}</div>
                  {item.description && <div style={{ color: S.muted, fontSize: 11, lineHeight: 1.5 }}>{item.description}</div>}
                  <div style={{ color: S.gold, fontWeight: 800, fontSize: 16, marginTop: 6 }}>MYR {item.price.toFixed(2)}</div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                  {qty > 0 ? (
                    <>
                      <button onClick={() => addToCart(item)}
                        style={{ width: 36, height: 36, borderRadius: 10, border: `1px solid ${S.green}`, background: S.greenB, color: S.green, cursor: 'pointer', fontSize: 20, fontWeight: 700 }}>+</button>
                      <span style={{ color: S.gold, fontWeight: 800, fontSize: 15 }}>{qty}</span>
                      <button onClick={() => removeFromCart(item.id)}
                        style={{ width: 36, height: 36, borderRadius: 10, border: `1px solid ${S.red}`, background: S.redB, color: S.red, cursor: 'pointer', fontSize: 20, fontWeight: 700 }}>−</button>
                    </>
                  ) : (
                    <button onClick={() => addToCart(item)}
                      style={{ width: 36, height: 36, borderRadius: 10, border: `1px solid ${S.gold}`, background: S.gold3, color: S.gold, cursor: 'pointer', fontSize: 22, fontWeight: 700 }}>+</button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Float Cart */}
      {cartCount > 0 && (
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, padding: '14px 16px', background: `${S.navy}F5`, backdropFilter: 'blur(12px)', borderTop: `1px solid ${S.border}` }}>
          <button onClick={() => setPhase('cart')}
            style={{ width: '100%', background: S.gold, border: 'none', borderRadius: 14, padding: '14px 20px', cursor: 'pointer', fontFamily: 'Tajawal, sans-serif', fontWeight: 800, fontSize: 15, color: S.navy, display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: `0 4px 20px rgba(201,168,76,0.3)` }}>
            <span>🛒 View Order ({cartCount} items)</span>
            <span>MYR {cartTotal.toFixed(2)}</span>
          </button>
        </div>
      )}
    </div>
  )
}
