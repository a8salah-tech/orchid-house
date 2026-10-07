'use client'
/* eslint-disable @next/next/no-img-element -- صور الإيصالات روابط Supabase Storage عامة بأحجام متفاوتة، next/image مش مناسب هنا */


import { useEffect, useState, useRef, useCallback } from 'react'
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

type Booking = {
  id: string; customer_name: string; customer_email: string; customer_phone: string
  booking_date: string; booking_time: string; guests: number
  section: string; table_number: number | null; notes: string | null
  status: 'pending' | 'confirmed' | 'cancelled'; created_at: string
  branch_id: string | null
  // ✅ جديد: العربون — يُدخله الموظف هنا فقط (لا يوجد حقل عربون في نموذج حجز العميل نفسه)
  deposit_amount: number | null
  // ✅ جديد: صورة إيصال/إثبات العربون — اختيارية (db/bookings_deposit_image.sql)
  deposit_image_url?: string | null
}

// ✅ جديد: أيام مُغلقة للحجز لكل فرع — مدير النظام فقط يقدر يضيف/يحذف
type ClosedDay = { id: string; branch_id: string; closed_date: string; note: string | null }

const SECTION_LABELS: Record<string, string> = {
  outdoor: '🌿 Outdoor', indoor: '❄️ Indoor', upstairs: '🌅 Upstairs'
}

const STATUS_CFG = {
  pending:   { label: 'Pending',   color: S.amber, bg: S.amberB },
  confirmed: { label: 'Confirmed', color: S.green, bg: S.greenB },
  cancelled: { label: 'Cancelled', color: S.red,   bg: S.redB   },
}

// ✅ جديد: عدد الحجوزات في كل صفحة
const PAGE_SIZE = 20

const inp: React.CSSProperties = { background: 'rgba(255,255,255,.04)', border: `1px solid ${S.border}`, borderRadius: 10, padding: '9px 14px', fontSize: 13, color: S.white, outline: 'none', fontFamily: 'Tajawal, sans-serif', boxSizing: 'border-box' as const }

// ✅ جديد: نفس جدول الحجوزات، مستخدَم لكل مجموعة (اليوم/غدًا/...) ولجدول الأرشيف، بدل تكرار نفس الكود.
// مكوّن مستقل خارج BookingsPage (مش دالة معرّفة جوه الـrender) عشان مايتعادش إنشاؤه كل مرة
function BookingsTable({ rows, branches, onUpdateTable, onUpdateStatus, onUpdateDeposit, onRowClick, onViewImage }: {
  rows: Booking[]; branches: { id: string; name: string }[]
  onUpdateTable: (id: string, table_number: number | null) => void
  onUpdateStatus: (id: string, status: 'confirmed' | 'cancelled') => void
  onUpdateDeposit: (id: string, deposit_amount: number | null) => void
  onRowClick: (b: Booking) => void
  onViewImage: (url: string) => void
}) {
  return (
    <div style={{ background: S.navy2, borderRadius: 16, border: `1px solid ${S.border}`, overflow: 'hidden' }}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1050 }}>
          <thead>
            <tr style={{ background: S.navy3 }}>
              {['Name', 'Phone', 'Branch', 'Date', 'Time', 'Guests', 'Section', 'Table', 'Deposit', 'Notes', 'Status', 'Actions'].map(h => (
                <th key={h} style={{ padding: '12px 14px', textAlign: 'left', fontSize: 11, color: S.muted, fontWeight: 700, borderBottom: `1px solid ${S.border}` }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(b => {
              const st = STATUS_CFG[b.status]
              return (
                <tr key={b.id} onClick={() => onRowClick(b)} style={{ borderBottom: `1px solid ${S.border}`, cursor: 'pointer' }}>
                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ fontWeight: 700, color: S.white, fontSize: 14 }}>{b.customer_name}</div>
                    <div style={{ fontSize: 11, color: S.muted }}>{b.customer_email}</div>
                  </td>
                  <td style={{ padding: '12px 14px', color: S.white, fontSize: 13 }}>{b.customer_phone}</td>
                  <td style={{ padding: '12px 14px', color: S.white, fontSize: 13 }}>{branches.find(br => br.id === b.branch_id)?.name || '—'}</td>
                  <td style={{ padding: '12px 14px', color: S.white, fontSize: 13, whiteSpace: 'nowrap' }}>
                    {new Date(b.booking_date).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' })}
                  </td>
                  <td style={{ padding: '12px 14px', color: S.gold, fontWeight: 700, fontSize: 13 }}>{b.booking_time}</td>
                  <td style={{ padding: '12px 14px', color: S.white, fontSize: 13, textAlign: 'center' }}>{b.guests}</td>
                  <td style={{ padding: '12px 14px', color: S.white, fontSize: 13 }}>{SECTION_LABELS[b.section] || b.section}</td>
                  <td style={{ padding: '8px 14px' }} onClick={e => e.stopPropagation()}>
                    <input type="number" style={{ ...inp, width: 70, fontSize: 12, padding: '5px 8px' }}
                      placeholder="—" value={b.table_number || ''} min={1}
                      onChange={e => onUpdateTable(b.id, parseInt(e.target.value) || null)} />
                  </td>
                  <td style={{ padding: '8px 14px' }} onClick={e => e.stopPropagation()}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <input type="number" style={{ ...inp, width: 90, fontSize: 12, padding: '5px 8px' }}
                        placeholder="MYR —" value={b.deposit_amount ?? ''} min={0} step={0.01}
                        onChange={e => onUpdateDeposit(b.id, e.target.value === '' ? null : parseFloat(e.target.value))} />
                      {b.deposit_image_url && (
                        <img src={b.deposit_image_url} alt="deposit receipt" title="Deposit receipt — click to view" onClick={() => onViewImage(b.deposit_image_url!)}
                          style={{ width: 30, height: 30, objectFit: 'cover', borderRadius: 6, border: `1px solid ${S.gold}`, cursor: 'zoom-in', flexShrink: 0 }} />
                      )}
                    </div>
                  </td>
                  <td style={{ padding: '12px 14px', color: S.muted, fontSize: 12, maxWidth: 150 }}>
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.notes || '—'}</div>
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <span style={{ background: st.bg, color: st.color, borderRadius: 20, padding: '4px 10px', fontSize: 11, fontWeight: 700 }}>{st.label}</span>
                  </td>
                  <td style={{ padding: '8px 14px' }} onClick={e => e.stopPropagation()}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {b.status !== 'confirmed' && (
                        <button onClick={() => onUpdateStatus(b.id, 'confirmed')} style={{ padding: '5px 10px', borderRadius: 8, border: `1px solid ${S.green}`, background: S.greenB, color: S.green, cursor: 'pointer', fontSize: 11, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>✓</button>
                      )}
                      {b.status !== 'cancelled' && (
                        <button onClick={() => onUpdateStatus(b.id, 'cancelled')} style={{ padding: '5px 10px', borderRadius: 8, border: `1px solid ${S.red}`, background: S.redB, color: S.red, cursor: 'pointer', fontSize: 11, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>✕</button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function BookingsPage() {
  const sbRef = useRef(createClient())
  const sb = sbRef.current
  // ✅ جديد: مدير النظام فقط يقدر يغلق/يفتح يوم حجز لفرع معيّن
  const { employee, permissions } = useAuth()
  const isAdmin = permissions?.all === true
  // ✅ جديد: إغلاق/فتح أيام الحجز أصبح متاحًا لمشرف الصالة كمان، بالإضافة لمدير النظام — لفرعه فقط
  const canManageClosedDays = isAdmin || employee?.role === 'hall_supervisor'

  const [bookings, setBookings] = useState<Booking[]>([])
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'pending' | 'confirmed' | 'cancelled'>('all')
  const [dateFilter, setDateFilter] = useState('')
  const [search, setSearch] = useState('')
  // ✅ جديد: فلتر الفرع
  const [branchFilter, setBranchFilter] = useState('')
  // ✅ جديد: أرشيف (الحجوزات اللي تاريخها فات) مقابل النشطة/القادمة
  const [showArchive, setShowArchive] = useState(false)
  // ✅ جديد: رقم الصفحة الحالية
  const [page, setPage] = useState(0)
  // ✅ جديد: الحجز اللي تم الضغط عليه — يظهر في نافذة التفاصيل الكاملة
  const [detailBooking, setDetailBooking] = useState<Booking | null>(null)
  // ✅ جديد: رفع صورة إثبات العربون + عرضها بالحجم الكامل
  const [uploadingDeposit, setUploadingDeposit] = useState<string | null>(null)
  const [viewImage, setViewImage] = useState<string | null>(null)
  // ✅ جديد: الأيام المُغلقة للحجز + نافذة إدارتها (أدمن فقط)
  const [closedDays, setClosedDays] = useState<ClosedDay[]>([])
  const [showClosedDaysModal, setShowClosedDaysModal] = useState(false)
  const [newClosedBranch, setNewClosedBranch] = useState('')
  const [newClosedDate, setNewClosedDate] = useState('')
  const [newClosedNote, setNewClosedNote] = useState('')
  const [closingDay, setClosingDay] = useState(false)
  // ✅ مشرف الصالة يشوف/يدير أيام فرعه بس؛ مدير النظام يشوف كل الفروع (الكتابة الفعلية أيضًا محصورة بنفس المنطق في RLS)
  const visibleClosedDays = isAdmin ? closedDays : closedDays.filter(d => d.branch_id === employee?.branch_id)
  const closedDaysBranches = isAdmin ? branches : branches.filter(br => br.id === employee?.branch_id)

  const fetchBookings = useCallback(async () => {
    // ✅ Fix: الترتيب بقى من الأحدث للأقدم (تنازلي) بدل تصاعدي
    const { data } = await sb.from('bookings').select('*').order('booking_date', { ascending: false }).order('booking_time', { ascending: false })
    setBookings((data as any) || [])
    setLoading(false)
  }, [sb])

  // ✅ جديد: جلب الفروع لدعم فلتر اختيار الفرع
  const fetchBranches = useCallback(async () => {
    const { data } = await sb.from('branches').select('id,name').eq('is_active', true).order('name')
    setBranches(data || [])
  }, [sb])

  // ✅ جديد: جلب الأيام المُغلقة — fail-open لو الجدول لسه ما اتعملش
  const fetchClosedDays = useCallback(async () => {
    const { data, error } = await sb.from('booking_closed_days').select('*').order('closed_date')
    if (!error && data) setClosedDays(data as ClosedDay[])
  }, [sb])

  useEffect(() => { fetchBookings(); fetchBranches(); fetchClosedDays() }, [fetchBookings, fetchBranches, fetchClosedDays])

  async function closeDay() {
    if (!newClosedBranch || !newClosedDate) { alert('اختر الفرع والتاريخ'); return }
    setClosingDay(true)
    const { error } = await sb.from('booking_closed_days')
      .insert({ branch_id: newClosedBranch, closed_date: newClosedDate, note: newClosedNote || null })
    setClosingDay(false)
    if (error) { alert('فشل إغلاق اليوم: ' + error.message + ' — تأكد من تشغيل db/booking_closed_days.sql'); return }
    setNewClosedDate(''); setNewClosedNote('')
    fetchClosedDays()
  }

  async function reopenDay(id: string) {
    if (!confirm('هل تريد إعادة فتح هذا اليوم للحجز؟')) return
    const { error } = await sb.from('booking_closed_days').delete().eq('id', id)
    if (error) { alert('خطأ: ' + error.message); return }
    fetchClosedDays()
  }

  useEffect(() => {
    const ch = sb.channel('bookings-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, fetchBookings)
      .subscribe()
    return () => { sb.removeChannel(ch) }
  }, [sb, fetchBookings])

  async function updateStatus(id: string, status: 'confirmed' | 'cancelled') {
    await sb.from('bookings').update({ status }).eq('id', id)
    fetchBookings()
  }

  async function updateTable(id: string, table_number: number | null) {
    await sb.from('bookings').update({ table_number }).eq('id', id)
    fetchBookings()
  }

  // ✅ جديد: تحديث العربون — نفس نمط updateTable بالضبط
  async function updateDeposit(id: string, deposit_amount: number | null) {
    const { error } = await sb.from('bookings').update({ deposit_amount }).eq('id', id)
    if (error) { alert('فشل حفظ العربون: ' + error.message + ' — تأكد من تشغيل db/bookings_deposit_amount.sql'); return }
    fetchBookings()
  }

  // ✅ جديد: رفع صورة إثبات العربون لحجز — في نفس bucket "employees" المستخدم في باقي صور اللوحة، وبعدها نحفظ الرابط في الحجز
  async function uploadDepositImage(id: string, file: File) {
    if (!file.type.startsWith('image/')) { alert('اختر ملف صورة فقط'); return }
    if (file.size > 10 * 1024 * 1024) { alert('حجم الصورة أكبر من 10MB'); return }
    setUploadingDeposit(id)
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg'
    const { data: up, error: upErr } = await sb.storage.from('employees').upload(`booking-deposits/${id}-${Date.now()}.${ext}`, file, { contentType: file.type })
    if (upErr || !up) { setUploadingDeposit(null); alert('فشل رفع الصورة: ' + (upErr?.message || 'unknown')); return }
    const url = sb.storage.from('employees').getPublicUrl(up.path).data.publicUrl
    const { error } = await sb.from('bookings').update({ deposit_image_url: url }).eq('id', id)
    setUploadingDeposit(null)
    if (error) { alert('فشل حفظ الصورة: ' + error.message + ' — تأكد من تشغيل db/bookings_deposit_image.sql'); return }
    setDetailBooking(p => p && p.id === id ? { ...p, deposit_image_url: url } : p)
    fetchBookings()
  }

  async function removeDepositImage(id: string) {
    if (!confirm('هل تريد حذف صورة العربون من هذا الحجز؟')) return
    const { error } = await sb.from('bookings').update({ deposit_image_url: null }).eq('id', id)
    if (error) { alert('خطأ: ' + error.message); return }
    setDetailBooking(p => p && p.id === id ? { ...p, deposit_image_url: null } : p)
    fetchBookings()
  }

  // ✅ نفس updateTable/updateStatus/updateDeposit، لكن بتحدّث كمان نسخة نافذة التفاصيل المفتوحة أول بأول (مش بس القائمة بعد إعادة الجلب)
  function updateTableAndDetail(id: string, table_number: number | null) {
    updateTable(id, table_number)
    setDetailBooking(p => p && p.id === id ? { ...p, table_number } : p)
  }
  function updateStatusAndDetail(id: string, status: 'confirmed' | 'cancelled') {
    updateStatus(id, status)
    setDetailBooking(p => p && p.id === id ? { ...p, status } : p)
  }
  function updateDepositAndDetail(id: string, deposit_amount: number | null) {
    updateDeposit(id, deposit_amount)
    setDetailBooking(p => p && p.id === id ? { ...p, deposit_amount } : p)
  }

  // ✅ جديد: تاريخ اليوم بصيغة قابلة للمقارنة، لتحديد الأرشيف
  // ✅ Fix: "اليوم" بتوقيت ماليزيا (UTC+8) مش UTC — وإلا بين 12 منتصف الليل و8 صباحًا يُحسب "أمس" ويدخل حجز اليوم في الأرشيف
  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kuala_Lumpur' })
  // ✅ جديد: حدود التجميع (اليوم / غدًا / هذا الأسبوع / لاحقًا) لعرض احترافي بدل جدول واحد طويل
  const addDays = (n: number) => { const d = new Date(todayStr + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().split('T')[0] }
  const tomorrowStr = addDays(1)
  const weekEndStr = addDays(7)
  const sortByWhen = (a: Booking, b: Booking) => a.booking_date === b.booking_date ? a.booking_time.localeCompare(b.booking_time) : a.booking_date.localeCompare(b.booking_date)

  const filtered = bookings.filter(b => {
    const matchStatus = filter === 'all' || b.status === filter
    const matchDate = !dateFilter || b.booking_date === dateFilter
    const matchSearch = !search || b.customer_name.toLowerCase().includes(search.toLowerCase()) || b.customer_phone.includes(search) || b.customer_email.toLowerCase().includes(search.toLowerCase())
    const matchBranch = !branchFilter || b.branch_id === branchFilter
    // ✅ Fix: لما يتحدد تاريخ معيّن من التقويم، نعرض حجوزات اليوم ده بالظبط سواء فات أو لسه — كان فلتر "النشطة/القادمة"
    // بيستبعد أي تاريخ سابق فيرجّع نتيجة فاضية رغم إن الحجوزات موجودة. بدون تاريخ محدد: الأرشيف = فات، النشطة = اليوم فما بعد
    const matchArchive = dateFilter ? true : (showArchive ? b.booking_date < todayStr : b.booking_date >= todayStr)
    return matchStatus && matchDate && matchSearch && matchBranch && matchArchive
  })

  // ✅ جديد: تقسيم النتائج المفلترة لصفحات، 20 حجز في كل صفحة
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageSafe = Math.min(page, totalPages - 1)
  const paginated = filtered.slice(pageSafe * PAGE_SIZE, pageSafe * PAGE_SIZE + PAGE_SIZE)
  // ✅ نرجّع لأول صفحة تلقائيًا كل ما اتغيّر أي فلتر
  useEffect(() => { setPage(0) }, [filter, dateFilter, search, branchFilter, showArchive])

  const counts = {
    all: bookings.length,
    pending: bookings.filter(b => b.status === 'pending').length,
    confirmed: bookings.filter(b => b.status === 'confirmed').length,
    cancelled: bookings.filter(b => b.status === 'cancelled').length,
  }

  // ✅ جديد: في تاب "النشطة/القادمة" نعرض الحجوزات مقسّمة لمجموعات (اليوم، غدًا، هذا الأسبوع، لاحقًا)
  // بدل جدول واحد طويل — كل مجموعة مرتبة بترتيب زمني تصاعدي (الأقرب أولًا)، وتُخفى لو فاضية.
  // الأرشيف يفضل جدول واحد بترقيم صفحات عادي، لأنه أكبر حجمًا وتاريخي بطبيعته
  const groups = (showArchive || dateFilter) ? null : [
    { key: 'today', label: '📌 Today', rows: filtered.filter(b => b.booking_date === todayStr).sort(sortByWhen) },
    { key: 'tomorrow', label: '🔜 Tomorrow', rows: filtered.filter(b => b.booking_date === tomorrowStr).sort(sortByWhen) },
    { key: 'week', label: '📆 This Week', rows: filtered.filter(b => b.booking_date > tomorrowStr && b.booking_date <= weekEndStr).sort(sortByWhen) },
    { key: 'later', label: '📅 Later', rows: filtered.filter(b => b.booking_date > weekEndStr).sort(sortByWhen) },
  ].filter(g => g.rows.length > 0)

  function printReport() {
    const win = window.open('', '_blank')
    if (!win) return
    // ✅ الطباعة بتاخد كل النتائج المفلترة (كل الصفحات مع بعض)، مش صفحة واحدة بس
    const rows = filtered.map((b, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${b.customer_name}</td>
        <td>${b.customer_phone}</td>
        <td>${b.customer_email}</td>
        <td>${branches.find(br => br.id === b.branch_id)?.name || '—'}</td>
        <td>${new Date(b.booking_date).toLocaleDateString('en-GB')}</td>
        <td>${b.booking_time}</td>
        <td>${b.guests}</td>
        <td>${SECTION_LABELS[b.section] || b.section}</td>
        <td>${b.table_number || '—'}</td>
        <td>${b.status.toUpperCase()}</td>
        <td>${b.notes || '—'}</td>
      </tr>`).join('')

    win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
    <title>Bookings Report</title>
    <style>
      body{font-family:Arial,sans-serif;font-size:10px;margin:15px;}
      h2{text-align:center;font-size:16px;margin-bottom:4px;}
      h3{text-align:center;font-size:11px;color:#555;margin-bottom:14px;}
      table{width:100%;border-collapse:collapse;}
      th{background:#0A1628;color:#fff;padding:5px 6px;text-align:left;font-size:9px;}
      td{padding:4px 6px;border-bottom:1px solid #ddd;font-size:9px;}
      tr:nth-child(even){background:#f9f9f9;}
      .sum{display:flex;gap:12px;margin-bottom:12px;}
      .box{border:1px solid #ddd;border-radius:6px;padding:8px 14px;text-align:center;}
      .box .v{font-size:18px;font-weight:bold;}
      @media print{@page{size:A4 landscape;margin:8mm;}}
    </style></head><body>
    <h2>🌸 Orchid House — Reservations Report</h2>
    <h3>Printed: ${new Date().toLocaleString('en-GB')} · ${filtered.length} bookings ${showArchive ? '(Archive)' : '(Active/Upcoming)'}</h3>
    <div class="sum">
      <div class="box"><div class="v">${counts.all}</div><div>Total</div></div>
      <div class="box"><div class="v" style="color:#F59E0B">${counts.pending}</div><div>Pending</div></div>
      <div class="box"><div class="v" style="color:#22C55E">${counts.confirmed}</div><div>Confirmed</div></div>
      <div class="box"><div class="v" style="color:#EF4444">${counts.cancelled}</div><div>Cancelled</div></div>
    </div>
    <table><thead><tr>
      <th>#</th><th>Name</th><th>Phone</th><th>Email</th><th>Branch</th>
      <th>Date</th><th>Time</th><th>Guests</th><th>Section</th>
      <th>Table</th><th>Status</th><th>Notes</th>
    </tr></thead><tbody>${rows}</tbody></table>
    <script>window.onload=()=>window.print()<\/script>
    </body></html>`)
    win.document.close()
  }

  // ✅ جديد: بطاقة حجز صغيرة قابلة للطباعة لحجز واحد (اسم العميل + عدد الأشخاص + بيانات الحجز)
  // — بحجم إيصال طابعة حرارية (80mm)، تُسلَّم للعميل أو تُوضع على الطاولة
  function escapeHtml(s: string) { return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string)) }

  function printBookingCard(b: Booking) {
    const win = window.open('', '_blank')
    if (!win) return
    const branchName = branches.find(br => br.id === b.branch_id)?.name || '—'
    const bookingRef = b.id.slice(-8).toUpperCase()

    win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
    <title>Booking Card #${bookingRef}</title>
    <style>
      * { box-sizing: border-box; }
      body { font-family: Arial, sans-serif; margin: 0; padding: 10px; width: 80mm; }
      .card { border: 2px dashed #0A1628; border-radius: 8px; padding: 14px; text-align: center; }
      .logo { font-size: 22px; font-weight: bold; margin-bottom: 2px; }
      .sub { font-size: 10px; color: #555; margin-bottom: 10px; }
      .ref { font-size: 11px; letter-spacing: 2px; color: #888; margin-bottom: 10px; }
      .name { font-size: 20px; font-weight: bold; margin-bottom: 4px; word-break: break-word; }
      .guests { font-size: 34px; font-weight: bold; color: #0A1628; margin: 8px 0 2px; }
      .guests-label { font-size: 10px; color: #555; margin-bottom: 12px; }
      table.info { width: 100%; border-collapse: collapse; text-align: left; font-size: 12px; margin-top: 6px; }
      table.info td { padding: 4px 2px; border-top: 1px solid #ddd; }
      table.info td.k { color: #555; width: 40%; }
      table.info td.v { font-weight: bold; }
      .status { display: inline-block; margin-top: 10px; padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: bold; }
      @media print { @page { size: 80mm auto; margin: 3mm; } }
    </style></head><body>
    <div class="card">
      <div class="logo">🌸 Orchid House</div>
      <div class="sub">Table Reservation</div>
      <div class="ref">#${bookingRef}</div>
      <div class="name">${escapeHtml(b.customer_name)}</div>
      <div class="guests">${b.guests}</div>
      <div class="guests-label">GUESTS · عدد الأشخاص</div>
      <table class="info">
        <tr><td class="k">Branch</td><td class="v">${escapeHtml(branchName)}</td></tr>
        <tr><td class="k">Date</td><td class="v">${new Date(b.booking_date).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}</td></tr>
        <tr><td class="k">Time</td><td class="v">${b.booking_time}</td></tr>
        <tr><td class="k">Section</td><td class="v">${SECTION_LABELS[b.section] || b.section}</td></tr>
        <tr><td class="k">Table</td><td class="v">${b.table_number || 'Not assigned'}</td></tr>
        <tr><td class="k">Phone</td><td class="v">${escapeHtml(b.customer_phone)}</td></tr>
      </table>
      <span class="status" style="background:${STATUS_CFG[b.status].bg};color:${STATUS_CFG[b.status].color}">${STATUS_CFG[b.status].label.toUpperCase()}</span>
    </div>
    <script>window.onload=()=>window.print()<\/script>
    </body></html>`)
    win.document.close()
  }

  const inp: React.CSSProperties = { background: 'rgba(255,255,255,.04)', border: `1px solid ${S.border}`, borderRadius: 10, padding: '9px 14px', fontSize: 13, color: S.white, outline: 'none', fontFamily: 'Tajawal, sans-serif', boxSizing: 'border-box' as const }

  return (
    <div style={{ fontFamily: 'Tajawal, sans-serif', color: S.white }}>
      <style>{`select option{background:#0F2040;color:#FAFAF8}`}</style>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 900, color: S.white, marginBottom: 4 }}>📅 Reservations</h1>
          <p style={{ fontSize: 13, color: S.muted }}>Manage table bookings and reservations</p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {/* ✅ جديد: إغلاق/فتح أيام الحجز — مدير النظام + مشرف الصالة (لفرعه فقط) */}
          {canManageClosedDays && (
            <button onClick={() => { if (!isAdmin && employee?.branch_id) setNewClosedBranch(employee.branch_id); setShowClosedDaysModal(true) }} style={{ padding: '10px 18px', borderRadius: 12, border: `1px solid ${S.red}`, background: S.redB, color: S.red, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>🔒 Closed Days{visibleClosedDays.length > 0 ? ` (${visibleClosedDays.length})` : ''}</button>
          )}
          <button onClick={printReport} style={{ padding: '10px 18px', borderRadius: 12, border: `1px solid ${S.blue}`, background: S.blueB, color: S.blue, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>🖨️ Print Report</button>
          <a href="/bookings" target="_blank" style={{ padding: '10px 18px', borderRadius: 12, border: `1px solid ${S.green}`, background: S.greenB, color: S.green, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700, textDecoration: 'none', display: 'flex', alignItems: 'center' }}>🔗 Booking Link</a>
        </div>
      </div>

      {/* ✅ جديد: تبديل نشطة/قادمة مقابل الأرشيف */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button onClick={() => setShowArchive(false)}
          style={{ flex: 1, padding: '10px', borderRadius: 12, border: `1px solid ${!showArchive ? S.green : S.border}`, background: !showArchive ? S.greenB : 'transparent', color: !showArchive ? S.green : S.muted, cursor: 'pointer', fontWeight: 700, fontSize: 13, fontFamily: 'Tajawal, sans-serif' }}>
          🟢 Active / Upcoming
        </button>
        <button onClick={() => setShowArchive(true)}
          style={{ flex: 1, padding: '10px', borderRadius: 12, border: `1px solid ${showArchive ? S.blue : S.border}`, background: showArchive ? S.blueB : 'transparent', color: showArchive ? S.blue : S.muted, cursor: 'pointer', fontWeight: 700, fontSize: 13, fontFamily: 'Tajawal, sans-serif' }}>
          🗄️ Archive (Past Dates)
        </button>
      </div>

      {/* ✅ جديد: اختيار الفرع بأزرار واضحة */}
      {branches.length > 0 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          <button onClick={() => setBranchFilter('')}
            style={{ padding: '9px 16px', borderRadius: 12, border: `1px solid ${!branchFilter ? S.gold : S.border}`, background: !branchFilter ? S.gold3 : 'transparent', color: !branchFilter ? S.gold : S.muted, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: !branchFilter ? 700 : 400 }}>
            🌐 All Branches
          </button>
          {branches.map(br => (
            <button key={br.id} onClick={() => setBranchFilter(br.id)}
              style={{ padding: '9px 16px', borderRadius: 12, border: `1px solid ${branchFilter === br.id ? S.gold : S.border}`, background: branchFilter === br.id ? S.gold3 : 'transparent', color: branchFilter === br.id ? S.gold : S.muted, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: branchFilter === br.id ? 700 : 400 }}>
              🏪 {br.name}
            </button>
          ))}
        </div>
      )}

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px,1fr))', gap: 12, marginBottom: 24 }}>
        {([['all','All','#fff'], ['pending','Pending',S.amber], ['confirmed','Confirmed',S.green], ['cancelled','Cancelled',S.red]] as const).map(([k, l, c]) => (
          <div key={k} onClick={() => setFilter(k)} style={{ background: filter === k ? c + '15' : S.card, border: `1px solid ${filter === k ? c : S.border}`, borderRadius: 14, padding: '14px 16px', cursor: 'pointer', transition: 'all .2s' }}>
            <div style={{ fontSize: 11, color: S.muted, marginBottom: 4 }}>{l}</div>
            <div style={{ fontSize: 26, fontWeight: 900, color: c }}>{counts[k]}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <input style={{ ...inp, flex: 1, minWidth: 200 }} placeholder="🔍 Search name, phone, email..." value={search} onChange={e => setSearch(e.target.value)} />
        <input type="date" style={{ ...inp, width: 'auto' }} value={dateFilter} onChange={e => setDateFilter(e.target.value)} />
        {dateFilter && <button onClick={() => setDateFilter('')} style={{ padding: '9px 14px', borderRadius: 10, border: `1px solid ${S.red}`, background: S.redB, color: S.red, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif' }}>✕ Clear</button>}
      </div>

      <div style={{ fontSize: 12, color: S.muted, marginBottom: 10 }}>
        {filtered.length} booking{filtered.length !== 1 ? 's' : ''} found
        {dateFilter && <span style={{ color: S.gold }}> · 📅 all bookings on {new Date(dateFilter).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })} (Active/Archive toggle ignored while a date is selected)</span>}
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: S.muted }}>⏳ Loading...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: S.muted }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📅</div>
          <div>No bookings found</div>
        </div>
      ) : groups ? (
        // ✅ جديد: النشطة/القادمة تُعرض مقسّمة (اليوم، غدًا، هذا الأسبوع، لاحقًا) بدل جدول واحد طويل
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
          {groups.map(g => (
            <div key={g.key}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <h2 style={{ fontSize: 15, fontWeight: 800, color: S.white }}>{g.label}</h2>
                <span style={{ fontSize: 11, fontWeight: 700, color: S.gold, background: S.gold3, borderRadius: 20, padding: '2px 10px' }}>{g.rows.length}</span>
              </div>
              <BookingsTable rows={g.rows} branches={branches} onUpdateTable={updateTable} onUpdateStatus={updateStatus} onUpdateDeposit={updateDeposit} onRowClick={setDetailBooking} onViewImage={setViewImage} />
            </div>
          ))}
        </div>
      ) : (
        <>
          <BookingsTable rows={paginated} branches={branches} onUpdateTable={updateTable} onUpdateStatus={updateStatus} onUpdateDeposit={updateDeposit} onRowClick={setDetailBooking} onViewImage={setViewImage} />

          {/* ✅ تصفح الصفحات - 20 حجز في كل صفحة (للأرشيف فقط، النشطة/القادمة مقسّمة بالمجموعات) */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, marginTop: 20 }}>
              <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={pageSafe === 0}
                style={{ padding: '9px 18px', borderRadius: 10, border: `1px solid ${S.border}`, background: 'transparent', color: pageSafe === 0 ? S.muted + '60' : S.white, cursor: pageSafe === 0 ? 'not-allowed' : 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif' }}>
                ← Previous
              </button>
              <span style={{ fontSize: 13, color: S.muted }}>Page {pageSafe + 1} of {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={pageSafe >= totalPages - 1}
                style={{ padding: '9px 18px', borderRadius: 10, border: `1px solid ${S.border}`, background: 'transparent', color: pageSafe >= totalPages - 1 ? S.muted + '60' : S.white, cursor: pageSafe >= totalPages - 1 ? 'not-allowed' : 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif' }}>
                Next →
              </button>
            </div>
          )}
        </>
      )}

      {/* ✅ جديد: عرض صورة العربون بالحجم الكامل */}
      {viewImage && (
        <div onClick={() => setViewImage(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.9)', zIndex: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, cursor: 'zoom-out' }}>
          <img src={viewImage} alt="deposit receipt" style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: 12 }} />
        </div>
      )}

      {/* ✅ جديد: نافذة تفاصيل الحجز الكاملة — تظهر عند الضغط على أي صف في الجدول */}
      {detailBooking && (() => {
        const b = detailBooking
        const st = STATUS_CFG[b.status]
        const rows: { icon: string; label: string; value: string }[] = [
          { icon: '🏪', label: 'Branch', value: branches.find(br => br.id === b.branch_id)?.name || '—' },
          { icon: '📅', label: 'Date', value: new Date(b.booking_date).toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }) },
          { icon: '🕐', label: 'Time', value: b.booking_time },
          { icon: '👥', label: 'Guests', value: String(b.guests) },
          { icon: SECTION_LABELS[b.section]?.split(' ')[0] || '📍', label: 'Section', value: SECTION_LABELS[b.section]?.split(' ').slice(1).join(' ') || b.section },
          { icon: '📧', label: 'Email', value: b.customer_email },
          { icon: '📱', label: 'Phone', value: b.customer_phone },
          { icon: '🕓', label: 'Submitted', value: new Date(b.created_at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) },
        ]
        return (
          <div onClick={() => setDetailBooking(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <div onClick={e => e.stopPropagation()} style={{ background: S.navy2, borderRadius: 20, border: `1px solid ${S.border}`, padding: 26, maxWidth: 480, width: '100%', maxHeight: '85vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 6 }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: S.white }}>{b.customer_name}</div>
                  <span style={{ display: 'inline-block', marginTop: 6, background: st.bg, color: st.color, borderRadius: 20, padding: '4px 12px', fontSize: 11, fontWeight: 700 }}>{st.label}</span>
                </div>
                <button onClick={() => setDetailBooking(null)} style={{ background: 'transparent', border: 'none', color: S.muted, fontSize: 22, cursor: 'pointer', lineHeight: 1 }}>✕</button>
              </div>

              <div style={{ background: 'rgba(255,255,255,.03)', borderRadius: 14, padding: 16, marginTop: 16 }}>
                {rows.map((r, i) => (
                  <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '8px 0', borderBottom: i < rows.length - 1 ? `1px solid ${S.border}` : 'none' }}>
                    <span style={{ fontSize: 17, width: 22, textAlign: 'center', flexShrink: 0 }}>{r.icon}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ color: S.muted, fontSize: 10.5 }}>{r.label}</div>
                      <div style={{ color: S.white, fontSize: 13, fontWeight: 600, wordBreak: 'break-word' }}>{r.value}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 16 }}>
                <div>
                  <div style={{ fontSize: 11, color: S.muted, marginBottom: 6 }}>🪑 Table Number</div>
                  <input type="number" style={{ ...inp, width: '100%' }} placeholder="Not assigned yet" value={b.table_number || ''} min={1}
                    onChange={e => updateTableAndDetail(b.id, parseInt(e.target.value) || null)} />
                </div>
                <div>
                  <div style={{ fontSize: 11, color: S.muted, marginBottom: 6 }}>💰 Deposit (MYR)</div>
                  <input type="number" style={{ ...inp, width: '100%' }} placeholder="Not recorded" value={b.deposit_amount ?? ''} min={0} step={0.01}
                    onChange={e => updateDepositAndDetail(b.id, e.target.value === '' ? null : parseFloat(e.target.value))} />
                </div>
              </div>

              {/* ✅ جديد: صورة إثبات العربون (اختيارية) */}
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 11, color: S.muted, marginBottom: 6 }}>🧾 Deposit receipt (optional)</div>
                {b.deposit_image_url ? (
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center', background: 'rgba(255,255,255,.03)', borderRadius: 12, padding: 10 }}>
                    <img src={b.deposit_image_url} alt="deposit receipt" onClick={() => setViewImage(b.deposit_image_url!)}
                      style={{ width: 92, height: 92, objectFit: 'cover', borderRadius: 10, border: `1px solid ${S.gold}`, cursor: 'zoom-in' }} />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <label style={{ padding: '7px 14px', borderRadius: 10, border: `1px solid ${S.blue}`, background: S.blueB, color: S.blue, cursor: 'pointer', fontSize: 12, fontWeight: 700, textAlign: 'center' }}>
                        {uploadingDeposit === b.id ? '⏳ Uploading...' : '🔄 Replace'}
                        <input type="file" accept="image/*" style={{ display: 'none' }} disabled={uploadingDeposit === b.id}
                          onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) uploadDepositImage(b.id, f) }} />
                      </label>
                      <button onClick={() => removeDepositImage(b.id)} style={{ padding: '7px 14px', borderRadius: 10, border: `1px solid ${S.red}`, background: S.redB, color: S.red, cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: 'Tajawal, sans-serif' }}>🗑️ Remove</button>
                    </div>
                  </div>
                ) : (
                  <label style={{ display: 'block', padding: '12px', borderRadius: 12, border: `1px dashed ${S.border}`, color: S.muted, cursor: 'pointer', fontSize: 12.5, textAlign: 'center' }}>
                    {uploadingDeposit === b.id ? '⏳ Uploading...' : '📎 Attach deposit receipt (photo)'}
                    <input type="file" accept="image/*" style={{ display: 'none' }} disabled={uploadingDeposit === b.id}
                      onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) uploadDepositImage(b.id, f) }} />
                  </label>
                )}
              </div>

              {b.notes && (
                <div style={{ marginTop: 16 }}>
                  <div style={{ fontSize: 11, color: S.muted, marginBottom: 6 }}>📝 Special Requests</div>
                  <div style={{ background: 'rgba(255,255,255,.03)', borderRadius: 12, padding: 12, fontSize: 12.5, color: S.white, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{b.notes}</div>
                </div>
              )}

              {/* ✅ جديد: بطاقة حجز قابلة للطباعة (اسم العميل + عدد الأشخاص + بيانات الحجز) */}
              <button onClick={() => printBookingCard(b)}
                style={{ width: '100%', marginTop: 16, padding: '11px', borderRadius: 12, border: `1px solid ${S.blue}`, background: S.blueB, color: S.blue, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>🖨️ Print Booking Card</button>

              <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                {b.status !== 'confirmed' && (
                  <button onClick={() => updateStatusAndDetail(b.id, 'confirmed')}
                    style={{ flex: 1, padding: '11px', borderRadius: 12, border: `1px solid ${S.green}`, background: S.greenB, color: S.green, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>✓ Confirm</button>
                )}
                {b.status !== 'cancelled' && (
                  <button onClick={() => updateStatusAndDetail(b.id, 'cancelled')}
                    style={{ flex: 1, padding: '11px', borderRadius: 12, border: `1px solid ${S.red}`, background: S.redB, color: S.red, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>✕ Cancel</button>
                )}
              </div>
            </div>
          </div>
        )
      })()}

      {/* ✅ جديد: نافذة إدارة الأيام المُغلقة للحجز — مدير النظام + مشرف الصالة (لفرعه فقط) */}
      {canManageClosedDays && showClosedDaysModal && (
        <div onClick={() => setShowClosedDaysModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: S.navy2, borderRadius: 20, border: `1px solid ${S.border}`, padding: 26, maxWidth: 480, width: '100%', maxHeight: '85vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 6 }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 900, color: S.white }}>🔒 Closed Booking Days</div>
                <div style={{ fontSize: 12, color: S.muted, marginTop: 4 }}>لا يقدر العميل يحجز في اليوم اللي تقفله هنا لهذا الفرع</div>
              </div>
              <button onClick={() => setShowClosedDaysModal(false)} style={{ background: 'transparent', border: 'none', color: S.muted, fontSize: 22, cursor: 'pointer', lineHeight: 1 }}>✕</button>
            </div>

            {/* نموذج إغلاق يوم جديد */}
            <div style={{ background: 'rgba(255,255,255,.03)', borderRadius: 14, padding: 16, marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <select style={{ ...inp, width: '100%' }} value={newClosedBranch} onChange={e => setNewClosedBranch(e.target.value)} disabled={!isAdmin}>
                <option value="">Select branch...</option>
                {closedDaysBranches.map(br => <option key={br.id} value={br.id}>{br.name}</option>)}
              </select>
              <input type="date" style={{ ...inp, width: '100%' }} value={newClosedDate} min={new Date().toISOString().split('T')[0]} onChange={e => setNewClosedDate(e.target.value)} />
              <input type="text" style={{ ...inp, width: '100%' }} placeholder="Reason (optional) · السبب (اختياري)" value={newClosedNote} onChange={e => setNewClosedNote(e.target.value)} />
              <button onClick={closeDay} disabled={closingDay || !newClosedBranch || !newClosedDate}
                style={{ padding: '11px', borderRadius: 12, border: `1px solid ${S.red}`, background: S.redB, color: S.red, cursor: closingDay ? 'not-allowed' : 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700, opacity: (!newClosedBranch || !newClosedDate) ? 0.5 : 1 }}>
                {closingDay ? '⏳ Closing...' : '🔒 Close This Day'}
              </button>
            </div>

            {/* قائمة الأيام المُغلقة حاليًا */}
            <div style={{ marginTop: 20 }}>
              <div style={{ fontSize: 12, color: S.muted, marginBottom: 8 }}>Currently closed ({visibleClosedDays.length})</div>
              {visibleClosedDays.length === 0 ? (
                <div style={{ fontSize: 12, color: S.muted, textAlign: 'center', padding: 16 }}>No closed days · لا توجد أيام مُغلقة</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {visibleClosedDays.map(d => (
                    <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(255,255,255,.03)', borderRadius: 12, padding: '10px 14px' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: S.white }}>{branches.find(br => br.id === d.branch_id)?.name || '—'}</div>
                        <div style={{ fontSize: 12, color: S.gold }}>{new Date(d.closed_date).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}</div>
                        {d.note && <div style={{ fontSize: 11, color: S.muted, marginTop: 2 }}>{d.note}</div>}
                      </div>
                      <button onClick={() => reopenDay(d.id)} style={{ padding: '7px 12px', borderRadius: 10, border: `1px solid ${S.green}`, background: S.greenB, color: S.green, cursor: 'pointer', fontSize: 11.5, fontFamily: 'Tajawal, sans-serif', fontWeight: 700, whiteSpace: 'nowrap' }}>🔓 Reopen</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
