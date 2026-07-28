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
  red: '#EF4444', redB: 'rgba(239,68,68,0.12)',
  card: 'rgba(255,255,255,0.04)',
}

const ROOT_ROLES = ['admin', 'branch_manager']
const MANAGER_ROLES = ['kitchen_manager', 'hall_manager', 'bar_manager', 'warehouse_manager']
const SUPERVISOR_ROLES = ['kitchen_supervisor', 'hall_supervisor', 'bar_supervisor']

const ROLE_LABELS: Record<string, string> = {
  admin: 'مدير النظام', branch_manager: 'مدير الفرع',
  kitchen_manager: 'مدير المطبخ', hall_manager: 'مدير الصالة', bar_manager: 'مدير البار', warehouse_manager: 'مدير المستودعات',
  kitchen_supervisor: 'مشرف المطبخ', hall_supervisor: 'مشرف الصالة', bar_supervisor: 'مشرف البار',
  warehouse_keeper: 'أمين المستودع', cashier: 'كاشير',
  kitchen_cleaner: 'عامل نظافة المطبخ', hall_cleaner: 'عامل نظافة الصالة', hall_worker: 'عامل صالة',
  employee: 'موظف',
}

type Emp = { id: string; name: string; name_en?: string; employee_number?: string; role: string; department?: string; branch_id: string; default_shift: 'morning' | 'evening'; photo_url?: string }
type Node = { id: string; employee_id: string; parent_id: string | null }

function roleColor(role: string) {
  if (ROOT_ROLES.includes(role)) return S.gold
  if (MANAGER_ROLES.includes(role)) return S.blue
  if (SUPERVISOR_ROLES.includes(role)) return S.green
  return S.muted
}

export default function OrgChartPage() {
  const sbRef = useRef(createClient())
  const sb = sbRef.current
  const { employee, permissions } = useAuth()
  // ✅ Fix: حماية مضاعفة - لازم صلاحية "all" كاملة ودور "admin" الفعلي مع بعض، عشان مفيش أي احتمال يشوفها موظف عادي بالخطأ
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
  const [nodes, setNodes] = useState<Node[]>([])
  // ✅ جديد: لو فيه أكتر من "مدير نظام" واحد، الأدمن يختار مين اللي يظهر بالهيكل، والباقي يتخفوا تلقائيًا
  const [visibleAdminId, setVisibleAdminId] = useState<string | null>(null)
  const [moveMenuOpenId, setMoveMenuOpenId] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const [branchesRes, empRes, adminRes, nodesRes, settingsRes] = await Promise.all([
      sb.from('branches').select('id,name').eq('is_active', true).order('name'),
      // ✅ فقط الموظفون النشطون حاليًا - الموقوفون مستبعدون تمامًا
      sb.from('employees').select('id,name,name_en,employee_number,role,department,branch_id,default_shift,photo_url').eq('is_active', true).not('branch_id', 'is', null),
      // ✅ Fix: مدراء النظام يُجلَبون بشكل منفصل بدون اشتراط وجود فرع، لأن حساب "مدير نظام" غالبًا مالوش فرع محدد
      // (وده كان سبب ظهور مدير واحد بس من أصل 3 في القائمة قبل كده)
      sb.from('employees').select('id,name,name_en,employee_number,role,department,branch_id,default_shift,photo_url').eq('is_active', true).eq('role', 'admin'),
      sb.from('org_chart_nodes').select('id,employee_id,parent_id'),
      sb.from('org_chart_settings').select('visible_admin_id').eq('id', 1).maybeSingle(),
    ])
    setBranches(branchesRes.data || [])
    if (!activeBranch && branchesRes.data?.[0]) setActiveBranch(branchesRes.data[0].id)
    // ✅ ندمج الموظفين العاديين (لهم فرع) مع مدراء النظام (بغض النظر عن الفرع)، بدون تكرار
    const empIds = new Set((empRes.data || []).map((e: any) => e.id))
    const mergedEmployees = [
      ...(empRes.data || []),
      ...((adminRes.data || []).filter((a: any) => !empIds.has(a.id))),
    ]
    setEmployees(mergedEmployees.map((e: any) => ({ ...e, default_shift: e.default_shift || 'morning' })))
    setNodes(nodesRes.data || [])
    setVisibleAdminId(settingsRes.data?.visible_admin_id || null)
    setLoading(false)
  }, [sb])

  useEffect(() => { fetchAll() }, [fetchAll])

  // ✅ جديد: لو فيه أكتر من مدير نظام واحد، نستبعد الباقي من الهيكل ونستخدم بس اللي تم اختياره
  const adminEmployees = employees.filter(e => e.role === 'admin')
  const effectiveVisibleAdminId = visibleAdminId || adminEmployees[0]?.id || null
  const displayEmployees = adminEmployees.length > 1
    ? employees.filter(e => e.role !== 'admin' || e.id === effectiveVisibleAdminId)
    : employees

  async function saveVisibleAdmin(id: string) {
    setVisibleAdminId(id)
    await sb.from('org_chart_settings').update({ visible_admin_id: id }).eq('id', 1)
  }

  // ✅ إنشاء تلقائي لأي موظف نشط لسه ماله عقدة في الهيكل - بناءً على دوره ونفس القسم
  useEffect(() => {
    if (loading || displayEmployees.length === 0) return
    async function seedMissing() {
      const existingIds = new Set(nodes.map(n => n.employee_id))
      const missing = displayEmployees.filter(e => !existingIds.has(e.id))
      if (missing.length === 0) return
      const byBranchDept = (branchId: string, dept: string | undefined, roles: string[]) =>
        displayEmployees.find(e => e.branch_id === branchId && roles.includes(e.role) && (!dept || e.department === dept))
      const rootOf = (branchId: string) =>
        displayEmployees.find(e => e.branch_id === branchId && e.role === 'branch_manager') ||
        displayEmployees.find(e => e.role === 'admin')

      const inserts: { employee_id: string; parent_id: null; branch_id: string }[] = []
      // نبني بالترتيب: الجذور أولاً، بعدين المدراء، بعدين المشرفين، بعدين الباقي - نستخدم موجود+المُدرَج حديثًا معًا
      const allKnown = [...displayEmployees]
      const parentFor = (e: Emp): Emp | null => {
        if (ROOT_ROLES.includes(e.role)) return null
        if (MANAGER_ROLES.includes(e.role)) return rootOf(e.branch_id) || null
        if (SUPERVISOR_ROLES.includes(e.role)) return byBranchDept(e.branch_id, e.department, MANAGER_ROLES) || rootOf(e.branch_id) || null
        return byBranchDept(e.branch_id, e.department, SUPERVISOR_ROLES) || byBranchDept(e.branch_id, e.department, MANAGER_ROLES) || rootOf(e.branch_id) || null
      }
      for (const e of missing) {
        const p = parentFor(e)
        inserts.push({ employee_id: e.id, parent_id: null, branch_id: e.branch_id })
      }
      const { data: createdRows } = await sb.from('org_chart_nodes').insert(inserts).select('id,employee_id,parent_id')
      if (createdRows) {
        // ✅ تحديث parent_id بعد الإنشاء (محتاجين معرّفات العقد نفسها، مش معرّفات الموظفين)
        const idByEmp: Record<string, string> = {}
        ;[...nodes, ...createdRows].forEach(n => { idByEmp[n.employee_id] = n.id })
        for (const e of missing) {
          const p = parentFor(e)
          if (p && idByEmp[p.id]) {
            const nodeId = idByEmp[e.id]
            await sb.from('org_chart_nodes').update({ parent_id: idByEmp[p.id] }).eq('id', nodeId)
          }
        }
        fetchAll()
      }
    }
    seedMissing()
  }, [loading, displayEmployees, nodes, sb])

  async function moveNode(draggedEmpId: string, targetEmpId: string | null) {
    const draggedNode = nodes.find(n => n.employee_id === draggedEmpId)
    if (!draggedNode) return
    if (targetEmpId === draggedEmpId) return
    const targetNode = targetEmpId ? nodes.find(n => n.employee_id === targetEmpId) : null
    // ✅ منع جعل الموظف تابعًا لنفسه بشكل غير مباشر (يصبح والد أحد أسلافه)
    if (targetNode) {
      let cursor: string | null = targetNode.parent_id
      while (cursor) {
        if (cursor === draggedNode.id) { alert('⚠️ لا يمكن نقل الموظف تحت أحد مرؤوسيه'); return }
        cursor = nodes.find(n => n.id === cursor)?.parent_id || null
      }
    }
    await sb.from('org_chart_nodes').update({ parent_id: targetNode ? targetNode.id : null }).eq('id', draggedNode.id)
    setNodes(prev => prev.map(n => n.id === draggedNode.id ? { ...n, parent_id: targetNode ? targetNode.id : null } : n))
  }

  async function moveShift(empId: string, shift: 'morning' | 'evening') {
    await sb.from('employees').update({ default_shift: shift }).eq('id', empId)
    setEmployees(prev => prev.map(e => e.id === empId ? { ...e, default_shift: shift } : e))
  }

  function EmployeeCard({ emp, depth, allEmpsInBranch }: { emp: Emp; depth: number; allEmpsInBranch: Emp[] }) {
    const isMenuOpen = moveMenuOpenId === emp.id
    return (
      <div style={{ position: 'relative' }}>
        <div
          style={{
            background: S.navy2, border: `1.5px solid ${roleColor(emp.role)}50`,
            borderRadius: 12, padding: '8px 12px', minWidth: 150, maxWidth: 190,
            boxShadow: '0 3px 10px rgba(0,0,0,.25)', textAlign: 'center',
          }}>
          {emp.photo_url ? (
            <img src={emp.photo_url} alt={emp.name} style={{ width: 34, height: 34, borderRadius: '50%', objectFit: 'cover', margin: '0 auto 4px', border: `2px solid ${roleColor(emp.role)}` }} />
          ) : (
            <div style={{ width: 34, height: 34, borderRadius: '50%', background: S.card, margin: '0 auto 4px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: roleColor(emp.role), border: `2px solid ${roleColor(emp.role)}` }}>
              {emp.name.charAt(0)}
            </div>
          )}
          <div style={{ fontSize: 12, fontWeight: 700, color: S.white, lineHeight: 1.3 }}>{emp.name} {emp.name_en || ''}</div>
          <div style={{ fontSize: 9, color: roleColor(emp.role), fontWeight: 700, marginTop: 2 }}>{ROLE_LABELS[emp.role] || emp.role}</div>
          {emp.employee_number && <div style={{ fontSize: 8, color: S.muted, marginTop: 1 }}>{emp.employee_number}</div>}
          {/* ✅ جديد: بدل السحب والإفلات (كان بيعلّق أحيانًا) - زر بسيط بيفتح قائمة اختيار مباشرة */}
          <button onClick={() => setMoveMenuOpenId(isMenuOpen ? null : emp.id)}
            style={{ marginTop: 6, width: '100%', padding: '4px 0', borderRadius: 6, border: `1px solid ${S.border}`, background: 'transparent', color: S.muted, cursor: 'pointer', fontSize: 9, fontFamily: 'Tajawal, sans-serif' }}>
            🔗 نقل...
          </button>
        </div>

        {isMenuOpen && (
          <div style={{ position: 'absolute', top: '100%', right: 0, left: 0, marginTop: 4, background: S.navy2, border: `1px solid ${S.gold}`, borderRadius: 10, padding: 10, zIndex: 50, boxShadow: '0 10px 30px rgba(0,0,0,.5)', minWidth: 200 }}>
            <div style={{ fontSize: 10, color: S.muted, marginBottom: 6 }}>ينقل تحت مدير:</div>
            <select onChange={e => { const v = e.target.value; if (v === '__root__') moveNode(emp.id, null); else if (v) moveNode(emp.id, v); setMoveMenuOpenId(null) }} defaultValue=""
              style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: `1px solid ${S.border}`, background: S.navy3, color: S.white, fontSize: 11, fontFamily: 'Tajawal, sans-serif', marginBottom: 8 }}>
              <option value="" disabled>-- اختر مديرًا جديدًا --</option>
              <option value="__root__">🔝 اجعله جذرًا (بدون مدير)</option>
              {allEmpsInBranch.filter(e => e.id !== emp.id).map(e => (
                <option key={e.id} value={e.id}>{e.name} — {ROLE_LABELS[e.role] || e.role}</option>
              ))}
            </select>
            <div style={{ fontSize: 10, color: S.muted, marginBottom: 6 }}>أو انقله لشيفت آخر:</div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => { moveShift(emp.id, 'morning'); setMoveMenuOpenId(null) }}
                style={{ flex: 1, padding: '6px 0', borderRadius: 6, border: `1px solid ${S.amber}60`, background: emp.default_shift === 'morning' ? S.amberB : 'transparent', color: S.amber, cursor: 'pointer', fontSize: 10, fontFamily: 'Tajawal, sans-serif' }}>🌅 صباحي</button>
              <button onClick={() => { moveShift(emp.id, 'evening'); setMoveMenuOpenId(null) }}
                style={{ flex: 1, padding: '6px 0', borderRadius: 6, border: `1px solid ${S.blue}60`, background: emp.default_shift === 'evening' ? S.blueB : 'transparent', color: S.blue, cursor: 'pointer', fontSize: 10, fontFamily: 'Tajawal, sans-serif' }}>🌆 مسائي</button>
            </div>
            <button onClick={() => setMoveMenuOpenId(null)} style={{ width: '100%', marginTop: 8, padding: '5px 0', borderRadius: 6, border: 'none', background: 'transparent', color: S.muted, cursor: 'pointer', fontSize: 10, fontFamily: 'Tajawal, sans-serif' }}>إلغاء</button>
          </div>
        )}
      </div>
    )
  }

  // ✅ عرض شجري متكرر - كل عقدة وتحتها أبناؤها أفقيًا، بخط وصل بسيط بينهم
  function TreeNode({ emp, allInGroup }: { emp: Emp; allInGroup: Emp[] }) {
    const node = nodes.find(n => n.employee_id === emp.id)
    const children = allInGroup.filter(e => {
      const cn = nodes.find(n => n.employee_id === e.id)
      return cn && node && cn.parent_id === node.id
    })
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <EmployeeCard emp={emp} depth={0} allEmpsInBranch={allInGroup} />
        {children.length > 0 && (
          <>
            <div style={{ width: 1.5, height: 14, background: S.border }} />
            <div style={{ display: 'flex', gap: 18, position: 'relative', paddingTop: 2 }}>
              {children.length > 1 && <div style={{ position: 'absolute', top: 0, left: '10%', right: '10%', height: 1.5, background: S.border }} />}
              {children.map(c => (
                <div key={c.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{ width: 1.5, height: 10, background: S.border }} />
                  <TreeNode emp={c} allInGroup={allInGroup} />
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    )
  }

  function ShiftHalf({ shift, label, icon }: { shift: 'morning' | 'evening'; label: string; icon: string }) {
    // ✅ Fix: مدير النظام المختار يظهر في هيكل الفرع الحالي حتى لو مالوش فرع محدد في بياناته أصلًا
    const groupEmps = displayEmployees.filter(e => (e.branch_id === activeBranch || e.id === effectiveVisibleAdminId) && e.default_shift === shift)
    const roots = groupEmps.filter(e => {
      const n = nodes.find(n => n.employee_id === e.id)
      if (!n || !n.parent_id) return true
      // ✅ لو الأب مش في نفس الشيفت (اتنقل لشيفت تاني)، نعتبره جذر مؤقت هنا برضو
      const parentEmpId = nodes.find(pn => pn.id === n.parent_id)?.employee_id
      const parentInGroup = groupEmps.some(g => g.id === parentEmpId)
      return !parentInGroup
    })
    return (
      <div
        style={{ flex: 1, background: S.card, borderRadius: 16, border: `1px solid ${S.border}`, padding: 16, minHeight: 200, overflow: 'hidden' }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: S.gold, marginBottom: 14, textAlign: 'center' }}>{icon} {label} <span style={{ color: S.muted, fontWeight: 400, fontSize: 11 }}>({groupEmps.length})</span></div>
        {groupEmps.length === 0 ? (
          <div style={{ textAlign: 'center', color: S.muted, fontSize: 12, padding: 30 }}>لا يوجد موظفون في هذا الشيفت</div>
        ) : (
          <div style={{ display: 'flex', gap: 24, justifyContent: groupEmps.length > 6 ? 'flex-start' : 'center', flexWrap: 'nowrap', paddingBottom: 10, overflowX: 'auto', width: '100%' }}>
            {roots.map(r => <TreeNode key={r.id} emp={r} allInGroup={groupEmps} />)}
          </div>
        )}
      </div>
    )
  }

  function printBranch() {
    const branchName = branches.find(b => b.id === activeBranch)?.name || ''
    const win = window.open('', '_blank')
    if (!win) return
    function renderNodeHtml(emp: Emp, group: Emp[]): string {
      const node = nodes.find(n => n.employee_id === emp.id)
      const children = group.filter(e => { const cn = nodes.find(n => n.employee_id === e.id); return cn && node && cn.parent_id === node.id })
      return `
        <div class="node">
          <div class="card" style="border-color:${roleColor(emp.role)}">
            <div class="name">${emp.name} ${emp.name_en || ''}</div>
            <div class="role" style="color:${roleColor(emp.role)}">${ROLE_LABELS[emp.role] || emp.role}</div>
            ${emp.employee_number ? `<div class="num">${emp.employee_number}</div>` : ''}
          </div>
          ${children.length > 0 ? `<div class="children">${children.map(c => renderNodeHtml(c, group)).join('')}</div>` : ''}
        </div>`
    }
    function renderHalf(shift: 'morning' | 'evening', label: string): string {
      const group = displayEmployees.filter(e => (e.branch_id === activeBranch || e.id === effectiveVisibleAdminId) && e.default_shift === shift)
      const roots = group.filter(e => {
        const n = nodes.find(n => n.employee_id === e.id)
        if (!n || !n.parent_id) return true
        const parentEmpId = nodes.find(pn => pn.id === n.parent_id)?.employee_id
        return !group.some(g => g.id === parentEmpId)
      })
      return `<div class="half">
        <h1>🏢 الهيكل الوظيفي — ${branchName}</h1>
        <div class="sub">${new Date().toLocaleDateString('ar-MY')} — الموظفون النشطون فقط</div>
        <h2>${label} (${group.length})</h2>
        <div class="tree">${roots.map(r => renderNodeHtml(r, group)).join('')}</div>
      </div>`
    }
    win.document.write(`
      <html dir="rtl"><head><title>الهيكل الوظيفي — ${branchName}</title>
      <style>
        @page { size: A4 landscape; margin: 10mm; }
        * { box-sizing: border-box; }
        body { font-family: 'Tajawal', Arial, sans-serif; margin: 0; }
        h1 { text-align: center; font-size: 20px; margin: 0 0 4px; }
        .sub { text-align: center; color: #666; font-size: 11px; margin-bottom: 12px; }
        /* ✅ Fix: كل شيفت بقى في صفحة طباعة منفصلة بدل جنب بعض في نفس الصفحة */
        .half { page-break-after: always; padding-top: 6px; }
        .half:last-child { page-break-after: auto; }
        .half h2 { text-align: center; font-size: 15px; margin: 0 0 14px; }
        .tree { display: flex; justify-content: center; gap: 14px; flex-wrap: wrap; }
        .node { display: flex; flex-direction: column; align-items: center; }
        .card { border: 1.5px solid #999; border-radius: 8px; padding: 5px 8px; text-align: center; min-width: 90px; margin-bottom: 4px; }
        .name { font-size: 9px; font-weight: 700; }
        .role { font-size: 7.5px; font-weight: 700; }
        .num { font-size: 7px; color: #888; }
        .children { display: flex; gap: 8px; padding-top: 8px; border-top: 1px solid #ccc; margin-top: 4px; flex-wrap: wrap; justify-content: center; }
      </style></head>
      <body>
        ${renderHalf('morning', '🌅 الشيفت الصباحي')}
        ${renderHalf('evening', '🌆 الشيفت المسائي')}
      </body></html>
    `)
    win.document.close(); win.focus()
    setTimeout(() => win.print(), 400)
  }

  if (!isAdmin) return (
    <div style={{ fontFamily: 'Tajawal, sans-serif', direction: 'rtl', color: S.white, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', flexDirection: 'column', gap: 16 }}>
      <div style={{ fontSize: 64 }}>🔒</div>
      <div style={{ fontSize: 20, fontWeight: 800, color: S.red }}>هذه الصفحة مخصصة لمدير النظام فقط</div>
    </div>
  )

  return (
    <div style={{ fontFamily: 'Tajawal, sans-serif', direction: 'rtl', color: S.white, padding: isMobile ? 14 : 24 }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700;800&display=swap');`}</style>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>🏢 الهيكل الوظيفي</h1>
          <p style={{ fontSize: 12, color: S.muted }}>اضغط "🔗 نقل..." تحت أي بطاقة موظف عشان تغيّر مديره المباشر أو تنقله بين الشيفتين</p>
        </div>
        <button onClick={printBranch} style={{ padding: '10px 20px', borderRadius: 12, border: `1px solid ${S.gold}`, background: S.gold3, color: S.gold, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
          🖨️ طباعة هذا الفرع
        </button>
      </div>

      {/* ✅ جديد: لو فيه أكتر من مدير نظام واحد، نسأل الأدمن مين اللي يظهر بالهيكل، والباقي يتخفوا تلقائيًا */}
      {adminEmployees.length > 1 && (
        <div style={{ background: S.amberB, border: `1px solid ${S.amber}60`, borderRadius: 12, padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, color: S.amber, fontWeight: 700 }}>👑 يوجد {adminEmployees.length} حسابات "مدير نظام" — اختر مين اللي يظهر في الهيكل الوظيفي:</span>
          <select value={effectiveVisibleAdminId || ''} onChange={e => saveVisibleAdmin(e.target.value)}
            style={{ padding: '7px 12px', borderRadius: 8, border: `1px solid ${S.border}`, background: S.navy3, color: S.white, fontSize: 12, fontFamily: 'Tajawal, sans-serif' }}>
            {adminEmployees.map(a => <option key={a.id} value={a.id}>{a.name} {a.name_en || ''}</option>)}
          </select>
        </div>
      )}

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
        <div style={{ display: 'flex', gap: 16, flexDirection: 'column' }}>
          <ShiftHalf shift="morning" label="الشيفت الصباحي" icon="🌅" />
          <ShiftHalf shift="evening" label="الشيفت المسائي" icon="🌆" />
        </div>
      )}
    </div>
  )
}
