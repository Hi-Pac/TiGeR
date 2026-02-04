let allCustomersData = []; // To store fetched customers for client-side filtering

async function initCustomersModule() {
    console.log("Customers Module Initialized!");

    const customersModuleNode = document.getElementById('customers-module');
    if (!customersModuleNode) {
        console.error("Customers module container not found.");
        return;
    }

    const customersTableBody = customersModuleNode.querySelector('#customers-table-body');
    const customerFormElement = customersModuleNode.querySelector('#customer-form');
    const customerIdField = customersModuleNode.querySelector('#customer-id-field');
    const customerShopNameField = customersModuleNode.querySelector('#customer-shop-name-field');
    const customerOwnerNameField = customersModuleNode.querySelector('#customer-owner-name-field');
    const customerPhoneField = customersModuleNode.querySelector('#customer-phone-field');
    const customerPhone2Field = customersModuleNode.querySelector('#customer-phone2-field');
    const customerEmailField = customersModuleNode.querySelector('#customer-email-field');
    const customerAreaField = customersModuleNode.querySelector('#customer-area-field');
    const customerAddressField = customersModuleNode.querySelector('#customer-address-field');
    const customerCreditLimitField = customersModuleNode.querySelector('#customer-credit-limit-field');
    const customerOpeningBalanceField = customersModuleNode.querySelector('#customer-opening-balance-field');
    const customerStatusField = customersModuleNode.querySelector('#customer-status-field');
    const customerNotesField = customersModuleNode.querySelector('#customer-notes-field');
    const saveCustomerBtn = customersModuleNode.querySelector('#save-customer-form-btn');

    // Filter inputs
    const customerSearchInput = customersModuleNode.querySelector('#customer-search-input');
    const customerAreaFilter = customersModuleNode.querySelector('#customer-area-filter');
    const customerStatusFilter = customersModuleNode.querySelector('#customer-status-filter');


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
            const customersSnapshot = await db.collection('customers').get();
            allCustomersData = customersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
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
        if (!customerAreaFilter) return;
        const existingOptions = Array.from(customerAreaFilter.options).map(opt => opt.value);
        const distinctAreas = [...new Set(customers.map(c => c.area).filter(area => area && !existingOptions.includes(area)))];
        distinctAreas.sort();
        distinctAreas.forEach(area => {
            const option = new Option(area, area);
            customerAreaFilter.add(option);
        });
    }

    function applyCustomerFiltersAndRender() {
        if(!customersTableBody) return;
        let filteredCustomers = [...allCustomersData];

        const searchTerm = customerSearchInput.value.toLowerCase();
        const area = customerAreaFilter.value;
        const status = customerStatusFilter.value;

        if (searchTerm) {
            filteredCustomers = filteredCustomers.filter(cust =>
                cust.shopName.toLowerCase().includes(searchTerm) ||
                (cust.ownerName && cust.ownerName.toLowerCase().includes(searchTerm)) ||
                cust.phone.includes(searchTerm) ||
                (cust.phone2 && cust.phone2.includes(searchTerm))
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
                    <span class="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full 
                        ${customer.status === 'active' ? 'bg-green-100 text-green-800 dark:bg-green-700 dark:text-green-100' : 'bg-red-100 text-red-800 dark:bg-red-700 dark:text-red-100'}">
                        ${customer.status === 'active' ? 'نشط' : 'غير نشط'}
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
                // TODO: Implement logic to show customer statement (e.g., in a modal or new view)
                alert(`عرض كشف حساب للعميل ID: ${customerId} (قيد الإنشاء)`);
            });
        });
    }

    if (customerFormElement) {
        customerFormElement.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!saveCustomerBtn) return;
            window.showButtonSpinner(saveCustomerBtn, true);

            const customerData = {
                shopName: customerShopNameField.value,
                ownerName: customerOwnerNameField.value,
                phone: customerPhoneField.value,
                phone2: customerPhone2Field.value,
                email: customerEmailField.value,
                area: customerAreaField.value,
                address: customerAddressField.value,
                creditLimit: parseFloat(customerCreditLimitField.value) || 0,
                openingBalance: parseFloat(customerOpeningBalanceField.value) || 0,
                status: customerStatusField.value,
                notes: customerNotesField.value,
                // currentBalance will be calculated based on openingBalance and transactions
            };
            const customerId = customerIdField.value;

            try {
                if (customerId) {
                    customerData.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
                    await db.collection('customers').doc(customerId).update(customerData);
                    console.log("Customer updated successfully");
                } else {
                    customerData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
                    customerData.currentBalance = customerData.openingBalance;
                    await db.collection('customers').add(customerData);
                    console.log("Customer added successfully");
                }
                const closeBtn = customersModuleNode.querySelector('#close-customer-form-btn');
                if (closeBtn) closeBtn.click();
                await loadAndRenderCustomers();
            } catch (error) {
                console.error("Error saving customer:", error);
                alert(`فشل حفظ العميل: ${error.message}`);
            } finally {
                window.showButtonSpinner(saveCustomerBtn, false);
            }
        });
    }

    async function handleDeleteCustomer(customerId) {
        if (confirm('هل أنت متأكد أنك تريد حذف هذا العميل؟')) {
            try {
                await db.collection('customers').doc(customerId).delete();
                console.log('Customer deleted successfully');
                await loadAndRenderCustomers();
            } catch (error) {
                console.error("Error deleting customer:", error);
                alert('فشل حذف العميل.');
            }
        }
    }

    // Add event listeners for filters
    if (customerSearchInput) customerSearchInput.addEventListener('input', applyCustomerFiltersAndRender);
    if (customerAreaFilter) customerAreaFilter.addEventListener('change', applyCustomerFiltersAndRender);
    if (customerStatusFilter) customerStatusFilter.addEventListener('change', applyCustomerFiltersAndRender);

    loadAndRenderCustomers();
}