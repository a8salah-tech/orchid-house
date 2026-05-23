'use client'
export const dynamic = 'force-dynamic'

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
  teal: '#14B8A6', tealB: 'rgba(20,184,166,0.12)',
  card: 'rgba(255,255,255,0.04)', card2: 'rgba(255,255,255,0.08)',
}

type Customer = {
  id: string; name: string; email?: string; phone?: string
  total_visits: number; total_spent: number; loyalty_points: number
  created_at: string
}

// Loyalty tiers
const TIERS = [
  { name: 'Bronze',   min: 0,    max: 499,  color: '#CD7F32', bg: 'rgba(205,127,50,0.12)',  icon: '🥉', perks: ['5% discount on birthdays', 'Welcome gift'] },
  { name: 'Silver',   min: 500,  max: 1499, color: '#C0C0C0', bg: 'rgba(192,192,192,0.12)', icon: '🥈', perks: ['10% discount', 'Priority reservation', 'Free dessert on birthday'] },
  { name: 'Gold',     min: 1500, max: 2999, color: S.gold,    bg: S.gold3,                  icon: '🥇', perks: ['15% discount', 'Free appetizer', 'VIP table', 'Monthly gift'] },
  { name: 'Platinum', min: 3000, max: Infinity, color: S.blue, bg: S.blueB,                 icon: '💎', perks: ['20% discount', 'Personal waiter', 'Chef\'s table', 'Exclusive events'] },
]

function getTier(points: number) {
  return TIERS.find(t => points >= t.min && points <= t.max) || TIERS[0]
}

function getNextTier(points: number) {
  const idx = TIERS.findIndex(t => points >= t.min && points <= t.max)
  return idx < TIERS.length - 1 ? TIERS[idx + 1] : null
}

// Points adjustment modal
function AdjustPointsModal({ customer, onClose, onSaved }: { customer: Customer; onClose: () => void; onSaved: () => void }) {
  const sbRef = useRef(createClient())
  const sb = sbRef.current
  const [action, setAction] = useState<'add' | 'deduct' | 'set'>('add')
  const [points, setPoints] = useState('')
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)

  async function save() {
    const pts = parseInt(points) || 0
    if (!pts) { alert('Enter points amount'); return }
    setSaving(true)
    let newPoints = customer.loyalty_points
    if (action === 'add') newPoints += pts
    else if (action === 'deduct') newPoints = Math.max(0, newPoints - pts)
    else newPoints = pts
    await sb.from('customers').update({ loyalty_points: newPoints }).eq('id', customer.id)
    setSaving(false)
    onSaved()
    onClose()
  }

  const inp: React.CSSProperties = { width: '100%', background: 'rgba(255,255,255,.04)', border: `1px solid ${S.border}`, borderRadius: 10, padding: '10px 14px', fontSize: 13, color: S.white, outline: 'none', fontFamily: 'Tajawal, sans-serif', boxSizing: 'border-box' as const }

  const tier = getTier(customer.loyalty_points)

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.85)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: S.navy2, borderRadius: 20, border: `1px solid ${S.border}`, width: '100%', maxWidth: 420, padding: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ color: S.white, fontSize: 16, fontWeight: 800 }}>🎁 Adjust Points — {customer.name}</h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: S.muted, fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>

        <div style={{ background: S.card, borderRadius: 12, padding: 14, marginBottom: 20, textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: S.muted, marginBottom: 4 }}>Current Balance</div>
          <div style={{ fontSize: 32, fontWeight: 900, color: tier.color }}>{customer.loyalty_points.toLocaleString()}</div>
          <div style={{ fontSize: 12, color: tier.color }}>{tier.icon} {tier.name}</div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 16 }}>
          {[{ k: 'add', l: '➕ Add', c: S.green }, { k: 'deduct', l: '➖ Deduct', c: S.red }, { k: 'set', l: '⚙️ Set', c: S.blue }].map(a => (
            <button key={a.k} onClick={() => setAction(a.k as any)} style={{ padding: '10px', borderRadius: 10, border: `1px solid ${action === a.k ? a.c : S.border}`, background: action === a.k ? a.c + '20' : 'transparent', color: action === a.k ? a.c : S.muted, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', fontWeight: action === a.k ? 700 : 400 }}>
              {a.l}
            </button>
          ))}
        </div>

        {/* Quick amounts */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          {[50, 100, 200, 500].map(p => (
            <button key={p} onClick={() => setPoints(p.toString())} style={{ flex: 1, padding: '8px', borderRadius: 8, border: `1px solid ${S.border}`, background: points === p.toString() ? S.gold3 : 'transparent', color: points === p.toString() ? S.gold : S.muted, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif' }}>
              {p}
            </button>
          ))}
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>Points Amount</label>
          <input type="number" style={inp} value={points} onChange={e => setPoints(e.target.value)} placeholder="Enter amount..." />
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>Reason (optional)</label>
          <input style={inp} value={reason} onChange={e => setReason(e.target.value)} placeholder="Birthday bonus, redemption..." />
        </div>

        {points && (
          <div style={{ background: S.card, borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: S.muted }}>
            New balance: <span style={{ color: S.white, fontWeight: 700 }}>
              {action === 'add' ? customer.loyalty_points + (parseInt(points)||0)
               : action === 'deduct' ? Math.max(0, customer.loyalty_points - (parseInt(points)||0))
               : parseInt(points)||0} pts
            </span>
          </div>
        )}

        <button onClick={save} disabled={saving} style={{ width: '100%', padding: '12px', borderRadius: 12, border: 'none', background: `linear-gradient(135deg,${S.gold},${S.gold2})`, color: S.navy, cursor: 'pointer', fontWeight: 800, fontSize: 15, fontFamily: 'Tajawal, sans-serif' }}>
          {saving ? '⏳...' : '✅ Confirm'}
        </button>
      </div>
    </div>
  )
}

// ══ Main ══
export default function LoyaltyPage() {
  const sbRef = useRef(createClient())
  const sb = sbRef.current

  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [tierFilter, setTierFilter] = useState('all')
  const [adjustCustomer, setAdjustCustomer] = useState<Customer | null>(null)

  const fetchCustomers = useCallback(async () => {
    const { data } = await sb.from('customers').select('id,name,email,phone,total_visits,total_spent,loyalty_points,created_at').order('loyalty_points', { ascending: false })
    setCustomers(data || [])
    setLoading(false)
  }, [sb])

  useEffect(() => { fetchCustomers() }, [fetchCustomers])

  const filtered = customers.filter(c => {
    const matchSearch = !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.phone?.includes(search)
    const tier = getTier(c.loyalty_points)
    const matchTier = tierFilter === 'all' || tier.name.toLowerCase() === tierFilter
    return matchSearch && matchTier
  })

  const stats = {
    total: customers.length,
    totalPoints: customers.reduce((s, c) => s + c.loyalty_points, 0),
    platinum: customers.filter(c => c.loyalty_points >= 3000).length,
    gold: customers.filter(c => c.loyalty_points >= 1500 && c.loyalty_points < 3000).length,
    silver: customers.filter(c => c.loyalty_points >= 500 && c.loyalty_points < 1500).length,
    bronze: customers.filter(c => c.loyalty_points < 500).length,
  }

  const inp: React.CSSProperties = { background: 'rgba(255,255,255,.04)', border: `1px solid ${S.border}`, borderRadius: 10, padding: '9px 14px', fontSize: 13, color: S.white, outline: 'none', fontFamily: 'Tajawal, sans-serif', boxSizing: 'border-box' as const }

  return (
    <div style={{ fontFamily: 'Tajawal, sans-serif', color: S.white }}>
      <style>{`select option{background:#0F2040;color:#FAFAF8}`}</style>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 900, marginBottom: 4 }}>🎁 Loyalty Program</h1>
        <p style={{ fontSize: 13, color: S.muted }}>Manage customer loyalty points and tiers</p>
      </div>

      {/* Tier Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 14, marginBottom: 28 }}>
        {TIERS.map((tier, i) => {
          const count = [stats.bronze, stats.silver, stats.gold, stats.platinum][i]
          return (
            <div key={tier.name} style={{ background: tier.bg, border: `1px solid ${tier.color}40`, borderRadius: 18, padding: '18px 20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 22 }}>{tier.icon}</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: tier.color, marginTop: 4 }}>{tier.name}</div>
                  <div style={{ fontSize: 11, color: S.muted }}>{tier.min.toLocaleString()}+ pts</div>
                </div>
                <div style={{ fontSize: 28, fontWeight: 900, color: tier.color }}>{count}</div>
              </div>
              <div style={{ borderTop: `1px solid ${tier.color}30`, paddingTop: 10 }}>
                {tier.perks.slice(0, 2).map((p, j) => (
                  <div key={j} style={{ fontSize: 10, color: S.muted, marginBottom: 3 }}>✓ {p}</div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* Stats bar */}
      <div style={{ background: S.card2, borderRadius: 14, border: `1px solid ${S.border}`, padding: '14px 18px', marginBottom: 20, display: 'flex', gap: 24, flexWrap: 'wrap' }}>
        <div><div style={{ fontSize: 11, color: S.muted }}>Total Members</div><div style={{ fontSize: 20, fontWeight: 800 }}>{stats.total}</div></div>
        <div><div style={{ fontSize: 11, color: S.muted }}>Total Points Issued</div><div style={{ fontSize: 20, fontWeight: 800, color: S.gold }}>{stats.totalPoints.toLocaleString()}</div></div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <input style={{ ...inp, flex: 1, minWidth: 200 }} placeholder="🔍 Search customer..." value={search} onChange={e => setSearch(e.target.value)} />
        <select style={{ ...inp, width: 'auto', cursor: 'pointer' }} value={tierFilter} onChange={e => setTierFilter(e.target.value)}>
          <option value="all">All Tiers</option>
          <option value="bronze">🥉 Bronze</option>
          <option value="silver">🥈 Silver</option>
          <option value="gold">🥇 Gold</option>
          <option value="platinum">💎 Platinum</option>
        </select>
      </div>

      {/* Customers list */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: S.muted }}>⏳ Loading...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: S.muted }}>No customers found</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(c => {
            const tier = getTier(c.loyalty_points)
            const next = getNextTier(c.loyalty_points)
            const progress = next ? ((c.loyalty_points - tier.min) / (next.min - tier.min)) * 100 : 100
            return (
              <div key={c.id} style={{ background: S.navy2, borderRadius: 16, border: `1px solid ${S.border}`, padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>

                {/* Avatar */}
                <div style={{ width: 44, height: 44, borderRadius: '50%', background: tier.bg, border: `2px solid ${tier.color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
                  {tier.icon}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 150 }}>
                  <div style={{ fontWeight: 800, fontSize: 15, color: S.white, marginBottom: 2 }}>{c.name}</div>
                  <div style={{ fontSize: 11, color: S.muted }}>{c.phone || c.email || '—'}</div>
                  <div style={{ fontSize: 11, color: tier.color, fontWeight: 600, marginTop: 2 }}>{tier.icon} {tier.name}</div>
                </div>

                {/* Points + Progress */}
                <div style={{ flex: 2, minWidth: 180 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 13, color: S.white, fontWeight: 700 }}>{c.loyalty_points.toLocaleString()} pts</span>
                    {next && <span style={{ fontSize: 11, color: S.muted }}>{(next.min - c.loyalty_points).toLocaleString()} to {next.name}</span>}
                  </div>
                  <div style={{ background: 'rgba(255,255,255,.08)', borderRadius: 20, height: 6, overflow: 'hidden' }}>
                    <div style={{ width: `${Math.min(100, progress)}%`, height: '100%', background: `linear-gradient(90deg,${tier.color},${next?.color || tier.color})`, borderRadius: 20, transition: 'width .5s' }} />
                  </div>
                </div>

                {/* Stats */}
                <div style={{ display: 'flex', gap: 16, flexShrink: 0 }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: S.blue }}>{c.total_visits}</div>
                    <div style={{ fontSize: 10, color: S.muted }}>Visits</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: S.gold }}>MYR {c.total_spent.toFixed(0)}</div>
                    <div style={{ fontSize: 10, color: S.muted }}>Spent</div>
                  </div>
                </div>

                {/* Actions */}
                <button onClick={() => setAdjustCustomer(c)}
                  style={{ padding: '8px 14px', borderRadius: 10, border: `1px solid ${S.gold}`, background: S.gold3, color: S.gold, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', fontWeight: 700, flexShrink: 0 }}>
                  🎁 Points
                </button>
              </div>
            )
          })}
        </div>
      )}

      {adjustCustomer && (
        <AdjustPointsModal customer={adjustCustomer} onClose={() => setAdjustCustomer(null)} onSaved={fetchCustomers} />
      )}
    </div>
  )
}
