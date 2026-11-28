'use client'

// «اعتماد الكل» لسلف الراتب — لمدير النظام: قائمة السلف غير المكتملة محددة كلها، ثم تأكيد واحد.
// كل طلب يمرّ بنفس خطوات الاعتماد الفردي (تثبيت المبلغ ثم خصمه من راتب شهر الاعتماد).
import { useEffect, useRef, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { CircleCheck, TriangleAlert, X } from 'lucide-react'
import { addAdvanceToPayroll, payrollPeriodOf, reducedAdvanceDescription } from '../../../../lib/advancePayroll'

export interface BulkAdvance {
  id: string; request_number: number; employee_id: string; status: string; created_at: string
  amount: number; approved_amount?: number | null
  employees?: { name: string; name_en?: string; employee_number?: string; branches?: { name: string } }
}

const createClient = () => createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const C = {
  panel: '#0F2040', white: '#FAFAF8', muted: '#8A9BB5', border: 'rgba(255,255,255,0.08)', gold: '#C9A84C',
  green: '#22C55E', greenB: 'rgba(34,197,94,0.12)', red: '#EF4444', redB: 'rgba(239,68,68,0.12)',
  amber: '#F59E0B', amberB: 'rgba(245,158,11,0.12)',
}
const btn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '11px 18px', borderRadius: 12, fontSize: 13, fontWeight: 700, fontFamily: 'Tajawal, sans-serif', cursor: 'pointer' }

const money = (n: number) => 'MYR ' + n.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
// المبلغ الذي سيُعتمد: المحفوظ مسبقًا إن وُجد، وإلا المطلوب
const payAmount = (r: { amount: number; approved_amount?: number | null }) => Math.round(Number(r.approved_amount ?? r.amount) * 100) / 100
const nameOf = (r: BulkAdvance) => `${r.employees?.name || '—'}${r.employees?.name_en ? ' ' + r.employees.name_en : ''}`

type Result = { done: number; total: number; failed: { name: string; number: number; reason: string }[] }

export default function BulkAdvanceModal({ advances, completedThisMonth, approvedBy, scopeLabel, onClose, onDone }: {
  advances: BulkAdvance[]; completedThisMonth: string[]; approvedBy: string; scopeLabel: string
  onClose: () => void; onDone: () => void
}) {
  // لقطة ثابتة للقائمة لحظة فتح النافذة
  const [list] = useState(() => [...advances].sort((a, b) => a.created_at.localeCompare(b.created_at)))
  const [excluded, setExcluded] = useState<Set<string>>(new Set())
  const [period] = useState(() => payrollPeriodOf(new Date().toISOString()))
  const [monthBlock, setMonthBlock] = useState<string | null>('جارٍ التحقق من كشف رواتب الشهر...')
  const [running, setRunning] = useState(false)
  // قفل فوري: حالة React لا تتحدث قبل ضغطة ثانية تأتي في اللحظة نفسها
  const started = useRef(false)
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState<Result | null>(null)

  const periodLabel = `${period.month}/${period.year}`
  const chosen = list.filter(r => !excluded.has(r.id))
  const total = chosen.reduce((s, r) => s + payAmount(r), 0)

  // لا خصم على كشف رواتب معتمَد أو مدفوع
  async function checkMonth(p: { year: number; month: number }): Promise<string | null> {
    const { data, error } = await createClient().from('payroll_months').select('status').eq('month', p.month).eq('year', p.year).maybeSingle()
    if (error) return 'تعذّر التحقق من كشف الرواتب: ' + error.message
    if (data && (data.status === 'finalized' || data.status === 'paid')) return `رواتب شهر ${p.month}/${p.year} معتمَدة، فلا يمكن خصم سلف جديدة منها.`
    return null
  }

  useEffect(() => {
    let alive = true
    checkMonth(period).then(msg => { if (alive) setMonthBlock(msg) })
    return () => { alive = false }
  }, [period])

  // تنبيه المتصفح لو حاول المستخدم إغلاق الصفحة أثناء التنفيذ
  useEffect(() => {
    if (!running) return
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault() }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [running])

  function toggle(id: string) {
    setExcluded(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next })
  }

  async function run() {
    if (started.current || chosen.length === 0) return
    started.current = true
    setRunning(true); setProgress(0)
    const supabase = createClient()
    const now = payrollPeriodOf(new Date().toISOString())
    const blocked = now.month !== period.month
      ? 'تغيّر الشهر منذ فتح النافذة. أغلقها وافتحها من جديد.'
      : await checkMonth(now)
    if (blocked) { setMonthBlock(blocked); setRunning(false); started.current = false; return }

    const failed: Result['failed'] = []
    let done = 0
    let doneTotal = 0
    for (let i = 0; i < chosen.length; i++) {
      const r = chosen[i]
      const fail = (reason: string) => failed.push({ name: nameOf(r), number: r.request_number, reason })
      setProgress(i + 1)

      // الصف الحالي من قاعدة البيانات: قد يكون غيره اعتمده أو عدّل مبلغه بعد فتح القائمة
      const { data: row, error: readErr } = await supabase.from('employee_requests')
        .select('status, amount, approved_amount, approved_by, approved_at, rejection_reason, description').eq('id', r.id).maybeSingle()
      if (readErr || !row) { fail(readErr?.message || 'لم يُعثر على الطلب'); continue }
      if (row.status !== 'pending' && row.status !== 'approved') { fail('تغيّرت حالته قبل الاعتماد'); continue }
      const amount = payAmount(row)
      if (Math.abs(amount - payAmount(r)) > 0.001) { fail('تغيّر مبلغه بعد فتح القائمة'); continue }
      if (!(amount > 0) || amount > Number(row.amount) + 0.001) { fail('مبلغه غير صالح'); continue }

      // الشرط على الحالة يمنع الخصم المزدوج: من لم يغيّر الصف بنفسه لا يخصم
      const description = reducedAdvanceDescription(row.description, approvedBy, amount, Number(row.amount))
      const { data: claimed, error: claimErr } = await supabase.from('employee_requests').update({
        status: 'completed', approved_by: approvedBy || null, approved_at: new Date().toISOString(), rejection_reason: null,
        amount, ...(description != null ? { description } : {}),
      }).eq('id', r.id).eq('status', row.status).select('id')
      if (claimErr || !claimed || claimed.length === 0) { fail(claimErr?.message || 'تغيّرت حالته قبل الاعتماد'); continue }

      const payrollError = await addAdvanceToPayroll(supabase, r.employee_id, amount, now)
      if (!payrollError) { done++; doneTotal += amount; continue }

      // فشل الخصم: نعيد الطلب كما كان حتى لا يبقى مكتملًا بلا خصم
      const { data: reverted, error: revertErr } = await supabase.from('employee_requests').update({
        status: row.status, approved_by: row.approved_by, approved_at: row.approved_at, rejection_reason: row.rejection_reason,
        amount: row.amount, description: row.description,
      }).eq('id', r.id).select('id')
      if (revertErr || !reverted || reverted.length === 0) {
        fail(`⚠️ صار «مكتملًا» ولم يُؤكَّد خصمه، فراجع خانة «سلفة» يدويًا (${payrollError})`)
        chosen.slice(i + 1).forEach(rest => failed.push({ name: nameOf(rest), number: rest.request_number, reason: 'لم يُنفَّذ: توقفت العملية' }))
        break
      }
      fail(`تعذّر الخصم فبقي الطلب دون اعتماد (${payrollError})`)
    }
    setResult({ done, total: doneTotal, failed })
    setRunning(false)
  }

  const currentKey = periodLabel
  const perEmployee = list.reduce((m, r) => m.set(r.employee_id, (m.get(r.employee_id) || 0) + 1), new Map<string, number>())
  function warningsOf(r: BulkAdvance) {
    const w: string[] = []
    if ((perEmployee.get(r.employee_id) || 0) > 1) w.push('له أكثر من طلب في القائمة')
    if (completedThisMonth.includes(r.employee_id)) w.push('له سلفة مكتملة هذا الشهر')
    const p = payrollPeriodOf(r.created_at)
    if (`${p.month}/${p.year}` !== currentKey) w.push('طلب من شهر سابق')
    return w
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: C.panel, borderRadius: 18, border: `1px solid ${C.border}`, width: '100%', maxWidth: 640, maxHeight: '90vh', display: 'flex', flexDirection: 'column', direction: 'rtl', fontFamily: 'Tajawal, sans-serif' }}>
        <div style={{ padding: '18px 20px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <h3 style={{ color: C.white, fontSize: 16, fontWeight: 800, marginBottom: 4 }}>اعتماد سلف الراتب دفعة واحدة</h3>
            <p style={{ color: C.muted, fontSize: 12 }}>{scopeLabel} · تُخصم من راتب شهر <strong style={{ color: C.gold }}>{periodLabel}</strong></p>
          </div>
          <button onClick={result ? onDone : onClose} disabled={running} aria-label="إغلاق" style={{ background: 'transparent', border: 'none', color: C.muted, cursor: running ? 'not-allowed' : 'pointer', alignSelf: 'flex-start' }}><X size={20} /></button>
        </div>

        {result ? (
          <>
            <div style={{ padding: 20, overflowY: 'auto' }}>
              <div style={{ background: C.greenB, color: C.green, borderRadius: 12, padding: '12px 14px', fontSize: 14, fontWeight: 800, marginBottom: 12 }}>
                اكتمل {result.done} طلب وخُصم {money(result.total)}
              </div>
              {result.failed.length > 0 && (
                <div style={{ background: C.redB, borderRadius: 12, padding: '12px 14px' }}>
                  <div style={{ color: C.red, fontWeight: 800, fontSize: 13, marginBottom: 8 }}>لم يكتمل {result.failed.length}:</div>
                  {result.failed.map(f => (
                    <div key={f.number} style={{ color: C.white, fontSize: 12.5, lineHeight: 1.9 }}>#{f.number} {f.name} — {f.reason}</div>
                  ))}
                </div>
              )}
            </div>
            <div style={{ padding: '14px 20px', borderTop: `1px solid ${C.border}` }}>
              <button onClick={onDone} style={{ ...btn, width: '100%', background: C.gold, color: '#0A1628', border: `1px solid ${C.gold}` }}>تم</button>
            </div>
          </>
        ) : (
          <>
            <div style={{ padding: '10px 20px', borderBottom: `1px solid ${C.border}` }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, color: C.white, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                <input type="checkbox" checked={excluded.size === 0} disabled={running}
                  onChange={() => setExcluded(excluded.size === 0 ? new Set(list.map(r => r.id)) : new Set())}
                  style={{ width: 17, height: 17, accentColor: C.green }} />
                تحديد الكل ({list.length})
              </label>
            </div>
            <div style={{ overflowY: 'auto', flex: 1, minHeight: 0 }}>
              {list.map(r => {
                const warnings = warningsOf(r)
                return (
                  <label key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 20px', borderBottom: `1px solid ${C.border}`, cursor: 'pointer', opacity: excluded.has(r.id) ? 0.5 : 1 }}>
                    <input type="checkbox" checked={!excluded.has(r.id)} disabled={running} onChange={() => toggle(r.id)} style={{ width: 17, height: 17, accentColor: C.green, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ color: C.white, fontSize: 13, fontWeight: 700 }}>{nameOf(r)}</div>
                      <div style={{ color: C.muted, fontSize: 11 }}>
                        #{r.request_number} · {r.employees?.employee_number || '—'} · {r.employees?.branches?.name || '—'} · {r.created_at.slice(0, 10)}
                      </div>
                      {warnings.length > 0 && (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: C.amber, fontSize: 11, fontWeight: 700, marginTop: 3 }}>
                          <TriangleAlert size={12} /> {warnings.join(' · ')}
                        </div>
                      )}
                    </div>
                    <div style={{ textAlign: 'left', flexShrink: 0 }}>
                      <div style={{ color: C.gold, fontSize: 13, fontWeight: 800 }}>{money(payAmount(r))}</div>
                      {payAmount(r) < Number(r.amount) - 0.001 && <div style={{ color: C.muted, fontSize: 11 }}>المطلوب {money(Number(r.amount))}</div>}
                    </div>
                  </label>
                )
              })}
            </div>
            <div style={{ padding: '14px 20px', borderTop: `1px solid ${C.border}` }}>
              {monthBlock && <div style={{ background: C.amberB, color: C.amber, borderRadius: 10, padding: '9px 12px', fontSize: 12, fontWeight: 700, marginBottom: 10 }}>{monthBlock}</div>}
              <div style={{ display: 'flex', justifyContent: 'space-between', color: C.white, fontSize: 13, marginBottom: 10 }}>
                <span>المحدد: <strong>{chosen.length}</strong></span>
                <span>الإجمالي: <strong style={{ color: C.gold }}>{money(total)}</strong></span>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={run} disabled={running || !!monthBlock || chosen.length === 0}
                  style={{ ...btn, flex: 1, background: C.greenB, color: C.green, border: `1px solid ${C.green}55`, opacity: running || monthBlock || chosen.length === 0 ? 0.5 : 1 }}>
                  <CircleCheck size={15} /> {running ? `جارٍ الاعتماد ${progress} من ${chosen.length}...` : `تأكيد: اعتماد وخصم ${chosen.length} طلب`}
                </button>
                <button onClick={onClose} disabled={running} style={{ ...btn, background: 'transparent', color: C.white, border: '1px solid rgba(255,255,255,0.18)' }}>إلغاء</button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
