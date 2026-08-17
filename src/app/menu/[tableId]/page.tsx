'use client'


import { useEffect, useState, useRef } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useParams } from 'next/navigation'

const createClient = () => createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// ══ Orchid House Brand Colors — Light Theme ══
const C = {
  bg:        '#FFFFFF',   // white background
  bg2:       '#FFFFFF',   // card
  bg3:       '#FFFFFF',   // header
  blue1:     '#00FFFF',   // cyan (primary)
  blue2:     '#00A8A8',   // darker cyan (keeps white text readable on top of it)
  blue3:     '#0891B2',   // mid cyan (secondary accent)
  silver:    '#4B4358',   // dark secondary text
  silver2:   '#8A7F97',   // muted text
  white:     '#2A2233',   // primary dark text (on white background)
  white2:    '#3D3348',
  border:    'rgba(0,180,180,0.25)',
  border2:   'rgba(0,180,180,0.45)',
  glow:      'rgba(0,200,200,0.15)',
  glow2:     'rgba(0,200,200,0.35)',
}

type Category = {
  id: string; name: string; name_en: string; destination: string
  available_days?: number[] | null; available_from?: string | null; available_to?: string | null
  time_badge_ar?: string | null; time_badge_en?: string | null
}
type MenuItem  = { id: string; name: string; name_en: string; price: number; discount_percent?: number; description: string; description_en: string; category_id: string; is_available: boolean; image_url?: string; sizes?: { id: string; name: string; name_en: string; price: number; is_active: boolean }[] }
type CartItem  = { item: MenuItem; quantity: number; notes: string; selectedSize?: { id: string; name: string; name_en: string; price: number } | null }
type Phase     = 'welcome' | 'rewards' | 'menu' | 'cart' | 'done'
// ✅ New: dish review — star rating (1-5) with an optional written comment and optional reviewer name
type Review    = { id: string; menu_item_id: string; stars: number; review_text: string | null; reviewer_name: string | null; created_at: string }

// ✅ Is this category currently available based on its configured day/time (no restrictions = always available)
function isCategoryAvailableNow(cat: Category): boolean {
  if (!cat.available_days && !cat.available_from && !cat.available_to) return true
  const now = new Date()
  const day = now.getDay() // 0=Sunday ... 6=Saturday
  if (cat.available_days && cat.available_days.length > 0 && !cat.available_days.includes(day)) return false
  if (cat.available_from || cat.available_to) {
    const nowMinutes = now.getHours() * 60 + now.getMinutes()
    if (cat.available_from) {
      const [h, m] = cat.available_from.split(':').map(Number)
      if (nowMinutes < h * 60 + m) return false
    }
    if (cat.available_to) {
      const [h, m] = cat.available_to.split(':').map(Number)
      if (nowMinutes >= h * 60 + m) return false
    }
  }
  return true
}

export default function CustomerMenuPage() {
  const params  = useParams()
  const tableId = params?.tableId as string
  const sbRef   = useRef(createClient())
  const sb      = sbRef.current

  const [table, setTable]           = useState<{ id: string; number: number; name: string } | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [items, setItems]           = useState<MenuItem[]>([])
  const [loading, setLoading]       = useState(true)
  const [notFound, setNotFound]     = useState(false)
  const [activeCat, setActiveCat]   = useState<string>('all')
  const [search, setSearch]         = useState('')
  const [cart, setCart]             = useState<CartItem[]>([])
  const [phase, setPhase]           = useState<Phase>('welcome')
  const [submitting, setSubmitting] = useState(false)
  const [orderNumber, setOrderNumber] = useState('')
  const [confirmedOrderId, setConfirmedOrderId] = useState<string | null>(null)
  // ✅ New: Orchid Rewards system - customer enters just their mobile number (no password); if already registered they see their points,
  // if new, they are registered automatically and earn 50 welcome points
  const [rewardsPhone, setRewardsPhone] = useState('')
  const [rewardsName, setRewardsName] = useState('')
  const [rewardsSubmitting, setRewardsSubmitting] = useState(false)
  const [rewardsError, setRewardsError] = useState('')
  const [rewardsResult, setRewardsResult] = useState<{ customerId: string; name: string; points: number; isNew: boolean } | null>(null)
  const [identifiedCustomerId, setIdentifiedCustomerId] = useState<string | null>(null)
  // ✅ New: whether the customer is here to "join" or just to "check their points" - only changes the displayed text, same lookup mechanism
  const [rewardsIntent, setRewardsIntent] = useState<'join' | 'check'>('join')
  // ✅ Points threshold required to unlock a discount - a single constant so it only needs to change in one place
  const DISCOUNT_POINTS_TARGET = 1000
  // ✅ New: full accumulated order items (all rounds combined) from the database - instead of relying on the local cart, which resets with each new order
  const [liveOrderItems, setLiveOrderItems] = useState<{ id: string; name: string; quantity: number; unit_price: number; size_name?: string | null }[]>([])
  const [waiterCalled, setWaiterCalled] = useState(false)
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null)
  const [selectedSize, setSelectedSize]   = useState<{ id: string; name: string; name_en: string; price: number } | null>(null)

  // ✅ New: dish rating system — stars and written comment for each item
  const [reviews, setReviews] = useState<Review[]>([])
  const [newReviewStars, setNewReviewStars] = useState(0)
  const [newReviewText, setNewReviewText] = useState('')
  const [reviewerName, setReviewerName] = useState('')
  const [reviewSubmitting, setReviewSubmitting] = useState(false)
  const [reviewError, setReviewError] = useState('')
  const [reviewSubmitted, setReviewSubmitted] = useState(false)

  // ✅ New: floating "+1" animation when adding an item to the cart — the latest trend seen in food apps worldwide
  const [flyingPlusOnes, setFlyingPlusOnes] = useState<{ id: number; x: number; y: number }[]>([])
  function triggerFlyPlusOne(e: { clientX: number; clientY: number }) {
    const id = Date.now() + Math.random()
    setFlyingPlusOnes(p => [...p, { id, x: e.clientX, y: e.clientY }])
    setTimeout(() => setFlyingPlusOnes(p => p.filter(f => f.id !== id)), 900)
  }
  // ✅ New: short visual pulse on the add button itself when tapped
  const [pulseKey, setPulseKey] = useState<string | null>(null)
  function bumpPulse(key: string) {
    setPulseKey(key)
    setTimeout(() => setPulseKey(k => (k === key ? null : k)), 400)
  }

  // ✅ "Who's Paying the Bill?" game - just for fun, no connection to the cashier or actual payment
  const [showPayGame, setShowPayGame] = useState(false)
  const [gamePhone, setGamePhone] = useState('')
  const [gameNames, setGameNames] = useState<string[]>(['', ''])
  const [gameSpinning, setGameSpinning] = useState(false)
  const [wheelRotation, setWheelRotation] = useState(0)
  const [gameWinner, setGameWinner] = useState<string | null>(null)
  // ✅ Fix (critical): synchronous lock (not state) preventing confirmOrder from running more than once at the same instant.
  // The (submitting) state update is asynchronous (React batching), so if the customer taps the button more than once quickly
  // (very common on a slow network), confirmOrder() would actually run twice in parallel before the button gets disabled in the UI,
  // causing a conflict: one run succeeds while the other clashes and fails, while the second run is still in progress and the button stays stuck on "Placing order...".
  const isSubmittingRef = useRef(false)
  // ✅ We update "now" every minute so time-restricted categories automatically appear/disappear without the customer needing to refresh the page
  const [, forceTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => forceTick(t => t + 1), 60 * 1000)
    return () => clearInterval(id)
  }, [])

  // ✅ New: fetch all items of a given order (all rounds) from the database, so they display in full no matter how many rounds the customer ordered
  async function fetchLiveOrderItems(orderId: string) {
    const { data } = await sb.from('order_items')
      .select('id, quantity, unit_price, size_name, status, menu_items(name, name_en)')
      .eq('order_id', orderId)
      .neq('status', 'cancelled')
    setLiveOrderItems((data || []).map((i: any) => ({
      id: i.id, quantity: i.quantity, unit_price: i.unit_price, size_name: i.size_name,
      name: i.menu_items?.name_en || i.menu_items?.name || '',
    })))
  }

  useEffect(() => {
    async function load() {
      const { data: tbl } = await sb.from('tables').select('*').eq('id', tableId).single()
      if (!tbl) { setNotFound(true); setLoading(false); return }
      setTable(tbl)
      const [cats, itms, revs] = await Promise.all([
        sb.from('menu_categories').select('id,name,name_en,destination,available_days,available_from,available_to,time_badge_ar,time_badge_en').eq('is_active', true).order('sort_order'),
        sb.from('menu_items') .select('id,name,name_en,price,discount_percent,description,description_en,category_id,is_available,image_url,sort_order,menu_categories(sort_order),sizes:menu_item_sizes(id,name,name_en,price,is_active)') .eq('is_available', true) .eq('is_active', true) ,
        // ✅ New: fetch all of the restaurant's reviews in one call (stars + comment) to compute the average and show comments for each item
        sb.from('menu_item_reviews').select('id,menu_item_id,stars,review_text,reviewer_name,created_at').order('created_at', { ascending: false })
      ])
      setCategories(cats.data || [])
      setItems(itms.data || [])
      setReviews(revs.data || [])
      // ✅ If the table already has an active order (not yet closed at the cashier), show the "Confirmed" screen directly
      // instead of the menu from scratch - the order stays visible to the customer as long as the table is open, even if they close and reopen the page
      const { data: existingOrders } = await sb.from('orders')
        .select('id').eq('table_id', tbl.id).in('status', ['confirmed', 'preparing', 'ready'])
        .order('created_at', { ascending: false }).limit(1)
      const existing = existingOrders?.[0]

      // ✅ Fix per user request: removed automatically following a redirect on full page load - the table is now
      // always free for anyone opening the page again after a redirect (even if the same old customer closes and reopens the page).
      // Following a redirected order is now limited to "Order More" only, if the customer still has the same tab open without closing it
      // (see checkAndFollowRedirect) - this fixes the duplicate-order issue without affecting a new customer seated afterward

      if (existing) {
        setConfirmedOrderId(existing.id)
        setOrderNumber(existing.id.slice(-6).toUpperCase())
        await fetchLiveOrderItems(existing.id)
        setPhase('done')
      }
      setLoading(false)
    }
    if (tableId) load()
  }, [tableId, sb])

// ✅ Currently available categories only (a time-restricted category automatically disappears outside its window)
const visibleCategories = categories.filter(isCategoryAvailableNow)
const visibleCategoryIds = new Set(visibleCategories.map(c => c.id))

const filteredItems = items
  .filter(i => visibleCategoryIds.has(i.category_id) || !categories.some(c => c.id === i.category_id))
  .filter(i => {
    const matchCat = activeCat === 'all' || i.category_id === activeCat
    const q = search.trim()
    return matchCat && (!q || i.name.includes(q) || i.name_en.toLowerCase().includes(q.toLowerCase()))
  })
  .sort((a, b) => {
    const aDiscount = (a.discount_percent || 0) > 0 ? 0 : 1
    const bDiscount = (b.discount_percent || 0) > 0 ? 0 : 1
    if (aDiscount !== bDiscount) return aDiscount - bDiscount
    const aCatOrder = (a as any).menu_categories?.sort_order ?? 99
    const bCatOrder = (b as any).menu_categories?.sort_order ?? 99
    if (aCatOrder !== bCatOrder) return aCatOrder - bCatOrder
    const aOrder = (a as any).sort_order ?? 0
    const bOrder = (b as any).sort_order ?? 0
    return aOrder - bOrder
  })

  useEffect(() => {
    if (activeCat !== 'all' && !visibleCategoryIds.has(activeCat)) setActiveCat('all')
  }, [activeCat, visibleCategoryIds])

  // ✅ New: reset the "add your rating" form every time the customer opens a different item
  useEffect(() => {
    setNewReviewStars(0)
    setNewReviewText('')
    setReviewerName('')
    setReviewError('')
    setReviewSubmitted(false)
  }, [selectedItem?.id])

  function addToCart(item: MenuItem, size?: { id: string; name: string; name_en: string; price: number } | null) {
    setCart(p => {
      const ex = p.find(c => c.item.id === item.id && (size ? c.selectedSize?.id === size.id : !c.selectedSize))
      if (ex) return p.map(c => c.item.id === item.id && (size ? c.selectedSize?.id === size.id : !c.selectedSize) ? { ...c, quantity: c.quantity + 1 } : c)
      return [...p, { item, quantity: 1, notes: '', selectedSize: size || null }]
    })
  }

  function removeFromCart(itemId: string, sizeId?: string | null) {
    setCart(p => {
      const ex = p.find(c => c.item.id === itemId && (sizeId ? c.selectedSize?.id === sizeId : !c.selectedSize))
      if (!ex) return p
      if (ex.quantity === 1) return p.filter(c => !(c.item.id === itemId && (sizeId ? c.selectedSize?.id === sizeId : !c.selectedSize)))
      return p.map(c => c.item.id === itemId && (sizeId ? c.selectedSize?.id === sizeId : !c.selectedSize) ? { ...c, quantity: c.quantity - 1 } : c)
    })
  }

  function getQty(itemId: string, sizeId?: string) { return cart.filter(c => c.item.id === itemId && (sizeId ? c.selectedSize?.id === sizeId : !c.selectedSize)).reduce((s, c) => s + c.quantity, 0) }

  // ✅ New: compute the average stars and rating count for a given item from the preloaded reviews list
  function getItemRating(itemId: string): { avg: number; count: number } {
    const itemReviews = reviews.filter(r => r.menu_item_id === itemId)
    if (itemReviews.length === 0) return { avg: 0, count: 0 }
    const avg = itemReviews.reduce((s, r) => s + r.stars, 0) / itemReviews.length
    return { avg, count: itemReviews.length }
  }

  // ✅ New: submit a rating (stars + optional written comment) for a given item and add it immediately to the displayed reviews list
  async function submitReview() {
    if (!selectedItem || newReviewStars < 1) { setReviewError('Please select a star rating first'); return }
    setReviewSubmitting(true)
    setReviewError('')
    const { data, error } = await sb.from('menu_item_reviews').insert([{
      menu_item_id: selectedItem.id,
      stars: newReviewStars,
      review_text: newReviewText.trim() || null,
      reviewer_name: reviewerName.trim() || null,
    }]).select('id,menu_item_id,stars,review_text,reviewer_name,created_at').single()
    if (error || !data) {
      // ✅ log the real Supabase error to the console so the exact cause can be diagnosed (RLS, missing table, missing extension, etc.)
      console.error('menu_item_reviews insert failed:', error?.message, error?.code, error?.details, error?.hint)
      setReviewError('An error occurred while submitting the review, please try again')
      setReviewSubmitting(false)
      return
    }
    setReviews(p => [data, ...p])
    setNewReviewStars(0)
    setNewReviewText('')
    setReviewerName('')
    setReviewSubmitting(false)
    setReviewSubmitted(true)
    setTimeout(() => setReviewSubmitted(false), 2500)
  }
  const cartCount = cart.reduce((s, c) => s + c.quantity, 0)
  const cartTotal = cart.reduce((s, c) => {
    const unitPrice = c.selectedSize
      ? c.selectedSize.price
      : c.item.discount_percent && c.item.discount_percent > 0
        ? c.item.price * (1 - c.item.discount_percent / 100)
        : c.item.price
    return s + unitPrice * c.quantity
  }, 0)

  // ✅ "Who's Paying the Bill?" game - real spinning wheel
  function updateGamePeopleCount(n: number) {
    const count = Math.max(2, n)
    setGameNames(prev => {
      const next = [...prev]
      while (next.length < count) next.push('')
      while (next.length > count) next.pop()
      return next
    })
  }

  // ✅ Save the first person's (organizer's) details in the restaurant customer table, if they entered their mobile number
  // ✅ New: Orchid Rewards - phone-only lookup (no password); if found, shows their points; if new, registers them and gives 50 welcome points
  async function handleRewardsSubmit() {
    const phone = rewardsPhone.trim()
    if (!phone || phone.length < 8) { setRewardsError('Please enter a valid phone number'); return }
    setRewardsSubmitting(true)
    setRewardsError('')
    try {
      const { data: existing, error: findErr } = await sb.from('customers').select('id,name,loyalty_points').eq('phone', phone).maybeSingle()
      if (findErr) { setRewardsError('Something went wrong, please try again'); setRewardsSubmitting(false); return }
      if (existing) {
        // ✅ Existing customer - show their current points
        setRewardsResult({ customerId: existing.id, name: existing.name, points: existing.loyalty_points || 0, isNew: false })
        setIdentifiedCustomerId(existing.id)
      } else {
        // ✅ New customer - register them with 50 welcome points
        const name = rewardsName.trim() || 'Guest'
        const { data: created, error: insertErr } = await sb.from('customers').insert([{ name, phone, loyalty_points: 50, notes: '🌸 Joined via Menu Welcome Screen' }]).select('id,name,loyalty_points').single()
        if (insertErr || !created) { setRewardsError('Something went wrong, please try again'); setRewardsSubmitting(false); return }
        setRewardsResult({ customerId: created.id, name: created.name, points: created.loyalty_points || 50, isNew: true })
        setIdentifiedCustomerId(created.id)
      }
    } catch {
      setRewardsError('Something went wrong, please try again')
    }
    setRewardsSubmitting(false)
  }

  async function saveGameOrganizerAsCustomer() {
    const firstName = gameNames[0]?.trim()
    const phone = gamePhone.trim()
    if (!firstName || !phone) return
    // ✅ Silent diagnostic logging in the database (no effect on the customer experience) to help find the cause of any order-linking issue
    async function log(step: string, success: boolean, error_message: string | null, customerId?: string | null) {
      try {
        await sb.from('game_link_debug_log').insert([{
          confirmed_order_id: confirmedOrderId, customer_id: customerId || null, phone, step, success, error_message,
        }])
      } catch { /* ignore - this logging must never break the game itself */ }
    }
    try {
      const { data: existing, error: findErr } = await sb.from('customers').select('id').eq('phone', phone).maybeSingle()
      await log('find_customer', !findErr, findErr?.message || null, existing?.id)
      let customerId = existing?.id
      if (!customerId) {
        const { data: created, error: insertErr } = await sb.from('customers').insert([{ name: firstName, phone, loyalty_points: 0, notes: '🎲 Added via "Who\'s Paying the Bill?" game' }]).select('id').single()
        await log('insert_customer', !insertErr, insertErr?.message || null, created?.id)
        customerId = created?.id
      }
      if (customerId && confirmedOrderId) {
        const { error: linkErr } = await sb.from('orders').update({ customer_id: customerId }).eq('id', confirmedOrderId)
        await log('link_order', !linkErr, linkErr?.message || null, customerId)
      } else {
        await log('skipped_link', false, `customerId=${customerId || 'null'} confirmedOrderId=${confirmedOrderId || 'null'}`, customerId)
      }
    } catch (e: any) {
      await log('exception', false, e?.message || String(e))
    }
  }

  function playPayGame() {
    const validNames = gameNames.map(n => n.trim()).filter(Boolean)
    if (validNames.length < 2 || gameSpinning) return
    if (!gamePhone.trim()) { alert('Please enter a mobile number to play'); return }
    saveGameOrganizerAsCustomer()
    setGameWinner(null)
    setGameSpinning(true)
    const n = validNames.length
    const winnerIdx = Math.floor(Math.random() * n)
    const segAngle = 360 / n
    const centerAngle = winnerIdx * segAngle + segAngle / 2
    const extraSpins = 6 + Math.floor(Math.random() * 3) // 6-8 full spins
    // add a small random offset within the segment bounds so it never stops at exactly the same spot every time (feels more realistic)
    const jitter = (Math.random() - 0.5) * (segAngle * 0.6)
    const target = wheelRotation + extraSpins * 360 + ((360 - centerAngle - wheelRotation % 360 + 360) % 360) + jitter
    setWheelRotation(target)
    // animation duration is 4.2 seconds (matches the CSS transition below)
    setTimeout(() => {
      setGameWinner(validNames[winnerIdx])
      setGameSpinning(false)
    }, 4200)
  }

  function resetPayGame() {
    setGameWinner(null)
    setGameNames(['', ''])
    setGamePhone('')
    setWheelRotation(0)
  }

  // ✅ Share the game result - generates an image with the Orchid logo and the winner's name, and opens the native mobile share sheet
  // (covers WhatsApp, Instagram, and any other installed app) - on desktop it falls back to direct WhatsApp/Facebook/X links
  async function shareGameResult() {
    if (!gameWinner) return
    const shareText = `🎲 We played "Who's Paying the Bill?" at Orchid House and ${gameWinner} is paying! 💸🌸`
    try {
      const canvas = document.createElement('canvas')
      canvas.width = 800
      canvas.height = 800
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.fillStyle = C.bg
        ctx.fillRect(0, 0, 800, 800)
        try {
          const logo = new Image()
          logo.crossOrigin = 'anonymous'
          logo.src = '/logo.png'
          await new Promise(res => { logo.onload = res; logo.onerror = res; setTimeout(res, 800) })
          ctx.drawImage(logo, 300, 90, 200, 200)
        } catch {}
        ctx.textAlign = 'center'
        ctx.fillStyle = C.blue1
        ctx.font = 'bold 34px Arial'
        ctx.fillText("🎲 Who's Paying the Bill?", 400, 340)
        ctx.fillStyle = C.white
        ctx.font = 'bold 64px Arial'
        ctx.fillText(gameWinner, 400, 460)
        ctx.font = '30px Arial'
        ctx.fillStyle = C.silver2
        ctx.fillText('💸 pays the bill today!', 400, 510)
        ctx.font = 'bold 26px Arial'
        ctx.fillStyle = C.blue1
        ctx.fillText('🌸 Orchid House Restaurant', 400, 650)
      }
      const blob: Blob | null = await new Promise(res => canvas.toBlob(res, 'image/png'))
      if (blob) {
        const file = new File([blob], 'orchid-who-pays.png', { type: 'image/png' })
        const nav = navigator as any
        if (nav.canShare && nav.canShare({ files: [file] })) {
          await nav.share({ files: [file], text: shareText, title: "Who's Paying the Bill?" })
          return
        }
        if (nav.share) {
          await nav.share({ text: shareText })
          return
        }
        // ✅ Desktop fallback: automatically download the image so the user can upload it themselves to any platform
        const link = document.createElement('a')
        link.href = URL.createObjectURL(blob)
        link.download = 'orchid-who-pays.png'
        link.click()
      }
    } catch {
      // ignore any error generating the image, the user can still use the share links below
    }
  }
  function shareToWhatsApp() {
    const text = `🎲 We played "Who's Paying the Bill?" at 🌸 Orchid House and ${gameWinner} is paying! 💸`
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')
  }
  function shareToFacebook() {
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.href)}`, '_blank')
  }
  function shareToTwitter() {
    const text = `🎲 We played "Who's Paying the Bill?" at 🌸 Orchid House and ${gameWinner} is paying! 💸`
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank')
  }

  // ✅ New: unified function that checks "has the table been redirected elsewhere?" and updates the screen immediately if so - without
  // the customer needing a manual refresh. Used here (when tapping "Order More") and also inside the order confirmation itself
  async function checkAndFollowRedirect() {
    if (!table) return
    const { data: freshTableRow } = await sb.from('tables').select('*').eq('id', table.id).single()
    const isRedirectRecent = freshTableRow?.redirected_at && (Date.now() - new Date(freshTableRow.redirected_at).getTime()) < 4 * 60 * 60 * 1000
    if (freshTableRow?.redirected_to_table_id && isRedirectRecent) {
      const { data: redirectedTableFull } = await sb.from('tables').select('*').eq('id', freshTableRow.redirected_to_table_id).single()
      if (redirectedTableFull) setTable(redirectedTableFull)
    }
  }

  async function confirmOrder() {
    if (!table || cart.length === 0) return
    // ✅ Fix (critical): immediate synchronous check — if a run is already in progress, stop right away with no delay
    if (isSubmittingRef.current) return
    isSubmittingRef.current = true
    setSubmitting(true)
    const catMap = Object.fromEntries(categories.map(c => [c.id, c.destination]))

    // ✅ Critical fix: removed the redirect check from here entirely - it used to run for any customer confirming an order (even a completely
    // new customer opening an empty menu), so it would wrongly redirect the new customer's order to the old customer's order if the table had
    // been redirected recently. Correctly following the old customer is now limited to "Order More" (checkAndFollowRedirect)
    // which updates the table state before ever reaching the confirmation screen - so no second conflicting check is needed here
    const effectiveTableId = table.id

    // check whether an order already exists for the table
    const { data: existingOrders } = await sb.from('orders')
      .select('id,total_amount')
      .eq('table_id', effectiveTableId)
      .in('status', ['confirmed', 'preparing', 'ready'])
      .order('created_at', { ascending: false })
      .limit(1)

    const existingOrder = existingOrders?.[0] || null
    let orderId: string

    if (existingOrder) {
      // add to the existing order and update the total
      orderId = existingOrder.id
      await sb.from('orders').update({
        total_amount: (existingOrder.total_amount || 0) + cartTotal
      }).eq('id', orderId)
    } else {
      // create a new order
      const { data: order, error } = await sb.from('orders').insert([{
        table_id: effectiveTableId, status: 'confirmed',
        total_amount: cartTotal, confirmed_at: new Date().toISOString(),
        // ✅ New: link the customer registered in the Orchid Rewards system (if they entered their mobile number on the welcome screen) directly to the order
        customer_id: identifiedCustomerId || null,
      }]).select('id').single()
      if (error || !order) { isSubmittingRef.current = false; setSubmitting(false); alert('Error, please try again'); return }
      orderId = order.id
    }

    // ✅ Critical fix: as soon as an actual order (new or additional) is recorded for this table, clear any old redirect flag on it
    // immediately - so that if a genuinely different new customer orders here and then taps
    // "Order More", they will not wrongly follow an old redirect to another table. The table now has its own activity again
    await sb.from('tables').update({ redirected_to_table_id: null, redirected_at: null }).eq('id', effectiveTableId)

    // ✅ Fix: compute the correct actual price applied at order time (selected size or discount), instead of always using the base item price
    function actualUnitPrice(c: CartItem) {
      if (c.selectedSize) return c.selectedSize.price
      if (c.item.discount_percent && c.item.discount_percent > 0) return c.item.price * (1 - c.item.discount_percent / 100)
      return c.item.price
    }

    const itemsPayload = cart.map(c => ({
      order_id: orderId, menu_item_id: c.item.id,
      quantity: c.quantity, unit_price: actualUnitPrice(c),
      notes: c.notes || null,
      size_name: c.selectedSize ? (c.selectedSize.name_en || c.selectedSize.name) : null,
      destination: catMap[c.item.category_id] || 'kitchen',
      status: 'pending',
    }))

    // ✅ Fix: we must confirm the items were actually recorded before showing "Order Confirmed" to the customer.
    // previously the code continued with no check at all, so if the insert failed (a momentary network drop, timeout...)
    // the order would be recorded with the correct total but with no items at all, and the customer would still see "Order Confirmed".
    let itemsError = (await sb.from('order_items').insert(itemsPayload)).error
    let attemptCount = 1
    // ✅ 3 attempts instead of two, with a short delay between them (half a second) to give the network a chance to recover from a momentary drop
    while (itemsError && attemptCount < 3) {
      console.error(`order_items insert failed (attempt ${attemptCount}):`, itemsError.message, itemsError.code, itemsError.details, itemsPayload)
      await new Promise(res => setTimeout(res, 500))
      attemptCount++
      itemsError = (await sb.from('order_items').insert(itemsPayload)).error
    }
    if (itemsError) {
      console.error(`order_items insert failed (attempt ${attemptCount}):`, itemsError.message, itemsError.code, itemsError.details, itemsPayload)
      // ✅ log the real error to the database so it can be diagnosed later (console.error is trapped inside the customer's phone and never reaches us)
      try {
        await sb.from('order_submission_errors').insert([{
          table_id: effectiveTableId,
          attempt_count: attemptCount,
          error_message: itemsError.message || null,
          error_code: itemsError.code || null,
          error_details: itemsError.details || null,
          items_payload: itemsPayload,
        }])
      } catch (logErr) {
        console.error('Failed to log order_submission_errors:', logErr)
      }
    }
    if (itemsError) {
      // ✅ Fix: roll back the order update/creation so we don't leave an order with the wrong total and no items
      let rollbackError
      if (existingOrder) {
        rollbackError = (await sb.from('orders').update({ total_amount: existingOrder.total_amount || 0 }).eq('id', orderId)).error
      } else {
        // ✅ Fix: use update to status 'cancelled' instead of delete — because the (anon) customer usually has no DELETE permission under RLS,
        // and delete used to fail silently (without checking the result), leaving the empty order in place exactly like the original problem
        rollbackError = (await sb.from('orders').update({ status: 'cancelled' }).eq('id', orderId)).error
      }
      if (rollbackError) console.error('order rollback failed:', rollbackError.message, rollbackError.code)
      isSubmittingRef.current = false
      setSubmitting(false)
      alert('⚠️ Something went wrong sending your order. Please try again or call the waiter.')
      return
    }

    // ✅ Critical fix: used to set the old table's (table.id) status to "occupied" for the new order, even if the order
    // was actually recorded on the correct table after the redirect (effectiveTableId) - this was exactly why the old table
    // appeared "occupied again" with a separate order after it had been cleared by the redirect
    // ✅ Critical fix: occupied_since now only gets set when this is a genuinely new order, not on every additional
    // round placed on an already-occupied table - otherwise the elapsed-time shown to the cashier kept resetting to
    // zero with every new round instead of reflecting when the customer actually sat down
    if (existingOrder) {
      await sb.from('tables').update({ status: 'occupied', current_order_id: orderId }).eq('id', effectiveTableId)
    } else {
      await sb.from('tables').update({
        status: 'occupied',
        occupied_since: new Date().toISOString(),
        current_order_id: orderId,
      }).eq('id', effectiveTableId)
    }

    setOrderNumber(orderId.slice(-6).toUpperCase())
    setConfirmedOrderId(orderId)
    // ✅ Critical fix: the cart used to never fully reset after completing an order, so if the customer ordered again afterward,
    // the entire old cart contents would be resent again along with the new one, actually duplicating the first round's items in the database
    setCart([])
    // ✅ New: fetch all accumulated order items (all rounds) from the database, so the confirmation screen shows the complete order
    // not just the current round the customer just ordered - this way the first round's items never disappear from their screen
    await fetchLiveOrderItems(orderId)
    // ✅ log IP, user-agent, and device model (if available - Android+Chrome only) for this order - in the background
    ;(async () => {
      let deviceModel: string | null = null
      try {
        const uaData = (navigator as any).userAgentData
        if (uaData?.getHighEntropyValues) {
          const info = await uaData.getHighEntropyValues(['model'])
          deviceModel = info.model || null
        }
      } catch { /* iPhone or another browser that doesn't support this feature - ignore and continue normally */ }
      fetch('/api/log-order-meta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: orderId, user_agent: navigator.userAgent, device_model: deviceModel }),
      }).catch(() => { /* intentionally ignore any error here */ })
    })()
    setPhase('done')
    isSubmittingRef.current = false
    setSubmitting(false)
  }

  const globalStyles = `
    @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800;900&display=swap');
    *{box-sizing:border-box;margin:0;padding:0}
    ::-webkit-scrollbar{display:none}
    body{background:${C.bg};color:${C.white};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
    .ar-text{font-family:'Tajawal','Segoe UI',sans-serif}
    @keyframes fadeUp{from{opacity:0;transform:translateY(30px)}to{opacity:1;transform:translateY(0)}}
    @keyframes chefBounce{0%,100%{transform:translateY(0) rotate(-6deg)}50%{transform:translateY(-16px) rotate(6deg)}}
    @keyframes blueGlow{0%,100%{box-shadow:0 0 20px ${C.glow}}50%{box-shadow:0 0 40px ${C.glow2}}}
    @keyframes slideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
    @keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}
    @keyframes flyPlusOne{0%{opacity:0;transform:translate(-50%,-50%) scale(.5)}15%{opacity:1;transform:translate(-50%,-50%) scale(1.15)}100%{opacity:0;transform:translate(-50%,-140px) scale(1)}}
    @keyframes addBounce{0%{transform:scale(1)}35%{transform:scale(1.28)}60%{transform:scale(.92)}100%{transform:scale(1)}}
    .item-card{transition:transform .15s,box-shadow .15s}
    .item-card:active{transform:scale(.97)}
  `

  // ══ Loading ══
  if (loading) return (
    <div style={{ minHeight:'100dvh', background:C.bg, display:'flex', alignItems:'center', justifyContent:'center' }}>
      <style>{globalStyles}</style>
      <div style={{ textAlign:'center' }}>
        <div style={{ width:80, height:80, borderRadius:'50%', overflow:'hidden', background:C.bg3, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 20px', animation:'spin 2s linear infinite', boxShadow:`0 0 30px ${C.glow2}` }}>
          <img src="/logo.png" alt="Orchid House" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
        </div>
        <div style={{ color:C.blue2, fontSize:16, fontWeight:700 }}>Loading menu...</div>
      </div>
    </div>
  )

  if (notFound) return (
    <div style={{ minHeight:'100dvh', background:C.bg, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:12 }}>
      <style>{globalStyles}</style>
      <div style={{ fontSize:48 }}>❌</div>
      <div style={{ color:C.white, fontSize:18, fontWeight:700 }}>Table not found</div>
    </div>
  )

  // ══ Done ══
  if (phase === 'done') return (
    <div style={{ minHeight:'100dvh', background:C.bg, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
      <style>{globalStyles}</style>
      <div style={{ maxWidth:400, width:'100%', textAlign:'center', animation:'fadeUp .6s ease' }}>
        <div style={{ fontSize:90, display:'inline-block', animation:'chefBounce 2s ease-in-out infinite', marginBottom:24, filter:`drop-shadow(0 8px 20px ${C.glow2})` }}>👨‍🍳</div>
        <div style={{ background:C.bg2, borderRadius:28, border:`1px solid ${C.border2}`, padding:'36px 24px', boxShadow:`0 0 40px ${C.glow}` }}>
          <div style={{ color:C.blue2, fontSize:11, fontWeight:700, letterSpacing:4, textTransform:'uppercase', marginBottom:10 }}>✨ Order Confirmed</div>
          <h2 style={{ color:C.white, fontSize:22, fontWeight:900, marginBottom:10 }}>Your order is being prepared!</h2>
          <p style={{ color:C.silver2, fontSize:13, marginBottom:28, lineHeight:1.7 }}>Our kitchen team is working on your delicious meal. Sit back and relax! 🍽️</p>
          <div style={{ background:`linear-gradient(135deg,rgba(0,200,200,.15),rgba(0,150,150,.15))`, border:`1px solid ${C.border2}`, borderRadius:20, padding:'24px 20px', marginBottom:24, animation:'blueGlow 2s ease infinite' }}>
            <div style={{ color:C.silver2, fontSize:10, letterSpacing:3, marginBottom:8 }}>YOUR ORDER NUMBER</div>
            <div style={{ background:`linear-gradient(135deg,${C.blue1},${C.silver})`, WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', fontSize:52, fontWeight:900, letterSpacing:8 }}>#{orderNumber}</div>
            <div className="ar-text" style={{ color:C.silver2, fontSize:12, marginTop:8 }}>{table?.name || `Table ${table?.number}`}</div>
          </div>
          <div style={{ background:`rgba(255,255,255,.03)`, borderRadius:16, padding:16 }}>
            <div style={{ color:C.silver2, fontSize:10, marginBottom:12, letterSpacing:2 }}>ORDER SUMMARY</div>
            {liveOrderItems.map(c => (
              <div key={c.id} style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:`1px solid ${C.border}`, fontSize:13 }}>
                <span style={{ color:C.white2 }}>{c.name}{c.size_name ? ` (${c.size_name})` : ''} <span style={{ color:C.silver2 }}>×{c.quantity}</span></span>
                <span style={{ color:C.blue2, fontWeight:700 }}>MYR {(c.unit_price * c.quantity).toFixed(2)}</span>
              </div>
            ))}
          </div>
          <p style={{ color:C.silver2, fontSize:12, marginTop:20 }}>A team member will serve you shortly 🙏</p>
        </div>

        {/* ✅ New: clear button to go back to the menu and order more - needed since we keep the order visible when the page is reopened */}
        <button onClick={async () => { await checkAndFollowRedirect(); setPhase('menu') }}
          style={{ width:'100%', marginTop:16, background:`linear-gradient(135deg,${C.blue1},${C.blue2})`, border:'none', borderRadius:16, padding:'14px', color:C.white, fontWeight:800, fontSize:14, cursor:'pointer', boxShadow:`0 6px 20px ${C.glow2}` }}>
          ➕ Order More Items
        </button>

        {/* ── 🎲 Who's Paying the Bill? Roulette Game ── */}
        <div style={{ marginTop:24, background:`linear-gradient(135deg, ${C.bg2}, ${C.bg3})`, border:`1px solid ${C.border2}`, borderRadius:28, padding:'24px 20px', boxShadow:`0 0 40px ${C.glow}` }}>
          {!showPayGame ? (
            <>
              <div style={{ fontSize:32, marginBottom:8 }}>🎲</div>
              <div style={{ fontSize:16, fontWeight:900, color:C.white, marginBottom:6 }}>While you wait... Who's Paying the Bill?</div>
              <div style={{ fontSize:12, color:C.silver2, marginBottom:14 }}>Spin the wheel and let fate decide! 🎉</div>
              <button onClick={() => setShowPayGame(true)}
                style={{ background:`linear-gradient(135deg,${C.blue1},${C.blue2})`, border:'none', borderRadius:14, padding:'12px 24px', color:C.white, fontWeight:800, fontSize:14, cursor:'pointer', boxShadow:`0 6px 20px ${C.glow2}` }}>
                🎮 Play the Game
              </button>
            </>
          ) : (
            <div>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
                <span style={{ fontSize:15, fontWeight:900, color:C.white }}>🎲 Who's Paying?</span>
                <button onClick={() => { setShowPayGame(false); resetPayGame() }} style={{ background:'transparent', border:'none', color:C.silver2, fontSize:20, cursor:'pointer' }}>✕</button>
              </div>

              {gameWinner ? (
                <div>
                  <div style={{ position:'relative', width:220, height:220, margin:'0 auto 18px' }}>
                    <img src="/logo.png" alt="Orchid House" style={{ width:80, height:80, borderRadius:'50%', position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)', border:`3px solid ${C.blue1}`, boxShadow:`0 0 30px ${C.glow2}`, zIndex:2, objectFit:'cover' }} />
                    <div style={{ fontSize:90, textAlign:'center', animation:'chefBounce 1.4s ease-in-out infinite' }}>🎉</div>
                  </div>
                  <div style={{ fontSize:13, color:C.silver2, marginBottom:6 }}>And the bill goes to...</div>
                  <div style={{ fontSize:26, fontWeight:900, color:C.blue2, marginBottom:20 }}>{gameWinner}! 💸</div>

                  {/* Share the result */}
                  <div style={{ fontSize:11, color:C.silver2, marginBottom:10 }}>📤 Share the result</div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:10 }}>
                    <button onClick={shareToWhatsApp} style={{ padding:'10px', borderRadius:12, border:'1px solid rgba(37,211,102,.4)', background:'rgba(37,211,102,.12)', color:'#25D366', fontWeight:700, fontSize:12, cursor:'pointer' }}>💬 WhatsApp</button>
                    <button onClick={shareToFacebook} style={{ padding:'10px', borderRadius:12, border:'1px solid rgba(24,119,242,.4)', background:'rgba(24,119,242,.12)', color:'#1877F2', fontWeight:700, fontSize:12, cursor:'pointer' }}>📘 Facebook</button>
                    <button onClick={shareToTwitter} style={{ padding:'10px', borderRadius:12, border:`1px solid ${C.border2}`, background:C.bg, color:C.white, fontWeight:700, fontSize:12, cursor:'pointer' }}>✖️ X / Twitter</button>
                    <button onClick={shareGameResult} style={{ padding:'10px', borderRadius:12, border:`1px solid ${C.blue1}`, background:`linear-gradient(135deg,${C.blue1},${C.blue2})`, color:C.white, fontWeight:700, fontSize:12, cursor:'pointer' }}>📸 More / Image</button>
                  </div>

                  <button onClick={resetPayGame}
                    style={{ width:'100%', background:'transparent', border:`1px solid ${C.border2}`, borderRadius:12, padding:'10px 20px', color:C.silver2, fontWeight:700, fontSize:13, cursor:'pointer' }}>
                    🔄 Play Again
                  </button>
                </div>
              ) : (
                <>
                  {gameNames.filter(n => n.trim()).length >= 2 && (
                    /* ── Spinning wheel ── */
                    <div style={{ position:'relative', width:240, height:240, margin:'0 auto 20px' }}>
                      {/* Fixed pointer on top */}
                      <div style={{ position:'absolute', top:-6, left:'50%', transform:'translateX(-50%)', width:0, height:0, borderLeft:'12px solid transparent', borderRight:'12px solid transparent', borderTop:`22px solid ${C.blue1}`, zIndex:10, filter:`drop-shadow(0 2px 6px ${C.glow2})` }} />
                      {/* The wheel itself */}
                      <div style={{
                        width:'100%', height:'100%', borderRadius:'50%',
                        border:`4px solid ${C.blue1}`,
                        boxShadow:`0 0 30px ${C.glow2}, inset 0 0 20px rgba(0,0,0,.3)`,
                        position:'relative', overflow:'hidden',
                        transform:`rotate(${wheelRotation}deg)`,
                        transition: gameSpinning ? 'transform 4.2s cubic-bezier(0.17,0.67,0.12,0.99)' : 'none',
                        background: (() => {
                          const names = gameNames.map(n => n.trim()).filter(Boolean)
                          const n = names.length
                          const palette = [C.blue1, C.blue3, C.blue2, C.silver2]
                          const stops = names.map((_, i) => `${palette[i % palette.length]} ${(i / n) * 100}% ${((i + 1) / n) * 100}%`)
                          return `conic-gradient(${stops.join(',')})`
                        })(),
                      }}>
                        {gameNames.map(n => n.trim()).filter(Boolean).map((name, i, arr) => {
                          const segAngle = 360 / arr.length
                          const centerAngle = i * segAngle + segAngle / 2
                          return (
                            <div key={i} style={{ position:'absolute', inset:0, transform:`rotate(${centerAngle}deg)` }}>
                              <div style={{ position:'absolute', top:'10%', left:'50%', transform:'translateX(-50%)', fontSize:10, fontWeight:900, color:'#fff', textShadow:'0 1px 3px rgba(0,0,0,.6)', maxWidth:56, textAlign:'center', lineHeight:1.15, wordBreak:'break-word' }}>
                                {name}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                      {/* Wheel center */}
                      <div style={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)', width:36, height:36, borderRadius:'50%', background:C.bg2, border:`3px solid ${C.blue1}`, zIndex:5 }} />
                    </div>
                  )}

                  <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:10, marginBottom:14 }}>
                    <span style={{ fontSize:12, color:C.silver2 }}>Number of People</span>
                    <button onClick={() => updateGamePeopleCount(gameNames.length - 1)} disabled={gameNames.length <= 2 || gameSpinning}
                      style={{ width:28, height:28, borderRadius:8, border:`1px solid ${C.border2}`, background:'transparent', color:C.white, cursor:gameNames.length <= 2 ? 'not-allowed':'pointer', fontSize:15, opacity:gameNames.length <= 2 ? 0.4:1 }}>−</button>
                    <span style={{ fontSize:14, fontWeight:800, color:C.blue2, minWidth:18, textAlign:'center' }}>{gameNames.length}</span>
                    <button onClick={() => updateGamePeopleCount(gameNames.length + 1)} disabled={gameSpinning}
                      style={{ width:28, height:28, borderRadius:8, border:`1px solid ${C.border2}`, background:'transparent', color:C.white, cursor:'pointer', fontSize:15 }}>+</button>
                  </div>

                  <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:12 }}>
                    {gameNames.map((name, i) => (
                      <div key={i}
                        style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 12px', borderRadius:12, border:`1px solid ${C.border}` }}>
                        <span style={{ fontSize:12, color:C.silver2, minWidth:16 }}>{i + 1}.</span>
                        <input
                          value={name}
                          disabled={gameSpinning}
                          onChange={e => setGameNames(prev => prev.map((n, ni) => ni === i ? e.target.value : n))}
                          placeholder={`Person ${i + 1} name`}
                          style={{ flex:1, background:'transparent', border:'none', outline:'none', color:C.white, fontSize:13, fontFamily:'inherit' }}
                        />
                      </div>
                    ))}
                  </div>

                  <input
                    value={gamePhone}
                    disabled={gameSpinning}
                    onChange={e => setGamePhone(e.target.value)}
                    placeholder="📱 Mobile number (required) *"
                    style={{ width:'100%', boxSizing:'border-box', padding:'10px 12px', borderRadius:12, border:`1px solid ${gamePhone.trim() ? C.border : 'rgba(239,68,68,.4)'}`, background:C.bg, color:C.white, fontSize:13, marginBottom:14, direction:'ltr', textAlign:'left' }}
                  />

                  <button
                    onClick={playPayGame}
                    disabled={gameSpinning || gameNames.map(n => n.trim()).filter(Boolean).length < 2 || !gamePhone.trim()}
                    style={{
                      width:'100%', padding:'13px', borderRadius:14, border:'none',
                      background: (gameSpinning || !gamePhone.trim()) ? C.border : `linear-gradient(135deg,${C.blue1},${C.blue2})`,
                      color:C.white, fontWeight:900, fontSize:14,
                      cursor: gameSpinning ? 'default' : 'pointer', opacity: gameSpinning ? 0.7 : 1,
                    }}>
                    {gameSpinning ? '🎰 Spinning...' : '🎰 Spin the Wheel!'}
                  </button>
                  <div style={{ fontSize:10, color:C.silver2, marginTop:10 }}>🎉 Just for fun — not a real payment decision!</div>
                </>
              )}
            </div>
          )}
        </div>

        {/* ── 📱 Follow Us — Social Links ── */}
        <div style={{ marginTop:24, background:`linear-gradient(135deg, ${C.bg2}, ${C.bg3})`, border:`1px solid ${C.border2}`, borderRadius:28, padding:'24px 20px', boxShadow:`0 0 40px ${C.glow}`, textAlign:'center' }}>
          <div style={{ fontSize:15, fontWeight:900, color:C.white, marginBottom:4 }}>Did we make your evening special? 🌸</div>
          <div style={{ fontSize:12, color:C.silver2, marginBottom:18 }}>Follow us & share your experience</div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12 }}>
            {[
              { name:'Google', action:'Rate us', href:'https://www.google.com/maps/search/Orchid+House+Restaurant+Kuala+Lumpur', color:'#4285F4', type:'google' },
              { name:'Instagram', action:'Follow', href:'https://www.instagram.com/orchidofficial.my/', color:'#E1306C', type:'instagram' },
              { name:'Facebook', action:'Like', href:'https://www.facebook.com/OrchidOfficial.my', color:'#1877F2', type:'facebook' },
              { name:'TripAdvisor', action:'Review', href:'https://www.tripadvisor.com.eg/Restaurant_Review-g298570-d33055605-Reviews-Orchid_House_Restaurant-Kuala_Lumpur_Wilayah_Persekutuan.html', color:'#00AF87', type:'tripadvisor' },
              { name:'TikTok', action:'Follow', href:'https://www.tiktok.com/@orchidofficial.my', color:'#ffffff', type:'tiktok' },
              { name:'Website', action:'Visit', href:'https://restaurantorchid.com/', color:C.blue1, type:'website' },
            ].map(link => (
              <a key={link.name} href={link.href} target="_blank" rel="noopener noreferrer"
                style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:6, padding:'14px 6px', borderRadius:16, background:'rgba(255,255,255,.03)', border:`1px solid ${link.color}40`, textDecoration:'none' }}>
                <svg viewBox="0 0 24 24" fill="none" width="22" height="22">
                  {link.type === 'google' && (<>
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </>)}
                  {link.type === 'instagram' && (<>
                    <rect x="2" y="2" width="20" height="20" rx="5" stroke={link.color} strokeWidth="1.8"/>
                    <circle cx="12" cy="12" r="4.5" stroke={link.color} strokeWidth="1.8"/>
                    <circle cx="17.5" cy="6.5" r="1.2" fill={link.color}/>
                  </>)}
                  {link.type === 'facebook' && (
                    <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" stroke={link.color} strokeWidth="1.8" strokeLinejoin="round"/>
                  )}
                  {link.type === 'tripadvisor' && (<>
                    <circle cx="7" cy="14" r="4" stroke={link.color} strokeWidth="1.8"/>
                    <circle cx="17" cy="14" r="4" stroke={link.color} strokeWidth="1.8"/>
                    <circle cx="12" cy="5" r="3" stroke={link.color} strokeWidth="1.8"/>
                  </>)}
                  {link.type === 'tiktok' && (
                    <path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5" stroke={link.color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  )}
                  {link.type === 'website' && (<>
                    <circle cx="12" cy="12" r="10" stroke={link.color} strokeWidth="1.8"/>
                    <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" stroke={link.color} strokeWidth="1.8"/>
                  </>)}
                </svg>
                <span style={{ fontSize:10, color:C.white, fontWeight:700 }}>{link.name}</span>
                <span style={{ fontSize:9, color:C.silver2 }}>{link.action}</span>
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  )

  // ══ Item Bottom Sheet ══
  const ItemSheet = selectedItem && (
    <div style={{ position:'fixed', inset:0, zIndex:200 }} onClick={() => setSelectedItem(null)}>
      <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,.75)' }} />
      <div style={{ position:'absolute', bottom:0, left:0, right:0, background:C.bg2, borderRadius:'28px 28px 0 0', maxWidth:520, margin:'0 auto', overflow:'hidden', border:`1px solid ${C.border2}`, borderBottom:'none', animation:'slideUp .3s cubic-bezier(.34,1.56,.64,1)', maxHeight:'88dvh', display:'flex', flexDirection:'column' }}
        onClick={e => e.stopPropagation()}>
        <div style={{ overflowY:'auto' }}>
        {selectedItem.image_url && (
          <div style={{ width:'100%', height:260, overflow:'hidden', position:'relative' }}>
            <img src={selectedItem.image_url} alt={selectedItem.name_en} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
            <div style={{ position:'absolute', inset:0, background:`linear-gradient(to top,${C.bg2},transparent)` }} />
          </div>
        )}
        <div style={{ padding:'24px 24px 40px' }}>
          <div className="ar-text" style={{ fontSize:22, fontWeight:900, color:C.white, marginBottom:4 }}>{selectedItem.name_en || selectedItem.name}</div>
          <div className="ar-text" style={{ fontSize:13, color:C.blue2, marginBottom:6, fontWeight:600 }}>{selectedItem.name}</div>

          {/* ✅ New: average item rating above the sheet */}
          {(() => {
            const { avg, count } = getItemRating(selectedItem.id)
            return count > 0 ? (
              <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:14 }}>
                <span style={{ fontSize:14, color:'#B8860B', fontWeight:800 }}>{'⭐'.repeat(Math.round(avg))}{'☆'.repeat(5 - Math.round(avg))}</span>
                <span style={{ fontSize:12, color:C.silver2, fontWeight:700 }}>{avg.toFixed(1)} · {count} ratings</span>
              </div>
            ) : (
              <div style={{ fontSize:12, color:C.silver2, marginBottom:14 }}>🆕 No ratings yet — be the first to rate this dish</div>
            )
          })()}

          {(selectedItem.description_en || selectedItem.description) && (
            <div style={{ fontSize:14, color:C.silver2, lineHeight:1.7, marginBottom:20 }}>{selectedItem.description_en || selectedItem.description}</div>
          )}
          {/* Sizes */}
          {selectedItem.sizes && selectedItem.sizes.filter((s: any) => s.is_active).length > 0 && (
            <div style={{ marginBottom:16 }}>
              <div style={{ fontSize:12, color:C.silver2, marginBottom:8, fontWeight:600 }}>Select size:</div>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                {selectedItem.sizes.filter((s: any) => s.is_active).map((size: any) => (
                  <button key={size.id} onClick={() => setSelectedSize(selectedSize?.id === size.id ? null : size)}
                    style={{ padding:'8px 14px', borderRadius:20, border:`2px solid ${selectedSize?.id === size.id ? C.blue1 : C.border2}`, background: selectedSize?.id === size.id ? 'rgba(0,200,200,0.15)' : 'transparent', color: selectedSize?.id === size.id ? C.blue1 : C.silver2, cursor:'pointer', fontSize:13, fontWeight:700, fontFamily:'inherit' }}>
                    {size.name_en || size.name} — MYR {size.price.toFixed(2)}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:28 }}>
            <div>
              <div style={{ fontSize:26, fontWeight:900, color:C.blue2 }}>
                MYR {selectedSize ? selectedSize.price.toFixed(2) : selectedItem.price.toFixed(2)}
              </div>
              {selectedSize && <div style={{ fontSize:11, color:C.silver2, marginTop:2 }}>{selectedSize.name_en || selectedSize.name}</div>}
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:14 }}>
              {getQty(selectedItem.id, selectedSize?.id) > 0 && (
                <>
                  <button onClick={() => removeFromCart(selectedItem.id, selectedSize?.id || null)} style={{ width:44, height:44, borderRadius:'50%', border:'none', background:'rgba(239,68,68,.15)', color:'#ef4444', fontSize:24, fontWeight:700, cursor:'pointer' }}>−</button>
                  <span style={{ color:C.white, fontWeight:900, fontSize:20, minWidth:24, textAlign:'center' }}>{getQty(selectedItem.id, selectedSize?.id)}</span>
                </>
              )}
              <button onClick={e => {
                const activeSizes = selectedItem.sizes?.filter((s: any) => s.is_active) || []
                if (activeSizes.length > 0 && !selectedSize) { alert('Please select a size first'); return }
                addToCart(selectedItem, selectedSize)
                triggerFlyPlusOne(e)
                bumpPulse(`sheet_${selectedItem.id}`)
              }} style={{ width:44, height:44, borderRadius:'50%', border:'none', background:`linear-gradient(135deg,${C.blue1},${C.blue2})`, color:C.white, fontSize:24, fontWeight:700, cursor:'pointer', boxShadow:`0 4px 16px ${C.glow2}`, animation: pulseKey === `sheet_${selectedItem.id}` ? 'addBounce .4s ease' : undefined }}>+</button>
            </div>
          </div>

          {/* ✅ New: ratings section — star rating with written comment */}
          <div style={{ borderTop:`1px solid ${C.border}`, paddingTop:20 }}>
            <div style={{ fontSize:15, fontWeight:900, color:C.white, marginBottom:14 }}>⭐ Ratings</div>

            {/* New rating submission form */}
            <div style={{ background:'#FAFEFE', border:`1px dashed ${C.border2}`, borderRadius:16, padding:'16px 14px', marginBottom:18 }}>
              <div style={{ fontSize:12, color:C.silver2, marginBottom:8, fontWeight:600 }}>Rate this dish:</div>
              <div style={{ display:'flex', gap:6, marginBottom:12 }}>
                {[1,2,3,4,5].map(n => (
                  <button key={n} onClick={() => setNewReviewStars(n)}
                    style={{ background:'none', border:'none', cursor:'pointer', fontSize:26, padding:0, lineHeight:1, filter: n <= newReviewStars ? 'none' : 'grayscale(1) opacity(.4)' }}>
                    ⭐
                  </button>
                ))}
              </div>
              <textarea value={newReviewText} onChange={e => setNewReviewText(e.target.value)}
                placeholder="Share your thoughts on this dish (optional)..."
                rows={2}
                style={{ width:'100%', boxSizing:'border-box', background:'#fff', border:`1px solid ${C.border}`, borderRadius:12, padding:'10px 12px', fontSize:13, color:C.white, outline:'none', resize:'none', fontFamily:'inherit', marginBottom:8 }} />
              <input value={reviewerName} onChange={e => setReviewerName(e.target.value)}
                placeholder="Your name (optional)"
                style={{ width:'100%', boxSizing:'border-box', background:'#fff', border:`1px solid ${C.border}`, borderRadius:12, padding:'9px 12px', fontSize:13, color:C.white, outline:'none', marginBottom:10 }} />
              {reviewError && <div style={{ color:'#EF4444', fontSize:11.5, marginBottom:8 }}>{reviewError}</div>}
              {reviewSubmitted && <div style={{ color:'#16A34A', fontSize:11.5, marginBottom:8, fontWeight:700 }}>✅ Thank you, your review was submitted successfully</div>}
              <button onClick={submitReview} disabled={reviewSubmitting}
                style={{ width:'100%', background: reviewSubmitting ? C.border2 : `linear-gradient(135deg,${C.blue1},${C.blue2})`, border:'none', borderRadius:12, padding:'11px', color:C.white, fontWeight:800, fontSize:13, cursor: reviewSubmitting ? 'not-allowed' : 'pointer' }}>
                {reviewSubmitting ? 'Submitting...' : 'Submit Review'}
              </button>
            </div>

            {/* List of written reviews */}
            {reviews.filter(r => r.menu_item_id === selectedItem.id).length === 0 ? (
              <div style={{ fontSize:12.5, color:C.silver2, textAlign:'center', padding:'10px 0' }}>No comments yet</div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {reviews.filter(r => r.menu_item_id === selectedItem.id).map(r => (
                  <div key={r.id} style={{ border:`1px solid ${C.border}`, borderRadius:14, padding:'12px 14px' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
                      <span style={{ fontSize:12.5, fontWeight:800, color:C.white }}>{r.reviewer_name || 'Guest'}</span>
                      <span style={{ fontSize:12, color:'#B8860B' }}>{'⭐'.repeat(r.stars)}</span>
                    </div>
                    {r.review_text && <div style={{ fontSize:12.5, color:C.silver2, lineHeight:1.6 }}>{r.review_text}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        </div>
      </div>
    </div>
  )

  // ══ Welcome ══
  if (phase === 'welcome') return (
    <div style={{ minHeight:'100dvh', background:`radial-gradient(ellipse at top, ${C.bg3}, ${C.bg} 60%)`, color:C.white, display:'flex', flexDirection:'column', alignItems:'center', padding:'40px 20px', position:'relative', overflow:'hidden' }}>
      <style>{globalStyles}</style>
      <div style={{ maxWidth:420, width:'100%', textAlign:'center', animation:'fadeUp .6s ease', position:'relative', zIndex:1 }}>
        {/* Logo */}
        <div style={{ width:90, height:90, borderRadius:'50%', overflow:'hidden', background:C.bg3, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px', boxShadow:`0 0 40px ${C.glow2}`, border:`1px solid ${C.border2}` }}>
          <img src="/logo.png" alt="Orchid House" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
        </div>
        <div style={{ color:C.blue2, fontSize:12, fontWeight:800, letterSpacing:4, marginBottom:4 }}>ORCHID RESTAURANT</div>

        <h1 style={{ fontSize:32, fontWeight:900, margin:'18px 0 6px', color:C.white }}>Welcome to Orchid</h1>
        <div style={{ width:60, height:1, background:C.border2, margin:'0 auto 10px' }} />
        <p style={{ color:C.silver2, fontSize:14, marginBottom:26 }}>Great food. Unforgettable moments.</p>

        {/* Membership perks */}
        <div style={{ background:C.bg2, border:`1px solid ${C.border}`, borderRadius:20, padding:'20px 16px', marginBottom:22 }}>
          <div style={{ display:'flex', justifyContent:'space-around', marginBottom:16 }}>
            {[['⭐','Earn Points','with every visit'],['🎁','Exclusive Offers','just for members'],['🏷️','Birthday Rewards','and more surprises']].map(([icon,title,sub]) => (
              <div key={title} style={{ flex:1, padding:'0 4px' }}>
                <div style={{ width:44, height:44, borderRadius:'50%', border:`1px solid ${C.border2}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, margin:'0 auto 8px' }}>{icon}</div>
                <div style={{ fontSize:11.5, fontWeight:700, color:C.white2 }}>{title}</div>
                <div style={{ fontSize:10, color:C.silver2 }}>{sub}</div>
              </div>
            ))}
          </div>
          <div style={{ borderTop:`1px solid ${C.border}`, paddingTop:14, display:'flex', alignItems:'center', gap:10, textAlign:'left' }}>
            <div style={{ width:34, height:34, borderRadius:'50%', border:`1px solid ${C.border2}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:15, flexShrink:0 }}>🎁</div>
            <div style={{ fontSize:12, color:C.silver }}>
              Join Orchid Rewards and enjoy exclusive benefits.<br />
              <span style={{ color:C.blue2, fontWeight:800 }}>Register today and get 50 welcome points!</span>
            </div>
          </div>
        </div>

        <div style={{ display:'flex', alignItems:'center', gap:10, margin:'0 0 16px' }}>
          <div style={{ flex:1, height:1, background:C.border }} />
          <span style={{ fontSize:12, color:C.silver2 }}>How would you like to continue?</span>
          <div style={{ flex:1, height:1, background:C.border }} />
        </div>

        {/* Join Rewards button */}
        <button onClick={() => { setPhase('rewards'); setRewardsIntent('join'); setRewardsResult(null); setRewardsError('') }}
          style={{ width:'100%', background:`linear-gradient(135deg, ${C.blue1}, ${C.blue2})`, border:'none', borderRadius:16, padding:'16px 18px', display:'flex', alignItems:'center', justifyContent:'space-between', cursor:'pointer', marginBottom:10, boxShadow:`0 6px 20px ${C.glow2}` }}>
          <div style={{ display:'flex', alignItems:'center', gap:12, textAlign:'left' }}>
            <div style={{ width:38, height:38, borderRadius:'50%', background:'rgba(0,0,0,.2)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:17 }}>👤</div>
            <div>
              <div style={{ fontSize:14, fontWeight:900, color:C.white }}>JOIN ORCHID REWARDS</div>
              <div style={{ fontSize:11, color:'rgba(255,255,255,.85)' }}>Sign in or create an account</div>
            </div>
          </div>
          <span style={{ fontSize:20, color:C.white }}>›</span>
        </button>

        {/* ✅ New: check-points-only button - between the join button and the continue-as-guest button */}
        <button onClick={() => { setPhase('rewards'); setRewardsIntent('check'); setRewardsResult(null); setRewardsError('') }}
          style={{ width:'100%', background:C.bg2, border:`1px solid ${C.border2}`, borderRadius:16, padding:'16px 18px', display:'flex', alignItems:'center', justifyContent:'space-between', cursor:'pointer', marginBottom:10 }}>
          <div style={{ display:'flex', alignItems:'center', gap:12, textAlign:'left' }}>
            <div style={{ width:38, height:38, borderRadius:'50%', border:`1px solid ${C.border2}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:17 }}>🔍</div>
            <div>
              <div style={{ fontSize:14, fontWeight:900, color:C.white }}>CHECK MY POINTS</div>
              <div style={{ fontSize:11, color:C.silver2 }}>See your balance & discount progress</div>
            </div>
          </div>
          <span style={{ fontSize:20, color:C.silver2 }}>›</span>
        </button>

        {/* Continue as guest button */}
        <button onClick={() => setPhase('menu')}
          style={{ width:'100%', background:C.bg2, border:`1px solid ${C.border2}`, borderRadius:16, padding:'16px 18px', display:'flex', alignItems:'center', justifyContent:'space-between', cursor:'pointer', marginBottom:14 }}>
          <div style={{ display:'flex', alignItems:'center', gap:12, textAlign:'left' }}>
            <div style={{ width:38, height:38, borderRadius:'50%', border:`1px solid ${C.border2}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:17 }}>👤</div>
            <div>
              <div style={{ fontSize:14, fontWeight:900, color:C.white }}>CONTINUE AS GUEST</div>
              <div style={{ fontSize:11, color:C.silver2 }}>Browse menu and place your order</div>
            </div>
          </div>
          <span style={{ fontSize:20, color:C.silver2 }}>›</span>
        </button>

        <div style={{ display:'flex', alignItems:'flex-start', gap:8, textAlign:'left', color:C.silver2, fontSize:11, lineHeight:1.5 }}>
          <span>ⓘ</span>
          <span>You can browse the menu and place an order as a guest, but you won't earn points or enjoy member benefits.</span>
        </div>
      </div>
    </div>
  )

  // ══ Rewards - enter mobile number ══
  if (phase === 'rewards') return (
    <div style={{ minHeight:'100dvh', background:`radial-gradient(ellipse at top, ${C.bg3}, ${C.bg} 60%)`, color:C.white, display:'flex', flexDirection:'column', alignItems:'center', padding:'40px 20px' }}>
      <style>{globalStyles}</style>
      <div style={{ maxWidth:380, width:'100%', animation:'fadeUp .5s ease' }}>
        <button onClick={() => setPhase('welcome')} style={{ background:'none', border:'none', color:C.silver2, fontSize:13, cursor:'pointer', marginBottom:20, padding:0 }}>‹ Back</button>

        {!rewardsResult ? (
          <div style={{ textAlign:'center' }}>
            <div style={{ fontSize:40, marginBottom:12 }}>{rewardsIntent === 'check' ? '🔍' : '🌸'}</div>
            <h2 style={{ fontSize:22, fontWeight:900, marginBottom:6 }}>{rewardsIntent === 'check' ? 'Check My Points' : 'Orchid Rewards'}</h2>
            <p style={{ color:C.silver2, fontSize:13, marginBottom:26 }}>
              {rewardsIntent === 'check' ? 'Enter your mobile number to see your points balance.' : "Enter your mobile number — new or returning, we've got you covered."}
            </p>

            <input type="tel" inputMode="tel" placeholder="Mobile number" value={rewardsPhone}
              onChange={e => setRewardsPhone(e.target.value.replace(/[^\d+]/g, ''))}
              style={{ width:'100%', boxSizing:'border-box', background:C.bg2, border:`1px solid ${C.border2}`, borderRadius:14, padding:'14px 16px', color:C.white, fontSize:15, outline:'none', marginBottom:12, textAlign:'center' }} />

            {/* ✅ Optional name - only used if the customer is actually new (ignored if they already exist) */}
            <input type="text" placeholder="Your name (for new members)" value={rewardsName}
              onChange={e => setRewardsName(e.target.value)}
              style={{ width:'100%', boxSizing:'border-box', background:C.bg2, border:`1px solid ${C.border}`, borderRadius:14, padding:'14px 16px', color:C.white, fontSize:14, outline:'none', marginBottom:16, textAlign:'center' }} />

            {rewardsError && <div style={{ color:'#EF4444', fontSize:12, marginBottom:12 }}>{rewardsError}</div>}

            <button onClick={handleRewardsSubmit} disabled={rewardsSubmitting}
              style={{ width:'100%', background:`linear-gradient(135deg, ${C.blue1}, ${C.blue2})`, border:'none', borderRadius:14, padding:'15px', color:C.white, fontSize:14, fontWeight:900, cursor:rewardsSubmitting?'not-allowed':'pointer', opacity:rewardsSubmitting?0.7:1 }}>
              {rewardsSubmitting ? 'Checking...' : 'Continue'}
            </button>
          </div>
        ) : (
          <div style={{ textAlign:'center', animation:'fadeUp .4s ease' }}>
            <div style={{ fontSize:52, marginBottom:14 }}>{rewardsResult.isNew ? '🎉' : '🌸'}</div>
            <h2 style={{ fontSize:20, fontWeight:900, marginBottom:6 }}>
              {rewardsResult.isNew ? `Welcome, ${rewardsResult.name}!` : `Welcome back, ${rewardsResult.name}!`}
            </h2>
            <p style={{ color:C.silver2, fontSize:13, marginBottom:20 }}>
              {rewardsResult.isNew ? "You've just joined Orchid Rewards" : "Great to see you again"}
            </p>
            <div style={{ background:C.bg2, border:`1px solid ${C.border2}`, borderRadius:18, padding:'22px', marginBottom:24 }}>
              <div style={{ fontSize:11, color:C.silver2, letterSpacing:2, marginBottom:6 }}>YOUR POINTS BALANCE</div>
              <div style={{ fontSize:40, fontWeight:900, color:C.blue2 }}>{rewardsResult.points}</div>
              {rewardsResult.isNew && <div style={{ fontSize:12, color:C.blue2, marginTop:6, fontWeight:700 }}>🎁 +50 welcome points added!</div>}

              {/* ✅ New: clear progress bar toward 1000 points to unlock a discount */}
              <div style={{ marginTop:20, textAlign:'left' }}>
                {rewardsResult.points >= DISCOUNT_POINTS_TARGET ? (
                  <div style={{ background:'rgba(34,197,94,.12)', border:'1px solid rgba(34,197,94,.4)', borderRadius:12, padding:'10px 14px', fontSize:12.5, color:'#4ADE80', fontWeight:700, textAlign:'center' }}>
                    🎉 You've unlocked your discount! Show this to your waiter.
                  </div>
                ) : (
                  <>
                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:11.5, color:C.silver2, marginBottom:6 }}>
                      <span>Progress to discount</span>
                      <span style={{ color:C.blue2, fontWeight:800 }}>{rewardsResult.points} / {DISCOUNT_POINTS_TARGET}</span>
                    </div>
                    <div style={{ width:'100%', height:8, background:'rgba(255,255,255,.08)', borderRadius:20, overflow:'hidden' }}>
                      <div style={{ width:`${Math.min(100, (rewardsResult.points / DISCOUNT_POINTS_TARGET) * 100)}%`, height:'100%', background:`linear-gradient(90deg, ${C.blue2}, ${C.blue1})`, borderRadius:20, transition:'width .6s ease' }} />
                    </div>
                    <div style={{ fontSize:11.5, color:C.silver2, marginTop:8, textAlign:'center' }}>
                      Earn <span style={{ color:C.blue2, fontWeight:800 }}>{DISCOUNT_POINTS_TARGET - rewardsResult.points}</span> more points to unlock a special discount! 🎁
                    </div>
                  </>
                )}
              </div>
            </div>
            <button onClick={() => setPhase('menu')}
              style={{ width:'100%', background:`linear-gradient(135deg, ${C.blue1}, ${C.blue2})`, border:'none', borderRadius:14, padding:'15px', color:C.white, fontSize:14, fontWeight:900, cursor:'pointer' }}>
              Browse Menu →
            </button>
          </div>
        )}
      </div>
    </div>
  )

  // ══ Cart ══
  if (phase === 'cart') return (
    <div style={{ minHeight:'100dvh', background:C.bg, color:C.white }}>
      <style>{globalStyles}</style>
      <div style={{ background:C.bg3, padding:'16px 20px', display:'flex', alignItems:'center', gap:12, borderBottom:`1px solid ${C.border}`, position:'sticky', top:0, zIndex:50 }}>
        <button onClick={() => setPhase('menu')} style={{ background:`rgba(0,200,200,.1)`, border:`1px solid ${C.border}`, color:C.blue2, width:38, height:38, borderRadius:'50%', cursor:'pointer', fontSize:18 }}>←</button>
        <h1 style={{ color:C.white, fontSize:17, fontWeight:900, margin:0 }}>🛒 Your Order</h1>
        <div className="ar-text" style={{ marginLeft:'auto', color:C.blue2, fontWeight:600, fontSize:13 }}>{table?.name || `Table ${table?.number}`}</div>
      </div>
      <div style={{ padding:20, maxWidth:520, margin:'0 auto' }}>
        {cart.map((c, idx) => {
          const unitPrice = c.selectedSize ? c.selectedSize.price : c.item.price
          return (
          <div key={`${c.item.id}_${c.selectedSize?.id || 'no-size'}_${idx}`} style={{ background:C.bg2, borderRadius:20, padding:16, marginBottom:12, border:`1px solid ${C.border}`, position:'relative' }}>
            {/* Remove item button */}
            <button onClick={() => setCart(p => p.filter((_, i) => i !== idx))}
              style={{ position:'absolute', top:10, left:10, width:28, height:28, borderRadius:'50%', border:'none', background:'rgba(239,68,68,.2)', color:'#ef4444', fontSize:16, cursor:'pointer', fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center' }}>✕</button>
            <div style={{ display:'flex', gap:12, alignItems:'center' }}>
              {c.item.image_url && <img src={c.item.image_url} alt={c.item.name_en} style={{ width:60, height:60, borderRadius:14, objectFit:'cover', flexShrink:0, border:`1px solid ${C.border}` }} />}
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:800, fontSize:14, color:C.white, marginBottom:2 }}>{c.item.name_en || c.item.name}</div>
                {c.selectedSize && <div style={{ fontSize:11, color:C.blue2, marginBottom:2, fontWeight:600 }}>{c.selectedSize.name_en || c.selectedSize.name}</div>}
                <div style={{ fontSize:11, color:C.silver2, marginBottom:8 }}>MYR {unitPrice.toFixed(2)} each</div>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                    <button onClick={() => removeFromCart(c.item.id, c.selectedSize?.id || null)} style={{ width:32, height:32, borderRadius:'50%', border:'none', background:'rgba(239,68,68,.15)', color:'#ef4444', fontSize:20, cursor:'pointer', fontWeight:700 }}>−</button>
                    <span style={{ color:C.white, fontWeight:900, fontSize:16 }}>{c.quantity}</span>
                    <button onClick={() => addToCart(c.item, c.selectedSize || null)} style={{ width:32, height:32, borderRadius:'50%', border:'none', background:`linear-gradient(135deg,${C.blue1},${C.blue2})`, color:C.white, fontSize:20, cursor:'pointer', fontWeight:700 }}>+</button>
                  </div>
                  <span style={{ color:C.blue2, fontWeight:900, fontSize:16 }}>MYR {(unitPrice * c.quantity).toFixed(2)}</span>
                </div>
              </div>
            </div>
            <input style={{ width:'100%', background:'rgba(255,255,255,.04)', border:`1px solid ${C.border}`, borderRadius:12, padding:'8px 14px', fontSize:12, color:C.white, outline:'none', marginTop:12, boxSizing:'border-box' as const }}
              placeholder="Special request... e.g. no onion"
              value={c.notes} onChange={e => setCart(p => p.map((ci, i) => i === idx ? { ...ci, notes: e.target.value } : ci))} />
          </div>
          )
        })}
        <button onClick={confirmOrder} disabled={submitting}
          style={{ width:'100%', background: submitting ? '#333' : `linear-gradient(135deg,${C.blue1},${C.blue2})`, border:'none', borderRadius:18, padding:'17px', cursor: submitting ? 'not-allowed' : 'pointer', fontWeight:900, fontSize:16, color:C.white, boxShadow: submitting ? 'none' : `0 8px 32px ${C.glow2}` }}>
          {submitting ? '⏳ Placing order...' : `✅ Confirm Order — ${cartCount} items`}
        </button>
      </div>
    </div>
  )

  // ══ Menu ══
  return (
    <div style={{ minHeight:'100dvh', background:C.bg, color:C.white, paddingBottom: cartCount > 0 ? 100 : 24 }}>
      <style>{globalStyles}</style>

      {/* ── Header ── */}
      <div style={{ background:C.bg3, padding:'18px 18px 0', borderBottom:`1px solid ${C.border}`, position:'sticky', top:0, zIndex:50 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
          {/* Logo area */}
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:40, height:40, borderRadius:'50%', overflow:'hidden', background:C.bg3, display:'flex', alignItems:'center', justifyContent:'center', boxShadow:`0 4px 12px ${C.glow}`, flexShrink:0 }}>
              <img src="/logo.png" alt="Orchid House" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
            </div>
            <div>
              <div style={{ fontSize:16, fontWeight:900, color:C.white, lineHeight:1 }}>ORCHID <span style={{ color:C.blue2 }}>HOUSE</span></div>
              <div className="ar-text" style={{ display:'inline-block', marginTop:5, padding:'3px 10px', borderRadius:8, border:`1.5px solid ${C.blue1}`, background:'rgba(0,200,200,.1)', fontSize:12, fontWeight:800, color:C.blue2 }}>{table?.name || `Table ${table?.number}`}</div>
            </div>
          </div>
          <button onClick={() => { setWaiterCalled(true); setTimeout(() => setWaiterCalled(false), 5000) }}
            style={{ background: waiterCalled ? `linear-gradient(135deg,#22C55E,#16A34A)` : `rgba(0,200,200,.1)`, border: waiterCalled ? 'none' : `1px solid ${C.border}`, borderRadius:14, padding:'9px 16px', cursor:'pointer', fontSize:12, color: waiterCalled ? C.white : C.silver, fontWeight:700, transition:'all .3s' }}>
            {waiterCalled ? '✅ On the way!' : '🔔 Call Waiter'}
          </button>
        </div>

        {/* Search */}
        <div style={{ position:'relative', marginBottom:14 }}>
          <input style={{ width:'100%', background:'rgba(255,255,255,.05)', border:`1px solid ${C.border}`, borderRadius:14, padding:'11px 18px 11px 44px', fontSize:14, color:C.white, outline:'none', caretColor:C.blue1 }}
            placeholder="Search dishes..." value={search} onChange={e => setSearch(e.target.value)} />
          <span style={{ position:'absolute', left:16, top:'50%', transform:'translateY(-50%)', fontSize:16, color:C.silver2 }}>🔍</span>
        </div>

        {/* Categories */}
        <div style={{ display:'flex', gap:8, overflowX:'auto', paddingBottom:14 }}>
          {[{ id:'all', name_en:'All', name:'All' }, ...visibleCategories].map(c => {
            const timeBadge = (c as Category).time_badge_en || (c as Category).time_badge_ar
            return (
              <button key={c.id} onClick={() => setActiveCat(c.id)}
                style={{ padding:'8px 18px', borderRadius:30, border: activeCat === c.id ? 'none' : `1px solid ${C.border}`, background: activeCat === c.id ? `linear-gradient(135deg,${C.blue1},${C.blue2})` : 'rgba(255,255,255,.05)', color: activeCat === c.id ? C.white : C.silver2, cursor:'pointer', fontSize:13, fontWeight: activeCat === c.id ? 800 : 400, whiteSpace:'nowrap', boxShadow: activeCat === c.id ? `0 4px 16px ${C.glow2}` : 'none', transition:'all .2s', display:'flex', alignItems:'center', gap:6 }}>
                {c.name_en || c.name}
                {timeBadge && (
                  <span style={{ fontSize:9, background: activeCat === c.id ? 'rgba(255,255,255,.25)' : 'rgba(245,158,11,.15)', color: activeCat === c.id ? C.white : '#F59E0B', border: activeCat === c.id ? 'none' : '1px solid rgba(245,158,11,.4)', borderRadius:8, padding:'2px 6px', fontWeight:800 }}>
                    🍽️ {timeBadge}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Items Grid ── */}
      <div style={{ padding:'18px 14px 100px', display:'grid', gridTemplateColumns:'repeat(2, 1fr)', gap:16, maxWidth:560, margin:'0 auto' }}>
        {filteredItems.length === 0 ? (
          <div style={{ gridColumn:'1 / -1', textAlign:'center', padding:60, color:C.silver2 }}>
            <div style={{ fontSize:40, marginBottom:12 }}>🍽️</div>
            <div>No items found</div>
          </div>
        ) : filteredItems.map(item => {
          const qty = getQty(item.id)
          const hasDiscount = !!(item.discount_percent && item.discount_percent > 0)
          const hasSizes = !!(item.sizes && item.sizes.filter((s: any) => s.is_active).length > 0)
          return (
            <div key={item.id} className="item-card"
              style={{
                background:C.bg2, borderRadius:18, overflow:'hidden',
                border: `2px dashed ${qty > 0 ? C.blue1 : C.border2}`,
                cursor:'pointer', position:'relative', display:'flex', flexDirection:'column',
                boxShadow: qty > 0 ? `0 8px 22px ${C.glow}` : '0 3px 12px rgba(0,180,180,.07)',
                transition:'all .2s'
              }}
              onClick={() => { setSelectedItem(item); setSelectedSize(null) }}>

              {/* ── Image ── */}
              <div style={{ position:'relative', width:'100%', height:190, background:'#EAFDFD', flexShrink:0 }}>
                {item.image_url
                  ? <img src={item.image_url} alt={item.name_en} loading="lazy" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                  : <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:34 }}>🍽️</div>
                }

                {/* Discount badge */}
                {hasDiscount && (
                  <div style={{ position:'absolute', top:8, left:8, background:'linear-gradient(135deg,#ef4444,#dc2626)', color:'#fff', fontSize:9, fontWeight:900, padding:'3px 8px', borderRadius:8, boxShadow:'0 3px 8px rgba(239,68,68,.4)' }}>
                    🔥 -{item.discount_percent}%
                  </div>
                )}

                {/* Added quantity badge */}
                {qty > 0 && (
                  <div style={{ position:'absolute', bottom:8, right:8, background:`linear-gradient(135deg,${C.blue1},${C.blue2})`, color:C.white, borderRadius:'50%', width:23, height:23, display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:900, boxShadow:`0 2px 8px ${C.glow2}` }}>{qty}</div>
                )}

                {/* Name plate overlapping the bottom of the image */}
                <div style={{ position:'absolute', left:8, right:8, bottom:-12, background:`linear-gradient(135deg,${C.blue1},${C.blue2})`, borderRadius:9, padding:'6px 9px', boxShadow:`0 4px 10px ${C.glow2}` }}>
                  <div className="ar-text" style={{ fontSize:11.5, fontWeight:900, color:C.white, lineHeight:1.25, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{item.name_en || item.name}</div>
                </div>
              </div>

              {/* ── Content ── */}
              <div style={{ flex:1, padding:'18px 11px 11px', display:'flex', flexDirection:'column', gap:6 }}>
                <div className="ar-text" style={{ fontSize:10, color:C.blue2, fontWeight:600 }}>{item.name}</div>

                {/* ✅ New: average item rating badge (stars + review count) */}
                {(() => {
                  const { avg, count } = getItemRating(item.id)
                  return count > 0 ? (
                    <div style={{ display:'flex', alignItems:'center', gap:3, fontSize:10, color:'#B8860B', fontWeight:700 }}>
                      <span>⭐ {avg.toFixed(1)}</span>
                      <span style={{ color:C.silver2, fontWeight:600 }}>({count})</span>
                    </div>
                  ) : (
                    <div style={{ fontSize:9.5, color:C.silver2 }}>🆕 Be the first to rate</div>
                  )
                })()}

                {item.description_en && (
                  <div style={{ fontSize:9.5, color:C.silver2, lineHeight:1.5, display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical' as any, overflow:'hidden' }}>{item.description_en}</div>
                )}

                {hasSizes ? (
                  // ✅ Multiple sizes — each size in its own clear row
                  <div style={{ display:'flex', flexDirection:'column', gap:5, marginTop:2 }}>
                    {item.sizes!.filter((s: any) => s.is_active).map((size: any) => {
                      const sizeQty = getQty(item.id, size.id)
                      const key = `${item.id}_${size.id}`
                      return (
                        <div key={size.id}
                          onClick={e => e.stopPropagation()}
                          style={{
                            display:'flex', alignItems:'center', justifyContent:'space-between',
                            background: sizeQty > 0 ? `rgba(0,180,180,0.08)` : '#F4FDFD',
                            border: `1px solid ${sizeQty > 0 ? C.blue1 : C.border}`,
                            borderRadius:10, padding:'5px 8px', gap:6,
                          }}>
                          <span style={{ fontSize:9.5, color: sizeQty > 0 ? C.blue1 : C.silver2, fontWeight:700, flex:1, minWidth:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{size.name_en || size.name}</span>
                          <span style={{ fontSize:9.5, fontWeight:900, color:C.white, whiteSpace:'nowrap' }}>MYR {size.price.toFixed(2)}</span>
                          {sizeQty > 0 ? (
                            <div style={{ display:'flex', alignItems:'center', gap:3 }}>
                              <button onClick={() => removeFromCart(item.id, size.id)} style={{ width:19, height:19, borderRadius:'50%', border:'none', background:'rgba(239,68,68,.15)', color:'#ef4444', fontSize:12, cursor:'pointer', fontWeight:900, display:'flex', alignItems:'center', justifyContent:'center' }}>−</button>
                              <span style={{ color:C.white, fontWeight:900, fontSize:10.5, minWidth:12, textAlign:'center' }}>{sizeQty}</span>
                              <button onClick={e => { addToCart(item, size); triggerFlyPlusOne(e); bumpPulse(key) }} style={{ width:19, height:19, borderRadius:'50%', border:'none', background:`linear-gradient(135deg,${C.blue1},${C.blue2})`, color:C.white, fontSize:12, cursor:'pointer', fontWeight:900, display:'flex', alignItems:'center', justifyContent:'center', animation: pulseKey === key ? 'addBounce .4s ease' : undefined }}>+</button>
                            </div>
                          ) : (
                            <button onClick={e => { addToCart(item, size); triggerFlyPlusOne(e); bumpPulse(key) }} style={{ background:`linear-gradient(135deg,${C.blue1},${C.blue2})`, border:'none', borderRadius:8, padding:'3px 7px', cursor:'pointer', fontSize:9.5, fontWeight:800, color:C.white, whiteSpace:'nowrap', animation: pulseKey === key ? 'addBounce .4s ease' : undefined }}>+</button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  // item without sizes — price and add button at the bottom of the card
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:6, marginTop:'auto', paddingTop:6 }}>
                    {item.discount_percent && item.discount_percent > 0 ? (
                      <div style={{ display:'flex', flexDirection:'column' }}>
                        <span style={{ fontSize:12, fontWeight:900, color:'#dc2626' }}>MYR {(item.price * (1 - item.discount_percent / 100)).toFixed(2)}</span>
                        <span style={{ fontSize:9, color:C.silver2, textDecoration:'line-through' }}>MYR {item.price.toFixed(2)}</span>
                      </div>
                    ) : (
                      <span style={{ fontSize:13, fontWeight:900, color:C.blue2 }}>MYR {item.price.toFixed(2)}</span>
                    )}
                    <div onClick={e => { e.stopPropagation(); addToCart(item); triggerFlyPlusOne(e); bumpPulse(item.id) }}
                      style={{ background: qty > 0 ? `linear-gradient(135deg,${C.blue1},${C.blue2})` : '#FFFFFF', border: qty > 0 ? 'none' : `2px solid ${C.blue1}`, borderRadius:20, padding:'5px 11px', cursor:'pointer', fontSize:11, fontWeight:800, color: qty > 0 ? C.white : C.blue2, display:'flex', alignItems:'center', gap:3, boxShadow: qty > 0 ? `0 2px 8px ${C.glow}` : `0 2px 6px rgba(0,180,180,.15)`, animation: pulseKey === item.id ? 'addBounce .4s ease' : undefined }}>
                      <span style={{ fontSize:13 }}>+</span>
                      <span>{qty > 0 ? qty : 'Add'}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* ✅ New: floating "+1" animation layer when adding to cart */}
      {flyingPlusOnes.map(f => (
        <div key={f.id} style={{ position:'fixed', left:f.x, top:f.y, zIndex:300, pointerEvents:'none', fontSize:22, fontWeight:900, color:C.blue2, textShadow:'0 2px 6px rgba(0,0,0,.15)', animation:'flyPlusOne .9s ease-out forwards' }}>
          +1 ✨
        </div>
      ))}

      {/* Item Sheet */}
      {ItemSheet}

      {/* ── Cart Bar ── */}
      {cartCount > 0 && (
        <div style={{ position:'fixed', bottom:0, left:0, right:0, padding:'12px 16px 20px', background:`rgba(255,255,255,.97)`, borderTop:`1px solid ${C.border2}`, zIndex:100, backdropFilter:'blur(8px)', boxShadow:'0 -8px 24px rgba(0,180,180,0.1)' }}>
          <div style={{ maxWidth:520, margin:'0 auto' }}>
            <button onClick={() => setPhase('cart')}
              style={{ width:'100%', background:`linear-gradient(135deg,${C.blue1},${C.blue2})`, border:'none', borderRadius:18, padding:'15px 20px', cursor:'pointer', fontWeight:900, fontSize:15, color:C.white, display:'flex', justifyContent:'center', alignItems:'center', boxShadow:`0 8px 28px ${C.glow2}` }}>
              <span>🛒 View Order ({cartCount} items)</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
