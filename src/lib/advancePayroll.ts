// خصم سلفة الراتب من كشف الرواتب — منطق مشترك بين الاعتماد الفردي و«اعتماد الكل» في صفحة طلبات الموظفين
import type { SupabaseClient } from '@supabase/supabase-js'

const money = (n: number) => 'MYR ' + n.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// ✅ شهر كشف الرواتب لأي لحظة بتوقيت ماليزيا (لا بساعة جهاز المعتمِد) — السلفة تُضاف لكشف شهر اعتمادها
// (وهو الراتب الذي يُسلَّم يوم 10 من الشهر التالي)، وتُطرح عند الحذف من الكشف نفسه
export function payrollPeriodOf(iso: string) {
  const [year, month] = new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Kuala_Lumpur' }).split('-').map(Number)
  return { year, month }
}

// لو المبلغ المعتمد أقل من المطلوب نضيف سطرًا توضيحيًا في وصف الطلب (يظهر في الاستمارة المطبوعة). يرجع null لو لا تغيير
export function reducedAdvanceDescription(description: string | null | undefined, approvedBy: string, approved: number, requested: number): string | null {
  if (!requested || approved >= requested - 0.001) return null
  if ((description || '').includes('اعتمد ')) return null
  return (description || '') + `\n\n— اعتمد ${approvedBy || 'الإدارة'} مبلغ ${money(approved)} من أصل ${money(requested)} المطلوبة.`
}

// يضيف مبلغ السلفة إلى خانة «سلفة» في راتب الشهر المحدد، وينشئ كشف الشهر أو سجل الموظف إن لم يوجدا.
// يرجع null عند النجاح، وإلا نص الخطأ. (لغير مدير النظام/صاحب صلاحية الرواتب تتكفل قاعدة البيانات بالخصم وتُرفض كتابة المتصفح)
export async function addAdvanceToPayroll(
  supabase: SupabaseClient, employeeId: string, amount: number, period: { year: number; month: number },
): Promise<string | null> {
  // 1) إيجاد شهر الرواتب المطابق، أو إنشاؤه لو لم يكن موجودًا بعد
  const found = await supabase.from('payroll_months')
    .select('id').eq('month', period.month).eq('year', period.year).maybeSingle()
  if (found.error) return found.error.message
  let monthId: string | undefined = found.data?.id
  if (!monthId) {
    const created = await supabase.from('payroll_months')
      .insert([{ month: period.month, year: period.year, status: 'draft' }]).select('id').single()
    if (created.error) return created.error.message
    monthId = created.data?.id
  }
  if (!monthId) return 'تعذّر إنشاء كشف رواتب الشهر'

  // 2) إيجاد سجل راتب الموظف لهذا الشهر، أو إنشاؤه لو لم يكن موجودًا بعد
  const record = await supabase.from('payroll_records')
    .select('id, advance').eq('payroll_month_id', monthId).eq('employee_id', employeeId).maybeSingle()
  if (record.error) return record.error.message

  if (record.data) {
    // ✅ نزيد على القيمة الحالية (لا نستبدلها) لحماية أي سلفة سابقة معتمدة لنفس الشهر
    const total = Math.round(((Number(record.data.advance) || 0) + amount) * 100) / 100
    const updated = await supabase.from('payroll_records').update({ advance: total }).eq('id', record.data.id).select('id')
    if (updated.error) return updated.error.message
    return updated.data && updated.data.length > 0 ? null : 'لم يتغير سجل الراتب (تحقق من صلاحية الرواتب)'
  }

  // ✅ الراتب اتنقل لجدول employee_compensation المقفول (مدير النظام فقط). لتعبئة السجل الجديد
  // نستخدم دالة app_employee_base_pay — مقصورة على مدير النظام أو صاحب صلاحية "الرواتب".
  // لو المعتمِد بلا صلاحية رواتب: basic_salary=0 ويُصلَّح عند توليد الرواتب من صفحة الرواتب.
  const { data: bp } = await supabase.rpc('app_employee_base_pay', { p_emp: employeeId })
  const empData = Array.isArray(bp) ? bp[0] : bp
  const inserted = await supabase.from('payroll_records').insert([{
    payroll_month_id: monthId, employee_id: employeeId,
    basic_salary: empData?.salary || 0, insurance: empData?.insurance || 0,
    working_days: 30, days_worked: 30,
    overtime_days: 0, overtime_hours: 0,
    allowance_1: 0, allowance_1_label: 'Allowance 1',
    allowance_2: 0, allowance_2_label: 'Allowance 2',
    allowance_3: 0, allowance_3_label: 'Allowance 3',
    absence_days: 0, late_hours: 0, early_exit_hours: 0,
    tax: 0,
    deduction_1: 0, deduction_1_label: 'Deduction 1',
    deduction_2: 0, deduction_2_label: 'Deduction 2',
    deduction_3: 0, deduction_3_label: 'Deduction 3',
    advance: amount, advance_balance: 0, carried_forward: 0,
    amount_due: 0, amount_paid: 0,
    work_insurance: empData?.work_insurance || 0,
  }]).select('id')
  if (inserted.error) return inserted.error.message
  return inserted.data && inserted.data.length > 0 ? null : 'لم يُنشأ سجل الراتب (تحقق من صلاحية الرواتب)'
}
