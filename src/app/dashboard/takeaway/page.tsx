'use client'

import { useEffect, useState, useRef } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useAuth } from '../../components/AuthProvider'

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
  amber: '#F59E0B', amberB: 'rgba(245,158,11,0.12)',
  blue: '#3B82F6', blueB: 'rgba(59,130,246,0.12)',
  purple: '#A855F7', purpleB: 'rgba(168,85,247,0.12)',
  card: 'rgba(255,255,255,0.04)',
}

// ✅ القنوات الأربعة - كل واحدة مرتبطة بـ"طاولة وهمية" ثابتة في نفس الفرع (نفس فكرة الطاولة العادية، بس مفيش عميل فعلي جالس عليها)
const CHANNELS = [
  { key: 'foodpanda', label: 'Foodpanda', icon: '🛵', color: '#D91C6E', tableNumber: 901 },
  { key: 'grab', label: 'Grab', icon: '🚗', color: '#00B14F', tableNumber: 902 },
  { key: 'customer', label: 'Customer', icon: '👤', color: S.blue, tableNumber: 903 },
  { key: 'other', label: 'Other', icon: '📦', color: S.amber, tableNumber: 904 },
]

type MenuItem = { id: string; name: string; name_en: string; price: number; category_id: string; or_code?: string; menu_categories?: { name: string } | { name: string }[]
  sizes?: { id: string; name: string; name_en?: string; price: number; is_active: boolean }[] }

export default function TakeAwayPage() {
  const sbRef = useRef(createClient())
  const sb = sbRef.current
  const { employee, permissions } = useAuth()
  const isAdmin = permissions?.all === true

  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 800)
    check(); window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // ✅ فرع العمل - من بيانات الموظف، أو منتقي يدوي لو أدمن بدون فرع محدد
  const [branchId, setBranchId] = useState(employee?.branch_id || '')
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([])
  useEffect(() => {
    if (isAdmin) sb.from('branches').select('id,name').eq('is_active', true).order('name').then(({ data }) => setBranches(data || []))
  }, [isAdmin, sb])
  useEffect(() => { if (employee?.branch_id) setBranchId(employee.branch_id) }, [employee?.branch_id])

  const [step, setStep] = useState<'channel' | 'order'>('channel')
  const [channel, setChannel] = useState<typeof CHANNELS[number] | null>(null)
  const [channelTableId, setChannelTableId] = useState<string | null>(null)
  const [loadingTable, setLoadingTable] = useState(false)

  // ✅ عند اختيار القناة، نجيب الطاولة الوهمية المطابقة لها في نفس الفرع
  async function selectChannel(ch: typeof CHANNELS[number]) {
    if (!branchId) { alert('من فضلك اختر الفرع أولًا'); return }
    setLoadingTable(true)
    const { data } = await sb.from('tables').select('id').eq('branch_id', branchId).eq('number', ch.tableNumber).maybeSingle()
    setLoadingTable(false)
    if (!data) { alert('⚠️ لم يتم العثور على حساب ' + ch.label + ' لهذا الفرع'); return }
    setChannel(ch)
    setChannelTableId(data.id)
    setStep('order')
  }

  const [categories, setCategories] = useState<{ id: string; name: string; name_en: string }[]>([])
  const [items, setItems] = useState<MenuItem[]>([])
  const [selectedCat, setSelectedCat] = useState('all')
  const [search, setSearch] = useState('')
  const [codeSearch, setCodeSearch] = useState('')
  const [cart, setCart] = useState<{ item: MenuItem; qty: number; notes: string; selectedSize?: { id: string; name: string; name_en?: string; price: number } }[]>([])
  const [sizePickerItem, setSizePickerItem] = useState<MenuItem | null>(null)
  const [saving, setSaving] = useState(false)
  const isSavingRef = useRef(false)

  useEffect(() => {
    if (step !== 'order') return
    sb.from('menu_categories').select('id,name,name_en').eq('is_active', true).order('sort_order').then(({ data }) => setCategories(data || []))
    sb.from('menu_items').select('id,name,name_en,price,category_id,or_code,menu_categories(name),sizes:menu_item_sizes(id,name,name_en,price,is_active)').eq('is_available', true).order('name').then(({ data }) => setItems((data as any) || []))
  }, [step, sb])

  const filtered = items.filter(i => {
    const matchCat = selectedCat === 'all' || i.category_id === selectedCat
    const matchSearch = !search || i.name.includes(search) || i.name_en.toLowerCase().includes(search.toLowerCase()) || (i.or_code || '').toLowerCase().includes(search.toLowerCase())
    const codeDigits = (i.or_code || '').match(/\d+/)?.[0] || ''
    const matchCode = !codeSearch || codeDigits === codeSearch.replace(/\D/g, '')
    return matchCat && matchSearch && matchCode
  })

  function addItem(item: MenuItem) {
    const activeSizes = (item.sizes || []).filter(s => s.is_active)
    if (activeSizes.length > 0) { setSizePickerItem(item); return }
    setCart(p => {
      const ex = p.find(c => c.item.id === item.id && !c.selectedSize)
      if (ex) return p.map(c => c === ex ? { ...c, qty: c.qty + 1 } : c)
      return [...p, { item, qty: 1, notes: '' }]
    })
  }
  function addItemWithSize(item: MenuItem, size: { id: string; name: string; name_en?: string; price: number }) {
    setCart(p => {
      const ex = p.find(c => c.item.id === item.id && c.selectedSize?.id === size.id)
      if (ex) return p.map(c => c === ex ? { ...c, qty: c.qty + 1 } : c)
      return [...p, { item, qty: 1, notes: '', selectedSize: size }]
    })
    setSizePickerItem(null)
  }
  function decreaseItem(itemId: string) {
    setCart(p => {
      const idx = p.findIndex(c => c.item.id === itemId)
      if (idx === -1) return p
      const c = p[idx]
      if (c.qty <= 1) return p.filter((_, i) => i !== idx)
      return p.map((c2, i) => i === idx ? { ...c2, qty: c2.qty - 1 } : c2)
    })
  }

  const total = cart.reduce((s, c) => s + (c.selectedSize?.price ?? c.item.price) * c.qty, 0)

  async function placeOrder() {
    if (cart.length === 0 || !channelTableId) return
    if (isSavingRef.current) return
    isSavingRef.current = true
    setSaving(true)
    // ✅ نبحث عن طلب مفتوح بالفعل على حساب القناة دي (زي أي طاولة عادية) - لو موجود نضيف عليه، ولو لأ ننشئ جديد
    const { data: existingOrder } = await sb.from('orders').select('id').eq('table_id', channelTableId).in('status', ['confirmed', 'preparing', 'ready']).limit(1).maybeSingle()
    let orderId = existingOrder?.id
    if (!orderId) {
      const { data: newOrder, error } = await sb.from('orders').insert([{ table_id: channelTableId, status: 'confirmed', total_amount: 0 }]).select('id').single()
      if (error || !newOrder) { alert('حصل خطأ: ' + (error?.message || '')); setSaving(false); isSavingRef.current = false; return }
      orderId = newOrder.id
      await sb.from('tables').update({ status: 'occupied', current_order_id: orderId, occupied_since: new Date().toISOString() }).eq('id', channelTableId)
    }
    await sb.from('order_items').insert(cart.map(c => ({
      order_id: orderId, menu_item_id: c.item.id,
      quantity: c.qty, unit_price: c.selectedSize?.price ?? c.item.price,
      size_name: c.selectedSize ? (c.selectedSize.name_en || c.selectedSize.name) : null,
      notes: c.notes || null, status: 'pending', destination: 'kitchen',
    })))
    const { data: allItems } = await sb.from('order_items').select('unit_price, quantity, status').eq('order_id', orderId)
    const newTotal = (allItems || []).filter(i => i.status !== 'cancelled').reduce((s, i) => s + i.unit_price * i.quantity, 0)
    await sb.from('orders').update({ total_amount: newTotal }).eq('id', orderId)

    setSaving(false)
    isSavingRef.current = false
    setCart([])
    alert(`✅ تم إرسال الطلب لحساب ${channel?.label} بنجاح!`)
    setStep('channel'); setChannel(null); setChannelTableId(null)
  }

  const inp: React.CSSProperties = { background: S.card, border: `1px solid ${S.border}`, borderRadius: 10, padding: '9px 12px', fontSize: 13, color: S.white, outline: 'none', fontFamily: 'Tajawal, sans-serif' }

  return (
    <div style={{ fontFamily: 'Tajawal, sans-serif', direction: 'rtl', color: S.white, minHeight: '100vh', padding: isMobile ? 14 : 24 }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700;800&display=swap');`}</style>

      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 20 }}>🥡 Take Away</h1>

      {step === 'channel' ? (
        <div style={{ maxWidth: 500, margin: '0 auto' }}>
          {isAdmin && (
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 6 }}>🏪 اختر الفرع</label>
              <select value={branchId} onChange={e => setBranchId(e.target.value)}
                style={{ ...inp, width: '100%', boxSizing: 'border-box' }}>
                <option value="">-- اختر الفرع --</option>
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
          )}
          <p style={{ fontSize: 13, color: S.muted, marginBottom: 16 }}>اختر مصدر الطلب:</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            {CHANNELS.map(ch => (
              <button key={ch.key} onClick={() => selectChannel(ch)} disabled={loadingTable}
                style={{ padding: '28px 16px', borderRadius: 18, border: `1.5px solid ${ch.color}60`, background: ch.color + '18', color: S.white, cursor: loadingTable ? 'wait' : 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, fontFamily: 'Tajawal, sans-serif' }}>
                <span style={{ fontSize: 34 }}>{ch.icon}</span>
                <span style={{ fontSize: 15, fontWeight: 800, color: ch.color }}>{ch.label}</span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <button onClick={() => { setStep('channel'); setChannel(null); setChannelTableId(null); setCart([]) }}
              style={{ padding: '8px 14px', borderRadius: 10, border: `1px solid ${S.border}`, background: 'transparent', color: S.muted, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif' }}>← رجوع</button>
            {channel && (
              <span style={{ fontSize: 14, fontWeight: 800, color: channel.color, background: channel.color + '18', borderRadius: 20, padding: '6px 14px' }}>
                {channel.icon} {channel.label}
              </span>
            )}
          </div>

          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            <input style={{ ...inp, flex: 2 }} placeholder="🔍 البحث بالاسم أو الكود..." value={search} onChange={e => setSearch(e.target.value)} />
            <input style={{ ...inp, flex: 1 }} placeholder="# كود" inputMode="numeric" type="text" value={codeSearch} onChange={e => setCodeSearch(e.target.value.replace(/\D/g, ''))} />
          </div>

          <div style={{ display: 'flex', gap: 8, marginBottom: 16, overflowX: 'auto', paddingBottom: 4 }}>
            <button onClick={() => setSelectedCat('all')} style={{ padding: '8px 14px', borderRadius: 10, border: `1px solid ${selectedCat === 'all' ? S.gold : S.border}`, background: selectedCat === 'all' ? S.gold3 : 'transparent', color: selectedCat === 'all' ? S.gold : S.muted, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', whiteSpace: 'nowrap' }}>الكل</button>
            {categories.map(c => (
              <button key={c.id} onClick={() => setSelectedCat(c.id)} style={{ padding: '8px 14px', borderRadius: 10, border: `1px solid ${selectedCat === c.id ? S.gold : S.border}`, background: selectedCat === c.id ? S.gold3 : 'transparent', color: selectedCat === c.id ? S.gold : S.muted, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', whiteSpace: 'nowrap' }}>{c.name_en || c.name}</button>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(auto-fill, minmax(150px,1fr))', gap: 10, marginBottom: 100 }}>
            {filtered.map(item => {
              const qty = cart.filter(c => c.item.id === item.id).reduce((s, c) => s + c.qty, 0)
              const activeSizes = (item.sizes || []).filter(s => s.is_active)
              return (
                <div key={item.id} onClick={() => addItem(item)} style={{ background: qty > 0 ? S.gold3 : S.card, border: `1px solid ${qty > 0 ? S.gold : S.border}`, borderRadius: 10, padding: 10, cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    {item.or_code && <span style={{ fontSize: 12, fontWeight: 800, color: S.gold }}>#{item.or_code}</span>}
                    <div style={{ fontSize: 12, fontWeight: 700, color: S.white, flex: 1 }}>{item.name_en || item.name}</div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, color: S.gold, fontWeight: 700 }}>{activeSizes.length > 0 ? `من MYR ${Math.min(...activeSizes.map(s => s.price)).toFixed(2)}` : `MYR ${item.price.toFixed(2)}`}</span>
                    {qty > 0 && <span style={{ color: S.gold, fontWeight: 800, fontSize: 13 }}>×{qty}</span>}
                  </div>
                </div>
              )
            })}
          </div>

          {/* شريط السلة السفلي */}
          {cart.length > 0 && (
            <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: S.navy2, borderTop: `1px solid ${S.border}`, padding: 16, zIndex: 100 }}>
              <div style={{ maxWidth: 700, margin: '0 auto' }}>
                <div style={{ maxHeight: 160, overflowY: 'auto', marginBottom: 10 }}>
                  {cart.map((c, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', fontSize: 12 }}>
                      <span style={{ color: S.white }}>{c.item.name_en || c.item.name}{c.selectedSize ? ` (${c.selectedSize.name_en || c.selectedSize.name})` : ''} ×{c.qty}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ color: S.gold }}>MYR {((c.selectedSize?.price ?? c.item.price) * c.qty).toFixed(2)}</span>
                        <button onClick={() => decreaseItem(c.item.id)} style={{ background: 'transparent', border: 'none', color: S.red, cursor: 'pointer', fontSize: 14 }}>✕</button>
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 16, fontWeight: 800, color: S.gold }}>MYR {total.toFixed(2)}</span>
                  <button onClick={placeOrder} disabled={saving}
                    style={{ flex: 1, maxWidth: 260, padding: '12px', borderRadius: 12, border: 'none', background: `linear-gradient(135deg, ${S.gold}, ${S.gold2})`, color: S.navy, cursor: saving ? 'not-allowed' : 'pointer', fontWeight: 800, fontSize: 14, fontFamily: 'Tajawal, sans-serif', opacity: saving ? 0.7 : 1 }}>
                    {saving ? '⏳ جاري الإرسال...' : `✅ تأكيد الطلب (${cart.reduce((s, c) => s + c.qty, 0)} صنف)`}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* مودال اختيار النوع */}
      {sizePickerItem && (
        <div onClick={() => setSizePickerItem(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.75)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: S.navy2, borderRadius: 20, border: `1px solid ${S.border}`, padding: 20, maxWidth: 360, width: '100%', maxHeight: '80vh', overflowY: 'auto' }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: S.gold, marginBottom: 14 }}>{sizePickerItem.name_en || sizePickerItem.name} — اختر النوع</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(sizePickerItem.sizes || []).filter(s => s.is_active).map(size => (
                <button key={size.id} onClick={() => addItemWithSize(sizePickerItem, size)}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', borderRadius: 10, border: `1px solid ${S.border}`, background: S.card, color: S.white, cursor: 'pointer', fontSize: 13, fontFamily: 'inherit', textAlign: 'right' }}>
                  <span>{size.name_en || size.name}</span>
                  <span style={{ color: S.gold, fontWeight: 700 }}>MYR {size.price.toFixed(2)}</span>
                </button>
              ))}
            </div>
            <button onClick={() => setSizePickerItem(null)} style={{ width: '100%', marginTop: 14, padding: '10px 0', borderRadius: 10, border: `1px solid ${S.border}`, background: 'transparent', color: S.muted, cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>إلغاء</button>
          </div>
        </div>
      )}
    </div>
  )
}
