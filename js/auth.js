/**
 * js/auth.js
 * 
 * وحدة المصادقة وإدارة الجلسات وصلاحيات المستخدمين
 * - تسجيل الدخول عبر Supabase Auth
 * - جلب دور المستخدم من جدول users
 * - توجيه المستخدم حسب حالة تسجيل الدخول
 * - تعريف صلاحيات كل دور
 */

// ============================================================
// صلاحيات الأدوار — كل دور يرى الوحدات المسموح له بها فقط
// ============================================================
window.ROLE_PERMISSIONS = {
    'admin': [
        'dashboard', 'users', 'products', 'customers', 'suppliers',
        'purchases', 'sales', 'inventory', 'expenses', 'banks',
        'accounting', 'settings', 'help'
    ],
    'accountant': [
        'dashboard', 'products', 'customers', 'suppliers',
        'purchases', 'sales', 'expenses', 'banks', 'accounting', 'help'
    ],
    'sales': [
        'dashboard', 'products', 'customers', 'sales', 'inventory', 'help'
    ],
    'warehouse': [
        'dashboard', 'products', 'inventory', 'help'
    ],
};

// أسماء الأدوار بالعربية للعرض
window.ROLE_LABELS = {
    'admin':      'مدير النظام',
    'accountant': 'محاسب',
    'sales':      'مندوب مبيعات',
    'warehouse':  'أمين مخزن',
};

// ============================================================
// تسجيل الدخول — يُستدعى من login.html
// ============================================================
window.loginUser = async function(email, password) {
    if (!window.supabaseClient) {
        throw new Error('عميل Supabase غير مُهيَّأ.');
    }

    // 1. المصادقة عبر Supabase Auth
    const { data: authData, error: authError } = await window.supabaseClient.auth.signInWithPassword({
        email,
        password,
    });

    if (authError) throw authError;

    // 2. جلب بيانات المستخدم (الدور) من جدول users
    await window.fetchAndCacheUserProfile(authData.user);

    // 3. التحقق من أن الحساب نشط
    const profile = window.currentUser;
    if (profile && profile.status === 'inactive') {
        await window.supabaseClient.auth.signOut();
        window.currentUser = null;
        throw new Error('حساب غير نشط. تواصل مع المدير.');
    }

    // 4. توجيه إلى الصفحة الرئيسية
    window.location.replace('index.html');
};

// ============================================================
// جلب بيانات المستخدم من جدول users وتخزينها
// ============================================================
window.fetchAndCacheUserProfile = async function(authUser) {
    if (!authUser) { window.currentUser = null; return; }

    try {
        // البحث في جدول users بواسطة البريد الإلكتروني
        const { data, error } = await window.supabaseClient
            .from('users')
            .select('id, doc_data')
            .filter('doc_data->>email', 'eq', authUser.email)
            .maybeSingle();

        if (!error && data) {
            window.currentUser = {
                id:       data.id,
                authId:   authUser.id,
                email:    authUser.email,
                name:     data.doc_data.name  || authUser.email,
                role:     data.doc_data.role  || 'sales',
                status:   data.doc_data.status || 'active',
                phone:    data.doc_data.phone  || '',
            };
        } else {
            // لم يُعثر على ملف المستخدم — منح دور افتراضي
            window.currentUser = {
                id:     null,
                authId: authUser.id,
                email:  authUser.email,
                name:   authUser.email,
                role:   'sales',
                status: 'active',
                phone:  '',
            };
        }
    } catch (e) {
        console.warn('تحذير: تعذّر جلب ملف المستخدم:', e);
        window.currentUser = {
            id:     null,
            authId: authUser.id,
            email:  authUser.email,
            name:   authUser.email,
            role:   'sales',
            status: 'active',
            phone:  '',
        };
    }
};

// ============================================================
// تسجيل الخروج
// ============================================================
window.logoutUser = async function() {
    if (window.supabaseClient) {
        await window.supabaseClient.auth.signOut();
    }
    window.currentUser = null;
    window.location.replace('login.html');
};

// ============================================================
// حارس المصادقة — للاستخدام في index.html
// ============================================================
window.requireAuth = async function() {
    if (!window.supabaseClient) return;

    const { data: { session } } = await window.supabaseClient.auth.getSession();

    if (!session) {
        window.location.replace('login.html');
        return false;
    }

    await window.fetchAndCacheUserProfile(session.user);

    // التحقق من حالة الحساب
    if (window.currentUser && window.currentUser.status === 'inactive') {
        await window.supabaseClient.auth.signOut();
        window.location.replace('login.html');
        return false;
    }

    return true;
};

// ============================================================
// التحقق من صلاحية الوصول لوحدة معينة
// ============================================================
window.canAccessModule = function(moduleId) {
    const user = window.currentUser;
    if (!user) return false;
    const allowed = window.ROLE_PERMISSIONS[user.role] || [];
    return allowed.includes(moduleId);
};
