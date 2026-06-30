'use client'

import { useEffect, useState, useCallback } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useAuth } from '../../components/AuthProvider'
import { useLang } from '../../components/LanguageContext'

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
  card: 'rgba(255,255,255,0.04)',
}

type InventoryCount = {
  id: string
  warehouse_id: string
  counted_by: string
  approved_by: string | null
  status: 'pending' | 'approved' | 'rejected'
  count_date: string
  notes: string | null
  created_at: string
  approved_at: string | null
  warehouses?: { name: string; branch_id?: string }
  employees?: { name: string; name_en?: string }
  approver?: { name: string; name_en?: string }
  inventory_count_items?: InventoryCountItem[]
}

type InventoryCountItem = {
  id: string
  product_id: string
  system_stock: number
  actual_stock: number
  difference: number
  notes: string | null
  warehouse_products?: { name: string; name_en?: string }
  units?: { symbol: string }
}

// دمج الاسم الأول والأخير (name_en يخزّن اسم العائلة في هذا النظام)
function getFullName(p?: { name?: string; name_en?: string } | null): string {
  if (!p) return '—'
  return [p.name, p.name_en].filter(Boolean).join(' ').trim() || '—'
}

export default function InventoryReportsPage() {
  const sb = createClient()
  const { employee, permissions } = useAuth()
  const { isAr } = useLang()

  const role = employee?.role || ''
  const isAdmin = permissions?.all === true
  const isBranchManager = role === 'branch_manager'
  const canApprove = isAdmin || isBranchManager

  const [counts, setCounts] = useState<InventoryCount[]>([])
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([])
  const [activeBranch, setActiveBranch] = useState<string>('') // '' = الإجمالي (admin فقط)، أو branch_id محدد
  const [unitConversions, setUnitConversions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<InventoryCount | null>(null)
  const [approving, setApproving] = useState(false)
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all')
  const [editingItems, setEditingItems] = useState<Record<string, number>>({})
  const [isEditing, setIsEditing] = useState(false)

  const fetchCounts = useCallback(async () => {
    setLoading(true)
    let q = sb.from('inventory_counts')
      .select(`
        *,
        warehouses(name, branch_id),
        employees:counted_by(name, name_en),
        approver:approved_by(name, name_en),
        inventory_count_items(
          *,
          warehouse_products(name, name_en),
          units!inventory_count_items_unit_id_fkey(symbol)
        )
      `)
      .order('created_at', { ascending: false })

    if (isBranchManager && !isAdmin) {
      // مدير الفرع يشوف مستودعات فرعه فقط
      const { data: warehouses } = await sb.from('warehouses').select('id').eq('branch_id', employee?.branch_id || '')
      if (warehouses) q = q.in('warehouse_id', warehouses.map(w => w.id))
    }

    const [{ data }, convRes, branchesRes] = await Promise.all([
      q,
      sb.from('unit_conversions').select('*, from_unit:units!unit_conversions_from_unit_id_fkey(symbol), to_unit:units!unit_conversions_to_unit_id_fkey(symbol)'),
      sb.from('branches').select('id,name').eq('is_active', true),
    ])
    setCounts((data as any) || [])
    setUnitConversions(convRes.data || [])
    setBranches(branchesRes.data || [])
    setLoading(false)
  }, [employee])

  useEffect(() => { fetchCounts() }, [fetchCounts])

  // الأدوار غير admin تتقفل على فرعها تلقائيًا (أو المستودع الرئيسي لو مالهاش فرع)
  useEffect(() => {
    if (!isAdmin) setActiveBranch(employee?.branch_id || 'main')
  }, [isAdmin, employee?.branch_id])

  async function approveCount(countId: string) {
    setApproving(true)
    const count = counts.find(c => c.id === countId)
    if (!count) { setApproving(false); return }

    // ⚠️ Fix: لا نحدّث current_stock يدويًا هنا — الـ trigger (trigger_update_stock)
    // على جدول stock_movements بيحدّث current_stock تلقائيًا أول ما نسجل الحركة تحت.
    // كان فيه تحديث يدوي مباشر زيادة عن اللازم هنا، وده كان يسبب تحديث current_stock
    // مرتين (مرة يدوي + مرة من التريغر) فيخرج رقم مضاعف خطأ (مثال: 89 بتتحول لـ 178).
    for (const item of count.inventory_count_items || []) {
      // تسجيل حركة مخزون بالفرق فقط — الـ trigger هو المسؤول عن تحديث current_stock
      if (item.difference !== 0) {
        await sb.from('stock_movements').insert([{
          product_id: item.product_id,
          warehouse_id: count.warehouse_id,
          movement_type: item.difference > 0 ? 'in' : 'out',
          quantity: Math.abs(item.difference),
          movement_date: count.count_date,
          notes: `جرد مخزون معتمد — فرق ${item.difference > 0 ? '+' : ''}${item.difference}`,
        }])
      }
    }

    // تحديث حالة الجرد
    await sb.from('inventory_counts').update({
      status: 'approved',
      approved_by: employee?.id,
      approved_at: new Date().toISOString(),
    }).eq('id', countId)

    setApproving(false)
    setSelected(null)
    fetchCounts()
    alert('✅ تم اعتماد الجرد وتحديث المخزون')
  }

  async function rejectCount(countId: string) {
    await sb.from('inventory_counts').update({ status: 'rejected' }).eq('id', countId)
    setSelected(null)
    fetchCounts()
  }

  function formatStockDisplay(productId: string, stock: number, unitSymbol: string) {
    const conv = unitConversions.find((c: any) => c.product_id === productId)
    if (!conv || !conv.factor || conv.factor <= 1) return `${stock} ${unitSymbol}`
    const bigQty = Math.floor(stock / conv.factor)
    // ✅ Fix: تقريب لمنع أخطاء الفاصلة العائمة في JS (مثال: 6.899999999999999 بدل 6.9)
    const smallQty = Math.round((stock % conv.factor) * 100) / 100
    const parts = []
    if (bigQty > 0) parts.push(`${bigQty} ${conv.from_unit?.symbol || ''}`)
    if (smallQty > 0) parts.push(`${smallQty} ${conv.to_unit?.symbol || unitSymbol}`)
    return parts.length > 0 ? parts.join(' + ') : `0 ${unitSymbol}`
  }

  async function saveEdits() {
    if (!selected) return
    for (const [itemId, actual] of Object.entries(editingItems)) {
      await sb.from('inventory_count_items').update({ actual_stock: actual }).eq('id', itemId)
    }
    setIsEditing(false)
    setEditingItems({})
    fetchCounts()
  }

  function printReport(count: InventoryCount) {
    const items = count.inventory_count_items || []
    const deficit = items.filter(i => i.difference < 0)
    const surplus = items.filter(i => i.difference > 0)
    const match = items.filter(i => i.difference === 0)
    const win = window.open('', '_blank')
    if (!win) return
    const rows = items.map((item, i) => {
      const diff = item.difference
      const diffColor = diff < 0 ? '#EF4444' : diff > 0 ? '#22C55E' : '#8A9BB5'
      return `<tr style="background:${i%2===0?'#fff':'#f9f9f9'}">
        <td>${item.warehouse_products?.name || '—'}</td>
        <td>${formatStockDisplay(item.product_id, item.system_stock, item.units?.symbol || '')}</td>
        <td style="font-weight:700">${formatStockDisplay(item.product_id, item.actual_stock, item.units?.symbol || '')}</td>
        <td style="color:${diffColor};font-weight:700">${diff !== 0 ? (diff > 0 ? '+' : '−') : ''}${formatStockDisplay(item.product_id, Math.abs(diff), item.units?.symbol || '')}</td>
        <td style="color:${diffColor}">${diff < 0 ? '📉 عجز' : diff > 0 ? '📈 زيادة' : '✅ مطابق'}</td>
      </tr>`
    }).join('')
    win.document.write(`<!DOCTYPE html><html dir="rtl"><head><meta charset="UTF-8"><title>تقرير الجرد</title>
<style>
  body{font-family:Arial,sans-serif;font-size:12px;margin:20px;direction:rtl;}
  h1{font-size:18px;color:#0A1628;margin-bottom:4px;}
  .sub{font-size:12px;color:#666;margin-bottom:16px;}
  .summary{display:flex;gap:16px;margin-bottom:20px;}
  .box{border:1px solid #ddd;border-radius:8px;padding:10px 16px;text-align:center;min-width:80px;}
  .box .val{font-size:22px;font-weight:bold;}
  table{width:100%;border-collapse:collapse;font-size:11px;}
  th{background:#0A1628;color:#fff;padding:8px 10px;text-align:right;}
  td{padding:7px 10px;border-bottom:1px solid #eee;}
  @media print{@page{size:A4;margin:10mm;}}
</style></head><body>
<h1>📋 تقرير جرد المخزون</h1>
<div class="sub">
  🏭 ${(count.warehouses as any)?.name} · 
  👤 ${getFullName(count.employees as any)} · 
  📅 ${new Date(count.count_date).toLocaleDateString('ar-SA')} · 
  ${items.length} صنف
</div>
<div class="summary">
  <div class="box"><div class="val" style="color:#22C55E">${match.length}</div><div>✅ مطابق</div></div>
  <div class="box"><div class="val" style="color:#EF4444">${deficit.length}</div><div>📉 عجز</div></div>
  <div class="box"><div class="val" style="color:#F59E0B">${surplus.length}</div><div>📈 زيادة</div></div>
</div>
<table>
  <thead><tr><th>الصنف</th><th>النظام</th><th>الفعلي</th><th>الفرق</th><th>الحالة</th></tr></thead>
  <tbody>${rows}</tbody>
</table>
<script>window.onload=()=>window.print()<\/script>
</body></html>`)
    win.document.close()
  }

  // خريطة سريعة: warehouse_id → branch_id (أو 'main' لو المستودع غير مرتبط بفرع — المستودع الرئيسي)
  const warehouseBranchMap = Object.fromEntries(
    counts.map(c => [c.warehouse_id, c.warehouses?.branch_id || 'main'])
  )
  function countBranchKey(c: InventoryCount): string {
    return c.warehouses?.branch_id || warehouseBranchMap[c.warehouse_id] || 'main'
  }

  // التابات: تاب لكل فرع، بالإضافة لتاب "المستودع الرئيسي" دائمًا
  const allTabs = [{ key: 'main', label: '🏭 المستودع الرئيسي' }, ...branches.map(b => ({ key: b.id, label: `🏪 ${b.name}` }))]
  // الأدوار غير admin تشوف بس تاب فرعها (أو المستودع الرئيسي لو مالهاش فرع)
  const visibleTabs = isAdmin ? allTabs : allTabs.filter(t => t.key === (employee?.branch_id || 'main'))

  const branchScopedCounts = activeBranch ? counts.filter(c => countBranchKey(c) === activeBranch) : counts

  const filtered = branchScopedCounts.filter(c => statusFilter === 'all' || c.status === statusFilter)

  const STATUS_CFG = {
    pending:  { label: 'قيد المراجعة', color: S.amber, bg: S.amberB, icon: '⏳' },
    approved: { label: 'معتمد',        color: S.green, bg: S.greenB, icon: '✅' },
    rejected: { label: 'مرفوض',        color: S.red,   bg: S.redB,   icon: '❌' },
  }

  if (!canApprove) return (
    <div style={{ fontFamily: 'Tajawal, sans-serif', direction: 'rtl', color: S.white, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', flexDirection: 'column', gap: 16 }}>
      <div style={{ fontSize: 64 }}>🔒</div>
      <div style={{ fontSize: 20, fontWeight: 800, color: S.red }}>غير مصرح بالوصول</div>
    </div>
  )

  return (
    <div style={{ fontFamily: 'Tajawal, sans-serif', direction: 'rtl', color: S.white }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700;800&display=swap');`}</style>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 900, color: S.white, marginBottom: 4 }}>📋 تقارير الجرد</h1>
        <p style={{ fontSize: 13, color: S.muted }}>مراجعة واعتماد جرد المخزون من أمناء المستودعات</p>
      </div>

      {/* Branch Tabs */}
      {visibleTabs.length > 1 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
          {isAdmin && (
            <button onClick={() => setActiveBranch('')}
              style={{ padding: '9px 16px', borderRadius: 12, border: `1px solid ${activeBranch === '' ? S.gold : S.border}`, background: activeBranch === '' ? S.gold3 : 'transparent', color: activeBranch === '' ? S.gold : S.muted, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: activeBranch === '' ? 700 : 400 }}>
              🌐 الإجمالي (الكل)
            </button>
          )}
          {visibleTabs.map(t => (
            <button key={t.key} onClick={() => setActiveBranch(t.key)}
              style={{ padding: '9px 16px', borderRadius: 12, border: `1px solid ${activeBranch === t.key ? S.gold : S.border}`, background: activeBranch === t.key ? S.gold3 : 'transparent', color: activeBranch === t.key ? S.gold : S.muted, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: activeBranch === t.key ? 700 : 400 }}>
              {t.label}
            </button>
          ))}
        </div>
      )}

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 12, marginBottom: 24 }}>
        {(['all', 'pending', 'approved', 'rejected'] as const).map(s => {
          const count = s === 'all' ? branchScopedCounts.length : branchScopedCounts.filter(c => c.status === s).length
          const cfg = s === 'all' ? { color: S.white, bg: S.card, icon: '📋', label: 'الكل' } : { ...STATUS_CFG[s], label: STATUS_CFG[s].label }
          return (
            <div key={s} onClick={() => setStatusFilter(s)}
              style={{ background: statusFilter === s ? cfg.bg : S.card, border: `1px solid ${statusFilter === s ? cfg.color : S.border}`, borderRadius: 14, padding: '14px 16px', cursor: 'pointer', transition: 'all .2s' }}>
              <div style={{ fontSize: 11, color: S.muted, marginBottom: 4 }}>{cfg.icon} {cfg.label}</div>
              <div style={{ fontSize: 26, fontWeight: 900, color: cfg.color }}>{count}</div>
            </div>
          )
        })}
      </div>

      {/* List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: S.muted }}>⏳ جاري التحميل...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, background: S.navy2, borderRadius: 16, border: `1px solid ${S.border}` }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
          <div style={{ color: S.muted }}>لا توجد تقارير جرد</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filtered.map(c => {
            const cfg = STATUS_CFG[c.status]
            const items = c.inventory_count_items || []
            const deficitItems = items.filter(i => i.difference < 0)
            const surplusItems = items.filter(i => i.difference > 0)
            return (
              <div key={c.id}
                onClick={() => setSelected(c)}
                style={{ background: S.navy2, borderRadius: 16, border: `1px solid ${c.status === 'pending' ? S.amber + '40' : S.border}`, padding: '18px 20px', cursor: 'pointer', transition: 'all .2s' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.border = `1px solid ${cfg.color}60`}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.border = `1px solid ${c.status === 'pending' ? S.amber + '40' : S.border}`}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                      <span style={{ background: cfg.bg, color: cfg.color, borderRadius: 20, padding: '3px 12px', fontSize: 11, fontWeight: 700 }}>{cfg.icon} {cfg.label}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: S.white }}>{(c.warehouses as any)?.name || '—'}</span>
                      {isAdmin && !activeBranch && (
                        <span style={{ background: S.blueB, color: S.blue, borderRadius: 20, padding: '3px 10px', fontSize: 10, fontWeight: 700 }}>
                          {allTabs.find(t => t.key === countBranchKey(c))?.label || '—'}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: S.muted }}>
                      👤 {getFullName(c.employees as any)} · 📅 {new Date(c.count_date).toLocaleDateString('ar-SA')}
                    </div>
                    {c.approved_at && <div style={{ fontSize: 11, color: S.green, marginTop: 4 }}>✅ اعتمد بواسطة: {getFullName(c.approver as any)} · {new Date(c.approved_at).toLocaleDateString('ar-SA')}</div>}
                  </div>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 18, fontWeight: 800, color: S.white }}>{items.length}</div>
                      <div style={{ fontSize: 10, color: S.muted }}>صنف</div>
                    </div>
                    {deficitItems.length > 0 && (
                      <div style={{ textAlign: 'center', background: S.redB, borderRadius: 10, padding: '6px 12px' }}>
                        <div style={{ fontSize: 18, fontWeight: 800, color: S.red }}>{deficitItems.length}</div>
                        <div style={{ fontSize: 10, color: S.red }}>عجز</div>
                      </div>
                    )}
                    {surplusItems.length > 0 && (
                      <div style={{ textAlign: 'center', background: S.greenB, borderRadius: 10, padding: '6px 12px' }}>
                        <div style={{ fontSize: 18, fontWeight: 800, color: S.green }}>{surplusItems.length}</div>
                        <div style={{ fontSize: 10, color: S.green }}>زيادة</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Detail Modal */}
      {selected && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: S.navy2, borderRadius: 20, border: `1px solid ${S.border}`, width: '100%', maxWidth: 760, maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}>
            {/* Modal Header */}
            <div style={{ padding: '20px 24px', borderBottom: `1px solid ${S.border}`, flexShrink: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h2 style={{ fontSize: 17, fontWeight: 800, color: S.white, marginBottom: 4 }}>📋 تفاصيل الجرد — {(selected.warehouses as any)?.name}</h2>
                  <div style={{ fontSize: 12, color: S.muted }}>
                    👤 {getFullName(selected.employees as any)} · 📅 {new Date(selected.count_date).toLocaleDateString('ar-SA')} · {selected.inventory_count_items?.length} صنف
                  </div>
                </div>
                <button onClick={() => setSelected(null)} style={{ background: 'transparent', border: 'none', color: S.muted, fontSize: 22, cursor: 'pointer' }}>✕</button>
              </div>
            </div>

            {/* Items Table */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
              {/* Summary */}
              {(() => {
                const items = selected.inventory_count_items || []
                const deficit = items.filter(i => i.difference < 0)
                const surplus = items.filter(i => i.difference > 0)
                const match = items.filter(i => i.difference === 0)
                return (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 16 }}>
                    <div style={{ background: S.greenB, border: `1px solid ${S.green}40`, borderRadius: 12, padding: '12px 16px', textAlign: 'center' }}>
                      <div style={{ fontSize: 22, fontWeight: 800, color: S.green }}>{match.length}</div>
                      <div style={{ fontSize: 11, color: S.muted }}>✅ مطابق</div>
                    </div>
                    <div style={{ background: S.redB, border: `1px solid ${S.red}40`, borderRadius: 12, padding: '12px 16px', textAlign: 'center' }}>
                      <div style={{ fontSize: 22, fontWeight: 800, color: S.red }}>{deficit.length}</div>
                      <div style={{ fontSize: 11, color: S.muted }}>📉 عجز</div>
                    </div>
                    <div style={{ background: S.amberB, border: `1px solid ${S.amber}40`, borderRadius: 12, padding: '12px 16px', textAlign: 'center' }}>
                      <div style={{ fontSize: 22, fontWeight: 800, color: S.amber }}>{surplus.length}</div>
                      <div style={{ fontSize: 11, color: S.muted }}>📈 زيادة</div>
                    </div>
                  </div>
                )
              })()}

              {/* Table */}
              <div style={{ background: S.navy3, borderRadius: 12, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${S.border}` }}>
                      {['الصنف', 'النظام', 'الفعلي', 'الفرق', 'الحالة'].map(h => (
                        <th key={h} style={{ padding: '10px 14px', textAlign: 'right', fontSize: 11, color: S.muted, fontWeight: 700 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(selected.inventory_count_items || []).map(item => {
                      const diff = item.difference
                      const diffColor = diff < 0 ? S.red : diff > 0 ? S.green : S.muted
                      const isDeficit = diff < 0
                      return (
                        <tr key={item.id} style={{ borderBottom: `1px solid ${S.border}`, background: isDeficit ? 'rgba(239,68,68,0.04)' : 'transparent' }}>
                          <td style={{ padding: '10px 14px' }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: S.white }}>{item.warehouse_products?.name}</div>
                            {item.warehouse_products?.name_en && <div style={{ fontSize: 10, color: S.muted }}>{item.warehouse_products.name_en}</div>}
                          </td>
                          <td style={{ padding: '10px 14px', fontSize: 13, color: S.muted }}>{formatStockDisplay(item.product_id, item.system_stock, item.units?.symbol || '')}</td>
                          <td style={{ padding: '10px 14px', fontSize: 13, fontWeight: 700, color: S.white }}>
                            {isEditing ? (
                              <input type="number" min="0"
                                value={editingItems[item.id] ?? item.actual_stock}
                                onChange={e => setEditingItems(prev => ({ ...prev, [item.id]: parseFloat(e.target.value) || 0 }))}
                                style={{ background: 'rgba(255,255,255,0.08)', border: `1px solid ${S.amber}`, borderRadius: 6, padding: '4px 8px', fontSize: 12, color: S.white, outline: 'none', width: 80, textAlign: 'center' }}
                              />
                            ) : formatStockDisplay(item.product_id, item.actual_stock, item.units?.symbol || '')}
                          </td>
                          <td style={{ padding: '10px 14px', fontSize: 13, fontWeight: 700, color: diffColor }}>
                            {diff !== 0 && (diff > 0 ? '+' : '−')}{formatStockDisplay(item.product_id, Math.abs(diff), item.units?.symbol || '')}
                          </td>
                          <td style={{ padding: '10px 14px' }}>
                            <span style={{ background: diff < 0 ? S.redB : diff > 0 ? S.greenB : S.card, color: diff < 0 ? S.red : diff > 0 ? S.green : S.muted, borderRadius: 20, padding: '3px 10px', fontSize: 10, fontWeight: 700 }}>
                              {diff < 0 ? '📉 عجز' : diff > 0 ? '📈 زيادة' : '✅ مطابق'}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Footer Actions */}
            <div style={{ padding: '16px 24px', borderTop: `1px solid ${S.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0, flexWrap: 'wrap', gap: 10 }}>
              <div style={{ fontSize: 12, color: S.muted }}>
                {selected.status === 'pending' ? '⏳ في انتظار الاعتماد' :
                 selected.status === 'approved' ? `✅ معتمد · ${new Date(selected.approved_at!).toLocaleDateString('ar-SA')}` :
                 '❌ مرفوض'}
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button onClick={() => printReport(selected)} style={{ padding: '10px 18px', borderRadius: 10, border: `1px solid ${S.blue}`, background: S.blueB, color: S.blue, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>🖨️ طباعة PDF</button>
                {canApprove && selected.status === 'pending' && !isEditing && (
                  <button onClick={() => {
                    const init: Record<string, number> = {}
                    selected.inventory_count_items?.forEach(i => { init[i.id] = i.actual_stock })
                    setEditingItems(init)
                    setIsEditing(true)
                  }} style={{ padding: '10px 18px', borderRadius: 10, border: `1px solid ${S.amber}`, background: S.amberB, color: S.amber, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>✏️ تعديل</button>
                )}
                {isEditing && (
                  <>
                    <button onClick={() => { setIsEditing(false); setEditingItems({}) }} style={{ padding: '10px 18px', borderRadius: 10, border: `1px solid ${S.muted}`, background: 'transparent', color: S.muted, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif' }}>إلغاء</button>
                    <button onClick={saveEdits} style={{ padding: '10px 18px', borderRadius: 10, border: `1px solid ${S.amber}`, background: S.amberB, color: S.amber, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>💾 حفظ التعديلات</button>
                  </>
                )}
                <button onClick={() => { setSelected(null); setIsEditing(false); setEditingItems({}) }} style={{ padding: '10px 18px', borderRadius: 10, border: `1px solid ${S.border}`, background: 'transparent', color: S.muted, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif' }}>إغلاق</button>
                {canApprove && selected.status === 'pending' && !isEditing && (
                  <>
                    <button onClick={() => rejectCount(selected.id)} style={{ padding: '10px 18px', borderRadius: 10, border: `1px solid ${S.red}`, background: S.redB, color: S.red, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>❌ رفض</button>
                    <button onClick={() => approveCount(selected.id)} disabled={approving} style={{ padding: '10px 24px', borderRadius: 10, border: `1px solid ${S.green}`, background: S.greenB, color: S.green, cursor: approving ? 'not-allowed' : 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
                      {approving ? '⏳ جاري الاعتماد...' : '✅ اعتماد وتحديث المخزون'}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
