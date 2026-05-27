'use client'



import { useEffect, useState, useRef, useCallback } from 'react'
import { createBrowserClient } from '@supabase/ssr'

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
  amber: '#F59E0B', amberB: 'rgba(245,158,11,0.12)',
  purple: '#8B5CF6', purpleB: 'rgba(139,92,246,0.12)',
  teal: '#14B8A6', tealB: 'rgba(20,184,166,0.12)',
  card: 'rgba(255,255,255,0.04)',
}

type BarOrder = {
  id: string
  status: string
  created_at: string
  tables: { number: number; name: string }
  order_items: {
    id: string
    quantity: number
    notes: string
    status: string
    destination: string
    menu_items: { name: string }
  }[]
}

function elapsed(iso: string) {
  const sec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

function urgencyColor(iso: string) {
  const min = (Date.now() - new Date(iso).getTime()) / 60000
  if (min > 10) return S.red    // بار أسرع من المطبخ — 10 دقائق كحد أقصى
  if (min > 5)  return S.amber
  return S.teal
}

export default function BarPage() {
  const sbRef = useRef(createClient())
  const sb = sbRef.current

  const [orders, setOrders] = useState<BarOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [tick, setTick] = useState(0)
  const [notif, setNotif] = useState(false)

  const fetchOrders = useCallback(async () => {
    const { data } = await sb
      .from('orders')
      .select(`
        id, status, created_at,
        tables(number, name),
        order_items(id, quantity, notes, status, destination,
          menu_items(name)
        )
      `)
      .in('status', ['preparing'])
      .order('created_at', { ascending: true })

    const filtered = ((data as any) || []).map((o: BarOrder) => ({
      ...o,
      order_items: o.order_items.filter(i => i.destination === 'bar'),
    })).filter((o: BarOrder) => o.order_items.length > 0)

    setOrders(filtered)
    setLoading(false)
  }, [sb])

  useEffect(() => { fetchOrders() }, [fetchOrders])

  // Real-time
  useEffect(() => {
    const channel = sb.channel('bar-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        fetchOrders()
        setNotif(true)
        setTimeout(() => setNotif(false), 2000)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, () => fetchOrders())
      .subscribe()
    return () => { sb.removeChannel(channel) }
  }, [sb, fetchOrders])

  // Timer كل ثانية
  useEffect(() => {
    const t = setInterval(() => setTick(p => p + 1), 1000)
    return () => clearInterval(t)
  }, [])

  async function markItemReady(itemId: string, orderId: string) {
    await sb.from('order_items').update({ status: 'ready' }).eq('id', itemId)
    // تحقق: لو كل الـ bar items جاهزة
    const order = orders.find(o => o.id === orderId)
    if (order) {
      const remaining = order.order_items.filter(i => i.id !== itemId && i.status !== 'ready')
      if (remaining.length === 0) {
        // تحقق كمان من items الـ kitchen — لو كلها ready، غير الـ order لـ ready
const { data: allItems } = await sb
  .from('order_items')
  .select('id, status')
  .eq('order_id', orderId)
const allReady = (allItems || []).every((i: any) => i.status === 'ready' || i.id === itemId)
        if (allReady) {
          await sb.from('orders').update({ status: 'ready' }).eq('id', orderId)
        }
      }
    }
    fetchOrders()
  }

  return (
    <div style={{ minHeight: '100vh', background: S.navy, fontFamily: 'Tajawal, sans-serif', direction: 'rtl' }}>

      {notif && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, height: 4, background: S.teal, zIndex: 999 }} />
      )}

      {/* Header */}
      <div style={{ background: S.navy2, borderBottom: `1px solid ${S.border}`, padding: '0 24px', display: 'flex', alignItems: 'center', height: 60, gap: 12, position: 'sticky', top: 0, zIndex: 100 }}>
        <h1 style={{ color: S.teal, fontSize: 20, fontWeight: 900 }}>🥤 شاشة البار</h1>
        <div style={{ color: S.muted, fontSize: 13 }}>{orders.length} طلب قيد التحضير</div>
        <div style={{ marginRight: 'auto', fontSize: 12, color: S.muted }}>🟢 متصل · يتجدد تلقائياً</div>
      </div>

      <div style={{ padding: 20 }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: S.muted, fontSize: 18 }}>⏳</div>
        ) : orders.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 80 }}>
            <div style={{ fontSize: 64, marginBottom: 16 }}>✅</div>
            <div style={{ color: S.white, fontSize: 20, fontWeight: 700 }}>لا توجد طلبات حالياً</div>
            <div style={{ color: S.muted, fontSize: 14, marginTop: 8 }}>في انتظار الطلبات...</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
            {orders.map(order => {
              const age = urgencyColor(order.created_at)
              const time = elapsed(order.created_at)
              return (
                <div key={order.id} style={{ background: S.navy2, borderRadius: 16, border: `2px solid ${age}40`, overflow: 'hidden' }}>

                  <div style={{ height: 4, background: age }} />

                  <div style={{ padding: '14px 16px', borderBottom: `1px solid ${S.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ color: S.white, fontWeight: 800, fontSize: 17 }}>
                        {order.tables?.name || `طاولة ${order.tables?.number}`}
                      </div>
                      <div style={{ fontSize: 11, color: S.muted }}>#{order.id.slice(-6).toUpperCase()}</div>
                    </div>
                    <div style={{ color: age, fontWeight: 900, fontSize: 22, fontVariantNumeric: 'tabular-nums' }}>
                      {time}
                    </div>
                  </div>

                  <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {order.order_items.map(item => (
                      <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: item.status === 'ready' ? S.greenB : S.tealB, borderRadius: 10, border: `1px solid ${item.status === 'ready' ? S.green + '40' : S.teal + '40'}` }}>
                        <div>
                          <div style={{ color: item.status === 'ready' ? S.green : S.white, fontWeight: 700, fontSize: 14 }}>
                            {item.status === 'ready' ? '✅ ' : '🥤 '}{item.menu_items?.name}
                            <span style={{ color: S.gold, marginRight: 6, fontWeight: 900 }}>×{item.quantity}</span>
                          </div>
                          {item.notes && <div style={{ color: S.amber, fontSize: 11, marginTop: 2 }}>⚠️ {item.notes}</div>}
                        </div>
                        {item.status !== 'ready' && (
                          <button onClick={() => markItemReady(item.id, order.id)}
                            style={{ padding: '8px 12px', borderRadius: 8, border: `1px solid ${S.green}`, background: S.greenB, color: S.green, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', fontWeight: 700, whiteSpace: 'nowrap' }}>
                            جاهز ✓
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
