import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { getCaller, callerHasPermission } from '../../../lib/apiAuth'

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
// ✅ جديد: أي سجل حضور (مفتوح أو مقفول، بغض النظر مين قفله) مدته أطول من هذا العدد من الساعات
// يُعتبر مشكوكاً فيه ويستحق مراجعة — يرصد حالة الموظف الذي يُغلق شيفته بنفسه متأخراً جداً (24 ساعة مثلاً)،
// وهي حالة كانت تفلت تماماً من الفحص القديم لأن ذلك الفحص كان يعالج السجلات "المفتوحة" فقط
const SUSPICIOUS_DURATION_HOURS = 16
// ✅ علامة نضعها داخل notes بعد رصد سجل مشكوك فيه، لمنع رصده وإنشاء مخالفة له مرة أخرى في كل تشغيلة يومية تالية
const SUSPICIOUS_FLAG_MARKER = '⚠️ تم رصد مدة غير منطقية'

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
    // ✅ حماية (fail-closed): الطلب لازم يكون إما من Vercel Cron (يحمل Bearer CRON_SECRET —
    // تحطّه Vercel تلقائياً لو المتغيّر معرَّف في إعدادات المشروع)، أو من موظف مسجَّل معه صلاحية
    // الموارد البشرية (للتشغيل اليدوي / dryRun). غير كده → 401. لو CRON_SECRET مش معرَّف، الكرون
    // نفسه هيرجع 401 لحد ما يتضاف في Vercel.
    const authHeader = req.headers.get('authorization')
    const cronOk = !!process.env.CRON_SECRET && authHeader === `Bearer ${process.env.CRON_SECRET}`
    if (!cronOk) {
      const caller = await getCaller()
      if (!caller || !(await callerHasPermission(caller, 'hr'))) {
        return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
      }
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

    let processed = 0
    const results: { employee_id: string; date: string; checkout_time: string; proposed_penalty_myr: number }[] = []

    // ✅ Fix حرج: مكانش يخرج مبكراً هنا لو مفيش سجلات مفتوحة — وده كان بيتخطّى فحص "المدة غير المنطقية"
    // للسجلات المقفولة (تحت) تماماً. أي ليلة كل الموظفين مقفلين فيها شيفتاتهم = أي سجل 24 ساعة وهمي
    // ماكانش يترصد أبداً. دلوقتي بنكمّل دايماً للفحص التاني.
    for (const rec of ((openRecords || []) as AttendanceRow[])) {
      const dateStr = String(rec.date).slice(0, 10)
      const shiftEndUtc = await getShiftEndUtc(rec.employee_id, dateStr)
      if (shiftEndUtc === null) continue // لا يوجد شيفت مجدول لهذا اليوم — لا يمكن تحديد وقت الإغلاق التلقائي

      const cutoff = shiftEndUtc + AUTO_CHECKOUT_GRACE_HOURS * 60 * 60 * 1000
      if (now < cutoff) continue // لم يحن بعد وقت الإغلاق التلقائي

      const checkoutIso = new Date(cutoff).toISOString()

      // ✅ جلب راتب الموظف لحساب قيمة خصم الساعتين (نحتاجه في وضع التجربة أيضاً لعرض القيمة المتوقعة)
      const { data: emp } = await supabaseAdmin
        .from('employee_compensation')
        .select('salary')
        .eq('employee_id', rec.employee_id)
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
      // مباشرة، لكي يتمكن الأدمن من تمييز الخروج التلقائي عن الخروج اليدوي بنظرة واحدة
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
      // ✅ نتحقق من نجاح الإدراج فعلياً (violInsertError) قبل ما نبعت أي إشعار — كان الإشعار يترسل دايماً
      // بغض النظر عن نجاح تسجيل المخالفة من عدمه (حتى لو المبلغ صفر أو فشل الإدراج لأي سبب)، فيوصل
      // للموظف إشعار "تم اقتراح خصم" رغم عدم وجود أي مخالفة فعلية في النظام — تناقض مباشر ومربك
      let violationRecorded = false
      if (penaltyAmount > 0) {
        const nowIso = new Date().toISOString()
        const { error: violInsertError } = await supabaseAdmin.from('violations').insert([{
          employee_id: rec.employee_id,
          amount: penaltyAmount,
          reason: `خصم تلقائي من النظام: نسيان تسجيل الخروج بتاريخ ${dateStr} — تم تسجيل الخروج تلقائياً وخُصمت ${PENALTY_HOURS} ساعة. إن كان الموظف يعمل أوفر تايم فعلياً يراجع الإدارة لإلغاء الخصم\nAutomatic system deduction: forgot to check out on ${dateStr} — checkout was recorded automatically and ${PENALTY_HOURS} hours were deducted. If the employee genuinely worked overtime, contact management to cancel it`,
          date: dateStr,
          // ✅ مخالفات النظام تُعتمد وتُخصم مباشرة — إلغاؤها لمدير النظام فقط من صفحة المخالفات
          status: 'active',
          submitted_at: nowIso,
          manager_approved_at: nowIso,
        }])
        violationRecorded = !violInsertError
        if (violInsertError) console.error('violation insert error:', violInsertError.message)
      }

      // 4) إشعار للموظف بالعربي والإنجليزي معاً — يترسل الآن فقط لو المخالفة اتسجّلت فعلاً بنجاح،
      // لضمان تطابق كامل بين ما يُقال للموظف وما هو مسجَّل فعلياً في قاعدة البيانات
      if (violationRecorded) {
        await supabaseAdmin.from('notifications').insert([{
          type: 'auto_checkout',
          title: 'تسجيل خروج تلقائي / Automatic Checkout',
          body:
            `تم نسيان تسجيل الخروج بتاريخ ${dateStr}، فقام النظام بتسجيل الخروج تلقائياً وخصم ${PENALTY_HOURS} ساعة من راتبك. لو كنت تعمل أوفر تايم فعلياً تواصل مع مديرك المباشر فوراً لمراجعة الخصم وإلغائه.\n\n` +
            `You forgot to check out on ${dateStr}, so the system automatically checked you out and deducted ${PENALTY_HOURS} hours from your pay. If you were genuinely working overtime, contact your manager right away to review and cancel the deduction.`,
          target_employee_id: rec.employee_id,
          is_read: false,
        }])
      }

      processed++
      results.push({ employee_id: rec.employee_id, date: dateStr, checkout_time: checkoutIso, proposed_penalty_myr: penaltyAmount })
    }

    // ══════════════════════════════════════════════════════════════════════
    // ✅ فحص منفصل جديد: أي سجل حضور مقفول بالفعل (سواء أغلقه الموظف بنفسه يدوياً، أو الأداة أعلاه) لكن
    // مدته أطول من حد معقول — الفحص القديم فوق كان يعالج السجلات "المفتوحة" فقط، فلو موظف قفل شيفته
    // بنفسه بعد مدة غير منطقية (24 ساعة مثلاً) قبل ما الأداة تشتغل في موعدها اليومي، كان يفلت تماماً بلا أي رصد
    // ══════════════════════════════════════════════════════════════════════
    const suspiciousResults: { employee_id: string; date: string; duration_hours: number; proposed_penalty_myr: number }[] = []
    let suspiciousProcessed = 0

    const { data: closedRecords, error: closedErr } = await supabaseAdmin
      .from('attendance')
      .select('id, employee_id, date, check_in_time, check_out_time, notes')
      .not('check_in_time', 'is', null)
      .not('check_out_time', 'is', null)
      .gte('date', lookbackDate)

    if (!closedErr && closedRecords) {
      for (const rec of closedRecords as (AttendanceRow & { notes: string | null })[]) {
        // ✅ تخطي أي سجل سبق فحصه (العلامة موجودة بالفعل في notes) — يمنع تكرار نفس المخالفة كل يوم
        if (rec.notes && rec.notes.includes(SUSPICIOUS_FLAG_MARKER)) continue
        if (!rec.check_out_time) continue

        const durationHours = (new Date(rec.check_out_time).getTime() - new Date(rec.check_in_time).getTime()) / (60 * 60 * 1000)
        if (durationHours <= SUSPICIOUS_DURATION_HOURS) continue

        const dateStr = String(rec.date).slice(0, 10)

        if (dryRun) {
          suspiciousProcessed++
          suspiciousResults.push({ employee_id: rec.employee_id, date: dateStr, duration_hours: parseFloat(durationHours.toFixed(1)), proposed_penalty_myr: 0 })
          continue
        }

        const { data: emp } = await supabaseAdmin
          .from('employee_compensation')
          .select('salary')
          .eq('employee_id', rec.employee_id)
          .maybeSingle()
        const dailyRate = (emp?.salary || 0) / 30
        const hourlyRate = dailyRate / 8
        const penaltyAmount = parseFloat((hourlyRate * PENALTY_HOURS).toFixed(2))

        // ✅ نضيف العلامة على الملاحظات الحالية (بدون مسح أي ملاحظة سابقة موجودة، مثل علامة الخروج التلقائي)
        const newNotes = rec.notes ? `${rec.notes}\n${SUSPICIOUS_FLAG_MARKER}` : SUSPICIOUS_FLAG_MARKER
        await supabaseAdmin.from('attendance').update({ notes: newNotes }).eq('id', rec.id)

        // ✅ نفس إصلاح الخطوة 3/4 أعلاه: الإشعار يترسل فقط لو المخالفة اتسجّلت فعلاً بنجاح
        let violationRecorded = false
        if (penaltyAmount > 0) {
          const nowIso2 = new Date().toISOString()
          const { error: violInsertError } = await supabaseAdmin.from('violations').insert([{
            employee_id: rec.employee_id,
            amount: penaltyAmount,
            reason: `خصم تلقائي من النظام: سجل حضور بتاريخ ${dateStr} مدته ${durationHours.toFixed(1)} ساعة — مدة غير منطقية لشيفت واحد، وخُصمت ${PENALTY_HOURS} ساعة. إن كان هناك خطأ في التسجيل راجع الإدارة لإلغاء الخصم\nAutomatic system deduction: attendance record on ${dateStr} lasted ${durationHours.toFixed(1)} hours — unreasonable for a single shift, ${PENALTY_HOURS} hours deducted. If this was a recording error, contact management to cancel it`,
            date: dateStr,
            status: 'active',
            submitted_at: nowIso2,
            manager_approved_at: nowIso2,
          }])
          violationRecorded = !violInsertError
          if (violInsertError) console.error('violation insert error:', violInsertError.message)
        }

        if (violationRecorded) {
          await supabaseAdmin.from('notifications').insert([{
            type: 'suspicious_duration',
            title: 'مدة حضور غير منطقية / Unusual Attendance Duration',
            body:
              `سجل حضورك بتاريخ ${dateStr} مدته ${durationHours.toFixed(1)} ساعة، وهذا يُعتبر مدة غير منطقية لشيفت واحد. خُصمت ${PENALTY_HOURS} ساعة من راتبك — لو كان هناك خطأ في التسجيل تواصل مع مديرك المباشر فوراً لمراجعة الخصم وإلغائه.\n\n` +
              `Your attendance record on ${dateStr} lasted ${durationHours.toFixed(1)} hours, which is unreasonable for a single shift. ${PENALTY_HOURS} hours were deducted from your pay — if there was a recording error, contact your manager right away to review and cancel it.`,
            target_employee_id: rec.employee_id,
            is_read: false,
          }])
        }

        suspiciousProcessed++
        suspiciousResults.push({ employee_id: rec.employee_id, date: dateStr, duration_hours: parseFloat(durationHours.toFixed(1)), proposed_penalty_myr: penaltyAmount })
      }
    }

    return NextResponse.json({ dryRun, processed, results, suspiciousProcessed, suspiciousResults })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'خطأ في الخادم' }, { status: 500 })
  }
}
