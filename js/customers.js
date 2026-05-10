let allCustomersData = []; // To store fetched customers for client-side filtering
const CUSTOMER_STATUS_LABEL_BY_VALUE = { active: 'نشط', inactive: 'غير نشط', blocked: 'محظور' };
const CUSTOMER_STATUS_CLASS_BY_VALUE = {
    active: 'bg-green-100 text-green-800 dark:bg-green-700 dark:text-green-100',
    inactive: 'bg-red-100 text-red-800 dark:bg-red-700 dark:text-red-100',
    blocked: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-700 dark:text-yellow-100'
};

async function initCustomersModule() {
    console.log("Customers Module Initialized!");

    const customersModuleNode = document.getElementById('customers-module');
    if (!customersModuleNode) {
        console.error("Customers module container not found.");
        return;
    }

    const customersTableBody = customersModuleNode.querySelector('#customers-table-body');
    const customerFormElement = document.getElementById('customer-form');
    const customerIdField = document.getElementById('customer-id-field');
    const customerShopNameField = document.getElementById('customer-shop-name-field');
    const customerOwnerNameField = document.getElementById('customer-owner-name-field');
    const customerPhoneField = document.getElementById('customer-phone-field');
    const customerPhone2Field = document.getElementById('customer-phone2-field');
    const customerEmailField = document.getElementById('customer-email-field');
    const customerAreaField = document.getElementById('customer-area-field');
    const customerAreaDatalist = document.getElementById('customer-area-list');
    const customerAddressField = document.getElementById('customer-address-field');
    const customerCreditLimitField = document.getElementById('customer-credit-limit-field');
    const customerOpeningBalanceField = document.getElementById('customer-opening-balance-field');
    const customerStatusField = document.getElementById('customer-status-field');
    const customerNotesField = document.getElementById('customer-notes-field');
    const saveCustomerBtn = document.getElementById('save-customer-form-btn');

    // Filter inputs
    const customerSearchInput = customersModuleNode.querySelector('#customer-search-input');
    const customerAreaFilter = customersModuleNode.querySelector('#customer-area-filter');
    const customerStatusFilter = customersModuleNode.querySelector('#customer-status-filter');

    const mapCustomerRowToViewModel = (row) => ({
        id: row.id,
        shopName: row.shop_name || '',
        ownerName: row.owner_name || '',
        phone: row.phone || '',
        phone2: row.phone2 || '',
        email: row.email || '',
        area: row.area || '',
        address: row.address || '',
        creditLimit: Number(row.credit_limit || 0),
        openingBalance: Number(row.opening_balance || 0),
        currentBalance: Number(row.current_balance || 0),
        status: row.status || 'active',
        notes: row.notes || ''
    });


    function resetCustomerForm(customerData = null) {
        if (!customerFormElement) return;
        customerFormElement.reset();
        customerIdField.value = '';

        if (customerData) {
            customerIdField.value = customerData.id;
            customerShopNameField.value = customerData.shopName || '';
            customerOwnerNameField.value = customerData.ownerName || '';
            customerPhoneField.value = customerData.phone || '';
            customerPhone2Field.value = customerData.phone2 || '';
            customerEmailField.value = customerData.email || '';
            customerAreaField.value = customerData.area || '';
            customerAddressField.value = customerData.address || '';
            customerCreditLimitField.value = customerData.creditLimit || 0;
            customerOpeningBalanceField.value = customerData.openingBalance || 0;
            customerStatusField.value = customerData.status || 'active';
            customerNotesField.value = customerData.notes || '';
        }
    }

    const openCustomerFormForEdit = window.setupFormToggle({
        currentModule: 'customers',
        addButtonId: 'add-customer-btn',
        formContainerId: 'customer-form-container',
        closeButtonId: 'close-customer-form-btn',
        cancelButtonId: 'cancel-customer-form-btn',
        formId: 'customer-form',
        formTitleId: 'customer-form-title',
        addTitle: 'إضافة عميل جديد',
        editTitle: 'تعديل بيانات العميل',
        resetFormFunction: resetCustomerForm
    });

    async function loadAndRenderCustomers() {
        if (!customersTableBody) return;
        customersTableBody.innerHTML = `<tr><td colspan="7" class="text-center p-4">جاري تحميل العملاء...</td></tr>`;
        try {
            const { data } = await DB
                .from('customers')
                .select('*')
                .order('shop_name', { ascending: true })
                .get();
            allCustomersData = (data || []).map(mapCustomerRowToViewModel);
            allCustomersData.sort((a, b) => (a.shopName || '').localeCompare(b.shopName || ''));
            console.log("Customers loaded:", allCustomersData);
            populateAreaFilter(allCustomersData);
            applyCustomerFiltersAndRender();
        } catch (error) {
            console.error("Error loading customers:", error);
            customersTableBody.innerHTML = `<tr><td colspan="7" class="text-center p-4 text-red-500">فشل تحميل العملاء.</td></tr>`;
        }
    }
    
    function populateAreaFilter(customers) {
        const configuredAreas = (window.AppConfig?.getLookupOptions('customerAreas') || []).map((item) => item.label || item.value);
        const distinctAreas = [...new Set([...configuredAreas, ...customers.map((customer) => customer.area).filter(Boolean)])].sort();

        if (customerAreaFilter) {
            const selectedArea = customerAreaFilter.value;
            customerAreaFilter.innerHTML = '<option value="">كل المناطق</option>' +
                distinctAreas.map((area) => `<option value="${area}">${area}</option>`).join('');
            customerAreaFilter.value = selectedArea && distinctAreas.includes(selectedArea) ? selectedArea : '';
        }

        if (customerAreaDatalist) {
            customerAreaDatalist.innerHTML = distinctAreas.map((area) => `<option value="${area}"></option>`).join('');
        }
    }

    function applyCustomerFiltersAndRender() {
        if(!customersTableBody) return;
        let filteredCustomers = [...allCustomersData];

        const searchTerm = customerSearchInput.value.toLowerCase();
        const area = customerAreaFilter.value;
        const status = customerStatusFilter.value;

        if (searchTerm) {
            filteredCustomers = filteredCustomers.filter(cust =>
                (cust.shopName || '').toLowerCase().includes(searchTerm) ||
                (cust.ownerName || '').toLowerCase().includes(searchTerm) ||
                (cust.phone || '').includes(searchTerm) ||
                (cust.phone2 || '').includes(searchTerm)
            );
        }
        if (area) {
            filteredCustomers = filteredCustomers.filter(cust => cust.area === area);
        }
        if (status) {
            filteredCustomers = filteredCustomers.filter(cust => cust.status === status);
        }
        renderCustomersTable(filteredCustomers);
    }

    function renderCustomersTable(customersToRender) {
        if (!customersTableBody) return;
        customersTableBody.innerHTML = '';

        if (customersToRender.length === 0) {
            customersTableBody.innerHTML = `<tr><td colspan="7" class="text-center p-4">لا يوجد عملاء يطابقون معايير البحث.</td></tr>`;
            return;
        }

        customersToRender.forEach(customer => {
            const row = customersTableBody.insertRow();
            // currentBalance should be calculated/fetched in a real app
            const currentBalance = customer.currentBalance !== undefined ? customer.currentBalance : customer.openingBalance;
            const balanceColor = currentBalance >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';
            const customerStatusClass = CUSTOMER_STATUS_CLASS_BY_VALUE[customer.status] || CUSTOMER_STATUS_CLASS_BY_VALUE.inactive;
            const customerStatusLabel = CUSTOMER_STATUS_LABEL_BY_VALUE[customer.status] || customer.status;

            row.innerHTML = `
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm font-medium text-gray-900 dark:text-gray-100">${customer.shopName}</div>
                    <div class="text-xs text-gray-500 dark:text-gray-400">${customer.ownerName || 'غير محدد'}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">${customer.phone}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">${customer.area || 'N/A'}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium ${balanceColor}">${currentBalance} ج.م</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">${customer.creditLimit} ج.م</td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${customerStatusClass}">
                        ${customerStatusLabel}
                    </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-left"> <!-- text-left for actions -->
                    <button class="text-primary hover:text-primary/80 ml-2 edit-customer-btn" data-id="${customer.id}" title="تعديل"><i class="fas fa-edit"></i></button>
                    <button class="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 ml-2 delete-customer-btn" data-id="${customer.id}" title="حذف"><i class="fas fa-trash-alt"></i></button>
                    <button class="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 view-customer-statement-btn" data-id="${customer.id}" title="كشف حساب"><i class="fas fa-file-invoice-dollar"></i></button>
                </td>
            `;
        });

        customersModuleNode.querySelectorAll('.edit-customer-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const customerId = e.currentTarget.getAttribute('data-id');
                const customerToEdit = allCustomersData.find(c => c.id === customerId);
                if (customerToEdit) {
                    openCustomerFormForEdit(customerToEdit);
                }
            });
        });

        customersModuleNode.querySelectorAll('.delete-customer-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const customerId = e.currentTarget.getAttribute('data-id');
                handleDeleteCustomer(customerId);
            });
        });
        
        customersModuleNode.querySelectorAll('.view-customer-statement-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const customerId = e.currentTarget.getAttribute('data-id');
                window.AppNotify?.info(`عرض كشف حساب للعميل ID: ${customerId} (قيد الإنشاء)`);
            });
        });

        window.applyModuleActionGuards?.('customers', customersModuleNode);
    }

    if (customerFormElement) {
        customerFormElement.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!saveCustomerBtn) return;
            window.showButtonSpinner(saveCustomerBtn, true);

            const customerData = {
                shop_name: customerShopNameField.value.trim(),
                owner_name: customerOwnerNameField.value.trim(),
                phone: customerPhoneField.value.trim(),
                phone2: customerPhone2Field.value.trim(),
                email: customerEmailField.value.trim(),
                area: customerAreaField.value.trim(),
                address: customerAddressField.value.trim(),
                credit_limit: parseFloat(customerCreditLimitField.value) || 0,
                opening_balance: parseFloat(customerOpeningBalanceField.value) || 0,
                status: customerStatusField.value,
                notes: customerNotesField.value.trim()
            };
            const customerId = customerIdField.value;

            try {
                if (customerId) {
                    await DB
                        .from('customers')
                        .eq('id', customerId)
                        .update(customerData);
                    console.log("Customer updated successfully");
                } else {
                    customerData.current_balance = customerData.opening_balance;
                    await DB.from('customers').insert(customerData);
                    console.log("Customer added successfully");
                }
                const closeBtn = document.getElementById('close-customer-form-btn');
                if (closeBtn) closeBtn.click();
                await loadAndRenderCustomers();
                window.AppNotify?.success(customerId ? 'تم تحديث بيانات العميل.' : 'تمت إضافة العميل بنجاح.');
            } catch (error) {
                console.error("Error saving customer:", error);
                window.AppNotify?.error(`فشل حفظ العميل: ${error.message}`);
            } finally {
                window.showButtonSpinner(saveCustomerBtn, false);
            }
        });
    }

    async function handleDeleteCustomer(customerId) {
        if (confirm('هل أنت متأكد أنك تريد حذف هذا العميل؟')) {
            try {
                await DB
                    .from('customers')
                    .eq('id', customerId)
                    .softDelete();
                console.log('Customer deleted successfully');
                await loadAndRenderCustomers();
                window.AppNotify?.success('تم حذف العميل.');
            } catch (error) {
                console.error("Error deleting customer:", error);
                window.AppNotify?.error('فشل حذف العميل.');
            }
        }
    }

    // Add event listeners for filters
    if (customerSearchInput) customerSearchInput.addEventListener('input', applyCustomerFiltersAndRender);
    if (customerAreaFilter) customerAreaFilter.addEventListener('change', applyCustomerFiltersAndRender);
    if (customerStatusFilter) customerStatusFilter.addEventListener('change', applyCustomerFiltersAndRender);

    await loadAndRenderCustomers();
    window.applyModuleActionGuards?.('customers', customersModuleNode);
    console.log("✅ Customers module initialized successfully");
}
