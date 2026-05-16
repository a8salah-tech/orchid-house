import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { base64Image, products } = await req.json()

    if (!base64Image) {
      return NextResponse.json({ error: 'لم يتم إرسال صورة' }, { status: 400 })
    }

    const productList = (products || [])
      .map((p: any) => `${p.name}${p.name_en ? ` (${p.name_en})` : ''}`)
      .join(', ')

    const imageData = base64Image.includes(',') ? base64Image.split(',')[1] : base64Image

    const prompt = `أنت نظام استخراج بيانات الفواتير. استخرج من هذه الفاتورة:
1. اسم المورد/الشركة
2. رقم الفاتورة
3. تاريخ الفاتورة (بصيغة YYYY-MM-DD)
4. قائمة الأصناف مع الكمية والسعر

قائمة المنتجات الموجودة في النظام للمطابقة:
${productList}

أعد الرد بـ JSON فقط بهذا الشكل بدون أي نص إضافي:
{
  "supplier_name": "اسم المورد",
  "invoice_number": "رقم الفاتورة",
  "invoice_date": "YYYY-MM-DD",
  "items": [{"name": "اسم الصنف", "quantity": 0, "unit_price": 0}],
  "notes": "أي ملاحظات"
}`

    const response = await fetch(
`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              {
                inline_data: {
                  mime_type: 'image/jpeg',
                  data: imageData,
                }
              },
              { text: prompt }
            ]
          }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 1500,
          }
        })
      }
    )

    if (!response.ok) {
      const err = await response.json()
      return NextResponse.json({ error: 'خطأ من Gemini API: ' + (err.error?.message || response.status) }, { status: 500 })
    }

    const data = await response.json()
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}'
    const clean = text.replace(/```json|```/g, '').trim()

    try {
      const result = JSON.parse(clean)
      return NextResponse.json({ success: true, data: result })
    } catch {
      return NextResponse.json({ error: 'فشل تحليل الرد', raw: text }, { status: 500 })
    }

  } catch (e: any) {
    return NextResponse.json({ error: 'خطأ في الخادم: ' + e.message }, { status: 500 })
  }
}
