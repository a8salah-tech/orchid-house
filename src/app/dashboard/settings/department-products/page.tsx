'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useAuth } from '../../../components/AuthProvider'

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
  blue: '#3B82F6', blueB: 'rgba(59,130,246,0.12)',
  amber: '#F59E0B', amberB: 'rgba(245,158,11,0.12)',
  card: 'rgba(255,255,255,0.04)',
}

const inp: React.CSSProperties = {
  width: '100%', background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.10)',
  borderRadius: 10, padding: '10px 14px', fontSize: 13,
  color: '#FAFAF8', outline: 'none', fontFamily: 'Tajawal, sans-serif',
  boxSizing: 'border-box', direction: 'rtl',
}

const DEPTS = [
  { key: 'المطبخ', label: 'المطبخ', icon: '🍳' },
  { key: 'البار',  label: 'البار',  icon: '🍹' },
  { key: 'الصالة', label: 'الصالة', icon: '🪑' },
]

export default function DepartmentProductsPage() {
  const sb = createClient()
  const { permissions, employee } = useAuth()
  const isAdmin = permissions?.all === true
  const isWarehouse = employee?.role === 'warehouse_keeper'

  const [products,  setProducts]  = useState<any[]>([])
  const [mapping,   setMapping]   = useState<Record<string, string[]>>({ المطبخ: [], البار: [], الصالة: [] })
  const [activeDept, setActiveDept] = useState('المطبخ')
  const [search,    setSearch]    = useState('')
  const [saving,    setSaving]    = useState(false)
  const [saved,     setSaved]     = useState(false)
  const [loading,   setLoading]   = useState(true)
  const [activeCategory, setActiveCategory] = useState('الكل')

  useEffect(() => {
    async function load() {
      const [prodRes, mapRes] = await Promise.all([
        sb.from('warehouse_products')
          .select('id,name,name_en,current_stock,category,units(symbol)')
          .eq('is_active', true)
          .eq('warehouse_id', 'adcb9ca3-56a7-4c9e-94b8-55fec4fcc0a8') // المستودع الرئيسي فقط
          .order('name'),
        sb.from('department_products').select('department,product_id'),
      ])
      // جيب الفئات بشكل منفصل
      const catRes = await sb.from('warehouse_categories').select('id,name')
      const catMap = Object.fromEntries((catRes.data||[]).map((c:any) => [c.id, c.name]))
      setProducts((prodRes.data || []).map((p: any) => ({
        ...p,
        category_name: catMap[p.category] || p.category || 'أخرى'
      })))
      const m: Record<string, string[]> = { المطبخ: [], البار: [], الصالة: [] }
      for (const row of (mapRes.data || [])) {
        if (m[row.department] && !m[row.department].includes(row.product_id)) m[row.department].push(row.product_id)
      }
      setMapping(m)
      setLoading(false)
    }
    load()
  }, [])

  function toggle(productId: string) {
    setMapping(prev => {
      const arr = prev[activeDept] || []
      const next = arr.includes(productId) ? arr.filter(id => id !== productId) : [...arr, productId]
      return { ...prev, [activeDept]: next }
    })
  }

  function selectAll(ids: string[]) {
    setMapping(prev => {
      const arr = prev[activeDept] || []
      const next = [...new Set([...arr, ...ids])]
      return { ...prev, [activeDept]: next }
    })
  }

  function deselectAll(ids: string[]) {
    setMapping(prev => {
      const next = (prev[activeDept] || []).filter(id => !ids.includes(id))
      return { ...prev, [activeDept]: next }
    })
  }

  async function save() {
    setSaving(true)
    for (const dept of ['المطبخ', 'البار', 'الصالة']) {
      const { error: delErr } = await sb.from('department_products').delete().eq('department', dept)
      if (delErr) { alert('خطأ في الحذف: ' + delErr.message); setSaving(false); return }
      const ids = mapping[dept] || []
      if (ids.length > 0) {
        const { error: insErr } = await sb.from('department_products').insert(ids.map(pid => ({ department: dept, product_id: pid })))
        if (insErr) { alert('خطأ في الحفظ: ' + insErr.message); setSaving(false); return }
      }
    }
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  if (!isAdmin && !isWarehouse) return (
    <div style={{ fontFamily: 'Tajawal, sans-serif', direction: 'rtl', color: '#FAFAF8', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', flexDirection: 'column', gap: 16 }}>
      <div style={{ fontSize: 64 }}>🔒</div>
      <div style={{ fontSize: 20, fontWeight: 800, color: '#EF4444' }}>غير مصرح بالوصول</div>
    </div>
  )

  const q = search.toLowerCase()
  const filteredProducts = products.filter(p =>
    (!q || p.name.toLowerCase().includes(q) || (p.name_en||'').toLowerCase().includes(q)) &&
    (activeCategory === 'الكل' || p.category_name === activeCategory)
  )
  const categories = ['الكل', ...new Set(products.map(p => p.category_name))]
  const currentSet = mapping[activeDept] || []
  const selectedCount = currentSet.length
  const filteredIds = filteredProducts.map(p => p.id)

  return (
    <div style={{ fontFamily: 'Tajawal, sans-serif', direction: 'rtl', color: S.white }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700;800&display=swap');`}</style>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: S.white, marginBottom: 4 }}>🏷️ مواد الأقسام</h1>
          <p style={{ fontSize: 13, color: S.muted }}>حدد المواد المتاحة لكل قسم في طلبات الفروع</p>
        </div>
        <button onClick={save} disabled={saving}
          style={{ padding: '10px 24px', borderRadius: 12, border: `1px solid ${saved ? S.green : S.gold}`, background: saved ? S.greenB : S.gold3, color: saved ? S.green : S.gold, cursor: saving ? 'not-allowed' : 'pointer', fontSize: 14, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
          {saving ? '⏳ جاري الحفظ...' : saved ? '✅ تم الحفظ!' : '💾 حفظ التغييرات'}
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 20 }}>
        {DEPTS.map(d => (
          <div key={d.key} style={{ background: activeDept === d.key ? S.gold3 : S.card, borderRadius: 12, padding: '12px 16px', border: `1px solid ${activeDept === d.key ? S.gold : S.border}`, cursor: 'pointer' }} onClick={() => setActiveDept(d.key)}>
            <div style={{ fontSize: 20, marginBottom: 4 }}>{d.icon}</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: activeDept === d.key ? S.gold : S.white }}>{d.label}</div>
            <div style={{ fontSize: 12, color: S.muted }}>{mapping[d.key]?.length || 0} صنف</div>
          </div>
        ))}
      </div>

      {/* Dept Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {DEPTS.map(d => (
          <button key={d.key} onClick={() => setActiveDept(d.key)}
            style={{ padding: '9px 20px', borderRadius: 10, border: `1px solid ${activeDept === d.key ? S.gold : S.border}`, background: activeDept === d.key ? S.gold3 : 'transparent', color: activeDept === d.key ? S.gold : S.muted, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: activeDept === d.key ? 700 : 400 }}>
            {d.icon} {d.label} <span style={{ fontSize: 11, opacity: 0.7 }}>({mapping[d.key]?.length || 0})</span>
          </button>
        ))}
      </div>

      {/* Search + Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <input style={{ ...inp, flex: 1, minWidth: 200 }} value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 بحث في المنتجات..." />
        <button onClick={() => selectAll(filteredIds)} style={{ padding: '9px 16px', borderRadius: 10, border: `1px solid ${S.green}`, background: S.greenB, color: S.green, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>✅ تحديد الكل</button>
        <button onClick={() => deselectAll(filteredIds)} style={{ padding: '9px 16px', borderRadius: 10, border: `1px solid ${S.red}`, background: S.redB, color: S.red, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>❌ إلغاء الكل</button>
      </div>

      {/* Category Filter */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {categories.map(cat => (
          <button key={cat} onClick={() => setActiveCategory(cat)}
            style={{ padding: '5px 12px', borderRadius: 20, border: `1px solid ${activeCategory === cat ? S.gold : S.border}`, background: activeCategory === cat ? S.gold3 : 'transparent', color: activeCategory === cat ? S.gold : S.muted, cursor: 'pointer', fontSize: 11, fontFamily: 'Tajawal, sans-serif', fontWeight: activeCategory === cat ? 700 : 400 }}>
            {cat}
          </button>
        ))}
      </div>

      {/* Products Grid */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: S.muted }}>⏳ جاري التحميل...</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 10 }}>
          {filteredProducts.map(p => {
            const selected = currentSet.includes(p.id)
            return (
              <div key={p.id} onClick={() => toggle(p.id)}
                style={{ background: selected ? S.gold3 : S.card, borderRadius: 12, border: `1px solid ${selected ? S.gold : S.border}`, padding: '12px 14px', cursor: 'pointer', transition: 'all .15s', userSelect: 'none' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: selected ? S.gold : S.white, flex: 1, lineHeight: 1.4 }}>{p.name}</div>
                  <div style={{ width: 20, height: 20, borderRadius: '50%', border: `2px solid ${selected ? S.gold : S.muted}`, background: selected ? S.gold : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: S.navy, fontWeight: 800, flexShrink: 0 }}>
                    {selected ? '✓' : ''}
                  </div>
                </div>
                {p.name_en && <div style={{ fontSize: 10, color: S.muted, marginBottom: 4 }}>{p.name_en}</div>}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 10, color: S.muted, background: 'rgba(255,255,255,0.06)', borderRadius: 6, padding: '2px 6px' }}>{p.category_name}</span>
                  <span style={{ fontSize: 11, color: p.current_stock > 0 ? S.green : S.red, fontWeight: 700 }}>{p.current_stock} {p.units?.symbol}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {filteredProducts.length === 0 && !loading && (
        <div style={{ textAlign: 'center', padding: 40, color: S.muted }}>لا توجد منتجات</div>
      )}

      {/* Footer */}
      <div style={{ position: 'sticky', bottom: 0, background: S.navy, borderTop: `1px solid ${S.border}`, padding: '12px 0', marginTop: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 13, color: S.muted }}>{selectedCount} صنف محدد في <strong style={{ color: S.gold }}>{activeDept}</strong></span>
        <button onClick={save} disabled={saving}
          style={{ padding: '10px 28px', borderRadius: 12, border: `1px solid ${saved ? S.green : S.gold}`, background: saved ? S.greenB : S.gold3, color: saved ? S.green : S.gold, cursor: saving ? 'not-allowed' : 'pointer', fontSize: 14, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
          {saving ? '⏳...' : saved ? '✅ تم الحفظ!' : '💾 حفظ'}
        </button>
      </div>
    </div>
  )
}
