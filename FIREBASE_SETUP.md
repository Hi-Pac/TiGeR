# Firebase Rules Setup للمشروع TiGeR

## الخطوة 1: تفعيل Anonymous Authentication
1. اذهب إلى Firebase Console
2. اختر **Authentication** من القائمة الجانبية
3. اختر **Sign-in method**
4. فعّل **Anonymous**

## الخطوة 2: تعديل Firestore Security Rules
1. اذهب إلى **Firestore Database**
2. اختر **Rules** tab
3. استبدل القوانس الافتراضية بـ:

```firestore
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    // Allow read/write for authenticated users (including anonymous)
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

4. انقر **Publish**

## الخطوة 3: تحقق من الإعدادات
- يجب أن ترى "Develop & Test" وضع في Firebase بدلاً من "Production"
- تأكد أن Anonymous Authentication مفعل

## النتيجة
بعد هذه الخطوات:
✅ سيتمكن التطبيق من الوصول إلى Firestore
✅ ستعمل جميع عمليات CRUD (Create, Read, Update, Delete)
✅ ستعمل جميع الأزرار بشكل صحيح

---

## ملاحظة أمان مهمة:
هذه القوانين آمنة فقط للتطوير والاختبار. 
للإنتاج، يجب تغييرها إلى قوانس أكثر تقيداً تتحقق من هوية المستخدم الفعلية.
