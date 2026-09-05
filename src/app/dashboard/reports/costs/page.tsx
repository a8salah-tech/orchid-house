'use client'


import { useEffect, useState, useMemo } from 'react'
import { createBrowserClient } from '@supabase/ssr'

const supabase = createBrowserClient(
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
  card: 'rgba(255,255,255,0.04)',
  purple: '#8B5CF6', purpleB: 'rgba(139,92,246,0.12)',
  teal: '#14B8A6', tealB: 'rgba(20,184,166,0.12)',
}

function formatMYR(n: number) {
  return 'MYR ' + (n || 0).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function getMarginColor(margin: number) {
  if (margin >= 70) return S.green
  if (margin >= 50) return S.teal
  if (margin >= 30) return S.amber
  return S.red
}

function getMarginBg(margin: number) {
  if (margin >= 70) return S.greenB
  if (margin >= 50) return S.tealB
  if (margin >= 30) return S.amberB
  return S.redB
}

function getMarginLabel(margin: number) {
  if (margin >= 70) return '⭐ ممتاز'
  if (margin >= 50) return '✅ جيد'
  if (margin >= 30) return '⚠️ مقبول'
  return '❌ ضعيف'
}

// ══ Progress Bar ══
function ProgressBar({ value, color }: { value: number; color: string }) {
  return (
    <div style={{ height: 8, background: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden', width: '100%' }}>
      <div style={{ height: '100%', width: `${Math.min(value, 100)}%`, background: color, borderRadius: 4, transition: 'width .5s' }} />
    </div>
  )
}

export default function CostAnalysisPage() {
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [filterCat, setFilterCat] = useState('all')
  const [filterMargin, setFilterMargin] = useState('all')
  const [sort, setSort] = useState<'margin_asc' | 'margin_desc' | 'price_desc' | 'profit_desc'>('margin_desc')
  const [view, setView] = useState<'grid' | 'list'>('list')

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    setLoading(true)
    const [itemsRes, catsRes] = await Promise.all([
      supabase.from('menu_items')
        .select('id, name, name_en, price, cost_price, is_available, category_id, menu_categories(name, icon)')
        .eq('is_active', true)
        .order('category_id')
        .order('name'),
      supabase.from('menu_categories').select('id, name, icon').eq('is_active', true).order('sort_order'),
    ])
    setItems(itemsRes.data || [])
    setCategories(catsRes.data || [])
    setLoading(false)
  }

  // حساب التحليل لكل صنف
  const analyzed = useMemo(() => items.map(item => {
    const price = item.price || 0
    const cost = item.cost_price || 0
    const profit = price - cost
    const margin = price > 0 ? (profit / price) * 100 : 0
    const markup = cost > 0 ? (profit / cost) * 100 : 0
    return { ...item, profit, margin, markup }
  }), [items])

  // فلتر وترتيب
  const filtered = useMemo(() => {
    let result = analyzed.filter(item => {
      const matchSearch = !search || item.name.includes(search) || (item.name_en||'').toLowerCase().includes(search.toLowerCase())
      const matchCat = filterCat === 'all' || item.category_id === filterCat
      const matchMargin = filterMargin === 'all' ||
        (filterMargin === 'excellent' && item.margin >= 70) ||
        (filterMargin === 'good' && item.margin >= 50 && item.margin < 70) ||
        (filterMargin === 'acceptable' && item.margin >= 30 && item.margin < 50) ||
        (filterMargin === 'poor' && item.margin < 30)
      return matchSearch && matchCat && matchMargin
    })

    result.sort((a, b) => {
      if (sort === 'margin_desc') return b.margin - a.margin
      if (sort === 'margin_asc') return a.margin - b.margin
      if (sort === 'price_desc') return b.price - a.price
      if (sort === 'profit_desc') return b.profit - a.profit
      return 0
    })
    return result
  }, [analyzed, search, filterCat, filterMargin, sort])

  // إحصائيات عامة
  const stats = useMemo(() => {
    const withCost = analyzed.filter(i => i.cost_price > 0)
    const avgMargin = withCost.length ? withCost.reduce((s, i) => s + i.margin, 0) / withCost.length : 0
    const totalRevenuePotential = analyzed.reduce((s, i) => s + i.price, 0)
    const totalCost = analyzed.reduce((s, i) => s + i.cost_price, 0)
    const excellent = analyzed.filter(i => i.margin >= 70).length
    const good = analyzed.filter(i => i.margin >= 50 && i.margin < 70).length
    const acceptable = analyzed.filter(i => i.margin >= 30 && i.margin < 50).length
    const poor = analyzed.filter(i => i.margin < 30 && i.cost_price > 0).length
    const noCost = analyzed.filter(i => !i.cost_price).length
    return { avgMargin, totalRevenuePotential, totalCost, excellent, good, acceptable, poor, noCost, withCost: withCost.length }
  }, [analyzed])

  // تحليل بالأقسام
  const byCategory = useMemo(() => {
    const grouped: Record<string, { name: string; icon: string; items: any[]; avgMargin: number }> = {}
    analyzed.forEach(item => {
      const catId = item.category_id || 'other'
      const catName = item.menu_categories?.name || 'غير مصنف'
      const catIcon = item.menu_categories?.icon || '🍽️'
      if (!grouped[catId]) grouped[catId] = { name: catName, icon: catIcon, items: [], avgMargin: 0 }
      grouped[catId].items.push(item)
    })
    Object.values(grouped).forEach(cat => {
      const withCost = cat.items.filter(i => i.cost_price > 0)
      cat.avgMargin = withCost.length ? withCost.reduce((s, i) => s + i.margin, 0) / withCost.length : 0
    })
    return Object.values(grouped).sort((a, b) => b.avgMargin - a.avgMargin)
  }, [analyzed])

  // أعلى وأقل هامش
  const topItems = [...analyzed].filter(i => i.cost_price > 0).sort((a, b) => b.margin - a.margin).slice(0, 5)
  const bottomItems = [...analyzed].filter(i => i.cost_price > 0).sort((a, b) => a.margin - b.margin).slice(0, 5)

  function printReport() {
    const html = `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8">
    <title>تحليل التكاليف — Orchid House</title>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700;800&display=swap');
      body{font-family:'Tajawal',Arial,sans-serif;margin:20px;color:#1a1a1a;direction:rtl}
      .header{text-align:center;padding:20px;background:#0F2040;border-radius:8px;margin-bottom:16px;color:white}
      h1{color:#C9A84C;font-size:20px;margin:0 0 4px}
      .stats{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:16px}
      .stat{border:1px solid #ddd;border-radius:8px;padding:12px;text-align:center}
      .sv{font-size:18px;font-weight:800;color:#C9A84C}
      .sl{font-size:11px;color:#666;margin-top:2px}
      table{width:100%;border-collapse:collapse;font-size:11px;margin-bottom:16px}
      th{background:#0F2040;color:white;padding:8px 10px;text-align:right}
      td{padding:6px 10px;border-bottom:1px solid #eee}
      tr:nth-child(even){background:#f9f9f9}
      .cat-title{background:#f0e8d0;font-weight:800;color:#8B6914;padding:8px 10px;font-size:12px}
      .margin-bar{display:inline-block;height:8px;background:#ddd;width:60px;border-radius:4px;vertical-align:middle;position:relative;overflow:hidden}
      @media print{button{display:none}}
    </style></head><body>
    <div class="header"><div style="font-size:28px">🌸</div>
    <h1>Orchid House — تحليل التكاليف والأرباح</h1>
    <div style="color:#8A9BB5;font-size:12px">${new Date().toLocaleDateString('ar-SA', { year:'numeric', month:'long', day:'numeric' })}</div></div>

    <div class="stats">
      <div class="stat"><div class="sv">${stats.withCost}</div><div class="sl">أصناف محللة</div></div>
      <div class="stat"><div class="sv">${stats.avgMargin.toFixed(1)}%</div><div class="sl">متوسط هامش الربح</div></div>
      <div class="stat"><div class="sv" style="color:#16a34a">${stats.excellent}</div><div class="sl">هامش ممتاز +70%</div></div>
      <div class="stat"><div class="sv" style="color:#dc2626">${stats.poor}</div><div class="sl">هامش ضعيف -30%</div></div>
    </div>

    ${byCategory.map(cat => `
    <table>
      <thead><tr><th colspan="6" class="cat-title">${cat.icon} ${cat.name} — متوسط الهامش: ${cat.avgMargin.toFixed(1)}%</th></tr>
      <tr><th>الصنف</th><th>سعر البيع</th><th>التكلفة</th><th>الربح</th><th>هامش الربح</th><th>التقييم</th></tr></thead>
      <tbody>
      ${cat.items.map(item => `<tr>
        <td><b>${item.name}</b>${item.name_en?`<br/><small style="color:#666">${item.name_en}</small>`:''}</td>
        <td>MYR ${item.price.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
        <td>${item.cost_price?'MYR '+item.cost_price.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 }):'—'}</td>
        <td style="color:${item.profit>0?'#16a34a':'#dc2626'};font-weight:700">${item.cost_price?'MYR '+item.profit.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 }):'—'}</td>
        <td style="font-weight:800;color:${item.margin>=70?'#16a34a':item.margin>=50?'#0d9488':item.margin>=30?'#d97706':'#dc2626'}">${item.cost_price?item.margin.toFixed(1)+'%':'—'}</td>
        <td>${item.cost_price?getMarginLabel(item.margin):'غير محدد'}</td>
      </tr>`).join('')}
      </tbody>
    </table>`).join('')}

    <div style="text-align:center;color:#999;font-size:10px;margin-top:20px">🌸 Orchid Group Restaurant Management System</div>
    </body></html>`

    const win = window.open('', '_blank')
    if (win) { win.document.write(html); win.document.close(); setTimeout(() => win.print(), 500) }
  }

  const inp: React.CSSProperties = {
    background: S.card, border: `1px solid ${S.border}`, borderRadius: 10,
    padding: '9px 14px', fontSize: 13, color: S.white, outline: 'none',
    fontFamily: 'Tajawal, sans-serif', direction: 'rtl',
  }

  return (
    <div style={{ fontFamily: 'Tajawal, sans-serif', direction: 'rtl', color: S.white }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&display=swap');
        select option{background:#0F2040;color:#FAFAF8}
        .item-row:hover{background:rgba(255,255,255,0.04)}
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: S.white, marginBottom: 4 }}>💰 تحليل التكاليف والأرباح</h1>
          <p style={{ fontSize: 13, color: S.muted }}>تحليل هامش ربح كل صنف من المنيو بناءً على آخر سعر شراء</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={fetchData} style={{ ...inp, cursor: 'pointer', color: S.gold, border: `1px solid ${S.gold}`, fontWeight: 700 } as any}>🔄 تحديث</button>
          <button onClick={printReport} style={{ ...inp, cursor: 'pointer', color: S.blue, border: `1px solid ${S.blue}`, fontWeight: 700 } as any}>🖨️ طباعة</button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 80, color: S.muted }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⏳</div>
          <div style={{ fontSize: 16 }}>جاري التحليل...</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

          {/* ══ الإحصائيات العامة ══ */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 14 }}>
            {[
              { label: 'أصناف محللة', value: stats.withCost, icon: '📊', color: S.blue, bg: S.blueB },
              { label: 'متوسط الهامش', value: stats.avgMargin.toFixed(1) + '%', icon: '📈', color: getMarginColor(stats.avgMargin), bg: getMarginBg(stats.avgMargin) },
              { label: 'هامش ممتاز +70%', value: stats.excellent, icon: '⭐', color: S.green, bg: S.greenB },
              { label: 'هامش جيد 50-70%', value: stats.good, icon: '✅', color: S.teal, bg: S.tealB },
              { label: 'هامش مقبول 30-50%', value: stats.acceptable, icon: '⚠️', color: S.amber, bg: S.amberB },
              { label: 'هامش ضعيف -30%', value: stats.poor, icon: '❌', color: S.red, bg: S.redB },
              { label: 'بدون تكلفة محددة', value: stats.noCost, icon: '❓', color: S.muted, bg: S.card },
              { label: 'إجمالي الأصناف', value: items.length, icon: '🍽️', color: S.gold, bg: S.gold3 },
            ].map((s, i) => (
              <div key={i} style={{ background: s.bg, borderRadius: 14, border: `1px solid ${s.color}30`, padding: '14px 16px' }}>
                <div style={{ fontSize: 20, marginBottom: 6 }}>{s.icon}</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: s.color, marginBottom: 2 }}>{s.value}</div>
                <div style={{ fontSize: 11, color: S.muted }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* ══ توزيع الهامش ══ */}
          <div style={{ background: S.navy2, borderRadius: 16, border: `1px solid ${S.border}`, padding: '20px' }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: S.white, marginBottom: 16 }}>📊 توزيع هامش الربح</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
              {[
                { label: 'ممتاز +70%', count: stats.excellent, color: S.green, pct: items.length ? (stats.excellent/items.length)*100 : 0 },
                { label: 'جيد 50-70%', count: stats.good, color: S.teal, pct: items.length ? (stats.good/items.length)*100 : 0 },
                { label: 'مقبول 30-50%', count: stats.acceptable, color: S.amber, pct: items.length ? (stats.acceptable/items.length)*100 : 0 },
                { label: 'ضعيف -30%', count: stats.poor, color: S.red, pct: items.length ? (stats.poor/items.length)*100 : 0 },
              ].map((item, i) => (
                <div key={i} style={{ background: S.card, borderRadius: 12, padding: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 12, color: S.muted }}>{item.label}</span>
                    <span style={{ fontSize: 14, fontWeight: 800, color: item.color }}>{item.count}</span>
                  </div>
                  <ProgressBar value={item.pct} color={item.color} />
                  <div style={{ fontSize: 11, color: S.muted, marginTop: 4 }}>{item.pct.toFixed(0)}%</div>
                </div>
              ))}
            </div>
          </div>

          {/* ══ أفضل وأسوأ الأصناف ══ */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {/* أعلى هامش */}
            <div style={{ background: S.navy2, borderRadius: 16, border: `1px solid ${S.green}30`, overflow: 'hidden' }}>
              <div style={{ padding: '14px 18px', borderBottom: `1px solid ${S.border}`, background: S.greenB }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: S.green }}>⭐ أعلى 5 أصناف هامشاً</div>
              </div>
              {topItems.map((item, i) => (
                <div key={i} style={{ padding: '12px 18px', borderBottom: `1px solid ${S.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: S.white, marginBottom: 2 }}>{item.name}</div>
                    <div style={{ fontSize: 11, color: S.muted }}>{item.menu_categories?.icon} {item.menu_categories?.name}</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 16, fontWeight: 800, color: S.green }}>{item.margin.toFixed(1)}%</div>
                    <div style={{ fontSize: 10, color: S.muted }}>ربح {formatMYR(item.profit)}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* أقل هامش */}
            <div style={{ background: S.navy2, borderRadius: 16, border: `1px solid ${S.red}30`, overflow: 'hidden' }}>
              <div style={{ padding: '14px 18px', borderBottom: `1px solid ${S.border}`, background: S.redB }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: S.red }}>⚠️ أقل 5 أصناف هامشاً</div>
              </div>
              {bottomItems.map((item, i) => (
                <div key={i} style={{ padding: '12px 18px', borderBottom: `1px solid ${S.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: S.white, marginBottom: 2 }}>{item.name}</div>
                    <div style={{ fontSize: 11, color: S.muted }}>{item.menu_categories?.icon} {item.menu_categories?.name}</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 16, fontWeight: 800, color: getMarginColor(item.margin) }}>{item.margin.toFixed(1)}%</div>
                    <div style={{ fontSize: 10, color: S.muted }}>ربح {formatMYR(item.profit)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ══ تحليل بالأقسام ══ */}
          <div style={{ background: S.navy2, borderRadius: 16, border: `1px solid ${S.border}`, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: `1px solid ${S.border}` }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: S.white }}>📁 متوسط الهامش بالقسم</div>
            </div>
            <div style={{ padding: '12px 0' }}>
              {byCategory.map((cat, i) => (
                <div key={i} style={{ padding: '12px 20px', borderBottom: `1px solid ${S.border}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 18 }}>{cat.icon}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: S.white }}>{cat.name}</span>
                      <span style={{ fontSize: 11, color: S.muted, background: S.card, borderRadius: 20, padding: '2px 8px' }}>{cat.items.length} صنف</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 11, color: S.muted }}>{getMarginLabel(cat.avgMargin)}</span>
                      <span style={{ fontSize: 15, fontWeight: 800, color: getMarginColor(cat.avgMargin) }}>{cat.avgMargin.toFixed(1)}%</span>
                    </div>
                  </div>
                  <ProgressBar value={cat.avgMargin} color={getMarginColor(cat.avgMargin)} />
                </div>
              ))}
            </div>
          </div>

          {/* ══ الفلاتر ══ */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <input style={{ ...inp, flex: 1, minWidth: 200 }} value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 بحث عن صنف..." />
            <select style={inp} value={filterCat} onChange={e => setFilterCat(e.target.value)}>
              <option value="all">كل الأقسام</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
            </select>
            <select style={inp} value={filterMargin} onChange={e => setFilterMargin(e.target.value)}>
              <option value="all">كل الهوامش</option>
              <option value="excellent">⭐ ممتاز +70%</option>
              <option value="good">✅ جيد 50-70%</option>
              <option value="acceptable">⚠️ مقبول 30-50%</option>
              <option value="poor">❌ ضعيف -30%</option>
            </select>
            <select style={inp} value={sort} onChange={e => setSort(e.target.value as any)}>
              <option value="margin_desc">هامش الربح ↓</option>
              <option value="margin_asc">هامش الربح ↑</option>
              <option value="profit_desc">أعلى ربح</option>
              <option value="price_desc">أعلى سعر</option>
            </select>
            <div style={{ display: 'flex', background: S.navy3, borderRadius: 10, padding: 4, gap: 4 }}>
              <button onClick={() => setView('list')} style={{ padding: '7px 12px', borderRadius: 8, border: 'none', background: view === 'list' ? S.gold3 : 'transparent', color: view === 'list' ? S.gold : S.muted, cursor: 'pointer', fontSize: 16 }}>☰</button>
              <button onClick={() => setView('grid')} style={{ padding: '7px 12px', borderRadius: 8, border: 'none', background: view === 'grid' ? S.gold3 : 'transparent', color: view === 'grid' ? S.gold : S.muted, cursor: 'pointer', fontSize: 16 }}>⊞</button>
            </div>
            <div style={{ fontSize: 12, color: S.muted }}>{filtered.length} صنف</div>
          </div>

          {/* ══ قائمة الأصناف ══ */}
          {view === 'list' ? (
            <div style={{ background: S.navy2, borderRadius: 16, border: `1px solid ${S.border}`, overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 750 }}>
                  <thead>
                    <tr style={{ background: S.navy3 }}>
                      {['الصنف', 'القسم', 'سعر البيع', 'التكلفة', 'الربح', 'هامش الربح', 'نسبة الربح', 'التقييم'].map(h => (
                        <th key={h} style={{ padding: '12px 14px', textAlign: 'right', fontSize: 12, color: S.muted, fontWeight: 700, borderBottom: `1px solid ${S.border}` }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((item, i) => (
                      <tr key={item.id} className="item-row" style={{ borderBottom: `1px solid ${S.border}` }}>
                        <td style={{ padding: '12px 14px' }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: S.white }}>{item.name}</div>
                          {item.name_en && <div style={{ fontSize: 11, color: S.muted, fontStyle: 'italic' }}>{item.name_en}</div>}
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          <span style={{ background: S.card, borderRadius: 20, padding: '3px 10px', fontSize: 11, color: S.muted }}>
                            {item.menu_categories?.icon} {item.menu_categories?.name}
                          </span>
                        </td>
                        <td style={{ padding: '12px 14px', fontWeight: 700, color: S.gold }}>{formatMYR(item.price)}</td>
                        <td style={{ padding: '12px 14px', color: item.cost_price ? S.red : S.muted }}>
                          {item.cost_price ? formatMYR(item.cost_price) : <span style={{ color: S.muted, fontSize: 11 }}>غير محدد</span>}
                        </td>
                        <td style={{ padding: '12px 14px', fontWeight: 700, color: item.cost_price ? (item.profit >= 0 ? S.green : S.red) : S.muted }}>
                          {item.cost_price ? formatMYR(item.profit) : '—'}
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          {item.cost_price ? (
                            <div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                <span style={{ fontSize: 13, fontWeight: 800, color: getMarginColor(item.margin) }}>{item.margin.toFixed(1)}%</span>
                              </div>
                              <ProgressBar value={item.margin} color={getMarginColor(item.margin)} />
                            </div>
                          ) : <span style={{ color: S.muted, fontSize: 11 }}>—</span>}
                        </td>
                        <td style={{ padding: '12px 14px', color: item.cost_price ? S.muted : S.muted, fontSize: 12 }}>
                          {item.cost_price ? `${item.markup.toFixed(0)}%` : '—'}
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          {item.cost_price ? (
                            <span style={{ background: getMarginBg(item.margin), color: getMarginColor(item.margin), borderRadius: 20, padding: '4px 12px', fontSize: 12, fontWeight: 700 }}>
                              {getMarginLabel(item.margin)}
                            </span>
                          ) : (
                            <span style={{ background: S.card, color: S.muted, borderRadius: 20, padding: '4px 12px', fontSize: 12 }}>❓ غير محدد</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14 }}>
              {filtered.map(item => (
                <div key={item.id} style={{ background: S.navy2, borderRadius: 16, border: `1px solid ${item.cost_price ? getMarginColor(item.margin) + '30' : S.border}`, padding: '16px 18px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: S.white, marginBottom: 2 }}>{item.name}</div>
                      {item.name_en && <div style={{ fontSize: 11, color: S.muted, fontStyle: 'italic', marginBottom: 4 }}>{item.name_en}</div>}
                      <span style={{ background: S.card, borderRadius: 20, padding: '2px 8px', fontSize: 10, color: S.muted }}>
                        {item.menu_categories?.icon} {item.menu_categories?.name}
                      </span>
                    </div>
                    {item.cost_price && (
                      <span style={{ background: getMarginBg(item.margin), color: getMarginColor(item.margin), borderRadius: 20, padding: '4px 10px', fontSize: 12, fontWeight: 800, flexShrink: 0, marginRight: 8 }}>
                        {item.margin.toFixed(0)}%
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                    <div style={{ background: S.card, borderRadius: 8, padding: '8px 10px' }}>
                      <div style={{ fontSize: 10, color: S.muted, marginBottom: 2 }}>💰 سعر البيع</div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: S.gold }}>{formatMYR(item.price)}</div>
                    </div>
                    <div style={{ background: S.card, borderRadius: 8, padding: '8px 10px' }}>
                      <div style={{ fontSize: 10, color: S.muted, marginBottom: 2 }}>🏭 التكلفة</div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: item.cost_price ? S.red : S.muted }}>
                        {item.cost_price ? formatMYR(item.cost_price) : '—'}
                      </div>
                    </div>
                  </div>

                  {item.cost_price ? (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <span style={{ fontSize: 12, color: S.muted }}>الربح</span>
                        <span style={{ fontSize: 14, fontWeight: 800, color: item.profit >= 0 ? S.green : S.red }}>{formatMYR(item.profit)}</span>
                      </div>
                      <ProgressBar value={item.margin} color={getMarginColor(item.margin)} />
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                        <span style={{ fontSize: 11, color: S.muted }}>{getMarginLabel(item.margin)}</span>
                        <span style={{ fontSize: 11, color: S.muted }}>{'markup: ' + item.markup.toFixed(0) + '%'}</span>
                      </div>
                    </>
                  ) : (
                    <div style={{ background: S.card, borderRadius: 8, padding: '8px 12px', fontSize: 12, color: S.muted, textAlign: 'center' }}>
                      ❓ لم يتم تحديد سعر التكلفة
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {filtered.length === 0 && (
            <div style={{ textAlign: 'center', padding: 60, color: S.muted }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>💰</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: S.white }}>لا توجد نتائج</div>
            </div>
          )}

        </div>
      )}
    </div>
  )
}
