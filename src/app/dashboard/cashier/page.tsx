'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState, useRef, useCallback } from 'react'
import { createBrowserClient } from '@supabase/ssr'

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
  card: 'rgba(255,255,255,0.04)', card2: 'rgba(255,255,255,0.08)',
  purple: '#8B5CF6', purpleB: 'rgba(139,92,246,0.12)',
}

type Order = {
  id: string
  table_id: string
  status: string
  total_amount: number
  notes: string
  created_at: string
  confirmed_at: string
  tables: { number: number; name: string }
  order_items: {
    id: string
    quantity: number
    unit_price: number
    notes: string
    destination: string
    status: string
    menu_items: { name: string; name_en: string }
  }[]
}

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string; emoji: string }> = {
  confirmed:  { label: 'جديد',        color: S.blue,   bg: S.blueB,   emoji: '🆕' },
  preparing:  { label: 'قيد التحضير', color: S.amber,  bg: S.amberB,  emoji: '👨‍🍳' },
  ready:      { label: 'جاهز',        color: S.green,  bg: S.greenB,  emoji: '✅' },
  done:       { label: 'مُسلَّم',      color: S.muted,  bg: S.card,    emoji: '📦' },
  cancelled:  { label: 'ملغي',        color: S.red,    bg: S.redB,    emoji: '❌' },
}

function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60) return `منذ ${diff}ث`
  if (diff < 3600) return `منذ ${Math.floor(diff / 60)}د`
  return `منذ ${Math.floor(diff / 3600)}س`
}

export default function CashierPage() {
  const sbRef = useRef(createClient())
  const sb = sbRef.current

  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('active') // active | all | done
  const [tick, setTick]   = useState(0) // لتحديث timeAgo كل دقيقة
  const [notif, setNotif] = useState<string | null>(null)

  const fetchOrders = useCallback(async () => {
    const { data } = await sb
      .from('orders')
      .select(`
        id, table_id, status, total_amount, notes, created_at, confirmed_at,
        tables(number, name),
        order_items(id, quantity, unit_price, notes, destination, status,
          menu_items(name, name_en)
        )
      `)
      .not('status', 'in', '("pending")')
      .order('created_at', { ascending: false })
      .limit(100)
    setOrders((data as any) || [])
    setLoading(false)
  }, [sb])

  useEffect(() => { fetchOrders() }, [fetchOrders])

  // Real-time subscription
  useEffect(() => {
    const channel = sb.channel('cashier-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, payload => {
        fetchOrders()
        if (payload.eventType === 'INSERT') {
          setNotif('🆕 طلب جديد وصل!')
          setTimeout(() => setNotif(null), 4000)
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, () => fetchOrders())
      .subscribe()
    return () => { sb.removeChannel(channel) }
  }, [sb, fetchOrders])

  // تحديث timeAgo كل دقيقة
  useEffect(() => {
    const t = setInterval(() => setTick(p => p + 1), 60000)
    return () => clearInterval(t)
  }, [])

  async function updateOrderStatus(orderId: string, status: string) {
    await sb.from('orders').update({ status, ...(status === 'done' ? { done_at: new Date().toISOString() } : {}) }).eq('id', orderId)
    fetchOrders()
  }

  async function sendToStation(orderId: string) {
    // تحديث status الـ order_items لـ preparing
    await sb.from('order_items').update({ status: 'preparing' }).eq('order_id', orderId)
    await sb.from('orders').update({ status: 'preparing' }).eq('id', orderId)
    fetchOrders()
  }

  const filtered = orders.filter(o => {
    if (filter === 'active') return ['confirmed', 'preparing', 'ready'].includes(o.status)
    if (filter === 'done')   return ['done', 'cancelled'].includes(o.status)
    return true
  })

  const activeCount = orders.filter(o => ['confirmed', 'preparing', 'ready'].includes(o.status)).length

  return (
    <div style={{ minHeight: '100vh', background: S.navy, fontFamily: 'Tajawal, sans-serif', direction: 'rtl' }}>

      {/* Notif */}
      {notif && (
        <div style={{ position: 'fixed', top: 80, right: 20, background: S.blue, color: S.white, padding: '12px 20px', borderRadius: 12, fontWeight: 700, fontSize: 14, zIndex: 999, boxShadow: '0 4px 20px rgba(0,0,0,0.4)' }}>
          {notif}
        </div>
      )}

      {/* Header */}
      <div style={{ background: S.navy2, borderBottom: `1px solid ${S.border}`, padding: '0 24px', display: 'flex', alignItems: 'center', height: 60, gap: 16, position: 'sticky', top: 0, zIndex: 100 }}>
        <h1 style={{ color: S.gold, fontSize: 18, fontWeight: 900 }}>🏧 لوحة الكاشير</h1>
        {activeCount > 0 && (
          <div style={{ background: S.redB, border: `1px solid ${S.red}`, borderRadius: 20, padding: '4px 12px', fontSize: 13, color: S.red, fontWeight: 700 }}>
            {activeCount} طلب نشط
          </div>
        )}
        <div style={{ marginRight: 'auto', display: 'flex', gap: 8 }}>
          {[
            { key: 'active', label: 'النشطة' },
            { key: 'all',    label: 'الكل' },
            { key: 'done',   label: 'المنتهية' },
          ].map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              style={{ padding: '6px 14px', borderRadius: 20, border: `1px solid ${filter === f.key ? S.gold : S.border}`, background: filter === f.key ? S.gold3 : 'transparent', color: filter === f.key ? S.gold : S.muted, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: filter === f.key ? 700 : 400 }}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: 20, maxWidth: 1100, margin: '0 auto' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: S.muted }}>⏳ جاري التحميل...</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: S.muted }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🎉</div>
            <div>لا توجد طلبات نشطة</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
            {filtered.map(order => {
              const st = STATUS_LABELS[order.status] || STATUS_LABELS['confirmed']
              const kitchenItems = order.order_items.filter(i => i.destination === 'kitchen')
              const barItems     = order.order_items.filter(i => i.destination === 'bar')

              return (
                <div key={order.id} style={{ background: S.navy2, borderRadius: 16, border: `1px solid ${order.status === 'confirmed' ? S.blue + '60' : S.border}`, overflow: 'hidden' }}>

                  {/* Order Header */}
                  <div style={{ padding: '14px 16px', borderBottom: `1px solid ${S.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ color: S.white, fontWeight: 800, fontSize: 16 }}>
                          {order.tables?.name || `طاولة ${order.tables?.number}`}
                        </span>
                        <span style={{ background: st.bg, color: st.color, borderRadius: 8, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>
                          {st.emoji} {st.label}
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: S.muted, marginTop: 2 }}>
                        #{order.id.slice(-6).toUpperCase()} · {timeAgo(order.created_at)}
                      </div>
                    </div>
                    <div style={{ color: S.gold, fontWeight: 800, fontSize: 16 }}>MYR {(order.total_amount || 0).toFixed(2)}</div>
                  </div>

                  {/* Items */}
                  <div style={{ padding: '12px 16px' }}>
                    {kitchenItems.length > 0 && (
                      <div style={{ marginBottom: 10 }}>
                        <div style={{ fontSize: 11, color: S.amber, fontWeight: 700, marginBottom: 6 }}>🍳 مطبخ</div>
                        {kitchenItems.map(i => (
                          <div key={i.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 13, borderBottom: `1px solid ${S.border}` }}>
                            <span style={{ color: S.white }}>{i.menu_items?.name} <span style={{ color: S.muted }}>×{i.quantity}</span></span>
                            {i.notes && <span style={{ color: S.muted, fontSize: 11 }}>({i.notes})</span>}
                          </div>
                        ))}
                      </div>
                    )}
                    {barItems.length > 0 && (
                      <div>
                        <div style={{ fontSize: 11, color: S.purple, fontWeight: 700, marginBottom: 6 }}>🥤 بار</div>
                        {barItems.map(i => (
                          <div key={i.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 13, borderBottom: `1px solid ${S.border}` }}>
                            <span style={{ color: S.white }}>{i.menu_items?.name} <span style={{ color: S.muted }}>×{i.quantity}</span></span>
                            {i.notes && <span style={{ color: S.muted, fontSize: 11 }}>({i.notes})</span>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div style={{ padding: '12px 16px', borderTop: `1px solid ${S.border}`, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {order.status === 'confirmed' && (
                      <button onClick={() => sendToStation(order.id)}
                        style={{ flex: 1, padding: '10px', borderRadius: 10, border: `1px solid ${S.amber}`, background: S.amberB, color: S.amber, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
                        👨‍🍳 أرسل للمحطة
                      </button>
                    )}
                    {order.status === 'preparing' && (
                      <button onClick={() => updateOrderStatus(order.id, 'ready')}
                        style={{ flex: 1, padding: '10px', borderRadius: 10, border: `1px solid ${S.green}`, background: S.greenB, color: S.green, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
                        ✅ جاهز للتسليم
                      </button>
                    )}
                    {order.status === 'ready' && (
                      <button onClick={() => updateOrderStatus(order.id, 'done')}
                        style={{ flex: 1, padding: '10px', borderRadius: 10, border: `1px solid ${S.gold}`, background: S.gold3, color: S.gold, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
                        📦 تم التسليم
                      </button>
                    )}
                    {['confirmed', 'preparing'].includes(order.status) && (
                      <button onClick={() => updateOrderStatus(order.id, 'cancelled')}
                        style={{ padding: '10px 14px', borderRadius: 10, border: `1px solid ${S.red}`, background: S.redB, color: S.red, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
                        ❌
                      </button>
                    )}
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
