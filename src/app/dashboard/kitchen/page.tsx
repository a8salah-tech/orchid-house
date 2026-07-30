'use client'


import { useEffect, useState, useRef, useCallback } from 'react'
import { createBrowserClient } from '@supabase/ssr'
// ⚠️ ملحوظة: عدّل مسار الاستيراد ده لو مكان الملف مختلف عن نمط dashboard/*/page.tsx المعتاد
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
  blue: '#3B82F6', blueB: 'rgba(59,130,246,0.12)',
  purple: '#8B5CF6', purpleB: 'rgba(139,92,246,0.12)',
  card: 'rgba(255,255,255,0.04)',
}

type OrderItem = {
  id: string; quantity: number; notes: string
  status: string; destination: string
  created_at: string; ready_at: string | null
  size_name?: string | null
  cancel_reason?: string | null
  cancelled_at?: string | null
  menu_items: { id: string; name: string; name_en: string }
}

type KitchenOrder = {
  id: string; status: string; created_at: string
  tables: { number: number; name: string; branch_id?: string; branches?: { name: string } }
  order_items: OrderItem[]
}

type WasteItem = { name: string; qty: number; reason: string; status: string; actionBy: string; time: string | null; dateKey: string; tableLabel: string }

function elapsed(iso: string) {
  const sec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
}

function urgencyColor(iso: string) {
  const min = (Date.now() - new Date(iso).getTime()) / 60000
  if (min > 20) return S.red
  if (min > 10) return S.amber
  return S.green
}

// ✅ يحسب مدة تحضير الصنف - من وقت ما دخل الطلب لحد ما اتعمل جاهز (أو لحد دلوقتي لو لسه شغال عليه)
// نفس شكل عرض عداد الأوردر بالظبط (H:MM:SS لو زادت عن ساعة، وإلا MM:SS)
function itemDuration(startIso: string, endIso?: string | null) {
  const start = new Date(startIso).getTime()
  const end = endIso ? new Date(endIso).getTime() : Date.now()
  const sec = Math.max(0, Math.floor((end - start) / 1000))
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

// ✅ جديد: تجميع أصناف الطلب في "جولات" - كل جولة هي مجموعة أصناف اتطلبت مع بعض في نفس اللحظة تقريبًا
// (زي أول 5 أصناف طلبهم العميل، وبعدين صنف سادس أضافه لاحقًا = جولة تانية منفصلة).
// كل جولة ليها وقتها الإجمالي الخاص بيها: من أول صنف دخل الجولة لحد آخر صنف فيها يخلص
function groupItemsIntoRounds(items: OrderItem[]) {
  const sorted = [...items].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
  const rounds: OrderItem[][] = []
  const TOLERANCE_MS = 8000 // ✅ أي أصناف اتضافت في نفس اللحظة (خلال 8 ثواني من بعض) تعتبر نفس الجولة
  for (const item of sorted) {
    const lastRound = rounds[rounds.length - 1]
    if (lastRound && new Date(item.created_at).getTime() - new Date(lastRound[lastRound.length - 1].created_at).getTime() <= TOLERANCE_MS) {
      lastRound.push(item)
    } else {
      rounds.push([item])
    }
  }
  return rounds.map((roundItems, idx) => {
    const activeItems = roundItems.filter(i => !['cancelled', 'returned', 'replaced'].includes(i.status))
    const allReady = activeItems.length > 0 && activeItems.every(i => i.status === 'ready')
    const roundStart = Math.min(...roundItems.map(i => new Date(i.created_at).getTime()))
    const roundEnd = allReady ? Math.max(...activeItems.map(i => new Date(i.ready_at!).getTime())) : null
    return { index: idx + 1, items: roundItems, allReady, roundStart, roundEnd }
  })
}

// ✅ Fix: نفس نغمة الكاشير بالظبط (نغمتين متتاليتين 880Hz ثم 1100Hz)، لكن بصوت أعلى (0.4 → 0.9، شبه أقصى مستوى آمن)
function playNewOrderBeep() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    const freqs = [880, 1100]
    const duration = 0.18
    freqs.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain); gain.connect(ctx.destination)
      osc.type = 'sine'; osc.frequency.value = freq
      const t = ctx.currentTime + i * (duration + 0.04)
      gain.gain.setValueAtTime(0.9, t) // ✅ أعلى من صوت الكاشير (0.4) بشكل ملحوظ
      gain.gain.exponentialRampToValueAtTime(0.001, t + duration)
      osc.start(t); osc.stop(t + duration)
    })
  } catch { /* المتصفح مش بيدعم Web Audio - نتجاهل بصمت */ }
}

// ══ Waste/Return Modal ══
function ItemActionModal({ item, orderId, onClose, onDone }: {
  item: OrderItem; orderId: string; onClose: () => void; onDone: () => void
}) {
  const sbRef = useRef(createClient())
  const sb = sbRef.current
  // ✅ جديد: نجيب اسم الموظف الحالي عشان نسجّله كـ"مين نفّذ العملية"
  const { employee } = useAuth()
  const actorName = employee?.name || employee?.name_en || 'Unknown'
  const [action, setAction] = useState<'return' | 'cancel' | 'replace' | null>(null)
  const [qty, setQty] = useState(item.quantity)
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  // ✅ Fix: حالة حفظ منفصلة تمامًا لزر "Mark Ready" - كانت بتشارك نفس الحالة مع باقي الأزرار، فلو أي زرار تاني
  // اتعلقت حالته "جاري الحفظ" بالغلط، كان بيأثر على الزرار ده ويمنعه من الاستجابة خالص (مؤشر "ممنوع" الرمادي)
  const [savingReady, setSavingReady] = useState(false)

  async function confirm() {
    if (!action) return
    setSaving(true)
    // ✅ Fix: السبب كان بيفضل في ذاكرة المتصفح بس، ميتحفظش في قاعدة البيانات خالص - فيختفي بمجرد ما حد يقفل الصفحة
    // أو يفتحها من جهاز تاني. دلوقتي بنحفظه فعليًا في عمود cancel_reason (بغض النظر عن الحالة النهائية)
    // ✅ جديد: بنسجّل كمان مين نفّذ العملية (action_by)
    if (action === 'cancel') {
      await sb.from('order_items').update({ status: 'cancelled', cancel_reason: reason || null, cancelled_at: new Date().toISOString(), action_by: actorName }).eq('id', item.id)
    } else if (action === 'return') {
      await sb.from('order_items').update({ status: 'returned', cancel_reason: reason || null, cancelled_at: new Date().toISOString(), action_by: actorName }).eq('id', item.id)
    } else if (action === 'replace') {
      await sb.from('order_items').update({ status: 'replaced', cancel_reason: reason || null, cancelled_at: new Date().toISOString(), action_by: actorName }).eq('id', item.id)
    }
    setSaving(false)
    onDone()
    onClose()
  }

  // ✅ Fix: عكسنا الاتجاه بالكامل بناءً على توضيح المستخدم - المطلوب مش "خليه Ready"، المطلوب "تراجع لو
  // اتعلّم Ready بالغلط" يعني يرجع لحالته الأصلية (لسه بيتحضّر، مش جاهز) عشان يفضل يتابعه عادي
  async function undoReady() {
    setSavingReady(true)
    // ✅ Fix حرج جدًا: استخدمت 'confirmed' قبل كده وهي قيمة مش موجودة في قيد status الفعلي بقاعدة البيانات
    // (order_items_status_check يسمح بس بـ: pending, preparing, ready, cancelled, returned, replaced, done).
    // الصح هو 'pending' - وهي نفس الحالة الأولية الحقيقية اللي بيتولد بيها أي صنف جديد في الكاشير
    const { data, error } = await sb.from('order_items').update({ status: 'pending', ready_at: null }).eq('id', item.id).select('id, status')
    setSavingReady(false)
    if (error) { alert('حصل خطأ: ' + error.message); console.error('undoReady error:', error); return }
    if (!data || data.length === 0) { alert('⚠️ التحديث لم يؤثر على أي صف'); console.error('undoReady: 0 rows affected, item.id =', item.id); return }
    onDone()
    onClose()
  }

  const inp: React.CSSProperties = { background: 'rgba(255,255,255,.06)', border: `1px solid ${S.border}`, borderRadius: 10, padding: '9px 14px', fontSize: 13, color: S.white, outline: 'none', width: '100%', boxSizing: 'border-box' as const, fontFamily: 'Tajawal, sans-serif' }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.85)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: S.navy2, borderRadius: 20, border: `1px solid ${S.border}`, width: '100%', maxWidth: 400, padding: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ color: S.white, fontSize: 16, fontWeight: 800 }}>
            {item.menu_items?.name_en || item.menu_items?.name}{item.size_name ? ` (${item.size_name})` : ''}
          </h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: S.muted, fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>

        {/* ✅ Fix: الزرار ده دلوقتي بيظهر بس لو الصنف اتعلّم "Ready" بالفعل (زي لو حد ضغط عليه بالغلط) -
            وبيرجّعه لحالته الأصلية (لسه بيتحضّر، التايمر يشتغل تاني، وزرار "✓ Ready" يرجع يظهر) */}
        {item.status === 'ready' && !action && (
          <button onClick={undoReady} disabled={savingReady}
            style={{ width: '100%', padding: '12px 8px', borderRadius: 12, border: `1px solid ${S.amber}`, background: S.amberB, color: S.amber, cursor: savingReady ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 700, fontFamily: 'Tajawal, sans-serif', marginBottom: 16 }}>
            {savingReady ? '⏳ Saving...' : '↩️ Undo — Not Ready Yet (accidental click)'}
          </button>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 20 }}>
          {[
            { k: 'return', label: '↩️ Return', color: S.amber },
            { k: 'cancel', label: '❌ Cancel', color: S.red },
            { k: 'replace', label: '🔄 Replace', color: S.blue },
          ].map(a => (
            <button key={a.k} onClick={() => setAction(a.k as any)}
              style={{ padding: '12px 8px', borderRadius: 12, border: `1px solid ${action === a.k ? a.color : S.border}`, background: action === a.k ? a.color + '20' : 'transparent', color: action === a.k ? a.color : S.muted, cursor: 'pointer', fontSize: 13, fontWeight: action === a.k ? 700 : 400, fontFamily: 'Tajawal, sans-serif' }}>
              {a.label}
            </button>
          ))}
        </div>

        {action && (
          <>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 6 }}>Quantity</label>
              <input type="number" style={inp} value={qty} min={1} max={item.quantity}
                onChange={e => setQty(parseInt(e.target.value) || 1)} />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 6 }}>Reason (optional)</label>
              <input style={inp} placeholder="e.g. Customer changed mind..." value={reason} onChange={e => setReason(e.target.value)} />
            </div>
            <button onClick={confirm} disabled={saving}
              style={{ width: '100%', padding: '12px', borderRadius: 12, border: 'none', background: action === 'cancel' ? S.red : action === 'return' ? S.amber : S.blue, color: S.white, cursor: 'pointer', fontWeight: 800, fontSize: 15, fontFamily: 'Tajawal, sans-serif' }}>
              {saving ? '⏳...' : 'Confirm'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

// ══ Shift Report Modal ══
function ShiftReportModal({ orders, waste, shiftStart, onClose }: {
  orders: KitchenOrder[]; waste: WasteItem[]; shiftStart: Date | null; onClose: () => void
}) {
  const now = new Date()
  const allItems = orders.flatMap(o => o.order_items.filter(i => i.status === 'ready'))
  const totalItems = allItems.reduce((s, i) => s + i.quantity, 0)

  // ✅ متوسط وقت التحضير لكل الأصناف اللي اتعملت جاهزة، محسوب من created_at لحد ready_at
  const itemsWithTiming = allItems.filter(i => i.ready_at)
  const avgPrepSeconds = itemsWithTiming.length > 0
    ? Math.round(itemsWithTiming.reduce((s, i) => s + (new Date(i.ready_at!).getTime() - new Date(i.created_at).getTime()) / 1000, 0) / itemsWithTiming.length)
    : 0
  const avgPrepLabel = avgPrepSeconds > 0 ? `${Math.floor(avgPrepSeconds / 60)}:${String(avgPrepSeconds % 60).padStart(2, '0')}` : '—'

  // ✅ جديد: متوسط "الوقت الإجمالي للجولة" (من أول صنف في الجولة لحد آخر صنف فيها يخلص) عبر كل الطلبات
  const allRoundDurations: number[] = []
  for (const o of orders) {
    for (const round of groupItemsIntoRounds(o.order_items)) {
      if (round.allReady && round.roundEnd) allRoundDurations.push((round.roundEnd - round.roundStart) / 1000)
    }
  }
  const avgRoundSeconds = allRoundDurations.length > 0 ? Math.round(allRoundDurations.reduce((s, x) => s + x, 0) / allRoundDurations.length) : 0
  const avgRoundLabel = avgRoundSeconds > 0 ? `${Math.floor(avgRoundSeconds / 60)}:${String(avgRoundSeconds % 60).padStart(2, '0')}` : '—'

  function printReport() {
    const win = window.open('', '_blank')
    if (!win) return
    const rows = orders.map((o, idx) => `
      <tr>
        <td>${idx + 1}</td>
        <td>${o.tables?.name || 'Table ' + o.tables?.number}</td>
        <td>#${o.id.slice(-6).toUpperCase()}</td>
        <td>${o.order_items.filter(i=>i.destination==='kitchen').map(i => `${i.menu_items?.name_en||i.menu_items?.name} ×${i.quantity}`).join(', ')}</td>
        <td>${o.order_items.some(i=>i.status==='ready') ? '✅ Ready' : '🔄 In Progress'}</td>
        <td>${new Date(o.created_at).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}</td>
      </tr>`).join('')

    const wasteRows = waste.map((w, i) => `
      <tr>
        <td>${i+1}</td>
        <td>${w.name}</td>
        <td>${w.qty}</td>
        <td>${w.reason}</td>
      </tr>`).join('')

    win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
    <title>Kitchen Shift Report</title>
    <style>
      body{font-family:Arial,sans-serif;font-size:11px;margin:15px;}
      h2{text-align:center;font-size:16px;margin-bottom:4px;}
      h3{text-align:center;font-size:12px;color:#555;margin-bottom:14px;}
      h4{font-size:13px;margin:16px 0 8px;border-bottom:2px solid #000;padding-bottom:4px;}
      table{width:100%;border-collapse:collapse;margin-bottom:16px;}
      th{background:#0A1628;color:#fff;padding:6px 8px;text-align:left;font-size:10px;}
      td{padding:5px 8px;border-bottom:1px solid #ddd;font-size:10px;}
      tr:nth-child(even){background:#f9f9f9;}
      .summary{display:flex;gap:16px;margin-bottom:16px;}
      .box{border:1px solid #ddd;border-radius:8px;padding:10px 16px;text-align:center;flex:1;}
      .box .val{font-size:20px;font-weight:bold;}
      @media print{@page{size:A4;margin:10mm;}}
    </style></head><body>
    <h2>🍳 Kitchen Shift Report</h2>
    <h3>${shiftStart ? 'Started: ' + shiftStart.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}) : ''} · Closed: ${now.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})} · ${now.toLocaleDateString('en-GB',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}</h3>
    <div class="summary">
      <div class="box"><div class="val">${orders.length}</div><div>Orders</div></div>
      <div class="box"><div class="val">${totalItems}</div><div>Items Prepared</div></div>
      <div class="box"><div class="val">${avgPrepLabel}</div><div>Avg Prep Time</div></div>
      <div class="box"><div class="val">${avgRoundLabel}</div><div>Avg Round Total Time</div></div>
      <div class="box"><div class="val">${waste.length}</div><div>Waste/Returns</div></div>
    </div>
    <h4>Orders</h4>
    <table><thead><tr><th>#</th><th>Table</th><th>Order #</th><th>Items</th><th>Status</th><th>Time</th></tr></thead>
    <tbody>${rows}</tbody></table>
    ${waste.length > 0 ? `
    <h4>Waste & Returns</h4>
    <table><thead><tr><th>#</th><th>Item</th><th>Qty</th><th>Reason</th></tr></thead>
    <tbody>${wasteRows}</tbody></table>` : ''}
    <script>window.onload=()=>window.print()<\/script>
    </body></html>`)
    win.document.close()
  }

  const thS: React.CSSProperties = { padding: '8px 12px', fontSize: 11, color: S.white, background: S.navy3, border: `1px solid ${S.border}`, textAlign: 'left' as const }
  const tdS: React.CSSProperties = { padding: '8px 12px', fontSize: 12, color: S.white, borderBottom: `1px solid ${S.border}` }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.9)', zIndex: 500, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 20, overflowY: 'auto' }}>
      <div style={{ background: S.navy2, borderRadius: 20, border: `1px solid ${S.border}`, width: '100%', maxWidth: 900, padding: 28, margin: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <h2 style={{ color: S.white, fontSize: 18, fontWeight: 800, marginBottom: 4 }}>🍳 Kitchen Shift Report</h2>
            <p style={{ fontSize: 12, color: S.muted }}>{now.toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={printReport} style={{ padding: '10px 18px', borderRadius: 10, border: `1px solid ${S.blue}`, background: S.blueB, color: S.blue, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>🖨️ Print</button>
            <button onClick={onClose} style={{ padding: '10px 18px', borderRadius: 10, border: `1px solid ${S.red}`, background: S.redB, color: S.red, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>✕ Close</button>
          </div>
        </div>

        {/* Summary */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 12, marginBottom: 20 }}>
          {[
            { label: 'Total Orders', value: orders.length, color: S.white },
            { label: 'Items Prepared', value: totalItems, color: S.green },
            { label: 'Avg Prep Time', value: avgPrepLabel, color: S.blue },
            { label: 'Avg Round Total Time', value: avgRoundLabel, color: S.gold },
            { label: 'Waste / Returns', value: waste.length, color: S.red },
          ].map((s, i) => (
            <div key={i} style={{ background: S.card, borderRadius: 14, padding: '14px 18px', border: `1px solid ${S.border}`, textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 900, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 12, color: S.muted, marginTop: 4 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Orders Table */}
        <div style={{ background: S.navy3, borderRadius: 12, overflow: 'hidden', border: `1px solid ${S.border}`, marginBottom: 20 }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>{['#', 'Table', 'Order #', 'Items', 'Status', 'Time'].map(h => <th key={h} style={thS}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {orders.map((o, i) => (
                  <tr key={o.id}>
                    <td style={tdS}>{i + 1}</td>
                    <td style={tdS}>{o.tables?.name || `Table ${o.tables?.number}`}</td>
                    <td style={{ ...tdS, color: S.gold }}>#{o.id.slice(-6).toUpperCase()}</td>
                    <td style={tdS}>{o.order_items.filter(i => i.destination === 'kitchen').map(i => `${i.menu_items?.name_en || i.menu_items?.name} ×${i.quantity}`).join(', ')}</td>
                    <td style={tdS}><span style={{ background: o.status === 'ready' ? S.greenB : S.amberB, color: o.status === 'ready' ? S.green : S.amber, borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 700 }}>{o.status === 'ready' ? '✅ Ready' : '🔄 In Progress'}</span></td>
                    <td style={{ ...tdS, color: S.muted }}>{new Date(o.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Waste Table */}
        {waste.length > 0 && (
          <>
            <h3 style={{ color: S.red, fontSize: 15, fontWeight: 700, marginBottom: 12 }}>🗑️ Waste & Returns</h3>
            <div style={{ background: S.navy3, borderRadius: 12, overflow: 'hidden', border: `1px solid ${S.border}` }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr>{['#', 'Item', 'Qty', 'Reason'].map(h => <th key={h} style={thS}>{h}</th>)}</tr></thead>
                <tbody>
                  {waste.map((w, i) => (
                    <tr key={i}>
                      <td style={tdS}>{i + 1}</td>
                      <td style={tdS}>{w.name}</td>
                      <td style={{ ...tdS, color: S.red }}>{w.qty}</td>
                      <td style={{ ...tdS, color: S.muted }}>{w.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ══ Main ══
export default function KitchenPage() {
  const sbRef = useRef(createClient())
  const sb = sbRef.current
  // ✅ جديد: كل فرع يشوف طلباته بس، والأدمن يشوف كل الفروع
  const { employee } = useAuth()
  const isAdmin = employee?.role === 'admin'
  const myBranchId = employee?.branch_id || ''

  const [orders, setOrders] = useState<KitchenOrder[]>([])
  const [allShiftOrders, setAllShiftOrders] = useState<KitchenOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [tick, setTick] = useState(0)
  const [notif, setNotif] = useState(false)
  const [actionItem, setActionItem] = useState<{ item: OrderItem; orderId: string } | null>(null)
  const [waste, setWaste] = useState<WasteItem[]>([])
  const [showReport, setShowReport] = useState(false)
  // ✅ جديد: مودال بسيط لعرض قائمة الهدر بضغطة واحدة، من غير الحاجة لإنهاء الشيفت
  const [showWasteList, setShowWasteList] = useState(false)
  // ✅ جديد: تاريخ قائمة الهدر - افتراضيًا النهاردة بتوقيت ماليزيا (UTC+8) بالظبط
  const [wasteDate, setWasteDate] = useState(() => new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().split('T')[0])
  // ✅ جديد: تصفح صفحات لقائمة الهدر - 50 في كل صفحة
  const [wastePage, setWastePage] = useState(0)
  const WASTE_PAGE_SIZE = 50
  const [shiftStarted, setShiftStarted] = useState(false)
  const [shiftStart, setShiftStart] = useState<Date | null>(null)
  // ✅ جديد: قسم الأرشيف - البحث بالتاريخ لمعرفة كم أوردر اتنفذ وكم كان معلّق/اتلغى في أي يوم فات
  const [viewMode, setViewMode] = useState<'live' | 'archive'>('live')
  const [archiveDate, setArchiveDate] = useState(new Date().toISOString().split('T')[0])
  const [archiveOrders, setArchiveOrders] = useState<any[]>([])
  const [archiveLoading, setArchiveLoading] = useState(false)
  // ✅ جديد: تصفح صفحات لجدول الأرشيف - 50 طلب في كل صفحة بدل عرضهم كلهم في صفحة واحدة طويلة
  const [archivePage, setArchivePage] = useState(0)
  const ARCHIVE_PAGE_SIZE = 50

  // ✅ جديد: جلب طلبات المطبخ ليوم محدد من الأرشيف (كل الحالات، مش النشطة بس) مع فلترة الفرع
  const fetchArchive = useCallback(async (date: string) => {
    setArchiveLoading(true)
    const dayStart = `${date}T00:00:00`
    const dayEnd = `${date}T23:59:59`
    const { data } = await sb.from('orders').select(`
      id, status, created_at,
      tables(number, name, branch_id, branches(name)),
      order_items(id, quantity, status, destination, created_at, ready_at, size_name, menu_items(id, name, name_en))
    `).gte('created_at', dayStart).lte('created_at', dayEnd)

    let dayOrders = ((data as any) || []).map((o: any) => ({
      ...o,
      order_items: o.order_items.filter((i: any) => i.destination === 'kitchen'),
    })).filter((o: any) => o.order_items.length > 0)

    if (!isAdmin && myBranchId) {
      dayOrders = dayOrders.filter((o: any) => o.tables?.branch_id === myBranchId)
    }
    setArchiveOrders(dayOrders)
    setArchiveLoading(false)
  }, [sb, isAdmin, myBranchId])

  useEffect(() => { if (viewMode === 'archive') fetchArchive(archiveDate) }, [viewMode, archiveDate, fetchArchive])
  useEffect(() => { setArchivePage(0) }, [archiveDate])

  const fetchOrders = useCallback(async () => {
    const { data } = await sb.from('orders').select(`
      id, status, created_at,
      tables(number, name, branch_id, branches(name)),
      order_items(id, quantity, notes, status, destination, created_at, ready_at, size_name, cancel_reason, cancelled_at, menu_items(id, name, name_en))
    `)
      // ✅ Fix: بنجيب الطلبات الملغاة كمان (مش بس confirmed/preparing/ready) - عشان تفضل ظاهرة في المطبخ بدل ما تختفي فورًا
      .in('status', ['confirmed', 'preparing', 'ready', 'cancelled']).order('created_at', { ascending: false }) // ✅ Fix: الطلب الأحدث دلوقتي يظهر أول واحد فوق

    let filtered = ((data as any) || []).map((o: KitchenOrder) => ({
      ...o,
      order_items: o.order_items.filter(i => i.destination === 'kitchen'),
    })).filter((o: KitchenOrder) => {
      if (o.order_items.length === 0) return false
      // ✅ جديد: الطلب الملغي بالكامل يفضل ظاهر بس لمدة 20 دقيقة من لحظة إلغائه، عشان المطبخ ياخد باله، وبعدها يختفي طبيعي (يفضل في الأرشيف)
      if (o.status === 'cancelled') {
        const cancelTimes = o.order_items.map(i => i.cancelled_at ? new Date(i.cancelled_at).getTime() : 0).filter(t => t > 0)
        const mostRecentCancel = cancelTimes.length > 0 ? Math.max(...cancelTimes) : 0
        return mostRecentCancel > 0 && (Date.now() - mostRecentCancel) < 20 * 60 * 1000
      }
      return o.order_items.some(i => !['cancelled','returned','replaced'].includes(i.status))
    })

    // ✅ Fix: ترتيب فعلي حسب "أحدث نشاط" مش وقت إنشاء الطلب بس - لو طاولة عندها طلب قديم وأضاف لها جولة
    // جديدة (أصناف إضافية)، كانت الطاولة تفضل في مكانها القديم في الترتيب ومحدش ياخد باله من الجولة الجديدة.
    // دلوقتي بنرتب حسب أحدث created_at لأي صنف جوه الطلب (يعني أحدث جولة)، مش وقت إنشاء الطلب الأصلي بس
    filtered = filtered.sort((a: KitchenOrder, b: KitchenOrder) => {
      const aLatest = Math.max(new Date(a.created_at).getTime(), ...a.order_items.map(i => new Date(i.created_at).getTime()))
      const bLatest = Math.max(new Date(b.created_at).getTime(), ...b.order_items.map(i => new Date(i.created_at).getTime()))
      return bLatest - aLatest
    })

    // ✅ جديد: كل فرع يشوف طلبات فرعه بس - الأدمن يشوف كل الفروع من غير أي فلترة
    if (!isAdmin && myBranchId) {
      filtered = filtered.filter((o: KitchenOrder) => o.tables?.branch_id === myBranchId)
    }

    setOrders(filtered)
    setAllShiftOrders(prev => {
      const existing = new Set(prev.map(o => o.id))
      const newOrders = filtered.filter((o: KitchenOrder) => !existing.has(o.id))
      return [...prev, ...newOrders]
    })
    setLoading(false)
  }, [sb, isAdmin, myBranchId])

  // ✅ Fix جذري: قائمة الهدر كانت بتتحسب من ذاكرة المتصفح بس (بتختفي لأي حد تاني، وبينهم الأدمن، يفتح الصفحة من جلسة تانية).
  // دلوقتي بنجيبها فعليًا من قاعدة البيانات - وبقت شاملة الإلغاء كمان (مش بس الإرجاع والاستبدال)، ومفلترة بيوم
  // محدد بتوقيت ماليزيا بالظبط (افتراضيًا النهاردة)، مش آخر 30 يوم مجمّعين مع بعض
  const fetchWaste = useCallback(async (dateStr: string) => {
    // ✅ حساب بداية ونهاية اليوم بتوقيت ماليزيا (UTC+8) بالظبط، مش توقيت السيرفر
    const dayStart = new Date(`${dateStr}T00:00:00+08:00`).toISOString()
    const dayEnd = new Date(`${dateStr}T23:59:59.999+08:00`).toISOString()
    const { data } = await sb.from('order_items').select(`
      quantity, cancel_reason, status, cancelled_at, created_at, action_by,
      menu_items(name, name_en),
      orders(table_id, tables(number, name, branch_id))
    `).in('status', ['returned', 'replaced', 'cancelled'])
      // ✅ الفلترة على وقت الإلغاء نفسه (مش وقت إنشاء الصنف الأصلي) - عشان "اليوم" يعني "اتلغى اليوم" فعليًا
      .gte('cancelled_at', dayStart).lte('cancelled_at', dayEnd).order('cancelled_at', { ascending: false })
    let items = ((data as any) || [])
    if (!isAdmin && myBranchId) {
      items = items.filter((i: any) => i.orders?.tables?.branch_id === myBranchId)
    }
    setWaste(items.map((i: any) => {
      const t = i.cancelled_at || i.created_at
      return {
        name: i.menu_items?.name_en || i.menu_items?.name || '—',
        qty: i.quantity,
        reason: i.cancel_reason || '—',
        status: i.status,
        actionBy: i.action_by || 'Unknown',
        time: t,
        dateKey: new Date(t).toISOString().split('T')[0],
        tableLabel: i.orders?.tables?.name || (i.orders?.tables?.number ? `Table ${i.orders.tables.number}` : '—'),
      }
    }))
  }, [sb, isAdmin, myBranchId])

  useEffect(() => { fetchOrders(); fetchWaste(wasteDate) }, [fetchOrders, fetchWaste, wasteDate])

  useEffect(() => {
    const ch = sb.channel('kitchen-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => { fetchOrders(); setNotif(true); playNewOrderBeep(); setTimeout(() => setNotif(false), 2000) })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, () => { fetchOrders(); fetchWaste(wasteDate) })
      .subscribe()
    return () => { sb.removeChannel(ch) }
  }, [sb, fetchOrders, fetchWaste])

  useEffect(() => {
    const t = setInterval(() => setTick(p => p + 1), 1000)
    return () => clearInterval(t)
  }, [])

  // Restore shift
  useEffect(() => {
    const s = localStorage.getItem('kitchen_shift_start')
    if (s) { setShiftStarted(true); setShiftStart(new Date(s)) }
  }, [])

  async function markItemReady(itemId: string, orderId: string) {
    await sb.from('order_items').update({ status: 'ready', ready_at: new Date().toISOString() }).eq('id', itemId)
    // ✅ Fix: نتأكد من حالة كل الأصناف مباشرة من قاعدة البيانات (مش من الـ state القديمة في الذاكرة)
    // السبب الأصلي للمشكلة: لو الشيف ضغط "Ready" على أكتر من صنف بسرعة قبل ما الصفحة تتحدث،
    // الفحص القديم كان بيعتمد على بيانات قديمة فيسيب الأوردر "معلّق" حتى لو كل الأصناف فعلاً جاهزة
    const { data: allItems } = await sb.from('order_items').select('id, status, destination').eq('order_id', orderId)
    const kitchenItems = (allItems || []).filter(i => i.destination === 'kitchen')
    const allKitchenReady = kitchenItems.length > 0 && kitchenItems.every(i => ['ready', 'cancelled', 'returned', 'replaced'].includes(i.status))
    if (allKitchenReady) {
      await sb.from('orders').update({ status: 'ready' }).eq('id', orderId)
    }
    fetchOrders()
  }

  function startShift() {
    const now = new Date()
    setShiftStarted(true); setShiftStart(now)
    localStorage.setItem('kitchen_shift_start', now.toISOString())
    setAllShiftOrders([])
    setWaste([])
  }

  function endShift() { setShowReport(true) }

  function closeReport() {
    setShowReport(false); setShiftStarted(false); setShiftStart(null)
    localStorage.removeItem('kitchen_shift_start')
    setAllShiftOrders([]); setWaste([])
  }

  const shiftElapsed = shiftStart ? elapsed(shiftStart.toISOString()) : null

  return (
    <div style={{ minHeight: '100vh', background: S.navy, fontFamily: 'Tajawal, sans-serif', direction: 'ltr' }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700;800;900&display=swap'); *{box-sizing:border-box;}`}</style>

      {notif && <div style={{ position: 'fixed', top: 0, left: 0, right: 0, height: 4, background: S.amber, zIndex: 999 }} />}

      {/* Header */}
      <div style={{ background: S.navy2, borderBottom: `1px solid ${S.border}`, padding: '0 20px', display: 'flex', alignItems: 'center', minHeight: 60, gap: 12, flexWrap: 'wrap', paddingTop: 10, paddingBottom: 10 }}>
        <h1 style={{ color: S.amber, fontSize: 18, fontWeight: 900 }}>🍳 Kitchen</h1>
        <div style={{ color: S.muted, fontSize: 13 }}>{orders.length} active orders</div>
        {/* ✅ جديد (ميزة إضافية 2): توزيع عدد الطلبات النشطة حسب الفرع - يظهر للأدمن بس اللي بيشوف كل الفروع */}
        {isAdmin && (() => {
          const byBranch: Record<string, number> = {}
          for (const o of orders) {
            const bname = o.tables?.branches?.name || 'Unknown'
            byBranch[bname] = (byBranch[bname] || 0) + 1
          }
          return Object.keys(byBranch).length > 1 ? (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {Object.entries(byBranch).map(([bname, count]) => (
                <span key={bname} style={{ fontSize: 11, color: S.purple, background: S.purpleB, borderRadius: 20, padding: '2px 10px', fontWeight: 700 }}>🏪 {bname}: {count}</span>
              ))}
            </div>
          ) : null
        })()}

        {/* Shift */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 8 }}>
          {!shiftStarted ? (
            <button onClick={startShift} style={{ padding: '6px 14px', borderRadius: 8, border: `1px solid ${S.green}`, background: S.greenB, color: S.green, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>▶ Start Shift</button>
          ) : (
            <>
              <span style={{ fontSize: 12, color: S.green, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>⏱ {shiftElapsed}</span>
              <button onClick={endShift} style={{ padding: '6px 14px', borderRadius: 8, border: `1px solid ${S.red}`, background: S.redB, color: S.red, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>⏹ End Shift</button>
            </>
          )}
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* ✅ Fix: الشارة بقت زر فعلي بيفتح قائمة الهدر مباشرة - كانت مجرد نص ثابت مفيهاش أي استجابة للضغط */}
          {waste.length > 0 && (
            <button onClick={() => setShowWasteList(true)}
              style={{ fontSize: 12, color: S.red, background: S.redB, border: `1px solid ${S.red}60`, borderRadius: 20, padding: '3px 10px', fontWeight: 700, cursor: 'pointer', fontFamily: 'Tajawal, sans-serif' }}>
              🗑️ {waste.length} waste
            </button>
          )}
          {/* ✅ جديد: تبديل بين الشاشة الحية والأرشيف */}
          <button onClick={() => setViewMode('live')} style={{ padding: '6px 12px', borderRadius: 8, border: `1px solid ${viewMode === 'live' ? S.green : S.border}`, background: viewMode === 'live' ? S.greenB : 'transparent', color: viewMode === 'live' ? S.green : S.muted, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>🟢 Live</button>
          <button onClick={() => setViewMode('archive')} style={{ padding: '6px 12px', borderRadius: 8, border: `1px solid ${viewMode === 'archive' ? S.blue : S.border}`, background: viewMode === 'archive' ? S.blueB : 'transparent', color: viewMode === 'archive' ? S.blue : S.muted, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>🗄️ Archive</button>
        </div>
      </div>

      <div style={{ padding: 16 }}>
        {viewMode === 'archive' ? (
          <div>
            {/* ✅ جديد: منتقي التاريخ لعرض إحصائيات أي يوم فات */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
              <label style={{ fontSize: 13, color: S.muted }}>📅 Select date:</label>
              <input type="date" value={archiveDate} onChange={e => setArchiveDate(e.target.value)}
                style={{ background: S.navy2, border: `1px solid ${S.border}`, borderRadius: 10, padding: '9px 12px', color: S.white, fontSize: 13, outline: 'none' }} />
            </div>
            {archiveLoading ? (
              <div style={{ textAlign: 'center', padding: 60, color: S.muted }}>⏳ Loading...</div>
            ) : (() => {
              // ✅ نحسب عدد الطلبات المكتملة (كل أصناف المطبخ فيها جاهزة)، والملغية بالكامل، والباقي (لسه شغال وقت انتهاء اليوم)
              const completed = archiveOrders.filter((o: any) => o.order_items.length > 0 && o.order_items.every((i: any) => i.status === 'ready' || i.status === 'cancelled' || i.status === 'returned' || i.status === 'replaced') && o.order_items.some((i: any) => i.status === 'ready'))
              const fullyCancelled = archiveOrders.filter((o: any) => o.order_items.length > 0 && o.order_items.every((i: any) => ['cancelled', 'returned', 'replaced'].includes(i.status)))
              const stillPending = archiveOrders.filter((o: any) => o.order_items.some((i: any) => !['ready', 'cancelled', 'returned', 'replaced'].includes(i.status)))
              const totalItemsDone = completed.reduce((s: number, o: any) => s + o.order_items.filter((i: any) => i.status === 'ready').reduce((s2: number, i: any) => s2 + i.quantity, 0), 0)
              return (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 24 }}>
                    {[
                      { label: 'Total Orders', value: archiveOrders.length, color: S.white },
                      { label: '✅ Completed', value: completed.length, color: S.green },
                      { label: '⏳ Pending / Not Finished', value: stillPending.length, color: S.amber },
                      { label: '❌ Fully Cancelled', value: fullyCancelled.length, color: S.red },
                      { label: 'Items Prepared', value: totalItemsDone, color: S.blue },
                    ].map((s, i) => (
                      <div key={i} style={{ background: S.card, borderRadius: 14, padding: '14px 18px', border: `1px solid ${S.border}`, textAlign: 'center' }}>
                        <div style={{ fontSize: 26, fontWeight: 900, color: s.color }}>{s.value}</div>
                        <div style={{ fontSize: 11, color: S.muted, marginTop: 4 }}>{s.label}</div>
                      </div>
                    ))}
                  </div>
                  {archiveOrders.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 60, color: S.muted }}>No orders found for this date</div>
                  ) : (() => {
                    // ✅ جديد: تصفح صفحات - 50 طلب في كل صفحة بدل عرضهم كلهم في صفحة واحدة طويلة
                    const totalArchivePages = Math.max(1, Math.ceil(archiveOrders.length / ARCHIVE_PAGE_SIZE))
                    const pageSafe = Math.min(archivePage, totalArchivePages - 1)
                    const pagedOrders = archiveOrders.slice(pageSafe * ARCHIVE_PAGE_SIZE, pageSafe * ARCHIVE_PAGE_SIZE + ARCHIVE_PAGE_SIZE)
                    return (
                    <>
                    <div style={{ background: S.navy2, borderRadius: 14, border: `1px solid ${S.border}`, overflow: 'hidden' }}>
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                          <thead>
                            <tr style={{ background: S.navy3 }}>
                              {['Table', 'Order #', ...(isAdmin ? ['Branch'] : []), 'Items', 'Status', 'Time'].map(h => (
                                <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 11, color: S.muted, fontWeight: 700, borderBottom: `1px solid ${S.border}` }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {pagedOrders.map((o: any) => {
                              const isDone = o.order_items.length > 0 && o.order_items.every((i: any) => ['ready', 'cancelled', 'returned', 'replaced'].includes(i.status)) && o.order_items.some((i: any) => i.status === 'ready')
                              const isCancelled = o.order_items.length > 0 && o.order_items.every((i: any) => ['cancelled', 'returned', 'replaced'].includes(i.status))
                              // ✅ جديد: فصل الأصناف الملغاة عن باقي الأصناف - كل مجموعة في سطر منفصل واضح
                              const activeItemsList = o.order_items.filter((i: any) => !['cancelled', 'returned', 'replaced'].includes(i.status))
                              const cancelledItemsList = o.order_items.filter((i: any) => ['cancelled', 'returned', 'replaced'].includes(i.status))
                              return (
                                <tr key={o.id} style={{ borderBottom: `1px solid ${S.border}` }}>
                                  <td style={{ padding: '10px 12px', color: S.white, fontSize: 13 }}>{o.tables?.name || `Table ${o.tables?.number}`}</td>
                                  <td style={{ padding: '10px 12px', color: S.gold, fontSize: 12 }}>#{o.id.slice(-6).toUpperCase()}</td>
                                  {isAdmin && <td style={{ padding: '10px 12px', color: S.purple, fontSize: 12 }}>{o.tables?.branches?.name || '—'}</td>}
                                  <td style={{ padding: '10px 12px', color: S.muted, fontSize: 12 }}>
                                    {activeItemsList.length > 0 && <div>{activeItemsList.map((i: any) => `${i.menu_items?.name_en || i.menu_items?.name} ×${i.quantity}`).join(', ')}</div>}
                                    {/* ✅ جديد: سطر منفصل واضح للأصناف الملغاة بس */}
                                    {cancelledItemsList.length > 0 && (
                                      <div style={{ color: S.red, marginTop: activeItemsList.length > 0 ? 4 : 0 }}>
                                        ❌ {cancelledItemsList.map((i: any) => `${i.menu_items?.name_en || i.menu_items?.name} ×${i.quantity}`).join(', ')}
                                      </div>
                                    )}
                                  </td>
                                  <td style={{ padding: '10px 12px' }}>
                                    <span style={{ background: isCancelled ? S.redB : isDone ? S.greenB : S.amberB, color: isCancelled ? S.red : isDone ? S.green : S.amber, borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 700 }}>
                                      {isCancelled ? '❌ Cancelled' : isDone ? '✅ Completed' : '⏳ Pending'}
                                    </span>
                                  </td>
                                  <td style={{ padding: '10px 12px', color: S.muted, fontSize: 12 }}>{new Date(o.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                    {/* ✅ جديد: أزرار تصفح الصفحات - 50 طلب في كل صفحة */}
                    {totalArchivePages > 1 && (
                      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, marginTop: 16 }}>
                        <button onClick={() => setArchivePage(p => Math.max(0, p - 1))} disabled={pageSafe === 0}
                          style={{ padding: '8px 16px', borderRadius: 10, border: `1px solid ${S.border}`, background: 'transparent', color: pageSafe === 0 ? S.muted + '60' : S.white, cursor: pageSafe === 0 ? 'not-allowed' : 'pointer', fontSize: 13 }}>
                          ← Previous
                        </button>
                        <span style={{ fontSize: 13, color: S.muted }}>Page {pageSafe + 1} of {totalArchivePages}</span>
                        <button onClick={() => setArchivePage(p => Math.min(totalArchivePages - 1, p + 1))} disabled={pageSafe >= totalArchivePages - 1}
                          style={{ padding: '8px 16px', borderRadius: 10, border: `1px solid ${S.border}`, background: 'transparent', color: pageSafe >= totalArchivePages - 1 ? S.muted + '60' : S.white, cursor: pageSafe >= totalArchivePages - 1 ? 'not-allowed' : 'pointer', fontSize: 13 }}>
                          Next →
                        </button>
                      </div>
                    )}
                    </>
                    )
                  })()}
                </>
              )
            })()}
          </div>
        ) : (
        <>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: S.muted, fontSize: 18 }}>⏳</div>
        ) : orders.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 80 }}>
            <div style={{ fontSize: 64, marginBottom: 16 }}>✅</div>
            <div style={{ color: S.white, fontSize: 20, fontWeight: 700 }}>No active orders</div>
            <div style={{ color: S.muted, fontSize: 14, marginTop: 8 }}>Waiting for orders...</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
            {(() => {
              // ✅ Fix: بما إن الترتيب بقى بالأحدث أولاً، لازم نحسب "أقدم طلب لسه مش جاهز" بشكل منفصل
              // عن ترتيب العرض، عشان شارة "الأولوية" تفضل تشاور على الطلب الصحيح مهما كان مكانه في الشبكة
              const unreadyOrders = orders.filter(o => o.status !== 'ready')
              const oldestOrderId = unreadyOrders.length > 0
                ? unreadyOrders.reduce((oldest, o) => new Date(o.created_at) < new Date(oldest.created_at) ? o : oldest).id
                : null
              return orders.map((order, orderIdx) => {
                const age = urgencyColor(order.created_at)
                const time = elapsed(order.created_at)
                const isOldestPriority = order.id === oldestOrderId
                // ✅ جديد: تجميع أصناف الطلب في جولات، كل جولة بوقتها الإجمالي الخاص بيها
                const rounds = groupItemsIntoRounds(order.order_items)
                return (
                  // ✅ Fix: الطلب الأحدث يظهر أول واحد فوق دلوقتي (ترتيب CSS صريح يطابق ترتيب البيانات)
                  <div key={order.id} style={{ background: S.navy2, borderRadius: 16, border: `2px solid ${isOldestPriority ? S.red : age + '40'}`, overflow: 'hidden', order: orderIdx }}>
                    <div style={{ height: 4, background: age }} />
                    <div style={{ padding: '14px 16px', borderBottom: `1px solid ${S.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        {/* ✅ شارة واضحة على أقدم طلب لسه مش جاهز - عشان يبقى مؤكد إنه الأولوية، بغض النظر عن مكانه في الشبكة */}
                        {isOldestPriority && (
                          <div style={{ fontSize: 10, color: S.red, fontWeight: 900, marginBottom: 2 }}>🔥 OLDEST — PRIORITY</div>
                        )}
                        <div style={{ color: S.white, fontWeight: 800, fontSize: 17 }}>{order.tables?.name || `Table ${order.tables?.number}`}</div>
                        <div style={{ fontSize: 11, color: S.muted }}>#{order.id.slice(-6).toUpperCase()}</div>
                      {/* ✅ جديد: شارة اسم الفرع - تظهر للأدمن بس (اللي بيشوف كل الفروع مع بعض) */}
                      {isAdmin && order.tables?.branches?.name && (
                        <div style={{ fontSize: 10, color: S.purple, background: S.purpleB, borderRadius: 20, padding: '1px 8px', display: 'inline-block', marginTop: 4, fontWeight: 700 }}>
                          🏪 {order.tables.branches.name}
                        </div>
                      )}
                      {/* ✅ جديد: تسجيل دخول وخروج الطلب بالكامل (Check-in / Check-out) */}
                      {(() => {
                        const activeItems = order.order_items.filter(i => !['cancelled', 'returned', 'replaced'].includes(i.status))
                        const allReady = activeItems.length > 0 && activeItems.every(i => i.status === 'ready')
                        const checkOutTime = allReady ? Math.max(...activeItems.map(i => new Date(i.ready_at!).getTime())) : null
                        return (
                          <div style={{ fontSize: 10, color: S.muted, marginTop: 4, lineHeight: 1.6 }}>
                            <div>🕐 Check-in: {new Date(order.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</div>
                            <div style={{ color: checkOutTime ? S.green : S.amber }}>
                              {checkOutTime ? `✅ Check-out: ${new Date(checkOutTime).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}` : '⏳ Check-out: in progress'}
                            </div>
                          </div>
                        )
                      })()}
                    </div>
                    <div style={{ color: order.status === 'ready' ? S.green : age, fontWeight: 900, fontSize: 22, fontVariantNumeric: 'tabular-nums' }}>
                      {order.status === 'ready' ? '✅ Done' : time}
                    </div>
                  </div>

                  <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {rounds.map(round => (
                      <div key={round.index}>
                        {/* ✅ جديد: عنوان الجولة مع الوقت الإجمالي لها (من أول صنف فيها لحد آخر صنف يخلص) */}
                        {rounds.length > 1 && (
                          <div style={{ fontSize: 11, color: S.gold, fontWeight: 800, marginBottom: 6, display: 'flex', justifyContent: 'space-between' }}>
                            <span>🔔 Round {round.index} ({round.items.length} item{round.items.length > 1 ? 's' : ''})</span>
                            <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                              {round.allReady && round.roundEnd
                                ? `✓ total: ${itemDuration(new Date(round.roundStart).toISOString(), new Date(round.roundEnd).toISOString())}`
                                : `⏱ ${itemDuration(new Date(round.roundStart).toISOString())}`}
                            </span>
                          </div>
                        )}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {round.items.map(item => {
                            // ✅ جديد: تمييز واضح للأصناف الملغاة/المرتجعة - كانت بتتعرض زي أي صنف عادي مستنّي، من غير أي إشارة إنها اتلغت
                            const isCancelled = ['cancelled', 'returned', 'replaced'].includes(item.status)
                            return (
                            <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: isCancelled ? S.redB : item.status === 'ready' ? S.greenB : S.card, borderRadius: 10, border: `1px solid ${isCancelled ? S.red + '60' : item.status === 'ready' ? S.green + '40' : S.border}`, opacity: isCancelled ? 0.75 : 1 }}>
                              <div>
                                <div style={{ color: isCancelled ? S.red : item.status === 'ready' ? S.green : S.white, fontWeight: 700, fontSize: 14, textDecoration: isCancelled ? 'line-through' : 'none' }}>
                                  {isCancelled ? '❌ ' : item.status === 'ready' ? '✅ ' : ''}{item.menu_items?.name_en || item.menu_items?.name}{item.size_name ? ` (${item.size_name})` : ''}
                                  <span style={{ color: isCancelled ? S.red : S.gold, marginLeft: 6, fontWeight: 900 }}>×{item.quantity}</span>
                                </div>
                                {isCancelled ? (
                                  <div style={{ fontSize: 11, color: S.red, marginTop: 2, fontWeight: 700 }}>
                                    ❌ CANCELLED{item.cancelled_at ? ` after ${itemDuration(item.created_at, item.cancelled_at)}` : ''}{item.cancel_reason ? ` — ${item.cancel_reason}` : ''}
                                  </div>
                                ) : (
                                  <div style={{ fontSize: 11, color: item.status === 'ready' ? S.green : S.muted, marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>
                                    {item.status === 'ready'
                                      ? (item.ready_at ? `✓ took ${itemDuration(item.created_at, item.ready_at)}` : '✓ Ready (time not tracked)')
                                      : `⏱ ${itemDuration(item.created_at)}`}
                                  </div>
                                )}
                                {item.notes && !isCancelled && <div style={{ color: S.amber, fontSize: 11, marginTop: 2 }}>⚠️ {item.notes}</div>}
                              </div>
                              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                                {/* ✅ Fix: زر Ready مبيظهرش خالص للصنف الملغي - مفيش حاجة تتحضّر */}
                                {!isCancelled && item.status !== 'ready' && (
                                  <button onClick={() => markItemReady(item.id, order.id)}
                                    style={{ padding: '7px 10px', borderRadius: 8, border: `1px solid ${S.green}`, background: S.greenB, color: S.green, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
                                    ✓ Ready
                                  </button>
                                )}
                                <button onClick={() => setActionItem({ item, orderId: order.id })}
                                  style={{ padding: '7px 10px', borderRadius: 8, border: `1px solid ${S.muted}`, background: 'transparent', color: S.muted, cursor: 'pointer', fontSize: 12 }}>
                                  •••
                                </button>
                              </div>
                            </div>
                          )})}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })
            })()}
          </div>
        )}
        </>
        )}
      </div>

      {/* Modals */}
      {actionItem && (
        <ItemActionModal
          item={actionItem.item} orderId={actionItem.orderId}
          onClose={() => setActionItem(null)}
          onDone={() => { fetchOrders(); fetchWaste(wasteDate) }}
        />
      )}

      {showReport && (
        <ShiftReportModal
          orders={allShiftOrders} waste={waste}
          shiftStart={shiftStart}
          onClose={closeReport}
        />
      )}

      {/* ✅ جديد: مودال قائمة الهدر المستقل - يفتح بضغطة واحدة من غير الحاجة لإنهاء الشيفت */}
      {showWasteList && (
        <div onClick={() => setShowWasteList(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.75)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: S.navy2, borderRadius: 20, border: `1px solid ${S.red}60`, padding: 20, maxWidth: 460, width: '100%', maxHeight: '85vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ color: S.red, fontSize: 16, fontWeight: 800 }}>🗑️ Waste, Returns & Cancellations ({waste.length})</h3>
              <button onClick={() => setShowWasteList(false)} style={{ background: 'transparent', border: 'none', color: S.muted, fontSize: 20, cursor: 'pointer' }}>✕</button>
            </div>
            {/* ✅ جديد: منتقي تاريخ - افتراضيًا النهاردة بتوقيت ماليزيا، وتقدر تختار أي يوم فات */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <label style={{ fontSize: 12, color: S.muted }}>📅</label>
              <input type="date" value={wasteDate} onChange={e => { setWasteDate(e.target.value); setWastePage(0) }}
                style={{ background: S.navy3, border: `1px solid ${S.border}`, borderRadius: 10, padding: '7px 10px', color: S.white, fontSize: 13, outline: 'none' }} />
              <span style={{ fontSize: 10, color: S.muted }}>(Malaysia time)</span>
            </div>
            {waste.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 30, color: S.muted, fontSize: 13 }}>No waste, returns or cancellations on this day</div>
            ) : (() => {
              const statusCfg: Record<string, { label: string; color: string }> = {
                cancelled: { label: '❌ Cancelled', color: S.red },
                returned: { label: '↩️ Returned', color: S.amber },
                replaced: { label: '🔄 Replaced', color: S.blue },
              }
              // ✅ جديد: تصفح صفحات - 50 في كل صفحة
              const totalWastePages = Math.max(1, Math.ceil(waste.length / WASTE_PAGE_SIZE))
              const wastePageSafe = Math.min(wastePage, totalWastePages - 1)
              const pagedWaste = waste.slice(wastePageSafe * WASTE_PAGE_SIZE, wastePageSafe * WASTE_PAGE_SIZE + WASTE_PAGE_SIZE)
              return (
                <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {pagedWaste.map((w, i) => {
                    const cfg = statusCfg[w.status] || { label: w.status, color: S.muted }
                    return (
                      <div key={i} style={{ background: S.card, border: `1px solid ${cfg.color}40`, borderRadius: 10, padding: '10px 14px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <span style={{ color: S.white, fontWeight: 700, fontSize: 13 }}>{w.name}</span>
                          <span style={{ color: cfg.color, fontWeight: 800, fontSize: 13 }}>×{w.qty}</span>
                        </div>
                        <div style={{ color: S.gold, fontSize: 11, fontWeight: 700, marginTop: 2 }}>🪑 {w.tableLabel}</div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                          <span style={{ color: cfg.color, fontSize: 11, fontWeight: 700 }}>{cfg.label}</span>
                          {w.time && <span style={{ color: S.muted, fontSize: 10 }}>{new Date(w.time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kuala_Lumpur' })}</span>}
                        </div>
                        <div style={{ color: S.muted, fontSize: 11, marginTop: 3 }}>👤 By: <span style={{ color: S.white }}>{w.actionBy}</span></div>
                        {w.reason && w.reason !== '—' && <div style={{ color: S.muted, fontSize: 11, marginTop: 2 }}>📝 {w.reason}</div>}
                      </div>
                    )
                  })}
                </div>
                {/* ✅ جديد: أزرار تصفح الصفحات */}
                {totalWastePages > 1 && (
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, marginTop: 16 }}>
                    <button onClick={() => setWastePage(p => Math.max(0, p - 1))} disabled={wastePageSafe === 0}
                      style={{ padding: '7px 14px', borderRadius: 10, border: `1px solid ${S.border}`, background: 'transparent', color: wastePageSafe === 0 ? S.muted + '60' : S.white, cursor: wastePageSafe === 0 ? 'not-allowed' : 'pointer', fontSize: 12 }}>
                      ← Previous
                    </button>
                    <span style={{ fontSize: 12, color: S.muted }}>Page {wastePageSafe + 1} of {totalWastePages}</span>
                    <button onClick={() => setWastePage(p => Math.min(totalWastePages - 1, p + 1))} disabled={wastePageSafe >= totalWastePages - 1}
                      style={{ padding: '7px 14px', borderRadius: 10, border: `1px solid ${S.border}`, background: 'transparent', color: wastePageSafe >= totalWastePages - 1 ? S.muted + '60' : S.white, cursor: wastePageSafe >= totalWastePages - 1 ? 'not-allowed' : 'pointer', fontSize: 12 }}>
                      Next →
                    </button>
                  </div>
                )}
                </>
              )
            })()}
          </div>
        </div>
      )}
    </div>
  )
}
