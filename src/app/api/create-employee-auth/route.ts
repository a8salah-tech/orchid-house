import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function POST(req: NextRequest) {
  try {
    const { employee_id, email, password } = await req.json()

    if (!employee_id || !email || !password) {
      return NextResponse.json({ error: 'بيانات ناقصة' }, { status: 400 })
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' }, { status: 400 })
    }

    let userId: string

    // حاول إنشاء حساب جديد
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })

    if (authError) {
      if (authError.message.includes('already registered')) {
        // الإيميل موجود — ابحث عنه وربطه
        const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers()
        if (listError) return NextResponse.json({ error: 'خطأ في البحث عن المستخدم' }, { status: 500 })

        const existingUser = users.find(u => u.email === email)
        if (!existingUser) return NextResponse.json({ error: 'لم يتم العثور على المستخدم' }, { status: 400 })

        userId = existingUser.id

        // حدّث كلمة المرور لو المطلوب
        await supabaseAdmin.auth.admin.updateUserById(userId, { password })
      } else {
        return NextResponse.json({ error: authError.message }, { status: 400 })
      }
    } else {
      userId = authData.user.id
    }

    // ربط الحساب بالموظف
    const { error: updateError } = await supabaseAdmin
      .from('employees')
      .update({ auth_user_id: userId, email_account: email })
      .eq('id', employee_id)

    if (updateError) {
      return NextResponse.json({ error: 'فشل ربط الحساب بالموظف' }, { status: 500 })
    }

    return NextResponse.json({ success: true, user_id: userId })

  } catch (e) {
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status: 500 })
  }
}

// تغيير كلمة المرور
export async function PATCH(req: NextRequest) {
  try {
    const { auth_user_id, new_password } = await req.json()

    if (!auth_user_id || !new_password) {
      return NextResponse.json({ error: 'بيانات ناقصة' }, { status: 400 })
    }

    if (new_password.length < 6) {
      return NextResponse.json({ error: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' }, { status: 400 })
    }

    const { error } = await supabaseAdmin.auth.admin.updateUserById(auth_user_id, {
      password: new_password
    })

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    return NextResponse.json({ success: true })

  } catch (e) {
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status: 500 })
  }
}

// حذف حساب موظف
export async function DELETE(req: NextRequest) {
  try {
    const { auth_user_id } = await req.json()
    if (!auth_user_id) return NextResponse.json({ error: 'بيانات ناقصة' }, { status: 400 })

    const { error } = await supabaseAdmin.auth.admin.deleteUser(auth_user_id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    return NextResponse.json({ success: true })

  } catch (e) {
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status: 500 })
  }
}
