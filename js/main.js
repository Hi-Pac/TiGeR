// js/main.js

// --- تعريف متغيرات DOM التي ستحتاجها الدوال العامة (سيتم تهيئتها في DOMContentLoaded) ---
let contentArea;
let pageTitleElement;
let allModuleButtonsForActiveState; // سيتم استخدامها في setActiveSidebarButton

// --- تعريف الدوال العامة التي تحتاجها الوحدات أو HTML ---

/**
 * تحميل وعرض وحدة HTML وتشغيل دالة التهيئة الخاصة بها.
 * @param {string} moduleId - معرف الوحدة المراد تحميلها.
 */
window.loadModule = async function(moduleId) {
    // تهيئة عناصر DOM الرئيسية إذا لم تكن قد هيئت بعد
    if (!contentArea) contentArea = document.getElementById('content-area');
    if (!pageTitleElement) pageTitleElement = document.getElementById('page-title');
    
    const globalLoader = document.getElementById('global-loader');

    if (globalLoader) globalLoader.classList.remove('hidden');
    try {
        const response = await fetch(`modules/${moduleId}.html`);
        if (!response.ok) {
            throw new Error(`Could not load module ${moduleId}.html: ${response.statusText}`);
        }
        const html = await response.text();
        if (contentArea) contentArea.innerHTML = html;

        // تحديث عنوان الصفحة
        const moduleButtonForTitle = document.querySelector(`.module-btn[data-module="${moduleId}"]`);
        if (moduleButtonForTitle && pageTitleElement) {
            pageTitleElement.textContent = moduleButtonForTitle.querySelector('span').textContent;
        }
        
        // تفعيل الزر في الشريط الجانبي
        if (typeof window.setActiveSidebarButton === 'function') {
            window.setActiveSidebarButton(moduleId);
        }

        // إغلاق الشريط الجانبي للموبايل (إذا كان مفتوحًا)
        if (typeof window.closeMobileSidebar === 'function') { // تأكد من تعريف هذه الدالة بشكل عام إذا لزم الأمر
             window.closeMobileSidebar();
        }


        window.currentLoadedModule = moduleId; // لتتبع الوحدة المحملة حاليًا

        // استدعاء دالة التهيئة الخاصة بالوحدة (يجب أن تكون معرفة بشكل عام أو ضمن <script> في ملف الوحدة)
        const initFunctionName = `init${moduleId.charAt(0).toUpperCase() + moduleId.slice(1)}Module`;
        if (typeof window[initFunctionName] === 'function') {
            await window[initFunctionName]();
        } else if (moduleId === 'dashboard' && typeof initDashboardModule === 'function') { // حالة خاصة لـ dashboard إذا كانت دالته في HTML
            initDashboardModule();
        } else if (moduleId === 'users' && typeof initUsersModule === 'function') {
             await initUsersModule();
        } else if (moduleId === 'products' && typeof initProductsModule === 'function') {
             await initProductsModule();
        } else if (moduleId === 'customers' && typeof initCustomersModule === 'function') {
             await initCustomersModule();
        } else if (moduleId === 'suppliers' && typeof initSuppliersModule === 'function') {
             await initSuppliersModule();
        } else if (moduleId === 'purchases' && typeof initPurchasesModule === 'function') {
             await initPurchasesModule();
        } else if (moduleId === 'sales' && typeof initSalesModule === 'function') {
             await initSalesModule();
        } else if (moduleId === 'inventory' && typeof initInventoryModule === 'function') {
             await initInventoryModule();
        } else if (moduleId === 'expenses' && typeof initExpensesModule === 'function') {
             await initExpensesModule();
        } else if (moduleId === 'banks' && typeof initBanksModule === 'function') {
             await initBanksModule();
        } else if (moduleId === 'accounting' && typeof initAccountingModule === 'function') {
             await initAccountingModule();
        } else if (moduleId === 'settings' && typeof initSettingsModule === 'function') {
             await initSettingsModule();
        } else if (moduleId === 'help' && typeof initHelpModule === 'function') {
             await initHelpModule();
        }


    } catch (error) {
        console.error(`Error loading module '${moduleId}':`, error);
        if (contentArea) contentArea.innerHTML = `<div class="p-4 text-red-500">فشل تحميل الوحدة ${moduleId}: ${error.message}</div>`;
    } finally {
        if (globalLoader) globalLoader.classList.add('hidden');
    }
};

/**
 * تفعيل الزر النشط في الشريط الجانبي.
 * @param {string} moduleId - معرف الوحدة النشطة.
 */
window.setActiveSidebarButton = function(moduleId) {
    if (!allModuleButtonsForActiveState) { // تهيئة عند أول استدعاء إذا لزم الأمر
        allModuleButtonsForActiveState = document.querySelectorAll('.module-btn');
    }
    allModuleButtonsForActiveState.forEach(btn => {
        btn.classList.remove('sidebar-btn-active');
        if (btn.getAttribute('data-module') === moduleId) {
            btn.classList.add('sidebar-btn-active');
        }
    });
};

/**
 * إظهار أو إخفاء الـ spinner على زر.
 * @param {HTMLElement} buttonElement - عنصر الزر.
 * @param {boolean} show - true للإظهار، false للإخفاء.
 */
window.showButtonSpinner = function(buttonElement, show = true) {
    // ... (كود showButtonSpinner كما هو من قبل) ...
    if (!(buttonElement instanceof HTMLElement)) {
        console.error("Invalid buttonElement passed to showButtonSpinner:", buttonElement);
        return;
    }
    let spinner = buttonElement.querySelector('.btn-spinner');
    if (show) {
        buttonElement.disabled = true;
        if (!spinner) {
            spinner = document.createElement('span');
            spinner.className = 'btn-spinner';
            if (buttonElement.firstChild && buttonElement.firstChild.nodeName === '#text') {
                 buttonElement.insertBefore(spinner, buttonElement.firstChild.nextSibling);
            } else {
                buttonElement.prepend(spinner);
            }
        }
        spinner.style.display = 'inline-block';
    } else {
        if (spinner) {
            spinner.style.display = 'none';
        }
        buttonElement.disabled = false;
    }
};

/**
 * إعداد تبديل عرض النموذج (إضافة/تعديل).
 */
window.setupFormToggle = function(options) {
    // ... (كود setupFormToggle كما هو من قبل، مع التأكد من البحث الصحيح عن العناصر) ...
    const { addButtonId, formContainerId, closeButtonId, cancelButtonId, formId, formTitleId, addTitle, editTitle, resetFormFunction, onOpen, currentModule } = options;

    const addBtn = document.getElementById(addButtonId); // هذا يجب أن يكون ID فريد في الصفحة كلها (زر الإضافة الرئيسي للوحدة)
    
    // العناصر داخل الوحدة المحملة
    let formContainer, closeBtn, cancelBtn, form, formTitle;

    // دالة لتهيئة عناصر النموذج بعد تحميل الوحدة
    const initFormElements = () => {
        const moduleElement = document.getElementById(currentModule + '-module'); // حاوية الوحدة
        if (!moduleElement) {
            console.warn(`Module container #${currentModule}-module not found for form toggle.`);
            return false;
        }
        formContainer = moduleElement.querySelector(`#${formContainerId}`);
        closeBtn = moduleElement.querySelector(`#${closeButtonId}`);
        cancelBtn = cancelButtonId ? moduleElement.querySelector(`#${cancelButtonId}`) : null;
        form = moduleElement.querySelector(`#${formId}`);
        formTitle = moduleElement.querySelector(`#${formTitleId}`);
        
        if (!formContainer) { console.warn(`Form container not found: #${formContainerId} in #${currentModule}-module`); return false; }
        if (!closeBtn) { console.warn(`Close button not found: #${closeButtonId} in #${currentModule}-module`); return false; }
        if (!form) { console.warn(`Form not found: #${formId} in #${currentModule}-module`); return false; }
        return true;
    };


    const openForm = (editData = null) => {
        if (!initFormElements()) return; // تأكد من تهيئة العناصر قبل الفتح

        window.currentEditId = editData ? (editData.id || null) : null;
        if (formTitle) formTitle.textContent = window.currentEditId ? editTitle : addTitle;
        if (resetFormFunction) resetFormFunction(editData);
        if (onOpen) onOpen(editData);
        if (formContainer) formContainer.classList.remove('hidden');
    };

    const closeForm = () => {
        if (!formContainer) { // إذا لم تكن العناصر مهيئة (مثلاً لم يتم تحميل الوحدة بعد)
            const tempFormContainer = document.getElementById(formContainerId); // محاولة أخيرة للبحث العام (أقل مثالية)
            if(tempFormContainer) tempFormContainer.classList.add('hidden');
            return;
        }
        if (resetFormFunction) resetFormFunction();
        formContainer.classList.add('hidden');
        window.currentEditId = null;
    };

    if (addBtn) {
        addBtn.addEventListener('click', () => {
            // تأكد أن initFormElements يتم استدعاؤها هنا إذا لم تكن الوحدة قد هيأت عناصرها بعد
            // أو الاعتماد على أن init...Module تستدعي هذا لربط الزر بالفتح
            openForm();
        });
    } else {
        console.warn(`Add button not found: ${addButtonId}. Form toggle might not work as expected for new entries.`);
    }
    
    // ربط أزرار الإغلاق والإلغاء (سيتم هذا داخل init...Module بعد تحميل الـ HTML)
    // يمكن ترك هذا الجزء لـ init...Module الخاص بكل وحدة لضمان أن العناصر موجودة
    // أو تعديل هذا ليعمل بشكل أكثر ديناميكية عند استدعاء openForm.

    // للتبسيط الآن، نرجع الدالة التي يمكن استدعاؤها من init...Module لربط الأزرار
    return { openForm, closeForm, initFormElements }; // إرجاع الدالة لربطها لاحقًا عند تهيئة الوحدة
};


document.addEventListener('DOMContentLoaded', () => {
    // تهيئة عناصر DOM التي تحتاجها الدوال العامة
    contentArea = document.getElementById('content-area');
    pageTitleElement = document.getElementById('page-title');
    allModuleButtonsForActiveState = document.querySelectorAll('.module-btn'); // تهيئة مبكرة

    // --- Firebase Initialization ---
    const firebaseConfig = {
        apiKey: "AIzaSyCAUaKXd9bzMUfBAQTa1nSaEbR_VVLIe98",
        authDomain: "colorflow-erp.firebaseapp.com",
        projectId: "colorflow-erp",
        storageBucket: "colorflow-erp.firebasestorage.app",
        messagingSenderId: "40753390221",
        appId: "1:40753390221:web:a032845d5891d2b510b8c4"
    };
    firebase.initializeApp(firebaseConfig);
    window.db = firebase.firestore();
    window.storage = firebase.storage();
    window.FieldValue = firebase.firestore.FieldValue;
    console.log("Firebase initialized. DB instance:", window.db);


    // --- Dark Mode ---
    const toggleThemeBtn = document.getElementById('toggle-theme-btn');
    // ... (بقية كود الوضع المظلم كما هو)
    const prefersDarkScheme = window.matchMedia('(prefers-color-scheme: dark)');
    function applyTheme(theme) {
        if (theme === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    }
    const currentTheme = localStorage.getItem('theme') ? localStorage.getItem('theme') : (prefersDarkScheme.matches ? 'dark' : 'light');
    applyTheme(currentTheme);
    if (toggleThemeBtn) {
        toggleThemeBtn.addEventListener('click', () => {
            let theme = document.documentElement.classList.contains('dark') ? 'light' : 'dark';
            localStorage.setItem('theme', theme);
            applyTheme(theme);
        });
    }


    // --- Sidebar and Mobile Navigation ---
    const desktopSidebar = document.getElementById('sidebar');
    const mobileSidebarElement = document.getElementById('mobile-sidebar');
    const mobileSidebarAside = mobileSidebarElement ? mobileSidebarElement.querySelector('aside') : null;
    const toggleSidebarBtnMain = document.getElementById('toggle-sidebar-btn');
    const closeMobileSidebarBtn = document.getElementById('close-mobile-sidebar-btn');
    const mobileSidebarOverlay = document.getElementById('mobile-sidebar-overlay');
    const desktopNavMenu = document.getElementById('desktop-nav-menu');
    const mobileNavMenu = document.getElementById('mobile-nav-menu');

    if (desktopNavMenu && mobileNavMenu) {
        mobileNavMenu.innerHTML = desktopNavMenu.innerHTML;
    }
    
    // إعادة ربط الأحداث للأزرار المنسوخة في الشريط الجانبي للموبايل
    const allGeneratedModuleButtons = document.querySelectorAll('.module-btn'); // يشمل الأزرار الأصلية والمنسوخة

    allGeneratedModuleButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            const moduleId = e.currentTarget.getAttribute('data-module');
            if (moduleId) {
                window.loadModule(moduleId); // استدعاء الدالة العامة
            }
        });
    });
    
    window.closeMobileSidebar = function() { // جعلها عامة
        if(mobileSidebarAside) mobileSidebarAside.style.transform = 'translateX(100%)';
        if(mobileSidebarElement) setTimeout(() => mobileSidebarElement.classList.add('hidden'), 300);
    }

    if (toggleSidebarBtnMain) {
        toggleSidebarBtnMain.addEventListener('click', () => {
            if (window.innerWidth < 768) { // md breakpoint
                if(mobileSidebarElement) mobileSidebarElement.classList.remove('hidden');
                if(mobileSidebarAside) setTimeout(() => mobileSidebarAside.style.transform = 'translateX(0)', 10);
            } else {
                if(desktopSidebar) {
                    desktopSidebar.classList.toggle('w-64'); // Normal width
                    desktopSidebar.classList.toggle('w-20'); // Collapsed width
                    desktopSidebar.querySelectorAll('nav span').forEach(span => span.classList.toggle('hidden'));
                    desktopSidebar.querySelectorAll('nav .fas').forEach(icon => icon.classList.toggle('mx-auto')); // Center icon when collapsed
                }
            }
        });
    }
    if (closeMobileSidebarBtn) closeMobileSidebarBtn.addEventListener('click', window.closeMobileSidebar);
    if (mobileSidebarOverlay) mobileSidebarOverlay.addEventListener('click', window.closeMobileSidebar);


    // --- Initial Load ---
    window.loadModule('dashboard'); // استدعاء الدالة العامة لتحميل لوحة التحكم
});