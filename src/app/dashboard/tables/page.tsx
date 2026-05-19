'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useRef, useCallback } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import QRCode from 'qrcode'

const createClient = () => createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const S = {
  navy: '#0A1628', navy2: '#0F2040', navy3: '#0C1A32',
  gold: '#C9A84C', gold2: '#E8C97A', gold3: 'rgba(201,168,76,0.12)', goldB: 'rgba(201,168,76,0.22)',
  white: '#FAFAF8', muted: '#8A9BB5', border: 'rgba(255,255,255,0.08)',
  green: '#22C55E', greenB: 'rgba(34,197,94,0.10)',
  red: '#EF4444', redB: 'rgba(239,68,68,0.10)',
  amber: '#F59E0B', amberB: 'rgba(245,158,11,0.10)',
  card: 'rgba(255,255,255,0.03)',
}

type TableStatus = 'available' | 'reserved' | 'occupied'
type Table = { id: string; number: number; name: string; is_active: boolean; status: TableStatus }

const STATUS: Record<TableStatus, { label: string; color: string; bg: string; dot: string }> = {
  available: { label: 'Available', color: '#22C55E', bg: 'rgba(34,197,94,0.10)', dot: '#22C55E' },
  reserved:  { label: 'Reserved',  color: '#F59E0B', bg: 'rgba(245,158,11,0.10)', dot: '#F59E0B' },
  occupied:  { label: 'Occupied',  color: '#EF4444', bg: 'rgba(239,68,68,0.10)', dot: '#EF4444' },
}

const MENU_BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://orchid.bidlx.com'

export default function TablesPage() {
  const sbRef = useRef(createClient())
  const sb = sbRef.current
  const [tables, setTables]   = useState<Table[]>([])
  const [loading, setLoading] = useState(true)
  const [qrUrls, setQrUrls]   = useState<Record<string, string>>({})
  const [showAdd, setShowAdd] = useState(false)
  const [newNum, setNewNum]   = useState('')
  const [newName, setNewName] = useState('')
  const [saving, setSaving]   = useState(false)
  const [filter, setFilter]   = useState<TableStatus | 'all'>('all')

  const fetchTables = useCallback(async () => {
    const { data } = await sb.from('tables').select('*').order('number')
    setTables(data || [])
    setLoading(false)
  }, [sb])

  useEffect(() => { fetchTables() }, [fetchTables])

  useEffect(() => {
    const ch = sb.channel('tables').on('postgres_changes', { event: '*', schema: 'public', table: 'tables' }, fetchTables).subscribe()
    return () => { sb.removeChannel(ch) }
  }, [sb, fetchTables])

  useEffect(() => {
    if (!tables.length) return
    ;(async () => {
      const urls: Record<string, string> = {}
      for (const t of tables) {
        try { urls[t.id] = await QRCode.toDataURL(`${MENU_BASE_URL}/menu/${t.id}`, { width: 400, margin: 1, color: { dark: '#000000', light: '#FFFFFF' } }) }
        catch { urls[t.id] = '' }
      }
      setQrUrls(urls)
    })()
  }, [tables])

  async function addTable() {
    if (!newNum) return
    setSaving(true)
    await sb.from('tables').insert([{ number: parseInt(newNum), name: newName || `Table ${newNum}`, is_active: true, status: 'available' }])
    setNewNum(''); setNewName(''); setShowAdd(false); setSaving(false)
    fetchTables()
  }

  async function setStatus(id: string, status: TableStatus) {
    await sb.from('tables').update({ status }).eq('id', id)
    fetchTables()
  }

  async function deleteTable(id: string) {
    if (!confirm('Delete this table?')) return
    await sb.from('tables').delete().eq('id', id)
    fetchTables()
  }

 function printQR(table: Table) {
    const url = `${MENU_BASE_URL}/menu/${table.id}`
    const img = qrUrls[table.id]
    const win = window.open('', '_blank')
    if (!win || !img) return
    win.document.write(`<!DOCTYPE html><html>
    <head><meta charset="UTF-8"><title>QR - ${table.name}</title>
    <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Tajawal:wght@400;700&display=swap" rel="stylesheet">
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #fff; font-family: 'Tajawal', sans-serif; }
      .card { text-align: center; padding: 36px 32px; border: 2px solid #C9A84C; border-radius: 24px; width: 340px; background: #fff; }
      .orchid-logo { width: 60px; height: 60px; margin: 0 auto 10px; }
      .logo { font-family: 'Playfair Display', serif; font-size: 26px; font-weight: 900; color: #0A1628; letter-spacing: 2px; margin-bottom: 2px; }
      .tagline { font-size: 11px; color: #8A9BB5; letter-spacing: 3px; text-transform: uppercase; margin-bottom: 20px; }
      .divider { width: 60px; height: 2px; background: linear-gradient(90deg, transparent, #C9A84C, transparent); margin: 0 auto 20px; }
      .qr-wrap { position: relative; display: inline-block; }
      .qr-wrap img { width: 240px; height: 240px; border-radius: 16px; display: block; border: 3px solid #0A1628; }
      .table-badge { position: absolute; bottom: -18px; left: 50%; transform: translateX(-50%); background: linear-gradient(135deg, #C9A84C, #E8C97A); color: #0A1628; border-radius: 30px; padding: 6px 24px; font-size: 18px; font-weight: 900; white-space: nowrap; box-shadow: 0 4px 16px rgba(201,168,76,0.5); font-family: 'Playfair Display', serif; }
      .spacer { height: 28px; }
      .inst { font-size: 12px; color: #C9A84C; font-weight: 700; letter-spacing: 1px; margin-top: 16px; }
      .url { font-size: 9px; color: #ccc; margin-top: 10px; word-break: break-all; }
      .footer { margin-top: 20px; padding-top: 16px; border-top: 1px solid #eee; font-size: 10px; color: #999; }
     @media print { 
     @page { margin: 0; size: A6 portrait; } 
     body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .card { page-break-after: avoid; page-break-inside: avoid; }
     }
    </style></head><body>
    <div class="card">
      <div class="logo">Orchid Group</div>
      <div class="tagline">House Restaurant</div>
      <div class="divider"></div>
      <div class="qr-wrap">
        <img src="${img}" alt="QR Code" />
        <div class="table-badge">${table.name || `Table ${table.number}`}</div>
      </div>
      <div class="spacer"></div>
      <div class="inst">📱 Scan to view our menu & order</div>
      <div class="url">${url}</div>
      <div class="footer">All prices subject to 6% SST & 10% service charge</div>
    </div>
    <script>window.onload=()=>window.print()<\/script>
    </body></html>`)
    win.document.close()
  }

  const inp: React.CSSProperties = {
    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#FAFAF8',
    outline: 'none', fontFamily: 'Tajawal, sans-serif', boxSizing: 'border-box', width: '100%',
  }

  const filtered = filter === 'all' ? tables : tables.filter(t => t.status === filter)
  const counts = { available: tables.filter(t => t.status === 'available').length, reserved: tables.filter(t => t.status === 'reserved').length, occupied: tables.filter(t => t.status === 'occupied').length }

  return (
    <div style={{ fontFamily: 'Tajawal, sans-serif', direction: 'rtl', color: S.white, minHeight: '100vh', background: S.navy }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700;800;900&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .table-card { transition: transform .2s, box-shadow .2s; }
        .table-card:hover { transform: translateY(-3px); box-shadow: 0 12px 32px rgba(0,0,0,0.3); }
        select option { background: #0F2040; color: #FAFAF8; }
      `}</style>

      {/* Header */}
      <div style={{ background: S.navy2, borderBottom: `1px solid ${S.border}`, padding: '0 24px', display: 'flex', alignItems: 'center', height: 60, gap: 16, position: 'sticky', top: 0, zIndex: 100 }}>
        <h1 style={{ fontSize: 18, fontWeight: 900, color: S.gold }}>🪑 Table Management</h1>
        <div style={{ marginRight: 'auto', display: 'flex', gap: 8 }}>
          <button onClick={() => setShowAdd(true)} style={{ padding: '8px 18px', borderRadius: 10, border: `1px solid ${S.green}`, background: S.greenB, color: S.green, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
            ➕ Add Table
          </button>
        </div>
      </div>

      <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>

        {/* Stats Bar */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
          {([['all', 'All Tables', tables.length, S.white, S.card], ['available', 'Available', counts.available, STATUS.available.color, STATUS.available.bg], ['reserved', 'Reserved', counts.reserved, STATUS.reserved.color, STATUS.reserved.bg], ['occupied', 'Occupied', counts.occupied, STATUS.occupied.color, STATUS.occupied.bg]] as const).map(([key, label, count, color, bg]) => (
            <div key={key} onClick={() => setFilter(key as any)}
              style={{ flex: '1 1 120px', background: filter === key ? bg : S.navy2, border: `1px solid ${filter === key ? color + '80' : S.border}`, borderRadius: 14, padding: '14px 18px', cursor: 'pointer', transition: 'all .2s' }}>
              <div style={{ fontSize: 11, color: S.muted, marginBottom: 4 }}>{label}</div>
              <div style={{ fontSize: 26, fontWeight: 900, color }}>{count}</div>
            </div>
          ))}
        </div>

        {/* Add Modal */}
        {showAdd && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ background: S.navy2, borderRadius: 20, border: `1px solid ${S.border}`, padding: 28, width: 360 }}>
              <h2 style={{ color: S.white, fontSize: 16, fontWeight: 700, marginBottom: 20 }}>➕ Add New Table</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
                <div>
                  <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 4 }}>Table Number *</label>
                  <input type="number" style={inp} placeholder="1" value={newNum} onChange={e => setNewNum(e.target.value)} onKeyDown={e => e.key === 'Enter' && addTable()} />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 4 }}>Name (optional)</label>
                  <input style={inp} placeholder="VIP Table, Terrace..." value={newName} onChange={e => setNewName(e.target.value)} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={addTable} disabled={saving || !newNum} style={{ flex: 1, padding: '11px', borderRadius: 10, border: `1px solid ${S.gold}`, background: S.gold3, color: S.gold, cursor: 'pointer', fontSize: 14, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
                  {saving ? '⏳' : '✅ Add'}
                </button>
                <button onClick={() => setShowAdd(false)} style={{ padding: '11px 18px', borderRadius: 10, border: `1px solid ${S.border}`, background: 'transparent', color: S.muted, cursor: 'pointer', fontFamily: 'Tajawal, sans-serif' }}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: S.muted }}>⏳ Loading...</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
            {filtered.map(table => {
              const st = STATUS[table.status || 'available']
              return (
                <div key={table.id} className="table-card"
                  style={{ background: S.navy2, borderRadius: 18, border: `1.5px solid ${st.color}50`, overflow: 'hidden', opacity: table.is_active ? 1 : 0.5 }}>

                  {/* QR Top Section */}
                  <div style={{ background: 'linear-gradient(160deg, #0A1628 0%, #0F2040 100%)', padding: '20px 16px 28px', display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
                    {/* Brand */}
                    <div style={{ fontSize: 10, color: S.gold, fontWeight: 700, letterSpacing: 3, marginBottom: 14, textTransform: 'uppercase' }}>🌸 Orchid House</div>

                    {/* QR with border */}
                    <div style={{ background: '#fff', padding: 8, borderRadius: 12, border: `2px solid ${S.gold}`, boxShadow: `0 0 20px rgba(201,168,76,0.2)` }}>
                      {qrUrls[table.id] ? (
                        <img src={qrUrls[table.id]} alt="QR" style={{ width: 140, height: 140, display: 'block', borderRadius: 6 }} />
                      ) : (
                        <div style={{ width: 140, height: 140, background: '#f5f5f5', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999', fontSize: 12 }}>⏳</div>
                      )}
                    </div>

                    {/* Table Name Badge */}
                    <div style={{ position: 'absolute', bottom: -16, left: '50%', transform: 'translateX(-50%)', background: `linear-gradient(135deg, ${S.gold}, ${S.gold2})`, color: S.navy, borderRadius: 30, padding: '6px 22px', fontSize: 13, fontWeight: 900, whiteSpace: 'nowrap', boxShadow: `0 4px 16px rgba(201,168,76,0.5)`, letterSpacing: 0.5 }}>
                      {table.name || `Table ${table.number}`}
                    </div>
                  </div>

                  {/* Bottom Section */}
                  <div style={{ padding: '24px 14px 14px' }}>

                    {/* Status Selector */}
                    <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                      {(Object.entries(STATUS) as [TableStatus, typeof STATUS[TableStatus]][]).map(([key, cfg]) => (
                        <button key={key} onClick={() => setStatus(table.id, key)}
                          style={{ flex: 1, padding: '7px 4px', borderRadius: 8, border: `1px solid ${table.status === key ? cfg.color : 'rgba(255,255,255,0.08)'}`, background: table.status === key ? cfg.bg : 'transparent', color: table.status === key ? cfg.color : S.muted, cursor: 'pointer', fontSize: 10, fontFamily: 'Tajawal, sans-serif', fontWeight: table.status === key ? 700 : 400, transition: 'all .15s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: table.status === key ? cfg.color : 'transparent', border: `1px solid ${table.status === key ? cfg.color : 'rgba(255,255,255,0.2)'}`, flexShrink: 0 }} />
                          {cfg.label}
                        </button>
                      ))}
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => printQR(table)} style={{ flex: 1, padding: '8px', borderRadius: 8, border: `1px solid ${S.gold}`, background: S.gold3, color: S.gold, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
                        🖨️ Print
                      </button>
                      <button onClick={() => deleteTable(table.id)} style={{ padding: '8px 12px', borderRadius: 8, border: `1px solid rgba(239,68,68,0.4)`, background: 'rgba(239,68,68,0.08)', color: S.red, cursor: 'pointer', fontSize: 13 }}>
                        🗑️
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
