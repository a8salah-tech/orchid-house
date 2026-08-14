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
// ✅ جديد: دعم "بند مفتوح" (Open Item) - صنف حر مش مرتبط بالمنيو، بسعر وملاحظات يدخلها الموظف بنفسه
type QuoteRow = { item: MenuItem | null; qty: number; selectedSize?: { id: string; name_en?: string; name: string; price: number }
  isOpen?: boolean; openName?: string; openPrice?: number; openNotes?: string }

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
  // ✅ جديد: إضافة صف "بند مفتوح" - مش مرتبط بالمنيو، الموظف بيكتب الاسم والسعر بنفسه
  function addOpenRow() { setRows(prev => [...prev, { item: null, qty: 1, isOpen: true, openName: '', openPrice: 0, openNotes: '' }]) }
  function removeRow(idx: number) { setRows(prev => prev.filter((_, i) => i !== idx)) }
  function setOpenField(idx: number, field: 'openName' | 'openPrice' | 'openNotes', value: string | number) {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r))
  }
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
  // ✅ Fix: كان بيرجع لـ 1 فورًا بمجرد مسح الحقل (parseInt('') || 1 بيدّي 1)، فيمنع كتابة رقم جديد.
  // دلوقتي بنسمح بالقيمة صفر مؤقتًا أثناء الكتابة (يظهر الحقل فاضي)، ونمنع أقل من 1 بس لما تسيب الحقل (onBlur)
  function setRowQty(idx: number, qty: number) {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, qty } : r))
  }
  function clampRowQty(idx: number) {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, qty: Math.max(1, r.qty || 1) } : r))
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

  // ✅ Fix: البند المفتوح بيحسب سعره × كميته المُدخلة يدويًا بدل الاعتماد على صنف من المنيو
  const lineTotal = (r: QuoteRow) => r.isOpen ? (r.openPrice || 0) * r.qty : (r.item ? (r.selectedSize?.price ?? r.item.price) * r.qty : 0)
  const subtotal = rows.reduce((s, r) => s + lineTotal(r), 0)
  const serviceCharge = includeServiceCharge ? subtotal * SERVICE_CHARGE_RATE : 0
  const sst = subtotal * SST_RATE // ✅ ضريبة ثابتة دايمًا، مش قابلة للإلغاء
  const grandTotal = subtotal + serviceCharge + sst

  const branchName = branches.find(b => b.id === branchId)?.name || employee?.department || 'Orchid House'

  // ✅ جديد: العروض المحفوظة - الأدمن يشوف كل الفروع وكل العروض، والموظف يشوف عروضه هو بس
  const [savedQuotes, setSavedQuotes] = useState<any[]>([])
  const [savingQuote, setSavingQuote] = useState(false)
  const [expandedQuoteId, setExpandedQuoteId] = useState<string | null>(null)
  // ✅ جديد: وضع تعديل عرض محفوظ - لو له قيمة، الحفظ بيحدّث نفس العرض بدل إنشاء عرض جديد
  const [editingQuoteId, setEditingQuoteId] = useState<string | null>(null)

  // ✅ جديد: تحميل عرض محفوظ في النموذج للتعديل - كل الأصناف بتتحمّل كـ"بند مفتوح" قابل للتعديل الحر
  // (لأن الجدول الحالي بيحفظ اسم/سعر/كمية الصنف بس، مش رابط مباشر بصنف المنيو الأصلي)
  function loadForEdit(q: any) {
    setEditingQuoteId(q.id)
    setBranchId(q.branch_id || '')
    setQuoteTo(q.quote_to || '')
    setQuoteDate(q.quote_date)
    setIncludeServiceCharge(q.include_service_charge)
    setNotes(q.notes && q.notes.length > 0 ? q.notes : [''])
    const loadedRows: QuoteRow[] = (q.items || [])
      .slice()
      .sort((a: any, b: any) => a.sort_order - b.sort_order)
      .map((it: any) => ({ item: null, qty: it.qty, isOpen: true, openName: it.item_name, openPrice: Number(it.unit_price), openNotes: it.notes || '' }))
    setRows(loadedRows.length > 0 ? loadedRows : [{ item: null, qty: 1 }])
    setExpandedQuoteId(null)
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // ✅ جديد: الخروج من وضع التعديل وإرجاع النموذج لحالة "عرض جديد" فاضية
  function cancelEdit() {
    setEditingQuoteId(null)
    setBranchId(employee?.branch_id || '')
    setQuoteTo('')
    setQuoteDate(new Date().toISOString().split('T')[0])
    setRows([{ item: null, qty: 1 }])
    setNotes([''])
    setIncludeServiceCharge(true)
  }

  async function fetchSavedQuotations() {
    let q = sb.from('price_quotations').select('*, branches(name), items:price_quotation_items(*)').order('quote_number', { ascending: true })
    if (!isAdmin) q = q.eq('created_by', employee?.id || '')
    const { data } = await q
    setSavedQuotes(data || [])
  }
  useEffect(() => { if (employee) fetchSavedQuotations() }, [employee?.id, isAdmin])

  // ✅ Fix: الدالة دلوقتي بتدعم وضعين - إنشاء عرض جديد (زي قبل كده)، أو تحديث عرض محفوظ لو editingQuoteId متسجّل
  async function saveQuotation() {
    if (!branchId) { alert('Please select a branch'); return }
    const validRows = rows.filter(r => r.isOpen ? (r.openName || '').trim() : r.item)
    if (validRows.length === 0) { alert('Please add at least one item'); return }
    setSavingQuote(true)
    const payload = {
      branch_id: branchId, quote_to: quoteTo || null, quote_date: quoteDate,
      include_service_charge: includeServiceCharge,
      subtotal, service_charge: serviceCharge, sst, grand_total: grandTotal,
      notes: notes.filter(n => n.trim()),
    }
    let quotationId = editingQuoteId
    if (editingQuoteId) {
      const { error } = await sb.from('price_quotations').update(payload).eq('id', editingQuoteId)
      if (error) { setSavingQuote(false); alert('Error: ' + error.message); return }
      // ✅ أبسط وأضمن طريقة لمزامنة الأصناف بعد التعديل: نمسح القديمة كلها وندرج القائمة الجديدة كاملة
      await sb.from('price_quotation_items').delete().eq('quotation_id', editingQuoteId)
    } else {
      const { data: q, error } = await sb.from('price_quotations').insert([{
        ...payload,
        created_by: employee?.id || null,
        created_by_name: [employee?.name, (employee as any)?.name_en].filter(Boolean).join(' '),
      }]).select().single()
      if (error || !q) { setSavingQuote(false); alert('Error: ' + (error?.message || 'could not save')); return }
      quotationId = q.id
    }
    const itemRows = validRows.map((r, i) => ({
      quotation_id: quotationId,
      item_type: r.isOpen ? 'open' : 'menu',
      item_name: r.isOpen ? (r.openName || '').trim() : `${r.item!.name_en}${r.selectedSize ? ' (' + (r.selectedSize.name_en || r.selectedSize.name) + ')' : ''}`,
      unit_price: r.isOpen ? (r.openPrice || 0) : (r.selectedSize?.price ?? r.item!.price),
      qty: r.qty, line_total: lineTotal(r),
      notes: r.isOpen ? (r.openNotes || null) : null,
      sort_order: i,
    }))
    const { error: itemsErr } = await sb.from('price_quotation_items').insert(itemRows)
    setSavingQuote(false)
    if (itemsErr) { alert('Error saving items: ' + itemsErr.message); return }
    alert(editingQuoteId ? '✅ Quotation updated successfully' : '✅ Quotation saved successfully')
    setEditingQuoteId(null)
    fetchSavedQuotations()
  }

  function printQuotation() {
    const win = window.open('', '_blank')
    if (!win) return
    // ✅ Fix: البند المفتوح يُطبع باسمه وسعره المُدخلين يدويًا بدل بيانات صنف من المنيو
    const rowsHtml = rows.filter(r => r.isOpen ? (r.openName || '').trim() : r.item).map((r, i) => `
      <tr>
        <td style="text-align:center">${i + 1}</td>
        <td>${r.isOpen ? (r.openName || '') : (r.item!.name_en + (r.selectedSize ? ' (' + (r.selectedSize.name_en || r.selectedSize.name) + ')' : ''))}${r.isOpen && r.openNotes ? '<br/><span style="color:#888;font-size:11px">' + r.openNotes + '</span>' : ''}</td>
        <td style="text-align:center">${r.qty}</td>
        <td style="text-align:right">MYR ${(r.isOpen ? (r.openPrice || 0) : (r.selectedSize?.price ?? r.item!.price)).toFixed(2)}</td>
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
        .company-info { font-size:10px; color:#888; margin-top:6px; line-height:1.5; }
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
            <div class="company-info">
              Company Name: ORCHID KEBAB GROUP SDN. BHD.<br/>
              Business Registration No.: 202201021268 (1466965-K)<br/>
              Tax Identification No. (TIN): C29826106050
            </div>
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
            📧 info@restaurantorchid.com &nbsp;|&nbsp; 📱 <a href="https://wa.me/60104410200">+60 10-441 0200</a>
          </div>
        </div>
        <script>window.onload = () => window.print()</script>
      </body></html>
    `)
    win.document.close()
  }

  // ✅ جديد: طباعة مباشرة لعرض محفوظ من القائمة تحت - بدون الحاجة لتحميله في النموذج الأول
  // (دالة مستقلة تمامًا عن حالة النموذج الحالي، بتاخد بياناتها من العرض المحفوظ نفسه)
  function printSavedQuotation(q: any) {
    const win = window.open('', '_blank')
    if (!win) return
    const savedBranchName = q.branches?.name || 'Orchid House'
    const rowsHtml = (q.items || []).slice().sort((a: any, b: any) => a.sort_order - b.sort_order).map((it: any, i: number) => `
      <tr>
        <td style="text-align:center">${i + 1}</td>
        <td>${it.item_name}${it.notes ? '<br/><span style="color:#888;font-size:11px">' + it.notes + '</span>' : ''}</td>
        <td style="text-align:center">${it.qty}</td>
        <td style="text-align:right">MYR ${Number(it.unit_price).toFixed(2)}</td>
        <td style="text-align:right">MYR ${Number(it.line_total).toFixed(2)}</td>
      </tr>`).join('')
    const notesHtml = (q.notes || []).filter((n: string) => n.trim()).map((n: string) => `<li>${n}</li>`).join('')
    const totalsHtml = `
      <div><span>Subtotal</span><span>MYR ${Number(q.subtotal).toFixed(2)}</span></div>
      ${q.include_service_charge ? `<div><span>Service Charge (10%)</span><span>MYR ${Number(q.service_charge).toFixed(2)}</span></div>` : ''}
      <div><span>SST (6%)</span><span>MYR ${Number(q.sst).toFixed(2)}</span></div>
      <div class="grand"><span>Grand Total</span><span>MYR ${Number(q.grand_total).toFixed(2)}</span></div>`
    win.document.write(`
      <html><head><title>Price Quotation #${q.quote_number}</title>
      <style>
        body { font-family: Arial, Helvetica, sans-serif; padding: 32px; color: #1a1a1a; }
        .header { display:flex; align-items:center; gap:16px; border-bottom: 2px solid #C9A84C; padding-bottom:16px; margin-bottom:20px; }
        .header img { width:64px; height:64px; border-radius:50%; object-fit:cover; }
        h1 { font-size:20px; margin:0; color:#1a1a1a; }
        .sub { font-size:12px; color:#666; margin-top:2px; }
        .company-info { font-size:10px; color:#888; margin-top:6px; line-height:1.5; }
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
            <div class="sub">${savedBranchName} — Price Quotation #${q.quote_number}</div>
            <div class="company-info">
              Company Name: ORCHID KEBAB GROUP SDN. BHD.<br/>
              Business Registration No.: 202201021268 (1466965-K)<br/>
              Tax Identification No. (TIN): C29826106050
            </div>
          </div>
        </div>
        <div class="meta">
          <div><strong>Quote To:</strong> ${q.quote_to || '—'}</div>
          <div><strong>Date:</strong> ${q.quote_date}</div>
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
            📧 info@restaurantorchid.com &nbsp;|&nbsp; 📱 <a href="https://wa.me/60104410200">+60 10-441 0200</a>
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
          <div style={{ fontSize: 10, color: S.muted, marginTop: 6, lineHeight: 1.5 }}>
            Company Name: ORCHID KEBAB GROUP SDN. BHD.<br />
            Business Registration No.: 202201021268 (1466965-K)<br />
            Tax Identification No. (TIN): C29826106050
          </div>
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
            {row.isOpen ? (
              // ✅ جديد: بند مفتوح - اسم/سعر/كمية/ملاحظات يدخلها الموظف بنفسه، بدون أي بحث في المنيو
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <span style={{ fontSize: 11, color: S.gold, fontWeight: 700, background: S.gold3, padding: '3px 10px', borderRadius: 999 }}>✎ Open Item</span>
                  {rows.length > 1 && (
                    <button onClick={() => removeRow(i)} style={{ background: 'transparent', border: 'none', color: S.red, cursor: 'pointer', fontSize: 18, flexShrink: 0, padding: '0 4px' }}>✕</button>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <input value={row.openName || ''} onChange={e => setOpenField(i, 'openName', e.target.value)} placeholder="Item name"
                    style={{ ...inp, width: '100%', boxSizing: 'border-box' }} />
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 11, color: S.muted }}>Price:</span>
                      <input type="number" min={0} step="0.01" value={row.openPrice || 0} onChange={e => setOpenField(i, 'openPrice', parseFloat(e.target.value) || 0)}
                        style={{ ...inp, width: 90 }} />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 11, color: S.muted }}>Qty:</span>
                      <input type="number" min={1} value={row.qty === 0 ? '' : row.qty}
                        onChange={e => setRowQty(i, e.target.value === '' ? 0 : (parseInt(e.target.value) || 0))}
                        onBlur={() => clampRowQty(i)}
                        style={{ ...inp, width: 60 }} />
                    </div>
                    <span style={{ fontSize: 14, fontWeight: 800, color: S.gold, marginLeft: 'auto' }}>MYR {lineTotal(row).toFixed(2)}</span>
                  </div>
                  <input value={row.openNotes || ''} onChange={e => setOpenField(i, 'openNotes', e.target.value)} placeholder="Notes (optional)"
                    style={{ ...inp, width: '100%', boxSizing: 'border-box' }} />
                </div>
              </div>
            ) : (
            <>
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
                  <input type="number" min={1} value={row.qty === 0 ? '' : row.qty}
                    onChange={e => setRowQty(i, e.target.value === '' ? 0 : (parseInt(e.target.value) || 0))}
                    onBlur={() => clampRowQty(i)}
                    style={{ ...inp, width: 60 }} />
                </div>
                <span style={{ fontSize: 12, color: S.muted }}>MYR {(row.selectedSize?.price ?? row.item.price).toFixed(2)} each</span>
                <span style={{ fontSize: 14, fontWeight: 800, color: S.gold, marginLeft: 'auto' }}>MYR {lineTotal(row).toFixed(2)}</span>
              </div>
            )}
            </>
            )}
          </div>
        ))}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button onClick={addRow} style={{ padding: '9px 16px', borderRadius: 10, border: `1px solid ${S.gold}`, background: S.gold3, color: S.gold, cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
            + Add Item
          </button>
          {/* ✅ جديد: زر بند مفتوح - جمب زر إضافة صنف من المنيو */}
          <button onClick={addOpenRow} style={{ padding: '9px 16px', borderRadius: 10, border: `1px solid ${S.blue}`, background: S.blueB, color: S.blue, cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
            + Open Item
          </button>
        </div>
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
          📧 info@restaurantorchid.com &nbsp;|&nbsp; 📱 <a href="https://wa.me/60104410200" style={{ color: S.gold, textDecoration: 'none' }}>+60 10-441 0200</a>
        </div>
      </div>

      {/* ✅ جديد: شريط تنبيه لما يكون النموذج محمّل من عرض محفوظ للتعديل */}
      {editingQuoteId && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(59,130,246,0.12)', border: `1px solid ${S.blue}40`, borderRadius: 12, padding: '10px 16px', marginBottom: 16 }}>
          <span style={{ fontSize: 13, color: S.blue, fontWeight: 700 }}>✏️ Editing a saved quotation — saving will update it instead of creating a new one</span>
          <button onClick={cancelEdit} style={{ padding: '6px 14px', borderRadius: 8, border: `1px solid ${S.muted}`, background: 'transparent', color: S.muted, cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>Cancel</button>
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, marginBottom: 40 }}>
        <button onClick={printQuotation}
          style={{ flex: 1, padding: '14px', borderRadius: 12, border: 'none', background: `linear-gradient(135deg, ${S.gold}, ${S.gold2})`, color: S.navy, fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>
          🖨️ Print / Save Quotation
        </button>
        {/* ✅ جديد: حفظ العرض في قاعدة البيانات (منفصل عن الطباعة) عشان يظهر في قائمة "العروض المحفوظة" تحت */}
        <button onClick={saveQuotation} disabled={savingQuote}
          style={{ flex: 1, padding: '14px', borderRadius: 12, border: `1px solid ${S.green}`, background: 'rgba(34,197,94,0.12)', color: S.green, fontWeight: 800, fontSize: 14, cursor: savingQuote ? 'not-allowed' : 'pointer' }}>
          {savingQuote ? '⏳ Saving...' : (editingQuoteId ? '💾 Update Quotation' : '💾 Save Quotation')}
        </button>
      </div>

      {/* ✅ جديد: العروض المحفوظة - مرتبة تصاعديًا من 1، الأدمن يشوف الكل والموظف يشوف عروضه هو بس */}
      <div style={{ marginBottom: 60 }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: S.gold, marginBottom: 14 }}>📋 Saved Quotations</div>
        {savedQuotes.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 30, color: S.muted, fontSize: 13 }}>No saved quotations yet</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {savedQuotes.map(q => {
              const expanded = expandedQuoteId === q.id
              return (
                <div key={q.id} style={{ background: S.navy2, borderRadius: 14, border: `1px solid ${S.border}`, overflow: 'hidden' }}>
                  <div onClick={() => setExpandedQuoteId(expanded ? null : q.id)}
                    style={{ padding: 14, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                    <div>
                      <span style={{ color: S.gold, fontWeight: 800, fontSize: 14 }}>#{q.quote_number}</span>
                      <span style={{ color: S.white, fontWeight: 700, fontSize: 13, marginRight: 10 }}> — {q.quote_to || 'No name'}</span>
                      <div style={{ fontSize: 11, color: S.muted, marginTop: 3 }}>
                        🏪 {q.branches?.name || '—'} &nbsp;|&nbsp; 📅 {q.quote_date} &nbsp;|&nbsp; 👤 {q.created_by_name || '—'}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ color: S.gold, fontWeight: 800, fontSize: 15 }}>MYR {Number(q.grand_total).toFixed(2)}</span>
                      {/* ✅ جديد: تعديل وطباعة مباشرة من القائمة - stopPropagation عشان الضغط عليهم مايفتحش/يقفلش تفاصيل الكارت */}
                      <button onClick={e => { e.stopPropagation(); loadForEdit(q) }} title="Edit"
                        style={{ background: 'transparent', border: `1px solid ${S.blue}`, borderRadius: 8, color: S.blue, cursor: 'pointer', fontSize: 12, padding: '5px 9px' }}>
                        ✏️
                      </button>
                      <button onClick={e => { e.stopPropagation(); printSavedQuotation(q) }} title="Print"
                        style={{ background: 'transparent', border: `1px solid ${S.gold}`, borderRadius: 8, color: S.gold, cursor: 'pointer', fontSize: 12, padding: '5px 9px' }}>
                        🖨️
                      </button>
                      <span style={{ color: S.muted, fontSize: 12 }}>{expanded ? '▲' : '▼'}</span>
                    </div>
                  </div>
                  {expanded && (
                    <div style={{ padding: '0 14px 14px', borderTop: `1px solid ${S.border}` }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, marginTop: 10 }}>
                        <thead>
                          <tr style={{ color: S.muted, textAlign: 'left' }}>
                            <th style={{ padding: '4px 0' }}>Item</th>
                            <th style={{ padding: '4px 0', textAlign: 'center' }}>Qty</th>
                            <th style={{ padding: '4px 0', textAlign: 'right' }}>Unit</th>
                            <th style={{ padding: '4px 0', textAlign: 'right' }}>Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(q.items || []).sort((a: any, b: any) => a.sort_order - b.sort_order).map((it: any) => (
                            <tr key={it.id} style={{ borderTop: `1px solid ${S.border}` }}>
                              <td style={{ padding: '6px 0', color: S.white }}>
                                {it.item_name}{it.item_type === 'open' && <span style={{ color: S.blue, fontSize: 10 }}> (Open)</span>}
                                {it.notes && <div style={{ color: S.muted, fontSize: 10 }}>{it.notes}</div>}
                              </td>
                              <td style={{ padding: '6px 0', textAlign: 'center', color: S.white }}>{it.qty}</td>
                              <td style={{ padding: '6px 0', textAlign: 'right', color: S.muted }}>MYR {Number(it.unit_price).toFixed(2)}</td>
                              <td style={{ padding: '6px 0', textAlign: 'right', color: S.white, fontWeight: 700 }}>MYR {Number(it.line_total).toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px solid ${S.border}`, fontSize: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: S.muted, padding: '3px 0' }}><span>Subtotal</span><span>MYR {Number(q.subtotal).toFixed(2)}</span></div>
                        {q.include_service_charge && <div style={{ display: 'flex', justifyContent: 'space-between', color: S.muted, padding: '3px 0' }}><span>Service Charge (10%)</span><span>MYR {Number(q.service_charge).toFixed(2)}</span></div>}
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: S.muted, padding: '3px 0' }}><span>SST (6%)</span><span>MYR {Number(q.sst).toFixed(2)}</span></div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: S.gold, fontWeight: 800, fontSize: 14, paddingTop: 6 }}><span>Grand Total</span><span>MYR {Number(q.grand_total).toFixed(2)}</span></div>
                      </div>
                      {q.notes && q.notes.length > 0 && (
                        <div style={{ marginTop: 10, fontSize: 11, color: S.muted }}>
                          📝 {q.notes.join(' • ')}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
