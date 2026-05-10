async function initSettingsModule() {
    const settingsModuleNode = document.getElementById('settings-module');
    if (!settingsModuleNode || !window.AppConfig) return;

    await window.AppConfig.load();

    const tabButtons = settingsModuleNode.querySelectorAll('.settings-tab-btn');
    const tabPanes = settingsModuleNode.querySelectorAll('.settings-tab-pane');

    const companyInfoForm = settingsModuleNode.querySelector('#company-info-form');
    const generalSettingsForm = settingsModuleNode.querySelector('#general-settings-form');
    const financialSettingsForm = settingsModuleNode.querySelector('#financial-settings-form');
    const inventorySettingsForm = settingsModuleNode.querySelector('#inventory-settings-form');
    const salesSettingsForm = settingsModuleNode.querySelector('#sales-settings-form');
    const notificationsSettingsForm = settingsModuleNode.querySelector('#notifications-settings-form');
    const permissionsMatrixForm = settingsModuleNode.querySelector('#permissions-matrix-form');
    const userPermissionOverrideForm = settingsModuleNode.querySelector('#user-permission-override-form');

    const companyNameField = settingsModuleNode.querySelector('#company-name-field');
    const companyCrNumberField = settingsModuleNode.querySelector('#company-cr-number-field');
    const companyTaxNumberField = settingsModuleNode.querySelector('#company-tax-number-field');
    const companyPhoneField = settingsModuleNode.querySelector('#company-phone-field');
    const companyAddressField = settingsModuleNode.querySelector('#company-address-field');
    const companyEmailField = settingsModuleNode.querySelector('#company-email-field');
    const companyWebsiteField = settingsModuleNode.querySelector('#company-website-field');
    const companyLogoField = settingsModuleNode.querySelector('#company-logo-field');
    const companyLogoPreview = settingsModuleNode.querySelector('#company-logo-preview');

    const defaultCurrencyField = settingsModuleNode.querySelector('#system-default-currency-field');
    const dateFormatField = settingsModuleNode.querySelector('#system-date-format-field');
    const themeModeField = settingsModuleNode.querySelector('#system-theme-mode-field');
    const generalDefaultWarehouseField = settingsModuleNode.querySelector('#system-default-warehouse-field');
    const compactSidebarField = settingsModuleNode.querySelector('#compact-sidebar-field');
    const denseTablesField = settingsModuleNode.querySelector('#dense-tables-field');

    const vatPercentageField = settingsModuleNode.querySelector('#vat-percentage-field');
    const creditGraceDaysField = settingsModuleNode.querySelector('#credit-grace-days-field');
    const enableVatField = settingsModuleNode.querySelector('#enable-vat-field');
    const roundInvoicesField = settingsModuleNode.querySelector('#round-invoices-field');

    const lowStockThresholdField = settingsModuleNode.querySelector('#low-stock-threshold-field');
    const inventoryDefaultWarehouseField = settingsModuleNode.querySelector('#inventory-default-warehouse-field');
    const allowNegativeStockField = settingsModuleNode.querySelector('#allow-negative-stock-field');
    const autoReserveStockField = settingsModuleNode.querySelector('#auto-reserve-stock-field');

    const salesDefaultWarehouseField = settingsModuleNode.querySelector('#sales-default-warehouse-field');
    const salesDefaultPaymentMethodField = settingsModuleNode.querySelector('#sales-default-payment-method-field');
    const salesDefaultTaxRateField = settingsModuleNode.querySelector('#sales-default-tax-rate-field');
    const requireSalespersonField = settingsModuleNode.querySelector('#require-salesperson-field');
    const autoPrintAfterSaveField = settingsModuleNode.querySelector('#auto-print-after-save-field');

    const toastDurationField = settingsModuleNode.querySelector('#toast-duration-field');
    const toastPositionField = settingsModuleNode.querySelector('#toast-position-field');
    const notifyInvoiceSaveField = settingsModuleNode.querySelector('#notify-invoice-save-field');
    const emailNewOrderField = settingsModuleNode.querySelector('#email-new-order-notify');
    const emailLowStockField = settingsModuleNode.querySelector('#email-low-stock-notify');

    const permissionsRoleSelect = settingsModuleNode.querySelector('#permissions-role-select');
    const permissionsMatrixBody = settingsModuleNode.querySelector('#permissions-matrix-body');
    const permissionOverrideUserField = settingsModuleNode.querySelector('#permission-override-user-field');
    const permissionOverrideModuleField = settingsModuleNode.querySelector('#permission-override-module-field');
    const permissionOverrideActionField = settingsModuleNode.querySelector('#permission-override-action-field');
    const permissionOverrideModeField = settingsModuleNode.querySelector('#permission-override-mode-field');
    const userPermissionOverridesBody = settingsModuleNode.querySelector('#user-permission-overrides-body');

    const lookupCategoryField = settingsModuleNode.querySelector('#lookup-category-field');
    const lookupItemValueField = settingsModuleNode.querySelector('#lookup-item-value-field');
    const lookupItemLabelField = settingsModuleNode.querySelector('#lookup-item-label-field');
    const addLookupItemBtn = settingsModuleNode.querySelector('#add-lookup-item-btn');
    const lookupItemsBody = settingsModuleNode.querySelector('#lookup-items-body');

    const LOOKUP_LABELS = {
        currencies: 'العملات',
        dateFormats: 'تنسيقات التاريخ',
        customerAreas: 'مناطق العملاء',
        salePaymentMethods: 'طرق دفع المبيعات',
        purchasePaymentMethods: 'طرق دفع المشتريات',
        expenseTypes: 'أنواع المصروفات',
        expensePaymentMethods: 'طرق دفع المصروفات',
        bankAccountTypes: 'أنواع الحسابات البنكية',
        bankTransactionTypes: 'أنواع المعاملات البنكية'
    };

    let warehouses = [];
    let users = [];

    async function loadWarehouses() {
        const { data } = await window.DB.from('warehouses')
            .select('id,name,status')
            .eq('status', 'active')
            .order('name', { ascending: true })
            .get();
        warehouses = Array.isArray(data) ? data : [];
        const options = warehouses.map((warehouse) => `<option value="${warehouse.id}">${warehouse.name}</option>`).join('');
        [generalDefaultWarehouseField, inventoryDefaultWarehouseField, salesDefaultWarehouseField].forEach((field) => {
            if (!field) return;
            field.innerHTML = `<option value="">اختر مخزن...</option>${options}`;
        });
    }

    async function loadUsersForOverrides() {
        const { data } = await window.supabaseClient
            .from('profiles')
            .select('id, full_name, role, status')
            .order('full_name', { ascending: true });
        users = Array.isArray(data) ? data.filter((user) => user.status === 'active') : [];
        permissionOverrideUserField.innerHTML = '<option value="">اختر مستخدم...</option>' +
            users.map((user) => `<option value="${user.id}">${user.full_name} — ${window.AppConfig.roleLabels[user.role] || user.role}</option>`).join('');
    }

    function switchSettingsTab(targetTabId) {
        tabPanes.forEach((pane) => pane.classList.toggle('active', pane.id === targetTabId));
        tabButtons.forEach((button) => {
            const active = button.dataset.tabTarget === targetTabId;
            button.classList.toggle('active', active);
            button.setAttribute('aria-selected', String(active));
        });
    }

    function hydrateCompanyInfo() {
        const section = window.AppConfig.getSection('companyInfo');
        companyNameField.value = section.name || '';
        companyCrNumberField.value = section.crNumber || '';
        companyTaxNumberField.value = section.taxNumber || '';
        companyPhoneField.value = section.phone || '';
        companyAddressField.value = section.address || '';
        companyEmailField.value = section.email || '';
        companyWebsiteField.value = section.website || '';
        if (section.logoUrl) {
            companyLogoPreview.src = section.logoUrl;
            companyLogoPreview.classList.remove('hidden');
        } else {
            companyLogoPreview.classList.add('hidden');
        }
    }

    function hydrateGeneralSettings() {
        const section = window.AppConfig.getSection('generalSettings');
        window.AppConfig.populateSelect(defaultCurrencyField, 'currencies', { preserveValue: false });
        window.AppConfig.populateSelect(dateFormatField, 'dateFormats', { preserveValue: false });
        defaultCurrencyField.value = section.currency || 'EGP';
        dateFormatField.value = section.dateFormat || 'dd/mm/yyyy';
        themeModeField.value = section.themeMode || 'system';
        generalDefaultWarehouseField.value = section.defaultWarehouseId || '';
        compactSidebarField.checked = Boolean(section.compactSidebar);
        denseTablesField.checked = Boolean(section.denseTables);
    }

    function hydrateFinancialSettings() {
        const section = window.AppConfig.getSection('financialSettings');
        vatPercentageField.value = Number(section.vatPercentage ?? 14);
        creditGraceDaysField.value = Number(section.creditGraceDays ?? 0);
        enableVatField.checked = Boolean(section.enableVat);
        roundInvoicesField.checked = Boolean(section.roundInvoices);
    }

    function hydrateInventorySettings() {
        const section = window.AppConfig.getSection('inventorySettings');
        lowStockThresholdField.value = Number(section.lowStockThreshold ?? 10);
        inventoryDefaultWarehouseField.value = section.defaultWarehouseId || '';
        allowNegativeStockField.checked = Boolean(section.allowNegativeStock);
        autoReserveStockField.checked = Boolean(section.autoReserveStock);
    }

    function hydrateSalesSettings() {
        const section = window.AppConfig.getSection('salesSettings');
        window.AppConfig.populateSelect(salesDefaultPaymentMethodField, 'salePaymentMethods', { preserveValue: false });
        salesDefaultWarehouseField.value = section.defaultWarehouseId || '';
        salesDefaultPaymentMethodField.value = section.defaultPaymentMethod || 'cash';
        salesDefaultTaxRateField.value = Number(section.defaultTaxRate ?? 14);
        requireSalespersonField.checked = Boolean(section.requireSalesperson);
        autoPrintAfterSaveField.checked = Boolean(section.autoPrintAfterSave);
    }

    function hydrateNotificationsSettings() {
        const section = window.AppConfig.getSection('notificationsSettings');
        toastDurationField.value = Number(section.toastDuration ?? 4500);
        toastPositionField.value = section.toastPosition || 'top-left';
        notifyInvoiceSaveField.checked = Boolean(section.notifyInvoiceSave);
        emailNewOrderField.checked = Boolean(section.notifyNewOrder);
        emailLowStockField.checked = Boolean(section.notifyLowStock);
    }

    function renderPermissionsRoleOptions() {
        permissionsRoleSelect.innerHTML = window.AppConfig.roles
            .map((role) => `<option value="${role}">${window.AppConfig.roleLabels[role] || role}</option>`)
            .join('');
    }

    function renderPermissionModuleOptions() {
        permissionOverrideModuleField.innerHTML = Object.entries(window.AppConfig.modules)
            .map(([moduleId, module]) => `<option value="${moduleId}">${module.label}</option>`)
            .join('');
        syncPermissionActionOptions();
    }

    function syncPermissionActionOptions() {
        const moduleId = permissionOverrideModuleField.value || 'dashboard';
        const actions = window.AppConfig.modules[moduleId]?.actions || ['view'];
        permissionOverrideActionField.innerHTML = actions
            .map((action) => `<option value="${action}">${action}</option>`)
            .join('');
    }

    function renderPermissionsMatrix() {
        const role = permissionsRoleSelect.value || 'admin';
        const matrix = window.AppConfig.getPermissionMatrix()[role] || {};
        permissionsMatrixBody.innerHTML = Object.entries(window.AppConfig.modules).map(([moduleId, module]) => {
            const cells = module.actions.map((action) => {
                const checked = matrix[moduleId]?.[action] ? 'checked' : '';
                return `<label class="permissions-chip"><input type="checkbox" data-module-id="${moduleId}" data-action="${action}" class="form-checkbox-input" ${checked}><span>${action}</span></label>`;
            }).join(' ');
            return `<tr><td><strong>${module.label}</strong></td><td>${cells}</td></tr>`;
        }).join('');
    }

    function renderUserOverridesTable() {
        const selectedUserId = permissionOverrideUserField.value;
        userPermissionOverridesBody.innerHTML = '';
        if (!selectedUserId) {
            userPermissionOverridesBody.innerHTML = '<tr><td colspan="4"><div class="empty-state">اختر مستخدماً لعرض الاستثناءات.</div></td></tr>';
            return;
        }

        const overrides = window.AppConfig.getUserPermissionOverrides()[selectedUserId] || {};
        const rows = [];
        Object.entries(overrides).forEach(([moduleId, actions]) => {
            Object.entries(actions).forEach(([action, allowed]) => {
                rows.push({
                    moduleId,
                    action,
                    allowed,
                    moduleLabel: window.AppConfig.modules[moduleId]?.label || moduleId
                });
            });
        });

        if (!rows.length) {
            userPermissionOverridesBody.innerHTML = '<tr><td colspan="4"><div class="empty-state">لا توجد استثناءات مخصصة لهذا المستخدم.</div></td></tr>';
            return;
        }

        rows.forEach(({ moduleId, action, allowed, moduleLabel }) => {
            const row = document.createElement('tr');

            const moduleCell = document.createElement('td');
            moduleCell.textContent = moduleLabel;

            const actionCell = document.createElement('td');
            actionCell.textContent = action;

            const allowedCell = document.createElement('td');
            allowedCell.textContent = allowed ? 'سماح' : 'منع';

            const actionsCell = document.createElement('td');
            const removeButton = document.createElement('button');
            removeButton.type = 'button';
            removeButton.className = 'text-red-600 remove-override-btn';
            removeButton.dataset.userId = selectedUserId;
            removeButton.dataset.moduleId = moduleId;
            removeButton.dataset.action = action;
            removeButton.innerHTML = '<i class="fas fa-trash"></i>';
            actionsCell.appendChild(removeButton);

            row.append(moduleCell, actionCell, allowedCell, actionsCell);
            userPermissionOverridesBody.appendChild(row);
        });

        userPermissionOverridesBody.querySelectorAll('.remove-override-btn').forEach((button) => {
            button.addEventListener('click', async () => {
                const userId = button.dataset.userId;
                const moduleId = button.dataset.moduleId;
                const action = button.dataset.action;
                const overridesSnapshot = window.AppConfig.getUserPermissionOverrides();
                delete overridesSnapshot[userId]?.[moduleId]?.[action];
                if (overridesSnapshot[userId]?.[moduleId] && Object.keys(overridesSnapshot[userId][moduleId]).length === 0) {
                    delete overridesSnapshot[userId][moduleId];
                }
                if (overridesSnapshot[userId] && Object.keys(overridesSnapshot[userId]).length === 0) {
                    delete overridesSnapshot[userId];
                }
                await window.AppConfig.saveSection(window.AppConfig.settingKeys.userPermissionOverrides, overridesSnapshot);
                renderUserOverridesTable();
                window.AppNotify?.success('تم حذف الصلاحية المخصصة بنجاح.');
            });
        });
    }

    function renderLookupCategoryOptions() {
        lookupCategoryField.innerHTML = Object.keys(LOOKUP_LABELS)
            .map((key) => `<option value="${key}">${LOOKUP_LABELS[key]}</option>`)
            .join('');
    }

    function renderLookupItems() {
        const catalog = window.AppConfig.getSection('lookupCatalog');
        const category = lookupCategoryField.value;
        const items = catalog[category] || [];
        lookupItemsBody.innerHTML = items.length
            ? items.map((item) => `
                <tr>
                    <td>${item.value}</td>
                    <td>${item.label}</td>
                    <td><button type="button" class="text-red-600 remove-lookup-item-btn" data-value="${item.value}"><i class="fas fa-trash"></i></button></td>
                </tr>
            `).join('')
            : '<tr><td colspan="3"><div class="empty-state">لا توجد عناصر في هذه القائمة بعد.</div></td></tr>';

        lookupItemsBody.querySelectorAll('.remove-lookup-item-btn').forEach((button) => {
            button.addEventListener('click', async () => {
                const value = button.dataset.value;
                const catalogSnapshot = window.AppConfig.getSection('lookupCatalog');
                catalogSnapshot[category] = (catalogSnapshot[category] || []).filter((item) => item.value !== value);
                await window.AppConfig.saveSection(window.AppConfig.settingKeys.lookupCatalog, catalogSnapshot);
                renderLookupItems();
                hydrateGeneralSettings();
                hydrateSalesSettings();
                window.AppNotify?.success('تم حذف عنصر القائمة.');
            });
        });
    }

    function withSubmit(buttonSourceEvent, callback) {
        return (async () => {
            const submitter = buttonSourceEvent?.submitter;
            if (submitter) window.showButtonSpinner(submitter, true);
            try {
                await callback();
            } finally {
                if (submitter) window.showButtonSpinner(submitter, false);
            }
        })();
    }

    async function hydrateAll() {
        await Promise.all([loadWarehouses(), loadUsersForOverrides()]);
        hydrateCompanyInfo();
        hydrateGeneralSettings();
        hydrateFinancialSettings();
        hydrateInventorySettings();
        hydrateSalesSettings();
        hydrateNotificationsSettings();
        renderPermissionsRoleOptions();
        renderPermissionModuleOptions();
        renderPermissionsMatrix();
        renderUserOverridesTable();
        renderLookupCategoryOptions();
        renderLookupItems();
    }

    tabButtons.forEach((button) => {
        button.addEventListener('click', () => switchSettingsTab(button.dataset.tabTarget));
    });

    companyLogoField?.addEventListener('change', (event) => {
        const file = event.target.files?.[0];
        if (!file) {
            companyLogoPreview.classList.add('hidden');
            return;
        }
        const reader = new FileReader();
        reader.onload = (loadEvent) => {
            companyLogoPreview.src = loadEvent.target?.result;
            companyLogoPreview.classList.remove('hidden');
        };
        reader.readAsDataURL(file);
    });

    permissionsRoleSelect?.addEventListener('change', renderPermissionsMatrix);
    permissionOverrideUserField?.addEventListener('change', renderUserOverridesTable);
    permissionOverrideModuleField?.addEventListener('change', syncPermissionActionOptions);
    lookupCategoryField?.addEventListener('change', renderLookupItems);

    companyInfoForm?.addEventListener('submit', async (event) => {
        event.preventDefault();
        await withSubmit(event, async () => {
            await window.AppConfig.saveSection(window.AppConfig.settingKeys.companyInfo, {
                name: companyNameField.value.trim(),
                crNumber: companyCrNumberField.value.trim(),
                taxNumber: companyTaxNumberField.value.trim(),
                phone: companyPhoneField.value.trim(),
                address: companyAddressField.value.trim(),
                email: companyEmailField.value.trim(),
                website: companyWebsiteField.value.trim(),
                logoUrl: companyLogoPreview.classList.contains('hidden') ? null : companyLogoPreview.src
            });
            window.AppNotify?.success('تم حفظ معلومات الشركة.');
        });
    });

    generalSettingsForm?.addEventListener('submit', async (event) => {
        event.preventDefault();
        await withSubmit(event, async () => {
            await window.AppConfig.saveSection(window.AppConfig.settingKeys.generalSettings, {
                currency: defaultCurrencyField.value,
                dateFormat: dateFormatField.value,
                themeMode: themeModeField.value,
                compactSidebar: compactSidebarField.checked,
                denseTables: denseTablesField.checked,
                defaultWarehouseId: generalDefaultWarehouseField.value || null
            });
            window.AppNotify?.success('تم حفظ الإعدادات العامة.');
        });
    });

    financialSettingsForm?.addEventListener('submit', async (event) => {
        event.preventDefault();
        await withSubmit(event, async () => {
            await window.AppConfig.saveSection(window.AppConfig.settingKeys.financialSettings, {
                vatPercentage: Number(vatPercentageField.value || 0),
                creditGraceDays: Number(creditGraceDaysField.value || 0),
                enableVat: enableVatField.checked,
                roundInvoices: roundInvoicesField.checked
            });
            window.AppNotify?.success('تم حفظ الإعدادات المالية.');
        });
    });

    inventorySettingsForm?.addEventListener('submit', async (event) => {
        event.preventDefault();
        await withSubmit(event, async () => {
            await window.AppConfig.saveSection(window.AppConfig.settingKeys.inventorySettings, {
                lowStockThreshold: Number(lowStockThresholdField.value || 0),
                defaultWarehouseId: inventoryDefaultWarehouseField.value || null,
                allowNegativeStock: allowNegativeStockField.checked,
                autoReserveStock: autoReserveStockField.checked
            });
            window.AppNotify?.success('تم حفظ إعدادات المخزون.');
        });
    });

    salesSettingsForm?.addEventListener('submit', async (event) => {
        event.preventDefault();
        await withSubmit(event, async () => {
            await window.AppConfig.saveSection(window.AppConfig.settingKeys.salesSettings, {
                defaultWarehouseId: salesDefaultWarehouseField.value || null,
                defaultPaymentMethod: salesDefaultPaymentMethodField.value || 'cash',
                defaultTaxRate: Number(salesDefaultTaxRateField.value || 0),
                requireSalesperson: requireSalespersonField.checked,
                autoPrintAfterSave: autoPrintAfterSaveField.checked
            });
            window.AppNotify?.success('تم حفظ إعدادات المبيعات.');
        });
    });

    notificationsSettingsForm?.addEventListener('submit', async (event) => {
        event.preventDefault();
        await withSubmit(event, async () => {
            await window.AppConfig.saveSection(window.AppConfig.settingKeys.notificationsSettings, {
                toastDuration: Math.max(1500, Number(toastDurationField.value || 4500)),
                toastPosition: toastPositionField.value || 'top-left',
                notifyInvoiceSave: notifyInvoiceSaveField.checked,
                notifyNewOrder: emailNewOrderField.checked,
                notifyLowStock: emailLowStockField.checked
            });
            window.AppNotify?.success('تم حفظ إعدادات الإشعارات.');
        });
    });

    permissionsMatrixForm?.addEventListener('submit', async (event) => {
        event.preventDefault();
        await withSubmit(event, async () => {
            const role = permissionsRoleSelect.value;
            const matrixSnapshot = window.AppConfig.getPermissionMatrix();
            matrixSnapshot[role] = matrixSnapshot[role] || {};
            Object.entries(window.AppConfig.modules).forEach(([moduleId, module]) => {
                matrixSnapshot[role][moduleId] = matrixSnapshot[role][moduleId] || {};
                module.actions.forEach((action) => {
                    const field = permissionsMatrixBody.querySelector(`input[data-module-id="${moduleId}"][data-action="${action}"]`);
                    matrixSnapshot[role][moduleId][action] = Boolean(field?.checked);
                });
            });
            await window.AppConfig.saveSection(window.AppConfig.settingKeys.permissionMatrix, matrixSnapshot);
            window.AppNotify?.success('تم حفظ صلاحيات الدور.');
        });
    });

    userPermissionOverrideForm?.addEventListener('submit', async (event) => {
        event.preventDefault();
        try {
            await withSubmit(event, async () => {
                const userId = permissionOverrideUserField.value;
                const moduleId = permissionOverrideModuleField.value;
                const action = permissionOverrideActionField.value;
                const mode = permissionOverrideModeField.value;
                if (!userId || !moduleId || !action) {
                    throw new Error('يرجى تحديد المستخدم والوحدة والإجراء.');
                }
                const overridesSnapshot = window.AppConfig.getUserPermissionOverrides();
                overridesSnapshot[userId] = overridesSnapshot[userId] || {};
                overridesSnapshot[userId][moduleId] = overridesSnapshot[userId][moduleId] || {};
                overridesSnapshot[userId][moduleId][action] = mode === 'allow';
                await window.AppConfig.saveSection(window.AppConfig.settingKeys.userPermissionOverrides, overridesSnapshot);
                renderUserOverridesTable();
                window.AppNotify?.success('تم حفظ الاستثناء المخصص.');
            });
        } catch (error) {
            window.AppNotify.error(error.message || 'فشل حفظ الاستثناء.');
        }
    });

    addLookupItemBtn?.addEventListener('click', async () => {
        const category = lookupCategoryField.value;
        const value = lookupItemValueField.value.trim();
        const label = lookupItemLabelField.value.trim();
        if (!category || !value || !label) {
            window.AppNotify.warning('أدخل القيمة الفنية والعنوان قبل الإضافة.');
            return;
        }
        const catalogSnapshot = window.AppConfig.getSection('lookupCatalog');
        catalogSnapshot[category] = catalogSnapshot[category] || [];
        const exists = catalogSnapshot[category].some((item) => item.value === value);
        if (exists) {
            window.AppNotify.warning('هذه القيمة موجودة بالفعل في القائمة المحددة.');
            return;
        }
        catalogSnapshot[category].push({ value, label });
        await window.AppConfig.saveSection(window.AppConfig.settingKeys.lookupCatalog, catalogSnapshot);
        lookupItemValueField.value = '';
        lookupItemLabelField.value = '';
        renderLookupItems();
        hydrateGeneralSettings();
        hydrateSalesSettings();
        window.AppNotify?.success('تمت إضافة عنصر جديد للقائمة.');
    });

    await hydrateAll();
}
