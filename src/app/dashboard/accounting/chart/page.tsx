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
  blue: '#3B82F6', blueB: 'rgba(59,130,246,0.12)',
  amber: '#F59E0B', amberB: 'rgba(245,158,11,0.12)',
  purple: '#8B5CF6', purpleB: 'rgba(139,92,246,0.12)',
  teal: '#14B8A6', tealB: 'rgba(20,184,166,0.12)',
  card: 'rgba(255,255,255,0.04)', card2: 'rgba(255,255,255,0.08)',
}

type Account = {
  id: string; code: string; name: string; name_en?: string
  type: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense'
  category?: string; parent_code?: string; level: number
  is_active: boolean; balance: number; notes?: string
  children?: Account[]
}

const TYPE_CFG: Record<string, { label: string; labelAr: string; color: string; bg: string; icon: string; rangeStart: string }> = {
  asset:     { label: 'Assets',     labelAr: 'الأصول',          color: S.blue,   bg: S.blueB,   icon: '🏦', rangeStart: '1' },
  liability: { label: 'Liabilities',labelAr: 'الالتزامات',      color: S.red,    bg: S.redB,    icon: '⚖️', rangeStart: '2' },
  equity:    { label: 'Equity',     labelAr: 'حقوق الملكية',    color: S.purple, bg: S.purpleB, icon: '💎', rangeStart: '3' },
  revenue:   { label: 'Revenue',    labelAr: 'الإيرادات',        color: S.green,  bg: S.greenB,  icon: '💰', rangeStart: '4' },
  expense:   { label: 'Expenses',   labelAr: 'المصروفات',        color: S.amber,  bg: S.amberB,  icon: '💸', rangeStart: '5' },
}

function buildTree(accounts: Account[]): Account[] {
  const map = new Map<string, Account>()
  accounts.forEach(a => map.set(a.code, { ...a, children: [] }))
  const roots: Account[] = []
  map.forEach(a => {
    if (a.parent_code && map.has(a.parent_code)) {
      map.get(a.parent_code)!.children!.push(a)
    } else if (!a.parent_code) {
      roots.push(a)
    }
  })
  roots.forEach(r => sortChildren(r))
  return roots
}

function sortChildren(node: Account) {
  node.children?.sort((a, b) => a.code.localeCompare(b.code))
  node.children?.forEach(sortChildren)
}

function AccountRow({ account, depth, search, expandedCodes, onToggle }: {
  account: Account; depth: number; search: string; expandedCodes: Set<string>; onToggle: (code: string) => void
}) {
  const cfg = TYPE_CFG[account.type]
  const hasChildren = (account.children?.length || 0) > 0
  const isExpanded = expandedCodes.has(account.code)
  const isHeader = account.category === 'header'

  const matchSearch = !search || account.code.includes(search) || account.name.includes(search) || account.name_en?.toLowerCase().includes(search.toLowerCase())
  if (!matchSearch && !account.children?.some(c => c.name.includes(search) || c.code.includes(search))) return null

  const indent = depth * 20

  return (
    <>
      <tr style={{ borderBottom: `1px solid ${S.border}`, background: isHeader ? 'rgba(255,255,255,0.03)' : 'transparent' }}
        onClick={() => hasChildren && onToggle(account.code)}>
        <td style={{ padding: '10px 14px', paddingRight: `${14 + indent}px` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {hasChildren && (
              <span style={{ color: S.muted, fontSize: 12, width: 16, textAlign: 'center', cursor: 'pointer' }}>
                {isExpanded ? '▼' : '▶'}
              </span>
            )}
            {!hasChildren && <span style={{ width: 16 }} />}
            <span style={{ fontSize: isHeader ? 13 : 12, fontWeight: isHeader ? 800 : depth > 1 ? 400 : 600, color: isHeader ? cfg.color : S.white }}>
              {account.name}
            </span>
          </div>
        </td>
        <td style={{ padding: '10px 14px', fontSize: 12, color: S.muted }}>{account.name_en}</td>
        <td style={{ padding: '10px 14px' }}>
          <span style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 700, color: cfg.color, background: cfg.bg, borderRadius: 8, padding: '3px 10px' }}>
            {account.code}
          </span>
        </td>
        <td style={{ padding: '10px 14px' }}>
          {!isHeader && (
            <span style={{ background: cfg.bg, color: cfg.color, borderRadius: 20, padding: '2px 10px', fontSize: 10, fontWeight: 700 }}>
              {cfg.icon} {cfg.label}
            </span>
          )}
        </td>
        <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'monospace', fontSize: 13, color: account.balance !== 0 ? (account.balance > 0 ? S.green : S.red) : S.muted }}>
          {account.balance !== 0 ? `MYR ${Math.abs(account.balance).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '—'}
        </td>
      </tr>
      {isExpanded && account.children?.map(child => (
        <AccountRow key={child.code} account={child} depth={depth + 1} search={search} expandedCodes={expandedCodes} onToggle={onToggle} />
      ))}
    </>
  )
}

export default function ChartOfAccountsPage() {
  const sbRef = useRef(createClient())
  const sb = sbRef.current

  const [accounts, setAccounts] = useState<Account[]>([])
  const [tree, setTree] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [expandedCodes, setExpandedCodes] = useState<Set<string>>(new Set(['1000','2000','3000','4000','5000','6000','7000','8000']))
  const [view, setView] = useState<'tree' | 'flat'>('tree')

  // ✅ جديد: اختيار الفرع - فاضي = الرصيد الإجمالي المخزّن (زي ما هو حاليًا)، فرع محدد = رصيد محسوب ديناميكيًا من القيود بتاعته بس
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([])
  const [branchFilter, setBranchFilter] = useState('')

  // ✅ Fix حرج: Supabase بيرجع 1000 صف كحد أقصى افتراضيًا من غير Range صريح - بيقطع البيانات بصمت لو زادت
  async function fetchAllRows<T = any>(buildQuery: (from: number, to: number) => any, pageSize = 1000): Promise<T[]> {
    let allRows: T[] = []
    let from = 0
    while (true) {
      const { data, error } = await buildQuery(from, from + pageSize - 1)
      if (error) {
        console.error('fetchAllRows error:', error.message, '| code:', error.code, '| details:', error.details, '| hint:', error.hint)
        break
      }
      allRows = allRows.concat(data || [])
      if (!data || data.length < pageSize) break
      from += pageSize
    }
    return allRows
  }

  const fetchAccounts = useCallback(async () => {
    setLoading(true)
    const [accs, brs] = await Promise.all([
      fetchAllRows<Account>((from, to) =>
        sb.from('chart_of_accounts').select('*').eq('is_active', true).order('code').range(from, to)
      ),
      sb.from('branches').select('id,name').eq('is_active', true).order('name').then(r => r.data || []),
    ])
    setBranches(brs)

    if (!branchFilter) {
      // ✅ كل الفروع مع بعض: نستخدم الرصيد الإجمالي المخزّن زي ما هو بالظبط (مفيش تغيير في السلوك الحالي)
      setAccounts(accs)
      setTree(buildTree(accs))
      setLoading(false)
      return
    }

    // ✅ فرع محدد: نحسب الرصيد ديناميكيًا من بنود القيود (journal_entry_lines) المرتبطة بقيود الفرع ده بس
    const lines = await fetchAllRows<{ account_code: string; debit: number; credit: number }>((from, to) =>
      sb.from('journal_entry_lines')
        .select('account_code, debit, credit, journal_entries!inner(branch_id)')
        .eq('journal_entries.branch_id', branchFilter)
        .range(from, to)
    )
    const balanceByCode = new Map<string, number>()
    for (const l of lines) {
      const prev = balanceByCode.get(l.account_code) || 0
      balanceByCode.set(l.account_code, prev + (l.debit || 0) - (l.credit || 0))
    }
    // ✅ معادلة محاسبية قياسية: الأصول والمصروفات = مدين - دائن؛ الالتزامات وحقوق الملكية والإيرادات = دائن - مدين (عكس الإشارة)
    const accsForBranch = accs.map(a => {
      const raw = balanceByCode.get(a.code) || 0
      const balance = (a.type === 'liability' || a.type === 'equity' || a.type === 'revenue') ? -raw : raw
      return { ...a, balance }
    })
    setAccounts(accsForBranch)
    setTree(buildTree(accsForBranch))
    setLoading(false)
  }, [sb, branchFilter])

  useEffect(() => { fetchAccounts() }, [fetchAccounts])

  function toggleExpand(code: string) {
    setExpandedCodes(prev => {
      const next = new Set(prev)
      next.has(code) ? next.delete(code) : next.add(code)
      return next
    })
  }

  function expandAll() {
    setExpandedCodes(new Set(accounts.map(a => a.code)))
  }

  function collapseAll() {
    setExpandedCodes(new Set(['1000','2000','3000','4000','5000','6000','7000','8000']))
  }

  function printReport() {
    const win = window.open('', '_blank')
    if (!win) return
    const rows = accounts.map(a => {
      const cfg = TYPE_CFG[a.type]
      const indent = '—'.repeat(a.level - 1)
      return `<tr style="background:${a.category === 'header' ? '#f0f4ff' : '#fff'}">
        <td style="padding-right:${(a.level-1)*16}px;font-weight:${a.category==='header'?'bold':'normal'}">${indent} ${a.name}</td>
        <td>${a.name_en||''}</td>
        <td style="font-family:monospace;font-weight:bold;color:${cfg.color}">${a.code}</td>
        <td>${cfg.label}</td>
        <td style="text-align:right">${a.balance ? 'MYR ' + Math.abs(a.balance).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}</td>
      </tr>`
    }).join('')

    win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
    <title>Chart of Accounts — Orchid House</title>
    <style>
      body{font-family:Arial,sans-serif;font-size:10px;margin:15px;}
      h2{text-align:center;font-size:16px;}
      h3{text-align:center;font-size:11px;color:#666;margin-bottom:16px;}
      table{width:100%;border-collapse:collapse;}
      th{background:#0A1628;color:#fff;padding:6px 8px;text-align:left;font-size:9px;}
      td{padding:4px 8px;border-bottom:1px solid #eee;font-size:9px;}
      @media print{@page{size:A4;margin:10mm;}}
    </style></head><body>
    <h2>🌸 Orchid House — Chart of Accounts</h2>
    <h3>${branchFilter ? branches.find(b => b.id === branchFilter)?.name || '' : 'All Branches'} · Printed: ${new Date().toLocaleDateString('en-GB', { year:'numeric',month:'long',day:'numeric' })}</h3>
    <table><thead><tr>
      <th>Account Name</th><th>English</th><th>Code</th><th>Type</th><th>Balance</th>
    </tr></thead><tbody>${rows}</tbody></table>
    <script>window.onload=()=>window.print()<\/script>
    </body></html>`)
    win.document.close()
  }

  const filteredTree = typeFilter === 'all' ? tree : tree.filter(t => t.type === typeFilter || t.children?.some(c => c.type === typeFilter))
  const filteredFlat = accounts.filter(a => {
    const matchType = typeFilter === 'all' || a.type === typeFilter
    const matchSearch = !search || a.code.includes(search) || a.name.includes(search) || a.name_en?.toLowerCase().includes(search.toLowerCase())
    return matchType && matchSearch
  })

  const totals = {
    assets: accounts.filter(a => a.type === 'asset' && !a.children?.length).reduce((s, a) => s + a.balance, 0),
    liabilities: accounts.filter(a => a.type === 'liability' && !a.children?.length).reduce((s, a) => s + a.balance, 0),
    equity: accounts.filter(a => a.type === 'equity' && !a.children?.length).reduce((s, a) => s + a.balance, 0),
    revenue: accounts.filter(a => a.type === 'revenue' && !a.children?.length).reduce((s, a) => s + a.balance, 0),
    expense: accounts.filter(a => a.type === 'expense' && !a.children?.length).reduce((s, a) => s + a.balance, 0),
  }

  const inp: React.CSSProperties = { background: 'rgba(255,255,255,.04)', border: `1px solid ${S.border}`, borderRadius: 10, padding: '9px 14px', fontSize: 13, color: S.white, outline: 'none', fontFamily: 'Tajawal, sans-serif', boxSizing: 'border-box' as const }

  return (
    <div style={{ fontFamily: 'Tajawal, sans-serif', color: S.white }}>
      <style>{`select option{background:#0F2040;color:#FAFAF8} tr:hover{background:rgba(255,255,255,0.03)!important;}`}</style>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 900, marginBottom: 4 }}>📊 Chart of Accounts</h1>
          <p style={{ fontSize: 13, color: S.muted }}>{accounts.length} accounts · Restaurant accounting structure</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={printReport} style={{ padding: '10px 16px', borderRadius: 12, border: `1px solid ${S.blue}`, background: S.blueB, color: S.blue, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>🖨️ Print</button>
        </div>
      </div>

      {/* ✅ جديد: تابات اختيار الفرع */}
      {branches.length > 0 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <button onClick={() => setBranchFilter('')}
            style={{ padding: '8px 16px', borderRadius: 10, border: `1px solid ${!branchFilter ? S.gold : S.border}`, background: !branchFilter ? S.gold3 : 'transparent', color: !branchFilter ? S.gold : S.muted, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: !branchFilter ? 700 : 400 }}>
            🌐 كل الفروع
          </button>
          {branches.map(b => (
            <button key={b.id} onClick={() => setBranchFilter(b.id)}
              style={{ padding: '8px 16px', borderRadius: 10, border: `1px solid ${branchFilter === b.id ? S.gold : S.border}`, background: branchFilter === b.id ? S.gold3 : 'transparent', color: branchFilter === b.id ? S.gold : S.muted, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: branchFilter === b.id ? 700 : 400 }}>
              🏪 {b.name}
            </button>
          ))}
        </div>
      )}

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 12, marginBottom: 24 }}>
        {Object.entries(TYPE_CFG).map(([type, cfg]) => (
          <div key={type} onClick={() => setTypeFilter(typeFilter === type ? 'all' : type)}
            style={{ background: typeFilter === type ? cfg.bg : S.card2, border: `1px solid ${typeFilter === type ? cfg.color : S.border}`, borderRadius: 16, padding: '16px 18px', cursor: 'pointer', transition: 'all .2s' }}>
            <div style={{ fontSize: 22, marginBottom: 6 }}>{cfg.icon}</div>
            <div style={{ fontSize: 14, fontWeight: 800, color: cfg.color, marginBottom: 2 }}>{cfg.labelAr}</div>
            <div style={{ fontSize: 11, color: S.muted, marginBottom: 8 }}>{cfg.label}</div>
            <div style={{ fontSize: 11, color: S.muted }}>
              {accounts.filter(a => a.type === type).length} accounts
            </div>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <input style={{ ...inp, flex: 1, minWidth: 200 }} placeholder="🔍 Search by code or name..." value={search} onChange={e => setSearch(e.target.value)} />
        <div style={{ display: 'flex', background: S.navy3, borderRadius: 10, padding: 4, gap: 4 }}>
          <button onClick={() => setView('tree')} style={{ padding: '6px 12px', borderRadius: 8, border: 'none', background: view === 'tree' ? S.gold3 : 'transparent', color: view === 'tree' ? S.gold : S.muted, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif' }}>🌳 Tree</button>
          <button onClick={() => setView('flat')} style={{ padding: '6px 12px', borderRadius: 8, border: 'none', background: view === 'flat' ? S.gold3 : 'transparent', color: view === 'flat' ? S.gold : S.muted, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif' }}>📋 Flat</button>
        </div>
        {view === 'tree' && (
          <>
            <button onClick={expandAll} style={{ padding: '8px 14px', borderRadius: 10, border: `1px solid ${S.border}`, background: 'transparent', color: S.muted, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif' }}>Expand All</button>
            <button onClick={collapseAll} style={{ padding: '8px 14px', borderRadius: 10, border: `1px solid ${S.border}`, background: 'transparent', color: S.muted, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif' }}>Collapse</button>
          </>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: S.muted }}>⏳ Loading...</div>
      ) : (
        <div style={{ background: S.navy2, borderRadius: 16, border: `1px solid ${S.border}`, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
              <thead>
                <tr style={{ background: S.navy3 }}>
                  {['Account Name / اسم الحساب', 'English', 'Code', 'Type', 'Balance'].map((h, i) => (
                    <th key={h} style={{ padding: '12px 14px', textAlign: i === 4 ? 'right' : 'left', fontSize: 11, color: S.muted, fontWeight: 700, borderBottom: `1px solid ${S.border}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {view === 'tree' ? (
                  filteredTree.map(account => (
                    <AccountRow key={account.code} account={account} depth={0} search={search} expandedCodes={expandedCodes} onToggle={toggleExpand} />
                  ))
                ) : (
                  filteredFlat.map(a => {
                    const cfg = TYPE_CFG[a.type]
                    return (
                      <tr key={a.id} style={{ borderBottom: `1px solid ${S.border}`, background: a.category === 'header' ? 'rgba(255,255,255,0.03)' : 'transparent' }}>
                        <td style={{ padding: '10px 14px', paddingRight: `${14 + (a.level-1)*16}px`, fontSize: 13, fontWeight: a.category === 'header' ? 700 : 400, color: a.category === 'header' ? cfg.color : S.white }}>{a.name}</td>
                        <td style={{ padding: '10px 14px', fontSize: 12, color: S.muted }}>{a.name_en}</td>
                        <td style={{ padding: '10px 14px' }}>
                          <span style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 700, color: cfg.color, background: cfg.bg, borderRadius: 8, padding: '3px 10px' }}>{a.code}</span>
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          <span style={{ background: cfg.bg, color: cfg.color, borderRadius: 20, padding: '2px 10px', fontSize: 10, fontWeight: 700 }}>{cfg.icon} {cfg.label}</span>
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'monospace', fontSize: 13, color: a.balance !== 0 ? (a.balance > 0 ? S.green : S.red) : S.muted }}>
                          {a.balance !== 0 ? `MYR ${Math.abs(a.balance).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '—'}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
