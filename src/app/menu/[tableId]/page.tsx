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
type MenuItem = { id: string; name: string; name_en: string; price: number; description: string; category_id: string; is_available: boolean; image_url?: string }
type CartItem = { item: MenuItem; quantity: number; notes: string }

type Phase = 'menu' | 'cart' | 'confirming' | 'done'

export default function CustomerMenuPage() {
  const params = useParams()
  const tableId = params?.tableId as string
  const sbRef = useRef(createClient())
  const sb = sbRef.current

  const [table, setTable]       = useState<{ id: string; number: number; name: string } | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [items, setItems]       = useState<MenuItem[]>([])
  const [loading, setLoading]   = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [activeCat, setActiveCat] = useState<string>('all')
  const [search, setSearch]     = useState('')
  const [cart, setCart]         = useState<CartItem[]>([])
  const [phase, setPhase]       = useState<Phase>('menu')
  const [submitting, setSubmitting] = useState(false)
  const [orderId, setOrderId]   = useState<string | null>(null)
  const [orderNumber, setOrderNumber] = useState<string>('')

  useEffect(() => {
    async function load() {
      // جلب الطاولة
      const { data: tbl } = await sb.from('tables').select('*').eq('id', tableId).single()
      if (!tbl) { setNotFound(true); setLoading(false); return }
      setTable(tbl)

      // جلب المنيو
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
    const matchCat = activeCat === 'all' || i.category_id === activeCat
    const q = search.trim()
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

  function getQty(itemId: string) {
    return cart.find(c => c.item.id === itemId)?.quantity || 0
  }

  const cartTotal = cart.reduce((s, c) => s + c.item.price * c.quantity, 0)
  const cartCount = cart.reduce((s, c) => s + c.quantity, 0)

  async function confirmOrder() {
    if (!table || cart.length === 0) return
    setSubmitting(true)

    // إنشاء الطلب
    const { data: order, error: oErr } = await sb.from('orders')
      .insert([{
        table_id: table.id,
        status: 'confirmed',
        total_amount: cartTotal,
        confirmed_at: new Date().toISOString(),
      }])
      .select('id')
      .single()

    if (oErr || !order) { setSubmitting(false); alert('حدث خطأ، حاول مرة أخرى'); return }

    // تحديد destination من category
    const catMap = Object.fromEntries(categories.map(c => [c.id, c.destination]))

    // إدراج عناصر الطلب
    const orderItems = cart.map(c => ({
      order_id: order.id,
      menu_item_id: c.item.id,
      quantity: c.quantity,
      unit_price: c.item.price,
      notes: c.notes || null,
      destination: catMap[c.item.category_id] || 'kitchen',
      status: 'pending',
    }))

    await sb.from('order_items').insert(orderItems)

    // رقم الطلب (آخر 6 من UUID)
    setOrderId(order.id)
    setOrderNumber(order.id.slice(-6).toUpperCase())
    setPhase('done')
    setSubmitting(false)
  }

  // ══ Styles ══
  const btn = (color: string, bg: string, border: string): React.CSSProperties => ({
    padding: '12px 24px', borderRadius: 12, border: `1px solid ${border}`,
    background: bg, color, cursor: 'pointer', fontSize: 14,
    fontFamily: 'Tajawal, sans-serif', fontWeight: 700,
  })

  if (loading) return (
    <div style={{ minHeight: '100dvh', background: S.navy, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Tajawal, sans-serif' }}>
      <div style={{ color: S.gold, fontSize: 18 }}>⏳ جاري تحميل المنيو...</div>
    </div>
  )

  if (notFound) return (
    <div style={{ minHeight: '100dvh', background: S.navy, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Tajawal, sans-serif', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 48 }}>❌</div>
      <div style={{ color: S.white, fontSize: 18, fontWeight: 700 }}>الطاولة غير موجودة</div>
      <div style={{ color: S.muted, fontSize: 14 }}>تأكد من صحة الـ QR Code</div>
    </div>
  )

  // ══ شاشة التأكيد النهائية ══
  if (phase === 'done') return (
    <div style={{ minHeight: '100dvh', background: S.navy, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Tajawal, sans-serif', direction: 'rtl', padding: 20 }}>
      <div style={{ background: S.navy2, borderRadius: 24, border: `1px solid ${S.border}`, padding: 40, maxWidth: 400, width: '100%', textAlign: 'center' }}>
        <div style={{ fontSize: 64, marginBottom: 16 }}>✅</div>
        <h2 style={{ color: S.green, fontSize: 22, fontWeight: 800, marginBottom: 8 }}>تم تأكيد طلبك!</h2>
        <p style={{ color: S.muted, fontSize: 14, marginBottom: 24 }}>طلبك وصل للمطعم وسيتم تحضيره قريباً</p>

        <div style={{ background: S.card, borderRadius: 16, padding: 20, marginBottom: 24 }}>
          <div style={{ fontSize: 13, color: S.muted, marginBottom: 6 }}>رقم طلبك</div>
          <div style={{ fontSize: 42, fontWeight: 900, color: S.gold, letterSpacing: 4 }}>#{orderNumber}</div>
          <div style={{ fontSize: 13, color: S.muted, marginTop: 8 }}>{table?.name || `طاولة ${table?.number}`}</div>
        </div>

        <div style={{ background: S.card, borderRadius: 12, padding: 16, marginBottom: 24, textAlign: 'right' }}>
          <div style={{ fontSize: 13, color: S.muted, marginBottom: 10, textAlign: 'center' }}>ملخص الطلب</div>
          {cart.map(c => (
            <div key={c.item.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: `1px solid ${S.border}`, fontSize: 13 }}>
              <span style={{ color: S.white }}>{c.item.name} ×{c.quantity}</span>
              <span style={{ color: S.gold }}>MYR {(c.item.price * c.quantity).toFixed(2)}</span>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0 0', fontSize: 15, fontWeight: 800 }}>
            <span style={{ color: S.white }}>الإجمالي</span>
            <span style={{ color: S.gold }}>MYR {cartTotal.toFixed(2)}</span>
          </div>
        </div>

        <p style={{ color: S.muted, fontSize: 12 }}>سيقوم أحد أفراد الفريق بخدمتك قريباً 🙏</p>
      </div>
    </div>
  )

  // ══ شاشة مراجعة السلة ══
  if (phase === 'cart') return (
    <div style={{ minHeight: '100dvh', background: S.navy, fontFamily: 'Tajawal, sans-serif', direction: 'rtl' }}>
      {/* Header */}
      <div style={{ background: S.navy2, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: `1px solid ${S.border}`, position: 'sticky', top: 0, zIndex: 50 }}>
        <button onClick={() => setPhase('menu')} style={{ background: 'transparent', border: 'none', color: S.gold, fontSize: 20, cursor: 'pointer' }}>←</button>
        <h1 style={{ color: S.white, fontSize: 17, fontWeight: 800 }}>🛒 مراجعة الطلب</h1>
        <div style={{ marginRight: 'auto', fontSize: 13, color: S.muted }}>{table?.name || `طاولة ${table?.number}`}</div>
      </div>

      <div style={{ padding: 20, maxWidth: 500, margin: '0 auto' }}>
        {cart.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: S.muted }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🛒</div>
            <div>السلة فاضية</div>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
              {cart.map(c => (
                <div key={c.item.id} style={{ background: S.card, borderRadius: 14, padding: '14px 16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <div>
                      <div style={{ color: S.white, fontWeight: 700, fontSize: 15 }}>{c.item.name}</div>
                      <div style={{ color: S.muted, fontSize: 12 }}>{c.item.name_en}</div>
                    </div>
                    <div style={{ color: S.gold, fontWeight: 800, fontSize: 15 }}>MYR {(c.item.price * c.quantity).toFixed(2)}</div>
                  </div>

                  {/* التحكم في الكمية */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                    <button onClick={() => removeFromCart(c.item.id)}
                      style={{ width: 34, height: 34, borderRadius: 10, border: `1px solid ${S.red}`, background: S.redB, color: S.red, cursor: 'pointer', fontSize: 18, fontWeight: 700 }}>−</button>
                    <span style={{ color: S.white, fontWeight: 800, fontSize: 16, minWidth: 24, textAlign: 'center' }}>{c.quantity}</span>
                    <button onClick={() => addToCart(c.item)}
                      style={{ width: 34, height: 34, borderRadius: 10, border: `1px solid ${S.green}`, background: S.greenB, color: S.green, cursor: 'pointer', fontSize: 18, fontWeight: 700 }}>+</button>
                    <span style={{ color: S.muted, fontSize: 12, marginRight: 4 }}>× MYR {c.item.price.toFixed(2)}</span>
                  </div>

                  {/* ملاحظة */}
                  <input
                    style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: S.white, outline: 'none', fontFamily: 'Tajawal, sans-serif', boxSizing: 'border-box', direction: 'rtl' }}
                    placeholder="ملاحظة (اختياري)... مثال: بدون بصل"
                    value={c.notes}
                    onChange={e => setCart(p => p.map(ci => ci.item.id === c.item.id ? { ...ci, notes: e.target.value } : ci))}
                  />
                </div>
              ))}
            </div>

            {/* الإجمالي */}
            <div style={{ background: S.card, borderRadius: 14, padding: '16px 20px', marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13 }}>
                <span style={{ color: S.muted }}>عدد الأصناف</span>
                <span style={{ color: S.white }}>{cartCount} صنف</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 18, fontWeight: 800 }}>
                <span style={{ color: S.white }}>الإجمالي</span>
                <span style={{ color: S.gold }}>MYR {cartTotal.toFixed(2)}</span>
              </div>
            </div>

            <button onClick={confirmOrder} disabled={submitting}
              style={{ ...btn(S.navy, S.gold, S.gold), width: '100%', fontSize: 16, opacity: submitting ? 0.7 : 1 }}>
              {submitting ? '⏳ جاري الإرسال...' : '✅ تأكيد الطلب'}
            </button>
          </>
        )}
      </div>
    </div>
  )

  // ══ شاشة المنيو الرئيسية ══
  return (
    <div style={{ minHeight: '100dvh', background: S.navy, fontFamily: 'Tajawal, sans-serif', direction: 'rtl', paddingBottom: cartCount > 0 ? 90 : 0 }}>

      {/* Header */}
      <div style={{ background: S.navy2, padding: '16px 20px', borderBottom: `1px solid ${S.border}`, position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div>
            <h1 style={{ color: S.gold, fontSize: 20, fontWeight: 900 }}>🍽️ قائمة الطعام</h1>
            <p style={{ color: S.muted, fontSize: 12 }}>{table?.name || `طاولة ${table?.number}`}</p>
          </div>
          {cartCount > 0 && (
            <button onClick={() => setPhase('cart')}
              style={{ background: S.gold, border: 'none', borderRadius: 12, padding: '10px 16px', cursor: 'pointer', fontFamily: 'Tajawal, sans-serif', fontWeight: 800, fontSize: 13, color: S.navy, display: 'flex', alignItems: 'center', gap: 8 }}>
              🛒 {cartCount}
              <span style={{ background: S.navy, color: S.gold, borderRadius: 8, padding: '2px 8px', fontSize: 12 }}>MYR {cartTotal.toFixed(2)}</span>
            </button>
          )}
        </div>

        {/* بحث */}
        <input
          style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: S.white, outline: 'none', fontFamily: 'Tajawal, sans-serif', boxSizing: 'border-box', direction: 'rtl' }}
          placeholder="🔍 ابحث عن صنف..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Categories */}
      <div style={{ display: 'flex', gap: 8, padding: '12px 16px', overflowX: 'auto', borderBottom: `1px solid ${S.border}`, background: S.navy3 }}>
        <button onClick={() => setActiveCat('all')}
          style={{ padding: '8px 16px', borderRadius: 20, border: `1px solid ${activeCat === 'all' ? S.gold : S.border}`, background: activeCat === 'all' ? S.gold3 : 'transparent', color: activeCat === 'all' ? S.gold : S.muted, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', whiteSpace: 'nowrap', fontWeight: activeCat === 'all' ? 700 : 400 }}>
          الكل
        </button>
        {categories.map(c => (
          <button key={c.id} onClick={() => setActiveCat(c.id)}
            style={{ padding: '8px 16px', borderRadius: 20, border: `1px solid ${activeCat === c.id ? S.gold : S.border}`, background: activeCat === c.id ? S.gold3 : 'transparent', color: activeCat === c.id ? S.gold : S.muted, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', whiteSpace: 'nowrap', fontWeight: activeCat === c.id ? 700 : 400 }}>
            {c.name}
          </button>
        ))}
      </div>

      {/* Items */}
      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 600, margin: '0 auto' }}>
        {filteredItems.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: S.muted }}>لا توجد أصناف</div>
        ) : filteredItems.map(item => {
          const qty = getQty(item.id)
          return (
            <div key={item.id} style={{ background: S.card, borderRadius: 16, padding: '16px', border: qty > 0 ? `1px solid ${S.gold}40` : `1px solid ${S.border}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ color: S.white, fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{item.name}</div>
                  <div style={{ color: S.muted, fontSize: 12, marginBottom: 6 }}>{item.name_en}</div>
                  {item.description && <div style={{ color: S.muted, fontSize: 12, lineHeight: 1.5 }}>{item.description}</div>}
                  <div style={{ color: S.gold, fontWeight: 800, fontSize: 17, marginTop: 8 }}>MYR {item.price.toFixed(2)}</div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  {qty > 0 ? (
                    <>
                      <button onClick={() => addToCart(item)}
                        style={{ width: 38, height: 38, borderRadius: 10, border: `1px solid ${S.green}`, background: S.greenB, color: S.green, cursor: 'pointer', fontSize: 20, fontWeight: 700 }}>+</button>
                      <span style={{ color: S.gold, fontWeight: 800, fontSize: 16 }}>{qty}</span>
                      <button onClick={() => removeFromCart(item.id)}
                        style={{ width: 38, height: 38, borderRadius: 10, border: `1px solid ${S.red}`, background: S.redB, color: S.red, cursor: 'pointer', fontSize: 20, fontWeight: 700 }}>−</button>
                    </>
                  ) : (
                    <button onClick={() => addToCart(item)}
                      style={{ width: 38, height: 38, borderRadius: 10, border: `1px solid ${S.gold}`, background: S.gold3, color: S.gold, cursor: 'pointer', fontSize: 22, fontWeight: 700 }}>+</button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Float Cart Button */}
      {cartCount > 0 && (
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, padding: '16px 20px', background: `${S.navy}F0`, backdropFilter: 'blur(12px)', borderTop: `1px solid ${S.border}` }}>
          <button onClick={() => setPhase('cart')}
            style={{ width: '100%', background: S.gold, border: 'none', borderRadius: 14, padding: '14px 20px', cursor: 'pointer', fontFamily: 'Tajawal, sans-serif', fontWeight: 800, fontSize: 15, color: S.navy, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>🛒 عرض الطلب ({cartCount} صنف)</span>
            <span>MYR {cartTotal.toFixed(2)}</span>
          </button>
        </div>
      )}
    </div>
  )
}
