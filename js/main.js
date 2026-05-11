document.addEventListener('DOMContentLoaded', () => {
    console.log('Main.js loaded — Supabase backend active.');

    const SETTINGS_KEYS = Object.freeze({
        companyInfo: 'company_info',
        generalSettings: 'system_preferences',
        financialSettings: 'tax_settings',
        inventorySettings: 'inventory_preferences',
        salesSettings: 'sales_preferences',
        notificationsSettings: 'notification_preferences',
        permissionMatrix: 'permission_matrix',
        userPermissionOverrides: 'user_permission_overrides',
        lookupCatalog: 'lookup_catalog'
    });

    const ROLE_LIST = Object.freeze(['admin', 'accountant', 'sales', 'warehouse', 'viewer']);
    const ROLE_LABELS = Object.freeze({
        admin: 'مدير النظام',
        accountant: 'محاسب',
        sales: 'مبيعات',
        warehouse: 'مخزن',
        viewer: 'مشاهد'
    });

    const MODULES = Object.freeze({
        dashboard: { label: 'لوحة التحكم', actions: ['view'] },
        users: { label: 'المستخدمون', actions: ['view', 'create', 'edit', 'delete', 'manage'] },
        products: { label: 'الأصناف', actions: ['view', 'create', 'edit', 'delete'] },
        customers: { label: 'العملاء', actions: ['view', 'create', 'edit', 'delete'] },
        suppliers: { label: 'الموردون', actions: ['view', 'create', 'edit', 'delete'] },
        purchases: { label: 'المشتريات', actions: ['view', 'create', 'edit', 'cancel'] },
        sales: { label: 'المبيعات', actions: ['view', 'create', 'edit', 'cancel'] },
        inventory: { label: 'المخزون', actions: ['view', 'create', 'edit', 'transfer'] },
        expenses: { label: 'المصروفات', actions: ['view', 'create', 'edit', 'delete'] },
        banks: { label: 'البنوك والخزائن', actions: ['view', 'create', 'edit', 'delete'] },
        accounting: { label: 'الحسابات', actions: ['view', 'create', 'edit', 'export'] },
        profile: { label: 'الملف الشخصي', actions: ['view'] },
        settings: { label: 'الإعدادات', actions: ['view', 'manage'] },
        help: { label: 'المساعدة', actions: ['view'] }
    });

    const MODULE_ACTION_GUARDS = Object.freeze({
        users: [
            { selector: '#add-user-btn', action: 'create' },
            { selector: '.edit-user-btn', action: 'edit' },
            { selector: '.deactivate-user-btn', action: 'delete' }
        ],
        customers: [
            { selector: '#add-customer-btn', action: 'create' },
            { selector: '.edit-customer-btn', action: 'edit' },
            { selector: '.delete-customer-btn', action: 'delete' }
        ],
        suppliers: [
            { selector: '#add-supplier-btn', action: 'create' },
            { selector: '.edit-supplier-btn', action: 'edit' },
            { selector: '.delete-supplier-btn', action: 'delete' }
        ],
        sales: [
            { selector: '#add-sale-btn', action: 'create' },
            { selector: '.edit-sale-btn', action: 'edit' },
            { selector: '.delete-sale-btn', action: 'cancel' }
        ],
        purchases: [
            { selector: '#add-purchase-btn', action: 'create' },
            { selector: '.edit-purchase-btn', action: 'edit' },
            { selector: '.delete-purchase-btn', action: 'cancel' }
        ],
        expenses: [
            { selector: '#add-expense-btn', action: 'create' },
            { selector: '.edit-expense-btn', action: 'edit' },
            { selector: '.delete-expense-btn', action: 'delete' }
        ],
        banks: [
            { selector: '#add-bank-account-btn', action: 'create' },
            { selector: '#add-bank-transaction-btn', action: 'create' },
            { selector: '.edit-bank-account-btn', action: 'edit' },
            { selector: '.delete-bank-account-btn', action: 'delete' }
        ],
        products: [
            { selector: '#add-product-btn', action: 'create' },
            { selector: '.edit-product-btn', action: 'edit' },
            { selector: '.delete-product-btn', action: 'delete' }
        ],
        inventory: [
            { selector: '#add-inventory-in-btn', action: 'create' },
            { selector: '#add-inventory-transfer-btn', action: 'transfer' }
        ]
    });

    const DEFAULT_LOOKUPS = Object.freeze({
        currencies: [
            { value: 'EGP', label: 'جنيه مصري (EGP)' },
            { value: 'USD', label: 'دولار أمريكي (USD)' },
            { value: 'EUR', label: 'يورو (EUR)' }
        ],
        dateFormats: [
            { value: 'dd/mm/yyyy', label: 'DD/MM/YYYY' },
            { value: 'mm/dd/yyyy', label: 'MM/DD/YYYY' },
            { value: 'yyyy-mm-dd', label: 'YYYY-MM-DD' }
        ],
        customerAreas: [
            { value: 'القاهرة', label: 'القاهرة' },
            { value: 'الجيزة', label: 'الجيزة' },
            { value: 'الإسكندرية', label: 'الإسكندرية' }
        ],
        salePaymentMethods: [
            { value: 'cash', label: 'نقداً' },
            { value: 'credit', label: 'آجل' },
            { value: 'bank_transfer', label: 'تحويل بنكي' },
            { value: 'pos', label: 'نقطة بيع' }
        ],
        purchasePaymentMethods: [
            { value: 'cash', label: 'نقداً' },
            { value: 'credit', label: 'آجل' },
            { value: 'bank_transfer', label: 'تحويل بنكي' }
        ],
        expenseTypes: [
            { value: 'fuel', label: 'وقود' },
            { value: 'maintenance', label: 'صيانة' },
            { value: 'rent', label: 'إيجارات' },
            { value: 'salaries', label: 'رواتب' },
            { value: 'utilities', label: 'فواتير ومرافق' },
            { value: 'office_supplies', label: 'أدوات مكتبية' },
            { value: 'marketing', label: 'تسويق ودعاية' },
            { value: 'transport', label: 'نقل ومواصلات' },
            { value: 'bank_fees', label: 'رسوم بنكية' },
            { value: 'government_fees', label: 'رسوم حكومية' },
            { value: 'hospitality', label: 'ضيافة وبوفيه' },
            { value: 'other', label: 'أخرى' }
        ],
        expensePaymentMethods: [
            { value: 'cash', label: 'نقداً (خزينة)' },
            { value: 'bank_account_1', label: 'حساب بنكي' },
            { value: 'employee_paid', label: 'دفعها موظف (عهدة)' }
        ],
        bankAccountTypes: [
            { value: 'bank_current', label: 'حساب بنكي - جاري' },
            { value: 'bank_saving', label: 'حساب بنكي - توفير' },
            { value: 'cash_on_hand', label: 'خزينة نقدية' },
            { value: 'e_wallet', label: 'محفظة إلكترونية' }
        ],
        bankTransactionTypes: [
            { value: 'deposit', label: 'إيداع / وارد' },
            { value: 'withdrawal', label: 'سحب / مصروف' },
            { value: 'transfer_out', label: 'تحويل صادر' },
            { value: 'transfer_in', label: 'تحويل وارد' },
            { value: 'bank_fee', label: 'رسوم بنكية' },
            { value: 'interest', label: 'فائدة' }
        ]
    });

    const DEFAULT_SETTINGS = Object.freeze({
        companyInfo: {
            name: 'شركة TiGeR للتجارة والتوزيع',
            crNumber: '',
            taxNumber: '',
            phone: '',
            address: '',
            email: '',
            website: '',
            logoUrl: null
        },
        generalSettings: {
            currency: 'EGP',
            dateFormat: 'dd/mm/yyyy',
            themeMode: 'system',
            compactSidebar: false,
            denseTables: false,
            defaultWarehouseId: null
        },
        financialSettings: {
            vatPercentage: 14,
            enableVat: true,
            creditGraceDays: 0,
            roundInvoices: false
        },
        inventorySettings: {
            lowStockThreshold: 10,
            allowNegativeStock: false,
            autoReserveStock: true,
            defaultWarehouseId: null
        },
        salesSettings: {
            defaultWarehouseId: null,
            defaultPaymentMethod: 'cash',
            requireSalesperson: false,
            autoPrintAfterSave: false,
            defaultTaxRate: 14
        },
        notificationsSettings: {
            toastDuration: 4500,
            toastPosition: 'top-left',
            notifyNewOrder: false,
            notifyLowStock: false,
            notifyInvoiceSave: true
        },
        lookupCatalog: DEFAULT_LOOKUPS,
        permissionMatrix: buildDefaultPermissionMatrix(),
        userPermissionOverrides: {}
    });

    const appState = {
        config: structuredClone(DEFAULT_SETTINGS),
        loaded: false,
        loadPromise: null
    };

    const contentArea = document.getElementById('content-area');
    const pageTitleElement = document.getElementById('page-title');
    const DESKTOP_BREAKPOINT = 768;
    const desktopNavMenu = document.getElementById('desktop-nav-menu');
    const mobileNavMenu = document.getElementById('mobile-nav-menu');
    const globalLoader = document.getElementById('global-loader');
    const toggleThemeBtn = document.getElementById('toggle-theme-btn');
    const prefersDarkScheme = window.matchMedia('(prefers-color-scheme: dark)');
    const desktopSidebar = document.getElementById('sidebar');
    const mobileSidebarElement = document.getElementById('mobile-sidebar');
    const mobileSidebarAside = mobileSidebarElement?.querySelector('aside');
    const toggleSidebarBtn = document.getElementById('toggle-sidebar-btn');
    const closeMobileSidebarBtn = document.getElementById('close-mobile-sidebar-btn');
    const mobileSidebarOverlay = document.getElementById('mobile-sidebar-overlay');
    const toastContainer = document.getElementById('toast-container');

    if (desktopNavMenu && mobileNavMenu) {
        mobileNavMenu.innerHTML = desktopNavMenu.innerHTML;
    }

    const allModuleButtons = () => document.querySelectorAll('.module-btn');

    function buildDefaultPermissionMatrix() {
        const makeModuleRecord = (actions, enabledActions) => actions.reduce((acc, action) => {
            acc[action] = enabledActions.includes(action);
            return acc;
        }, {});

        return {
            admin: Object.fromEntries(Object.entries(MODULES).map(([moduleId, module]) => [moduleId, makeModuleRecord(module.actions, [...module.actions])])),
            accountant: {
                dashboard: { view: true },
                users: { view: false, create: false, edit: false, delete: false, manage: false },
                products: { view: true, create: false, edit: false, delete: false },
                customers: { view: true, create: false, edit: false, delete: false },
                suppliers: { view: true, create: false, edit: false, delete: false },
                purchases: { view: true, create: true, edit: true, cancel: true },
                sales: { view: true, create: true, edit: true, cancel: true },
                inventory: { view: true, create: false, edit: false, transfer: false },
                expenses: { view: true, create: true, edit: true, delete: false },
                banks: { view: true, create: true, edit: true, delete: false },
                accounting: { view: true, create: true, edit: true, export: true },
                settings: { view: true, manage: false },
                help: { view: true }
            },
            sales: {
                dashboard: { view: true },
                users: { view: false, create: false, edit: false, delete: false, manage: false },
                products: { view: true, create: false, edit: false, delete: false },
                customers: { view: true, create: true, edit: true, delete: false },
                suppliers: { view: true, create: false, edit: false, delete: false },
                purchases: { view: true, create: false, edit: false, cancel: false },
                sales: { view: true, create: true, edit: true, cancel: false },
                inventory: { view: true, create: false, edit: false, transfer: false },
                expenses: { view: false, create: false, edit: false, delete: false },
                banks: { view: false, create: false, edit: false, delete: false },
                accounting: { view: false, create: false, edit: false, export: false },
                settings: { view: false, manage: false },
                help: { view: true }
            },
            warehouse: {
                dashboard: { view: true },
                users: { view: false, create: false, edit: false, delete: false, manage: false },
                products: { view: true, create: false, edit: true, delete: false },
                customers: { view: false, create: false, edit: false, delete: false },
                suppliers: { view: true, create: false, edit: false, delete: false },
                purchases: { view: true, create: true, edit: true, cancel: false },
                sales: { view: true, create: false, edit: false, cancel: false },
                inventory: { view: true, create: true, edit: true, transfer: true },
                expenses: { view: false, create: false, edit: false, delete: false },
                banks: { view: false, create: false, edit: false, delete: false },
                accounting: { view: false, create: false, edit: false, export: false },
                settings: { view: false, manage: false },
                help: { view: true }
            },
            viewer: {
                dashboard: { view: true },
                users: { view: false, create: false, edit: false, delete: false, manage: false },
                products: { view: true, create: false, edit: false, delete: false },
                customers: { view: true, create: false, edit: false, delete: false },
                suppliers: { view: true, create: false, edit: false, delete: false },
                purchases: { view: true, create: false, edit: false, cancel: false },
                sales: { view: true, create: false, edit: false, cancel: false },
                inventory: { view: true, create: false, edit: false, transfer: false },
                expenses: { view: true, create: false, edit: false, delete: false },
                banks: { view: true, create: false, edit: false, delete: false },
                accounting: { view: true, create: false, edit: false, export: false },
                settings: { view: false, manage: false },
                help: { view: true }
            }
        };
    }

    function deepClone(value) {
        if (typeof structuredClone === 'function') return structuredClone(value);
        return JSON.parse(JSON.stringify(value));
    }


    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    window.escapeHtml = escapeHtml;

    function deepMerge(baseValue, overrideValue) {
        if (Array.isArray(baseValue)) {
            return Array.isArray(overrideValue) ? deepClone(overrideValue) : deepClone(baseValue);
        }
        if (baseValue && typeof baseValue === 'object') {
            const output = deepClone(baseValue);
            if (!overrideValue || typeof overrideValue !== 'object') return output;
            Object.keys(overrideValue).forEach((key) => {
                output[key] = key in output ? deepMerge(output[key], overrideValue[key]) : deepClone(overrideValue[key]);
            });
            return output;
        }
        return overrideValue !== undefined ? overrideValue : baseValue;
    }

    function getCurrentThemePreference() {
        return localStorage.getItem('theme') || (prefersDarkScheme.matches ? 'dark' : 'light');
    }

    function applyTheme(theme) {
        if (theme === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    }

    function inferToastType(message) {
        const text = String(message || '');
        if (/فشل|خطأ|تعذر|غير صالح|مرفوض|cannot|error/i.test(text)) return 'error';
        if (/تحذير|تنبيه|warning/i.test(text)) return 'warning';
        if (/تم|نجاح|saved|completed|done/i.test(text)) return 'success';
        return 'info';
    }

    function getToastIcon(type) {
        return {
            success: 'fa-circle-check',
            error: 'fa-circle-xmark',
            warning: 'fa-triangle-exclamation',
            info: 'fa-circle-info'
        }[type] || 'fa-circle-info';
    }

    function getToastTitle(type) {
        return {
            success: 'تم بنجاح',
            error: 'حدث خطأ',
            warning: 'تنبيه',
            info: 'معلومة'
        }[type] || 'معلومة';
    }

    function getToastDuration() {
        return Number(window.AppConfig?.getSection('notificationsSettings')?.toastDuration || DEFAULT_SETTINGS.notificationsSettings.toastDuration);
    }

    function positionToastContainer() {
        if (!toastContainer) return;
        const position = window.AppConfig?.getSection('notificationsSettings')?.toastPosition || 'top-left';
        toastContainer.style.top = '1rem';
        toastContainer.style.bottom = 'auto';
        toastContainer.style.left = '1rem';
        toastContainer.style.right = 'auto';
        if (position === 'top-right') {
            toastContainer.style.left = 'auto';
            toastContainer.style.right = '1rem';
        }
    }

    function showToast(message, type = 'info', options = {}) {
        if (!toastContainer) return;
        positionToastContainer();
        const toast = document.createElement('div');
        toast.className = `toast toast--${type}`;

        const iconWrap = document.createElement('div');
        iconWrap.className = 'toast__icon';
        const icon = document.createElement('i');
        icon.className = `fas ${getToastIcon(type)}`;
        iconWrap.appendChild(icon);

        const body = document.createElement('div');
        const titleEl = document.createElement('div');
        titleEl.className = 'toast__title';
        titleEl.textContent = options.title || getToastTitle(type);
        const messageEl = document.createElement('div');
        messageEl.className = 'toast__message';
        messageEl.textContent = String(message || '');
        body.append(titleEl, messageEl);

        const closeButton = document.createElement('button');
        closeButton.type = 'button';
        closeButton.className = 'toast__close';
        closeButton.setAttribute('aria-label', 'إغلاق');
        closeButton.innerHTML = '<i class="fas fa-xmark"></i>';
        closeButton.addEventListener('click', () => toast.remove());

        toast.append(iconWrap, body, closeButton);
        toastContainer.appendChild(toast);
        const duration = Number(options.duration || getToastDuration());
        window.setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(-8px)';
            window.setTimeout(() => toast.remove(), 180);
        }, duration);
    }

    window.AppNotify = {
        show({ message, type = 'info', title, duration }) {
            showToast(message, type, { title, duration });
        },
        success(message, options = {}) { showToast(message, 'success', options); },
        error(message, options = {}) { showToast(message, 'error', options); },
        warning(message, options = {}) { showToast(message, 'warning', options); },
        info(message, options = {}) { showToast(message, 'info', options); }
    };

    window.alert = function(message) {
        window.AppNotify.show({ message: String(message || ''), type: inferToastType(message) });
    };

    async function fetchAppSettings() {
        const companyId = window.AppAuth?.companyId?.();
        if (!window.supabaseClient || !companyId) {
            return {};
        }
        const keys = Object.values(SETTINGS_KEYS);
        const { data, error } = await window.supabaseClient
            .from('app_settings')
            .select('setting_key,setting_value_json')
            .eq('company_id', companyId)
            .in('setting_key', keys);
        if (error) throw error;
        return (data || []).reduce((acc, row) => {
            acc[row.setting_key] = row.setting_value_json || null;
            return acc;
        }, {});
    }

    async function saveAppSetting(settingKey, jsonValue) {
        const companyId = window.AppAuth?.companyId?.();
        if (!window.supabaseClient || !companyId) {
            throw new Error('تعذر تحديد الشركة الحالية لحفظ الإعدادات.');
        }
        const { error } = await window.supabaseClient
            .from('app_settings')
            .upsert({
                company_id: companyId,
                setting_key: settingKey,
                setting_value_json: jsonValue,
                setting_value: null,
                updated_at: new Date().toISOString()
            }, { onConflict: 'company_id,setting_key' });
        if (error) throw error;
    }

    async function loadAppConfig(force = false) {
        if (!force && appState.loaded) return appState.config;
        if (!force && appState.loadPromise) return appState.loadPromise;

        appState.loadPromise = (async () => {
            const persisted = await fetchAppSettings().catch((error) => {
                console.error('Error loading app settings:', error);
                window.AppNotify.warning('تعذر تحميل بعض الإعدادات المتقدمة، وسيتم استخدام القيم الافتراضية. يرجى التحقق من الاتصال أو إعادة تحميل الصفحة.');
                return {};
            });

            appState.config = {
                companyInfo: deepMerge(DEFAULT_SETTINGS.companyInfo, persisted[SETTINGS_KEYS.companyInfo]),
                generalSettings: deepMerge(DEFAULT_SETTINGS.generalSettings, persisted[SETTINGS_KEYS.generalSettings]),
                financialSettings: deepMerge(DEFAULT_SETTINGS.financialSettings, persisted[SETTINGS_KEYS.financialSettings]),
                inventorySettings: deepMerge(DEFAULT_SETTINGS.inventorySettings, persisted[SETTINGS_KEYS.inventorySettings]),
                salesSettings: deepMerge(DEFAULT_SETTINGS.salesSettings, persisted[SETTINGS_KEYS.salesSettings]),
                notificationsSettings: deepMerge(DEFAULT_SETTINGS.notificationsSettings, persisted[SETTINGS_KEYS.notificationsSettings]),
                lookupCatalog: deepMerge(DEFAULT_SETTINGS.lookupCatalog, persisted[SETTINGS_KEYS.lookupCatalog]),
                permissionMatrix: deepMerge(DEFAULT_SETTINGS.permissionMatrix, persisted[SETTINGS_KEYS.permissionMatrix]),
                userPermissionOverrides: deepMerge(DEFAULT_SETTINGS.userPermissionOverrides, persisted[SETTINGS_KEYS.userPermissionOverrides])
            };

            appState.loaded = true;
            appState.loadPromise = null;
            positionToastContainer();
            applyConfiguredThemeMode();
            applyConfiguredLayoutMode();
            updateNavigationVisibility();
            window.dispatchEvent(new CustomEvent('app-config:loaded', { detail: { config: appState.config } }));
            return appState.config;
        })();

        return appState.loadPromise;
    }

    function getRolePermission(role, moduleId, action) {
        return Boolean(appState.config.permissionMatrix?.[role]?.[moduleId]?.[action]);
    }

    function getUserOverride(userId, moduleId, action) {
        if (!userId) return undefined;
        return appState.config.userPermissionOverrides?.[userId]?.[moduleId]?.[action];
    }

    function hasPermission(moduleId, action = 'view', userId, role) {
        const effectiveUserId = userId ?? window.AppAuth?.currentUser?.id;
        const effectiveRole = role ?? window.AppAuth?.role?.() ?? 'viewer';
        const base = getRolePermission(effectiveRole, moduleId, action);
        const override = getUserOverride(effectiveUserId, moduleId, action);
        return typeof override === 'boolean' ? override : base;
    }

    function canAccessModule(moduleId) {
        if (!MODULES[moduleId]) return false;
        return hasPermission(moduleId, 'view');
    }

    function applyConfiguredThemeMode() {
        const configuredTheme = appState.config.generalSettings?.themeMode || 'system';
        const theme = configuredTheme === 'system' ? getCurrentThemePreference() : configuredTheme;
        applyTheme(theme);
    }

    function applyConfiguredLayoutMode() {
        const compactSidebar = Boolean(appState.config.generalSettings?.compactSidebar);
        const denseTables = Boolean(appState.config.generalSettings?.denseTables);

        document.body.classList.toggle('layout-compact-sidebar', compactSidebar);
        document.body.classList.toggle('layout-dense-tables', denseTables);

        if (isDesktopViewport()) setDesktopSidebarCompact(compactSidebar);
    }

    function setDesktopSidebarCompact(compact) {
        if (!desktopSidebar) return;
        desktopSidebar.classList.toggle('w-20', compact);
        desktopSidebar.classList.toggle('w-64', !compact);
        desktopSidebar.querySelectorAll('nav span').forEach((span) => {
            span.classList.toggle('hidden', compact);
        });
    }

    function isDesktopViewport() {
        return window.matchMedia(`(min-width: ${DESKTOP_BREAKPOINT}px)`).matches;
    }

    function setActiveSidebarButton(moduleId) {
        allModuleButtons().forEach((btn) => {
            btn.classList.remove('sidebar-btn-active');
            if (btn.getAttribute('data-module') === moduleId) {
                btn.classList.add('sidebar-btn-active');
            }
        });
    }

    function updateNavigationVisibility() {
        allModuleButtons().forEach((button) => {
            const moduleId = button.getAttribute('data-module');
            const allowed = canAccessModule(moduleId);
            button.classList.toggle('hidden', !allowed);
            button.toggleAttribute('disabled', !allowed);
            button.setAttribute('aria-hidden', String(!allowed));
        });
    }

    function openMobileSidebar() {
        mobileSidebarElement?.classList.remove('hidden');
        window.setTimeout(() => {
            if (mobileSidebarAside) mobileSidebarAside.style.transform = 'translateX(0)';
        }, 10);
    }

    function closeMobileSidebar() {
        if (mobileSidebarAside) mobileSidebarAside.style.transform = 'translateX(100%)';
        window.setTimeout(() => mobileSidebarElement?.classList.add('hidden'), 300);
    }

    function firstAccessibleModule() {
        return Object.keys(MODULES).find((moduleId) => canAccessModule(moduleId)) || 'help';
    }

    function ensureModuleAccess(moduleId) {
        if (canAccessModule(moduleId)) return true;
        window.AppNotify.error('لا تملك صلاحية الوصول إلى هذه الصفحة.');
        return false;
    }

    function decorateModuleShell(moduleId) {
        const moduleRoot = contentArea?.querySelector(`#${moduleId}-module`) || contentArea?.firstElementChild;
        moduleRoot?.classList.add('module-shell');
        return moduleRoot;
    }

    window.applyModuleActionGuards = function(moduleId, root = contentArea) {
        const rules = MODULE_ACTION_GUARDS[moduleId] || [];
        rules.forEach(({ selector, action }) => {
            root?.querySelectorAll(selector)?.forEach((element) => {
                const allowed = hasPermission(moduleId, action);
                element.classList.toggle('hidden', !allowed);
                element.toggleAttribute('disabled', !allowed);
            });
        });
    };

    window.AppConfig = {
        settingKeys: SETTINGS_KEYS,
        roleLabels: ROLE_LABELS,
        roles: ROLE_LIST,
        modules: MODULES,
        defaultSettings: DEFAULT_SETTINGS,
        async load(force = false) {
            return loadAppConfig(force);
        },
        async reload() {
            return loadAppConfig(true);
        },
        async saveSection(settingKey, value) {
            await saveAppSetting(settingKey, value);
            await loadAppConfig(true);
            window.dispatchEvent(new CustomEvent('app-config:updated', { detail: { settingKey, value } }));
        },
        getSection(sectionName) {
            return deepClone(appState.config?.[sectionName]);
        },
        getLookupOptions(lookupKey) {
            return deepClone(appState.config.lookupCatalog?.[lookupKey] || []);
        },
        getLookupLabel(lookupKey, value) {
            const options = appState.config.lookupCatalog?.[lookupKey] || [];
            return options.find((option) => option.value === value)?.label || value;
        },
        populateSelect(selectElement, lookupKey, options = {}) {
            if (!selectElement) return;
            const currentValue = options.preserveValue ? selectElement.value : undefined;
            const items = this.getLookupOptions(lookupKey);
            const fragments = [];
            if (options.placeholder) fragments.push(`<option value="">${options.placeholder}</option>`);
            items.forEach((item) => {
                fragments.push(`<option value="${item.value}">${item.label}</option>`);
            });
            selectElement.innerHTML = fragments.join('');
            if (currentValue !== undefined) selectElement.value = currentValue;
            if (options.value !== undefined) selectElement.value = options.value;
        },
        hasPermission,
        canAccessModule,
        getPermissionMatrix() {
            return deepClone(appState.config.permissionMatrix);
        },
        getUserPermissionOverrides() {
            return deepClone(appState.config.userPermissionOverrides);
        }
    };

    window.showButtonSpinner = function(buttonElement, show = true) {
        if (!(buttonElement instanceof HTMLElement)) return;
        let spinner = buttonElement.querySelector('.btn-spinner');
        if (show) {
            buttonElement.disabled = true;
            if (!spinner) {
                spinner = document.createElement('span');
                spinner.className = 'btn-spinner';
                buttonElement.prepend(spinner);
            }
            spinner.style.display = 'inline-block';
        } else {
            if (spinner) spinner.style.display = 'none';
            buttonElement.disabled = false;
        }
    };

    window.setupFormToggle = function(options) {
        const { addButtonId, formContainerId, closeButtonId, cancelButtonId, formId, formTitleId, addTitle, editTitle, resetFormFunction, onOpen, currentModule } = options;
        let addBtn = document.getElementById(addButtonId);
        let formContainer = document.getElementById(formContainerId);
        let closeBtn = document.getElementById(closeButtonId);
        let cancelBtn = cancelButtonId ? document.getElementById(cancelButtonId) : null;
        let form = document.getElementById(formId);
        let formTitle = document.getElementById(formTitleId);

        if (!addBtn && currentModule) addBtn = document.querySelector(`#${currentModule}-module #${addButtonId}`);
        if (!formContainer && currentModule) formContainer = document.querySelector(`#${currentModule}-module #${formContainerId}`);
        if (!closeBtn && currentModule) closeBtn = document.querySelector(`#${currentModule}-module #${closeButtonId}`);
        if (!cancelBtn && currentModule && cancelButtonId) cancelBtn = document.querySelector(`#${currentModule}-module #${cancelButtonId}`);
        if (!form && currentModule) form = document.querySelector(`#${currentModule}-module #${formId}`);
        if (!formTitle && currentModule) formTitle = document.querySelector(`#${currentModule}-module #${formTitleId}`);

        if (!formContainer || !closeBtn || !form) return () => {};

        const openForm = async (editData = null) => {
            window.currentEditId = editData ? (editData.id || null) : null;
            if (formTitle) formTitle.textContent = window.currentEditId ? editTitle : addTitle;
            if (resetFormFunction) resetFormFunction(editData);
            if (onOpen) await onOpen(editData);
            formContainer.classList.remove('hidden');
        };

        const closeForm = () => {
            if (resetFormFunction) resetFormFunction();
            formContainer.classList.add('hidden');
            window.currentEditId = null;
        };

        addBtn?.addEventListener('click', () => openForm());
        closeBtn.addEventListener('click', closeForm);
        cancelBtn?.addEventListener('click', closeForm);
        return openForm;
    };

    window.showGlobalLoader = function(show = true) {
        globalLoader?.classList.toggle('hidden', !show);
    };

    function updateHeaderUserInfo() {
        const profile = window.AppAuth?.profile;
        if (!profile) return;
        const displayName = document.getElementById('user-display-name');
        const avatarInitial = document.getElementById('user-avatar-initial');
        if (displayName) displayName.textContent = profile.full_name || '';
        if (avatarInitial) avatarInitial.innerHTML = `<span>${(profile.full_name || '?').charAt(0)}</span>`;
    }

    window.currentLoadedModule = null;

    const loadModule = window.loadModule = async function(moduleId) {
        if (!ensureModuleAccess(moduleId)) return;
        window.showGlobalLoader(true);
        try {
            const response = await fetch(`modules/${moduleId}.html`);
            if (!response.ok) throw new Error(`Could not load module ${moduleId}.html: ${response.statusText}`);
            const html = await response.text();
            contentArea.innerHTML = html;
            decorateModuleShell(moduleId);
            const moduleButton = document.querySelector(`.module-btn[data-module="${moduleId}"]`);
            if (moduleButton && pageTitleElement) {
                pageTitleElement.textContent = moduleButton.querySelector('span')?.textContent || MODULES[moduleId]?.label || '';
            }
            setActiveSidebarButton(moduleId);
            closeMobileSidebar();
            currentLoadedModule = moduleId;

            const initializers = {
                users: window.initUsersModule,
                products: window.initProductsModule,
                customers: window.initCustomersModule,
                dashboard: window.initDashboardModule,
                suppliers: window.initSuppliersModule,
                purchases: window.initPurchasesModule,
                sales: window.initSalesModule,
                inventory: window.initInventoryModule,
                expenses: window.initExpensesModule,
                banks: window.initBanksModule,
                accounting: window.initAccountingModule,
                settings: window.initSettingsModule,
                help: window.initHelpModule
            };

            if (typeof initializers[moduleId] === 'function') {
                await initializers[moduleId]();
            }
            window.applyModuleActionGuards(moduleId, contentArea);
        } catch (error) {
            console.error('Error loading module:', error);
            contentArea.innerHTML = `<div class="module-shell p-4 text-red-500">فشل تحميل الوحدة: ${error.message}</div>`;
        } finally {
            window.showGlobalLoader(false);
        }
    };

    allModuleButtons().forEach((button) => {
        button.addEventListener('click', (e) => {
            const moduleId = e.currentTarget.getAttribute('data-module');
            if (moduleId) loadModule(moduleId);
        });
    });

    toggleThemeBtn?.addEventListener('click', () => {
        const theme = document.documentElement.classList.contains('dark') ? 'light' : 'dark';
        localStorage.setItem('theme', theme);
        applyTheme(theme);
    });

    toggleSidebarBtn?.addEventListener('click', () => {
        if (!isDesktopViewport()) {
            openMobileSidebar();
        } else {
            const shouldCompact = !desktopSidebar?.classList.contains('w-20');
            setDesktopSidebarCompact(shouldCompact);
        }
    });

    closeMobileSidebarBtn?.addEventListener('click', closeMobileSidebar);
    mobileSidebarOverlay?.addEventListener('click', closeMobileSidebar);

    function updateUserMenuInfo() {
        const profile = window.AppAuth?.profile;
        if (!profile) return;
        const nameEl = document.getElementById('user-menu-name');
        const roleEl = document.getElementById('user-menu-role');
        if (nameEl) nameEl.textContent = profile.full_name || '';
        if (roleEl) roleEl.textContent = ROLE_LABELS[profile.role] || profile.role || '';
    }

    async function bootstrapAuthenticatedShell() {
        updateHeaderUserInfo();
        updateUserMenuInfo();
        await loadAppConfig();
        const landingModule = canAccessModule('dashboard') ? 'dashboard' : firstAccessibleModule();
        await loadModule(landingModule);
    }

    window.addEventListener('auth:ready', async (e) => {
        if (e.detail.authenticated) {
            await bootstrapAuthenticatedShell();
        }
    });

    window.addEventListener('auth:signedIn', async () => {
        await bootstrapAuthenticatedShell();
    });

    window.addEventListener('auth:signedOut', () => {
        contentArea.innerHTML = '';
        if (pageTitleElement) pageTitleElement.textContent = 'لوحة التحكم';
        appState.loaded = false;
        appState.config = deepClone(DEFAULT_SETTINGS);
    });

    window.addEventListener('app-config:updated', () => {
        positionToastContainer();
        applyConfiguredThemeMode();
        applyConfiguredLayoutMode();
        updateNavigationVisibility();
        if (currentLoadedModule) {
            window.applyModuleActionGuards(currentLoadedModule, contentArea);
        }
    });

    document.getElementById('user-menu-button')?.addEventListener('click', (e) => {
        e.stopPropagation();
        document.getElementById('user-menu-dropdown')?.classList.toggle('hidden');
    });

    document.addEventListener('click', () => {
        document.getElementById('user-menu-dropdown')?.classList.add('hidden');
    });

    document.getElementById('logout-btn')?.addEventListener('click', async () => {
        document.getElementById('user-menu-dropdown')?.classList.add('hidden');
        await window.AppAuth?.logout?.();
    });

    applyTheme(getCurrentThemePreference());
    positionToastContainer();
});
