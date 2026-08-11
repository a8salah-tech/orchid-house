'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { createBrowserClient } from '@supabase/ssr'
import { useAuth } from '../../../components/AuthProvider'
import { useLang } from '../../../components/LanguageContext'

const createClient = () => createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const S = {
  navy: '#0A1628', navy2: '#0F2040', navy3: '#0C1A32',
  gold: '#C9A84C', gold2: '#E8C97A', gold3: 'rgba(201,168,76,0.12)',
  white: '#FAFAF8', muted: '#8A9BB5', border: 'rgba(255,255,255,0.08)',
  green: '#22C55E', greenB: 'rgba(34,197,94,0.12)',
  red: '#EF4444', redB: 'rgba(239,68,68,0.12)',
  blue: '#3B82F6', blueB: 'rgba(59,130,246,0.12)',
  amber: '#F59E0B', amberB: 'rgba(245,158,11,0.12)',
  teal: '#14B8A6', tealB: 'rgba(20,184,166,0.12)',
  purple: '#8B5CF6', purpleB: 'rgba(139,92,246,0.12)',
  card: 'rgba(255,255,255,0.04)', card2: 'rgba(255,255,255,0.08)',
}

function getDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat/2) ** 2 + Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) * Math.sin(dLng/2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
}

// ✅ كل فروع المطعم بتوقيت ماليزيا دائمًا (UTC+8) — نحسب "تاريخ اليوم" بهذا التوقيت بدقة
// بدل الاعتماد على toISOString() التي تعطي التاريخ بصيغة UTC وتُسبب أخطاء قرب منتصف الليل
function getMalaysiaDateString(d: Date = new Date()): string {
  const malaysiaMs = d.getTime() + 8 * 60 * 60 * 1000
  const malaysiaDate = new Date(malaysiaMs)
  return malaysiaDate.toISOString().split('T')[0]
}

function formatTime(iso?: string) {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })
}

function workDuration(checkIn?: string, checkOut?: string) {
  if (!checkIn) return null
  const end = checkOut ? new Date(checkOut) : new Date()
  const mins = Math.floor((end.getTime() - new Date(checkIn).getTime()) / 60000)
  if (mins < 0) return null
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${h}h ${m}m`
}

type Branch = { id: string; name: string; latitude?: number; longitude?: number; radius_meters?: number }
type AttendanceRecord = {
  id?: string; employee_id: string; date: string
  check_in_time?: string; check_in_lat?: number; check_in_lng?: number; check_in_distance?: number
  check_out_time?: string; check_out_lat?: number; check_out_lng?: number; check_out_distance?: number
  status?: string; is_manual?: boolean; notes?: string; branch_id?: string
}
type Employee = {
  id: string; name: string; name_en?: string; employee_number?: string
  role: string; department?: string; branch_id?: string; salary?: number
  branches?: { name: string } | any
}

// ══════════════════════════════════════════
// Employee Card
// ══════════════════════════════════════════
function MyAttendanceCard() {
  const { isAr } = useLang()
  const { employee } = useAuth()
  const sbRef = useRef(createClient())
  const sb    = sbRef.current

  const [branches,  setBranches]  = useState<Branch[]>([])
  const [today,     setToday]     = useState<AttendanceRecord | null>(null)
  const [loading,   setLoading]   = useState(true)
  const [checking,  setChecking]  = useState(false)
  const [distance,  setDistance]  = useState<number | null>(null)
  const [locError,  setLocError]  = useState('')
  const [history,   setHistory]   = useState<AttendanceRecord[]>([])
  const [clock,     setClock]     = useState(new Date())
  const [hasShiftToday, setHasShiftToday] = useState(true) // افتراضي true لحد ما نتأكد، لكي مانوقفش الزرار بالغلط وقت التحميل
  // ✅ نافذة تأكيد "خروج سريع جداً" — تظهر في منتصف الشاشة بدل نافذة المتصفح الافتراضية (confirm)
  const [shortShiftModal, setShortShiftModal] = useState<{ minutes: number; openRecordId: string; lat: number; lng: number; dist: number } | null>(null)
  const [justCheckedIn, setJustCheckedIn] = useState(false) // فترة تأخير قصيرة بعد نجاح Check In لمنع ضغطة متتالية سريعة على نفس مكان الزر

  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  const fetchData = useCallback(async () => {
    if (!employee?.id) return
    setLoading(true)
    const today_date = getMalaysiaDateString()
    const yesterday_date = getMalaysiaDateString(new Date(Date.now() - 86400000))
    const [brs, openAtt, todayAtt, hist, schToday, schYesterday] = await Promise.all([
      sb.from('branches').select('id,name,latitude,longitude,radius_meters').eq('is_active', true),
      // أولاً: هل يوجد شيفت مفتوح (دخول بدون خروج) من اليوم أو من يوم سابق (شيفت ليلي عابر لمنتصف الليل)؟
      sb.from('attendance').select('*').eq('employee_id', employee.id)
        .not('check_in_time', 'is', null).is('check_out_time', null)
        .order('date', { ascending: false }).limit(1).maybeSingle(),
      // ✅ ممكن يكون فيه أكتر من صف لنفس اليوم دلوقتي (شيفت ليلي + شيفت جديد لنفس اليوم)، فلازم .order()+.limit(1)
      // قبل .maybeSingle() — وإلا الاستعلام يطلع خطأ فوري بمجرد ما يوجد أكتر من صف واحد لنفس التاريخ
      sb.from('attendance').select('*').eq('employee_id', employee.id).eq('date', today_date).order('check_in_time', { ascending: false }).limit(1).maybeSingle(),
      sb.from('attendance').select('*').eq('employee_id', employee.id).order('date', { ascending: false }).limit(14),
      sb.from('shift_schedules').select('id, shifts(start_time,end_time), custom_start, custom_end').eq('employee_id', employee.id).eq('date', today_date).maybeSingle(),
      sb.from('shift_schedules').select('id, shifts(start_time,end_time), custom_start, custom_end').eq('employee_id', employee.id).eq('date', yesterday_date).maybeSingle(),
    ])
    setBranches(brs.data || [])

    // ✅ لو صف اليوم مكتمل (دخول وخروج) لكن يوجد شيفت جديد لليوم نفسه يبدأ بعد وقت هذا الخروج (شيفت مسائي/ليلي
    // بعد ما الموظف خلّص تكملة شيفت الليلة اللي قبلها صبح النهاردة)، لازم نعتبره "لسه ما سجّلش دخول" لشيفته
    // الجديد — وإلا الصفحة تقفل بـ"Attendance Complete" وتمنعه يسجّل دخول لشيفت لسه ما بدأش خالص
    let effectiveTodayRecord = openAtt.data || todayAtt.data
    if (!openAtt.data && todayAtt.data?.check_in_time && todayAtt.data?.check_out_time && schToday.data) {
      const startStr = schToday.data.custom_start || (schToday.data as any).shifts?.start_time
      if (startStr) {
        const [sh, sm] = startStr.split(':').map(Number)
        const shiftStartToday = new Date(); shiftStartToday.setHours(sh, sm || 0, 0, 0)
        const checkoutTime = new Date(todayAtt.data.check_out_time)
        if (shiftStartToday.getTime() > checkoutTime.getTime()) {
          effectiveTodayRecord = null
        }
      }
    }
    // لو يوجد شيفت مفتوح (من اليوم أو من يوم سابق)، اعرضه كالحالة الحالية. غير ذلك اعرض صف اليوم (سواء فاضي أو مكتمل)
    setToday(effectiveTodayRecord)
    setHistory(hist.data || [])

    // فحص وجود شيفت مجدول فعليًا (اليوم، أو شيفت أمس الممتد لما بعد منتصف الليل ولا يزال في وقته)
    let shiftExists = !!schToday.data
    if (schYesterday.data) {
      const endStr = schYesterday.data.custom_end || (schYesterday.data as any).shifts?.end_time
      const startStr = schYesterday.data.custom_start || (schYesterday.data as any).shifts?.start_time
      if (endStr && startStr) {
        const [sh] = startStr.split(':').map(Number)
        const [eh, em] = endStr.split(':').map(Number)
        const crossesMidnight = (eh * 60 + (em||0)) <= (sh * 60)
        if (crossesMidnight) {
          const now = new Date()
          const endToday = new Date(); endToday.setHours(eh, em || 0, 0, 0)
          // ✅ نفس تصحيح الاعتماد على الوقت الفعلي بس، بغض النظر عن وجود شيفت اليوم من عدمه
          if (now.getTime() < endToday.getTime()) shiftExists = true
        }
      }
    }
    // لو يوجد شيفت مفتوح من قبل (الموظف فعلاً شغال)، ما نمنعه من حقه يسجل خروج بغض النظر عن جدول اليوم
    setHasShiftToday(shiftExists || !!openAtt.data)
    setLoading(false)
  }, [employee?.id, sb])

  useEffect(() => { fetchData() }, [fetchData])

  // الفرع المحدد للموظف
  const myBranch = branches.find(b => b.id === employee?.branch_id) || branches[0] || null

  function getLocation(): Promise<GeolocationPosition> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) { reject(new Error('Geolocation not supported')); return }
      navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000 })
    })
  }

  async function updateLocation() {
    setLocError('')
    try {
      const pos = await getLocation()
      const lat = pos.coords.latitude
      const lng = pos.coords.longitude
      if (myBranch?.latitude && myBranch?.longitude) {
        const dist = getDistance(lat, lng, myBranch.latitude, myBranch.longitude)
        setDistance(Math.round(dist))
      }
    } catch {
      setLocError('Could not get location. Please allow location access.')
    }
  }

  async function checkIn() {
    if (!employee?.id || !myBranch) return
    setChecking(true); setLocError('')
    try {
      const pos  = await getLocation()
      const lat  = pos.coords.latitude
      const lng  = pos.coords.longitude
      const dist = myBranch.latitude && myBranch.longitude
        ? getDistance(lat, lng, myBranch.latitude, myBranch.longitude) : 0
      const radius = myBranch.radius_meters || 150

      if (dist > radius) {
        setLocError(`You are ${Math.round(dist)}m from the branch. Must be within ${radius}m to check in.`)
        setChecking(false); return
      }

      // ✅ Fix v2: منع تسجيل دخول جديد لو بعد يوجد شيفت مفتوح (لم يسجل خروج منه)
      const { data: stillOpen } = await sb.from('attendance')
        .select('id, date')
        .eq('employee_id', employee.id)
        .not('check_in_time', 'is', null)
        .is('check_out_time', null)
        .order('date', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (stillOpen) {
        setLocError('You already have an open check-in. Please check out first before checking in again.')
        setChecking(false); return
      }

      const today_date = getMalaysiaDateString()
      const yesterday_date = getMalaysiaDateString(new Date(Date.now() - 86400000))
      const now        = new Date().toISOString()
      // حساب التأخير بناءً على جدول الشيفت
      const now_time = new Date()
      let shiftStart = null
      // نجلب شيفت الموظف من قاعدة البيانات — اليوم الحالي أو الأمس (لو شيفت ليلي عابر لمنتصف الليل ولا يزال في وقته)
      const { data: schToday } = await sb.from('shift_schedules')
        .select('*, shifts(start_time,end_time), custom_start, custom_end')
        .eq('employee_id', employee.id)
        .eq('date', today_date)
        .maybeSingle()
      const { data: schYesterday } = await sb.from('shift_schedules')
        .select('*, shifts(start_time,end_time), custom_start, custom_end')
        .eq('employee_id', employee.id)
        .eq('date', yesterday_date)
        .maybeSingle()

      let schData = schToday
      // لو يوجد شيفت أمس يتجاوز منتصف الليل (end_time < start_time) ولا يزال الوقت الحالي قبل وقت انتهائه، يُعتبر هو الشيفت الفعلي الحالي
      if (schYesterday) {
        const endStr = schYesterday.custom_end || schYesterday.shifts?.end_time
        const startStr = schYesterday.custom_start || schYesterday.shifts?.start_time
        if (endStr && startStr) {
          const [sh] = startStr.split(':').map(Number)
          const [eh, em] = endStr.split(':').map(Number)
          const crossesMidnight = (eh * 60 + (em||0)) <= (sh * 60)
          if (crossesMidnight) {
            const endToday = new Date(); endToday.setHours(eh, em || 0, 0, 0)
            // ✅ الاعتماد على الوقت الفعلي فقط (هل لا زلنا داخل نطاق شيفت أمس الممتد لما بعد منتصف الليل)،
            // وليس على وجود/عدم وجود شيفت مجدول لليوم — الجدولة الشهرية المسبقة تجعل "شيفت اليوم" موجوداً
            // دائماً تقريباً، فكان شرط "!schToday" يمنع استخدام شيفت أمس أبداً، ويُحتسب أي دخول بعد منتصف
            // الليل خطأً كأنه بداية شيفت اليوم الجديد (الذي لم يبدأ فعلياً بعد)، ويُسجَّل بتاريخ خاطئ
            if (now_time.getTime() < endToday.getTime()) {
              schData = schYesterday
            }
          }
        }
      }

      if (schData) {
        const startStr = schData.custom_start || schData.shifts?.start_time
        if (startStr) {
          const [h, m] = startStr.split(':').map(Number)
          shiftStart = new Date()
          // لو استخدمنا شيفت الأمس، وقت البداية يكون أمس فعليًا
          if (schData === schYesterday) shiftStart.setDate(shiftStart.getDate() - 1)
          shiftStart.setHours(h, m, 0, 0)
        }
      }
      // لو لا توجد شيفت، نستخدم 9 صباحاً كـ default
      if (!shiftStart) { shiftStart = new Date(); shiftStart.setHours(9, 0, 0, 0) }
      const diffMins = Math.floor((now_time.getTime() - shiftStart.getTime()) / 60000)
      // grace period 10 دقيقة — لو أتأخر أكتر من 10 دقائق يحتسب متأخر
      const status = diffMins > 10 ? 'late' : 'present'
      const late_minutes = status === 'late' ? diffMins : 0
      // لو استخدمنا شيفت الأمس، صف الحضور يُسجَّل بتاريخ الأمس (نفس منطق تسجيل الشيفتات الليلية في الجدول)
      const attendance_date = (schData === schYesterday) ? yesterday_date : today_date

      // ✅ نتحقق هل يوجد صف حضور مكتمل بالفعل (دخول وخروج) لنفس التاريخ — لو موجود، لازم نضيف صفاً جديداً
      // منفصلاً (شيفت ثانٍ لنفس اليوم التقويمي، شائع مع الشيفتات الليلية)، وليس نُحدِّث الصف المكتمل القديم،
      // وإلا يتحدَّث وقت الدخول فقط ويبقى وقت الخروج القديم كما هو (فيصبح دخول الساعة 6 المغرب مثلاً
      // مقروناً بخروج الساعة 5 الصبح قبله في نفس الصف، وهذا فساد فعلي للبيانات)
      const { data: existingRow } = await sb.from('attendance')
        .select('id, check_in_time, check_out_time')
        .eq('employee_id', employee.id)
        .eq('date', attendance_date)
        // ✅ نفس الحماية — ممكن يكون فيه أكتر من صف لنفس اليوم دلوقتي، فنختار الأحدث بدل خطأ maybeSingle()
        .order('check_in_time', { ascending: false })
        .limit(1)
        .maybeSingle()

      let error
      if (existingRow && existingRow.check_in_time && existingRow.check_out_time) {
        // الصف الموجود مكتمل بالفعل (شيفت سابق انتهى) — أضف صفاً جديداً منفصلاً لشيفت اليوم الثاني
        const res = await sb.from('attendance').insert({
          employee_id: employee.id,
          date: attendance_date,
          check_in_time: now,
          check_in_lat: lat,
          check_in_lng: lng,
          check_in_distance: Math.round(dist),
          status,
          late_minutes: late_minutes || 0,
          branch_id: myBranch.id,
        })
        error = res.error
      } else {
        // لا يوجد صف بعد، أو يوجد صف مفتوح لنفس هذا الشيفت تحديداً — حدّثه بدل إضافة صف جديد
        const res = await sb.from('attendance').upsert({
          id: existingRow?.id,
          employee_id: employee.id,
          date: attendance_date,
          check_in_time: now,
          check_in_lat: lat,
          check_in_lng: lng,
          check_in_distance: Math.round(dist),
          status,
          late_minutes: late_minutes || 0,
          branch_id: myBranch.id,
        }, existingRow ? { onConflict: 'id' } : undefined)
        error = res.error
      }

      if (error) { setLocError('Error: ' + error.message); setChecking(false); return }
      setDistance(Math.round(dist))
      await fetchData()
      // ✅ تأخير قصير قبل إظهار زر Check Out في نفس مكان الزر، لمنع ضغطة متتالية سريعة غير مقصودة
      setJustCheckedIn(true)
      setTimeout(() => setJustCheckedIn(false), 60000)
    } catch (e: any) { setLocError('Location error: ' + e.message) }
    setChecking(false)
  }

  async function checkOut() {
    if (!employee?.id) return
    setChecking(true); setLocError('')
    try {
      const pos  = await getLocation()
      const lat  = pos.coords.latitude
      const lng  = pos.coords.longitude
      const dist = myBranch?.latitude && myBranch?.longitude
        ? getDistance(lat, lng, myBranch.latitude, myBranch.longitude) : 0

      const radius = myBranch?.radius_meters || 150
      if (dist > radius) {
        setLocError(`You are ${Math.round(dist)}m from the branch. Must be within ${radius}m to check out.`)
        setChecking(false); return
      }

      // ✅ Fix v2: البحث عن آخر صف حضور "مفتوح" (يوجد check_in بدون check_out)
      // بدل الاعتماد على تاريخ اليوم الحالي — ضروري للشيفتات التي تعبر منتصف الليل
      const { data: openRecord, error: findError } = await sb.from('attendance')
        .select('id, date, check_in_time')
        .eq('employee_id', employee.id)
        .not('check_in_time', 'is', null)
        .is('check_out_time', null)
        .order('date', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (findError) { setLocError('Error: ' + findError.message); setChecking(false); return }
      if (!openRecord) {
        setLocError('No open check-in found. Please check in first.')
        setChecking(false); return
      }

      // ✅ حماية من إساءة الاستخدام: تسجيل دخول ثم خروج فوري بعد ثوانٍ/دقائق قليلة (بدون عمل فعلي)،
      // ثم الادّعاء لاحقاً بوجود عطل تقني. لا نمنع الخروج نهائياً (قد تكون حالة طارئة حقيقية)،
      // لكن نعرض نافذة تحذير واضحة في منتصف الشاشة (بدل نافذة المتصفح) ونطلب تأكيداً صريحاً
      const MIN_SHIFT_MINUTES = 60
      const minutesSinceCheckIn = openRecord.check_in_time
        ? Math.floor((Date.now() - new Date(openRecord.check_in_time).getTime()) / 60000)
        : null
      if (minutesSinceCheckIn !== null && minutesSinceCheckIn < MIN_SHIFT_MINUTES) {
        // نوقف هنا وننتظر تأكيد الموظف من النافذة المنبثقة — التنفيذ الفعلي في finalizeCheckOut()
        setShortShiftModal({ minutes: minutesSinceCheckIn, openRecordId: openRecord.id, lat, lng, dist })
        setChecking(false)
        return
      }

      await finalizeCheckOut(openRecord.id, lat, lng, dist, null)
    } catch (e: any) { setLocError('Location error: ' + e.message) }
    setChecking(false)
  }

  // ✅ التنفيذ الفعلي لتسجيل الخروج — منفصل عن checkOut() لأنه يُستدعى إما مباشرة (خروج طبيعي)
  // أو بعد تأكيد الموظف من نافذة "خروج سريع جداً" المنبثقة
  async function finalizeCheckOut(openRecordId: string, lat: number, lng: number, dist: number, shortShiftNote: string | null) {
    const { error } = await sb.from('attendance')
      .update({
        check_out_time:     new Date().toISOString(),
        check_out_lat:      lat,
        check_out_lng:      lng,
        check_out_distance: Math.round(dist),
        updated_at:         new Date().toISOString(),
        ...(shortShiftNote ? { notes: shortShiftNote } : {}),
      })
      .eq('id', openRecordId)

    if (error) { setLocError('Error: ' + error.message); setChecking(false); return }
    setDistance(Math.round(dist))
    await fetchData()
    setChecking(false)
  }

  // ✅ يُستدعى عند تأكيد الموظف صراحةً من نافذة "خروج سريع جداً" — يسجّل الخروج، ويرفع مخالفة
  // "بانتظار الاعتماد" (submitted) للمراجعة، بنفس منطق ومصطلحات صفحة إدارة المخالفات الحالية
  async function confirmShortShiftCheckOut() {
    if (!shortShiftModal || !employee?.id) return
    setChecking(true)
    const { minutes, openRecordId, lat, lng, dist } = shortShiftModal
    const note = `⚠️ خروج سريع جداً (${minutes} دقيقة فقط بعد الدخول) — يحتاج مراجعة الإدارة / Very short shift (only ${minutes} min after check-in) — needs management review`
    await finalizeCheckOut(openRecordId, lat, lng, dist, note)
    // ✅ رفع مخالفة مقترحة بحالة "submitted" (بانتظار الاعتماد) — لا تُخصم تلقائياً من الراتب
    // إلا بعد موافقة أدمن أو مدير فرع صريحة من صفحة إدارة المخالفات، نفس مبدأ الأمان المتّبع
    // في كل أدوات الخصم التلقائي الأخرى في هذا النظام
    await sb.from('violations').insert([{
      employee_id: employee.id,
      amount: 100,
      reason: `مؤشر تلاعب محتمل بنظام الحضور: تسجيل خروج بعد ${minutes} دقيقة فقط من الدخول — خصم مقترح 100 MYR، بانتظار مراجعة الإدارة\nPotential attendance system abuse: checked out only ${minutes} minute(s) after checking in — proposed 100 MYR deduction, pending management review`,
      date: new Date().toISOString().slice(0, 10),
      status: 'submitted',
      submitted_at: new Date().toISOString(),
    }])
    setShortShiftModal(null)
  }

  const isInRange = distance !== null && myBranch?.radius_meters ? distance <= myBranch.radius_meters : null

  if (loading) return <div style={{ textAlign: 'center', padding: 60, color: S.muted }}>⏳ Loading...</div>

  return (
    <>
    <div style={{ maxWidth: 500, margin: '0 auto' }}>
      {/* Clock */}
      <div style={{ background: S.navy2, borderRadius: 20, border: `1px solid ${S.border}`, padding: '24px', marginBottom: 16, textAlign: 'center' }}>
        <div style={{ fontSize: 42, fontWeight: 900, color: S.gold, fontVariantNumeric: 'tabular-nums', letterSpacing: 2 }}>
          {clock.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </div>
        <div style={{ fontSize: 14, color: S.muted, marginTop: 4 }}>
          {clock.toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </div>
        {myBranch && <div style={{ fontSize: 12, color: S.blue, marginTop: 6 }}>🏪 {myBranch.name}</div>}
      </div>

      {/* Status Card */}
      <div style={{ background: S.navy2, borderRadius: 20, border: `1px solid ${S.border}`, padding: 24, marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: S.muted, marginBottom: 16 }}>📋 Today's Attendance</div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
          {/* Check In */}
          <div style={{ background: today?.check_in_time ? S.greenB : S.card, borderRadius: 12, padding: '14px 16px', border: `1px solid ${today?.check_in_time ? S.green + '40' : S.border}` }}>
            <div style={{ fontSize: 11, color: S.muted, marginBottom: 4 }}>🟢 Check In</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: today?.check_in_time ? S.green : S.muted }}>
              {formatTime(today?.check_in_time)}
            </div>
            {today?.check_in_distance !== undefined && today?.check_in_distance !== null && (
              <div style={{ fontSize: 11, color: S.muted, marginTop: 4 }}>
                📍 {today.check_in_distance}m from branch
              </div>
            )}
          </div>
          {/* Check Out */}
          <div style={{ background: today?.check_out_time ? S.blueB : S.card, borderRadius: 12, padding: '14px 16px', border: `1px solid ${today?.check_out_time ? S.blue + '40' : S.border}` }}>
            <div style={{ fontSize: 11, color: S.muted, marginBottom: 4 }}>🔴 Check Out</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: today?.check_out_time ? S.blue : S.muted }}>
              {formatTime(today?.check_out_time)}
            </div>
            {today?.check_out_distance !== undefined && today?.check_out_distance !== null && (
              <div style={{ fontSize: 11, color: S.muted, marginTop: 4 }}>
                📍 {today.check_out_distance}m from branch
              </div>
            )}
          </div>
        </div>

        {today?.check_in_time && (
          <div style={{ background: S.gold3, borderRadius: 10, padding: '10px 14px', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: S.muted }}>⏱ Duration</span>
            <span style={{ fontSize: 14, fontWeight: 800, color: S.gold }}>
              {workDuration(today.check_in_time, today.check_out_time)}
            </span>
          </div>
        )}

        {/* Location Check */}
        <div style={{ marginBottom: 16 }}>
          <button onClick={updateLocation}
            style={{ width: '100%', padding: '10px', borderRadius: 10, border: `1px solid ${S.muted}`, background: S.card, color: S.muted, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', marginBottom: 8 }}>
            📍 Check My Location
          </button>
          {distance !== null && (
            <div style={{ background: isInRange ? S.greenB : S.redB, borderRadius: 10, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: isInRange ? S.green : S.red, fontWeight: 700 }}>
                {isInRange ? '✅ You are in range' : '❌ You are out of range'}
              </span>
              <span style={{ fontSize: 16, fontWeight: 900, color: isInRange ? S.green : S.red }}>{distance}m</span>
            </div>
          )}
          {locError && (
            <div style={{ background: S.redB, borderRadius: 10, padding: '10px 14px', marginTop: 8, fontSize: 12, color: S.red }}>
              ⚠️ {locError}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        {!hasShiftToday && (
          <div style={{ background: S.amberB, borderRadius: 14, padding: '14px 16px', border: `2px solid ${S.amber}`, textAlign: 'center', marginBottom: 14 }}>
            <div style={{ fontSize: 24, marginBottom: 6 }}>⚠️</div>
            <div style={{ fontSize: 14, color: S.amber, fontWeight: 800, marginBottom: 6 }}>
              لا يوجد لديك شيفت مجدول اليوم — راجع مدير القسم (هام)
            </div>
            <div style={{ fontSize: 11, color: S.muted, marginBottom: 4 }}>
              يمكنك تسجيل الدخول والخروج بشكل طبيعي، لكن هذا اليوم لن يُحتسب ضمن ساعات عملك المجدولة إلى أن يُنشئ لك مديرك شيفتاً. يرجى التواصل معه في أقرب وقت
            </div>
            <div style={{ fontSize: 10, color: S.muted, fontStyle: 'italic', borderTop: `1px solid ${S.border}`, paddingTop: 6, marginTop: 6 }}>
              You have no shift scheduled today — this is important, please contact your department manager.<br/>You can still check in/out normally, but today will not count toward your scheduled hours until a shift is created for you.
            </div>
          </div>
        )}
        {!today?.check_in_time ? (
          <button onClick={checkIn} disabled={checking}
            style={{ width: '100%', padding: '16px', borderRadius: 14, border: 'none', background: `linear-gradient(135deg, ${S.green}, #16A34A)`, color: S.white, cursor: checking ? 'not-allowed' : 'pointer', fontSize: 16, fontFamily: 'Tajawal, sans-serif', fontWeight: 800, opacity: checking ? 0.7 : 1, boxShadow: '0 4px 20px rgba(34,197,94,0.3)' }}>
            {checking ? '⏳ Getting location...' : '✅ Check In'}
          </button>
        ) : justCheckedIn ? (
          <div style={{ width: '100%', padding: '16px', borderRadius: 14, background: S.greenB, border: `1px solid ${S.green}40`, textAlign: 'center' }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: S.green }}>✅ Checked In Successfully</div>
            <div style={{ fontSize: 12, color: S.muted, marginTop: 4 }}>Check Out button will appear shortly...</div>
          </div>
        ) : !today?.check_out_time ? (
          <button onClick={checkOut} disabled={checking}
            style={{ width: '100%', padding: '16px', borderRadius: 14, border: 'none', background: `linear-gradient(135deg, ${S.red}, #DC2626)`, color: S.white, cursor: checking ? 'not-allowed' : 'pointer', fontSize: 16, fontFamily: 'Tajawal, sans-serif', fontWeight: 800, opacity: checking ? 0.7 : 1, boxShadow: '0 4px 20px rgba(239,68,68,0.3)' }}>
            {checking ? '⏳ Getting location...' : '🔴 Check Out'}
          </button>
        ) : (
          <div style={{ background: S.greenB, borderRadius: 12, padding: '14px', textAlign: 'center', border: `1px solid ${S.green}40` }}>
            <div style={{ fontSize: 14, color: S.green, fontWeight: 700 }}>✅ Attendance Complete</div>
            <div style={{ fontSize: 12, color: S.muted, marginTop: 4 }}>See you tomorrow!</div>
          </div>
        )}
      </div>

      {/* History */}
      {history.length > 0 && (
        <div style={{ background: S.navy2, borderRadius: 16, border: `1px solid ${S.border}`, overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: `1px solid ${S.border}`, fontSize: 13, fontWeight: 700, color: S.white }}>📋 Recent Attendance</div>
          {history.map((h, i) => {
            const dur = workDuration(h.check_in_time, h.check_out_time)
            return (
              <div key={h.id || i} style={{ padding: '12px 18px', borderBottom: i < history.length - 1 ? `1px solid ${S.border}` : 'none' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: S.white }}>{formatDate(h.date)}</div>
                    <div style={{ fontSize: 11, color: S.muted, marginTop: 2 }}>
                      {h.check_in_time ? `In: ${formatTime(h.check_in_time)}` : 'No check-in'}
                      {h.check_out_time ? ` · Out: ${formatTime(h.check_out_time)}` : ''}
                      {dur ? ` · ${dur}` : ''}
                    </div>
                    <div style={{ fontSize: 10, color: S.muted, marginTop: 2, display: 'flex', gap: 10 }}>
                      {h.check_in_distance != null && <span>📍 In: {h.check_in_distance}m</span>}
                      {h.check_out_distance != null && <span>📍 Out: {h.check_out_distance}m</span>}
                    </div>
                  </div>
                  <span style={{ background: h.status === 'present' ? S.greenB : h.status === 'late' ? S.amberB : S.redB, color: h.status === 'present' ? S.green : h.status === 'late' ? S.amber : S.red, borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                    {h.status || 'present'}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>

    {/* ✅ نافذة تأكيد "خروج سريع جداً" — في منتصف الشاشة، بالعربي والإنجليزي معاً */}
    {shortShiftModal && typeof document !== 'undefined' && createPortal(
      <div
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 20 }}
        onClick={() => { setShortShiftModal(null); setChecking(false) }}
      >
        <div
          onClick={e => e.stopPropagation()}
          style={{ background: S.navy2, border: `2px solid ${S.red}`, borderRadius: 16, padding: 24, maxWidth: 440, width: '100%', textAlign: 'center', boxShadow: '0 10px 40px rgba(0,0,0,0.5)' }}
        >
          <div style={{ fontSize: 36, marginBottom: 10 }}>⚠️</div>
          <div style={{ fontSize: 16, fontWeight: 900, color: S.red, marginBottom: 12 }}>
            تنبيه: مؤشر تلاعب محتمل بنظام الحضور
          </div>
          <div style={{ fontSize: 13, color: S.white, lineHeight: 1.9, marginBottom: 14 }}>
            سجّلت دخولك منذ <b style={{ color: S.amber }}>{shortShiftModal.minutes} دقيقة</b> فقط. تسجيل الدخول والخروج خلال فترة قصيرة جداً بدون عمل فعلي يُعتبر مؤشر تلاعب بنظام الحضور. في حال تأكيد التلاعب من الإدارة، <b style={{ color: S.red }}>سيتم خصم 100 رينجت ماليزي (MYR 100) من راتبك</b>.
          </div>
          <div style={{ borderTop: `1px solid ${S.border}`, margin: '14px 0' }} />
          <div style={{ fontSize: 12, color: S.muted, lineHeight: 1.8, marginBottom: 16, fontStyle: 'italic' }}>
            Warning: Potential attendance system abuse detected.<br />
            You checked in only <b style={{ color: S.amber }}>{shortShiftModal.minutes} minute(s)</b> ago. Checking in and out within such a short period without actual work is considered a sign of tampering with the attendance system. If confirmed by management, <b style={{ color: S.red }}>MYR 100 will be deducted from your salary</b>.
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <button
              onClick={confirmShortShiftCheckOut}
              disabled={checking}
              style={{ padding: '10px 22px', borderRadius: 10, border: `1px solid ${S.red}`, background: S.redB, color: S.red, cursor: checking ? 'default' : 'pointer', fontWeight: 800, fontFamily: 'inherit', fontSize: 13, opacity: checking ? 0.6 : 1 }}
            >{checking ? '⏳...' : 'تأكيد الخروج / Confirm Checkout'}</button>
            <button
              onClick={() => { setShortShiftModal(null); setChecking(false) }}
              disabled={checking}
              style={{ padding: '10px 22px', borderRadius: 10, border: `1px solid ${S.border}`, background: 'transparent', color: S.muted, cursor: checking ? 'default' : 'pointer', fontWeight: 700, fontFamily: 'inherit', fontSize: 13 }}
            >إلغاء / Cancel</button>
          </div>
        </div>
      </div>,
      document.body
    )}
    </>
  )
}

// ══════════════════════════════════════════
// Admin View
// ══════════════════════════════════════════
function AdminAttendanceView({ empInfo }: { empInfo: any }) {
  const { isAr } = useLang()
  const sbRef = useRef(createClient())
  const sb    = sbRef.current

  const [date,         setDate]         = useState(getMalaysiaDateString())
  const [records,      setRecords]      = useState<any[]>([])
  const [employees,    setEmployees]    = useState<Employee[]>([])
  const [branches,     setBranches]     = useState<Branch[]>([])
  const [loading,      setLoading]      = useState(true)
  const [saving,       setSaving]       = useState(false)
  const [filterBranch, setFilterBranch] = useState(() => empInfo?.branch_id || 'all')
  const [tab,          setTab]          = useState<'day' | 'report' | 'absence' | 'health'>('day')
  const [reportEmp,    setReportEmp]    = useState('')
  const [reportMonth,  setReportMonth]  = useState(new Date().toISOString().slice(0, 7))
  const [reportData,   setReportData]   = useState<any[]>([])
  const [loadingReport, setLoadingReport] = useState(false)
  // ✅ أداة إعادة حساب التأخير بأثر رجعي لشهر كامل (لتصحيح سجلات قديمة مثل شهر يوليو)
  const [recalcMonth, setRecalcMonth] = useState(new Date().toISOString().slice(0, 7))
  const [recalculating, setRecalculating] = useState(false)
  const [recalcProgress, setRecalcProgress] = useState<{ done: number; total: number } | null>(null)
  // ✅ كشف الغياب التلقائي: مقارنة الشيفتات المجدولة (shift_schedules) بسجلات الحضور الفعلية (attendance)
  const [absenceMonth, setAbsenceMonth] = useState(new Date().toISOString().slice(0, 7))
  const [detectingAbsence, setDetectingAbsence] = useState(false)
  const [missingRows, setMissingRows] = useState<{ employee_id: string; date: string; empName: string; empNumber: string; isActive: boolean; shiftLabel: string }[]>([])
  const [hideInactiveEmps, setHideInactiveEmps] = useState(true)
  const [absenceSearch, setAbsenceSearch] = useState('')
  // ✅ فحص صحة الحضور: تقسيم الموظفين لـ3 مجموعات حسب نمط تسجيل الدخول (Admin only)
  const [healthMonth, setHealthMonth] = useState(new Date().toISOString().slice(0, 7))
  const [checkingHealth, setCheckingHealth] = useState(false)
  const [hasRunHealth, setHasRunHealth] = useState(false)
  const [healthRows, setHealthRows] = useState<{ employee_id: string; name: string; employee_number: string; department: string; is_active: boolean; scheduledDays: number; attendedDays: number; missingDays: number; lastCheckin: string | null }[]>([])
  const [healthHideInactive, setHealthHideInactive] = useState(true)
  const [healthEndDate, setHealthEndDate] = useState('')
  const [selectedMissing, setSelectedMissing] = useState<Set<string>>(new Set())
  const [confirmingAbsence, setConfirmingAbsence] = useState(false)
  const [hasRunDetection, setHasRunDetection] = useState(false)

  // ✅ جديد: كشف الموبايل لكي نظبط تنسيق الشبكات والأزرار
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 860)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const [daySchedules, setDaySchedules] = useState<{ employee_id: string; shift_id: string | null; custom_start: string | null }[]>([])
  const fetchData = useCallback(async () => {
    setLoading(true)
    const [att, emps, brs, sched] = await Promise.all([
      sb.from('attendance')
        .select('*, employees(id,name,name_en,employee_number,role,department,branch_id,salary,branches(name))')
        .eq('date', date)
        .order('check_in_time'),
      (() => {
        let q = sb.from('employees').select('id,name,name_en,employee_number,role,department,branch_id,salary,branches(name)').eq('is_active', true).order('name')
        const role = empInfo?.role || ''
        const branchId = empInfo?.branch_id || ''
        if (role === 'branch_manager') q = q.eq('branch_id', branchId)
        else if (role === 'kitchen_manager') q = q.eq('branch_id', branchId).in('department', ['المطبخ','البار','الحلويات','Kitchen','Bar','Desserts'])
        else if (role === 'hall_manager') q = q.eq('branch_id', branchId).in('department', ['الصالة','Hall'])
        else if (role === 'bar_manager') q = q.eq('branch_id', branchId).in('department', ['البار','Bar'])
        else if (role === 'kitchen_supervisor') q = q.eq('branch_id', branchId).in('department', ['المطبخ','Kitchen'])
        else if (role === 'hall_supervisor') q = q.eq('branch_id', branchId).in('department', ['الصالة','Hall'])
        else if (role === 'bar_supervisor') q = q.eq('branch_id', branchId).in('department', ['البار','Bar'])
        return q
      })(),
      sb.from('branches').select('id,name').eq('is_active', true),
      // ✅ نجيب الشيفتات المجدولة لهذا اليوم بالذات — لكي "الغياب" في هذا العرض يُحتسب فقط للموظف
      // الذي كان يلزمه الحضور فعلاً (له شيفت مجدول)، وليس لكل الموظفين بلا تمييز
      sb.from('shift_schedules').select('employee_id,shift_id,custom_start').eq('date', date).eq('status', 'confirmed'),
    ])
    setRecords(att.data || [])
    setEmployees(emps.data || [])
    setBranches(brs.data || [])
    // ✅ نستبعد صفوف الإجازة (بلا shift_id وبلا custom_start) — نفس المنطق المستخدم في أدوات كشف الغياب
    setDaySchedules((sched.data || []).filter((s: any) => s.shift_id || s.custom_start))
    setLoading(false)
  }, [date, sb])

  useEffect(() => { fetchData() }, [fetchData])

  async function loadReport() {
    if (!reportEmp) return
    setLoadingReport(true)
    const startDate = `${reportMonth}-01`
    // ✅ Date.UTC بدل new Date() العادي — لكي الحساب لا يتأثر بتوقيت متصفح الأدمن المحلي (نفس باج monthEnd في صفحة الرواتب)
    const [ry, rm] = reportMonth.split('-').map(Number)
    const monthEndStr = new Date(Date.UTC(ry, rm, 1)).toISOString().split('T')[0]
    // ✅ لكي نستبعد أي يوم لم يأتِ بعد (مستقبلي) — نفس تصحيح الباج المطبَّق في Absence Detection وAttendance Health،
    // وإلا أي شيفت مجدول مسبقاً لبقية الشهر سيُحتسب "غياباً" رغم أن اليوم لم يحدث أصلاً
    const todayStr = new Date().toISOString().slice(0, 10)
    const endStr = monthEndStr < todayStr ? monthEndStr : todayStr

    const [{ data }, { data: schedules }] = await Promise.all([
      sb.from('attendance')
        .select('*')
        .eq('employee_id', reportEmp)
        .gte('date', startDate)
        .lt('date', endStr)
        .order('date'),
      // ✅ كل الشيفتات المجدولة فعلياً لهذا الموظف هذا الشهر (شغل أو إجازة معاً) — لكي نميّز يوم الإجازة
      // عن يوم الغياب الحقيقي عن يوم الراحة (بلا أي شيفت مجدول أصلاً)
      sb.from('shift_schedules')
        .select('date,shift_id,custom_start')
        .eq('employee_id', reportEmp)
        .eq('status', 'confirmed')
        .gte('date', startDate)
        .lt('date', endStr),
    ])

    const realRows = data || []
    const realRowByDate: Record<string, any> = {}
    for (const r of realRows) realRowByDate[String(r.date).slice(0, 10)] = r

    // ✅ خريطة نوع كل يوم مجدول: 'work' (شيفت فعلي) أو 'leave' (إجازة رسمية — بلا shift_id وبلا custom_start)
    const scheduleTypeByDate: Record<string, 'work' | 'leave'> = {}
    for (const s of (schedules || [])) {
      const d = String(s.date).slice(0, 10)
      scheduleTypeByDate[d] = (s.shift_id || s.custom_start) ? 'work' : 'leave'
    }

    // ✅ نبني صفاً لكل يوم تقويمي في الفترة المعروضة بالكامل — بلا أي فجوة، حتى لا يظهر الشهر "ناقصاً"
    // ويلتبس الأمر بين يوم إجازة ويوم غياب ويوم راحة (بلا شيفت مجدول أصلاً)
    const merged: any[] = []
    for (let d = new Date(startDate + 'T00:00:00Z'); d.toISOString().slice(0, 10) < endStr; d.setUTCDate(d.getUTCDate() + 1)) {
      const dateStr = d.toISOString().slice(0, 10)
      const realRow = realRowByDate[dateStr]
      const schedType = scheduleTypeByDate[dateStr]

      if (realRow && realRow.check_in_time) {
        merged.push(realRow)
      } else if (schedType === 'leave') {
        merged.push({ date: dateStr, check_in_time: null, check_out_time: null, late_minutes: 0, status: 'leave', _synthetic: true })
      } else if (schedType === 'work') {
        merged.push({ date: dateStr, check_in_time: null, check_out_time: null, late_minutes: 0, status: 'absent', _synthetic: true })
      } else {
        // لا يوجد أي شيفت مجدول لهذا اليوم إطلاقاً — يوم راحة أسبوعية، لا يُحتسب غياباً ولا إجازة
        merged.push({ date: dateStr, check_in_time: null, check_out_time: null, late_minutes: 0, status: 'day_off', _synthetic: true })
      }
    }

    setReportData(merged)
    setLoadingReport(false)
  }

  function workHours(r: any) {
    if (!r.check_in_time || !r.check_out_time) return '—'
    const mins = Math.floor((new Date(r.check_out_time).getTime() - new Date(r.check_in_time).getTime()) / 60000)
    return `${Math.floor(mins/60)}h ${mins%60}m`
  }

  function workMins(r: any) {
    if (!r.check_in_time || !r.check_out_time) return 0
    return Math.floor((new Date(r.check_out_time).getTime() - new Date(r.check_in_time).getTime()) / 60000)
  }

  // فلتر حسب الفرع
  const filteredEmps = filterBranch === 'all'
    ? employees
    : employees.filter(e => e.branch_id === filterBranch)

  const filteredRecords = filterBranch === 'all'
    ? records
    : records.filter(r => {
        const emp = employees.find(e => e.id === r.employee_id)
        return emp?.branch_id === filterBranch
      })

  const checkedIn  = filteredRecords.filter(r => r.check_in_time).length
  const checkedOut = filteredRecords.filter(r => r.check_out_time).length
  // ✅ "الغياب" يُحتسب فقط للموظف الذي كان له شيفت مجدول فعلياً هذا اليوم (موجود في daySchedules)،
  // وليس لكل الموظفين — الموظف الذي لم يكن مطلوباً منه الحضور أصلاً لا يُعدّ غائباً
  const scheduledEmpIdsToday = new Set(daySchedules.map(s => s.employee_id))
  const checkedInEmpIds = new Set(filteredRecords.filter(r => r.check_in_time).map(r => r.employee_id))
  const absent = filteredEmps.filter(e => scheduledEmpIdsToday.has(e.id) && !checkedInEmpIds.has(e.id)).length
  const late       = filteredRecords.filter(r => r.status === 'late').length

  // إحصائيات الفروع
  const isAdminView = ['admin','branch_manager'].includes(empInfo?.role || '')
  // ✅ جديد: الأدمن فقط (ليس مدير فرع) يقدر يحذف/يصحح سجلات الحضور
  const isAdmin = empInfo?.role === 'admin'

  // ✅ جديد: تعديل وقت الدخول/الخروج مباشرة (بدل المسح فقط)
  const [editingCell, setEditingCell] = useState<{ recordId: string; field: 'check_in_time' | 'check_out_time' } | null>(null)
  const [editValue, setEditValue] = useState('')

  // تحويل وقت ISO لصيغة datetime-local (بتوقيت ماليزيا UTC+8، مثل باقي النظام)
  function toDatetimeLocal(iso?: string) {
    if (!iso) return ''
    const d = new Date(iso)
    const local = new Date(d.getTime() + 8 * 60 * 60 * 1000) // UTC+8
    return local.toISOString().slice(0, 16)
  }

  function startEditingTime(recordId: string, field: 'check_in_time' | 'check_out_time', currentValue?: string) {
    setEditingCell({ recordId, field })
    setEditValue(toDatetimeLocal(currentValue))
  }

  // ✅ يحسب دقائق التأخير وحالة الحضور (late/present) بمقارنة وقت الدخول الفعلي بموعد بداية الشيفت المجدول لنفس اليوم،
  // بنفس منطق تسجيل الدخول الذاتي بالظبط (grace period 10 دقائق). بنستخدمها هنا لكي أي تصحيح يدوي أو إضافة يدوية
  // لوقت الدخول تُعيد حساب التأخير صح، بدل ما تفضل قيمة late_minutes قديمة أو صفر رغم إن الوقت الفعلي متأخر
  async function computeLateInfo(employeeId: string, dateStr: string, checkInIso: string): Promise<{ status: string; late_minutes: number }> {
    const { data: sch } = await sb.from('shift_schedules')
      .select('*, shifts(start_time,end_time), custom_start, custom_end')
      .eq('employee_id', employeeId)
      .eq('date', dateStr)
      .maybeSingle()

    const startStr = sch?.custom_start || sch?.shifts?.start_time
    const [y, mo, d] = dateStr.split('-').map(Number)
    let shiftStartMs: number
    if (startStr) {
      const [h, m] = startStr.split(':').map(Number)
      // ✅ نفس منطق تحويل التوقيت المحلي (ماليزيا UTC+8) المستخدم في باقي الصفحة — الحساب يبقى صح
      // بغض النظر عن التايم زون الخاص بـ جهاز الأدمن الذي بيعدّل السجل
      shiftStartMs = Date.UTC(y, mo - 1, d, h, m, 0) - 8 * 60 * 60 * 1000
    } else {
      // لا توجد شيفت مجدول — نفس الافتراضي المستخدم في تسجيل الدخول الذاتي (9 صباحاً)
      shiftStartMs = Date.UTC(y, mo - 1, d, 9, 0, 0) - 8 * 60 * 60 * 1000
    }

    const diffMins = Math.floor((new Date(checkInIso).getTime() - shiftStartMs) / 60000)
    const status = diffMins > 10 ? 'late' : 'present'
    return { status, late_minutes: status === 'late' ? diffMins : 0 }
  }

  // ✅ إعادة حساب دقائق التأخير لكل موظفين الشركة في شهر كامل بأثر رجعي — لتصحيح سجلات قديمة (مثل يوليو) كانت
  // سُجِّلت أو عُدِّلت يدوياً قبل إضافة الحساب التلقائي، وكانت late_minutes فيها صفراً أو خاطئة رغم أن الموظف تأخر فعلياً
  async function recalcMonthLateMinutes() {
    if (!confirm(`⚠️ هل أنت متأكد من إعادة حساب دقائق التأخير لكل الموظفين في شهر ${recalcMonth}؟\n\nسيتم تحديث كل سجل حضور مسجَّل به وقت دخول بمقارنته بموعد الشيفت المجدول.`)) return
    setRecalculating(true)
    setRecalcProgress(null)
    try {
      const startDate = `${recalcMonth}-01`
      // ✅ Date.UTC بدل new Date() العادي — نفس تصحيح باج التوقيت المحلي الذي عملناه في صفحة الرواتب و loadReport
      const [ry, rm] = recalcMonth.split('-').map(Number)
      const endDate = new Date(Date.UTC(ry, rm, 1)).toISOString().slice(0, 10)

      // ✅ Supabase بيحدّ أي select بـ 1000 صف كحد أقصى افتراضياً — لازم نسحب على دفعات (Pagination)
      // لكي نضمن إننا سنحضر كل السجلات فعلاً، ليس أول 1000 فقط (خطر جداً مع أكتر من 200 موظف × 31 يوم)
      const PAGE_SIZE = 1000
      let monthRecords: { id: string; employee_id: string; date: string; check_in_time: string | null }[] = []
      let page = 0
      while (true) {
        const { data: batch, error: fetchErr } = await sb.from('attendance')
          .select('id, employee_id, date, check_in_time')
          .gte('date', startDate).lt('date', endDate)
          .not('check_in_time', 'is', null)
          .order('id')
          .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1)

        if (fetchErr) { alert('حصل خطأ أثناء جلب السجلات: ' + fetchErr.message); return }
        if (!batch || batch.length === 0) break
        monthRecords = monthRecords.concat(batch)
        if (batch.length < PAGE_SIZE) break
        page++
      }

      if (monthRecords.length === 0) { alert(`لا توجد سجلات حضور فيها وقت دخول في شهر ${recalcMonth}.`); return }

      setRecalcProgress({ done: 0, total: monthRecords.length })
      let updated = 0
      for (let i = 0; i < monthRecords.length; i++) {
        const rec = monthRecords[i]
        const { status, late_minutes } = await computeLateInfo(rec.employee_id, rec.date, rec.check_in_time!)
        const { error: updErr } = await sb.from('attendance').update({ status, late_minutes }).eq('id', rec.id)
        if (!updErr) updated++
        setRecalcProgress({ done: i + 1, total: monthRecords.length })
      }

      alert(`✅ تم تحديث ${updated} من أصل ${monthRecords.length} سجل حضور لشهر ${recalcMonth}.\nراجع صفحة الرواتب للشهر هذا تاني لكي الخصومات تتحدث معاها.`)
      if (tab === 'report' && reportEmp) loadReport()
      fetchData()
    } finally {
      setRecalculating(false)
      setRecalcProgress(null)
    }
  }

  // ✅ كشف الغياب التلقائي: يقارن كل يوم كان مجدولاً فيه شيفت للموظف (shift_schedules, status='confirmed')
  // بسجلات الحضور الفعلية (attendance مع check_in_time)، وبيستبعد أي يوم اتسجل غياب له بالفعل في جدول absences
  // ✅ فحص صحة الحضور: يحسب لكل موظف عدد أيام الشيفت المجدولة، عدد أيام الحضور الفعلي، وآخر يوم سجّل فيه دخولاً،
  // وبيقسّمهم لـ3 مجموعات لكي نفرّق بين "مشكلة تقنية في التطبيق" و"موظف سايب الشغل فعلاً" و"نمط طبيعي"
  async function runAttendanceHealthCheck() {
    setCheckingHealth(true)
    setHasRunHealth(false)
    setHealthRows([])
    try {
      const startDate = `${healthMonth}-01`
      const [hy, hm] = healthMonth.split('-').map(Number)
      const monthEnd = new Date(Date.UTC(hy, hm, 1)).toISOString().slice(0, 10)
      const todayStr = new Date().toISOString().slice(0, 10)
      const endDate = monthEnd < todayStr ? monthEnd : todayStr

      async function fetchAllPaged<T>(build: (from: number, to: number) => any): Promise<T[]> {
        const PAGE_SIZE = 1000
        let all: T[] = []
        let p = 0
        while (true) {
          const { data, error } = await build(p * PAGE_SIZE, p * PAGE_SIZE + PAGE_SIZE - 1)
          if (error) throw error
          if (!data || data.length === 0) break
          all = all.concat(data)
          if (data.length < PAGE_SIZE) break
          p++
        }
        return all
      }

      const [schedules, attendanceRows, allEmpsData] = await Promise.all([
        fetchAllPaged<{ employee_id: string; date: string; shift_id: string | null; custom_start: string | null }>(
          (from, to) => sb.from('shift_schedules')
            .select('employee_id,date,shift_id,custom_start')
            .eq('status', 'confirmed')
            .gte('date', startDate).lt('date', endDate)
            .order('id').range(from, to)
        ),
        fetchAllPaged<{ employee_id: string; date: string }>(
          (from, to) => sb.from('attendance')
            .select('employee_id,date')
            .not('check_in_time', 'is', null)
            .gte('date', startDate).lt('date', endDate)
            .order('id').range(from, to)
        ),
        sb.from('employees').select('id,name,name_en,employee_number,department,is_active').then(r => r.data || []),
      ])

      const empMap: Record<string, any> = {}
      ;(allEmpsData as any[]).forEach(e => { empMap[e.id] = e })

      const attendedByEmp: Record<string, Set<string>> = {}
      for (const a of attendanceRows) {
        const d = String(a.date).slice(0, 10)
        if (!attendedByEmp[a.employee_id]) attendedByEmp[a.employee_id] = new Set()
        attendedByEmp[a.employee_id].add(d)
      }

      const scheduledByEmp: Record<string, string[]> = {}
      for (const s of schedules) {
        if (!s.shift_id && !s.custom_start) continue // يوم إجازة، ليس شيفت فعلي
        const d = String(s.date).slice(0, 10)
        if (!scheduledByEmp[s.employee_id]) scheduledByEmp[s.employee_id] = []
        scheduledByEmp[s.employee_id].push(d)
      }

      const rows: typeof healthRows = []
      for (const employeeId of Object.keys(scheduledByEmp)) {
        const scheduledDates = scheduledByEmp[employeeId].sort()
        const attended = attendedByEmp[employeeId] || new Set<string>()
        const attendedDays = scheduledDates.filter(d => attended.has(d)).length
        const missingDays = scheduledDates.length - attendedDays
        if (missingDays <= 5) continue // فرق بسيط جداً — ليس يحتاج إلى مراجعة
        const lastCheckin = attended.size > 0 ? Array.from(attended).sort().slice(-1)[0] : null
        const emp = empMap[employeeId]
        rows.push({
          employee_id: employeeId,
          name: emp ? `${emp.name}${emp.name_en ? ' ' + emp.name_en : ''}` : 'Unknown / Deleted',
          employee_number: emp?.employee_number || '—',
          department: emp?.department || '—',
          is_active: emp?.is_active ?? false,
          scheduledDays: scheduledDates.length,
          attendedDays,
          missingDays,
          lastCheckin,
        })
      }
      rows.sort((a, b) => b.missingDays - a.missingDays)
      setHealthRows(rows)
      setHealthEndDate(endDate)
      setHasRunHealth(true)
    } catch (err: any) {
      alert('Error running health check: ' + (err?.message || String(err)))
    } finally {
      setCheckingHealth(false)
    }
  }

  async function detectMissingAttendance() {
    setDetectingAbsence(true)
    setMissingRows([])
    setSelectedMissing(new Set())
    setHasRunDetection(false)
    try {
      const startDate = `${absenceMonth}-01`
      const [ay, am] = absenceMonth.split('-').map(Number)
      const monthEnd = new Date(Date.UTC(ay, am, 1)).toISOString().slice(0, 10)
      // ✅ لازم نستبعد أي يوم بعد ماجاش (مستقبلي)، وإلا أي شيفت مجدول قدّام هيظهر "غايب" غلط
      // لمجرد إن اليوم هذا أصلاً بعد لم يحدث، ليس لأن حد غايب فعلاً
      const todayStr = new Date().toISOString().slice(0, 10)
      const endDate = monthEnd < todayStr ? monthEnd : todayStr

      // ✅ سحب على دفعات (Pagination) — نفس درس الـ1000 صف الذي اتعلمناه قبل كذلك
      async function fetchAllPaged<T>(build: (from: number, to: number) => any): Promise<T[]> {
        const PAGE_SIZE = 1000
        let all: T[] = []
        let p = 0
        while (true) {
          const { data, error } = await build(p * PAGE_SIZE, p * PAGE_SIZE + PAGE_SIZE - 1)
          if (error) throw error
          if (!data || data.length === 0) break
          all = all.concat(data)
          if (data.length < PAGE_SIZE) break
          p++
        }
        return all
      }

      const [schedules, attendanceRows, existingAbsences] = await Promise.all([
        fetchAllPaged<{ employee_id: string; date: string; shift_id: string | null; custom_start: string | null; custom_end: string | null; shifts: { name: string } | null }>(
          (from, to) => sb.from('shift_schedules')
            .select('employee_id,date,shift_id,custom_start,custom_end,shifts(name)')
            .eq('status', 'confirmed')
            .gte('date', startDate).lt('date', endDate)
            .order('id').range(from, to)
        ),
        fetchAllPaged<{ employee_id: string; date: string }>(
          (from, to) => sb.from('attendance')
            .select('employee_id,date')
            .not('check_in_time', 'is', null)
            .gte('date', startDate).lt('date', endDate)
            .order('id').range(from, to)
        ),
        fetchAllPaged<{ employee_id: string; date: string }>(
          (from, to) => sb.from('absences')
            .select('employee_id,date')
            .gte('date', startDate).lt('date', endDate)
            .order('id').range(from, to)
        ),
      ])

      const attendedSet = new Set(attendanceRows.map(a => `${a.employee_id}|${String(a.date).slice(0, 10)}`))
      const absentAlreadySet = new Set(existingAbsences.map(a => `${a.employee_id}|${String(a.date).slice(0, 10)}`))
      // ✅ يجب جلب كل الموظفين (وليس النشطين فقط كما في الحالة الرئيسية) حتى تظهر الأسماء بشكل صحيح،
      // ولكي نتمكن من تمييز موظف غير نشط بدلاً من أن يظهر "—" غامض
      const { data: allEmpsData } = await sb.from('employees').select('id,name,name_en,employee_number,is_active')
      const empMap: Record<string, { name: string; name_en?: string; employee_number: string; is_active: boolean }> = {}
      ;(allEmpsData || []).forEach((e: any) => { empMap[e.id] = e })

      const missing: typeof missingRows = []
      for (const s of schedules) {
        // ✅ صف بدون shift_id وبدون custom_start = يوم إجازة/بدون شيفت فعلي (ليس التزام حضور حقيقي)،
        // نفس المنطق الذي شاشة "جدول الموظف" بتستخدمه لتمييز الإجازة — نستبعده هنا لكي مايتحسبش غياب
        if (!s.shift_id && !s.custom_start) continue
        const dateStr = String(s.date).slice(0, 10)
        const key = `${s.employee_id}|${dateStr}`
        if (attendedSet.has(key)) continue       // حضر فعلاً
        if (absentAlreadySet.has(key)) continue   // متسجل غياب له بالفعل
        const emp = empMap[s.employee_id]
        missing.push({
          employee_id: s.employee_id,
          date: dateStr,
          empName: emp ? `${emp.name}${emp.name_en ? ' ' + emp.name_en : ''}` : '⚠️ موظف محذوف/غير معروف',
          empNumber: emp?.employee_number || '—',
          isActive: emp?.is_active ?? false,
          shiftLabel: s.custom_start && s.custom_end ? `${s.custom_start.slice(0,5)}–${s.custom_end.slice(0,5)}` : (s.shifts?.name || '—'),
        })
      }
      missing.sort((a, b) => a.date.localeCompare(b.date) || a.empName.localeCompare(b.empName))
      setMissingRows(missing)
      // ✅ لا توجد تحديد تلقائي — الأدمن لازم يراجع ويحدد يدوياً، خصوصاً إن الأعداد ممكن تطلع كبيرة جداً
      // لو يوجد فجوة في استخدام تسجيل الدخول (ليس كل "لا توجد check-in" معناه غياب فعلي)
      setSelectedMissing(new Set())
      setHasRunDetection(true)
    } catch (err: any) {
      alert('حصل خطأ أثناء الكشف: ' + (err?.message || String(err)))
    } finally {
      setDetectingAbsence(false)
    }
  }

  function toggleMissingRow(key: string) {
    setSelectedMissing(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key); else next.add(key)
      return next
    })
  }

  // ✅ يحفظ الحالات المحددة فعلياً كسجلات غياب في جدول absences (status='active' لكي صفحة الرواتب تحسبها)
  async function confirmSelectedAbsences() {
    const rows = missingRows.filter(m => selectedMissing.has(`${m.employee_id}|${m.date}`))
    if (rows.length === 0) { alert('لا توجد حالات محددة.'); return }
    if (!confirm(`⚠️ هل أنت متأكد من تسجيل ${rows.length} يوم غياب؟ سيتم خصمهم في صفحة الرواتب.`)) return
    setConfirmingAbsence(true)
    try {
      const payload = rows.map(r => ({
        employee_id: r.employee_id,
        date: r.date,
        status: 'active',
        notes: 'غياب تلقائي — لا يوجد تسجيل حضور رغم وجود شيفت مجدول',
        created_by: empInfo?.id || null,
        manager_approved_by: empInfo?.id || null,
        manager_approved_at: new Date().toISOString(),
        submitted_at: new Date().toISOString(),
      }))
      let inserted = 0
      for (let i = 0; i < payload.length; i += 200) {
        const { error } = await sb.from('absences').insert(payload.slice(i, i + 200))
        if (!error) inserted += payload.slice(i, i + 200).length
      }
      alert(`✅ تم تسجيل ${inserted} من أصل ${rows.length} يوم غياب.`)
      detectMissingAbsenceRefresh()
    } finally {
      setConfirmingAbsence(false)
    }
  }

  function detectMissingAbsenceRefresh() {
    detectMissingAttendance()
  }

  async function saveEditedTime(empName: string) {
    if (!editingCell || !editValue) return
    const label = editingCell.field === 'check_in_time' ? 'الدخول' : 'الخروج'
    if (!confirm(`⚠️ هل أنت متأكد من تعديل وقت ${label} للموظف "${empName}"؟`)) return
    // ✅ الحقل datetime-local بيرجع وقت محلي (ماليزيا UTC+8)، لازم نحوله لـ UTC قبل الحفظ
    const localDate = new Date(editValue + ':00')
    const utcIso = new Date(localDate.getTime() - 8 * 60 * 60 * 1000).toISOString()
    const updatePayload: Record<string, any> = { [editingCell.field]: utcIso }
    // ✅ لو بنعدّل وقت الدخول تحديداً، لازم نعيد حساب التأخير كذلك — وإلا سيبقى الرقم القديم غلط حتى بعد التصحيح
    if (editingCell.field === 'check_in_time') {
      const rec = records.find(r => r.id === editingCell.recordId)
      if (rec) {
        const { status, late_minutes } = await computeLateInfo(rec.employee_id, rec.date, utcIso)
        updatePayload.status = status
        updatePayload.late_minutes = late_minutes
      }
    }
    const { error } = await sb.from('attendance').update(updatePayload).eq('id', editingCell.recordId)
    if (error) { alert('حصل خطأ: ' + error.message); return }
    setEditingCell(null)
    fetchData()
  }

  // ✅ جديد: مسح وقت الدخول أو الخروج لسجل معين (بدون حذف السجل كله) - مع تأكيد صريح
  async function clearAttendanceField(recordId: string, field: 'check_in_time' | 'check_out_time', empName: string) {
    const label = field === 'check_in_time' ? 'الدخول' : 'الخروج'
    if (!confirm(`⚠️ هل أنت متأكد من مسح وقت ${label} للموظف "${empName}"؟\n\nهذا الإجراء لا يمكن التراجع عنه.`)) return
    const { error } = await sb.from('attendance').update({ [field]: null }).eq('id', recordId)
    if (error) { alert('حصل خطأ: ' + error.message); return }
    fetchData()
  }

  // ✅ جديد: حذف سجل الحضور بالكامل (اليوم كله لهذا الموظف) - تأكيد مضاعف لأنه إجراء أقوى
  async function deleteAttendanceRecord(recordId: string, empName: string, recordDate: string) {
    if (!confirm(`⚠️ هل أنت متأكد من حذف سجل حضور "${empName}" ليوم ${recordDate} بالكامل؟\n\nسيتم حذف وقتي الدخول والخروج معًا. هذا الإجراء لا يمكن التراجع عنه.`)) return
    if (!confirm('تأكيد نهائي: سيتم حذف السجل بشكل كامل ولا يمكن استرجاعه. متابعة؟')) return
    const { error } = await sb.from('attendance').delete().eq('id', recordId)
    if (error) { alert('حصل خطأ: ' + error.message); return }
    fetchData()
  }

  // ✅ جديد: إنشاء سجل حضور من الصفر لموظف غائب (مالوش أي سجل على الإطلاق لليوم هذا) - للأدمن فقط
  const [addingAttendanceFor, setAddingAttendanceFor] = useState<string | null>(null)
  const [addCheckIn, setAddCheckIn] = useState('')
  const [addCheckOut, setAddCheckOut] = useState('')

  function startAddingAttendance(empId: string) {
    setAddingAttendanceFor(empId)
    // ✅ نبدّئ بوقت افتراضي معقول (بداية اليوم المختار الساعة 9 صباحًا) لكي يسهّل الإدخال، قابل للتعديل طبعًا
    setAddCheckIn(`${date}T09:00`)
    setAddCheckOut('')
  }

  async function saveManualAttendance(empId: string, empName: string) {
    if (!addCheckIn) { alert('من فضلك أدخل وقت الدخول على الأقل'); return }
    if (!confirm(`⚠️ هل أنت متأكد من إضافة سجل حضور جديد للموظف "${empName}" ليوم ${date}؟`)) return
    // ✅ نفس منطق تحويل التوقيت المحلي (ماليزيا UTC+8) لـUTC المستخدم في تعديل الوقت الموجود بالفعل
    const inLocal = new Date(addCheckIn + ':00')
    const checkInUtc = new Date(inLocal.getTime() - 8 * 60 * 60 * 1000).toISOString()
    let checkOutUtc: string | null = null
    if (addCheckOut) {
      const outLocal = new Date(addCheckOut + ':00')
      checkOutUtc = new Date(outLocal.getTime() - 8 * 60 * 60 * 1000).toISOString()
    }
    // ✅ نحسب حالة الحضور ودقائق التأخير للسجل اليدوي بنفس منطق تسجيل الدخول الذاتي، بدل ما تفضل صفر افتراضياً
    const { status, late_minutes } = await computeLateInfo(empId, date, checkInUtc)
    const { error } = await sb.from('attendance').insert([{
      employee_id: empId, date, check_in_time: checkInUtc, check_out_time: checkOutUtc, status, late_minutes,
    }])
    if (error) { alert('حصل خطأ: ' + error.message); return }
    setAddingAttendanceFor(null)
    setAddCheckIn(''); setAddCheckOut('')
    fetchData()
  }
  const branchStats = branches.map(b => {
    const brEmps    = employees.filter(e => e.branch_id === b.id)
    const brRecords = records.filter(r => brEmps.some(e => e.id === r.employee_id))
    return {
      branch: b,
      total:    brEmps.length,
      present:  brRecords.filter(r => r.check_in_time).length,
      absent:   brEmps.length - brRecords.filter(r => r.check_in_time).length,
      late:     brRecords.filter(r => r.status === 'late').length,
    }
  })

  // تقرير الموظف
  const reportEmployee = employees.find(e => e.id === reportEmp)
  const totalWorkMins  = reportData.reduce((s, r) => s + workMins(r), 0)
  const presentDays    = reportData.filter(r => r.check_in_time && r.status !== 'absent').length
  const absentDays     = reportData.filter(r => r.status === 'absent').length
  const lateDays       = reportData.filter(r => r.status === 'late').length
  // ✅ إجمالي دقائق التأخير الفعلية على مدار الشهر كله (ليس فقط عدد الأيام المتأخرة)
  const totalLateMins  = reportData.reduce((s, r) => s + (r.late_minutes || 0), 0)
  const dailyRate      = reportEmployee?.salary ? reportEmployee.salary / 30 : 0
  const earnedSalary   = dailyRate * presentDays
  const deductions     = dailyRate * absentDays

  function printReport() {
    if (!reportEmployee) return
    const win = window.open('', '_blank')
    if (!win) return
    const rows = reportData.map(r => `<tr>
      <td>${r.date}</td>
      <td>${r.check_in_time ? new Date(r.check_in_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
      <td>${r.check_out_time ? new Date(r.check_out_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
      <td>${r.check_in_distance != null ? r.check_in_distance + 'm' : '—'}</td>
      <td>${r.check_out_distance != null ? r.check_out_distance + 'm' : '—'}</td>
      <td>${workHours(r)}</td>
      <td style="color:${r.late_minutes > 0 ? 'orange' : '#999'}">${r.late_minutes > 0 ? r.late_minutes + 'm' : '—'}</td>
      <td style="color:${r.status === 'present' ? 'green' : r.status === 'late' ? 'orange' : r.status === 'leave' ? 'teal' : r.status === 'day_off' ? '#999' : 'red'}">${r.status === 'leave' ? 'إجازة' : r.status === 'day_off' ? 'يوم راحة' : r.status === 'absent' ? 'غياب' : (r.status || 'present')}</td>
    </tr>`).join('')

    win.document.write(`<!DOCTYPE html><html dir="rtl"><head><meta charset="UTF-8">
    <title>Attendance Report - ${reportEmployee.name}</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 24px; font-size: 12px; direction: rtl; }
      h2 { color: #C9A84C; margin-bottom: 4px; }
      .info { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin: 16px 0; }
      .info-box { background: #f5f5f5; padding: 12px; border-radius: 8px; }
      .info-label { font-size: 10px; color: #666; margin-bottom: 4px; }
      .info-value { font-weight: bold; font-size: 15px; }
      table { width: 100%; border-collapse: collapse; margin-top: 16px; }
      th { background: #0A1628; color: white; padding: 8px; text-align: center; border: 1px solid #ddd; }
      td { padding: 7px 8px; border: 1px solid #ddd; text-align: center; }
      tr:nth-child(even) { background: #f9f9f9; }
      .salary-box { background: #fff8e1; border: 1px solid #C9A84C; border-radius: 8px; padding: 16px; margin-top: 20px; }
      @media print { @page { size: A4; margin: 10mm; } }
    </style></head><body>
    <h2>🌸 Orchid House — Attendance Report</h2>
    <h3 style="color:#555;font-weight:400">${reportEmployee.name} ${reportEmployee.name_en || ''} · ${reportMonth}</h3>
    <div class="info">
      <div class="info-box"><div class="info-label">Employee ID</div><div class="info-value">${reportEmployee.employee_number || '—'}</div></div>
      <div class="info-box"><div class="info-label">Role</div><div class="info-value">${reportEmployee.role}</div></div>
      <div class="info-box"><div class="info-label">Branch</div><div class="info-value">${(reportEmployee as any).branches?.name || '—'}</div></div>
      <div class="info-box"><div class="info-label" style="color:green">✅ Present Days</div><div class="info-value" style="color:green">${presentDays}</div></div>
      <div class="info-box"><div class="info-label" style="color:red">❌ Absent Days</div><div class="info-value" style="color:red">${absentDays}</div></div>
      <div class="info-box"><div class="info-label" style="color:orange">⏰ Late Days</div><div class="info-value" style="color:orange">${lateDays}</div></div>
      <div class="info-box"><div class="info-label" style="color:orange">🐢 Total Late Time</div><div class="info-value" style="color:orange">${Math.floor(totalLateMins/60)}h ${totalLateMins%60}m</div></div>
    </div>
    <table>
      <thead><tr><th>Date</th><th>${isAr ? 'تسجيل حضور' : 'Check In'}</th><th>${isAr ? 'تسجيل انصراف' : 'Check Out'}</th><th>In Distance</th><th>Out Distance</th><th>Duration</th><th>Late</th><th>Status</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div style="margin-top:24px;display:flex;justify-content:space-between;font-size:11px;color:#666">
      <div>Prepared by: _______________</div>
      <div>Date: ${new Date().toLocaleDateString()}</div>
    </div>
    <script>window.onload=function(){window.print()}<\/script>
    </body></html>`)
    win.document.close()
  }

  const inp2: React.CSSProperties = {
    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)',
    borderRadius: 10, padding: '9px 12px', fontSize: 13, color: '#FAFAF8',
    outline: 'none', fontFamily: 'Tajawal, sans-serif', width: '100%', boxSizing: 'border-box',
  }

  return (
    <div>
      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: 4, marginBottom: 24, width: 'fit-content' }}>
        {([
          ['day', '📅 Daily View'],
          ['report', '📊 Employee Report'],
          ...(isAdmin ? ([['absence', '🔍 Absence Detection'], ['health', '🩺 Attendance Health']] as [typeof tab, string][]) : []),
        ] as [typeof tab, string][]).map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)} style={{ padding: '9px 20px', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: tab === t ? 800 : 400, background: tab === t ? S.gold3 : 'transparent', color: tab === t ? S.gold : S.muted }}>
            {label}
          </button>
        ))}
      </div>

      {/* ✅ أداة إعادة حساب التأخير بأثر رجعي لشهر كامل — للأدمن فقط */}
      {isAdmin && (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(245,158,11,0.08)', border: `1px solid ${S.amber}40`, borderRadius: 12, padding: '10px 14px', marginBottom: 20, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, color: S.amber, fontWeight: 700, whiteSpace: 'nowrap' }}>🔄 إعادة حساب التأخير لشهر كامل (لتصحيح سجلات قديمة)</span>
        <input type="month" style={{ ...inp2, width: 140 }} value={recalcMonth} onChange={e => setRecalcMonth(e.target.value)} disabled={recalculating} />
        <button
          onClick={recalcMonthLateMinutes}
          disabled={recalculating}
          style={{ padding: '8px 16px', borderRadius: 10, border: `1px solid ${S.amber}`, background: S.amberB, color: S.amber, cursor: recalculating ? 'default' : 'pointer', fontSize: 12, fontWeight: 700, fontFamily: 'Tajawal, sans-serif', opacity: recalculating ? 0.6 : 1, whiteSpace: 'nowrap' }}
        >
          {recalculating ? (recalcProgress ? `⏳ جاري التحديث... ${recalcProgress.done}/${recalcProgress.total}` : '⏳ جاري التحضير...') : 'إعادة الحساب'}
        </button>
      </div>
      )}
      {tab === 'day' && (
        <>
          {/* Branch Cards */}
          {branches.length > 1 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12, marginBottom: 20 }}>
              <div
                onClick={() => setFilterBranch('all')}
                style={{ background: filterBranch === 'all' ? S.gold3 : S.navy2, border: `1px solid ${filterBranch === 'all' ? S.gold : S.border}`, borderRadius: 14, padding: '14px 16px', cursor: 'pointer', transition: 'all .15s' }}
              >
                <div style={{ fontSize: 11, color: S.muted, marginBottom: 6 }}>🌸 All Branches</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div><div style={{ fontSize: 10, color: S.muted }}>Total</div><div style={{ fontSize: 18, fontWeight: 800, color: S.white }}>{employees.length}</div></div>
                  <div><div style={{ fontSize: 10, color: S.muted }}>{isAr ? 'حاضر' : 'Present'}</div><div style={{ fontSize: 18, fontWeight: 800, color: S.green }}>{records.filter(r => r.check_in_time).length}</div></div>
                </div>
              </div>
              {isAdminView && branchStats.map(bs => (
                <div key={bs.branch.id}
                  onClick={() => setFilterBranch(bs.branch.id)}
                  style={{ background: filterBranch === bs.branch.id ? S.blueB : S.navy2, border: `1px solid ${filterBranch === bs.branch.id ? S.blue : S.border}`, borderRadius: 14, padding: '14px 16px', cursor: 'pointer', transition: 'all .15s' }}
                >
                  <div style={{ fontSize: 11, color: S.muted, marginBottom: 6 }}>🏪 {bs.branch.name}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: 6 }}>
                    <div><div style={{ fontSize: 9, color: S.muted }}>Total</div><div style={{ fontSize: 16, fontWeight: 800, color: S.white }}>{bs.total}</div></div>
                    <div><div style={{ fontSize: 9, color: S.muted }}>{isAr ? 'حاضر' : 'Present'}</div><div style={{ fontSize: 16, fontWeight: 800, color: S.green }}>{bs.present}</div></div>
                    <div><div style={{ fontSize: 9, color: S.muted }}>{isAr ? 'غائب' : 'Absent'}</div><div style={{ fontSize: 16, fontWeight: 800, color: S.red }}>{bs.absent}</div></div>
                    <div><div style={{ fontSize: 9, color: S.muted }}>{isAr ? 'متأخر' : 'Late'}</div><div style={{ fontSize: 16, fontWeight: 800, color: S.amber }}>{bs.late}</div></div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Date + Stats */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
            <input style={{ ...inp2, width: 180 }} type="date" value={date} onChange={e => setDate(e.target.value)} />
            <div style={{ fontSize: 12, color: S.muted }}>
              {filteredEmps.length} employees
              {filterBranch !== 'all' && ` · ${branches.find(b => b.id === filterBranch)?.name}`}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: isMobile ? 8 : 12, marginBottom: 20 }}>
            {[
              { label: 'Present',     value: checkedIn,  color: S.green, bg: S.greenB, icon: '✅' },
              { label: 'Checked Out', value: checkedOut, color: S.blue,  bg: S.blueB,  icon: '🔴' },
              { label: 'Absent',      value: absent,     color: S.red,   bg: S.redB,   icon: '❌' },
              { label: 'Late',        value: late,       color: S.amber, bg: S.amberB, icon: '⏰' },
            ].map((s, i) => (
              <div key={i} style={{ background: s.bg, borderRadius: 12, border: `1px solid ${s.color}30`, padding: '14px 16px' }}>
                <div style={{ fontSize: 11, color: S.muted, marginBottom: 4 }}>{s.icon} {s.label}</div>
                <div style={{ fontSize: 24, fontWeight: 900, color: s.color }}>{s.value}</div>
              </div>
            ))}
          </div>
          {/* Table */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: S.muted }}>⏳ Loading...</div>
          ) : (
            <div style={{ background: S.navy2, borderRadius: 14, border: `1px solid ${S.border}`, overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 800 }}>
                  <thead>
                    <tr style={{ background: S.navy3 }}>
                      {['Employee', 'Branch', 'Dept', 'Check In', 'In Dist.', 'Check Out', 'Out Dist.', 'Duration', 'Status', 'Notes', ...(isAdmin ? ['Actions'] : [])].map(h => (
                        <th key={h} style={{ padding: '12px 14px', textAlign: 'right', fontSize: 12, color: S.muted, fontWeight: 700, borderBottom: `1px solid ${S.border}`, whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRecords.map(r => {
                      const emp = employees.find(e => e.id === r.employee_id)
                      return (
                        <tr key={r.id} style={{ borderBottom: `1px solid ${S.border}` }}>
                          <td style={{ padding: '12px 14px' }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: S.white }}>{(r.employees?.name || emp?.name || '—')}{r.employees?.name_en ? ' ' + r.employees.name_en : emp?.name_en ? ' ' + emp.name_en : ''}</div>
                            <div style={{ fontSize: 11, color: S.gold }}>{r.employees?.employee_number || emp?.employee_number}</div>
                          </td>
                          <td style={{ padding: '12px 14px', fontSize: 12, color: S.blue }}>
                            {(r.employees as any)?.branches?.name || (emp as any)?.branches?.name || '—'}
                          </td>
                          <td style={{ padding: '12px 14px', fontSize: 12, color: S.muted }}>{r.employees?.department || emp?.department || '—'}</td>
                          <td style={{ padding: '12px 14px', fontSize: 13, color: r.check_in_time ? S.green : S.muted }}>
                            {isAdmin && editingCell && editingCell.recordId === r.id && editingCell.field === 'check_in_time' ? (
                              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                                <input type="datetime-local" value={editValue} onChange={e => setEditValue(e.target.value)}
                                  style={{ padding: '3px 6px', borderRadius: 6, border: `1px solid ${S.border}`, background: S.navy3, color: S.white, fontSize: 11, fontFamily: 'inherit' }} />
                                <button onClick={() => saveEditedTime(r.employees?.name || emp?.name || '—')} style={{ padding: '3px 6px', borderRadius: 6, border: 'none', background: S.green, color: '#fff', cursor: 'pointer', fontSize: 10 }}>✔️</button>
                                <button onClick={() => setEditingCell(null)} style={{ padding: '3px 6px', borderRadius: 6, border: `1px solid ${S.border}`, background: 'transparent', color: S.muted, cursor: 'pointer', fontSize: 10 }}>✕</button>
                              </div>
                            ) : formatTime(r.check_in_time)}
                          </td>
                          <td style={{ padding: '12px 14px', fontSize: 12, color: S.muted }}>
                            {r.check_in_distance != null ? `${r.check_in_distance}m` : '—'}
                          </td>
                          <td style={{ padding: '12px 14px', fontSize: 13, color: r.check_out_time ? S.blue : S.muted }}>
                            {isAdmin && editingCell && editingCell.recordId === r.id && editingCell.field === 'check_out_time' ? (
                              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                                <input type="datetime-local" value={editValue} onChange={e => setEditValue(e.target.value)}
                                  style={{ padding: '3px 6px', borderRadius: 6, border: `1px solid ${S.border}`, background: S.navy3, color: S.white, fontSize: 11, fontFamily: 'inherit' }} />
                                <button onClick={() => saveEditedTime(r.employees?.name || emp?.name || '—')} style={{ padding: '3px 6px', borderRadius: 6, border: 'none', background: S.green, color: '#fff', cursor: 'pointer', fontSize: 10 }}>✔️</button>
                                <button onClick={() => setEditingCell(null)} style={{ padding: '3px 6px', borderRadius: 6, border: `1px solid ${S.border}`, background: 'transparent', color: S.muted, cursor: 'pointer', fontSize: 10 }}>✕</button>
                              </div>
                            ) : (
                              <>
                                {formatTime(r.check_out_time)}
                                {/* ✅ شارة مميّزة لتسجيل الخروج التلقائي — تُقرأ من ملاحظة السجل التي تكتبها أداة auto-checkout */}
                                {r.notes && r.notes.includes('تسجيل خروج تلقائي') && (
                                  <span title="تسجيل خروج تلقائي — نسيان تسجيل الخروج" style={{ marginRight: 6, fontSize: 10, background: S.amberB, color: S.amber, borderRadius: 8, padding: '1px 6px', fontWeight: 700 }}>⏰ تلقائي</span>
                                )}
                              </>
                            )}
                          </td>
                          <td style={{ padding: '12px 14px', fontSize: 12, color: S.muted }}>
                            {r.check_out_distance != null ? `${r.check_out_distance}m` : '—'}
                          </td>
                          <td style={{ padding: '12px 14px', fontSize: 13, color: S.gold }}>
                            {workHours(r)}
                            {/* ✅ علامة تحذيرية لأي شيفت مدته أقل من ساعة — بتشتغل حتى على السجلات القديمة
                                لأنها بتُحسب مباشرة من وقتي الدخول/الخروج، مش محتاجة أي حقل إضافي بقاعدة البيانات */}
                            {r.check_in_time && r.check_out_time && workMins(r) > 0 && workMins(r) < 60 && (
                              <span title="مدة قصيرة جداً — تستحق المراجعة" style={{ marginRight: 6, fontSize: 10, background: S.redB, color: S.red, borderRadius: 8, padding: '1px 6px', fontWeight: 700 }}>⚠️ قصير جداً</span>
                            )}
                          </td>
                          <td style={{ padding: '12px 14px' }}>
                            <span style={{ background: r.status === 'present' ? S.greenB : r.status === 'late' ? S.amberB : r.status === 'remote' ? S.blueB : S.redB, color: r.status === 'present' ? S.green : r.status === 'late' ? S.amber : r.status === 'remote' ? S.blue : S.red, borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 700 }}>
                              {r.is_manual ? '✏️ ' : ''}{r.status || 'present'}
                            </span>
                          </td>
                          <td style={{ padding: '12px 14px', fontSize: 12, color: S.muted }}>{r.notes || '—'}</td>
                          {isAdmin && (
                            <td style={{ padding: '12px 14px', minWidth: isMobile ? 130 : undefined }}>
                              <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 4 : 6, flexWrap: isMobile ? undefined : 'wrap' }}>
                                <button onClick={() => startEditingTime(r.id, 'check_in_time', r.check_in_time)}
                                  style={{ padding: '5px 8px', borderRadius: 6, border: `1px solid ${S.blue}`, background: 'transparent', color: S.blue, cursor: 'pointer', fontSize: 10, fontFamily: 'inherit', width: isMobile ? '100%' : undefined, whiteSpace: 'nowrap' }}>
                                  ✏️ تعديل الدخول
                                </button>
                                <button onClick={() => startEditingTime(r.id, 'check_out_time', r.check_out_time)}
                                  style={{ padding: '5px 8px', borderRadius: 6, border: `1px solid ${S.blue}`, background: 'transparent', color: S.blue, cursor: 'pointer', fontSize: 10, fontFamily: 'inherit', width: isMobile ? '100%' : undefined, whiteSpace: 'nowrap' }}>
                                  ✏️ تعديل الخروج
                                </button>
                                {r.check_in_time && (
                                  <button onClick={() => clearAttendanceField(r.id, 'check_in_time', r.employees?.name || emp?.name || '—')}
                                    style={{ padding: '5px 8px', borderRadius: 6, border: `1px solid ${S.amber}`, background: 'transparent', color: S.amber, cursor: 'pointer', fontSize: 10, fontFamily: 'inherit', width: isMobile ? '100%' : undefined, whiteSpace: 'nowrap' }}>
                                    🗑️ مسح الدخول
                                  </button>
                                )}
                                {r.check_out_time && (
                                  <button onClick={() => clearAttendanceField(r.id, 'check_out_time', r.employees?.name || emp?.name || '—')}
                                    style={{ padding: '5px 8px', borderRadius: 6, border: `1px solid ${S.amber}`, background: 'transparent', color: S.amber, cursor: 'pointer', fontSize: 10, fontFamily: 'inherit', width: isMobile ? '100%' : undefined, whiteSpace: 'nowrap' }}>
                                    🗑️ مسح الخروج
                                  </button>
                                )}
                                <button onClick={() => deleteAttendanceRecord(r.id, r.employees?.name || emp?.name || '—', r.date)}
                                  style={{ padding: '5px 8px', borderRadius: 6, border: `1px solid ${S.red}`, background: 'transparent', color: S.red, cursor: 'pointer', fontSize: 10, fontFamily: 'inherit', width: isMobile ? '100%' : undefined, whiteSpace: 'nowrap' }}>
                                  ❌ حذف السجل
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      )
                    })}
                    {/* Absent */}
                    {filteredEmps.filter(e => !filteredRecords.find(r => r.employee_id === e.id)).map(e => (
                      <tr key={e.id} style={{ borderBottom: `1px solid ${S.border}`, opacity: 0.5 }}>
                        <td style={{ padding: '12px 14px' }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: S.white }}>{e.name} {e.name_en || ''}</div>
                          <div style={{ fontSize: 11, color: S.gold }}>{e.employee_number}</div>
                        </td>
                        <td style={{ padding: '12px 14px', fontSize: 12, color: S.blue }}>{(e as any).branches?.name || '—'}</td>
                        <td style={{ padding: '12px 14px', fontSize: 12, color: S.muted }}>{e.department || '—'}</td>
                        <td colSpan={5} style={{ padding: '12px 14px', fontSize: 12, color: S.muted }}>—</td>
                        <td style={{ padding: '12px 14px' }}>
                          <span style={{ background: S.redB, color: S.red, borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 700 }}>❌ absent</span>
                        </td>
                        <td style={{ padding: '12px 14px', fontSize: 12, color: S.muted }}>—</td>
                        {/* ✅ جديد: إمكانية إضافة سجل حضور يدوي لموظف غايب تمامًا - للأدمن فقط، ومكانها عمود الإجراءات نفسه الموجود بالفعل */}
                        {isAdmin && (
                          <td style={{ padding: '12px 14px' }}>
                            {addingAttendanceFor === e.id ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 180 }}>
                                <div>
                                  <label style={{ fontSize: 9, color: S.muted }}>دخول</label>
                                  <input type="datetime-local" value={addCheckIn} onChange={ev => setAddCheckIn(ev.target.value)}
                                    style={{ width: '100%', padding: '3px 6px', borderRadius: 6, border: `1px solid ${S.border}`, background: S.navy3, color: S.white, fontSize: 11, fontFamily: 'inherit' }} />
                                </div>
                                <div>
                                  <label style={{ fontSize: 9, color: S.muted }}>خروج (اختياري)</label>
                                  <input type="datetime-local" value={addCheckOut} onChange={ev => setAddCheckOut(ev.target.value)}
                                    style={{ width: '100%', padding: '3px 6px', borderRadius: 6, border: `1px solid ${S.border}`, background: S.navy3, color: S.white, fontSize: 11, fontFamily: 'inherit' }} />
                                </div>
                                <div style={{ display: 'flex', gap: 6 }}>
                                  <button onClick={() => saveManualAttendance(e.id, e.name)} style={{ flex: 1, padding: '4px 0', borderRadius: 6, border: 'none', background: S.green, color: '#fff', cursor: 'pointer', fontSize: 10 }}>✔️ حفظ</button>
                                  <button onClick={() => setAddingAttendanceFor(null)} style={{ flex: 1, padding: '4px 0', borderRadius: 6, border: `1px solid ${S.border}`, background: 'transparent', color: S.muted, cursor: 'pointer', fontSize: 10 }}>إلغاء</button>
                                </div>
                              </div>
                            ) : (
                              <button onClick={() => startAddingAttendance(e.id)}
                                style={{ padding: '4px 10px', borderRadius: 6, border: `1px solid ${S.blue}`, background: 'transparent', color: S.blue, cursor: 'pointer', fontSize: 10, fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                                ➕ إضافة حضور
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Employee Report Tab */}
      {tab === 'report' && (
        <div>
          <div style={{ background: S.navy2, borderRadius: 14, border: `1px solid ${S.border}`, padding: 20, marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: S.gold, marginBottom: 14 }}>📊 Monthly Attendance Report</div>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto', gap: 12, alignItems: 'end' }}>
              <div>
                <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 6 }}>Employee</label>
                <select style={inp2} value={reportEmp} onChange={e => setReportEmp(e.target.value)}>
                  <option value="">Select Employee...</option>
                  {branches.map(b => (
                    <optgroup key={b.id} label={`🏪 ${b.name}`}>
                      {employees.filter(e => e.branch_id === b.id).map(e => (
                        <option key={e.id} value={e.id}>{e.name} {e.name_en || ''} — {e.employee_number || e.role}</option>
                      ))}
                    </optgroup>
                  ))}
                  {employees.filter(e => !e.branch_id).map(e => (
                    <option key={e.id} value={e.id}>{e.name} {e.name_en || ''}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 6 }}>Month</label>
                <input style={inp2} type="month" value={reportMonth} onChange={e => setReportMonth(e.target.value)} />
              </div>
              <button onClick={loadReport} disabled={!reportEmp || loadingReport}
                style={{ padding: '10px 20px', borderRadius: 10, border: `1px solid ${S.gold}`, background: S.gold3, color: S.gold, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
                {loadingReport ? '⏳' : '🔍 Load'}
              </button>
            </div>
          </div>

          {reportData.length > 0 && reportEmployee && (
            <>
              {/* Summary Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 20 }}>
                {[
                  { label: 'Present Days', value: presentDays,  color: S.green,  bg: S.greenB,  icon: '✅' },
                  { label: 'Absent Days',  value: absentDays,   color: S.red,    bg: S.redB,    icon: '❌' },
                  { label: 'Late Days',    value: lateDays,     color: S.amber,  bg: S.amberB,  icon: '⏰' },
                  { label: 'Total Late Time', value: `${Math.floor(totalLateMins/60)}h ${totalLateMins%60}m`, color: S.amber, bg: S.amberB, icon: '🐢' },
                  { label: 'Total Hours',  value: `${Math.floor(totalWorkMins/60)}h ${totalWorkMins%60}m`, color: S.blue, bg: S.blueB, icon: '⏱' },
                ].map((s, i) => (
                  <div key={i} style={{ background: s.bg, borderRadius: 12, border: `1px solid ${s.color}30`, padding: '14px 16px' }}>
                    <div style={{ fontSize: 11, color: S.muted, marginBottom: 4 }}>{s.icon} {s.label}</div>
                    <div style={{ fontSize: 22, fontWeight: 900, color: s.color }}>{s.value}</div>
                  </div>
                ))}
              </div>

              {/* Print Button */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
                <button onClick={printReport} style={{ padding: '10px 20px', borderRadius: 10, border: `1px solid ${S.blue}`, background: S.blueB, color: S.blue, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
                  🖨️ Print Report
                </button>
              </div>

              {/* Detail Table */}
              <div style={{ background: S.navy2, borderRadius: 14, border: `1px solid ${S.border}`, overflow: 'hidden' }}>
                <div style={{ padding: '14px 18px', borderBottom: `1px solid ${S.border}`, fontSize: 13, fontWeight: 700, color: S.white }}>
                  📋 Daily Records — {reportEmployee.name} {reportEmployee.name_en || ''} · {reportMonth}
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: S.navy3 }}>
                        {['Date', 'Check In', 'In Distance', 'Check Out', 'Out Distance', 'Duration', 'Late', 'Status'].map(h => (
                          <th key={h} style={{ padding: '10px 14px', textAlign: 'right', fontSize: 12, color: S.muted, fontWeight: 700, borderBottom: `1px solid ${S.border}`, whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.map(r => (
                        <tr key={r.id || `row-${r.date}`} style={{ borderBottom: `1px solid ${S.border}` }}>
                          <td style={{ padding: '10px 14px', fontSize: 12, color: S.white }}>{r.date}</td>
                          <td style={{ padding: '10px 14px', fontSize: 13, color: r.check_in_time ? S.green : S.muted }}>{formatTime(r.check_in_time)}</td>
                          <td style={{ padding: '10px 14px', fontSize: 12, color: S.muted }}>
                            {r.check_in_distance != null ? `${r.check_in_distance}m` : '—'}
                          </td>
                          <td style={{ padding: '10px 14px', fontSize: 13, color: r.check_out_time ? S.blue : S.muted }}>{formatTime(r.check_out_time)}</td>
                          <td style={{ padding: '10px 14px', fontSize: 12, color: S.muted }}>
                            {r.check_out_distance != null ? `${r.check_out_distance}m` : '—'}
                          </td>
                          <td style={{ padding: '10px 14px', fontSize: 13, color: S.gold }}>{workHours(r)}</td>
                          <td style={{ padding: '10px 14px', fontSize: 13, color: r.late_minutes > 0 ? S.amber : S.muted }}>
                            {r.late_minutes > 0 ? `${r.late_minutes}m` : '—'}
                          </td>
                          <td style={{ padding: '10px 14px' }}>
                            <span style={{
                              background: r.status === 'present' ? S.greenB : r.status === 'late' ? S.amberB : r.status === 'leave' ? S.tealB : r.status === 'day_off' ? 'rgba(255,255,255,0.06)' : S.redB,
                              color: r.status === 'present' ? S.green : r.status === 'late' ? S.amber : r.status === 'leave' ? S.teal : r.status === 'day_off' ? S.muted : S.red,
                              borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 700,
                            }}>
                              {r.status === 'leave' ? 'إجازة' : r.status === 'day_off' ? 'يوم راحة' : r.status === 'absent' ? 'غياب' : (r.status || 'present')}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Absence Detection Tab */}
      {tab === 'absence' && isAdmin && (
        <div>
          <div style={{ background: S.navy2, borderRadius: 14, border: `1px solid ${S.border}`, padding: 20, marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: S.gold, marginBottom: 6 }}>🔍 كشف الغياب التلقائي</div>
            <div style={{ fontSize: 11, color: S.muted, marginBottom: 14, lineHeight: 1.7 }}>
              يقارن كل يوم كان مجدولاً فيه شيفت للموظف بسجلات الحضور الفعلية، ويستبعد أي يوم سُجِّل غياب له بالفعل.
              النتيجة قايمة مراجعة فقط — <b style={{ color: S.red }}>لا توجد أي حالة متحددة تلقائياً</b>، اختار يدوياً فقط الذي متأكد منه فعلاً قبل ما تأكّد.
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <input type="month" style={{ ...inp2, width: 160 }} value={absenceMonth} onChange={e => setAbsenceMonth(e.target.value)} disabled={detectingAbsence} />
              <button
                onClick={detectMissingAttendance}
                disabled={detectingAbsence}
                style={{ padding: '8px 18px', borderRadius: 10, border: `1px solid ${S.gold}`, background: S.gold3, color: S.gold, cursor: detectingAbsence ? 'default' : 'pointer', fontSize: 12, fontWeight: 700, fontFamily: 'Tajawal, sans-serif', opacity: detectingAbsence ? 0.6 : 1 }}
              >{detectingAbsence ? '⏳ جاري الفحص...' : '🔍 ابدأ الكشف'}</button>
            </div>
          </div>

          {hasRunDetection && (() => {
            const activeFiltered = hideInactiveEmps ? missingRows.filter(m => m.isActive) : missingRows
            const searchTerm = absenceSearch.trim().toLowerCase()
            const visibleRows = searchTerm
              ? activeFiltered.filter(m => m.empName.toLowerCase().includes(searchTerm) || m.empNumber.toLowerCase().includes(searchTerm))
              : activeFiltered
            const inactiveCount = missingRows.length - missingRows.filter(m => m.isActive).length
            return missingRows.length === 0 ? (
              <div style={{ background: S.greenB, border: `1px solid ${S.green}40`, borderRadius: 14, padding: 24, textAlign: 'center', color: S.green, fontSize: 13, fontWeight: 700 }}>
                ✅ لا يوجد أي غياب غير مسجَّل لموظف نشط — كل يوم فيه شيفت مجدول إما سُجِّل فيه حضور أو غياب بالفعل.
                {inactiveCount > 0 && <div style={{ marginTop: 8, color: S.muted, fontWeight: 400, fontSize: 11 }}>(يوجد {inactiveCount} حالة لموظفين غير نشطين مخفية — فعّل الفلتر أدناه لعرضهم)</div>}
              </div>
            ) : (
              <div style={{ background: S.navy2, borderRadius: 14, border: `1px solid ${S.border}`, overflow: 'hidden' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', borderBottom: `1px solid ${S.border}`, flexWrap: 'wrap', gap: 10 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ fontSize: 12, color: S.amber, fontWeight: 700 }}>
                      ⚠️ {visibleRows.length} حالة محتملة — {selectedMissing.size} محددة الآن
                    </div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: S.muted, cursor: 'pointer' }}>
                      <input type="checkbox" checked={hideInactiveEmps} onChange={e => setHideInactiveEmps(e.target.checked)} />
                      إخفاء الموظفين غير النشطين ({inactiveCount} حالة مخفية)
                    </label>
                  </div>
                  <input
                    style={{ ...inp2, width: 220 }}
                    placeholder="🔍 دوّر باسم الموظف أو رقمه..."
                    value={absenceSearch}
                    onChange={e => setAbsenceSearch(e.target.value)}
                  />
                  <button
                    onClick={confirmSelectedAbsences}
                    disabled={confirmingAbsence || selectedMissing.size === 0}
                    style={{ padding: '8px 18px', borderRadius: 10, border: `1px solid ${S.red}`, background: S.redB, color: S.red, cursor: (confirmingAbsence || selectedMissing.size === 0) ? 'default' : 'pointer', fontSize: 12, fontWeight: 700, fontFamily: 'Tajawal, sans-serif', opacity: (confirmingAbsence || selectedMissing.size === 0) ? 0.5 : 1 }}
                  >{confirmingAbsence ? '⏳ جاري التسجيل...' : `✅ تأكيد ${selectedMissing.size} غياب وتسجيلهم`}</button>
                </div>
                {visibleRows.length === 0 ? (
                  <div style={{ padding: 24, textAlign: 'center', color: S.muted, fontSize: 12 }}>لا توجد نتايج مطابقة للبحث.</div>
                ) : (
                <div style={{ maxHeight: 480, overflowY: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        {['', 'التاريخ', 'الموظف', 'رقم الموظف', 'الشيفت المجدول'].map(h => (
                          <th key={h} style={{ position: 'sticky', top: 0, background: S.navy3, padding: '8px 12px', fontSize: 11, color: S.muted, textAlign: 'center', border: `1px solid ${S.border}` }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {visibleRows.map(m => {
                        const key = `${m.employee_id}|${m.date}`
                        const checked = selectedMissing.has(key)
                        return (
                          <tr key={key} onClick={() => toggleMissingRow(key)} style={{ cursor: 'pointer', background: checked ? 'rgba(239,68,68,0.06)' : undefined }}>
                            <td style={{ padding: '8px 12px', border: `1px solid ${S.border}`, textAlign: 'center' }}>
                              <input type="checkbox" checked={checked} onChange={() => toggleMissingRow(key)} onClick={e => e.stopPropagation()} />
                            </td>
                            <td style={{ padding: '8px 12px', border: `1px solid ${S.border}`, fontSize: 12, textAlign: 'center' }}>{m.date}</td>
                            <td style={{ padding: '8px 12px', border: `1px solid ${S.border}`, fontSize: 12 }}>
                              {m.empName}
                              {!m.isActive && <span style={{ marginRight: 6, fontSize: 10, color: S.muted, background: 'rgba(255,255,255,0.06)', borderRadius: 6, padding: '1px 6px' }}>غير نشط</span>}
                            </td>
                            <td style={{ padding: '8px 12px', border: `1px solid ${S.border}`, fontSize: 12, textAlign: 'center', color: S.muted }}>{m.empNumber}</td>
                            <td style={{ padding: '8px 12px', border: `1px solid ${S.border}`, fontSize: 12, textAlign: 'center' }}>{m.shiftLabel}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                )}
              </div>
            )
          })()}
        </div>
      )}

      {/* Attendance Health Check Tab — Admin only, all in English */}
      {tab === 'health' && isAdmin && (
        <div>
          <div style={{ background: S.navy2, borderRadius: 14, border: `1px solid ${S.border}`, padding: 20, marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: S.gold, marginBottom: 6 }}>🩺 Attendance Health Check</div>
            <div style={{ fontSize: 11, color: S.muted, marginBottom: 14, lineHeight: 1.7 }}>
              Compares each employee's scheduled shifts against their actual check-ins for the month, and splits employees
              with a large gap into 3 groups. This is a diagnostic tool only — it does not write anything to the database.
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <input type="month" style={{ ...inp2, width: 160 }} value={healthMonth} onChange={e => setHealthMonth(e.target.value)} disabled={checkingHealth} />
              <button
                onClick={runAttendanceHealthCheck}
                disabled={checkingHealth}
                style={{ padding: '8px 18px', borderRadius: 10, border: `1px solid ${S.gold}`, background: S.gold3, color: S.gold, cursor: checkingHealth ? 'default' : 'pointer', fontSize: 12, fontWeight: 700, fontFamily: 'Tajawal, sans-serif', opacity: checkingHealth ? 0.6 : 1 }}
              >{checkingHealth ? '⏳ Checking...' : '🩺 Run Health Check'}</button>
              {hasRunHealth && (
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: S.muted, cursor: 'pointer' }}>
                  <input type="checkbox" checked={healthHideInactive} onChange={e => setHealthHideInactive(e.target.checked)} />
                  Hide inactive employees
                </label>
              )}
            </div>
          </div>

          {hasRunHealth && (() => {
            const RECENT_DAYS = 7
            const cutoff = new Date(healthEndDate)
            cutoff.setUTCDate(cutoff.getUTCDate() - RECENT_DAYS)
            const cutoffStr = cutoff.toISOString().slice(0, 10)

            const filtered = healthHideInactive ? healthRows.filter(r => r.is_active) : healthRows
            // ✅ ليس كفاية إن آخر تسجيل يكون قريب — لازم كذلك نسبة الحضور تكون معقولة، وإلا موظف حضر يومين فقط بالصدفة
            // آخرهم قريب من نهاية الفترة هيتصنّف غلط "نمط طبيعي" رغم إنه فعلياً غياب شبه كامل
            const MIN_ATTENDANCE_RATIO = 0.5
            const isRecent = (r: typeof healthRows[number]) => !!r.lastCheckin && r.lastCheckin >= cutoffStr
            const hasReasonableRatio = (r: typeof healthRows[number]) => r.scheduledDays > 0 && (r.attendedDays / r.scheduledDays) >= MIN_ATTENDANCE_RATIO
            const group1 = filtered.filter(r => r.attendedDays === 0)
            const group2 = filtered.filter(r => r.attendedDays > 0 && !(isRecent(r) && hasReasonableRatio(r)))
            const group3 = filtered.filter(r => r.attendedDays > 0 && isRecent(r) && hasReasonableRatio(r))

            const renderGroup = (title: string, desc: string, color: string, bg: string, rows: typeof healthRows) => (
              <div style={{ background: S.navy2, borderRadius: 14, border: `1px solid ${S.border}`, overflow: 'hidden', marginBottom: 20 }}>
                <div style={{ padding: '14px 18px', borderBottom: `1px solid ${S.border}`, background: bg }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color }}>{title} — {rows.length} employee{rows.length !== 1 ? 's' : ''}</div>
                  <div style={{ fontSize: 11, color: S.muted, marginTop: 2 }}>{desc}</div>
                </div>
                {rows.length === 0 ? (
                  <div style={{ padding: 18, textAlign: 'center', color: S.muted, fontSize: 12 }}>No employees in this group.</div>
                ) : (
                  <div style={{ maxHeight: 340, overflowY: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr>
                          {['Employee', 'ID', 'Department', 'Scheduled', 'Attended', 'Missing', 'Last Check-in', 'Status'].map(h => (
                            <th key={h} style={{ position: 'sticky', top: 0, background: S.navy3, padding: '7px 10px', fontSize: 10, color: S.muted, textAlign: 'center', border: `1px solid ${S.border}` }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map(r => (
                          <tr key={r.employee_id}>
                            <td style={{ padding: '7px 10px', border: `1px solid ${S.border}`, fontSize: 12 }}>{r.name}</td>
                            <td style={{ padding: '7px 10px', border: `1px solid ${S.border}`, fontSize: 12, textAlign: 'center', color: S.muted }}>{r.employee_number}</td>
                            <td style={{ padding: '7px 10px', border: `1px solid ${S.border}`, fontSize: 12, textAlign: 'center' }}>{r.department}</td>
                            <td style={{ padding: '7px 10px', border: `1px solid ${S.border}`, fontSize: 12, textAlign: 'center' }}>{r.scheduledDays}</td>
                            <td style={{ padding: '7px 10px', border: `1px solid ${S.border}`, fontSize: 12, textAlign: 'center', color: S.green }}>{r.attendedDays}</td>
                            <td style={{ padding: '7px 10px', border: `1px solid ${S.border}`, fontSize: 12, textAlign: 'center', color: S.red, fontWeight: 700 }}>{r.missingDays}</td>
                            <td style={{ padding: '7px 10px', border: `1px solid ${S.border}`, fontSize: 12, textAlign: 'center' }}>{r.lastCheckin || 'Never'}</td>
                            <td style={{ padding: '7px 10px', border: `1px solid ${S.border}`, fontSize: 11, textAlign: 'center' }}>
                              {r.is_active ? <span style={{ color: S.green }}>Active</span> : <span style={{ color: S.muted }}>Inactive</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )

            return filtered.length === 0 ? (
              <div style={{ background: S.greenB, border: `1px solid ${S.green}40`, borderRadius: 14, padding: 24, textAlign: 'center', color: S.green, fontSize: 13, fontWeight: 700 }}>
                ✅ No employees with a significant attendance gap (more than 5 missing days) this month.
              </div>
            ) : (
              <>
                {renderGroup(
                  '🔴 Zero Attendance',
                  'Scheduled every day but never checked in once — most likely a technical / app-usage issue, or the employee has actually left. Verify with their manager before assuming absence.',
                  S.red, S.redB, group1
                )}
                {renderGroup(
                  '🟡 Stopped Mid-Month / Low Attendance',
                  `Either stopped checking in completely (no check-in in the last ${RECENT_DAYS} days of the period), or checked in on less than ${MIN_ATTENDANCE_RATIO * 100}% of scheduled days overall. Needs individual review.`,
                  S.amber, S.amberB, group2
                )}
                {renderGroup(
                  '🟢 Ongoing Pattern',
                  `Checking in recently (within the last ${RECENT_DAYS} days) AND attended at least ${MIN_ATTENDANCE_RATIO * 100}% of scheduled days — likely a mix of real absence and minor technical gaps.`,
                  S.blue, S.blueB, group3
                )}
              </>
            )
          })()}
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════
// Main Page
// ══════════════════════════════════════════
export default function AttendancePage() {
  const { isAr } = useLang()
  const { employee, permissions } = useAuth()
  const isManager = permissions?.all === true || ['branch_manager','kitchen_manager','hall_manager','bar_manager','kitchen_supervisor','hall_supervisor','bar_supervisor'].includes(employee?.role || '')

  return (
    <div style={{ fontFamily: 'Tajawal, sans-serif', direction: 'rtl', color: S.white }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        select option { background: #0F2040; color: #FAFAF8; }
        input[type="date"]::-webkit-calendar-picker-indicator,
        input[type="month"]::-webkit-calendar-picker-indicator { filter: invert(1); }
      `}</style>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: S.white, marginBottom: 4 }}>
            {isManager ? '📊 Attendance Management' : '⏰ My Attendance'}
          </h1>
          <p style={{ fontSize: 13, color: S.muted }}>
            {isManager ? 'Track and manage employee attendance by branch' : 'Check in and out using your location'}
          </p>
        </div>
      </div>

      <MyAttendanceCard />
      {isManager && <div style={{ marginTop: 32 }}><AdminAttendanceView empInfo={employee} /></div>}
    </div>
  )
}

