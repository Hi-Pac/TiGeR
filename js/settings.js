async function initSettingsModule() {
    const settingsModuleNode = document.getElementById('settings-module');
    if (!settingsModuleNode) return;

    const tabButtons = settingsModuleNode.querySelectorAll('.settings-tab-btn');
    const tabPanes = settingsModuleNode.querySelectorAll('.settings-tab-pane');
    const activeTabClasses = ['border-primary', 'text-primary', 'dark:border-primary', 'dark:text-primary'];
    const inactiveTabClasses = ['border-transparent', 'hover:text-gray-600', 'hover:border-gray-300', 'dark:hover:text-gray-300'];

    const companyInfoForm = settingsModuleNode.querySelector('#company-info-form');
    const systemPreferencesForm = settingsModuleNode.querySelector('#system-preferences-form');
    const taxesFeesForm = settingsModuleNode.querySelector('#taxes-fees-form');
    const companyLogoField = settingsModuleNode.querySelector('#company-logo-field');
    const companyLogoPreview = settingsModuleNode.querySelector('#company-logo-preview');

    const companyNameField = settingsModuleNode.querySelector('#company-name-field');
    const companyCrNumberField = settingsModuleNode.querySelector('#company-cr-number-field');
    const companyTaxNumberField = settingsModuleNode.querySelector('#company-tax-number-field');
    const companyPhoneField = settingsModuleNode.querySelector('#company-phone-field');
    const companyAddressField = settingsModuleNode.querySelector('#company-address-field');
    const companyEmailField = settingsModuleNode.querySelector('#company-email-field');
    const companyWebsiteField = settingsModuleNode.querySelector('#company-website-field');

    const defaultCurrencyField = settingsModuleNode.querySelector('#system-default-currency-field');
    const dateFormatField = settingsModuleNode.querySelector('#system-date-format-field');
    const defaultWarehouseField = settingsModuleNode.querySelector('#system-default-warehouse-field');
    const lowStockThresholdField = settingsModuleNode.querySelector('#low-stock-threshold-field');
    const emailNewOrderField = settingsModuleNode.querySelector('#email-new-order-notify');
    const emailLowStockField = settingsModuleNode.querySelector('#email-low-stock-notify');

    const vatPercentageField = settingsModuleNode.querySelector('#vat-percentage-field');
    const enableVatField = settingsModuleNode.querySelector('#enable-vat-field');

    const createBackupBtn = settingsModuleNode.querySelector('#create-backup-btn');
    const restoreBackupBtn = settingsModuleNode.querySelector('#restore-backup-btn');

    const SETTINGS_KEYS = {
        company: 'company_info',
        preferences: 'system_preferences',
        taxes: 'tax_settings'
    };

    async function loadWarehousesForSettings() {
        const { data } = await DB.from('warehouses')
            .select('id,name,status')
            .eq('status', 'active')
            .order('name', { ascending: true })
            .get();

        const rows = Array.isArray(data) ? data : [];
        defaultWarehouseField.innerHTML = '<option value="">اختر مخزن...</option>' +
            rows.map((w) => `<option value="${w.id}">${w.name}</option>`).join('');
    }

    async function getSetting(settingKey) {
        const { data, error } = await window.supabaseClient
            .from('app_settings')
            .select('setting_value_json,setting_value')
            .eq('setting_key', settingKey)
            .maybeSingle();
        if (error) throw error;
        return data?.setting_value_json || null;
    }

    async function upsertSetting(settingKey, jsonValue) {
        const companyId = window.AppAuth?.companyId();
        if (!companyId) throw new Error('تعذر تحديد الشركة الحالية.');

        const { error } = await window.supabaseClient
            .from('app_settings')
            .upsert({
                company_id: companyId,
                setting_key: settingKey,
                setting_value_json: jsonValue,
                setting_value: null,
                description: null,
                updated_at: new Date().toISOString()
            }, { onConflict: 'company_id,setting_key' });

        if (error) throw error;
    }

    function switchSettingsTab(targetTabId) {
        tabPanes.forEach((pane) => pane.classList.add('hidden'));
        tabButtons.forEach((button) => {
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
    }

    async function loadCompanyInfo() {
        const data = await getSetting(SETTINGS_KEYS.company);
        if (!data) return;

        companyNameField.value = data.name || '';
        companyCrNumberField.value = data.crNumber || '';
        companyTaxNumberField.value = data.taxNumber || '';
        companyPhoneField.value = data.phone || '';
        companyAddressField.value = data.address || '';
        companyEmailField.value = data.email || '';
        companyWebsiteField.value = data.website || '';

        if (data.logoUrl && companyLogoPreview) {
            companyLogoPreview.src = data.logoUrl;
            companyLogoPreview.classList.remove('hidden');
        }
    }

    async function loadSystemPreferences() {
        await loadWarehousesForSettings();
        const data = await getSetting(SETTINGS_KEYS.preferences);
        if (!data) return;

        defaultCurrencyField.value = data.currency || 'EGP';
        dateFormatField.value = data.dateFormat || 'dd/mm/yyyy';
        defaultWarehouseField.value = data.defaultWarehouseId || '';
        lowStockThresholdField.value = Number(data.lowStockThreshold ?? 10);
        emailNewOrderField.checked = Boolean(data.notifyNewOrder);
        emailLowStockField.checked = Boolean(data.notifyLowStock);
    }

    async function loadTaxSettings() {
        const data = await getSetting(SETTINGS_KEYS.taxes);
        if (!data) return;

        vatPercentageField.value = Number(data.vatPercentage ?? 14);
        enableVatField.checked = Boolean(data.enableVat ?? true);
    }

    tabButtons.forEach((button) => {
        button.addEventListener('click', async (e) => {
            const tab = e.currentTarget.dataset.tabTarget;
            switchSettingsTab(tab);
            if (tab === 'company-info-tab') await loadCompanyInfo();
            if (tab === 'system-preferences-tab') await loadSystemPreferences();
            if (tab === 'taxes-fees-tab') await loadTaxSettings();
        });
    });

    if (companyLogoField && companyLogoPreview) {
        companyLogoField.addEventListener('change', (event) => {
            const file = event.target.files?.[0];
            if (!file) {
                companyLogoPreview.classList.add('hidden');
                return;
            }
            const reader = new FileReader();
            reader.onload = (e) => {
                companyLogoPreview.src = e.target.result;
                companyLogoPreview.classList.remove('hidden');
            };
            reader.readAsDataURL(file);
        });
    }

    if (companyInfoForm) {
        companyInfoForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const saveBtn = e.submitter;
            if (saveBtn) window.showButtonSpinner(saveBtn, true);

            try {
                const payload = {
                    name: companyNameField.value.trim(),
                    crNumber: companyCrNumberField.value.trim(),
                    taxNumber: companyTaxNumberField.value.trim(),
                    phone: companyPhoneField.value.trim(),
                    address: companyAddressField.value.trim(),
                    email: companyEmailField.value.trim(),
                    website: companyWebsiteField.value.trim(),
                    logoUrl: companyLogoPreview && !companyLogoPreview.classList.contains('hidden') ? companyLogoPreview.src : null
                };
                await upsertSetting(SETTINGS_KEYS.company, payload);
                alert('تم حفظ معلومات الشركة.');
            } catch (err) {
                console.error('Error saving company settings:', err);
                alert(`فشل حفظ معلومات الشركة: ${err.message || 'خطأ غير متوقع.'}`);
            } finally {
                if (saveBtn) window.showButtonSpinner(saveBtn, false);
            }
        });
    }

    if (systemPreferencesForm) {
        systemPreferencesForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const saveBtn = e.submitter;
            if (saveBtn) window.showButtonSpinner(saveBtn, true);

            try {
                const payload = {
                    currency: defaultCurrencyField.value,
                    dateFormat: dateFormatField.value,
                    defaultWarehouseId: defaultWarehouseField.value || null,
                    lowStockThreshold: Number(lowStockThresholdField.value || 10),
                    notifyNewOrder: emailNewOrderField.checked,
                    notifyLowStock: emailLowStockField.checked
                };
                await upsertSetting(SETTINGS_KEYS.preferences, payload);
                alert('تم حفظ تفضيلات النظام.');
            } catch (err) {
                console.error('Error saving system preferences:', err);
                alert(`فشل حفظ التفضيلات: ${err.message || 'خطأ غير متوقع.'}`);
            } finally {
                if (saveBtn) window.showButtonSpinner(saveBtn, false);
            }
        });
    }

    if (taxesFeesForm) {
        taxesFeesForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const saveBtn = e.submitter;
            if (saveBtn) window.showButtonSpinner(saveBtn, true);

            try {
                const payload = {
                    vatPercentage: Number(vatPercentageField.value || 0),
                    enableVat: enableVatField.checked
                };
                await upsertSetting(SETTINGS_KEYS.taxes, payload);
                alert('تم حفظ إعدادات الضرائب.');
            } catch (err) {
                console.error('Error saving tax settings:', err);
                alert(`فشل حفظ إعدادات الضرائب: ${err.message || 'خطأ غير متوقع.'}`);
            } finally {
                if (saveBtn) window.showButtonSpinner(saveBtn, false);
            }
        });
    }

    if (createBackupBtn) createBackupBtn.addEventListener('click', () => alert('ميزة النسخ الاحتياطي قيد التطوير.'));
    if (restoreBackupBtn) restoreBackupBtn.addEventListener('click', () => alert('ميزة الاستعادة قيد التطوير.'));

    switchSettingsTab('company-info-tab');
    await Promise.all([loadCompanyInfo(), loadSystemPreferences(), loadTaxSettings()]);
}
