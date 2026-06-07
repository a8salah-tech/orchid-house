'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLang } from '../../components/LanguageContext'
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
  name_en?: string 
  description: string
  location: string
  is_main: boolean
  is_default: boolean
  is_active: boolean
  created_at: string
  product_count?: number
  low_stock_count?: number
}

function AddWarehouseModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const supabase = createClient()
  const { isAr } = useLang()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ name: '', description: '', location: '', is_main: false })

  async function save() {
    if (!form.name) { alert(isAr ? 'يرجى إدخال اسم المستودع' : 'Please enter warehouse name'); return }
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
          <h3 style={{ color: S.white, fontSize: 16, fontWeight: 700 }}>{isAr ? '🏭 إضافة مستودع جديد' : '🏭 Add New Warehouse'}</h3>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: S.muted, fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>{isAr ? 'اسم المستودع *' : 'Warehouse Name *'}</label>
            <input
              style={{ width: '100%', background: S.card2, border: `1px solid ${S.border}`, borderRadius: 10, padding: '10px 14px', fontSize: 13, color: S.white, outline: 'none', fontFamily: 'Tajawal, sans-serif', direction: isAr ? 'rtl' : 'ltr' }}
              value={form.name}
              onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              placeholder="مثال: مستودع المشروبات"
            />
          </div>
          <div>
            <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>الوصف</label>
            <input
              style={{ width: '100%', background: S.card2, border: `1px solid ${S.border}`, borderRadius: 10, padding: '10px 14px', fontSize: 13, color: S.white, outline: 'none', fontFamily: 'Tajawal, sans-serif', direction: isAr ? 'rtl' : 'ltr' }}
              value={form.description}
              onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              placeholder="وصف مختصر للمستودع"
            />
          </div>
          <div>
            <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>الموقع / العنوان</label>
            <input
              style={{ width: '100%', background: S.card2, border: `1px solid ${S.border}`, borderRadius: 10, padding: '10px 14px', fontSize: 13, color: S.white, outline: 'none', fontFamily: 'Tajawal, sans-serif', direction: isAr ? 'rtl' : 'ltr' }}
              value={form.location}
              onChange={e => setForm(p => ({ ...p, location: e.target.value }))}
              placeholder={isAr ? "مثال: الدور الأول، المطبخ الرئيسي" : "e.g. Ground Floor, Main Kitchen"}
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
              <div style={{ fontSize: 13, color: S.white, fontWeight: 600 }}>{isAr ? 'مستودع رئيسي' : 'Main Warehouse'}</div>
              <div style={{ fontSize: 11, color: S.muted }}>{isAr ? 'يغذي باقي المستودعات' : 'Supplies other warehouses'}</div>
            </div>
          </label>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 22, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '9px 18px', borderRadius: 10, border: `1px solid ${S.muted}`, background: 'transparent', color: S.muted, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif' }}>{isAr ? 'إلغاء' : 'Cancel'}</button>
          <button onClick={save} disabled={saving} style={{ padding: '9px 18px', borderRadius: 10, border: `1px solid ${S.gold}`, background: S.gold3, color: S.gold, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
            {saving ? (isAr ? '⏳ جاري الحفظ...' : '⏳ Saving...') : (isAr ? '💾 حفظ المستودع' : '💾 Save')}
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

  if (!products || products.length === 0) { alert('No products found'); return }

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

// ══ Add Unit Modal ══
function AddUnitModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const supabase = createClient()
  const { isAr } = useLang()
  const [saving, setSaving] = useState(false)
  const [units, setUnits] = useState<{id:string;name:string;symbol:string}[]>([])
  const [form, setForm] = useState({ name: '', symbol: '' })
  const [err, setErr] = useState('')

  useEffect(() => {
    supabase.from('units').select('id,name,symbol').order('name').then(({ data }) => setUnits(data || []))
  }, [])

  async function save() {
    if (!form.name || !form.symbol) { setErr('يرجى إدخال الاسم والرمز'); return }
    if (units.find(u => u.name === form.name.trim())) { setErr('هذه الوحدة موجودة بالفعل'); return }
    setSaving(true); setErr('')
    const { error } = await supabase.from('units').insert([{ name: form.name.trim(), symbol: form.symbol.trim() }])
    setSaving(false)
    if (error) { setErr('خطأ: ' + error.message); return }
    setForm({ name: '', symbol: '' })
    supabase.from('units').select('id,name,symbol').order('name').then(({ data }) => setUnits(data || []))
  }

  async function del(id: string) {
    if (!confirm('حذف هذه الوحدة؟')) return
    await supabase.from('units').delete().eq('id', id)
    supabase.from('units').select('id,name,symbol').order('name').then(({ data }) => setUnits(data || []))
  }

  const inp2: React.CSSProperties = { width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#FAFAF8', outline: 'none', fontFamily: 'Tajawal, sans-serif', boxSizing: 'border-box', direction: isAr ? 'rtl' : 'ltr' }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 400, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 20, overflowY: 'auto' }}>
      <div style={{ background: '#0F2040', borderRadius: 18, border: '1px solid rgba(255,255,255,0.08)', width: '100%', maxWidth: 460, padding: 28, margin: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ color: '#14B8A6', fontSize: 16, fontWeight: 700 }}>{isAr ? '📦 إدارة الوحدات' : '📦 Manage Units'}</h3>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#8A9BB5', fontSize: 22, cursor: 'pointer' }}>✕</button>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: 16, marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#FAFAF8', marginBottom: 12 }}>➕ إضافة وحدة جديدة</div>
          {err && <div style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid #EF4444', borderRadius: 8, padding: '8px 12px', marginBottom: 12, fontSize: 12, color: '#EF4444' }}>{err}</div>}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto', gap: 8, alignItems: 'flex-end' }}>
            <div>
              <label style={{ fontSize: 11, color: '#8A9BB5', display: 'block', marginBottom: 4 }}>اسم الوحدة *</label>
              <input style={inp2} value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="مثال: كرتون" />
            </div>
            <div>
              <label style={{ fontSize: 11, color: '#8A9BB5', display: 'block', marginBottom: 4 }}>الرمز *</label>
              <input style={inp2} value={form.symbol} onChange={e => setForm(p => ({ ...p, symbol: e.target.value }))} placeholder="كرتون" />
            </div>
            <button onClick={save} disabled={saving} style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid #14B8A6', background: 'rgba(20,184,166,0.12)', color: '#14B8A6', cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
              {saving ? '⏳' : '💾'}
            </button>
          </div>
        </div>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#FAFAF8', marginBottom: 10 }}>{isAr ? `📋 الوحدات (${units.length})` : `📋 Units (${units.length})`}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 280, overflowY: 'auto' }}>
          {units.map(u => (
            <div key={u.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: '8px 14px' }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#FAFAF8' }}>{u.name} <span style={{ fontSize: 11, color: '#8A9BB5' }}>({u.symbol})</span></span>
              <button onClick={() => del(u.id)} style={{ padding: '4px 10px', borderRadius: 8, border: '1px solid #EF4444', background: 'rgba(239,68,68,0.12)', color: '#EF4444', cursor: 'pointer', fontSize: 12 }}>🗑️</button>
            </div>
          ))}
        </div>
        <button onClick={onClose} style={{ width: '100%', marginTop: 16, padding: '10px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)', background: 'transparent', color: '#8A9BB5', cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif' }}>إغلاق</button>
      </div>
    </div>
  )
}

export default function WarehousesPage() {
  const { isAr } = useLang()
  const router = useRouter()
  const supabase = createClient()
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [showAddUnit, setShowAddUnit] = useState(false)

  async function fetchWarehouses() {
    setLoading(true)
    const { data } = await supabase
      .from('warehouses')
      .select('*')
      .eq('is_active', true)
      .order('created_at')
    
    if (data) {
      const withCounts = await Promise.all(data.map(async (w) => {
        if (w.is_default) {
          // المستودع الافتراضي يجيب مجموع كل المستودعات
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
        }
        // باقي المستودعات بتجيب منتجاتها فقط
        const { count: productCount } = await supabase
          .from('warehouse_products')
          .select('*', { count: 'exact', head: true })
          .eq('warehouse_id', w.id)
          .eq('is_active', true)
        const { data: products } = await supabase
          .from('warehouse_products')
          .select('current_stock, min_stock')
          .eq('warehouse_id', w.id)
          .eq('is_active', true)
        const lowStock = (products || []).filter(p => p.current_stock <= p.min_stock && p.min_stock > 0).length
        return { ...w, product_count: productCount || 0, low_stock_count: lowStock }
      }))
      setWarehouses(withCounts)
    }
    setLoading(false)
  }

  useEffect(() => { fetchWarehouses() }, [])

  const defaultWarehouse = warehouses.find(w => w.is_default)
  const mainWarehouse = warehouses.find(w => w.is_main && !w.is_default)
  const subWarehouses = warehouses.filter(w => !w.is_main && !w.is_default)

  return (
    <div style={{ fontFamily: 'Tajawal, sans-serif', direction: isAr ? 'rtl' : 'ltr', color: S.white }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&display=swap');`}</style>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: S.white, marginBottom: 4 }}>{isAr ? '🏭 المستودعات' : '🏭 Warehouses'}</h1>
          <p style={{ fontSize: 13, color: S.muted }}>{isAr ? 'إدارة جميع المستودعات — اضغط على أي مستودع للدخول إليه' : 'Manage all warehouses — click any to enter'}</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={() => printInventoryReport(supabase)}
            style={{ padding: '10px 20px', borderRadius: 12, border: `1px solid #3B82F6`, background: 'rgba(59,130,246,0.12)', color: '#3B82F6', cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}
          >
            {isAr ? '🖨️ طباعة تقرير المخزون' : '🖨️ Print Report'}
          </button>
          <button
            onClick={() => setShowAddUnit(true)}
            style={{ padding: '10px 16px', borderRadius: 12, border: '1px solid #14B8A6', background: 'rgba(20,184,166,0.12)', color: '#14B8A6', cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}
          >
            {isAr ? '📦 وحدات' : '📦 Units'}
          </button>
          <button
            onClick={() => setShowAdd(true)}
            style={{ padding: '10px 20px', borderRadius: 12, border: `1px solid ${S.gold}`, background: S.gold3, color: S.gold, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}
          >
            {isAr ? '➕ مستودع جديد' : '➕ New Warehouse'}
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: S.muted }}>⏳ جاري التحميل...</div>
      ) : (
        <>
          {/* المستودع الافتراضي */}
          {defaultWarehouse && (
            <div style={{ marginBottom: 28 }}>
              <div style={{ fontSize: 12, color: S.purple, fontWeight: 700, marginBottom: 12, letterSpacing: 1 }}>{isAr ? '🗃️ المستودع الافتراضي' : '🗃️ Default Warehouse'}</div>
              <div
                onClick={() => router.push(`/dashboard/warehouse/${defaultWarehouse.id}`)}
                style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.08), rgba(139,92,246,0.03))', border: '1px solid rgba(139,92,246,0.3)', borderRadius: 18, padding: 24, cursor: 'pointer', transition: 'all .2s', position: 'relative', overflow: 'hidden' }}
                onMouseEnter={e => (e.currentTarget.style.border = `1px solid ${S.purple}`)}
                onMouseLeave={e => (e.currentTarget.style.border = '1px solid rgba(139,92,246,0.3)')}
              >
                <div style={{ position: 'absolute', top: -20, left: -20, fontSize: 80, opacity: 0.05 }}>🗃️</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                      <span style={{ fontSize: 24 }}>🗃️</span>
                      <h2 style={{ fontSize: 20, fontWeight: 800, color: S.purple }}>{isAr ? defaultWarehouse.name : (defaultWarehouse.name_en || defaultWarehouse.name)}</h2>
                      <span style={{ background: S.purpleB, border: `1px solid ${S.purple}`, color: S.purple, borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 700 }}>{isAr ? 'افتراضي' : 'Default'}</span>
                    </div>
                    {defaultWarehouse.description && <p style={{ fontSize: 13, color: S.muted, marginBottom: 4 }}>{defaultWarehouse.description}</p>}
                    {defaultWarehouse.location && <p style={{ fontSize: 12, color: S.muted }}>📍 {defaultWarehouse.location}</p>}
                    <p style={{ fontSize: 12, color: S.muted, marginTop: 4 }}>{isAr ? 'يحتوي على جميع بيانات المستودعات' : 'Contains all warehouse data and records'}</p>
                  </div>
                  <div style={{ display: 'flex', gap: 16 }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 24, fontWeight: 800, color: S.white }}>{defaultWarehouse.product_count}</div>
                      <div style={{ fontSize: 11, color: S.muted }}>{isAr ? 'صنف' : 'Items'}</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 24, fontWeight: 800, color: defaultWarehouse.low_stock_count! > 0 ? S.amber : S.green }}>{defaultWarehouse.low_stock_count}</div>
                      <div style={{ fontSize: 11, color: S.muted }}>{isAr ? 'منخفض' : 'Low'}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* المستودع الرئيسي */}
          {mainWarehouse && (
            <div style={{ marginBottom: 28 }}>
              <div style={{ fontSize: 12, color: S.gold, fontWeight: 700, marginBottom: 12, letterSpacing: 1 }}>{isAr ? 'المستودع الرئيسي' : 'Main Warehouse'}</div>
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
                      <h2 style={{ fontSize: 20, fontWeight: 800, color: S.gold }}> {isAr ? mainWarehouse.name : (mainWarehouse.name_en || mainWarehouse.name)} </h2>
                      <span style={{ background: S.gold3, border: `1px solid ${S.gold}`, color: S.gold, borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 700 }}>{isAr ? 'رئيسي' : 'Main'}</span>
                    </div>
                    {mainWarehouse.description && <p style={{ fontSize: 13, color: S.muted, marginBottom: 4 }}>{mainWarehouse.description}</p>}
                    {mainWarehouse.location && <p style={{ fontSize: 12, color: S.muted }}>📍 {mainWarehouse.location}</p>}
                  </div>
                  <div style={{ display: 'flex', gap: 16 }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 24, fontWeight: 800, color: S.white }}>{mainWarehouse.product_count}</div>
                      <div style={{ fontSize: 11, color: S.muted }}>{isAr ? 'صنف' : 'Items'}</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 24, fontWeight: 800, color: mainWarehouse.low_stock_count! > 0 ? S.amber : S.green }}>{mainWarehouse.low_stock_count}</div>
                      <div style={{ fontSize: 11, color: S.muted }}>{isAr ? 'منخفض' : 'Low'}</div>
                    </div>
                  </div>
                </div>
                <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 6, color: S.gold, fontSize: 12 }}>
                  <span>{isAr ? `يغذي ${subWarehouses.length} مستودع فرعي` : `Feeds ${subWarehouses.length} branch warehouses`}</span>
                  <span>←</span>
                </div>
              </div>
            </div>
          )}

          {/* المستودعات الفرعية */}
          {subWarehouses.length > 0 && (
            <div>
              <div style={{ fontSize: 12, color: S.muted, fontWeight: 700, marginBottom: 12, letterSpacing: 1 }}>{isAr ? 'المستودعات الفرعية' : 'Branch Warehouses'}</div>
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
                        {w.low_stock_count! > 0 ? (isAr ? `⚠️ ${w.low_stock_count} منخفض` : `⚠️ ${w.low_stock_count} Low`) : (isAr ? '✅ كافي' : '✅ OK')}
                      </span>
                    </div>
                    <h3 style={{ fontSize: 16, fontWeight: 700, color: S.white, marginBottom: 4 }}>{isAr ? w.name : (w.name_en || w.name)}</h3>
                    {w.description && <p style={{ fontSize: 12, color: S.muted, marginBottom: 8 }}>{w.description}</p>}
                    {w.location && <p style={{ fontSize: 11, color: S.muted, marginBottom: 12 }}>📍 {w.location}</p>}
                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 12, borderTop: `1px solid ${S.border}` }}>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 18, fontWeight: 700, color: S.white }}>{w.product_count}</div>
                        <div style={{ fontSize: 11, color: S.muted }}>{isAr ? 'صنف' : 'Items'}</div>
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
                  <div style={{ fontSize: 13, color: S.muted, fontWeight: 600 }}>{isAr ? 'إضافة مستودع جديد' : 'Add New Warehouse'}</div>
                </div>
              </div>
            </div>
          )}

          {/* لو مفيش مستودعات */}
          {warehouses.length === 0 && (
            <div style={{ textAlign: 'center', padding: 60 }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>🏭</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: S.white, marginBottom: 8 }}>لا توجد مستودعات بعد</div>
              <div style={{ fontSize: 13, color: S.muted, marginBottom: 24 }}>{isAr ? 'ابدأ بإضافة المستودع الرئيسي' : 'Start by adding the main warehouse'}</div>
              <button
                onClick={() => setShowAdd(true)}
                style={{ padding: '12px 24px', borderRadius: 12, border: `1px solid ${S.gold}`, background: S.gold3, color: S.gold, cursor: 'pointer', fontSize: 14, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}
              >
                {isAr ? '➕ إضافة مستودع' : '➕ Add Warehouse'}
              </button>
            </div>
          )}
        </>
      )}

      {showAddUnit && <AddUnitModal onClose={() => setShowAddUnit(false)} onSaved={() => setShowAddUnit(false)} />
      }{showAdd && <AddWarehouseModal onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); fetchWarehouses() }} />}
    </div>
  )
}
