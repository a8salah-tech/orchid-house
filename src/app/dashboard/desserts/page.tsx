'use client'



import { useEffect, useState, useRef, useCallback } from 'react'
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
  amber: '#F59E0B', amberB: 'rgba(245,158,11,0.12)',
  pink: '#EC4899', pinkB: 'rgba(236,72,153,0.12)',
  purple: '#8B5CF6', purpleB: 'rgba(139,92,246,0.12)',
  card: 'rgba(255,255,255,0.04)',
}

type DessertsOrder = {
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

// ✅ Cake-related types (daily production + table distribution)
type CakeProduction = {
  id: string
  production_date: string
  quantity: number
  photo_urls: string[]
  produced_by_name: string | null
  branch_id: string | null
  notes: string | null
  created_at: string
}
type CakeTableLog = {
  id: string
  table_id: string | null
  quantity: number
  source: 'menu_order' | 'manual'
  logged_by_name: string | null
  notes: string | null
  created_at: string
  tables?: { number: number; name: string; branch_id: string | null }
}
type TableRow = { id: string; number: number; name: string; branch_id: string | null }
type Branch = { id: string; name: string }

function elapsed(iso: string) {
  const sec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

function urgencyColor(iso: string) {
  const min = (Date.now() - new Date(iso).getTime()) / 60000
  if (min > 15) return S.red
  if (min > 8)  return S.amber
  return S.pink
}

// ✅ Upload cake photos to Supabase Storage (instead of base64) - same pattern used across the project
async function uploadCakePhoto(sb: ReturnType<typeof createClient>, file: File): Promise<string | null> {
  const ext = file.name.split('.').pop() || 'jpg'
  const path = `cake_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`
  const { data, error } = await sb.storage.from('cake-photos').upload(path, file, { upsert: true, contentType: file.type })
  if (error) { console.error('Cake photo upload error:', error); return null }
  const { data: urlData } = sb.storage.from('cake-photos').getPublicUrl(data.path)
  return urlData.publicUrl
}

const CAKE_CATEGORY_ID = 'c349a109-48e3-4e13-af7f-c3bfe381b335' // "Cake" category in menu_categories

export default function DessertsPage() {
  const sbRef = useRef(createClient())
  const sb = sbRef.current
  const { employee, permissions } = useAuth()
  const isAdmin = permissions?.all === true
  const currentUserName = employee?.name || 'Unknown User'

  const [mainTab, setMainTab] = useState<'orders' | 'cake'>('orders')

  // ✅ Responsive: detect mobile viewport so the cake section can stack into a single column
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 860)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])


  const [orders, setOrders] = useState<DessertsOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [tick, setTick]     = useState(0)
  const [notif, setNotif]   = useState(false)

  // ✅ Cake section: daily production + table distribution
  const [branches, setBranches] = useState<Branch[]>([])
  const [tables, setTables] = useState<TableRow[]>([])
  const [cakeProductions, setCakeProductions] = useState<CakeProduction[]>([])
  const [cakeTableLogs, setCakeTableLogs] = useState<CakeTableLog[]>([])
  const [cakeLoading, setCakeLoading] = useState(false)

  // ✅ Date being viewed/searched - defaults to today, but can browse any past day
  const todayStr = new Date().toISOString().slice(0, 10)
  const [viewDate, setViewDate] = useState(todayStr)

  // ✅ Branch filter tabs at the top - shows stats for a specific branch or all branches combined
  const [branchFilter, setBranchFilter] = useState('') // '' = All Branches

  // Production entry form
  const [prodBranchId, setProdBranchId] = useState('')
  const [prodQty, setProdQty] = useState('')
  const [prodNotes, setProdNotes] = useState('')
  const [prodFiles, setProdFiles] = useState<File[]>([])
  const [prodSaving, setProdSaving] = useState(false)

  // Manual table distribution form
  const [logBranchId, setLogBranchId] = useState('')
  const [logTableId, setLogTableId] = useState('')
  const [logQty, setLogQty] = useState('1')
  const [logNotes, setLogNotes] = useState('')
  const [logSaving, setLogSaving] = useState(false)
  const prodFileInputRef = useRef<HTMLInputElement>(null)

  // ✅ Cumulative data (all days up to & including viewDate) - used to compute the real running "Remaining" total
  const [cumProductions, setCumProductions] = useState<{ quantity: number; branch_id: string | null }[]>([])
  const [cumTableLogs, setCumTableLogs] = useState<{ quantity: number; tables?: { branch_id: string | null } }[]>([])

  const fetchCakeData = useCallback(async () => {
    setCakeLoading(true)
    const [br, tbl, prod, logs, cumProd, cumLogs] = await Promise.all([
      sb.from('branches').select('id,name').eq('is_active', true).order('name'),
      sb.from('tables').select('id,number,name,branch_id').order('number'),
      sb.from('cake_production_log').select('*').eq('production_date', viewDate).order('created_at', { ascending: false }),
      sb.from('cake_table_log').select('*, tables(number,name,branch_id)').gte('created_at', `${viewDate}T00:00:00`).lt('created_at', `${viewDate}T23:59:59.999`).order('created_at', { ascending: false }),
      // ✅ everything ever produced up to and including viewDate (for the cumulative "Remaining" figure)
      sb.from('cake_production_log').select('quantity, branch_id').lte('production_date', viewDate),
      // ✅ everything ever distributed up to and including viewDate
      sb.from('cake_table_log').select('quantity, tables(branch_id)').lt('created_at', `${viewDate}T23:59:59.999`),
    ])
    setBranches(br.data || [])
    setTables(tbl.data || [])
    setCakeProductions(prod.data || [])
    setCakeTableLogs(logs.data || [])
    setCumProductions((cumProd.data as any) || [])
    setCumTableLogs((cumLogs.data as any) || [])
    setCakeLoading(false)
  }, [sb, viewDate])

  useEffect(() => { if (mainTab === 'cake') fetchCakeData() }, [mainTab, fetchCakeData])

  // ✅ Monthly stats - admin only
  const [statsMonth, setStatsMonth] = useState(todayStr.slice(0, 7)) // 'YYYY-MM'
  const [monthProduced, setMonthProduced] = useState(0)
  const [monthDistributed, setMonthDistributed] = useState(0)
  const [monthStatsLoading, setMonthStatsLoading] = useState(false)

  const fetchMonthlyStats = useCallback(async () => {
    if (!isAdmin) return
    setMonthStatsLoading(true)
    const [y, m] = statsMonth.split('-').map(Number)
    const monthStart = `${statsMonth}-01`
    const nextMonthStart = new Date(y, m, 1).toISOString().slice(0, 10) // first day of the following month
    const [prod, dist] = await Promise.all([
      sb.from('cake_production_log').select('quantity, branch_id').gte('production_date', monthStart).lt('production_date', nextMonthStart),
      sb.from('cake_table_log').select('quantity, tables(branch_id)').gte('created_at', `${monthStart}T00:00:00`).lt('created_at', `${nextMonthStart}T00:00:00`),
    ])
    const prodData = (prod.data as any[]) || []
    const distData = (dist.data as any[]) || []
    const prodFiltered = branchFilter ? prodData.filter(p => p.branch_id === branchFilter) : prodData
    const distFiltered = branchFilter ? distData.filter(l => l.tables?.branch_id === branchFilter) : distData
    setMonthProduced(prodFiltered.reduce((s, p) => s + p.quantity, 0))
    setMonthDistributed(distFiltered.reduce((s, l) => s + l.quantity, 0))
    setMonthStatsLoading(false)
  }, [sb, statsMonth, isAdmin, branchFilter])

  useEffect(() => { if (mainTab === 'cake' && isAdmin) fetchMonthlyStats() }, [mainTab, isAdmin, fetchMonthlyStats])

  async function submitCakeProduction() {
    if (!prodBranchId) { alert('Please select a branch'); return }
    const qty = parseInt(prodQty)
    if (!qty || qty <= 0) { alert('Please enter a valid number of cakes'); return }
    if (prodFiles.length === 0) { alert('Please add at least one proof photo'); return }
    setProdSaving(true)
    const photoUrls: string[] = []
    for (const file of prodFiles) {
      const url = await uploadCakePhoto(sb, file)
      if (url) photoUrls.push(url)
    }
    // ✅ Stop and warn if every photo failed to upload (e.g. storage bucket misconfigured) —
    // instead of silently saving a "proof" record with no proof at all
    if (photoUrls.length === 0) {
      setProdSaving(false)
      alert('Photo upload failed. Please check your connection and try again — the entry was NOT saved.')
      return
    }
    if (photoUrls.length < prodFiles.length) {
      alert(`Note: only ${photoUrls.length} of ${prodFiles.length} photo(s) uploaded successfully. Continuing with those.`)
    }
    const { error } = await sb.from('cake_production_log').insert([{
      production_date: viewDate,
      quantity: qty,
      photo_urls: photoUrls,
      produced_by_name: currentUserName,
      branch_id: prodBranchId,
      notes: prodNotes.trim() || null,
    }])
    setProdSaving(false)
    if (error) { alert('Error: ' + error.message); return }
    setProdQty(''); setProdNotes(''); setProdFiles([]); setProdBranchId('')
    fetchCakeData()
  }

  async function submitCakeTableLog() {
    if (!logBranchId) { alert('Please select a branch'); return }
    if (!logTableId) { alert('Please select a table'); return }
    const qty = parseInt(logQty)
    if (!qty || qty <= 0) { alert('Please enter a valid quantity'); return }
    setLogSaving(true)
    const { error } = await sb.from('cake_table_log').insert([{
      table_id: logTableId,
      quantity: qty,
      source: 'manual',
      logged_by_name: currentUserName,
      notes: logNotes.trim() || null,
    }])
    setLogSaving(false)
    if (error) { alert('Error: ' + error.message); return }
    setLogTableId(''); setLogQty('1'); setLogNotes('')
    fetchCakeData()
  }

  // ✅ Delete a production log entry (e.g. test/mistaken entries)
  async function deleteCakeProduction(id: string) {
    if (!confirm('Delete this production entry? This cannot be undone.')) return
    const { error } = await sb.from('cake_production_log').delete().eq('id', id)
    if (error) { alert('Error: ' + error.message); return }
    fetchCakeData()
  }

  // ✅ Delete a table distribution log entry
  async function deleteCakeTableLog(id: string) {
    if (!confirm('Delete this distribution entry? This cannot be undone.')) return
    const { error } = await sb.from('cake_table_log').delete().eq('id', id)
    if (error) { alert('Error: ' + error.message); return }
    fetchCakeData()
  }

  const tablesForSelectedBranch = tables.filter(t => t.branch_id === logBranchId)

  // ✅ Data filtered by the selected branch tab (empty = All Branches)
  const visibleProductions = branchFilter ? cakeProductions.filter(p => p.branch_id === branchFilter) : cakeProductions
  const visibleTableLogs = branchFilter ? cakeTableLogs.filter(l => l.tables?.branch_id === branchFilter) : cakeTableLogs

  const totalProducedForDate = visibleProductions.reduce((s, p) => s + p.quantity, 0)
  const totalDistributedForDate = visibleTableLogs.reduce((s, l) => s + l.quantity, 0)

  // ✅ Running/cumulative remaining = everything ever produced minus everything ever distributed, up to viewDate
  // (a leftover cake from a previous day carries over instead of resetting to 0 each day)
  const cumProducedFiltered = branchFilter ? cumProductions.filter(p => p.branch_id === branchFilter) : cumProductions
  const cumDistributedFiltered = branchFilter ? cumTableLogs.filter(l => l.tables?.branch_id === branchFilter) : cumTableLogs
  const cumulativeProduced = cumProducedFiltered.reduce((s, p) => s + p.quantity, 0)
  const cumulativeDistributed = cumDistributedFiltered.reduce((s, l) => s + l.quantity, 0)
  const remainingForDate = cumulativeProduced - cumulativeDistributed



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

    const filtered = ((data as any) || []).map((o: DessertsOrder) => ({
      ...o,
      order_items: o.order_items.filter(i => i.destination === 'desserts'),
    })).filter((o: DessertsOrder) => o.order_items.length > 0)

    setOrders(filtered)
    setLoading(false)
  }, [sb])

  useEffect(() => { fetchOrders() }, [fetchOrders])

  // Real-time
  useEffect(() => {
    const channel = sb.channel('desserts-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        fetchOrders()
        setNotif(true)
        setTimeout(() => setNotif(false), 2000)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, () => fetchOrders())
      .subscribe()
    return () => { sb.removeChannel(channel) }
  }, [sb, fetchOrders])

  // Timer - updates every second
  useEffect(() => {
    const t = setInterval(() => setTick(p => p + 1), 1000)
    return () => clearInterval(t)
  }, [])

  async function markItemReady(itemId: string, orderId: string) {
    await sb.from('order_items').update({ status: 'ready' }).eq('id', itemId)
    const order = orders.find(o => o.id === orderId)
    if (order) {
      const remaining = order.order_items.filter(i => i.id !== itemId && i.status !== 'ready')
      if (remaining.length === 0) {
// Re-check all items to avoid a race condition where two items are marked ready simultaneously
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
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, height: 4, background: S.pink, zIndex: 999 }} />
      )}

      {/* Header */}
      <div style={{ background: S.navy2, borderBottom: `1px solid ${S.border}`, padding: isMobile ? '10px 12px' : '0 24px', display: 'flex', alignItems: 'center', height: isMobile ? 'auto' : 60, minHeight: isMobile ? undefined : 60, gap: isMobile ? 8 : 12, position: 'sticky', top: 0, zIndex: 100, flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
        <h1 style={{ color: S.pink, fontSize: isMobile ? 16 : 20, fontWeight: 900, margin: 0 }}>🍰 شاشة الحلويات</h1>
        <div style={{ display: 'flex', gap: 6, marginRight: isMobile ? 0 : 12 }}>
          <button onClick={() => setMainTab('orders')} style={{ padding: '7px 14px', borderRadius: 9, border: `1px solid ${mainTab === 'orders' ? S.pink : S.border}`, background: mainTab === 'orders' ? S.pinkB : 'transparent', color: mainTab === 'orders' ? S.pink : S.muted, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>📋 Orders</button>
          <button onClick={() => setMainTab('cake')} style={{ padding: '7px 14px', borderRadius: 9, border: `1px solid ${mainTab === 'cake' ? S.gold : S.border}`, background: mainTab === 'cake' ? S.gold3 : 'transparent', color: mainTab === 'cake' ? S.gold : S.muted, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>🎂 Cake</button>
        </div>
        {mainTab === 'orders' && <div style={{ color: S.muted, fontSize: 13 }}>{orders.length} طلب قيد التحضير</div>}
        {!isMobile && <div style={{ marginRight: 'auto', fontSize: 12, color: S.muted }}>🟢 متصل · يتجدد تلقائياً</div>}
      </div>

      {mainTab === 'orders' ? (
      <div style={{ padding: 20 }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: S.muted, fontSize: 18 }}>⏳</div>
        ) : orders.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 80 }}>
            <div style={{ fontSize: 64, marginBottom: 16 }}>🍰</div>
            <div style={{ color: S.white, fontSize: 20, fontWeight: 700 }}>لا توجد طلبات حالياً</div>
            <div style={{ color: S.muted, fontSize: 14, marginTop: 8 }}>في انتظار الطلبات...</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
            {orders.map(order => {
              const age  = urgencyColor(order.created_at)
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
                      <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: item.status === 'ready' ? S.greenB : S.pinkB, borderRadius: 10, border: `1px solid ${item.status === 'ready' ? S.green + '40' : S.pink + '40'}` }}>
                        <div>
                          <div style={{ color: item.status === 'ready' ? S.green : S.white, fontWeight: 700, fontSize: 14 }}>
                            {item.status === 'ready' ? '✅ ' : '🍰 '}{item.menu_items?.name}
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
      ) : (
      <div style={{ padding: isMobile ? '12px' : 20, direction: 'ltr' }}>

        {/* ── Monthly Stats (Admin Only) ── */}
        {isAdmin && (
          <div style={{ background: `linear-gradient(135deg, ${S.navy2}, ${S.navy3})`, border: `1px solid ${S.gold}60`, borderRadius: 16, padding: isMobile ? 12 : 16, marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
              <span style={{ color: S.gold, fontWeight: 800, fontSize: 14 }}>👑 Admin Only — Monthly Stats</span>
              <input type="month" value={statsMonth} max={todayStr.slice(0, 7)} onChange={e => setStatsMonth(e.target.value)}
                style={{ padding: '6px 10px', borderRadius: 8, border: `1px solid ${S.border}`, background: S.navy3, color: S.white, fontSize: 12, marginLeft: isMobile ? 0 : 'auto' }} />
            </div>
            {monthStatsLoading ? (
              <div style={{ color: S.muted, fontSize: 13 }}>⏳ Loading...</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12 }}>
                <div style={{ background: S.navy, borderRadius: 12, padding: 14, textAlign: 'center' }}>
                  <div style={{ fontSize: 24, fontWeight: 900, color: S.gold }}>{monthProduced}</div>
                  <div style={{ fontSize: 11, color: S.muted, marginTop: 2 }}>🎂 Cakes produced this month</div>
                </div>
                <div style={{ background: S.navy, borderRadius: 12, padding: 14, textAlign: 'center' }}>
                  <div style={{ fontSize: 24, fontWeight: 900, color: S.pink }}>{monthDistributed}</div>
                  <div style={{ fontSize: 11, color: S.muted, marginTop: 2 }}>🍽️ Cakes distributed this month</div>
                </div>
              </div>
            )}
            <div style={{ fontSize: 10, color: S.muted, marginTop: 8 }}>
              {branchFilter ? `Filtered to: ${branches.find(b => b.id === branchFilter)?.name}` : 'Showing all branches combined'}
            </div>
          </div>
        )}

        {/* ── Branch filter tabs ── */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
          <button onClick={() => setBranchFilter('')}
            style={{ padding: '8px 16px', borderRadius: 10, border: `1px solid ${branchFilter === '' ? S.gold : S.border}`, background: branchFilter === '' ? S.gold3 : 'transparent', color: branchFilter === '' ? S.gold : S.muted, cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>
            🏢 All Branches
          </button>
          {branches.map(b => (
            <button key={b.id} onClick={() => setBranchFilter(b.id)}
              style={{ padding: '8px 16px', borderRadius: 10, border: `1px solid ${branchFilter === b.id ? S.gold : S.border}`, background: branchFilter === b.id ? S.gold3 : 'transparent', color: branchFilter === b.id ? S.gold : S.muted, cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>
              {b.name}
            </button>
          ))}
        </div>

        {/* ── Date search bar ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, background: S.navy2, borderRadius: 14, border: `1px solid ${S.border}`, padding: isMobile ? '10px 12px' : '12px 16px', flexWrap: 'wrap' }}>
          <span style={{ color: S.muted, fontSize: 13 }}>🔍 View date:</span>
          <input type="date" value={viewDate} max={todayStr} onChange={e => setViewDate(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: 8, border: `1px solid ${S.border}`, background: S.navy3, color: S.white, fontSize: 13 }} />
          {viewDate !== todayStr && (
            <button onClick={() => setViewDate(todayStr)} style={{ padding: '8px 12px', borderRadius: 8, border: `1px solid ${S.gold}`, background: S.gold3, color: S.gold, cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
              Back to Today
            </button>
          )}
          <span style={{ color: S.muted, fontSize: 12, marginLeft: isMobile ? 0 : 'auto' }}>
            {branchFilter ? branches.find(b => b.id === branchFilter)?.name : 'All Branches'} · {viewDate === todayStr ? 'Showing today' : `Showing ${viewDate}`}
          </span>
        </div>

        {/* ── Summary tabs for the selected date ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: isMobile ? 8 : 12, marginBottom: 20 }}>
          <div style={{ background: S.navy2, borderRadius: 14, border: `1px solid ${S.gold}40`, padding: isMobile ? '10px 6px' : 16, textAlign: 'center' }}>
            <div style={{ fontSize: isMobile ? 20 : 28, fontWeight: 900, color: S.gold }}>{totalProducedForDate}</div>
            <div style={{ fontSize: isMobile ? 10 : 12, color: S.muted, marginTop: 2 }}>🎂 Produced{!isMobile && ' (this day)'}</div>
          </div>
          <div style={{ background: S.navy2, borderRadius: 14, border: `1px solid ${S.pink}40`, padding: isMobile ? '10px 6px' : 16, textAlign: 'center' }}>
            <div style={{ fontSize: isMobile ? 20 : 28, fontWeight: 900, color: S.pink }}>{totalDistributedForDate}</div>
            <div style={{ fontSize: isMobile ? 10 : 12, color: S.muted, marginTop: 2 }}>🍽️ Distributed{!isMobile && ' (this day)'}</div>
          </div>
          <div style={{ background: S.navy2, borderRadius: 14, border: `1px solid ${remainingForDate < 0 ? S.red : S.green}40`, padding: isMobile ? '10px 6px' : 16, textAlign: 'center' }}>
            <div style={{ fontSize: isMobile ? 20 : 28, fontWeight: 900, color: remainingForDate < 0 ? S.red : S.green }}>{remainingForDate}</div>
            <div style={{ fontSize: isMobile ? 10 : 12, color: S.muted, marginTop: 2 }}>📦 Remaining{!isMobile && ' (running total)'}</div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '360px 1fr', gap: isMobile ? 16 : 20, alignItems: 'start' }}>

          {/* ── Forms column ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Production entry form */}
            <div style={{ background: S.navy2, borderRadius: 16, border: `1px solid ${S.gold}40`, padding: 16 }}>
              <div style={{ color: S.gold, fontWeight: 800, fontSize: 14, marginBottom: 4 }}>📦 Log Today's Cake Production</div>
              <div style={{ color: S.muted, fontSize: 11, marginBottom: 12 }}>Logging as: <span style={{ color: S.white, fontWeight: 700 }}>{currentUserName}</span></div>
              <select value={prodBranchId} onChange={e => setProdBranchId(e.target.value)}
                style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 10, border: `1px solid ${S.border}`, background: S.navy3, color: S.white, fontSize: 14, marginBottom: 8 }}>
                <option value="">-- Select Branch --</option>
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
              <input type="number" min={1} value={prodQty} onChange={e => setProdQty(e.target.value)} placeholder="Number of cakes"
                style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 10, border: `1px solid ${S.border}`, background: S.navy3, color: S.white, fontSize: 14, marginBottom: 8 }} />
              <textarea value={prodNotes} onChange={e => setProdNotes(e.target.value)} placeholder="Notes (optional)" rows={2}
                style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 10, border: `1px solid ${S.border}`, background: S.navy3, color: S.white, fontSize: 13, marginBottom: 8, resize: 'vertical' }} />
              <button type="button" onClick={() => prodFileInputRef.current?.click()}
                style={{ display: 'block', width: '100%', padding: '10px 12px', borderRadius: 10, border: `1px dashed ${prodFiles.length > 0 ? S.green : S.red}`, background: 'transparent', color: prodFiles.length > 0 ? S.green : S.muted, fontSize: 12, textAlign: 'center', cursor: 'pointer', marginBottom: 10 }}>
                📷 {prodFiles.length > 0 ? `${prodFiles.length} photo(s) selected: ${prodFiles.map(f => f.name).join(', ')}` : 'Add proof photo(s) (required)'}
              </button>
              <input ref={prodFileInputRef} type="file" accept="image/*" multiple style={{ display: 'none' }}
                onChange={e => setProdFiles(Array.from(e.target.files || []))} />
              <button onClick={submitCakeProduction} disabled={prodSaving}
                style={{ width: '100%', padding: 12, borderRadius: 10, border: 'none', background: S.gold, color: S.navy, fontWeight: 800, fontSize: 14, cursor: 'pointer', opacity: prodSaving ? 0.6 : 1 }}>
                {prodSaving ? '⏳ Saving...' : '✅ Log Production'}
              </button>
            </div>

            {/* Manual table distribution form */}
            <div style={{ background: S.navy2, borderRadius: 16, border: `1px solid ${S.pink}40`, padding: 16 }}>
              <div style={{ color: S.pink, fontWeight: 800, fontSize: 14, marginBottom: 4 }}>🍽️ Log Cake Given to a Table (Manual)</div>
              <div style={{ color: S.muted, fontSize: 11, marginBottom: 12 }}>Logging as: <span style={{ color: S.white, fontWeight: 700 }}>{currentUserName}</span></div>

              <select value={logBranchId} onChange={e => { setLogBranchId(e.target.value); setLogTableId('') }}
                style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 10, border: `1px solid ${S.border}`, background: S.navy3, color: S.white, fontSize: 14, marginBottom: 8 }}>
                <option value="">-- Select Branch --</option>
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>

              <select value={logTableId} onChange={e => setLogTableId(e.target.value)} disabled={!logBranchId}
                style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 10, border: `1px solid ${S.border}`, background: S.navy3, color: S.white, fontSize: 14, marginBottom: 8, opacity: logBranchId ? 1 : 0.5 }}>
                <option value="">{logBranchId ? '-- Select Table --' : '-- Select a branch first --'}</option>
                {tablesForSelectedBranch.map(t => <option key={t.id} value={t.id}>{t.name || `Table ${t.number}`}</option>)}
              </select>

              <input type="number" min={1} value={logQty} onChange={e => setLogQty(e.target.value)} placeholder="Number of cakes"
                style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 10, border: `1px solid ${S.border}`, background: S.navy3, color: S.white, fontSize: 14, marginBottom: 8 }} />
              <input value={logNotes} onChange={e => setLogNotes(e.target.value)} placeholder="Notes (optional)"
                style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 10, border: `1px solid ${S.border}`, background: S.navy3, color: S.white, fontSize: 13, marginBottom: 10 }} />
              <button onClick={submitCakeTableLog} disabled={logSaving}
                style={{ width: '100%', padding: 12, borderRadius: 10, border: 'none', background: S.pink, color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer', opacity: logSaving ? 0.6 : 1 }}>
                {logSaving ? '⏳ Saving...' : '✅ Log Distribution'}
              </button>
            </div>
          </div>

          {/* ── Logs column ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Production log for selected date */}
            <div>
              <div style={{ color: S.white, fontWeight: 800, fontSize: 15, marginBottom: 10 }}>📦 Production Log ({visibleProductions.length})</div>
              {cakeLoading ? (
                <div style={{ color: S.muted, fontSize: 13 }}>⏳ Loading...</div>
              ) : visibleProductions.length === 0 ? (
                <div style={{ color: S.muted, fontSize: 13, background: S.navy2, borderRadius: 12, padding: 16, textAlign: 'center' }}>No production logged for this date yet</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {visibleProductions.map(p => (
                    <div key={p.id} style={{ background: S.navy2, borderRadius: 12, border: `1px solid ${S.border}`, padding: 12, display: 'flex', gap: 12 }}>
                      {p.photo_urls?.length > 0 && (
                        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                          {p.photo_urls.slice(0, 3).map((url, i) => (
                            <img key={i} src={url} alt="Cake" style={{ width: 46, height: 46, borderRadius: 8, objectFit: 'cover', border: `1px solid ${S.border}` }} />
                          ))}
                        </div>
                      )}
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ color: S.gold, fontWeight: 800, fontSize: 15 }}>🎂 {p.quantity} cake(s)</span>
                          <span style={{ color: S.muted, fontSize: 11 }}>{new Date(p.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <div style={{ color: S.muted, fontSize: 12, marginTop: 2 }}>By: {p.produced_by_name || '—'}</div>
                        {p.notes && <div style={{ color: S.amber, fontSize: 11, marginTop: 2 }}>⚠️ {p.notes}</div>}
                      </div>
                      {isAdmin && (
                        <button onClick={() => deleteCakeProduction(p.id)} title="Delete"
                          style={{ alignSelf: 'flex-start', background: 'transparent', border: `1px solid ${S.red}`, borderRadius: 8, color: S.red, cursor: 'pointer', fontSize: 12, padding: '4px 8px', flexShrink: 0 }}>🗑️</button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Table distribution log for selected date */}
            <div>
              <div style={{ color: S.white, fontWeight: 800, fontSize: 15, marginBottom: 10 }}>🍽️ Table Distribution Log ({visibleTableLogs.length})</div>
              {cakeLoading ? (
                <div style={{ color: S.muted, fontSize: 13 }}>⏳ Loading...</div>
              ) : visibleTableLogs.length === 0 ? (
                <div style={{ color: S.muted, fontSize: 13, background: S.navy2, borderRadius: 12, padding: 16, textAlign: 'center' }}>No cakes distributed on this date yet</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {visibleTableLogs.map(l => (
                    <div key={l.id} style={{ background: S.navy2, borderRadius: 10, border: `1px solid ${S.border}`, padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <span style={{ color: S.white, fontWeight: 700, fontSize: 13 }}>
                          {l.tables?.name || `Table ${l.tables?.number ?? '—'}`}
                        </span>
                        <span style={{ color: S.gold, fontWeight: 800, marginLeft: 8 }}>×{l.quantity}</span>
                        {l.source === 'menu_order' ? (
                          <span style={{ background: S.purpleB, color: S.purple, fontSize: 10, padding: '2px 7px', borderRadius: 6, marginLeft: 8 }}>📱 From Menu</span>
                        ) : (
                          <span style={{ background: S.pinkB, color: S.pink, fontSize: 10, padding: '2px 7px', borderRadius: 6, marginLeft: 8 }}>✋ Manual — {l.logged_by_name || '—'}</span>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ color: S.muted, fontSize: 11 }}>{new Date(l.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
                        {isAdmin && (
                          <button onClick={() => deleteCakeTableLog(l.id)} title="Delete"
                            style={{ background: 'transparent', border: `1px solid ${S.red}`, borderRadius: 8, color: S.red, cursor: 'pointer', fontSize: 11, padding: '3px 7px' }}>🗑️</button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      )}
    </div>
  )
}
