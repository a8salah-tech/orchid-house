'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { createBrowserClient } from '@supabase/ssr'
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
  amber: '#F59E0B', amberB: 'rgba(245,158,11,0.12)',
  card: 'rgba(255,255,255,0.04)', card2: 'rgba(255,255,255,0.08)',
}

// ✅ نفس جدول menu_item_reviews اللي بتقرأ وتكتب فيه صفحة المنيو العامة (src/app/menu/[tableId])
// فأي حذف من هنا بيختفي فورًا من تعليقات صفحة المنيو لأنه نفس المصدر بالظبط، مفيش نسخة تانية محفوظة
type Review = {
  id: string
  menu_item_id: string
  stars: number
  review_text: string | null
  reviewer_name: string | null
  created_at: string
  menu_items: { name: string; name_en: string | null; image_url: string | null } | null
}

const T = {
  ar: {
    title: '⭐ تقييمات العملاء', desc: 'كل التقييمات والتعليقات اللي العملاء كتبوها على أصناف المنيو',
    loading: 'جاري التحميل...', empty: 'لا توجد تقييمات مطابقة', noComment: 'بدون تعليق مكتوب',
    guest: 'زائر', totalReviews: 'إجمالي التقييمات', avgRating: 'متوسط التقييم', topItem: 'الأكثر تقييمًا',
    searchPh: 'ابحث باسم الصنف أو العميل أو نص التعليق...', allStars: 'كل التقييمات',
    sortNewest: 'الأحدث أولاً', sortOldest: 'الأقدم أولاً', sortHighest: 'الأعلى تقييمًا', sortLowest: 'الأقل تقييمًا',
    delete: 'حذف', deleteConfirm: 'هل أنت متأكد من حذف هذا التقييم نهائيًا؟ سيختفي فورًا من صفحة المنيو أيضًا.',
    deleting: 'جاري الحذف...', deleted: 'تم الحذف',
  },
  en: {
    title: '⭐ Customer Reviews', desc: 'All ratings and comments customers left on menu items',
    loading: 'Loading...', empty: 'No matching reviews', noComment: 'No written comment',
    guest: 'Guest', totalReviews: 'Total Reviews', avgRating: 'Average Rating', topItem: 'Top Rated Item',
    searchPh: 'Search by item, customer, or comment text...', allStars: 'All Ratings',
    sortNewest: 'Newest First', sortOldest: 'Oldest First', sortHighest: 'Highest Rated', sortLowest: 'Lowest Rated',
    delete: 'Delete', deleteConfirm: 'Delete this review permanently? It will also disappear from the menu page immediately.',
    deleting: 'Deleting...', deleted: 'Deleted',
  },
}

function Stars({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <div style={{ display: 'flex', gap: 2 }}>
      {[1, 2, 3, 4, 5].map(i => (
        <span key={i} style={{ fontSize: size, color: i <= value ? S.gold : S.border, lineHeight: 1 }}>★</span>
      ))}
    </div>
  )
}

const PAGE_SIZE = 50

// ══ Pagination ══ (نفس مكوّن الترقيم المستخدم في صفحة أصناف المنيو، بحجم صفحة ثابت 50)
function Pagination({ page, total, totalPages, onChange, isAr }: {
  page: number; total: number; totalPages: number; onChange: (p: number) => void; isAr: boolean
}) {
  if (totalPages <= 1) return null
  const from = (page - 1) * PAGE_SIZE + 1
  const to = Math.min(page * PAGE_SIZE, total)
  const getPages = (): (number | '...')[] => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1)
    const pages: (number | '...')[] = [1]
    if (page > 3) pages.push('...')
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i)
    if (page < totalPages - 2) pages.push('...')
    pages.push(totalPages)
    return pages
  }
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, flexWrap: 'wrap', gap: 12 }}>
      <div style={{ fontSize: 12, color: S.muted }}>{isAr ? `عرض ${from}–${to} من ${total} تعليق` : `Showing ${from}–${to} of ${total} reviews`}</div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <button onClick={() => onChange(page - 1)} disabled={page === 1}
          style={{ padding: '8px 14px', borderRadius: 10, border: `1px solid ${page === 1 ? S.border : S.gold}`, background: page === 1 ? 'transparent' : S.gold3, color: page === 1 ? S.muted : S.gold, cursor: page === 1 ? 'not-allowed' : 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif' }}>
          {isAr ? '← السابق' : '← Prev'}
        </button>
        {getPages().map((p, i) => (
          p === '...' ? <span key={`e${i}`} style={{ color: S.muted }}>...</span>
          : <button key={p} onClick={() => onChange(p as number)}
              style={{ width: 36, height: 36, borderRadius: 10, border: `1px solid ${p === page ? S.gold : S.border}`, background: p === page ? S.gold3 : 'transparent', color: p === page ? S.gold : S.muted, cursor: 'pointer', fontSize: 13, fontWeight: p === page ? 800 : 400, fontFamily: 'Tajawal, sans-serif' }}>
              {p}
            </button>
        ))}
        <button onClick={() => onChange(page + 1)} disabled={page === totalPages}
          style={{ padding: '8px 14px', borderRadius: 10, border: `1px solid ${page === totalPages ? S.border : S.gold}`, background: page === totalPages ? 'transparent' : S.gold3, color: page === totalPages ? S.muted : S.gold, cursor: page === totalPages ? 'not-allowed' : 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif' }}>
          {isAr ? 'التالي →' : 'Next →'}
        </button>
      </div>
    </div>
  )
}

export default function MenuReviewsPage() {
  const { isAr } = useLang()
  const t = T[isAr ? 'ar' : 'en']
  const supabase = createClient()

  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [starFilter, setStarFilter] = useState<number | 'all'>('all')
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'highest' | 'lowest'>('newest')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [page, setPage] = useState(1)

  const fetchReviews = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('menu_item_reviews')
      .select('id,menu_item_id,stars,review_text,reviewer_name,created_at,menu_items(name,name_en,image_url)')
      .order('created_at', { ascending: false })
    setReviews((data as unknown as Review[]) || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchReviews() }, [fetchReviews])

  async function deleteReview(id: string) {
    if (!confirm(t.deleteConfirm)) return
    setDeletingId(id)
    // ✅ حذف مباشر من menu_item_reviews - نفس الجدول اللي صفحة المنيو العامة بتقرأ منه لايف،
    // فمفيش أي خطوة إضافية مطلوبة عشان التعليق يختفي من هناك كمان
    const { error } = await supabase.from('menu_item_reviews').delete().eq('id', id)
    setDeletingId(null)
    if (error) { alert('❌ ' + error.message); return }
    setReviews(prev => prev.filter(r => r.id !== id))
  }

  const stats = useMemo(() => {
    if (reviews.length === 0) return { total: 0, avg: 0, top: null as { name: string; avg: number; count: number } | null }
    const total = reviews.length
    const avg = reviews.reduce((s, r) => s + r.stars, 0) / total
    const byItem = new Map<string, { name: string; sum: number; count: number }>()
    reviews.forEach(r => {
      const name = isAr ? (r.menu_items?.name || '—') : (r.menu_items?.name_en || r.menu_items?.name || '—')
      const cur = byItem.get(r.menu_item_id) || { name, sum: 0, count: 0 }
      cur.sum += r.stars; cur.count += 1
      byItem.set(r.menu_item_id, cur)
    })
    // ✅ أعلى صنف = أعلى متوسط تقييم، وعند التساوي يفوز الصنف اللي عنده تقييمات أكتر
    let top: { name: string; avg: number; count: number } | null = null
    byItem.forEach(v => {
      const a = v.sum / v.count
      if (!top || a > top.avg || (a === top.avg && v.count > top.count)) top = { name: v.name, avg: a, count: v.count }
    })
    return { total, avg, top }
  }, [reviews, isAr])

  const filtered = useMemo(() => {
    let list = [...reviews]
    if (starFilter !== 'all') list = list.filter(r => r.stars === starFilter)
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(r =>
        (r.menu_items?.name || '').toLowerCase().includes(q) ||
        (r.menu_items?.name_en || '').toLowerCase().includes(q) ||
        (r.reviewer_name || '').toLowerCase().includes(q) ||
        (r.review_text || '').toLowerCase().includes(q)
      )
    }
    list.sort((a, b) => {
      if (sortBy === 'newest') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      if (sortBy === 'oldest') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      if (sortBy === 'highest') return b.stars - a.stars
      return a.stars - b.stars
    })
    return list
  }, [reviews, search, starFilter, sortBy])

  // ✅ الرجوع لصفحة 1 لما الفلتر/البحث/الترتيب يتغيّر - عشان ما نفضلش واقفين على صفحة بقت فاضية
  useEffect(() => { setPage(1) }, [search, starFilter, sortBy])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  // ✅ لو حذفنا آخر تعليق في آخر صفحة (أو الفلتر قلّل النتائج)، نرجع لآخر صفحة صالحة بدل ما تفضل شاشة فاضية
  useEffect(() => { if (page > totalPages) setPage(totalPages) }, [page, totalPages])
  const paged = useMemo(() => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [filtered, page])

  return (
    <div style={{ fontFamily: 'Tajawal, sans-serif', direction: isAr ? 'rtl' : 'ltr', color: S.white }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&display=swap');`}</style>

      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: S.white, marginBottom: 4 }}>{t.title}</h1>
        <p style={{ fontSize: 13, color: S.muted }}>{t.desc}</p>
      </div>

      {/* ── إحصائيات سريعة ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 20 }}>
        <div style={{ background: S.navy2, border: `1px solid ${S.border}`, borderRadius: 14, padding: '14px 16px' }}>
          <div style={{ fontSize: 11, color: S.muted, marginBottom: 6 }}>💬 {t.totalReviews}</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: S.gold }}>{stats.total}</div>
        </div>
        <div style={{ background: S.navy2, border: `1px solid ${S.border}`, borderRadius: 14, padding: '14px 16px' }}>
          <div style={{ fontSize: 11, color: S.muted, marginBottom: 6 }}>⭐ {t.avgRating}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: S.gold }}>{stats.avg.toFixed(1)}</div>
            <Stars value={Math.round(stats.avg)} />
          </div>
        </div>
        <div style={{ background: S.navy2, border: `1px solid ${S.border}`, borderRadius: 14, padding: '14px 16px' }}>
          <div style={{ fontSize: 11, color: S.muted, marginBottom: 6 }}>🏆 {t.topItem}</div>
          <div style={{ fontSize: 14, fontWeight: 800, color: S.white, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {stats.top ? stats.top.name : '—'}
          </div>
          {stats.top && <div style={{ fontSize: 11, color: S.muted, marginTop: 2 }}>{stats.top.avg.toFixed(1)} ★ · {stats.top.count}</div>}
        </div>
      </div>

      {/* ── فلاتر ── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 18 }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t.searchPh}
          style={{ flex: '1 1 260px', padding: '10px 14px', borderRadius: 10, border: `1px solid ${S.border}`, background: S.navy2, color: S.white, fontSize: 13, fontFamily: 'Tajawal, sans-serif' }} />
        <select value={starFilter} onChange={e => setStarFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
          style={{ padding: '10px 14px', borderRadius: 10, border: `1px solid ${S.border}`, background: S.navy2, color: S.white, fontSize: 13, fontFamily: 'Tajawal, sans-serif' }}>
          <option value="all">{t.allStars}</option>
          {[5, 4, 3, 2, 1].map(n => <option key={n} value={n}>{'★'.repeat(n)} ({n})</option>)}
        </select>
        <select value={sortBy} onChange={e => setSortBy(e.target.value as typeof sortBy)}
          style={{ padding: '10px 14px', borderRadius: 10, border: `1px solid ${S.border}`, background: S.navy2, color: S.white, fontSize: 13, fontFamily: 'Tajawal, sans-serif' }}>
          <option value="newest">{t.sortNewest}</option>
          <option value="oldest">{t.sortOldest}</option>
          <option value="highest">{t.sortHighest}</option>
          <option value="lowest">{t.sortLowest}</option>
        </select>
      </div>

      {/* ── القائمة ── */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: S.muted }}>⏳ {t.loading}</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: S.muted }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>📭</div>
          {t.empty}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {paged.map(r => (
            <div key={r.id} style={{ display: 'flex', gap: 14, background: S.navy2, border: `1px solid ${S.border}`, borderRadius: 14, padding: 14, alignItems: 'flex-start' }}>
              {r.menu_items?.image_url ? (
                <img src={r.menu_items.image_url} alt="" style={{ width: 52, height: 52, borderRadius: 10, objectFit: 'cover', flexShrink: 0, border: `1px solid ${S.border}` }} />
              ) : (
                <div style={{ width: 52, height: 52, borderRadius: 10, background: S.card, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>🍽️</div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: 800, color: S.white }}>
                    {isAr ? (r.menu_items?.name || '—') : (r.menu_items?.name_en || r.menu_items?.name || '—')}
                  </span>
                  <Stars value={r.stars} />
                </div>
                <div style={{ fontSize: 13, color: r.review_text ? S.white : S.muted, lineHeight: 1.6, marginBottom: 6, fontStyle: r.review_text ? 'normal' : 'italic' }}>
                  {r.review_text || t.noComment}
                </div>
                <div style={{ fontSize: 11, color: S.muted }}>
                  👤 {r.reviewer_name || t.guest} · {new Date(r.created_at).toLocaleString(isAr ? 'ar-EG' : 'en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
              <button onClick={() => deleteReview(r.id)} disabled={deletingId === r.id}
                style={{ flexShrink: 0, padding: '7px 12px', borderRadius: 8, border: `1px solid ${S.red}`, background: S.redB, color: S.red, cursor: deletingId === r.id ? 'not-allowed' : 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', fontWeight: 700, opacity: deletingId === r.id ? 0.6 : 1 }}>
                {deletingId === r.id ? '⏳' : `🗑️ ${t.delete}`}
              </button>
            </div>
          ))}
        </div>
      )}

      <Pagination page={page} total={filtered.length} totalPages={totalPages} onChange={setPage} isAr={isAr} />
    </div>
  )
}
