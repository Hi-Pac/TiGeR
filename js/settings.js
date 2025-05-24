function initSettingsModule() {
    console.log("Settings Module Initialized!");

    const settingsModuleNode = document.getElementById('settings-module');
    if (!settingsModuleNode) return;

    const tabButtons = settingsModuleNode.querySelectorAll('.settings-tab-btn');
    const tabPanes = settingsModuleNode.querySelectorAll('.settings-tab-pane');
    const activeTabClasses = ['border-primary', 'text-primary', 'dark:border-primary', 'dark:text-primary'];
    const inactiveTabClasses = ['border-transparent', 'hover:text-gray-600', 'hover:border-gray-300', 'dark:hover:text-gray-300'];

    // --- Tab Switching Logic ---
    function switchSettingsTab(targetTabId) {
        tabPanes.forEach(pane => pane.classList.add('hidden'));
        tabButtons.forEach(button => {
            button.classList.remove(...activeTabClasses);
            button.classList.add(...inactiveTabClasses);
        });

        const activePane = settingsModuleNode.querySelector(`#${targetTabId}`);
        const activeButton = settingsModuleNode.querySelector(`[data-tab-target="${targetTabId}"]`);

        if (activePane) activePane.classList.remove('hidden');
        if (activeButton) {
            activeButton.classList.add(...activeTabClasses);
            activeButton.classList.remove(...inactiveTabClasses);
        }
        // Load data for the active tab if needed
        if (targetTabId === 'company-info-tab') {
            loadCompanyInfo();
        } // Add else if for other tabs data loading
    }

    tabButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            switchSettingsTab(e.currentTarget.dataset.tabTarget);
        });
    });

    // --- Company Info Form Logic ---
    const companyInfoForm = settingsModuleNode.querySelector('#company-info-form');
    const companyLogoField = settingsModuleNode.querySelector('#company-logo-field');
    const companyLogoPreview = settingsModuleNode.querySelector('#company-logo-preview');

    async function loadCompanyInfo() {
        // --- FIREBASE: Fetch company info from a 'settings' document ---
        console.log("Loading company info (simulated)...");
        // Example:
        // const doc = await db.collection('appSettings').doc('companyDetails').get();
        // if (doc.exists) {
        //     const data = doc.data();
        //     document.getElementById('company-name-field').value = data.name || '';
        //     // ... populate other fields
        //     if(data.logoUrl) {
        //         companyLogoPreview.src = data.logoUrl;
        //         companyLogoPreview.classList.remove('hidden');
        //     }
        // }
    }

    if (companyLogoField && companyLogoPreview) {
        companyLogoField.addEventListener('change', function(event) {
            const file = event.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    companyLogoPreview.src = e.target.result;
                    companyLogoPreview.classList.remove('hidden');
                }
                reader.readAsDataURL(file);
            } else {
                companyLogoPreview.classList.add('hidden');
            }
        });
    }
    
    if (companyInfoForm) {
        companyInfoForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const saveBtn = e.submitter;
            window.showButtonSpinner(saveBtn, true);
            const companyData = {
                name: document.getElementById('company-name-field').value,
                crNumber: document.getElementById('company-cr-number-field').value,
                taxNumber: document.getElementById('company-tax-number-field').value,
                phone: document.getElementById('company-phone-field').value,
                address: document.getElementById('company-address-field').value,
                email: document.getElementById('company-email-field').value,
                website: document.getElementById('company-website-field').value,
            };
            const logoFile = companyLogoField.files[0];
            try {
                if (logoFile) {
                    // --- FIREBASE STORAGE: Upload logoFile, get URL, save URL to companyData.logoUrl ---
                    console.log("Simulating logo upload:", logoFile.name);
                    // companyData.logoUrl = "simulated_logo_url.png";
                }
                // --- FIREBASE: Save companyData to Firestore ---
                // await db.collection('appSettings').doc('companyDetails').set(companyData, { merge: true });
                console.log("Saving company info:", companyData);
                alert("تم حفظ معلومات الشركة (محاكاة).");
            } catch (error) {
                console.error("Error saving company info:", error);
                alert("فشل حفظ معلومات الشركة.");
            } finally {
                window.showButtonSpinner(saveBtn, false);
            }
        });
    }

    // --- System Preferences Form Logic ---
    const systemPreferencesForm = settingsModuleNode.querySelector('#system-preferences-form');
    if (systemPreferencesForm) {
        // TODO: Load existing preferences
        systemPreferencesForm.addEventListener('submit', async (e) => {
            e.preventDefault(); /* Save system preferences logic */
            alert("تم حفظ تفضيلات النظام (محاكاة).");
        });
    }
    
    // --- Taxes & Fees Form Logic ---
    const taxesFeesForm = settingsModuleNode.querySelector('#taxes-fees-form');
    if (taxesFeesForm) {
         // TODO: Load existing tax settings
        taxesFeesForm.addEventListener('submit', async (e) => {
            e.preventDefault(); /* Save tax settings logic */
            alert("تم حفظ إعدادات الضرائب (محاكاة).");
        });
    }

    // --- Backup & Restore Logic ---
    const createBackupBtn = settingsModuleNode.querySelector('#create-backup-btn');
    const restoreBackupBtn = settingsModuleNode.querySelector('#restore-backup-btn');
    if(createBackupBtn) createBackupBtn.addEventListener('click', () => alert("إنشاء نسخة احتياطية (سيتم تنفيذه عبر Firebase Functions لاحقًا)."));
    if(restoreBackupBtn) restoreBackupBtn.addEventListener('click', () => alert("استعادة من نسخة احتياطية (سيتم تنفيذه عبر Firebase Functions لاحقًا)."));


    // Initial Tab and Data Load
    switchSettingsTab('company-info-tab'); // Default to company info
}