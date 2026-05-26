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

type Supplier = {
  id: string; name: string; company?: string; category?: string
  email?: string; phone?: string; whatsapp?: string; address?: string
  payment_type: 'cash' | 'credit' | 'mixed'; credit_days: number
  total_purchases: number; outstanding_balance: number
  notes?: string; is_active: boolean; created_at: string
  invoice_count?: number; source?: 'main' | 'warehouse'
}

const PAYMENT_CFG = {
  cash:   { label: 'Cash',   color: S.green,  bg: S.greenB  },
  credit: { label: 'Credit', color: S.amber,  bg: S.amberB  },
  mixed:  { label: 'Mixed',  color: S.blue,   bg: S.blueB   },
}

const CATEGORIES = ['Meat & Poultry', 'Seafood', 'Vegetables & Fruits', 'Dairy & Eggs', 'Dry Goods', 'Beverages', 'Bakery', 'Spices & Condiments', 'Cleaning Supplies', 'Packaging', 'Other']

// ══ Supplier Modal ══
function SupplierModal({ supplier, onClose, onSaved }: { supplier?: Supplier | null; onClose: () => void; onSaved: () => void }) {
  const sbRef = useRef(createClient())
  const sb = sbRef.current
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: supplier?.name || '',
    company: supplier?.company || '',
    category: supplier?.category || '',
    email: supplier?.email || '',
    phone: supplier?.phone || '',
    whatsapp: supplier?.whatsapp || '',
    address: supplier?.address || '',
    payment_type: supplier?.payment_type || 'cash',
    credit_days: supplier?.credit_days?.toString() || '0',
    outstanding_balance: supplier?.outstanding_balance?.toString() || '0',
    notes: supplier?.notes || '',
    is_active: supplier?.is_active !== false,
  })

  async function save() {
    if (!form.name.trim()) { alert('Supplier name is required'); return }
    setSaving(true)
    const payload: any = {
      name: form.name,
      company: form.company || null,
      category: form.category || null,
      email: form.email || null,
      phone: form.phone || null,
      whatsapp: form.whatsapp || null,
      address: form.address || null,
      payment_type: form.payment_type,
      credit_days: parseInt(form.credit_days) || 0,
      outstanding_balance: parseFloat(form.outstanding_balance) || 0,
      notes: form.notes || null,
      is_active: form.is_active,
    }
    let error
    if (supplier) {
      ({ error } = await sb.from('suppliers').update(payload).eq('id', supplier.id))
    } else {
      ({ error } = await sb.from('suppliers').insert([payload]))
    }
    setSaving(false)
    if (error) { alert('Error: ' + error.message); return }
    onSaved()
  }

  const inp: React.CSSProperties = { width: '100%', background: 'rgba(255,255,255,.04)', border: `1px solid ${S.border}`, borderRadius: 10, padding: '10px 14px', fontSize: 13, color: S.white, outline: 'none', fontFamily: 'Tajawal, sans-serif', boxSizing: 'border-box' as const }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.85)', zIndex: 300, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 20, overflowY: 'auto' }}>
      <div style={{ background: S.navy2, borderRadius: 20, border: `1px solid ${S.border}`, width: '100%', maxWidth: 560, padding: 28, margin: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ color: S.white, fontSize: 17, fontWeight: 800 }}>{supplier ? '✏️ Edit Supplier' : '➕ Add Supplier'}</h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: S.muted, fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>Contact Name *</label>
              <input style={inp} placeholder="Ahmed Hassan" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
            </div>
            <div>
              <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>Company Name</label>
              <input style={inp} placeholder="Al Rashid Trading Co." value={form.company} onChange={e => setForm(p => ({ ...p, company: e.target.value }))} />
            </div>
          </div>

          <div>
            <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>Category / Supplies</label>
            <select style={{ ...inp, cursor: 'pointer' }} value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}>
              <option value="">Select category...</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>📧 Email</label>
              <input type="email" style={inp} placeholder="supplier@email.com" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
            </div>
            <div>
              <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>📞 Phone</label>
              <input style={inp} placeholder="+60 12-345 6789" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>📱 WhatsApp</label>
              <input style={inp} placeholder="+60 12-345 6789" value={form.whatsapp} onChange={e => setForm(p => ({ ...p, whatsapp: e.target.value }))} />
            </div>
            <div>
              <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>📍 Address</label>
              <input style={inp} placeholder="Kuala Lumpur, Malaysia" value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} />
            </div>
          </div>

          {/* Payment Type */}
          <div>
            <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 8 }}>Payment Type</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
              {(Object.entries(PAYMENT_CFG) as any[]).map(([k, cfg]: any) => (
                <button key={k} onClick={() => setForm(p => ({ ...p, payment_type: k }))}
                  style={{ padding: '10px', borderRadius: 10, border: `1px solid ${form.payment_type === k ? cfg.color : S.border}`, background: form.payment_type === k ? cfg.bg : 'transparent', color: form.payment_type === k ? cfg.color : S.muted, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: form.payment_type === k ? 700 : 400 }}>
                  {cfg.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {form.payment_type !== 'cash' && (
              <div>
                <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>Credit Days</label>
                <input type="number" style={inp} placeholder="30" value={form.credit_days} onChange={e => setForm(p => ({ ...p, credit_days: e.target.value }))} />
              </div>
            )}
            <div>
              <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>Outstanding Balance (MYR)</label>
              <input type="number" style={inp} placeholder="0.00" value={form.outstanding_balance} onChange={e => setForm(p => ({ ...p, outstanding_balance: e.target.value }))} />
            </div>
          </div>

          <div>
            <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 5 }}>Notes</label>
            <textarea style={{ ...inp, minHeight: 70, resize: 'vertical' as const }} placeholder="Delivery schedule, special terms..." value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', background: S.card, borderRadius: 10, padding: '10px 14px' }}>
            <input type="checkbox" checked={form.is_active} onChange={e => setForm(p => ({ ...p, is_active: e.target.checked }))} style={{ accentColor: S.green, width: 16, height: 16 }} />
            <div>
              <div style={{ fontSize: 13, color: S.white, fontWeight: 600 }}>Active Supplier</div>
              <div style={{ fontSize: 11, color: S.muted }}>Currently supplying to the restaurant</div>
            </div>
          </label>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button onClick={onClose} style={{ padding: '11px 20px', borderRadius: 10, border: `1px solid ${S.muted}`, background: 'transparent', color: S.muted, cursor: 'pointer', fontFamily: 'Tajawal, sans-serif' }}>Cancel</button>
          <button onClick={save} disabled={saving} style={{ flex: 1, padding: '11px', borderRadius: 10, border: `1px solid ${S.gold}`, background: S.gold3, color: S.gold, cursor: 'pointer', fontSize: 14, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
            {saving ? '⏳...' : supplier ? '💾 Save Changes' : '✅ Add Supplier'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ══ Supplier Detail ══
function SupplierDetail({ supplier, onClose, onEdit }: { supplier: Supplier; onClose: () => void; onEdit: () => void }) {
  const sbRef = useRef(createClient())
  const sb = sbRef.current
  const [invoices, setInvoices] = useState<any[]>([])

  useEffect(() => {
    sb.from('purchase_invoices').select('id,invoice_number,invoice_date,total_amount,status').eq('supplier_id', supplier.id).order('invoice_date', { ascending: false })
      .then(({ data }) => setInvoices(data || []))
  }, [supplier.id])

  function printReport() {
    const totalAmount = invoices.filter(i => i.status !== 'cancelled').reduce((s, i) => s + parseFloat(i.total_amount || 0), 0)
    const html = `<!DOCTYPE html><html dir="rtl"><head><meta charset="UTF-8"><title>تقرير المورد - ${supplier.name}</title>
    <style>body{font-family:Arial,sans-serif;padding:30px;color:#000;direction:rtl}h1{color:#C9A84C;border-bottom:2px solid #C9A84C;padding-bottom:10px}table{width:100%;border-collapse:collapse;margin-top:20px}th{background:#0A1628;color:#fff;padding:10px;text-align:right}td{padding:8px 10px;border-bottom:1px solid #ddd}tr:nth-child(even){background:#f9f9f9}.total{font-weight:bold;background:#f0f0f0}.badge{display:inline-block;padding:2px 8px;border-radius:10px;font-size:11px}.info-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:16px 0}.info-box{background:#f5f5f5;padding:12px;border-radius:8px}.info-label{font-size:11px;color:#666;margin-bottom:4px}.info-value{font-weight:bold;font-size:14px}@media print{button{display:none}}</style></head>
    <body>
    <h1>🤝 تقرير المورد</h1>
    <div class="info-grid">
      <div class="info-box"><div class="info-label">اسم المورد</div><div class="info-value">${supplier.name}</div></div>
      ${supplier.company ? `<div class="info-box"><div class="info-label">الشركة</div><div class="info-value">${supplier.company}</div></div>` : ''}
      ${supplier.phone ? `<div class="info-box"><div class="info-label">الهاتف</div><div class="info-value">${supplier.phone}</div></div>` : ''}
      <div class="info-box"><div class="info-label">إجمالي المشتريات</div><div class="info-value" style="color:#22C55E">MYR ${totalAmount.toLocaleString('en-MY', {minimumFractionDigits:2})}</div></div>
      <div class="info-box"><div class="info-label">عدد الفواتير</div><div class="info-value">${invoices.length}</div></div>
    </div>
    <h2>الفواتير</h2>
    <table>
      <thead><tr><th>#</th><th>رقم الفاتورة</th><th>التاريخ</th><th>المبلغ</th><th>الحالة</th></tr></thead>
      <tbody>
        ${invoices.map((inv, i) => `<tr><td>${i+1}</td><td>${inv.invoice_number || '-'}</td><td>${inv.invoice_date}</td><td>MYR ${parseFloat(inv.total_amount).toFixed(2)}</td><td>${inv.status === 'cancelled' ? 'ملغي' : 'مكتمل'}</td></tr>`).join('')}
        <tr class="total"><td colspan="3">الإجمالي</td><td>MYR ${totalAmount.toFixed(2)}</td><td></td></tr>
      </tbody>
    </table>
    <p style="margin-top:30px;font-size:12px;color:#666">تاريخ التقرير: ${new Date().toLocaleDateString('ar-SA')}</p>
    </body></html>`
    const w = window.open('', '_blank')
    if (w) { w.document.write(html); w.document.close(); w.print() }
  }

  const cfg = PAYMENT_CFG[supplier.payment_type]

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.85)', zIndex: 300, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 20, overflowY: 'auto' }}>
      <div style={{ background: S.navy2, borderRadius: 20, border: `1px solid ${S.border}`, width: '100%', maxWidth: 620, padding: 28, margin: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <h2 style={{ color: S.white, fontSize: 18, fontWeight: 800 }}>🤝 {supplier.name}</h2>
            {supplier.company && <div style={{ fontSize: 13, color: S.muted }}>{supplier.company}</div>}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={printReport} style={{ padding: '8px 14px', borderRadius: 10, border: `1px solid ${S.teal}`, background: S.tealB, color: S.teal, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>🖨️ طباعة</button>
            <button onClick={onEdit} style={{ padding: '8px 14px', borderRadius: 10, border: `1px solid ${S.gold}`, background: S.gold3, color: S.gold, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>✏️ Edit</button>
            <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: S.muted, fontSize: 20, cursor: 'pointer' }}>✕</button>
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 20 }}>
          <div style={{ background: S.greenB, border: `1px solid ${S.green}30`, borderRadius: 12, padding: '14px 16px', textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: S.muted, marginBottom: 4 }}>💰 Total Purchases</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: S.green }}>MYR {supplier.total_purchases.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
          </div>
          <div style={{ background: supplier.outstanding_balance > 0 ? S.redB : S.greenB, border: `1px solid ${supplier.outstanding_balance > 0 ? S.red : S.green}30`, borderRadius: 12, padding: '14px 16px', textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: S.muted, marginBottom: 4 }}>⚖️ Outstanding</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: supplier.outstanding_balance > 0 ? S.red : S.green }}>MYR {supplier.outstanding_balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
          </div>
          <div style={{ background: cfg.bg, border: `1px solid ${cfg.color}30`, borderRadius: 12, padding: '14px 16px', textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: S.muted, marginBottom: 4 }}>💳 Payment</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: cfg.color }}>{cfg.label}</div>
            {supplier.credit_days > 0 && <div style={{ fontSize: 11, color: S.muted }}>{supplier.credit_days} days</div>}
          </div>
        </div>

        {/* Contact Info */}
        <div style={{ background: S.card, borderRadius: 14, padding: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: S.white, marginBottom: 12 }}>Contact Information</div>
          {[
            { icon: '📁', label: 'Category', value: supplier.category },
            { icon: '📧', label: 'Email', value: supplier.email, link: supplier.email ? `mailto:${supplier.email}` : null },
            { icon: '📞', label: 'Phone', value: supplier.phone, link: supplier.phone ? `tel:${supplier.phone}` : null },
            { icon: '📱', label: 'WhatsApp', value: supplier.whatsapp, link: supplier.whatsapp ? `https://wa.me/${supplier.whatsapp.replace(/\D/g,'')}` : null },
            { icon: '📍', label: 'Address', value: supplier.address },
            { icon: '📝', label: 'Notes', value: supplier.notes },
          ].filter(r => r.value).map((r, i) => (
            <div key={i} style={{ display: 'flex', gap: 12, padding: '7px 0', borderBottom: `1px solid ${S.border}`, fontSize: 13, alignItems: 'center' }}>
              <span style={{ fontSize: 16 }}>{r.icon}</span>
              <span style={{ color: S.muted, minWidth: 80 }}>{r.label}</span>
              {r.link ? (
                <a href={r.link} target="_blank" rel="noreferrer" style={{ color: S.blue, textDecoration: 'none', fontWeight: 600 }}>{r.value}</a>
              ) : (
                <span style={{ color: S.white }}>{r.value}</span>
              )}
            </div>
          ))}
        </div>

        {/* Recent Invoices */}
        {invoices.length > 0 && (
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: S.white, marginBottom: 10 }}>📄 Recent Invoices</div>
            <div style={{ background: S.navy3, borderRadius: 12, overflow: 'hidden', border: `1px solid ${S.border}` }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr>
                  {['Invoice #', 'Date', 'Amount', 'Status'].map(h => <th key={h} style={{ padding: '8px 12px', fontSize: 11, color: S.muted, fontWeight: 700, borderBottom: `1px solid ${S.border}`, textAlign: 'left' }}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {invoices.map(inv => (
                    <tr key={inv.id}>
                      <td style={{ padding: '8px 12px', fontSize: 12, color: S.gold }}>{inv.invoice_number}</td>
                      <td style={{ padding: '8px 12px', fontSize: 12, color: S.white }}>{new Date(inv.invoice_date).toLocaleDateString('en-GB')}</td>
                      <td style={{ padding: '8px 12px', fontSize: 12, color: S.white, fontWeight: 700 }}>MYR {inv.total_amount?.toFixed(2)}</td>
                      <td style={{ padding: '8px 12px' }}>
                        <span style={{ background: inv.status === 'paid' ? S.greenB : S.amberB, color: inv.status === 'paid' ? S.green : S.amber, borderRadius: 20, padding: '2px 8px', fontSize: 10, fontWeight: 700 }}>{inv.status}</span>
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
export default function SuppliersPage() {
  const sbRef = useRef(createClient())
  const sb = sbRef.current
  const [lang, setLang] = useState<'ar'|'en'>(() => typeof window !== 'undefined' ? (localStorage.getItem('dashboard-lang') as 'ar'|'en' || 'ar') : 'ar')

  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('active')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [editSupplier, setEditSupplier] = useState<Supplier | null>(null)
  const [viewSupplier, setViewSupplier] = useState<Supplier | null>(null)

  const fetchSuppliers = useCallback(async () => {
    // Fetch from both suppliers tables
    const [{ data: mainSuppliers }, { data: warehouseSuppliers }, { data: invoices }] = await Promise.all([
      sb.from('suppliers').select('*').order('name'),
      sb.from('warehouse_suppliers').select('*').order('name'),
      sb.from('purchase_invoices').select('supplier_id,total_amount,status').neq('status', 'cancelled'),
    ])

    // Calculate totals per warehouse supplier
    const invMap: Record<string, { total: number; count: number }> = {}
    ;(invoices || []).forEach((inv: any) => {
      if (inv.supplier_id) {
        if (!invMap[inv.supplier_id]) invMap[inv.supplier_id] = { total: 0, count: 0 }
        invMap[inv.supplier_id].total += parseFloat(inv.total_amount) || 0
        invMap[inv.supplier_id].count += 1
      }
    })

    // Convert warehouse suppliers to same shape as Supplier type
    const wSuppliers: Supplier[] = (warehouseSuppliers || []).map((ws: any) => ({
      id: ws.id, name: ws.name, company: undefined, category: 'مورد مستودع',
      email: undefined, phone: ws.phone || undefined, whatsapp: undefined, address: undefined,
      payment_type: 'cash' as const, credit_days: 0,
      total_purchases: invMap[ws.id]?.total || 0,
      outstanding_balance: 0,
      notes: undefined, is_active: ws.is_active !== false, created_at: ws.created_at,
      invoice_count: invMap[ws.id]?.count || 0,
      source: 'warehouse' as const,
    }))

    // Merge - avoid duplicates by name
    const mainNames = new Set((mainSuppliers || []).map((s: any) => s.name.toLowerCase()))
    const uniqueWarehouse = wSuppliers.filter(ws => !mainNames.has(ws.name.toLowerCase()))

    const combined = [
      ...(mainSuppliers || []).map((s: any) => ({
        ...s,
        invoice_count: invMap[s.id]?.count || 0,
        source: 'main' as const,
      })),
      ...uniqueWarehouse,
    ].sort((a, b) => a.name.localeCompare(b.name))

    setSuppliers(combined)
    setLoading(false)
  }, [sb])

  useEffect(() => { fetchSuppliers() }, [fetchSuppliers])

  const filtered = suppliers.filter(s => {
    const matchSearch = !search || s.name.toLowerCase().includes(search.toLowerCase()) || s.company?.toLowerCase().includes(search.toLowerCase()) || s.phone?.includes(search)
    const matchFilter = filter === 'all' || (filter === 'active' ? s.is_active : !s.is_active)
    const matchCat = !categoryFilter || s.category === categoryFilter
    return matchSearch && matchFilter && matchCat
  })

  const stats = {
    total: suppliers.filter(s => s.is_active).length,
    totalPurchases: suppliers.reduce((sum, s) => sum + s.total_purchases, 0),
    totalOutstanding: suppliers.reduce((sum, s) => sum + s.outstanding_balance, 0),
    cash: suppliers.filter(s => s.payment_type === 'cash' && s.is_active).length,
    credit: suppliers.filter(s => s.payment_type !== 'cash' && s.is_active).length,
  }

  function exportCSV() {
    const rows = [
      ['Name', 'Company', 'Category', 'Phone', 'WhatsApp', 'Email', 'Payment', 'Credit Days', 'Total Purchases', 'Outstanding', 'Status'],
      ...suppliers.map(s => [s.name, s.company||'', s.category||'', s.phone||'', s.whatsapp||'', s.email||'', s.payment_type, s.credit_days, s.total_purchases.toFixed(2), s.outstanding_balance.toFixed(2), s.is_active ? 'Active' : 'Inactive'])
    ]
    const csv = rows.map(r => r.join(',')).join('\n')
    const a = document.createElement('a'); a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv); a.download = 'suppliers.csv'; a.click()
  }

  const inp: React.CSSProperties = { background: 'rgba(255,255,255,.04)', border: `1px solid ${S.border}`, borderRadius: 10, padding: '9px 14px', fontSize: 13, color: S.white, outline: 'none', fontFamily: 'Tajawal, sans-serif', boxSizing: 'border-box' as const }

  return (
    <div style={{ fontFamily: 'Tajawal, sans-serif', color: S.white }}>
      <style>{`select option{background:#0F2040;color:#FAFAF8}`}</style>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 900, marginBottom: 4 }}>🤝 Suppliers</h1>
          <p style={{ fontSize: 13, color: S.muted }}>Manage supplier accounts and balances</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={exportCSV} style={{ padding: '10px 16px', borderRadius: 12, border: `1px solid ${S.blue}`, background: S.blueB, color: S.blue, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>📥 Export</button>
          <button onClick={() => setShowAdd(true)} style={{ padding: '10px 20px', borderRadius: 12, border: `1px solid ${S.green}`, background: S.greenB, color: S.green, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>➕ Add Supplier</button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Active Suppliers', value: stats.total, color: S.white, icon: '🤝' },
          { label: 'Total Purchases', value: `MYR ${stats.totalPurchases.toLocaleString('en-US', { maximumFractionDigits: 0 })}`, color: S.green, icon: '💰' },
          { label: 'Outstanding', value: `MYR ${stats.totalOutstanding.toLocaleString('en-US', { maximumFractionDigits: 0 })}`, color: stats.totalOutstanding > 0 ? S.red : S.green, icon: '⚖️' },
          { label: 'Cash Suppliers', value: stats.cash, color: S.green, icon: '💵' },
          { label: 'Credit Suppliers', value: stats.credit, color: S.amber, icon: '💳' },
        ].map((s, i) => (
          <div key={i} style={{ background: S.card2, borderRadius: 14, border: `1px solid ${S.border}`, padding: '14px 16px' }}>
            <div style={{ fontSize: 20, marginBottom: 6 }}>{s.icon}</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: s.color, marginBottom: 4 }}>{s.value}</div>
            <div style={{ fontSize: 11, color: S.muted }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <input style={{ ...inp, flex: 1, minWidth: 200 }} placeholder="🔍 Search supplier..." value={search} onChange={e => setSearch(e.target.value)} />
        <select style={{ ...inp, width: 'auto', cursor: 'pointer' }} value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
          <option value="">All Categories</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <div style={{ display: 'flex', background: S.navy3, borderRadius: 10, padding: 4, gap: 4 }}>
          {(['all', 'active', 'inactive'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{ padding: '6px 12px', borderRadius: 8, border: 'none', background: filter === f ? S.gold3 : 'transparent', color: filter === f ? S.gold : S.muted, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', fontWeight: filter === f ? 700 : 400, textTransform: 'capitalize' }}>
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Suppliers Grid */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: S.muted }}>⏳ Loading...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: S.muted }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🤝</div>
          <div>No suppliers found</div>
          <button onClick={() => setShowAdd(true)} style={{ marginTop: 16, padding: '10px 20px', borderRadius: 10, border: `1px solid ${S.green}`, background: S.greenB, color: S.green, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>➕ Add First Supplier</button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(320px,1fr))', gap: 14 }}>
          {filtered.map(s => {
            const cfg = PAYMENT_CFG[s.payment_type]
            return (
              <div key={s.id} style={{ background: S.navy2, borderRadius: 16, border: `1px solid ${s.is_active ? S.border : S.red + '30'}`, overflow: 'hidden', cursor: 'pointer', opacity: s.is_active ? 1 : 0.7 }}
                onClick={() => setViewSupplier(s)}>
                <div style={{ padding: '16px 18px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: S.white, marginBottom: 2 }}>{s.name}</div>
                      {s.company && <div style={{ fontSize: 12, color: S.muted }}>{s.company}</div>}
                      <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                        {s.category && <div style={{ display: 'inline-block', background: S.navy3, borderRadius: 20, padding: '2px 10px', fontSize: 11, color: S.muted }}>{s.category}</div>}
                        {s.source === 'warehouse' && <div style={{ display: 'inline-block', background: S.tealB, border: `1px solid ${S.teal}30`, borderRadius: 20, padding: '2px 10px', fontSize: 11, color: S.teal }}>🏭 {lang === 'en' ? 'Warehouse' : 'مستودع'}</div>}
                        {(s.invoice_count || 0) > 0 && <div style={{ display: 'inline-block', background: S.blueB, borderRadius: 20, padding: '2px 10px', fontSize: 11, color: S.blue }}>{s.invoice_count} {lang === 'en' ? 'invoices' : 'فاتورة'}</div>}
                      </div>
                    </div>
                    <span style={{ background: cfg.bg, color: cfg.color, borderRadius: 20, padding: '4px 10px', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{cfg.label}</span>
                  </div>

                  {/* Contact */}
                  <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
                    {s.phone && <div style={{ fontSize: 12, color: S.muted }}>📞 {s.phone}</div>}
                    {s.whatsapp && <div style={{ fontSize: 12, color: S.green }}>📱 WhatsApp</div>}
                  </div>

                  {/* Financials */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <div style={{ background: S.card, borderRadius: 10, padding: '10px 12px' }}>
                      <div style={{ fontSize: 10, color: S.muted, marginBottom: 3 }}>Total Purchases</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: S.gold }}>MYR {s.total_purchases.toLocaleString('en-US', { maximumFractionDigits: 0 })}</div>
                    </div>
                    <div style={{ background: s.outstanding_balance > 0 ? S.redB : S.card, borderRadius: 10, padding: '10px 12px', border: s.outstanding_balance > 0 ? `1px solid ${S.red}30` : 'none' }}>
                      <div style={{ fontSize: 10, color: S.muted, marginBottom: 3 }}>Outstanding</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: s.outstanding_balance > 0 ? S.red : S.green }}>
                        {s.outstanding_balance > 0 ? `MYR ${s.outstanding_balance.toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '✅ Clear'}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 8, marginTop: 12 }} onClick={e => e.stopPropagation()}>
                    {s.whatsapp && (
                      <a href={`https://wa.me/${s.whatsapp.replace(/\D/g,'')}`} target="_blank" rel="noreferrer"
                        style={{ padding: '7px 12px', borderRadius: 8, border: `1px solid ${S.green}`, background: S.greenB, color: S.green, cursor: 'pointer', fontSize: 12, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                        📱 Chat
                      </a>
                    )}
                    {s.phone && (
                      <a href={`tel:${s.phone}`} style={{ padding: '7px 12px', borderRadius: 8, border: `1px solid ${S.blue}`, background: S.blueB, color: S.blue, cursor: 'pointer', fontSize: 12, textDecoration: 'none' }}>
                        📞 Call
                      </a>
                    )}
                    <button onClick={() => setEditSupplier(s)} style={{ padding: '7px 12px', borderRadius: 8, border: `1px solid ${S.gold}`, background: S.gold3, color: S.gold, cursor: 'pointer', fontSize: 12, marginLeft: 'auto' }}>✏️ Edit</button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modals */}
      {(showAdd || editSupplier) && (
        <SupplierModal supplier={editSupplier} onClose={() => { setShowAdd(false); setEditSupplier(null) }} onSaved={() => { setShowAdd(false); setEditSupplier(null); fetchSuppliers() }} />
      )}
      {viewSupplier && (
        <SupplierDetail supplier={viewSupplier} onClose={() => setViewSupplier(null)} onEdit={() => { setEditSupplier(viewSupplier); setViewSupplier(null) }} />
      )}
    </div>
  )
}
