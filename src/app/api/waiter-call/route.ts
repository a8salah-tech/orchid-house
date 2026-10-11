import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// ✅ نداء النادل من صفحة المنيو العامة: كان الزر يغيّر شكله عند العميل فقط ولا يرسل شيئًا للكاشير إطلاقًا
// (ما كانش فيه أي صف في waiter_calls). الآن يمرّ من هنا بعميل service-role (الزائر مجهول):
//  1) صف في waiter_calls (يلتقطه الكاشير فورًا بالـrealtime + فحص دوري كل 4 ثوانٍ، فيظهر شريط + صوت + إشعار متصفح)
//  2) إشعار في جدول notifications للكاشير ومساعد الكاشير ومدير الكاشير (جرس الإشعارات)، يحمل اسم الطاولة والفرع
//  3) حماية من التكرار: نداء واحد لكل طاولة كل 60 ثانية
const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const NOTIFY_ROLES = ['cashier', 'assistant_cashier', 'cashier_manager']
const THROTTLE_MS = 60 * 1000

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)
    const tableId = typeof body?.tableId === 'string' ? body.tableId : ''
    if (!tableId) return NextResponse.json({ error: 'tableId required' }, { status: 400 })

    const { data: tbl } = await sb.from('tables').select('id, name, number, is_active, branches(name)').eq('id', tableId).maybeSingle()
    if (!tbl || tbl.is_active === false) return NextResponse.json({ error: 'table not found' }, { status: 404 })

    // لا نكرّر نداء نفس الطاولة خلال دقيقة (العميل ضغط أكتر من مرة): نردّ بنجاح من غير إشعار جديد
    const since = new Date(Date.now() - THROTTLE_MS).toISOString()
    const { data: recent } = await sb.from('waiter_calls').select('id').eq('table_id', tableId).gte('created_at', since).limit(1)
    if (recent && recent.length > 0) return NextResponse.json({ ok: true, throttled: true })

    const { error: callErr } = await sb.from('waiter_calls').insert([{ table_id: tableId }])
    if (callErr) return NextResponse.json({ error: callErr.message }, { status: 500 })

    const branchName = (tbl.branches as unknown as { name?: string } | null)?.name || ''
    const tableName = tbl.name || `Table ${tbl.number}`
    // الإشعار اختياري: لو فشل ما نفشلش النداء نفسه (الكاشير هيلتقطه من waiter_calls)
    try {
      await sb.from('notifications').insert(NOTIFY_ROLES.map(role => ({
        type: 'waiter_call', title: '🔔 نداء نادل', body: `${tableName}${branchName ? ' — ' + branchName : ''}`,
        link: '/dashboard/cashier', target_role: role, target_employee_id: null,
      })))
    } catch { /* اختياري */ }

    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'unknown' }, { status: 500 })
  }
}
