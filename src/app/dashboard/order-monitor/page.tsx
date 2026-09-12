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
  gold: '#C9A84C', gold3: 'rgba(201,168,76,0.12)',
  white: '#FAFAF8', muted: '#8A9BB5', border: 'rgba(255,255,255,0.08)',
  green: '#22C55E', greenB: 'rgba(34,197,94,0.12)',
  red: '#EF4444', redB: 'rgba(239,68,68,0.12)',
  amber: '#F59E0B', amberB: 'rgba(245,158,11,0.12)',
  blue: '#3B82F6', blueB: 'rgba(59,130,246,0.12)',
  card: 'rgba(255,255,255,0.04)',
}

type ClientMeta = { ip_address: string | null; user_agent: string | null; device_model: string | null; created_at?: string | null }
type ActiveTable = {
  id: string; number: number; name: string; section: string; branch_id: string
  current_order_id: string; occupied_since: string | null
  branchName: string; itemsCount: number; total: number
  meta: ClientMeta[]
}

// ✅ استخراج ملخص مختصر ومقروء من الـ user-agent الخام (بدل ما نطبع السطر الطويل كامل)
function summarizeUserAgent(ua: string | null | undefined): string {
  if (!ua) return '—'
  const isIOS = /iPhone|iPad|iPod/i.test(ua)
  const isAndroid = /Android/i.test(ua)
  const os = isIOS ? '🍎 iOS' : isAndroid ? '🤖 Android' : /Windows/i.test(ua) ? '🖥️ Windows' : /Mac OS/i.test(ua) ? '🖥️ Mac' : 'جهاز غير معروف'
  const browser = /Chrome/i.test(ua) && !/Edg/i.test(ua) ? 'Chrome' : /Safari/i.test(ua) && !/Chrome/i.test(ua) ? 'Safari' : /Firefox/i.test(ua) ? 'Firefox' : /Edg/i.test(ua) ? 'Edge' : ''
  return browser ? `${os} · ${browser}` : os
}

function fmtElapsed(iso: string | null): string {
  if (!iso) return '—'
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000))
  if (mins < 60) return `${mins} د`
  const h = Math.floor(mins / 60), m = mins % 60
  return `${h} س ${m} د`
}

function fmtTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })
}

export default function OrderMonitorPage() {
  const sb = useRef(createClient()).current
  const { employee, permissions } = useAuth() as any
  const isAdmin = permissions?.all === true

  const [branches, setBranches] = useState<{ id: string; name: string }[]>([])
  const [activeBranch, setActiveBranch] = useState<string>('all')
  const [tables, setTables] = useState<ActiveTable[]>([])
  const [loading, setLoading] = useState(true)
  // ✅ آخر مرة اتحدّثت فيها البيانات - عشان الأدمن يعرف الداتا فريش قد إيه
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)

  const fetchActive = useCallback(async () => {
    setLoading(true)
    const [{ data: branchesData }, { data: tablesData }] = await Promise.all([
      sb.from('branches').select('id,name').eq('is_active', true).order('name'),
      // ✅ أي طاولة (صالة أو تيك أواي) عليها أوردر شغّال دلوقتي - مش بس status='occupied' لأننا عايزين
      // نتأكد إن فيه فاتورة فعلية مرتبطة، مش مجرد علم قديم عالق
      sb.from('tables').select('id,number,name,section,branch_id,current_order_id,occupied_since')
        .not('current_order_id', 'is', null),
    ])
    setBranches(branchesData || [])

    const rows = (tablesData || []) as any[]
    const branchNameOf = (id: string) => (branchesData || []).find((b: any) => b.id === id)?.name || '—'
    const orderIds = rows.map(r => r.current_order_id).filter(Boolean)

    const [itemsRes, metaRes] = await Promise.all([
      orderIds.length > 0
        ? sb.from('order_items').select('order_id,unit_price,quantity,status').in('order_id', orderIds)
        : Promise.resolve({ data: [] }),
      // ✅ كل بيانات الجهاز/الـ IP المسجَّلة لكل أوردر من هالطاولات - ممكن أكتر من سطر لو العميل ضاف على الأوردر أكتر من مرة
      orderIds.length > 0
        ? sb.from('order_client_meta').select('*').in('order_id', orderIds)
        : Promise.resolve({ data: [] }),
    ])

    const itemsByOrder: Record<string, { count: number; total: number }> = {}
    for (const it of (itemsRes.data || []) as any[]) {
      if (it.status === 'cancelled') continue
      if (!itemsByOrder[it.order_id]) itemsByOrder[it.order_id] = { count: 0, total: 0 }
      itemsByOrder[it.order_id].count++
      itemsByOrder[it.order_id].total += (it.unit_price || 0) * (it.quantity || 0)
    }
    const metaByOrder: Record<string, ClientMeta[]> = {}
    for (const m of (metaRes.data || []) as any[]) {
      if (!metaByOrder[m.order_id]) metaByOrder[m.order_id] = []
      metaByOrder[m.order_id].push(m)
    }

    const withData: ActiveTable[] = rows.map(r => ({
      id: r.id, number: r.number, name: r.name, section: r.section, branch_id: r.branch_id,
      current_order_id: r.current_order_id, occupied_since: r.occupied_since,
      branchName: branchNameOf(r.branch_id),
      itemsCount: itemsByOrder[r.current_order_id]?.count || 0,
      total: itemsByOrder[r.current_order_id]?.total || 0,
      meta: metaByOrder[r.current_order_id] || [],
    })).sort((a, b) => a.branchName.localeCompare(b.branchName) || a.number - b.number)

    setTables(withData)
    setLastRefresh(new Date())
    setLoading(false)
  }, [sb])

  useEffect(() => { if (employee) fetchActive() }, [employee, fetchActive])

  // ✅ تحديث حي - أي تغيير في الطاولات أو الأوردرات أو بيانات الجهاز يحدّث الشاشة تلقائيًا من غير ما الأدمن يعمل رفرش يدوي
  useEffect(() => {
    const ch = sb.channel('order-monitor-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tables' }, fetchActive)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, fetchActive)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_client_meta' }, fetchActive)
      .subscribe()
    return () => { sb.removeChannel(ch) }
  }, [sb, fetchActive])

  if (!isAdmin) {
    return <div style={{ padding: 40, textAlign: 'center', color: S.muted, fontFamily: 'Tajawal, sans-serif' }}>ليس لديك صلاحية للوصول لهذه الصفحة</div>
  }

  const filtered = activeBranch === 'all' ? tables : tables.filter(t => t.branch_id === activeBranch)

  // ✅ نفس الـ IP ظاهر على أكتر من طاولة شغّالة دلوقتي في نفس اللحظة - مؤشر قوي إن حد بيطلب من برّه
  // على أكتر من طاولة، أو إن نفس الجهاز واقف وراء أكتر من حساب
  const ipToTables: Record<string, Set<string>> = {}
  for (const t of tables) {
    for (const m of t.meta) {
      if (!m.ip_address) continue
      if (!ipToTables[m.ip_address]) ipToTables[m.ip_address] = new Set()
      ipToTables[m.ip_address].add(t.id)
    }
  }
  const suspiciousIp = (ip: string | null) => !!ip && (ipToTables[ip]?.size || 0) > 1

  return (
    <div style={{ minHeight: '100vh', background: S.navy, padding: 20, fontFamily: 'Tajawal, sans-serif', direction: 'rtl' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: S.white }}>🔍 مراقبة الطلبات المباشرة</h1>
          <p style={{ fontSize: 12, color: S.muted, marginTop: 4 }}>كل طاولة (صالة أو تيك أواي) عليها أوردر شغّال دلوقتي، مع بيانات الجهاز/الـ IP اللي طلب بيه — لتحديد أي طلب مشبوه من برّة المطعم</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          {lastRefresh && <span style={{ fontSize: 11, color: S.muted }}>آخر تحديث: {fmtTime(lastRefresh.toISOString())}</span>}
          <button onClick={fetchActive} disabled={loading}
            style={{ padding: '9px 16px', borderRadius: 10, border: `1px solid ${S.gold}`, background: S.gold3, color: S.gold, cursor: loading ? 'not-allowed' : 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
            {loading ? '⏳...' : '🔄 تحديث'}
          </button>
        </div>
      </div>

      {branches.length > 1 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
          <button onClick={() => setActiveBranch('all')}
            style={{ padding: '7px 16px', borderRadius: 999, border: activeBranch === 'all' ? `1px solid ${S.gold}` : `1px solid ${S.border}`, background: activeBranch === 'all' ? S.gold3 : 'transparent', color: activeBranch === 'all' ? S.gold : S.muted, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
            كل الفروع
          </button>
          {branches.map(b => (
            <button key={b.id} onClick={() => setActiveBranch(b.id)}
              style={{ padding: '7px 16px', borderRadius: 999, border: activeBranch === b.id ? `1px solid ${S.gold}` : `1px solid ${S.border}`, background: activeBranch === b.id ? S.gold3 : 'transparent', color: activeBranch === b.id ? S.gold : S.muted, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
              {b.name}
            </button>
          ))}
        </div>
      )}

      {loading && tables.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: S.muted }}>⏳ جارٍ التحميل...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: S.muted }}>لا توجد طاولات شغّالة دلوقتي</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
          {filtered.map(t => {
            const flagged = t.meta.some(m => suspiciousIp(m.ip_address))
            return (
              <div key={t.id} style={{ background: S.navy2, borderRadius: 16, border: `1px solid ${flagged ? S.red : S.border}`, padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10, gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: S.white }}>
                      {t.section === 'takeaway' ? '🥡' : '🪑'} {t.name}
                      {flagged && <span style={{ marginRight: 8, fontSize: 10, background: S.redB, color: S.red, borderRadius: 20, padding: '2px 8px', fontWeight: 700 }}>⚠️ IP مكرر على طاولة تانية</span>}
                    </div>
                    <div style={{ fontSize: 11, color: S.muted, marginTop: 3 }}>🏪 {t.branchName} — شغّالة من {fmtElapsed(t.occupied_since)}</div>
                  </div>
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: S.gold }}>MYR {t.total.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                    <div style={{ fontSize: 10, color: S.muted }}>{t.itemsCount} صنف</div>
                  </div>
                </div>

                <div style={{ borderTop: `1px solid ${S.border}`, paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {t.meta.length === 0 ? (
                    <div style={{ fontSize: 11, color: S.muted }}>لا توجد بيانات جهاز مسجَّلة لهذا الأوردر</div>
                  ) : t.meta.map((m, i) => (
                    <div key={i} style={{ background: suspiciousIp(m.ip_address) ? S.redB : S.card, borderRadius: 10, padding: '8px 10px', fontSize: 11 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: suspiciousIp(m.ip_address) ? S.red : S.white, fontWeight: 700 }}>
                        <span>🌐 {m.ip_address || '—'}</span>
                        {m.created_at && <span style={{ color: S.muted, fontWeight: 400 }}>{fmtTime(m.created_at)}</span>}
                      </div>
                      <div style={{ color: S.muted, marginTop: 3 }}>
                        {m.device_model ? `📱 ${m.device_model} — ` : ''}{summarizeUserAgent(m.user_agent)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
