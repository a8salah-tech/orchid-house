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

type ClientMeta = { ip_address: string | null; user_agent: string | null; device_model: string | null; device_id?: string | null; created_at?: string | null }
type BlockedClient = { id: string; kind: 'device' | 'ip'; value: string; reason: string | null; expires_at: string | null; blocked_by_name: string | null; created_at: string }
type BlockTarget = { meta: ClientMeta; tableName: string }
type BlockedAttempt = { created_at: string; ip_address: string | null; user_agent: string | null; table_id: string | null }
type BlockedOrder = {
  id: string; status: string; total_amount: number | null; created_at: string; table_id: string
  tables: { name: string; branch_id: string } | null
  order_items: { id: string; quantity: number; unit_price: number; status: string; size_name: string | null; notes: string | null; menu_items: { name: string; name_en: string | null } | null }[]
}
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
  // ✅ حظر الأجهزة/العناوين: القائمة الحالية + نافذة الحظر
  const [blocked, setBlocked] = useState<BlockedClient[]>([])
  const [blockTarget, setBlockTarget] = useState<BlockTarget | null>(null)
  const [blockDevice, setBlockDevice] = useState(true)
  const [blockIp, setBlockIp] = useState(false)
  const [ipDuration, setIpDuration] = useState<'24h' | '7d' | 'forever'>('24h')
  const [blockReason, setBlockReason] = useState('')
  const [blockSaving, setBlockSaving] = useState(false)
  // ✅ تفاصيل المحظور: كل الطلبات التي أرسلها هذا الجهاز/العنوان (مع بياناته)
  const [detailTarget, setDetailTarget] = useState<BlockedClient | null>(null)
  const [detailOrders, setDetailOrders] = useState<BlockedOrder[]>([])
  const [detailMetas, setDetailMetas] = useState<(ClientMeta & { order_id: string })[]>([])
  const [detailLoading, setDetailLoading] = useState(false)
  // ✅ محاولات الطلب من محظور: العدد وآخر محاولة لكل محظور + آخر المحاولات في نافذة التفاصيل
  const [attemptStats, setAttemptStats] = useState<Record<string, { count: number; last: string }>>({})
  const [detailAttempts, setDetailAttempts] = useState<BlockedAttempt[]>([])
  const [attemptTables, setAttemptTables] = useState<Record<string, string>>({})
  const [nowMs, setNowMs] = useState(() => Date.now())

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

  const fetchBlocked = useCallback(async () => {
    const { data } = await sb.from('blocked_clients').select('*').order('created_at', { ascending: false })
    setBlocked((data || []) as BlockedClient[])
    const { data: att } = await sb.from('blocked_attempts').select('blocked_id,created_at').order('created_at', { ascending: false }).limit(5000)
    const stats: Record<string, { count: number; last: string }> = {}
    for (const a of (att || []) as { blocked_id: string; created_at: string }[]) {
      if (!stats[a.blocked_id]) stats[a.blocked_id] = { count: 0, last: a.created_at }
      stats[a.blocked_id].count++
    }
    setAttemptStats(stats)
    setNowMs(Date.now())
  }, [sb])

  useEffect(() => { if (employee) { fetchActive(); fetchBlocked() } }, [employee, fetchActive, fetchBlocked])

  const isBlockActive = (b: BlockedClient) => !b.expires_at || new Date(b.expires_at).getTime() > nowMs
  const isMetaBlocked = (m: ClientMeta) => blocked.some(b => isBlockActive(b) && ((b.kind === 'device' && !!m.device_id && b.value === m.device_id) || (b.kind === 'ip' && !!m.ip_address && b.value === m.ip_address)))

  function openBlock(meta: ClientMeta, tableName: string) {
    setBlockTarget({ meta, tableName })
    setBlockDevice(!!meta.device_id)
    setBlockIp(!meta.device_id)
    setIpDuration('24h')
    setBlockReason('')
  }

  async function confirmBlock() {
    if (!blockTarget) return
    const m = blockTarget.meta
    const rows: { kind: 'device' | 'ip'; value: string; reason: string | null; expires_at: string | null; blocked_by_name: string | null }[] = []
    const reason = blockReason.trim() || null
    const byName = employee?.name || null
    if (blockDevice && m.device_id) rows.push({ kind: 'device', value: m.device_id, reason, expires_at: null, blocked_by_name: byName })
    if (blockIp && m.ip_address) {
      const ms = ipDuration === '24h' ? 24 * 3600 * 1000 : ipDuration === '7d' ? 7 * 24 * 3600 * 1000 : 0
      rows.push({ kind: 'ip', value: m.ip_address, reason, expires_at: ms ? new Date(Date.now() + ms).toISOString() : null, blocked_by_name: byName })
    }
    if (rows.length === 0) { alert('اختر ما تريد حظره'); return }
    setBlockSaving(true)
    const { error } = await sb.from('blocked_clients').upsert(rows, { onConflict: 'kind,value' })
    setBlockSaving(false)
    if (error) { alert('تعذّر الحظر: ' + error.message); return }
    setBlockTarget(null)
    fetchBlocked()
  }

  // ✅ عند الضغط على محظور: نجيب كل سجلات order_client_meta المطابقة (رمز الجهاز أو الـ IP) ثم الطلبات وأصنافها
  async function openBlockedDetail(b: BlockedClient) {
    setDetailTarget(b)
    setDetailOrders([]); setDetailMetas([]); setDetailAttempts([]); setAttemptTables({})
    setDetailLoading(true)
    const { data: attRows } = await sb.from('blocked_attempts').select('created_at,ip_address,user_agent,table_id').eq('blocked_id', b.id).order('created_at', { ascending: false }).limit(30)
    const attList = (attRows || []) as BlockedAttempt[]
    setDetailAttempts(attList)
    const tIds = [...new Set(attList.map(a => a.table_id).filter(Boolean))] as string[]
    if (tIds.length > 0) {
      const { data: tb } = await sb.from('tables').select('id,name').in('id', tIds)
      setAttemptTables(Object.fromEntries(((tb || []) as { id: string; name: string }[]).map(t => [t.id, t.name])))
    }
    const col = b.kind === 'device' ? 'device_id' : 'ip_address'
    const { data: metas } = await sb.from('order_client_meta').select('*').eq(col, b.value).order('created_at', { ascending: false }).limit(300)
    const metaRows = (metas || []) as (ClientMeta & { order_id: string })[]
    setDetailMetas(metaRows)
    const ids = [...new Set(metaRows.map(m => m.order_id))]
    if (ids.length > 0) {
      const { data: ords } = await sb.from('orders')
        .select('id,status,total_amount,created_at,table_id,tables(name,branch_id),order_items(id,quantity,unit_price,status,size_name,notes,menu_items(name,name_en))')
        .in('id', ids).order('created_at', { ascending: false })
      setDetailOrders((ords || []) as unknown as BlockedOrder[])
    }
    setDetailLoading(false)
  }

  async function unblock(id: string) {
    if (!confirm('رفع الحظر عن هذا الجهاز/العنوان؟')) return
    const { error } = await sb.from('blocked_clients').delete().eq('id', id)
    if (error) { alert('تعذّر رفع الحظر: ' + error.message); return }
    fetchBlocked()
  }

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
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6, gap: 8 }}>
                        <span style={{ color: S.muted, fontSize: 10 }}>{m.device_id ? `🔑 ${m.device_id.slice(0, 8)}…` : 'بلا رمز جهاز (طلب قديم)'}</span>
                        {isMetaBlocked(m)
                          ? <span style={{ fontSize: 10, color: S.red, fontWeight: 700 }}>🚫 محظور</span>
                          : <button onClick={() => openBlock(m, t.name)} style={{ padding: '4px 10px', borderRadius: 8, border: `1px solid ${S.red}`, background: S.redB, color: S.red, cursor: 'pointer', fontSize: 11, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>🚫 حظر</button>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* 🚫 قائمة المحظورين */}
      <div style={{ marginTop: 28, background: S.navy2, borderRadius: 16, border: `1px solid ${S.border}`, padding: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: S.white, marginBottom: 10 }}>🚫 المحظورون ({blocked.filter(isBlockActive).length})</div>
        {blocked.length === 0 ? (
          <div style={{ fontSize: 12, color: S.muted }}>لا يوجد محظورون.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {blocked.map(b => (
              <div key={b.id} onClick={() => openBlockedDetail(b)} title="اضغط لعرض الطلبات التي أرسلها" style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, background: S.card, borderRadius: 10, padding: '8px 12px', opacity: isBlockActive(b) ? 1 : 0.5, flexWrap: 'wrap' }}>
                <div style={{ fontSize: 12, color: S.white }}>
                  <div style={{ fontWeight: 700 }}>{b.kind === 'device' ? '📱 جهاز' : '🌐 IP'} — <span dir="ltr">{b.kind === 'device' ? b.value.slice(0, 8) + '…' : b.value}</span></div>
                  <div style={{ fontSize: 10.5, marginTop: 3, color: attemptStats[b.id] ? S.amber : S.muted, fontWeight: attemptStats[b.id] ? 700 : 400 }}>
                    {attemptStats[b.id] ? `🚧 حاول الطلب ${attemptStats[b.id].count} ${attemptStats[b.id].count === 1 ? 'مرة' : 'مرات'} بعد الحظر · آخرها ${new Date(attemptStats[b.id].last).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })}` : '🚧 لم يحاول الطلب بعد الحظر'}
                  </div>
                  <div style={{ fontSize: 10, color: S.muted, marginTop: 2 }}>
                    {b.reason ? `السبب: ${b.reason} · ` : ''}بواسطة {b.blocked_by_name || '—'} · {new Date(b.created_at).toLocaleDateString('en-GB')} · {b.expires_at ? (isBlockActive(b) ? `ينتهي ${new Date(b.expires_at).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })}` : 'انتهى') : 'دائم'}
                  </div>
                </div>
                <button onClick={e => { e.stopPropagation(); unblock(b.id) }} style={{ padding: '5px 12px', borderRadius: 8, border: `1px solid ${S.border}`, background: 'transparent', color: S.muted, cursor: 'pointer', fontSize: 11, fontFamily: 'Tajawal, sans-serif' }}>رفع الحظر</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 🔎 تفاصيل محظور: كل طلباته */}
      {detailTarget && (() => {
        const active = detailOrders.filter(o => o.status !== 'cancelled')
        const totalAmt = active.reduce((sum, o) => sum + (o.total_amount || 0), 0)
        const ips = [...new Set(detailMetas.map(m => m.ip_address).filter(Boolean))] as string[]
        const devs = [...new Set(detailMetas.map(m => m.device_id).filter(Boolean))] as string[]
        const models = [...new Set(detailMetas.map(m => m.device_model).filter(Boolean))] as string[]
        const uas = [...new Set(detailMetas.map(m => summarizeUserAgent(m.user_agent)))]
        const metaOf = (orderId: string) => detailMetas.filter(m => m.order_id === orderId)
        const branchNameOf = (id: string | undefined) => branches.find(b => b.id === id)?.name || '—'
        const fmtDT = (iso: string) => new Date(iso).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })
        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 500, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 20, overflowY: 'auto' }} onClick={() => setDetailTarget(null)}>
            <div onClick={e => e.stopPropagation()} style={{ background: S.navy2, border: `1px solid ${S.red}50`, borderRadius: 16, padding: 22, maxWidth: 680, width: '100%', margin: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: S.red }}>🚫 {detailTarget.kind === 'device' ? 'جهاز محظور' : 'عنوان IP محظور'}</div>
                  <div dir="ltr" style={{ fontSize: 11, color: S.muted, marginTop: 4, wordBreak: 'break-all', textAlign: 'right' }}>{detailTarget.value}</div>
                </div>
                <button onClick={() => setDetailTarget(null)} style={{ background: 'transparent', border: 'none', color: S.muted, fontSize: 22, cursor: 'pointer' }}>✕</button>
              </div>
              <div style={{ fontSize: 12, color: S.muted, lineHeight: 1.9, background: S.card, borderRadius: 10, padding: '10px 12px', marginBottom: 12 }}>
                {detailTarget.reason && <div>📝 السبب: <span style={{ color: S.white }}>{detailTarget.reason}</span></div>}
                <div>👤 حظره: <span style={{ color: S.white }}>{detailTarget.blocked_by_name || '—'}</span> · {fmtDT(detailTarget.created_at)}</div>
                <div>⏳ المدة: <span style={{ color: S.white }}>{detailTarget.expires_at ? (isBlockActive(detailTarget) ? `ينتهي ${fmtDT(detailTarget.expires_at)}` : 'انتهى') : 'دائم'}</span></div>
              </div>
              <div style={{ background: S.card, borderRadius: 10, padding: '10px 12px', marginBottom: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: detailAttempts.length > 0 ? S.amber : S.muted, marginBottom: detailAttempts.length > 0 ? 6 : 0 }}>🚧 محاولات الطلب بعد الحظر: {attemptStats[detailTarget.id]?.count || 0}</div>
                {detailAttempts.map((a, i) => (
                  <div key={i} dir="ltr" style={{ fontSize: 10.5, color: S.muted, textAlign: 'right', lineHeight: 1.7 }}>
                    {fmtDT(a.created_at)} · 🌐 {a.ip_address || '—'} · {summarizeUserAgent(a.user_agent)}{a.table_id && attemptTables[a.table_id] ? ` · 🪑 ${attemptTables[a.table_id]}` : ''}
                  </div>
                ))}
              </div>
              {detailLoading ? (
                <div style={{ textAlign: 'center', padding: 30, color: S.muted }}>⏳ جارٍ جلب الطلبات...</div>
              ) : detailOrders.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 30, color: S.muted, lineHeight: 1.8 }}>لا توجد طلبات مسجَّلة لهذا {detailTarget.kind === 'device' ? 'الجهاز' : 'العنوان'}.{detailTarget.kind === 'device' ? <><br />رمز الجهاز يُسجَّل فقط مع الطلبات المرسلة بعد تفعيل الحظر.</> : null}</div>
              ) : (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8, marginBottom: 12 }}>
                    {[{ l: 'عدد الطلبات', v: String(detailOrders.length) }, { l: 'إجمالي غير الملغى', v: `MYR ${totalAmt.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` }, { l: 'أول طلب', v: fmtDT(detailOrders[detailOrders.length - 1].created_at) }, { l: 'آخر طلب', v: fmtDT(detailOrders[0].created_at) }].map((c, i) => (
                      <div key={i} style={{ background: S.card, borderRadius: 10, padding: '8px 10px', textAlign: 'center' }}>
                        <div style={{ fontSize: 13, fontWeight: 800, color: S.white }}>{c.v}</div>
                        <div style={{ fontSize: 10, color: S.muted, marginTop: 2 }}>{c.l}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ fontSize: 11, color: S.muted, lineHeight: 1.9, marginBottom: 12 }}>
                    {detailTarget.kind === 'device' && ips.length > 0 && <div>🌐 عناوين IP التي استخدمها: <span dir="ltr" style={{ color: S.white }}>{ips.join(' · ')}</span></div>}
                    {detailTarget.kind === 'ip' && devs.length > 0 && <div>🔑 رموز الأجهزة على هذا العنوان: <span dir="ltr" style={{ color: S.white }}>{devs.map(d => d.slice(0, 8) + '…').join(' · ')}</span></div>}
                    {models.length > 0 && <div>📱 الطراز: <span style={{ color: S.white }}>{models.join('، ')}</span></div>}
                    <div>🖥️ المتصفح/النظام: <span style={{ color: S.white }}>{uas.join('، ')}</span></div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {detailOrders.map(o => {
                      const cancelled = o.status === 'cancelled'
                      const oMetas = metaOf(o.id)
                      return (
                        <div key={o.id} style={{ background: S.card, border: `1px solid ${cancelled ? S.red + '40' : S.border}`, borderRadius: 12, padding: '10px 12px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
                            <div style={{ fontSize: 12, color: S.white, fontWeight: 700 }}>#{o.id.slice(-6).toUpperCase()} · 🪑 {o.tables?.name || '—'} <span style={{ color: S.muted, fontWeight: 400 }}>· 🏪 {branchNameOf(o.tables?.branch_id)}</span></div>
                            <div style={{ fontSize: 12, fontWeight: 800, color: cancelled ? S.red : S.gold }}>MYR {(o.total_amount || 0).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                          </div>
                          <div style={{ fontSize: 10.5, color: S.muted, marginBottom: 6 }}>🕐 {fmtDT(o.created_at)} · الحالة: <span style={{ color: cancelled ? S.red : S.white, fontWeight: 700 }}>{o.status}</span></div>
                          <div style={{ fontSize: 11.5, color: S.white, lineHeight: 1.7 }}>
                            {o.order_items.map(it => (
                              <div key={it.id} style={{ opacity: it.status === 'cancelled' ? 0.5 : 1, textDecoration: it.status === 'cancelled' ? 'line-through' : 'none' }}>
                                {it.menu_items?.name || it.menu_items?.name_en || '⚠️ صنف محذوف'}{it.size_name ? ` (${it.size_name})` : ''} <span style={{ color: S.gold, fontWeight: 700 }}>×{it.quantity}</span> <span style={{ color: S.muted }}>· MYR {(it.unit_price * it.quantity).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>{it.notes ? <span style={{ color: S.gold }}> · 📝 {it.notes}</span> : null}
                              </div>
                            ))}
                          </div>
                          {oMetas.length > 0 && (
                            <div style={{ fontSize: 10, color: S.muted, marginTop: 6, borderTop: `1px solid ${S.border}`, paddingTop: 6 }}>
                              {oMetas.map((m, i) => <div key={i} dir="ltr" style={{ textAlign: 'right' }}>🌐 {m.ip_address || '—'} · {m.device_model ? `📱 ${m.device_model} · ` : ''}{summarizeUserAgent(m.user_agent)}{m.created_at ? ` · ${fmtDT(m.created_at)}` : ''}</div>)}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </>
              )}
            </div>
          </div>
        )
      })()}

      {/* نافذة الحظر */}
      {blockTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={() => setBlockTarget(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background: S.navy2, border: `1px solid ${S.red}50`, borderRadius: 16, padding: 22, maxWidth: 440, width: '100%' }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: S.red, marginBottom: 4 }}>🚫 حظر من إرسال الطلبات</div>
            <div style={{ fontSize: 11, color: S.muted, marginBottom: 14, lineHeight: 1.7 }}>
              {blockTarget.tableName} · 🌐 {blockTarget.meta.ip_address || '—'} · {blockTarget.meta.device_model ? `📱 ${blockTarget.meta.device_model} · ` : ''}{summarizeUserAgent(blockTarget.meta.user_agent)}
            </div>
            <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13, color: blockTarget.meta.device_id ? S.white : S.muted, marginBottom: 10, cursor: blockTarget.meta.device_id ? 'pointer' : 'default' }}>
              <input type="checkbox" checked={blockDevice} disabled={!blockTarget.meta.device_id} onChange={e => setBlockDevice(e.target.checked)} style={{ marginTop: 3 }} />
              <span>حظر الجهاز (دائم){!blockTarget.meta.device_id && <span style={{ display: 'block', fontSize: 10, color: S.amber }}>هذا الطلب قديم بلا رمز جهاز — لا يمكن حظر جهازه، ويمكن حظر عنوانه مؤقتاً فقط.</span>}</span>
            </label>
            <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13, color: S.white, marginBottom: 6, cursor: 'pointer' }}>
              <input type="checkbox" checked={blockIp} onChange={e => setBlockIp(e.target.checked)} style={{ marginTop: 3 }} />
              <span>حظر عنوان الـ IP أيضاً</span>
            </label>
            {blockIp && (
              <div style={{ marginRight: 24, marginBottom: 10 }}>
                <select value={ipDuration} onChange={e => setIpDuration(e.target.value as '24h' | '7d' | 'forever')} style={{ background: S.navy3, color: S.white, border: `1px solid ${S.border}`, borderRadius: 8, padding: '6px 10px', fontSize: 12, fontFamily: 'Tajawal, sans-serif' }}>
                  <option value="24h">24 ساعة</option>
                  <option value="7d">7 أيام</option>
                  <option value="forever">دائم</option>
                </select>
                <div style={{ fontSize: 10, color: S.amber, marginTop: 6, lineHeight: 1.6 }}>⚠️ عناوين الجوال يشترك فيها عملاء كثيرون وتتغير — الأفضل مؤقتاً. لا تحظر عنوان المطعم.</div>
              </div>
            )}
            <input value={blockReason} onChange={e => setBlockReason(e.target.value)} placeholder="السبب (اختياري)" style={{ width: '100%', background: S.card, border: `1px solid ${S.border}`, borderRadius: 8, padding: '9px 12px', color: S.white, fontSize: 13, fontFamily: 'Tajawal, sans-serif', marginBottom: 14, boxSizing: 'border-box' }} />
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={confirmBlock} disabled={blockSaving} style={{ flex: 1, padding: '10px', borderRadius: 10, border: `1px solid ${S.red}`, background: S.redB, color: S.red, cursor: blockSaving ? 'not-allowed' : 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 800 }}>{blockSaving ? '⏳...' : '🚫 تأكيد الحظر'}</button>
              <button onClick={() => setBlockTarget(null)} style={{ padding: '10px 18px', borderRadius: 10, border: `1px solid ${S.border}`, background: 'transparent', color: S.muted, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif' }}>إلغاء</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
