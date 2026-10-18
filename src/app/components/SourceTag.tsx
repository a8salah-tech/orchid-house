// علامة من أضاف الصنف: حرفان قبل اسم الصنف
//   QR = العميل من رمز الـQR · CA = الكاشير · AC = مساعد الكاشير · ST = موظف آخر (مشرف/مدير…)
// الأصناف القديمة (قبل إضافة العمود source) لا علامة لها
const MAP: Record<string, { label: string; title: string; bg: string; color: string }> = {
  qr:                { label: 'QR', title: 'Customer (QR) — العميل من الـQR', bg: 'rgba(34,197,94,0.18)',  color: '#22C55E' },
  cashier:           { label: 'CA', title: 'Cashier — الكاشير',               bg: 'rgba(59,130,246,0.18)', color: '#60A5FA' },
  assistant_cashier: { label: 'AC', title: 'Assistant cashier — مساعد الكاشير', bg: 'rgba(139,92,246,0.20)', color: '#A78BFA' },
  staff:             { label: 'ST', title: 'Staff — موظف',                    bg: 'rgba(245,158,11,0.18)', color: '#F59E0B' },
}

export default function SourceTag({ source }: { source?: string | null }) {
  const m = MAP[source || '']
  if (!m) return null
  return (
    <span title={m.title} style={{ display: 'inline-block', fontSize: 9, fontWeight: 900, letterSpacing: 0.4, padding: '1px 5px', borderRadius: 5, marginInlineEnd: 6, background: m.bg, color: m.color, verticalAlign: 'middle', lineHeight: 1.4 }}>
      {m.label}
    </span>
  )
}
