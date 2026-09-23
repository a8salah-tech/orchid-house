'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useAuth } from './AuthProvider'

const sb = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const EXEMPT_ROLES = ['admin', 'branch_manager', 'cashier', 'kitchen_display']
const READ_SECONDS = 8

type Pending = { id: string; title: string; title_en: string; content: string; content_en: string; department: string }

function PolicyCard({ policy, total, employeeId, onDone }: { policy: Pending; total: number; employeeId: string; onDone: (id: string) => void }) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [left, setLeft] = useState(READ_SECONDS)

  useEffect(() => {
    const t = setInterval(() => setLeft(s => (s > 0 ? s - 1 : 0)), 1000)
    return () => clearInterval(t)
  }, [])

  async function confirm() {
    setSaving(true); setError('')
    const { error: err } = await sb.from('policy_acknowledgments')
      .upsert([{ policy_id: policy.id, employee_id: employeeId }], { onConflict: 'policy_id,employee_id' })
    setSaving(false)
    if (err) { setError('تعذر حفظ التأكيد، حاول مرة أخرى'); return }
    onDone(policy.id)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.92)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, direction: 'rtl', fontFamily: 'Tajawal, sans-serif' }}>
      <div style={{ background: '#0F2040', border: '1px solid rgba(201,168,76,.4)', borderRadius: 20, width: '100%', maxWidth: 680, maxHeight: '92vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '18px 22px', borderBottom: '1px solid rgba(255,255,255,.08)' }}>
          <div style={{ fontSize: 12, color: '#F59E0B', fontWeight: 700, marginBottom: 6 }}>⚠️ سياسة إلزامية — يجب القراءة والتأكيد للمتابعة ({total} متبقية)</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#FAFAF8' }}>📜 {policy.title}</div>
          {policy.title_en && <div style={{ fontSize: 12, color: '#8A9BB5', direction: 'ltr', textAlign: 'right', marginTop: 2 }}>{policy.title_en}</div>}
        </div>
        <div style={{ padding: '18px 22px', overflowY: 'auto', flex: 1 }}>
          <div style={{ fontSize: 14, color: '#FAFAF8', lineHeight: 1.9, whiteSpace: 'pre-wrap' }}>{policy.content}</div>
          {policy.content_en && (
            <div style={{ marginTop: 16, background: 'rgba(255,255,255,.04)', borderRadius: 10, padding: '12px 16px', direction: 'ltr' }}>
              <div style={{ fontSize: 13, color: '#8A9BB5', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{policy.content_en}</div>
            </div>
          )}
        </div>
        <div style={{ padding: '14px 22px', borderTop: '1px solid rgba(255,255,255,.08)' }}>
          {error && <div style={{ color: '#EF4444', fontSize: 12, marginBottom: 8 }}>{error}</div>}
          <button onClick={confirm} disabled={saving || left > 0}
            style={{ width: '100%', padding: 13, borderRadius: 12, border: 'none', background: left > 0 || saving ? 'rgba(255,255,255,.1)' : 'linear-gradient(135deg,#22C55E,#14B8A6)', color: '#FAFAF8', cursor: left > 0 || saving ? 'not-allowed' : 'pointer', fontWeight: 800, fontSize: 14, fontFamily: 'Tajawal, sans-serif' }}>
            {saving ? '⏳...' : left > 0 ? `اقرأ السياسة... (${left})` : '✅ قرأت وفهمت والتزم بهذه السياسة'}
          </button>
        </div>
      </div>
    </div>
  )
}

// يمنع الموظف من استخدام النظام حتى يقرأ ويؤكد كل السياسات الإلزامية النشطة الخاصة بقسمه أو العامة
export default function MandatoryPolicyGate() {
  const { employee } = useAuth()
  const [pending, setPending] = useState<Pending[]>([])

  useEffect(() => {
    if (!employee?.id || EXEMPT_ROLES.includes(employee.role)) return
    let cancelled = false
    Promise.all([
      sb.from('work_policies').select('id,title,title_en,content,content_en,department').eq('is_active', true).eq('is_mandatory', true).order('created_at'),
      sb.from('policy_acknowledgments').select('policy_id').eq('employee_id', employee.id),
    ]).then(([pol, acks]) => {
      if (cancelled || pol.error || acks.error) return
      const done = new Set((acks.data || []).map((a: { policy_id: string }) => a.policy_id))
      setPending(((pol.data || []) as Pending[]).filter(p =>
        !done.has(p.id) && (p.department === 'الإدارة' || p.department === employee.department)
      ))
    })
    return () => { cancelled = true }
  }, [employee?.id, employee?.role, employee?.department])

  const current = pending[0]
  if (!current || !employee?.id) return null

  return (
    <PolicyCard
      key={current.id}
      policy={current}
      total={pending.length}
      employeeId={employee.id}
      onDone={id => setPending(prev => prev.filter(p => p.id !== id))}
    />
  )
}
