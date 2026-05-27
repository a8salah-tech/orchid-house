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
  amber: '#F59E0B', amberB: 'rgba(245,158,11,0.12)',
  blue: '#3B82F6', blueB: 'rgba(59,130,246,0.12)',
  card: 'rgba(255,255,255,0.04)',
}

type Booking = {
  id: string; customer_name: string; customer_email: string; customer_phone: string
  booking_date: string; booking_time: string; guests: number
  section: string; table_number: number | null; notes: string | null
  status: 'pending' | 'confirmed' | 'cancelled'; created_at: string
}

const SECTION_LABELS: Record<string, string> = {
  outdoor: '🌿 Outdoor', indoor: '❄️ Indoor', terrace: '🌅 Terrace'
}

const STATUS_CFG = {
  pending:   { label: 'Pending',   color: S.amber, bg: S.amberB },
  confirmed: { label: 'Confirmed', color: S.green, bg: S.greenB },
  cancelled: { label: 'Cancelled', color: S.red,   bg: S.redB   },
}

export default function BookingsPage() {
  const sbRef = useRef(createClient())
  const sb = sbRef.current

  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'pending' | 'confirmed' | 'cancelled'>('all')
  const [dateFilter, setDateFilter] = useState('')
  const [search, setSearch] = useState('')

  const fetchBookings = useCallback(async () => {
    const { data } = await sb.from('bookings').select('*').order('booking_date', { ascending: true }).order('booking_time', { ascending: true })
    setBookings((data as any) || [])
    setLoading(false)
  }, [sb])

  useEffect(() => { fetchBookings() }, [fetchBookings])

  useEffect(() => {
    const ch = sb.channel('bookings-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, fetchBookings)
      .subscribe()
    return () => { sb.removeChannel(ch) }
  }, [sb, fetchBookings])

  async function updateStatus(id: string, status: 'confirmed' | 'cancelled') {
    await sb.from('bookings').update({ status }).eq('id', id)
    fetchBookings()
  }

  async function updateTable(id: string, table_number: number | null) {
    await sb.from('bookings').update({ table_number }).eq('id', id)
    fetchBookings()
  }

  const filtered = bookings.filter(b => {
    const matchStatus = filter === 'all' || b.status === filter
    const matchDate = !dateFilter || b.booking_date === dateFilter
    const matchSearch = !search || b.customer_name.toLowerCase().includes(search.toLowerCase()) || b.customer_phone.includes(search) || b.customer_email.toLowerCase().includes(search.toLowerCase())
    return matchStatus && matchDate && matchSearch
  })

  const counts = {
    all: bookings.length,
    pending: bookings.filter(b => b.status === 'pending').length,
    confirmed: bookings.filter(b => b.status === 'confirmed').length,
    cancelled: bookings.filter(b => b.status === 'cancelled').length,
  }

  function printReport() {
    const win = window.open('', '_blank')
    if (!win) return
    const rows = filtered.map((b, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${b.customer_name}</td>
        <td>${b.customer_phone}</td>
        <td>${b.customer_email}</td>
        <td>${new Date(b.booking_date).toLocaleDateString('en-GB')}</td>
        <td>${b.booking_time}</td>
        <td>${b.guests}</td>
        <td>${SECTION_LABELS[b.section] || b.section}</td>
        <td>${b.table_number || '—'}</td>
        <td>${b.status.toUpperCase()}</td>
        <td>${b.notes || '—'}</td>
      </tr>`).join('')

    win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
    <title>Bookings Report</title>
    <style>
      body{font-family:Arial,sans-serif;font-size:10px;margin:15px;}
      h2{text-align:center;font-size:16px;margin-bottom:4px;}
      h3{text-align:center;font-size:11px;color:#555;margin-bottom:14px;}
      table{width:100%;border-collapse:collapse;}
      th{background:#0A1628;color:#fff;padding:5px 6px;text-align:left;font-size:9px;}
      td{padding:4px 6px;border-bottom:1px solid #ddd;font-size:9px;}
      tr:nth-child(even){background:#f9f9f9;}
      .sum{display:flex;gap:12px;margin-bottom:12px;}
      .box{border:1px solid #ddd;border-radius:6px;padding:8px 14px;text-align:center;}
      .box .v{font-size:18px;font-weight:bold;}
      @media print{@page{size:A4 landscape;margin:8mm;}}
    </style></head><body>
    <h2>🌸 Orchid House — Reservations Report</h2>
    <h3>Printed: ${new Date().toLocaleString('en-GB')} · ${filtered.length} bookings</h3>
    <div class="sum">
      <div class="box"><div class="v">${counts.all}</div><div>Total</div></div>
      <div class="box"><div class="v" style="color:#F59E0B">${counts.pending}</div><div>Pending</div></div>
      <div class="box"><div class="v" style="color:#22C55E">${counts.confirmed}</div><div>Confirmed</div></div>
      <div class="box"><div class="v" style="color:#EF4444">${counts.cancelled}</div><div>Cancelled</div></div>
    </div>
    <table><thead><tr>
      <th>#</th><th>Name</th><th>Phone</th><th>Email</th>
      <th>Date</th><th>Time</th><th>Guests</th><th>Section</th>
      <th>Table</th><th>Status</th><th>Notes</th>
    </tr></thead><tbody>${rows}</tbody></table>
    <script>window.onload=()=>window.print()<\/script>
    </body></html>`)
    win.document.close()
  }

  const inp: React.CSSProperties = { background: 'rgba(255,255,255,.04)', border: `1px solid ${S.border}`, borderRadius: 10, padding: '9px 14px', fontSize: 13, color: S.white, outline: 'none', fontFamily: 'Tajawal, sans-serif', boxSizing: 'border-box' as const }

  return (
    <div style={{ fontFamily: 'Tajawal, sans-serif', color: S.white }}>
      <style>{`select option{background:#0F2040;color:#FAFAF8}`}</style>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 900, color: S.white, marginBottom: 4 }}>📅 Reservations</h1>
          <p style={{ fontSize: 13, color: S.muted }}>Manage table bookings and reservations</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={printReport} style={{ padding: '10px 18px', borderRadius: 12, border: `1px solid ${S.blue}`, background: S.blueB, color: S.blue, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>🖨️ Print Report</button>
          <a href="/bookings" target="_blank" style={{ padding: '10px 18px', borderRadius: 12, border: `1px solid ${S.green}`, background: S.greenB, color: S.green, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700, textDecoration: 'none', display: 'flex', alignItems: 'center' }}>🔗 Booking Link</a>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px,1fr))', gap: 12, marginBottom: 24 }}>
        {([['all','All','#fff'], ['pending','Pending',S.amber], ['confirmed','Confirmed',S.green], ['cancelled','Cancelled',S.red]] as const).map(([k, l, c]) => (
          <div key={k} onClick={() => setFilter(k)} style={{ background: filter === k ? c + '15' : S.card, border: `1px solid ${filter === k ? c : S.border}`, borderRadius: 14, padding: '14px 16px', cursor: 'pointer', transition: 'all .2s' }}>
            <div style={{ fontSize: 11, color: S.muted, marginBottom: 4 }}>{l}</div>
            <div style={{ fontSize: 26, fontWeight: 900, color: c }}>{counts[k]}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <input style={{ ...inp, flex: 1, minWidth: 200 }} placeholder="🔍 Search name, phone, email..." value={search} onChange={e => setSearch(e.target.value)} />
        <input type="date" style={{ ...inp, width: 'auto' }} value={dateFilter} onChange={e => setDateFilter(e.target.value)} />
        {dateFilter && <button onClick={() => setDateFilter('')} style={{ padding: '9px 14px', borderRadius: 10, border: `1px solid ${S.red}`, background: S.redB, color: S.red, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif' }}>✕ Clear</button>}
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: S.muted }}>⏳ Loading...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: S.muted }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📅</div>
          <div>No bookings found</div>
        </div>
      ) : (
        <div style={{ background: S.navy2, borderRadius: 16, border: `1px solid ${S.border}`, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
              <thead>
                <tr style={{ background: S.navy3 }}>
                  {['Name', 'Phone', 'Date', 'Time', 'Guests', 'Section', 'Table', 'Notes', 'Status', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '12px 14px', textAlign: 'left', fontSize: 11, color: S.muted, fontWeight: 700, borderBottom: `1px solid ${S.border}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(b => {
                  const st = STATUS_CFG[b.status]
                  return (
                    <tr key={b.id} style={{ borderBottom: `1px solid ${S.border}` }}>
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ fontWeight: 700, color: S.white, fontSize: 14 }}>{b.customer_name}</div>
                        <div style={{ fontSize: 11, color: S.muted }}>{b.customer_email}</div>
                      </td>
                      <td style={{ padding: '12px 14px', color: S.white, fontSize: 13 }}>{b.customer_phone}</td>
                      <td style={{ padding: '12px 14px', color: S.white, fontSize: 13, whiteSpace: 'nowrap' }}>
                        {new Date(b.booking_date).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' })}
                      </td>
                      <td style={{ padding: '12px 14px', color: S.gold, fontWeight: 700, fontSize: 13 }}>{b.booking_time}</td>
                      <td style={{ padding: '12px 14px', color: S.white, fontSize: 13, textAlign: 'center' }}>{b.guests}</td>
                      <td style={{ padding: '12px 14px', color: S.white, fontSize: 13 }}>{SECTION_LABELS[b.section] || b.section}</td>
                      <td style={{ padding: '8px 14px' }}>
                        <input type="number" style={{ ...inp, width: 70, fontSize: 12, padding: '5px 8px' }}
                          placeholder="—" value={b.table_number || ''} min={1}
                          onChange={e => updateTable(b.id, parseInt(e.target.value) || null)} />
                      </td>
                      <td style={{ padding: '12px 14px', color: S.muted, fontSize: 12, maxWidth: 150 }}>
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.notes || '—'}</div>
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{ background: st.bg, color: st.color, borderRadius: 20, padding: '4px 10px', fontSize: 11, fontWeight: 700 }}>{st.label}</span>
                      </td>
                      <td style={{ padding: '8px 14px' }}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          {b.status !== 'confirmed' && (
                            <button onClick={() => updateStatus(b.id, 'confirmed')} style={{ padding: '5px 10px', borderRadius: 8, border: `1px solid ${S.green}`, background: S.greenB, color: S.green, cursor: 'pointer', fontSize: 11, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>✓</button>
                          )}
                          {b.status !== 'cancelled' && (
                            <button onClick={() => updateStatus(b.id, 'cancelled')} style={{ padding: '5px 10px', borderRadius: 8, border: `1px solid ${S.red}`, background: S.redB, color: S.red, cursor: 'pointer', fontSize: 11, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>✕</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
