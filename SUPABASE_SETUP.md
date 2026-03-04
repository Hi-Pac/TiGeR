# 🚀 دليل إعداد Supabase لنظام TiGeR ERP

## المتطلبات
- حساب على [Supabase](https://supabase.com) (مجاني)

---

## الخطوة 1 — إنشاء مشروع Supabase جديد

1. انتقل إلى [https://app.supabase.com](https://app.supabase.com)
2. اضغط **New Project**
3. أدخل اسم المشروع (مثلاً: `tiger-erp`) وكلمة مرور قاعدة البيانات واختر منطقة قريبة منك
4. انتظر حتى يُنشأ المشروع (دقيقة أو اثنتان)

---

## الخطوة 2 — جلب بيانات الاعتماد (Credentials)

1. من لوحة التحكم اذهب إلى **Settings → API**
2. انسخ:
   - **Project URL** (مثل: `https://xxxx.supabase.co`)
   - **anon / public key**

---

## الخطوة 3 — ضبط الإعدادات في الكود

افتح الملف `js/supabase-client.js` واستبدل السطرين التاليين:

```js
const SUPABASE_URL = 'YOUR_SUPABASE_URL';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';
```

بقيم مشروعك الفعلية، مثلاً:

```js
const SUPABASE_URL = 'https://xxxx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
```

---

## الخطوة 4 — إنشاء الجداول في قاعدة البيانات

انتقل إلى **SQL Editor** في لوحة تحكم Supabase وقم بتنفيذ الكود التالي كاملاً:

```sql
-- ============================================================
-- TiGeR ERP — Database Schema
-- ============================================================

-- دالة مساعدة لتحديث حقل updated_at تلقائياً
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- جدول المستخدمين
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  doc_data   JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TRIGGER users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- جدول الأصناف / المنتجات
-- ============================================================
CREATE TABLE IF NOT EXISTS products (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  doc_data   JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TRIGGER products_updated_at BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- جدول العملاء
-- ============================================================
CREATE TABLE IF NOT EXISTS customers (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  doc_data   JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TRIGGER customers_updated_at BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- جدول الموردين
-- ============================================================
CREATE TABLE IF NOT EXISTS suppliers (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  doc_data   JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TRIGGER suppliers_updated_at BEFORE UPDATE ON suppliers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- جدول المشتريات
-- ============================================================
CREATE TABLE IF NOT EXISTS purchases (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  doc_data   JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TRIGGER purchases_updated_at BEFORE UPDATE ON purchases
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- جدول المبيعات
-- ============================================================
CREATE TABLE IF NOT EXISTS sales (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  doc_data   JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TRIGGER sales_updated_at BEFORE UPDATE ON sales
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- جدول أرصدة المخزون
-- ============================================================
CREATE TABLE IF NOT EXISTS inventory_stock (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  doc_data   JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TRIGGER inventory_stock_updated_at BEFORE UPDATE ON inventory_stock
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- جدول حركات المخزون (وارد / تحويل)
-- ============================================================
CREATE TABLE IF NOT EXISTS inventory_transactions (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  doc_data   JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TRIGGER inventory_transactions_updated_at BEFORE UPDATE ON inventory_transactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- جدول المصروفات
-- ============================================================
CREATE TABLE IF NOT EXISTS expenses (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  doc_data   JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TRIGGER expenses_updated_at BEFORE UPDATE ON expenses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- جدول الحسابات البنكية والخزائن
-- ============================================================
CREATE TABLE IF NOT EXISTS bank_accounts (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  doc_data   JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TRIGGER bank_accounts_updated_at BEFORE UPDATE ON bank_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- جدول المعاملات البنكية
-- ============================================================
CREATE TABLE IF NOT EXISTS bank_transactions (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  doc_data   JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TRIGGER bank_transactions_updated_at BEFORE UPDATE ON bank_transactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- جدول إعدادات النظام
-- ============================================================
CREATE TABLE IF NOT EXISTS app_settings (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  doc_data   JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TRIGGER app_settings_updated_at BEFORE UPDATE ON app_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

---

## الخطوة 5 — إعداد Row Level Security (RLS) — اختياري للبداية

بشكل افتراضي تكون RLS مُفعَّلة في Supabase وتمنع القراءة/الكتابة.  
للبدء السريع بدون authentication، يمكنك تعطيلها مؤقتاً عبر SQL:

```sql
-- تعطيل مؤقت لـ RLS على جميع الجداول (للتطوير فقط)
ALTER TABLE users               DISABLE ROW LEVEL SECURITY;
ALTER TABLE products            DISABLE ROW LEVEL SECURITY;
ALTER TABLE customers           DISABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers           DISABLE ROW LEVEL SECURITY;
ALTER TABLE purchases           DISABLE ROW LEVEL SECURITY;
ALTER TABLE sales               DISABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_stock     DISABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_transactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE expenses            DISABLE ROW LEVEL SECURITY;
ALTER TABLE bank_accounts       DISABLE ROW LEVEL SECURITY;
ALTER TABLE bank_transactions   DISABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings        DISABLE ROW LEVEL SECURITY;
```

> ⚠️ **تحذير:** لا تُبقِ RLS معطَّلاً في بيئة الإنتاج.  
> عند الجاهزية، فعِّل المصادقة وأضف سياسات RLS مناسبة.

---

## الخطوة 6 — تشغيل التطبيق

```bash
# باستخدام Python 3
python -m http.server 8000

# ثم افتح المتصفح على
http://localhost:8000
```

---

## 🗄️ ملاحظات تقنية

### بنية التخزين
كل جدول يحتوي على:
| العمود | النوع | الوصف |
|--------|-------|--------|
| `id` | UUID | مفتاح أساسي تلقائي |
| `doc_data` | JSONB | بيانات السجل (بنية مرنة) |
| `created_at` | TIMESTAMPTZ | تاريخ الإنشاء |
| `updated_at` | TIMESTAMPTZ | تاريخ آخر تعديل |

### استعلام البيانات من Supabase Studio
```sql
-- مثال: استعراض بيانات المنتجات
SELECT id, doc_data->>'name' AS name, doc_data->>'salePrice' AS sale_price
FROM products;

-- مثال: فلترة العملاء النشطين
SELECT id, doc_data->>'shopName' AS shop_name
FROM customers
WHERE doc_data->>'status' = 'active';
```

### طبقة التوافق مع Firestore API
ملف `js/supabase-client.js` يوفر نفس واجهة Firestore:
```js
// قراءة
const snapshot = await db.collection('products').get();
const products = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

// إضافة
await db.collection('products').add({ name: 'منتج جديد', ... });

// تعديل
await db.collection('products').doc(id).update({ name: 'اسم جديد' });

// حذف
await db.collection('products').doc(id).delete();
```

---

## 🔐 المرحلة القادمة: المصادقة (Authentication)

لإضافة نظام تسجيل الدخول الحقيقي:
1. فعِّل **Email Auth** من **Authentication → Providers** في Supabase
2. استخدم `window.supabaseClient.auth.signInWithPassword({ email, password })`
3. أضف RLS policies لتقييد الوصول حسب المستخدم

---

**آخر تحديث:** مارس 2026
