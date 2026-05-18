'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'

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
  blue: '#3B82F6', blueB: 'rgba(59,130,246,0.12)',
  amber: '#F59E0B', amberB: 'rgba(245,158,11,0.12)',
  card: 'rgba(255,255,255,0.04)', card2: 'rgba(255,255,255,0.08)',
  purple: '#8B5CF6', purpleB: 'rgba(139,92,246,0.12)',
}

interface Warehouse {
  id: string
  name: string
  description: string
  location: string
  is_main: boolean
  is_active: boolean
  created_at: string
  product_count?: number
  low_stock_count?: number
}

function AddWarehouseModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const supabase = createClient()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ name: '', description: '', location: '', is_main: false })

  async function save() {
    if (!form.name) { alert('يرجى إدخال اسم المستودع'); return }
    setSaving(true)
    const { error } = await supabase.from('warehouses').insert([form])
    setSaving(false)
    if (error) { alert('خطأ: ' + error.message); return }
    onSaved()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: S.navy2, borderRadius: 18, border: `1px solid ${S.border}`, width: '100%', maxWidth: 460, padding: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
          <h3 style={{ color: S.white, fontSize: 16, fontWeight: 700 }}>🏭 إضافة مستودع جديد</h3>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: S.muted, fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>اسم المستودع *</label>
            <input
              style={{ width: '100%', background: S.card2, border: `1px solid ${S.border}`, borderRadius: 10, padding: '10px 14px', fontSize: 13, color: S.white, outline: 'none', fontFamily: 'Tajawal, sans-serif', direction: 'rtl' }}
              value={form.name}
              onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              placeholder="مثال: مستودع المشروبات"
            />
          </div>
          <div>
            <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>الوصف</label>
            <input
              style={{ width: '100%', background: S.card2, border: `1px solid ${S.border}`, borderRadius: 10, padding: '10px 14px', fontSize: 13, color: S.white, outline: 'none', fontFamily: 'Tajawal, sans-serif', direction: 'rtl' }}
              value={form.description}
              onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              placeholder="وصف مختصر للمستودع"
            />
          </div>
          <div>
            <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>الموقع / العنوان</label>
            <input
              style={{ width: '100%', background: S.card2, border: `1px solid ${S.border}`, borderRadius: 10, padding: '10px 14px', fontSize: 13, color: S.white, outline: 'none', fontFamily: 'Tajawal, sans-serif', direction: 'rtl' }}
              value={form.location}
              onChange={e => setForm(p => ({ ...p, location: e.target.value }))}
              placeholder="مثال: الدور الأول، المطبخ الرئيسي"
            />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '10px 14px', background: S.card, borderRadius: 10 }}>
            <input
              type="checkbox"
              checked={form.is_main}
              onChange={e => setForm(p => ({ ...p, is_main: e.target.checked }))}
              style={{ width: 16, height: 16, accentColor: S.gold }}
            />
            <div>
              <div style={{ fontSize: 13, color: S.white, fontWeight: 600 }}>مستودع رئيسي</div>
              <div style={{ fontSize: 11, color: S.muted }}>يغذي باقي المستودعات</div>
            </div>
          </label>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 22, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '9px 18px', borderRadius: 10, border: `1px solid ${S.muted}`, background: 'transparent', color: S.muted, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif' }}>إلغاء</button>
          <button onClick={save} disabled={saving} style={{ padding: '9px 18px', borderRadius: 10, border: `1px solid ${S.gold}`, background: S.gold3, color: S.gold, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
            {saving ? '⏳ جاري الحفظ...' : '💾 حفظ المستودع'}
          </button>
        </div>
      </div>
    </div>
  )
}


// ══ دالة طباعة تقرير المخزون ══
async function printInventoryReport(supabase: any) {
  const { data: products } = await supabase
    .from('warehouse_products')
    .select('name, name_en, category, current_stock, min_stock, last_purchase_price, units(symbol)')
    .eq('is_active', true)
    .order('category')
    .order('name')

  if (!products || products.length === 0) { alert('لا توجد منتجات'); return }

  const grouped: Record<string, any[]> = {}
  products.forEach((p: any) => {
    const cat = p.category || 'غير مصنف'
    if (!grouped[cat]) grouped[cat] = []
    grouped[cat].push(p)
  })

  const now = new Date().toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' })
  const lowStock = products.filter((p: any) => p.current_stock <= p.min_stock && p.min_stock > 0).length

  const rows = Object.entries(grouped).map(([category, items]) => `
    <tr><td colspan="6" style="padding:10px 14px;font-weight:800;font-size:13px;color:#8B6914;background:#f5e6c0;border-bottom:2px solid #C9A84C">📦 ${category} (${items.length} صنف)</td></tr>
    ${(items as any[]).map((p: any, i: number) => {
      const unit = p.units?.symbol || ''
      const low = p.current_stock <= p.min_stock && p.min_stock > 0
      return `<tr style="background:${i%2===0?'#fff':'#f9f9f9'}">
        <td style="padding:6px 12px;font-weight:600">${p.name}</td>
        <td style="padding:6px 12px;color:#666;font-style:italic;direction:ltr;text-align:left">${p.name_en||''}</td>
        <td style="padding:6px 12px;text-align:center">${unit}</td>
        <td style="padding:6px 12px;text-align:center;font-weight:700;color:${low?'#dc2626':'#16a34a'}">${p.current_stock??0}</td>
        <td style="padding:6px 12px;text-align:center;color:#666">${p.min_stock??0}</td>
        <td style="padding:6px 12px;text-align:center;color:#92400e">${p.last_purchase_price?'MYR '+p.last_purchase_price:'—'}</td>
      </tr>`
    }).join('')}
  `).join('')

  const html = `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8">
    <title>تقرير المخزون — Orchid House</title>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700;800&display=swap');
      body{font-family:'Tajawal',Arial,sans-serif;margin:20px;direction:rtl;color:#1a1a1a}
      .header{text-align:center;padding:20px;background:#0F2040;border-radius:8px;margin-bottom:16px;color:white}
      .logo{font-size:28px;margin-bottom:6px}
      h1{color:#C9A84C;font-size:20px;margin:0 0 4px}
      .date{color:#8A9BB5;font-size:12px}
      .stats{display:flex;gap:12px;margin-bottom:16px;justify-content:center}
      .stat{border:1px solid #ddd;border-radius:8px;padding:10px 20px;text-align:center}
      .sv{font-size:20px;font-weight:800;color:#C9A84C}
      .sl{font-size:11px;color:#666;margin-top:2px}
      table{width:100%;border-collapse:collapse;font-size:12px}
      th{background:#0F2040;color:white;padding:8px 12px;text-align:center;font-size:11px}
      th:first-child{text-align:right}
      td{border-bottom:1px solid #eee;font-size:12px}
      .footer{text-align:center;color:#999;font-size:10px;margin-top:16px}
      @media print{button{display:none}}
    </style>
    </head><body>
    <div class="header"><div class="logo">🌸</div><h1>Orchid House — تقرير المخزون</h1><div class="date">${now}</div></div>
    <div class="stats">
      <div class="stat"><div class="sv">${products.length}</div><div class="sl">إجمالي الأصناف</div></div>
      <div class="stat"><div class="sv">${Object.keys(grouped).length}</div><div class="sl">الأقسام</div></div>
      <div class="stat"><div class="sv" style="color:${lowStock>0?'#dc2626':'#16a34a'}">${lowStock}</div><div class="sl">مخزون منخفض</div></div>
    </div>
    <table><thead><tr>
      <th style="text-align:right">الصنف</th><th>Item Name</th><th>الوحدة</th><th>المخزون</th><th>الحد الأدنى</th><th>سعر الشراء</th>
    </tr></thead><tbody>${rows}</tbody></table>
    <div class="footer">🌸 Orchid Group Restaurant Management System — ${now}</div>
    </body></html>`

  const win = window.open('','_blank')
  if (win) { win.document.write(html); win.document.close(); setTimeout(()=>win.print(),500) }
}

export default function WarehousesPage() {
  const router = useRouter()
  const supabase = createClient()
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)

  async function fetchWarehouses() {
    setLoading(true)
    const { data } = await supabase
      .from('warehouses')
      .select('*')
      .eq('is_active', true)
      .order('is_main', { ascending: false })
      .order('created_at')
    
    if (data) {
      const withCounts = await Promise.all(data.map(async (w) => {
        const { count: productCount } = await supabase
          .from('warehouse_products')
          .select('*', { count: 'exact', head: true })
          .eq('is_active', true)
        
        const { data: products } = await supabase
          .from('warehouse_products')
          .select('current_stock, min_stock')
          .eq('is_active', true)
        
        const lowStock = (products || []).filter(p => p.current_stock <= p.min_stock && p.min_stock > 0).length

        return { ...w, product_count: productCount || 0, low_stock_count: lowStock }
      }))
      setWarehouses(withCounts)
    }
    setLoading(false)
  }

  useEffect(() => { fetchWarehouses() }, [])

  const mainWarehouse = warehouses.find(w => w.is_main)
  const subWarehouses = warehouses.filter(w => !w.is_main)

  return (
    <div style={{ fontFamily: 'Tajawal, sans-serif', direction: 'rtl', color: S.white }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&display=swap');`}</style>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: S.white, marginBottom: 4 }}>🏭 المستودعات</h1>
          <p style={{ fontSize: 13, color: S.muted }}>إدارة جميع المستودعات — اضغط على أي مستودع للدخول إليه</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={() => printInventoryReport(supabase)}
            style={{ padding: '10px 20px', borderRadius: 12, border: `1px solid #3B82F6`, background: 'rgba(59,130,246,0.12)', color: '#3B82F6', cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}
          >
            🖨️ طباعة تقرير المخزون
          </button>
          <button
            onClick={() => setShowAdd(true)}
            style={{ padding: '10px 20px', borderRadius: 12, border: `1px solid ${S.gold}`, background: S.gold3, color: S.gold, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}
          >
            ➕ مستودع جديد
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: S.muted }}>⏳ جاري التحميل...</div>
      ) : (
        <>
          {/* المستودع الرئيسي */}
          {mainWarehouse && (
            <div style={{ marginBottom: 28 }}>
              <div style={{ fontSize: 12, color: S.gold, fontWeight: 700, marginBottom: 12, letterSpacing: 1 }}>المستودع الرئيسي</div>
              <div
                onClick={() => router.push(`/dashboard/warehouse/${mainWarehouse.id}`)}
                style={{
                  background: `linear-gradient(135deg, rgba(201,168,76,0.08), rgba(201,168,76,0.03))`,
                  border: `1px solid rgba(201,168,76,0.3)`,
                  borderRadius: 18, padding: 24, cursor: 'pointer',
                  transition: 'all .2s', position: 'relative', overflow: 'hidden',
                }}
                onMouseEnter={e => (e.currentTarget.style.border = `1px solid ${S.gold}`)}
                onMouseLeave={e => (e.currentTarget.style.border = `1px solid rgba(201,168,76,0.3)`)}
              >
                <div style={{ position: 'absolute', top: -20, left: -20, fontSize: 80, opacity: 0.05 }}>🏭</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                      <span style={{ fontSize: 24 }}>🏭</span>
                      <h2 style={{ fontSize: 20, fontWeight: 800, color: S.gold }}>{mainWarehouse.name}</h2>
                      <span style={{ background: S.gold3, border: `1px solid ${S.gold}`, color: S.gold, borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 700 }}>رئيسي</span>
                    </div>
                    {mainWarehouse.description && <p style={{ fontSize: 13, color: S.muted, marginBottom: 4 }}>{mainWarehouse.description}</p>}
                    {mainWarehouse.location && <p style={{ fontSize: 12, color: S.muted }}>📍 {mainWarehouse.location}</p>}
                  </div>
                  <div style={{ display: 'flex', gap: 16 }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 24, fontWeight: 800, color: S.white }}>{mainWarehouse.product_count}</div>
                      <div style={{ fontSize: 11, color: S.muted }}>صنف</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 24, fontWeight: 800, color: mainWarehouse.low_stock_count! > 0 ? S.amber : S.green }}>{mainWarehouse.low_stock_count}</div>
                      <div style={{ fontSize: 11, color: S.muted }}>منخفض</div>
                    </div>
                  </div>
                </div>
                <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 6, color: S.gold, fontSize: 12 }}>
                  <span>يغذي {subWarehouses.length} مستودع فرعي</span>
                  <span>←</span>
                </div>
              </div>
            </div>
          )}

          {/* المستودعات الفرعية */}
          {subWarehouses.length > 0 && (
            <div>
              <div style={{ fontSize: 12, color: S.muted, fontWeight: 700, marginBottom: 12, letterSpacing: 1 }}>المستودعات الفرعية</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
                {subWarehouses.map(w => (
                  <div
                    key={w.id}
                    onClick={() => router.push(`/dashboard/warehouse/${w.id}`)}
                    style={{
                      background: S.card2, border: `1px solid ${S.border}`,
                      borderRadius: 16, padding: 20, cursor: 'pointer',
                      transition: 'all .2s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.border = `1px solid ${S.blue}`; e.currentTarget.style.background = S.blueB }}
                    onMouseLeave={e => { e.currentTarget.style.border = `1px solid ${S.border}`; e.currentTarget.style.background = S.card2 }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                      <div style={{ fontSize: 28 }}>🗄️</div>
                      <span style={{
                        background: w.low_stock_count! > 0 ? S.amberB : S.greenB,
                        color: w.low_stock_count! > 0 ? S.amber : S.green,
                        borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 700
                      }}>
                        {w.low_stock_count! > 0 ? `⚠️ ${w.low_stock_count} منخفض` : '✅ كافي'}
                      </span>
                    </div>
                    <h3 style={{ fontSize: 16, fontWeight: 700, color: S.white, marginBottom: 4 }}>{w.name}</h3>
                    {w.description && <p style={{ fontSize: 12, color: S.muted, marginBottom: 8 }}>{w.description}</p>}
                    {w.location && <p style={{ fontSize: 11, color: S.muted, marginBottom: 12 }}>📍 {w.location}</p>}
                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 12, borderTop: `1px solid ${S.border}` }}>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 18, fontWeight: 700, color: S.white }}>{w.product_count}</div>
                        <div style={{ fontSize: 11, color: S.muted }}>صنف</div>
                      </div>
                      <div style={{ fontSize: 20, color: S.muted }}>←</div>
                    </div>
                  </div>
                ))}

                {/* كارد إضافة مستودع */}
                <div
                  onClick={() => setShowAdd(true)}
                  style={{
                    background: 'transparent', border: `2px dashed ${S.border}`,
                    borderRadius: 16, padding: 20, cursor: 'pointer',
                    transition: 'all .2s', display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center', minHeight: 160, gap: 10,
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = S.gold; e.currentTarget.style.background = S.gold3 }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = S.border; e.currentTarget.style.background = 'transparent' }}
                >
                  <div style={{ fontSize: 28, color: S.muted }}>➕</div>
                  <div style={{ fontSize: 13, color: S.muted, fontWeight: 600 }}>إضافة مستودع جديد</div>
                </div>
              </div>
            </div>
          )}

          {/* لو مفيش مستودعات */}
          {warehouses.length === 0 && (
            <div style={{ textAlign: 'center', padding: 60 }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>🏭</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: S.white, marginBottom: 8 }}>لا توجد مستودعات بعد</div>
              <div style={{ fontSize: 13, color: S.muted, marginBottom: 24 }}>ابدأ بإضافة المستودع الرئيسي</div>
              <button
                onClick={() => setShowAdd(true)}
                style={{ padding: '12px 24px', borderRadius: 12, border: `1px solid ${S.gold}`, background: S.gold3, color: S.gold, cursor: 'pointer', fontSize: 14, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}
              >
                ➕ إضافة مستودع
              </button>
            </div>
          )}
        </>
      )}

      {showAdd && <AddWarehouseModal onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); fetchWarehouses() }} />}
    </div>
  )
}
