'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useRef, useCallback } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useParams } from 'next/navigation'

const createClient = () => createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type Category = { id: string; name: string; name_en: string; destination: string }
type MenuItem  = { id: string; name: string; name_en: string; price: number; description: string; description_en: string; category_id: string; is_available: boolean; image_url?: string }
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
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null)

  useEffect(() => {
    async function load() {
      const { data: tbl } = await sb.from('tables').select('*').eq('id', tableId).single()
      if (!tbl) { setNotFound(true); setLoading(false); return }
      setTable(tbl)
      const [cats, itms] = await Promise.all([
        sb.from('menu_categories').select('id,name,name_en,destination').eq('is_active', true).order('sort_order'),
        sb.from('menu_items').select('id,name,name_en,price,description,description_en,category_id,is_available,image_url').eq('is_available', true).order('sort_order'),
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
    await sb.from('tables').update({ status: 'occupied', occupied_since: new Date().toISOString() }).eq('id', table.id)
    setOrderNumber(order.id.slice(-6).toUpperCase())
    setPhase('done')
    setSubmitting(false)
  }

  // ══ Loading ══
  if (loading) return (
    <div style={{ minHeight: '100dvh', background: '#1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 56, marginBottom: 16, animation: 'spin 2s linear infinite' }}>🌸</div>
        <div style={{ color: '#fff', fontSize: 16, fontWeight: 600 }}>Loading menu...</div>
      </div>
      <style>{`@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>
    </div>
  )

  if (notFound) return (
    <div style={{ minHeight: '100dvh', background: '#1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, fontFamily: 'system-ui' }}>
      <div style={{ fontSize: 48 }}>❌</div>
      <div style={{ color: '#fff', fontSize: 18, fontWeight: 700 }}>Table not found</div>
    </div>
  )

  // ══ Done Screen ══
  if (phase === 'done') return (
    <div style={{ minHeight: '100dvh', background: '#1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui', padding: 20 }}>
      <style>{`
        @keyframes fadeUp { from{opacity:0;transform:translateY(30px)} to{opacity:1;transform:translateY(0)} }
        @keyframes chefBounce { 0%,100%{transform:translateY(0) rotate(-5deg)} 50%{transform:translateY(-14px) rotate(5deg)} }
        @keyframes pulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.04)} }
      `}</style>
      <div style={{ maxWidth: 400, width: '100%', textAlign: 'center', animation: 'fadeUp .6s ease' }}>
        <div style={{ fontSize: 88, display: 'inline-block', animation: 'chefBounce 2s ease-in-out infinite', marginBottom: 24 }}>👨‍🍳</div>
        <div style={{ background: '#222', borderRadius: 24, border: '1px solid #333', padding: '32px 24px' }}>
          <div style={{ color: '#C9A84C', fontSize: 13, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 8 }}>Order Confirmed!</div>
          <h2 style={{ color: '#fff', fontSize: 20, fontWeight: 800, marginBottom: 8 }}>Your order is being prepared</h2>
          <p style={{ color: '#888', fontSize: 13, marginBottom: 24 }}>Our kitchen team is working on your meal. Sit back and relax! 🍽️</p>
          <div style={{ background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.3)', borderRadius: 16, padding: 20, marginBottom: 20, animation: 'pulse 2s ease-in-out infinite' }}>
            <div style={{ color: '#888', fontSize: 11, marginBottom: 6, letterSpacing: 1 }}>ORDER NUMBER</div>
            <div style={{ color: '#C9A84C', fontSize: 48, fontWeight: 900, letterSpacing: 6 }}>#{orderNumber}</div>
            <div style={{ color: '#888', fontSize: 12, marginTop: 6 }}>{table?.name || `Table ${table?.number}`}</div>
          </div>
          <div style={{ background: '#1a1a1a', borderRadius: 12, padding: 16 }}>
            <div style={{ color: '#666', fontSize: 11, marginBottom: 10, letterSpacing: 1 }}>ORDER SUMMARY</div>
            {cart.map(c => (
              <div key={c.item.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid #2a2a2a', fontSize: 13 }}>
                <span style={{ color: '#fff' }}>{c.item.name_en || c.item.name} <span style={{ color: '#555' }}>×{c.quantity}</span></span>
                <span style={{ color: '#C9A84C', fontWeight: 700 }}>MYR {(c.item.price * c.quantity).toFixed(2)}</span>
              </div>
            ))}
          </div>
          <p style={{ color: '#555', fontSize: 12, marginTop: 20 }}>A team member will serve you shortly 🙏</p>
        </div>
      </div>
    </div>
  )

  // ══ Item Detail Modal ══
  const ItemModal = selectedItem && (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }} onClick={() => setSelectedItem(null)}>
      <div style={{ background: '#1e1e1e', borderRadius: '24px 24px 0 0', width: '100%', maxWidth: 500, overflow: 'hidden', animation: 'slideUp .3s ease' }} onClick={e => e.stopPropagation()}>
        <style>{`@keyframes slideUp { from{transform:translateY(100%)} to{transform:translateY(0)} }`}</style>
        {selectedItem.image_url && (
          <div style={{ width: '100%', height: 220, overflow: 'hidden' }}>
            <img src={selectedItem.image_url} alt={selectedItem.name_en} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
        )}
        <div style={{ padding: '20px 20px 32px' }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#fff', marginBottom: 4 }}>{selectedItem.name_en || selectedItem.name}</div>
          <div style={{ fontSize: 13, color: '#888', marginBottom: 10 }}>{selectedItem.name}</div>
          {(selectedItem.description_en || selectedItem.description) && (
            <div style={{ fontSize: 13, color: '#aaa', lineHeight: 1.6, marginBottom: 16 }}>{selectedItem.description_en || selectedItem.description}</div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 900, color: '#C9A84C' }}>MYR {selectedItem.price.toFixed(2)}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {getQty(selectedItem.id) > 0 && (
                <>
                  <button onClick={() => removeFromCart(selectedItem.id)} style={{ width: 40, height: 40, borderRadius: '50%', border: 'none', background: '#E53E3E', color: '#fff', fontSize: 22, fontWeight: 700, cursor: 'pointer' }}>−</button>
                  <span style={{ color: '#fff', fontWeight: 800, fontSize: 18 }}>{getQty(selectedItem.id)}</span>
                </>
              )}
              <button onClick={() => addToCart(selectedItem)} style={{ width: 40, height: 40, borderRadius: '50%', border: 'none', background: '#C9A84C', color: '#fff', fontSize: 22, fontWeight: 700, cursor: 'pointer' }}>+</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  // ══ Cart Screen ══
  if (phase === 'cart') return (
    <div style={{ minHeight: '100dvh', background: '#1a1a1a', fontFamily: 'system-ui', color: '#fff' }}>
      {/* Header */}
      <div style={{ background: '#111', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid #2a2a2a', position: 'sticky', top: 0, zIndex: 50 }}>
        <button onClick={() => setPhase('menu')} style={{ background: '#2a2a2a', border: 'none', color: '#fff', width: 36, height: 36, borderRadius: '50%', cursor: 'pointer', fontSize: 18 }}>←</button>
        <h1 style={{ color: '#fff', fontSize: 17, fontWeight: 800, margin: 0 }}>🛒 Your Order</h1>
        <div style={{ marginLeft: 'auto', fontSize: 13, color: '#888' }}>{table?.name || `Table ${table?.number}`}</div>
      </div>
      <div style={{ padding: 20, maxWidth: 500, margin: '0 auto' }}>
        {cart.map(c => (
          <div key={c.item.id} style={{ background: '#222', borderRadius: 16, padding: 16, marginBottom: 12, border: '1px solid #2a2a2a' }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              {c.item.image_url && <img src={c.item.image_url} alt={c.item.name_en} style={{ width: 56, height: 56, borderRadius: 12, objectFit: 'cover', flexShrink: 0 }} />}
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: '#fff', marginBottom: 2 }}>{c.item.name_en || c.item.name}</div>
                <div style={{ fontSize: 11, color: '#888', marginBottom: 8 }}>{c.item.name}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <button onClick={() => removeFromCart(c.item.id)} style={{ width: 30, height: 30, borderRadius: '50%', border: 'none', background: '#E53E3E', color: '#fff', fontSize: 18, cursor: 'pointer', fontWeight: 700 }}>−</button>
                    <span style={{ color: '#fff', fontWeight: 800, fontSize: 16 }}>{c.quantity}</span>
                    <button onClick={() => addToCart(c.item)} style={{ width: 30, height: 30, borderRadius: '50%', border: 'none', background: '#C9A84C', color: '#fff', fontSize: 18, cursor: 'pointer', fontWeight: 700 }}>+</button>
                  </div>
                  <span style={{ color: '#C9A84C', fontWeight: 800, fontSize: 15 }}>MYR {(c.item.price * c.quantity).toFixed(2)}</span>
                </div>
              </div>
            </div>
            <input style={{ width: '100%', background: '#1a1a1a', border: '1px solid #333', borderRadius: 10, padding: '8px 12px', fontSize: 12, color: '#fff', outline: 'none', marginTop: 10, boxSizing: 'border-box' as const, fontFamily: 'system-ui' }}
              placeholder="Special request... e.g. no onion"
              value={c.notes} onChange={e => setCart(p => p.map(ci => ci.item.id === c.item.id ? { ...ci, notes: e.target.value } : ci))} />
          </div>
        ))}
        <button onClick={confirmOrder} disabled={submitting}
          style={{ width: '100%', background: submitting ? '#555' : 'linear-gradient(135deg,#C9A84C,#E8C97A)', border: 'none', borderRadius: 16, padding: '16px', cursor: submitting ? 'not-allowed' : 'pointer', fontWeight: 800, fontSize: 16, color: '#1a1a1a', marginTop: 8, boxShadow: '0 4px 20px rgba(201,168,76,0.3)' }}>
          {submitting ? '⏳ Placing order...' : `✅ Confirm Order (${cartCount} items)`}
        </button>
      </div>
    </div>
  )

  // ══ Menu Screen ══
  return (
    <div style={{ minHeight: '100dvh', background: '#1a1a1a', fontFamily: 'system-ui', color: '#fff', paddingBottom: cartCount > 0 ? 90 : 0 }}>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { display: none; }
        .item-card { transition: transform .15s; }
        .item-card:active { transform: scale(0.97); }
      `}</style>

      {/* Header */}
      <div style={{ background: '#111', padding: '20px 20px 0', borderBottom: '1px solid #2a2a2a' }}>
        {/* Brand + Waiter */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 900, color: '#fff', letterSpacing: 1 }}>🌸 Orchid House</div>
            <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{table?.name || `Table ${table?.number}`}</div>
          </div>
          <button onClick={callWaiter}
            style={{ background: waiterCalled ? '#22C55E' : '#2a2a2a', border: 'none', borderRadius: 12, padding: '8px 14px', cursor: 'pointer', fontSize: 13, color: waiterCalled ? '#fff' : '#aaa', fontWeight: 700, transition: 'all .3s', fontFamily: 'system-ui' }}>
            {waiterCalled ? '✅ On the way!' : '🔔 Call Waiter'}
          </button>
        </div>

        {/* Search */}
        <div style={{ position: 'relative', marginBottom: 14 }}>
          <input style={{ width: '100%', background: '#2a2a2a', border: '1px solid #333', borderRadius: 12, padding: '11px 16px 11px 40px', fontSize: 14, color: '#fff', outline: 'none', fontFamily: 'system-ui' }}
            placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} />
          <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 16, color: '#666' }}>🔍</span>
        </div>

        {/* Categories */}
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 14 }}>
          <button onClick={() => setActiveCat('all')}
            style={{ padding: '8px 18px', borderRadius: 24, border: 'none', background: activeCat === 'all' ? '#C9A84C' : '#2a2a2a', color: activeCat === 'all' ? '#1a1a1a' : '#aaa', cursor: 'pointer', fontSize: 13, fontWeight: activeCat === 'all' ? 800 : 400, whiteSpace: 'nowrap', fontFamily: 'system-ui' }}>
            All
          </button>
          {categories.map(c => (
            <button key={c.id} onClick={() => setActiveCat(c.id)}
              style={{ padding: '8px 18px', borderRadius: 24, border: 'none', background: activeCat === c.id ? '#C9A84C' : '#2a2a2a', color: activeCat === c.id ? '#1a1a1a' : '#aaa', cursor: 'pointer', fontSize: 13, fontWeight: activeCat === c.id ? 800 : 400, whiteSpace: 'nowrap', fontFamily: 'system-ui' }}>
              {c.name_en || c.name}
            </button>
          ))}
        </div>
      </div>

      {/* Items Grid */}
      <div style={{ padding: '16px 14px', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14, maxWidth: 600, margin: '0 auto' }}>
        {filteredItems.length === 0 ? (
          <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: 40, color: '#555' }}>No items found</div>
        ) : filteredItems.map(item => {
          const qty = getQty(item.id)
          return (
            <div key={item.id} className="item-card"
              style={{ background: '#222', borderRadius: 20, overflow: 'hidden', border: qty > 0 ? '2px solid #C9A84C' : '1px solid #2a2a2a', cursor: 'pointer', position: 'relative' }}
              onClick={() => setSelectedItem(item)}>

              {/* Image with circular overlay */}
              <div style={{ position: 'relative', paddingTop: '75%', background: '#1a1a1a', overflow: 'visible' }}>
                {item.image_url ? (
                  <img src={item.image_url} alt={item.name_en} loading="lazy"
                    style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40 }}>🍽️</div>
                )}
                {/* Circular image overlay */}
                <div style={{ position: 'absolute', top: -20, left: '50%', transform: 'translateX(-50%)', width: 90, height: 90, borderRadius: '50%', overflow: 'hidden', border: qty > 0 ? '3px solid #C9A84C' : '3px dashed #C9A84C', boxShadow: qty > 0 ? '0 0 20px rgba(201,168,76,0.5)' : '0 4px 16px rgba(0,0,0,0.5)', background: '#1a1a1a', display: item.image_url ? 'block' : 'none' }}>
                  {item.image_url && <img src={item.image_url} alt={item.name_en} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                </div>
              </div>

              {/* Content */}
              <div style={{ padding: '36px 14px 14px', textAlign: 'center' }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#fff', marginBottom: 4, lineHeight: 1.3 }}>{item.name_en || item.name}</div>
                <div style={{ fontSize: 11, color: '#666', marginBottom: 8 }}>{item.name}</div>
                {item.description_en && <div style={{ fontSize: 11, color: '#888', lineHeight: 1.5, marginBottom: 10, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any, overflow: 'hidden' }}>{item.description_en}</div>}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
                  <div style={{ background: '#C9A84C', borderRadius: 20, padding: '4px 12px', fontSize: 13, fontWeight: 800, color: '#1a1a1a' }}>MYR {item.price.toFixed(2)}</div>
                  <div onClick={e => { e.stopPropagation(); addToCart(item) }}
                    style={{ background: qty > 0 ? '#C9A84C' : '#333', border: 'none', borderRadius: 20, padding: '6px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 700, color: qty > 0 ? '#1a1a1a' : '#fff', display: 'flex', alignItems: 'center', gap: 4 }}>
                    {qty > 0 ? <><span style={{ fontSize: 16 }}>+</span>{qty}</> : <><span style={{ fontSize: 16 }}>+</span> Add</>}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Item Detail Modal */}
      {ItemModal}

      {/* Float Cart Bar */}
      {cartCount > 0 && (
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, padding: '12px 16px', background: 'rgba(26,26,26,0.95)', backdropFilter: 'blur(12px)', borderTop: '1px solid #2a2a2a' }}>
          <div style={{ maxWidth: 500, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 13, color: '#888' }}>
              <span style={{ color: '#C9A84C', fontWeight: 800 }}>MYR {cartTotal.toFixed(2)}</span>
              <span style={{ marginRight: 8 }}> · السعر الإجمالي:</span>
            </div>
            <button onClick={() => setPhase('cart')}
              style={{ background: 'linear-gradient(135deg,#C9A84C,#E8C97A)', border: 'none', borderRadius: 14, padding: '12px 24px', cursor: 'pointer', fontWeight: 800, fontSize: 14, color: '#1a1a1a', display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 4px 20px rgba(201,168,76,0.3)' }}>
              🛒 قائمة الطلب
              <span style={{ background: '#1a1a1a', color: '#C9A84C', borderRadius: 20, padding: '2px 8px', fontSize: 12 }}>{cartCount}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
