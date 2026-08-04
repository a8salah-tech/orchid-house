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

const SERVICE_CHARGE_RATE = 0.10
const SST_RATE = 0.06

type MenuItem = { id: string; name_en: string; price: number; or_code?: string; category_id: string
  sizes?: { id: string; name_en?: string; name: string; price: number; is_active: boolean }[] }
type QuoteRow = { item: MenuItem | null; qty: number; selectedSize?: { id: string; name_en?: string; name: string; price: number } }

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

  const [categories, setCategories] = useState<{ id: string; name_en: string; name: string }[]>([])
  const [items, setItems] = useState<MenuItem[]>([])
  useEffect(() => {
    sb.from('menu_categories').select('id,name_en,name').eq('is_active', true).order('sort_order').then(({ data }) => setCategories(data || []))
    sb.from('menu_items').select('id,name_en,price,or_code,category_id,sizes:menu_item_sizes(id,name,name_en,price,is_active)').eq('is_available', true).order('name_en')
      .then(({ data }) => setItems((data as any) || []))
  }, [sb])

  const [quoteTo, setQuoteTo] = useState('')
  const [quoteDate, setQuoteDate] = useState(() => new Date().toISOString().split('T')[0])
  // ✅ Fix: الصفوف تبدأ بواحد بس (زي الملاحظات بالظبط) - تقدر تضيف كل ما تحتاج بدل عدد ثابت مسبقًا
  const [rows, setRows] = useState<QuoteRow[]>([{ item: null, qty: 1 }])
  const [notes, setNotes] = useState<string[]>([''])
  const [searchOpenFor, setSearchOpenFor] = useState<number | null>(null)
  const [search, setSearch] = useState('')
  // ✅ جديد: بحث بالكود منفصل - زي صفحة المنيو بالظبط
  const [codeSearch, setCodeSearch] = useState('')
  const [selectedCat, setSelectedCat] = useState('all')
  // ✅ جديد: منتقي الحجم/النوع الفرعي - يظهر لو الصنف عنده أحجام مسجّلة (زي المنيو والكاشير بالظبط)
  const [sizePickerFor, setSizePickerFor] = useState<{ rowIdx: number; item: MenuItem } | null>(null)
  // ✅ جديد: تفعيل/إلغاء رسوم الخدمة والضريبة - قابلة للإيقاف لأي عرض سعر مايحتاجهاش
  const [includeServiceCharge, setIncludeServiceCharge] = useState(true)

  function addRow() { setRows(prev => [...prev, { item: null, qty: 1 }]) }
  function removeRow(idx: number) { setRows(prev => prev.filter((_, i) => i !== idx)) }
  function setRowItem(idx: number, item: MenuItem) {
    const activeSizes = (item.sizes || []).filter(s => s.is_active)
    if (activeSizes.length > 0) {
      setSizePickerFor({ rowIdx: idx, item })
      setSearchOpenFor(null)
      setSearch('')
      return
    }
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, item, selectedSize: undefined } : r))
    setSearchOpenFor(null)
    setSearch('')
  }
  function setRowSize(idx: number, item: MenuItem, size: { id: string; name_en?: string; name: string; price: number }) {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, item, selectedSize: size } : r))
    setSizePickerFor(null)
  }
  function setRowQty(idx: number, qty: number) {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, qty: Math.max(1, qty) } : r))
  }

  function addNote() { setNotes(prev => [...prev, '']) }
  function updateNote(idx: number, val: string) { setNotes(prev => prev.map((n, i) => i === idx ? val : n)) }
  function removeNote(idx: number) { setNotes(prev => prev.filter((_, i) => i !== idx)) }

  const filteredItems = items.filter(i => {
    const matchCat = selectedCat === 'all' || i.category_id === selectedCat
    const matchSearch = !search || i.name_en.toLowerCase().includes(search.toLowerCase()) || (i.or_code || '').toLowerCase().includes(search.toLowerCase())
    const codeDigits = (i.or_code || '').match(/\d+/)?.[0] || ''
    const matchCode = !codeSearch || codeDigits === codeSearch.replace(/\D/g, '')
    return matchCat && matchSearch && matchCode
  })

  const lineTotal = (r: QuoteRow) => (r.item ? (r.selectedSize?.price ?? r.item.price) * r.qty : 0)
  const subtotal = rows.reduce((s, r) => s + lineTotal(r), 0)
  const serviceCharge = includeServiceCharge ? subtotal * SERVICE_CHARGE_RATE : 0
  const sst = subtotal * SST_RATE // ✅ ضريبة ثابتة دايمًا، مش قابلة للإلغاء
  const grandTotal = subtotal + serviceCharge + sst

  const branchName = branches.find(b => b.id === branchId)?.name || employee?.department || 'Orchid House'

  function printQuotation() {
    const win = window.open('', '_blank')
    if (!win) return
    const rowsHtml = rows.filter(r => r.item).map((r, i) => `
      <tr>
        <td style="text-align:center">${i + 1}</td>
        <td>${r.item!.name_en}${r.selectedSize ? ' (' + (r.selectedSize.name_en || r.selectedSize.name) + ')' : ''}</td>
        <td style="text-align:center">${r.qty}</td>
        <td style="text-align:right">MYR ${(r.selectedSize?.price ?? r.item!.price).toFixed(2)}</td>
        <td style="text-align:right">MYR ${lineTotal(r).toFixed(2)}</td>
      </tr>`).join('')
    const notesHtml = notes.filter(n => n.trim()).map(n => `<li>${n}</li>`).join('')
    const totalsHtml = `
      <div><span>Subtotal</span><span>MYR ${subtotal.toFixed(2)}</span></div>
      ${includeServiceCharge ? `<div><span>Service Charge (10%)</span><span>MYR ${serviceCharge.toFixed(2)}</span></div>` : ''}
      <div><span>SST (6%)</span><span>MYR ${sst.toFixed(2)}</span></div>
      <div class="grand"><span>Grand Total</span><span>MYR ${grandTotal.toFixed(2)}</span></div>`
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
          ${totalsHtml}
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

      {/* ✅ Fix: كروت بدل جدول - متجاوبة تمامًا مع الموبايل، وزر الحذف ظاهر دايمًا */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Items</div>
        {rows.map((row, i) => (
          <div key={i} style={{ background: S.navy2, borderRadius: 14, border: `1px solid ${S.border}`, padding: 14, marginBottom: 10, position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: row.item ? 10 : 0 }}>
              <div style={{ flex: 1, position: 'relative' }}>
                <div onClick={() => { setSearchOpenFor(i); setSearch(''); setSelectedCat('all') }}
                  style={{ cursor: 'pointer', fontSize: 14, fontWeight: row.item ? 700 : 400, color: row.item ? S.white : S.muted }}>
                  {row.item ? `${row.item.name_en}${row.selectedSize ? ' (' + (row.selectedSize.name_en || row.selectedSize.name) + ')' : ''}` : '+ Select item from menu'}
                </div>
                {searchOpenFor === i && (
                  <>
                    {/* ✅ جديد: طبقة شفافة تغطي الشاشة كلها - الضغط عليها يقفل القائمة تلقائيًا */}
                    <div onClick={() => setSearchOpenFor(null)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
                    <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', top: '100%', left: 0, zIndex: 50, background: S.navy3, border: `1px solid ${S.gold}60`, borderRadius: 12, padding: 12, width: 'min(320px, 85vw)', maxHeight: 340, overflowY: 'auto', boxShadow: '0 8px 24px rgba(0,0,0,.6)' }}>
                      {/* ✅ جديد: بحث بالاسم + بحث بالكود منفصل - زي صفحة المنيو بالظبط */}
                      <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                        <input autoFocus value={search} onChange={e => setSearch(e.target.value)} placeholder="Search item..."
                          style={{ ...inp, flex: 2, boxSizing: 'border-box' }} />
                        <input value={codeSearch} onChange={e => setCodeSearch(e.target.value.replace(/\D/g, ''))} placeholder="# code" inputMode="numeric"
                          style={{ ...inp, flex: 1, boxSizing: 'border-box' }} />
                      </div>
                      {/* ✅ جديد: تصنيفات زي صفحة المنيو بالظبط */}
                      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', marginBottom: 8, paddingBottom: 4 }}>
                        <button onClick={() => setSelectedCat('all')} style={{ padding: '5px 10px', borderRadius: 16, border: `1px solid ${selectedCat === 'all' ? S.gold : S.border}`, background: selectedCat === 'all' ? S.gold3 : 'transparent', color: selectedCat === 'all' ? S.gold : S.muted, cursor: 'pointer', fontSize: 11, whiteSpace: 'nowrap' }}>All</button>
                        {categories.map(c => (
                          <button key={c.id} onClick={() => setSelectedCat(c.id)} style={{ padding: '5px 10px', borderRadius: 16, border: `1px solid ${selectedCat === c.id ? S.gold : S.border}`, background: selectedCat === c.id ? S.gold3 : 'transparent', color: selectedCat === c.id ? S.gold : S.muted, cursor: 'pointer', fontSize: 11, whiteSpace: 'nowrap' }}>{c.name_en || c.name}</button>
                        ))}
                      </div>
                      {filteredItems.slice(0, 40).map(it => (
                        <div key={it.id} onClick={() => setRowItem(i, it)}
                          style={{ padding: '8px 8px', borderRadius: 6, cursor: 'pointer', fontSize: 12, display: 'flex', justifyContent: 'space-between' }}
                          onMouseEnter={e => (e.currentTarget.style.background = S.card)}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                          <span>{it.or_code ? `#${it.or_code} ` : ''}{it.name_en}{(it.sizes || []).filter(s => s.is_active).length > 0 ? ' ›' : ''}</span>
                          <span style={{ color: S.gold }}>{(it.sizes || []).filter(s => s.is_active).length > 0 ? 'from ' : ''}MYR {((it.sizes || []).filter(s => s.is_active)[0]?.price ?? it.price).toFixed(2)}</span>
                        </div>
                      ))}
                      <div onClick={() => setSearchOpenFor(null)} style={{ textAlign: 'center', fontSize: 11, color: S.muted, cursor: 'pointer', marginTop: 6 }}>Close</div>
                    </div>
                  </>
                )}
              </div>
              {/* ✅ Fix: زر الحذف بقى ظاهر دايمًا في مكان ثابت - مش هيختفي على الموبايل تاني */}
              {rows.length > 1 && (
                <button onClick={() => removeRow(i)} style={{ background: 'transparent', border: 'none', color: S.red, cursor: 'pointer', fontSize: 18, flexShrink: 0, padding: '0 4px' }}>✕</button>
              )}
            </div>
            {row.item && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 11, color: S.muted }}>Qty:</span>
                  <input type="number" min={1} value={row.qty} onChange={e => setRowQty(i, parseInt(e.target.value) || 1)}
                    style={{ ...inp, width: 60 }} />
                </div>
                <span style={{ fontSize: 12, color: S.muted }}>MYR {(row.selectedSize?.price ?? row.item.price).toFixed(2)} each</span>
                <span style={{ fontSize: 14, fontWeight: 800, color: S.gold, marginLeft: 'auto' }}>MYR {lineTotal(row).toFixed(2)}</span>
              </div>
            )}
          </div>
        ))}
        <button onClick={addRow} style={{ padding: '9px 16px', borderRadius: 10, border: `1px solid ${S.gold}`, background: S.gold3, color: S.gold, cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
          + Add Item
        </button>
      </div>

      {/* ✅ جديد: منتقي الحجم/النوع الفرعي - نفس أسلوب المنيو والكاشير بالظبط */}
      {sizePickerFor && (
        <div onClick={() => setSizePickerFor(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.75)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: S.navy2, borderRadius: 20, border: `1px solid ${S.border}`, padding: 20, maxWidth: 360, width: '100%', maxHeight: '80vh', overflowY: 'auto' }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: S.gold, marginBottom: 14 }}>{sizePickerFor.item.name_en} — Select size</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(sizePickerFor.item.sizes || []).filter(s => s.is_active).map(size => (
                <button key={size.id} onClick={() => setRowSize(sizePickerFor.rowIdx, sizePickerFor.item, size)}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', borderRadius: 10, border: `1px solid ${S.border}`, background: S.card, color: S.white, cursor: 'pointer', fontSize: 13, fontFamily: 'inherit', textAlign: 'left' }}>
                  <span>{size.name_en || size.name}</span>
                  <span style={{ color: S.gold, fontWeight: 700 }}>MYR {size.price.toFixed(2)}</span>
                </button>
              ))}
            </div>
            <button onClick={() => setSizePickerFor(null)} style={{ width: '100%', marginTop: 14, padding: '10px 0', borderRadius: 10, border: `1px solid ${S.border}`, background: 'transparent', color: S.muted, cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Totals */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 24 }}>
        <div style={{ width: 300, background: S.navy2, borderRadius: 14, border: `1px solid ${S.border}`, padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 13, color: S.muted, borderBottom: `1px solid ${S.border}` }}>
            <span>Subtotal</span><span>MYR {subtotal.toFixed(2)}</span>
          </div>
          {/* ✅ جديد: زر تفعيل/إلغاء رسوم الخدمة - علامة + لو ملغية، ✕ لو مفعّلة */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', fontSize: 13, color: includeServiceCharge ? S.muted : S.muted + '80', borderBottom: `1px solid ${S.border}` }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button onClick={() => setIncludeServiceCharge(v => !v)}
                style={{ width: 18, height: 18, borderRadius: 5, border: `1px solid ${includeServiceCharge ? S.red : S.green}`, background: 'transparent', color: includeServiceCharge ? S.red : S.green, cursor: 'pointer', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, flexShrink: 0 }}>
                {includeServiceCharge ? '✕' : '+'}
              </button>
              <span style={{ textDecoration: includeServiceCharge ? 'none' : 'line-through' }}>Service Charge (10%)</span>
            </span>
            <span>MYR {serviceCharge.toFixed(2)}</span>
          </div>
          {/* ✅ Fix: SST ضريبة قانونية ثابتة - شلنا زر الإلغاء منها، بتفضل محسوبة دايمًا (بعكس رسوم الخدمة) */}
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 13, color: S.muted, borderBottom: `1px solid ${S.border}` }}>
            <span>SST (6%)</span>
            <span>MYR {sst.toFixed(2)}</span>
          </div>
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
