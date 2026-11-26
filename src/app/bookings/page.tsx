'use client'

import { useState, useRef, useEffect } from 'react'
import { createBrowserClient } from '@supabase/ssr'

const createClient = () => createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const C = {
  bg: '#0A0F1A', bg2: '#0F1825', bg3: '#141F30',
  blue1: '#3B9FE5', blue2: '#1A6BB5',
  silver: '#B8C5D6', silver2: '#8A9BB5',
  white: '#FFFFFF', white2: '#E8EDF5',
  green: '#22C55E', greenB: 'rgba(34,197,94,0.15)',
  red: '#EF4444', redB: 'rgba(239,68,68,0.12)',
  amber: '#F59E0B', amberB: 'rgba(245,158,11,0.12)',
  border: 'rgba(59,159,229,0.15)', border2: 'rgba(59,159,229,0.3)',
  glow: 'rgba(59,159,229,0.2)',
}

// ✅ جديد: أيقونة موحّدة باللون الأبيض — بعض الإيموجي (مثل 📅🕐👥📍🏪) كانت تظهر بألوانها
// الافتراضية (أسود/أزرق) وتضيع على الخلفية الداكنة؛ الفلتر يحوّلها لأيقونة بيضاء واضحة دائمًا
function Icon({ children, size = 16 }: { children: React.ReactNode; size?: number }) {
  return <span style={{ filter: 'brightness(0) invert(1)', fontSize: size, display: 'inline-block', lineHeight: 1, verticalAlign: 'middle' }}>{children}</span>
}

// تذييل صفحة الحجز: رابط موقع المطعم + «Powered by BidLX» (يظهر في كل مراحل الحجز وشاشة التأكيد)
function BookingFooter() {
  return (
    <div style={{ maxWidth: 560, margin: '0 auto', padding: '8px 16px 28px', textAlign: 'center' }}>
      <a href="https://restaurantorchid.com" target="_blank" rel="noopener noreferrer"
        style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: C.blue1, textDecoration: 'none', fontSize: 13, fontWeight: 700, padding: '10px 18px', borderRadius: 999, border: `1px solid ${C.border2}`, background: 'rgba(59,159,229,.08)' }}>
        <Icon size={14}>🌐</Icon> Visit our website · زوروا موقعنا
        <span style={{ color: C.silver2, fontWeight: 500 }} dir="ltr">restaurantorchid.com</span>
      </a>
      <div style={{ marginTop: 18, fontSize: 12, color: C.silver2 }}>
        Powered by{' '}
        <a href="https://bidlx.com" target="_blank" rel="noopener noreferrer" style={{ color: C.white, fontWeight: 800, textDecoration: 'none', letterSpacing: 0.3 }}>BidLX</a>
      </div>
    </div>
  )
}

const SECTIONS = [
  { key: 'outdoor', label: 'Outdoor Hall',  labelAr: 'الصالة الخارجية',         icon: '🌿', color: C.green },
  { key: 'indoor',  label: 'Indoor Hall',   labelAr: 'الصالة الداخلية المكيفة', icon: '❄️', color: C.blue1 },
  { key: 'upstairs',label: 'Upstairs',      labelAr: 'الطابق العلوي',           icon: '🌅', color: C.amber },
]

// menu: منيو الفرع في دليل بدلكس (يُسبَق بلغة الزائر ar أو en) — نفس الروابط المستخدمة في موقع المطعم
type BranchInfo = { ar: string; en: string; location: string; area: string; menu: string }
const BRANCH_NAMES: Record<string, BranchInfo> = {
  '783bc0ec-16f5-4e6c-9148-9c30b12d42c2': { ar: 'أوركيد هاوس', en: 'Orchid House', location: 'Lorong Raja Uda', area: 'Kampung Baru', menu: 'directory/orchid/house' },
  '9375998c-0a98-48c8-be7a-485e0c616ae1': { ar: 'أوركيد كي إل سي سي', en: 'Orchid KLCC', location: 'Lorong Yap Kwan Seng', area: 'KLCC', menu: 'directory/orchid/klcc' },
}
const branchMenuUrl = (path: string) => {
  const arabic = typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('ar')
  return `https://app.bidlx.com/${arabic ? 'ar' : 'en'}/${path}`
}
function BranchMenuButton({ branch }: { branch: BranchInfo }) {
  return (
    <a href={branchMenuUrl(branch.menu)} target="_blank" rel="noopener noreferrer"
      style={{ display: 'block', textAlign: 'center', background: `linear-gradient(135deg,${C.blue1},${C.blue2})`, borderRadius: 14, padding: '10px 16px', color: C.white, textDecoration: 'none', fontWeight: 800, fontSize: 14, lineHeight: 1.7, boxShadow: `0 6px 20px ${C.glow}` }}>
      {branch.en} Menu
      <span dir="rtl" style={{ display: 'block', fontSize: 13, fontWeight: 700 }}>منيو {branch.ar}</span>
    </a>
  )
}

// ✅ جديد: سياسات خاصة بفرع أوركيد هاوس فقط (سعة كل قسم + قيد وقت الطابق العلوي) — لا تنطبق على KLCC
const ORCHID_HOUSE_ID = '783bc0ec-16f5-4e6c-9148-9c30b12d42c2'
// أقل وقت مسموح لحجز "الطابق العلوي" في أوركيد هاوس (24h، مقارنة نصية بسيطة HH:MM)
const UPSTAIRS_MIN_TIME = '19:00'
const SECTION_POLICY: Record<string, { en: string; ar: string }> = {
  outdoor: { en: 'Capacity: up to 100 guests', ar: 'السعة: حتى 100 شخص' },
  indoor:  { en: 'Capacity: up to 100 guests', ar: 'السعة: حتى 100 شخص' },
  upstairs:{ en: `Capacity: 15–20 guests · Bookings from ${UPSTAIRS_MIN_TIME} onwards only`, ar: `السعة: 15–20 شخص · الحجز متاح فقط من الساعة 7:00 مساءً` },
}
type Phase = 'branch' | 'date' | 'section' | 'details' | 'done'
type Branch = { id: string; name: string; location: string; image_url?: string | null }
// صور الأقسام (Indoor/Outdoor/Upstairs) التي يرفعها المدير من صفحة "🏪 صور الفروع"
type SectionPhoto = { branch_id: string; section: string; image_url: string | null }
// ✅ جديد: الأيام المُغلقة للحجز لكل فرع — يديرها مدير النظام فقط من صفحة "حجوزات العملاء"
type ClosedDay = { branch_id: string; closed_date: string; note: string | null }
type ClosedSection = { branch_id: string; closed_date: string; section: string }

export default function BookingPage() {
  const sbRef = useRef(createClient())
  const sb = sbRef.current

  const [phase, setPhase] = useState<Phase>('branch')
  const [branches, setBranches] = useState<Branch[]>([])
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null)
  const [bookingDate, setBookingDate] = useState('')
  const [section, setSection] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [bookingRef, setBookingRef] = useState('')
  const [form, setForm] = useState({ name: '', email: '', phone: '', date: '', time: '', guests: '', notes: '' })

  useEffect(() => { if (bookingDate) setForm(p => ({ ...p, date: bookingDate })) }, [bookingDate])
  const [errors, setErrors] = useState<Record<string, string>>({})

  // ✅ صور الأقسام — تُجلب مرة واحدة، fail-open
  const [sectionPhotos, setSectionPhotos] = useState<SectionPhoto[]>([])

  async function fetchBranches() {
    // ✅ select('*') بدل تحديد الأعمدة: fail-open لو عمود image_url لسه ما اتضافش (قبل تشغيل SQL)
    const { data } = await sb.from('branches').select('*').eq('is_active', true).order('name', { ascending: false })
    setBranches(data || [])
  }

  async function fetchSectionPhotos() {
    // fail-open: لو جدول booking_section_photos لسه ما اتعملش، نتجاهل الخطأ بدون كسر الصفحة
    const { data, error } = await sb.from('booking_section_photos').select('*')
    if (!error && data) setSectionPhotos(data as SectionPhoto[])
  }

  const [closedDays, setClosedDays] = useState<ClosedDay[]>([])
  async function fetchClosedDays() {
    // fail-open: لو جدول booking_closed_days لسه ما اتعملش، نتجاهل الخطأ بدون كسر الصفحة
    const { data, error } = await sb.from('booking_closed_days').select('branch_id,closed_date,note')
    if (!error && data) setClosedDays(data as ClosedDay[])
  }
  // ✅ جديد: أقسام مغلقة لتاريخ معيّن (الأدمن/مشرف الصالة بيقفلها من لوحة التحكم) — القسم المغلق مايظهرش للعميل
  const [closedSections, setClosedSections] = useState<ClosedSection[]>([])
  async function fetchClosedSections() {
    // fail-open: لو جدول booking_closed_sections لسه ما اتعملش، نتجاهل الخطأ بدون كسر الصفحة
    const { data, error } = await sb.from('booking_closed_sections').select('branch_id,closed_date,section')
    if (!error && data) setClosedSections(data as ClosedSection[])
  }
  function isSectionClosed(branchId: string | undefined, date: string, sec: string): boolean {
    if (!branchId || !date) return false
    return closedSections.some(d => d.branch_id === branchId && d.closed_date === date && d.section === sec)
  }
  // ✅ هل هذا التاريخ مغلق للحجز في الفرع المختار؟
  function isDateClosed(branchId: string | undefined, date: string): boolean {
    if (!branchId || !date) return false
    return closedDays.some(d => d.branch_id === branchId && d.closed_date === date)
  }

  useEffect(() => { fetchBranches(); fetchSectionPhotos(); fetchClosedDays(); fetchClosedSections() }, [])

  // دعم زر الرجوع في المتصفح
  useEffect(() => {
    window.history.pushState({ phase }, '', window.location.pathname)
  }, [phase])

  useEffect(() => {
    const handlePop = (e: PopStateEvent) => {
      const prev = e.state?.phase
      if (prev) setPhase(prev as Phase)
      else setPhase('branch')
    }
    window.addEventListener('popstate', handlePop)
    return () => window.removeEventListener('popstate', handlePop)
  }, [])

  // ✅ Fix per user request: العميل لم يعد يختار طاولة بعينها (كان يلخبط العملاء) — يختار القسم
  // فقط، والموظف يحدد رقم الطاولة الفعلي لاحقًا من صفحة الحجوزات في لوحة التحكم
  function pickSection(sec: string) {
    setSection(sec)
    setPhase('details')
  }

  function validate() {
    const e: Record<string, string> = {}
    if (!form.name.trim()) e.name = 'Name is required'
    if (!form.email.trim() || !form.email.includes('@')) e.email = 'Valid email is required'
    if (!form.phone.trim() || form.phone.length < 8) e.phone = 'Valid phone number is required'
    if (!form.date) e.date = 'Date is required'
    if (!form.time) e.time = 'Time is required'
    if (form.date && new Date(form.date) < new Date(new Date().toDateString())) e.date = 'Date cannot be in the past'
    // ✅ جديد: منع الحجز لو الأدمن أغلق هذا اليوم لهذا الفرع
    if (form.date && isDateClosed(selectedBranch?.id, form.date)) e.date = 'This date is not available for booking · هذا التاريخ غير متاح للحجز'
    if (!form.guests || parseInt(form.guests) < 1) e.guests = 'Please enter the number of guests'
    // ✅ جديد: الطابق العلوي في أوركيد هاوس متاح فقط لحجوزات الساعة 7 مساءً فأكثر
    if (selectedBranch?.id === ORCHID_HOUSE_ID && section === 'upstairs' && form.time && form.time < UPSTAIRS_MIN_TIME) {
      e.time = `Upstairs bookings are only available from ${UPSTAIRS_MIN_TIME} onwards`
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function submit() {
    if (!validate()) return
    setSubmitting(true)
    // ✅ إنشاء الحجز يمرّ من السيرفر (مفتاح service-role)
    let newId: string | null = null
    let newRef: string | null = null
    try {
      const res = await fetch('/api/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'submit',
          booking: {
            customer_name: form.name,
            customer_email: form.email,
            customer_phone: form.phone,
            booking_date: form.date,
            booking_time: form.time,
            guests: parseInt(form.guests) || 2,
            branch_id: selectedBranch?.id || null,
            section,
            table_id: null,
            table_number: null,
            notes: form.notes || null,
          },
        }),
      })
      const data = await res.json().catch(() => null)
      if (res.ok && data?.id) { newId = data.id; newRef = data.ref || null }
    } catch { /* يعالَج أدناه */ }

    if (!newId) { setSubmitting(false); alert('Error submitting booking. Please try again.'); return }
    setBookingRef(newRef || newId.slice(-8).toUpperCase())
    setPhase('done')
    setSubmitting(false)
  }

  const inp = (field: string): React.CSSProperties => ({
    width: '100%', background: 'rgba(255,255,255,.06)',
    border: `1px solid ${errors[field] ? C.red : C.border}`,
    borderRadius: 12, padding: '12px 16px', fontSize: 14,
    color: C.white, outline: 'none', boxSizing: 'border-box' as const,
    fontFamily: 'system-ui', caretColor: C.blue1,
  })

  const selectedSection = SECTIONS.find(s => s.key === section)

  // ══ Done ══
  // العميل يرسل لقطة من هذه الشاشة للمطعم، فالفرع (صورته واسمه) في أعلى البطاقة ومعه منيو الفرع نفسه
  const doneBranch = selectedBranch ? BRANCH_NAMES[selectedBranch.id] : undefined
  const doneBranchName = doneBranch?.en || selectedBranch?.name || ''
  if (phase === 'done') return (
    <div style={{ minHeight: '100dvh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: 'system-ui' }}>
      <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(30px)}to{opacity:1;transform:translateY(0)}} @keyframes glow{0%,100%{box-shadow:0 0 20px ${C.glow}}50%{box-shadow:0 0 40px rgba(59,159,229,.4)}}`}</style>
      <div style={{ maxWidth: 460, width: '100%', textAlign: 'center', animation: 'fadeUp .6s ease' }}>
        <div style={{ background: C.bg2, borderRadius: 24, border: `1px solid ${C.border2}`, overflow: 'hidden', animation: 'glow 2s ease infinite' }}>
          <div style={{ position: 'relative', height: 150, background: `linear-gradient(135deg, ${C.blue1}33, ${C.bg3})` }}>
            {selectedBranch?.image_url && (
              <img src={selectedBranch.image_url} alt={doneBranchName} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            )}
            <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '34px 16px 10px', background: 'linear-gradient(180deg, transparent, rgba(5,10,18,.78) 45%, rgba(5,10,18,.95))' }}>
              <div style={{ color: C.white, fontSize: 24, fontWeight: 900, lineHeight: 1.25 }}>{doneBranchName}</div>
              {doneBranch && <div dir="rtl" style={{ color: C.white2, fontSize: 15, fontWeight: 700, marginTop: 2 }}>{doneBranch.ar}</div>}
              <div style={{ color: C.silver, fontSize: 12, marginTop: 5 }}>
                <Icon size={11}>📍</Icon> {doneBranch ? `${doneBranch.location}, ${doneBranch.area}` : selectedBranch?.location}
              </div>
            </div>
          </div>
          <div style={{ padding: '16px 20px 20px' }}>
          {/* ✅ Fix: الشاشة كانت بتقول "Booking Confirmed" مع إن الحجز لسه "pending" فعليًا لحد ما فريق
              الحجوزات يراجعه ويوافق عليه — النص بقى يعكس الحالة الحقيقية، بالعربي والإنجليزي */}
          <div style={{ color: C.blue1, fontSize: 11, fontWeight: 700, letterSpacing: 4, textTransform: 'uppercase', marginBottom: 6 }}>Request Sent!</div>
          <h2 style={{ color: C.white, fontSize: 22, fontWeight: 900, margin: '0 0 4px' }}>Thank you, {form.name.split(' ')[0]}!</h2>
          <p style={{ color: C.silver2, fontSize: 12.5, margin: '0 0 12px', lineHeight: 1.6 }}>
            Your request has been sent to our bookings team. We'll contact you shortly to confirm your reservation.
            <br />تم إرسال طلبكم إلى قسم الحجوزات، وسيتم التواصل معكم في أقرب وقت لتأكيد الحجز.
          </p>
          <div style={{ background: 'rgba(59,159,229,.08)', border: `1px solid ${C.border2}`, borderRadius: 16, padding: '10px 16px', marginBottom: 12 }}>
            <div style={{ color: C.silver2, fontSize: 10, letterSpacing: 3, marginBottom: 2 }}>BOOKING REFERENCE</div>
            <div style={{ color: C.blue1, fontSize: 30, fontWeight: 900, letterSpacing: 5 }}>#{bookingRef}</div>
          </div>
          <div style={{ background: 'rgba(255,255,255,.03)', borderRadius: 14, padding: '6px 14px', textAlign: 'left' }}>
            {[
              { icon: '🏪', label: 'Branch · الفرع', value: doneBranchName },
              { icon: '📍', label: 'Section', value: selectedSection?.label },
              { icon: '📅', label: 'Date', value: new Date(form.date).toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) },
              { icon: '🕐', label: 'Time', value: form.time },
              { icon: '👥', label: 'Guests', value: `${form.guests} guests` },
            ].map((r, i) => (
              <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '5px 0', borderBottom: i < 4 ? `1px solid ${C.border}` : 'none' }}>
                <Icon size={18}>{r.icon}</Icon>
                <div>
                  <div style={{ color: C.silver2, fontSize: 10 }}>{r.label}</div>
                  <div style={{ color: C.white, fontSize: 13, fontWeight: 600 }}>{r.value}</div>
                </div>
              </div>
            ))}
          </div>
          {doneBranch && <div style={{ marginTop: 12 }}><BranchMenuButton branch={doneBranch} /></div>}
          </div>
        </div>
        <div style={{ marginTop: 22 }}><BookingFooter /></div>
      </div>
    </div>
  )


  return (
    <div style={{ minHeight: '100dvh', background: C.bg, fontFamily: 'system-ui', color: C.white, paddingBottom: 40 }}>
      <style>{`*{box-sizing:border-box;margin:0;padding:0} input,select,textarea{font-family:system-ui;} input::placeholder,textarea::placeholder{color:${C.silver2}} select option{background:${C.bg2};color:${C.white}}`}</style>

      {/* Header */}
      <div style={{ background: C.bg3, padding: '20px', borderBottom: `1px solid ${C.border}`, textAlign: 'center' }}>
        <div style={{ fontSize: 28, fontWeight: 900, color: C.white }}>ORCHID <span style={{ color: C.blue1 }}>GROUP</span></div>
        <div style={{ fontSize: 13, color: C.silver2, marginTop: 4 }}>Table Reservation</div>
      </div>

      <div style={{ maxWidth: 560, margin: '0 auto', padding: '24px 16px' }}>

        {/* Progress */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 28 }}>
          {['Branch', 'Date', 'Section', 'Details'].map((s, i) => {
            const phases = ['branch', 'date', 'section', 'details', 'done']
            const currentIdx = phases.indexOf(phase)
            const done = currentIdx > i
            const active = currentIdx === i
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, flex: i > 0 ? 1 : 'none' }}>
                {i > 0 && <div style={{ flex: 1, height: 1, background: done ? C.blue1 : C.border }} />}
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <div style={{ width: 22, height: 22, borderRadius: '50%', background: done || active ? C.blue1 : C.border, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: C.white, flexShrink: 0 }}>
                    {done ? '✓' : i + 1}
                  </div>
                  <span style={{ fontSize: 10, color: active ? C.white : C.silver2, whiteSpace: 'nowrap' }}>{s}</span>
                </div>
              </div>
            )
          })}
        </div>

        {/* ══ Step 0: Branch ══ */}
        {phase === 'branch' && (
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 6 }}>Choose Your Branch</h2>
            <p style={{ color: C.silver2, fontSize: 14, marginBottom: 24 }}>Select the branch you'd like to visit · اختر الفرع</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {branches.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 40, color: C.silver2 }}><Icon size={14}>⏳</Icon> Loading branches...</div>
              ) : branches.map(b => (
                <div key={b.id} onClick={() => { setSelectedBranch(b); setPhase('date') }}
                  style={{ background: C.bg2, border: `1.5px solid ${C.border}`, borderRadius: 18, padding: 14, cursor: 'pointer' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.border = `1.5px solid ${C.blue1}` }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.border = `1.5px solid ${C.border}` }}>
                  {/* ✅ صورة الفرع في إطار أنيق فوق الاسم — قبل ضبط الصورة (fail-open) تظهر أيقونة بديلة أنيقة */}
                  <div style={{ width: '100%', height: 150, borderRadius: 14, overflow: 'hidden', border: `1px solid ${C.border2}`, boxShadow: `0 8px 24px rgba(0,0,0,.35)`, marginBottom: 14, background: `linear-gradient(135deg, ${C.blue1}25, ${C.bg3})`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {b.image_url
                      ? <img src={b.image_url} alt={BRANCH_NAMES[b.id]?.en || b.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                      : <Icon size={40}>🏪</Icon>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 800, fontSize: 16, color: C.white, marginBottom: 2 }}>{BRANCH_NAMES[b.id]?.ar || b.name}</div>
                      <div style={{ fontSize: 13, color: C.silver2, marginBottom: 2 }}>{BRANCH_NAMES[b.id]?.en || ''}</div>
                      {(BRANCH_NAMES[b.id]?.location || b.location) && <div style={{ fontSize: 11, color: C.silver2, display: 'flex', alignItems: 'center', gap: 4 }}><Icon size={11}>📍</Icon> {BRANCH_NAMES[b.id]?.location || b.location}</div>}
                    </div>
                    <div style={{ color: C.silver2, fontSize: 20 }}>›</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ══ Step 1: Date ══ */}
        {phase === 'date' && (
          <div>
            <button onClick={() => setPhase('branch')} style={{ background: 'transparent', border: 'none', color: C.blue1, cursor: 'pointer', fontSize: 14, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>← Back</button>
            <div style={{ background: C.blue1 + '15', border: `1px solid ${C.blue1}40`, borderRadius: 14, padding: '12px 16px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
              <Icon size={22}>🏪</Icon>
              <div style={{ fontWeight: 700, color: C.white }}>{selectedBranch?.name}</div>
              {selectedBranch?.location && <div style={{ fontSize: 12, color: C.silver2, display: 'flex', alignItems: 'center', gap: 4 }}><Icon size={12}>📍</Icon> {selectedBranch.location}</div>}
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 6 }}>Choose a Date</h2>
            <p style={{ color: C.silver2, fontSize: 14, marginBottom: 24 }}>Select your preferred visit date · اختر تاريخ الزيارة</p>
            <div style={{ background: C.bg2, border: `1px solid ${C.border}`, borderRadius: 16, padding: 24 }}>
              <label style={{ fontSize: 13, color: C.silver2, display: 'block', marginBottom: 10 }}>Date · التاريخ</label>
              <input type="date" style={{ width: '100%', background: 'rgba(255,255,255,.06)', border: `1px solid ${bookingDate && isDateClosed(selectedBranch?.id, bookingDate) ? C.red : C.border}`, borderRadius: 12, padding: '14px 16px', fontSize: 16, color: C.white, outline: 'none', boxSizing: 'border-box' as const, fontFamily: 'system-ui', caretColor: C.blue1 }}
                value={bookingDate} min={new Date().toISOString().split('T')[0]}
                onChange={e => setBookingDate(e.target.value)} />
              {/* ✅ جديد: تنويه لو الأدمن أغلق هذا اليوم لهذا الفرع */}
              {bookingDate && isDateClosed(selectedBranch?.id, bookingDate) && (
                <div style={{ marginTop: 10, fontSize: 12, color: C.red }}>⚠️ This date is not available for booking · هذا التاريخ غير متاح للحجز، برجاء اختيار تاريخ آخر</div>
              )}
              <button onClick={() => {
                if (!bookingDate) { alert('Please select a date'); return }
                if (isDateClosed(selectedBranch?.id, bookingDate)) return
                setPhase('section')
              }}
                disabled={!!bookingDate && isDateClosed(selectedBranch?.id, bookingDate)}
                style={{ width: '100%', background: !bookingDate || isDateClosed(selectedBranch?.id, bookingDate) ? '#333' : `linear-gradient(135deg,${C.blue1},${C.blue2})`, border: 'none', borderRadius: 14, padding: '14px', cursor: !bookingDate || isDateClosed(selectedBranch?.id, bookingDate) ? 'not-allowed' : 'pointer', fontWeight: 800, fontSize: 15, color: C.white, marginTop: 16, boxShadow: bookingDate && !isDateClosed(selectedBranch?.id, bookingDate) ? `0 6px 20px ${C.glow}` : 'none' }}>
                Continue → Choose Section
              </button>
            </div>
          </div>
        )}
        {/* ══ Step 2: Section ══ */}
        {phase === 'section' && (
          <div>
            <button onClick={() => setPhase('date')} style={{ background: 'transparent', border: 'none', color: C.blue1, cursor: 'pointer', fontSize: 14, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>← Back</button>
            <div style={{ background: C.blue1 + '15', border: `1px solid ${C.blue1}40`, borderRadius: 14, padding: '10px 16px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <Icon>🏪</Icon><span style={{ color: C.white, fontWeight: 700, fontSize: 13 }}>{selectedBranch?.name}</span>
              <span style={{ color: C.silver2 }}>·</span>
              <Icon>📅</Icon><span style={{ color: C.silver2, fontSize: 13 }}>{bookingDate && new Date(bookingDate).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}</span>
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 6 }}>Choose Your Section</h2>
            <p style={{ color: C.silver2, fontSize: 14, marginBottom: 24 }}>Select your preferred dining area</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* ✅ جديد: لو كل أقسام اليوم مغلقة، رسالة واضحة بدل قائمة فاضية */}
              {SECTIONS.every(s => isSectionClosed(selectedBranch?.id, bookingDate, s.key)) && (
                <div style={{ background: C.amberB, border: `1px solid ${C.amber}40`, borderRadius: 14, padding: '14px 16px', fontSize: 13, color: C.silver2, lineHeight: 1.7 }}>
                  No sections are available on this date. Please choose another date. · لا توجد أقسام متاحة في هذا التاريخ، يُرجى اختيار تاريخ آخر.
                </div>
              )}
              {SECTIONS.filter(s => !isSectionClosed(selectedBranch?.id, bookingDate, s.key)).map(s => {
                // ✅ Fix: صور الأقسام كانت مقصورة على أوركيد هاوس فقط (بقية سياسات القسم في هذا الملف كذلك
                // بالتصميم)، لكن صفحة الإدارة تسمح برفعها لأي فرع — فصور KLCC كانت تُرفع بنجاح وتُخزَّن
                // لكن لا تظهر أبدًا للعميل. الصورة نفسها بصرية بحتة فقط، فأصبحت تظهر لأي فرع رفع له الأدمن صورة
                const photo = sectionPhotos.find(p => p.branch_id === selectedBranch?.id && p.section === s.key)
                const hasPhoto = !!photo?.image_url
                return (
                <div key={s.key} onClick={() => pickSection(s.key)}
                  style={{ background: C.bg2, border: `1.5px solid ${C.border}`, borderRadius: 18, padding: hasPhoto ? 0 : '18px 20px', overflow: 'hidden', cursor: 'pointer', transition: 'all .2s' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.border = `1.5px solid ${s.color}` }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.border = `1.5px solid ${C.border}` }}>
                  {/* ✅ صورة القسم كبيرة وواضحة أعلى البطاقة (بدل الأيقونة الصغيرة السابقة) — تظهر فقط لو رفعها الأدمن */}
                  {hasPhoto && (
                    <div style={{ width: '100%', height: 220, overflow: 'hidden' }}>
                      <img src={photo!.image_url!} alt={s.label} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    </div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: hasPhoto ? '16px 20px' : 0 }}>
                    {!hasPhoto && (
                      <div style={{ width: 52, height: 52, borderRadius: 14, background: s.color + '20', border: `1.5px solid ${s.color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0 }}>{s.icon}</div>
                    )}
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 800, fontSize: 16, color: C.white, marginBottom: 2 }}>{s.label}</div>
                      <div style={{ fontSize: 12, color: C.silver2 }}>{s.labelAr}</div>
                      {/* ✅ جديد: سياسة القسم (السعة + شرط الوقت للطابق العلوي) — أوركيد هاوس فقط */}
                      {selectedBranch?.id === ORCHID_HOUSE_ID && SECTION_POLICY[s.key] && (
                        <div style={{ fontSize: 11, color: s.color, marginTop: 6, lineHeight: 1.6 }}>
                          {SECTION_POLICY[s.key].en}<br />{SECTION_POLICY[s.key].ar}
                        </div>
                      )}
                    </div>
                    <div style={{ color: C.silver2, fontSize: 20 }}>›</div>
                  </div>
                </div>
              )})}
            </div>

            {/* ✅ جديد: تنويه عدم اصطحاب مأكولات/مشروبات من خارج المطعم — أوركيد هاوس فقط */}
            {selectedBranch?.id === ORCHID_HOUSE_ID && (
              <div style={{ marginTop: 18, background: C.amberB, border: `1px solid ${C.amber}40`, borderRadius: 14, padding: '12px 16px', fontSize: 12, color: C.silver2, lineHeight: 1.7 }}>
                ⚠️ Outside food and beverages are not permitted. · يُرجى العلم أنه لا يُسمح باصطحاب أي مأكولات أو مشروبات من خارج المطعم.
              </div>
            )}

            {/* منيو الفرع المختار من دليل بدلكس — للفرعين */}
            {selectedBranch && BRANCH_NAMES[selectedBranch.id] && (
              <div style={{ marginTop: 18 }}>
                <BranchMenuButton branch={BRANCH_NAMES[selectedBranch.id]} />
              </div>
            )}
          </div>
        )}

        {/* ══ Step 3: Details ══ */}
        {phase === 'details' && (
          <div>
            <button onClick={() => setPhase('section')} style={{ background: 'transparent', border: 'none', color: C.blue1, cursor: 'pointer', fontSize: 14, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>← Back</button>
            <div style={{ background: C.bg2, border: `1px solid ${C.border}`, borderRadius: 14, padding: '12px 16px', marginBottom: 20, display: 'flex', gap: 12, alignItems: 'center' }}>
              <span style={{ fontSize: 22 }}>{selectedSection?.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, color: C.white, fontSize: 14 }}>{selectedSection?.label} · {selectedBranch?.name}</div>
                <div style={{ fontSize: 12, color: C.silver2, display: 'flex', alignItems: 'center', gap: 5 }}><Icon size={12}>🪑</Icon> We'll assign your table when you arrive</div>
              </div>
              <button onClick={() => setPhase('section')} style={{ background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 8, color: C.silver2, cursor: 'pointer', fontSize: 12, padding: '5px 10px' }}>Change</button>
            </div>
            <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 20 }}>Your Details</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, color: C.silver2, display: 'block', marginBottom: 6 }}>Full Name *</label>
                <input style={inp('name')} placeholder="John Smith" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
                {errors.name && <div style={{ color: C.red, fontSize: 11, marginTop: 4 }}>{errors.name}</div>}
              </div>
              <div>
                <label style={{ fontSize: 12, color: C.silver2, display: 'block', marginBottom: 6 }}>Email Address *</label>
                <input type="email" style={inp('email')} placeholder="john@email.com" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
                {errors.email && <div style={{ color: C.red, fontSize: 11, marginTop: 4 }}>{errors.email}</div>}
              </div>
              <div>
                <label style={{ fontSize: 12, color: C.silver2, display: 'block', marginBottom: 6 }}>Phone Number *</label>
                <input type="tel" style={inp('phone')} placeholder="+60 12-345 6789" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} />
                {errors.phone && <div style={{ color: C.red, fontSize: 11, marginTop: 4 }}>{errors.phone}</div>}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, color: C.silver2, display: 'block', marginBottom: 6 }}>Date *</label>
                  <input type="date" style={inp('date')} value={form.date} min={new Date().toISOString().split('T')[0]} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} />
                  {errors.date && <div style={{ color: C.red, fontSize: 11, marginTop: 4 }}>{errors.date}</div>}
                </div>
                <div>
                  <label style={{ fontSize: 12, color: C.silver2, display: 'block', marginBottom: 6 }}>Time *</label>
                  <input type="time" style={inp('time')} value={form.time} onChange={e => setForm(p => ({ ...p, time: e.target.value }))} />
                  {errors.time && <div style={{ color: C.red, fontSize: 11, marginTop: 4 }}>{errors.time}</div>}
                </div>
              </div>
              <div>
                <label style={{ fontSize: 12, color: C.silver2, display: 'block', marginBottom: 6 }}>Number of Guests *</label>
                <input type="number" inputMode="numeric" min={1} max={100} style={inp('guests')} placeholder="e.g. 4"
                  value={form.guests} onChange={e => setForm(p => ({ ...p, guests: e.target.value }))} />
                {errors.guests && <div style={{ color: C.red, fontSize: 11, marginTop: 4 }}>{errors.guests}</div>}
              </div>
              <div>
                <label style={{ fontSize: 12, color: C.silver2, display: 'block', marginBottom: 6 }}>Special Requests (optional)</label>
                <textarea style={{ ...inp('notes'), minHeight: 80, resize: 'vertical' as const }} placeholder="Birthday, dietary needs..." value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
              </div>

              {/* ✅ جديد: ملاحظتا إعادة الجدولة والعربون — تظهران للعميل قبل تأكيد الحجز مباشرة، أوركيد هاوس فقط */}
              {selectedBranch?.id === ORCHID_HOUSE_ID && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ background: C.amberB, border: `1px solid ${C.amber}40`, borderRadius: 14, padding: '12px 16px', fontSize: 12, color: C.silver2, lineHeight: 1.7 }}>
                    🔄 If you wish to change your booking date, please contact our bookings team at least 2 days before your reserved date.
                    <br />في حال رغبة العميل في تغيير تاريخ الحجز، يُرجى التواصل مع قسم الحجوزات في مدة لا تقل عن يومين من تاريخ الحجز المسبق.
                  </div>
                  <div style={{ background: C.amberB, border: `1px solid ${C.amber}40`, borderRadius: 14, padding: '12px 16px', fontSize: 12, color: C.silver2, lineHeight: 1.7 }}>
                    💰 The deposit is deducted from your final bill upon visiting the restaurant. If you do not attend without at least 48 hours&apos; prior notice, the paid amount is non-refundable.
                    <br />العربون يُخصم من الفاتورة النهائية عند زيارة المطعم، أما في حالة عدم الحضور بدون إشعار مسبق لا يقل عن 48 ساعة، فلا يُسترد المبلغ المدفوع.
                  </div>
                </div>
              )}

              <button onClick={submit} disabled={submitting}
                style={{ width: '100%', background: submitting ? '#333' : `linear-gradient(135deg,${C.blue1},${C.blue2})`, border: 'none', borderRadius: 16, padding: '16px', cursor: submitting ? 'not-allowed' : 'pointer', fontWeight: 800, fontSize: 16, color: C.white, boxShadow: submitting ? 'none' : `0 8px 28px ${C.glow}`, marginTop: 8 }}>
                {submitting ? '⏳ Submitting...' : '✅ Confirm Reservation'}
              </button>
              <p style={{ textAlign: 'center', color: C.silver2, fontSize: 12, lineHeight: 1.7 }}>
                Your request will be sent to our bookings team for confirmation.
                <br />سيتم إرسال طلبكم إلى قسم الحجوزات للتأكيد.
              </p>
            </div>
          </div>
        )}
      </div>
      <BookingFooter />
    </div>
  )
}
