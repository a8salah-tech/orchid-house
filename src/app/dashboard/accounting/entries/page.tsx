'use client'


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

// Entry types config
const ENTRY_TYPES = {
  receipt:  { label: 'Receipt Voucher',  labelAr: 'سند قبض',       icon: '📥', color: S.green,  bg: S.greenB,  prefix: 'RV',  defaultDebit: '1101', defaultCredit: '4101' },
  payment:  { label: 'Payment Voucher',  labelAr: 'سند صرف',       icon: '📤', color: S.red,    bg: S.redB,    prefix: 'PV',  defaultDebit: '6101', defaultCredit: '1101' },
  check:    { label: 'Check Voucher',    labelAr: 'سند شيك',       icon: '🧾', color: S.amber,  bg: S.amberB,  prefix: 'CH',  defaultDebit: '6101', defaultCredit: '1103' },
  transfer: { label: 'Bank Transfer',    labelAr: 'حوالة بنكية',   icon: '🏦', color: S.blue,   bg: S.blueB,   prefix: 'BT',  defaultDebit: '1103', defaultCredit: '1103' },
  expense:  { label: 'Expense Voucher',  labelAr: 'سند مصروف',     icon: '💸', color: S.purple, bg: S.purpleB, prefix: 'EV',  defaultDebit: '6400', defaultCredit: '1101' },
  purchase: { label: 'Purchase Invoice', labelAr: 'فاتورة مشتريات', icon: '🛒', color: S.teal,   bg: S.tealB,   prefix: 'PI',  defaultDebit: '5001', defaultCredit: '2101' },
  sales:    { label: 'Sales Invoice',    labelAr: 'فاتورة مبيعات',  icon: '🧾', color: S.gold,   bg: S.gold3,   prefix: 'SI',  defaultDebit: '1101', defaultCredit: '4101' },
  journal:  { label: 'Journal Entry',    labelAr: 'قيد يومية',     icon: '📋', color: S.muted,  bg: S.card,    prefix: 'JE',  defaultDebit: '',     defaultCredit: ''     },
}

type EntryType = keyof typeof ENTRY_TYPES

type Line = { id: string; account_code: string; account_name: string; description: string; debit: number; credit: number; sort_order: number }
type Entry = {
  id: string; entry_number: string; entry_type: EntryType
  date: string; reference?: string; check_number?: string; bank_name?: string
  description: string; total_amount: number; status: 'draft' | 'posted' | 'cancelled'
  notes?: string; created_at: string
  journal_entry_lines?: Line[]
}
type Account = { code: string; name: string; name_en?: string; type: string }

// ══ Print Voucher ══
function printVoucher(entry: Entry, lines: Line[]) {
  const cfg = ENTRY_TYPES[entry.entry_type]
  const totalDebit = lines.reduce((s, l) => s + l.debit, 0)
  const totalCredit = lines.reduce((s, l) => s + l.credit, 0)
  const win = window.open('', '_blank')
  if (!win) return
  win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
  <title>${cfg.labelAr} - ${entry.entry_number}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Segoe UI',Arial,sans-serif;font-size:11px;padding:20px;direction:rtl;}
    .header{text-align:center;border-bottom:2px solid #000;padding-bottom:12px;margin-bottom:16px;}
    .title{font-size:20px;font-weight:900;color:#0A1628;}
    .sub{font-size:13px;color:#555;margin-top:4px;}
    .meta{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:16px;}
    .meta-box{border:1px solid #ddd;border-radius:6px;padding:8px 12px;}
    .meta-label{font-size:9px;color:#888;margin-bottom:3px;}
    .meta-value{font-size:13px;font-weight:700;}
    .desc-box{border:1px solid #ddd;border-radius:6px;padding:10px 14px;margin-bottom:16px;background:#f9f9f9;}
    table{width:100%;border-collapse:collapse;margin-bottom:16px;}
    th{background:#0A1628;color:#fff;padding:7px 10px;text-align:right;font-size:10px;}
    td{padding:6px 10px;border-bottom:1px solid #eee;font-size:11px;text-align:right;}
    .total-row{background:#f0f4ff;font-weight:bold;}
    .sigs{display:grid;grid-template-columns:1fr 1fr 1fr;gap:20px;margin-top:30px;}
    .sig-box{text-align:center;border-top:1px solid #999;padding-top:8px;font-size:10px;color:#555;}
    .badge{display:inline-block;background:#22C55E20;color:#22C55E;border-radius:20px;padding:3px 12px;font-size:10px;font-weight:700;}
    @media print{@page{size:A5;margin:8mm;}}
  </style></head><body>
  <div class="header">
    <div class="title">🌸 ORCHID HOUSE</div>
    <div class="sub">${cfg.icon} ${cfg.labelAr} — ${cfg.label}</div>
  </div>

  <div class="meta">
    <div class="meta-box">
      <div class="meta-label">رقم السند</div>
      <div class="meta-value" style="color:#C9A84C;font-size:16px;letter-spacing:1px">${entry.entry_number}</div>
    </div>
    <div class="meta-box">
      <div class="meta-label">التاريخ</div>
      <div class="meta-value">${new Date(entry.date).toLocaleDateString('ar-SA', { year:'numeric',month:'long',day:'numeric' })}</div>
    </div>
    <div class="meta-box">
      <div class="meta-label">المبلغ الإجمالي</div>
      <div class="meta-value" style="color:#22C55E;font-size:15px">MYR ${entry.total_amount.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
    </div>
  </div>

  ${entry.reference || entry.check_number || entry.bank_name ? `
  <div class="meta">
    ${entry.reference ? `<div class="meta-box"><div class="meta-label">المرجع</div><div class="meta-value">${entry.reference}</div></div>` : ''}
    ${entry.check_number ? `<div class="meta-box"><div class="meta-label">رقم الشيك</div><div class="meta-value">${entry.check_number}</div></div>` : ''}
    ${entry.bank_name ? `<div class="meta-box"><div class="meta-label">البنك</div><div class="meta-value">${entry.bank_name}</div></div>` : ''}
  </div>` : ''}

  <div class="desc-box">
    <div style="font-size:10px;color:#888;margin-bottom:4px">البيان</div>
    <div style="font-size:13px;font-weight:600">${entry.description}</div>
    ${entry.notes ? `<div style="font-size:11px;color:#666;margin-top:6px">${entry.notes}</div>` : ''}
  </div>

  <table>
    <thead><tr>
      <th>كود الحساب</th><th>اسم الحساب</th><th>البيان</th>
      <th>مدين (MYR)</th><th>دائن (MYR)</th>
    </tr></thead>
    <tbody>
      ${lines.map(l => `<tr>
        <td style="font-family:monospace;font-weight:bold;color:#3B82F6">${l.account_code}</td>
        <td>${l.account_name}</td>
        <td style="color:#666">${l.description||''}</td>
        <td style="font-family:monospace;font-weight:${l.debit>0?'bold':'normal'};color:${l.debit>0?'#22C55E':'#999'}">${l.debit>0?l.debit.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 }):'—'}</td>
        <td style="font-family:monospace;font-weight:${l.credit>0?'bold':'normal'};color:${l.credit>0?'#EF4444':'#999'}">${l.credit>0?l.credit.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 }):'—'}</td>
      </tr>`).join('')}
      <tr class="total-row">
        <td colspan="3" style="text-align:center;font-weight:bold">الإجمالي</td>
        <td style="font-family:monospace;color:#22C55E;font-size:13px">${totalDebit.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
        <td style="font-family:monospace;color:#EF4444;font-size:13px">${totalCredit.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
      </tr>
    </tbody>
  </table>

  <div class="sigs">
    <div class="sig-box">المحاسب<br>Accountant</div>
    <div class="sig-box">المدير المالي<br>Finance Manager</div>
    <div class="sig-box">المدير العام<br>General Manager</div>
  </div>
  <script>window.onload=()=>window.print()<\/script>
  </body></html>`)
  win.document.close()
}

// ══ Entry Form Modal ══
function EntryModal({ entry, accounts, branches, onClose, onSaved }: {
  entry?: Entry | null; accounts: Account[]; branches: { id: string; name: string }[]; onClose: () => void; onSaved: () => void
}) {
  const sbRef = useRef(createClient())
  const sb = sbRef.current
  const [saving, setSaving] = useState(false)
  const [entryType, setEntryType] = useState<EntryType>(entry?.entry_type || 'receipt')
  const cfg = ENTRY_TYPES[entryType]

  const [form, setForm] = useState({
    date: entry?.date || new Date().toISOString().split('T')[0],
    reference: entry?.reference || '',
    check_number: entry?.check_number || '',
    bank_name: entry?.bank_name || '',
    description: entry?.description || '',
    notes: entry?.notes || '',
    // ✅ الفرع - إجباري لأي قيد جديد من دلوقتي، القيود القديمة (من غير هذا الحقل) هتفضل بدون فرع محدد
    branch_id: (entry as any)?.branch_id || '',
  })

  const [lines, setLines] = useState<Omit<Line,'id'>[]>(
    entry?.journal_entry_lines?.length ? entry.journal_entry_lines.map(l => ({
      account_code: l.account_code, account_name: l.account_name,
      description: l.description, debit: l.debit, credit: l.credit, sort_order: l.sort_order
    })) : [
      { account_code: cfg.defaultDebit, account_name: accounts.find(a=>a.code===cfg.defaultDebit)?.name||'', description:'', debit:0, credit:0, sort_order:0 },
      { account_code: cfg.defaultCredit, account_name: accounts.find(a=>a.code===cfg.defaultCredit)?.name||'', description:'', debit:0, credit:0, sort_order:1 },
    ]
  )

  const [accSearch, setAccSearch] = useState<number | null>(null)
  const [accQuery, setAccQuery] = useState('')

  const totalDebit = lines.reduce((s,l) => s + (l.debit||0), 0)
  const totalCredit = lines.reduce((s,l) => s + (l.credit||0), 0)
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01

  function addLine() {
    setLines(prev => [...prev, { account_code:'', account_name:'', description:'', debit:0, credit:0, sort_order: prev.length }])
  }

  function removeLine(i: number) {
    setLines(prev => prev.filter((_,idx) => idx !== i))
  }

  function updateLine(i: number, field: string, value: any) {
    setLines(prev => prev.map((l,idx) => idx === i ? { ...l, [field]: value } : l))
  }

  function selectAccount(lineIdx: number, acc: Account) {
    updateLine(lineIdx, 'account_code', acc.code)
    updateLine(lineIdx, 'account_name', acc.name)
    setAccSearch(null)
    setAccQuery('')
  }

  // Auto-fill description from type
  useEffect(() => {
    if (!form.description) setForm(p => ({ ...p, description: cfg.labelAr }))
  }, [entryType])

  async function save(status: 'draft' | 'posted') {
    if (!form.description.trim()) { alert('البيان مطلوب'); return }
    if (!form.branch_id) { alert('يرجى اختيار الفرع'); return }
    if (lines.some(l => !l.account_code)) { alert('يرجى اختيار الحساب لكل بند'); return }
    if (!isBalanced) { alert('القيد غير متوازن — المدين ≠ الدائن'); return }

    setSaving(true)

    // Generate entry number if new
    let entryNumber = entry?.entry_number
    if (!entryNumber) {
      const year = new Date().getFullYear()
      const { count } = await sb.from('journal_entries').select('id', { count: 'exact', head: true }).eq('entry_type', entryType)
      const seq = String((count || 0) + 1).padStart(4, '0')
      entryNumber = `${cfg.prefix}-${year}-${seq}`
    }

    const payload = {
      entry_number: entryNumber,
      entry_type: entryType,
      date: form.date,
      reference: form.reference || null,
      check_number: form.check_number || null,
      bank_name: form.bank_name || null,
      description: form.description,
      total_amount: totalDebit,
      status,
      notes: form.notes || null,
      branch_id: form.branch_id,
    }

    let entryId = entry?.id
    if (entry) {
      await sb.from('journal_entries').update(payload).eq('id', entry.id)
      await sb.from('journal_entry_lines').delete().eq('entry_id', entry.id)
    } else {
      const { data } = await sb.from('journal_entries').insert([payload]).select('id').single()
      entryId = data?.id
    }

    if (entryId) {
      const linesPayload = lines.map((l,i) => ({ entry_id: entryId, ...l, sort_order: i }))
      await sb.from('journal_entry_lines').insert(linesPayload)
    }

    setSaving(false)
    onSaved()
  }

  const inp: React.CSSProperties = { width:'100%', background:'rgba(255,255,255,.04)', border:`1px solid ${S.border}`, borderRadius:10, padding:'9px 12px', fontSize:13, color:S.white, outline:'none', fontFamily:'Tajawal, sans-serif', boxSizing:'border-box' as const }
  const numInp: React.CSSProperties = { ...inp, width:110, textAlign:'right', fontFamily:'monospace' }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.9)', zIndex:400, display:'flex', alignItems:'flex-start', justifyContent:'center', padding:16, overflowY:'auto' }}>
      <div style={{ background:S.navy2, borderRadius:20, border:`1px solid ${S.border}`, width:'100%', maxWidth:860, padding:24, margin:'auto' }}>
        {/* Header */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
          <h2 style={{ color:S.white, fontSize:17, fontWeight:800 }}>{entry ? '✏️ تعديل سند' : '➕ سند جديد'}</h2>
          <button onClick={onClose} style={{ background:'transparent', border:'none', color:S.muted, fontSize:22, cursor:'pointer' }}>✕</button>
        </div>

        {/* Type Selector */}
        {!entry && (
          <div style={{ marginBottom:20 }}>
            <label style={{ fontSize:12, color:S.muted, display:'block', marginBottom:8 }}>نوع السند</label>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(120px,1fr))', gap:8 }}>
              {(Object.entries(ENTRY_TYPES) as [EntryType, typeof ENTRY_TYPES[EntryType]][]).map(([k,t]) => (
                <button key={k} onClick={() => setEntryType(k)}
                  style={{ padding:'10px 8px', borderRadius:12, border:`1px solid ${entryType===k?t.color:S.border}`, background:entryType===k?t.bg:'transparent', color:entryType===k?t.color:S.muted, cursor:'pointer', fontSize:12, fontFamily:'Tajawal, sans-serif', fontWeight:entryType===k?700:400, textAlign:'center' }}>
                  <div style={{ fontSize:18, marginBottom:3 }}>{t.icon}</div>
                  <div>{t.labelAr}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Type badge */}
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:20, background:cfg.bg, border:`1px solid ${cfg.color}40`, borderRadius:12, padding:'10px 16px' }}>
          <span style={{ fontSize:22 }}>{cfg.icon}</span>
          <div>
            <div style={{ fontWeight:700, color:cfg.color, fontSize:15 }}>{cfg.labelAr}</div>
            <div style={{ fontSize:11, color:S.muted }}>{cfg.label} · {cfg.prefix}-{new Date().getFullYear()}-XXXX</div>
          </div>
        </div>

        {/* Form Fields */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12, marginBottom:16 }}>
          <div>
            <label style={{ fontSize:12, color:S.muted, display:'block', marginBottom:5 }}>🏪 الفرع *</label>
            <select style={inp} value={form.branch_id} onChange={e => setForm(p=>({...p,branch_id:e.target.value}))}>
              <option value="">-- اختر الفرع --</option>
              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize:12, color:S.muted, display:'block', marginBottom:5 }}>التاريخ *</label>
            <input type="date" style={inp} value={form.date} onChange={e => setForm(p=>({...p,date:e.target.value}))} />
          </div>
          <div>
            <label style={{ fontSize:12, color:S.muted, display:'block', marginBottom:5 }}>رقم المرجع</label>
            <input style={inp} placeholder="INV-001 / PO-123" value={form.reference} onChange={e => setForm(p=>({...p,reference:e.target.value}))} />
          </div>
          {(entryType === 'check') && (
            <div>
              <label style={{ fontSize:12, color:S.muted, display:'block', marginBottom:5 }}>🧾 رقم الشيك</label>
              <input style={inp} placeholder="CHQ-000123" value={form.check_number} onChange={e => setForm(p=>({...p,check_number:e.target.value}))} />
            </div>
          )}
          {(entryType === 'check' || entryType === 'transfer') && (
            <div>
              <label style={{ fontSize:12, color:S.muted, display:'block', marginBottom:5 }}>🏦 اسم البنك</label>
              <input style={inp} placeholder="Maybank / CIMB" value={form.bank_name} onChange={e => setForm(p=>({...p,bank_name:e.target.value}))} />
            </div>
          )}
        </div>

        <div style={{ marginBottom:16 }}>
          <label style={{ fontSize:12, color:S.muted, display:'block', marginBottom:5 }}>البيان *</label>
          <input style={inp} placeholder="وصف السند..." value={form.description} onChange={e => setForm(p=>({...p,description:e.target.value}))} />
        </div>

        {/* Lines */}
        <div style={{ marginBottom:16 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
            <label style={{ fontSize:13, color:S.white, fontWeight:700 }}>بنود القيد المحاسبي</label>
            <button onClick={addLine} style={{ padding:'6px 12px', borderRadius:8, border:`1px solid ${S.blue}`, background:S.blueB, color:S.blue, cursor:'pointer', fontSize:12, fontFamily:'Tajawal, sans-serif' }}>+ إضافة بند</button>
          </div>

          <div style={{ background:S.navy3, borderRadius:12, overflow:'hidden', border:`1px solid ${S.border}` }}>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr style={{ background:'rgba(255,255,255,0.05)' }}>
                  {['كود الحساب', 'اسم الحساب', 'البيان', 'مدين', 'دائن', ''].map(h => (
                    <th key={h} style={{ padding:'10px 12px', fontSize:11, color:S.muted, fontWeight:700, textAlign:'right', borderBottom:`1px solid ${S.border}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lines.map((line, i) => (
                  <tr key={i} style={{ borderBottom:`1px solid ${S.border}` }}>
                    <td style={{ padding:'8px 12px', position:'relative' }}>
                      <input style={{ ...inp, width:90, fontSize:12, fontFamily:'monospace', fontWeight:700 }}
                        placeholder="1101" value={line.account_code}
                        onChange={e => { updateLine(i,'account_code',e.target.value); setAccSearch(i); setAccQuery(e.target.value) }}
                        onFocus={() => { setAccSearch(i); setAccQuery(line.account_code) }} />
                      {accSearch === i && (
                        <div style={{ position:'absolute', top:'100%', right:0, width:320, background:S.navy2, border:`1px solid ${S.border}`, borderRadius:10, maxHeight:200, overflowY:'auto', zIndex:100 }}>
                          {accounts.filter(a => a.code.includes(accQuery) || a.name.includes(accQuery)).slice(0,8).map(acc => (
                            <div key={acc.code} onClick={() => selectAccount(i, acc)}
                              style={{ padding:'8px 12px', cursor:'pointer', borderBottom:`1px solid ${S.border}`, display:'flex', gap:10, alignItems:'center' }}
                              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background='rgba(255,255,255,.05)'}
                              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background='transparent'}>
                              <span style={{ fontFamily:'monospace', color:S.blue, fontSize:12, fontWeight:700, minWidth:40 }}>{acc.code}</span>
                              <span style={{ fontSize:12, color:S.white }}>{acc.name}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                    <td style={{ padding:'8px 12px', fontSize:12, color:S.muted }}>{line.account_name || '—'}</td>
                    <td style={{ padding:'8px 12px' }}>
                      <input style={{ ...inp, fontSize:12 }} placeholder="بيان البند" value={line.description} onChange={e => updateLine(i,'description',e.target.value)} />
                    </td>
                    <td style={{ padding:'8px 12px' }}>
                      <input type="number" style={{ ...numInp, color:line.debit>0?S.green:S.muted }} placeholder="0.00"
                        value={line.debit||''}
                        onChange={e => { updateLine(i,'debit',parseFloat(e.target.value)||0); if(parseFloat(e.target.value)>0) updateLine(i,'credit',0) }} />
                    </td>
                    <td style={{ padding:'8px 12px' }}>
                      <input type="number" style={{ ...numInp, color:line.credit>0?S.red:S.muted }} placeholder="0.00"
                        value={line.credit||''}
                        onChange={e => { updateLine(i,'credit',parseFloat(e.target.value)||0); if(parseFloat(e.target.value)>0) updateLine(i,'debit',0) }} />
                    </td>
                    <td style={{ padding:'8px 12px' }}>
                      <button onClick={() => removeLine(i)} style={{ background:'transparent', border:'none', color:S.red, cursor:'pointer', fontSize:16 }}>🗑️</button>
                    </td>
                  </tr>
                ))}
                {/* Totals */}
                <tr style={{ background:'rgba(255,255,255,0.04)' }}>
                  <td colSpan={3} style={{ padding:'10px 12px', fontSize:13, fontWeight:700, color:S.white, textAlign:'right' }}>الإجمالي</td>
                  <td style={{ padding:'10px 12px', fontFamily:'monospace', fontWeight:800, fontSize:14, color:S.green }}>{totalDebit.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  <td style={{ padding:'10px 12px', fontFamily:'monospace', fontWeight:800, fontSize:14, color:S.red }}>{totalCredit.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  <td style={{ padding:'10px 12px' }}>
                    {isBalanced
                      ? <span style={{ color:S.green, fontSize:18 }}>✅</span>
                      : <span style={{ color:S.red, fontSize:12 }}>فرق: {Math.abs(totalDebit-totalCredit).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Notes */}
        <div style={{ marginBottom:20 }}>
          <label style={{ fontSize:12, color:S.muted, display:'block', marginBottom:5 }}>ملاحظات</label>
          <textarea style={{ ...inp, minHeight:60, resize:'vertical' as const }} placeholder="ملاحظات إضافية..." value={form.notes} onChange={e => setForm(p=>({...p,notes:e.target.value}))} />
        </div>

        {/* Actions */}
        <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
          <button onClick={onClose} style={{ padding:'11px 20px', borderRadius:10, border:`1px solid ${S.muted}`, background:'transparent', color:S.muted, cursor:'pointer', fontFamily:'Tajawal, sans-serif' }}>إلغاء</button>
          <button onClick={() => save('draft')} disabled={saving} style={{ padding:'11px 20px', borderRadius:10, border:`1px solid ${S.amber}`, background:S.amberB, color:S.amber, cursor:'pointer', fontFamily:'Tajawal, sans-serif', fontWeight:700 }}>
            {saving ? '⏳...' : '💾 حفظ مسودة'}
          </button>
          <button onClick={() => save('posted')} disabled={saving||!isBalanced} style={{ padding:'11px 24px', borderRadius:10, border:'none', background:isBalanced?`linear-gradient(135deg,${S.gold},${S.gold2})`:'#333', color:isBalanced?S.navy:S.muted, cursor:isBalanced?'pointer':'not-allowed', fontFamily:'Tajawal, sans-serif', fontWeight:800, fontSize:14 }}>
            {saving ? '⏳...' : '✅ ترحيل وحفظ'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ══ Main ══
export default function JournalEntriesPage() {
  const sbRef = useRef(createClient())
  const sb = sbRef.current

  const [entries, setEntries] = useState<Entry[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [editEntry, setEditEntry] = useState<Entry | null>(null)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | EntryType>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'draft' | 'posted'>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    const [entriesRes, accountsRes, branchesRes] = await Promise.all([
      sb.from('journal_entries').select('*, journal_entry_lines(*)').order('date', { ascending: false }).order('created_at', { ascending: false }).limit(200),
      sb.from('chart_of_accounts').select('code,name,name_en,type').eq('is_active', true).order('code'),
      sb.from('branches').select('id,name').eq('is_active', true).order('name'),
    ])
    setEntries((entriesRes.data as any) || [])
    setAccounts((accountsRes.data as any) || [])
    setBranches(branchesRes.data || [])
    setLoading(false)
  }, [sb])

  useEffect(() => { fetchAll() }, [fetchAll])

  async function deleteEntry(id: string) {
    if (!confirm('حذف هذا السند؟')) return
    await sb.from('journal_entries').delete().eq('id', id)
    fetchAll()
  }

  async function cancelEntry(id: string) {
    if (!confirm('إلغاء هذا السند؟')) return
    await sb.from('journal_entries').update({ status: 'cancelled' }).eq('id', id)
    fetchAll()
  }

  const filtered = entries.filter(e => {
    const matchType = typeFilter === 'all' || e.entry_type === typeFilter
    const matchStatus = statusFilter === 'all' || e.status === statusFilter
    const matchSearch = !search || e.entry_number.includes(search) || e.description.includes(search) || e.reference?.includes(search) || e.check_number?.includes(search)
    return matchType && matchStatus && matchSearch
  })

  const totals = {
    all: entries.length,
    draft: entries.filter(e => e.status === 'draft').length,
    posted: entries.filter(e => e.status === 'posted').length,
    totalAmount: entries.filter(e => e.status === 'posted').reduce((s,e) => s + e.total_amount, 0),
  }

  const inp: React.CSSProperties = { background:'rgba(255,255,255,.04)', border:`1px solid ${S.border}`, borderRadius:10, padding:'9px 14px', fontSize:13, color:S.white, outline:'none', fontFamily:'Tajawal, sans-serif', boxSizing:'border-box' as const }

  return (
    <div style={{ fontFamily:'Tajawal, sans-serif', color:S.white, direction:'rtl' }}>
      <style>{`select option{background:#0F2040;color:#FAFAF8} tr:hover{background:rgba(255,255,255,0.02)!important;}`}</style>

      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:24, flexWrap:'wrap', gap:12 }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:900, marginBottom:4 }}>💸 سندات القيد</h1>
          <p style={{ fontSize:13, color:S.muted }}>الدورة المستندية الكاملة للمطعم</p>
        </div>
        <button onClick={() => setShowAdd(true)} style={{ padding:'10px 22px', borderRadius:12, border:`1px solid ${S.gold}`, background:S.gold3, color:S.gold, cursor:'pointer', fontSize:14, fontFamily:'Tajawal, sans-serif', fontWeight:800 }}>
          ➕ سند جديد
        </button>
      </div>

      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))', gap:12, marginBottom:24 }}>
        {[
          { label:'إجمالي السندات', value:totals.all, color:S.white, icon:'📋' },
          { label:'مرحّل', value:totals.posted, color:S.green, icon:'✅' },
          { label:'مسودة', value:totals.draft, color:S.amber, icon:'📝' },
          { label:'إجمالي المرحّل', value:`MYR ${totals.totalAmount.toLocaleString('en-US',{maximumFractionDigits:0})}`, color:S.gold, icon:'💰' },
        ].map((s,i) => (
          <div key={i} style={{ background:S.card2, borderRadius:14, border:`1px solid ${S.border}`, padding:'16px 18px' }}>
            <div style={{ fontSize:20, marginBottom:6 }}>{s.icon}</div>
            <div style={{ fontSize:20, fontWeight:800, color:s.color, marginBottom:4 }}>{s.value}</div>
            <div style={{ fontSize:11, color:S.muted }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Type Filter Tabs */}
      <div style={{ display:'flex', gap:8, marginBottom:16, overflowX:'auto', paddingBottom:4 }}>
        <button onClick={() => setTypeFilter('all')} style={{ padding:'7px 14px', borderRadius:20, border:`1px solid ${typeFilter==='all'?S.gold:S.border}`, background:typeFilter==='all'?S.gold3:'transparent', color:typeFilter==='all'?S.gold:S.muted, cursor:'pointer', fontSize:12, fontFamily:'Tajawal, sans-serif', fontWeight:typeFilter==='all'?700:400, whiteSpace:'nowrap' }}>
          الكل ({entries.length})
        </button>
        {(Object.entries(ENTRY_TYPES) as [EntryType, typeof ENTRY_TYPES[EntryType]][]).map(([k,t]) => {
          const count = entries.filter(e => e.entry_type === k).length
          return (
            <button key={k} onClick={() => setTypeFilter(k)}
              style={{ padding:'7px 14px', borderRadius:20, border:`1px solid ${typeFilter===k?t.color:S.border}`, background:typeFilter===k?t.bg:'transparent', color:typeFilter===k?t.color:S.muted, cursor:'pointer', fontSize:12, fontFamily:'Tajawal, sans-serif', fontWeight:typeFilter===k?700:400, whiteSpace:'nowrap' }}>
              {t.icon} {t.labelAr} ({count})
            </button>
          )
        })}
      </div>

      {/* Filters */}
      <div style={{ display:'flex', gap:10, marginBottom:20 }}>
        <input style={{ ...inp, flex:1 }} placeholder="🔍 بحث برقم السند أو البيان..." value={search} onChange={e => setSearch(e.target.value)} />
        <div style={{ display:'flex', background:S.navy3, borderRadius:10, padding:4, gap:4 }}>
          {(['all','draft','posted'] as const).map(s => (
            <button key={s} onClick={() => setStatusFilter(s)} style={{ padding:'6px 12px', borderRadius:8, border:'none', background:statusFilter===s?S.gold3:'transparent', color:statusFilter===s?S.gold:S.muted, cursor:'pointer', fontSize:12, fontFamily:'Tajawal, sans-serif', fontWeight:statusFilter===s?700:400 }}>
              {s==='all'?'الكل':s==='draft'?'مسودة':'مرحّل'}
            </button>
          ))}
        </div>
      </div>

      {/* Entries Table */}
      {loading ? (
        <div style={{ textAlign:'center', padding:60, color:S.muted }}>⏳ جاري التحميل...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign:'center', padding:60, color:S.muted }}>
          <div style={{ fontSize:40, marginBottom:12 }}>💸</div>
          <div style={{ marginBottom:16 }}>لا توجد سندات</div>
          <button onClick={() => setShowAdd(true)} style={{ padding:'10px 20px', borderRadius:10, border:`1px solid ${S.gold}`, background:S.gold3, color:S.gold, cursor:'pointer', fontSize:13, fontFamily:'Tajawal, sans-serif', fontWeight:700 }}>➕ إضافة أول سند</button>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {filtered.map(entry => {
            const cfg = ENTRY_TYPES[entry.entry_type]
            const isExpanded = expandedId === entry.id
            const lines = entry.journal_entry_lines || []
            const statusCfg = entry.status === 'posted' ? { color:S.green, bg:S.greenB, label:'مرحّل' } : entry.status === 'draft' ? { color:S.amber, bg:S.amberB, label:'مسودة' } : { color:S.red, bg:S.redB, label:'ملغي' }

            return (
              <div key={entry.id} style={{ background:S.navy2, borderRadius:14, border:`1px solid ${entry.status==='posted'?S.border:entry.status==='draft'?S.amber+'40':S.red+'40'}`, overflow:'hidden' }}>
                <div style={{ padding:'14px 18px', display:'flex', alignItems:'center', gap:14, cursor:'pointer' }} onClick={() => setExpandedId(isExpanded?null:entry.id)}>
                  {/* Icon */}
                  <div style={{ width:44, height:44, borderRadius:12, background:cfg.bg, border:`1px solid ${cfg.color}40`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, flexShrink:0 }}>
                    {cfg.icon}
                  </div>

                  {/* Info */}
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:3, flexWrap:'wrap' }}>
                      <span style={{ fontFamily:'monospace', fontWeight:900, fontSize:14, color:S.gold }}>{entry.entry_number}</span>
                      <span style={{ background:cfg.bg, color:cfg.color, borderRadius:20, padding:'2px 10px', fontSize:10, fontWeight:700 }}>{cfg.labelAr}</span>
                      <span style={{ background:statusCfg.bg, color:statusCfg.color, borderRadius:20, padding:'2px 10px', fontSize:10, fontWeight:700 }}>{statusCfg.label}</span>
                    </div>
                    <div style={{ fontSize:13, color:S.white, marginBottom:2 }}>{entry.description}</div>
                    <div style={{ fontSize:11, color:S.muted }}>
                      {new Date(entry.date).toLocaleDateString('ar-SA')}
                      {entry.reference && ` · Ref: ${entry.reference}`}
                      {entry.check_number && ` · شيك: ${entry.check_number}`}
                      {entry.bank_name && ` · ${entry.bank_name}`}
                    </div>
                  </div>

                  {/* Amount */}
                  <div style={{ textAlign:'left', flexShrink:0 }}>
                    <div style={{ fontFamily:'monospace', fontWeight:900, fontSize:16, color:S.gold }}>MYR {entry.total_amount.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                    <div style={{ fontSize:11, color:S.muted }}>{lines.length} بنود</div>
                  </div>

                  {/* Actions */}
                  <div style={{ display:'flex', gap:6, flexShrink:0 }} onClick={e => e.stopPropagation()}>
                    <button onClick={() => printVoucher(entry, lines)} style={{ padding:'7px 10px', borderRadius:8, border:`1px solid ${S.blue}`, background:S.blueB, color:S.blue, cursor:'pointer', fontSize:12 }}>🖨️</button>
                    {entry.status !== 'posted' && (
                      <button onClick={() => setEditEntry(entry)} style={{ padding:'7px 10px', borderRadius:8, border:`1px solid ${S.gold}`, background:S.gold3, color:S.gold, cursor:'pointer', fontSize:12 }}>✏️</button>
                    )}
                    {entry.status === 'posted' && (
                      <button onClick={() => cancelEntry(entry.id)} style={{ padding:'7px 10px', borderRadius:8, border:`1px solid ${S.amber}`, background:S.amberB, color:S.amber, cursor:'pointer', fontSize:12 }}>↩️</button>
                    )}
                    {entry.status !== 'posted' && (
                      <button onClick={() => deleteEntry(entry.id)} style={{ padding:'7px 10px', borderRadius:8, border:`1px solid ${S.red}`, background:S.redB, color:S.red, cursor:'pointer', fontSize:12 }}>🗑️</button>
                    )}
                    <span style={{ color:S.muted, display:'flex', alignItems:'center', fontSize:14 }}>{isExpanded?'▲':'▼'}</span>
                  </div>
                </div>

                {/* Lines Detail */}
                {isExpanded && lines.length > 0 && (
                  <div style={{ borderTop:`1px solid ${S.border}`, background:S.navy3 }}>
                    <table style={{ width:'100%', borderCollapse:'collapse' }}>
                      <thead>
                        <tr>
                          {['كود','الحساب','البيان','مدين','دائن'].map(h => (
                            <th key={h} style={{ padding:'8px 14px', fontSize:10, color:S.muted, fontWeight:700, textAlign:'right', borderBottom:`1px solid ${S.border}` }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {lines.sort((a,b)=>a.sort_order-b.sort_order).map(line => (
                          <tr key={line.id} style={{ borderBottom:`1px solid ${S.border}` }}>
                            <td style={{ padding:'8px 14px', fontFamily:'monospace', color:S.blue, fontWeight:700, fontSize:12 }}>{line.account_code}</td>
                            <td style={{ padding:'8px 14px', fontSize:13, color:S.white }}>{line.account_name}</td>
                            <td style={{ padding:'8px 14px', fontSize:12, color:S.muted }}>{line.description||'—'}</td>
                            <td style={{ padding:'8px 14px', fontFamily:'monospace', fontSize:13, color:line.debit>0?S.green:S.muted, fontWeight:line.debit>0?700:400 }}>
                              {line.debit>0?line.debit.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 }):'—'}
                            </td>
                            <td style={{ padding:'8px 14px', fontFamily:'monospace', fontSize:13, color:line.credit>0?S.red:S.muted, fontWeight:line.credit>0?700:400 }}>
                              {line.credit>0?line.credit.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 }):'—'}
                            </td>
                          </tr>
                        ))}
                        <tr style={{ background:'rgba(255,255,255,0.04)' }}>
                          <td colSpan={3} style={{ padding:'8px 14px', fontSize:12, fontWeight:700, color:S.white, textAlign:'right' }}>الإجمالي</td>
                          <td style={{ padding:'8px 14px', fontFamily:'monospace', fontWeight:800, color:S.green }}>
                            {lines.reduce((s,l)=>s+l.debit,0).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td style={{ padding:'8px 14px', fontFamily:'monospace', fontWeight:800, color:S.red }}>
                            {lines.reduce((s,l)=>s+l.credit,0).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {(showAdd || editEntry) && (
        <EntryModal entry={editEntry} accounts={accounts} branches={branches} onClose={() => { setShowAdd(false); setEditEntry(null) }} onSaved={() => { setShowAdd(false); setEditEntry(null); fetchAll() }} />
      )}
    </div>
  )
}
