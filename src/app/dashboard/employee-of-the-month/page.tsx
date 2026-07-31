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
  gold: '#C9A84C', gold2: '#E8C97A', gold3: 'rgba(201,168,76,0.12)', goldB: 'rgba(201,168,76,0.22)',
  white: '#FAFAF8', muted: '#8A9BB5', border: 'rgba(255,255,255,0.08)',
  green: '#22C55E', greenB: 'rgba(34,197,94,0.12)',
  blue: '#3B82F6', blueB: 'rgba(59,130,246,0.12)',
  amber: '#F59E0B', amberB: 'rgba(245,158,11,0.12)',
  card: 'rgba(255,255,255,0.04)',
}

const MONTH_NAMES_AR = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر']
const MONTH_NAMES_EN = ['January','February','March','April','May','June','July','August','September','October','November','December']

type Candidate = {
  employeeId: string
  name: string
  nameEn?: string
  photoUrl?: string
  branchName: string
  department?: string
  evaluationScore: number
  attendanceRate: number
  combinedScore: number
}

export default function EmployeeOfTheMonthPage() {
  const sbRef = useRef(createClient())
  const sb = sbRef.current
  const { employee } = useAuth()

  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 860)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // الشهر المستهدف = الشهر السابق (لو نحن في يوليو، نعرض يونيو)، مع معالجة صحيحة لعبور السنة
  const now = new Date()
  const targetMonth = now.getMonth() === 0 ? 12 : now.getMonth()
  const targetYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear()

  const [loading, setLoading] = useState(true)
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([])
  const [branchFilter, setBranchFilter] = useState('')

  // النظام يبدأ رسميًا من ١ أغسطس ٢٠٢٦ - قبل ذلك تظهر شاشة عد تنازلي بدل النتائج الفعلية
  const LAUNCH_DATE = new Date(2026, 7, 1, 0, 0, 0)
  const [isLaunched, setIsLaunched] = useState(() => new Date() >= LAUNCH_DATE)
  const [countdown, setCountdown] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 })

  useEffect(() => {
    if (isLaunched) return
    const tick = () => {
      const diff = LAUNCH_DATE.getTime() - new Date().getTime()
      if (diff <= 0) { setIsLaunched(true); return }
      setCountdown({
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((diff / (1000 * 60)) % 60),
        seconds: Math.floor((diff / 1000) % 60),
      })
    }
    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [isLaunched])

  const fetchData = useCallback(async () => {
    setLoading(true)
    const daysInMonth = new Date(targetYear, targetMonth, 0).getDate()
    const monthStart = `${targetYear}-${String(targetMonth).padStart(2, '0')}-01`
    const monthEnd = `${targetYear}-${String(targetMonth).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`

    const [evalRes, attRes, branchRes] = await Promise.all([
      sb.from('employee_evaluations')
        // ✅ Fix: تحديد الرابط الصريح (employee_id_fkey) لتجنب التضارب مع رابط evaluator_id
        .select('employee_id, total_score, employees!employee_evaluations_employee_id_fkey(name, name_en, photo_url, branch_id, department, is_active, branches(name))')
        .eq('month', targetMonth).eq('year', targetYear).eq('status', 'approved'),
      // ✅ Fix حرج جدًا: الاستعلام مكنش فيه أي .limit() صريح، فـ Supabase كان بيرجّع 1000 صف بس كحد
      // أقصى افتراضي (سلوك النظام العام) - لكن شهر واحد بيحتوي على آلاف صفوف الحضور لكل الموظفين مجتمعين
      // (2700+ صف في يوليو مثلًا)، فكانت البيانات بتتقطع، وأي موظف صفوفه وقعت بعد أول 1000 صف كان
      // يظهر حضوره أقل بكتير من الحقيقة (زي نسبة 32% بدل 93% الحقيقية)
      sb.from('attendance').select('employee_id, date, check_in_time').gte('date', monthStart).lte('date', monthEnd).limit(20000),
      sb.from('branches').select('id, name').eq('is_active', true).order('name'),
    ])
    setBranches(branchRes.data || [])

    // نسبة الحضور = عدد الأيام التي سجّل فيها دخولًا ÷ عدد أيام الشهر × 100
    const attendanceByEmp: Record<string, Set<string>> = {}
    for (const a of (attRes.data || [])) {
      if (!a.check_in_time) continue
      if (!attendanceByEmp[a.employee_id]) attendanceByEmp[a.employee_id] = new Set()
      attendanceByEmp[a.employee_id].add(a.date)
    }

    const list: Candidate[] = []
    for (const row of (evalRes.data as any[]) || []) {
      const emp = row.employees
      if (!emp || emp.is_active === false) continue
      const daysPresent = attendanceByEmp[row.employee_id]?.size || 0
      const attendanceRate = Math.min(100, Math.round((daysPresent / daysInMonth) * 1000) / 10)
      const evaluationScore = Math.round((row.total_score || 0) * 10) / 10
      const combinedScore = Math.round(((attendanceRate + evaluationScore) / 2) * 10) / 10
      list.push({
        employeeId: row.employee_id, name: emp.name, nameEn: emp.name_en, photoUrl: emp.photo_url,
        branchName: emp.branches?.name || '—', department: emp.department,
        evaluationScore, attendanceRate, combinedScore,
      })
    }
    list.sort((a, b) => b.combinedScore - a.combinedScore)
    setCandidates(list)
    setLoading(false)
  }, [sb, targetMonth, targetYear])

  useEffect(() => { fetchData() }, [fetchData])

  const filtered = branchFilter ? candidates.filter(c => c.branchName === branches.find(b => b.id === branchFilter)?.name) : candidates
  const winner = filtered[0]

  // ✅ جديد: عداد تنازلي حي لإعلان الفايز القادم - بيحسب الوقت المتبقي لحد أول يوم في الشهر الجاي
  // (لحظة ما نتيجة الشهر الحالي تبقى متاحة وتظهر كـ"الموظف المثالي" الجديد)
  const nextAnnounceDate = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0)
  const [nextCountdown, setNextCountdown] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 })
  useEffect(() => {
    if (!isLaunched) return
    const tick = () => {
      const diff = nextAnnounceDate.getTime() - new Date().getTime()
      if (diff <= 0) { setNextCountdown({ days: 0, hours: 0, minutes: 0, seconds: 0 }); return }
      setNextCountdown({
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((diff / (1000 * 60)) % 60),
        seconds: Math.floor((diff / 1000) % 60),
      })
    }
    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [isLaunched])

  // قبل ١ أغسطس، نعرض شاشة "قريبًا" بعلامة استفهام وعداد تنازلي حي بدل النتائج الفعلية
  if (!isLaunched) {
    return (
      <div style={{ fontFamily: 'Tajawal, sans-serif', direction: 'rtl', color: S.white, padding: isMobile ? 16 : 28, maxWidth: 700, margin: '0 auto', minHeight: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&display=swap');`}</style>
        <div style={{
          background: `linear-gradient(160deg, ${S.navy2}, ${S.navy3})`, borderRadius: 24,
          border: `2px dashed ${S.gold}`, padding: isMobile ? 32 : 48, textAlign: 'center', width: '100%',
        }}>
          <div style={{ fontSize: 72, marginBottom: 16, color: S.gold }}>❓</div>
          <div style={{ fontSize: isMobile ? 22 : 28, fontWeight: 900, color: S.gold, marginBottom: 2 }}>🏆 الموظف المثالي</div>
          <div style={{ fontSize: 14, color: S.gold2, fontWeight: 700, fontFamily: 'system-ui, sans-serif', marginBottom: 20 }}>Employee of the Month</div>
          <div style={{ fontSize: 14, color: S.muted, marginBottom: 8, lineHeight: 1.8 }}>
            نظام تكريم الموظف المثالي سيبدأ رسميًا مع أول تقييم شهري بداية من شهر أغسطس<br />
            ترقّبوا الإعلان عن أول موظف مثالي قريبًا!
          </div>
          <div style={{ fontSize: 12, color: S.muted, fontFamily: 'system-ui, sans-serif', marginBottom: 32, lineHeight: 1.7 }}>
            The Employee of the Month program officially launches with the first monthly evaluation in August.<br />
            Stay tuned for the first announcement soon!
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            {[
              { ar: 'يوم', en: 'Days', value: countdown.days },
              { ar: 'ساعة', en: 'Hours', value: countdown.hours },
              { ar: 'دقيقة', en: 'Minutes', value: countdown.minutes },
              { ar: 'ثانية', en: 'Seconds', value: countdown.seconds },
            ].map((u, i) => (
              <div key={i} style={{ background: S.card, borderRadius: 14, padding: isMobile ? '12px 14px' : '16px 20px', minWidth: isMobile ? 64 : 80 }}>
                <div style={{ fontSize: isMobile ? 24 : 32, fontWeight: 900, color: S.white, fontVariantNumeric: 'tabular-nums' }}>{String(u.value).padStart(2, '0')}</div>
                <div style={{ fontSize: 11, color: S.muted, marginTop: 4 }}>{u.ar}</div>
                <div style={{ fontSize: 9, color: S.muted, fontFamily: 'system-ui, sans-serif' }}>{u.en}</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 12, color: S.gold, marginTop: 24, fontWeight: 700 }}>📅 موعد الانطلاق: ١ أغسطس ٢٠٢٦</div>
          <div style={{ fontSize: 11, color: S.gold2, fontFamily: 'system-ui, sans-serif', marginTop: 2 }}>Launch date: August 1, 2026</div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ fontFamily: 'Tajawal, sans-serif', direction: 'rtl', color: S.white, padding: isMobile ? 16 : 28, maxWidth: 900, margin: '0 auto' }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&family=Playfair+Display:ital,wght@1,600&display=swap'); select option { background: ${S.navy2}; color: ${S.white}; }`}</style>

      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <div style={{ fontSize: isMobile ? 26 : 32, fontWeight: 900, color: S.gold, marginBottom: 2 }}>🏆 الموظف المثالي</div>
        <div style={{ fontSize: isMobile ? 14 : 16, color: S.gold2, fontWeight: 700, fontFamily: 'system-ui, sans-serif', marginBottom: 8 }}>Employee of the Month</div>
        <div style={{ fontSize: 14, color: S.muted }}>عن شهر {MONTH_NAMES_AR[targetMonth - 1]} {targetYear}</div>
        <div style={{ fontSize: 11, color: S.muted, fontFamily: 'system-ui, sans-serif' }}>For {MONTH_NAMES_EN[targetMonth - 1]} {targetYear}</div>
      </div>

      {branches.length > 0 && (
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 24, flexWrap: 'wrap' }}>
          <button onClick={() => setBranchFilter('')}
            style={{ padding: '8px 16px', borderRadius: 10, border: `1px solid ${!branchFilter ? S.gold : S.border}`, background: !branchFilter ? S.gold3 : 'transparent', color: !branchFilter ? S.gold : S.muted, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', fontWeight: !branchFilter ? 700 : 400 }}>
            🌐 كل الفروع · All Branches
          </button>
          {branches.map(b => (
            <button key={b.id} onClick={() => setBranchFilter(b.id)}
              style={{ padding: '8px 16px', borderRadius: 10, border: `1px solid ${branchFilter === b.id ? S.gold : S.border}`, background: branchFilter === b.id ? S.gold3 : 'transparent', color: branchFilter === b.id ? S.gold : S.muted, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', fontWeight: branchFilter === b.id ? 700 : 400 }}>
              🏪 {b.name}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: S.muted }}>
          <div>⏳ جاري التحميل...</div>
          <div style={{ fontSize: 12, fontFamily: 'system-ui, sans-serif', marginTop: 4 }}>Loading...</div>
        </div>
      ) : !winner ? (
        <div style={{ textAlign: 'center', padding: 60, background: S.navy2, borderRadius: 20, border: `1px solid ${S.border}`, color: S.muted }}>
          <div>لا توجد تقييمات معتمدة لشهر {MONTH_NAMES_AR[targetMonth - 1]} {targetYear} حتى الآن</div>
          <div style={{ fontSize: 12, fontFamily: 'system-ui, sans-serif', marginTop: 6 }}>No approved evaluations for {MONTH_NAMES_EN[targetMonth - 1]} {targetYear} yet</div>
        </div>
      ) : (
        <>
          {/* ── شهادة التكريم — Certificate of Appreciation ── */}
          <div style={{
            background: `linear-gradient(160deg, ${S.navy2}, ${S.navy3})`, borderRadius: 24,
            border: `2px solid ${S.gold}`, padding: isMobile ? 24 : 40, textAlign: 'center', position: 'relative', overflow: 'hidden', marginBottom: 24,
            boxShadow: '0 20px 60px rgba(201,168,76,0.15)',
          }}>
            <div style={{ position: 'absolute', top: -30, left: -30, fontSize: 140, opacity: 0.05 }}>🏆</div>
            <div style={{ position: 'absolute', bottom: -30, right: -30, fontSize: 140, opacity: 0.05 }}>⭐</div>

            <div style={{ fontSize: 13, color: S.gold, letterSpacing: 2, fontWeight: 700, marginBottom: 2 }}>✦ شهادة تقدير ✦</div>
            <div style={{ fontSize: 11, color: S.gold2, fontFamily: 'system-ui, sans-serif', letterSpacing: 1, marginBottom: 16 }}>CERTIFICATE OF APPRECIATION</div>

            {winner.photoUrl ? (
              <img src={winner.photoUrl} alt={winner.name} style={{ width: 110, height: 110, borderRadius: '50%', objectFit: 'cover', border: `3px solid ${S.gold}`, marginBottom: 16 }} />
            ) : (
              <div style={{ width: 110, height: 110, borderRadius: '50%', background: S.gold3, border: `3px solid ${S.gold}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40, fontWeight: 900, color: S.gold, margin: '0 auto 16px' }}>
                {winner.name.charAt(0)}
              </div>
            )}

            <div style={{ fontSize: isMobile ? 24 : 30, fontWeight: 900, color: S.white, marginBottom: 4 }}>{winner.name}</div>
            {winner.nameEn && <div style={{ fontSize: 13, color: S.muted, marginBottom: 8, fontFamily: 'system-ui, sans-serif' }}>{winner.nameEn}</div>}
            <div style={{ fontSize: 12, color: S.gold, marginBottom: 2 }}>🏪 {winner.branchName} {winner.department && `— ${winner.department}`}</div>
            <div style={{ fontSize: 10, color: S.muted, fontFamily: 'system-ui, sans-serif', marginBottom: 24 }}>Branch{winner.department ? ' & Department' : ''}</div>

            {/* النسب المئوية — Percentages */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, maxWidth: 480, margin: '0 auto 28px' }}>
              <div style={{ background: S.card, borderRadius: 14, padding: '14px 8px' }}>
                <div style={{ fontSize: isMobile ? 20 : 26, fontWeight: 900, color: S.blue }}>{winner.attendanceRate}%</div>
                <div style={{ fontSize: 10, color: S.muted, marginTop: 2 }}>نسبة الحضور</div>
                <div style={{ fontSize: 9, color: S.muted, fontFamily: 'system-ui, sans-serif' }}>Attendance Rate</div>
              </div>
              <div style={{ background: S.card, borderRadius: 14, padding: '14px 8px' }}>
                <div style={{ fontSize: isMobile ? 20 : 26, fontWeight: 900, color: S.green }}>{winner.evaluationScore}%</div>
                <div style={{ fontSize: 10, color: S.muted, marginTop: 2 }}>نسبة التقييم</div>
                <div style={{ fontSize: 9, color: S.muted, fontFamily: 'system-ui, sans-serif' }}>Evaluation Score</div>
              </div>
              <div style={{ background: S.gold3, borderRadius: 14, padding: '14px 8px', border: `1px solid ${S.gold}40` }}>
                <div style={{ fontSize: isMobile ? 20 : 26, fontWeight: 900, color: S.gold }}>{winner.combinedScore}%</div>
                <div style={{ fontSize: 10, color: S.gold, marginTop: 2 }}>التقييم الإجمالي</div>
                <div style={{ fontSize: 9, color: S.gold, fontFamily: 'system-ui, sans-serif' }}>Overall Score</div>
              </div>
            </div>

            {/* رسالة الشكر والتوقيع — Thank-you message & signature */}
            <div style={{ borderTop: `1px solid ${S.border}`, paddingTop: 20, maxWidth: 520, margin: '0 auto' }}>
              <div style={{ fontSize: 14, color: S.white, lineHeight: 1.9 }}>
                تقديرًا لجهودك المتميزة والتزامك الرائع خلال شهر {MONTH_NAMES_AR[targetMonth - 1]}،
                نتقدم لك بخالص الشكر والتقدير، ونتمنى لك دوام التألق والنجاح.
              </div>
              <div style={{ fontSize: 12, color: S.muted, fontFamily: 'system-ui, sans-serif', lineHeight: 1.7, marginTop: 10 }}>
                In appreciation of your outstanding effort and dedication throughout {MONTH_NAMES_EN[targetMonth - 1]},
                we extend to you our sincere thanks, and wish you continued success.
              </div>
              <div style={{ marginTop: 20, fontFamily: "'Playfair Display', serif", fontStyle: 'italic', fontSize: 20, color: S.gold2 }}>
                د. علاء
              </div>
              <div style={{ fontSize: 10, color: S.muted, marginTop: 2 }}>بتوقيع الإدارة</div>
              <div style={{ fontSize: 9, color: S.muted, fontFamily: 'system-ui, sans-serif' }}>Signed by Management — Dr. Alaa</div>
            </div>
          </div>

          {/* ✅ جديد: عداد تنازلي للإعلان عن الموظف المثالي القادم - بدل قائمة باقي الترشيحات */}
          <div style={{ background: S.navy2, borderRadius: 20, border: `1px solid ${S.border}`, padding: isMobile ? 20 : 28, textAlign: 'center' }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: S.gold, marginBottom: 2 }}>⏳ العد التنازلي للموظف المثالي القادم</div>
            <div style={{ fontSize: 11, color: S.muted, fontFamily: 'system-ui, sans-serif', marginBottom: 18 }}>Countdown to Next Employee of the Month</div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: isMobile ? 10 : 16 }}>
              {[
                { ar: 'يوم', en: 'Days', value: nextCountdown.days },
                { ar: 'ساعة', en: 'Hours', value: nextCountdown.hours },
                { ar: 'دقيقة', en: 'Minutes', value: nextCountdown.minutes },
                { ar: 'ثانية', en: 'Seconds', value: nextCountdown.seconds },
              ].map(u => (
                <div key={u.en} style={{ background: S.card, borderRadius: 14, padding: isMobile ? '12px 10px' : '16px 18px', minWidth: isMobile ? 60 : 76 }}>
                  <div style={{ fontSize: isMobile ? 22 : 30, fontWeight: 900, color: S.gold, fontVariantNumeric: 'tabular-nums' }}>{String(u.value).padStart(2, '0')}</div>
                  <div style={{ fontSize: 10, color: S.muted, marginTop: 2 }}>{u.ar}</div>
                  <div style={{ fontSize: 8, color: S.muted, fontFamily: 'system-ui, sans-serif' }}>{u.en}</div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
