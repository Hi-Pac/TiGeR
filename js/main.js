document.addEventListener('DOMContentLoaded', async () => {
    // تهيئة Supabase تمت في js/supabase-client.js المُحمَّل قبل هذا الملف.
    // window.db  → طبقة التوافق مع Firestore API
    // window.supabaseClient → عميل Supabase الأصلي
    console.log("Main.js loaded — Supabase backend active.");

    // --- حارس المصادقة: التحقق من تسجيل الدخول ---
    const isAuthenticated = await window.requireAuth();
    if (!isAuthenticated) return; // سيتم التوجيه إلى login.html

    // --- تحديث معلومات المستخدم في الواجهة ---
    const user = window.currentUser;
    if (user) {
        const nameEl = document.getElementById('user-display-name');
        const avatarEl = document.getElementById('user-avatar-initial');
        const roleEl = document.getElementById('user-role-label');
        const dropdownNameEl = document.getElementById('user-dropdown-name');
        const dropdownEmailEl = document.getElementById('user-dropdown-email');

        if (nameEl) nameEl.textContent = user.name;
        if (avatarEl) avatarEl.textContent = user.name ? user.name.charAt(0).toUpperCase() : 'م';
        if (roleEl) roleEl.textContent = window.ROLE_LABELS[user.role] || user.role;
        if (dropdownNameEl) dropdownNameEl.textContent = user.name;
        if (dropdownEmailEl) dropdownEmailEl.textContent = user.email;
    }

    // --- قائمة المستخدم المنسدلة ---
    const userMenuButton = document.getElementById('user-menu-button');
    const userDropdown = document.getElementById('user-dropdown');
    if (userMenuButton && userDropdown) {
        userMenuButton.addEventListener('click', (e) => {
            e.stopPropagation();
            userDropdown.classList.toggle('hidden');
        });
        document.addEventListener('click', () => {
            userDropdown.classList.add('hidden');
        });
    }

    // --- زر تسجيل الخروج ---
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            if (confirm('هل تريد تسجيل الخروج؟')) {
                await window.logoutUser();
            }
        });
    }

    // --- Global DOM Elements ---
    const contentArea = document.getElementById('content-area');
    const pageTitleElement = document.getElementById('page-title');
    const desktopNavMenu = document.getElementById('desktop-nav-menu');
    const mobileNavMenu = document.getElementById('mobile-nav-menu');
    const globalLoader = document.getElementById('global-loader');

    // --- إخفاء عناصر التنقل التي لا يملك المستخدم صلاحية الوصول إليها ---
    function applyRoleBasedNavigation() {
        const allNavItems = document.querySelectorAll('.module-btn');
        allNavItems.forEach(btn => {
            const moduleId = btn.getAttribute('data-module');
            const listItem = btn.closest('li');
            if (moduleId && !window.canAccessModule(moduleId)) {
                if (listItem) listItem.classList.add('hidden');
            } else {
                if (listItem) listItem.classList.remove('hidden');
            }
        });
    }

    // --- Dark Mode ---
    const toggleThemeBtn = document.getElementById('toggle-theme-btn');
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
    const mobileSidebarAside = mobileSidebarElement.querySelector('aside');
    const toggleSidebarBtn = document.getElementById('toggle-sidebar-btn');
    const closeMobileSidebarBtn = document.getElementById('close-mobile-sidebar-btn');
    const mobileSidebarOverlay = document.getElementById('mobile-sidebar-overlay');

    // Populate mobile nav from desktop nav
    if (desktopNavMenu && mobileNavMenu) {
        mobileNavMenu.innerHTML = desktopNavMenu.innerHTML;
    }
    const allModuleButtons = document.querySelectorAll('.module-btn');

    // تطبيق فلتر الصلاحيات على القائمة
    applyRoleBasedNavigation();

    function setActiveSidebarButton(moduleId) {
        allModuleButtons.forEach(btn => {
            btn.classList.remove('sidebar-btn-active');
            if (btn.getAttribute('data-module') === moduleId) {
                btn.classList.add('sidebar-btn-active');
            }
        });
    }

    function openMobileSidebar() {
        mobileSidebarElement.classList.remove('hidden');
        setTimeout(() => mobileSidebarAside.style.transform = 'translateX(0)', 10);
    }

    function closeMobileSidebar() {
        mobileSidebarAside.style.transform = 'translateX(100%)';
        setTimeout(() => mobileSidebarElement.classList.add('hidden'), 300);
    }

    if (toggleSidebarBtn) {
        toggleSidebarBtn.addEventListener('click', () => {
            if (window.innerWidth < 768) {
                openMobileSidebar();
            } else {
                desktopSidebar.classList.toggle('w-64');
                desktopSidebar.classList.toggle('w-20');
                desktopSidebar.querySelectorAll('nav span').forEach(span => span.classList.toggle('hidden'));
            }
        });
    }

    if (closeMobileSidebarBtn) closeMobileSidebarBtn.addEventListener('click', closeMobileSidebar);
    if (mobileSidebarOverlay) mobileSidebarOverlay.addEventListener('click', closeMobileSidebar);


    // --- Module Loading and Navigation ---
    window.currentLoadedModule = null;

    const loadModule = window.loadModule = async function(moduleId) {
        // التحقق من الصلاحيات قبل تحميل الوحدة
        if (!window.canAccessModule(moduleId)) {
            contentArea.innerHTML = `
                <div class="flex flex-col items-center justify-center h-64 text-gray-500 dark:text-gray-400">
                    <i class="fas fa-lock text-5xl mb-4 text-red-400"></i>
                    <h3 class="text-lg font-bold mb-2">غير مصرح بالوصول</h3>
                    <p class="text-sm">ليس لديك صلاحية الوصول إلى هذه الوحدة.</p>
                    <p class="text-xs mt-1 text-gray-400">تواصل مع مدير النظام إذا كنت تحتاج إلى الوصول.</p>
                </div>`;
            if (pageTitleElement) pageTitleElement.textContent = 'غير مصرح بالوصول';
            return;
        }

        if (globalLoader) globalLoader.classList.remove('hidden');
        try {
            const response = await fetch(`modules/${moduleId}.html`);
            if (!response.ok) {
                throw new Error(`Could not load module ${moduleId}.html: ${response.statusText}`);
            }
            const html = await response.text();
            contentArea.innerHTML = html;

            // Update page title
            const moduleButton = document.querySelector(`.module-btn[data-module="${moduleId}"]`);
            if (moduleButton && pageTitleElement) {
                pageTitleElement.textContent = moduleButton.querySelector('span').textContent;
            }
            setActiveSidebarButton(moduleId);
            closeMobileSidebar();

            // Call module-specific initialization function if it exists
            currentLoadedModule = moduleId;
            if (moduleId === 'users' && typeof initUsersModule === 'function') {
                await initUsersModule();
            } else if (moduleId === 'products' && typeof initProductsModule === 'function') {
                await initProductsModule();
            } else if (moduleId === 'customers' && typeof initCustomersModule === 'function') {
                await initCustomersModule();
            } else if (moduleId === 'dashboard' && typeof initDashboardModule === 'function') {
                await initDashboardModule();
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
            console.error('Error loading module:', error);
            contentArea.innerHTML = `<div class="p-4 text-red-500">فشل تحميل الوحدة: ${error.message}</div>`;
        } finally {
            if (globalLoader) globalLoader.classList.add('hidden');
        }
    }

    allModuleButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            const moduleId = e.currentTarget.getAttribute('data-module');
            if (moduleId) {
                loadModule(moduleId);
            }
        });
    });

    // --- Utility Functions ---
    window.showButtonSpinner = function(buttonElement, show = true) {
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

    window.setupFormToggle = function(options) {
        const { addButtonId, formContainerId, closeButtonId, cancelButtonId, formId, formTitleId, addTitle, editTitle, resetFormFunction, onOpen, currentModule } = options;

        let addBtn = document.getElementById(addButtonId);
        if (!addBtn && currentModule) {
            const currentModuleElement = document.getElementById(`${currentModule}-module`);
            if (currentModuleElement) {
                addBtn = currentModuleElement.querySelector(`#${addButtonId}`);
            }
        }

        let formContainer = document.getElementById(formContainerId);
        if (!formContainer && currentModule) {
            const currentModuleElement = document.getElementById(`${currentModule}-module`);
            if (currentModuleElement) {
                formContainer = currentModuleElement.querySelector(`#${formContainerId}`);
            }
        }

        let closeBtn = document.getElementById(closeButtonId);
        if (!closeBtn && currentModule) {
            const currentModuleElement = document.getElementById(`${currentModule}-module`);
            if (currentModuleElement) {
                closeBtn = currentModuleElement.querySelector(`#${closeButtonId}`);
            }
        }

        let cancelBtn = null;
        if (cancelButtonId) {
            cancelBtn = document.getElementById(cancelButtonId);
            if (!cancelBtn && currentModule) {
                const currentModuleElement = document.getElementById(`${currentModule}-module`);
                if (currentModuleElement) {
                    cancelBtn = currentModuleElement.querySelector(`#${cancelButtonId}`);
                }
            }
        }

        let form = document.getElementById(formId);
        if (!form && currentModule) {
            const currentModuleElement = document.getElementById(`${currentModule}-module`);
            if (currentModuleElement) {
                form = currentModuleElement.querySelector(`#${formId}`);
            }
        }

        let formTitle = document.getElementById(formTitleId);
        if (!formTitle && currentModule) {
            const currentModuleElement = document.getElementById(`${currentModule}-module`);
            if (currentModuleElement) {
                formTitle = currentModuleElement.querySelector(`#${formTitleId}`);
            }
        }

        if (!addBtn) { console.error(`Add button not found: #${addButtonId}`); return () => {}; }
        if (!formContainer) { console.error(`Form container not found: #${formContainerId}`); return () => {}; }
        if (!closeBtn) { console.error(`Close button not found: #${closeButtonId}`); return () => {}; }
        if (!form) { console.error(`Form not found: #${formId}`); return () => {}; }

        const openForm = (editData = null) => {
            window.currentEditId = editData ? (editData.id || null) : null;
            if (formTitle) formTitle.textContent = window.currentEditId ? editTitle : addTitle;
            if (resetFormFunction) resetFormFunction(editData);
            if (onOpen) onOpen(editData);
            formContainer.classList.remove('hidden');
        };

        const closeForm = () => {
            if (resetFormFunction) resetFormFunction();
            formContainer.classList.add('hidden');
            window.currentEditId = null;
        };

        addBtn.addEventListener('click', () => openForm());
        closeBtn.addEventListener('click', closeForm);
        if (cancelBtn) cancelBtn.addEventListener('click', closeForm);

        return openForm;
    };

    window.showGlobalLoader = function(show = true) {
        if (globalLoader) {
            if (show) globalLoader.classList.remove('hidden');
            else globalLoader.classList.add('hidden');
        }
    };

    // --- Initial Load ---
    loadModule('dashboard');
});
