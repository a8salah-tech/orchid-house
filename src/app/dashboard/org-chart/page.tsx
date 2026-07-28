'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
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
  green: '#22C55E', greenB: 'rgba(34,197,94,0.12)',
  amber: '#F59E0B', amberB: 'rgba(245,158,11,0.12)',
  blue: '#3B82F6', blueB: 'rgba(59,130,246,0.12)',
  purple: '#A855F7', purpleB: 'rgba(168,85,247,0.12)',
  card: 'rgba(255,255,255,0.04)',
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'مدير النظام', branch_manager: 'مدير الفرع',
  kitchen_manager: 'مدير المطبخ', hall_manager: 'مدير الصالة', bar_manager: 'مدير البار', warehouse_manager: 'مدير المستودعات',
  kitchen_supervisor: 'مشرف المطبخ', hall_supervisor: 'مشرف الصالة', bar_supervisor: 'مشرف البار',
  warehouse_keeper: 'أمين المستودع', cashier: 'كاشير',
  kitchen_cleaner: 'عامل نظافة المطبخ', hall_cleaner: 'عامل نظافة الصالة', hall_worker: 'عامل صالة',
  employee: 'موظف',
}

// ✅ تصنيف كل دور لقسمه الافتراضي + مستواه (0=قيادة، 1=مدير قسم، 2=مشرف، 3=موظف)
const ROLE_DEPT: Record<string, { dept: string; tier: number }> = {
  admin: { dept: 'leadership', tier: 0 }, branch_manager: { dept: 'leadership', tier: 0 },
  kitchen_manager: { dept: 'kitchen', tier: 1 }, kitchen_supervisor: { dept: 'kitchen', tier: 2 }, kitchen_cleaner: { dept: 'kitchen', tier: 3 },
  hall_manager: { dept: 'hall', tier: 1 }, hall_supervisor: { dept: 'hall', tier: 2 }, hall_cleaner: { dept: 'hall', tier: 3 }, hall_worker: { dept: 'hall', tier: 3 },
  bar_manager: { dept: 'bar', tier: 1 }, bar_supervisor: { dept: 'bar', tier: 2 },
  warehouse_manager: { dept: 'warehouse', tier: 1 }, warehouse_keeper: { dept: 'warehouse', tier: 3 },
  cashier: { dept: 'other', tier: 3 }, employee: { dept: 'other', tier: 3 },
}

const DEPTS: { key: string; label: string; icon: string; color: string }[] = [
  { key: 'kitchen', label: 'المطبخ', icon: '🍳', color: S.amber },
  { key: 'hall', label: 'الصالة', icon: '🍽️', color: S.green },
  { key: 'bar', label: 'البار', icon: '🍹', color: S.purple },
  { key: 'warehouse', label: 'المستودعات', icon: '📦', color: S.blue },
  { key: 'other', label: 'أخرى', icon: '👥', color: S.muted },
]

type Emp = { id: string; name: string; name_en?: string; employee_number?: string; role: string; branch_id: string; default_shift: 'morning' | 'evening'; photo_url?: string; org_chart_dept?: string | null }

function deptOf(e: Emp): string { return e.org_chart_dept || ROLE_DEPT[e.role]?.dept || 'other' }
function tierOf(e: Emp): number { return ROLE_DEPT[e.role]?.tier ?? 3 }
function roleColor(role: string) {
  const t = ROLE_DEPT[role]?.tier ?? 3
  if (t === 0) return S.gold
  if (t === 1) return S.blue
  if (t === 2) return S.green
  return S.muted
}

export default function OrgChartPage() {
  const sbRef = useRef(createClient())
  const sb = sbRef.current
  const { employee, permissions } = useAuth()
  // ✅ حماية مضاعفة - لازم صلاحية "all" كاملة ودور "admin" الفعلي مع بعض
  const isAdmin = permissions?.all === true && employee?.role === 'admin'

  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 900)
    check(); window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const [loading, setLoading] = useState(true)
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([])
  const [activeBranch, setActiveBranch] = useState('')
  const [employees, setEmployees] = useState<Emp[]>([])
  const [moveMenuEmp, setMoveMenuEmp] = useState<Emp | null>(null)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const [branchesRes, empRes, adminRes] = await Promise.all([
      sb.from('branches').select('id,name').eq('is_active', true).order('name'),
      // ✅ فقط الموظفون النشطون حاليًا - الموقوفون مستبعدون تمامًا
      sb.from('employees').select('id,name,name_en,employee_number,role,branch_id,default_shift,photo_url,org_chart_dept').eq('is_active', true).not('branch_id', 'is', null),
      // ✅ مدراء النظام يُجلَبون بشكل منفصل بدون اشتراط وجود فرع
      sb.from('employees').select('id,name,name_en,employee_number,role,branch_id,default_shift,photo_url,org_chart_dept').eq('is_active', true).eq('role', 'admin'),
    ])
    setBranches(branchesRes.data || [])
    if (!activeBranch && branchesRes.data?.[0]) setActiveBranch(branchesRes.data[0].id)
    const empIds = new Set((empRes.data || []).map((e: any) => e.id))
    const merged = [...(empRes.data || []), ...((adminRes.data || []).filter((a: any) => !empIds.has(a.id)))]
    setEmployees(merged.map((e: any) => ({ ...e, default_shift: e.default_shift || 'morning' })))
    setLoading(false)
  }, [sb])

  useEffect(() => { fetchAll() }, [fetchAll])

  async function saveDept(empId: string, dept: string | null) {
    await sb.from('employees').update({ org_chart_dept: dept }).eq('id', empId)
    setEmployees(prev => prev.map(e => e.id === empId ? { ...e, org_chart_dept: dept } : e))
    setMoveMenuEmp(null)
  }
  async function saveShift(empId: string, shift: 'morning' | 'evening') {
    await sb.from('employees').update({ default_shift: shift }).eq('id', empId)
    setEmployees(prev => prev.map(e => e.id === empId ? { ...e, default_shift: shift } : e))
    setMoveMenuEmp(null)
  }

  function Card({ e }: { e: Emp }) {
    return (
      <div style={{ background: S.navy2, border: `1.5px solid ${roleColor(e.role)}50`, borderRadius: 10, padding: '6px 10px', minWidth: 130, maxWidth: 160, textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,.2)' }}>
        {e.photo_url ? (
          <img src={e.photo_url} alt={e.name} style={{ width: 30, height: 30, borderRadius: '50%', objectFit: 'cover', margin: '0 auto 3px', border: `2px solid ${roleColor(e.role)}` }} />
        ) : (
          <div style={{ width: 30, height: 30, borderRadius: '50%', background: S.card, margin: '0 auto 3px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: roleColor(e.role), border: `2px solid ${roleColor(e.role)}` }}>{e.name.charAt(0)}</div>
        )}
        <div style={{ fontSize: 11, fontWeight: 700, color: S.white, lineHeight: 1.25 }}>{e.name} {e.name_en || ''}</div>
        <div style={{ fontSize: 8.5, color: roleColor(e.role), fontWeight: 700, marginTop: 1 }}>{ROLE_LABELS[e.role] || e.role}</div>
        {e.employee_number && <div style={{ fontSize: 7.5, color: S.muted }}>{e.employee_number}</div>}
        <button onClick={() => setMoveMenuEmp(e)} style={{ marginTop: 4, width: '100%', padding: '2px 0', borderRadius: 5, border: `1px solid ${S.border}`, background: 'transparent', color: S.muted, cursor: 'pointer', fontSize: 8 }}>🔗 نقل...</button>
      </div>
    )
  }

  function ShiftSection({ shift, label, icon }: { shift: 'morning' | 'evening'; label: string; icon: string }) {
    const group = employees.filter(e => (e.branch_id === activeBranch || e.role === 'admin') && e.default_shift === shift)
    const leadership = group.filter(e => deptOf(e) === 'leadership').sort((a, b) => tierOf(a) - tierOf(b))
    return (
      <div style={{ background: S.card, borderRadius: 16, border: `1px solid ${S.border}`, padding: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: S.gold, marginBottom: 14, textAlign: 'center' }}>{icon} {label} <span style={{ color: S.muted, fontWeight: 400, fontSize: 11 }}>({group.length})</span></div>
        {group.length === 0 ? (
          <div style={{ textAlign: 'center', color: S.muted, fontSize: 12, padding: 20 }}>لا يوجد موظفون في هذا الشيفت</div>
        ) : (
          <>
            {/* ✅ صف القيادة - فوق الكل دايمًا، بسيط وواضح */}
            {leadership.length > 0 && (
              <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 16, paddingBottom: 14, borderBottom: `1.5px dashed ${S.gold}50` }}>
                {leadership.map(e => <Card key={e.id} e={e} />)}
              </div>
            )}
            {/* ✅ أعمدة الأقسام - كل قسم عمود مستقل، مرتب من مدير لمشرف لموظفين */}
            <div style={{ display: 'flex', gap: 14, overflowX: 'auto', paddingBottom: 6 }}>
              {DEPTS.map(d => {
                const deptEmps = group.filter(e => deptOf(e) === d.key).sort((a, b) => tierOf(a) - tierOf(b))
                if (deptEmps.length === 0) return null
                return (
                  <div key={d.key} style={{ background: S.navy3, borderRadius: 12, border: `1px solid ${d.color}40`, padding: 10, minWidth: 160, flexShrink: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: d.color, textAlign: 'center', marginBottom: 8 }}>{d.icon} {d.label} ({deptEmps.length})</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center' }}>
                      {deptEmps.map(e => <Card key={e.id} e={e} />)}
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    )
  }

  function printBranch() {
    const branchName = branches.find(b => b.id === activeBranch)?.name || ''
    const win = window.open('', '_blank')
    if (!win) return
    function cardHtml(e: Emp) {
      return `<div class="card" style="border-color:${roleColor(e.role)}">
        <div class="name">${e.name} ${e.name_en || ''}</div>
        <div class="role" style="color:${roleColor(e.role)}">${ROLE_LABELS[e.role] || e.role}</div>
        ${e.employee_number ? `<div class="num">${e.employee_number}</div>` : ''}
      </div>`
    }
    function shiftHtml(shift: 'morning' | 'evening', label: string) {
      const group = employees.filter(e => (e.branch_id === activeBranch || e.role === 'admin') && e.default_shift === shift)
      const leadership = group.filter(e => deptOf(e) === 'leadership').sort((a, b) => tierOf(a) - tierOf(b))
      const deptCols = DEPTS.map(d => ({ d, emps: group.filter(e => deptOf(e) === d.key).sort((a, b) => tierOf(a) - tierOf(b)) })).filter(c => c.emps.length > 0)
      return `<div class="page">
        <h1>🏢 الهيكل الوظيفي — ${branchName}</h1>
        <div class="sub">${new Date().toLocaleDateString('ar-MY')} — الموظفون النشطون فقط</div>
        <h2>${label} (${group.length})</h2>
        ${leadership.length > 0 ? `<div class="leadership">${leadership.map(cardHtml).join('')}</div>` : ''}
        <div class="cols">
          ${deptCols.map(c => `<div class="col" style="border-color:${c.d.color}"><div class="col-title" style="color:${c.d.color}">${c.d.icon} ${c.d.label} (${c.emps.length})</div>${c.emps.map(cardHtml).join('')}</div>`).join('')}
        </div>
      </div>`
    }
    win.document.write(`
      <html dir="rtl"><head><title>الهيكل الوظيفي — ${branchName}</title>
      <style>
        @page { size: A4 landscape; margin: 10mm; }
        * { box-sizing: border-box; }
        body { font-family: 'Tajawal', Arial, sans-serif; margin: 0; }
        .page { page-break-after: always; }
        .page:last-child { page-break-after: auto; }
        h1 { text-align: center; font-size: 20px; margin: 0 0 4px; }
        .sub { text-align: center; color: #666; font-size: 11px; margin-bottom: 6px; }
        h2 { text-align: center; font-size: 15px; margin: 0 0 14px; }
        .leadership { display: flex; justify-content: center; gap: 14px; margin-bottom: 16px; padding-bottom: 14px; border-bottom: 2px dashed #C9A84C; flex-wrap: wrap; }
        .cols { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; align-items: flex-start; }
        .col { border: 2px solid #999; border-radius: 10px; padding: 10px; min-width: 140px; }
        .col-title { text-align: center; font-size: 12px; font-weight: 800; margin-bottom: 8px; }
        .card { border: 1.5px solid #999; border-radius: 8px; padding: 6px 8px; text-align: center; margin-bottom: 6px; background: #fff; }
        .name { font-size: 10px; font-weight: 700; }
        .role { font-size: 8px; font-weight: 700; }
        .num { font-size: 7px; color: #888; }
      </style></head>
      <body>
        ${shiftHtml('morning', '🌅 الشيفت الصباحي')}
        ${shiftHtml('evening', '🌆 الشيفت المسائي')}
      </body></html>
    `)
    win.document.close(); win.focus()
    setTimeout(() => win.print(), 400)
  }

  if (!isAdmin) return (
    <div style={{ fontFamily: 'Tajawal, sans-serif', direction: 'rtl', color: S.white, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', flexDirection: 'column', gap: 16 }}>
      <div style={{ fontSize: 64 }}>🔒</div>
      <div style={{ fontSize: 20, fontWeight: 800, color: '#EF4444' }}>هذه الصفحة مخصصة لمدير النظام فقط</div>
    </div>
  )

  return (
    <div style={{ fontFamily: 'Tajawal, sans-serif', direction: 'rtl', color: S.white, padding: isMobile ? 14 : 24 }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700;800&display=swap');`}</style>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>🏢 الهيكل الوظيفي</h1>
          <p style={{ fontSize: 12, color: S.muted }}>القيادة تظهر فوق دايمًا، وتحتها كل قسم في عموده الخاص. اضغط "🔗 نقل..." لتغيير قسم أي موظف أو شيفته</p>
        </div>
        <button onClick={printBranch} style={{ padding: '10px 20px', borderRadius: 12, border: `1px solid ${S.gold}`, background: S.gold3, color: S.gold, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
          🖨️ طباعة هذا الفرع
        </button>
      </div>

      {branches.length > 0 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          {branches.map(b => (
            <button key={b.id} onClick={() => setActiveBranch(b.id)}
              style={{ padding: '10px 20px', borderRadius: 12, border: `1px solid ${activeBranch === b.id ? S.gold : S.border}`, background: activeBranch === b.id ? S.gold3 : 'transparent', color: activeBranch === b.id ? S.gold : S.muted, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: activeBranch === b.id ? 700 : 400 }}>
              🏪 {b.name}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: S.muted }}>⏳ جاري التحميل...</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <ShiftSection shift="morning" label="الشيفت الصباحي" icon="🌅" />
          <ShiftSection shift="evening" label="الشيفت المسائي" icon="🌆" />
        </div>
      )}

      {moveMenuEmp && (
        <div onClick={() => setMoveMenuEmp(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: S.navy2, border: `1px solid ${S.gold}`, borderRadius: 16, padding: 18, maxWidth: 320, width: '100%' }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: S.gold, marginBottom: 4 }}>🔗 نقل: {moveMenuEmp.name}</div>
            <div style={{ fontSize: 11, color: S.muted, marginBottom: 14 }}>{ROLE_LABELS[moveMenuEmp.role] || moveMenuEmp.role}</div>

            <div style={{ fontSize: 11, color: S.gold, fontWeight: 700, marginBottom: 6 }}>🏷️ انقله لقسم:</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 14 }}>
              {DEPTS.map(d => (
                <button key={d.key} onClick={() => saveDept(moveMenuEmp.id, d.key)}
                  style={{ padding: '8px 4px', borderRadius: 8, border: `1px solid ${deptOf(moveMenuEmp) === d.key ? d.color : S.border}`, background: deptOf(moveMenuEmp) === d.key ? d.color + '22' : S.card, color: S.white, cursor: 'pointer', fontSize: 11, fontFamily: 'Tajawal, sans-serif' }}>
                  {d.icon} {d.label}
                </button>
              ))}
            </div>
            <button onClick={() => saveDept(moveMenuEmp.id, null)}
              style={{ width: '100%', padding: '7px 0', borderRadius: 8, border: `1px solid ${S.border}`, background: 'transparent', color: S.muted, cursor: 'pointer', fontSize: 11, fontFamily: 'Tajawal, sans-serif', marginBottom: 14 }}>
              ↩️ رجّعه للقسم الافتراضي (حسب دوره الوظيفي)
            </button>

            <div style={{ fontSize: 11, color: S.muted, marginBottom: 6 }}>أو انقله لشيفت آخر:</div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              <button onClick={() => saveShift(moveMenuEmp.id, 'morning')}
                style={{ flex: 1, padding: '8px 0', borderRadius: 8, border: `1px solid ${S.amber}60`, background: moveMenuEmp.default_shift === 'morning' ? S.amberB : 'transparent', color: S.amber, cursor: 'pointer', fontSize: 11, fontFamily: 'Tajawal, sans-serif' }}>🌅 صباحي</button>
              <button onClick={() => saveShift(moveMenuEmp.id, 'evening')}
                style={{ flex: 1, padding: '8px 0', borderRadius: 8, border: `1px solid ${S.blue}60`, background: moveMenuEmp.default_shift === 'evening' ? S.blueB : 'transparent', color: S.blue, cursor: 'pointer', fontSize: 11, fontFamily: 'Tajawal, sans-serif' }}>🌆 مسائي</button>
            </div>
            <button onClick={() => setMoveMenuEmp(null)} style={{ width: '100%', padding: '8px 0', borderRadius: 8, border: `1px solid ${S.border}`, background: 'transparent', color: S.muted, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif' }}>إغلاق</button>
          </div>
        </div>
      )}
    </div>
  )
}
