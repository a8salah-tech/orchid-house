'use client'
// صفحة إدارة الطاولات وطباعة QR Codes
// ضعها في: app/(dashboard)/tables/page.tsx

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
  card: 'rgba(255,255,255,0.04)', card2: 'rgba(255,255,255,0.08)',
}

type Table = { id: string; number: number; name: string; is_active: boolean }

// رابط المنيو — غيّر الدومين حسب بيئتك
const MENU_BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://your-domain.com'

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
  const [printId, setPrintId] = useState<string | null>(null)

  const fetchTables = useCallback(async () => {
    const { data } = await sb.from('tables').select('*').order('number')
    setTables(data || [])
    setLoading(false)
  }, [sb])

  useEffect(() => { fetchTables() }, [fetchTables])

  // توليد QR لكل طاولة
  useEffect(() => {
    async function genQRs() {
      const urls: Record<string, string> = {}
      for (const t of tables) {
        const url = `${MENU_BASE_URL}/menu/${t.id}`
        try {
          urls[t.id] = await QRCode.toDataURL(url, {
            width: 300,
            margin: 2,
            color: { dark: '#0A1628', light: '#FAFAF8' },
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
    }])
    setNewNum('')
    setNewName('')
    setShowAdd(false)
    setSaving(false)
    fetchTables()
  }

  async function toggleActive(id: string, current: boolean) {
    await sb.from('tables').update({ is_active: !current }).eq('id', id)
    fetchTables()
  }

  function printQR(table: Table) {
    const url  = `${MENU_BASE_URL}/menu/${table.id}`
    const img  = qrUrls[table.id]
    const win  = window.open('', '_blank')
    if (!win || !img) return
    win.document.write(`
      <!DOCTYPE html><html dir="rtl">
      <head>
        <meta charset="UTF-8">
        <title>QR - ${table.name}</title>
        <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700;900&display=swap" rel="stylesheet">
        <style>
          body { margin: 0; display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #fff; font-family: Tajawal, sans-serif; }
          .card { text-align: center; padding: 40px; border: 3px solid #C9A84C; border-radius: 24px; width: 320px; }
          .logo { font-size: 28px; font-weight: 900; color: #0A1628; margin-bottom: 6px; }
          .sub  { font-size: 14px; color: #666; margin-bottom: 20px; }
          img   { width: 260px; height: 260px; border-radius: 12px; }
          .table-name { font-size: 22px; font-weight: 900; color: #0A1628; margin-top: 16px; }
          .url  { font-size: 10px; color: #999; margin-top: 8px; word-break: break-all; }
          .inst { font-size: 13px; color: #C9A84C; margin-top: 12px; font-weight: 700; }
          @media print { @page { margin: 0; } body { -webkit-print-color-adjust: exact; } }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="logo">🍽️ قائمة الطعام</div>
          <div class="sub">امسح الكود لعرض المنيو وتقديم طلبك</div>
          <img src="${img}" alt="QR Code" />
          <div class="table-name">${table.name || `طاولة ${table.number}`}</div>
          <div class="inst">📱 وجّه كاميرا هاتفك نحو الكود</div>
          <div class="url">${url}</div>
        </div>
        <script>window.onload = () => { window.print(); }<\/script>
      </body></html>
    `)
    win.document.close()
  }

  const inp: React.CSSProperties = {
    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)',
    borderRadius: 10, padding: '10px 14px', fontSize: 13,
    color: '#FAFAF8', outline: 'none', fontFamily: 'Tajawal, sans-serif',
    boxSizing: 'border-box', direction: 'rtl', width: '100%',
  }

  return (
    <div style={{ minHeight: '100vh', background: S.navy, fontFamily: 'Tajawal, sans-serif', direction: 'rtl' }}>

      {/* Header */}
      <div style={{ background: S.navy2, borderBottom: `1px solid ${S.border}`, padding: '0 24px', display: 'flex', alignItems: 'center', height: 60, gap: 16, position: 'sticky', top: 0, zIndex: 100 }}>
        <h1 style={{ color: S.gold, fontSize: 18, fontWeight: 900 }}>🪑 إدارة الطاولات وQR Codes</h1>
        <button onClick={() => setShowAdd(true)}
          style={{ marginRight: 'auto', padding: '8px 18px', borderRadius: 10, border: `1px solid ${S.green}`, background: S.greenB, color: S.green, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
          ➕ إضافة طاولة
        </button>
      </div>

      <div style={{ padding: 24, maxWidth: 1000, margin: '0 auto' }}>

        {/* Modal إضافة طاولة */}
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
            {tables.map(table => (
              <div key={table.id} style={{ background: S.navy2, borderRadius: 16, border: `1px solid ${table.is_active ? S.border : S.red + '40'}`, overflow: 'hidden', opacity: table.is_active ? 1 : 0.6 }}>

                {/* QR Image */}
                <div style={{ background: '#FAFAF8', padding: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {qrUrls[table.id] ? (
                    <img src={qrUrls[table.id]} alt="QR" style={{ width: 160, height: 160, borderRadius: 8 }} />
                  ) : (
                    <div style={{ width: 160, height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999', fontSize: 13 }}>⏳ جاري التوليد...</div>
                  )}
                </div>

                <div style={{ padding: '12px 14px' }}>
                  <div style={{ color: S.white, fontWeight: 800, fontSize: 16, marginBottom: 2 }}>
                    {table.name || `طاولة ${table.number}`}
                  </div>
                  <div style={{ color: S.muted, fontSize: 11, marginBottom: 12 }}>
                    /menu/{table.id.slice(-8)}...
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => printQR(table)}
                      style={{ flex: 1, padding: '8px', borderRadius: 8, border: `1px solid ${S.gold}`, background: S.gold3, color: S.gold, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
                      🖨️ طباعة
                    </button>
                    <button onClick={() => toggleActive(table.id, table.is_active)}
                      style={{ padding: '8px 12px', borderRadius: 8, border: `1px solid ${table.is_active ? S.red : S.green}`, background: table.is_active ? S.redB : S.greenB, color: table.is_active ? S.red : S.green, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif' }}>
                      {table.is_active ? 'إيقاف' : 'تفعيل'}
                    </button>
                  </div>
                </div>

              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
