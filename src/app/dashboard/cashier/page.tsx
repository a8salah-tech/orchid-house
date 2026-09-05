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
  gold: '#1E3A8A', gold2: '#3B5BC7', gold3: 'rgba(30,58,138,0.12)', goldB: 'rgba(30,58,138,0.22)',
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

// ✅ تجميع أصناف الطلب في "جولات" منفصلة — لو الفاصل الزمني بين صنف والتالي أكتر من دقيقتين، تعتبر جولة طلب جديدة
// (يحصل ده لما عميل تاني على نفس الطاولة يطلب طلب إضافي بعد فترة)
function groupItemsByRound(items: OrderItem[]): OrderItem[][] {
  const sorted = [...items].sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime())
  const rounds: OrderItem[][] = []
  const GAP_MS = 10 * 1000 // 10 ثواني
  for (const item of sorted) {
    const last = rounds[rounds.length - 1]
    const lastItem = last?.[last.length - 1]
    const gap = lastItem?.created_at && item.created_at
      ? new Date(item.created_at).getTime() - new Date(lastItem.created_at).getTime()
      : 0
    if (last && gap < GAP_MS) {
      last.push(item)
    } else {
      rounds.push([item])
    }
  }
  return rounds
}

// ✅ يحسب المدة اللي عدّت من وقت أول صنف في الجولة لحد دلوقتي (مثال: "منذ 12 د" أو "منذ 1س 5د")
function timeElapsedSince(dateStr?: string): string {
  if (!dateStr) return ''
  const diffMs = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  const remMins = mins % 60
  return remMins > 0 ? `${hrs}h ${remMins}m ago` : `${hrs}h ago`
}

// ✅ جديد: طباعة تقرير تفصيلي كامل لشيفت مقفول من تاب Closed - كل طاولة، كل صنف، كل تفصيلة من أول الشيفت لآخره
// ✅ جديد: بيرجّع قائمة الدفعات الحقيقية لأي فاتورة - لو عادية بيرجّع دفعة واحدة بطريقتها المسجّلة،
// ولو مقسّمة (split) بيرجّع كل الدفعات الفرعية الحقيقية من order_split_payments بدل ما تضيع تحت "split" عامة
function getPaymentBreakdown(order: Order, splitPayments: { order_id: string; amount: number; payment_method: string; card_bank: string | null }[]): { method: string; card_bank: string | null; amount: number }[] {
  if (order.payment_method === 'split') {
    const parts = splitPayments.filter(sp => sp.order_id === order.id)
    if (parts.length > 0) return parts.map(p => ({ method: p.payment_method, card_bank: p.card_bank, amount: p.amount }))
    return [] // مفيش تفاصيل متاحة (نادر) - نتجاهلها بدل ما نحسبها غلط
  }
  return [{ method: order.payment_method, card_bank: (order as any).card_bank || null, amount: order.total_amount || 0 }]
}

function printClosedShiftReport(session: { cashier_name: string; shift: string; started_at: string; ended_at: string | null }, sessOrders: Order[], expenses: { description: string; amount: number; status: string; created_at: string }[], totals: { cash: number; visa: number; visaMaybank: number; visaBsn: number; online: number; credit: number; discount: number; freeCount?: number; freeAmount?: number; deposits?: number; total: number; expPaid: number; expPending: number }, splitPayments: { order_id: string; amount: number; payment_method: string; card_bank: string | null }[] = []) {
  const win = window.open('', '_blank')
  if (!win) return
  const shiftLabel = session.shift === 'shift1' ? 'Shift 1' : session.shift === 'shift2' ? 'Shift 2' : 'Shift 3'
  const paidOrders = sessOrders.filter(o => o.status === 'paid').sort((a, b) => new Date(a.paid_at || a.created_at).getTime() - new Date(b.paid_at || b.created_at).getTime())
  const cancelledOrders = sessOrders.filter(o => o.status === 'cancelled')

  const orderRows = paidOrders.map((o, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${o.tables?.name || 'Table ' + o.tables?.number}</td>
      <td>#${o.id.slice(-6).toUpperCase()}</td>
      <td>${(o.order_items || []).filter(it => it.status !== 'cancelled').map(it => (it.menu_items?.name_en || it.menu_items?.name || '⚠️ Removed Item') + (it.size_name ? ' (' + it.size_name + ')' : '') + ' ×' + it.quantity).join(', ')}</td>
      <td>${o.payment_method === 'split'
          ? splitPayments.filter(sp => sp.order_id === o.id).map(sp => `${sp.payment_method.toUpperCase()}${sp.card_bank ? ' (' + sp.card_bank + ')' : ''} MYR ${sp.amount.toFixed(2)}`).join(' + ') || 'SPLIT'
          : `${o.payment_method?.toUpperCase() || '—'}${(o as any).card_bank ? ' (' + (o as any).card_bank + ')' : ''}`}</td>
      <td>${o.discount_amount > 0 ? 'MYR ' + o.discount_amount.toFixed(2) : (o.payment_method === 'free' ? 'FREE' : '—')}</td>
      <td>${o.notes ? o.notes.replace(/</g, '&lt;') : '—'}</td>
      <td>${o.paid_by_name || '—'}</td>
      <td><b>MYR ${(o.total_amount || 0).toFixed(2)}</b></td>
      <td>${o.paid_at ? new Date(o.paid_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
    </tr>`).join('')

  const cancelledRows = cancelledOrders.map((o, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${o.tables?.name || 'Table ' + o.tables?.number}</td>
      <td>#${o.id.slice(-6).toUpperCase()}</td>
      <td>${(o.order_items || []).map(it => (it.menu_items?.name_en || it.menu_items?.name || '⚠️ Removed Item') + ' ×' + it.quantity).join(', ')}</td>
      <td>${o.cancel_reason || '—'}</td>
      <td>${o.created_at ? new Date(o.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
    </tr>`).join('')

  const expenseRows = expenses.map((e, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${e.description}</td>
      <td>${e.status === 'paid' ? '✅ Paid' : '⏳ Pending'}</td>
      <td><b>MYR ${e.amount.toFixed(2)}</b></td>
      <td>${new Date(e.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</td>
    </tr>`).join('')

  win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
  <title>Shift Report — ${session.cashier_name} — ${shiftLabel}</title>
  <style>
    body { font-family: Arial, sans-serif; font-size: 11px; margin: 15px; color: #000; }
    h2 { text-align: center; font-size: 16px; margin-bottom: 4px; }
    h3 { text-align: center; font-size: 12px; color: #555; margin-bottom: 4px; }
    h4 { font-size: 13px; margin: 18px 0 8px; border-bottom: 2px solid #1E3A8A; padding-bottom: 4px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
    th { background: #0A1628; color: #fff; padding: 6px 8px; text-align: left; font-size: 10px; }
    td { padding: 5px 8px; border-bottom: 1px solid #ddd; font-size: 10px; }
    tr:nth-child(even) { background: #f9f9f9; }
    .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 16px 0; }
    .summary-box { border: 1px solid #ddd; border-radius: 8px; padding: 10px; text-align: center; }
    .summary-box .label { font-size: 10px; color: #666; margin-bottom: 4px; }
    .summary-box .value { font-size: 15px; font-weight: bold; color: #000; }
    .total-row { background: #1E3A8A !important; font-weight: bold; color: #fff; }
    .no-data { color: #999; font-size: 11px; padding: 8px 0; }
    @media print { @page { size: A4 landscape; margin: 10mm; } }
  </style></head><body>
  <h2>🌸 Orchid House — Full Shift Report</h2>
  <h3>🧑‍💼 ${session.cashier_name} · ${shiftLabel}</h3>
  <h3>Started: ${new Date(session.started_at).toLocaleString('en-GB')} ${session.ended_at ? '· Ended: ' + new Date(session.ended_at).toLocaleString('en-GB') : '· 🟢 Still Active (printed at ' + new Date().toLocaleTimeString('en-GB') + ')'}</h3>

  <div class="summary">
    <div class="summary-box"><div class="label">💵 Cash</div><div class="value">MYR ${totals.cash.toFixed(2)}</div></div>
    <div class="summary-box"><div class="label">💳 Visa (Maybank ${totals.visaMaybank.toFixed(2)} · BSN ${totals.visaBsn.toFixed(2)})</div><div class="value">MYR ${totals.visa.toFixed(2)}</div></div>
    <div class="summary-box"><div class="label">📱 Bank Transfer</div><div class="value">MYR ${totals.online.toFixed(2)}</div></div>
    <div class="summary-box"><div class="label">🧾 Credit (Grab/Foodpanda)</div><div class="value">MYR ${totals.credit.toFixed(2)}</div></div>
    <div class="summary-box"><div class="label">🏷️ Discounts</div><div class="value">MYR ${totals.discount.toFixed(2)}</div></div>
    <div class="summary-box"><div class="label">🆓 Free Tables (${totals.freeCount || 0})</div><div class="value">MYR ${(totals.freeAmount || 0).toFixed(2)}</div></div>
    <div class="summary-box"><div class="label">💰 Deposits</div><div class="value">MYR ${(totals.deposits || 0).toFixed(2)}</div></div>
    <div class="summary-box"><div class="label">💸 Expenses Paid</div><div class="value">MYR ${totals.expPaid.toFixed(2)}</div></div>
    <div class="summary-box"><div class="label">⏳ Expenses Pending</div><div class="value">MYR ${totals.expPending.toFixed(2)}</div></div>
    <div class="summary-box" style="background:#1E3A8A;border-color:#1E3A8A;"><div class="label" style="color:#cbd5e1;">💰 Total Sales</div><div class="value" style="color:#fff;">MYR ${totals.total.toFixed(2)}</div></div>
  </div>

  <h4>📋 All Paid Orders (${paidOrders.length})</h4>
  ${paidOrders.length ? `<table>
    <thead><tr><th>#</th><th>Table</th><th>Order #</th><th>Items</th><th>Payment</th><th>Discount</th><th>Reason</th><th>Cashier</th><th>Total</th><th>Time</th></tr></thead>
    <tbody>${orderRows}
      <tr class="total-row"><td colspan="8">TOTAL — ${paidOrders.length} orders</td><td>MYR ${totals.total.toFixed(2)}</td><td>—</td></tr>
    </tbody>
  </table>` : `<div class="no-data">No paid orders in this shift.</div>`}

  ${cancelledOrders.length ? `
  <h4>❌ Cancelled Orders (${cancelledOrders.length})</h4>
  <table>
    <thead><tr><th>#</th><th>Table</th><th>Order #</th><th>Items</th><th>Reason</th><th>Time</th></tr></thead>
    <tbody>${cancelledRows}</tbody>
  </table>` : ''}

  <h4>💸 Cash Expenses (${expenses.length})</h4>
  ${expenses.length ? `<table>
    <thead><tr><th>#</th><th>Description</th><th>Status</th><th>Amount</th><th>Time</th></tr></thead>
    <tbody>${expenseRows}</tbody>
  </table>` : `<div class="no-data">No expenses recorded in this shift.</div>`}

  <script>window.onload=()=>window.print()<\/script>
  </body></html>`)
  win.document.close()
}

// ✅ جديد: طباعة ملخص مجمّع (أصناف مجمّعة + بند لكل نوع مصروف/دفع) - نفس منطق شاشة الملخص المجمّع بالظبط،
// تُستخدم لكل من طباعة "يوم كامل" (Whole Day Total) وطباعة "شيفت واحد" من نافذة الملخص المجمّع
function printAggregatedReport(title: string, subtitle: string, orders: Order[], totals: {
  cash: number; visa: number; visaMaybank: number; visaBsn: number; online: number; credit: number
  discount: number; freeCount: number; freeAmount: number; deposits: number; total: number; expPaid: number; expPending: number
}) {
  const win = window.open('', '_blank')
  if (!win) return
  const paidOrders = orders.filter(o => o.status === 'paid')

  const itemMap = new Map<string, { name: string; qty: number; revenue: number }>()
  paidOrders.forEach(o => {
    (o.order_items || []).filter(it => it.status !== 'cancelled').forEach(it => {
      const label = (it.menu_items?.name_en || it.menu_items?.name || '⚠️ Removed Item') + (it.size_name ? ` (${it.size_name})` : '')
      const cur = itemMap.get(label) || { name: label, qty: 0, revenue: 0 }
      cur.qty += it.quantity || 0
      cur.revenue += (it.unit_price || 0) * (it.quantity || 0)
      itemMap.set(label, cur)
    })
  })
  const itemRows = [...itemMap.values()].sort((a, b) => b.qty - a.qty)
  const totalUnits = itemRows.reduce((s, r) => s + r.qty, 0)

  const rows = itemRows.map((r, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${r.name}</td>
      <td>${r.qty}</td>
      <td><b>MYR ${r.revenue.toFixed(2)}</b></td>
    </tr>`).join('')

  win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
  <title>${title} — ${subtitle}</title>
  <style>
    body { font-family: Arial, sans-serif; font-size: 11px; margin: 15px; color: #000; }
    h2 { text-align: center; font-size: 16px; margin-bottom: 4px; }
    h3 { text-align: center; font-size: 12px; color: #555; margin-bottom: 4px; }
    h4 { font-size: 13px; margin: 18px 0 8px; border-bottom: 2px solid #1E3A8A; padding-bottom: 4px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
    th { background: #0A1628; color: #fff; padding: 6px 8px; text-align: left; font-size: 10px; }
    td { padding: 5px 8px; border-bottom: 1px solid #ddd; font-size: 10px; }
    tr:nth-child(even) { background: #f9f9f9; }
    .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 16px 0; }
    .summary-box { border: 1px solid #ddd; border-radius: 8px; padding: 10px; text-align: center; }
    .summary-box .label { font-size: 10px; color: #666; margin-bottom: 4px; }
    .summary-box .value { font-size: 15px; font-weight: bold; color: #000; }
    .total-row { background: #1E3A8A !important; font-weight: bold; color: #fff; }
    .no-data { color: #999; font-size: 11px; padding: 8px 0; }
    @media print { @page { size: A4 portrait; margin: 10mm; } }
  </style></head><body>
  <h2>🌸 Orchid House — ${title}</h2>
  <h3>${subtitle}</h3>

  <div class="summary">
    <div class="summary-box"><div class="label">📋 Paid Orders</div><div class="value">${paidOrders.length}</div></div>
    <div class="summary-box"><div class="label">🍽️ Items Sold</div><div class="value">${totalUnits}</div></div>
    <div class="summary-box"><div class="label">💵 Cash</div><div class="value">MYR ${totals.cash.toFixed(2)}</div></div>
    <div class="summary-box"><div class="label">💳 Visa (Maybank ${totals.visaMaybank.toFixed(2)} · BSN ${totals.visaBsn.toFixed(2)})</div><div class="value">MYR ${totals.visa.toFixed(2)}</div></div>
    <div class="summary-box"><div class="label">📱 Bank Transfer</div><div class="value">MYR ${totals.online.toFixed(2)}</div></div>
    <div class="summary-box"><div class="label">🧾 Credit (Grab/Foodpanda)</div><div class="value">MYR ${totals.credit.toFixed(2)}</div></div>
    <div class="summary-box"><div class="label">🏷️ Discounts</div><div class="value">MYR ${totals.discount.toFixed(2)}</div></div>
    <div class="summary-box"><div class="label">🆓 Free Tables (${totals.freeCount})</div><div class="value">MYR ${totals.freeAmount.toFixed(2)}</div></div>
    <div class="summary-box"><div class="label">💰 Deposits</div><div class="value">MYR ${totals.deposits.toFixed(2)}</div></div>
    <div class="summary-box"><div class="label">💸 Expenses Paid</div><div class="value">MYR ${totals.expPaid.toFixed(2)}</div></div>
    <div class="summary-box"><div class="label">⏳ Expenses Pending</div><div class="value">MYR ${totals.expPending.toFixed(2)}</div></div>
    <div class="summary-box" style="background:#1E3A8A;border-color:#1E3A8A;"><div class="label" style="color:#cbd5e1;">💰 Total Sales</div><div class="value" style="color:#fff;">MYR ${totals.total.toFixed(2)}</div></div>
  </div>

  <h4>🍽️ Items Sold — Grouped (${itemRows.length} distinct items)</h4>
  ${itemRows.length ? `<table>
    <thead><tr><th>#</th><th>Item</th><th>Qty</th><th>Revenue</th></tr></thead>
    <tbody>${rows}
      <tr class="total-row"><td colspan="2">TOTAL</td><td>${totalUnits}</td><td>MYR ${itemRows.reduce((s, r) => s + r.revenue, 0).toFixed(2)}</td></tr>
    </tbody>
  </table>` : `<div class="no-data">No paid orders.</div>`}

  <script>window.onload=()=>window.print()<\/script>
  </body></html>`)
  win.document.close()
}

// ══ Shift Item Summary Modal ══
// ✅ جديد: ملخص مجمّع على الشاشة لكل أصناف الشيفت (كام شاورما، كام مياه...) - نفس بيانات التقرير المطبوع
// بس متجمّعة في شاشة واحدة سهلة القراءة بدل جدول تفصيلي طلب-طلب
function ShiftItemSummaryModal({ data, onClose }: {
  data: {
    session: { cashier_name: string; shift: string; started_at: string; ended_at: string | null }; sessOrders: Order[]
    cash: number; visa: number; visaMaybank: number; visaBsn: number; online: number; credit: number
    discount: number; freeCount: number; freeAmount: number; deposits: number; total: number; expPaid: number; expPending: number
  }
  onClose: () => void
}) {
  const { session, sessOrders, discount, freeCount, freeAmount, deposits, total } = data
  const shiftLabel = session.shift === 'shift1' ? 'Shift 1' : session.shift === 'shift2' ? 'Shift 2' : 'Shift 3'
  const paidOrders = sessOrders.filter(o => o.status === 'paid')

  const itemMap = new Map<string, { name: string; qty: number; revenue: number }>()
  paidOrders.forEach(o => {
    (o.order_items || []).filter(it => it.status !== 'cancelled').forEach(it => {
      const label = (it.menu_items?.name_en || it.menu_items?.name || '⚠️ Removed Item') + (it.size_name ? ` (${it.size_name})` : '')
      const cur = itemMap.get(label) || { name: label, qty: 0, revenue: 0 }
      cur.qty += it.quantity || 0
      cur.revenue += (it.unit_price || 0) * (it.quantity || 0)
      itemMap.set(label, cur)
    })
  })
  const itemRows = [...itemMap.values()].sort((a, b) => b.qty - a.qty)
  const totalUnits = itemRows.reduce((s, r) => s + r.qty, 0)

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 500, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 20, overflowY: 'auto' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: S.navy2, borderRadius: 20, border: `1px solid ${S.border}`, width: '100%', maxWidth: 560, padding: 24, margin: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div>
            <h2 style={{ color: S.white, fontSize: 16, fontWeight: 800 }}>📊 Item Summary</h2>
            <p style={{ fontSize: 12, color: S.muted, marginTop: 4 }}>
              🧑‍💼 {session.cashier_name} · {shiftLabel} · Started {new Date(session.started_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
              {session.ended_at ? ` · Ended ${new Date(session.ended_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}` : ' · 🟢 Still Active'}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button onClick={() => printAggregatedReport('Shift Summary', `${session.cashier_name} · ${shiftLabel}`, sessOrders, data)}
              style={{ padding: '7px 14px', borderRadius: 8, border: `1px solid ${S.blue}`, background: S.blueB, color: S.blue, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', fontWeight: 700, whiteSpace: 'nowrap' }}>
              🖨️ Print
            </button>
            <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: S.muted, fontSize: 20, cursor: 'pointer' }}>✕</button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 10, marginBottom: 18 }}>
          {[
            { label: 'Paid Orders', value: paidOrders.length, color: S.blue, icon: '📋' },
            { label: 'Items Sold', value: totalUnits, color: S.green, icon: '🍽️' },
            { label: `Free Tables (${freeCount})`, value: `MYR ${freeAmount.toFixed(2)}`, color: S.amber, icon: '🆓' },
            { label: 'Discounts', value: `MYR ${discount.toFixed(2)}`, color: S.red, icon: '🏷️' },
            { label: 'Deposits', value: `MYR ${deposits.toFixed(2)}`, color: S.teal, icon: '💰' },
            { label: 'Total', value: `MYR ${total.toFixed(2)}`, color: S.gold, icon: '💰' },
          ].map((s, i) => (
            <div key={i} style={{ background: S.card, borderRadius: 12, padding: '10px 12px', border: `1px solid ${S.border}`, textAlign: 'center' }}>
              <div style={{ fontSize: 16, marginBottom: 4 }}>{s.icon}</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 10, color: S.muted, marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>

        <div style={{ fontSize: 12, fontWeight: 700, color: S.white, marginBottom: 8 }}>🍽️ Items (grouped, most sold first)</div>
        {itemRows.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 24, color: S.muted, fontSize: 12 }}>No paid orders in this shift.</div>
        ) : (
          <div style={{ background: S.navy3, borderRadius: 12, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.04)' }}>
                  <th style={{ padding: '8px 12px', textAlign: 'left', color: S.muted, fontWeight: 700 }}>Item</th>
                  <th style={{ padding: '8px 12px', textAlign: 'center', color: S.muted, fontWeight: 700 }}>Qty</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right', color: S.muted, fontWeight: 700 }}>Revenue</th>
                </tr>
              </thead>
              <tbody>
                {itemRows.map((r, i) => (
                  <tr key={i} style={{ borderTop: `1px solid ${S.border}` }}>
                    <td style={{ padding: '8px 12px', color: S.white }}>{r.name}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'center', color: S.gold, fontWeight: 800 }}>×{r.qty}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', color: S.muted }}>MYR {r.revenue.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <button onClick={onClose} style={{ width: '100%', marginTop: 18, padding: '10px 0', borderRadius: 10, border: `1px solid ${S.border}`, background: 'transparent', color: S.muted, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif' }}>
          Close
        </button>
      </div>
    </div>
  )
}

type TableRow = { id: string; number: number; name: string; status: string; is_active: boolean; branch_id?: string; occupied_since?: string | null; current_order_id?: string | null }
type OrderItem = { id: string; quantity: number; unit_price: number; notes: string; size_name?: string | null; destination: string; status: string; created_at?: string; cancel_reason?: string | null; menu_items: { name: string; name_en: string; or_code?: string } }
type Order = {
  id: string; table_id: string; status: string; total_amount: number
  discount_amount: number; discount_type: string; payment_method: string
  service_charge: number; sst_amount: number; shift: string
  notes: string; created_at: string; confirmed_at: string; paid_at?: string
  customer_id?: string | null; cancel_reason?: string | null; paid_by_name?: string | null
  tables: { number: number; name: string; section?: string | null }
  order_items: OrderItem[]
}
type MenuItem = { id: string; name: string; name_en: string; price: number; category_id: string; or_code?: string; menu_categories?: { name: string } | { name: string }[]
  // ✅ جديد: هل الصنف لسه مفعّل في المنيو (مش محذوف)؟ - nullable لأن صفوف قديمة ممكن ماتبقاش مسجّلة له قيمة أصلًا
  is_active?: boolean | null
  // ✅ جديد: أنواع/أحجام الصنف (زي أنواع الشيشة المختلفة) - كانت مفقودة تمامًا من واجهة الكاشير
  sizes?: { id: string; name: string; name_en?: string; price: number; is_active: boolean }[] }
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
  if (diff < 60) return `${diff}s`
  if (diff < 3600) return `${Math.floor(diff / 60)}m`
  return `${Math.floor(diff / 3600)}h ${Math.floor((diff % 3600) / 60)}m`
}

function elapsed(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  const h = Math.floor(diff / 3600)
  const m = Math.floor((diff % 3600) / 60)
  const s = diff % 60
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
}

// ✅ وقت آخر صنف اتطلب فعليًا (مش وقت أول ما الطاولة اتحجزت) - يستخدم في عداد "⏱" جنب الطاولة
function lastOrderTime(order?: Order | null): string | null {
  if (!order || !order.order_items || order.order_items.length === 0) return order?.created_at || null
  return order.order_items.reduce((latest: string, item) => {
    if (!item.created_at) return latest
    return !latest || new Date(item.created_at).getTime() > new Date(latest).getTime() ? item.created_at : latest
  }, order.created_at)
}

// ══ Payment Modal ══
function PaymentModal({ order, onClose, onPaid, onPaymentStart, onTransfer, tables }: { order: Order & { mergedTableId?: string; mergeId?: string }; onClose: () => void; onPaid: () => void; onPaymentStart?: (tableId: string) => void; onTransfer: (order: Order) => void; tables?: TableRow[] }) {
  const sb = createClient()
  const { employee, permissions } = useAuth()
  // ✅ Fix: مساعد الكاشير (assistant_cashier) بقى نفس مستوى موظف/مشرف الصالة بالظبط - مش صلاحيات كاشير كاملة
  // ✅ المشرف العام: عرض كامل في صفحة الكاشير زي الأدمن (كل الفروع + تقرير الشيفت + الدفع)
  const isCashierRole = permissions?.all === true || employee?.role === 'cashier' || employee?.role === 'general_supervisor'
  // ✅ جديد: الدور المحدود (مشرف/موظف الصالة + مساعد الكاشير) - بياخدوا "+" بس، مش الدفع/الدمج/التحويل
  const isLimitedTableRole = ['hall_supervisor', 'hall_manager', 'assistant_cashier'].includes(employee?.role || '')
  const isAdminUser = permissions?.all === true || employee?.role === 'general_supervisor'
  // ✅ Fix: حماية من تنفيذ الدفع مرتين لو حصل ضغط مزدوج سريع على "Confirm" (كان بيضاعف إحصائيات العميل)
  const isPayingRef = useRef(false)
  // ✅ اسم الفرع الحقيقي للطاولة - عشان الأدمن يفرّق بين طاولات نفس الاسم في فروع مختلفة (زي "Table 1" في House و KLCC)
  // ✅ وكمان محتاجين branch_id دايمًا (مش بس للأدمن) عشان القيد المحاسبي التلقائي يتسجل للفرع الصح
  const [orderBranchName, setOrderBranchName] = useState<string | null>(null)
  const [orderBranchId, setOrderBranchId] = useState<string | null>(null)
  useEffect(() => {
    sb.from('tables').select('branch_id, branches(name)').eq('id', order.table_id).maybeSingle()
      .then(({ data }) => {
        setOrderBranchId((data as any)?.branch_id || null)
        if (isAdminUser) setOrderBranchName((data as any)?.branches?.name || null)
      })
  }, [isAdminUser, order.table_id])
  // ✅ Fix: لطاولات Grab/Foodpanda، الطريقة الافتراضية بقت "Credit" تلقائيًا من أول ما تفتح الفاتورة - بدل ما تفضل
  // "Cash" وتحتاج الكاشير يفتكر يغيّرها يدويًا كل مرة (ممكن ينسى فيتسجل غلط)
  const [method, setMethod] = useState<'cash' | 'visa' | 'online' | 'credit' | 'free'>(
    () => /grab|foodpanda/i.test(order.tables?.name || '') ? 'credit' : 'cash'
  )
  // ✅ جديد: المبلغ اللي العميل دفعه كاش - لحساب الباقي (Change Due) تلقائيًا
  const [cashReceived, setCashReceived] = useState('')
  // ✅ جديد: تحديد البنك لما تكون طريقة الدفع فيزا - عشان تقرير اليومية يقدر يفرّق بين البنكين
  const [cardBank, setCardBank] = useState<'maybank' | 'bsn' | ''>('')
  const [discountType, setDiscountType] = useState<'none' | 'amount' | 'percent' | 'free'>('none')
  const [discountValue, setDiscountValue] = useState('')
  // ✅ جديد: سبب الخصم أو الفري - إلزامي عشان يبقى واضح ليه اتعمل، ويظهر في Closed وتقرير الشيفت
  const [discountReason, setDiscountReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [customers, setCustomers] = useState<any[]>([])
  const [customerSearch, setCustomerSearch] = useState('')
  const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null)
  // ✅ جديد: عربون العميل المتاح (لو مسجّل ودافع عربون قبل كده) - وحالة تطبيقه على الفاتورة الحالية
  const [availableDeposits, setAvailableDeposits] = useState<{ id: string; amount: number }[]>([])
  const [depositApplied, setDepositApplied] = useState(false)
  const [showCustomerDrop, setShowCustomerDrop] = useState(false)

  // ✅ تقسيم الفاتورة على أكتر من شخص
  const [splitMode, setSplitMode] = useState(false)
  const [splitType, setSplitType] = useState<'equal' | 'items' | 'amount'>('equal')
  const [splitCount, setSplitCount] = useState(2)
  // ✅ جديد: "وضع المبلغ المخصص" - لما عميل واحد يدفع جزء كاش وجزء فيزا لنفس الفاتورة (بدل تقسيم بين أشخاص)
  const [customAmounts, setCustomAmounts] = useState<Record<number, string>>({})
  const [personItemQty, setPersonItemQty] = useState<Record<string, number>>({}) // key: `${itemId}::${personIdx}` → qty assigned to that person
  const [personMethods, setPersonMethods] = useState<Record<number, 'cash' | 'visa' | 'online'>>({})
  // ✅ جديد: بنك الفيزا لكل دفعة منفصلة (Maybank/BSN) - كان ناقص في وضع Split/Mixed Payment
  const [personCardBank, setPersonCardBank] = useState<Record<number, 'maybank' | 'bsn' | ''>>({})
  const [personPaid, setPersonPaid] = useState<Record<number, boolean>>({})
  // ✅ مودال تأكيد الدفع (بدل window.confirm) - عشان يظهر منسق في نص الشاشة
  const [confirmAction, setConfirmAction] = useState<'pay' | 'split' | null>(null)
  // ✅ جديد: نقل أصناف محددة (مش الطلب كله) لطاولة تانية شغالة بالفعل - مختلف عن "Transfer" اللي بينقل الطلب كامل لطاولة فاضية
  const [showMoveItems, setShowMoveItems] = useState(false)
  const [moveSelectedIds, setMoveSelectedIds] = useState<Set<string>>(new Set())
  const [moveDestTableId, setMoveDestTableId] = useState('')
  const [movingItems, setMovingItems] = useState(false)

  async function moveSelectedItemsToTable() {
    if (moveSelectedIds.size === 0 || !moveDestTableId) return
    const destTable = (tables || []).find(t => t.id === moveDestTableId)
    if (!destTable) return
    if (!confirm(`نقل ${moveSelectedIds.size} صنف إلى Table ${destTable.number}؟`)) return
    setMovingItems(true)
    const fullName = [employee?.name, (employee as any)?.name_en].filter(Boolean).join(' ') || 'غير معروف'
    const sourceTableLabel = order.tables?.name || `Table ${order.tables?.number}`

    // ✅ Fix حرج جدًا: Supabase مابيرميش استثناء تلقائي لما السيرفر يرفض الطلب - كنا لاقيناها قبل كده في
    // الدفع، ونفس المشكلة كانت هنا بالظبط. دلوقتي try/catch شامل + تحقق صريح من كل عملية، عشان أي فشل
    // يوري رسالة واضحة بدل ما يسيب الطلب المصدر عالق بإجمالي قديم وحالة نشطة من غير تفسير
    try {
    // ✅ نجيب الطلب النشط للطاولة الوجهة - لو مفيش، ننشئ طلب جديد فارغ ليها ونشغّلها
    let destOrderId: string
    const { data: destActiveOrder } = await sb.from('orders')
      .select('id').eq('table_id', destTable.id).in('status', ['confirmed','preparing','ready']).limit(1).maybeSingle()
    if (destActiveOrder?.id) {
      destOrderId = destActiveOrder.id
    } else {
      const { data: newOrder, error: newOrderError } = await sb.from('orders').insert([{
        table_id: destTable.id, status: 'confirmed', total_amount: 0, shift: 'shift1',
      }]).select('id').single()
      if (newOrderError || !newOrder) throw new Error('Failed to create destination order: ' + (newOrderError?.message || 'unknown'))
      destOrderId = newOrder.id
      const { error: destTableError } = await sb.from('tables').update({ status: 'occupied', current_order_id: destOrderId, occupied_since: new Date().toISOString() }).eq('id', destTable.id)
      if (destTableError) throw new Error('Failed to occupy destination table: ' + destTableError.message)
    }

    // ✅ ننقل كل صنف مختار: نغيّر order_id بتاعه للطلب الوجهة، ونضيف ملاحظة توضح المصدر ومين نقله
    for (const itemId of moveSelectedIds) {
      const item = order.order_items.find(i => i.id === itemId)
      const moveNote = `📤 نُقل من ${sourceTableLabel} بواسطة ${fullName}`
      const combinedNotes = item?.notes ? `${item.notes} — ${moveNote}` : moveNote
      const { error: moveItemError } = await sb.from('order_items').update({ order_id: destOrderId, notes: combinedNotes }).eq('id', itemId)
      if (moveItemError) throw new Error('Failed to move item: ' + moveItemError.message)
    }

    // ✅ إعادة حساب إجمالي الطلبين (المصدر والوجهة) بعد النقل
    const { data: destItems } = await sb.from('order_items').select('unit_price, quantity, status').eq('order_id', destOrderId)
    const destTotal = (destItems || []).filter(i => i.status !== 'cancelled').reduce((s, i) => s + i.unit_price * i.quantity, 0)
    const { error: destTotalError } = await sb.from('orders').update({ total_amount: destTotal }).eq('id', destOrderId)
    if (destTotalError) throw new Error('Failed to update destination total: ' + destTotalError.message)

    const { data: srcItems } = await sb.from('order_items').select('unit_price, quantity, status').eq('order_id', order.id)
    const srcActiveItems = (srcItems || []).filter(i => i.status !== 'cancelled')
    const srcTotal = srcActiveItems.reduce((s, i) => s + i.unit_price * i.quantity, 0)
    const { error: srcTotalError } = await sb.from('orders').update({ total_amount: srcTotal }).eq('id', order.id)
    if (srcTotalError) throw new Error('Failed to update source total: ' + srcTotalError.message)

    // ✅ جديد: لو الطاولة المصدر بقت من غير أي أصناف نشطة بعد النقل، نقفل طلبها ونرجّعها "فاضية" تلقائيًا
    if (srcActiveItems.length === 0) {
      const { error: closeSrcError } = await sb.from('orders').update({ status: 'done' }).eq('id', order.id)
      if (closeSrcError) throw new Error('Failed to close source order: ' + closeSrcError.message)
      const { error: freeSrcTableError } = await sb.from('tables').update({ status: 'available', current_order_id: null, occupied_since: null }).eq('id', order.table_id)
      if (freeSrcTableError) throw new Error('Failed to free source table: ' + freeSrcTableError.message)
    }

    setShowMoveItems(false)
    setMoveSelectedIds(new Set())
    setMoveDestTableId('')
    onPaid() // نعيد تحميل البيانات وإغلاق المودال، بنفس أثر إتمام أي عملية
    } catch (err: any) {
      console.error('moveSelectedItemsToTable error:', err)
      alert('⚠️ Move failed: ' + (err?.message || 'Unknown error') + '\n\nPlease try again or contact support.')
    } finally {
      setMovingItems(false)
    }
  }

  // ✅ Fix حرج: كان بيجيب أول 200 عميل بس (مرتبين بالاسم) ويبحث فيهم محليًا - يعني أي عميل اسمه بيبدأ بحرف
  // متأخر أبجديًا وبره أول 200 كان مستحيل يتلاقى في البحث مهما كتبت رقم تليفونه صح. دلوقتي البحث بيستعلم
  // من قاعدة البيانات مباشرة مع كل حرف تكتبه (نفس أسلوب البحث في مودال العربون)، فمفيش أي حد ممكن يضيع
  const [customerSearchLoading, setCustomerSearchLoading] = useState(false)
  useEffect(() => {
    if (!customerSearch.trim()) { setCustomers([]); return }
    setCustomerSearchLoading(true)
    const t = setTimeout(() => {
      sb.from('customers').select('id,name,phone,email,loyalty_points')
        .or(`name.ilike.%${customerSearch}%,phone.ilike.%${customerSearch}%,email.ilike.%${customerSearch}%`)
        .limit(20)
        .then(({ data }) => { setCustomers(data || []); setCustomerSearchLoading(false) })
    }, 300) // ✅ debounce بسيط عشان مانستعلمش على كل حرف فورًا
    return () => clearTimeout(t)
  }, [customerSearch])

  // ✅ لو الأوردر أصلاً مرتبط بعميل (مثلاً من لعبة "مين هيدفع؟" في صفحة المنيو)، نجيب بياناته ونحطه كمختار تلقائيًا
  // بدل ما يفضل فاضي ويتمسح الربط لو الكاشير أكد الدفع من غير ما يختار العميل يدوي تاني
  useEffect(() => {
    if (!order.customer_id) return
    sb.from('customers').select('id,name,phone,email,loyalty_points').eq('id', order.customer_id).maybeSingle()
      .then(({ data }) => { if (data) setSelectedCustomer(data) })
  }, [order.customer_id])

  // ✅ جديد: لما نختار عميل، ندوّر له على أي عربون متاح (status = 'available') عشان نعرضه ونقدر نطبّقه
  useEffect(() => {
    setDepositApplied(false)
    if (!selectedCustomer?.id) { setAvailableDeposits([]); return }
    sb.from('customer_deposits').select('id, amount').eq('customer_id', selectedCustomer.id).eq('status', 'available')
      .then(({ data }) => setAvailableDeposits(data || []))
  }, [selectedCustomer?.id])
  const totalAvailableDeposit = availableDeposits.reduce((s, d) => s + (d.amount || 0), 0)

  const filteredCustomers = customers.filter(c =>
    !customerSearch ||
    c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
    c.phone?.includes(customerSearch) ||
    c.email?.toLowerCase().includes(customerSearch.toLowerCase())
  ).slice(0, 8)

  const subtotal = order.order_items.filter(i => i.status !== 'cancelled').reduce((s, i) => s + i.unit_price * i.quantity, 0)
  // ✅ جديد: طلبات التيك أواي (Foodpanda/Grab/Customer/Other) مالهاش رسوم خدمة خالص - مافيش خدمة طاولة أصلًا
  const isTakeawayOrder = order.tables?.section === 'takeaway'
  // ✅ جديد: حسابات التوصيل الخارجية (Grab/Foodpanda) بتدفع للمطعم لاحقًا (تسوية دورية)، مش وقت قفل الفاتورة -
  // فمحتاجين نفرّق بينها وبين الكاش الحقيقي اللي في درج الكاشير
  const isPlatformCreditOrder = /grab|foodpanda/i.test(order.tables?.name || '')
  // ✅ الخدمة والضريبة بيتحسبوا على السعر الأصلي (subtotal) دايمًا
  const serviceCharge = (discountType === 'free' || isTakeawayOrder) ? 0 : subtotal * SERVICE_CHARGE_RATE
  const sst = discountType === 'free' ? 0 : subtotal * SST_RATE
  // ✅ Fix حرج جدًا: نسبة الخصم (%) بقت تتحسب على *الإجمالي الكلي* (سعر + خدمة + ضريبة)، مش على السعر
  // الأساسي بس - عشان "خصم 50%" يبقى فعلاً نص قيمة الفاتورة كاملة شاملة الضرائب، مش نص السعر الأساسي بس
  // (اللي كان بيدي نسبة خصم فعلية أقل من اللي الموظف كاتبها)
  const preDiscountTotal = subtotal + serviceCharge + sst
  const discountAmt = discountType === 'none' ? 0
    : discountType === 'free' ? preDiscountTotal
    : discountType === 'percent' ? preDiscountTotal * (parseFloat(discountValue) || 0) / 100
    : parseFloat(discountValue) || 0
  // ✅ جديد: لو العميل طبّق عربون سابق، بيتخصم من الإجمالي النهائي المطلوب دفعه دلوقتي
  const depositDeduction = depositApplied ? Math.min(totalAvailableDeposit, preDiscountTotal - discountAmt) : 0
  const total = Math.max(0, preDiscountTotal - discountAmt - depositDeduction)
  // ✅ صافي المبيعات بعد الخصم - للاستخدام في القيد المحاسبي بس
  const afterDiscount = Math.max(0, preDiscountTotal - discountAmt)
  // ✅ جديد: الباقي المطلوب إرجاعه للعميل لو دفع كاش أكتر من قيمة الفاتورة
  const cashReceivedNum = parseFloat(cashReceived) || 0
  const changeDue = Math.max(0, cashReceivedNum - total)

  // ✅ helper: الكمية المخصصة لشخص معين من صنف معين
  function getPersonQty(itemId: string, personIdx: number): number {
    return personItemQty[`${itemId}::${personIdx}`] || 0
  }
  // ✅ helper: إجمالي الكمية اللي اتحطت لأي شخص من صنف معين (لمعرفة المتبقي)
  function totalAssignedForItem(itemId: string, n: number): number {
    let sum = 0
    for (let p = 0; p < n; p++) sum += getPersonQty(itemId, p)
    return sum
  }

  // ✅ حساب حصة كل شخص - متساوي أو بالصنف (بالتناسب مع نصيبه من الإجمالي الفرعي)
  const splitPeople: { idx: number; label: string; amount: number }[] = (() => {
    if (!splitMode) return []
    if (splitType === 'equal') {
      const n = Math.max(2, splitCount)
      const baseShare = Math.floor((total / n) * 100) / 100
      const shares = Array.from({ length: n }, () => baseShare)
      // نضيف أي فرق تقريب صغير لنصيب آخر شخص عشان المجموع يساوي الإجمالي بالظبط
      const roundingDiff = total - baseShare * n
      shares[n - 1] = Math.round((shares[n - 1] + roundingDiff) * 100) / 100
      return shares.map((amount, idx) => ({ idx, label: `Person ${idx + 1}`, amount }))
    }
    if (splitType === 'amount') {
      // ✅ جديد: مبلغ مخصص لكل طريقة دفع (زي "60 كاش + 40 فيزا" لنفس الفاتورة) - آخر واحد بيتحسب تلقائيًا كباقي
      const n = Math.max(2, splitCount)
      const entered: number[] = Array.from({ length: n - 1 }, (_, idx) => Math.max(0, parseFloat(customAmounts[idx]) || 0))
      const enteredSum = entered.reduce((s, v) => s + v, 0)
      const remainder = Math.round(Math.max(0, total - enteredSum) * 100) / 100
      const amounts = [...entered, remainder]
      return amounts.map((amount, idx) => ({ idx, label: `Payment ${idx + 1}`, amount }))
    }
    // splitType === 'items'
    const n = Math.max(2, splitCount)
    const perPersonSubtotal: number[] = Array.from({ length: n }, () => 0)
    for (const item of order.order_items.filter(i => i.status !== 'cancelled')) {
      for (let p = 0; p < n; p++) {
        perPersonSubtotal[p] += getPersonQty(item.id, p) * item.unit_price
      }
    }
    return perPersonSubtotal.map((personSubtotal, idx) => {
      const ratio = subtotal > 0 ? personSubtotal / subtotal : 0
      const amount = Math.round(ratio * total * 100) / 100
      return { idx, label: `Person ${idx + 1}`, amount }
    })
  })()
  const unassignedItemsCount = splitMode && splitType === 'items'
    ? order.order_items.filter(i => i.status !== 'cancelled' && totalAssignedForItem(i.id, Math.max(2, splitCount)) < i.quantity).length
    : 0
  const allSplitPeoplePaid = splitPeople.length > 0 && splitPeople.every(p => personPaid[p.idx])

  // ✅ تحديث "Total Spent" و"Total Visits" في جدول customers وقت الدفع الفعلي (مش وقت التأكيد بس)
  async function bumpCustomerStats(customerId: string, amount: number) {
    const { data: cust } = await sb.from('customers').select('total_spent, total_visits').eq('id', customerId).maybeSingle()
    if (!cust) return
    await sb.from('customers').update({
      total_spent: (cust.total_spent || 0) + amount,
      total_visits: (cust.total_visits || 0) + 1,
    }).eq('id', customerId)
  }

  // ✅ جديد: إنشاء قيد محاسبي تلقائي في "سندات القيد" وقت إقفال أي فاتورة مبيعات
  const SALES_ACCOUNTS: Record<string, { code: string; name: string }> = {
    cash:   { code: '1101', name: 'الصندوق النقدي - الكاشير' },
    visa:   { code: '1111', name: 'مستحقات العملاء - بطاقات ائتمان' },
    online: { code: '1105', name: 'المدفوعات الإلكترونية المعلقة' },
    // ✅ جديد: حساب مستقل لمبالغ Grab/Foodpanda الآجلة - عشان متتسجلش غلط كأنها كاش في الدرج
    credit: { code: '1121', name: 'مستحقات منصات التوصيل - Grab/Foodpanda' },
  }
  async function createSalesJournalEntry(debitLines: { method: string; amount: number }[], salesAmt: number, serviceChargeAmt: number, sstAmt: number, tableName: string) {
    if (!orderBranchId) { console.error('createSalesJournalEntry: مفيش branch_id، هنتجاهل القيد التلقائي'); return }
    const lines: any[] = []
    let sortOrder = 0
    const byMethod = new Map<string, number>()
    for (const dl of debitLines) {
      if (dl.amount <= 0) continue
      byMethod.set(dl.method, (byMethod.get(dl.method) || 0) + dl.amount)
    }
    byMethod.forEach((amt, method) => {
      const acc = SALES_ACCOUNTS[method] || SALES_ACCOUNTS.cash
      lines.push({ account_code: acc.code, account_name: acc.name, description: `مبيعات - ${tableName}`, debit: Math.round(amt * 100) / 100, credit: 0, sort_order: sortOrder++ })
    })
    if (salesAmt > 0) lines.push({ account_code: '4100', account_name: 'إيرادات المبيعات', description: `مبيعات - ${tableName}`, debit: 0, credit: Math.round(salesAmt * 100) / 100, sort_order: sortOrder++ })
    if (serviceChargeAmt > 0) lines.push({ account_code: '4121', account_name: 'رسوم الخدمة 10%', description: `رسوم خدمة - ${tableName}`, debit: 0, credit: Math.round(serviceChargeAmt * 100) / 100, sort_order: sortOrder++ })
    if (sstAmt > 0) lines.push({ account_code: '2121', account_name: 'ضريبة SST المستحقة', description: `SST - ${tableName}`, debit: 0, credit: Math.round(sstAmt * 100) / 100, sort_order: sortOrder++ })

    const totalDebit = lines.reduce((s, l) => s + l.debit, 0)
    const totalCredit = lines.reduce((s, l) => s + l.credit, 0)
    if (totalDebit <= 0 || Math.abs(totalDebit - totalCredit) > 0.05) {
      console.error('createSalesJournalEntry: القيد غير متوازن، هنتجاهله', totalDebit, totalCredit)
      return
    }

    const today = new Date().toISOString().split('T')[0]
    const { count } = await sb.from('journal_entries').select('id', { count: 'exact', head: true }).eq('entry_type', 'sales')
    const entryNumber = `SI-${new Date().getFullYear()}-${String((count || 0) + 1).padStart(4, '0')}`

    const { data: entry, error: entryErr } = await sb.from('journal_entries').insert([{
      entry_number: entryNumber, entry_type: 'sales', date: today,
      description: `فاتورة مبيعات - ${tableName}`, total_amount: totalDebit, status: 'posted',
      branch_id: orderBranchId,
    }]).select('id').single()
    if (entryErr || !entry?.id) { console.error('createSalesJournalEntry insert error:', entryErr?.message); return }
    await sb.from('journal_entry_lines').insert(lines.map(l => ({ ...l, entry_id: entry.id })))
  }

  async function doPay() {
    if (isPayingRef.current) return // ✅ منع التنفيذ المزدوج
    isPayingRef.current = true
    setSaving(true)
    // ✅ Fix حرج: نستبعد الطاولة من أول لحظة تبدأ فيها عملية الدفع (قبل أي استعلام)، مش بعد ما العملية تخلص -
    // عشان أي تحديث شاشة (fetchAll) يحصل أثناء خطوات الدفع نفسه (زي دمج طلب مكرر) ميرجّعش الطلب بالغلط
    onPaymentStart?.(order.table_id)
    // ✅ Fix حرج: لف الدالة كلها بـ try/catch/finally - قبل كده لو حصل أي خطأ في نص العملية (زي فشل استعلام
    // دمج الطلبات المكررة)، الكود كان بيتوقف بصمت من غير أي رسالة، فالطاولة كانت بترجع تبان "شغالة" لسه
    // من غير ما الكاشير يعرف السبب. دلوقتي أي خطأ هيظهر رسالة واضحة، وisPayingRef هيترجع false تلقائيًا
    // عشان يقدر يعيد المحاولة على طول بدل ما يفضل عالق
    try {

    // ✅ Fix حرج جدًا (طبقة حماية أخيرة): في حالات نادرة جدًا (Race Condition - لو اتنين حاولوا يضيفوا
    // طلب لنفس الطاولة في نفس اللحظة بالظبط)، ممكن يتعمل أكتر من صف "orders" نشط لنفس الطاولة. لو سبنا
    // ده يحصل، التحديث تحت (total_amount) هيتكرر على كل الصفوف ويطلع في تقارير المبيعات مضاعف. فقبل
    // ما نقفل الفاتورة، بنتأكد إن كل الطلبات النشطة لنفس الطاولة اتجمعت في صف واحد بس.
    const { data: activeOrdersForTable } = await sb.from('orders')
      .select('id, created_at').eq('table_id', order.table_id).in('status', ['confirmed', 'preparing', 'ready'])
      .order('created_at', { ascending: true })
    if (activeOrdersForTable && activeOrdersForTable.length > 1) {
      const primaryId = activeOrdersForTable[0].id
      const duplicateIds = activeOrdersForTable.slice(1).map(o => o.id)
      // ننقل كل أصناف الطلبات الزيادة للطلب الأساسي (الأقدم)
      await sb.from('order_items').update({ order_id: primaryId }).in('order_id', duplicateIds)
      // ونلغي الطلبات الزيادة نفسها (بإجمالي صفر) عشان محدش يحسبها تاني
      await sb.from('orders').update({ status: 'cancelled', total_amount: 0, cancel_reason: 'دمج تلقائي - نفس طلب الطاولة' }).in('id', duplicateIds)
    }

    // 1. Mark all active orders for this table as paid
    const { error: mainPayError } = await sb.from('orders').update({
      status: 'paid',
      payment_method: discountType === 'free' ? 'free' : method,
      card_bank: method === 'visa' ? (cardBank || null) : null,
      discount_amount: discountAmt,
      discount_type: discountType === 'free' ? 'free' : discountType,
      service_charge: serviceCharge,
      sst_amount: sst,
      total_amount: total,
      paid_at: new Date().toISOString(),
      customer_id: selectedCustomer?.id || null,
      paid_by: employee?.id || null,
      paid_by_name: employee?.name || null,
      // ✅ جديد: سبب الخصم/الفري + ملاحظة تطبيق العربون (لو حصل) بيتضافوا لملاحظات الطلب - عشان يبقى واضح
      // وقت مراجعة Closed/تقرير الشيفت
      notes: [
        order.notes,
        (discountType === 'amount' || discountType === 'percent' || discountType === 'free') && discountReason.trim()
          ? `${discountType === 'free' ? '🎁 Free reason' : '🏷️ Discount reason'}: ${discountReason.trim()}`
          : null,
        depositApplied ? `💰 Deposit applied: MYR ${depositDeduction.toFixed(2)}` : null,
      ].filter(Boolean).join(' | ') || null,
    }).eq('table_id', order.table_id).in('status', ['confirmed','preparing','ready'])
    // ✅ Fix حرج جدًا: Supabase مابيرميش استثناء تلقائي لما السيرفر يرفض الطلب - بنتأكد صراحة ونرمي خطأ فعلي
    if (mainPayError) throw new Error('Failed to mark order as paid: ' + mainPayError.message)
    // ✅ جديد: لو العميل طبّق عربون على الفاتورة دي، نعلّمه "مستخدم" عشان مايتطبقش تاني على فاتورة تانية بالغلط
    if (depositApplied && availableDeposits.length > 0) {
      await sb.from('customer_deposits').update({ status: 'used', used_at: new Date().toISOString(), used_order_id: order.id })
        .in('id', availableDeposits.map(d => d.id))
    }

    // ✅ تحديث إحصائيات العميل لو مرتبط بالفاتورة
    if (selectedCustomer?.id) {
      await bumpCustomerStats(selectedCustomer.id, total)
    }

    // ✅ قيد محاسبي تلقائي لفاتورة المبيعات دي
    if (discountType !== 'free' && total > 0) {
      await createSalesJournalEntry(
        [{ method, amount: total }],
        afterDiscount, serviceCharge, sst,
        order.tables?.name || `Table ${order.tables?.number}`
      )
    }

    // 2. Reset table to available
    await sb.from('tables').update({
      status: 'available',
      current_order_id: null,
      occupied_since: null,
      redirected_to_table_id: null,
      redirected_at: null,
    }).eq('id', order.table_id)

    // ✅ جديد: لو فيه طاولة قديمة كانت بتوجه للطاولة دي (بسبب تحويل سابق)، نمسح إشارتها كمان
    // عشان مايفضلش عندها إشارة قديمة لطلب اتقفل وخلص خالص
    await sb.from('tables').update({ redirected_to_table_id: null, redirected_at: null }).eq('redirected_to_table_id', order.table_id)

    // ✅ Fix حرج جدًا: لو الفاتورة كانت مدموجة من طاولتين، المفروض نضم أصناف الطاولة الشريكة فعليًا للفاتورة
    // الأساسية (مش نسيبها في صف طلب منفصل يتقفل "مدفوع" بإجماله القديم قبل الدمج) - وإلا نفس الفلوس بتتحسب
    // مرتين في كل التقارير (مرة في الطاولة الأساسية بالإجمالي الصحيح المدموج، ومرة تانية في الطاولة الشريكة
    // بإجمالها القديم المنفصل). دلوقتي بننقل كل order_items للفاتورة الأساسية، ونلغي (مش ندفع) صف الطلب
    // الشريك بإجمالي صفر، بالظبط زي منطق دمج الطلبات المكررة اللي بنيناه قبل كده
    if (order.mergedTableId) {
      const { data: partnerOrders } = await sb.from('orders').select('id')
        .eq('table_id', order.mergedTableId).in('status', ['confirmed', 'preparing', 'ready'])
      const partnerOrderIds = (partnerOrders || []).map((o: any) => o.id)
      if (partnerOrderIds.length > 0) {
        // ننقل كل أصناف الطاولة الشريكة للفاتورة الأساسية - عشان تبان كاملة في أي تقرير أو مراجعة لاحقة
        const { error: moveItemsError } = await sb.from('order_items').update({ order_id: order.id }).in('order_id', partnerOrderIds)
        if (moveItemsError) throw new Error('Failed to merge partner table items: ' + moveItemsError.message)
        // نلغي صف الطلب الشريك نفسه بإجمالي صفر - الإجمالي الحقيقي كله بقى مسجّل على الفاتورة الأساسية بس
        const { error: cancelPartnerError } = await sb.from('orders').update({
          status: 'cancelled', total_amount: 0,
          cancel_reason: `🔗 Merged into ${order.tables?.name || 'Table ' + order.tables?.number}'s bill`,
        }).in('id', partnerOrderIds)
        if (cancelPartnerError) throw new Error('Failed to close partner table order: ' + cancelPartnerError.message)
      }
      const { error: partnerTableError } = await sb.from('tables').update({
        status: 'available', current_order_id: null, occupied_since: null,
      }).eq('id', order.mergedTableId)
      if (partnerTableError) throw new Error('Failed to free partner table: ' + partnerTableError.message)
      if (order.mergeId) {
        // ✅ Fix حرج: بنتأكد من نجاح فك الدمج فعليًا - قبل كده لو فشل الاستعلام ده بصمت، علامة الدمج كانت بتفضل عالقة للأبد
        const { error: unmergeError } = await sb.from('table_merges').update({ unmerged_at: new Date().toISOString() }).eq('id', order.mergeId)
        if (unmergeError) throw new Error('Failed to clear table merge: ' + unmergeError.message)
      }
    }

    onPaid()
    } catch (err: any) {
      // ✅ Fix حرج: بدل ما الخطأ يتبلع بصمت، نوريه واضح للكاشير عشان يعرف يبلّغ بيه أو يعيد المحاولة
      console.error('doPay error:', err)
      alert('⚠️ Payment failed: ' + (err?.message || 'Unknown error') + '\n\nPlease try again or contact support.')
    } finally {
      setSaving(false)
      isPayingRef.current = false
    }
  }
  // ✅ زرار "Confirm Payment" بيفتح مودال تأكيد في نص الشاشة بدل ما ينفذ الدفع على طول
  function pay() {
    // ✅ Fix: رجّعناها تقتصر على الكاشير بس - المشرف المحدود (isLimitedTableRole) اتشال من صلاحية الدفع
    if (!isCashierRole) { alert('🔒 Payment requires cashier access'); return }
    if (method === 'visa' && !cardBank) { alert('من فضلك حدد البنك (Maybank / BSN)'); return }
    // ✅ جديد: سبب الخصم/الفري إلزامي عشان يبقى واضح ليه اتعمل
    if ((discountType === 'amount' || discountType === 'percent' || discountType === 'free') && !discountReason.trim()) {
      alert(discountType === 'free' ? 'من فضلك اكتب سبب الـ Free' : 'من فضلك اكتب سبب الخصم')
      return
    }
    setConfirmAction('pay')
  }

  // ✅ إنهاء الفاتورة بعد ما كل شخص دفع نصيبه بطريقته
  // ✅ زرار "Finalize Split Bill" بيفتح مودال تأكيد في نص الشاشة بدل ما ينفذ على طول
  function paySplit() {
    // ✅ Fix: نفس التقييد - الكاشير بس
    if (!isCashierRole) { alert('🔒 Payment requires cashier access'); return }
    if (!allSplitPeoplePaid) return
    // ✅ جديد: سبب الخصم/الفري إلزامي هنا كمان (splitMode بيتقفل تلقائيًا لو discountType === 'free'، فبيهمنا amount/percent بس هنا)
    if ((discountType === 'amount' || discountType === 'percent') && !discountReason.trim()) {
      alert('من فضلك اكتب سبب الخصم')
      return
    }
    setConfirmAction('split')
  }

  async function doPaySplit() {
    if (isPayingRef.current) return // ✅ منع التنفيذ المزدوج
    isPayingRef.current = true
    setSaving(true)
    // ✅ Fix حرج: نستبعد الطاولة من أول لحظة (زي doPay بالظبط) - مهم جدًا هنا لأن فيه خطوة دمج/إلغاء تحصل
    // قبل الدفع النهائي، وكانت بتسبب تحديث شاشة مبكر يرجّع الطلب قبل ما نبدأ نستبعد الطاولة
    onPaymentStart?.(order.table_id)
    // ✅ Fix حرج: نفس حماية doPay - try/catch/finally عشان أي خطأ يظهر واضح بدل ما يتبلع بصمت
    try {

    // ✅ نفس طبقة الحماية الموجودة في doPay - دمج أي طلبات نشطة مكررة لنفس الطاولة قبل قفل الفاتورة المقسّمة
    const { data: activeOrdersForTableSplit } = await sb.from('orders')
      .select('id, created_at').eq('table_id', order.table_id).in('status', ['confirmed', 'preparing', 'ready'])
      .order('created_at', { ascending: true })
    if (activeOrdersForTableSplit && activeOrdersForTableSplit.length > 1) {
      const primaryId = activeOrdersForTableSplit[0].id
      const duplicateIds = activeOrdersForTableSplit.slice(1).map(o => o.id)
      await sb.from('order_items').update({ order_id: primaryId }).in('order_id', duplicateIds)
      await sb.from('orders').update({ status: 'cancelled', total_amount: 0, cancel_reason: 'دمج تلقائي - نفس طلب الطاولة' }).in('id', duplicateIds)
    }

    // ✅ Fix حرج جدًا: نمسح أي دفعات تقسيم قديمة لنفس الطلب ده الأول (لو فيه من محاولة سابقة فشلت جزئيًا -
    // مثلاً نجح تسجيل الدفعات لكن فشل تحديث الفاتورة بعدها لأي سبب) - عشان إعادة المحاولة متضيفش صفوف
    // مكررة فوق القديمة. الحذف ده آمن 100% لأننا هننشئ الصفوف الصحيحة الجديدة فورًا بعده في نفس العملية
    await sb.from('order_split_payments').delete().eq('order_id', order.id)

    // نسجل كل دفعة على حدة في order_split_payments للأرشفة والتقارير
    const { error: splitInsertError } = await sb.from('order_split_payments').insert(
      splitPeople.map(p => ({
        order_id: order.id,
        person_label: p.label,
        amount: p.amount,
        payment_method: personMethods[p.idx] || 'cash',
        // ✅ جديد: بنك الفيزا لكل دفعة (لو كانت فيزا) - كان ناقص خالص قبل كده
        card_bank: personMethods[p.idx] === 'visa' ? (personCardBank[p.idx] || null) : null,
      }))
    )
    // ✅ Fix حرج جدًا: Supabase مابيرميش استثناء (Exception) تلقائي لما السيرفر يرفض الطلب (403/400) - بيرجع
    // بس { error } بهدوء والكود بيكمل عادي كأن كل حاجة تمام! عشان كده try/catch مكنش بيمسك الأخطاء دي خالص.
    // دلوقتي بنتأكد من النتيجة صراحة ونرمي خطأ فعلي لو فشلت، عشان يوصل لـ catch ويوري رسالة واضحة للكاشير
    if (splitInsertError) throw new Error('Failed to save split payments: ' + splitInsertError.message)

    // ✅ Fix حرج جدًا: كانت القيمة نص ديناميكي زي "split(cash+online)"، وده كان بيخالف قيد قاعدة البيانات
    // (orders_payment_method_check) اللي بيسمح بس بقائمة ثابتة من القيم. التفاصيل الحقيقية لكل دفعة (الطريقة
    // والبنك) محفوظة أصلاً في جدول order_split_payments المنفصل، فمش محتاجين نكرر التفاصيل هنا خالص
    const summaryMethod = 'split'
    // ✅ جديد: بنك أول دفعة فيزا في التقسيم - بيتسجّل على الطلب الرئيسي نفسه عشان يتحسب صح في تقارير
    // Visa Maybank/BSN (اللي بتقرا من عمود card_bank بتاع الطلب مباشرة، مش من جدول الدفعات المقسّمة)
    const firstVisaPerson = splitPeople.find(p => personMethods[p.idx] === 'visa')
    const orderLevelCardBank = firstVisaPerson ? (personCardBank[firstVisaPerson.idx] || null) : null

    // نفس خطوات إغلاق الفاتورة العادية، بس payment_method بيوضح إنها كانت فاتورة مقسّمة
    const { error: splitPayError } = await sb.from('orders').update({
      status: 'paid',
      payment_method: summaryMethod,
      card_bank: orderLevelCardBank,
      discount_amount: discountAmt,
      discount_type: discountType === 'free' ? 'free' : discountType,
      service_charge: serviceCharge,
      sst_amount: sst,
      total_amount: total,
      paid_at: new Date().toISOString(),
      customer_id: selectedCustomer?.id || null,
      paid_by: employee?.id || null,
      paid_by_name: employee?.name || null,
      notes: (discountType === 'amount' || discountType === 'percent') && discountReason.trim()
        ? [order.notes, `🏷️ Discount reason: ${discountReason.trim()}`].filter(Boolean).join(' | ')
        : (order.notes || null),
    }).eq('table_id', order.table_id).in('status', ['confirmed', 'preparing', 'ready'])
    if (splitPayError) throw new Error('Failed to mark order as paid: ' + splitPayError.message)
    // ✅ جديد: نفس تعليم العربون هنا كمان لو الدفع كان مقسّم
    if (depositApplied && availableDeposits.length > 0) {
      await sb.from('customer_deposits').update({ status: 'used', used_at: new Date().toISOString(), used_order_id: order.id })
        .in('id', availableDeposits.map(d => d.id))
    }

    // ✅ تحديث إحصائيات العميل لو مرتبط بالفاتورة
    if (selectedCustomer?.id) {
      await bumpCustomerStats(selectedCustomer.id, total)
    }

    // ✅ قيد محاسبي تلقائي - مع سطر مدين منفصل لكل طريقة دفع استُخدمت في التقسيم
    if (discountType !== 'free' && total > 0) {
      await createSalesJournalEntry(
        splitPeople.map(p => ({ method: personMethods[p.idx] || 'cash', amount: p.amount })),
        afterDiscount, serviceCharge, sst,
        order.tables?.name || `Table ${order.tables?.number}`
      )
    }

    await sb.from('tables').update({
      status: 'available',
      current_order_id: null,
      occupied_since: null,
    }).eq('id', order.table_id)

    // ✅ Fix حرج جدًا: نفس معالجة doPay بالظبط - كانت مفقودة تمامًا هنا، فأي فاتورة مدموجة من طاولتين
    // اتدفعت عن طريق Split Payment كانت بتسيب الطاولة الشريكة عالقة "مشغولة" للأبد وعلامة الدمج ماتتفكش
    if (order.mergedTableId) {
      const { data: partnerOrders } = await sb.from('orders').select('id')
        .eq('table_id', order.mergedTableId).in('status', ['confirmed', 'preparing', 'ready'])
      const partnerOrderIds = (partnerOrders || []).map((o: any) => o.id)
      if (partnerOrderIds.length > 0) {
        const { error: moveItemsError } = await sb.from('order_items').update({ order_id: order.id }).in('order_id', partnerOrderIds)
        if (moveItemsError) throw new Error('Failed to merge partner table items: ' + moveItemsError.message)
        const { error: cancelPartnerError } = await sb.from('orders').update({
          status: 'cancelled', total_amount: 0,
          cancel_reason: `🔗 Merged into ${order.tables?.name || 'Table ' + order.tables?.number}'s bill`,
        }).in('id', partnerOrderIds)
        if (cancelPartnerError) throw new Error('Failed to close partner table order: ' + cancelPartnerError.message)
      }
      const { error: partnerTableError } = await sb.from('tables').update({
        status: 'available', current_order_id: null, occupied_since: null,
      }).eq('id', order.mergedTableId)
      if (partnerTableError) throw new Error('Failed to free partner table: ' + partnerTableError.message)
      if (order.mergeId) {
        const { error: unmergeError } = await sb.from('table_merges').update({ unmerged_at: new Date().toISOString() }).eq('id', order.mergeId)
        if (unmergeError) throw new Error('Failed to clear table merge: ' + unmergeError.message)
      }
    }

    onPaid()
    } catch (err: any) {
      console.error('doPaySplit error:', err)
      alert('⚠️ Payment failed: ' + (err?.message || 'Unknown error') + '\n\nPlease try again or contact support.')
    } finally {
      setSaving(false)
      isPayingRef.current = false
    }
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
    ${order.order_items.filter(i => i.status !== 'cancelled').map(i => `
    <div class="row"><span>${i.menu_items?.name_en || i.menu_items?.name || '⚠️ Removed Item'}${i.size_name ? ' (' + i.size_name + ')' : ''} ×${i.quantity}</span><span>MYR ${(i.unit_price * i.quantity).toFixed(2)}</span></div>
    ${i.notes ? `<div style="font-size:10px;color:#666;padding-right:10px">* ${i.notes}</div>` : ''}
    `).join('')}
    <div class="line"></div>
    <div class="row"><span>Subtotal</span><span>MYR ${subtotal.toFixed(2)}</span></div>
    ${discountType !== 'free' ? `
    ${!isTakeawayOrder ? `<div class="row"><span>Service Charge (10%)</span><span>MYR ${serviceCharge.toFixed(2)}</span></div>` : ''}
    <div class="row"><span>SST (6%)</span><span>MYR ${sst.toFixed(2)}</span></div>
    ` : ''}
    ${discountAmt > 0 ? `<div class="row"><span>Discount</span><span>- MYR ${discountAmt.toFixed(2)}</span></div>` : ''}
    <div class="line"></div>
    <div class="row bold big"><span>TOTAL</span><span>MYR ${total.toFixed(2)}</span></div>
    <div class="line"></div>
    <div class="row"><span>Payment</span><span>${discountType === 'free' ? 'COMPLIMENTARY' : method.toUpperCase()}</span></div>
    ${method === 'cash' && discountType !== 'free' && cashReceivedNum >= total && cashReceived.trim() !== '' ? `
    <div class="row"><span>Cash Received</span><span>MYR ${cashReceivedNum.toFixed(2)}</span></div>
    <div class="row bold"><span>Change Due</span><span>MYR ${changeDue.toFixed(2)}</span></div>
    ` : ''}
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
          <div style={{ fontSize: 12, color: S.muted, marginBottom: 10 }}>
            {order.tables?.name || `Table ${order.tables?.number}`} · #{order.id.slice(-6).toUpperCase()}
            {orderBranchName && <span style={{ background: S.purpleB, color: S.purple, borderRadius: 8, padding: '2px 8px', fontSize: 10, fontWeight: 700, marginLeft: 8 }}>🏢 {orderBranchName}</span>}
          </div>
          {groupItemsByRound(order.order_items).map((round, ri) => (
            <div key={ri}>
              {ri > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '10px 0', color: S.amber, fontSize: 11, fontWeight: 700 }}>
                  <div style={{ flex: 1, height: 1, background: S.amber + '40' }} />
                  🔔 Round {ri + 1} (Additional Order) · {timeElapsedSince(round[0]?.created_at)}
                  <div style={{ flex: 1, height: 1, background: S.amber + '40' }} />
                </div>
              )}
              {round.map(i => (
                <div key={i.id} style={{ padding: '5px 0', borderBottom: `1px solid ${S.border}`, fontSize: 13 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8, color: i.status === 'cancelled' ? S.muted : S.white, textDecoration: i.status === 'cancelled' ? 'line-through' : 'none' }}>
                      {/* ✅ Fix: الكود أولًا ثم الاسم بجانبه مباشرة - نفس ترتيب "#246 Cafe Latte" */}
                      {i.menu_items?.or_code && <span style={{ fontWeight: 700, color: S.gold }}>#{i.menu_items.or_code}</span>}
                      <span>{i.menu_items?.name_en || i.menu_items?.name || '⚠️ Removed Item'}{i.size_name ? ` (${i.size_name})` : ''} <span style={{ color: S.muted }}>×{i.quantity}</span></span>
                    </span>
                    <span style={{ color: i.status === 'cancelled' ? S.muted : S.gold, textDecoration: i.status === 'cancelled' ? 'line-through' : 'none' }}>MYR {(i.unit_price * i.quantity).toFixed(2)}</span>
                  </div>
                  {i.notes && <div style={{ fontSize: 11, color: S.gold, marginTop: 2 }}>📝 {i.notes}</div>}
                  {i.status === 'cancelled' && i.cancel_reason && <div style={{ fontSize: 11, color: S.red, marginTop: 2 }}>❌ Cancelled: {i.cancel_reason}</div>}
                </div>
              ))}
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
              {customerSearchLoading && <div style={{ fontSize: 11, color: S.muted, marginTop: 4 }}>⏳ Searching...</div>}
              {!customerSearchLoading && customerSearch.trim().length > 0 && filteredCustomers.length === 0 && (
                <div style={{ fontSize: 11, color: S.amber, marginTop: 4 }}>⚠️ No customer found</div>
              )}
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
          {/* ✅ جديد: لو العميل ده دافع عربون قبل كده ولسه متاح، نوريه ونديه فرصة يطبّقه على الفاتورة دي */}
          {selectedCustomer && totalAvailableDeposit > 0 && (
            <div style={{ marginTop: 10, background: S.blueB, border: `1px solid ${S.blue}40`, borderRadius: 10, padding: '10px 14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: S.blue, fontWeight: 700 }}>💰 Available Deposit: MYR {totalAvailableDeposit.toFixed(2)}</span>
                <button onClick={() => setDepositApplied(v => !v)}
                  style={{ padding: '6px 12px', borderRadius: 8, border: `1px solid ${S.blue}`, background: depositApplied ? S.blue : 'transparent', color: depositApplied ? '#fff' : S.blue, cursor: 'pointer', fontSize: 11, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
                  {depositApplied ? '✅ Applied' : 'Apply Deposit'}
                </button>
              </div>
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
          {/* ✅ جديد: سبب الخصم/الفري - إلزامي، وبيظهر بعد كده في Closed وتقرير الشيفت عشان يبقى واضح ليه اتعمل */}
          {(discountType === 'amount' || discountType === 'percent' || discountType === 'free') && (
            <input style={{ ...inp, marginTop: 8, borderColor: !discountReason.trim() ? S.red + '60' : undefined }}
              value={discountReason} onChange={e => setDiscountReason(e.target.value)}
              placeholder={discountType === 'free' ? 'Why is this free? (required)' : 'Why this discount? (required)'} />
          )}
        </div>

        {/* Split Bill Toggle */}
        {discountType !== 'free' && isCashierRole && (
          <div style={{ marginBottom: 16 }}>
            <button onClick={() => setSplitMode(!splitMode)}
              style={{ width: '100%', padding: '10px', borderRadius: 10, border: `1px solid ${splitMode ? S.purple : S.border}`, background: splitMode ? S.purpleB : 'transparent', color: splitMode ? S.purple : S.muted, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
              {splitMode ? '✕ Cancel Split' : '✂️ Split Bill'}
            </button>
          </div>
        )}

        {/* Payment Method */}
        {discountType !== 'free' && !splitMode && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, color: S.muted, marginBottom: 8 }}>Payment Method</div>
            <div style={{ display: 'grid', gridTemplateColumns: isPlatformCreditOrder ? 'repeat(4, 1fr)' : 'repeat(3, 1fr)', gap: 8 }}>
              {[
                { k: 'cash', label: '💵 Cash', color: S.green },
                { k: 'visa', label: '💳 Visa', color: S.blue },
                { k: 'online', label: '📱 Bank Transfer', color: S.purple },
                // ✅ جديد: يظهر بس لطاولات جراب/فودباندا - الفلوس هتتحصّل من المنصة لاحقًا مش دلوقتي
                ...(isPlatformCreditOrder ? [{ k: 'credit', label: '🧾 Credit', color: S.amber }] : []),
              ].map(m => (
                <button key={m.k} onClick={() => setMethod(m.k as any)}
                  style={{ padding: '10px', borderRadius: 10, border: `1px solid ${method === m.k ? m.color : S.border}`, background: method === m.k ? m.color + '20' : 'transparent', color: method === m.k ? m.color : S.muted, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: method === m.k ? 700 : 400 }}>
                  {m.label}
                </button>
              ))}
            </div>
            {/* ✅ New: clarifies this amount will be collected later from the platform, not real cash/card right now */}
            {method === 'credit' && (
              <div style={{ marginTop: 8, padding: '10px 14px', borderRadius: 10, background: S.amberB, border: `1px solid ${S.amber}40`, fontSize: 12, color: S.amber }}>
                🧾 This amount will be recorded as Credit and won't count as cash in the drawer — it will be collected from the platform (Grab/Foodpanda) during their periodic settlement.
              </div>
            )}
            {/* ✅ جديد: لما الدفع كاش - نطلب المبلغ المستلم من العميل ونحسب الباقي تلقائيًا */}
            {method === 'cash' && (
              <div style={{ marginTop: 8 }}>
                <input type="number" value={cashReceived} onChange={e => setCashReceived(e.target.value)}
                  placeholder="💵 Amount received from customer (MYR)"
                  style={{ ...inp, width: '100%' }} />
                {cashReceived.trim() !== '' && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, padding: '10px 14px', borderRadius: 10, background: cashReceivedNum < total ? S.redB : S.greenB, border: `1px solid ${cashReceivedNum < total ? S.red : S.green}40` }}>
                    <span style={{ fontSize: 12, color: cashReceivedNum < total ? S.red : S.green, fontWeight: 700 }}>
                      {cashReceivedNum < total ? '⚠️ Insufficient Amount' : '💰 Change Due'}
                    </span>
                    <span style={{ fontSize: 16, fontWeight: 900, color: cashReceivedNum < total ? S.red : S.green }}>
                      {cashReceivedNum < total ? `MYR ${(total - cashReceivedNum).toFixed(2)} short` : `MYR ${changeDue.toFixed(2)}`}
                    </span>
                  </div>
                )}
              </div>
            )}
            {/* ✅ جديد: اختيار البنك إجباري لما تكون فيزا */}
            {method === 'visa' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginTop: 8 }}>
                {[{ k: 'maybank', label: '🏦 Maybank' }, { k: 'bsn', label: '🏦 BSN' }].map(b => (
                  <button key={b.k} onClick={() => setCardBank(b.k as any)}
                    style={{ padding: '8px', borderRadius: 10, border: `1px solid ${cardBank === b.k ? S.gold : S.border}`, background: cardBank === b.k ? S.gold3 : 'transparent', color: cardBank === b.k ? S.gold : S.muted, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', fontWeight: cardBank === b.k ? 700 : 400 }}>
                    {b.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Split Bill Panel */}
        {discountType !== 'free' && splitMode && isCashierRole && (
          <div style={{ marginBottom: 16, background: S.card, borderRadius: 12, padding: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 14 }}>
              <button onClick={() => setSplitType('equal')}
                style={{ padding: '9px', borderRadius: 10, border: `1px solid ${splitType === 'equal' ? S.gold : S.border}`, background: splitType === 'equal' ? S.gold3 : 'transparent', color: splitType === 'equal' ? S.gold : S.muted, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
                ⚖️ Split Equally
              </button>
              <button onClick={() => setSplitType('items')}
                style={{ padding: '9px', borderRadius: 10, border: `1px solid ${splitType === 'items' ? S.gold : S.border}`, background: splitType === 'items' ? S.gold3 : 'transparent', color: splitType === 'items' ? S.gold : S.muted, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
                🍽️ Assign Items Per Person
              </button>
              {/* ✅ جديد: لعميل واحد بيدفع جزء كاش وجزء فيزا (أو أي مزيج طرق) لنفس الفاتورة */}
              <button onClick={() => { setSplitType('amount'); setSplitCount(2) }}
                style={{ padding: '9px', borderRadius: 10, border: `1px solid ${splitType === 'amount' ? S.gold : S.border}`, background: splitType === 'amount' ? S.gold3 : 'transparent', color: splitType === 'amount' ? S.gold : S.muted, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
                💰 Mixed Payment
              </button>
            </div>

            {/* ✅ جديد: إدخال المبالغ يدويًا في وضع الدفع المخصص - آخر واحد بيتحسب تلقائيًا كباقي الإجمالي */}
            {splitType === 'amount' && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, color: S.muted, marginBottom: 8 }}>
                  Enter the amount for each payment — the last one fills in automatically with the remainder of MYR {total.toFixed(2)}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {Array.from({ length: Math.max(2, splitCount) - 1 }, (_, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 12, color: S.white, minWidth: 80 }}>Payment {idx + 1}</span>
                      <input type="number" value={customAmounts[idx] || ''} onChange={e => setCustomAmounts(prev => ({ ...prev, [idx]: e.target.value }))}
                        placeholder="0.00" style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: `1px solid ${S.border}`, background: S.card, color: S.white, fontSize: 13, fontFamily: 'Tajawal, sans-serif', outline: 'none' }} />
                    </div>
                  ))}
                  <button onClick={() => setSplitCount(c => c + 1)}
                    style={{ padding: '6px', borderRadius: 8, border: `1px dashed ${S.border}`, background: 'transparent', color: S.muted, cursor: 'pointer', fontSize: 11, fontFamily: 'Tajawal, sans-serif' }}>
                    ➕ Add another payment method
                  </button>
                </div>
              </div>
            )}

            {/* عدد الأشخاص - واحد بس فوق، بيتحكم في الاتنين */}
            {splitType !== 'amount' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <span style={{ fontSize: 12, color: S.muted }}>Number of People</span>
              <button onClick={() => setSplitCount(c => Math.max(2, c - 1))} style={{ width: 30, height: 30, borderRadius: 8, border: `1px solid ${S.border}`, background: 'transparent', color: S.white, cursor: 'pointer', fontSize: 16 }}>−</button>
              <span style={{ fontSize: 15, fontWeight: 800, color: S.gold, minWidth: 20, textAlign: 'center' }}>{Math.max(2, splitCount)}</span>
              <button onClick={() => setSplitCount(c => c + 1)} style={{ width: 30, height: 30, borderRadius: 8, border: `1px solid ${S.border}`, background: 'transparent', color: S.white, cursor: 'pointer', fontSize: 16 }}>+</button>
            </div>
            )}

            {splitType === 'items' && unassignedItemsCount > 0 && (
              <div style={{ fontSize: 11, color: S.red, marginBottom: 10 }}>⚠️ {unassignedItemsCount} item(s) still not fully assigned to anyone</div>
            )}

            {/* Per-person cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {splitPeople.map(p => (
                <div key={p.idx} style={{ background: personPaid[p.idx] ? S.greenB : S.navy3, border: `1px solid ${personPaid[p.idx] ? S.green : S.border}`, borderRadius: 10, padding: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: S.white }}>👤 {p.label}</span>
                    <span style={{ fontSize: 15, fontWeight: 800, color: S.gold }}>MYR {p.amount.toFixed(2)}</span>
                  </div>

                  {/* ✅ لو وضع "تحديد أصناف كل شخص": يظهر جنب كل شخص الأصناف المتبقية بس (اللي لسه محدش خدها) */}
                  {splitType === 'items' && (
                    <div style={{ marginBottom: 10, background: S.card, borderRadius: 8, padding: 8 }}>
                      {order.order_items.filter(item => item.status !== 'cancelled').map(item => {
                        const myQty = getPersonQty(item.id, p.idx)
                        // أقصى حاجة ممكن الشخص ده ياخدها = الكمية الكلية ناقص اللي اتاخد من باقي الناس (مش هو)
                        const takenByOthers = totalAssignedForItem(item.id, Math.max(2, splitCount)) - myQty
                        const maxForThisPerson = item.quantity - takenByOthers
                        if (maxForThisPerson <= 0 && myQty === 0) return null // اتاخدت بالكامل من ناس تانيين
                        return (
                          <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: `1px solid ${S.border}` }}>
                            <span style={{ fontSize: 11, color: S.white, flex: 1 }}>{item.menu_items?.name_en || item.menu_items?.name || '⚠️ Removed Item'} <span style={{ color: S.muted }}>(×{item.quantity} total)</span></span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <button onClick={() => setPersonItemQty(prev => ({ ...prev, [`${item.id}::${p.idx}`]: Math.max(0, myQty - 1) }))}
                                disabled={myQty <= 0}
                                style={{ width: 22, height: 22, borderRadius: 6, border: `1px solid ${S.border}`, background: 'transparent', color: myQty <= 0 ? S.muted : S.white, cursor: myQty <= 0 ? 'not-allowed' : 'pointer', fontSize: 13 }}>−</button>
                              <span style={{ fontSize: 12, fontWeight: 700, color: S.gold, minWidth: 14, textAlign: 'center' }}>{myQty}</span>
                              <button onClick={() => setPersonItemQty(prev => ({ ...prev, [`${item.id}::${p.idx}`]: myQty + 1 }))}
                                disabled={myQty >= maxForThisPerson}
                                style={{ width: 22, height: 22, borderRadius: 6, border: `1px solid ${S.border}`, background: 'transparent', color: myQty >= maxForThisPerson ? S.muted : S.white, cursor: myQty >= maxForThisPerson ? 'not-allowed' : 'pointer', fontSize: 13 }}>+</button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 8 }}>
                    {[
                      { k: 'cash', label: '💵 Cash', color: S.green },
                      { k: 'visa', label: '💳 Visa', color: S.blue },
                      { k: 'online', label: '📱 Bank Transfer', color: S.purple },
                    ].map(m => (
                      <button key={m.k} onClick={() => setPersonMethods(prev => ({ ...prev, [p.idx]: m.k as any }))}
                        style={{ padding: '7px', borderRadius: 8, border: `1px solid ${personMethods[p.idx] === m.k ? m.color : S.border}`, background: personMethods[p.idx] === m.k ? m.color + '20' : 'transparent', color: personMethods[p.idx] === m.k ? m.color : S.muted, cursor: 'pointer', fontSize: 11, fontFamily: 'Tajawal, sans-serif', fontWeight: personMethods[p.idx] === m.k ? 700 : 400 }}>
                        {m.label}
                      </button>
                    ))}
                  </div>
                  {/* ✅ جديد: اختيار البنك إجباري لما الدفعة دي تكون فيزا - كان ناقص هنا وموجود بس في الدفع العادي */}
                  {personMethods[p.idx] === 'visa' && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6, marginBottom: 8 }}>
                      {[{ k: 'maybank', label: '🏦 Maybank' }, { k: 'bsn', label: '🏦 BSN' }].map(b => (
                        <button key={b.k} onClick={() => setPersonCardBank(prev => ({ ...prev, [p.idx]: b.k as any }))}
                          style={{ padding: '7px', borderRadius: 8, border: `1px solid ${personCardBank[p.idx] === b.k ? S.gold : S.border}`, background: personCardBank[p.idx] === b.k ? S.gold3 : 'transparent', color: personCardBank[p.idx] === b.k ? S.gold : S.muted, cursor: 'pointer', fontSize: 11, fontFamily: 'Tajawal, sans-serif', fontWeight: personCardBank[p.idx] === b.k ? 700 : 400 }}>
                          {b.label}
                        </button>
                      ))}
                    </div>
                  )}
                  <button
                    disabled={!personMethods[p.idx] || (personMethods[p.idx] === 'visa' && !personCardBank[p.idx])}
                    onClick={() => setPersonPaid(prev => ({ ...prev, [p.idx]: !prev[p.idx] }))}
                    style={{ width: '100%', padding: '8px', borderRadius: 8, border: 'none', background: personPaid[p.idx] ? S.green : (personMethods[p.idx] ? S.gold : S.border), color: personPaid[p.idx] ? '#fff' : S.navy, cursor: personMethods[p.idx] ? 'pointer' : 'not-allowed', fontSize: 12, fontFamily: 'Tajawal, sans-serif', fontWeight: 700, opacity: personMethods[p.idx] ? 1 : 0.5 }}>
                    {personPaid[p.idx] ? '✅ Paid' : 'Mark as Paid'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Totals */}
        <div style={{ background: S.card, borderRadius: 12, padding: 16, marginBottom: 20 }}>
          {[
            { label: 'Subtotal', value: subtotal, color: S.white },
            discountType !== 'free' && !isTakeawayOrder ? { label: 'Service Charge (10%)', value: serviceCharge, color: S.muted } : null,
            discountType !== 'free' ? { label: 'SST 6%', value: sst, color: S.muted } : null,
            discountAmt > 0 ? { label: 'Discount', value: -discountAmt, color: S.red } : null,
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

        {/* ✅ جديد: لوحة اختيار الأصناف المراد نقلها لطاولة تانية شغالة بالفعل */}
        {showMoveItems && (
          <div style={{ background: S.card, borderRadius: 12, padding: 14, marginBottom: 14, border: `1px solid ${S.amber}40` }}>
            <div style={{ fontSize: 12, color: S.amber, fontWeight: 700, marginBottom: 10 }}>📤 اختر الأصناف المطلوب نقلها، ثم حدد الطاولة الوجهة</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
              {order.order_items.filter(i => i.status !== 'cancelled').map(item => (
                <label key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input type="checkbox" checked={moveSelectedIds.has(item.id)}
                    onChange={e => setMoveSelectedIds(prev => {
                      const next = new Set(prev)
                      if (e.target.checked) next.add(item.id); else next.delete(item.id)
                      return next
                    })} />
                  <span style={{ fontSize: 12, color: S.white }}>{item.menu_items?.name_en || item.menu_items?.name || '⚠️ Removed Item'} ×{item.quantity} — MYR {(item.unit_price * item.quantity).toFixed(2)}</span>
                </label>
              ))}
            </div>
            <select value={moveDestTableId} onChange={e => setMoveDestTableId(e.target.value)}
              style={{ width: '100%', boxSizing: 'border-box', padding: '9px 10px', borderRadius: 8, border: `1px solid ${S.border}`, background: S.navy3, color: S.white, fontSize: 13, fontFamily: 'inherit', marginBottom: 10 }}>
              <option value="">-- Select destination table --</option>
              {(tables || []).filter(t => t.id !== order.table_id && t.branch_id === (tables || []).find(x => x.id === order.table_id)?.branch_id).map(t => (
                <option key={t.id} value={t.id}>Table {t.number} — {t.name || ''}</option>
              ))}
            </select>
            <button onClick={moveSelectedItemsToTable} disabled={moveSelectedIds.size === 0 || !moveDestTableId || movingItems}
              style={{ width: '100%', padding: '10px', borderRadius: 10, border: 'none', background: S.amber, color: S.navy, cursor: (moveSelectedIds.size === 0 || !moveDestTableId) ? 'not-allowed' : 'pointer', fontSize: 13, fontFamily: 'inherit', fontWeight: 800, opacity: (moveSelectedIds.size === 0 || !moveDestTableId) ? 0.5 : 1 }}>
              {movingItems ? '⏳ جاري النقل...' : `📤 نقل ${moveSelectedIds.size} صنف`}
            </button>
          </div>
        )}

        {/* ✅ Fix: الأزرار الثانوية (طباعة/تحويل/نقل) بقت في صف مستقل متساوي الحجم بدل ما تكون مستطيلة ومزاحمة زرار الدفع */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <button onClick={printReceipt} style={{ flex: 1, padding: '12px 6px', borderRadius: 12, border: `1px solid ${S.blue}`, background: S.blueB, color: S.blue, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', fontWeight: 700, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
            <span style={{ fontSize: 18 }}>🖨️</span> Print
          </button>
          {/* ✅ Fix: التحويل رجع يقتصر على الكاشير بس - شيلنا استثناء الدور المحدود (مشرف الصالة) */}
          {isCashierRole && (
            <button onClick={() => onTransfer(order)} style={{ flex: 1, padding: '12px 6px', borderRadius: 12, border: `1px solid ${S.purple}`, background: S.purpleB, color: S.purple, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', fontWeight: 700, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
              <span style={{ fontSize: 18 }}>🔄</span> Transfer
            </button>
          )}
          {/* ✅ جديد: نقل أصناف محددة (مش الطلب كله) - يقدر ينقلها لطاولة شغالة بالفعل، عكس Transfer اللي بيشترط طاولة فاضية */}
          {isCashierRole && tables && (
            <button onClick={() => setShowMoveItems(v => !v)} style={{ flex: 1, padding: '12px 6px', borderRadius: 12, border: `1px solid ${S.amber}`, background: showMoveItems ? S.amber : S.amberB, color: showMoveItems ? S.navy : S.amber, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', fontWeight: 700, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
              <span style={{ fontSize: 18 }}>📤</span> Move
            </button>
          )}
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          {/* ✅ Fix: الدفع رجع يقتصر على الكاشير بس - شيلنا استثناء الدور المحدود (مشرف/مدير الصالة) */}
          {!isCashierRole ? (
            <div style={{ flex: 1, padding: '12px', borderRadius: 12, background: S.card, color: S.muted, textAlign: 'center', fontSize: 13, fontFamily: 'Tajawal, sans-serif' }}>
              🔒 Payment requires cashier access
            </div>
          ) : splitMode ? (
            <button onClick={paySplit} disabled={saving || !allSplitPeoplePaid || unassignedItemsCount > 0} style={{ flex: 1, padding: '12px', borderRadius: 12, border: 'none', background: (allSplitPeoplePaid && unassignedItemsCount === 0) ? `linear-gradient(135deg, ${S.gold}, ${S.gold2})` : S.border, color: (allSplitPeoplePaid && unassignedItemsCount === 0) ? S.navy : S.muted, cursor: (allSplitPeoplePaid && unassignedItemsCount === 0) ? 'pointer' : 'not-allowed', fontSize: 15, fontFamily: 'Tajawal, sans-serif', fontWeight: 800, opacity: saving ? 0.7 : 1 }}>
              {saving ? '⏳...' : '✅ Finalize Split Bill'}
            </button>
          ) : (
            <button onClick={pay} disabled={saving} style={{ flex: 1, padding: '12px', borderRadius: 12, border: 'none', background: `linear-gradient(135deg, ${S.gold}, ${S.gold2})`, color: S.navy, cursor: 'pointer', fontSize: 15, fontFamily: 'Tajawal, sans-serif', fontWeight: 800, opacity: saving ? 0.7 : 1 }}>
              {saving ? '⏳...' : discountType === 'free' ? '🎁 Complimentary' : '✅ Confirm Payment'}
            </button>
          )}
        </div>
      </div>

      {/* ✅ Payment Confirmation Modal - centered on screen */}
      {confirmAction && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: S.navy2, borderRadius: 20, border: `1px solid ${S.gold}`, width: '100%', maxWidth: 380, padding: 28, textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}>
            <div style={{ fontSize: 40, marginBottom: 14 }}>⚠️</div>
            <div style={{ color: S.white, fontSize: 17, fontWeight: 800, marginBottom: 10 }}>
              {confirmAction === 'split' ? 'Confirm Split Bill?' : 'Confirm Payment?'}
            </div>
            <div style={{ color: S.muted, fontSize: 13, marginBottom: 8, lineHeight: 1.6 }}>
              {confirmAction === 'split'
                ? <>Finalize this split bill for <span style={{ color: S.gold, fontWeight: 800 }}>MYR {total.toFixed(2)}</span>?</>
                : <>Confirm payment of <span style={{ color: S.gold, fontWeight: 800 }}>MYR {total.toFixed(2)}</span> via <span style={{ color: S.gold, fontWeight: 800 }}>{discountType === 'free' ? 'Complimentary (Free)' : method.toUpperCase()}</span>?</>
              }
            </div>
            {method === 'cash' && discountType !== 'free' && cashReceived.trim() !== '' && cashReceivedNum >= total && (
              <div style={{ color: S.green, fontSize: 13, fontWeight: 700, marginBottom: 8 }}>💰 Change Due: MYR {changeDue.toFixed(2)}</div>
            )}
            <div style={{ color: S.red, fontSize: 11, marginBottom: 22 }}>This will close the table and cannot be undone.</div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setConfirmAction(null)} style={{ flex: 1, padding: '12px', borderRadius: 12, border: `1px solid ${S.border}`, background: 'transparent', color: S.muted, cursor: 'pointer', fontSize: 14, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
                Cancel
              </button>
              <button
                disabled={saving}
                onClick={() => { const action = confirmAction; setConfirmAction(null); if (action === 'split') doPaySplit(); else doPay() }}
                style={{ flex: 1, padding: '12px', borderRadius: 12, border: 'none', background: `linear-gradient(135deg, ${S.gold}, ${S.gold2})`, color: S.navy, cursor: saving ? 'not-allowed' : 'pointer', fontSize: 14, fontFamily: 'Tajawal, sans-serif', fontWeight: 800, opacity: saving ? 0.6 : 1 }}>
                ✅ Yes, Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ══ Add Order Modal ══
function AddOrderModal({ tableId, tableName, onClose, onSaved }: { tableId: string; tableName: string; onClose: () => void; onSaved: () => void }) {
  const sb = createClient()
  const [categories, setCategories] = useState<Category[]>([])
  const [items, setItems] = useState<MenuItem[]>([])
  const [cart, setCart] = useState<{ item: MenuItem; qty: number; notes: string; selectedSize?: { id: string; name: string; name_en?: string; price: number } }[]>([])
  const [selectedCat, setSelectedCat] = useState('all')
  const [search, setSearch] = useState('')
  // ✅ جديد: خانة بحث منفصلة بالكود فقط - تطابق رقمي كامل ودقيق، مش جزء من الرقم
  const [codeSearch, setCodeSearch] = useState('')
  const [saving, setSaving] = useState(false)
  // ✅ جديد: الصنف اللي بيتم اختيار نوعه حاليًا (زي اختيار نوع الشيشة) - null يعني مفيش مودال مفتوح
  const [sizePickerItem, setSizePickerItem] = useState<MenuItem | null>(null)
  // ✅ جديد: "Open Item" - صنف مفتوح مخصص (زي "عسل زيادة") مش موجود في المنيو أصلاً
  const [showOpenItem, setShowOpenItem] = useState(false)
  const [openItemRows, setOpenItemRows] = useState<{ name: string; price: string; notes: string }[]>([{ name: '', price: '', notes: '' }])
  const [savingOpenItem, setSavingOpenItem] = useState(false)

  useEffect(() => {
    Promise.all([
      sb.from('menu_categories').select('id,name,name_en').eq('is_active', true).order('sort_order'),
      // ✅ Fix حرج: الاستعلام القديم كان بيفلتر بـ is_available بس، وده مكنش كافي - أصناف اتحذفت من المنيو (is_active: false)
      // كانت لسه بتظهر في شاشة "Add Order" بتاعة الكاشير طالما is_available فضلت true، فكان ممكن الكاشير يضيف صنف محذوف بالغلط
      sb.from('menu_items').select('id,name,name_en,price,category_id,or_code,is_active,menu_categories(name),sizes:menu_item_sizes(id,name,name_en,price,is_active)').eq('is_available', true).order('name'),
    ]).then(([cats, itms]) => {
      setCategories(cats.data || [])
      // ✅ نستبعد بس الأصناف اللي اتحدد لها is_active = false صراحةً (يعني اتحذفت فعلًا)
      // ونسيب أي صنف قيمته null/undefined (صفوف قديمة قبل إضافة العمود) زي ما هو، عشان ما نخفيش أصناف سليمة بالغلط
      setItems(((itms.data || []) as any[]).filter(i => i.is_active !== false))
    })
  }, [])

  const filtered = items.filter(i => {
    const matchCat = selectedCat === 'all' || i.category_id === selectedCat
    // ✅ جديد: البحث بكود الصنف (زي OR-155) كمان - بيشتغل بجزء من الكود من غير ما يدخله كامل
    // (مثلاً كتابة "155" بس كفاية تلاقي "OR-155")
    const matchSearch = !search || i.name.includes(search) || i.name_en.toLowerCase().includes(search.toLowerCase()) || (i.or_code || '').toLowerCase().includes(search.toLowerCase())
    // ✅ جديد: خانة بحث منفصلة بالكود بالظبط - تطابق رقمي كامل ودقيق (مش أي كود فيه نفس الرقم كجزء منه)
    // مثال: كتابة "5" هتطابق "OR-5" بس، مش "OR-15" أو "OR-51" أو "OR-100"
    const codeDigits = (i.or_code || '').match(/\d+/)?.[0] || ''
    const matchCode = !codeSearch || codeDigits === codeSearch.replace(/\D/g, '')
    return matchCat && matchSearch && matchCode
  })

  // ✅ Fix: لو الصنف له أنواع/أحجام نشطة (زي أنواع الشيشة)، نفتح مودال اختيار النوع بدل الإضافة المباشرة
  function addItem(item: MenuItem) {
    const activeSizes = (item.sizes || []).filter(s => s.is_active)
    if (activeSizes.length > 0) {
      setSizePickerItem(item)
      return
    }
    setCart(p => {
      const ex = p.find(c => c.item.id === item.id && !c.selectedSize)
      if (ex) return p.map(c => c === ex ? { ...c, qty: c.qty + 1 } : c)
      return [...p, { item, qty: 1, notes: '' }]
    })
  }

  // ✅ جديد: إضافة الصنف بعد اختيار النوع/الحجم المحدد من المودال
  function addItemWithSize(item: MenuItem, size: { id: string; name: string; name_en?: string; price: number }) {
    setCart(p => {
      const ex = p.find(c => c.item.id === item.id && c.selectedSize?.id === size.id)
      if (ex) return p.map(c => c === ex ? { ...c, qty: c.qty + 1 } : c)
      return [...p, { item, qty: 1, notes: '', selectedSize: size }]
    })
    setSizePickerItem(null)
  }

  // ✅ جديد: حفظ صنف/أصناف مفتوحة (Open Item) - كل صنف بيتسجل كصنف حقيقي في menu_items لكن مخفي (is_available: false)
  // عشان ميظهرش في المنيو العادي أو شبكة الأصناف، لكن يظهر تلقائيًا في السلة والفاتورة والمطبخ زي أي صنف عادي بالظبط
  async function saveOpenItems() {
    const validRows = openItemRows.filter(r => r.name.trim() && parseFloat(r.price) >= 0)
    if (validRows.length === 0) { alert('من فضلك أدخل اسم وسعر الصنف على الأقل'); return }
    setSavingOpenItem(true)
    const newCartEntries: typeof cart = []
    for (const row of validRows) {
      const price = parseFloat(row.price) || 0
      const { data: newMenuItem, error } = await sb.from('menu_items').insert([{
        name: row.name.trim(), name_en: row.name.trim(), price,
        // ✅ Fix: is_active بقى false كمان (مش is_available بس) - عشان يختفي تمامًا من صفحة إدارة المنيو نفسها،
        // اللي بتستبعد الأصناف الملغى تنشيطها (is_active=false)، مش بس الأصناف "متوقفة مؤقتًا" (is_available=false)
        is_available: false, is_active: false, category_id: null,
      }]).select('id, name, name_en, price, category_id').single()
      if (error || !newMenuItem) { alert('حصل خطأ أثناء إضافة الصنف: ' + (error?.message || '')); continue }
      newCartEntries.push({ item: newMenuItem as MenuItem, qty: 1, notes: row.notes.trim() })
    }
    setCart(p => [...p, ...newCartEntries])
    setSavingOpenItem(false)
    setShowOpenItem(false)
    setOpenItemRows([{ name: '', price: '', notes: '' }])
  }

  function removeItem(id: string) {
    setCart(p => {
      const ex = p.find(c => c.item.id === id)
      if (!ex) return p
      if (ex.qty === 1) return p.filter(c => c.item.id !== id)
      return p.map(c => c.item.id === id ? { ...c, qty: c.qty - 1 } : c)
    })
  }

  // ✅ جديد: تحديد الكمية مباشرة بكتابة رقم بدل الضغط المتكرر على "+" (زي لو عايز 20 وجبة، تكتب 20 مرة واحدة)
  function setItemQty(id: string, newQty: number) {
    setCart(p => {
      if (newQty <= 0) return p.filter(c => c.item.id !== id)
      const ex = p.find(c => c.item.id === id && !c.selectedSize)
      if (!ex) return p
      return p.map(c => c === ex ? { ...c, qty: newQty } : c)
    })
  }

  // ✅ Fix: نستخدم سعر النوع/الحجم المختار لو موجود، وإلا السعر الأساسي للصنف
  const total = cart.reduce((s, c) => s + (c.selectedSize?.price ?? c.item.price) * c.qty, 0)

  async function placeOrder() {
    if (cart.length === 0) return
    setSaving(true)
    // ✅ Fix حرج جدًا: بنتأكد الأول لو الطاولة عندها طلب نشط بالفعل (confirmed/preparing/ready) ونستخدمه،
    // بدل ما ننشئ صف "orders" جديد كل مرة. الكود القديم كان بينشئ صف جديد في كل ضغطة "Add Order"، فلو
    // اتضغطت على نفس الطاولة (خصوصًا حسابات Takeaway الوهمية) أكتر من مرة في نفس الشيفت، كانت بتتعمل
    // صفوف "orders" منفصلة متعددة لنفس الطاولة. وقت الدفع، الكود بيحدّث *كل* الصفوف النشطة لنفس الطاولة
    // بنفس الإجمالي الكامل للفاتورة — فيتكرر نفس المبلغ على كل صف، وتقارير المبيعات (Closed/Archive/اليومية)
    // كانت بتجمعهم كأنهم فواتير منفصلة حقيقية، فيطلع الإجمالي أضعاف الحقيقي.
    const { data: existingOrder } = await sb.from('orders')
      .select('id, total_amount').eq('table_id', tableId).in('status', ['confirmed', 'preparing', 'ready']).limit(1).maybeSingle()

    let orderId: string
    if (existingOrder?.id) {
      orderId = existingOrder.id
      await sb.from('orders').update({ total_amount: (existingOrder.total_amount || 0) + total }).eq('id', orderId)
    } else {
      const { data: newOrder } = await sb.from('orders').insert([{
        table_id: tableId, status: 'confirmed',
        total_amount: total, confirmed_at: new Date().toISOString(),
      }]).select('id').single()
      if (!newOrder) { setSaving(false); return }
      orderId = newOrder.id
    }
    await sb.from('order_items').insert(cart.map(c => ({
      order_id: orderId, menu_item_id: c.item.id,
      quantity: c.qty, unit_price: c.selectedSize?.price ?? c.item.price,
      // ✅ جديد: نسجل اسم النوع/الحجم المختار (زي نوع الشيشة) عشان يظهر بوضوح للمطبخ والفاتورة
      size_name: c.selectedSize ? (c.selectedSize.name_en || c.selectedSize.name) : null,
      notes: c.notes || null, status: 'pending',
      destination: 'kitchen',
    })))
    // ✅ Fix حرج: وقت الجلوس (occupied_since) بقى يتسجل بس مع أول طلب حقيقي على الطاولة، مش مع كل جولة إضافية -
    // قبل كده كان بيتحدّث في كل مرة (حتى لو الطاولة شغالة بالفعل)، فالعداد الظاهر على الطاولة كان بيرجع للصفر
    // مع كل جولة جديدة، بدل ما يفضل من أول ما العميل قعد فعليًا
    if (!existingOrder?.id) {
      await sb.from('tables').update({ status: 'occupied', current_order_id: orderId, occupied_since: new Date().toISOString() }).eq('id', tableId)
    } else {
      await sb.from('tables').update({ current_order_id: orderId }).eq('id', tableId)
    }
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
        <div style={{ display: 'flex', gap: 8 }}>
          <input style={{ ...inp, flex: 2 }} placeholder="🔍 Search by name or code..." value={search} onChange={e => setSearch(e.target.value)} />
          {/* ✅ جديد: خانة بحث منفصلة بالكود فقط - أرقام فقط، وتطابق دقيق كامل مش جزئي */}
          <input style={{ ...inp, flex: 1 }} placeholder="# Code" inputMode="numeric" type="text"
            value={codeSearch} onChange={e => setCodeSearch(e.target.value.replace(/\D/g, ''))} />
          {/* ✅ جديد: زر إضافة صنف مفتوح (Open Item) - لأي إضافة مش موجودة في المنيو أصلاً */}
          <button onClick={() => setShowOpenItem(true)}
            style={{ padding: '9px 14px', borderRadius: 10, border: `1px solid ${S.amber}`, background: S.amberB, color: S.amber, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', fontWeight: 700, whiteSpace: 'nowrap' }}>
            ➕ Open Item
          </button>
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 10, marginBottom: 12, overflowX: 'auto' }}>
          <button onClick={() => setSelectedCat('all')} style={{ padding: '5px 12px', borderRadius: 20, border: `1px solid ${selectedCat === 'all' ? S.gold : S.border}`, background: selectedCat === 'all' ? S.gold3 : 'transparent', color: selectedCat === 'all' ? S.gold : S.muted, cursor: 'pointer', fontSize: 11, whiteSpace: 'nowrap', fontFamily: 'Tajawal, sans-serif' }}>All</button>
          {categories.map(c => (
            <button key={c.id} onClick={() => setSelectedCat(c.id)} style={{ padding: '5px 12px', borderRadius: 20, border: `1px solid ${selectedCat === c.id ? S.gold : S.border}`, background: selectedCat === c.id ? S.gold3 : 'transparent', color: selectedCat === c.id ? S.gold : S.muted, cursor: 'pointer', fontSize: 11, whiteSpace: 'nowrap', fontFamily: 'Tajawal, sans-serif' }}>{c.name_en || c.name}</button>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 8, maxHeight: 300, overflowY: 'auto', marginBottom: 16 }}>
          {filtered.map(item => {
            // ✅ Fix: نجمع الكمية الكلية عبر كل أنواع/أحجام هذا الصنف في السلة (مش نوع واحد بس)
            const qty = cart.filter(c => c.item.id === item.id).reduce((s, c) => s + c.qty, 0)
            const activeSizes = (item.sizes || []).filter(s => s.is_active)
            const hasSizes = activeSizes.length > 0
            return (
              <div key={item.id} style={{ background: qty > 0 ? S.gold3 : S.card, border: `1px solid ${qty > 0 ? S.gold : S.border}`, borderRadius: 10, padding: 10, cursor: 'pointer' }} onClick={() => addItem(item)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  {/* ✅ Fix: الكود أولًا في الترتيب (يظهر على اليسار)، والاسم بعده (يظهر على اليمين) - نفس ترتيب "#246 Cafe Latte" */}
                  {item.or_code && (
                    <span style={{ fontSize: 12, fontWeight: 800, color: S.gold, flexShrink: 0 }}>
                      #{item.or_code}
                    </span>
                  )}
                  <div style={{ fontSize: 12, fontWeight: 700, color: S.white, flex: 1 }}>{item.name_en || item.name}</div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: S.gold, fontWeight: 700 }}>
                    {/* ✅ جديد: لو له أنواع، نعرض "من" أرخص سعر بدل السعر الأساسي المفرد فقط */}
                    {hasSizes ? `From MYR ${Math.min(...activeSizes.map(s => s.price)).toFixed(2)}` : `MYR ${item.price.toFixed(2)}`}
                  </span>
                  {/* ✅ Fix: زر الإنقاص السريع + حقل الكمية بقى قابل للكتابة المباشرة (بدل الضغط المتكرر) - يظهر بس للأصناف اللي مالهاش أنواع */}
                  {qty > 0 && !hasSizes && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }} onClick={e => e.stopPropagation()}>
                      <button onClick={() => removeItem(item.id)} style={{ width: 22, height: 22, borderRadius: 6, border: `1px solid ${S.red}`, background: S.redB, color: S.red, cursor: 'pointer', fontSize: 14, fontWeight: 700 }}>−</button>
                      {/* ✅ جديد: اكتب الرقم مباشرة بدل ما تضغط "+" عشرات المرات */}
                      <input type="number" value={qty} min={0}
                        onClick={e => e.stopPropagation()}
                        onChange={e => setItemQty(item.id, parseInt(e.target.value) || 0)}
                        style={{ width: 40, textAlign: 'center', background: S.navy2, border: `1px solid ${S.gold}`, borderRadius: 6, color: S.gold, fontWeight: 800, fontSize: 13, padding: '2px 0', fontFamily: 'Tajawal, sans-serif' }} />
                    </div>
                  )}
                  {qty > 0 && hasSizes && (
                    <span style={{ color: S.gold, fontWeight: 800, fontSize: 12 }}>×{qty} in cart</span>
                  )}
                </div>
                {/* ✅ جديد: إشارة واضحة إن الصنف له أنواع متعددة (زي أنواع الشيشة) */}
                {hasSizes && <div style={{ fontSize: 10, color: S.muted, marginTop: 3 }}>🔸 {activeSizes.length} types available</div>}
              </div>
            )
          })}
        </div>
        {cart.length > 0 && (
          <div style={{ background: S.card, borderRadius: 12, padding: 14, marginBottom: 16 }}>
            {cart.map((c, idx) => (
              <div key={`${c.item.id}-${c.selectedSize?.id || 'base'}-${idx}`} style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                  {/* ✅ Fix: نعرض الكود أولًا ثم اسم النوع/الحجم المختار - نفس ترتيب "#246 Cafe Latte" */}
                  <span style={{ color: S.white, display: 'flex', alignItems: 'center', gap: 6 }}>
                    {c.item.or_code && <span style={{ fontWeight: 700, color: S.gold }}>#{c.item.or_code}</span>}
                    <span>{c.item.name_en || c.item.name}{c.selectedSize ? ` (${c.selectedSize.name_en || c.selectedSize.name})` : ''}</span>
                    {/* ✅ جديد: الكمية بقت حقل رقمي تقدر تكتب فيه مباشرة بدل الضغط المتكرر */}
                    <span style={{ color: S.muted }}>×</span>
                    <input type="number" value={c.qty} min={1}
                      onChange={e => {
                        const v = Math.max(1, parseInt(e.target.value) || 1)
                        setCart(p => p.map((ci, i) => i === idx ? { ...ci, qty: v } : ci))
                      }}
                      style={{ width: 40, textAlign: 'center', background: S.navy2, border: `1px solid ${S.gold}`, borderRadius: 6, color: S.gold, fontWeight: 800, fontSize: 12, padding: '2px 0', fontFamily: 'Tajawal, sans-serif' }} />
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ color: S.gold }}>MYR {((c.selectedSize?.price ?? c.item.price) * c.qty).toFixed(2)}</span>
                    <button onClick={() => setCart(p => p.filter((_, i) => i !== idx))} style={{ background: 'transparent', border: 'none', color: S.red, cursor: 'pointer', fontSize: 14 }}>✕</button>
                  </div>
                </div>
                <input style={{ ...inp, fontSize: 11 }} placeholder="Note..." value={c.notes} onChange={e => setCart(p => p.map((ci, i) => i === idx ? { ...ci, notes: e.target.value } : ci))} />
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

      {/* ✅ جديد: مودال اختيار النوع/الحجم - نفس فكرة منيو العميل بالظبط (زي اختيار نوع الشيشة) */}
      {sizePickerItem && (
        <div onClick={() => setSizePickerItem(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.75)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: S.navy2, borderRadius: 20, border: `1px solid ${S.border}`, padding: 20, maxWidth: 360, width: '100%', maxHeight: '80vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              {sizePickerItem.or_code && (
                <span style={{ fontSize: 15, fontWeight: 800, color: S.gold }}>
                  #{sizePickerItem.or_code}
                </span>
              )}
              <div style={{ fontSize: 15, fontWeight: 800, color: S.gold, flex: 1 }}>{sizePickerItem.name_en || sizePickerItem.name} — اختر النوع</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(sizePickerItem.sizes || []).filter(s => s.is_active).map(size => (
                <button key={size.id} onClick={() => addItemWithSize(sizePickerItem, size)}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', borderRadius: 10, border: `1px solid ${S.border}`, background: S.card, color: S.white, cursor: 'pointer', fontSize: 13, fontFamily: 'inherit', textAlign: 'right' }}>
                  <span>{size.name_en || size.name}</span>
                  <span style={{ color: S.gold, fontWeight: 700 }}>MYR {size.price.toFixed(2)}</span>
                </button>
              ))}
            </div>
            <button onClick={() => setSizePickerItem(null)} style={{ width: '100%', marginTop: 14, padding: '10px 0', borderRadius: 10, border: `1px solid ${S.border}`, background: 'transparent', color: S.muted, cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>
            Cancel
            </button>
          </div>
        </div>
      )}

      {/* ✅ جديد: مودال الصنف المفتوح (Open Item) - لإضافة أي صنف مخصص مش موجود في المنيو أصلاً */}
      {showOpenItem && (
        <div onClick={() => { setShowOpenItem(false); setOpenItemRows([{ name: '', price: '', notes: '' }]) }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.75)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: S.navy2, borderRadius: 20, border: `1px solid ${S.amber}`, padding: 20, maxWidth: 380, width: '100%', maxHeight: '85vh', overflowY: 'auto' }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: S.amber, marginBottom: 4 }}>➕ Open Item</div>
            <div style={{ fontSize: 11, color: S.muted, marginBottom: 16 }}>For any addition not on the menu (e.g. "Extra Honey")</div>

            {openItemRows.map((row, idx) => (
              <div key={idx} style={{ background: S.card, borderRadius: 12, padding: 12, marginBottom: 10, position: 'relative' }}>
                {openItemRows.length > 1 && (
                  <button onClick={() => setOpenItemRows(p => p.filter((_, i) => i !== idx))}
                    style={{ position: 'absolute', top: 8, left: 8, background: 'transparent', border: 'none', color: S.red, cursor: 'pointer', fontSize: 14 }}>✕</button>
                )}
                {/* الاسم */}
                <input placeholder="Item name (e.g. Extra Honey)" value={row.name}
                  onChange={e => setOpenItemRows(p => p.map((r, i) => i === idx ? { ...r, name: e.target.value } : r))}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '9px 10px', borderRadius: 8, border: `1px solid ${S.border}`, background: S.navy3, color: S.white, fontSize: 13, fontFamily: 'inherit', marginBottom: 8 }} />
                {/* ✅ الصف الأول: السعر */}
                <input type="number" min={0} step="0.01" placeholder="Price (MYR)" value={row.price}
                  onChange={e => setOpenItemRows(p => p.map((r, i) => i === idx ? { ...r, price: e.target.value } : r))}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '9px 10px', borderRadius: 8, border: `1px solid ${S.border}`, background: S.navy3, color: S.white, fontSize: 13, fontFamily: 'inherit', marginBottom: 8 }} />
                {/* ✅ الصف الثاني: الملاحظات */}
                <input placeholder="Notes (optional)" value={row.notes}
                  onChange={e => setOpenItemRows(p => p.map((r, i) => i === idx ? { ...r, notes: e.target.value } : r))}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '9px 10px', borderRadius: 8, border: `1px solid ${S.border}`, background: S.navy3, color: S.white, fontSize: 13, fontFamily: 'inherit' }} />
              </div>
            ))}

            {/* ✅ لو في إضافة ثاني (أو أكتر) - زر يضيف صف صنف مفتوح جديد */}
            <button onClick={() => setOpenItemRows(p => [...p, { name: '', price: '', notes: '' }])}
              style={{ width: '100%', padding: '9px 0', borderRadius: 8, border: `1px dashed ${S.border}`, background: 'transparent', color: S.muted, cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', marginBottom: 14 }}>
              ➕ Add another open item
            </button>

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => { setShowOpenItem(false); setOpenItemRows([{ name: '', price: '', notes: '' }]) }}
                style={{ flex: 1, padding: '10px 0', borderRadius: 10, border: `1px solid ${S.border}`, background: 'transparent', color: S.muted, cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>
                Cancel
              </button>
              <button onClick={saveOpenItems} disabled={savingOpenItem}
                style={{ flex: 1, padding: '10px 0', borderRadius: 10, border: 'none', background: S.amber, color: S.navy, cursor: savingOpenItem ? 'not-allowed' : 'pointer', fontSize: 13, fontFamily: 'inherit', fontWeight: 800, opacity: savingOpenItem ? 0.6 : 1 }}>
                {savingOpenItem ? '⏳...' : '✅ Add to Cart'}
              </button>
            </div>
          </div>
        </div>
      )}
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
        <td>${o.order_items?.map(i => (i.menu_items?.name_en || i.menu_items?.name || '⚠️ Removed Item') + ' ×' + i.quantity).join(', ')}</td>
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
      .total-row { background: #1E3A8A !important; font-weight: bold; color: #fff; }
      @media print { @page { size: A4 landscape; margin: 10mm; } }
    </style></head><body>
    <h2>🌸 Orchid House — Shift Report</h2>
    <h3>${shift === 'shift1' ? 'Shift 1' : shift === 'shift2' ? 'Shift 2' : 'Shift 3'} · ${now.toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
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
      <div class="summary-box"><div class="label">📱 Bank Transfer</div><div class="value">MYR ${totalOnline.toFixed(2)}</div></div>
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
            <p style={{ fontSize: 12, color: S.muted }}>{shift === 'shift1' ? 'Shift 1' : shift === 'shift2' ? 'Shift 2' : 'Shift 3'} · {new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
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
            { label: 'Bank Transfer', value: `MYR ${totalOnline.toFixed(2)}`, color: S.purple, icon: '📱' },
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
function TransferTableModal({ order, tables, isCashierRole, onClose, onTransferred }: { order: Order; tables: TableRow[]; isCashierRole?: boolean; onClose: () => void; onTransferred: () => void }) {
  const sb = createClient()
  const [moving, setMoving] = useState(false)
  // ✅ Fix: لازم نفلتر الطاولات المتاحة لنقل الطلب إليها بنفس فرع الطاولة الحالية بس، مش كل الفروع
  const currentTable = tables.find(t => t.id === order.table_id)
  const availableTables = tables.filter(t =>
    t.is_active && t.id !== order.table_id && (t.status || 'available') === 'available'
    && t.branch_id === currentTable?.branch_id
  )

  async function transferTo(newTable: TableRow) {
    // ✅ Fix: فحص صلاحية حقيقي جوه الدالة نفسها، مش بس إخفاء الزرار من الواجهة
    if (!isCashierRole) { alert('🔒 Transferring tables requires cashier access'); return }
    setMoving(true)
    const oldTableId = order.table_id
    // ✅ جيب الطاولة القديمة عشان نحافظ على وقت الجلوس الأصلي (occupied_since) بدل ما يرجع العداد للصفر
    const { data: oldTableData } = await sb.from('tables').select('occupied_since').eq('id', oldTableId).single()

    // نقل كل الطلبات النشطة المرتبطة بالطاولة القديمة (لو فيها أكتر من طلب مدموج)
    await sb.from('orders')
      .update({ table_id: newTable.id })
      .eq('table_id', oldTableId)
      .in('status', ['confirmed', 'preparing', 'ready'])

    await sb.from('tables').update({
      status: 'occupied', current_order_id: order.id, occupied_since: oldTableData?.occupied_since || new Date().toISOString(),
      // ✅ Fix: نلغي أي إشارة تحويل قديمة على الطاولة الجديدة لو كانت موجودة (احتياطًا)
      redirected_to_table_id: null,
      redirected_at: null,
    }).eq('id', newTable.id)

    await sb.from('tables').update({
      status: 'available', current_order_id: null, occupied_since: null,
      // ✅ جديد: نسجّل إن الطاولة القديمة "اتحوّلت" لطاولة جديدة - عشان أي عميل لسه فاتح صفحة الـQR القديمة
      // بتاعتها يتوجه تلقائيًا لطلبه الصحيح من غير ما يحتاج يعمل سكان جديد
      redirected_to_table_id: newTable.id,
      redirected_at: new Date().toISOString(),
    }).eq('id', oldTableId)

    setMoving(false)
    onTransferred()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: S.navy2, borderRadius: 20, border: `1px solid ${S.border}`, width: '100%', maxWidth: 480, maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '18px 22px', borderBottom: `1px solid ${S.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: S.purple }}>🔄 Transfer Table</div>
            <div style={{ fontSize: 12, color: S.muted, marginTop: 2 }}>Select the destination table</div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: S.muted, fontSize: 22, cursor: 'pointer' }}>✕</button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 18 }}>
          {availableTables.length === 0 ? (
            <div style={{ textAlign: 'center', color: S.muted, padding: 30 }}>No available tables right now</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: 10 }}>
              {availableTables.map(t => (
                <button key={t.id} disabled={moving} onClick={() => transferTo(t)}
                  style={{ padding: '14px 8px', borderRadius: 12, border: `2px solid ${S.green}60`, background: S.greenB, color: S.green, cursor: moving ? 'not-allowed' : 'pointer', fontFamily: 'Tajawal, sans-serif', fontWeight: 800, fontSize: 14, opacity: moving ? 0.6 : 1 }}>
                  {t.number}
                  <div style={{ fontSize: 9, fontWeight: 400, marginTop: 2 }}>{t.name}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function CashierPage() {
  const sbRef = useRef(createClient())
  const sb = sbRef.current
  const { employee, permissions } = useAuth()
  // ✅ المشرف العام: عرض كامل في صفحة الكاشير زي الأدمن (كل الفروع + تقرير الشيفت + الدفع)
  const isAdmin = permissions?.all === true || employee?.role === 'general_supervisor'
  // ✅ Fix: مساعد الكاشير بقى نفس مستوى موظف/مشرف الصالة بالظبط - مش صلاحيات كاشير كاملة
  const isCashierRole = isAdmin || employee?.role === 'cashier'
  // ✅ جديد: حساب مشترك محدود لمشرفي/موظفي الصالة + مساعد الكاشير - يقدروا يشوفوا الطاولات ويضيفوا طلبات
  // بس، من غير الدفع/الدمج/التحويل/التقارير
  const isLimitedTableRole = ['hall_supervisor', 'hall_manager', 'assistant_cashier'].includes(employee?.role || '')

  // ✅ كشف الموبايل عشان نظبط تنسيق الهيدر والتابات فوق
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 860)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const [orders, setOrders] = useState<Order[]>([])
  const [tables, setTables] = useState<TableRow[]>([])
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([])
  // ✅ جديد: قائمة الدمجات النشطة حاليًا بين الطاولات (فاتورة موحدة مؤقتة)
  const [activeMerges, setActiveMerges] = useState<{ id: string; primary_table_id: string; merged_table_id: string }[]>([])
  const tablesRef = useRef<TableRow[]>([])
  useEffect(() => { tablesRef.current = tables }, [tables])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'active' | 'all' | 'done'>('active')
  const [shift, setShift] = useState<'shift1' | 'shift2' | 'shift3'>('shift1')
  const [shiftStarted, setShiftStarted] = useState(false)
  const [shiftStart, setShiftStart] = useState<Date | null>(null)
  // ✅ جديد: اسم الكاشير اللي ماسك الشيفت المختار حاليًا - بييجي من قاعدة البيانات فيبان لأي حد بيفتح الصفحة
  const [activeShiftCashierName, setActiveShiftCashierName] = useState<string | null>(null)
  // ✅ جديد: تسجيل مصروف نقدي أثناء الشيفت مباشرة من شاشة الكاشير (بدل ما يحتاج يفتح صفحة اليومية)
  const [showExpenseModal, setShowExpenseModal] = useState(false)
  const [expDesc, setExpDesc] = useState('')
  const [expAmount, setExpAmount] = useState('')
  const [expStatus, setExpStatus] = useState<'paid' | 'pending'>('paid')
  const [expSaving, setExpSaving] = useState(false)
  const [expSaved, setExpSaved] = useState(false)
  // ✅ جديد: صور الفاتورة المرفقة مع المصروف - ممكن أكتر من صورة
  const [expImages, setExpImages] = useState<File[]>([])
  const [expImagePreviews, setExpImagePreviews] = useState<string[]>([])
  const [expUploading, setExpUploading] = useState(false)
  // ✅ جديد: تسجيل عربون (Deposit) لعميل من شاشة الكاشير مباشرة - باسمه ورقمه بس (مش لازم يكون مسجّل مسبقًا،
  // لو رقمه مش موجود في نظام العملاء بننشئله حساب جديد تلقائيًا)
  const [showDepositModal, setShowDepositModal] = useState(false)
  const [depCustName, setDepCustName] = useState('')
  const [depCustPhone, setDepCustPhone] = useState('')
  const [depAmount, setDepAmount] = useState('')
  const [depMethod, setDepMethod] = useState<'cash' | 'visa' | 'online'>('cash')
  const [depCardBank, setDepCardBank] = useState<'maybank' | 'bsn' | ''>('')
  // ✅ جديد: يوم الحجز (يوم رجوع العميل) - العربون يُنسب لتوتال هذا اليوم، مش يوم أخذ العربون نفسه
  const [depReservationDate, setDepReservationDate] = useState(() => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kuala_Lumpur' }))
  const [depSaving, setDepSaving] = useState(false)
  const [depSaved, setDepSaved] = useState(false)
  const [shiftOrders, setShiftOrders] = useState<Order[]>([])
  const [showShiftReport, setShowShiftReport] = useState(false)
  // ✅ جديد: مودال اختيار اسم الكاشير الحقيقي وقت بدء الشيفت - مهم لما يكون فيه حساب دخول مشترك بين أكتر من كاشير
  // (بدل ما الاسم ياخده تلقائي من الحساب اللي داخل بيه، اللي هيبقى نفسه لأي حد داخل بنفس الحساب المشترك)
  const [showStartShiftModal, setShowStartShiftModal] = useState(false)
  const [startShiftCashierList, setStartShiftCashierList] = useState<{ id: string; name: string }[]>([])
  const [startShiftSelectedName, setStartShiftSelectedName] = useState('')
  const [startShiftCustomName, setStartShiftCustomName] = useState('')
  const [soundEnabled, setSoundEnabled] = useState(false)
  // ✅ جديد: بيانات تاب "Closed" - كل العمليات المقفولة (مدفوعة/ملغية) لليوم الحالي بتوقيت ماليزيا + جلسات الشيفتات (الكاشير، بداية/نهاية الشيفت)
  // المطعم شغال 24 ساعة، فبيانات هذا التاب تتصفّر يوميًا تلقائيًا لأنها تجيب بيانات "اليوم الحالي" فقط
  const [closedOrders, setClosedOrders] = useState<Order[]>([])
  const [closedSessions, setClosedSessions] = useState<{ id: string; shift: string; cashier_name: string; started_at: string; ended_at: string | null; branch_id: string | null }[]>([])
  // ✅ جديد: مصروفات الكاش المسجّلة لليوم المعروض في Closed - كانت بتتسجل في قاعدة البيانات بس مفيهاش أي عرض هنا
  const [closedExpenses, setClosedExpenses] = useState<{ id: string; shift: string; cashier_name: string; description: string; amount: number; status: string; created_at: string; branch_id: string | null; receipt_urls: string[] | null }[]>([])
  // ✅ جديد: تفاصيل دفعات الفواتير المقسّمة (Split Payment) - مطلوبة عشان نجمع كام كاش وكام فيزا فعليًا حتى للفواتير المقسّمة
  const [closedSplitPayments, setClosedSplitPayments] = useState<{ order_id: string; person_label: string; amount: number; payment_method: string; card_bank: string | null }[]>([])
  // ✅ جديد: العربونات المأخوذة في نطاق اليوم/الشيفت المعروض في تاب Closed - عشان تتحسب ضمن Cash/Visa/Online
  const [closedDeposits, setClosedDeposits] = useState<{ id: string; amount: number; payment_method: string; card_bank: string | null; created_at: string; created_by_name: string | null; branch_id: string | null; reservation_date?: string | null }[]>([])
  const [closedLoading, setClosedLoading] = useState(false)
  const [closedFetched, setClosedFetched] = useState(false)
  // ✅ جديد: عرض صورة إيصال المصروف بحجمها الكامل جوه نفس الصفحة (بدل ما تفتح في تاب جديد)
  const [viewingReceiptUrl, setViewingReceiptUrl] = useState<string | null>(null)
  // ✅ جديد: ملخص مجمّع لشيفت مقفول (كم صنف اتباع مجمّع، طاولات فري، خصومات) - يفتح لما تضغط على بطاقة الشيفت
  const [itemSummary, setItemSummary] = useState<{
    session: { cashier_name: string; shift: string; started_at: string; ended_at: string | null }; sessOrders: Order[]
    cash: number; visa: number; visaMaybank: number; visaBsn: number; online: number; credit: number
    discount: number; freeCount: number; freeAmount: number; deposits: number; total: number; expPaid: number; expPending: number
  } | null>(null)


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

  // ✅ جديد: جلب اسم الكاشير اللي ماسك الشيفت الحالي (للفرع والشيفت المختارين) من قاعدة البيانات
  // بيبان لأي حد بيفتح الصفحة، مش بس اللي بدأ الشيفت من جهازه
  // ✅ Fix حرج: شلنا شرط session_date = النهاردة بالكامل. المطعم شغال 24 ساعة، فلو شيفت بدأ قبل منتصف الليل
  // واستمر بعده، "النهاردة" بتتغيّر لكن الجلسة لسه شغالة فعليًا - فكان بيختفي اسم الكاشير فجأة بعد منتصف الليل
  // ويرجع يوري "Start Shift" وكأن محدش ماسك الشيفت. دلوقتي بندور بس على "أحدث جلسة لسه مفتوحة" (ended_at فاضي)
  // لنفس الشيفت والفرع، بغض النظر عن تاريخها - وده صحيح منطقيًا لأنه أصلًا مفروض تكون جلسة واحدة بس مفتوحة في كل لحظة
  const fetchActiveShiftCashier = useCallback(async () => {
    if (!isCashierRole) return
    let q = sb.from('cashier_shift_sessions').select('cashier_name')
      .eq('shift', shift).is('ended_at', null)
      .order('started_at', { ascending: false }).limit(1)
    if (employee?.branch_id) q = q.eq('branch_id', employee.branch_id)
    const { data } = await q.maybeSingle()
    setActiveShiftCashierName(data?.cashier_name || null)
  }, [sb, shift, employee?.branch_id, isCashierRole])
  useEffect(() => { fetchActiveShiftCashier() }, [fetchActiveShiftCashier])

  // Restore shift from localStorage
  useEffect(() => {
    const active = localStorage.getItem('cashier_shift_active')
    const start  = localStorage.getItem('cashier_shift_start')
    const sv     = localStorage.getItem('cashier_shift_value')
    if (active === 'true' && start) {
      setShiftStarted(true)
      setShiftStart(new Date(start))
    }
    if (sv) setShift(sv as 'shift1' | 'shift2' | 'shift3')
  }, [])
  const [tick, setTick] = useState(0)
  const [notif, setNotif] = useState<string | null>(null)
  const [newOrderAlert, setNewOrderAlert] = useState<{ tableName: string; itemsCount: number; total: number } | null>(null)
  // ✅ تتبّع الطاولات اللي عليها طلب جديد/إضافي لسه محدش فتحها — يفضل badge ظاهر عليها لحد ما تُفتح
  const [unseenTableIds, setUnseenTableIds] = useState<Set<string>>(new Set())
  // ✅ لتجنب تكرار الإشعار: نتذكر الطلبات اللي اتعمل لها إشعار "طلب جديد" حديثًا (من حدث INSERT على orders)
  const recentNewOrderIdsRef = useRef<Set<string>>(new Set())
  // ✅ تجميع إشعارات إضافة أصناف على طلب موجود (لما عميل تاني على نفس الطاولة يطلب) في إشعار واحد بدل واحد لكل صنف
  const itemsBatchRef = useRef<{ timer: ReturnType<typeof setTimeout> | null; byOrder: Map<string, number> }>({ timer: null, byOrder: new Map() })
  const [payOrder, setPayOrder] = useState<Order | null>(null)
  const [transferOrder, setTransferOrder] = useState<Order | null>(null)
  const [addOrderTable, setAddOrderTable] = useState<TableRow | null>(null)
  // ✅ جديد: الطاولة اللي بندمجها حاليًا (يفتح مودال اختيار الطاولة الشريكة)
  const [mergePickerTable, setMergePickerTable] = useState<TableRow | null>(null)
  const [view, setView] = useState<'orders' | 'tables' | 'archive'>('tables')
  // ✅ تاب الأرشيف - بحث في الفواتير المقفولة (مدفوعة/ملغية) بالتاريخ أو رقم الطاولة
  const [archiveDate, setArchiveDate] = useState('')
  const [archiveTableSearch, setArchiveTableSearch] = useState('')
  const [archiveResults, setArchiveResults] = useState<Order[]>([])
  const [archiveLoading, setArchiveLoading] = useState(false)
  const [archiveSearched, setArchiveSearched] = useState(false)
  // ✅ جديد: الفاتورة المختارة من الأرشيف لعرض تفاصيلها الكاملة في مودال بمنتصف الشاشة
  const [archiveDetailOrder, setArchiveDetailOrder] = useState<Order | null>(null)
  // ✅ جديد: مصروفات الكاش لليوم المختار في الأرشيف — عشان الكاشير العادي (اللي مش عنده صفحة الشيفت) يشوف
  // "💸 Expenses" وإجماليها لكل يوم، بنفس الطريقة اللي بتظهر بيها في صفحة الشيفت
  const [archiveExpenses, setArchiveExpenses] = useState<{ id: string; shift: string; cashier_name: string; description: string; amount: number; status: string; created_at: string; receipt_urls: string[] | null }[]>([])
  const [adminBranchFilter, setAdminBranchFilter] = useState<string>('')
  // ✅ Fix: الأدمن يبدأ بـ"كل الفروع" افتراضيًا (بدل ما يتفلتر تلقائيًا على أول فرع في القايمة من غير ما يلاحظ)
  // - ده كان سبب مباشر لمشاكل "الأوردر مش ظاهر" رغم إنه موجود فعليًا، لمجرد إن الأدمن كان شايف فرع تاني

  const searchArchive = useCallback(async () => {
    setArchiveLoading(true)
    setArchiveSearched(true)
    const SEL_ARCHIVE = `id,table_id,status,total_amount,discount_amount,discount_type,payment_method,service_charge,sst_amount,shift,notes,created_at,confirmed_at,paid_at,customer_id,cancel_reason,paid_by_name,tables(number,name,section),order_items(id,quantity,unit_price,notes,size_name,destination,status,created_at,cancel_reason,menu_items(name,name_en,or_code))`
    let q = sb.from('orders').select(SEL_ARCHIVE).in('status', ['paid', 'cancelled']).order('created_at', { ascending: false }).limit(200)
    if (archiveDate) {
      // ✅ Fix حرج: نفس مشكلة تاب Closed - لازم +08:00 وإلا الوقت يتفهم كـ UTC بالغلط
      q = q.gte('created_at', `${archiveDate}T00:00:00+08:00`).lt('created_at', `${archiveDate}T23:59:59.999+08:00`)
    }
    const { data } = await q
    let results = (data as any as Order[]) || []
    // ✅ فلترة برقم الطاولة (بحث نصي بسيط على اسم/رقم الطاولة)
    if (archiveTableSearch.trim()) {
      const s = archiveTableSearch.trim().toLowerCase()
      results = results.filter(o => {
        const tblName = (o.tables?.name || '').toLowerCase()
        const tblNum = String(o.tables?.number || '')
        return tblName.includes(s) || tblNum.includes(s)
      })
    }
    setArchiveResults(results)

    // ✅ جديد: لو فيه تاريخ محدد، نجيب مصروفات الكاش لليوم ده كمان — نفس جدول daily_cash_expenses
    // اللي بيقرا منه تقرير الشيفت. نطاق الفرع: الكاشير العادي = فرعه؛ الأدمن = الفرع المختار.
    if (archiveDate) {
      let xq = sb.from('daily_cash_expenses')
        .select('id,shift,cashier_name,description,amount,status,created_at,receipt_urls')
        .eq('expense_date', archiveDate).order('created_at', { ascending: false })
      if (!isAdmin && employee?.branch_id) xq = xq.eq('branch_id', employee.branch_id)
      if (isAdmin && adminBranchFilter) xq = xq.eq('branch_id', adminBranchFilter)
      const { data: xData } = await xq
      let expenses = (xData as any[]) || []

      // ✅ الكاشير العادي: الحساب مشترك، وعمود cashier_name في صف المصروف ممكن يطلع غلط لو جلسة شيفت
      // قديمة اتنسيت مفتوحة. فبدل ما نعتمد عليه، بنطابق المصروف بنافذة وقت جلسة الشيفت — بالظبط زي
      // ما تقرير الشيفت بيعمل — فيظهر تحت الكاشير الماسك الشيفت فعليًا وقت تسجيل المصروف.
      if (!isAdmin && activeShiftCashierName) {
        const { data: sessData } = await sb.from('cashier_shift_sessions')
          .select('shift,started_at,ended_at')
          .in('session_date', [archiveDate, new Date(new Date(archiveDate + 'T00:00:00+08:00').getTime() - 86400000).toLocaleDateString('en-CA', { timeZone: 'Asia/Kuala_Lumpur' })])
          .eq('cashier_name', activeShiftCashierName)
          .eq('branch_id', employee?.branch_id || '')
        const sessions = (sessData as any[]) || []
        expenses = sessions.length === 0 ? [] : expenses.filter(e => sessions.some(s => {
          if (s.shift !== e.shift) return false
          const t = new Date(e.created_at).getTime()
          const st = new Date(s.started_at).getTime()
          const en = s.ended_at ? new Date(s.ended_at).getTime() : Date.now()
          return t >= st && t <= en
        }))
      }
      setArchiveExpenses(expenses)
    } else {
      setArchiveExpenses([])
    }

    setArchiveLoading(false)
  }, [sb, archiveDate, archiveTableSearch, isAdmin, adminBranchFilter, employee?.branch_id, activeShiftCashierName])

  const [fetchError, setFetchError] = useState<string | null>(null)

  // ✅ Fix حرج: قائمة مؤقتة بالطاولات اللي اتدفعت لتوها - عشان لو fetchAll اشتغل بعد الدفع مباشرة ورجّع نسخة
  // من قاعدة البيانات لسه مش متزامنة تمامًا (تأخير طبيعي بسيط)، منمنعهاش من إرجاع الطلب المدفوع للشاشة بالغلط
  const recentlyPaidTableIdsRef = useRef<Set<string>>(new Set())
  const fetchAll = useCallback(async () => {
    const SEL = `id,table_id,status,total_amount,discount_amount,discount_type,payment_method,service_charge,sst_amount,shift,notes,created_at,confirmed_at,paid_at,customer_id,cancel_reason,paid_by_name,tables(number,name,section),order_items(id,quantity,unit_price,notes,size_name,destination,status,created_at,cancel_reason,menu_items(name,name_en,or_code))`
    let tablesQuery = sb.from('tables').select('*').order('number')
    // ✅ غير الأدمن يشوف بس طاولات فرعه
    if (!isAdmin && employee?.branch_id) tablesQuery = tablesQuery.eq('branch_id', employee.branch_id)
    const [activeRes, tablesRes] = await Promise.all([
      // ✅ Fix عاجل: شلنا الـ limit(100) - كان بيقطع أي طلب نشط زيادة عن أحدث 100 طلب،
      // فطاولات كانت بتفضل "مشغولة" في جدول الطاولات بس الطلب نفسه يختفي من القايمة (بيفتح "Add Order" فاضية بدل الطلب الحقيقي)
      sb.from('orders').select(SEL).in('status', ['confirmed','preparing','ready']).order('created_at', { ascending: false }),
      tablesQuery,
    ])
    // ✅ Fix: لو الاستعلام فشل (عمود ناقص، RLS، إلخ) كان بيفضل صامت والطلبات كلها تختفي من غير أي تنبيه
    // دلوقتي بنسجل الخطأ في الـ console ونعرض تحذير واضح بدل الاختفاء الصامت
    if (activeRes.error) {
      console.error('fetchAll orders error:', activeRes.error)
      setFetchError(activeRes.error.message)
    } else if (tablesRes.error) {
      console.error('fetchAll tables error:', tablesRes.error)
      setFetchError(tablesRes.error.message)
    } else {
      setFetchError(null)
    }
    const allowedTables = tablesRes.data || []
    const allowedTableIds = new Set(allowedTables.map((t: any) => t.id))
    // ✅ غير الأدمن: نستثني طلبات الفروع التانية حتى لو رجعت في نفس الاستعلام (orders مفيهاش branch_id مباشر)
    const filteredOrders = isAdmin
      ? (activeRes.data as any) || []
      : ((activeRes.data as any) || []).filter((o: any) => allowedTableIds.has(o.table_id))
    // ✅ Fix حرج: نستبعد أي طاولة اتدفعت حديثًا (آخر كذا ثانية) حتى لو ظهرت في نتيجة الاستعلام - حماية من
    // تأخير التزامن الطبيعي بين لحظة الكتابة (UPDATE) ولحظة القراءة (SELECT) اللي كان بيرجّع الطلب المدفوع للشاشة
    const finalOrders = recentlyPaidTableIdsRef.current.size > 0
      ? filteredOrders.filter((o: any) => !recentlyPaidTableIdsRef.current.has(o.table_id))
      : filteredOrders
    setOrders(finalOrders)
    setTables(allowedTables)
    // ✅ جديد: جلب الدمجات النشطة (اللي لسه ما اتفكتش) للطاولات المتاحة لهذا المستخدم
    if (allowedTableIds.size > 0) {
      const { data: mergesData } = await sb.from('table_merges')
        .select('id, primary_table_id, merged_table_id')
        .is('unmerged_at', null)
      setActiveMerges((mergesData || []).filter((m: any) => allowedTableIds.has(m.primary_table_id) || allowedTableIds.has(m.merged_table_id)))
    }
    setLoading(false)
  }, [sb, isAdmin, employee?.branch_id])

  // ✅ جديد: إيجاد الطاولة الشريكة المدموجة مع طاولة معينة (لو موجودة) - بيرجع null لو الطاولة مش مدموجة
  function getMergePartnerTableId(tableId: string): string | null {
    const m = activeMerges.find(m => m.primary_table_id === tableId || m.merged_table_id === tableId)
    if (!m) return null
    return m.primary_table_id === tableId ? m.merged_table_id : m.primary_table_id
  }

  // ✅ جديد: دمج طاولتين مؤقتًا في فاتورة واحدة موحدة
  async function mergeTables(tableA: string, tableB: string) {
    // ✅ Fix: فحص صلاحية حقيقي جوه الدالة نفسها، مش بس إخفاء الزرار من الواجهة
    if (!isCashierRole) { alert('🔒 Merging tables requires cashier access'); return }
    const fullName = [employee?.name, (employee as any)?.name_en].filter(Boolean).join(' ') || 'غير معروف'
    const branchId = tablesRef.current.find(t => t.id === tableA)?.branch_id || null
    const { error } = await sb.from('table_merges').insert([{
      primary_table_id: tableA, merged_table_id: tableB, branch_id: branchId, merged_by_name: fullName,
    }])
    if (error) { alert('حصل خطأ أثناء الدمج: ' + error.message); return }
    await fetchAll()
  }

  // ✅ جديد: فك دمج الطاولتين (بدون التأثير على الطلبات نفسها، فقط إلغاء الربط المؤقت)
  async function unmergeTables(mergeId: string) {
    // ✅ Fix: فحص صلاحية حقيقي جوه الدالة نفسها
    if (!isCashierRole) { alert('🔒 Unmerging tables requires cashier access'); return }
    if (!confirm('هل أنت متأكد من فك دمج الطاولتين؟ ستعود كل طاولة مستقلة بفاتورتها.')) return
    await sb.from('table_merges').update({ unmerged_at: new Date().toISOString() }).eq('id', mergeId)
    await fetchAll()
  }

  // Separate fetch for shift report (paid orders)
  const fetchPaidOrders = useCallback(async () => {
    const SEL = `id,table_id,status,total_amount,discount_amount,discount_type,payment_method,service_charge,sst_amount,shift,notes,created_at,confirmed_at,paid_at,customer_id,cancel_reason,paid_by_name,tables(number,name,section),order_items(id,quantity,unit_price,notes,size_name,destination,status,created_at,cancel_reason,menu_items(name,name_en,or_code))`
    const { data } = await sb.from('orders').select(SEL).eq('status', 'paid').order('paid_at', { ascending: false }).limit(200)
    return (data as any) || []
  }, [sb])

  // ✅ جديد: تاريخ تاب "Closed" - افتراضيًا النهاردة، لكن الأدمن يقدر يغيّره لأي يوم قديم
  const [closedDate, setClosedDate] = useState(() => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kuala_Lumpur' }))

  // ✅ جديد: جلب كل العمليات المقفولة (مدفوعة/ملغية) ليوم معيّن بتوقيت ماليزيا (النهاردة افتراضيًا، أو أي يوم يختاره الأدمن)، بالإضافة لجلسات الشيفت (الكاشير، وقت البداية/النهاية)
  const fetchClosedData = useCallback(async () => {
    setClosedLoading(true)
    const targetDate = closedDate || new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kuala_Lumpur' })
    // ✅ Fix حرج جدًا: لازم نحدد المنطقة الزمنية صراحةً (+08:00 توقيت ماليزيا)، وإلا قاعدة البيانات بتفهم
    // الوقت ده كـ UTC تلقائيًا - يعني "00:00" بتتفهم كـ 8 الصبح بتوقيت ماليزيا مش نص الليل! وده كان بيخلي أي
    // طلب اتدفع قبل الساعة 8 الصبح (زي وقت الفجر/الليل) يقع بره نطاق اليوم المحسوب بالغلط، فيبان إجمالي صفر
    const dayStart = `${targetDate}T00:00:00+08:00`
    const dayEnd = `${targetDate}T23:59:59.999+08:00`

    // ✅ Fix حرج: اليوم المحاسبي "بتاعنا" بيتحدد بيوم بداية الشيفت بس، مش بتاريخ منتصف الليل التقويمي.
    // يعني شيفت 3 اللي بيبدأ 7 مساءً ويكمل لحد 5 الفجر تاني يوم - كل بياناته (حتى الجزء اللي بعد نص الليل)
    // بتتحسب على "يوم بدايته" بس، ومش المفروض تظهر تاني في تقرير اليوم التالي خالص. عشان كده الجلب بقى
    // بسيط: session_date = اليوم المطلوب بالظبط، من غير أي توسيع لليوم اللي بعده
    let sq = sb.from('cashier_shift_sessions').select('id,shift,cashier_name,started_at,ended_at,branch_id')
      .eq('session_date', targetDate)
      .order('started_at', { ascending: true })
    if (!isAdmin && employee?.branch_id) sq = sq.eq('branch_id', employee.branch_id)
    if (isAdmin && adminBranchFilter) sq = sq.eq('branch_id', adminBranchFilter)
    const { data: sData } = await sq
    let sessions = (sData as any[]) || []
    // ✅ جديد: أي كاشير (غير الأدمن) يشوف بس بطاقة شيفته هو، مش شيفتات باقي الكاشيرية
    if (!isAdmin) {
      sessions = sessions.filter(s => s.cashier_name === employee?.name)
    }
    setClosedSessions(sessions)

    // ✅ Fix حرج جدًا: منع تكرار نفس الفاتورة في يومين مختلفين. لو فيه شيفت بدأ *اليوم اللي فات* ولسه شغال
    // (أو امتد لحد داخل اليوم المطلوب دلوقتي)، الفترة المتداخلة دي أصلاً بتاعة الشيفت القديم ده (يوم بدايته)
    // مش اليوم الحالي - فبنأجّل بداية استعلام اليوم الحالي لحد ما الشيفت القديم ده يخلص فعليًا (أو "دلوقتي"
    // لو لسه شغال)، عشان الفترة متتحسبش مرتين. من غير الفحص ده، أي طلب اتدفع بعد نص الليل من شيفت امبارح
    // كان بيظهر مرتين: تحت شيفت امبارح صح، وتحت "Other Closed Orders" النهاردة غلط
    const prevDate = new Date(new Date(targetDate + 'T00:00:00+08:00').getTime() - 24 * 60 * 60 * 1000)
      .toLocaleDateString('en-CA', { timeZone: 'Asia/Kuala_Lumpur' })
    let pq = sb.from('cashier_shift_sessions').select('ended_at').eq('session_date', prevDate)
      .or(`ended_at.is.null,ended_at.gte.${dayStart}`)
    if (!isAdmin && employee?.branch_id) pq = pq.eq('branch_id', employee.branch_id)
    if (isAdmin && adminBranchFilter) pq = pq.eq('branch_id', adminBranchFilter)
    const { data: prevData } = await pq
    let effectiveDayStart = dayStart
    for (const p of (prevData || [])) {
      const pEnd = p.ended_at || new Date().toISOString() // لسه شغال؟ يبقى النهاردة كله محجوز لحد ما يخلص
      if (new Date(pEnd).getTime() > new Date(effectiveDayStart).getTime()) effectiveDayStart = pEnd
    }

    // ✅ جديد: تاب Closed بتاع الكاشير المفروض يوري "الشيفت كامل من أوله لآخره" حتى لو عدّى منتصف الليل -
    // بعكس تقرير اليومية اللي لازم يتقسم على أيام تقويمية للمحاسبة. عشان كده بنوسّع نطاق جلب الطلبات ليغطي
    // من أول جلسة شيفت (حتى لو بدأت امبارح) لحد نهاية اليوم المطلوب (أو دلوقتي لو فيه شيفت لسه شغال)
    let ordersRangeStart = effectiveDayStart
    let ordersRangeEnd = dayEnd
    // ✅ Fix حرج جدًا: المقارنة بين الأوقات لازم تتم بالتوقيت الحقيقي (getTime) مش كنصوص (String) - المقارنة
    // النصية كانت بتفشل لما تختلف صيغة المنطقة الزمنية بين القيمتين (مثلاً "21:05+00:00" من قاعدة البيانات
    // مقابل "23:59+08:00" الافتراضي)، فكان بيقف نطاق الطلبات عند نص الليل بالظبط ومش بيوسّع لآخر الشيفت الحقيقي
    for (const s of sessions) {
      if (new Date(s.started_at).getTime() < new Date(ordersRangeStart).getTime()) ordersRangeStart = s.started_at
      const sEnd = s.ended_at || new Date().toISOString()
      if (new Date(sEnd).getTime() > new Date(ordersRangeEnd).getTime()) ordersRangeEnd = sEnd
    }

    const SEL_CLOSED = `id,table_id,status,total_amount,discount_amount,discount_type,payment_method,card_bank,service_charge,sst_amount,shift,notes,created_at,confirmed_at,paid_at,customer_id,cancel_reason,paid_by_name,tables(number,name,section),order_items(id,quantity,unit_price,notes,size_name,destination,status,created_at,cancel_reason,menu_items(name,name_en,or_code))`
    // ✅ الطلبات المدفوعة بنحدد نطاقها بـ paid_at (وقت القفل الفعلي) على مدى النطاق الموسّع (يغطي شيفتات عابرة لمنتصف الليل)
    // والملغية (مالهاش paid_at) بتفضل محصورة في اليوم المطلوب بس (created_at)
    const { data: oData } = await sb.from('orders').select(SEL_CLOSED)
      .or(`and(status.eq.paid,paid_at.gte.${ordersRangeStart},paid_at.lte.${ordersRangeEnd}),and(status.eq.cancelled,created_at.gte.${effectiveDayStart},created_at.lte.${dayEnd})`)
      // ✅ الترتيب بقى حسب وقت القفل الفعلي (paid_at) - مش وقت فتح الطلب - عشان الفواتير تظهر بترتيب زمني صحيح
      .order('paid_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
    let results = (oData as any as Order[]) || []
    // ✅ نقصر النتيجة على الطاولات المسموح بها لهذا المستخدم (نفس منطق fetchAll)، وعلى فرع الأدمن المختار لو محدد
    const allowedIds = new Set(tables.map(t => t.id))
    results = results.filter(o => allowedIds.has(o.table_id))
    if (isAdmin && adminBranchFilter) {
      results = results.filter(o => tables.find(t => t.id === o.table_id)?.branch_id === adminBranchFilter)
    }
    // ✅ جديد: أي كاشير (غير الأدمن) يشوف بس الفواتير اللي هو شخصيًا دفّعها - مش فواتير باقي الكاشيرية في نفس اليوم
    if (!isAdmin) {
      results = results.filter(o => (o as any).paid_by_name === employee?.name)
    }
    setClosedOrders(results)

    // ✅ جديد: لأي فاتورة مقسّمة (payment_method = 'split')، نجيب تفاصيل كل دفعة فيها (طريقتها وبنكها الحقيقي)
    // عشان نقدر نجمعها صح جوه أعمدة Cash/Visa/Online/Credit بدل ما تضيع تحت "split" عامة
    const splitOrderIds = results.filter(o => o.payment_method === 'split').map(o => o.id)
    if (splitOrderIds.length > 0) {
      const { data: splitData } = await sb.from('order_split_payments')
        .select('order_id, person_label, amount, payment_method, card_bank').in('order_id', splitOrderIds)
      setClosedSplitPayments((splitData as any) || [])
    } else {
      setClosedSplitPayments([])
    }

    // ✅ Fix: العربون يُنسب ليوم الحجز (reservation_date) مش يوم أخذه فعليًا - عربون يُؤخذ النهارده لحجز الأسبوع
    // الجاي لازم يظهر في توتال يوم الحجز، مش توتال النهارده. اللي اتاخد بدون تاريخ حجز مستقبلي (نفس اليوم) بيفضل يتحسب زي ما كان
    let dq = sb.from('customer_deposits').select('id, amount, payment_method, card_bank, created_at, created_by_name, branch_id, reservation_date')
      .eq('reservation_date', closedDate)
    if (!isAdmin && employee?.branch_id) dq = dq.eq('branch_id', employee.branch_id)
    if (isAdmin && adminBranchFilter) dq = dq.eq('branch_id', adminBranchFilter)
    const { data: depositsData } = await dq
    let deposits = (depositsData as any[]) || []
    // ✅ نفس تقييد "كل كاشير يشوف بس بتاعته" - العربونات اللي هو شخصيًا سجّلها بس
    if (!isAdmin) {
      deposits = deposits.filter(d => d.created_by_name === employee?.name)
    }
    setClosedDeposits(deposits)

    // ✅ جديد: جلب مصروفات الكاش المسجّلة لليوم ده - نفس جدول daily_cash_expenses اللي زرار "💸 Add Expense" بيكتب فيه
    let eq = sb.from('daily_cash_expenses').select('id,shift,cashier_name,description,amount,status,created_at,branch_id,receipt_urls')
      .eq('expense_date', targetDate).order('created_at', { ascending: false })
    if (!isAdmin && employee?.branch_id) eq = eq.eq('branch_id', employee.branch_id)
    if (isAdmin && adminBranchFilter) eq = eq.eq('branch_id', adminBranchFilter)
    const { data: expData } = await eq
    setClosedExpenses((expData as any) || [])

    setClosedFetched(true)
    setClosedLoading(false)
  }, [sb, tables, isAdmin, adminBranchFilter, employee?.branch_id, closedDate])

  // ✅ لما الأدمن يغيّر التاريخ، نسحب البيانات تلقائيًا للتاريخ الجديد (من غير ما يحتاج يدوس تحديث بنفسه)
  useEffect(() => {
    if (closedFetched) fetchClosedData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [closedDate])

  useEffect(() => { fetchAll() }, [fetchAll])

  useEffect(() => {
    const channel = sb.channel('cashier-rt')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, async (payload: any) => {
        fetchAll()
        const newOrderId = payload.new?.id
        if (newOrderId) {
          // ✅ نسجّل الطلب ده عشان معالج order_items يعرف يعمل الإشعار بعد ما الأصناف اتحفظت
          recentNewOrderIdsRef.current.add(newOrderId)
          setTimeout(() => recentNewOrderIdsRef.current.delete(newOrderId), 15000)
        }
        // ✅ Fix جذري: مش بنبعت إشعار هنا خالص — الإشعار بيجي من معالج order_items INSERT
        // عشان نضمن إن عدد الأصناف يكون صح دايماً (مش 0)
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'order_items' }, (payload: any) => {
        fetchAll()
        const orderId = payload.new?.order_id
        if (!orderId) return
        const batch = itemsBatchRef.current
        batch.byOrder.set(orderId, (batch.byOrder.get(orderId) || 0) + 1)
        if (batch.timer) clearTimeout(batch.timer)
        batch.timer = setTimeout(async () => {
          const orderIds = Array.from(batch.byOrder.keys())
          batch.byOrder.clear()
          batch.timer = null
          for (const oid of orderIds) {
            const { data: orderData } = await sb.from('orders').select('table_id,total_amount,status').eq('id', oid).single()
            if (!orderData || orderData.status === 'cancelled') continue
            const tbl = tablesRef.current.find(t => t.id === orderData.table_id)
            let tableName = tbl?.name || (tbl?.number ? `Table ${tbl.number}` : 'Table')
            if (!tbl && orderData.table_id) {
              const { data: tblData } = await sb.from('tables').select('name,number').eq('id', orderData.table_id).single()
              if (tblData) tableName = tblData.name || `Table ${tblData.number}`
            }
            const { data: itemsData } = await sb.from('order_items').select('id').eq('order_id', oid)
            const itemsCount = itemsData?.length || 0
            if (orderData.table_id) setUnseenTableIds(prev => new Set(prev).add(orderData.table_id))
            // ✅ لو الطلب جديد (موجود في recentNewOrderIds) → إشعار "طلب جديد"
            // لو مش جديد → إشعار "أصناف إضافية"
            const isNewOrder = recentNewOrderIdsRef.current.has(oid)
            setNewOrderAlert({ tableName, itemsCount, total: orderData.total_amount || 0 })
            setNotif(isNewOrder ? '🆕 New order received!' : `🆕 New items added — ${tableName}!`)
            setTimeout(() => setNotif(null), 5000)
            playSound('order')
            sendNotification(
              isNewOrder ? '🆕 New Order!' : '🆕 Items Added!',
              `${tableName} — ${itemsCount} item(s)`
            )
          }
        }, 1200)
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, async (payload: any) => {
        const newStatus = (payload.new as any)?.status
        const tableId = (payload.new as any)?.table_id
        // ✅ Fix: لو الطلب اتلغى تلقائيًا (فشل حفظ الأصناف من المنيو وتم التراجع عنه)،
        // نشيل البادچ/الإشعار عن الطاولة دي بدل ما يفضلوا ظاهرين لطلب أصلاً ملغي
        if (newStatus === 'cancelled' && tableId) {
          setUnseenTableIds(prev => { const next = new Set(prev); next.delete(tableId); return next })
          setNewOrderAlert(prev => {
            if (!prev) return prev
            const tbl = tablesRef.current.find(t => t.id === tableId)
            const tblName = tbl?.name || (tbl?.number ? `Table ${tbl.number}` : '')
            return prev.tableName === tblName ? null : prev
          })
          setNotif('⚠️ Order failed and was cancelled — ask customer to retry')
          setTimeout(() => setNotif(null), 6000)
        }
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

  // ✅ إلغاء فاتورة كاملة أو صنف واحد - بسبب إجباري، متاح للكاشير بس
  const [cancelOrderTarget, setCancelOrderTarget] = useState<Order | null>(null)
  // ✅ Fix: أضفنا totalQty عشان نقدر نلغي جزء من الكمية بس (مثلاً 1 من أصل 2)، مش كل الصنف إجباريًا
  const [cancelItemTarget, setCancelItemTarget] = useState<{ orderId: string; itemId: string; itemName: string; totalQty: number } | null>(null)
  const [cancelItemQty, setCancelItemQty] = useState(1)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelSaving, setCancelSaving] = useState(false)

  // ✅ جديد: تحميل صنف على موظف (خطأ في الطلب أو وجبة شخصية) - الصنف يتشال من فاتورة العميل
  // ويتسجل فورًا كمخالفة "active" على نفس جدول المخالفات، فينزل من راتب الموظف ويظهر في "راتبي"
  // وشيت الرواتب في نفس اليوم - من غير أي اعتماد مطلوب من مدير/أدمن (نفس آلية مخالفة يسجلها مدير مباشرة)
  const [chargeItemTarget, setChargeItemTarget] = useState<{ orderId: string; itemId: string; itemName: string; unitPrice: number; totalQty: number } | null>(null)
  const [chargeQty, setChargeQty] = useState(1)
  const [chargeStaffList, setChargeStaffList] = useState<{ id: string; name: string; name_en: string | null; employee_number: string | null }[]>([])
  const [chargeEmployeeId, setChargeEmployeeId] = useState('')
  const [chargeStaffSearch, setChargeStaffSearch] = useState('')
  const [chargeStaffOpen, setChargeStaffOpen] = useState(false)
  const [chargeType, setChargeType] = useState<'mistake' | 'personal'>('mistake')
  // ✅ جديد: نسبة الخصم من قيمة الصنف - مش كل الحالات لازم تتحمّل 100% (مثلاً وجبة شخصية ممكن تتحمّل بنص السعر بس)
  const [chargePercent, setChargePercent] = useState(100)
  const [chargeNote, setChargeNote] = useState('')
  const [chargeSaving, setChargeSaving] = useState(false)
  // ✅ جديد: الموظف يقدر يدفع جزء (أو كل) المبلغ كاش/شبكة فورًا زي أي عميل عادي، والباقي بس هو اللي ينزل من راتبه
  const [chargePaidNow, setChargePaidNow] = useState('')
  const [chargePaidMethod, setChargePaidMethod] = useState<'cash' | 'visa' | 'online'>('cash')

  const chargeTotalAmount = chargeItemTarget ? chargeItemTarget.unitPrice * chargeQty * (chargePercent / 100) : 0
  const chargePaidNowNum = chargeItemTarget ? Math.max(0, Math.min(chargeTotalAmount, Number(chargePaidNow) || 0)) : 0
  const chargeRemaining = Math.max(0, chargeTotalAmount - chargePaidNowNum)

  // ✅ جديد: طاولة افتراضية "مشتريات الموظفين" لكل فرع - عشان الجزء المدفوع كاش/شبكة يتسجل كبيعة حقيقية
  // وييدخل في إجمالي الكاش/الفيزا بتاعت الشيفت عند القفل، بدل ما يضيع كرقم مكتوب في السبب بس
  async function getOrCreateStaffTable(branchId: string): Promise<string | null> {
    if (!branchId) return null
    const { data: existing } = await sb.from('tables').select('id').eq('branch_id', branchId).eq('section', 'staff').limit(1).maybeSingle()
    if (existing) return existing.id
    const { data: created, error } = await sb.from('tables')
      .insert([{ branch_id: branchId, name: 'مشتريات الموظفين', number: 999, section: 'staff', status: 'available', is_active: true }])
      .select('id').maybeSingle()
    if (error) { console.error('Failed to create staff purchases table:', error.message); return null }
    return created?.id || null
  }

  function chargeStaffLabel(s: { name: string; name_en: string | null; employee_number: string | null }) {
    return `${s.name}${s.name_en ? ` (${s.name_en})` : ''}${s.employee_number ? ` — #${s.employee_number}` : ''}`
  }
  const filteredChargeStaff = chargeStaffSearch.trim()
    ? chargeStaffList.filter(s => {
        const q = chargeStaffSearch.trim().toLowerCase()
        return s.name.toLowerCase().includes(q) || (s.name_en || '').toLowerCase().includes(q) || (s.employee_number || '').toLowerCase().includes(q)
      })
    : chargeStaffList

  async function openChargeToEmployee(orderId: string, itemId: string, itemName: string, unitPrice: number, totalQty: number) {
    setChargeItemTarget({ orderId, itemId, itemName, unitPrice, totalQty })
    setChargeQty(totalQty)
    setChargeEmployeeId('')
    setChargeStaffSearch('')
    setChargeType('mistake')
    setChargePercent(100)
    setChargeNote('')
    setChargePaidNow('')
    setChargePaidMethod('cash')
    if (chargeStaffList.length === 0) {
      // ✅ كل موظفي الفرع النشطين - مش بس الكاشيرية، لأن الخطأ أو الوجبة الشخصية ممكن تكون لأي موظف (مطبخ، صالة، إلخ)
      // ✅ جديد: name_en + employee_number كمان عشان البحث/العرض يبان بيهم مش بس بالاسم العربي
      const { data } = await sb.from('employees').select('id,name,name_en,employee_number')
        .eq('is_active', true).eq('branch_id', employee?.branch_id || '').order('name')
      setChargeStaffList(data || [])
    }
  }

  async function doChargeToEmployee() {
    if (!chargeItemTarget || !chargeEmployeeId) return
    setChargeSaving(true)
    const label = chargeType === 'mistake'
      ? `🍽️ خصم كاشير - خطأ في الطلب: ${chargeItemTarget.itemName} ×${chargeQty}`
      : `🍽️ خصم كاشير - وجبة شخصية: ${chargeItemTarget.itemName} ×${chargeQty}`
    const percentNote = chargePercent < 100 ? ` (خصم ${chargePercent}% من السعر)` : ''
    // ✅ جديد: نوضّح في السبب لو الموظف دفع جزء كاش/شبكة فورًا، عشان يبان واضح في سجل المخالفات ليه المبلغ أقل من قيمة الصنف كاملة
    const paidNoteText = chargePaidNowNum > 0 ? ` — دفع MYR ${chargePaidNowNum.toFixed(2)} ${chargePaidMethod === 'cash' ? 'كاش' : chargePaidMethod === 'visa' ? 'شبكة' : 'تحويل بنكي'} فورًا` : ''
    const fullReason = chargeNote.trim() ? `${label}${percentNote}${paidNoteText} — ${chargeNote.trim()}` : `${label}${percentNote}${paidNoteText}`
    const actionBy = employee?.name || employee?.name_en || 'Unknown'

    // 1) نفس آلية إلغاء الصنف بالظبط - نشيله من فاتورة العميل (الكمية كلها أو جزء منها)
    if (chargeQty < chargeItemTarget.totalQty) {
      const { data: originalItem } = await sb.from('order_items').select('*').eq('id', chargeItemTarget.itemId).maybeSingle()
      if (originalItem) {
        await sb.from('order_items').update({ quantity: chargeItemTarget.totalQty - chargeQty }).eq('id', chargeItemTarget.itemId)
        const { id, ...rest } = originalItem as any
        await sb.from('order_items').insert([{ ...rest, quantity: chargeQty, status: 'cancelled', cancel_reason: fullReason, cancelled_at: new Date().toISOString(), action_by: actionBy }])
      }
    } else {
      await sb.from('order_items').update({ status: 'cancelled', cancel_reason: fullReason, cancelled_at: new Date().toISOString(), action_by: actionBy }).eq('id', chargeItemTarget.itemId)
    }
    const { data: items } = await sb.from('order_items').select('unit_price, quantity, status').eq('order_id', chargeItemTarget.orderId)
    const newTotal = (items || []).filter(i => i.status !== 'cancelled').reduce((s, i) => s + i.unit_price * i.quantity, 0)
    await sb.from('orders').update({ total_amount: newTotal }).eq('id', chargeItemTarget.orderId)

    // 2) لو الموظف دافع جزء (أو كل) المبلغ كاش/شبكة دلوقتي - نسجّله كبيعة حقيقية على طاولة "مشتريات الموظفين"
    // عشان يدخل في إجمالي الكاش/الفيزا بتاعت الشيفت عادي زي أي بيع تاني وقت القفل آخر الشيفت
    if (chargePaidNowNum > 0) {
      const staffTableId = await getOrCreateStaffTable(employee?.branch_id || '')
      if (staffTableId) {
        await sb.from('orders').insert([{
          table_id: staffTableId, status: 'paid', payment_method: chargePaidMethod,
          total_amount: chargePaidNowNum, paid_at: new Date().toISOString(), shift,
          notes: `شراء موظف: ${chargeItemTarget.itemName} ×${chargeQty}`,
        }])
      }
    }

    // 3) الباقي بس (لو فيه) هو اللي ينزل خصم فوري من راتب الموظف - نفس جدول المخالفات وبحالة "active" مباشرة
    if (chargeRemaining > 0) {
      const { error } = await sb.from('violations').insert([{
        employee_id: chargeEmployeeId, amount: chargeRemaining, reason: fullReason,
        date: new Date().toISOString().split('T')[0], created_by: employee?.id, status: 'active',
      }])
      if (error) { setChargeSaving(false); alert('❌ ' + error.message); return }
    }
    setChargeSaving(false)
    setChargeItemTarget(null); setChargeQty(1); setChargeEmployeeId(''); setChargeStaffSearch(''); setChargeStaffOpen(false); setChargeType('mistake'); setChargePercent(100); setChargeNote(''); setChargePaidNow(''); setChargePaidMethod('cash')
    fetchAll()
  }

  async function doCancelOrder() {
    if (!cancelOrderTarget || !cancelReason.trim()) return
    setCancelSaving(true)
    const { data: cancelledOrders } = await sb.from('orders').update({ status: 'cancelled', cancel_reason: cancelReason.trim() })
      .eq('table_id', cancelOrderTarget.table_id).in('status', ['confirmed', 'preparing', 'ready']).select('id')
    // ✅ Fix حرج: لما الطلب يتلغى بالكامل، كانت الأصناف الفردية جواه بتفضل بحالتها القديمة (زي إنها لسه شغالة)،
    // وبما إن المطبخ بيفلتر حسب حالة الطلب، كان الطلب يختفي من شاشة المطبخ فورًا من غير أي أثر إنه اتلغى.
    // دلوقتي بنحدّث كل الأصناف الفردية كمان لتبقى "ملغية" فعليًا مع السبب ووقت الإلغاء
    if (cancelledOrders && cancelledOrders.length > 0) {
      const orderIds = cancelledOrders.map((o: any) => o.id)
      await sb.from('order_items').update({ status: 'cancelled', cancel_reason: cancelReason.trim(), cancelled_at: new Date().toISOString(), action_by: employee?.name || employee?.name_en || 'Unknown' })
        .in('order_id', orderIds).not('status', 'in', '(cancelled,ready)')
    }
    await sb.from('tables').update({ status: 'available', current_order_id: null, occupied_since: null, reserved_at: null })
      .eq('id', cancelOrderTarget.table_id)
    setCancelSaving(false)
    setCancelOrderTarget(null)
    setCancelReason('')
    fetchAll()
  }

  async function doCancelItem() {
    if (!cancelItemTarget || !cancelReason.trim()) return
    setCancelSaving(true)
    // ✅ Fix: لو الكمية المطلوب إلغاؤها أقل من إجمالي الصنف، نقسم السطر بدل ما نلغي الكل
    if (cancelItemQty < cancelItemTarget.totalQty) {
      // نجيب بيانات الصنف الأصلي كاملة عشان ننسخها للسطر الجديد الملغي
      const { data: originalItem } = await sb.from('order_items').select('*').eq('id', cancelItemTarget.itemId).maybeSingle()
      if (originalItem) {
        // نقلل كمية السطر الأصلي بمقدار الكمية الملغاة (يفضل نشط بالكمية المتبقية)
        await sb.from('order_items').update({ quantity: cancelItemTarget.totalQty - cancelItemQty }).eq('id', cancelItemTarget.itemId)
        // وننشئ سطر جديد منفصل بالكمية الملغاة بس، محدد كـ"ملغي" مع السبب ووقت الإلغاء
        const { id, ...rest } = originalItem as any
        await sb.from('order_items').insert([{ ...rest, quantity: cancelItemQty, status: 'cancelled', cancel_reason: cancelReason.trim(), cancelled_at: new Date().toISOString(), action_by: employee?.name || employee?.name_en || 'Unknown' }])
      }
    } else {
      // إلغاء الصنف بالكامل (السلوك الأصلي زي ما كان بالظبط) - مع تسجيل وقت الإلغاء الفعلي كمان
      await sb.from('order_items').update({ status: 'cancelled', cancel_reason: cancelReason.trim(), cancelled_at: new Date().toISOString(), action_by: employee?.name || employee?.name_en || 'Unknown' }).eq('id', cancelItemTarget.itemId)
    }
    // ✅ نعيد حساب إجمالي الفاتورة بعد إلغاء الصنف عشان مايفضلش محسوب في المبلغ المطلوب من العميل
    const { data: items } = await sb.from('order_items').select('unit_price, quantity, status').eq('order_id', cancelItemTarget.orderId)
    const newTotal = (items || []).filter(i => i.status !== 'cancelled').reduce((s, i) => s + i.unit_price * i.quantity, 0)
    await sb.from('orders').update({ total_amount: newTotal }).eq('id', cancelItemTarget.orderId)
    setCancelSaving(false)
    setCancelItemTarget(null)
    setCancelItemQty(1)
    setCancelReason('')
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
      {/* ✅ Fix: zIndex اتقلل من 999 لـ 150 - عشان لو الكاشير فاتح شاشة طلب (Add Order/Payment وغيرها، zIndex بتاعها 300+)
          الإشعار يظهر تحتها بدل ما يغطيها ويقاطع اللي بيعمله */}
      {notif && (
        <div style={{ position: 'fixed', top: 80, left: '50%', transform: 'translateX(-50%)', background: S.blue, color: S.white, padding: '12px 24px', borderRadius: 12, fontWeight: 700, fontSize: 14, zIndex: 150, boxShadow: '0 4px 20px rgba(0,0,0,0.4)', whiteSpace: 'nowrap' }}>
          {notif}
        </div>
      )}

      {/* New Order Center Alert */}
      {/* ✅ Fix: zIndex اتقلل من 1000 لـ 200 - نفس السبب: لو فيه شاشة طلب مفتوحة بالفعل (zIndex 300+)، الإشعار الكبير
          ده هيفضل تحتها ومحجوب بالكامل خلف الـ backdrop بتاعها، وهيبان تلقائيًا لما الكاشير يقفل الشاشة اللي فاتحاها */}
      {newOrderAlert && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(10,22,40,0.6)', backdropFilter: 'blur(2px)' }}>
          <div
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
      <div style={{ background: S.navy2, borderBottom: `1px solid ${S.border}`, padding: isMobile ? '8px 10px' : '10px 16px', zIndex: 10 }}>
        {/* Row 1 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
          <h1 style={{ color: S.gold, fontSize: isMobile ? 15 : 17, fontWeight: 900 }}>🏧 Cashier</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 6 : 8, flexWrap: 'wrap' }}>
            {!isMobile && (
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
            )}
            {activeCount > 0 && (
              <div style={{ background: S.redB, border: `1px solid ${S.red}`, borderRadius: 20, padding: '3px 10px', fontSize: 12, color: S.red, fontWeight: 700 }}>{activeCount} active</div>
            )}
            <button onClick={() => setView('tables')} style={{ padding: '6px 12px', borderRadius: 8, border: `1px solid ${view === 'tables' ? S.gold : S.border}`, background: view === 'tables' ? S.gold3 : 'transparent', color: view === 'tables' ? S.gold : S.muted, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif' }}>🪑 {isMobile ? '' : 'Tables'}</button>
            <button onClick={() => { setView('orders'); setFilter('active') }} style={{ padding: '6px 12px', borderRadius: 8, border: `1px solid ${view === 'orders' && filter !== 'done' ? S.gold : S.border}`, background: view === 'orders' && filter !== 'done' ? S.gold3 : 'transparent', color: view === 'orders' && filter !== 'done' ? S.gold : S.muted, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif' }}>📋 {isMobile ? '' : 'Orders'}</button>
            {isCashierRole && (
              <button onClick={() => { setView('archive'); if (!archiveSearched) searchArchive() }} style={{ padding: '6px 12px', borderRadius: 8, border: `1px solid ${(view as string) === 'archive' ? S.purple : S.border}`, background: (view as string) === 'archive' ? S.purpleB : 'transparent', color: (view as string) === 'archive' ? S.purple : S.muted, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif' }}>📦 {isMobile ? '' : 'Archive'}</button>
            )}
            {isAdmin && (
              <button onClick={() => { setView('orders'); setFilter('done' as any); if (!closedFetched) fetchClosedData() }}
                style={{ padding: '6px 12px', borderRadius: 8, border: `1px solid ${view === 'orders' && filter === 'done' ? S.teal : S.border}`, background: view === 'orders' && filter === 'done' ? S.tealB : 'transparent', color: view === 'orders' && filter === 'done' ? S.teal : S.muted, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif' }}>📊 {isMobile ? '' : 'Shift'}</button>
            )}
          </div>
        </div>
        {/* Row 2: Shift */}
        {isCashierRole && <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <select value={shift} onChange={e => setShift(e.target.value as any)} style={{ background: S.navy3, border: `1px solid ${S.border}`, borderRadius: 8, padding: '5px 10px', color: S.white, fontSize: 12, fontFamily: 'Tajawal, sans-serif', cursor: 'pointer' }}>
            <option value="shift1">Shift 1</option>
            <option value="shift2">Shift 2</option>
            <option value="shift3">Shift 3</option>
          </select>
          {/* ✅ جديد: شارة اسم الكاشير الحالي - تظهر لأي شخص يفتح الصفحة، مش بس اللي بدأ الشيفت من جهازه */}
          {activeShiftCashierName && (
            <div style={{ background: S.tealB, border: `1px solid ${S.teal}`, borderRadius: 8, padding: '5px 10px', fontSize: 12, color: S.teal, fontWeight: 700, fontFamily: 'Tajawal, sans-serif' }}>
              🧑‍💼 Cashier: {activeShiftCashierName}
            </div>
          )}
          {/* ✅ جديد: تسجيل مصروف نقدي أثناء الشيفت مباشرة - زي "خرجت 100 رينجت لشراء حاجة" */}
          {shiftStarted && (
            <button onClick={() => setShowExpenseModal(true)}
              style={{ padding: '5px 14px', borderRadius: 8, border: `1px solid ${S.red}`, background: S.redB, color: S.red, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
              💸 {isMobile ? '' : 'Add Expense'}
            </button>
          )}
          {/* ✅ جديد: تسجيل عربون (Deposit) لعميل - باسمه ورقمه بس، من غير ما يحتاج يكون مسجّل مسبقًا */}
          {isCashierRole && (
            <button onClick={() => setShowDepositModal(true)}
              style={{ padding: '5px 14px', borderRadius: 8, border: `1px solid ${S.blue}`, background: S.blueB, color: S.blue, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
              💰 {isMobile ? '' : 'Add Deposit'}
            </button>
          )}
          {!shiftStarted ? (
            <button onClick={async () => {
              // ✅ جديد: بدل ما ناخد الاسم تلقائي من الحساب (مهم لو الحساب مشترك بين أكتر من كاشير)، نفتح
              // مودال يطلب اختيار/كتابة الاسم الحقيقي الأول
              const { data } = await sb.from('employees').select('id,name')
                .in('role', ['cashier', 'assistant_cashier']).eq('is_active', true)
                .eq('branch_id', employee?.branch_id || '').order('name')
              setStartShiftCashierList(data || [])
              setStartShiftSelectedName('')
              setStartShiftCustomName('')
              setShowStartShiftModal(true)
            }} style={{ padding: '5px 14px', borderRadius: 8, border: `1px solid ${S.green}`, background: S.greenB, color: S.green, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>▶ Start Shift</button>
          ) : (
            <>
              <span style={{ fontSize: 13, color: S.green, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>⏱ {shiftElapsed}</span>
              <button onClick={() => { setShowShiftReport(true) }} style={{ padding: '5px 14px', borderRadius: 8, border: `1px solid ${S.red}`, background: S.redB, color: S.red, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>⏹ End Shift</button>
            </>
          )}
        </div>}
      </div>

      {/* Row 3: Branch Selector (Admin only) */}
      {isAdmin && branches.length > 0 && (
        <div style={{ background: S.navy2, borderBottom: `1px solid ${S.border}`, padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, color: S.muted, fontWeight: 700 }}>🏪 Branch:</span>
          <button onClick={() => setAdminBranchFilter('')}
            style={{ padding: '6px 16px', borderRadius: 20, border: `1px solid ${!adminBranchFilter ? S.gold : S.border}`, background: !adminBranchFilter ? S.gold3 : 'transparent', color: !adminBranchFilter ? S.gold : S.muted, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', fontWeight: !adminBranchFilter ? 700 : 400 }}>
            🌐 All Branches
          </button>
          {branches.map(b => (
            <button key={b.id} onClick={() => setAdminBranchFilter(b.id)}
              style={{ padding: '6px 16px', borderRadius: 20, border: `1px solid ${adminBranchFilter === b.id ? S.gold : S.border}`, background: adminBranchFilter === b.id ? S.gold3 : 'transparent', color: adminBranchFilter === b.id ? S.gold : S.muted, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', fontWeight: adminBranchFilter === b.id ? 700 : 400 }}>
              {b.name}
            </button>
          ))}
        </div>
      )}

      <div style={{ padding: isMobile ? 10 : 16, maxWidth: 1200, margin: '0 auto' }}>
        {fetchError && (
          <div style={{ background: S.redB, border: `1px solid ${S.red}`, borderRadius: 12, padding: '12px 16px', marginBottom: 16, color: S.red, fontSize: 13, fontWeight: 700 }}>
            ⚠️ Failed to load orders/tables — data may be incomplete or missing until this is fixed:
            <div style={{ fontSize: 11, fontWeight: 400, marginTop: 4, direction: 'ltr', textAlign: 'left' }}>{fetchError}</div>
          </div>
        )}
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
                const isUnseen = unseenTableIds.has(table.id)
                // ✅ جديد: التحقق من وجود طاولة مدموجة مع هذه الطاولة حاليًا
                const mergePartnerId = getMergePartnerTableId(table.id)
                const mergeRecord = activeMerges.find(m => m.primary_table_id === table.id || m.merged_table_id === table.id)
                const partnerTable = mergePartnerId ? tablesRef.current.find(t => t.id === mergePartnerId) : null
                const statusColors: Record<string, { color: string; bg: string; border: string }> = {
                  available: { color: S.green, bg: S.greenB, border: S.green + '60' },
                  reserved:  { color: S.amber, bg: S.amberB, border: S.amber + '60' },
                  occupied:  { color: S.red,   bg: S.redB,   border: S.red + '60' },
                }
                const sc = statusColors[status] || statusColors.available
                return (
                  <div key={table.id}
                    onClick={() => {
                      // ✅ فتح الطاولة = شوفناها، نشيل علامة "جديد"
                      if (isUnseen) setUnseenTableIds(prev => { const next = new Set(prev); next.delete(table.id); return next })
                      if (activeOrder) {
                        // جيب كل الطلبات النشطة للطاولة
                        let tableOrders = orders.filter(o => o.table_id === table.id && ['confirmed','preparing','ready'].includes(o.status))
                        // ✅ جديد: لو الطاولة مدموجة مع طاولة تانية، نضيف طلبات الطاولة الشريكة كمان لنفس الفاتورة
                        if (mergePartnerId) {
                          const partnerOrders = orders.filter(o => o.table_id === mergePartnerId && ['confirmed','preparing','ready'].includes(o.status))
                          tableOrders = [...tableOrders, ...partnerOrders]
                        }
                        if (tableOrders.length > 1) {
                          // دمج الطلبات في طلب واحد للعرض
                          const merged = { ...tableOrders[0], order_items: tableOrders.flatMap(o => o.order_items), total_amount: tableOrders.reduce((s,o) => s + (o.total_amount||0), 0) }
                          // ✅ جديد: نمرر معرّف الطاولة الشريكة عشان مودال الدفع يقدر يقفل الطاولتين مع بعض عند الدفع
                          setPayOrder(mergePartnerId ? { ...merged, mergedTableId: mergePartnerId, mergeId: mergeRecord?.id } as any : merged as any)
                        } else {
                          setPayOrder(activeOrder)
                        }
                      } else {
                        setAddOrderTable(table)
                      }
                    }}
                    style={{ background: sc.bg, border: `2px solid ${isUnseen ? S.gold : sc.border}`, borderRadius: 16, padding: '16px 12px', cursor: 'pointer', textAlign: 'center', transition: 'all .2s', position: 'relative', boxShadow: isUnseen ? `0 0 0 3px ${S.gold}40` : 'none' }}>
                    {isUnseen && (
                      <div style={{ position: 'absolute', top: -8, right: -8, background: S.gold, color: S.navy, borderRadius: '50%', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 900, boxShadow: '0 2px 8px rgba(0,0,0,0.3)', animation: 'popIn .25s ease-out' }}>
                        🆕
                      </div>
                    )}
                    {/* ✅ جديد: شارة الدمج - تظهر لو الطاولة مدموجة مع طاولة تانية حاليًا */}
                    {partnerTable && (
                      <div style={{ position: 'absolute', top: -8, left: -8, background: S.gold, color: S.navy, borderRadius: 8, padding: '2px 6px', fontSize: 9, fontWeight: 900, boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }}>
                        🔗 {partnerTable.number}
                      </div>
                    )}
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
                    {activeOrder && (() => {
                      // ✅ Fix حرج: السعر الظاهر على البطاقة كان بيعرض total_amount الخام بس (سعر الأصناف
                      // من غير خدمة أو ضريبة، لأن دول بيتحسبوا بس وقت الدفع الفعلي). دلوقتي بنحسبهم هنا
                      // للعرض بس، عشان الرقم الظاهر يطابق المبلغ الحقيقي اللي العميل هيدفعه فعليًا
                      const isTakeaway = (table as any).section === 'takeaway'
                      const raw = activeOrder.total_amount || 0
                      const withFees = raw + (isTakeaway ? 0 : raw * SERVICE_CHARGE_RATE) + raw * SST_RATE
                      return <div style={{ fontSize: 10, color: S.gold, marginTop: 2 }}>MYR {withFees.toFixed(2)}</div>
                    })()}
                    {/* ✅ Fix: الدمج/فك الدمج يقتصر على الكاشير بس، لكن زرار + (إضافة طلب على طاولة مشغولة)
                        متاح للكاشير والدور المحدود (مشرف الصالة) مع بعض */}
                    {(isCashierRole || isLimitedTableRole) && activeOrder && (
                      <div style={{ display: 'flex', gap: 4, justifyContent: 'center', marginTop: 6 }}>
                        {isCashierRole && (
                          <button onClick={e => {
                            e.stopPropagation()
                            if (mergeRecord) { unmergeTables(mergeRecord.id) }
                            else { setMergePickerTable(table) }
                          }}
                            style={{ padding: '3px 8px', borderRadius: 6, border: `1px solid ${mergeRecord ? S.red : S.gold}60`, background: 'transparent', color: mergeRecord ? S.red : S.gold, cursor: 'pointer', fontSize: 9, fontFamily: 'inherit' }}>
                            {mergeRecord ? '🔗 Unmerge' : '🔗 Merge'}
                          </button>
                        )}
                        {/* ✅ جديد: يسمح للكاشير والدور المحدود بإضافة طلب جديد على الطاولة حتى لو كانت مشغولة بالفعل */}
                        <button onClick={e => { e.stopPropagation(); setAddOrderTable(table) }}
                          title="Add another order to this table"
                          style={{ padding: '3px 9px', borderRadius: 6, border: `1px solid ${S.green}60`, background: S.greenB, color: S.green, cursor: 'pointer', fontSize: 11, fontFamily: 'inherit', fontWeight: 800 }}>
                          +
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ) : view === 'archive' && isCashierRole ? (
          /* ══ ARCHIVE VIEW ══ */
          <div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center', background: S.card, borderRadius: 12, padding: 12, border: `1px solid ${S.border}` }}>
              <span style={{ fontSize: 12, color: S.muted, fontWeight: 700 }}>📦 Archive Search</span>
              <input type="date" value={archiveDate} onChange={e => setArchiveDate(e.target.value)}
                style={{ padding: '7px 10px', borderRadius: 8, border: `1px solid ${S.border}`, background: S.navy3, color: S.white, fontSize: 12 }} />
              <input type="text" value={archiveTableSearch} onChange={e => setArchiveTableSearch(e.target.value)}
                placeholder="Table number/name..."
                style={{ padding: '7px 10px', borderRadius: 8, border: `1px solid ${S.border}`, background: S.navy3, color: S.white, fontSize: 12, flex: isMobile ? '1 1 100%' : undefined, minWidth: 140 }} />
              <button onClick={searchArchive} disabled={archiveLoading}
                style={{ padding: '7px 16px', borderRadius: 8, border: 'none', background: `linear-gradient(135deg, ${S.gold}, ${S.gold2})`, color: S.navy, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', fontWeight: 800 }}>
                {archiveLoading ? '⏳...' : '🔍 Search'}
              </button>
              {(archiveDate || archiveTableSearch) && (
                <button onClick={() => { setArchiveDate(''); setArchiveTableSearch(''); setArchiveExpenses([]); searchArchive() }}
                  style={{ padding: '7px 12px', borderRadius: 8, border: `1px solid ${S.border}`, background: 'transparent', color: S.muted, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif' }}>
                  ✕ Clear
                </button>
              )}
            </div>

            {/* ✅ جديد: بطاقة "💸 Expenses" لليوم المختار — عشان الكاشير يشوف مصروفات الكاش وإجماليها
                من غير ما يحتاج صفحة الشيفت. تظهر بس لما يكون فيه تاريخ محدد ومصروفات مسجّلة فيه */}
            {!archiveLoading && archiveDate && archiveExpenses.length > 0 && (() => {
              const aExpPaid = archiveExpenses.filter(e => e.status === 'paid').reduce((s, e) => s + (e.amount || 0), 0)
              const aExpPending = archiveExpenses.filter(e => e.status === 'pending').reduce((s, e) => s + (e.amount || 0), 0)
              return (
                <div style={{ background: S.redB, borderRadius: 16, border: `1px solid ${S.red}40`, padding: '16px 18px', marginBottom: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: S.red, marginBottom: 10 }}>💸 Expenses ({archiveDate})</div>
                  <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 10, color: S.muted }}>💸 Expenses Paid</div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: S.red }}>MYR {aExpPaid.toFixed(2)}</div>
                    </div>
                    {aExpPending > 0 && (
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 10, color: S.muted }}>⏳ Expenses Pending</div>
                        <div style={{ fontSize: 15, fontWeight: 800, color: S.amber }}>MYR {aExpPending.toFixed(2)}</div>
                      </div>
                    )}
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 10, color: S.muted }}>Σ Total</div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: S.white }}>MYR {(aExpPaid + aExpPending).toFixed(2)}</div>
                    </div>
                  </div>
                  <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${S.red}30`, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {archiveExpenses.map(exp => (
                      <div key={exp.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, flexWrap: 'wrap', gap: 6 }}>
                        <span style={{ color: S.white }}>
                          {exp.status === 'paid' ? '✅' : '⏳'} {exp.description}
                          <span style={{ color: S.muted, fontSize: 10 }}> · {(!isAdmin && activeShiftCashierName) ? activeShiftCashierName : exp.cashier_name} · {exp.shift === 'shift1' ? 'Shift 1' : exp.shift === 'shift2' ? 'Shift 2' : 'Shift 3'} · {new Date(exp.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {(exp.receipt_urls || []).map((url, i) => (
                            <a key={i} href={url} onClick={e => { e.preventDefault(); e.stopPropagation(); setViewingReceiptUrl(url) }}>
                              <img src={url} alt="receipt" style={{ width: 28, height: 28, objectFit: 'cover', borderRadius: 4, border: `1px solid ${S.border}` }} />
                            </a>
                          ))}
                          <span style={{ color: S.red, fontWeight: 800 }}>MYR {(exp.amount || 0).toFixed(2)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })()}

            {archiveLoading ? (
              <div style={{ textAlign: 'center', padding: 60, color: S.muted }}>⏳ Loading...</div>
            ) : archiveResults.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 60, color: S.muted }}>
                <div style={{ fontSize: 40, marginBottom: 10 }}>📦</div>
                {archiveSearched ? 'No invoices found for this search' : 'Search by date and/or table number'}
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
                {archiveResults.map(order => (
                  <div key={order.id} onClick={() => setArchiveDetailOrder(order)} style={{ background: S.navy2, borderRadius: 16, border: `1px solid ${order.status === 'cancelled' ? S.red + '40' : S.green + '40'}`, padding: 14, cursor: 'pointer' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ color: S.white, fontWeight: 800, fontSize: 14 }}>{order.tables?.name || `Table ${order.tables?.number}`}</span>
                      <span style={{ background: order.status === 'cancelled' ? S.redB : S.greenB, color: order.status === 'cancelled' ? S.red : S.green, borderRadius: 8, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>
                        {order.status === 'cancelled' ? '❌ Cancelled' : '✅ Paid'}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: S.muted, marginBottom: 6 }}>
                      {new Date(order.created_at).toLocaleString('en-GB')}
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 900, color: S.gold, marginBottom: 6 }}>MYR {(order.total_amount || 0).toFixed(2)}</div>
                    {order.payment_method && <div style={{ fontSize: 11, color: S.teal, marginBottom: 4 }}>{order.payment_method === 'cash' ? '💵' : order.payment_method === 'visa' ? '💳' : '📱'} {order.payment_method}</div>}
                    {order.paid_by_name && <div style={{ fontSize: 11, color: S.muted, marginBottom: 4 }}>👤 {order.paid_by_name}</div>}
                    {order.cancel_reason && <div style={{ fontSize: 11, color: S.red, marginBottom: 4 }}>❌ {order.cancel_reason}</div>}
                    <div style={{ borderTop: `1px solid ${S.border}`, marginTop: 8, paddingTop: 8, fontSize: 12, color: S.muted }}>
                      {order.order_items.filter(i => i.status !== 'cancelled').map(i => `${i.menu_items?.name_en || i.menu_items?.name || '⚠️ Removed Item'} ×${i.quantity}`).join(', ')}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* ══ ORDERS VIEW ══ */
          <div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
              {[
                { key: 'active', label: 'Active' },
                { key: 'all',    label: 'All' },
                // ✅ فلتر Closed بقى بيظهر للأدمن بس - نفس شرط زرار "📊 Shift" فوق، عشان مايبقاش فيه مدخل بديل
                ...(isAdmin ? [{ key: 'done', label: 'Closed' }] : []),
              ].map(f => (
                <button key={f.key} onClick={() => { setFilter(f.key as any); if (f.key === 'done' && !closedFetched) fetchClosedData() }}
                  style={{ padding: '6px 14px', borderRadius: 20, border: `1px solid ${filter === f.key ? S.gold : S.border}`, background: filter === f.key ? S.gold3 : 'transparent', color: filter === f.key ? S.gold : S.muted, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: filter === f.key ? 700 : 400 }}>
                  {f.label}
                </button>
              ))}
            </div>

            {filter === 'done' && isAdmin ? (
              /* ══ CLOSED — تقرير يومي بالشيفتات (الكاشير، بداية/نهاية الشيفت، إجماليات الكاش/الفيزا) ══ */
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
                  {/* ✅ جديد: الأدمن بس يقدر يغيّر التاريخ ويجيب أي يوم قديم - غير الأدمن بيشوف تاريخ النهاردة بس */}
                  {isAdmin ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input type="date" value={closedDate} max={new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kuala_Lumpur' })}
                        onChange={e => setClosedDate(e.target.value)}
                        style={{ padding: '6px 10px', borderRadius: 8, border: `1px solid ${S.border}`, background: S.card, color: S.white, fontSize: 12, fontFamily: 'Tajawal, sans-serif' }} />
                      {closedDate !== new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kuala_Lumpur' }) && (
                        <button onClick={() => setClosedDate(new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kuala_Lumpur' }))}
                          style={{ padding: '5px 10px', borderRadius: 8, border: `1px solid ${S.gold}`, background: S.gold3, color: S.gold, cursor: 'pointer', fontSize: 11, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
                          Today
                        </button>
                      )}
                    </div>
                  ) : (
                    <span style={{ fontSize: 12, color: S.muted }}>📅 {new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Kuala_Lumpur' })} (Malaysia Time)</span>
                  )}
                  <button onClick={fetchClosedData} disabled={closedLoading}
                    style={{ padding: '6px 14px', borderRadius: 8, border: `1px solid ${S.border}`, background: 'transparent', color: S.muted, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif' }}>
                    {closedLoading ? '⏳...' : '🔄 Refresh'}
                  </button>
                </div>

                {closedLoading && !closedFetched ? (
                  <div style={{ textAlign: 'center', padding: 60, color: S.muted }}>⏳ Loading...</div>
                ) : closedSessions.length === 0 && closedOrders.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 60, color: S.muted }}>
                    <div style={{ fontSize: 40, marginBottom: 10 }}>📭</div>
                    No closed operations for this day
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                    {/* ✅ جديد: بطاقة إجمالي اليوم كله (كل الشيفتات مع بعض) - كاش/فيزا (مقسّمة على البنك لو فيه خصم)/أونلاين/خصومات/إجمالي */}
                    {(() => {
                      // ✅ Fix: مفيش داعي لقصّ إضافي هنا - closedOrders بقى بالفعل محصور صح على مستوى الجلسات
                      // (كل جلسة/شيفت بتاعة "يوم بدايته" بس، حتى لو استمرت بعد نص الليل)، فبنجمع كل حاجة موجودة
                      const dayPaid = closedOrders.filter(o => o.status === 'paid')
                      // ✅ Fix حرج: بدل ما نحسب من payment_method المسجّل على الفاتورة مباشرة (اللي بيبقى "split"
                      // للفواتير المقسّمة ومش بيتحسب في أي عمود)، بنفكّك كل فاتورة لدفعاتها الحقيقية (getPaymentBreakdown)
                      // ونجمعها حسب الطريقة الفعلية لكل دفعة - كده الفواتير المقسّمة بتتحسب صح في Cash/Visa/Online/Credit
                      // ✅ Fix: العربونات بقت منفصلة تمامًا عن Cash/Visa/Bank Transfer (كانت بتتجمع فيهم بصمت) -
                      // ليها بند "💰 Deposits" مستقل، وبتتضاف لـ Total بس مش لأي تبويب دفع بعينه
                      const dayOrderPayments = dayPaid.flatMap(o => getPaymentBreakdown(o, closedSplitPayments))
                      const dCash = dayOrderPayments.filter(p => p.method === 'cash').reduce((s, p) => s + p.amount, 0)
                      const dVisa = dayOrderPayments.filter(p => p.method === 'visa').reduce((s, p) => s + p.amount, 0)
                      const dVisaMaybank = dayOrderPayments.filter(p => p.method === 'visa' && p.card_bank === 'maybank').reduce((s, p) => s + p.amount, 0)
                      const dVisaBsn = dayOrderPayments.filter(p => p.method === 'visa' && p.card_bank === 'bsn').reduce((s, p) => s + p.amount, 0)
                      const dOnline = dayOrderPayments.filter(p => p.method === 'online').reduce((s, p) => s + p.amount, 0)
                      // ✅ جديد: إجمالي الآجل (Credit) ليوم كامل - مش كاش فعلي، دي فلوس متوقعة من جراب/فودباندا
                      const dCredit = dayOrderPayments.filter(p => p.method === 'credit').reduce((s, p) => s + p.amount, 0)
                      // ✅ Fix: الطاولات "Free" (تنازل كامل) بقت منفصلة عن الخصومات الحقيقية - كانت بتتجمع مع بعض
                      // في نفس رقم "🏷️ Discounts" فيضخّمه بمبالغ مش خصومات فعلية (الطاولة مجانية بالكامل)
                      const dDiscount = dayPaid.filter(o => o.discount_type !== 'free').reduce((s, o) => s + (o.discount_amount || 0), 0)
                      const dFreeOrders = dayPaid.filter(o => o.discount_type === 'free')
                      const dFreeAmount = dFreeOrders.reduce((s, o) => s + (o.discount_amount || 0), 0)
                      const dDepositsTotal = closedDeposits.reduce((s, d) => s + (d.amount || 0), 0)
                      // ✅ Fix: الإجمالي (💰 Total) المفروض يمثّل الفلوس الفعلية عند الكاشير بس (كاش + فيزا + أونلاين + عربونات) -
                      // مش شامل الـCredit لأنه فلوس آجلة لسه متحصلتش من المنصة (Grab/Foodpanda)، فمينفعش تتحسب
                      // كأنها موجودة في الدرج دلوقتي. الـCredit بيفضل ظاهر لوحده كبند منفصل بس مش جزء من الإجمالي
                      const dTotal = dayOrderPayments.filter(p => p.method !== 'credit').reduce((s, p) => s + p.amount, 0) + dDepositsTotal
                      // ✅ جديد: إجمالي المصروفات (المدفوعة والمعلّقة) لليوم كله من زرار "💸 Add Expense"
                      const dExpPaid = closedExpenses.filter(e => e.status === 'paid').reduce((s, e) => s + (e.amount || 0), 0)
                      const dExpPending = closedExpenses.filter(e => e.status === 'pending').reduce((s, e) => s + (e.amount || 0), 0)
                      return (
                        <div style={{ background: S.gold3, borderRadius: 16, border: `1px solid ${S.gold}`, padding: '16px 18px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
                            <div style={{ fontSize: 13, fontWeight: 800, color: S.gold }}>📊 Whole Day Total ({closedDate})</div>
                            <button
                              onClick={() => printAggregatedReport('Daily Summary', closedDate, dayPaid, {
                                cash: dCash, visa: dVisa, visaMaybank: dVisaMaybank, visaBsn: dVisaBsn, online: dOnline, credit: dCredit,
                                discount: dDiscount, freeCount: dFreeOrders.length, freeAmount: dFreeAmount, deposits: dDepositsTotal, total: dTotal,
                                expPaid: dExpPaid, expPending: dExpPending,
                              })}
                              style={{ padding: '6px 14px', borderRadius: 8, border: `1px solid ${S.gold}`, background: 'transparent', color: S.gold, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
                              🖨️ Print
                            </button>
                          </div>
                          <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
                            <div style={{ textAlign: 'center' }}>
                              <div style={{ fontSize: 10, color: S.muted }}>💵 Cash</div>
                              <div style={{ fontSize: 15, fontWeight: 800, color: S.green }}>MYR {dCash.toFixed(2)}</div>
                            </div>
                            <div style={{ textAlign: 'center' }}>
                              <div style={{ fontSize: 10, color: S.muted }}>💳 Visa{(dVisaMaybank > 0 || dVisaBsn > 0) ? ` (Maybank ${dVisaMaybank.toFixed(2)} · BSN ${dVisaBsn.toFixed(2)})` : ''}</div>
                              <div style={{ fontSize: 15, fontWeight: 800, color: S.blue }}>MYR {dVisa.toFixed(2)}</div>
                            </div>
                            <div style={{ textAlign: 'center' }}>
                              <div style={{ fontSize: 10, color: S.muted }}>📱 Bank Transfer</div>
                              <div style={{ fontSize: 15, fontWeight: 800, color: S.purple }}>MYR {dOnline.toFixed(2)}</div>
                            </div>
                            {dCredit > 0 && (
                              <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: 10, color: S.muted }}>🧾 Credit (Grab/Foodpanda)</div>
                                <div style={{ fontSize: 15, fontWeight: 800, color: S.amber }}>MYR {dCredit.toFixed(2)}</div>
                              </div>
                            )}
                            {dDiscount > 0 && (
                              <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: 10, color: S.muted }}>🏷️ Discounts</div>
                                <div style={{ fontSize: 15, fontWeight: 800, color: S.red }}>MYR {dDiscount.toFixed(2)}</div>
                              </div>
                            )}
                            {dFreeOrders.length > 0 && (
                              <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: 10, color: S.muted }}>🆓 Free Tables ({dFreeOrders.length})</div>
                                <div style={{ fontSize: 15, fontWeight: 800, color: S.amber }}>MYR {dFreeAmount.toFixed(2)}</div>
                              </div>
                            )}
                            {dDepositsTotal > 0 && (
                              <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: 10, color: S.muted }}>💰 Deposits</div>
                                <div style={{ fontSize: 15, fontWeight: 800, color: S.teal }}>MYR {dDepositsTotal.toFixed(2)}</div>
                              </div>
                            )}
                            <div style={{ textAlign: 'center' }}>
                              <div style={{ fontSize: 10, color: S.muted }}>💰 Total</div>
                              <div style={{ fontSize: 15, fontWeight: 800, color: S.gold }}>MYR {dTotal.toFixed(2)}</div>
                            </div>
                            {/* ✅ جديد: بطاقتي المصروفات المدفوعة/المعلّقة ليوم كامل */}
                            {dExpPaid > 0 && (
                              <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: 10, color: S.muted }}>💸 Expenses Paid</div>
                                <div style={{ fontSize: 15, fontWeight: 800, color: S.red }}>MYR {dExpPaid.toFixed(2)}</div>
                              </div>
                            )}
                            {dExpPending > 0 && (
                              <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: 10, color: S.muted }}>⏳ Expenses Pending</div>
                                <div style={{ fontSize: 15, fontWeight: 800, color: S.amber }}>MYR {dExpPending.toFixed(2)}</div>
                              </div>
                            )}
                          </div>
                          {/* ✅ جديد: قائمة تفصيلية بكل مصروف على حدة ليوم كامل، عشان يبان واضح إن المصروف اتسجل فعلاً */}
                          {closedExpenses.length > 0 && (
                            <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${S.gold}40` }}>
                              <div style={{ fontSize: 11, color: S.muted, marginBottom: 8, fontWeight: 700 }}>💸 Expenses Log</div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                {closedExpenses.map(exp => (
                                  <div key={exp.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, flexWrap: 'wrap', gap: 6 }}>
                                    <span style={{ color: S.white }}>
                                      {exp.status === 'paid' ? '✅' : '⏳'} {exp.description}
                                      <span style={{ color: S.muted, fontSize: 10 }}> · {exp.cashier_name} · {exp.shift === 'shift1' ? 'Shift 1' : exp.shift === 'shift2' ? 'Shift 2' : 'Shift 3'} · {new Date(exp.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
                                    </span>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                      {/* ✅ جديد: صور الفاتورة المرفقة - صور مصغّرة قابلة للضغط لفتحها بحجمها الكامل */}
                                      {(exp.receipt_urls || []).map((url, i) => (
                                        <a key={i} href={url} onClick={e => { e.preventDefault(); e.stopPropagation(); setViewingReceiptUrl(url) }}>
                                          <img src={url} alt="receipt" style={{ width: 28, height: 28, objectFit: 'cover', borderRadius: 4, border: `1px solid ${S.border}` }} />
                                        </a>
                                      ))}
                                      <span style={{ color: exp.status === 'paid' ? S.red : S.amber, fontWeight: 700 }}>MYR {exp.amount.toFixed(2)}</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          {/* ✅ جديد: قائمة تفصيلية بالعربونات المأخوذة اليوم - عشان تبان واضحة مش بس متجمّعة في الإجمالي */}
                          {closedDeposits.length > 0 && (
                            <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${S.gold}40` }}>
                              <div style={{ fontSize: 11, color: S.muted, marginBottom: 8, fontWeight: 700 }}>💰 Deposits Log (for this reservation day)</div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                {closedDeposits.map(dep => {
                                  // ✅ لو العربون اتاخد فعليًا في يوم مختلف عن يوم الحجز المعروض، نوضّح إمتى اتاخد
                                  const takenOnOtherDay = new Date(dep.created_at).toLocaleDateString('en-CA', { timeZone: 'Asia/Kuala_Lumpur' }) !== closedDate
                                  return (
                                    <div key={dep.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
                                      <span style={{ color: S.white }}>
                                        {dep.payment_method === 'cash' ? '💵' : dep.payment_method === 'visa' ? '💳' : '📱'} {dep.payment_method}{dep.card_bank ? ` (${dep.card_bank})` : ''}
                                        <span style={{ color: S.muted, fontSize: 10 }}>
                                          {' · '}{dep.created_by_name || '—'}
                                          {takenOnOtherDay
                                            ? ` · taken ${new Date(dep.created_at).toLocaleDateString('en-GB')}`
                                            : ` · ${new Date(dep.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`}
                                        </span>
                                      </span>
                                      <span style={{ color: S.teal, fontWeight: 700 }}>MYR {dep.amount.toFixed(2)}</span>
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })()}

                    {closedSessions.map(session => {
                      const start = new Date(session.started_at).getTime()
                      const end = session.ended_at ? new Date(session.ended_at).getTime() : Date.now()
                      const sessOrders = closedOrders.filter(o => {
                        // ✅ Fix حرج: شلنا شرط مطابقة عمود shift المسجّل على الطلب - الطلبات الجاية من طلب
                        // العميل مباشرة (QR) مالهاش وسيلة تسجّل الشيفت الصح وقت إنشائها (بتتسجل بقيمة افتراضية
                        // ثابتة)، فكانت مستحيل تتطابق مع اسم الشيفت الحقيقي حتى لو التوقيت صح 100%. دلوقتي
                        // بنعتمد بس على الوقت الفعلي (نفس المنطق اللي نجح في تقرير اليومية)
                        if (isAdmin) {
                          const branchId = tables.find(t => t.id === o.table_id)?.branch_id
                          if (branchId !== session.branch_id) return false
                        }
                        const t = new Date(o.paid_at || o.created_at).getTime()
                        return t >= start && t <= end
                      })
                      // ✅ Fix حرج: نفس منطق Whole Day Total - نفكّك كل فاتورة مدفوعة لدفعاتها الحقيقية عشان
                      // الفواتير المقسّمة تتحسب صح في Cash/Visa/Online/Credit بدل ما تضيع تحت "split"
                      const sessPaidOrders = sessOrders.filter(o => o.status === 'paid')
                      // ✅ جديد: عربونات هذا الشيفت بالذات - بالربط بتوقيت أخذ العربون داخل نافذة الشيفت
                      const sessDeposits = closedDeposits.filter(d => {
                        const t = new Date(d.created_at).getTime()
                        return t >= start && t <= end
                      })
                      // ✅ Fix: نفس منطق Whole Day Total - العربونات منفصلة عن Cash/Visa/Bank Transfer، ليها بند خاص
                      const sessOrderPayments = sessPaidOrders.flatMap(o => getPaymentBreakdown(o, closedSplitPayments))
                      const sCash = sessOrderPayments.filter(p => p.method === 'cash').reduce((s, p) => s + p.amount, 0)
                      const sVisa = sessOrderPayments.filter(p => p.method === 'visa').reduce((s, p) => s + p.amount, 0)
                      const sVisaMaybank = sessOrderPayments.filter(p => p.method === 'visa' && p.card_bank === 'maybank').reduce((s, p) => s + p.amount, 0)
                      const sVisaBsn = sessOrderPayments.filter(p => p.method === 'visa' && p.card_bank === 'bsn').reduce((s, p) => s + p.amount, 0)
                      const sOnline = sessOrderPayments.filter(p => p.method === 'online').reduce((s, p) => s + p.amount, 0)
                      // ✅ جديد: إجمالي الآجل (Credit) لهذا الشيفت
                      const sCredit = sessOrderPayments.filter(p => p.method === 'credit').reduce((s, p) => s + p.amount, 0)
                      // ✅ Fix: الطاولات "Free" بقت منفصلة عن الخصومات الحقيقية بدل ما تتجمع معاها
                      const sDiscount = sessOrders.filter(o => o.status === 'paid' && o.discount_type !== 'free').reduce((s, o) => s + (o.discount_amount || 0), 0)
                      const sFreeOrders = sessOrders.filter(o => o.status === 'paid' && o.discount_type === 'free')
                      const sFreeAmount = sFreeOrders.reduce((s, o) => s + (o.discount_amount || 0), 0)
                      const sDepositsTotal = sessDeposits.reduce((s, d) => s + (d.amount || 0), 0)
                      // ✅ Fix: نفس منطق Whole Day Total - الإجمالي هنا كمان بيستبعد Credit ويضيف العربونات
                      const sTotal = sessOrderPayments.filter(p => p.method !== 'credit').reduce((s, p) => s + p.amount, 0) + sDepositsTotal
                      // ✅ جديد: مصروفات هذا الشيفت بالذات - نفس نافذة الوقت اللي بنفلتر بيها الطلبات
                      const sExpenses = closedExpenses.filter(e => {
                        if (e.shift !== session.shift) return false
                        if (isAdmin && e.branch_id !== session.branch_id) return false
                        const t = new Date(e.created_at).getTime()
                        return t >= start && t <= end
                      })
                      const sExpPaid = sExpenses.filter(e => e.status === 'paid').reduce((s, e) => s + (e.amount || 0), 0)
                      const sExpPending = sExpenses.filter(e => e.status === 'pending').reduce((s, e) => s + (e.amount || 0), 0)
                      return (
                        <div key={session.id} style={{ background: S.navy2, borderRadius: 16, border: `1px solid ${S.border}`, overflow: 'hidden' }}>
                          <div style={{ padding: '14px 16px', background: S.card, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                            {/* ✅ جديد: الضغط هنا يفتح ملخص مجمّع لكل أصناف الشيفت (كم شاورما، كم مياه...) بدل الطباعة */}
                            <div onClick={() => setItemSummary({
                              session, sessOrders,
                              cash: sCash, visa: sVisa, visaMaybank: sVisaMaybank, visaBsn: sVisaBsn, online: sOnline, credit: sCredit,
                              discount: sDiscount, freeCount: sFreeOrders.length, freeAmount: sFreeAmount, deposits: sDepositsTotal, total: sTotal,
                              expPaid: sExpPaid, expPending: sExpPending,
                            })}
                              style={{ cursor: 'pointer' }} title="Click to view item summary">
                              <div style={{ fontSize: 14, fontWeight: 800, color: S.white }}>🧑‍💼 {session.cashier_name} · {session.shift === 'shift1' ? 'Shift 1' : session.shift === 'shift2' ? 'Shift 2' : 'Shift 3'} <span style={{ fontSize: 11, color: S.gold, fontWeight: 400 }}>📊</span></div>
                              <div style={{ fontSize: 11, color: S.muted, marginTop: 2 }}>
                                Started {new Date(session.started_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                                {' · '}
                                {session.ended_at ? `Ended ${new Date(session.ended_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}` : '🟢 Still Active'}
                              </div>
                            </div>
                            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                              <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: 10, color: S.muted }}>💵 Cash</div>
                                <div style={{ fontSize: 13, fontWeight: 800, color: S.green }}>MYR {sCash.toFixed(2)}</div>
                              </div>
                              <div style={{ textAlign: 'center' }}>
                                {/* ✅ جديد: لو في خصم في الشيفت، نوري تقسيم الفيزا حسب البنك (Maybank/BSN) على نفس الصف */}
                                <div style={{ fontSize: 10, color: S.muted }}>💳 Visa{sDiscount > 0 && (sVisaMaybank > 0 || sVisaBsn > 0) ? ` (Maybank ${sVisaMaybank.toFixed(2)} · BSN ${sVisaBsn.toFixed(2)})` : ''}</div>
                                <div style={{ fontSize: 13, fontWeight: 800, color: S.blue }}>MYR {sVisa.toFixed(2)}</div>
                              </div>
                              <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: 10, color: S.muted }}>📱 Bank Transfer</div>
                                <div style={{ fontSize: 13, fontWeight: 800, color: S.purple }}>MYR {sOnline.toFixed(2)}</div>
                              </div>
                              {sCredit > 0 && (
                                <div style={{ textAlign: 'center' }}>
                                  <div style={{ fontSize: 10, color: S.muted }}>🧾 Credit</div>
                                  <div style={{ fontSize: 13, fontWeight: 800, color: S.amber }}>MYR {sCredit.toFixed(2)}</div>
                                </div>
                              )}
                              {sDiscount > 0 && (
                                <div style={{ textAlign: 'center' }}>
                                  <div style={{ fontSize: 10, color: S.muted }}>🏷️ Discounts</div>
                                  <div style={{ fontSize: 13, fontWeight: 800, color: S.red }}>MYR {sDiscount.toFixed(2)}</div>
                                </div>
                              )}
                              {sFreeOrders.length > 0 && (
                                <div style={{ textAlign: 'center' }}>
                                  <div style={{ fontSize: 10, color: S.muted }}>🆓 Free Tables ({sFreeOrders.length})</div>
                                  <div style={{ fontSize: 13, fontWeight: 800, color: S.amber }}>MYR {sFreeAmount.toFixed(2)}</div>
                                </div>
                              )}
                              {sDepositsTotal > 0 && (
                                <div style={{ textAlign: 'center' }}>
                                  <div style={{ fontSize: 10, color: S.muted }}>💰 Deposits</div>
                                  <div style={{ fontSize: 13, fontWeight: 800, color: S.teal }}>MYR {sDepositsTotal.toFixed(2)}</div>
                                </div>
                              )}
                              <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: 10, color: S.muted }}>💰 Total</div>
                                <div style={{ fontSize: 13, fontWeight: 800, color: S.gold }}>MYR {sTotal.toFixed(2)}</div>
                              </div>
                              {/* ✅ جديد: طباعة تقرير تفصيلي كامل لهذا الشيفت - كل الطاولات والأصناف والمصروفات */}
                              <button
                                onClick={() => printClosedShiftReport(
                                  session, sessOrders, sExpenses,
                                  { cash: sCash, visa: sVisa, visaMaybank: sVisaMaybank, visaBsn: sVisaBsn, online: sOnline, credit: sCredit, discount: sDiscount, freeCount: sFreeOrders.length, freeAmount: sFreeAmount, deposits: sDepositsTotal, total: sTotal, expPaid: sExpPaid, expPending: sExpPending },
                                  closedSplitPayments
                                )}
                                style={{ padding: '6px 12px', borderRadius: 8, border: `1px solid ${S.border}`, background: 'transparent', color: S.muted, cursor: 'pointer', fontSize: 11, fontFamily: 'Tajawal, sans-serif', alignSelf: 'center' }}>
                                🖨️ Print
                              </button>
                              {/* ✅ جديد: مصروفات هذا الشيفت */}
                              {sExpPaid > 0 && (
                                <div style={{ textAlign: 'center' }}>
                                  <div style={{ fontSize: 10, color: S.muted }}>💸 Expenses</div>
                                  <div style={{ fontSize: 13, fontWeight: 800, color: S.red }}>MYR {sExpPaid.toFixed(2)}</div>
                                </div>
                              )}
                              {sExpPending > 0 && (
                                <div style={{ textAlign: 'center' }}>
                                  <div style={{ fontSize: 10, color: S.muted }}>⏳ Pending Exp.</div>
                                  <div style={{ fontSize: 13, fontWeight: 800, color: S.amber }}>MYR {sExpPending.toFixed(2)}</div>
                                </div>
                              )}
                            </div>
                          </div>
                          {/* ✅ جديد: قائمة تفصيلية بمصروفات هذا الشيفت بالذات */}
                          {sExpenses.length > 0 && (
                            <div style={{ padding: '0 16px 14px', borderTop: `1px solid ${S.border}`, paddingTop: 10 }}>
                              <div style={{ fontSize: 11, color: S.muted, marginBottom: 6, fontWeight: 700 }}>💸 Expenses</div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                                {sExpenses.map(exp => (
                                  <div key={exp.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, flexWrap: 'wrap', gap: 6 }}>
                                    <span style={{ color: S.white }}>{exp.status === 'paid' ? '✅' : '⏳'} {exp.description}</span>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                      {(exp.receipt_urls || []).map((url, i) => (
                                        <a key={i} href={url} onClick={e => { e.preventDefault(); e.stopPropagation(); setViewingReceiptUrl(url) }}>
                                          <img src={url} alt="receipt" style={{ width: 24, height: 24, objectFit: 'cover', borderRadius: 4, border: `1px solid ${S.border}` }} />
                                        </a>
                                      ))}
                                      <span style={{ color: exp.status === 'paid' ? S.red : S.amber, fontWeight: 700 }}>MYR {exp.amount.toFixed(2)}</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          {/* ✅ جديد: قائمة تفصيلية بعربونات هذا الشيفت بالذات */}
                          {sessDeposits.length > 0 && (
                            <div style={{ padding: '0 16px 14px', borderTop: `1px solid ${S.border}`, paddingTop: 10 }}>
                              <div style={{ fontSize: 11, color: S.muted, marginBottom: 6, fontWeight: 700 }}>💰 Deposits</div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                                {sessDeposits.map(dep => (
                                  <div key={dep.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                                    <span style={{ color: S.white }}>{dep.payment_method === 'cash' ? '💵' : dep.payment_method === 'visa' ? '💳' : '📱'} {dep.payment_method}{dep.card_bank ? ` (${dep.card_bank})` : ''}</span>
                                    <span style={{ color: S.teal, fontWeight: 700 }}>MYR {dep.amount.toFixed(2)}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10, padding: 14 }}>
                            {sessOrders.length === 0 ? (
                              <div style={{ color: S.muted, fontSize: 12, padding: '10px 0' }}>No orders in this shift</div>
                            ) : sessOrders.map(order => (
                              <div key={order.id} onClick={() => setArchiveDetailOrder(order)}
                                style={{ background: S.card, borderRadius: 12, border: `1px solid ${order.status === 'cancelled' ? S.red + '40' : S.border}`, padding: 10, cursor: 'pointer' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                  <span style={{ fontSize: 12, fontWeight: 700, color: S.white }}>{order.tables?.name || `Table ${order.tables?.number}`}</span>
                                  <span style={{ fontSize: 11, color: order.status === 'cancelled' ? S.red : S.gold, fontWeight: 700 }}>{order.status === 'cancelled' ? '❌ Cancelled' : `MYR ${(order.total_amount || 0).toFixed(2)}`}</span>
                                </div>
                                <div style={{ fontSize: 10, color: S.muted }}>
                                  {new Date(order.paid_at || order.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                                  {order.payment_method ? ` · ${order.payment_method}` : ''}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )
                    })}

                    {/* ✅ عمليات مقفولة اليوم لكنها مش تابعة لأي جلسة شيفت مسجّلة (اتقفلت قبل بدء الشيفت أو بعد انتهائه) - عشان محدش يضيع من التقرير */}
                    {(() => {
                      const unassigned = closedOrders.filter(o => !closedSessions.some(session => {
                        // ✅ Fix حرج: نفس المنطق - الاعتماد على الوقت بس بدل مطابقة عمود shift غير الموثوق
                        const t = new Date(o.paid_at || o.created_at).getTime()
                        const start = new Date(session.started_at).getTime()
                        const end = session.ended_at ? new Date(session.ended_at).getTime() : Date.now()
                        return t >= start && t <= end
                      }))
                      if (unassigned.length === 0) return null
                      return (
                        <div style={{ background: S.navy2, borderRadius: 16, border: `1px solid ${S.border}`, overflow: 'hidden' }}>
                          <div style={{ padding: '14px 16px', background: S.card, fontSize: 13, fontWeight: 800, color: S.muted }}>📋 Other Closed Orders Today</div>
                          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10, padding: 14 }}>
                            {unassigned.map(order => (
                              <div key={order.id} onClick={() => setArchiveDetailOrder(order)}
                                style={{ background: S.card, borderRadius: 12, border: `1px solid ${order.status === 'cancelled' ? S.red + '40' : S.border}`, padding: 10, cursor: 'pointer' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                  <span style={{ fontSize: 12, fontWeight: 700, color: S.white }}>{order.tables?.name || `Table ${order.tables?.number}`}</span>
                                  <span style={{ fontSize: 11, color: order.status === 'cancelled' ? S.red : S.gold, fontWeight: 700 }}>{order.status === 'cancelled' ? '❌ Cancelled' : `MYR ${(order.total_amount || 0).toFixed(2)}`}</span>
                                </div>
                                <div style={{ fontSize: 10, color: S.muted }}>
                                  {new Date(order.paid_at || order.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                                  {order.payment_method ? ` · ${order.payment_method}` : ''}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )
                    })()}
                  </div>
                )}
              </div>
            ) : filtered.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 60, color: S.muted }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>🎉</div>
                <div>No orders found</div>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
                {filtered.map(order => {
                  const st = STATUS_LABELS[order.status] || STATUS_LABELS['confirmed']
                  // ✅ اسم الفرع الحقيقي للطاولة دي - عشان الأدمن يفرّق بين "Table 1" بتاعة House و"Table 1" بتاعة KLCC (نفس الاسم بالظبط في الفروع)
                  const orderBranchName = isAdmin ? branches.find(b => b.id === tables.find(t => t.id === order.table_id)?.branch_id)?.name : null
                  return (
                    <div key={order.id} style={{ background: S.navy2, borderRadius: 16, border: `1px solid ${order.status === 'confirmed' ? S.blue + '60' : S.border}`, overflow: 'hidden' }}>
                      <div style={{ padding: '14px 16px', borderBottom: `1px solid ${S.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                            <span style={{ color: S.white, fontWeight: 800, fontSize: 15 }}>{order.tables?.name || `Table ${order.tables?.number}`}</span>
                            {orderBranchName && (
                              <span style={{ background: S.purpleB, color: S.purple, borderRadius: 8, padding: '2px 8px', fontSize: 10, fontWeight: 700 }}>🏢 {orderBranchName}</span>
                            )}
                            <span style={{ background: st.bg, color: st.color, borderRadius: 8, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>{st.emoji} {st.label}</span>
                          </div>
                          <div style={{ fontSize: 11, color: S.muted }}>#{order.id.slice(-6).toUpperCase()} · ago {timeAgo(order.created_at)}</div>
                          {lastOrderTime(order) && ['confirmed','preparing','ready'].includes(order.status) && (
                            <div style={{ fontSize: 11, color: S.amber, marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>⏱ {elapsed(lastOrderTime(order)!)}</div>
                          )}
                        </div>
                        <div style={{ textAlign: 'left' }}>
                          <div style={{ color: S.gold, fontWeight: 800, fontSize: 15 }}>MYR {(order.total_amount || 0).toFixed(2)}</div>
                          {order.payment_method && order.status === 'paid' && (
                            <div style={{ fontSize: 10, color: S.teal }}>{order.payment_method === 'cash' ? '💵' : order.payment_method === 'visa' ? '💳' : '📱'} {order.payment_method}</div>
                          )}
                          {order.status === 'paid' && order.paid_by_name && (
                            <div style={{ fontSize: 10, color: S.muted, marginTop: 2 }}>👤 {order.paid_by_name}</div>
                          )}
                        </div>
                      </div>

                      <div style={{ padding: '10px 16px' }}>
                        {groupItemsByRound(order.order_items).map((round, ri) => (
                          <div key={ri}>
                            {ri > 0 && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '8px 0', color: S.amber, fontSize: 10, fontWeight: 700 }}>
                                <div style={{ flex: 1, height: 1, background: S.amber + '40' }} />
                                🔔 Round {ri + 1} · {timeElapsedSince(round[0]?.created_at)}
                                <div style={{ flex: 1, height: 1, background: S.amber + '40' }} />
                              </div>
                            )}
                            {round.map(i => (
                              <div key={i.id} style={{ padding: '3px 0', fontSize: 12, borderBottom: `1px solid ${S.border}` }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                                  <span style={{ color: i.status === 'cancelled' ? S.muted : S.white, textDecoration: i.status === 'cancelled' ? 'line-through' : 'none', flex: 1 }}>
                                    {i.menu_items?.name_en || i.menu_items?.name || '⚠️ Removed Item'}{i.size_name ? ` (${i.size_name})` : ''} <span style={{ color: S.muted }}>×{i.quantity}</span>
                                  </span>
                                  {isCashierRole && i.status !== 'cancelled' && !['paid', 'cancelled'].includes(order.status) && (
                                    <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                                      {/* ✅ جديد: تحميل هذا الصنف على موظف (خطأ في الطلب أو وجبة شخصية) - يشيله من الفاتورة ويخصمه من راتبه */}
                                      <button onClick={() => openChargeToEmployee(order.id, i.id, i.menu_items?.name_en || i.menu_items?.name || '⚠️ Removed Item', i.unit_price, i.quantity)}
                                        title="Charge this item to an employee"
                                        style={{ background: 'transparent', border: `1px solid ${S.amber}`, borderRadius: 6, color: S.amber, cursor: 'pointer', fontSize: 10, padding: '2px 6px' }}>👤</button>
                                      <button onClick={() => { setCancelItemTarget({ orderId: order.id, itemId: i.id, itemName: i.menu_items?.name_en || i.menu_items?.name || '⚠️ Removed Item', totalQty: i.quantity }); setCancelItemQty(i.quantity) }}
                                        title="Cancel this item"
                                        style={{ background: 'transparent', border: `1px solid ${S.red}`, borderRadius: 6, color: S.red, cursor: 'pointer', fontSize: 10, padding: '2px 6px' }}>✕</button>
                                    </div>
                                  )}
                                </div>
                                {i.notes && <div style={{ fontSize: 10, color: S.gold, marginTop: 1 }}>📝 {i.notes}</div>}
                                {i.status === 'cancelled' && i.cancel_reason && <div style={{ fontSize: 10, color: S.red, marginTop: 1 }}>❌ Cancelled: {i.cancel_reason}</div>}
                              </div>
                            ))}
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
                        {isCashierRole && ['confirmed','preparing'].includes(order.status) && (
                          <button onClick={() => setCancelOrderTarget(order)} style={{ padding: '9px 12px', borderRadius: 8, border: `1px solid ${S.red}`, background: S.redB, color: S.red, cursor: 'pointer', fontSize: 12 }}>❌</button>
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
      {payOrder && <PaymentModal order={payOrder} tables={tables}
        onPaymentStart={(tableId) => {
          // ✅ Fix حرج: نستبعد الطاولة من أول لحظة تبدأ فيها عملية الدفع (قبل ما تخلص خالص) - عشان أي
          // تحديث شاشة يحصل أثناء خطوات الدفع (زي دمج طلب مكرر في Split Payment) ميرجّعش الطلب بالغلط
          recentlyPaidTableIdsRef.current.add(tableId)
          setTimeout(() => { recentlyPaidTableIdsRef.current.delete(tableId) }, 15000)
        }}
        onClose={() => setPayOrder(null)} onPaid={() => {
        const paidTableId = payOrder.table_id
        setPayOrder(null)
        // ✅ نضمن الاستبعاد لمدة كافية بعد نجاح الدفع كمان (لو onPaymentStart اتنفذ من فترة والوقت قرب يخلص)
        recentlyPaidTableIdsRef.current.add(paidTableId)
        setTimeout(() => { recentlyPaidTableIdsRef.current.delete(paidTableId) }, 15000)
        // فوراً امسح الطلبات المدفوعة من الـ state
        setOrders(prev => prev.filter(o => !(o.table_id === paidTableId && ['confirmed','preparing','ready'].includes(o.status))))
        // وحدّث الطاولة في الـ state مباشرة
        setTables(prev => prev.map(t => t.id === paidTableId ? { ...t, status: 'available', current_order_id: null, occupied_since: null } : t))
        // بعدين fetch من DB
        setTimeout(() => fetchAll(), 1000)
      }} onTransfer={(o) => { setPayOrder(null); setTransferOrder(o) }} />}

      {transferOrder && (
        <TransferTableModal
          order={transferOrder}
          tables={tables}
          isCashierRole={isCashierRole}
          onClose={() => setTransferOrder(null)}
          onTransferred={() => { setTransferOrder(null); fetchAll() }}
        />
      )}
      {addOrderTable && <AddOrderModal tableId={addOrderTable.id} tableName={addOrderTable.name || `Table ${addOrderTable.number}`} onClose={() => setAddOrderTable(null)} onSaved={() => { setAddOrderTable(null); fetchAll() }} />}
      {/* ✅ جديد: مودال اختيار الطاولة الشريكة للدمج المؤقت */}
      {mergePickerTable && (
        <div onClick={() => setMergePickerTable(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.75)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: S.navy2, borderRadius: 20, border: `1px solid ${S.border}`, padding: 20, maxWidth: 420, width: '100%', maxHeight: '80vh', overflowY: 'auto' }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: S.gold, marginBottom: 4 }}>🔗 دمج طاولة {mergePickerTable.number} مع...</div>
            <div style={{ fontSize: 11, color: S.muted, marginBottom: 14 }}>سيتم دمج فاتورتي الطاولتين في فاتورة واحدة موحدة مؤقتًا</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {tables
                // ✅ Fix حرج: نتأكد إن قائمة الدمج تعرض طاولات نفس الفرع بس، عشان ما يتخلطش فرع بفرع (خصوصًا للأدمن اللي بيشوف كل الفروع)
                .filter(t => t.id !== mergePickerTable.id && !getMergePartnerTableId(t.id) && t.branch_id === mergePickerTable.branch_id)
                .map(t => {
                  const tOrder = orders.find(o => o.table_id === t.id && ['confirmed','preparing','ready'].includes(o.status))
                  return (
                    <button key={t.id} onClick={async () => { await mergeTables(mergePickerTable.id, t.id); setMergePickerTable(null) }}
                      style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderRadius: 10, border: `1px solid ${S.border}`, background: S.card, color: S.white, cursor: 'pointer', fontSize: 13, fontFamily: 'inherit', textAlign: 'right' }}>
                      <span>Table {t.number} — {t.name || ''}</span>
                      <span style={{ fontSize: 11, color: tOrder ? S.red : S.green }}>{tOrder ? '🔴 Occupied' : '🟢 Available'}</span>
                    </button>
                  )
                })}
            </div>
            <button onClick={() => setMergePickerTable(null)} style={{ width: '100%', marginTop: 14, padding: '10px 0', borderRadius: 10, border: `1px solid ${S.border}`, background: 'transparent', color: S.muted, cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>
              إلغاء
            </button>
          </div>
        </div>
      )}
      {/* ✅ جديد: عرض صورة إيصال المصروف بحجمها الكامل جوه نفس الصفحة - بدل ما تفتح في تاب جديد */}
      {viewingReceiptUrl && (
        <div onClick={() => setViewingReceiptUrl(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <button onClick={() => setViewingReceiptUrl(null)}
            style={{ position: 'absolute', top: 20, right: 20, width: 36, height: 36, borderRadius: '50%', border: 'none', background: 'rgba(255,255,255,0.15)', color: '#fff', cursor: 'pointer', fontSize: 18 }}>✕</button>
          <img src={viewingReceiptUrl} alt="receipt" onClick={e => e.stopPropagation()}
            style={{ maxWidth: '95%', maxHeight: '90vh', objectFit: 'contain', borderRadius: 8 }} />
        </div>
      )}
      {/* ✅ جديد: ملخص مجمّع لأصناف الشيفت - يفتح لما تضغط على بطاقة الشيفت في تاب Closed */}
      {itemSummary && <ShiftItemSummaryModal data={itemSummary} onClose={() => setItemSummary(null)} />}

      {/* ✅ جديد: مودال تسجيل عربون لعميل من شاشة الكاشير - باسمه ورقمه بس، بيتربط تلقائيًا بحساب موجود
          (لو رقمه متسجّل بالفعل) أو بينشئله حساب جديد في نظام العملاء على طول */}
      {showDepositModal && (
        <div onClick={() => { setShowDepositModal(false); setDepCustName(''); setDepCustPhone(''); setDepAmount(''); setDepCardBank(''); setDepSaved(false); setDepReservationDate(new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kuala_Lumpur' })) }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: S.navy2, borderRadius: 20, border: `1px solid ${S.border}`, width: '100%', maxWidth: 380, padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ color: S.white, fontSize: 16, fontWeight: 800 }}>💰 Add Deposit</h2>
              <button onClick={() => { setShowDepositModal(false); setDepCustName(''); setDepCustPhone(''); setDepAmount(''); setDepCardBank(''); setDepSaved(false); setDepReservationDate(new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kuala_Lumpur' })) }}
                style={{ background: 'transparent', border: 'none', color: S.muted, fontSize: 20, cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ fontSize: 11, color: S.muted, marginBottom: 14 }}>
              Enter the customer's name and phone number. If they're not registered yet, a new customer profile will be created automatically.
            </div>

            <input style={{ background: '#F4FAF9', border: '1px solid rgba(15,60,60,0.15)', borderRadius: 10, padding: '9px 14px', fontSize: 13, color: S.white, outline: 'none', fontFamily: 'Tajawal, sans-serif', width: '100%', marginBottom: 10, boxSizing: 'border-box' }}
              placeholder="Customer Name" value={depCustName} onChange={e => setDepCustName(e.target.value)} />
            <input style={{ background: '#F4FAF9', border: '1px solid rgba(15,60,60,0.15)', borderRadius: 10, padding: '9px 14px', fontSize: 13, color: S.white, outline: 'none', fontFamily: 'Tajawal, sans-serif', width: '100%', marginBottom: 10, boxSizing: 'border-box' }}
              placeholder="Phone Number" value={depCustPhone} onChange={e => setDepCustPhone(e.target.value)} />
            <input style={{ background: '#F4FAF9', border: '1px solid rgba(15,60,60,0.15)', borderRadius: 10, padding: '9px 14px', fontSize: 13, color: S.white, outline: 'none', fontFamily: 'Tajawal, sans-serif', width: '100%', marginBottom: 10, boxSizing: 'border-box' }}
              type="number" placeholder="Deposit Amount (MYR)" value={depAmount} onChange={e => setDepAmount(e.target.value)} />

            <label style={{ fontSize: 11, color: S.muted, display: 'block', marginBottom: 5 }}>📅 Reservation Date (when the customer will come)</label>
            <input style={{ background: '#F4FAF9', border: '1px solid rgba(15,60,60,0.15)', borderRadius: 10, padding: '9px 14px', fontSize: 13, color: S.navy, outline: 'none', fontFamily: 'Tajawal, sans-serif', width: '100%', marginBottom: 6, boxSizing: 'border-box' }}
              type="date" value={depReservationDate} onChange={e => setDepReservationDate(e.target.value)} />
            <div style={{ fontSize: 10, color: S.muted, marginBottom: 10 }}>
              This deposit will count toward that day's total, not today's.
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 8 }}>
              {[{ k: 'cash', label: '💵 Cash' }, { k: 'visa', label: '💳 Visa' }, { k: 'online', label: '📱 Bank Transfer' }].map(m => (
                <button key={m.k} onClick={() => setDepMethod(m.k as any)}
                  style={{ padding: '8px', borderRadius: 8, border: `1px solid ${depMethod === m.k ? S.gold : S.border}`, background: depMethod === m.k ? S.gold3 : 'transparent', color: depMethod === m.k ? S.gold : S.muted, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', fontWeight: depMethod === m.k ? 700 : 400 }}>
                  {m.label}
                </button>
              ))}
            </div>
            {depMethod === 'visa' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6, marginBottom: 14 }}>
                {[{ k: 'maybank', label: '🏦 Maybank' }, { k: 'bsn', label: '🏦 BSN' }].map(b => (
                  <button key={b.k} onClick={() => setDepCardBank(b.k as any)}
                    style={{ padding: '8px', borderRadius: 8, border: `1px solid ${depCardBank === b.k ? S.gold : S.border}`, background: depCardBank === b.k ? S.gold3 : 'transparent', color: depCardBank === b.k ? S.gold : S.muted, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', fontWeight: depCardBank === b.k ? 700 : 400 }}>
                    {b.label}
                  </button>
                ))}
              </div>
            )}

            <button
              disabled={depSaving}
              onClick={async () => {
                if (!depCustName.trim()) { alert('Please enter the customer name'); return }
                if (!depCustPhone.trim()) { alert('Please enter the customer phone number'); return }
                if (!(parseFloat(depAmount) > 0)) { alert('Please enter a valid amount'); return }
                if (depMethod === 'visa' && !depCardBank) { alert('Please select the bank (Maybank / BSN)'); return }
                setDepSaving(true)
                // ✅ ندور الأول لو فيه عميل مسجّل بنفس الرقم ده، عشان منعملش نسخة مكررة بالغلط
                const { data: existingCust, error: findError } = await sb.from('customers')
                  .select('id').eq('phone', depCustPhone.trim()).limit(1).maybeSingle()
                if (findError) { alert('⚠️ Failed to check customer: ' + findError.message); setDepSaving(false); return }
                let customerId = existingCust?.id
                if (!customerId) {
                  const { data: newCust, error: newCustError } = await sb.from('customers')
                    .insert([{ name: depCustName.trim(), phone: depCustPhone.trim() }]).select('id').single()
                  if (newCustError || !newCust) { alert('⚠️ Failed to create customer: ' + (newCustError?.message || 'unknown')); setDepSaving(false); return }
                  customerId = newCust.id
                }
                const { error: depositError } = await sb.from('customer_deposits').insert([{
                  customer_id: customerId, branch_id: employee?.branch_id || null,
                  amount: parseFloat(depAmount), status: 'available',
                  payment_method: depMethod, card_bank: depMethod === 'visa' ? depCardBank : null,
                  created_by_name: activeShiftCashierName || employee?.name || null,
                  reservation_date: depReservationDate,
                }])
                setDepSaving(false)
                if (depositError) { alert('⚠️ Failed to save deposit: ' + depositError.message); return }
                setDepSaved(true)
                setTimeout(() => {
                  setShowDepositModal(false); setDepCustName(''); setDepCustPhone(''); setDepAmount('')
                  setDepCardBank(''); setDepSaved(false)
                  setDepReservationDate(new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kuala_Lumpur' }))
                }, 1200)
              }}
              style={{ width: '100%', padding: 12, borderRadius: 10, border: 'none', background: depSaved ? S.green : S.blue, color: '#fff', cursor: 'pointer', fontSize: 14, fontFamily: 'Tajawal, sans-serif', fontWeight: 800, opacity: depSaving ? 0.6 : 1 }}>
              {depSaving ? '⏳ Saving...' : depSaved ? '✅ Deposit Saved!' : '💾 Save Deposit'}
            </button>
          </div>
        </div>
      )}

      {/* ✅ New: log a cash expense during the shift - saved into the same daily_cash_expenses table the Daily Report reads automatically */}
      {showExpenseModal && (
        <div onClick={() => { setShowExpenseModal(false); setExpDesc(''); setExpAmount(''); setExpSaved(false); setExpImages([]); setExpImagePreviews([]) }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: S.navy2, borderRadius: 20, border: `1px solid ${S.border}`, width: '100%', maxWidth: 380, padding: 24, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ color: S.white, fontSize: 16, fontWeight: 800 }}>💸 Add Cash Expense</h2>
              <button onClick={() => { setShowExpenseModal(false); setExpDesc(''); setExpAmount(''); setExpSaved(false); setExpImages([]); setExpImagePreviews([]) }}
                style={{ background: 'transparent', border: 'none', color: S.muted, fontSize: 20, cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ fontSize: 12, color: S.muted, marginBottom: 14 }}>
              🧑‍💼 {activeShiftCashierName || employee?.name} · {shift === 'shift1' ? 'Shift 1' : shift === 'shift2' ? 'Shift 2' : 'Shift 3'}
              <br />This amount will be automatically deducted from the shift's cash total in the Daily Report
            </div>
            <input style={{ background: '#F4FAF9', border: '1px solid rgba(15,60,60,0.15)', borderRadius: 10, padding: '9px 14px', fontSize: 13, color: S.white, outline: 'none', fontFamily: 'Tajawal, sans-serif', width: '100%', marginBottom: 10, boxSizing: 'border-box' }} placeholder="Description - e.g. bought mineral water"
              value={expDesc} onChange={e => setExpDesc(e.target.value)} />
            <input style={{ background: '#F4FAF9', border: '1px solid rgba(15,60,60,0.15)', borderRadius: 10, padding: '9px 14px', fontSize: 13, color: S.white, outline: 'none', fontFamily: 'Tajawal, sans-serif', width: '100%', marginBottom: 10, boxSizing: 'border-box' }} type="number" placeholder="Amount (MYR)"
              value={expAmount} onChange={e => setExpAmount(e.target.value)} />

            {/* ✅ جديد: إرفاق صورة أو أكتر لفاتورة المصروف - إلزامي */}
            <div style={{ fontSize: 12, color: S.muted, marginBottom: 6 }}>🧾 Receipt Photo(s) — required</div>
            {/* ✅ Fix: زرارين منفصلين وواضحين بدل زرار واحد - سلوك المتصفحات مش ثابت مع input واحد (بعضها بيفتح
                الجاليري بس حتى من غير capture)، فدلوقتي كل زرار بيفتح اللي المفروض يفتحه على طول بشكل مضمون */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
              <label style={{ display: 'block', textAlign: 'center', padding: '10px', borderRadius: 10, border: `1px dashed ${S.blue}`, color: S.blue, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif' }}>
                📷 Take Photo
                <input type="file" accept="image/*" capture="environment" style={{ display: 'none' }}
                  onChange={e => {
                    const files = Array.from(e.target.files || [])
                    if (files.length === 0) return
                    setExpImages(prev => [...prev, ...files])
                    setExpImagePreviews(prev => [...prev, ...files.map(f => URL.createObjectURL(f))])
                    e.target.value = ''
                  }} />
              </label>
              <label style={{ display: 'block', textAlign: 'center', padding: '10px', borderRadius: 10, border: `1px dashed ${S.border}`, color: S.muted, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif' }}>
                🖼️ Choose from Gallery
                <input type="file" accept="image/*" multiple style={{ display: 'none' }}
                  onChange={e => {
                    const files = Array.from(e.target.files || [])
                    if (files.length === 0) return
                    setExpImages(prev => [...prev, ...files])
                    setExpImagePreviews(prev => [...prev, ...files.map(f => URL.createObjectURL(f))])
                    e.target.value = ''
                  }} />
              </label>
            </div>
            {expImagePreviews.length > 0 && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
                {expImagePreviews.map((src, i) => (
                  <div key={i} style={{ position: 'relative', width: 64, height: 64 }}>
                    <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 8, border: `1px solid ${S.border}` }} />
                    <button onClick={() => {
                      setExpImages(prev => prev.filter((_, idx) => idx !== i))
                      setExpImagePreviews(prev => prev.filter((_, idx) => idx !== i))
                    }} style={{ position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: '50%', border: 'none', background: S.red, color: '#fff', cursor: 'pointer', fontSize: 12, lineHeight: '20px', padding: 0 }}>✕</button>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
              {[{ k: 'paid', label: '✅ Already Spent' }, { k: 'pending', label: '⏳ Still Pending' }].map(s => (
                <button key={s.k} onClick={() => setExpStatus(s.k as any)}
                  style={{ padding: '8px', borderRadius: 8, border: `1px solid ${expStatus === s.k ? S.gold : S.border}`, background: expStatus === s.k ? S.gold3 : 'transparent', color: expStatus === s.k ? S.gold : S.muted, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', fontWeight: expStatus === s.k ? 700 : 400 }}>
                  {s.label}
                </button>
              ))}
            </div>
            <button
              onClick={async () => {
                if (!expDesc.trim() || !(parseFloat(expAmount) > 0)) { alert('Please enter a valid description and amount'); return }
                if (expImages.length === 0) { alert('Please attach at least one receipt photo'); return }
                setExpSaving(true)
                setExpUploading(true)
                // ✅ جديد: نرفع كل الصور المرفقة لـ Supabase Storage الأول، وناخد روابطها العامة
                const uploadedUrls: string[] = []
                for (const file of expImages) {
                  const fileExt = file.name.split('.').pop() || 'jpg'
                  const fileName = `${employee?.branch_id || 'unknown'}/${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`
                  const { error: upErr } = await sb.storage.from('expense-receipts').upload(fileName, file)
                  if (upErr) { alert('⚠️ Failed to upload image: ' + upErr.message); setExpSaving(false); setExpUploading(false); return }
                  const { data: urlData } = sb.storage.from('expense-receipts').getPublicUrl(fileName)
                  uploadedUrls.push(urlData.publicUrl)
                }
                setExpUploading(false)
                const todayMY = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kuala_Lumpur' })
                const { error } = await sb.from('daily_cash_expenses').insert([{
                  branch_id: employee?.branch_id || null, expense_date: todayMY, shift,
                  cashier_name: activeShiftCashierName || employee?.name || 'Unknown',
                  description: expDesc.trim(), amount: parseFloat(expAmount), status: expStatus,
                  receipt_urls: uploadedUrls,
                }])
                setExpSaving(false)
                if (error) { alert('⚠️ Failed to save expense: ' + error.message); return }
                setExpSaved(true)
                setTimeout(() => {
                  setShowExpenseModal(false); setExpDesc(''); setExpAmount(''); setExpSaved(false)
                  setExpImages([]); setExpImagePreviews([])
                }, 1200)
              }}
              disabled={expSaving}
              style={{ width: '100%', padding: 12, borderRadius: 10, border: 'none', background: expSaved ? S.green : S.red, color: '#fff', cursor: 'pointer', fontSize: 14, fontFamily: 'Tajawal, sans-serif', fontWeight: 800, opacity: expSaving ? 0.6 : 1 }}>
              {expUploading ? '⏳ Uploading photos...' : expSaving ? '⏳ Saving...' : expSaved ? '✅ Saved!' : '💾 Save Expense'}
            </button>
          </div>
        </div>
      )}

      {/* ✅ جديد: مودال اختيار اسم الكاشير الحقيقي وقت بدء الشيفت - عشان يشتغل صح حتى لو الحساب مشترك */}
      {showStartShiftModal && (
        <div onClick={() => setShowStartShiftModal(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: S.navy2, borderRadius: 20, border: `1px solid ${S.border}`, width: '100%', maxWidth: 380, padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ color: S.white, fontSize: 16, fontWeight: 800 }}>▶ Start Shift</h2>
              <button onClick={() => setShowStartShiftModal(false)} style={{ background: 'transparent', border: 'none', color: S.muted, fontSize: 20, cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ fontSize: 12, color: S.muted, marginBottom: 14 }}>Who is starting this shift now?</div>

            {startShiftCashierList.length > 0 && (
              <select style={{ background: '#F4FAF9', border: '1px solid rgba(15,60,60,0.15)', borderRadius: 10, padding: '9px 14px', fontSize: 13, color: S.white, outline: 'none', fontFamily: 'Tajawal, sans-serif', width: '100%', marginBottom: 10, boxSizing: 'border-box' }}
                value={startShiftSelectedName} onChange={e => { setStartShiftSelectedName(e.target.value); setStartShiftCustomName('') }}>
                <option value="">-- Select from list --</option>
                {startShiftCashierList.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
              </select>
            )}
            <div style={{ fontSize: 11, color: S.muted, marginBottom: 6 }}>{startShiftCashierList.length > 0 ? 'Or type a name not in the list:' : 'Type your name:'}</div>
            <input style={{ background: '#F4FAF9', border: '1px solid rgba(15,60,60,0.15)', borderRadius: 10, padding: '9px 14px', fontSize: 13, color: S.white, outline: 'none', fontFamily: 'Tajawal, sans-serif', width: '100%', marginBottom: 16, boxSizing: 'border-box' }}
              placeholder="Name" value={startShiftCustomName} onChange={e => { setStartShiftCustomName(e.target.value); setStartShiftSelectedName('') }} />

            <button
              onClick={async () => {
                const finalName = (startShiftSelectedName || startShiftCustomName).trim()
                if (!finalName) { alert('Please select or type a name'); return }
                const now = new Date()
                setShiftStarted(true); setShiftStart(now)
                localStorage.setItem('cashier_shift_active', 'true'); localStorage.setItem('cashier_shift_start', now.toISOString()); localStorage.setItem('cashier_shift_value', shift)
                // ✅ تسليم/استلام: نقفل أي جلسة مفتوحة *حديثة* لنفس الشيفت+الفرع قبل ما نفتح الجديدة — عشان
                // ماتفضلش جلسة يتيمة مفتوحة (كاشير نسي End Shift) تلخبط اسم الكاشير الحالي ونسبة المصروفات.
                // بنحصرها في آخر 36 ساعة بس: جلسة قديمة جدًا اتنسيت مفتوحة أصلًا مخفية من كل التقارير
                // (بسبب حارس started_at في تقرير اليومية)، وقفلها بوقت "النهاردة" كان بيلغبطها هناك.
                if (employee?.branch_id) {
                  const recentCutoff = new Date(now.getTime() - 36 * 60 * 60 * 1000).toISOString()
                  await sb.from('cashier_shift_sessions')
                    .update({ ended_at: now.toISOString() })
                    .eq('branch_id', employee.branch_id).eq('shift', shift)
                    .is('ended_at', null).gte('started_at', recentCutoff)
                }
                // ✅ الاسم الحقيقي اللي اتحدد يدويًا هو اللي بيتسجل، مش اسم الحساب اللي داخل بيه
                await sb.from('cashier_shift_sessions').insert([{ branch_id: employee?.branch_id || null, shift, cashier_name: finalName }])
                fetchActiveShiftCashier()
                setShowStartShiftModal(false)
              }}
              style={{ width: '100%', padding: 12, borderRadius: 10, border: 'none', background: S.green, color: '#fff', cursor: 'pointer', fontSize: 14, fontFamily: 'Tajawal, sans-serif', fontWeight: 800 }}>
              ▶ Start Shift
            </button>
          </div>
        </div>
      )}

      {showShiftReport && <ShiftReportModal orders={orders} shift={shift} shiftStart={shiftStart} fetchPaid={fetchPaidOrders} onClose={async () => {
        setShowShiftReport(false); setShiftStarted(false); setShiftStart(null)
        localStorage.removeItem('cashier_shift_active'); localStorage.removeItem('cashier_shift_start')
        // ✅ جديد: إغلاق جلسة الشيفت في قاعدة البيانات كمان
        // ✅ Fix حرج جدًا: قبل كده كنا بنقفل *كل* الجلسات المفتوحة لنفس رقم الشيفت بغض النظر عن تاريخها -
        // وده كان بيقفل بالغلط شيفتات قديمة جدًا (من أسابيع فاتت) اتنسيت مفتوحة (ended_at فاضي) من غير قصد،
        // وبيحطلها وقت نهاية = النهاردة، فتقرير اليومية كان بيفتكرها "شيفتات اليوم". دلوقتي بنجيب أحدث جلسة
        // مفتوحة بالتحديد (بالـ id بتاعها) ونقفل هي بس، مش أي جلسة تانية قديمة
        let selQ = sb.from('cashier_shift_sessions').select('id')
          .eq('shift', shift).is('ended_at', null).order('started_at', { ascending: false }).limit(1)
        if (employee?.branch_id) selQ = selQ.eq('branch_id', employee.branch_id)
        const { data: latestSession } = await selQ.maybeSingle()
        if (latestSession?.id) {
          await sb.from('cashier_shift_sessions').update({ ended_at: new Date().toISOString() }).eq('id', latestSession.id)
        }
        fetchActiveShiftCashier()
      }} />}

      {/* ✅ جديد: مودال تفاصيل فاتورة الأرشيف - يظهر بمنتصف الشاشة عند الضغط على أي طلب في تاب Archive */}
      {archiveDetailOrder && (
        <div onClick={() => setArchiveDetailOrder(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 400, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 20, overflowY: 'auto' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: S.navy2, borderRadius: 20, border: `1px solid ${S.border}`, width: '100%', maxWidth: 480, padding: 28, margin: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ color: S.white, fontSize: 18, fontWeight: 800 }}>📦 Invoice Details</h2>
              <button onClick={() => setArchiveDetailOrder(null)} style={{ background: 'transparent', border: 'none', color: S.muted, fontSize: 20, cursor: 'pointer' }}>✕</button>
            </div>

            <div style={{ background: S.card, borderRadius: 12, padding: 16, marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span style={{ fontSize: 12, color: S.muted }}>
                  {archiveDetailOrder.tables?.name || `Table ${archiveDetailOrder.tables?.number}`} · #{archiveDetailOrder.id.slice(-6).toUpperCase()}
                </span>
                <span style={{ background: archiveDetailOrder.status === 'cancelled' ? S.redB : S.greenB, color: archiveDetailOrder.status === 'cancelled' ? S.red : S.green, borderRadius: 8, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>
                  {archiveDetailOrder.status === 'cancelled' ? '❌ Cancelled' : '✅ Paid'}
                </span>
              </div>
              <div style={{ fontSize: 11, color: S.muted, marginBottom: 10 }}>{new Date(archiveDetailOrder.created_at).toLocaleString('en-GB')}</div>

              {groupItemsByRound(archiveDetailOrder.order_items).map((round, ri) => (
                <div key={ri}>
                  {ri > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '10px 0', color: S.amber, fontSize: 11, fontWeight: 700 }}>
                      <div style={{ flex: 1, height: 1, background: S.amber + '40' }} />
                      🔔 Round {ri + 1} (Additional Order) · {timeElapsedSince(round[0]?.created_at)}
                      <div style={{ flex: 1, height: 1, background: S.amber + '40' }} />
                    </div>
                  )}
                  {round.map(i => (
                    <div key={i.id} style={{ padding: '5px 0', borderBottom: `1px solid ${S.border}`, fontSize: 13 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 8, color: i.status === 'cancelled' ? S.muted : S.white, textDecoration: i.status === 'cancelled' ? 'line-through' : 'none' }}>
                          {i.menu_items?.or_code && <span style={{ fontWeight: 700, color: S.gold }}>#{i.menu_items.or_code}</span>}
                          <span>{i.menu_items?.name_en || i.menu_items?.name || '⚠️ Removed Item'}{i.size_name ? ` (${i.size_name})` : ''} <span style={{ color: S.muted }}>×{i.quantity}</span></span>
                        </span>
                        <span style={{ color: i.status === 'cancelled' ? S.muted : S.gold, textDecoration: i.status === 'cancelled' ? 'line-through' : 'none' }}>MYR {(i.unit_price * i.quantity).toFixed(2)}</span>
                      </div>
                      {i.notes && <div style={{ fontSize: 11, color: S.gold, marginTop: 2 }}>📝 {i.notes}</div>}
                      {i.status === 'cancelled' && i.cancel_reason && <div style={{ fontSize: 11, color: S.red, marginTop: 2 }}>❌ Cancelled: {i.cancel_reason}</div>}
                    </div>
                  ))}
                </div>
              ))}

              <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px solid ${S.border}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: S.muted, marginBottom: 4 }}>
                  <span>Subtotal</span>
                  <span>MYR {archiveDetailOrder.order_items.filter(i => i.status !== 'cancelled').reduce((s, i) => s + i.unit_price * i.quantity, 0).toFixed(2)}</span>
                </div>
                {archiveDetailOrder.service_charge > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: S.amber, marginBottom: 4 }}>
                    <span>Service Charge</span>
                    <span>MYR {archiveDetailOrder.service_charge.toFixed(2)}</span>
                  </div>
                )}
                {archiveDetailOrder.sst_amount > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: S.teal, marginBottom: 4 }}>
                    <span>SST</span>
                    <span>MYR {archiveDetailOrder.sst_amount.toFixed(2)}</span>
                  </div>
                )}
                {archiveDetailOrder.discount_amount > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: S.red, marginBottom: 4 }}>
                    <span>Discount {archiveDetailOrder.discount_type ? `(${archiveDetailOrder.discount_type})` : ''}</span>
                    <span>- MYR {archiveDetailOrder.discount_amount.toFixed(2)}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 900, color: S.gold, marginTop: 8 }}>
                  <span>Total</span>
                  <span>MYR {(archiveDetailOrder.total_amount || 0).toFixed(2)}</span>
                </div>
              </div>

              {archiveDetailOrder.payment_method === 'split' ? (
                <div style={{ marginTop: 10, background: S.card, borderRadius: 8, padding: 10 }}>
                  <div style={{ fontSize: 11, color: S.muted, marginBottom: 6, fontWeight: 700 }}>✂️ Split Payment Breakdown</div>
                  {closedSplitPayments.filter(sp => sp.order_id === archiveDetailOrder.id).length > 0 ? (
                    closedSplitPayments.filter(sp => sp.order_id === archiveDetailOrder.id).map((sp, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: S.teal, marginTop: 2 }}>
                        <span>{sp.payment_method === 'cash' ? '💵' : sp.payment_method === 'visa' ? '💳' : '📱'} {sp.payment_method}{sp.card_bank ? ` (${sp.card_bank})` : ''}</span>
                        <span>MYR {sp.amount.toFixed(2)}</span>
                      </div>
                    ))
                  ) : (
                    <div style={{ fontSize: 12, color: S.muted }}>Split payment — details unavailable in this view</div>
                  )}
                </div>
              ) : archiveDetailOrder.payment_method && (
                <div style={{ fontSize: 12, color: S.teal, marginTop: 10 }}>
                  {archiveDetailOrder.payment_method === 'cash' ? '💵' : archiveDetailOrder.payment_method === 'visa' ? '💳' : archiveDetailOrder.payment_method === 'credit' ? '🧾' : '📱'} {archiveDetailOrder.payment_method}
                  {(archiveDetailOrder as any).card_bank ? ` (${(archiveDetailOrder as any).card_bank})` : ''}
                </div>
              )}
              {archiveDetailOrder.paid_by_name && <div style={{ fontSize: 12, color: S.muted, marginTop: 4 }}>👤 {archiveDetailOrder.paid_by_name}</div>}
              {archiveDetailOrder.cancel_reason && <div style={{ fontSize: 12, color: S.red, marginTop: 4 }}>❌ Cancelled: {archiveDetailOrder.cancel_reason}</div>}
              {archiveDetailOrder.notes && <div style={{ fontSize: 12, color: S.gold, marginTop: 4 }}>📝 {archiveDetailOrder.notes}</div>}
            </div>

            <button onClick={() => setArchiveDetailOrder(null)} style={{ width: '100%', padding: '10px 0', borderRadius: 10, border: `1px solid ${S.border}`, background: 'transparent', color: S.muted, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif' }}>
              Close
            </button>
          </div>
        </div>
      )}

      {/* ✅ مودال سبب الإلغاء الإجباري - للفاتورة الكاملة أو لصنف واحد */}
      {(cancelOrderTarget || cancelItemTarget) && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: S.navy2, borderRadius: 20, border: `1px solid ${S.red}`, width: '100%', maxWidth: 400, padding: 28, textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}>
            <div style={{ fontSize: 40, marginBottom: 14 }}>⚠️</div>
            <div style={{ color: S.white, fontSize: 17, fontWeight: 800, marginBottom: 10 }}>
              {cancelOrderTarget ? `Cancel Order — ${cancelOrderTarget.tables?.name || `Table ${cancelOrderTarget.tables?.number}`}` : `Cancel Item — ${cancelItemTarget?.itemName}`}
            </div>
            <div style={{ color: S.red, fontSize: 11, marginBottom: 16 }}>This cannot be undone. A reason is required.</div>
            {/* ✅ جديد: اختيار الكمية المراد إلغاؤها - تظهر بس لو الصنف كميته أكتر من 1 */}
            {cancelItemTarget && cancelItemTarget.totalQty > 1 && (
              <div style={{ marginBottom: 16, textAlign: 'right' }}>
                <div style={{ color: S.white, fontSize: 12, marginBottom: 6 }}>How many to cancel? (of {cancelItemTarget.totalQty})</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center' }}>
                  <button onClick={() => setCancelItemQty(q => Math.max(1, q - 1))} style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${S.border}`, background: S.navy3, color: S.white, cursor: 'pointer', fontSize: 16 }}>−</button>
                  <span style={{ color: S.white, fontSize: 18, fontWeight: 800, minWidth: 30, textAlign: 'center' }}>{cancelItemQty}</span>
                  <button onClick={() => setCancelItemQty(q => Math.min(cancelItemTarget.totalQty, q + 1))} style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${S.border}`, background: S.navy3, color: S.white, cursor: 'pointer', fontSize: 16 }}>+</button>
                </div>
              </div>
            )}
            <textarea
              value={cancelReason}
              onChange={e => setCancelReason(e.target.value)}
              placeholder="Reason for cancellation (required)..."
              rows={3}
              autoFocus
              style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 10, border: `1px solid ${cancelReason.trim() ? S.border : S.red}`, background: S.navy3, color: S.white, fontSize: 13, marginBottom: 20, fontFamily: 'Tajawal, sans-serif', resize: 'vertical' }}
            />
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => { setCancelOrderTarget(null); setCancelItemTarget(null); setCancelItemQty(1); setCancelReason('') }} style={{ flex: 1, padding: '12px', borderRadius: 12, border: `1px solid ${S.border}`, background: 'transparent', color: S.muted, cursor: 'pointer', fontSize: 14, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
                Back
              </button>
              <button
                onClick={cancelOrderTarget ? doCancelOrder : doCancelItem}
                disabled={!cancelReason.trim() || cancelSaving}
                style={{ flex: 1, padding: '12px', borderRadius: 12, border: 'none', background: cancelReason.trim() ? S.red : S.border, color: cancelReason.trim() ? '#fff' : S.muted, cursor: cancelReason.trim() ? 'pointer' : 'not-allowed', fontSize: 14, fontFamily: 'Tajawal, sans-serif', fontWeight: 800, opacity: cancelSaving ? 0.7 : 1 }}>
                {cancelSaving ? '⏳...' : '❌ Confirm Cancellation'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ✅ جديد: تحميل صنف على موظف - يُشال من فاتورة العميل وينزل خصمًا فوريًا من راتب الموظف المختار */}
      {chargeItemTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: S.navy2, borderRadius: 20, border: `1px solid ${S.amber}`, width: '100%', maxWidth: 420, padding: 28, boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}>
            <div style={{ fontSize: 40, marginBottom: 14, textAlign: 'center' }}>👤</div>
            <div style={{ color: S.white, fontSize: 17, fontWeight: 800, marginBottom: 6, textAlign: 'center' }}>
              Charge to Employee — {chargeItemTarget.itemName}
            </div>
            <div style={{ color: S.amber, fontSize: 11, marginBottom: 18, textAlign: 'center' }}>
              This item will be removed from the customer&apos;s bill and deducted immediately from the selected employee&apos;s salary.
            </div>

            {chargeItemTarget.totalQty > 1 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ color: S.white, fontSize: 12, marginBottom: 6 }}>How many units? (of {chargeItemTarget.totalQty})</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center' }}>
                  <button onClick={() => setChargeQty(q => Math.max(1, q - 1))} style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${S.border}`, background: S.navy3, color: S.white, cursor: 'pointer', fontSize: 16 }}>−</button>
                  <span style={{ color: S.white, fontSize: 18, fontWeight: 800, minWidth: 30, textAlign: 'center' }}>{chargeQty}</span>
                  <button onClick={() => setChargeQty(q => Math.min(chargeItemTarget.totalQty, q + 1))} style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${S.border}`, background: S.navy3, color: S.white, cursor: 'pointer', fontSize: 16 }}>+</button>
                </div>
              </div>
            )}

            <div style={{ marginBottom: 14, textAlign: 'right', position: 'relative' }}>
              <div style={{ color: S.white, fontSize: 12, marginBottom: 6 }}>Employee to charge</div>
              {/* ✅ جديد: بحث حي بالاسم (عربي/إنجليزي) أو رقم الموظف بدل قائمة select عادية بالاسم بس */}
              <input
                value={chargeEmployeeId ? chargeStaffLabel(chargeStaffList.find(s => s.id === chargeEmployeeId)!) : chargeStaffSearch}
                onChange={e => { setChargeEmployeeId(''); setChargeStaffSearch(e.target.value); setChargeStaffOpen(true) }}
                onFocus={() => { setChargeEmployeeId(''); setChargeStaffSearch(''); setChargeStaffOpen(true) }}
                onBlur={() => setTimeout(() => setChargeStaffOpen(false), 150)}
                placeholder="Search by name or employee number..."
                style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 10, border: `1px solid ${chargeEmployeeId ? S.border : S.amber}`, background: S.navy3, color: S.white, fontSize: 13, fontFamily: 'Tajawal, sans-serif' }}
              />
              {chargeStaffOpen && !chargeEmployeeId && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, maxHeight: 220, overflowY: 'auto', background: S.navy3, border: `1px solid ${S.border}`, borderRadius: 10, zIndex: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
                  {filteredChargeStaff.length === 0 ? (
                    <div style={{ padding: '10px 12px', fontSize: 12, color: S.muted }}>No matching employees</div>
                  ) : filteredChargeStaff.map(s => (
                    <button key={s.id} onClick={() => { setChargeEmployeeId(s.id); setChargeStaffOpen(false) }}
                      style={{ display: 'block', width: '100%', textAlign: 'right', padding: '9px 12px', background: 'transparent', border: 'none', borderBottom: `1px solid ${S.border}`, color: S.white, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif' }}>
                      {chargeStaffLabel(s)}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div style={{ marginBottom: 14 }}>
              <div style={{ color: S.white, fontSize: 12, marginBottom: 6 }}>Reason</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => { setChargeType('mistake'); setChargePercent(100) }}
                  style={{ flex: 1, padding: '9px', borderRadius: 10, border: `1px solid ${chargeType === 'mistake' ? S.red : S.border}`, background: chargeType === 'mistake' ? S.redB : 'transparent', color: chargeType === 'mistake' ? S.red : S.muted, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
                  ❌ Order Mistake
                </button>
                <button onClick={() => { setChargeType('personal'); setChargePercent(50) }}
                  style={{ flex: 1, padding: '9px', borderRadius: 10, border: `1px solid ${chargeType === 'personal' ? S.blue : S.border}`, background: chargeType === 'personal' ? S.blueB : 'transparent', color: chargeType === 'personal' ? S.blue : S.muted, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
                  🍽️ Personal Meal
                </button>
              </div>
            </div>

            {/* ✅ جديد: نسبة الخصم من قيمة الصنف - مش لازم الموظف يتحمّل 100% دايمًا */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ color: S.white, fontSize: 12, marginBottom: 6 }}>Deduction percentage</div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                {[25, 50, 75, 100].map(p => (
                  <button key={p} onClick={() => setChargePercent(p)}
                    style={{ padding: '7px 10px', borderRadius: 8, border: `1px solid ${chargePercent === p ? S.amber : S.border}`, background: chargePercent === p ? S.amberB : 'transparent', color: chargePercent === p ? S.amber : S.muted, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
                    {p}%
                  </button>
                ))}
                <input type="number" min={0} max={100} value={chargePercent}
                  onChange={e => setChargePercent(Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
                  style={{ width: 64, boxSizing: 'border-box', padding: '7px 8px', borderRadius: 8, border: `1px solid ${S.border}`, background: S.navy3, color: S.white, fontSize: 12, fontFamily: 'Tajawal, sans-serif', textAlign: 'center' }} />
                <span style={{ color: S.muted, fontSize: 12 }}>%</span>
              </div>
            </div>

            {/* ✅ جديد: الموظف يقدر يدفع جزء (أو كل) المبلغ كاش/شبكة فورًا زي أي عميل، والباقي بس ينزل من راتبه */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ color: S.white, fontSize: 12, marginBottom: 6 }}>Pay part of it now? (optional)</div>
              <div style={{ display: 'flex', gap: 8, marginBottom: chargePaidNowNum > 0 ? 8 : 0 }}>
                <input type="number" min={0} max={chargeTotalAmount} step="0.01" value={chargePaidNow}
                  onChange={e => setChargePaidNow(e.target.value)}
                  placeholder={`0.00 (max MYR ${chargeTotalAmount.toFixed(2)})`}
                  style={{ flex: 1, boxSizing: 'border-box', padding: '9px 12px', borderRadius: 10, border: `1px solid ${S.border}`, background: S.navy3, color: S.white, fontSize: 13, fontFamily: 'Tajawal, sans-serif' }} />
              </div>
              {chargePaidNowNum > 0 && (
                <div style={{ display: 'flex', gap: 8 }}>
                  {(['cash', 'visa', 'online'] as const).map(m => (
                    <button key={m} onClick={() => setChargePaidMethod(m)}
                      style={{ flex: 1, padding: '8px', borderRadius: 8, border: `1px solid ${chargePaidMethod === m ? S.green : S.border}`, background: chargePaidMethod === m ? S.greenB : 'transparent', color: chargePaidMethod === m ? S.green : S.muted, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
                      {m === 'cash' ? '💵 Cash' : m === 'visa' ? '💳 Visa' : '📱 Bank Transfer'}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <textarea
              value={chargeNote}
              onChange={e => setChargeNote(e.target.value)}
              placeholder="Additional note (optional)..."
              rows={2}
              style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 10, border: `1px solid ${S.border}`, background: S.navy3, color: S.white, fontSize: 13, marginBottom: 14, fontFamily: 'Tajawal, sans-serif', resize: 'vertical' }}
            />

            <div style={{ background: S.card, borderRadius: 10, padding: '10px 12px', marginBottom: 18, fontSize: 13 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: S.white, fontWeight: 800 }}>
                <span>Total value</span>
                <span>MYR {chargeTotalAmount.toFixed(2)}</span>
              </div>
              {chargePaidNowNum > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: S.green, marginTop: 4 }}>
                  <span>Paid now ({chargePaidMethod === 'cash' ? 'Cash' : chargePaidMethod === 'visa' ? 'Visa' : 'Bank Transfer'})</span>
                  <span>MYR {chargePaidNowNum.toFixed(2)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', color: S.amber, marginTop: 4, fontWeight: 800 }}>
                <span>Deducted from salary</span>
                <span>MYR {chargeRemaining.toFixed(2)}</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => { setChargeItemTarget(null); setChargeQty(1); setChargeEmployeeId(''); setChargeStaffSearch(''); setChargeStaffOpen(false); setChargeType('mistake'); setChargePercent(100); setChargeNote(''); setChargePaidNow(''); setChargePaidMethod('cash') }}
                style={{ flex: 1, padding: '12px', borderRadius: 12, border: `1px solid ${S.border}`, background: 'transparent', color: S.muted, cursor: 'pointer', fontSize: 14, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
                Back
              </button>
              <button
                onClick={doChargeToEmployee}
                disabled={!chargeEmployeeId || chargeSaving}
                style={{ flex: 1, padding: '12px', borderRadius: 12, border: 'none', background: chargeEmployeeId ? S.amber : S.border, color: chargeEmployeeId ? '#1A1206' : S.muted, cursor: chargeEmployeeId ? 'pointer' : 'not-allowed', fontSize: 14, fontFamily: 'Tajawal, sans-serif', fontWeight: 800, opacity: chargeSaving ? 0.7 : 1 }}>
                {chargeSaving ? '⏳...' : '👤 Confirm Charge'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
