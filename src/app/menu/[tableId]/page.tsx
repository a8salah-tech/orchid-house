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
    <div style={{ minHeight:'100dvh', background:'linear-gradient(135deg,#0a0a0a,#1a1208)', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'system-ui' }}>
      <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}} @keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}`}</style>
      <div style={{ textAlign:'center' }}>
        <div style={{ fontSize:64, animation:'spin 3s linear infinite', marginBottom:20 }}>🌸</div>
        <div style={{ color:'#C9A84C', fontSize:16, fontWeight:700, animation:'pulse 1.5s ease infinite' }}>Loading menu...</div>
      </div>
    </div>
  )

  if (notFound) return (
    <div style={{ minHeight:'100dvh', background:'#0a0a0a', display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:12, fontFamily:'system-ui' }}>
      <div style={{ fontSize:48 }}>❌</div>
      <div style={{ color:'#fff', fontSize:18, fontWeight:700 }}>Table not found</div>
    </div>
  )

  // ══ Done Screen ══
  if (phase === 'done') return (
    <div style={{ minHeight:'100dvh', background:'linear-gradient(135deg,#0a0a0a,#1a1208)', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'system-ui', padding:20 }}>
      <style>{`
        @keyframes fadeUp{from{opacity:0;transform:translateY(40px)}to{opacity:1;transform:translateY(0)}}
        @keyframes chefBounce{0%,100%{transform:translateY(0) rotate(-8deg)}50%{transform:translateY(-18px) rotate(8deg)}}
        @keyframes glow{0%,100%{box-shadow:0 0 20px rgba(201,168,76,.3)}50%{box-shadow:0 0 40px rgba(201,168,76,.6)}}
        @keyframes shimmer{0%{background-position:-200px 0}100%{background-position:200px 0}}
      `}</style>
      <div style={{ maxWidth:400, width:'100%', textAlign:'center' }}>
        <div style={{ fontSize:96, display:'inline-block', animation:'chefBounce 2s ease-in-out infinite', marginBottom:28, filter:'drop-shadow(0 8px 24px rgba(0,0,0,.5))' }}>👨‍🍳</div>
        <div style={{ background:'linear-gradient(135deg,#1a1208,#0f0f0f)', borderRadius:28, border:'1px solid rgba(201,168,76,.25)', padding:'36px 28px', animation:'fadeUp .6s ease' }}>
          <div style={{ color:'#C9A84C', fontSize:11, fontWeight:700, letterSpacing:4, textTransform:'uppercase', marginBottom:10 }}>✨ Order Confirmed</div>
          <h2 style={{ color:'#fff', fontSize:22, fontWeight:900, marginBottom:10, lineHeight:1.3 }}>Your order is being<br/>prepared with love 💫</h2>
          <p style={{ color:'#666', fontSize:13, marginBottom:28, lineHeight:1.7 }}>Our talented kitchen team is crafting your meal. Sit back, relax and enjoy your time! 🍽️</p>
          <div style={{ background:'linear-gradient(135deg,rgba(201,168,76,.12),rgba(201,168,76,.06))', border:'1px solid rgba(201,168,76,.3)', borderRadius:20, padding:'24px 20px', marginBottom:24, animation:'glow 2s ease infinite' }}>
            <div style={{ color:'#888', fontSize:10, letterSpacing:3, marginBottom:8 }}>YOUR ORDER NUMBER</div>
            <div style={{ background:'linear-gradient(135deg,#C9A84C,#E8C97A)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', fontSize:56, fontWeight:900, letterSpacing:8, lineHeight:1 }}>#{orderNumber}</div>
            <div style={{ color:'#888', fontSize:12, marginTop:10 }}>{table?.name || `Table ${table?.number}`}</div>
          </div>
          <div style={{ background:'rgba(255,255,255,.03)', borderRadius:16, padding:16 }}>
            <div style={{ color:'#555', fontSize:10, marginBottom:12, letterSpacing:2 }}>ORDER SUMMARY</div>
            {cart.map(c => (
              <div key={c.item.id} style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid rgba(255,255,255,.05)', fontSize:13 }}>
                <span style={{ color:'#ccc' }}>{c.item.name_en || c.item.name} <span style={{ color:'#555' }}>×{c.quantity}</span></span>
                <span style={{ color:'#C9A84C', fontWeight:700 }}>MYR {(c.item.price * c.quantity).toFixed(2)}</span>
              </div>
            ))}
          </div>
          <p style={{ color:'#444', fontSize:12, marginTop:20 }}>A team member will serve you shortly 🙏</p>
        </div>
      </div>
    </div>
  )

  // ══ Item Detail Bottom Sheet ══
  const ItemSheet = selectedItem && (
    <div style={{ position:'fixed', inset:0, zIndex:200 }} onClick={() => setSelectedItem(null)}>
      <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,.7)', backdropFilter:'blur(8px)' }} />
      <div style={{ position:'absolute', bottom:0, left:0, right:0, background:'linear-gradient(135deg,#1a1208,#111)', borderRadius:'28px 28px 0 0', maxWidth:500, margin:'0 auto', overflow:'hidden', border:'1px solid rgba(201,168,76,.15)', borderBottom:'none' }}
        onClick={e => e.stopPropagation()}>
        <style>{`@keyframes slideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}`}</style>
        <div style={{ animation:'slideUp .3s cubic-bezier(.34,1.56,.64,1)' }}>
          {selectedItem.image_url && (
            <div style={{ width:'100%', height:220, overflow:'hidden', position:'relative' }}>
              <img src={selectedItem.image_url} alt={selectedItem.name_en} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
              <div style={{ position:'absolute', inset:0, background:'linear-gradient(to top,#1a1208,transparent)' }} />
            </div>
          )}
          <div style={{ padding:'24px 24px 36px' }}>
            <div style={{ fontSize:22, fontWeight:900, color:'#fff', marginBottom:4 }}>{selectedItem.name_en || selectedItem.name}</div>
            <div style={{ fontSize:13, color:'#C9A84C', marginBottom:12, fontWeight:600 }}>{selectedItem.name}</div>
            {(selectedItem.description_en || selectedItem.description) && (
              <div style={{ fontSize:14, color:'#888', lineHeight:1.7, marginBottom:20 }}>{selectedItem.description_en || selectedItem.description}</div>
            )}
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div style={{ fontSize:26, fontWeight:900, color:'#C9A84C' }}>MYR {selectedItem.price.toFixed(2)}</div>
              <div style={{ display:'flex', alignItems:'center', gap:14 }}>
                {getQty(selectedItem.id) > 0 && (
                  <>
                    <button onClick={() => removeFromCart(selectedItem.id)}
                      style={{ width:44, height:44, borderRadius:'50%', border:'none', background:'rgba(239,68,68,.2)', color:'#ef4444', fontSize:24, fontWeight:700, cursor:'pointer' }}>−</button>
                    <span style={{ color:'#fff', fontWeight:900, fontSize:20, minWidth:24, textAlign:'center' }}>{getQty(selectedItem.id)}</span>
                  </>
                )}
                <button onClick={() => addToCart(selectedItem)}
                  style={{ width:44, height:44, borderRadius:'50%', border:'none', background:'linear-gradient(135deg,#C9A84C,#E8C97A)', color:'#1a1208', fontSize:24, fontWeight:700, cursor:'pointer', boxShadow:'0 4px 16px rgba(201,168,76,.4)' }}>+</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  // ══ Cart Screen ══
  if (phase === 'cart') return (
    <div style={{ minHeight:'100dvh', background:'linear-gradient(135deg,#0a0a0a,#1a1208)', fontFamily:'system-ui', color:'#fff' }}>
      <div style={{ background:'rgba(0,0,0,.6)', backdropFilter:'blur(20px)', padding:'16px 20px', display:'flex', alignItems:'center', gap:12, borderBottom:'1px solid rgba(201,168,76,.1)', position:'sticky', top:0, zIndex:50 }}>
        <button onClick={() => setPhase('menu')} style={{ background:'rgba(255,255,255,.08)', border:'none', color:'#fff', width:38, height:38, borderRadius:'50%', cursor:'pointer', fontSize:18 }}>←</button>
        <h1 style={{ color:'#fff', fontSize:17, fontWeight:900, margin:0 }}>🛒 Your Order</h1>
        <div style={{ marginLeft:'auto', fontSize:13, color:'#C9A84C', fontWeight:600 }}>{table?.name || `Table ${table?.number}`}</div>
      </div>
      <div style={{ padding:20, maxWidth:500, margin:'0 auto' }}>
        {cart.map(c => (
          <div key={c.item.id} style={{ background:'rgba(255,255,255,.04)', backdropFilter:'blur(10px)', borderRadius:20, padding:16, marginBottom:12, border:'1px solid rgba(201,168,76,.1)' }}>
            <div style={{ display:'flex', gap:12, alignItems:'center' }}>
              {c.item.image_url && <img src={c.item.image_url} alt={c.item.name_en} style={{ width:60, height:60, borderRadius:14, objectFit:'cover', flexShrink:0 }} />}
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:800, fontSize:14, color:'#fff', marginBottom:2 }}>{c.item.name_en || c.item.name}</div>
                <div style={{ fontSize:11, color:'#C9A84C', marginBottom:8 }}>MYR {c.item.price.toFixed(2)} each</div>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                    <button onClick={() => removeFromCart(c.item.id)} style={{ width:32, height:32, borderRadius:'50%', border:'none', background:'rgba(239,68,68,.2)', color:'#ef4444', fontSize:20, cursor:'pointer', fontWeight:700 }}>−</button>
                    <span style={{ color:'#fff', fontWeight:900, fontSize:16 }}>{c.quantity}</span>
                    <button onClick={() => addToCart(c.item)} style={{ width:32, height:32, borderRadius:'50%', border:'none', background:'linear-gradient(135deg,#C9A84C,#E8C97A)', color:'#1a1208', fontSize:20, cursor:'pointer', fontWeight:700 }}>+</button>
                  </div>
                  <span style={{ color:'#C9A84C', fontWeight:900, fontSize:16 }}>MYR {(c.item.price * c.quantity).toFixed(2)}</span>
                </div>
              </div>
            </div>
            <input style={{ width:'100%', background:'rgba(255,255,255,.05)', border:'1px solid rgba(255,255,255,.08)', borderRadius:12, padding:'8px 14px', fontSize:12, color:'#fff', outline:'none', marginTop:12, boxSizing:'border-box' as const, fontFamily:'system-ui' }}
              placeholder="Special request... e.g. no onion"
              value={c.notes} onChange={e => setCart(p => p.map(ci => ci.item.id === c.item.id ? { ...ci, notes: e.target.value } : ci))} />
          </div>
        ))}
        <div style={{ background:'rgba(201,168,76,.08)', border:'1px solid rgba(201,168,76,.2)', borderRadius:20, padding:'16px 20px', marginBottom:16 }}>
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, color:'#888', marginBottom:6 }}>
            <span>Subtotal</span><span style={{ color:'#fff' }}>MYR {cartTotal.toFixed(2)}</span>
          </div>
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:'#666', marginBottom:4 }}>
            <span>Service Charge (10%)</span><span>MYR {(cartTotal * 0.1).toFixed(2)}</span>
          </div>
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:'#666' }}>
            <span>SST (6%)</span><span>MYR {(cartTotal * 0.06).toFixed(2)}</span>
          </div>
        </div>
        <button onClick={confirmOrder} disabled={submitting}
          style={{ width:'100%', background: submitting ? '#333' : 'linear-gradient(135deg,#C9A84C,#E8C97A)', border:'none', borderRadius:18, padding:'17px', cursor: submitting ? 'not-allowed' : 'pointer', fontWeight:900, fontSize:16, color:'#1a1208', boxShadow: submitting ? 'none' : '0 8px 32px rgba(201,168,76,.4)', letterSpacing:.5 }}>
          {submitting ? '⏳ Placing order...' : `✅ Confirm Order — ${cartCount} items`}
        </button>
      </div>
    </div>
  )

  // ══ Menu Screen ══
  return (
    <div style={{ minHeight:'100dvh', background:'linear-gradient(135deg,#0a0a0a,#1a1208)', fontFamily:'system-ui', color:'#fff', paddingBottom: cartCount > 0 ? 100 : 24 }}>
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{display:none}
        .item-card{transition:transform .2s,box-shadow .2s}
        .item-card:active{transform:scale(.96)}
        .cat-btn{transition:all .2s}
      `}</style>

      {/* Header */}
      <div style={{ background:'rgba(0,0,0,.5)', backdropFilter:'blur(20px)', padding:'20px 20px 0', borderBottom:'1px solid rgba(201,168,76,.08)', position:'sticky', top:0, zIndex:50 }}>
        {/* Top row */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
          <div>
            <div style={{ fontSize:20, fontWeight:900, background:'linear-gradient(135deg,#C9A84C,#E8C97A)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', letterSpacing:1 }}>🌸 Orchid House</div>
            <div style={{ fontSize:11, color:'#666', marginTop:2 }}>{table?.name || `Table ${table?.number}`}</div>
          </div>
          <button onClick={() => { setWaiterCalled(true); setTimeout(() => setWaiterCalled(false), 5000) }}
            style={{ background: waiterCalled ? 'linear-gradient(135deg,#22C55E,#16A34A)' : 'rgba(255,255,255,.06)', border:'1px solid rgba(255,255,255,.1)', borderRadius:14, padding:'9px 16px', cursor:'pointer', fontSize:12, color: waiterCalled ? '#fff' : '#aaa', fontWeight:700, transition:'all .3s', fontFamily:'system-ui', backdropFilter:'blur(10px)' }}>
            {waiterCalled ? '✅ On the way!' : '🔔 Call Waiter'}
          </button>
        </div>

        {/* Search */}
        <div style={{ position:'relative', marginBottom:14 }}>
          <input style={{ width:'100%', background:'rgba(255,255,255,.06)', border:'1px solid rgba(255,255,255,.08)', borderRadius:14, padding:'12px 18px 12px 44px', fontSize:14, color:'#fff', outline:'none', fontFamily:'system-ui', backdropFilter:'blur(10px)' }}
            placeholder="Search dishes..." value={search} onChange={e => setSearch(e.target.value)} />
          <span style={{ position:'absolute', left:16, top:'50%', transform:'translateY(-50%)', fontSize:16, color:'#555' }}>🔍</span>
        </div>

        {/* Categories */}
        <div style={{ display:'flex', gap:8, overflowX:'auto', paddingBottom:16 }}>
          {[{ id:'all', name_en:'All', name:'All' }, ...categories].map(c => (
            <button key={c.id} className="cat-btn" onClick={() => setActiveCat(c.id)}
              style={{ padding:'9px 20px', borderRadius:30, border:'none', background: activeCat === c.id ? 'linear-gradient(135deg,#C9A84C,#E8C97A)' : 'rgba(255,255,255,.06)', color: activeCat === c.id ? '#1a1208' : '#aaa', cursor:'pointer', fontSize:13, fontWeight: activeCat === c.id ? 800 : 400, whiteSpace:'nowrap', fontFamily:'system-ui', backdropFilter:'blur(10px)', boxShadow: activeCat === c.id ? '0 4px 16px rgba(201,168,76,.3)' : 'none' }}>
              {c.name_en || c.name}
            </button>
          ))}
        </div>
      </div>

      {/* Items Grid */}
      <div style={{ padding:'24px 14px', display:'grid', gridTemplateColumns:'repeat(2, 1fr)', gap:20, maxWidth:600, margin:'0 auto' }}>
        {filteredItems.length === 0 ? (
          <div style={{ gridColumn:'1/-1', textAlign:'center', padding:60, color:'#555' }}>
            <div style={{ fontSize:40, marginBottom:12 }}>🍽️</div>
            <div>No items found</div>
          </div>
        ) : filteredItems.map(item => {
          const qty = getQty(item.id)
          return (
            <div key={item.id} className="item-card"
              style={{ background:'rgba(255,255,255,.04)', backdropFilter:'blur(10px)', borderRadius:24, overflow:'visible', border: qty > 0 ? '1.5px solid rgba(201,168,76,.6)' : '1px solid rgba(255,255,255,.06)', cursor:'pointer', position:'relative', marginTop:52, boxShadow: qty > 0 ? '0 8px 32px rgba(201,168,76,.15)' : '0 4px 20px rgba(0,0,0,.3)' }}
              onClick={() => setSelectedItem(item)}>

              {/* Circular image */}
              <div style={{ position:'absolute', top:-52, left:'50%', transform:'translateX(-50%)', width:96, height:96, borderRadius:'50%', overflow:'hidden', border: qty > 0 ? '3px solid #C9A84C' : '2px solid rgba(201,168,76,.3)', boxShadow: qty > 0 ? '0 0 24px rgba(201,168,76,.5), 0 8px 24px rgba(0,0,0,.6)' : '0 8px 24px rgba(0,0,0,.6)', background:'linear-gradient(135deg,#1a1208,#0a0a0a)', zIndex:10, flexShrink:0 }}>
                {item.image_url
                  ? <img src={item.image_url} alt={item.name_en} loading="lazy" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                  : <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:36 }}>🍽️</div>
                }
              </div>

              {/* Content */}
              <div style={{ padding:'52px 14px 16px', textAlign:'center' }}>
                <div style={{ fontSize:14, fontWeight:800, color:'#fff', marginBottom:3, lineHeight:1.3 }}>{item.name_en || item.name}</div>
                <div style={{ fontSize:10, color:'#C9A84C', marginBottom:6, fontWeight:600 }}>{item.name}</div>
                {item.description_en && (
                  <div style={{ fontSize:11, color:'#666', lineHeight:1.5, marginBottom:10, display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical' as any, overflow:'hidden' }}>{item.description_en}</div>
                )}
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:10 }}>
                  <div style={{ background:'linear-gradient(135deg,#C9A84C,#E8C97A)', borderRadius:20, padding:'5px 12px', fontSize:13, fontWeight:900, color:'#1a1208', boxShadow:'0 2px 8px rgba(201,168,76,.3)' }}>
                    MYR {item.price.toFixed(2)}
                  </div>
                  <div onClick={e => { e.stopPropagation(); qty === 0 ? addToCart(item) : setSelectedItem(item) }}
                    style={{ background: qty > 0 ? 'linear-gradient(135deg,#C9A84C,#E8C97A)' : 'rgba(201,168,76,.12)', border: qty > 0 ? 'none' : '1px solid rgba(201,168,76,.3)', borderRadius:20, padding:'6px 14px', cursor:'pointer', fontSize:13, fontWeight:800, color: qty > 0 ? '#1a1208' : '#C9A84C', display:'flex', alignItems:'center', gap:4, boxShadow: qty > 0 ? '0 4px 12px rgba(201,168,76,.3)' : 'none' }}>
                    {qty > 0 ? <><span>+</span><span>{qty}</span></> : <><span style={{ fontSize:16 }}>+</span><span>Add</span></>}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Item Detail Sheet */}
      {ItemSheet}

      {/* Cart Bar */}
      {cartCount > 0 && (
        <div style={{ position:'fixed', bottom:0, left:0, right:0, padding:'14px 16px', background:'rgba(0,0,0,.85)', backdropFilter:'blur(20px)', borderTop:'1px solid rgba(201,168,76,.1)' }}>
          <div style={{ maxWidth:500, margin:'0 auto' }}>
            <button onClick={() => setPhase('cart')}
              style={{ width:'100%', background:'linear-gradient(135deg,#C9A84C,#E8C97A)', border:'none', borderRadius:18, padding:'15px 20px', cursor:'pointer', fontWeight:900, fontSize:15, color:'#1a1208', display:'flex', justifyContent:'space-between', alignItems:'center', boxShadow:'0 8px 32px rgba(201,168,76,.4)' }}>
              <span>🛒 View Order ({cartCount} items)</span>
              <span style={{ background:'rgba(26,18,8,.2)', borderRadius:12, padding:'4px 12px', fontSize:14 }}>MYR {cartTotal.toFixed(2)}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
