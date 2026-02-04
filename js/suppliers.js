let allSuppliersData = []; // To store fetched suppliers for client-side filtering

async function initSuppliersModule() {
    console.log("Suppliers Module Initialized!");

    const suppliersModuleNode = document.getElementById('suppliers-module');
    if (!suppliersModuleNode) {
        console.error("Suppliers module container not found.");
        return;
    }

    const suppliersTableBody = suppliersModuleNode.querySelector('#suppliers-table-body');
    const supplierFormElement = suppliersModuleNode.querySelector('#supplier-form');
    const supplierIdField = suppliersModuleNode.querySelector('#supplier-id-field');
    const supplierCompanyNameField = suppliersModuleNode.querySelector('#supplier-company-name-field');
    const supplierContactPersonField = suppliersModuleNode.querySelector('#supplier-contact-person-field');
    const supplierPhoneField = suppliersModuleNode.querySelector('#supplier-phone-field');
    const supplierEmailField = suppliersModuleNode.querySelector('#supplier-email-field');
    const supplierAddressField = suppliersModuleNode.querySelector('#supplier-address-field');
    const supplierOpeningBalanceField = suppliersModuleNode.querySelector('#supplier-opening-balance-field');
    const supplierPaymentTermsField = suppliersModuleNode.querySelector('#supplier-payment-terms-field');
    const supplierStatusField = suppliersModuleNode.querySelector('#supplier-status-field');
    const supplierProductCategoriesCheckboxesContainer = suppliersModuleNode.querySelector('#supplier-product-categories-checkboxes');
    const supplierNotesField = suppliersModuleNode.querySelector('#supplier-notes-field');
    const saveSupplierBtn = suppliersModuleNode.querySelector('#save-supplier-form-btn');

    // Filter inputs
    const supplierSearchInput = suppliersModuleNode.querySelector('#supplier-search-input');
    const supplierCategoryFilter = suppliersModuleNode.querySelector('#supplier-category-filter');
    const supplierStatusFilter = suppliersModuleNode.querySelector('#supplier-status-filter');

    function getSelectedCategories() {
        const checkboxes = supplierProductCategoriesCheckboxesContainer.querySelectorAll('input[type="checkbox"]:checked');
        return Array.from(checkboxes).map(cb => cb.value);
    }

    function setSelectedCategories(categoriesArray = []) {
        const allCheckboxes = supplierProductCategoriesCheckboxesContainer.querySelectorAll('input[type="checkbox"]');
        allCheckboxes.forEach(cb => {
            cb.checked = categoriesArray.includes(cb.value);
        });
    }


    function resetSupplierForm(supplierData = null) {
        if (!supplierFormElement) return;
        supplierFormElement.reset(); // Resets native form elements to their default values
        supplierIdField.value = '';
        setSelectedCategories([]); // Clear all checkboxes

        if (supplierData) {
            supplierIdField.value = supplierData.id;
            supplierCompanyNameField.value = supplierData.companyName || '';
            supplierContactPersonField.value = supplierData.contactPerson || '';
            supplierPhoneField.value = supplierData.phone || '';
            supplierEmailField.value = supplierData.email || '';
            supplierAddressField.value = supplierData.address || '';
            supplierOpeningBalanceField.value = supplierData.openingBalance || 0;
            supplierPaymentTermsField.value = supplierData.paymentTerms || '';
            supplierStatusField.value = supplierData.status || 'active';
            if (supplierData.productCategories && Array.isArray(supplierData.productCategories)) {
                 setSelectedCategories(supplierData.productCategories);
            }
            supplierNotesField.value = supplierData.notes || '';
        }
    }

    const openSupplierFormForEdit = window.setupFormToggle({
        currentModule: 'suppliers',
        addButtonId: 'add-supplier-btn',
        formContainerId: 'supplier-form-container',
        closeButtonId: 'close-supplier-form-btn',
        cancelButtonId: 'cancel-supplier-form-btn',
        formId: 'supplier-form',
        formTitleId: 'supplier-form-title',
        addTitle: 'إضافة مورد جديد',
        editTitle: 'تعديل بيانات المورد',
        resetFormFunction: resetSupplierForm
    });

    async function loadAndRenderSuppliers() {
        if (!suppliersTableBody) return;
        suppliersTableBody.innerHTML = `<tr><td colspan="6" class="text-center p-4">جاري تحميل الموردين...</td></tr>`;
        try {
            const suppliersSnapshot = await db.collection('suppliers').orderBy('companyName').get();
            allSuppliersData = suppliersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            console.log("Suppliers loaded:", allSuppliersData);
            applySupplierFiltersAndRender();
        } catch (error) {
            console.error("Error loading suppliers:", error);
            suppliersTableBody.innerHTML = `<tr><td colspan="6" class="text-center p-4 text-red-500">فشل تحميل الموردين.</td></tr>`;
        }
    }

    function applySupplierFiltersAndRender() {
        if (!suppliersTableBody) return;
        let filteredSuppliers = [...allSuppliersData];

        const searchTerm = supplierSearchInput.value.toLowerCase();
        const category = supplierCategoryFilter.value;
        const status = supplierStatusFilter.value;

        if (searchTerm) {
            filteredSuppliers = filteredSuppliers.filter(sup =>
                sup.companyName.toLowerCase().includes(searchTerm) ||
                (sup.contactPerson && sup.contactPerson.toLowerCase().includes(searchTerm)) ||
                sup.phone.includes(searchTerm)
            );
        }
        if (category) {
            filteredSuppliers = filteredSuppliers.filter(sup => sup.productCategories && sup.productCategories.includes(category));
        }
        if (status) {
            filteredSuppliers = filteredSuppliers.filter(sup => sup.status === status);
        }
        renderSuppliersTable(filteredSuppliers);
    }


    function renderSuppliersTable(suppliersToRender) {
        if (!suppliersTableBody) return;
        suppliersTableBody.innerHTML = '';

        if (suppliersToRender.length === 0) {
            suppliersTableBody.innerHTML = `<tr><td colspan="6" class="text-center p-4">لا يوجد موردون يطابقون معايير البحث.</td></tr>`;
            return;
        }
        const categoryDisplayNames = {
            'oils': 'زيوت', 'rice': 'أرز', 'pasta': 'مكرونة', 'canned': 'معلبات', 'spices': 'توابل'
        };

        suppliersToRender.forEach(supplier => {
            const row = suppliersTableBody.insertRow();
            const currentBalance = supplier.currentBalance !== undefined ? supplier.currentBalance : supplier.openingBalance;
            // For suppliers, positive balance means we owe them, negative means they owe us (or credit)
            const balanceColor = currentBalance >= 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400';
            
            const categoriesHtml = supplier.productCategories && supplier.productCategories.length > 0
                ? supplier.productCategories.map(cat => `<span class="text-xs bg-gray-200 dark:bg-gray-600 px-1.5 py-0.5 rounded-full mr-1 mb-1 inline-block">${categoryDisplayNames[cat] || cat}</span>`).join('')
                : 'غير محدد';

            row.innerHTML = `
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm font-medium text-gray-900 dark:text-gray-100">${supplier.companyName}</div>
                    <div class="text-xs text-gray-500 dark:text-gray-400">${supplier.contactPerson || 'غير محدد'}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">${supplier.phone}</td>
                <td class="px-6 py-4 whitespace-normal text-sm text-gray-500 dark:text-gray-400 leading-relaxed">${categoriesHtml}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium ${balanceColor}">${currentBalance} ج.م</td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full 
                        ${supplier.status === 'active' ? 'bg-green-100 text-green-800 dark:bg-green-700 dark:text-green-100' : 'bg-red-100 text-red-800 dark:bg-red-700 dark:text-red-100'}">
                        ${supplier.status === 'active' ? 'نشط' : 'غير نشط'}
                    </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-left">
                    <button class="text-primary hover:text-primary/80 ml-2 edit-supplier-btn" data-id="${supplier.id}" title="تعديل"><i class="fas fa-edit"></i></button>
                    <button class="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 ml-2 delete-supplier-btn" data-id="${supplier.id}" title="حذف"><i class="fas fa-trash-alt"></i></button>
                    <button class="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 view-supplier-statement-btn" data-id="${supplier.id}" title="كشف حساب المورد"><i class="fas fa-file-invoice-dollar"></i></button>
                </td>
            `;
        });

        suppliersModuleNode.querySelectorAll('.edit-supplier-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const supplierId = e.currentTarget.getAttribute('data-id');
                const supplierToEdit = allSuppliersData.find(s => s.id === supplierId);
                if (supplierToEdit) {
                    openSupplierFormForEdit(supplierToEdit);
                }
            });
        });

        suppliersModuleNode.querySelectorAll('.delete-supplier-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const supplierId = e.currentTarget.getAttribute('data-id');
                handleDeleteSupplier(supplierId);
            });
        });
         suppliersModuleNode.querySelectorAll('.view-supplier-statement-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const supplierId = e.currentTarget.getAttribute('data-id');
                alert(`عرض كشف حساب للمورد ID: ${supplierId} (قيد الإنشاء)`);
            });
        });
    }

    if (supplierFormElement) {
        supplierFormElement.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!saveSupplierBtn) return;
            window.showButtonSpinner(saveSupplierBtn, true);

            const supplierData = {
                companyName: supplierCompanyNameField.value,
                contactPerson: supplierContactPersonField.value,
                phone: supplierPhoneField.value,
                email: supplierEmailField.value,
                address: supplierAddressField.value,
                openingBalance: parseFloat(supplierOpeningBalanceField.value) || 0,
                paymentTerms: parseInt(supplierPaymentTermsField.value) || null, // Allow null if not set
                status: supplierStatusField.value,
                productCategories: getSelectedCategories(),
                notes: supplierNotesField.value,
                // currentBalance should be initialized and updated by transactions
            };
            const supplierId = supplierIdField.value;

            try {
                if (supplierId) {
                    supplierData.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
                    await db.collection('suppliers').doc(supplierId).update(supplierData);
                    console.log("Supplier updated successfully");
                } else {
                    supplierData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
                    supplierData.currentBalance = supplierData.openingBalance;
                    await db.collection('suppliers').add(supplierData);
                    console.log("Supplier added successfully");
                }
                const closeBtn = suppliersModuleNode.querySelector('#close-supplier-form-btn');
                if (closeBtn) closeBtn.click();
                await loadAndRenderSuppliers();
            } catch (error) {
                console.error("Error saving supplier:", error);
                alert(`فشل حفظ المورد: ${error.message}`);
            } finally {
                window.showButtonSpinner(saveSupplierBtn, false);
            }
        });
    }

    async function handleDeleteSupplier(supplierId) {
        if (confirm('هل أنت متأكد أنك تريد حذف هذا المورد؟')) {
            try {
                await db.collection('suppliers').doc(supplierId).delete();
                console.log('Supplier deleted successfully');
                await loadAndRenderSuppliers();
            } catch (error) {
                console.error("Error deleting supplier:", error);
                alert('فشل حذف المورد.');
            }
        }
    }
    
    // Add event listeners for filters
    if (supplierSearchInput) supplierSearchInput.addEventListener('input', applySupplierFiltersAndRender);
    if (supplierCategoryFilter) supplierCategoryFilter.addEventListener('change', applySupplierFiltersAndRender);
    if (supplierStatusFilter) supplierStatusFilter.addEventListener('change', applySupplierFiltersAndRender);

    loadAndRenderSuppliers();
}