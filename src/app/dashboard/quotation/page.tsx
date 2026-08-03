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
  green: '#22C55E', red: '#EF4444', blue: '#3B82F6', blueB: 'rgba(59,130,246,0.12)',
  card: 'rgba(255,255,255,0.04)',
}

const ROW_COUNT = 10
const SERVICE_CHARGE_RATE = 0.10
const SST_RATE = 0.06

type MenuItem = { id: string; name_en: string; price: number; or_code?: string }
type QuoteRow = { item: MenuItem | null; qty: number }

export default function QuotationPage() {
  const sbRef = useRef(createClient())
  const sb = sbRef.current
  const { employee, permissions } = useAuth()
  const isAdmin = permissions?.all === true

  const [branchId, setBranchId] = useState(employee?.branch_id || '')
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([])
  useEffect(() => {
    if (isAdmin) sb.from('branches').select('id,name').eq('is_active', true).order('name').then(({ data }) => setBranches(data || []))
  }, [isAdmin, sb])
  useEffect(() => { if (employee?.branch_id) setBranchId(employee.branch_id) }, [employee?.branch_id])

  const [items, setItems] = useState<MenuItem[]>([])
  useEffect(() => {
    sb.from('menu_items').select('id,name_en,price,or_code').eq('is_available', true).order('name_en')
      .then(({ data }) => setItems((data as any) || []))
  }, [sb])

  const [quoteTo, setQuoteTo] = useState('')
  const [quoteDate, setQuoteDate] = useState(() => new Date().toISOString().split('T')[0])
  const [rows, setRows] = useState<QuoteRow[]>(Array.from({ length: ROW_COUNT }, () => ({ item: null, qty: 1 })))
  const [notes, setNotes] = useState<string[]>([''])
  const [searchOpenFor, setSearchOpenFor] = useState<number | null>(null)
  const [search, setSearch] = useState('')

  function setRowItem(idx: number, item: MenuItem) {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, item } : r))
    setSearchOpenFor(null)
    setSearch('')
  }
  function setRowQty(idx: number, qty: number) {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, qty: Math.max(1, qty) } : r))
  }
  function clearRow(idx: number) {
    setRows(prev => prev.map((r, i) => i === idx ? { item: null, qty: 1 } : r))
  }

  function addNote() { setNotes(prev => [...prev, '']) }
  function updateNote(idx: number, val: string) { setNotes(prev => prev.map((n, i) => i === idx ? val : n)) }
  function removeNote(idx: number) { setNotes(prev => prev.filter((_, i) => i !== idx)) }

  const filteredItems = items.filter(i =>
    !search || i.name_en.toLowerCase().includes(search.toLowerCase()) || (i.or_code || '').toLowerCase().includes(search.toLowerCase())
  )

  const subtotal = rows.reduce((s, r) => s + (r.item ? r.item.price * r.qty : 0), 0)
  const serviceCharge = subtotal * SERVICE_CHARGE_RATE
  const sst = subtotal * SST_RATE
  const grandTotal = subtotal + serviceCharge + sst

  const branchName = branches.find(b => b.id === branchId)?.name || employee?.department || 'Orchid House'

  function printQuotation() {
    const win = window.open('', '_blank')
    if (!win) return
    const rowsHtml = rows.map((r, i) => `
      <tr>
        <td style="text-align:center">${i + 1}</td>
        <td>${r.item ? r.item.name_en : ''}</td>
        <td style="text-align:center">${r.item ? r.qty : ''}</td>
        <td style="text-align:right">${r.item ? 'MYR ' + r.item.price.toFixed(2) : ''}</td>
        <td style="text-align:right">${r.item ? 'MYR ' + (r.item.price * r.qty).toFixed(2) : ''}</td>
      </tr>`).join('')
    const notesHtml = notes.filter(n => n.trim()).map(n => `<li>${n}</li>`).join('')
    win.document.write(`
      <html><head><title>Price Quotation</title>
      <style>
        body { font-family: Arial, Helvetica, sans-serif; padding: 32px; color: #1a1a1a; }
        .header { display:flex; align-items:center; gap:16px; border-bottom: 2px solid #C9A84C; padding-bottom:16px; margin-bottom:20px; }
        .header img { width:64px; height:64px; border-radius:50%; object-fit:cover; }
        h1 { font-size:20px; margin:0; color:#1a1a1a; }
        .sub { font-size:12px; color:#666; margin-top:2px; }
        .meta { display:flex; justify-content:space-between; font-size:13px; margin-bottom:20px; }
        table { width:100%; border-collapse:collapse; font-size:13px; margin-bottom:20px; }
        th, td { border:1px solid #ccc; padding:8px 10px; }
        th { background:#f5f0e0; text-align:left; }
        .totals { width:280px; margin-left:auto; font-size:13px; }
        .totals div { display:flex; justify-content:space-between; padding:6px 0; border-bottom:1px solid #eee; }
        .totals .grand { font-weight:bold; font-size:15px; border-top:2px solid #C9A84C; border-bottom:none; padding-top:10px; }
        .notes { margin-top:24px; font-size:12px; }
        .notes h3 { font-size:13px; margin-bottom:6px; }
        .footer { margin-top:32px; text-align:center; }
        .footer .welcome { font-size:13px; color:#444; font-style:italic; margin:2px 0; }
        .footer hr { border:none; border-top:1px solid #C9A84C; width:120px; margin:14px auto; }
        .footer .branches { display:flex; justify-content:center; gap:60px; font-size:11px; color:#555; margin-bottom:10px; }
        .footer .contact { font-size:12px; color:#333; }
        .footer .contact a { color:#333; text-decoration:none; }
        @media print { body { padding: 10px; } }
      </style></head>
      <body>
        <div class="header">
          <img src="/logo.png" alt="Orchid House" />
          <div>
            <h1>Orchid House</h1>
            <div class="sub">${branchName} — Price Quotation</div>
          </div>
        </div>
        <div class="meta">
          <div><strong>Quote To:</strong> ${quoteTo || '—'}</div>
          <div><strong>Date:</strong> ${quoteDate}</div>
        </div>
        <table>
          <thead><tr><th>#</th><th>Item</th><th>Qty</th><th>Unit Price</th><th>Total</th></tr></thead>
          <tbody>${rowsHtml}</tbody>
        </table>
        <div class="totals">
          <div><span>Subtotal</span><span>MYR ${subtotal.toFixed(2)}</span></div>
          <div><span>Service Charge (10%)</span><span>MYR ${serviceCharge.toFixed(2)}</span></div>
          <div><span>SST (6%)</span><span>MYR ${sst.toFixed(2)}</span></div>
          <div class="grand"><span>Grand Total</span><span>MYR ${grandTotal.toFixed(2)}</span></div>
        </div>
        ${notesHtml ? `<div class="notes"><h3>Notes</h3><ul>${notesHtml}</ul></div>` : ''}
        <div class="footer">
          <p class="welcome">Thank you for considering Orchid House for your special occasion.</p>
          <p class="welcome">We look forward to welcoming you and creating an unforgettable dining experience.</p>
          <hr />
          <div class="branches">
            <div><strong>Orchid House</strong><br/>02, Lorong Raja Uda 1</div>
            <div><strong>Orchid KLCC</strong><br/>4, Lorong Yap Kwan Seng</div>
          </div>
          <div class="contact">
            📧 info@malaysiaunis.com &nbsp;|&nbsp; 📱 <a href="https://wa.me/60104410200">+60 10-441 0200</a>
          </div>
        </div>
        <script>window.onload = () => window.print()</script>
      </body></html>
    `)
    win.document.close()
  }

  const inp: React.CSSProperties = { background: S.card, border: `1px solid ${S.border}`, borderRadius: 8, padding: '8px 10px', fontSize: 13, color: S.white, outline: 'none', fontFamily: 'inherit' }

  return (
    <div style={{ fontFamily: 'Arial, Helvetica, sans-serif', color: S.white, maxWidth: 900, margin: '0 auto' }}>
      <style>{`select { color-scheme: dark; } select option { background-color: #0F2040; color: #FAFAF8; }`}</style>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, borderBottom: `2px solid ${S.gold}`, paddingBottom: 16, marginBottom: 20 }}>
        <img src="/logo.png" alt="Orchid House" style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover' }} />
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: S.gold, margin: 0 }}>Orchid House</h1>
          <div style={{ fontSize: 12, color: S.muted }}>Price Quotation</div>
        </div>
      </div>

      {isAdmin && (
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 4 }}>Branch</label>
          <select value={branchId} onChange={e => setBranchId(e.target.value)} style={{ ...inp, maxWidth: 260 }}>
            <option value="">-- Select branch --</option>
            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
      )}

      {/* Quote meta */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 4 }}>Quote To</label>
          <input style={{ ...inp, width: '100%', boxSizing: 'border-box' }} value={quoteTo} onChange={e => setQuoteTo(e.target.value)} placeholder="Customer / Company name" />
        </div>
        <div>
          <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 4 }}>Date</label>
          <input type="date" style={inp} value={quoteDate} onChange={e => setQuoteDate(e.target.value)} />
        </div>
      </div>

      {/* Items table - 10 fixed rows */}
      <div style={{ background: S.navy2, borderRadius: 14, border: `1px solid ${S.border}`, overflow: 'hidden', marginBottom: 20 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: S.card }}>
              {['#', 'Item', 'Qty', 'Unit Price', 'Total', ''].map(h => (
                <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 11, color: S.muted, fontWeight: 700, borderBottom: `1px solid ${S.border}` }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} style={{ borderBottom: `1px solid ${S.border}` }}>
                <td style={{ padding: '8px 12px', fontSize: 12, color: S.muted }}>{i + 1}</td>
                <td style={{ padding: '8px 12px', position: 'relative' }}>
                  <div onClick={() => { setSearchOpenFor(i); setSearch('') }}
                    style={{ cursor: 'pointer', fontSize: 13, color: row.item ? S.white : S.muted, minWidth: 160 }}>
                    {row.item ? row.item.name_en : '+ Select item'}
                  </div>
                  {searchOpenFor === i && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 50, background: S.navy3, border: `1px solid ${S.gold}60`, borderRadius: 10, padding: 10, width: 260, maxHeight: 260, overflowY: 'auto', boxShadow: '0 8px 24px rgba(0,0,0,.5)' }}>
                      <input autoFocus value={search} onChange={e => setSearch(e.target.value)} placeholder="Search item..."
                        style={{ ...inp, width: '100%', boxSizing: 'border-box', marginBottom: 8 }} />
                      {filteredItems.slice(0, 30).map(it => (
                        <div key={it.id} onClick={() => setRowItem(i, it)}
                          style={{ padding: '7px 8px', borderRadius: 6, cursor: 'pointer', fontSize: 12, display: 'flex', justifyContent: 'space-between' }}
                          onMouseEnter={e => (e.currentTarget.style.background = S.card)}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                          <span>{it.name_en}</span>
                          <span style={{ color: S.gold }}>MYR {it.price.toFixed(2)}</span>
                        </div>
                      ))}
                      <div onClick={() => setSearchOpenFor(null)} style={{ textAlign: 'center', fontSize: 11, color: S.muted, cursor: 'pointer', marginTop: 6 }}>Close</div>
                    </div>
                  )}
                </td>
                <td style={{ padding: '8px 12px' }}>
                  {row.item && (
                    <input type="number" min={1} value={row.qty} onChange={e => setRowQty(i, parseInt(e.target.value) || 1)}
                      style={{ ...inp, width: 60 }} />
                  )}
                </td>
                <td style={{ padding: '8px 12px', fontSize: 13, color: S.muted }}>{row.item ? `MYR ${row.item.price.toFixed(2)}` : ''}</td>
                <td style={{ padding: '8px 12px', fontSize: 13, fontWeight: 700, color: S.gold }}>{row.item ? `MYR ${(row.item.price * row.qty).toFixed(2)}` : ''}</td>
                <td style={{ padding: '8px 12px' }}>
                  {row.item && <button onClick={() => clearRow(i)} style={{ background: 'transparent', border: 'none', color: S.red, cursor: 'pointer', fontSize: 14 }}>✕</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Totals */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 24 }}>
        <div style={{ width: 280, background: S.navy2, borderRadius: 14, border: `1px solid ${S.border}`, padding: 16 }}>
          {[
            { label: 'Subtotal', value: subtotal },
            { label: 'Service Charge (10%)', value: serviceCharge },
            { label: 'SST (6%)', value: sst },
          ].map(r => (
            <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 13, color: S.muted, borderBottom: `1px solid ${S.border}` }}>
              <span>{r.label}</span><span>MYR {r.value.toFixed(2)}</span>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 12, fontSize: 16, fontWeight: 800, color: S.gold }}>
            <span>Grand Total</span><span>MYR {grandTotal.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Notes - dynamically added */}
      <div style={{ background: S.navy2, borderRadius: 14, border: `1px solid ${S.border}`, padding: 16, marginBottom: 24 }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Notes</div>
        {notes.map((note, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <input value={note} onChange={e => updateNote(i, e.target.value)} placeholder={`Note ${i + 1}`}
              style={{ ...inp, flex: 1 }} />
            <button onClick={() => removeNote(i)} style={{ background: 'transparent', border: 'none', color: S.red, cursor: 'pointer', fontSize: 14 }}>✕</button>
          </div>
        ))}
        <button onClick={addNote} style={{ padding: '8px 14px', borderRadius: 8, border: `1px solid ${S.gold}`, background: S.gold3, color: S.gold, cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
          + Add Note
        </button>
      </div>

      {/* Welcome message + branches + contact - shown on screen and in print */}
      <div style={{ textAlign: 'center', marginBottom: 24, padding: '20px 0' }}>
        <p style={{ fontSize: 13, color: S.muted, fontStyle: 'italic', margin: '2px 0' }}>Thank you for considering Orchid House for your special occasion.</p>
        <p style={{ fontSize: 13, color: S.muted, fontStyle: 'italic', margin: '2px 0' }}>We look forward to welcoming you and creating an unforgettable dining experience.</p>
        <div style={{ width: 100, height: 1, background: S.gold, margin: '16px auto' }} />
        <div style={{ display: 'flex', justifyContent: 'center', gap: 50, fontSize: 12, color: S.muted, marginBottom: 10, flexWrap: 'wrap' }}>
          <div><strong style={{ color: S.white }}>Orchid House</strong><br />02, Lorong Raja Uda 1</div>
          <div><strong style={{ color: S.white }}>Orchid KLCC</strong><br />4, Lorong Yap Kwan Seng</div>
        </div>
        <div style={{ fontSize: 13, color: S.white }}>
          📧 info@malaysiaunis.com &nbsp;|&nbsp; 📱 <a href="https://wa.me/60104410200" style={{ color: S.gold, textDecoration: 'none' }}>+60 10-441 0200</a>
        </div>
      </div>

      <button onClick={printQuotation}
        style={{ width: '100%', padding: '14px', borderRadius: 12, border: 'none', background: `linear-gradient(135deg, ${S.gold}, ${S.gold2})`, color: S.navy, fontWeight: 800, fontSize: 14, cursor: 'pointer', marginBottom: 40 }}>
        🖨️ Print / Save Quotation
      </button>
    </div>
  )
}
