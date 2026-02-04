document.addEventListener('DOMContentLoaded', () => {
    // --- Firebase Initialization ---
    const firebaseConfig = {
          apiKey: "AIzaSyBRtCWX-OcFAtMqZusMqePMX2zvlIdcRyA",
          authDomain: "delta-hcp-fa2ba.firebaseapp.com",
          projectId: "delta-hcp-fa2ba",
          storageBucket: "delta-hcp-fa2ba.firebasestorage.app",
          messagingSenderId: "649732241434",
          appId: "1:649732241434:web:f3adddc04c9b6e9d2f39a3",
          measurementId: "G-G3JEXBE9KZ"
        };
    firebase.initializeApp(firebaseConfig);
    window.auth = firebase.auth();
    window.db = firebase.firestore();
    window.storage = firebase.storage();
    console.log("Firebase Initialized Successfully!");

    // --- Global DOM Elements ---
    const contentArea = document.getElementById('content-area');
    const pageTitleElement = document.getElementById('page-title');
    const desktopNavMenu = document.getElementById('desktop-nav-menu');
    const mobileNavMenu = document.getElementById('mobile-nav-menu');
    const globalLoader = document.getElementById('global-loader');

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
    const toggleSidebarBtn = document.getElementById('toggle-sidebar-btn'); // Main toggle button
    const closeMobileSidebarBtn = document.getElementById('close-mobile-sidebar-btn');
    const mobileSidebarOverlay = document.getElementById('mobile-sidebar-overlay');

    // Populate mobile nav from desktop nav
    if (desktopNavMenu && mobileNavMenu) {
        mobileNavMenu.innerHTML = desktopNavMenu.innerHTML; // Simple copy
    }
    const allModuleButtons = document.querySelectorAll('.module-btn');


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
        setTimeout(() => mobileSidebarAside.style.transform = 'translateX(0)', 10); // For RTL
    }

    function closeMobileSidebar() {
        mobileSidebarAside.style.transform = 'translateX(100%)'; // For RTL
        setTimeout(() => mobileSidebarElement.classList.add('hidden'), 300);
    }
    
    // Toggle for main sidebar (desktop collapse/expand and mobile show)
    if (toggleSidebarBtn) {
        toggleSidebarBtn.addEventListener('click', () => {
            if (window.innerWidth < 768) { // md breakpoint
                openMobileSidebar();
            } else {
                desktopSidebar.classList.toggle('w-64');
                desktopSidebar.classList.toggle('w-20'); // Example collapsed width
                // You might want to hide text and only show icons when collapsed
                desktopSidebar.querySelectorAll('nav span').forEach(span => span.classList.toggle('hidden'));
            }
        });
    }

    if (closeMobileSidebarBtn) closeMobileSidebarBtn.addEventListener('click', closeMobileSidebar);
    if (mobileSidebarOverlay) mobileSidebarOverlay.addEventListener('click', closeMobileSidebar);


    // --- Module Loading and Navigation ---
    window.currentLoadedModule = null; // To keep track of the currently loaded module's specific JS functions

    async function loadModule(moduleId) {
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
            // These functions should be defined in their respective JS files (e.g., users.js, products.js)
            // and attached to the window object or managed via an event system.
            // For simplicity, we'll attach them to window for now.
            currentLoadedModule = moduleId;
            if (moduleId === 'users' && typeof initUsersModule === 'function') {
                initUsersModule();
            } else if (moduleId === 'products' && typeof initProductsModule === 'function') {
                initProductsModule();
            } else if (moduleId === 'customers' && typeof initCustomersModule === 'function') {
                initCustomersModule();
            } else if (moduleId === 'dashboard' && typeof initDashboardModule === 'function') {
                initDashboardModule();
            } else if (moduleId === 'suppliers' && typeof initSuppliersModule === 'function') {
                initSuppliersModule();
            } else if (moduleId === 'purchases' && typeof initPurchasesModule === 'function') {
                initPurchasesModule();
            } else if (moduleId === 'sales' && typeof initSalesModule === 'function') {
                initSalesModule();
            } else if (moduleId === 'inventory' && typeof initInventoryModule === 'function') {
                initInventoryModule();
            } else if (moduleId === 'expenses' && typeof initExpensesModule === 'function') {
                initExpensesModule();
            } else if (moduleId === 'banks' && typeof initBanksModule === 'function') {
                initBanksModule();
            } else if (moduleId === 'accounting' && typeof initAccountingModule === 'function') {
                initAccountingModule();
            } else if (moduleId === 'settings' && typeof initSettingsModule === 'function') {
                initSettingsModule();
            } else if (moduleId === 'help' && typeof initHelpModule === 'function') {
                initHelpModule();
            }
            // Add other `else if` for other modules here...
            
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

    // --- Utility Functions (can be moved to a separate utils.js later) ---
    window.showButtonSpinner = function(buttonElement, show = true) {
        // Ensure the button is an HTMLElement
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
                // Adjust insertion for RTL: icon before text
                if (buttonElement.firstChild && buttonElement.firstChild.nodeName === '#text') {
                     buttonElement.insertBefore(spinner, buttonElement.firstChild.nextSibling); // after first text node
                } else {
                    buttonElement.prepend(spinner);
                }
            }
            spinner.style.display = 'inline-block';
        } else {
            if (spinner) {
                spinner.style.display = 'none'; // Hide instead of remove if re-used
            }
            buttonElement.disabled = false;
        }
    };

    window.setupFormToggle = function(options) {
        const { addButtonId, formContainerId, closeButtonId, cancelButtonId, formId, formTitleId, addTitle, editTitle, resetFormFunction, onOpen, currentModule } = options;

        // Try to find elements within the module first, then fall back to global
        const currentModuleElement = document.getElementById(`${currentModule}-module`);
        
        const addBtn = currentModuleElement ? currentModuleElement.querySelector(`#${addButtonId}`) : document.getElementById(addButtonId);
        let formContainer = currentModuleElement ? currentModuleElement.querySelector(`#${formContainerId}`) : document.getElementById(formContainerId);
        if (!formContainer && !currentModuleElement) {
            formContainer = document.getElementById(formContainerId); // Fall back to global
        }
        
        let closeBtn = currentModuleElement ? currentModuleElement.querySelector(`#${closeButtonId}`) : document.getElementById(closeButtonId);
        if (!closeBtn) {
            closeBtn = document.getElementById(closeButtonId); // Fall back to global
        }
        
        let cancelBtn = null;
        if (cancelButtonId) {
            cancelBtn = currentModuleElement ? currentModuleElement.querySelector(`#${cancelButtonId}`) : document.getElementById(cancelButtonId);
            if (!cancelBtn) {
                cancelBtn = document.getElementById(cancelButtonId); // Fall back to global
            }
        }
        
        let form = currentModuleElement ? currentModuleElement.querySelector(`#${formId}`) : document.getElementById(formId);
        if (!form) {
            form = document.getElementById(formId); // Fall back to global
        }
        
        let formTitle = currentModuleElement ? currentModuleElement.querySelector(`#${formTitleId}`) : document.getElementById(formTitleId);
        if (!formTitle) {
            formTitle = document.getElementById(formTitleId); // Fall back to global
        }

        if (!addBtn) { console.error(`Add button not found: #${addButtonId} in module ${currentModule}. Current module element:`, currentModuleElement); return () => {}; }
        if (!formContainer) { console.error(`Form container not found: #${formContainerId} in module ${currentModule}. Current module element:`, currentModuleElement); return () => {}; }
        if (!closeBtn) { console.error(`Close button not found: #${closeButtonId} in module ${currentModule}. Current module element:`, currentModuleElement); return () => {}; }
        if (!form) { console.error(`Form not found: #${formId} in module ${currentModule}. Current module element:`, currentModuleElement); return () => {}; }

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
    loadModule('dashboard'); // Load dashboard by default
});
