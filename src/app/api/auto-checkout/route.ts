import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// ✅ عدد الساعات التي تُضاف على وقت نهاية الشيفت قبل تفعيل تسجيل الخروج التلقائي
const AUTO_CHECKOUT_GRACE_HOURS = 1
// ✅ عدد الساعات المخصومة من الموظف كعقوبة على نسيان تسجيل الخروج
const PENALTY_HOURS = 2
// ✅ لا نعالج سجلات حضور أقدم من هذا العدد من الأيام (حماية من إعادة المعالجة اللانهائية لسجلات قديمة معلَّقة)
const MAX_LOOKBACK_DAYS = 3

type AttendanceRow = {
  id: string
  employee_id: string
  date: string
  check_in_time: string
  check_out_time: string | null
}

// ✅ يحسب وقت نهاية الشيفت الفعلي (UTC) لموظف معيّن في تاريخ معيّن، مع مراعاة الشيفتات الليلية العابرة لمنتصف الليل
async function getShiftEndUtc(employeeId: string, dateStr: string): Promise<number | null> {
  const { data: sch } = await supabaseAdmin
    .from('shift_schedules')
    .select('custom_start, custom_end, shift_id, shifts(start_time, end_time)')
    .eq('employee_id', employeeId)
    .eq('date', dateStr)
    .eq('status', 'confirmed')
    .maybeSingle()

  if (!sch) return null

  const startStr = sch.custom_start || (sch.shifts as any)?.start_time
  const endStr = sch.custom_end || (sch.shifts as any)?.end_time
  if (!startStr || !endStr) return null

  const [sy, sm, sd] = dateStr.split('-').map(Number)
  const [eh, em] = endStr.slice(0, 5).split(':').map(Number)
  const [sh] = startStr.slice(0, 5).split(':').map(Number)

  // ✅ لو وقت النهاية أصغر من وقت البداية، الشيفت يعبر منتصف الليل وينتهي في اليوم التالي
  const crossesMidnight = eh < sh
  const dayOffset = crossesMidnight ? 1 : 0

  // نفس منطق تحويل التوقيت المحلي (ماليزيا UTC+8) لـ UTC المستخدم في باقي النظام
  return Date.UTC(sy, sm - 1, sd + dayOffset, eh, em, 0) - 8 * 60 * 60 * 1000
}

export async function GET(req: NextRequest) {
  return handleAutoCheckout(req)
}

export async function POST(req: NextRequest) {
  return handleAutoCheckout(req)
}

async function handleAutoCheckout(req: NextRequest) {
  try {
    // ✅ حماية بسيطة: التأكد إن الطلب جاي من Vercel Cron نفسه (موجود تلقائياً في هيدر الطلبات المجدولة)
    const authHeader = req.headers.get('authorization')
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
    }

    // ✅ وضع تجربة آمن تماماً: يوضّح كل حالة كانت ستُعالَج بالضبط (الموظف، التاريخ، وقت الإغلاق المقترح،
    // قيمة الخصم) من غير ما يكتب أي شيء في قاعدة البيانات إطلاقاً — للاختبار قبل أول تشغيل حقيقي
    // الاستخدام: GET /api/auto-checkout?dryRun=true
    const dryRun = req.nextUrl.searchParams.get('dryRun') === 'true'

    const now = Date.now()
    const lookbackDate = new Date(now - MAX_LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

    // ✅ كل سجلات الحضور "المفتوحة" (فيها دخول بلا خروج) في آخر أيام قليلة بس
    const { data: openRecords, error: fetchErr } = await supabaseAdmin
      .from('attendance')
      .select('id, employee_id, date, check_in_time, check_out_time')
      .is('check_out_time', null)
      .not('check_in_time', 'is', null)
      .gte('date', lookbackDate)

    if (fetchErr) {
      return NextResponse.json({ error: fetchErr.message }, { status: 500 })
    }
    if (!openRecords || openRecords.length === 0) {
      return NextResponse.json({ processed: 0, message: 'لا توجد سجلات حضور مفتوحة' })
    }

    let processed = 0
    const results: { employee_id: string; date: string; checkout_time: string; proposed_penalty_myr: number }[] = []

    for (const rec of openRecords as AttendanceRow[]) {
      const dateStr = String(rec.date).slice(0, 10)
      const shiftEndUtc = await getShiftEndUtc(rec.employee_id, dateStr)
      if (shiftEndUtc === null) continue // لا يوجد شيفت مجدول لهذا اليوم — لا يمكن تحديد وقت الإغلاق التلقائي

      const cutoff = shiftEndUtc + AUTO_CHECKOUT_GRACE_HOURS * 60 * 60 * 1000
      if (now < cutoff) continue // لسه ما وصلناش لوقت الإغلاق التلقائي بعد

      const checkoutIso = new Date(cutoff).toISOString()

      // ✅ جلب راتب الموظف لحساب قيمة خصم الساعتين (نحتاجه في وضع التجربة أيضاً لعرض القيمة المتوقعة)
      const { data: emp } = await supabaseAdmin
        .from('employees')
        .select('salary')
        .eq('id', rec.employee_id)
        .maybeSingle()
      const dailyRate = (emp?.salary || 0) / 30
      const hourlyRate = dailyRate / 8
      const penaltyAmount = parseFloat((hourlyRate * PENALTY_HOURS).toFixed(2))

      if (dryRun) {
        // ✅ وضع التجربة: لا كتابة إطلاقاً — فقط نسجّل ماذا كان سيحدث
        processed++
        results.push({ employee_id: rec.employee_id, date: dateStr, checkout_time: checkoutIso, proposed_penalty_myr: penaltyAmount })
        continue
      }

      // 1) تسجيل الخروج التلقائي في وقت (نهاية الشيفت + ساعة السماح)، وليس وقت تشغيل الأداة نفسها
      // ✅ نسجّل ملاحظة واضحة على سجل الحضور نفسه — تظهر في عمود "الملاحظات" بصفحة الحضور والانصراف
      // مباشرة، عشان الأدمن يقدر يميّز الخروج التلقائي عن الخروج اليدوي بنظرة واحدة
      const { error: updErr } = await supabaseAdmin
        .from('attendance')
        .update({
          check_out_time: checkoutIso,
          notes: `⏰ تسجيل خروج تلقائي (نسيان تسجيل الخروج) / Automatic checkout (forgot to check out)`,
        })
        .eq('id', rec.id)
      if (updErr) continue

      // 3) تسجيل الخصم كمخالفة "قيد المراجعة" — لا يُحتسب تلقائياً في الرواتب (الجدول يحسب المخالفات
      // بحالة 'active' فقط). هذا مقصود ومهم جداً: مع وجود أكثر من 200 موظف يعملون فعلياً الآن، أي موظف
      // يعمل أوفر تايم حقيقياً ونسي التطبيق سيُغلَق سجله تلقائياً بأمان، لكن الخصم المالي يبقى معلَّقاً
      // حتى يراجعه أدمن بشري ويوافق عليه يدوياً (بتحويل الحالة إلى 'active') — نفس مبدأ الأمان
      // المُتَّبع في أداة "كشف الغياب": لا خصم مالي تلقائي بالكامل بدون عين بشرية تراجعه أولاً
      if (penaltyAmount > 0) {
        await supabaseAdmin.from('violations').insert([{
          employee_id: rec.employee_id,
          amount: penaltyAmount,
          reason: `خصم مقترح (قيد المراجعة): نسيان تسجيل الخروج بتاريخ ${dateStr} — تم تسجيل الخروج تلقائياً، ويُقترَح خصم ${PENALTY_HOURS} ساعة. راجع السجل قبل الاعتماد فقد يكون الموظف كان يعمل أوفر تايم فعلياً\nProposed deduction (pending review): forgot to check out on ${dateStr} — checkout was recorded automatically, ${PENALTY_HOURS} hours deduction suggested. Please review before approving, the employee may have genuinely worked overtime`,
          date: dateStr,
          status: 'pending',
          submitted_at: new Date().toISOString(),
        }])
      }

      // 4) إشعار للموظف بالعربي والإنجليزي معاً — نوضّح إن الخصم مقترح ولسه محتاج موافقة، وليس نهائياً
      await supabaseAdmin.from('notifications').insert([{
        type: 'auto_checkout',
        title: 'تسجيل خروج تلقائي / Automatic Checkout',
        body:
          `تم نسيان تسجيل الخروج بتاريخ ${dateStr}، فقام النظام بتسجيل الخروج تلقائياً. تم اقتراح خصم ${PENALTY_HOURS} ساعة وهو الآن قيد مراجعة الإدارة — لو كنت تعمل أوفر تايم فعلياً تواصل مع مديرك المباشر فوراً.\n\n` +
          `You forgot to check out on ${dateStr}, so the system automatically checked you out. A ${PENALTY_HOURS}-hour deduction has been proposed and is now pending management review — if you were genuinely working overtime, please contact your manager right away.`,
        target_employee_id: rec.employee_id,
        is_read: false,
      }])

      processed++
      results.push({ employee_id: rec.employee_id, date: dateStr, checkout_time: checkoutIso, proposed_penalty_myr: penaltyAmount })
    }

    return NextResponse.json({ dryRun, processed, results })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'خطأ في الخادم' }, { status: 500 })
  }
}
