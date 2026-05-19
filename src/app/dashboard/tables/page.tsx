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
  green: '#22C55E', greenB: 'rgba(34,197,94,0.12)',
  red: '#EF4444', redB: 'rgba(239,68,68,0.12)',
  amber: '#F59E0B', amberB: 'rgba(245,158,11,0.12)',
  blue: '#3B82F6', blueB: 'rgba(59,130,246,0.12)',
  card: 'rgba(255,255,255,0.04)', card2: 'rgba(255,255,255,0.08)',
}

type TableStatus = 'available' | 'reserved' | 'occupied'
type Table = {
  id: string; number: number; name: string; is_active: boolean
  status: TableStatus; reserved_by?: string; reserved_at?: string
}

const STATUS_CONFIG: Record<TableStatus, { label: string; color: string; bg: string; border: string; icon: string }> = {
  available: { label: 'فاضية',   color: S.green, bg: S.greenB, border: S.green + '60', icon: '🟢' },
  reserved:  { label: 'محجوزة',  color: S.amber, bg: S.amberB, border: S.amber + '60', icon: '🟡' },
  occupied:  { label: 'مشغولة',  color: S.red,   bg: S.redB,   border: S.red + '60',   icon: '🔴' },
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
  const [filterStatus, setFilterStatus] = useState<TableStatus | 'all'>('all')

  const fetchTables = useCallback(async () => {
    const { data } = await sb.from('tables').select('*').order('number')
    setTables(data || [])
    setLoading(false)
  }, [sb])

  useEffect(() => { fetchTables() }, [fetchTables])

  // Real-time subscription
  useEffect(() => {
    const channel = sb.channel('tables-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tables' }, () => fetchTables())
      .subscribe()
    return () => { sb.removeChannel(channel) }
  }, [sb, fetchTables])

  // توليد QR
  useEffect(() => {
    async function genQRs() {
      const urls: Record<string, string> = {}
      for (const t of tables) {
        const url = `${MENU_BASE_URL}/menu/${t.id}`
        try {
          urls[t.id] = await QRCode.toDataURL(url, {
            width: 300, margin: 2,
            color: { dark: '#0A1628', light: '#FFFFFF' },
          })
        } catch { urls[t.id] = '' }
      }
      setQrUrls(urls)
    }
    if (tables.length > 0) genQRs()
  }, [tables])

  async function addTable() {
    if (!newNum) return
    setSaving(true)
    await sb.from('tables').insert([{
      number: parseInt(newNum),
      name: newName || `طاولة ${newNum}`,
      is_active: true,
      status: 'available',
    }])
    setNewNum(''); setNewName(''); setShowAdd(false); setSaving(false)
    fetchTables()
  }

  async function changeStatus(id: string, status: TableStatus) {
    await sb.from('tables').update({
      status,
      reserved_at: status !== 'available' ? new Date().toISOString() : null,
    }).eq('id', id)
    fetchTables()
  }

  async function toggleActive(id: string, current: boolean) {
    await sb.from('tables').update({ is_active: !current }).eq('id', id)
    fetchTables()
  }

  async function deleteTable(id: string, name: string) {
    if (!confirm(`هل أنت متأكد من حذف ${name}؟`)) return
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
      @media print { @page { margin: 0; size: 10cm 14cm; } body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
    </style></head><body>
    <div class="card">
      <div class="logo">ORCHID</div>
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
    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)',
    borderRadius: 10, padding: '10px 14px', fontSize: 13,
    color: '#FAFAF8', outline: 'none', fontFamily: 'Tajawal, sans-serif',
    boxSizing: 'border-box', direction: 'rtl', width: '100%',
  }

  const filtered = filterStatus === 'all' ? tables : tables.filter(t => t.status === filterStatus)
  const counts = {
    available: tables.filter(t => t.status === 'available').length,
    reserved:  tables.filter(t => t.status === 'reserved').length,
    occupied:  tables.filter(t => t.status === 'occupied').length,
  }

  return (
    <div style={{ minHeight: '100vh', background: S.navy, fontFamily: 'Tajawal, sans-serif', direction: 'rtl' }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700;800;900&display=swap'); * { box-sizing: border-box; margin: 0; padding: 0; }`}</style>

      {/* Header */}
      <div style={{ background: S.navy2, borderBottom: `1px solid ${S.border}`, padding: '0 24px', display: 'flex', alignItems: 'center', height: 60, gap: 16, position: 'sticky', top: 0, zIndex: 100 }}>
        <h1 style={{ color: S.gold, fontSize: 18, fontWeight: 900 }}>🪑 إدارة الطاولات</h1>
        <button onClick={() => setShowAdd(true)}
          style={{ marginRight: 'auto', padding: '8px 18px', borderRadius: 10, border: `1px solid ${S.green}`, background: S.greenB, color: S.green, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
          ➕ إضافة طاولة
        </button>
      </div>

      <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
          {[
            { label: 'إجمالي الطاولات', value: tables.length, color: S.white, bg: S.card2, icon: '🪑', st: 'all' as const },
            { label: 'فاضية', value: counts.available, color: S.green, bg: S.greenB, icon: '🟢', st: 'available' as const },
            { label: 'محجوزة', value: counts.reserved, color: S.amber, bg: S.amberB, icon: '🟡', st: 'reserved' as const },
            { label: 'مشغولة', value: counts.occupied, color: S.red, bg: S.redB, icon: '🔴', st: 'occupied' as const },
          ].map((s, i) => (
            <div key={i} onClick={() => setFilterStatus(filterStatus === s.st ? 'all' : s.st)}
              style={{ background: filterStatus === s.st ? s.bg : S.navy2, borderRadius: 14, border: `1px solid ${filterStatus === s.st ? s.color + '60' : S.border}`, padding: '16px 18px', cursor: 'pointer', transition: 'all .2s' }}>
              <div style={{ fontSize: 11, color: S.muted, marginBottom: 4 }}>{s.icon} {s.label}</div>
              <div style={{ fontSize: 26, fontWeight: 900, color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Modal إضافة */}
        {showAdd && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ background: S.navy2, borderRadius: 20, border: `1px solid ${S.border}`, padding: 28, width: 360 }}>
              <h2 style={{ color: S.white, fontSize: 16, fontWeight: 700, marginBottom: 20 }}>➕ إضافة طاولة جديدة</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
                <div>
                  <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 4 }}>رقم الطاولة *</label>
                  <input type="number" style={inp} placeholder="1" value={newNum} onChange={e => setNewNum(e.target.value)} />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 4 }}>الاسم (اختياري)</label>
                  <input style={inp} placeholder="طاولة VIP، تراس..." value={newName} onChange={e => setNewName(e.target.value)} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={addTable} disabled={saving || !newNum}
                  style={{ flex: 1, padding: '11px', borderRadius: 10, border: `1px solid ${S.gold}`, background: S.gold3, color: S.gold, cursor: 'pointer', fontSize: 14, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
                  {saving ? '⏳...' : '✅ إضافة'}
                </button>
                <button onClick={() => setShowAdd(false)}
                  style={{ padding: '11px 16px', borderRadius: 10, border: `1px solid ${S.border}`, background: 'transparent', color: S.muted, cursor: 'pointer', fontSize: 14, fontFamily: 'Tajawal, sans-serif' }}>
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: S.muted }}>⏳ جاري التحميل...</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 16 }}>
            {filtered.map(table => {
              const st = STATUS_CONFIG[table.status || 'available']
              return (
                <div key={table.id} style={{ background: S.navy2, borderRadius: 18, border: `2px solid ${st.border}`, overflow: 'hidden', opacity: table.is_active ? 1 : 0.5, transition: 'all .2s', position: 'relative' }}>

                  {/* Status Badge */}
                  <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 10, background: st.bg, border: `1px solid ${st.color}40`, borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 700, color: st.color }}>
                    {st.icon} {st.label}
                  </div>

                  {/* QR Section */}
                  <div style={{ background: `linear-gradient(135deg, #0A1628, #0F2040)`, padding: '24px 20px 30px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{ fontSize: 11, color: S.gold, fontWeight: 700, marginBottom: 12, letterSpacing: 2 }}>🌸 ORCHID HOUSE</div>
                    <div style={{ position: 'relative' }}>
                      {qrUrls[table.id] ? (
                        <img src={qrUrls[table.id]} alt="QR" style={{ width: 160, height: 160, borderRadius: 12, display: 'block', border: `3px solid ${S.gold}` }} />
                      ) : (
                        <div style={{ width: 160, height: 160, background: 'rgba(255,255,255,0.05)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', color: S.muted }}>⏳</div>
                      )}
                      {/* Table Name Badge */}
                      <div style={{ position: 'absolute', bottom: -16, left: '50%', transform: 'translateX(-50%)', background: `linear-gradient(135deg, ${S.gold}, ${S.gold2})`, color: S.navy, borderRadius: 20, padding: '5px 20px', fontSize: 14, fontWeight: 900, whiteSpace: 'nowrap', boxShadow: `0 4px 16px rgba(201,168,76,0.5)` }}>
                        {table.name || `طاولة ${table.number}`}
                      </div>
                    </div>
                    <div style={{ height: 24 }} />
                    <div style={{ fontSize: 10, color: S.muted }}>📱 امسح لعرض المنيو</div>
                  </div>

                  {/* Controls */}
                  <div style={{ padding: '14px' }}>
                    {/* Status Buttons */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 10 }}>
                      {(Object.entries(STATUS_CONFIG) as [TableStatus, typeof STATUS_CONFIG[TableStatus]][]).map(([key, cfg]) => (
                        <button key={key} onClick={() => changeStatus(table.id, key)}
                          style={{ padding: '6px 4px', borderRadius: 8, border: `1px solid ${table.status === key ? cfg.color : S.border}`, background: table.status === key ? cfg.bg : 'transparent', color: table.status === key ? cfg.color : S.muted, cursor: 'pointer', fontSize: 11, fontFamily: 'Tajawal, sans-serif', fontWeight: table.status === key ? 700 : 400 }}>
                          {cfg.icon} {cfg.label}
                        </button>
                      ))}
                    </div>

                    {/* Action Buttons */}
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => printQR(table)}
                        style={{ flex: 1, padding: '8px', borderRadius: 8, border: `1px solid ${S.gold}`, background: S.gold3, color: S.gold, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
                        🖨️ طباعة
                      </button>
                      <button onClick={() => toggleActive(table.id, table.is_active)}
                        style={{ padding: '8px 10px', borderRadius: 8, border: `1px solid ${table.is_active ? S.red : S.green}`, background: table.is_active ? S.redB : S.greenB, color: table.is_active ? S.red : S.green, cursor: 'pointer', fontSize: 12 }}>
                        {table.is_active ? '⏸' : '▶'}
                      </button>
                      <button onClick={() => deleteTable(table.id, table.name || `طاولة ${table.number}`)}
                        style={{ padding: '8px 10px', borderRadius: 8, border: `1px solid ${S.red}`, background: S.redB, color: S.red, cursor: 'pointer', fontSize: 12 }}>
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
