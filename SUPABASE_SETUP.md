# 🚀 دليل إعداد Supabase لنظام TiGeR ERP

> ⚠️ **المصدر الصحيح الحالي لقاعدة البيانات**
>
> 1. شغّل الملف الكامل: `supabase/schema.sql`
> 2. ثم شغّل ملف التحديث: `supabase/migrations/20260507_phase2_auth.sql`
>
> لا تستخدم أي سكريبت قديم مبني على `users` أو `doc_data` لأن التطبيق الحالي يعتمد على
> `public.profiles` المرتبط مباشرةً بـ `auth.users`.

---

## 1) إنشاء مشروع Supabase

1. افتح [https://app.supabase.com](https://app.supabase.com)
2. أنشئ مشروعاً جديداً
3. انتظر حتى يكتمل تجهيز قاعدة البيانات

---

## 2) نسخ بيانات الاتصال

من **Settings → API** انسخ:

- **Project URL**
- **anon / public key**

ثم حدّث الملف:

`/home/runner/work/TiGeR/TiGeR/js/supabase-client.js`

واستبدل:

```js
const SUPABASE_URL = 'YOUR_SUPABASE_URL';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';
```

بالقيم الفعلية لمشروعك.

> لا تضع `service_role` في الواجهة الأمامية.

---

## 3) إنشاء الجداول والدوال والسياسات

من **SQL Editor** في Supabase:

1. انسخ كامل محتوى الملف `supabase/schema.sql`
2. شغّله مرة واحدة
3. بعد نجاحه، انسخ كامل محتوى الملف `supabase/migrations/20260507_phase2_auth.sql`
4. شغّله مرة واحدة

### ماذا يضيف كل ملف؟

- `supabase/schema.sql`
  - الجداول الأساسية
  - الفهارس والقيود
  - RLS policies
  - دوال المساعدة
- `supabase/migrations/20260507_phase2_auth.sql`
  - `fn_my_status()`
  - `bootstrap_first_admin_profile()`
  - قالب SQL احتياطي للإعداد اليدوي لأول مدير

---

## 4) تفعيل تسجيل الدخول

من **Authentication → Providers**:

- فعّل **Email**

ثم من **Authentication → Users**:

- أنشئ أول مستخدم (البريد وكلمة المرور)

---

## 5) أول دخول للنظام

بعد تشغيل التطبيق وتسجيل الدخول بأول مستخدم:

- إذا لم يكن هناك أي سجل داخل `public.profiles`
- سيقوم التطبيق تلقائياً باستدعاء:

```sql
public.bootstrap_first_admin_profile()
```

وسيتم:

- إنشاء أول شركة تلقائياً إذا لم تكن موجودة
- أو إعادة استخدام الشركة الوحيدة الموجودة إذا كانت مُنشأة مسبقاً
- إنشاء ملف المستخدم الأول داخل `public.profiles`
- تعيينه كـ `admin`

### متى لا يعمل الإنشاء التلقائي؟

لن يعمل إذا:

- لم يتم تشغيل `schema.sql`
- لم يتم تشغيل `20260507_phase2_auth.sql`
- يوجد بالفعل مستخدمون داخل `public.profiles`
- توجد أكثر من شركة داخل `public.companies` بدون أي Profiles

في هذه الحالات استخدم القالب اليدوي الموجود داخل:

`supabase/migrations/20260507_phase2_auth.sql`

---

## 6) تشغيل التطبيق محلياً

من جذر المشروع:

```bash
python -m http.server 8000
```

ثم افتح:

```text
http://localhost:8000
```

---

## 7) التحقق السريع بعد الإعداد

بعد أول تسجيل دخول ناجح يمكنك التأكد من البيانات من Supabase SQL Editor:

```sql
SELECT id, name, status FROM public.companies;
SELECT id, full_name, role, status, company_id FROM public.profiles;
SELECT public.fn_my_company_id();
SELECT public.fn_my_role();
SELECT public.fn_my_status();
```

المفترض أن يكون أول مستخدم:

- موجوداً في `public.profiles`
- دوره `admin`
- حالته `active`

---

## 8) ملاحظات مهمة

- هذا النظام يستخدم **RLS** بشكل فعلي، فلا تعطّلها في الإنتاج.
- لا تنشئ سياسات عامة مثل `USING (true)`.
- إضافة المستخدمين بعد المدير الأول تتم من:
  - **Supabase Authentication** لإنشاء حساب الدخول
  - ثم **إدارة المستخدمين** داخل التطبيق لإضافة Profile باستخدام `Auth UID`

---

## 9) حل المشكلة الظاهرة في شاشة الدخول

إذا ظهرت الرسالة:

> لم يتم العثور على ملف تعريف المستخدم

فهذا يعني غالباً أحد أمرين:

1. لم يتم تشغيل ملفات SQL الجديدة
2. أو أن الحساب ليس له صف داخل `public.profiles`

ابدأ دائماً بتشغيل:

1. `supabase/schema.sql`
2. `supabase/migrations/20260507_phase2_auth.sql`

ثم أعد تسجيل الدخول بأول مستخدم.
