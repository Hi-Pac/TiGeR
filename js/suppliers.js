let allSuppliersData = []; // To store fetched suppliers for client-side filtering
let supplierCategoryOptions = [];
const categoryNameById = new Map();

async function initSuppliersModule() {
    console.log("Suppliers Module Initialized!");

    const suppliersModuleNode = document.getElementById('suppliers-module');
    if (!suppliersModuleNode) {
        console.error("Suppliers module container not found.");
        return;
    }

    const suppliersTableBody = suppliersModuleNode.querySelector('#suppliers-table-body');
    const supplierFormElement = document.getElementById('supplier-form');
    const supplierIdField = document.getElementById('supplier-id-field');
    const supplierCompanyNameField = document.getElementById('supplier-company-name-field');
    const supplierContactPersonField = document.getElementById('supplier-contact-person-field');
    const supplierPhoneField = document.getElementById('supplier-phone-field');
    const supplierEmailField = document.getElementById('supplier-email-field');
    const supplierAddressField = document.getElementById('supplier-address-field');
    const supplierOpeningBalanceField = document.getElementById('supplier-opening-balance-field');
    const supplierPaymentTermsField = document.getElementById('supplier-payment-terms-field');
    const supplierStatusField = document.getElementById('supplier-status-field');
    const supplierProductCategoriesCheckboxesContainer = document.getElementById('supplier-product-categories-checkboxes');
    const supplierNotesField = document.getElementById('supplier-notes-field');
    const saveSupplierBtn = document.getElementById('save-supplier-form-btn');

    // Filter inputs
    const supplierSearchInput = suppliersModuleNode.querySelector('#supplier-search-input');
    const supplierCategoryFilter = suppliersModuleNode.querySelector('#supplier-category-filter');
    const supplierStatusFilter = suppliersModuleNode.querySelector('#supplier-status-filter');

    const mapSupplierRowToViewModel = (row) => ({
        id: row.id,
        companyName: row.company_name || '',
        contactPerson: row.contact_person || '',
        phone: row.phone || '',
        email: row.email || '',
        address: row.address || '',
        openingBalance: Number(row.opening_balance || 0),
        currentBalance: Number(row.current_balance || 0),
        paymentTerms: row.payment_terms_days,
        status: row.status || 'active',
        notes: row.notes || '',
        productCategories: []
    });

    function getCategoryDisplayName(categoryId) {
        return categoryNameById.get(categoryId) || 'غير محدد';
    }

    function renderCategoryInputs() {
        if (supplierCategoryFilter) {
            supplierCategoryFilter.innerHTML = '<option value="">كل التصنيفات (التي يوردها)</option>';
            supplierCategoryOptions.forEach((cat) => {
                supplierCategoryFilter.add(new Option(cat.displayName, cat.id));
            });
        }

        if (supplierProductCategoriesCheckboxesContainer) {
            supplierProductCategoriesCheckboxesContainer.innerHTML = '';
            supplierCategoryOptions.forEach((cat) => {
                const label = document.createElement('label');
                label.className = 'inline-flex items-center';
                label.innerHTML = `<input type="checkbox" value="${cat.id}" class="form-checkbox-input rounded"> <span class="mr-2">${cat.displayName}</span>`;
                supplierProductCategoriesCheckboxesContainer.appendChild(label);
            });
        }
    }

    async function loadCategoryMetadata() {
        try {
            const { data } = await DB
                .from('product_categories')
                .select('id,name,name_ar')
                .order('name', { ascending: true })
                .get();
            if (!Array.isArray(data)) {
                throw new Error('نتيجة تصنيفات الأصناف غير صالحة.');
            }

            categoryNameById.clear();
            supplierCategoryOptions = data.map((category) => {
                const displayName = category.name_ar || category.name;
                categoryNameById.set(category.id, displayName);
                return { id: category.id, displayName };
            });
            renderCategoryInputs();
        } catch (error) {
            console.error('Error loading product categories for suppliers:', error);
            supplierCategoryOptions = [];
            categoryNameById.clear();
            renderCategoryInputs();
            window.AppNotify?.warning('تعذر تحميل تصنيفات الأصناف حالياً. يمكنك حفظ المورد بدون تصنيفات والمحاولة لاحقاً.');
        }
    }

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
            const [{ data: suppliersRows }, { data: supplierCategoryRows }] = await Promise.all([
                DB.from('suppliers').select('*').order('company_name', { ascending: true }).get(),
                DB.from('supplier_categories').select('supplier_id,category_id').get()
            ]);
            if (!Array.isArray(suppliersRows)) {
                throw new Error('فشل تحميل بيانات الموردين.');
            }
            if (!Array.isArray(supplierCategoryRows)) {
                throw new Error('فشل تحميل تصنيفات الموردين.');
            }

            const categoriesBySupplier = new Map();
            supplierCategoryRows.forEach((linkRow) => {
                if (!categoriesBySupplier.has(linkRow.supplier_id)) {
                    categoriesBySupplier.set(linkRow.supplier_id, []);
                }
                categoriesBySupplier.get(linkRow.supplier_id).push(linkRow.category_id);
            });

            allSuppliersData = suppliersRows.map((row) => {
                const supplier = mapSupplierRowToViewModel(row);
                supplier.productCategories = categoriesBySupplier.get(row.id) || [];
                return supplier;
            });
            allSuppliersData.sort((a, b) => (a.companyName || '').localeCompare(b.companyName || ''));
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
                (sup.companyName || '').toLowerCase().includes(searchTerm) ||
                (sup.contactPerson || '').toLowerCase().includes(searchTerm) ||
                (sup.phone || '').includes(searchTerm)
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
        suppliersToRender.forEach(supplier => {
            const row = suppliersTableBody.insertRow();
            const currentBalance = supplier.currentBalance !== undefined ? supplier.currentBalance : supplier.openingBalance;
            // For suppliers, positive balance means we owe them, negative means they owe us (or credit)
            const balanceColor = currentBalance >= 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400';
            
            const categoriesHtml = supplier.productCategories && supplier.productCategories.length > 0
                ? supplier.productCategories.map(cat => `<span class="text-xs bg-gray-200 dark:bg-gray-600 px-1.5 py-0.5 rounded-full mr-1 mb-1 inline-block">${getCategoryDisplayName(cat)}</span>`).join('')
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
                window.AppNotify?.info(`عرض كشف حساب للمورد ID: ${supplierId} (قيد الإنشاء)`);
            });
        });

        window.applyModuleActionGuards?.('suppliers', suppliersModuleNode);
    }

    if (supplierFormElement) {
        supplierFormElement.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!saveSupplierBtn) return;
            window.showButtonSpinner(saveSupplierBtn, true);

            const supplierData = {
                company_name: supplierCompanyNameField.value.trim(),
                contact_person: supplierContactPersonField.value.trim(),
                phone: supplierPhoneField.value.trim(),
                email: supplierEmailField.value.trim(),
                address: supplierAddressField.value.trim(),
                opening_balance: parseFloat(supplierOpeningBalanceField.value) || 0,
                payment_terms_days: parseInt(supplierPaymentTermsField.value, 10) || null,
                status: supplierStatusField.value,
                notes: supplierNotesField.value.trim()
            };
            const selectedCategoryIds = getSelectedCategories();
            const supplierId = supplierIdField.value;

            try {
                if (supplierId) {
                    await DB.from('suppliers').eq('id', supplierId).update(supplierData);
                    await syncSupplierCategories(supplierId, selectedCategoryIds);
                    console.log("Supplier updated successfully");
                } else {
                    supplierData.current_balance = supplierData.opening_balance;
                    const createdSupplier = await DB.from('suppliers').insert(supplierData);
                    if (!createdSupplier?.id) {
                        console.error('Supplier insert returned invalid payload:', createdSupplier);
                        throw new Error('لم يتم إرجاع معرّف المورد بعد الحفظ. يرجى التحقق من صلاحيات RLS وإعداد قاعدة البيانات.');
                    }
                    await syncSupplierCategories(createdSupplier.id, selectedCategoryIds);
                    console.log("Supplier added successfully");
                }
                const closeBtn = document.getElementById('close-supplier-form-btn');
                if (closeBtn) closeBtn.click();
                await loadAndRenderSuppliers();
                window.AppNotify?.success(supplierId ? 'تم تحديث بيانات المورد.' : 'تمت إضافة المورد بنجاح.');
            } catch (error) {
                console.error("Error saving supplier:", error);
                window.AppNotify?.error(`فشل حفظ المورد: ${error.message}`);
            } finally {
                window.showButtonSpinner(saveSupplierBtn, false);
            }
        });
    }

    async function handleDeleteSupplier(supplierId) {
        if (confirm('هل أنت متأكد أنك تريد حذف هذا المورد؟')) {
            try {
                await DB.from('suppliers').eq('id', supplierId).softDelete();
                console.log('Supplier deleted successfully');
                await loadAndRenderSuppliers();
                window.AppNotify?.success('تم حذف المورد.');
            } catch (error) {
                console.error("Error deleting supplier:", error);
                window.AppNotify?.error('فشل حذف المورد.');
            }
        }
    }
    
    // Add event listeners for filters
    if (supplierSearchInput) supplierSearchInput.addEventListener('input', applySupplierFiltersAndRender);
    if (supplierCategoryFilter) supplierCategoryFilter.addEventListener('change', applySupplierFiltersAndRender);
    if (supplierStatusFilter) supplierStatusFilter.addEventListener('change', applySupplierFiltersAndRender);

    async function syncSupplierCategories(supplierId, selectedCategoryIds) {
        // DB abstraction currently does not expose hard delete, while supplier_categories
        // needs row-level sync (insert/delete) to mirror checkbox selections.
        if (!supplierId) return;
        if (!window.supabaseClient) {
            throw new Error('تعذر تهيئة اتصال قاعدة البيانات لتحديث تصنيفات المورد.');
        }

        const { data: existingRows, error: existingError } = await window.supabaseClient
            .from('supplier_categories')
            .select('category_id')
            .eq('supplier_id', supplierId);
        if (existingError) {
            console.error('Failed to load existing supplier categories:', existingError);
            throw new Error(`تعذر تحميل تصنيفات المورد الحالية (${supplierId}): ${existingError.message}`);
        }

        const existingCategoryIds = new Set((existingRows || []).map((row) => row.category_id));
        const desiredCategoryIds = new Set(selectedCategoryIds.filter(Boolean));

        const toInsert = [...desiredCategoryIds].filter((categoryId) => !existingCategoryIds.has(categoryId));
        const toDelete = [...existingCategoryIds].filter((categoryId) => !desiredCategoryIds.has(categoryId));

        if (toDelete.length) {
            const { error: deleteError } = await window.supabaseClient
                .from('supplier_categories')
                .delete()
                .eq('supplier_id', supplierId)
                .in('category_id', toDelete);
            if (deleteError) {
                console.error('Failed to delete supplier categories:', deleteError);
                throw new Error(`تعذر حذف تصنيفات المورد (${supplierId}): ${deleteError.message}`);
            }
        }

        if (toInsert.length) {
            const rows = toInsert.map((categoryId) => ({ supplier_id: supplierId, category_id: categoryId }));
            const { error: insertError } = await window.supabaseClient
                .from('supplier_categories')
                .insert(rows);
            if (insertError) {
                console.error('Failed to insert supplier categories:', insertError);
                throw new Error(`تعذر إضافة تصنيفات المورد (${supplierId}): ${insertError.message}`);
            }
        }
    }

    await loadCategoryMetadata();
    await loadAndRenderSuppliers();
    window.applyModuleActionGuards?.('suppliers', suppliersModuleNode);
    console.log("✅ Suppliers module initialized successfully");
}
