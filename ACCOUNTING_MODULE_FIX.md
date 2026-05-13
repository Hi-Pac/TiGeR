# إصلاح وحدة المحاسبة - Accounting Module Fix

**التاريخ:** 2026-05-11
**الحالة:** ✅ مكتمل

---

## المشكلة الأصلية

كانت وحدة المحاسبة تعمل ببيانات وهمية (Hardcoded Test Data) بدلاً من قاعدة البيانات الفعلية:

### الكود القديم (قبل الإصلاح):

```javascript
// في loadAndRenderChartOfAccounts()
chartOfAccountsData = [
    { id: 'acc1', code: '1101', name: 'النقدية بالصندوق', ... },
    { id: 'acc2', code: '1201', name: 'حساب البنك الأهلي', ... },
    // ... بيانات وهمية أخرى
];
```

```javascript
// في حفظ الحساب
alert("حفظ الحساب (محاكاة)");
```

```javascript
// في حفظ القيد
alert("حفظ القيد (محاكاة)");
```

---

## الإصلاحات المنفذة

### 1️⃣ تحميل دليل الحسابات من قاعدة البيانات

**الملف:** `js/accounting.js` (السطور 84-119)

**التعديل:**
- استبدال البيانات الوهمية بـ Supabase Query
- تحميل من جدول `chart_of_accounts`
- تصفية حسب `company_id` و `status = 'active'`
- الترتيب حسب `code`
- تحويل الحقول من قاعدة البيانات إلى الصيغة المطلوبة في الواجهة

**الكود الجديد:**
```javascript
const { data, error } = await window.DB.from('chart_of_accounts')
    .select('*')
    .eq('company_id', window.currentUser?.company_id)
    .eq('status', 'active')
    .order('code', { ascending: true });

chartOfAccountsData = (data || []).map(acc => ({
    id: acc.id,
    code: acc.code,
    name: acc.name_ar || acc.name,
    mainType: acc.account_type,
    nature: acc.account_nature,
    currentBalance: parseFloat(acc.current_balance || 0),
    openingBalance: parseFloat(acc.opening_balance || 0),
    notes: acc.notes
}));
```

---

### 2️⃣ حفظ الحسابات في قاعدة البيانات

**الملف:** `js/accounting.js` (السطور 156-230)

**التعديل:**
- إزالة الـ `alert("حفظ الحساب (محاكاة)")`
- إضافة منطق الحفظ الفعلي
- التحقق من المدخلات (Validation)
- دعم الإضافة (INSERT) والتعديل (UPDATE)
- معالجة الأخطاء بشكل صحيح

**المميزات المضافة:**
- ✅ التحقق من الحقول المطلوبة
- ✅ تعطيل زر الحفظ أثناء العملية
- ✅ معالجة الأخطاء وعرض رسائل واضحة
- ✅ إعادة تحميل البيانات بعد الحفظ
- ✅ دعم التعديل والإضافة

**الكود الجديد:**
```javascript
const accountData = {
    company_id: window.currentUser?.company_id,
    code: code,
    name: name,
    name_ar: name,
    account_type: mainType,
    account_nature: nature,
    opening_balance: openingBalance,
    current_balance: accountId ? undefined : openingBalance,
    notes: notes,
    status: 'active'
};

if (accountId) {
    // Update
    const { data, error } = await window.DB.from('chart_of_accounts')
        .update(accountData)
        .eq('id', accountId)
        .select();
} else {
    // Insert
    const { data, error } = await window.DB.from('chart_of_accounts')
        .insert([accountData])
        .select();
}
```

---

### 3️⃣ تحميل القيود اليومية من قاعدة البيانات

**الملف:** `js/accounting.js` (السطور 304-338)

**التعديل:**
- استبدال البيانات الوهمية بـ Supabase Query
- تحميل من جدول `journal_entries`
- الترتيب حسب التاريخ ورقم القيد (الأحدث أولاً)

**الكود الجديد:**
```javascript
const { data, error } = await window.DB.from('journal_entries')
    .select('*')
    .eq('company_id', window.currentUser?.company_id)
    .order('entry_date', { ascending: false })
    .order('entry_number', { ascending: false });

journalEntriesData = (data || []).map(entry => ({
    id: entry.id,
    entryNumber: entry.entry_number,
    date: entry.entry_date,
    description: entry.description,
    totalDebit: parseFloat(entry.total_debit || 0),
    totalCredit: parseFloat(entry.total_credit || 0),
    status: entry.status
}));
```

---

### 4️⃣ حفظ القيود اليومية مع البنود

**الملف:** `js/accounting.js` (السطور 364-496)

**التعديل:**
- إزالة الـ `alert("حفظ القيد (محاكاة)")`
- إضافة منطق الحفظ الفعلي للقيد والبنود
- توليد رقم القيد تلقائياً بصيغة `JE-YYYYMMDD-XXX`
- حفظ القيد الرئيسي في جدول `journal_entries`
- حفظ البنود في جدول `journal_entry_lines`
- التحقق من توازن المدين والدائن

**المميزات المضافة:**
- ✅ توليد رقم القيد تلقائياً
- ✅ التحقق من توازن القيد (مدين = دائن)
- ✅ التحقق من وجود بنود
- ✅ حفظ القيد والبنود في معاملة واحدة (Transaction-like)
- ✅ في حالة فشل حفظ البنود، يتم حذف القيد الرئيسي
- ✅ معالجة الأخطاء الشاملة

**الكود الجديد:**
```javascript
// توليد رقم القيد تلقائياً
const dateStr = entryDate.replace(/-/g, '');
const { data: lastEntry } = await window.DB.from('journal_entries')
    .select('entry_number')
    .eq('company_id', window.currentUser?.company_id)
    .like('entry_number', `JE-${dateStr}%`)
    .order('entry_number', { ascending: false })
    .limit(1);

let sequence = 1;
if (lastEntry && lastEntry.length > 0) {
    const lastNum = lastEntry[0].entry_number.split('-').pop();
    sequence = parseInt(lastNum) + 1;
}
entryNumber = `JE-${dateStr}-${sequence.toString().padStart(3, '0')}`;

// حفظ القيد
const { data: journalEntry, error: journalError } = await window.DB
    .from('journal_entries')
    .insert([journalData])
    .select()
    .single();

// حفظ البنود
const { error: linesError } = await window.DB
    .from('journal_entry_lines')
    .insert(linesWithEntryId);
```

---

### 5️⃣ عرض رقم القيد بدلاً من الـ ID

**الملف:** `js/accounting.js` (السطر 351)

**التعديل:**
```javascript
// قديم
<td>${entry.id}</td>

// جديد
<td>${entry.entryNumber || entry.id}</td>
```

---

## الجداول المستخدمة من قاعدة البيانات

### 📊 `chart_of_accounts`
```sql
- id (UUID)
- company_id (UUID)
- code (TEXT)
- name (TEXT)
- name_ar (TEXT)
- account_type (TEXT: assets, liabilities, equity, revenue, expenses)
- account_nature (TEXT: debit, credit)
- opening_balance (NUMERIC)
- current_balance (NUMERIC)
- notes (TEXT)
- status (TEXT: active, inactive)
```

### 📊 `journal_entries`
```sql
- id (UUID)
- company_id (UUID)
- branch_id (UUID)
- entry_number (TEXT) - يتم توليده تلقائياً
- entry_date (DATE)
- description (TEXT)
- total_debit (NUMERIC)
- total_credit (NUMERIC)
- status (TEXT: draft, posted, reversed)
- created_by (UUID)
```

### 📊 `journal_entry_lines`
```sql
- id (UUID)
- journal_entry_id (UUID) - FK to journal_entries
- account_id (UUID) - FK to chart_of_accounts
- description (TEXT)
- debit_amount (NUMERIC)
- credit_amount (NUMERIC)
```

---

## التحققات والقواعد (Validation)

### ✅ دليل الحسابات:
- كود الحساب مطلوب
- اسم الحساب مطلوب
- النوع الرئيسي مطلوب
- الطبيعة (مدين/دائن) مطلوبة

### ✅ القيود اليومية:
- التاريخ مطلوب
- البيان مطلوب
- يجب أن يحتوي القيد على بنود
- يجب أن يكون القيد متوازناً (إجمالي المدين = إجمالي الدائن)
- كل بند يجب أن يحتوي على حساب
- كل بند يجب أن يحتوي على قيمة في المدين أو الدائن (وليس الاثنين معاً)

---

## معالجة الأخطاء

### 🛡️ الأخطاء المعالجة:

1. **أخطاء قاعدة البيانات**
   - عرض رسالة خطأ واضحة
   - تسجيل الخطأ في console
   - عدم فقدان بيانات المستخدم

2. **أخطاء التحقق من المدخلات**
   - رسائل تنبيه واضحة بالعربية
   - منع الحفظ حتى يتم التصحيح

3. **أخطاء الشبكة**
   - عرض رسالة خطأ
   - إمكانية إعادة المحاولة

---

## الحالة الحالية

✅ **مكتمل:**
- تحميل دليل الحسابات من قاعدة البيانات
- إضافة حسابات جديدة
- تعديل الحسابات الموجودة
- تحميل القيود اليومية
- إضافة قيود جديدة مع البنود
- التحقق من صحة البيانات
- معالجة الأخطاء

❌ **غير مدعوم حالياً:**
- تعديل القيود اليومية الموجودة (يتطلب حذف وإعادة إنشاء)
- حذف الحسابات (يمكن إضافته لاحقاً)
- حذف القيود (يمكن إضافته لاحقاً)
- ترحيل القيد (تحويل من draft إلى posted)

---

## خطوات الاختبار

1. **اختبار دليل الحسابات:**
   ```
   1. افتح وحدة المحاسبة
   2. اذهب إلى تبويب "شجرة الحسابات"
   3. اضغط "إضافة حساب جديد"
   4. املأ البيانات وحفظ
   5. تحقق من ظهور الحساب في الجدول
   ```

2. **اختبار القيود اليومية:**
   ```
   1. اذهب إلى تبويب "دفتر اليومية"
   2. اضغط "إضافة قيد يومية جديد"
   3. املأ التاريخ والبيان
   4. أضف بنود القيد (حساب مدين وحساب دائن)
   5. تأكد من توازن القيد
   6. حفظ وتحقق من ظهور القيد
   ```

---

## ملاحظات مهمة

⚠️ **يجب تشغيل migrations قبل الاختبار:**
```bash
# في Supabase SQL Editor
1. قم بتشغيل: supabase/schema.sql
2. أو تشغيل: supabase/migrations/20260511_align_schema_with_app.sql
```

⚠️ **التأكد من وجود المستخدم والشركة:**
- يجب أن يكون `window.currentUser` موجوداً
- يجب أن يحتوي على `company_id`

---

## الملفات المعدلة

- ✏️ `js/accounting.js` - التعديلات الرئيسية (260 سطر معدل)

---

## المرجع

- [SYSTEM_REVIEW_AND_IMPROVEMENTS.md](./SYSTEM_REVIEW_AND_IMPROVEMENTS.md) - التقرير الشامل لمراجعة النظام
- [supabase/schema.sql](./supabase/schema.sql) - هيكل قاعدة البيانات

---

**تم بواسطة:** Claude Code Agent
**التاريخ:** 2026-05-11
