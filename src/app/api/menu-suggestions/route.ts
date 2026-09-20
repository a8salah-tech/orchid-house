import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// ✅ اقتراحات "أكمل وجبتك" قبل تأكيد الطلب — تلقائية 100% من المبيعات الفعلية لآخر 30 يوماً، بلا تعليم يدوي.
// المسار يقرأ order_items بمفتاح service-role (الصفحة العامة لا تقرأ سجل الطلبات) ويرجّع أرقام أصناف فقط،
// والمتصفح هو اللي يطابقها على قائمة المنيو الظاهرة له (الاسم والصورة والتوفر والأحجام).
const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const DAYS = 30
const MIN_PRICE = 5
const CACHE_MS = 60 * 60 * 1000
const PAGE = 1000

type Suggestions = { starters: string[]; drinks: string[]; addons: string[]; desserts: string[]; bread: string | null }
let cache: { at: number; data: Suggestions } | null = null

const EMPTY: Suggestions = { starters: [], drinks: [], addons: [], desserts: [], bread: null }

async function compute(): Promise<Suggestions> {
  const [{ data: cats }, { data: items }, { data: sizes }] = await Promise.all([
    sb.from('menu_categories').select('id,name_en,destination').eq('is_active', true),
    sb.from('menu_items').select('id,name_en,price,category_id').eq('is_active', true).eq('is_available', true),
    sb.from('menu_item_sizes').select('menu_item_id').eq('is_active', true),
  ])
  if (!cats || !items) return EMPTY

  // الأصناف ذات الأحجام لا تُقترح — تحتاج اختيار حجم قبل الإضافة
  const hasSizes = new Set((sizes || []).map(s => s.menu_item_id))
  const catById = new Map(cats.map(c => [c.id, c]))
  const nameOf = (categoryId: string) => (catById.get(categoryId)?.name_en || '').trim().toLowerCase()

  const since = new Date(Date.now() - DAYS * 24 * 60 * 60 * 1000).toISOString()
  const { count } = await sb.from('order_items')
    .select('id', { count: 'exact', head: true }).gte('created_at', since).neq('status', 'cancelled')
  const pages = Math.ceil((count || 0) / PAGE)
  const sold = new Map<string, number>()
  for (let start = 0; start < pages; start += 10) {
    const batch = await Promise.all(
      Array.from({ length: Math.min(10, pages - start) }, (_, k) => {
        const from = (start + k) * PAGE
        return sb.from('order_items').select('menu_item_id,quantity')
          .gte('created_at', since).neq('status', 'cancelled').order('id').range(from, from + PAGE - 1)
      })
    )
    for (const r of batch) for (const row of r.data || []) {
      if (row.menu_item_id) sold.set(row.menu_item_id, (sold.get(row.menu_item_id) || 0) + (row.quantity || 1))
    }
  }

  const top = (pred: (i: { id: string; name_en: string; price: number; category_id: string }) => boolean, limit = 6) =>
    items
      .filter(i => !hasSizes.has(i.id) && pred(i))
      .sort((a, b) => (sold.get(b.id) || 0) - (sold.get(a.id) || 0))
      .slice(0, limit)
      .map(i => i.id)

  const bread = items.find(i => nameOf(i.category_id) === 'add on' && i.name_en.trim().toLowerCase() === 'bread' && !hasSizes.has(i.id))

  return {
    starters: top(i => nameOf(i.category_id) === 'hot appetizers' && i.price >= MIN_PRICE),
    // المشروبات المقترحة: من قسم Cold Drinks فقط (أي نوع بارد)، والماء لا يُقترح — لا يرفع قيمة السلة
    drinks: top(i => nameOf(i.category_id) === 'cold drinks' && i.price >= MIN_PRICE && !/water/i.test(i.name_en)),
    addons: top(i => nameOf(i.category_id) === 'add on' && i.price >= MIN_PRICE && !/water/i.test(i.name_en)),
    desserts: top(i => nameOf(i.category_id) === 'dessert' && i.price >= MIN_PRICE),
    bread: bread?.id || null,
  }
}

export async function GET() {
  try {
    if (!cache || Date.now() - cache.at > CACHE_MS) cache = { at: Date.now(), data: await compute() }
    return NextResponse.json(cache.data, { headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=600' } })
  } catch {
    return NextResponse.json(EMPTY)
  }
}
