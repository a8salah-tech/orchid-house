'use client'


import { useEffect, useState, useRef, useCallback } from 'react'
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
  purple: '#8B5CF6', purpleB: 'rgba(139,92,246,0.12)',
  card: 'rgba(255,255,255,0.04)', card2: 'rgba(255,255,255,0.08)',
}

type Coupon = {
  id: string; code: string; description?: string
  discount_type: 'percent' | 'amount' | 'free'
  discount_value: number; min_order_amount: number
  max_uses?: number; used_count: number
  is_active: boolean; expires_at?: string; created_at: string
}

function CouponModal({ coupon, onClose, onSaved }: { coupon?: Coupon | null; onClose: () => void; onSaved: () => void }) {
  const sbRef = useRef(createClient())
  const sb = sbRef.current
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    code: coupon?.code || '',
    description: coupon?.description || '',
    discount_type: coupon?.discount_type || 'percent',
    discount_value: coupon?.discount_value?.toString() || '',
    min_order_amount: coupon?.min_order_amount?.toString() || '0',
    max_uses: coupon?.max_uses?.toString() || '',
    expires_at: coupon?.expires_at ? coupon.expires_at.split('T')[0] : '',
    is_active: coupon?.is_active !== false,
  })

  function generateCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    const code = Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
    setForm(p => ({ ...p, code }))
  }

  async function save() {
    if (!form.code.trim()) { alert('Coupon code is required'); return }
    setSaving(true)
    const payload: any = {
      code: form.code.toUpperCase().trim(),
      description: form.description || null,
      discount_type: form.discount_type,
      discount_value: parseFloat(form.discount_value) || 0,
      min_order_amount: parseFloat(form.min_order_amount) || 0,
      max_uses: form.max_uses ? parseInt(form.max_uses) : null,
      expires_at: form.expires_at ? new Date(form.expires_at).toISOString() : null,
      is_active: form.is_active,
    }
    let error
    if (coupon) {
      ({ error } = await sb.from('coupons').update(payload).eq('id', coupon.id))
    } else {
      ({ error } = await sb.from('coupons').insert([payload]))
    }
    setSaving(false)
    if (error) { alert('Error: ' + error.message); return }
    onSaved()
  }

  const inp: React.CSSProperties = { width: '100%', background: 'rgba(255,255,255,.04)', border: `1px solid ${S.border}`, borderRadius: 10, padding: '10px 14px', fontSize: 13, color: S.white, outline: 'none', fontFamily: 'Tajawal, sans-serif', boxSizing: 'border-box' as const }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.85)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: S.navy2, borderRadius: 20, border: `1px solid ${S.border}`, width: '100%', maxWidth: 500, padding: 28, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ color: S.white, fontSize: 17, fontWeight: 800 }}>{coupon ? '✏️ Edit Coupon' : '➕ New Coupon'}</h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: S.muted, fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Code */}
          <div>
            <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>Coupon Code *</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input style={{ ...inp, flex: 1, textTransform: 'uppercase', letterSpacing: 2, fontWeight: 700 }}
                placeholder="e.g. SUMMER20" value={form.code}
                onChange={e => setForm(p => ({ ...p, code: e.target.value.toUpperCase() }))} />
              <button onClick={generateCode} style={{ padding: '10px 14px', borderRadius: 10, border: `1px solid ${S.blue}`, background: S.blueB, color: S.blue, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', whiteSpace: 'nowrap' }}>🎲 Generate</button>
            </div>
          </div>

          {/* Description */}
          <div>
            <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>Description</label>
            <input style={inp} placeholder="e.g. Summer 20% off" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
          </div>

          {/* Discount Type */}
          <div>
            <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 8 }}>Discount Type</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
              {[
                { k: 'percent', l: '% Percent', c: S.amber },
                { k: 'amount', l: 'MYR Amount', c: S.green },
                { k: 'free', l: '🎁 Free', c: S.purple },
              ].map(t => (
                <button key={t.k} onClick={() => setForm(p => ({ ...p, discount_type: t.k as any }))}
                  style={{ padding: '10px 8px', borderRadius: 10, border: `1px solid ${form.discount_type === t.k ? t.c : S.border}`, background: form.discount_type === t.k ? t.c + '20' : 'transparent', color: form.discount_type === t.k ? t.c : S.muted, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', fontWeight: form.discount_type === t.k ? 700 : 400 }}>
                  {t.l}
                </button>
              ))}
            </div>
          </div>

          {/* Discount Value */}
          {form.discount_type !== 'free' && (
            <div>
              <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>
                {form.discount_type === 'percent' ? 'Discount %' : 'Discount Amount (MYR)'}
              </label>
              <input type="number" style={inp} value={form.discount_value}
                onChange={e => setForm(p => ({ ...p, discount_value: e.target.value }))}
                placeholder={form.discount_type === 'percent' ? '20' : '10.00'} />
            </div>
          )}

          {/* Min Order */}
          <div>
            <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>Minimum Order Amount (MYR)</label>
            <input type="number" style={inp} value={form.min_order_amount}
              onChange={e => setForm(p => ({ ...p, min_order_amount: e.target.value }))} placeholder="0" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {/* Max Uses */}
            <div>
              <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>Max Uses (empty = unlimited)</label>
              <input type="number" style={inp} value={form.max_uses}
                onChange={e => setForm(p => ({ ...p, max_uses: e.target.value }))} placeholder="∞" />
            </div>
            {/* Expiry */}
            <div>
              <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>Expiry Date</label>
              <input type="date" style={inp} value={form.expires_at}
                onChange={e => setForm(p => ({ ...p, expires_at: e.target.value }))} />
            </div>
          </div>

          {/* Active */}
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', background: S.card, borderRadius: 10, padding: '10px 14px' }}>
            <input type="checkbox" checked={form.is_active} onChange={e => setForm(p => ({ ...p, is_active: e.target.checked }))} style={{ accentColor: S.green, width: 16, height: 16 }} />
            <div>
              <div style={{ fontSize: 13, color: S.white, fontWeight: 600 }}>Active</div>
              <div style={{ fontSize: 11, color: S.muted }}>Coupon can be used by customers</div>
            </div>
          </label>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button onClick={onClose} style={{ padding: '11px 20px', borderRadius: 10, border: `1px solid ${S.muted}`, background: 'transparent', color: S.muted, cursor: 'pointer', fontFamily: 'Tajawal, sans-serif' }}>Cancel</button>
          <button onClick={save} disabled={saving} style={{ flex: 1, padding: '11px', borderRadius: 10, border: `1px solid ${S.gold}`, background: S.gold3, color: S.gold, cursor: 'pointer', fontSize: 14, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
            {saving ? '⏳...' : coupon ? '💾 Save' : '✅ Create Coupon'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function CouponsPage() {
  const sbRef = useRef(createClient())
  const sb = sbRef.current

  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive' | 'expired'>('all')
  const [showAdd, setShowAdd] = useState(false)
  const [editCoupon, setEditCoupon] = useState<Coupon | null>(null)
  const [copied, setCopied] = useState('')

  const fetchCoupons = useCallback(async () => {
    const { data } = await sb.from('coupons').select('*').order('created_at', { ascending: false })
    setCoupons(data || [])
    setLoading(false)
  }, [sb])

  useEffect(() => { fetchCoupons() }, [fetchCoupons])

  async function toggleActive(id: string, current: boolean) {
    await sb.from('coupons').update({ is_active: !current }).eq('id', id)
    fetchCoupons()
  }

  async function deleteCoupon(id: string) {
    if (!confirm('Delete this coupon?')) return
    await sb.from('coupons').delete().eq('id', id)
    fetchCoupons()
  }

  function copyCode(code: string) {
    navigator.clipboard.writeText(code)
    setCopied(code)
    setTimeout(() => setCopied(''), 2000)
  }

  function isExpired(c: Coupon) {
    return c.expires_at && new Date(c.expires_at) < new Date()
  }

  function isMaxed(c: Coupon) {
    return c.max_uses != null && c.used_count >= c.max_uses
  }

  const filtered = coupons.filter(c => {
    const matchSearch = !search || c.code.includes(search.toUpperCase()) || c.description?.toLowerCase().includes(search.toLowerCase())
    const expired = isExpired(c) || isMaxed(c)
    const matchFilter = filter === 'all' ? true
      : filter === 'active' ? c.is_active && !expired
      : filter === 'inactive' ? !c.is_active
      : expired
    return matchSearch && matchFilter
  })

  const counts = {
    all: coupons.length,
    active: coupons.filter(c => c.is_active && !isExpired(c) && !isMaxed(c)).length,
    inactive: coupons.filter(c => !c.is_active).length,
    expired: coupons.filter(c => isExpired(c) || isMaxed(c)).length,
  }

  function discountLabel(c: Coupon) {
    if (c.discount_type === 'free') return '🎁 Free'
    if (c.discount_type === 'percent') return `${c.discount_value}% OFF`
    return `MYR ${c.discount_value.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} OFF`
  }

  const inp: React.CSSProperties = { background: 'rgba(255,255,255,.04)', border: `1px solid ${S.border}`, borderRadius: 10, padding: '9px 14px', fontSize: 13, color: S.white, outline: 'none', fontFamily: 'Tajawal, sans-serif', boxSizing: 'border-box' as const }

  return (
    <div style={{ fontFamily: 'Tajawal, sans-serif', color: S.white }}>
      <style>{`select option{background:#0F2040;color:#FAFAF8}`}</style>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 900, marginBottom: 4 }}>🎫 Coupon Codes</h1>
          <p style={{ fontSize: 13, color: S.muted }}>Create and manage discount coupons</p>
        </div>
        <button onClick={() => setShowAdd(true)} style={{ padding: '10px 20px', borderRadius: 12, border: `1px solid ${S.gold}`, background: S.gold3, color: S.gold, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>➕ New Coupon</button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 12, marginBottom: 24 }}>
        {([['all','Total','#fff'], ['active','Active',S.green], ['inactive','Inactive',S.muted], ['expired','Expired',S.red]] as const).map(([k,l,c]) => (
          <div key={k} onClick={() => setFilter(k)} style={{ background: filter === k ? c + '15' : S.card2, border: `1px solid ${filter === k ? c : S.border}`, borderRadius: 14, padding: '14px 16px', cursor: 'pointer', transition: 'all .2s' }}>
            <div style={{ fontSize: 11, color: S.muted, marginBottom: 4 }}>{l}</div>
            <div style={{ fontSize: 24, fontWeight: 900, color: c }}>{counts[k]}</div>
          </div>
        ))}
      </div>

      {/* Search */}
      <input style={{ ...inp, width: '100%', marginBottom: 16 }} placeholder="🔍 Search coupon code or description..." value={search} onChange={e => setSearch(e.target.value)} />

      {/* List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: S.muted }}>⏳ Loading...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: S.muted }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🎫</div>
          <div>No coupons found</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filtered.map(c => {
            const expired = isExpired(c) || isMaxed(c)
            const statusColor = !c.is_active ? S.muted : expired ? S.red : S.green
            const statusLabel = !c.is_active ? 'Inactive' : expired ? 'Expired' : 'Active'
            return (
              <div key={c.id} style={{ background: S.navy2, borderRadius: 16, border: `1px solid ${expired ? S.red + '30' : c.is_active ? S.border : S.border}`, overflow: 'hidden' }}>
                <div style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>

                  {/* Code */}
                  <div style={{ background: S.navy3, borderRadius: 10, padding: '10px 16px', border: `2px dashed ${S.gold}40`, minWidth: 140 }}>
                    <div style={{ fontSize: 18, fontWeight: 900, color: S.gold, letterSpacing: 3 }}>{c.code}</div>
                    <div style={{ fontSize: 11, color: S.muted, marginTop: 2 }}>{c.description || 'No description'}</div>
                  </div>

                  {/* Discount badge */}
                  <div style={{ background: c.discount_type === 'free' ? S.purpleB : c.discount_type === 'percent' ? S.amberB : S.greenB, border: `1px solid ${c.discount_type === 'free' ? S.purple : c.discount_type === 'percent' ? S.amber : S.green}40`, borderRadius: 12, padding: '8px 14px', textAlign: 'center' }}>
                    <div style={{ fontSize: 20, fontWeight: 900, color: c.discount_type === 'free' ? S.purple : c.discount_type === 'percent' ? S.amber : S.green }}>{discountLabel(c)}</div>
                    {c.min_order_amount > 0 && <div style={{ fontSize: 10, color: S.muted }}>min MYR {c.min_order_amount.toFixed(0)}</div>}
                  </div>

                  {/* Stats */}
                  <div style={{ flex: 1, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ fontSize: 11, color: S.muted }}>Used</div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: S.white }}>{c.used_count}{c.max_uses ? `/${c.max_uses}` : ''}</div>
                    </div>
                    {c.expires_at && (
                      <div>
                        <div style={{ fontSize: 11, color: S.muted }}>Expires</div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: expired ? S.red : S.white }}>{new Date(c.expires_at).toLocaleDateString('en-GB')}</div>
                      </div>
                    )}
                    <div>
                      <div style={{ fontSize: 11, color: S.muted }}>Status</div>
                      <span style={{ background: statusColor + '20', color: statusColor, borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 700 }}>{statusLabel}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                    <button onClick={() => copyCode(c.code)} style={{ padding: '7px 12px', borderRadius: 8, border: `1px solid ${S.blue}`, background: copied === c.code ? S.greenB : S.blueB, color: copied === c.code ? S.green : S.blue, cursor: 'pointer', fontSize: 12 }}>
                      {copied === c.code ? '✅' : '📋'}
                    </button>
                    <button onClick={() => toggleActive(c.id, c.is_active)} style={{ padding: '7px 12px', borderRadius: 8, border: `1px solid ${c.is_active ? S.amber : S.green}`, background: c.is_active ? S.amberB : S.greenB, color: c.is_active ? S.amber : S.green, cursor: 'pointer', fontSize: 12 }}>
                      {c.is_active ? '⏸' : '▶'}
                    </button>
                    <button onClick={() => setEditCoupon(c)} style={{ padding: '7px 12px', borderRadius: 8, border: `1px solid ${S.gold}`, background: S.gold3, color: S.gold, cursor: 'pointer', fontSize: 12 }}>✏️</button>
                    <button onClick={() => deleteCoupon(c.id)} style={{ padding: '7px 12px', borderRadius: 8, border: `1px solid ${S.red}`, background: S.redB, color: S.red, cursor: 'pointer', fontSize: 12 }}>🗑️</button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {(showAdd || editCoupon) && (
        <CouponModal coupon={editCoupon} onClose={() => { setShowAdd(false); setEditCoupon(null) }} onSaved={() => { setShowAdd(false); setEditCoupon(null); fetchCoupons() }} />
      )}
    </div>
  )
}
