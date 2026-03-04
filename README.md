# TiGeR ERP System

نظام إدارة الموارد المتكامل (ERP) لشركة النمر للتجارة والتوزيع

## 🚀 الميزات

- إدارة المستخدمين والأدوار
- إدارة الأصناف والمنتجات
- إدارة العملاء والموردين
- إدارة المشتريات والمبيعات
- إدارة المخازن والمخزون
- إدارة المصروفات والبنوك
- إدارة الحسابات والتقارير
- واجهة مظلمة/مضيئة
- دعم اللغة العربية كاملاً

## 🔧 التقنيات المستخدمة

- **Frontend:**
  - HTML5, CSS3, Tailwind CSS
  - JavaScript (Vanilla)
  - Font Awesome Icons
  
- **Backend:**
  - [Supabase](https://supabase.com) (PostgreSQL + REST API)
  - Supabase Auth (المصادقة)
  - Supabase Storage (تخزين الملفات)

## 📦 التثبيت

1. استنساخ المستودع:
```bash
git clone https://github.com/Hi-Pac/TiGeR.git
cd TiGeR
```

2. إعداد Supabase:
   - راجع ملف [SUPABASE_SETUP.md](./SUPABASE_SETUP.md) للتعليمات التفصيلية
   - أنشئ مشروعاً على [https://app.supabase.com](https://app.supabase.com)
   - نفِّذ SQL scripts الموجودة في `SUPABASE_SETUP.md` لإنشاء الجداول
   - ضع `SUPABASE_URL` و `SUPABASE_ANON_KEY` في `js/supabase-client.js`

3. تشغيل التطبيق:
```bash
# باستخدام Python 3
python -m http.server 8000

# ثم افتح المتصفح على
http://localhost:8000
```

## 📖 البنية

```
TiGeR/
├── index.html           # الصفحة الرئيسية
├── style.css            # الأنماط المخصصة
├── SUPABASE_SETUP.md    # دليل إعداد Supabase + SQL schemas
├── js/                  # ملفات JavaScript
│   ├── supabase-client.js  # Supabase client + Firestore compatibility wrapper
│   ├── main.js          # ملف التحكم الرئيسي
│   ├── dashboard.js     # لوحة التحكم
│   ├── users.js         # إدارة المستخدمين
│   ├── products.js      # إدارة الأصناف
│   └── ...              # ملفات أخرى
└── modules/             # ملفات HTML للوحدات
    ├── dashboard.html
    ├── users.html
    ├── products.html
    └── ...
```

## 🔐 الأمان

- المصادقة: Supabase Auth
- حماية البيانات: Row Level Security (RLS) في PostgreSQL
- لا تضع بيانات اعتماد Supabase في المستودع العام

## 📝 الترخيص

جميع الحقوق محفوظة لشركة النمر للتجارة والتوزيع

## 👨‍💻 المساهمون

- فريق التطوير - شركة النمر

---

**تم آخر تحديث:** مارس 2026
