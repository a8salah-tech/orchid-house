'use client'


import { useEffect, useState, useRef, useCallback } from 'react'
import { createBrowserClient } from '@supabase/ssr'

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
  purple: '#8B5CF6', purpleB: 'rgba(139,92,246,0.12)',
  teal: '#14B8A6', tealB: 'rgba(20,184,166,0.12)',
  card: 'rgba(255,255,255,0.04)', card2: 'rgba(255,255,255,0.08)',
}

type Customer = {
  id: string; name: string; email?: string; phone?: string
  nationality?: string; birthday?: string; notes?: string
  total_visits: number; total_spent: number; loyalty_points: number
  created_at: string
}

// ══ Add/Edit Modal ══
function CustomerModal({ customer, onClose, onSaved }: { customer?: Customer | null; onClose: () => void; onSaved: () => void }) {
  const sbRef = useRef(createClient())
  const sb = sbRef.current
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: customer?.name || '',
    email: customer?.email || '',
    phone: customer?.phone || '',
    nationality: customer?.nationality || '',
    birthday: customer?.birthday || '',
    notes: customer?.notes || '',
    loyalty_points: customer?.loyalty_points?.toString() || '0',
  })

  async function save() {
    if (!form.name.trim()) { alert('Name is required'); return }
    setSaving(true)
    const payload = {
      name: form.name,
      email: form.email || null,
      phone: form.phone || null,
      nationality: form.nationality || null,
      birthday: form.birthday || null,
      notes: form.notes || null,
      loyalty_points: parseInt(form.loyalty_points) || 0,
    }
    let error
    if (customer) {
      ({ error } = await sb.from('customers').update(payload).eq('id', customer.id))
    } else {
      ({ error } = await sb.from('customers').insert([payload]))
    }
    setSaving(false)
    if (error) { alert('Error: ' + error.message); return }
    onSaved()
  }

  const inp: React.CSSProperties = {
    width: '100%', background: 'rgba(255,255,255,.04)',
    border: `1px solid ${S.border}`, borderRadius: 10,
    padding: '10px 14px', fontSize: 13, color: S.white,
    outline: 'none', fontFamily: 'Tajawal, sans-serif', boxSizing: 'border-box' as const,
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.85)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: S.navy2, borderRadius: 20, border: `1px solid ${S.border}`, width: '100%', maxWidth: 500, padding: 28, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ color: S.white, fontSize: 17, fontWeight: 800 }}>{customer ? '✏️ Edit Customer' : '➕ Add Customer'}</h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: S.muted, fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>Full Name *</label>
            <input style={inp} placeholder="John Smith" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>Email</label>
              <input type="email" style={inp} placeholder="email@example.com" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
            </div>
            <div>
              <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>Phone</label>
              <input style={inp} placeholder="+60 12-345 6789" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>Nationality</label>
              <input style={inp} placeholder="Malaysian" value={form.nationality} onChange={e => setForm(p => ({ ...p, nationality: e.target.value }))} />
            </div>
            <div>
              <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>Birthday</label>
              <input type="date" style={inp} value={form.birthday} onChange={e => setForm(p => ({ ...p, birthday: e.target.value }))} />
            </div>
          </div>
          <div>
            <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>🎁 Loyalty Points</label>
            <input type="number" style={inp} value={form.loyalty_points} onChange={e => setForm(p => ({ ...p, loyalty_points: e.target.value }))} />
          </div>
          <div>
            <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>Notes</label>
            <textarea style={{ ...inp, minHeight: 70, resize: 'vertical' as const }} placeholder="VIP customer, allergies..." value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button onClick={onClose} style={{ padding: '11px 20px', borderRadius: 10, border: `1px solid ${S.muted}`, background: 'transparent', color: S.muted, cursor: 'pointer', fontFamily: 'Tajawal, sans-serif' }}>Cancel</button>
          <button onClick={save} disabled={saving} style={{ flex: 1, padding: '11px', borderRadius: 10, border: `1px solid ${S.gold}`, background: S.gold3, color: S.gold, cursor: 'pointer', fontSize: 14, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
            {saving ? '⏳...' : customer ? '💾 Save' : '✅ Add Customer'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ══ Customer Detail Modal ══
function CustomerDetail({ customer, onClose, onEdit, onRefresh }: { customer: Customer; onClose: () => void; onEdit: () => void; onRefresh: () => void }) {
  const sbRef = useRef(createClient())
  const sb = sbRef.current
  const [bookings, setBookings] = useState<any[]>([])
  const [customerOrders, setCustomerOrders] = useState<any[]>([])
  // ✅ جديد: عربونات العميل - كل السجل (متاح/مستخدم) + فورم إضافة عربون جديد
  const [deposits, setDeposits] = useState<any[]>([])
  const [depAmount, setDepAmount] = useState('')
  const [depMethod, setDepMethod] = useState<'cash' | 'visa' | 'online'>('cash')
  const [depCardBank, setDepCardBank] = useState<'maybank' | 'bsn' | ''>('')
  const [depSaving, setDepSaving] = useState(false)

  const fetchDeposits = useCallback(() => {
    sb.from('customer_deposits').select('*').eq('customer_id', customer.id).order('created_at', { ascending: false })
      .then(({ data }) => setDeposits(data || []))
  }, [sb, customer.id])

  useEffect(() => {
    sb.from('bookings').select('*').eq('customer_id', customer.id).order('booking_date', { ascending: false }).limit(10)
      .then(({ data }) => setBookings(data || []))
    // ✅ سجل الطلبات - يوضح رقم/اسم الطاولة والمبلغ لكل طلب مرتبط بالعميل ده
    // (بما في ذلك العملاء اللي اتسجلوا من لعبة "مين هيدفع؟" واللي اترتبطوا بالكاشير وقت الدفع)
    sb.from('orders').select('id,total_amount,status,created_at,paid_at,tables(number,name)').eq('customer_id', customer.id).order('created_at', { ascending: false }).limit(10)
      .then(({ data }) => setCustomerOrders(data || []))
    fetchDeposits()
  }, [customer.id])

  async function addPoints(pts: number) {
    await sb.from('customers').update({ loyalty_points: customer.loyalty_points + pts }).eq('id', customer.id)
    onRefresh()
  }

  const thS: React.CSSProperties = { padding: '8px 12px', fontSize: 11, color: S.muted, fontWeight: 700, borderBottom: `1px solid ${S.border}`, textAlign: 'left' as const }
  // ✅ جديد: نمط input محلي - مكنش معرّف في نطاق المكوّن ده أصلاً (بس في CustomerModal والمكوّن الرئيسي)
  const inp: React.CSSProperties = { background: 'rgba(255,255,255,.04)', border: `1px solid ${S.border}`, borderRadius: 10, padding: '9px 14px', fontSize: 13, color: S.white, outline: 'none', fontFamily: 'Tajawal, sans-serif', boxSizing: 'border-box' as const }
  const tdS: React.CSSProperties = { padding: '8px 12px', fontSize: 12, color: S.white, borderBottom: `1px solid ${S.border}` }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.85)', zIndex: 300, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 20, overflowY: 'auto' }}>
      <div style={{ background: S.navy2, borderRadius: 20, border: `1px solid ${S.border}`, width: '100%', maxWidth: 620, padding: 28, margin: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ color: S.white, fontSize: 18, fontWeight: 800 }}>👤 {customer.name}</h2>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onEdit} style={{ padding: '8px 14px', borderRadius: 10, border: `1px solid ${S.gold}`, background: S.gold3, color: S.gold, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>✏️ Edit</button>
            <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: S.muted, fontSize: 20, cursor: 'pointer' }}>✕</button>
          </div>
        </div>

        {/* Info Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
          {[
            { label: 'Total Visits', value: customer.total_visits, color: S.blue, icon: '🍽️' },
            { label: 'Total Spent', value: `MYR ${customer.total_spent.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, color: S.gold, icon: '💰' },
            { label: 'Loyalty Points', value: customer.loyalty_points, color: S.green, icon: '🎁' },
            // ✅ جديد: رصيد العربون المتاح حاليًا (لسه متطبقش على أي فاتورة)
            { label: 'Deposit Balance', value: `MYR ${deposits.filter(d => d.status === 'available').reduce((s, d) => s + (d.amount || 0), 0).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, color: S.teal, icon: '💵' },
          ].map((s, i) => (
            <div key={i} style={{ background: S.card, borderRadius: 12, padding: '14px 16px', border: `1px solid ${S.border}`, textAlign: 'center' }}>
              <div style={{ fontSize: 20, marginBottom: 4 }}>{s.icon}</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 11, color: S.muted }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Details */}
        <div style={{ background: S.card, borderRadius: 14, padding: 16, marginBottom: 16 }}>
          {[
            { label: '📧 Email', value: customer.email },
            { label: '📱 Phone', value: customer.phone },
            { label: '🌍 Nationality', value: customer.nationality },
            { label: '🎂 Birthday', value: customer.birthday ? new Date(customer.birthday).toLocaleDateString('en-GB') : null },
            { label: '📝 Notes', value: customer.notes },
            { label: '📅 Member Since', value: new Date(customer.created_at).toLocaleDateString('en-GB') },
          ].filter(r => r.value).map((r, i) => (
            <div key={i} style={{ display: 'flex', gap: 12, padding: '6px 0', borderBottom: `1px solid ${S.border}`, fontSize: 13 }}>
              <span style={{ color: S.muted, minWidth: 120 }}>{r.label}</span>
              <span style={{ color: S.white }}>{r.value}</span>
            </div>
          ))}
        </div>

        {/* Quick Points */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: S.muted, marginBottom: 8 }}>Quick Add Points</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {[10, 25, 50, 100].map(pts => (
              <button key={pts} onClick={() => addPoints(pts)} style={{ flex: 1, padding: '8px', borderRadius: 8, border: `1px solid ${S.green}`, background: S.greenB, color: S.green, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
                +{pts}
              </button>
            ))}
          </div>
        </div>

        {/* ✅ جديد: تسجيل عربون جديد (Deposit) - بيظهر تلقائيًا في الكاشير لما يبحث برقم تليفون العميل ده */}
        <div style={{ marginBottom: 16, background: S.card, borderRadius: 14, padding: 16 }}>
          <div style={{ fontSize: 13, color: S.white, fontWeight: 700, marginBottom: 10 }}>💰 Take New Deposit</div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <input type="number" style={{ ...inp, flex: 1 }} placeholder="Amount (MYR)" value={depAmount} onChange={e => setDepAmount(e.target.value)} />
            <select style={{ ...inp, width: 130 }} value={depMethod} onChange={e => setDepMethod(e.target.value as any)}>
              <option value="cash">💵 Cash</option>
              <option value="visa">💳 Visa</option>
              <option value="online">📱 Online</option>
            </select>
          </div>
          {depMethod === 'visa' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
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
              if (!(parseFloat(depAmount) > 0)) { alert('من فضلك اكتب مبلغ صحيح'); return }
              if (depMethod === 'visa' && !depCardBank) { alert('من فضلك حدد البنك (Maybank / BSN)'); return }
              setDepSaving(true)
              const { error } = await sb.from('customer_deposits').insert([{
                customer_id: customer.id,
                amount: parseFloat(depAmount),
                status: 'available',
                payment_method: depMethod,
                card_bank: depMethod === 'visa' ? depCardBank : null,
              }])
              setDepSaving(false)
              if (error) { alert('⚠️ Failed to save deposit: ' + error.message); return }
              setDepAmount(''); setDepCardBank('')
              fetchDeposits()
            }}
            style={{ width: '100%', padding: 9, borderRadius: 8, border: 'none', background: S.teal, color: '#fff', cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', fontWeight: 700, opacity: depSaving ? 0.6 : 1 }}>
            {depSaving ? '⏳...' : '➕ Add Deposit'}
          </button>

          {/* سجل كل العربونات - متاح ومستخدم */}
          {deposits.length > 0 && (
            <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${S.border}` }}>
              <div style={{ fontSize: 11, color: S.muted, marginBottom: 8, fontWeight: 700 }}>Deposit History</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {deposits.map(d => (
                  <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
                    <span style={{ color: S.white }}>
                      {d.status === 'available' ? '🟢' : d.status === 'used' ? '⚪' : '🔴'} {d.payment_method}{d.card_bank ? ` (${d.card_bank})` : ''}
                      <span style={{ color: S.muted, fontSize: 10 }}> · {new Date(d.created_at).toLocaleDateString('en-GB')}</span>
                    </span>
                    <span style={{ color: d.status === 'available' ? S.teal : S.muted, fontWeight: 700 }}>MYR {(d.amount || 0).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Order History */}
        {customerOrders.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13, color: S.white, fontWeight: 700, marginBottom: 10 }}>🧾 Order History</div>
            <div style={{ background: S.navy3, borderRadius: 10, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr>
                  {['Date', 'Table', 'Amount', 'Status'].map(h => <th key={h} style={thS}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {customerOrders.map(o => (
                    <tr key={o.id}>
                      <td style={tdS}>{new Date(o.created_at).toLocaleDateString('en-GB')}</td>
                      <td style={tdS}>{o.tables?.name || (o.tables?.number ? `Table ${o.tables.number}` : '—')}</td>
                      <td style={{ ...tdS, color: S.gold, fontWeight: 700 }}>MYR {(o.total_amount || 0).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td style={tdS}>
                        <span style={{ background: o.status === 'paid' ? S.greenB : o.status === 'cancelled' ? S.redB : S.amberB, color: o.status === 'paid' ? S.green : o.status === 'cancelled' ? S.red : S.amber, borderRadius: 20, padding: '2px 8px', fontSize: 10, fontWeight: 700 }}>{o.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Bookings */}
        {bookings.length > 0 && (
          <div>
            <div style={{ fontSize: 13, color: S.white, fontWeight: 700, marginBottom: 10 }}>📅 Reservation History</div>
            <div style={{ background: S.navy3, borderRadius: 10, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr>
                  {['Date', 'Time', 'Section', 'Guests', 'Status'].map(h => <th key={h} style={thS}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {bookings.map(b => (
                    <tr key={b.id}>
                      <td style={tdS}>{new Date(b.booking_date).toLocaleDateString('en-GB')}</td>
                      <td style={tdS}>{b.booking_time}</td>
                      <td style={tdS}>{b.section}</td>
                      <td style={tdS}>{b.guests}</td>
                      <td style={tdS}>
                        <span style={{ background: b.status === 'confirmed' ? S.greenB : b.status === 'cancelled' ? S.redB : S.amberB, color: b.status === 'confirmed' ? S.green : b.status === 'cancelled' ? S.red : S.amber, borderRadius: 20, padding: '2px 8px', fontSize: 10, fontWeight: 700 }}>{b.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ══ Main ══
export default function CustomersPage() {
  const sbRef = useRef(createClient())
  const sb = sbRef.current

  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [editCustomer, setEditCustomer] = useState<Customer | null>(null)
  const [viewCustomer, setViewCustomer] = useState<Customer | null>(null)
  // ✅ جديد: مجموعة IDs بتاعة العملاء اللي عندهم رصيد عربون متاح - لعرض شارة سريعة في القائمة الرئيسية
  const [depositCustomerIds, setDepositCustomerIds] = useState<Set<string>>(new Set())

  const fetchCustomers = useCallback(async () => {
    const { data } = await sb.from('customers').select('*').order('created_at', { ascending: false })
    setCustomers(data || [])
    setLoading(false)
  }, [sb])

  // ✅ جديد: جلب كل العربونات المتاحة دفعة واحدة (استعلام واحد بدل واحد لكل عميل) عشان نعرف مين عنده رصيد
  const fetchDepositBalances = useCallback(async () => {
    const { data } = await sb.from('customer_deposits').select('customer_id').eq('status', 'available')
    setDepositCustomerIds(new Set((data || []).map((d: any) => d.customer_id)))
  }, [sb])

  useEffect(() => { fetchCustomers(); fetchDepositBalances() }, [fetchCustomers, fetchDepositBalances])

  useEffect(() => {
    const ch = sb.channel('customers-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'customers' }, fetchCustomers)
      .subscribe()
    return () => { sb.removeChannel(ch) }
  }, [sb, fetchCustomers])

  const filtered = customers.filter(c => {
    if (!search) return true
    const q = search.toLowerCase()
    return c.name.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q) ||
      c.phone?.includes(search) ||
      c.nationality?.toLowerCase().includes(q)
  })

  const stats = {
    total: customers.length,
    totalSpent: customers.reduce((s, c) => s + c.total_spent, 0),
    totalPoints: customers.reduce((s, c) => s + c.loyalty_points, 0),
    vip: customers.filter(c => c.total_visits >= 10).length,
  }

  function exportCSV() {
    const rows = [
      ['Name', 'Email', 'Phone', 'Nationality', 'Visits', 'Total Spent', 'Points', 'Member Since'],
      // ✅ رقم عادي بدون فواصل آلاف هنا (مش عرض) - القيمة بتتحط في خلية CSV وأي فاصلة جواها هتكسر ترقيم الأعمدة
      ...customers.map(c => [c.name, c.email||'', c.phone||'', c.nationality||'', c.total_visits, c.total_spent.toFixed(2), c.loyalty_points, new Date(c.created_at).toLocaleDateString('en-GB')])
    ]
    const csv = rows.map(r => r.join(',')).join('\n')
    const a = document.createElement('a'); a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv); a.download = 'customers.csv'; a.click()
  }

  const inp: React.CSSProperties = { background: 'rgba(255,255,255,.04)', border: `1px solid ${S.border}`, borderRadius: 10, padding: '9px 14px', fontSize: 13, color: S.white, outline: 'none', fontFamily: 'Tajawal, sans-serif', boxSizing: 'border-box' as const }

  return (
    <div style={{ fontFamily: 'Tajawal, sans-serif', color: S.white }}>
      <style>{`select option{background:#0F2040;color:#FAFAF8}`}</style>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 900, marginBottom: 4 }}>👥 Customer Database</h1>
          <p style={{ fontSize: 13, color: S.muted }}>Manage customer profiles and loyalty points</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={exportCSV} style={{ padding: '10px 16px', borderRadius: 12, border: `1px solid ${S.blue}`, background: S.blueB, color: S.blue, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>📥 Export CSV</button>
          <button onClick={() => setShowAdd(true)} style={{ padding: '10px 18px', borderRadius: 12, border: `1px solid ${S.green}`, background: S.greenB, color: S.green, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>➕ Add Customer</button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Total Customers', value: stats.total, color: S.white, icon: '👥' },
          { label: 'VIP (10+ visits)', value: stats.vip, color: S.gold, icon: '⭐' },
          { label: 'Total Spent', value: `MYR ${stats.totalSpent.toFixed(0)}`, color: S.green, icon: '💰' },
          { label: 'Loyalty Points', value: stats.totalPoints.toLocaleString(), color: S.purple, icon: '🎁' },
        ].map((s, i) => (
          <div key={i} style={{ background: S.card2, borderRadius: 14, border: `1px solid ${S.border}`, padding: '16px 18px' }}>
            <div style={{ fontSize: 20, marginBottom: 6 }}>{s.icon}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: s.color, marginBottom: 4 }}>{s.value}</div>
            <div style={{ fontSize: 11, color: S.muted }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Search */}
      <input style={{ ...inp, width: '100%', marginBottom: 16 }} placeholder="🔍 Search by name, email, phone..." value={search} onChange={e => setSearch(e.target.value)} />

      {/* Table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: S.muted }}>⏳ Loading...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: S.muted }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>👥</div>
          <div>No customers found</div>
          <button onClick={() => setShowAdd(true)} style={{ marginTop: 16, padding: '10px 20px', borderRadius: 10, border: `1px solid ${S.green}`, background: S.greenB, color: S.green, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>➕ Add First Customer</button>
        </div>
      ) : (
        <div style={{ background: S.navy2, borderRadius: 16, border: `1px solid ${S.border}`, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
              <thead>
                <tr style={{ background: S.navy3 }}>
                  {['Customer', 'Contact', 'Nationality', 'Visits', 'Total Spent', 'Points', 'Since', ''].map(h => (
                    <th key={h} style={{ padding: '12px 14px', textAlign: 'left', fontSize: 11, color: S.muted, fontWeight: 700, borderBottom: `1px solid ${S.border}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => (
                  <tr key={c.id} style={{ borderBottom: `1px solid ${S.border}`, cursor: 'pointer' }} onClick={() => setViewCustomer(c)}>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 36, height: 36, borderRadius: '50%', background: `linear-gradient(135deg,${S.blue},${S.purple})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, color: S.white, flexShrink: 0 }}>
                          {c.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, color: S.white, fontSize: 14 }}>{c.name}</div>
                          {c.total_visits >= 10 && <div style={{ fontSize: 10, color: S.gold }}>⭐ VIP</div>}
                          {depositCustomerIds.has(c.id) && <div style={{ fontSize: 10, color: S.teal }}>💰 Has Deposit</div>}
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ fontSize: 12, color: S.white }}>{c.phone || '—'}</div>
                      <div style={{ fontSize: 11, color: S.muted }}>{c.email || '—'}</div>
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: 13, color: S.muted }}>{c.nationality || '—'}</td>
                    <td style={{ padding: '12px 14px', fontSize: 13, color: S.blue, fontWeight: 700, textAlign: 'center' }}>{c.total_visits}</td>
                    <td style={{ padding: '12px 14px', fontSize: 13, color: S.gold, fontWeight: 700 }}>MYR {c.total_spent.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td style={{ padding: '12px 14px' }}>
                      <span style={{ background: S.purpleB, color: S.purple, borderRadius: 20, padding: '3px 10px', fontSize: 12, fontWeight: 700 }}>🎁 {c.loyalty_points}</span>
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: 12, color: S.muted }}>{new Date(c.created_at).toLocaleDateString('en-GB')}</td>
                    <td style={{ padding: '12px 14px' }} onClick={e => e.stopPropagation()}>
                      <button onClick={() => setEditCustomer(c)} style={{ padding: '6px 10px', borderRadius: 8, border: `1px solid ${S.gold}`, background: S.gold3, color: S.gold, cursor: 'pointer', fontSize: 11, fontFamily: 'Tajawal, sans-serif' }}>✏️</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modals */}
      {(showAdd || editCustomer) && (
        <CustomerModal customer={editCustomer} onClose={() => { setShowAdd(false); setEditCustomer(null) }} onSaved={() => { setShowAdd(false); setEditCustomer(null); fetchCustomers() }} />
      )}
      {viewCustomer && (
        <CustomerDetail customer={viewCustomer} onClose={() => setViewCustomer(null)} onEdit={() => { setEditCustomer(viewCustomer); setViewCustomer(null) }} onRefresh={() => { fetchCustomers(); setViewCustomer(prev => prev ? { ...prev, loyalty_points: prev.loyalty_points } : null) }} />
      )}
    </div>
  )
}
