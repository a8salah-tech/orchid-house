'use client'

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
  blue: '#3B82F6', blueB: 'rgba(59,130,246,0.10)',
  card: 'rgba(255,255,255,0.03)',
}

type TableStatus = 'available' | 'reserved' | 'occupied'
type Table = { id: string; number: number; name: string; is_active: boolean; status: TableStatus; section?: string; pos_x?: number; pos_y?: number; branch_id?: string }

const STATUS: Record<TableStatus, { label: string; color: string; bg: string; dot: string }> = {
  available: { label: 'Available', color: '#22C55E', bg: 'rgba(34,197,94,0.10)', dot: '#22C55E' },
  reserved:  { label: 'Reserved',  color: '#F59E0B', bg: 'rgba(245,158,11,0.10)', dot: '#F59E0B' },
  occupied:  { label: 'Occupied',  color: '#EF4444', bg: 'rgba(239,68,68,0.10)', dot: '#EF4444' },
}

const MENU_BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://orchid.bidlx.com'

const SECTIONS = [
  { key: 'outdoor',  label: 'Outdoor Hall',  icon: '🌿', color: '#22C55E' },
  { key: 'indoor',   label: 'Indoor Hall',   icon: '❄️', color: '#3B82F6' },
  { key: 'upstairs', label: 'Upstairs',      icon: '🌅', color: '#F59E0B' },
]

// ══ Layout Editor Modal ══
function LayoutEditorModal({ tables, branches, onClose, onSaved }: {
  tables: Table[]; branches: { id: string; name: string }[]; onClose: () => void; onSaved: () => void
}) {
  const sb = createClient()
  const canvasRef = useRef<HTMLDivElement>(null)
  const [activeBranch, setActiveBranch] = useState(branches[0]?.id || '')
  const [activeSection, setActiveSection] = useState('outdoor')
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>(() => {
    const init: Record<string, { x: number; y: number }> = {}
    tables.forEach(t => { init[t.id] = { x: t.pos_x ?? 50, y: t.pos_y ?? 50 } })
    return init
  })
  const [dragging, setDragging] = useState<string | null>(null)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [saving, setSaving] = useState(false)

  const sectionTables = tables.filter(t => t.section === activeSection && t.branch_id === activeBranch)
  const CANVAS_W = 600
  const CANVAS_H = 500
  const TABLE_SIZE = 48

  function onMouseDown(e: React.MouseEvent, id: string) {
    e.preventDefault()
    const rect = canvasRef.current!.getBoundingClientRect()
    const scaleX = CANVAS_W / rect.width
    const scaleY = CANVAS_H / rect.height
    const pos = positions[id] || { x: 50, y: 50 }
    setDragging(id)
    setDragOffset({
      x: (e.clientX - rect.left) * scaleX - pos.x,
      y: (e.clientY - rect.top) * scaleY - pos.y,
    })
  }

  function onMouseMove(e: React.MouseEvent) {
    if (!dragging || !canvasRef.current) return
    const rect = canvasRef.current.getBoundingClientRect()
    const scaleX = CANVAS_W / rect.width
    const scaleY = CANVAS_H / rect.height
    const x = Math.max(0, Math.min(CANVAS_W - TABLE_SIZE, (e.clientX - rect.left) * scaleX - dragOffset.x))
    const y = Math.max(0, Math.min(CANVAS_H - TABLE_SIZE, (e.clientY - rect.top) * scaleY - dragOffset.y))
    setPositions(p => ({ ...p, [dragging]: { x, y } }))
  }

  function onTouchStart(e: React.TouchEvent, id: string) {
    e.preventDefault()
    const rect = canvasRef.current!.getBoundingClientRect()
    const scaleX = CANVAS_W / rect.width
    const scaleY = CANVAS_H / rect.height
    const touch = e.touches[0]
    const pos = positions[id] || { x: 50, y: 50 }
    setDragging(id)
    setDragOffset({
      x: (touch.clientX - rect.left) * scaleX - pos.x,
      y: (touch.clientY - rect.top) * scaleY - pos.y,
    })
  }

  function onTouchMove(e: React.TouchEvent) {
    if (!dragging || !canvasRef.current) return
    const rect = canvasRef.current.getBoundingClientRect()
    const scaleX = CANVAS_W / rect.width
    const scaleY = CANVAS_H / rect.height
    const touch = e.touches[0]
    const x = Math.max(0, Math.min(CANVAS_W - TABLE_SIZE, (touch.clientX - rect.left) * scaleX - dragOffset.x))
    const y = Math.max(0, Math.min(CANVAS_H - TABLE_SIZE, (touch.clientY - rect.top) * scaleY - dragOffset.y))
    setPositions(p => ({ ...p, [dragging]: { x, y } }))
  }

  async function save() {
    setSaving(true)
    await Promise.all(Object.entries(positions).map(([id, pos]) =>
      sb.from('tables').update({ pos_x: Math.round(pos.x), pos_y: Math.round(pos.y) }).eq('id', id)
    ))
    setSaving(false)
    onSaved()
    onClose()
  }

  function autoArrange() {
    const cols = Math.ceil(Math.sqrt(sectionTables.length))
    const gap = Math.floor((CANVAS_W - TABLE_SIZE) / Math.max(cols, 1))
    const newPos = { ...positions }
    sectionTables.forEach((t, i) => {
      const col = i % cols
      const row = Math.floor(i / cols)
      newPos[t.id] = { x: 40 + col * gap, y: 40 + row * (TABLE_SIZE + 30) }
    })
    setPositions(newPos)
  }

  const sec = SECTIONS.find(s => s.key === activeSection)

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: S.navy2, borderRadius: 20, border: `1px solid ${S.border}`, width: '100%', maxWidth: 700, maxHeight: '95vh', overflow: 'auto', padding: 24 }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ color: S.white, fontSize: 17, fontWeight: 800 }}>🗺️ Table Layout Editor</h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: S.muted, fontSize: 22, cursor: 'pointer' }}>✕</button>
        </div>

        {/* Branch Tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          {branches.map(b => (
            <button key={b.id} onClick={() => setActiveBranch(b.id)}
              style={{ padding: '7px 18px', borderRadius: 10, border: `1px solid ${activeBranch === b.id ? S.blue : S.border}`, background: activeBranch === b.id ? S.blueB : 'transparent', color: activeBranch === b.id ? S.blue : S.muted, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: activeBranch === b.id ? 700 : 400 }}>
              🏪 {b.name}
            </button>
          ))}
        </div>

        {/* Section Tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          {SECTIONS.map(s => (
            <button key={s.key} onClick={() => setActiveSection(s.key)}
              style={{ padding: '7px 16px', borderRadius: 10, border: `1px solid ${activeSection === s.key ? s.color : S.border}`, background: activeSection === s.key ? s.color + '20' : 'transparent', color: activeSection === s.key ? s.color : S.muted, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: activeSection === s.key ? 700 : 400 }}>
              {s.icon} {s.label}
            </button>
          ))}
        </div>

        {/* Hint */}
        <div style={{ fontSize: 12, color: S.muted, marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <span>🖱️ اسحب الطاولات لوضعها في مكانها الصح</span>
          <button onClick={autoArrange} style={{ padding: '5px 12px', borderRadius: 8, border: `1px solid ${S.gold}`, background: S.gold3, color: S.gold, cursor: 'pointer', fontSize: 11, fontFamily: 'Tajawal, sans-serif' }}>
            ✨ ترتيب تلقائي
          </button>
        </div>

        {/* Canvas */}
        <div ref={canvasRef}
          style={{ position: 'relative', width: '100%', paddingBottom: `${(CANVAS_H / CANVAS_W) * 100}%`, background: '#0a180a', borderRadius: 14, border: `1.5px solid ${sec?.color}40`, overflow: 'hidden', cursor: dragging ? 'grabbing' : 'default', touchAction: 'none', userSelect: 'none' }}
          onMouseMove={onMouseMove}
          onMouseUp={() => setDragging(null)}
          onMouseLeave={() => setDragging(null)}
          onTouchMove={onTouchMove}
          onTouchEnd={() => setDragging(null)}
        >
          <div style={{ position: 'absolute', inset: 0 }}>
            {/* Grid */}
            <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`} preserveAspectRatio="none">
              <defs>
                <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1a3a1a" strokeWidth="0.5"/>
                </pattern>
              </defs>
              <rect width={CANVAS_W} height={CANVAS_H} fill="url(#grid)" opacity="0.5"/>
              <text x={CANVAS_W/2} y={CANVAS_H/2} textAnchor="middle" fill="#1a3a1a" fontSize="20" fontFamily="system-ui">{sec?.icon} {sec?.label}</text>
            </svg>

            {/* Tables */}
            {sectionTables.length === 0 ? (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: S.muted, fontSize: 13 }}>
                لا توجد طاولات في هذه الصالة
              </div>
            ) : sectionTables.map(t => {
              const pos = positions[t.id] || { x: 50, y: 50 }
              const pct_x = (pos.x / CANVAS_W) * 100
              const pct_y = (pos.y / CANVAS_H) * 100
              const isActive = dragging === t.id
              return (
                <div key={t.id}
                  style={{
                    position: 'absolute',
                    left: `${pct_x}%`,
                    top: `${pct_y}%`,
                    width: `${(TABLE_SIZE / CANVAS_W) * 100}%`,
                    aspectRatio: '1',
                    background: isActive ? sec!.color + '40' : sec!.color + '25',
                    border: `2px solid ${isActive ? sec!.color : sec!.color + '80'}`,
                    borderRadius: 8,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'grab',
                    userSelect: 'none',
                    transform: isActive ? 'scale(1.1)' : 'scale(1)',
                    transition: isActive ? 'none' : 'transform .1s',
                    zIndex: isActive ? 10 : 1,
                    boxShadow: isActive ? `0 4px 20px ${sec!.color}60` : 'none',
                  }}
                  onMouseDown={e => onMouseDown(e, t.id)}
                  onTouchStart={e => onTouchStart(e, t.id)}
                >
                  <span style={{ color: sec!.color, fontSize: `${(14 / CANVAS_W) * 100 * 4}vw`, fontWeight: 700, fontFamily: 'system-ui', lineHeight: 1, maxWidth: '100%', overflow: 'hidden', textAlign: 'center' }}
                    className="table-num">
                    {t.number}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        <style>{`.table-num { font-size: clamp(10px, 1.5vw, 16px) !important; }`}</style>

        {/* Footer */}
        <div style={{ display: 'flex', gap: 10, marginTop: 18, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '10px 20px', borderRadius: 10, border: `1px solid ${S.border}`, background: 'transparent', color: S.muted, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif' }}>إلغاء</button>
          <button onClick={save} disabled={saving} style={{ padding: '10px 24px', borderRadius: 10, border: `1px solid ${S.green}`, background: S.greenB, color: S.green, cursor: saving ? 'not-allowed' : 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
            {saving ? '⏳' : '💾 حفظ المخطط'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function TablesPage() {
  const sbRef = useRef(createClient())
  const sb = sbRef.current
  const [tables, setTables]   = useState<Table[]>([])
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [qrUrls, setQrUrls]   = useState<Record<string, string>>({})
  const [showAdd, setShowAdd] = useState(false)
  const [showLayout, setShowLayout] = useState(false)
  const [newNum, setNewNum]   = useState('')
  const [newName, setNewName] = useState('')
  const [newSection, setNewSection] = useState('outdoor')
  const [saving, setSaving]   = useState(false)
  const [filter, setFilter]   = useState<TableStatus | 'all'>('all')

  const fetchTables = useCallback(async () => {
    const [{ data: tablesData }, { data: branchesData }] = await Promise.all([
      sb.from('tables').select('*').order('number'),
      sb.from('branches').select('id,name').eq('is_active', true).order('name', { ascending: false }),
    ])
    setTables(tablesData || [])
    setBranches(branchesData || [])
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
    const { error } = await sb.from('tables').insert([{
      number: parseInt(newNum),
      name: newName || `Table ${newNum}`,
      is_active: true,
      status: 'available',
      section: newSection,
    }])
    setSaving(false)
    if (error) { alert('Error adding table: ' + error.message); return }
    setNewNum(''); setNewName(''); setShowAdd(false)
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
    const img = qrUrls[table.id]
    if (!img) { alert('QR not ready yet, please wait...'); return }
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(`<!DOCTYPE html><html>
<head><meta charset="UTF-8"><title>${table.name || 'Table ' + table.number}</title>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700;900&family=Montserrat:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { width:10cm; height:15cm; display:flex; align-items:center; justify-content:center; background:#fff; font-family:'Montserrat',sans-serif; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  .card { width:9cm; height:14cm; border:2px solid #4BB8F0; border-radius:20px; display:flex; flex-direction:column; align-items:center; justify-content:space-between; padding:24px 20px 18px; background:#fff; position:relative; overflow:hidden; box-shadow: 0 4px 24px rgba(75,184,240,0.15); }
  .card::before { content:''; position:absolute; top:0; left:0; right:0; height:5px; background:linear-gradient(90deg,#0A1628,#1E6FA8,#4BB8F0,#1E6FA8,#0A1628); }
  .card::after { content:''; position:absolute; bottom:0; left:0; right:0; height:5px; background:linear-gradient(90deg,#0A1628,#1E6FA8,#4BB8F0,#1E6FA8,#0A1628); }
  .top { text-align:center; width:100%; }
  .group-name { font-family:'Montserrat',sans-serif; font-size:9px; font-weight:600; color:#4BB8F0; letter-spacing:5px; text-transform:uppercase; margin-bottom:2px; }
  .brand-name { font-family:'Cormorant Garamond',serif; font-size:30px; font-weight:700; color:#1E6FA8; letter-spacing:3px; text-transform:uppercase; line-height:1; }
  .brand-sub { font-size:9px; color:#8A9BB5; letter-spacing:3px; text-transform:uppercase; margin-top:4px; font-weight:500; }
  .qr-section { display:flex; flex-direction:column; align-items:center; }
  .qr-frame { padding:10px; border:2px solid #0A1628; border-radius:14px; background:#fff; margin-bottom:14px; box-shadow: inset 0 0 0 3px #4BB8F0, inset 0 0 0 5px #fff, inset 0 0 0 6px #0A1628; }
  .qr-frame img { width:160px; height:160px; display:block; }
  .table-pill { background:linear-gradient(135deg,#0A1628,#0F2040); color:#4BB8F0; border-radius:40px; padding:8px 28px; font-size:16px; font-weight:700; letter-spacing:2px; font-family:'Cormorant Garamond',serif; border: 1.5px solid #4BB8F0; box-shadow: 0 4px 16px rgba(75,184,240,0.25); }
  .scan-row { display:flex; align-items:center; gap:6px; margin-top:10px; }
  .scan-text { font-size:8px; color:#8A9BB5; letter-spacing:2px; text-transform:uppercase; font-weight:500; }
  .bottom { text-align:center; width:100%; }
  .footer-text { font-size:7px; color:#ccc; letter-spacing:0.5px; }
  .corner { position:absolute; width:16px; height:16px; border-color:#4BB8F0; border-style:solid; }
  .corner-tl { top:10px; left:10px; border-width:2px 0 0 2px; border-radius:3px 0 0 0; }
  .corner-tr { top:10px; right:10px; border-width:2px 2px 0 0; border-radius:0 3px 0 0; }
  .corner-bl { bottom:10px; left:10px; border-width:0 0 2px 2px; border-radius:0 0 0 3px; }
  .corner-br { bottom:10px; right:10px; border-width:0 2px 2px 0; border-radius:0 0 3px 0; }
  @media print { @page { size:10cm 15cm; margin:0; } body { width:10cm; height:15cm; } }
</style></head>
<body>
<div class="card">
  <div class="corner corner-tl"></div><div class="corner corner-tr"></div><div class="corner corner-bl"></div><div class="corner corner-br"></div>
  <div class="top">
    <div class="group-name">Orchid Group</div>
    <div class="brand-name">Orchid House</div>
    <div class="brand-sub">Fine Dining Restaurant</div>
  </div>
  <div class="qr-section">
    <div class="qr-frame"><img src="${img}" /></div>
    <div class="table-pill">${table.name || 'Table ' + table.number}</div>
    <div class="scan-row"><span style="font-size:12px;">📱</span><div class="scan-text">Scan to view menu &amp; order</div></div>
  </div>
  <div class="bottom">
    <div class="footer-text">All prices subject to 6% SST &amp; 10% service charge</div>
  </div>
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
  const counts = {
    available: tables.filter(t => t.status === 'available').length,
    reserved:  tables.filter(t => t.status === 'reserved').length,
    occupied:  tables.filter(t => t.status === 'occupied').length,
  }

  return (
    <div style={{ fontFamily: 'Tajawal, sans-serif', direction: 'rtl', color: S.white }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700;800;900&display=swap');
        * { box-sizing: border-box; }
        .table-card { transition: transform .2s, box-shadow .2s; }
        .table-card:hover { transform: translateY(-3px); box-shadow: 0 12px 32px rgba(0,0,0,0.3); }
        select option { background: #0F2040; color: #FAFAF8; }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 900, color: S.white, marginBottom: 4 }}>🪑 Table Management</h1>
          <p style={{ fontSize: 13, color: S.muted }}>Manage tables and print QR codes</p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button onClick={() => setShowLayout(true)} style={{ padding: '10px 18px', borderRadius: 12, border: `1px solid ${S.amber}`, background: S.amberB, color: S.amber, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
            🗺️ Layout Editor
          </button>
          <button onClick={() => setShowAdd(true)} style={{ padding: '10px 20px', borderRadius: 12, border: `1px solid ${S.green}`, background: S.greenB, color: S.green, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
            ➕ Add Table
          </button>
        </div>
      </div>

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
              <div>
                <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 4 }}>Section</label>
                <select style={{ ...inp, cursor: 'pointer', background: S.navy3 }} value={newSection} onChange={e => setNewSection(e.target.value)}>
                  {SECTIONS.map(s => <option key={s.key} value={s.key}>{s.icon} {s.label}</option>)}
                </select>
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

      {/* Layout Editor Modal */}
      {showLayout && (
        <LayoutEditorModal
          tables={tables}
          branches={branches}
          onClose={() => setShowLayout(false)}
          onSaved={fetchTables}
        />
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
                <div style={{ background: 'linear-gradient(160deg, #0A1628 0%, #0F2040 100%)', padding: '20px 16px 28px', display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
                  <div style={{ fontSize: 10, color: S.gold, fontWeight: 700, letterSpacing: 3, marginBottom: 14, textTransform: 'uppercase' }}>🌸 Orchid House</div>
                  <div style={{ background: '#fff', padding: 8, borderRadius: 12, border: '2px solid #4BB8F0', boxShadow: '0 0 20px rgba(75,184,240,0.2)' }}>
                    {qrUrls[table.id] ? (
                      <img src={qrUrls[table.id]} alt="QR" style={{ width: 140, height: 140, display: 'block', borderRadius: 6 }} />
                    ) : (
                      <div style={{ width: 140, height: 140, background: '#f5f5f5', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999', fontSize: 12 }}>⏳</div>
                    )}
                  </div>
                  <div style={{ position: 'absolute', bottom: -16, left: '50%', transform: 'translateX(-50%)', background: 'linear-gradient(135deg, #1E6FA8, #4BB8F0)', color: '#fff', borderRadius: 30, padding: '6px 22px', fontSize: 13, fontWeight: 900, whiteSpace: 'nowrap', boxShadow: '0 4px 16px rgba(75,184,240,0.4)', letterSpacing: 0.5 }}>
                    {table.name || `Table ${table.number}`}
                  </div>
                </div>
                <div style={{ padding: '24px 14px 14px' }}>
                  <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                    {(Object.entries(STATUS) as [TableStatus, typeof STATUS[TableStatus]][]).map(([key, cfg]) => (
                      <button key={key} onClick={() => setStatus(table.id, key)}
                        style={{ flex: 1, padding: '7px 4px', borderRadius: 8, border: `1px solid ${table.status === key ? cfg.color : 'rgba(255,255,255,0.08)'}`, background: table.status === key ? cfg.bg : 'transparent', color: table.status === key ? cfg.color : S.muted, cursor: 'pointer', fontSize: 10, fontFamily: 'Tajawal, sans-serif', fontWeight: table.status === key ? 700 : 400, transition: 'all .15s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: table.status === key ? cfg.color : 'transparent', border: `1px solid ${table.status === key ? cfg.color : 'rgba(255,255,255,0.2)'}`, flexShrink: 0 }} />
                        {cfg.label}
                      </button>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => printQR(table)} style={{ flex: 1, padding: '8px', borderRadius: 8, border: '1px solid #4BB8F0', background: 'rgba(75,184,240,0.12)', color: '#4BB8F0', cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
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
  )
}
