'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
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
  blue: '#3B82F6', blueB: 'rgba(59,130,246,0.12)',
  amber: '#F59E0B', amberB: 'rgba(245,158,11,0.12)',
  purple: '#8B5CF6', purpleB: 'rgba(139,92,246,0.12)',
  card: 'rgba(255,255,255,0.04)', card2: 'rgba(255,255,255,0.08)',
}

const inp: React.CSSProperties = {
  width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)',
  borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#FAFAF8', outline: 'none',
  fontFamily: 'Tajawal, sans-serif', boxSizing: 'border-box', direction: 'rtl',
}

const STATUS_CFG: Record<string, { label: string; icon: string; color: string; bg: string }> = {
  pending:   { label: 'قيد الانتظار', icon: '⏳', color: S.amber, bg: S.amberB },
  purchased: { label: 'تم الشراء',    icon: '🛒', color: S.blue,  bg: S.blueB },
  delivered: { label: 'تم التسليم',   icon: '✅', color: S.green, bg: S.greenB },
  rejected:  { label: 'مرفوض',        icon: '❌', color: S.red,   bg: S.redB },
}

interface Product { id: string; name: string; name_en?: string; current_stock: number; unit_id?: string; units?: { symbol: string } }
interface RequestItem {
  id: string; product_id: string | null; item_name: string | null; requested_quantity: number; requested_unit_id: string
  purchased_quantity: number | null; purchased_unit_id: string | null; unit_price: number | null; total_price: number | null; notes: string | null
  warehouse_products?: { name: string; name_en?: string }
  req_unit?: { symbol: string }; pur_unit?: { symbol: string }
  // ✅ جديد: الكمية المتوفرة بالفعل بالمخزون (مش محتاجة شراء)، والفرع، ومين سجّلها بالاسم الكامل
  available_in_warehouse_qty?: number | null
  available_in_warehouse_branch_id?: string | null
  available_recorded_by?: string | null
  available_branch?: { name: string }
}
interface PurchaseRequest {
  id: string; branch_id: string; requested_by: string; status: string
  request_number?: string | null
  // ✅ جديد: اليوم "الفعلي" للطلب بعد تطبيق قاعدة الساعة 12 ظهرًا - مختلف عن requested_at الحقيقي أحيانًا
  effective_date?: string | null
  requested_at: string; purchased_at: string | null; purchased_by: string | null
  delivered_at: string | null; delivered_image_url: string | null
  // ✅ جديد: مصفوفة كل صور إثبات الاستلام (بدل صورة واحدة فقط)
  delivered_image_urls?: string[] | null
  received_by: string | null; received_at: string | null; total_amount: number; notes: string | null
  branches?: { name: string }
  requester?: { name: string; name_en?: string; employee_number?: string }
  // ✅ جديد: اسم مستلم الطلب (الفرع) - لعرضه في تقرير الأدمن الشامل
  receiver?: { name: string; name_en?: string }
  market_purchase_request_items?: RequestItem[]
}

// ✅ جديد: عرض التاريخ والوقت بتوقيت ماليزيا (Asia/Kuala_Lumpur) بغض النظر عن توقيت جهاز المستخدم
// ✅ جديد: تحديد "يوم ماليزيا" الصحيح لأي طابع زمني، بدل الاعتماد على تاريخ UTC أو توقيت المتصفح المحلي
function myDateKey(iso: string) {
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Kuala_Lumpur' }) // en-CA بترجع YYYY-MM-DD مباشرة
}

function fmtMYTime(iso: string) {
  return new Date(iso).toLocaleString('ar-MY', {
    timeZone: 'Asia/Kuala_Lumpur', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true,
  })
}

// ✅ جديد: تحديد "اليوم الفعلي" للطلب - لو اتقدّم بعد 12 ظهرًا بتوقيت ماليزيا، يترحّل لليوم التالي تلقائيًا
function computeEffectiveDate(): string {
  const nowInMY = new Date().toLocaleString('en-US', { timeZone: 'Asia/Kuala_Lumpur' })
  const myNow = new Date(nowInMY)
  if (myNow.getHours() >= 12) {
    myNow.setDate(myNow.getDate() + 1)
  }
  const y = myNow.getFullYear()
  const m = String(myNow.getMonth() + 1).padStart(2, '0')
  const d = String(myNow.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export default function MarketPurchasesPage() {
  const sb = createClient()
  const { employee: currentUser, permissions } = useAuth()
  const isAdmin = permissions?.all === true
  // ✅ Fix: مسؤولو المستودع (أمين المستودع/مدير المستودعات) هم من يراجعون الطلبات، مش أي حد عنده صلاحية market_purchases عامة فقط
  const isPurchaser = isAdmin || permissions?.market_purchases === true || ['warehouse_keeper', 'warehouse_manager'].includes(currentUser?.role || '')
  // ✅ Fix: المشرفون ومديرو الأقسام هم من يطلبون (مش أمين المستودع، ده بيراجع مش بيطلب)
  const SUPERVISOR_ROLES = ['kitchen_supervisor', 'hall_supervisor', 'bar_supervisor']
  const MANAGER_ROLES = ['kitchen_manager', 'hall_manager', 'bar_manager']
  // ✅ Fix: أمين المستودع ومدير المستودعات أصبحوا يقدروا يطلبوا كمان، بالإضافة لدورهم كمسؤولي شراء
  const canRequest = isAdmin || [...SUPERVISOR_ROLES, ...MANAGER_ROLES, 'warehouse_keeper', 'warehouse_manager'].includes(currentUser?.role || '')

  const [tab, setTab] = useState<'new' | 'mine' | 'purchaser' | 'calendar' | 'report' | 'admin_stats'>(canRequest ? 'new' : 'purchaser')
  const [requests, setRequests] = useState<PurchaseRequest[]>([])
  // ✅ جديد: اختيار الفرع للإدارة - يشوف الفرعين ويقدر يختار بينهم
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([])
  const [adminBranchFilter, setAdminBranchFilter] = useState('')
  const [products, setProducts] = useState<Product[]>([])
  const [units, setUnits] = useState<{ id: string; symbol: string }[]>([])
  const [loading, setLoading] = useState(true)

  // ── New request form state ──
  // ✅ Fix: السلة بقت مصفوفة أصناف نصية حرة (اسم + كمية + وحدة) بدل الاختيار من أصناف المستودع فقط،
  // لأن مشتريات السوق أصلًا أصناف غير موجودة بالمستودع
  const [cart, setCart] = useState<{ tempId: string; name: string; quantity: string; unit_id: string }[]>([])
  const [newItemName, setNewItemName] = useState('')
  // ✅ جديد: اقتراحات البحث عن الأصناف الموجودة في المستودع أثناء الكتابة
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [newItemQty, setNewItemQty] = useState('')
  const [newItemUnit, setNewItemUnit] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // ✅ جديد: دوال مساعدة لإرسال إشعارات عند أي حركة في مشتريات السوق
  async function sendNotifToEmployee(targetEmployeeId: string, title: string, body: string) {
    if (!targetEmployeeId) return
    await sb.from('notifications').insert([{
      type: 'request', title, body,
      link: '/dashboard/market-purchases',
      target_employee_id: targetEmployeeId,
      // ✅ Fix حرج: عمود target_role له قيمة افتراضية "all" في قاعدة البيانات، فلو ما حددناهوش صراحةً
      // بـ null، الإشعار الشخصي ده كان بيوصل لكل الموظفين بدل الشخص المقصود بس
      target_role: null,
    }])
  }
  async function sendNotifToRole(targetRole: string, title: string, body: string) {
    await sb.from('notifications').insert([{
      type: 'request', title, body,
      link: '/dashboard/market-purchases',
      target_role: targetRole,
    }])
  }
  // ✅ جديد: كشف الموبايل - مطلوب لتنسيق تاب الإحصائيات الشاملة
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 860)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])
  // ✅ جديد: تنبيه الترحيل لليوم التالي - يظهر في منتصف الشاشة بدل alert عادي
  const [rolloverNotice, setRolloverNotice] = useState<{ requestNumber: string; effectiveDate: string } | null>(null)

  // ── Purchaser editing state ──
  const [editingReq, setEditingReq] = useState<PurchaseRequest | null>(null)
  const [purchaseEdits, setPurchaseEdits] = useState<Record<string, { quantity: string; unit_id: string }>>({})
  // ✅ جديد: تعديل الكمية/الوحدة قبل تأكيد الاستلام في نافذة "تأكيد الاستلام + رفع صورة"
  // (حالة منفصلة عن purchaseEdits عشان متتعارضش مع نافذة تسجيل المشتريات)
  const [receiveEdits, setReceiveEdits] = useState<Record<string, { quantity: string; unit_id: string }>>({})
  // ✅ جديد: حالة مؤقتة لإدخال الكمية المتوفرة بالمخزون لكل صنف قبل الحفظ
  const [availableEdits, setAvailableEdits] = useState<Record<string, { qty: string; branchId: string }>>({})
  const [saving, setSaving] = useState(false)

  // ── Receive confirmation state ──
  const [receivingReq, setReceivingReq] = useState<PurchaseRequest | null>(null)
  // ✅ Fix: بدل صورة واحدة، دلوقتي نقدر نرفع أكتر من صورة إثبات استلام
  const [receiveImgs, setReceiveImgs] = useState<File[]>([])
  const [receiveImgPreviews, setReceiveImgPreviews] = useState<string[]>([])
  const [confirming, setConfirming] = useState(false)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const baseSelect = `*, branches(name), requester:requested_by(name, name_en, employee_number), receiver:received_by(name, name_en), market_purchase_request_items(*, warehouse_products(name, name_en), req_unit:units!market_purchase_request_items_requested_unit_id_fkey(symbol), pur_unit:units!market_purchase_request_items_purchased_unit_id_fkey(symbol), available_branch:branches!market_purchase_request_items_available_in_warehouse_branc_fkey(name))`
    let q = sb.from('market_purchase_requests').select(baseSelect).order('requested_at', { ascending: false })
    const [reqRes, unitsRes, branchesRes] = await Promise.all([
      q,
      sb.from('units').select('id, symbol').order('name'),
      sb.from('branches').select('id, name').eq('is_active', true).order('name'),
    ])
    setRequests((reqRes.data as any) || [])
    setUnits(unitsRes.data || [])
    setBranches(branchesRes.data || [])
    setLoading(false)
  }, [])

  useEffect(() => { if (currentUser?.id) fetchAll() }, [currentUser?.id, fetchAll])

  // جلب أصناف مستودع فرع الموظف الحالي بالذات (لمنع bug اختيار المستودع الخاطئ)
  useEffect(() => {
    if (!currentUser?.branch_id) return
    sb.from('warehouses').select('id').eq('branch_id', currentUser.branch_id).maybeSingle()
      .then(({ data: wh }) => {
        if (!wh?.id) return
        sb.from('warehouse_products').select('id, name, name_en, current_stock, unit_id, units(symbol)')
          .eq('warehouse_id', wh.id).eq('is_active', true).order('name')
          .then(({ data }) => setProducts((data as any) || []))
      })
  }, [currentUser?.branch_id])

  // ✅ Fix: دوال إدارة سلة الأصناف الحرة - إضافة وحذف
  function addToCart() {
    if (!newItemName.trim()) { alert('يرجى كتابة اسم الصنف'); return }
    if (!newItemQty || parseFloat(newItemQty) <= 0) { alert('يرجى إدخال كمية صحيحة'); return }
    if (!newItemUnit) { alert('يرجى اختيار الوحدة'); return }
    setCart(prev => [...prev, {
      tempId: `${Date.now()}-${Math.random()}`,
      name: newItemName.trim(), quantity: newItemQty, unit_id: newItemUnit,
    }])
    setNewItemName(''); setNewItemQty(''); setNewItemUnit('')
  }
  function removeFromCart(tempId: string) {
    setCart(prev => prev.filter(c => c.tempId !== tempId))
  }

  // ✅ جديد: حذف الطلب بالكامل - متاح للأدمن فقط، مع تأكيد صريح
  async function deleteRequest(reqId: string, reqNumber: string | null | undefined) {
    if (!confirm(`⚠️ هل أنت متأكد من حذف الطلب #${reqNumber || '—'} نهائيًا؟\n\nسيتم حذف كل أصنافه معه. هذا الإجراء لا يمكن التراجع عنه.`)) return
    // نحذف الأصناف أولاً ثم الطلب نفسه، لضمان عدم بقاء أي بيانات معلّقة
    await sb.from('market_purchase_request_items').delete().eq('request_id', reqId)
    const { error } = await sb.from('market_purchase_requests').delete().eq('id', reqId)
    if (error) { alert('حصل خطأ أثناء الحذف: ' + error.message); return }
    await fetchAll()
  }

  // ✅ جديد (إضافة فقط): إعادة طلب سابق بعد التنفيذ - تملأ سلة "طلب جديد" الموجودة بنفس الأصناف
  // (قابلة للتعديل في الكمية/الوحدة أو إضافة صنف جديد) قبل الإرسال، من غير أي تعديل على submitRequest نفسها
  function reorderRequest(req: PurchaseRequest) {
    const items = (req.market_purchase_request_items || []).map(it => ({
      tempId: `${Date.now()}-${Math.random()}`,
      name: it.item_name || it.warehouse_products?.name || '—',
      quantity: String(it.requested_quantity),
      unit_id: it.requested_unit_id,
    }))
    setCart(items)
    setTab('new')
  }

  async function submitRequest() {
    if (cart.length === 0) { alert('يرجى إضافة صنف واحد على الأقل'); return }
    setSubmitting(true)
    // ✅ جديد: توليد رقم طلب تلقائي بصيغة ORK-{رقم تسلسلي}
    const { count } = await sb.from('market_purchase_requests').select('id', { count: 'exact', head: true })
    const requestNumber = `ORK-${(count || 0) + 1}`
    // ✅ جديد: نحسب اليوم الفعلي - لو الوقت دلوقتي بعد 12 ظهرًا بتوقيت ماليزيا، يترحّل الطلب لليوم التالي تلقائيًا
    const effectiveDate = computeEffectiveDate()
    const { data: newReq, error } = await sb.from('market_purchase_requests')
      .insert([{ branch_id: currentUser?.branch_id, requested_by: currentUser?.id, status: 'pending', request_number: requestNumber, effective_date: effectiveDate }])
      .select('id').single()
    if (error || !newReq) { alert('حدث خطأ: ' + (error?.message || '')); setSubmitting(false); return }

    await sb.from('market_purchase_request_items').insert(
      cart.map(c => ({
        request_id: newReq.id, item_name: c.name,
        requested_quantity: parseFloat(c.quantity), requested_unit_id: c.unit_id,
      }))
    )
    // ✅ جديد: إشعار لفريق الشراء (أمين ومدير المستودعات) بوصول طلب جديد
    const requesterName = [currentUser?.name, currentUser?.name_en].filter(Boolean).join(' ') || 'موظف'
    await sendNotifToRole('warehouse_keeper', '🛒 طلب مشتريات سوق جديد', `${requesterName} أرسل طلب مشتريات سوق جديد (#${requestNumber}، ${cart.length} صنف)`)
    await sendNotifToRole('warehouse_manager', '🛒 طلب مشتريات سوق جديد', `${requesterName} أرسل طلب مشتريات سوق جديد (#${requestNumber}، ${cart.length} صنف)`)
    await fetchAll()
    setSubmitting(false)
    setCart([])
    // ✅ جديد: تأكيد صريح لو الطلب اترحّل لليوم التالي بسبب تجاوز موعد الـ12 ظهرًا - في منتصف الشاشة
    const todayInMY = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kuala_Lumpur' })
    if (effectiveDate !== todayInMY) {
      setRolloverNotice({ requestNumber, effectiveDate })
    }
    setTab('mine')
  }

  function startEditingPurchase(req: PurchaseRequest) {
    // ✅ Fix: أزلنا السعر - سيُدخَل لاحقًا في فاتورة مشتريات منفصلة بقسم المشتريات
    const init: Record<string, { quantity: string; unit_id: string }> = {}
    req.market_purchase_request_items?.forEach(it => {
      init[it.id] = {
        quantity: String(it.purchased_quantity ?? it.requested_quantity),
        unit_id: it.purchased_unit_id || it.requested_unit_id,
      }
    })
    setPurchaseEdits(init)
    setEditingReq(req)
  }

  // ✅ جديد: تسجيل كمية متوفرة بالفعل بالمخزون لصنف معين - يقدر أي فرد من فريق المستودع يسجّلها
  // وتقلل الكمية المطلوب شراؤها من السوق تلقائيًا
  async function saveAvailableQty(itemId: string, requestedQty: number, availableQty: number, branchId: string) {
    const fullName = [currentUser?.name, currentUser?.name_en].filter(Boolean).join(' ') || 'غير معروف'
    const { error } = await sb.from('market_purchase_request_items').update({
      available_in_warehouse_qty: availableQty,
      available_in_warehouse_branch_id: branchId || null,
      available_recorded_by: fullName,
    }).eq('id', itemId)
    if (error) { alert('حصل خطأ أثناء الحفظ: ' + error.message); return }
    // ✅ نقلل "الكمية المتاحة فعليًا" المقترحة للشراء تلقائيًا بمقدار المتوفر بالمخزون
    const remaining = Math.max(0, requestedQty - availableQty)
    setPurchaseEdits(p => ({ ...p, [itemId]: { ...(p[itemId] || { unit_id: '' }), quantity: String(remaining) } }))
    // ✅ Fix حرج: المودال المفتوح (editingReq) هو نسخة منفصلة محفوظة عند فتحه، ولا يتحدّث تلقائيًا لمجرد
    // إعادة جلب القائمة الكاملة عبر fetchAll(). لذلك كانت البيانات تُحفظ فعليًا في قاعدة البيانات
    // لكن لا تظهر على الشاشة داخل المودال المفتوح. الحل: نحدّث editingReq مباشرة بالقيم الجديدة فور نجاح الحفظ.
    const selectedBranchName = branches.find(b => b.id === branchId)?.name
    setEditingReq(prev => {
      if (!prev) return prev
      return {
        ...prev,
        market_purchase_request_items: (prev.market_purchase_request_items || []).map(it =>
          it.id === itemId
            ? { ...it, available_in_warehouse_qty: availableQty, available_in_warehouse_branch_id: branchId || null, available_recorded_by: fullName, available_branch: selectedBranchName ? { name: selectedBranchName } : it.available_branch }
            : it
        ),
      }
    })
    await fetchAll()
  }

  // ✅ جديد: حفظ التقدم بس - بيسجل الكمية اللي اتلقت لحد دلوقتي من غير ما يقفل الطلب أو يشيله من قائمة "ما زال بحاجة إلى شراء"
  // مفيد لما المسؤول يشتري جزء من مكان، ويحتاج يرجع يكمل من مكان تاني بعدين
  async function savePurchaseProgress() {
    if (!editingReq) return
    setSaving(true)
    for (const [itemId, edit] of Object.entries(purchaseEdits)) {
      const qty = parseFloat(edit.quantity) || 0
      await sb.from('market_purchase_request_items').update({
        purchased_quantity: qty, purchased_unit_id: edit.unit_id,
      }).eq('id', itemId)
    }
    // ✅ ملحوظة: لا نلمس status الطلب هنا خالص - يفضل زي ما هو (قيد الانتظار) لحد ما يضغط "إتمام الشراء نهائيًا"
    await fetchAll()
    setSaving(false)
    alert('✅ تم حفظ التقدم الحالي. لا يزال الطلب ظاهرًا في قائمة الشراء، ويمكنك إكماله في أي وقت لاحق.')
  }

  // ✅ جديد (كانت اسمها savePurchase): إتمام الشراء نهائيًا - بيقفل الطلب فعليًا ويشيله من قائمة "ما زال بحاجة إلى شراء"
  async function completePurchase() {
    if (!editingReq) return
    // ✅ تنبيه وتأكيد نهائي واضح قبل إتمام الشراء فعليًا - يوضح ملخص الأصناف والكميات النهائية المطلوب شراؤها
    const itemsSummary = (editingReq.market_purchase_request_items || [])
      .map(it => {
        const q = purchaseEdits[it.id]?.quantity || '0'
        const unitSymbol = units.find(u => u.id === purchaseEdits[it.id]?.unit_id)?.symbol || it.req_unit?.symbol || ''
        return `• ${it.item_name || it.warehouse_products?.name}: ${q} ${unitSymbol}`
      }).join('\n')
    const confirmed = confirm(`⚠️ تأكيد نهائي لإتمام الشراء\n\nسيتم إغلاق الطلب نهائيًا وتسجيل هذه الكميات كـ"تم الشراء"، ولن يظهر بعد ذلك في قائمة الأصناف التي ما زالت بحاجة إلى شراء:\n\n${itemsSummary}\n\nهل أنت متأكد من المتابعة؟`)
    if (!confirmed) return
    setSaving(true)
    // ✅ Fix: مفيش سعر هنا خالص - بس نسجل الكمية والوحدة الفعلية بعد المراجعة
    for (const [itemId, edit] of Object.entries(purchaseEdits)) {
      const qty = parseFloat(edit.quantity) || 0
      await sb.from('market_purchase_request_items').update({
        purchased_quantity: qty, purchased_unit_id: edit.unit_id,
      }).eq('id', itemId)
    }
    await sb.from('market_purchase_requests').update({
      status: 'purchased', purchased_at: new Date().toISOString(),
      purchased_by: currentUser?.id,
    }).eq('id', editingReq.id)
    // ✅ جديد: إشعار لمقدّم الطلب بأن الشراء تم وأصبح جاهزًا للاستلام
    await sendNotifToEmployee(editingReq.requested_by, '✅ تم الشراء', `تم شراء طلبك #${editingReq.request_number || ''} وأصبح جاهزًا للاستلام`)
    await fetchAll()
    setSaving(false)
    setEditingReq(null)
    setPurchaseEdits({})
    setAvailableEdits({})
  }

  // ✅ Fix: بدل ما ياخد ملف واحد ويستبدله، دلوقتي بيضيف كل صورة جديدة لقائمة الصور المختارة
  function handleReceiveImgSelect(files: FileList) {
    const newFiles = Array.from(files)
    setReceiveImgs(prev => [...prev, ...newFiles])
    newFiles.forEach(file => {
      const reader = new FileReader()
      reader.onload = () => setReceiveImgPreviews(prev => [...prev, reader.result as string])
      reader.readAsDataURL(file)
    })
  }
  function removeReceiveImg(idx: number) {
    setReceiveImgs(prev => prev.filter((_, i) => i !== idx))
    setReceiveImgPreviews(prev => prev.filter((_, i) => i !== idx))
  }

  async function confirmReceive() {
    if (!receivingReq) return
    if (receiveImgs.length === 0) { alert('يرجى رفع صورة واحدة على الأقل كإثبات استلام'); return }
    setConfirming(true)
    // ✅ جديد: حفظ الكمية/الوحدة المُعدَّلة لكل صنف (لو المستلم غيّرها) قبل رفع الصور وتأكيد الحالة
    for (const it of (receivingReq.market_purchase_request_items || [])) {
      const edit = receiveEdits[it.id]
      if (!edit) continue
      const qty = parseFloat(edit.quantity)
      if (isNaN(qty) || !edit.unit_id) continue
      await sb.from('market_purchase_request_items').update({
        purchased_quantity: qty, purchased_unit_id: edit.unit_id,
      }).eq('id', it.id)
    }
    // ✅ Fix: رفع كل الصور المختارة (مش صورة واحدة بس) وتجميع روابطها في مصفوفة
    const uploadedUrls: string[] = []
    for (let i = 0; i < receiveImgs.length; i++) {
      const fileName = `market-purchases/${receivingReq.id}-${Date.now()}-${i}.jpg`
      const { data: upData } = await sb.storage.from('employees').upload(fileName, receiveImgs[i], { upsert: true })
      if (upData) { const { data: urlData } = sb.storage.from('employees').getPublicUrl(upData.path); uploadedUrls.push(urlData.publicUrl) }
    }
    if (uploadedUrls.length === 0) { setConfirming(false); alert('تعذّر رفع الصور، حاول مرة أخرى'); return }

    await sb.from('market_purchase_requests').update({
      status: 'delivered', delivered_at: new Date().toISOString(),
      // ✅ Fix: delivered_image_url (الحقل القديم) بيتسجّل بأول صورة للتوافق مع أي كود قديم، ومصفوفة
      // delivered_image_urls الجديدة بتحفظ كل الصور
      delivered_image_url: uploadedUrls[0], delivered_image_urls: uploadedUrls,
      received_by: currentUser?.id, received_at: new Date().toISOString(),
    }).eq('id', receivingReq.id)
    // ✅ جديد: إشعار للإدارة بمتابعة اكتمال الطلب، وإشعار لمقدّم الطلب لو مختلف عن الشخص اللي أكد الاستلام
    await sendNotifToRole('admin', '📦 تم استلام طلب مشتريات السوق', `تم تأكيد استلام الطلب #${receivingReq.request_number || ''}`)
    if (receivingReq.requested_by && receivingReq.requested_by !== currentUser?.id) {
      await sendNotifToEmployee(receivingReq.requested_by, '📦 تم استلام طلبك', `تم تأكيد استلام طلبك #${receivingReq.request_number || ''} بنجاح`)
    }
    await fetchAll()
    setConfirming(false)
    setReceivingReq(null)
    setReceiveImgs([])
    setReceiveImgPreviews([])
    setReceiveEdits({})
  }

  // ✅ جديد: تصفية اقتراحات الأصناف من قائمة أصناف المستودع حسب ما يكتبه المستخدم
  const productSuggestions = useMemo(() => {
    const q = newItemName.trim().toLowerCase()
    if (!q) return []
    return products.filter(p => p.name.toLowerCase().includes(q) || (p.name_en || '').toLowerCase().includes(q)).slice(0, 8)
  }, [products, newItemName])

  const myRequests = requests.filter(r => r.requested_by === currentUser?.id)
  // ✅ Fix: أمين المستودع ومدير المستودعات يشوفوا كل الفروع الآن (زي الأدمن بالظبط)، مش مقيدين بفرعهم بس
  const purchaserRequests = requests
    .filter(r => r.status === 'pending' || r.status === 'purchased')
    .filter(r => !adminBranchFilter || r.branch_id === adminBranchFilter)
  const pendingCount = requests.filter(r => r.status === 'pending').length

  // ✅ جديد (إضافة فقط): عدد الأصناف (مش عدد الطلبات) في الطلبات "قيد الانتظار" - يظهر جنب شارة قيد الانتظار
  const myPendingItemsCount = myRequests
    .filter(r => r.status === 'pending')
    .reduce((sum, r) => sum + (r.market_purchase_request_items?.length || 0), 0)
  const purchaserPendingItemsCount = requests
    .filter(r => r.status === 'pending')
    .reduce((sum, r) => sum + (r.market_purchase_request_items?.length || 0), 0)

  // ✅ جديد (إضافة فقط): فلترة طلباتي بالشهر + ترتيب بالرقم واليوم - متغير جديد منفصل، بدون لمس myRequests الأصلي
  const [myRequestsMonthFilter, setMyRequestsMonthFilter] = useState('')
  const myRequestsFiltered = myRequests
    .filter(r => {
      if (!myRequestsMonthFilter) return true
      const d = new Date(r.requested_at)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      return key === myRequestsMonthFilter
    })
    .slice()
    .sort((a, b) => {
      const numA = parseInt(String(a.request_number || '').replace(/\D/g, '')) || 0
      const numB = parseInt(String(b.request_number || '').replace(/\D/g, '')) || 0
      if (numB !== numA) return numB - numA
      return new Date(b.requested_at).getTime() - new Date(a.requested_at).getTime()
    })

  // ✅ جديد: اليوم المختار للتقرير المجمّع - فاضي معناه "كل الطلبات المعلّقة"، وله قيمة معناه يوم محدد بس
  const [reportDay, setReportDay] = useState<string | null>(null)

  // ✅ جديد: التقرير المجمّع - يجمع كل أصناف الطلبات "قيد الانتظار" و"تم الشراء" حسب الاسم والوحدة،
  // مقسّم بالفروع أولاً، وفي الآخر إجمالي كلي مجمّع لكل الأصناف المتطابقة - مع تتبع حالة الشراء لكل صنف
  const consolidatedReport = useMemo(() => {
    // ✅ Fix: بنشمل "تم الشراء" كمان مش "قيد الانتظار" بس، عشان نقدر نتابع حالة كل صنف (اتشرى كامل / جزئي / لسه)
    const relevantRequests = requests
      .filter(r => r.status === 'pending' || r.status === 'purchased')
      .filter(r => !adminBranchFilter || r.branch_id === adminBranchFilter)
      // ✅ جديد: لو محدد يوم معين من التقويم، نصفّي بيه (باستخدام effective_date - اليوم الفعلي بعد قاعدة الـ12 ظهرًا)
      .filter(r => !reportDay || (r.effective_date || myDateKey(r.requested_at)) === reportDay)

    type ItemAgg = { name: string; unit: string; requestedQty: number; purchasedQty: number }
    const byBranch: Record<string, Record<string, ItemAgg>> = {}
    const grandTotal: Record<string, ItemAgg> = {}
    // ✅ جديد: قائمة الطالبين (اسم + تاريخ ووقت) لكل فرع، عشان تظهر تحت اسم الفرع في التقرير
    const branchRequesters: Record<string, { name: string; at: string; requestNumber: string | null | undefined }[]> = {}

    for (const r of relevantRequests) {
      const bName = r.branches?.name || 'بدون فرع'
      if (!byBranch[bName]) byBranch[bName] = {}
      if (!branchRequesters[bName]) branchRequesters[bName] = []
      branchRequesters[bName].push({ name: [r.requester?.name, r.requester?.name_en].filter(Boolean).join(' ') || '—', at: fmtMYTime(r.requested_at), requestNumber: r.request_number })
      for (const it of (r.market_purchase_request_items || [])) {
        const name = it.item_name || it.warehouse_products?.name || '—'
        const unit = it.req_unit?.symbol || ''
        // ✅ المفتاح = الاسم + الوحدة، عشان صنف بوحدتين مختلفتين ميتجمعش غلط مع بعضه
        const itemKey = `${name.trim().toLowerCase()}__${unit}`
        // ✅ الكمية المشتراة فعليًا - بتكون null/undefined لو الطلب لسه "قيد الانتظار" ولسه محدش اشتراها
        const purchasedQty = it.purchased_quantity != null ? it.purchased_quantity : 0

        if (!byBranch[bName][itemKey]) byBranch[bName][itemKey] = { name, unit, requestedQty: 0, purchasedQty: 0 }
        byBranch[bName][itemKey].requestedQty += it.requested_quantity
        byBranch[bName][itemKey].purchasedQty += purchasedQty

        if (!grandTotal[itemKey]) grandTotal[itemKey] = { name, unit, requestedQty: 0, purchasedQty: 0 }
        grandTotal[itemKey].requestedQty += it.requested_quantity
        grandTotal[itemKey].purchasedQty += purchasedQty
      }
    }
    return {
      byBranch: Object.entries(byBranch).map(([branchName, items]) => ({
        branchName, items: Object.values(items).sort((a, b) => a.name.localeCompare(b.name, 'ar')),
        requesters: branchRequesters[branchName] || [],
      })),
      grandTotal: Object.values(grandTotal).sort((a, b) => a.name.localeCompare(b.name, 'ar')),
      requestsCount: relevantRequests.length,
    }
  }, [requests, adminBranchFilter, reportDay])

  // ✅ جديد: تحديد شارة حالة الصنف (اتشرى بالكامل / جزئي / لسه) للعرض والطباعة
  function itemProgressLabel(requestedQty: number, purchasedQty: number): { text: string; color: string } {
    if (purchasedQty <= 0) return { text: '⏳ لم يُشترَ بعد', color: S.amber }
    if (purchasedQty >= requestedQty) return { text: `✅ تم شراء الكل (${requestedQty})`, color: S.green }
    return { text: `🟡 تم شراء ${purchasedQty} من ${requestedQty}`, color: S.blue }
  }

  // ✅ جديد: إحصائيات شاملة للأدمن بس - سجل تفصيلي لكل عملية من الطلب لحد الاستلام
  const [adminStatsBranch, setAdminStatsBranch] = useState('')
  // ✅ جديد (إضافة فقط): فلترة الإحصائيات الشاملة بشهر محدد - فاضي معناها كل الأوقات
  const [adminStatsMonth, setAdminStatsMonth] = useState('')
  // ✅ جديد: نافذة تفاصيل طلبات موظف معيّن (بالضغط على اسمه في "الأكثر طلبًا") + ترقيم صفحات
  const [selectedRequesterName, setSelectedRequesterName] = useState<string | null>(null)
  const [requesterPage, setRequesterPage] = useState(1)
  const REQUESTER_PAGE_SIZE = 8
  const selectedRequesterRequests = useMemo(() => {
    if (!selectedRequesterName) return []
    return requests
      .filter(r => ([r.requester?.name, r.requester?.name_en].filter(Boolean).join(' ') || '—') === selectedRequesterName)
      .sort((a, b) => new Date(b.requested_at).getTime() - new Date(a.requested_at).getTime())
  }, [requests, selectedRequesterName])
  const requesterTotalPages = Math.max(1, Math.ceil(selectedRequesterRequests.length / REQUESTER_PAGE_SIZE))
  const requesterPageItems = selectedRequesterRequests.slice((requesterPage - 1) * REQUESTER_PAGE_SIZE, requesterPage * REQUESTER_PAGE_SIZE)

  // ✅ جديد: مقارنة استخدام الفروع - مين بيطلب أكتر. بتحترم فلتر الشهر، لكن عمدًا بتتجاهل فلتر
  // الفرع المحدد (adminStatsBranch) لأن الهدف أصلاً مقارنة كل الفروع مع بعض
  const branchComparisonData = useMemo(() => {
    const filtered = requests.filter(r => {
      if (!adminStatsMonth) return true
      const d = new Date(r.requested_at)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      return key === adminStatsMonth
    })
    const groups: Record<string, { branchId: string; branchName: string; requestCount: number; itemCount: number; deliveredCount: number; deliveryHours: number[] }> = {}
    for (const r of filtered) {
      const bId = r.branch_id || '—'
      const bName = r.branches?.name || '—'
      if (!groups[bId]) groups[bId] = { branchId: bId, branchName: bName, requestCount: 0, itemCount: 0, deliveredCount: 0, deliveryHours: [] }
      groups[bId].requestCount += 1
      groups[bId].itemCount += (r.market_purchase_request_items || []).length
      if (r.status === 'delivered') {
        groups[bId].deliveredCount += 1
        if (r.delivered_at) groups[bId].deliveryHours.push((new Date(r.delivered_at).getTime() - new Date(r.requested_at).getTime()) / (1000 * 60 * 60))
      }
    }
    const rows = Object.values(groups)
      .map(g => ({
        ...g,
        avgDeliveryHours: g.deliveryHours.length > 0 ? g.deliveryHours.reduce((s, h) => s + h, 0) / g.deliveryHours.length : null,
      }))
      .sort((a, b) => b.requestCount - a.requestCount)
    const maxRequests = Math.max(1, ...rows.map(r => r.requestCount))
    return { rows, maxRequests }
  }, [requests, adminStatsMonth])

  // ✅ جديد: تطبيع اسم الصنف - مستخدَم هنا بس لتجميع الأصناف المتشابهة داخل تقرير الطباعة
  function normalizeItemNameCompare(name: string): string {
    return (name || '')
      .trim()
      .toLowerCase()
      .replace(/[\u064B-\u065F\u0670]/g, '')
      .replace(/^ال/, '')
      .replace(/\s+/g, ' ')
  }

  // ✅ جديد: مقارنة كل صنف بين الفروع - للاستخدام داخل تقرير الطباعة بس (مفيش قسم جديد في الشاشة)
  const itemBranchComparisonData = useMemo(() => {
    const filtered = requests.filter(r => {
      if (!adminStatsMonth) return true
      const d = new Date(r.requested_at)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      return key === adminStatsMonth
    })
    const itemGroups: Record<string, { itemName: string; unit: string; byBranch: Record<string, { branchName: string; qty: number }> }> = {}
    const branchNamesSet = new Set<string>()
    for (const r of filtered) {
      const branchName = r.branches?.name || '—'
      branchNamesSet.add(branchName)
      for (const it of (r.market_purchase_request_items || [])) {
        const rawName = it.item_name || it.warehouse_products?.name || '—'
        const norm = normalizeItemNameCompare(rawName)
        if (!itemGroups[norm]) itemGroups[norm] = { itemName: rawName, unit: it.req_unit?.symbol || '', byBranch: {} }
        if (!itemGroups[norm].byBranch[branchName]) itemGroups[norm].byBranch[branchName] = { branchName, qty: 0 }
        itemGroups[norm].byBranch[branchName].qty += Number(it.requested_quantity) || 0
      }
    }
    const branchNames = Array.from(branchNamesSet).sort()
    const rows = Object.values(itemGroups)
      .map(g => ({ itemName: g.itemName, unit: g.unit, totalQty: Object.values(g.byBranch).reduce((s, b) => s + b.qty, 0), byBranch: g.byBranch }))
      .sort((a, b) => b.totalQty - a.totalQty)
    return { rows, branchNames }
  }, [requests, adminStatsMonth])

  // ✅ Fix: نفس زر "طباعة" بتاع مقارنة الفروع، لكن دلوقتي بيطبع كمان جدول مقارنة الأصناف تفصيليًا
  // (كل صنف وكمية كل فرع منه جنب بعض) تحت ملخّص الفروع، في نفس المستند
  function printBranchComparison() {
    const win = window.open('', '_blank')
    if (!win) return
    const rowsHtml = branchComparisonData.rows.map((row, i) => `
      <tr>
        <td style="text-align:center">${i + 1}</td>
        <td>${row.branchName}</td>
        <td style="text-align:center">${row.requestCount}</td>
        <td style="text-align:center">${row.itemCount}</td>
        <td style="text-align:center">${row.deliveredCount}</td>
        <td style="text-align:center">${row.avgDeliveryHours != null ? row.avgDeliveryHours.toFixed(1) + ' ساعة' : '—'}</td>
      </tr>`).join('')
    const { rows: itemRows, branchNames } = itemBranchComparisonData
    const itemHeaderCols = branchNames.map(b => `<th style="text-align:center">${b}</th>`).join('')
    const itemRowsHtml = itemRows.map((row, i) => {
      const branchCells = branchNames.map(b => `<td style="text-align:center">${row.byBranch[b]?.qty || 0} ${row.unit}</td>`).join('')
      return `
      <tr>
        <td style="text-align:center">${i + 1}</td>
        <td>${row.itemName}</td>
        ${branchCells}
        <td style="text-align:center;font-weight:bold">${row.totalQty} ${row.unit}</td>
      </tr>`
    }).join('')
    const monthLabel = adminStatsMonth || 'كل الأوقات'
    win.document.write(`
      <html><head><title>مقارنة استخدام الفروع - مشتريات السوق</title>
      <style>
        body { font-family: Arial, Helvetica, sans-serif; padding: 32px; color: #1a1a1a; direction: rtl; }
        h1 { font-size: 18px; margin-bottom: 4px; }
        h2 { font-size: 15px; margin: 28px 0 4px; }
        .sub { font-size: 12px; color: #666; margin-bottom: 20px; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; }
        th, td { border: 1px solid #C9A84C80; padding: 7px 9px; text-align: right; }
        th { background: #C9A84C30; }
        @media print { body { padding: 10px; } }
      </style></head>
      <body>
        <h1>🏪 مقارنة استخدام الفروع — مشتريات السوق</h1>
        <div class="sub">الشهر: ${monthLabel}</div>
        <table>
          <thead><tr><th>#</th><th>الفرع</th><th>عدد الطلبات</th><th>عدد الأصناف</th><th>تم التسليم</th><th>متوسط وقت التنفيذ</th></tr></thead>
          <tbody>${rowsHtml}</tbody>
        </table>

        <h2>📦 مقارنة الأصناف بين الفروع</h2>
        <div class="sub">إجمالي ${itemRows.length} صنف</div>
        <table>
          <thead><tr><th>#</th><th>الصنف</th>${itemHeaderCols}<th>الإجمالي</th></tr></thead>
          <tbody>${itemRowsHtml}</tbody>
        </table>
        <script>window.onload = () => window.print()</script>
      </body></html>
    `)
    win.document.close()
  }

  const adminStatsData = useMemo(() => {
    const filtered = requests
      .filter(r => !adminStatsBranch || r.branch_id === adminStatsBranch)
      // ✅ جديد: تصفية بالشهر المختار (صيغة YYYY-MM) بناءً على تاريخ الطلب
      .filter(r => {
        if (!adminStatsMonth) return true
        const d = new Date(r.requested_at)
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        return key === adminStatsMonth
      })
      .sort((a, b) => new Date(b.requested_at).getTime() - new Date(a.requested_at).getTime())

    const totalRequests = filtered.length
    const delivered = filtered.filter(r => r.status === 'delivered')
    const rejected = filtered.filter(r => r.status === 'rejected')
    const pending = filtered.filter(r => r.status === 'pending')
    const purchased = filtered.filter(r => r.status === 'purchased')

    // ✅ متوسط الوقت من الطلب لحد الاستلام (بالساعات) - لمعرفة سرعة التنفيذ الفعلية
    const deliveryTimes = delivered
      .filter(r => r.delivered_at)
      .map(r => (new Date(r.delivered_at!).getTime() - new Date(r.requested_at).getTime()) / (1000 * 60 * 60))
    const avgDeliveryHours = deliveryTimes.length > 0 ? deliveryTimes.reduce((s, h) => s + h, 0) / deliveryTimes.length : null

    // ✅ الأكثر طلبًا (اسم الموظف) - ✅ Fix: الاسم الكامل (عربي + إنجليزي) بدل الاسم الأول بس
    const requesterCounts: Record<string, number> = {}
    for (const r of filtered) {
      const n = [r.requester?.name, r.requester?.name_en].filter(Boolean).join(' ') || '—'
      requesterCounts[n] = (requesterCounts[n] || 0) + 1
    }
    const topRequesters = Object.entries(requesterCounts).sort((a, b) => b[1] - a[1]).slice(0, 5)

    // ✅ الأكثر طلبًا (الأصناف) - ✅ Fix: أعلى 5 أصناف بدل صنف واحد بس
    const itemCounts: Record<string, number> = {}
    for (const r of filtered) {
      for (const it of (r.market_purchase_request_items || [])) {
        const n = it.item_name || it.warehouse_products?.name || '—'
        itemCounts[n] = (itemCounts[n] || 0) + 1
      }
    }
    const topItems = Object.entries(itemCounts).sort((a, b) => b[1] - a[1]).slice(0, 5)

    return {
      log: filtered, totalRequests,
      deliveredCount: delivered.length, rejectedCount: rejected.length, pendingCount: pending.length, purchasedCount: purchased.length,
      avgDeliveryHours, topRequesters, topItems,
    }
  }, [requests, adminStatsBranch, adminStatsMonth])

  // ✅ جديد: ترقيم صفحات للسجل التفصيلي - 20 عملية في كل صفحة
  const ADMIN_LOG_PAGE_SIZE = 20
  const [adminLogPage, setAdminLogPage] = useState(1)
  useEffect(() => { setAdminLogPage(1) }, [adminStatsBranch, adminStatsMonth])
  const adminLogTotalPages = Math.max(1, Math.ceil(adminStatsData.log.length / ADMIN_LOG_PAGE_SIZE))
  const adminLogPageItems = adminStatsData.log.slice((adminLogPage - 1) * ADMIN_LOG_PAGE_SIZE, adminLogPage * ADMIN_LOG_PAGE_SIZE)

  // ✅ Fix: تطبيع اسم الصنف عشان الأصناف المتشابهة الاسم تتجمّع في كمية واحدة بدل ما تتفرق في الطباعة
  function normalizeItemNameStats(name: string): string {
    return (name || '')
      .trim()
      .toLowerCase()
      .replace(/[\u064B-\u065F\u0670]/g, '') // إزالة التشكيل
      .replace(/^ال/, '') // إزالة "أل" التعريف من بداية الاسم
      .replace(/\s+/g, ' ')
  }

  // ✅ Fix: رجّعنا تجميع الأصناف (زي ما كان قبل كده) بس مقصور على الطباعة بس - الشاشة فاضلة بالسجل التفصيلي العادي
  function printDetailedLog() {
    const win = window.open('', '_blank')
    if (!win) return
    const groups: Record<string, {
      branch: string; itemName: string; unit: string
      qtyRequested: number; qtyPurchased: number; requestCount: number
      requesters: Set<string>; purchaseDates: Set<string>; deliveryDates: Set<string>
    }> = {}
    for (const r of adminStatsData.log) {
      const branchName = r.branches?.name || '—'
      const requesterName = [r.requester?.name, r.requester?.name_en].filter(Boolean).join(' ') || '—'
      // ✅ خلي في تاريخ التسليم (وقت الشراء/التسليم من المندوب) وتاريخ الاستلام (وقت وصوله للفرع) بس
      const purchaseDateStr = r.purchased_at ? fmtMYTime(r.purchased_at) : null
      const deliveryDateStr = r.delivered_at ? fmtMYTime(r.delivered_at) : null
      for (const it of (r.market_purchase_request_items || [])) {
        const rawName = it.item_name || it.warehouse_products?.name || '—'
        const norm = normalizeItemNameStats(rawName)
        const key = `${branchName}|${norm}`
        if (!groups[key]) groups[key] = { branch: branchName, itemName: rawName, unit: it.req_unit?.symbol || '', qtyRequested: 0, qtyPurchased: 0, requestCount: 0, requesters: new Set(), purchaseDates: new Set(), deliveryDates: new Set() }
        groups[key].qtyRequested += Number(it.requested_quantity) || 0
        if (it.purchased_quantity != null) groups[key].qtyPurchased += Number(it.purchased_quantity) || 0
        groups[key].requestCount += 1
        groups[key].requesters.add(requesterName)
        if (purchaseDateStr) groups[key].purchaseDates.add(purchaseDateStr)
        if (deliveryDateStr) groups[key].deliveryDates.add(deliveryDateStr)
      }
    }
    const groupedRows = Object.values(groups).sort((a, b) => a.branch.localeCompare(b.branch) || a.itemName.localeCompare(b.itemName))
    const rowsHtml = groupedRows.map((row, i) => `
      <tr>
        <td style="text-align:center">${i + 1}</td>
        <td>${row.branch}</td>
        <td>${row.itemName}</td>
        <td style="text-align:center">${row.qtyRequested} ${row.unit}</td>
        <td style="text-align:center">${row.qtyPurchased} ${row.unit}</td>
        <td>${Array.from(row.purchaseDates).join('<br/>') || '—'}</td>
        <td>${Array.from(row.deliveryDates).join('<br/>') || '—'}</td>
        <td>${Array.from(row.requesters).join('، ')}</td>
      </tr>`).join('')
    const filterLabel = `${adminStatsBranch ? branches.find(b => b.id === adminStatsBranch)?.name || '' : 'كل الفروع'} — ${adminStatsMonth || 'كل الأوقات'}`
    win.document.write(`
      <html><head><title>ملخص الأصناف المجمّع - مشتريات السوق</title>
      <style>
        body { font-family: Arial, Helvetica, sans-serif; padding: 32px; color: #1a1a1a; direction: rtl; }
        h1 { font-size: 18px; margin-bottom: 4px; }
        .sub { font-size: 12px; color: #666; margin-bottom: 20px; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; }
        th, td { border: 1px solid #C9A84C80; padding: 7px 9px; text-align: right; vertical-align: top; }
        th { background: #C9A84C30; }
        @media print { body { padding: 10px; } }
      </style></head>
      <body>
        <h1>📦 ملخص الأصناف المجمّع — مشتريات السوق</h1>
        <div class="sub">${filterLabel} — إجمالي ${groupedRows.length} صنف مجمَّع</div>
        <table>
          <thead><tr><th>#</th><th>الفرع</th><th>الصنف</th><th>الكمية المطلوبة</th><th>الكمية المشتراة</th><th>تاريخ التسليم</th><th>تاريخ الاستلام</th><th>طلب بواسطة</th></tr></thead>
          <tbody>${rowsHtml}</tbody>
        </table>
        <script>window.onload = () => window.print()</script>
      </body></html>
    `)
    win.document.close()
  }

  // ✅ جديد: طباعة التقرير المجمّع
  function printConsolidatedReport() {
    const win = window.open('', '_blank')
    if (!win) return
    const branchesHtml = consolidatedReport.byBranch.map(({ branchName, items, requesters }) => `
      <h3>🏪 ${branchName}</h3>
      <p style="font-size:11px;color:#666;margin:4px 0 10px">${requesters.map(r => `👤 ${r.name} ${r.requestNumber ? `(#${r.requestNumber})` : ''} — 📅 ${r.at}`).join('<br>')}</p>
      <table>
        <tr><th>الصنف</th><th>الكمية المطلوبة</th><th>حالة الشراء</th></tr>
        ${items.map(it => {
          const progress = itemProgressLabel(it.requestedQty, it.purchasedQty)
          return `<tr><td>${it.name}</td><td>${it.requestedQty} ${it.unit}</td><td>${progress.text}</td></tr>`
        }).join('')}
      </table>
    `).join('')
    const totalHtml = `
      <h2>📊 الإجمالي الكلي (كل الفروع مجمّعة)</h2>
      <table>
        <tr><th>الصنف</th><th>الكمية المطلوبة</th><th>حالة الشراء</th></tr>
        ${consolidatedReport.grandTotal.map(it => {
          const progress = itemProgressLabel(it.requestedQty, it.purchasedQty)
          return `<tr><td>${it.name}</td><td><b>${it.requestedQty} ${it.unit}</b></td><td>${progress.text}</td></tr>`
        }).join('')}
      </table>
    `
    win.document.write(`
      <html dir="rtl"><head><title>تقرير مشتريات السوق المجمّع</title>
      <style>
        body { font-family: 'Tajawal', Arial, sans-serif; padding: 24px; }
        h1 { text-align: center; }
        h2 { margin-top: 24px; border-top: 2px solid #333; padding-top: 12px; }
        h3 { margin-top: 18px; color: #1e3a8a; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 6px; }
        th, td { border: 1px solid #ccc; padding: 6px 10px; text-align: right; font-size: 13px; }
        th { background: #f0f0f0; }
      </style></head>
      <body>
        <h1>📋 تقرير مشتريات السوق المجمّع</h1>
        <p style="text-align:center;color:#666">${reportDay ? `ليوم ${reportDay}` : 'كل الطلبات المعلّقة الحالية'} — ${new Date().toLocaleString('ar-MY', { timeZone: 'Asia/Kuala_Lumpur' })}</p>
        ${branchesHtml}
        ${totalHtml}
      </body></html>
    `)
    win.document.close()
    win.focus()
    setTimeout(() => win.print(), 300)
  }

  // ✅ جديد: منطق التقويم الشهري - يعرض عدد الطلبات ووضعها لكل يوم
  const [calendarMonth, setCalendarMonth] = useState(() => { const d = new Date(); d.setDate(1); return d })
  // ✅ جديد: اليوم المختار في التقويم - لعرض الطلبات مقسّمة بالفروع في تاب داخلي
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const calendarRequests = requests.filter(r => {
    if (!isAdmin) return r.branch_id === currentUser?.branch_id
    return !adminBranchFilter || r.branch_id === adminBranchFilter
  })
  const dayStats = useMemo(() => {
    const map: Record<string, { total: number; received: number; pending: number; purchased: number }> = {}
    for (const r of calendarRequests) {
      // ✅ Fix حرج: كان بيستخدم toISOString() اللي بترجع تاريخ UTC، وده بيسبب انزياح يوم كامل لأي طلب
      // بيحصل في الفترة اللي بتقع فرق التوقيت فيها (ماليزيا UTC+8) - بنستخدم دلوقتي توقيت ماليزيا صراحةً
      // ✅ Fix: نستخدم effective_date (اليوم بعد تطبيق قاعدة الـ12 ظهرًا) بدل وقت الإرسال الخام،
      // مع دعم البيانات القديمة اللي مالهاش effective_date محسوب (احتياطًا)
      const dateKey = r.effective_date || myDateKey(r.requested_at)
      if (!map[dateKey]) map[dateKey] = { total: 0, received: 0, pending: 0, purchased: 0 }
      map[dateKey].total++
      if (r.status === 'delivered') map[dateKey].received++
      else if (r.status === 'purchased') map[dateKey].purchased++
      else if (r.status === 'pending') map[dateKey].pending++
    }
    return map
  }, [calendarRequests])

  const calendarDays = useMemo(() => {
    const year = calendarMonth.getFullYear()
    const month = calendarMonth.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const startOffset = firstDay.getDay() // 0 = الأحد
    // ✅ Fix: بنبني مفتاح التاريخ (YYYY-MM-DD) مباشرة من الأرقام، من غير أي تحويل عبر Date/toISOString
    // اللي كان بيسبب انزياح يوم كامل بسبب فرق التوقيت المحلي للمتصفح
    const days: ({ date: Date; key: string } | null)[] = []
    for (let i = 0; i < startOffset; i++) days.push(null)
    for (let d = 1; d <= lastDay.getDate(); d++) {
      const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      days.push({ date: new Date(year, month, d), key })
    }
    return days
  }, [calendarMonth])

  function itemDisplay(it: RequestItem) {
    const name = it.item_name || it.warehouse_products?.name || '—'
    return `${name} — ${it.requested_quantity} ${it.req_unit?.symbol || ''}`
  }

  return (
    <div style={{ fontFamily: 'Tajawal, sans-serif', direction: 'rtl', color: S.white, maxWidth: 900, margin: '0 auto' }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&display=swap'); select option { background: ${S.navy2}; color: ${S.white}; }`}</style>

      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: S.white, marginBottom: 4 }}>🛒 مشتريات السوق</h1>
        <p style={{ fontSize: 13, color: S.muted }}>طلب وشراء وتسليم مشتريات السوق اليومية للفروع</p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {canRequest && (
          <>
            <button onClick={() => setTab('new')}
              style={{ padding: '9px 16px', borderRadius: 12, border: `1px solid ${tab === 'new' ? S.gold : S.border}`, background: tab === 'new' ? S.gold3 : 'transparent', color: tab === 'new' ? S.gold : S.muted, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: tab === 'new' ? 700 : 400 }}>
              ➕ طلب جديد
            </button>
            <button onClick={() => setTab('mine')}
              style={{ padding: '9px 16px', borderRadius: 12, border: `1px solid ${tab === 'mine' ? S.gold : S.border}`, background: tab === 'mine' ? S.gold3 : 'transparent', color: tab === 'mine' ? S.gold : S.muted, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: tab === 'mine' ? 700 : 400 }}>
              📋 طلباتي ({myRequests.length})
              {/* ✅ جديد (إضافة فقط): عدد الأصناف قيد الانتظار ضمن طلباتي */}
              {myPendingItemsCount > 0 && (
                <span style={{ marginRight: 6, fontSize: 10, color: S.amber }}>· ⏳ {myPendingItemsCount} صنف</span>
              )}
            </button>
          </>
        )}
        {isPurchaser && (
          <button onClick={() => setTab('purchaser')}
            style={{ padding: '9px 16px', borderRadius: 12, border: `1px solid ${tab === 'purchaser' ? S.gold : S.border}`, background: tab === 'purchaser' ? S.gold3 : 'transparent', color: tab === 'purchaser' ? S.gold : S.muted, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: tab === 'purchaser' ? 700 : 400, position: 'relative' }}>
            🛒 طلبات الشراء ({purchaserRequests.length})
            {/* ✅ جديد (إضافة فقط): عدد الأصناف قيد الانتظار ضمن كل طلبات الشراء */}
            {purchaserPendingItemsCount > 0 && (
              <span style={{ marginRight: 6, fontSize: 10, color: S.amber }}>· ⏳ {purchaserPendingItemsCount} صنف</span>
            )}
            {pendingCount > 0 && (
              <span style={{ position: 'absolute', top: -6, right: -6, background: S.red, color: '#fff', borderRadius: '50%', width: 18, height: 18, fontSize: 10, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{pendingCount}</span>
            )}
          </button>
        )}
        {/* ✅ Fix: تاب التقويم أصبح متاحًا لأمين المستودع ومدير المستودعات كمان، مش الإدارة بس */}
        {(isAdmin || ['warehouse_keeper', 'warehouse_manager'].includes(currentUser?.role || '')) && (
          <button onClick={() => setTab('calendar')}
            style={{ padding: '9px 16px', borderRadius: 12, border: `1px solid ${tab === 'calendar' ? S.gold : S.border}`, background: tab === 'calendar' ? S.gold3 : 'transparent', color: tab === 'calendar' ? S.gold : S.muted, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: tab === 'calendar' ? 700 : 400 }}>
            📅 التقويم
          </button>
        )}
        {/* ✅ جديد: تاب التقرير المجمّع - لمسؤول الشراء، يجمع كل الأصناف المطلوبة من كل الطلبات المعلّقة */}
        {isPurchaser && (
          <button onClick={() => setTab('report')}
            style={{ padding: '9px 16px', borderRadius: 12, border: `1px solid ${tab === 'report' ? S.gold : S.border}`, background: tab === 'report' ? S.gold3 : 'transparent', color: tab === 'report' ? S.gold : S.muted, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: tab === 'report' ? 700 : 400 }}>
            📋 تقرير مجمّع
          </button>
        )}
        {/* ✅ جديد: تاب الإحصائيات الشاملة - للأدمن فقط، سجل تفصيلي كامل لكل عملية من أولها لآخرها */}
        {isAdmin && (
          <button onClick={() => setTab('admin_stats')}
            style={{ padding: '9px 16px', borderRadius: 12, border: `1px solid ${tab === 'admin_stats' ? S.gold : S.border}`, background: tab === 'admin_stats' ? S.gold3 : 'transparent', color: tab === 'admin_stats' ? S.gold : S.muted, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: tab === 'admin_stats' ? 700 : 400 }}>
            📊 إحصائيات شاملة
          </button>
        )}
      </div>

      {/* ── New Request Tab ── */}
      {tab === 'new' && canRequest && (
        <div>
          {/* ✅ جديد: تنبيه ديناميكي - يتغيّر نصه لو الوقت دلوقتي بعد 12 ظهرًا بتوقيت ماليزيا */}
          {(() => {
            const nowInMY = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kuala_Lumpur' }))
            const isPastNoon = nowInMY.getHours() >= 12
            const effDate = computeEffectiveDate()
            return (
              <div style={{ background: S.redB, border: `1.5px solid ${S.red}`, borderRadius: 14, padding: '14px 18px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 24 }}>⏰</span>
                <div>
                  {isPastNoon ? (
                    <>
                      <div style={{ fontSize: 14, fontWeight: 800, color: S.red }}>لقد تجاوزت موعد اليوم (الساعة 12:00 ظهرًا بتوقيت ماليزيا)</div>
                      <div style={{ fontSize: 12, color: S.white, marginTop: 2 }}>أي طلب ترسله الآن سيتم ترحيله تلقائيًا ليوم <strong style={{ color: S.gold }}>{effDate}</strong> لأنك تطلب بعد الساعة 12 ظهرًا</div>
                    </>
                  ) : (
                    <>
                      <div style={{ fontSize: 14, fontWeight: 800, color: S.red }}>آخر موعد لتقديم طلبات مشتريات السوق هو الساعة 12:00 ظهرًا بتوقيت ماليزيا يوميًا</div>
                      <div style={{ fontSize: 11, color: S.white, marginTop: 2 }}>أي طلب يُقدَّم بعد هذا الموعد سيُرحَّل تلقائيًا لليوم التالي</div>
                    </>
                  )}
                </div>
              </div>
            )
          })()}

          {/* ✅ جديد: نموذج إضافة صنف - بحث ذكي في أصناف المستودع + إمكانية كتابة صنف حر جديد في نفس المكان */}
          <div style={{ background: S.navy2, borderRadius: 16, border: `1px solid ${S.border}`, padding: 20, marginBottom: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>➕ إضافة صنف للطلب</div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div style={{ flex: 2, minWidth: 160, position: 'relative' }}>
                <label style={{ fontSize: 11, color: S.muted, display: 'block', marginBottom: 4 }}>اسم الصنف</label>
                <input style={inp} placeholder="ابحث أو اكتب اسم صنف جديد..." value={newItemName}
                  onChange={e => { setNewItemName(e.target.value); setShowSuggestions(true) }}
                  onFocus={() => setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                  onKeyDown={e => { if (e.key === 'Enter') { setShowSuggestions(false); addToCart() } }} />
                {/* ✅ قائمة اقتراحات من أصناف المستودع الموجودة فعليًا - تظهر وتختفي في نفس مكان الكتابة، من غير أي انتقال لصفحة تانية */}
                {showSuggestions && newItemName.trim().length > 0 && productSuggestions.length > 0 && (
                  <div style={{ position: 'absolute', top: '100%', right: 0, left: 0, marginTop: 4, background: S.navy3, border: `1px solid ${S.border}`, borderRadius: 10, maxHeight: 200, overflowY: 'auto', zIndex: 50, boxShadow: '0 8px 20px rgba(0,0,0,0.4)' }}>
                    {productSuggestions.map(p => (
                      <div key={p.id} onMouseDown={() => {
                        setNewItemName(p.name)
                        if (p.unit_id) setNewItemUnit(p.unit_id)
                        setShowSuggestions(false)
                      }}
                        style={{ padding: '9px 12px', cursor: 'pointer', fontSize: 12, color: S.white, borderBottom: `1px solid ${S.border}` }}>
                        📦 {p.name} {p.name_en && <span style={{ color: S.muted }}>({p.name_en})</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ width: 100 }}>
                <label style={{ fontSize: 11, color: S.muted, display: 'block', marginBottom: 4 }}>الكمية</label>
                <input type="number" min={0} step="0.01" style={inp} placeholder="0" value={newItemQty}
                  onChange={e => setNewItemQty(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') addToCart() }} />
              </div>
              <div style={{ width: 110 }}>
                <label style={{ fontSize: 11, color: S.muted, display: 'block', marginBottom: 4 }}>الوحدة</label>
                <select style={inp} value={newItemUnit} onChange={e => setNewItemUnit(e.target.value)}>
                  <option value="">اختر</option>
                  {units.map(u => <option key={u.id} value={u.id}>{u.symbol}</option>)}
                </select>
              </div>
              <button onClick={addToCart}
                style={{ padding: '10px 18px', borderRadius: 10, border: `1px solid ${S.gold}`, background: S.gold3, color: S.gold, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700, whiteSpace: 'nowrap' }}>
                ➕ إضافة للسلة
              </button>
            </div>
          </div>

          {cart.length > 0 && (
            <div style={{ background: S.navy2, borderRadius: 16, border: `1px solid ${S.border}`, padding: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>🛒 سلة الطلب ({cart.length} صنف)</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {cart.map(c => (
                  <div key={c.tempId} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', background: S.card, borderRadius: 10, padding: '10px 12px' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, minWidth: 110, flex: 1 }}>{c.name}</div>
                    <div style={{ fontSize: 13, color: S.gold, fontWeight: 700 }}>{c.quantity} {units.find(u => u.id === c.unit_id)?.symbol}</div>
                    <button onClick={() => removeFromCart(c.tempId)} style={{ background: 'transparent', border: 'none', color: S.red, cursor: 'pointer', fontSize: 16 }}>✕</button>
                  </div>
                ))}
              </div>
              <button onClick={submitRequest} disabled={submitting}
                style={{ width: '100%', marginTop: 16, padding: '12px', borderRadius: 12, border: `1px solid ${S.gold}`, background: S.gold3, color: S.gold, cursor: submitting ? 'not-allowed' : 'pointer', fontSize: 14, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
                {submitting ? '⏳ جاري الإرسال...' : '✅ إرسال الطلب'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── My Requests Tab ── */}
      {tab === 'mine' && canRequest && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* ✅ جديد (إضافة فقط): فلترة طلباتي بالشهر */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <label style={{ fontSize: 12, color: S.muted }}>📅 تصفية بالشهر:</label>
            <input type="month" value={myRequestsMonthFilter} onChange={e => setMyRequestsMonthFilter(e.target.value)}
              style={{ padding: '7px 10px', borderRadius: 8, border: `1px solid ${S.border}`, background: S.navy3, color: S.white, fontSize: 12, fontFamily: 'Tajawal, sans-serif' }} />
            {myRequestsMonthFilter && (
              <button onClick={() => setMyRequestsMonthFilter('')}
                style={{ padding: '7px 12px', borderRadius: 8, border: `1px solid ${S.border}`, background: 'transparent', color: S.muted, cursor: 'pointer', fontSize: 11, fontFamily: 'Tajawal, sans-serif' }}>
                ✕ إلغاء التصفية
              </button>
            )}
          </div>
          {loading ? <div style={{ textAlign: 'center', padding: 40, color: S.muted }}>⏳ جاري التحميل...</div>
          : myRequestsFiltered.length === 0 ? <div style={{ textAlign: 'center', padding: 40, background: S.navy2, borderRadius: 16, border: `1px solid ${S.border}`, color: S.muted }}>لا توجد طلبات سابقة</div>
          : myRequestsFiltered.map(req => {
            const st = STATUS_CFG[req.status] || STATUS_CFG.pending
            return (
              <div key={req.id} style={{ background: S.navy2, borderRadius: 14, border: `1px solid ${S.border}`, padding: '16px 18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: S.gold }}>#{req.request_number || '—'}</div>
                    <div style={{ fontSize: 11, color: S.muted }}>📅 {fmtMYTime(req.requested_at)}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ background: st.bg, color: st.color, borderRadius: 20, padding: '3px 12px', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>{st.icon} {st.label}</span>
                    {/* ✅ جديد (إضافة فقط): عدد الأصناف في هذا الطلب تحديدًا */}
                    <span style={{ background: S.card, color: S.muted, borderRadius: 20, padding: '3px 10px', fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap' }}>📦 {(req.market_purchase_request_items || []).length} صنف</span>
                    {/* ✅ جديد (إضافة فقط): إعادة الطلب بعد التنفيذ - تظهر فقط للحالات المكتملة */}
                    {['delivered', 'purchased', 'rejected'].includes(req.status) && (
                      <button onClick={() => reorderRequest(req)} title="إعادة هذا الطلب"
                        style={{ background: S.blueB, border: `1px solid ${S.blue}`, borderRadius: 8, color: S.blue, cursor: 'pointer', fontSize: 11, padding: '4px 10px', fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
                        🔁 إعادة الطلب
                      </button>
                    )}
                    {/* ✅ جديد: حذف الطلب - أدمن فقط */}
                    {isAdmin && (
                      <button onClick={() => deleteRequest(req.id, req.request_number)} title="حذف الطلب"
                        style={{ background: S.redB, border: `1px solid ${S.red}`, borderRadius: 8, color: S.red, cursor: 'pointer', fontSize: 12, padding: '4px 8px' }}>
                        🗑️
                      </button>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
                  {(req.market_purchase_request_items || []).map(it => (
                    <div key={it.id} style={{ fontSize: 12, color: S.white }}>
                      • {it.item_name || it.warehouse_products?.name} —
                      {it.purchased_quantity != null
                        ? <span> طُلب {it.requested_quantity} {it.req_unit?.symbol} / اشتُري <b style={{ color: S.blue }}>{it.purchased_quantity} {it.pur_unit?.symbol}</b></span>
                        : <span> {it.requested_quantity} {it.req_unit?.symbol}</span>}
                    </div>
                  ))}
                </div>
                {/* ✅ Fix: تم إخفاء السعر والإجمالي عن الموظف الطالب بناءً على الطلب - يبقى ظاهرًا فقط لمسؤول المستودع والإدارة في تاب طلبات الشراء */}
                {req.status === 'purchased' && (
                  <button onClick={() => {
                    setReceivingReq(req)
                    // ✅ جديد: تعبئة الكميات مبدئيًا بالكمية المشتراة (أو المطلوبة لو مفيش كمية مشتراة مسجّلة)
                    const init: Record<string, { quantity: string; unit_id: string }> = {}
                    for (const it of (req.market_purchase_request_items || [])) {
                      init[it.id] = {
                        quantity: String(it.purchased_quantity ?? it.requested_quantity),
                        unit_id: it.purchased_unit_id || it.requested_unit_id,
                      }
                    }
                    setReceiveEdits(init)
                  }}
                    style={{ width: '100%', padding: '10px', borderRadius: 10, border: `1px solid ${S.green}`, background: S.greenB, color: S.green, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
                    ✅ تأكيد الاستلام + رفع صورة
                  </button>
                )}
                {req.status === 'delivered' && ((req.delivered_image_urls && req.delivered_image_urls.length > 0) || req.delivered_image_url) && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {(req.delivered_image_urls && req.delivered_image_urls.length > 0 ? req.delivered_image_urls : [req.delivered_image_url!]).map((url, i) => (
                      <a key={i} href={url} target="_blank" rel="noreferrer">
                        <img src={url} alt={`إثبات الاستلام ${i + 1}`} style={{ width: 80, height: 80, borderRadius: 10, objectFit: 'cover', border: `1px solid ${S.border}` }} />
                      </a>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── Purchaser Tab ── */}
      {tab === 'purchaser' && isPurchaser && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* ✅ جديد: اختيار الفرع - يظهر للإدارة فقط */}
          {isPurchaser && branches.length > 0 && (
            <div style={{ display: 'flex', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
              <button onClick={() => setAdminBranchFilter('')}
                style={{ padding: '8px 16px', borderRadius: 10, border: `1px solid ${!adminBranchFilter ? S.gold : S.border}`, background: !adminBranchFilter ? S.gold3 : 'transparent', color: !adminBranchFilter ? S.gold : S.muted, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', fontWeight: !adminBranchFilter ? 700 : 400 }}>
                🌐 كل الفروع
              </button>
              {branches.map(b => (
                <button key={b.id} onClick={() => setAdminBranchFilter(b.id)}
                  style={{ padding: '8px 16px', borderRadius: 10, border: `1px solid ${adminBranchFilter === b.id ? S.gold : S.border}`, background: adminBranchFilter === b.id ? S.gold3 : 'transparent', color: adminBranchFilter === b.id ? S.gold : S.muted, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', fontWeight: adminBranchFilter === b.id ? 700 : 400 }}>
                  🏪 {b.name}
                </button>
              ))}
            </div>
          )}
          {loading ? <div style={{ textAlign: 'center', padding: 40, color: S.muted }}>⏳ جاري التحميل...</div>
          : purchaserRequests.length === 0 ? <div style={{ textAlign: 'center', padding: 40, background: S.navy2, borderRadius: 16, border: `1px solid ${S.border}`, color: S.muted }}>لا توجد طلبات حالية</div>
          : purchaserRequests.map(req => {
            const st = STATUS_CFG[req.status] || STATUS_CFG.pending
            return (
              <div key={req.id} style={{ background: S.navy2, borderRadius: 14, border: `1px solid ${req.status === 'pending' ? S.amber + '40' : S.border}`, padding: '16px 18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: S.gold }}>#{req.request_number || '—'}</div>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{req.branches?.name} — {req.requester?.name} {req.requester?.name_en} {req.requester?.employee_number && <span style={{ color: S.gold, fontSize: 12 }}>(#{req.requester.employee_number})</span>}</div>
                    <div style={{ fontSize: 11, color: S.muted, marginTop: 2 }}>📅 {fmtMYTime(req.requested_at)}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ background: st.bg, color: st.color, borderRadius: 20, padding: '3px 12px', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>{st.icon} {st.label}</span>
                    {/* ✅ جديد (إضافة فقط): عدد الأصناف في هذا الطلب تحديدًا */}
                    <span style={{ background: S.card, color: S.muted, borderRadius: 20, padding: '3px 10px', fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap' }}>📦 {(req.market_purchase_request_items || []).length} صنف</span>
                    {/* ✅ جديد: حذف الطلب - أدمن فقط */}
                    {isAdmin && (
                      <button onClick={() => deleteRequest(req.id, req.request_number)} title="حذف الطلب"
                        style={{ background: S.redB, border: `1px solid ${S.red}`, borderRadius: 8, color: S.red, cursor: 'pointer', fontSize: 12, padding: '4px 8px' }}>
                        🗑️
                      </button>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                  {(req.market_purchase_request_items || []).map(it => (
                    <span key={it.id} style={{ background: S.card, borderRadius: 10, padding: '5px 10px', fontSize: 12 }}>{itemDisplay(it)}</span>
                  ))}
                </div>
                {/* ✅ Fix: الزر يفضل ظاهر حتى بعد "تم الشراء" (مش قيد الانتظار بس) - عشان يقدر يرجع يزوّد الكمية
                    لو اشترى جزء من محل وجزء من محل تاني في وقت لاحق، بدل ما يتقفل الطلب بعد أول حفظ */}
                {['pending', 'purchased'].includes(req.status) && (
                  <button onClick={() => startEditingPurchase(req)}
                    style={{ width: '100%', padding: '10px', borderRadius: 10, border: `1px solid ${req.status === 'purchased' ? S.amber : S.blue}`, background: req.status === 'purchased' ? S.amberB : S.blueB, color: req.status === 'purchased' ? S.amber : S.blue, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
                    {req.status === 'purchased' ? '✏️ تعديل / إضافة كمية مشتراة' : '🛒 تسجيل الشراء'}
                  </button>
                )}
                {req.status === 'purchased' && <div style={{ fontSize: 11, color: S.muted, marginTop: 6 }}>في انتظار استلام الفرع — يمكنك تعديل الكمية المشتراة في أي وقت قبل الاستلام</div>}
              </div>
            )
          })}
        </div>
      )}

      {/* ✅ جديد: تاب التقرير المجمّع */}
      {tab === 'report' && isPurchaser && (
        <div>
          {branches.length > 0 && (
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
              <button onClick={() => setAdminBranchFilter('')}
                style={{ padding: '8px 16px', borderRadius: 10, border: `1px solid ${!adminBranchFilter ? S.gold : S.border}`, background: !adminBranchFilter ? S.gold3 : 'transparent', color: !adminBranchFilter ? S.gold : S.muted, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', fontWeight: !adminBranchFilter ? 700 : 400 }}>
                🌐 كل الفروع
              </button>
              {branches.map(b => (
                <button key={b.id} onClick={() => setAdminBranchFilter(b.id)}
                  style={{ padding: '8px 16px', borderRadius: 10, border: `1px solid ${adminBranchFilter === b.id ? S.gold : S.border}`, background: adminBranchFilter === b.id ? S.gold3 : 'transparent', color: adminBranchFilter === b.id ? S.gold : S.muted, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', fontWeight: adminBranchFilter === b.id ? 700 : 400 }}>
                  🏪 {b.name}
                </button>
              ))}
            </div>
          )}

          {/* ✅ جديد: اختيار يوم محدد للتقرير (بدل كل الطلبات المعلّقة) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
            <label style={{ fontSize: 12, color: S.muted }}>📅 تصفية بيوم محدد:</label>
            <input type="date" value={reportDay || ''} onChange={e => setReportDay(e.target.value || null)}
              style={{ padding: '7px 10px', borderRadius: 8, border: `1px solid ${S.border}`, background: S.navy3, color: S.white, fontSize: 12, fontFamily: 'Tajawal, sans-serif' }} />
            {reportDay && (
              <button onClick={() => setReportDay(null)}
                style={{ padding: '7px 12px', borderRadius: 8, border: `1px solid ${S.border}`, background: 'transparent', color: S.muted, cursor: 'pointer', fontSize: 11, fontFamily: 'Tajawal, sans-serif' }}>
                ✕ إلغاء التصفية (عرض كل الطلبات المعلّقة)
              </button>
            )}
          </div>

          <p style={{ fontSize: 12, color: S.muted, marginBottom: 16 }}>
            تجميع كل أصناف الطلبات "قيد الانتظار" ({consolidatedReport.requestsCount} طلب){reportDay ? ` — ليوم ${reportDay} فقط` : ''} — مناسب للخروج للشراء دفعة واحدة بدل مراجعة كل طلب لوحده
          </p>

          {/* ✅ جديد: زرار طباعة التقرير */}
          {consolidatedReport.requestsCount > 0 && (
            <button onClick={printConsolidatedReport}
              style={{ marginBottom: 16, padding: '9px 18px', borderRadius: 10, border: `1px solid ${S.blue}`, background: S.blueB, color: S.blue, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
              🖨️ طباعة التقرير
            </button>
          )}

          {consolidatedReport.requestsCount === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, background: S.navy2, borderRadius: 16, border: `1px solid ${S.border}`, color: S.muted }}>لا توجد طلبات قيد الانتظار حاليًا</div>
          ) : (
            <>
              {/* تفصيل كل فرع لوحده */}
              {consolidatedReport.byBranch.map(({ branchName, items, requesters }) => (
                <div key={branchName} style={{ background: S.navy2, borderRadius: 14, border: `1px solid ${S.border}`, padding: 16, marginBottom: 12 }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: S.blue, marginBottom: 4 }}>🏪 {branchName}</div>
                  {/* ✅ جديد: اسم من طلب + التاريخ والتوقيت تحت اسم الفرع مباشرة */}
                  <div style={{ marginBottom: 10 }}>
                    {requesters.map((req, i) => (
                      <div key={i} style={{ fontSize: 10, color: S.muted }}>
                        👤 {req.name} {req.requestNumber && `(#${req.requestNumber})`} — 📅 {req.at}
                      </div>
                    ))}
                  </div>
                  {items.map((it, idx) => {
                    const progress = itemProgressLabel(it.requestedQty, it.purchasedQty)
                    return (
                      <div key={idx} style={{ padding: '6px 0', borderBottom: idx < items.length - 1 ? `1px solid ${S.border}` : 'none' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: 13, color: S.white }}>{it.name}</span>
                          <span style={{ fontSize: 13, fontWeight: 700, color: S.gold }}>{it.requestedQty} {it.unit}</span>
                        </div>
                        <div style={{ fontSize: 10, color: progress.color, marginTop: 2 }}>{progress.text}</div>
                      </div>
                    )
                  })}
                </div>
              ))}

              {/* الإجمالي الكلي المجمّع لكل الأصناف المتطابقة */}
              <div style={{ background: S.gold3, borderRadius: 14, border: `1.5px solid ${S.gold}`, padding: 16 }}>
                <div style={{ fontSize: 15, fontWeight: 900, color: S.gold, marginBottom: 12 }}>📊 الإجمالي الكلي (كل الفروع مجمّعة)</div>
                {consolidatedReport.grandTotal.map((it, idx) => {
                  const progress = itemProgressLabel(it.requestedQty, it.purchasedQty)
                  return (
                    <div key={idx} style={{ padding: '7px 0', borderBottom: idx < consolidatedReport.grandTotal.length - 1 ? `1px solid ${S.gold}30` : 'none' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 14, color: S.white, fontWeight: 600 }}>{it.name}</span>
                        <span style={{ fontSize: 14, fontWeight: 800, color: S.gold }}>{it.requestedQty} {it.unit}</span>
                      </div>
                      <div style={{ fontSize: 11, color: progress.color, marginTop: 2 }}>{progress.text}</div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* ✅ جديد: تاب الإحصائيات الشاملة - أدمن فقط */}
      {tab === 'admin_stats' && isAdmin && (
        <div>
          {branches.length > 0 && (
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
              <button onClick={() => setAdminStatsBranch('')}
                style={{ padding: '8px 16px', borderRadius: 10, border: `1px solid ${!adminStatsBranch ? S.gold : S.border}`, background: !adminStatsBranch ? S.gold3 : 'transparent', color: !adminStatsBranch ? S.gold : S.muted, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', fontWeight: !adminStatsBranch ? 700 : 400 }}>
                🌐 كل الفروع
              </button>
              {branches.map(b => (
                <button key={b.id} onClick={() => setAdminStatsBranch(b.id)}
                  style={{ padding: '8px 16px', borderRadius: 10, border: `1px solid ${adminStatsBranch === b.id ? S.gold : S.border}`, background: adminStatsBranch === b.id ? S.gold3 : 'transparent', color: adminStatsBranch === b.id ? S.gold : S.muted, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', fontWeight: adminStatsBranch === b.id ? 700 : 400 }}>
                  🏪 {b.name}
                </button>
              ))}
            </div>
          )}

          {/* ✅ جديد (إضافة فقط): تصفية الإحصائيات الشاملة بشهر محدد */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
            <label style={{ fontSize: 12, color: S.muted }}>📅 تصفية بالشهر:</label>
            <input type="month" value={adminStatsMonth} onChange={e => setAdminStatsMonth(e.target.value)}
              style={{ padding: '7px 10px', borderRadius: 8, border: `1px solid ${S.border}`, background: S.navy3, color: S.white, fontSize: 12, fontFamily: 'Tajawal, sans-serif' }} />
            {adminStatsMonth && (
              <button onClick={() => setAdminStatsMonth('')}
                style={{ padding: '7px 12px', borderRadius: 8, border: `1px solid ${S.border}`, background: 'transparent', color: S.muted, cursor: 'pointer', fontSize: 11, fontFamily: 'Tajawal, sans-serif' }}>
                ✕ إلغاء التصفية (كل الأوقات)
              </button>
            )}
          </div>

          {/* بطاقات الإحصائيات العامة */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: 10, marginBottom: 20 }}>
            <div style={{ background: S.navy2, borderRadius: 12, border: `1px solid ${S.border}`, padding: 14, textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: S.white }}>{adminStatsData.totalRequests}</div>
              <div style={{ fontSize: 11, color: S.muted }}>إجمالي الطلبات</div>
            </div>
            <div style={{ background: S.greenB, borderRadius: 12, border: `1px solid ${S.green}40`, padding: 14, textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: S.green }}>{adminStatsData.deliveredCount}</div>
              <div style={{ fontSize: 11, color: S.green }}>تم التسليم</div>
            </div>
            <div style={{ background: S.amberB, borderRadius: 12, border: `1px solid ${S.amber}40`, padding: 14, textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: S.amber }}>{adminStatsData.pendingCount}</div>
              <div style={{ fontSize: 11, color: S.amber }}>قيد الانتظار</div>
            </div>
            <div style={{ background: S.redB, borderRadius: 12, border: `1px solid ${S.red}40`, padding: 14, textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: S.red }}>{adminStatsData.rejectedCount}</div>
              <div style={{ fontSize: 11, color: S.red }}>مرفوض</div>
            </div>
          </div>

          {/* إحصائيات إضافية */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: 10, marginBottom: 24 }}>
            <div style={{ background: S.card, borderRadius: 12, padding: 14 }}>
              <div style={{ fontSize: 11, color: S.muted, marginBottom: 4 }}>⏱️ متوسط وقت التنفيذ (من الطلب للاستلام)</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: S.gold }}>
                {adminStatsData.avgDeliveryHours != null ? `${adminStatsData.avgDeliveryHours.toFixed(1)} ساعة` : '—'}
              </div>
            </div>
            <div style={{ background: S.card, borderRadius: 12, padding: 14 }}>
              <div style={{ fontSize: 11, color: S.muted, marginBottom: 4 }}>👤 الأكثر طلبًا (٥ أشخاص)</div>
              {adminStatsData.topRequesters.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {adminStatsData.topRequesters.map(([name, count], i) => (
                    <div key={i}
                      onClick={() => { setSelectedRequesterName(name); setRequesterPage(1) }}
                      style={{ fontSize: 12, fontWeight: 700, color: S.white, display: 'flex', justifyContent: 'space-between', cursor: 'pointer' }}
                      onMouseEnter={e => (e.currentTarget.style.color = S.gold)}
                      onMouseLeave={e => (e.currentTarget.style.color = S.white)}>
                      <span style={{ textDecoration: 'underline', textDecorationStyle: 'dotted' }}>{i + 1}. {name}</span>
                      <span style={{ color: S.gold }}>{count}</span>
                    </div>
                  ))}
                </div>
              ) : <div style={{ fontSize: 14, fontWeight: 800, color: S.white }}>—</div>}
            </div>
            <div style={{ background: S.card, borderRadius: 12, padding: 14 }}>
              <div style={{ fontSize: 11, color: S.muted, marginBottom: 4 }}>📦 الأكثر طلبًا (٥ أصناف)</div>
              {adminStatsData.topItems.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {adminStatsData.topItems.map(([name, count], i) => (
                    <div key={i} style={{ fontSize: 12, fontWeight: 700, color: S.white, display: 'flex', justifyContent: 'space-between' }}>
                      <span>{i + 1}. {name}</span>
                      <span style={{ color: S.gold }}>{count}</span>
                    </div>
                  ))}
                </div>
              ) : <div style={{ fontSize: 14, fontWeight: 800, color: S.white }}>—</div>}
            </div>
          </div>

          {/* ✅ جديد: مقارنة استخدام الفروع - مين بيطلب أكتر (بيشمل كل الفروع دايمًا بغض النظر عن فلتر الفرع فوق) */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: S.gold }}>🏪 مقارنة استخدام الفروع</div>
            <button onClick={printBranchComparison} disabled={branchComparisonData.rows.length === 0}
              style={{ padding: '7px 14px', borderRadius: 10, border: `1px solid ${S.gold}`, background: S.gold3, color: S.gold, cursor: branchComparisonData.rows.length === 0 ? 'not-allowed' : 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', fontWeight: 700, opacity: branchComparisonData.rows.length === 0 ? 0.5 : 1 }}>
              🖨️ طباعة
            </button>
          </div>
          {branchComparisonData.rows.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 24, color: S.muted, marginBottom: 24 }}>لا توجد بيانات ضمن الفلاتر الحالية</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 30 }}>
              {branchComparisonData.rows.map((row, i) => (
                <div key={row.branchId} style={{ background: S.navy2, borderRadius: 12, border: `1px solid ${S.border}`, padding: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 6 }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: S.white }}>{i + 1}. 🏪 {row.branchName}</div>
                    <div style={{ display: 'flex', gap: 14, fontSize: 11, color: S.muted, flexWrap: 'wrap' }}>
                      <span>📦 {row.itemCount} صنف</span>
                      <span>✅ {row.deliveredCount} مُسلَّم</span>
                      <span>⏱️ {row.avgDeliveryHours != null ? `${row.avgDeliveryHours.toFixed(1)} ساعة` : '—'}</span>
                    </div>
                  </div>
                  {/* شريط بصري لسهولة مقارنة عدد الطلبات بين الفروع */}
                  <div style={{ background: S.navy3, borderRadius: 999, height: 20, overflow: 'hidden', position: 'relative' }}>
                    <div style={{ width: `${(row.requestCount / branchComparisonData.maxRequests) * 100}%`, background: i === 0 ? S.gold : S.blue, height: '100%', borderRadius: 999, transition: 'width 0.3s' }} />
                    <span style={{ position: 'absolute', top: 0, right: 10, height: '100%', display: 'flex', alignItems: 'center', fontSize: 11, fontWeight: 800, color: S.white }}>{row.requestCount} طلب</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* السجل التفصيلي الكامل لكل عملية */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: S.gold }}>📜 سجل تفصيلي لكل عملية</div>
            {/* ✅ جديد: طباعة السجل التفصيلي بنفس أسلوب الطباعة في تبادل الفروع */}
            <button onClick={printDetailedLog} disabled={adminStatsData.log.length === 0}
              style={{ padding: '7px 14px', borderRadius: 10, border: `1px solid ${S.gold}`, background: S.gold3, color: S.gold, cursor: adminStatsData.log.length === 0 ? 'not-allowed' : 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', fontWeight: 700, opacity: adminStatsData.log.length === 0 ? 0.5 : 1 }}>
              🖨️ طباعة
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {adminLogPageItems.map(r => {
              const st = STATUS_CFG[r.status] || STATUS_CFG.pending
              return (
                <div key={r.id} style={{ background: S.navy2, borderRadius: 14, border: `1px solid ${S.border}`, padding: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: S.gold }}>#{r.request_number || '—'} — 🏪 {r.branches?.name}</div>
                      <div style={{ fontSize: 12, color: S.white, marginTop: 2 }}>👤 طلبه: {r.requester?.name} {r.requester?.name_en}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{ background: st.bg, color: st.color, borderRadius: 20, padding: '3px 12px', fontSize: 11, fontWeight: 700 }}>{st.icon} {st.label}</span>
                      {/* ✅ جديد (إضافة فقط): عدد الأصناف في هذه العملية تحديدًا */}
                      <span style={{ background: S.card, color: S.muted, borderRadius: 20, padding: '3px 10px', fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap' }}>📦 {(r.market_purchase_request_items || []).length} صنف</span>
                      {/* ✅ جديد: شارة تنبيه سريعة لو فيه صنف واحد على الأقل مختلف عن المطلوب في هذا الطلب */}
                      {(() => {
                        const mismatchCount = (r.market_purchase_request_items || []).filter(it =>
                          it.purchased_quantity != null && (
                            it.purchased_quantity !== it.requested_quantity ||
                            (!!it.purchased_unit_id && !!it.requested_unit_id && it.purchased_unit_id !== it.requested_unit_id)
                          )
                        ).length
                        return mismatchCount > 0 ? (
                          <span style={{ background: S.redB, color: S.red, borderRadius: 20, padding: '3px 10px', fontSize: 10, fontWeight: 800, whiteSpace: 'nowrap' }}>
                            ⚠️ فرق في {mismatchCount} صنف
                          </span>
                        ) : null
                      })()}
                    </div>
                  </div>

                  {/* الأصناف */}
                  <div style={{ marginBottom: 10 }}>
                    {(r.market_purchase_request_items || []).map(it => {
                      // ✅ جديد: كشف أي فرق بين الكمية/الوحدة المطلوبة والمُشتراة فعليًا - لتنبيه الإدارة لمراجعة الفرق يدويًا
                      const hasPurchase = it.purchased_quantity != null
                      const qtyMismatch = hasPurchase && it.purchased_quantity !== it.requested_quantity
                      const unitMismatch = hasPurchase && !!it.purchased_unit_id && !!it.requested_unit_id && it.purchased_unit_id !== it.requested_unit_id
                      const mismatch = qtyMismatch || unitMismatch
                      const isShort = qtyMismatch && (it.purchased_quantity as number) < it.requested_quantity
                      return (
                        <div key={it.id} style={{ fontSize: 12, color: S.white, marginBottom: 4 }}>
                          • {it.item_name || it.warehouse_products?.name} —
                          {hasPurchase
                            ? <span> طُلب {it.requested_quantity} {it.req_unit?.symbol} / اشتُري <b style={{ color: mismatch ? S.red : S.blue }}>{it.purchased_quantity} {it.pur_unit?.symbol}</b></span>
                            : <span> {it.requested_quantity} {it.req_unit?.symbol}</span>}
                          {mismatch && (
                            <span style={{ display: 'inline-block', marginRight: 8, background: S.redB, color: S.red, borderRadius: 8, padding: '1px 8px', fontSize: 10, fontWeight: 800 }}>
                              ⚠️ {unitMismatch && !qtyMismatch ? 'وحدة مختلفة عن المطلوب' : isShort ? 'كمية أقل من المطلوب' : 'كمية أكثر من المطلوب'}
                            </span>
                          )}
                        </div>
                      )
                    })}
                  </div>

                  {/* الخط الزمني الكامل */}
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 8, fontSize: 11, background: S.card, borderRadius: 10, padding: 10 }}>
                    <div>
                      <div style={{ color: S.muted }}>🕐 وقت الطلب</div>
                      <div style={{ color: S.white, fontWeight: 700 }}>{fmtMYTime(r.requested_at)}</div>
                    </div>
                    <div>
                      <div style={{ color: S.muted }}>🛒 وقت الشراء</div>
                      <div style={{ color: S.white, fontWeight: 700 }}>{r.purchased_at ? fmtMYTime(r.purchased_at) : '—'}</div>
                    </div>
                    <div>
                      <div style={{ color: S.muted }}>✅ وقت الاستلام</div>
                      <div style={{ color: S.white, fontWeight: 700 }}>{r.delivered_at ? fmtMYTime(r.delivered_at) : '—'}</div>
                      {r.receiver?.name && <div style={{ color: S.muted, marginTop: 1 }}>بواسطة: {r.receiver.name}</div>}
                    </div>
                  </div>

                  {/* صورة إثبات الاستلام */}
                  {((r.delivered_image_urls && r.delivered_image_urls.length > 0) || r.delivered_image_url) && (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
                      {(r.delivered_image_urls && r.delivered_image_urls.length > 0 ? r.delivered_image_urls : [r.delivered_image_url!]).map((url, i) => (
                        <a key={i} href={url} target="_blank" rel="noreferrer">
                          <img src={url} alt={`إثبات الاستلام ${i + 1}`} style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 8, border: `1px solid ${S.border}` }} />
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
            {adminStatsData.log.length === 0 && (
              <div style={{ textAlign: 'center', padding: 40, background: S.navy2, borderRadius: 16, border: `1px solid ${S.border}`, color: S.muted }}>لا توجد أي عمليات مسجّلة</div>
            )}
          </div>

          {/* ✅ جديد: أزرار التنقل بين صفحات السجل التفصيلي */}
          {adminStatsData.log.length > ADMIN_LOG_PAGE_SIZE && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, marginTop: 20 }}>
              <button onClick={() => setAdminLogPage(p => Math.max(1, p - 1))} disabled={adminLogPage === 1}
                style={{ padding: '8px 16px', borderRadius: 10, border: `1px solid ${S.border}`, background: 'transparent', color: adminLogPage === 1 ? S.muted : S.white, cursor: adminLogPage === 1 ? 'not-allowed' : 'pointer', fontSize: 12 }}>
                ‹ السابق
              </button>
              <span style={{ fontSize: 12, color: S.muted }}>صفحة {adminLogPage} من {adminLogTotalPages} ({adminStatsData.log.length} عملية)</span>
              <button onClick={() => setAdminLogPage(p => Math.min(adminLogTotalPages, p + 1))} disabled={adminLogPage === adminLogTotalPages}
                style={{ padding: '8px 16px', borderRadius: 10, border: `1px solid ${S.border}`, background: 'transparent', color: adminLogPage === adminLogTotalPages ? S.muted : S.white, cursor: adminLogPage === adminLogTotalPages ? 'not-allowed' : 'pointer', fontSize: 12 }}>
                التالي ›
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Calendar Tab ── */}
      {tab === 'calendar' && (isAdmin || ['warehouse_keeper', 'warehouse_manager'].includes(currentUser?.role || '')) && (
        <div>
          {branches.length > 0 && (
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
              <button onClick={() => setAdminBranchFilter('')}
                style={{ padding: '8px 16px', borderRadius: 10, border: `1px solid ${!adminBranchFilter ? S.gold : S.border}`, background: !adminBranchFilter ? S.gold3 : 'transparent', color: !adminBranchFilter ? S.gold : S.muted, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', fontWeight: !adminBranchFilter ? 700 : 400 }}>
                🌐 كل الفروع
              </button>
              {branches.map(b => (
                <button key={b.id} onClick={() => setAdminBranchFilter(b.id)}
                  style={{ padding: '8px 16px', borderRadius: 10, border: `1px solid ${adminBranchFilter === b.id ? S.gold : S.border}`, background: adminBranchFilter === b.id ? S.gold3 : 'transparent', color: adminBranchFilter === b.id ? S.gold : S.muted, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', fontWeight: adminBranchFilter === b.id ? 700 : 400 }}>
                  🏪 {b.name}
                </button>
              ))}
            </div>
          )}

          {/* شريط التنقل بين الشهور */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <button onClick={() => setCalendarMonth(m => { const d = new Date(m); d.setMonth(d.getMonth() - 1); return d })}
              style={{ padding: '8px 14px', borderRadius: 10, border: `1px solid ${S.border}`, background: 'transparent', color: S.white, cursor: 'pointer', fontSize: 13 }}>
              ← الشهر السابق
            </button>
            <div style={{ fontSize: 16, fontWeight: 800, color: S.gold }}>
              {calendarMonth.toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' })}
            </div>
            <button onClick={() => setCalendarMonth(m => { const d = new Date(m); d.setMonth(d.getMonth() + 1); return d })}
              style={{ padding: '8px 14px', borderRadius: 10, border: `1px solid ${S.border}`, background: 'transparent', color: S.white, cursor: 'pointer', fontSize: 13 }}>
              الشهر التالي →
            </button>
          </div>

          {/* شبكة التقويم */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
            {['أحد', 'اثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'].map(d => (
              <div key={d} style={{ textAlign: 'center', fontSize: 11, color: S.muted, fontWeight: 700, padding: '4px 0' }}>{d}</div>
            ))}
            {calendarDays.map((item, i) => {
              if (!item) return <div key={i} />
              const { date: day, key } = item
              const stats = dayStats[key]
              const isToday = key === myDateKey(new Date().toISOString())
              return (
                <div key={i} onClick={() => stats && setSelectedDay(key)} style={{
                  background: isToday ? S.gold3 : S.navy2, border: `1px solid ${isToday ? S.gold : S.border}`,
                  borderRadius: 10, padding: '8px 6px', minHeight: 72, display: 'flex', flexDirection: 'column', gap: 4,
                  cursor: stats ? 'pointer' : 'default',
                }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: isToday ? S.gold : S.white }}>{day.getDate()}</div>
                  {stats && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <div style={{ fontSize: 10, color: S.white }}>📦 {stats.total} طلب</div>
                      {stats.received > 0 && <div style={{ fontSize: 10, color: S.green }}>✅ {stats.received} مُستلَم</div>}
                      {stats.pending > 0 && <div style={{ fontSize: 10, color: S.amber }}>⏳ {stats.pending} معلّق</div>}
                      {stats.purchased > 0 && <div style={{ fontSize: 10, color: S.blue }}>🛒 {stats.purchased} تم الشراء</div>}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ✅ جديد: مودال تفاصيل اليوم المختار من التقويم - الطلبات مقسّمة بالفروع */}
      {selectedDay && (
        <div onClick={() => setSelectedDay(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.75)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: S.navy2, borderRadius: 20, border: `1px solid ${S.border}`, padding: 20, maxWidth: 560, width: '100%', maxHeight: '85vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: S.gold }}>📅 طلبات يوم {selectedDay}</div>
              <button onClick={() => setSelectedDay(null)} style={{ background: 'transparent', border: 'none', color: S.muted, fontSize: 20, cursor: 'pointer' }}>✕</button>
            </div>
            {/* ✅ جديد: الانتقال المباشر للتقرير المجمّع لنفس اليوم */}
            {isPurchaser && (
              <button onClick={() => { setReportDay(selectedDay); setSelectedDay(null); setTab('report') }}
                style={{ width: '100%', marginBottom: 14, padding: '9px 0', borderRadius: 10, border: `1px solid ${S.gold}`, background: S.gold3, color: S.gold, cursor: 'pointer', fontSize: 12, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
                📋 عرض تقرير مجمّع لهذا اليوم
              </button>
            )}
            {(() => {
              // ✅ نجمّع طلبات اليوم المختار حسب الفرع
              const dayRequests = calendarRequests.filter(r => (r.effective_date || myDateKey(r.requested_at)) === selectedDay)
              const byBranch: Record<string, typeof dayRequests> = {}
              for (const r of dayRequests) {
                const bName = r.branches?.name || 'بدون فرع'
                if (!byBranch[bName]) byBranch[bName] = []
                byBranch[bName].push(r)
              }
              if (dayRequests.length === 0) return <div style={{ textAlign: 'center', color: S.muted, padding: 20 }}>لا توجد طلبات في هذا اليوم</div>
              return Object.entries(byBranch).map(([bName, reqs]) => (
                <div key={bName} style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: S.blue, marginBottom: 8 }}>🏪 {bName} ({reqs.length})</div>
                  {reqs.map(r => {
                    const st = STATUS_CFG[r.status] || STATUS_CFG.pending
                    return (
                      <div key={r.id} style={{ background: S.card, borderRadius: 10, padding: '10px 12px', marginBottom: 6 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: S.gold }}>#{r.request_number || '—'} — {r.requester?.name} {r.requester?.name_en}</span>
                          <span style={{ background: st.bg, color: st.color, borderRadius: 20, padding: '2px 10px', fontSize: 10, fontWeight: 700 }}>{st.icon} {st.label}</span>
                        </div>
                        {(r.market_purchase_request_items || []).map(it => (
                          <div key={it.id} style={{ fontSize: 11, color: S.white }}>• {it.item_name || it.warehouse_products?.name} — {it.requested_quantity} {it.req_unit?.symbol}</div>
                        ))}
                      </div>
                    )
                  })}
                </div>
              ))
            })()}
          </div>
        </div>
      )}

      {/* ✅ جديد: مودال تنبيه ترحيل الطلب لليوم التالي - في منتصف الشاشة */}
      {rolloverNotice && (
        <div onClick={() => setRolloverNotice(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.75)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: S.navy2, borderRadius: 20, border: `1.5px solid ${S.amber}`, padding: 24, maxWidth: 400, width: '100%', textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>⏰</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: S.amber, marginBottom: 10 }}>تم إرسال طلبك بنجاح</div>
            <div style={{ fontSize: 13, color: S.white, lineHeight: 1.6, marginBottom: 16 }}>
              رقم الطلب <strong style={{ color: S.gold }}>#{rolloverNotice.requestNumber}</strong><br />
              نظرًا لتقديمه بعد الساعة <strong>12:00 ظهرًا</strong> بتوقيت ماليزيا، سيتم ترحيله تلقائيًا ليوم<br />
              <strong style={{ color: S.gold, fontSize: 16 }}>{rolloverNotice.effectiveDate}</strong>
            </div>
            <button onClick={() => setRolloverNotice(null)}
              style={{ width: '100%', padding: '10px 0', borderRadius: 10, border: 'none', background: S.gold, color: S.navy, cursor: 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 800 }}>
              حسنًا، فهمت
            </button>
          </div>
        </div>
      )}

      {/* ── Purchase Editing Modal ── */}
      {editingReq && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: S.navy2, borderRadius: 20, border: `1px solid ${S.border}`, width: '100%', maxWidth: 560, maxHeight: '88vh', overflowY: 'auto', padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 18 }}>
              <h2 style={{ fontSize: 16, fontWeight: 800 }}>🛒 تسجيل الشراء — {editingReq.branches?.name}</h2>
              <button onClick={() => { setEditingReq(null); setPurchaseEdits({}) }} style={{ background: 'transparent', border: 'none', color: S.muted, fontSize: 20, cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {(editingReq.market_purchase_request_items || []).map(it => {
                const edit = purchaseEdits[it.id] || { quantity: '', unit_id: '' }
                const avEdit = availableEdits[it.id] || { qty: it.available_in_warehouse_qty ? String(it.available_in_warehouse_qty) : '', branchId: it.available_in_warehouse_branch_id || '' }
                return (
                  <div key={it.id} style={{ background: S.card, borderRadius: 12, padding: 14 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>{it.item_name || it.warehouse_products?.name} <span style={{ color: S.muted, fontSize: 11 }}>(مطلوب: {it.requested_quantity} {it.req_unit?.symbol})</span></div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <div>
                        <label style={{ fontSize: 10, color: S.muted, display: 'block', marginBottom: 4 }}>الكمية المتاحة فعليًا</label>
                        <input type="number" min={0} step="0.01" value={edit.quantity} onChange={e => setPurchaseEdits(p => ({ ...p, [it.id]: { ...edit, quantity: e.target.value } }))}
                          style={{ width: 90, background: S.navy3, border: `1px solid ${S.border}`, borderRadius: 8, padding: '6px 8px', fontSize: 12, color: S.white, outline: 'none' }} />
                      </div>
                      <div>
                        <label style={{ fontSize: 10, color: S.muted, display: 'block', marginBottom: 4 }}>الوحدة</label>
                        <select value={edit.unit_id} onChange={e => setPurchaseEdits(p => ({ ...p, [it.id]: { ...edit, unit_id: e.target.value } }))}
                          style={{ background: S.navy3, border: `1px solid ${S.border}`, borderRadius: 8, padding: '6px 8px', fontSize: 12, color: S.white, outline: 'none', cursor: 'pointer' }}>
                          {units.map(u => <option key={u.id} value={u.id}>{u.symbol}</option>)}
                        </select>
                      </div>
                    </div>

                    {/* ✅ جديد: تسجيل كمية متوفرة بالفعل بالمخزون - يقدر أي فرد من فريق الشراء يسجّلها، وتقلل المطلوب شراؤه تلقائيًا */}
                    <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${S.border}` }}>
                      <div style={{ fontSize: 10, color: S.amber, marginBottom: 6 }}>📦 هل جزء من هذا الصنف متوفر بالفعل بالمخزون؟</div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                        <div>
                          <label style={{ fontSize: 10, color: S.muted, display: 'block', marginBottom: 4 }}>الكمية المتوفرة</label>
                          <input type="number" min={0} step="0.01" value={avEdit.qty}
                            onChange={e => setAvailableEdits(p => ({ ...p, [it.id]: { ...avEdit, qty: e.target.value } }))}
                            style={{ width: 80, background: S.navy3, border: `1px solid ${S.amber}60`, borderRadius: 8, padding: '6px 8px', fontSize: 12, color: S.white, outline: 'none' }} />
                        </div>
                        <div>
                          <label style={{ fontSize: 10, color: S.muted, display: 'block', marginBottom: 4 }}>الفرع/المستودع</label>
                          <select value={avEdit.branchId} onChange={e => setAvailableEdits(p => ({ ...p, [it.id]: { ...avEdit, branchId: e.target.value } }))}
                            style={{ background: S.navy3, border: `1px solid ${S.amber}60`, borderRadius: 8, padding: '6px 8px', fontSize: 12, color: S.white, outline: 'none', cursor: 'pointer' }}>
                            <option value="">-- اختر --</option>
                            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                          </select>
                        </div>
                        <button onClick={() => saveAvailableQty(it.id, it.requested_quantity, parseFloat(avEdit.qty) || 0, avEdit.branchId)}
                          style={{ padding: '6px 12px', borderRadius: 8, border: `1px solid ${S.amber}`, background: S.amberB, color: S.amber, cursor: 'pointer', fontSize: 11, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
                          💾 حفظ
                        </button>
                      </div>
                      {(it.available_in_warehouse_qty || 0) > 0 && (
                        <div style={{ fontSize: 10, color: S.green, marginTop: 6 }}>
                          ✅ {it.available_in_warehouse_qty} {it.req_unit?.symbol} متوفرة في {it.available_branch?.name || '—'} — سجّلها: {it.available_recorded_by || '—'}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
              {/* ✅ جديد: حفظ التقدم فقط - من غير ما يقفل الطلب، عشان يقدر يرجع يكمل الشراء من مكان تاني بعدين */}
              <button onClick={savePurchaseProgress} disabled={saving}
                style={{ flex: 1, padding: '12px', borderRadius: 12, border: `1px solid ${S.blue}`, background: S.blueB, color: S.blue, cursor: saving ? 'not-allowed' : 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
                {saving ? '⏳...' : '💾 حفظ التقدم (يبقى الطلب قيد الانتظار)'}
              </button>
              <button onClick={completePurchase} disabled={saving}
                style={{ flex: 1, padding: '12px', borderRadius: 12, border: `1px solid ${S.green}`, background: S.greenB, color: S.green, cursor: saving ? 'not-allowed' : 'pointer', fontSize: 13, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
                {saving ? '⏳...' : '✅ إتمام الشراء نهائيًا'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Requester Detail Modal (يظهر بالضغط على اسم شخص في "الأكثر طلبًا") ── */}
      {selectedRequesterName && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 350, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={() => setSelectedRequesterName(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background: S.navy2, borderRadius: 20, border: `1px solid ${S.border}`, width: '100%', maxWidth: 560, maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 22px', borderBottom: `1px solid ${S.border}` }}>
              <div>
                <h2 style={{ fontSize: 15, fontWeight: 800, color: S.gold }}>👤 {selectedRequesterName}</h2>
                <div style={{ fontSize: 11, color: S.muted, marginTop: 2 }}>{selectedRequesterRequests.length} طلب إجمالًا</div>
              </div>
              <button onClick={() => setSelectedRequesterName(null)} style={{ background: 'transparent', border: 'none', color: S.muted, fontSize: 20, cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ padding: '16px 22px', overflowY: 'auto', flex: 1 }}>
              {requesterPageItems.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 30, color: S.muted }}>لا توجد طلبات</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {requesterPageItems.map(r => {
                    const st = STATUS_CFG[r.status] || STATUS_CFG.pending
                    return (
                      <div key={r.id} style={{ background: S.card, borderRadius: 12, padding: 14 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8, flexWrap: 'wrap', gap: 6 }}>
                          <div>
                            <div style={{ fontSize: 12, fontWeight: 800, color: S.gold }}>#{r.request_number || '—'} — 🏪 {r.branches?.name}</div>
                            <div style={{ fontSize: 11, color: S.muted, marginTop: 2 }}>📅 {fmtMYTime(r.requested_at)}</div>
                          </div>
                          <span style={{ background: st.bg, color: st.color, borderRadius: 20, padding: '3px 10px', fontSize: 10, fontWeight: 700 }}>{st.icon} {st.label}</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                          {(r.market_purchase_request_items || []).map(it => {
                            const hasPurchase = it.purchased_quantity != null
                            const mismatch = hasPurchase && (
                              it.purchased_quantity !== it.requested_quantity ||
                              (!!it.purchased_unit_id && !!it.requested_unit_id && it.purchased_unit_id !== it.requested_unit_id)
                            )
                            return (
                              <div key={it.id} style={{ fontSize: 11, color: S.white }}>
                                • {it.item_name || it.warehouse_products?.name} —
                                {hasPurchase
                                  ? <span> طُلب {it.requested_quantity} {it.req_unit?.symbol} / اشتُري <b style={{ color: mismatch ? S.red : S.blue }}>{it.purchased_quantity} {it.pur_unit?.symbol}</b></span>
                                  : <span> {it.requested_quantity} {it.req_unit?.symbol}</span>}
                                {mismatch && <span style={{ color: S.red, fontWeight: 800 }}> ⚠️</span>}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
            {/* ✅ ترقيم صفحات - يظهر بس لو عدد الطلبات أكبر من حجم الصفحة الواحدة */}
            {requesterTotalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10, padding: '12px 22px', borderTop: `1px solid ${S.border}` }}>
                <button onClick={() => setRequesterPage(p => Math.max(1, p - 1))} disabled={requesterPage === 1}
                  style={{ padding: '7px 14px', borderRadius: 8, border: `1px solid ${S.border}`, background: 'transparent', color: requesterPage === 1 ? S.muted : S.white, cursor: requesterPage === 1 ? 'not-allowed' : 'pointer', fontSize: 12 }}>
                  ‹ السابق
                </button>
                <span style={{ fontSize: 12, color: S.muted }}>صفحة {requesterPage} من {requesterTotalPages}</span>
                <button onClick={() => setRequesterPage(p => Math.min(requesterTotalPages, p + 1))} disabled={requesterPage === requesterTotalPages}
                  style={{ padding: '7px 14px', borderRadius: 8, border: `1px solid ${S.border}`, background: 'transparent', color: requesterPage === requesterTotalPages ? S.muted : S.white, cursor: requesterPage === requesterTotalPages ? 'not-allowed' : 'pointer', fontSize: 12 }}>
                  التالي ›
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Receive Confirmation Modal ── */}
      {receivingReq && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: S.navy2, borderRadius: 20, border: `1px solid ${S.border}`, width: '100%', maxWidth: 420, padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 18 }}>
              <h2 style={{ fontSize: 16, fontWeight: 800 }}>✅ تأكيد الاستلام</h2>
              <button onClick={() => { setReceivingReq(null); setReceiveImgs([]); setReceiveImgPreviews([]); setReceiveEdits({}) }} style={{ background: 'transparent', border: 'none', color: S.muted, fontSize: 20, cursor: 'pointer' }}>✕</button>
            </div>
            {/* ✅ جديد: تعديل الكمية/الوحدة المستلمة فعليًا لكل صنف قبل رفع الصورة - عشان المستلم
                يقدر يصحّح الفرق لو استلم أقل أو أكثر من المطلوب/المشترى، بنفس الوحدة الأساسية أو الفرعية */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16, maxHeight: 260, overflowY: 'auto' }}>
              {(receivingReq.market_purchase_request_items || []).map(it => {
                const edit = receiveEdits[it.id] || { quantity: String(it.purchased_quantity ?? it.requested_quantity), unit_id: it.purchased_unit_id || it.requested_unit_id }
                return (
                  <div key={it.id} style={{ background: S.card, borderRadius: 10, padding: 10 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: S.white, marginBottom: 6 }}>
                      {it.item_name || it.warehouse_products?.name}
                      <span style={{ color: S.muted, fontWeight: 400, fontSize: 10 }}> (طُلب: {it.requested_quantity} {it.req_unit?.symbol})</span>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input type="number" min={0} step="0.01" value={edit.quantity}
                        onChange={e => setReceiveEdits(p => ({ ...p, [it.id]: { ...edit, quantity: e.target.value } }))}
                        style={{ flex: 1, background: S.navy3, border: `1px solid ${S.border}`, borderRadius: 8, padding: '7px 8px', fontSize: 12, color: S.white, outline: 'none' }} />
                      <select value={edit.unit_id} onChange={e => setReceiveEdits(p => ({ ...p, [it.id]: { ...edit, unit_id: e.target.value } }))}
                        style={{ background: S.navy3, border: `1px solid ${S.border}`, borderRadius: 8, padding: '7px 8px', fontSize: 12, color: S.white, outline: 'none', cursor: 'pointer' }}>
                        {units.map(u => <option key={u.id} value={u.id}>{u.symbol}</option>)}
                      </select>
                    </div>
                  </div>
                )
              })}
            </div>
            <label style={{ fontSize: 12, color: S.muted, display: 'block', marginBottom: 8 }}>📷 صور إثبات الاستلام (يمكن اختيار أكثر من صورة) *</label>
            <input type="file" accept="image/*" multiple onChange={e => e.target.files && e.target.files.length > 0 && handleReceiveImgSelect(e.target.files)} style={{ marginBottom: 14, fontSize: 12, color: S.white }} />
            {receiveImgPreviews.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: 8, marginBottom: 14 }}>
                {receiveImgPreviews.map((src, i) => (
                  <div key={i} style={{ position: 'relative' }}>
                    <img src={src} alt={`صورة ${i + 1}`} style={{ width: '100%', height: 90, objectFit: 'cover', borderRadius: 8 }} />
                    <button onClick={() => removeReceiveImg(i)}
                      style={{ position: 'absolute', top: 4, left: 4, width: 20, height: 20, borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.7)', color: S.red, cursor: 'pointer', fontSize: 12, lineHeight: '20px', padding: 0 }}>✕</button>
                  </div>
                ))}
              </div>
            )}
            <button onClick={confirmReceive} disabled={confirming}
              style={{ width: '100%', padding: '12px', borderRadius: 12, border: `1px solid ${S.green}`, background: S.greenB, color: S.green, cursor: confirming ? 'not-allowed' : 'pointer', fontSize: 14, fontFamily: 'Tajawal, sans-serif', fontWeight: 700 }}>
              {confirming ? '⏳ جاري التأكيد...' : '✅ تأكيد الاستلام'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
