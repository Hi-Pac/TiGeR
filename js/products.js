let allProductsData = []; // To store fetched products for client-side filtering
let productCategoriesOptions = [];
const productCategoryNameById = new Map();
let productUnitsOptions = [];
const productUnitNameById = new Map();

async function initProductsModule() {
    // Reset stale state from any previous visit to this module.
    allProductsData = [];
    productCategoriesOptions = [];
    productCategoryNameById.clear();
    productUnitsOptions = [];
    productUnitNameById.clear();

    console.log("Products Module Initialized!");

    const productsModuleNode = document.getElementById('products-module');
    if (!productsModuleNode) {
        console.error("Products module container not found.");
        return;
    }

    const productsTableBody = productsModuleNode.querySelector('#products-table-body');
    const productFormElement = document.getElementById('product-form');
    const productIdField = document.getElementById('product-id-field');
    const productNameField = document.getElementById('product-name-field');
    const productBarcodeField = document.getElementById('product-barcode-field');
    const productCategoryField = document.getElementById('product-category-field');
    const productUnitField = document.getElementById('product-unit-field');
    const productPurchasePriceField = document.getElementById('product-purchase-price-field');
    const productSalePriceField = document.getElementById('product-sale-price-field');
    const productDescriptionField = document.getElementById('product-description-field');
    const productReorderLevelField = document.getElementById('product-reorder-level-field');
    const saveProductBtn = document.getElementById('save-product-form-btn');

    // Filter inputs
    const productSearchInput = productsModuleNode.querySelector('#product-search-input');
    const productCategoryFilter = productsModuleNode.querySelector('#product-category-filter');

    function renderCategoryOptions() {
        const defaultFilterOption = '<option value="">كل التصنيفات</option>';
        if (productCategoryFilter) {
            productCategoryFilter.innerHTML = defaultFilterOption;
            productCategoriesOptions.forEach((category) => {
                productCategoryFilter.add(new Option(category.displayName, category.id));
            });
        }
        if (productCategoryField) {
            productCategoryField.innerHTML = '<option value="">اختر التصنيف</option>';
            productCategoriesOptions.forEach((category) => {
                productCategoryField.add(new Option(category.displayName, category.id));
            });
        }
    }

    async function loadCategoryMetadata() {
        const { data } = await DB
            .from('product_categories')
            .select('id,name,name_ar')
            .order('name', { ascending: true })
            .get();
        if (!Array.isArray(data)) throw new Error('فشل تحميل تصنيفات الأصناف.');

        productCategoryNameById.clear();
        productCategoriesOptions = data.map((category) => {
            const displayName = category.name_ar || category.name;
            productCategoryNameById.set(category.id, displayName);
            return { id: category.id, displayName };
        });
        renderCategoryOptions();
    }

    async function loadUnitsMetadata() {
        const { data } = await DB
            .from('product_units')
            .select('id,name,name_ar')
            .order('name', { ascending: true })
            .get();
        if (!Array.isArray(data)) throw new Error('فشل تحميل وحدات الأصناف.');

        productUnitNameById.clear();
        productUnitsOptions = data.map((unit) => {
            const displayName = unit.name_ar || unit.name;
            productUnitNameById.set(unit.id, displayName);
            return { id: unit.id, displayName };
        });
    }

    async function resolveUnitId(unitNameRaw) {
        const unitName = (unitNameRaw || '').trim();
        if (!unitName) return null;

        const existingUnit = productUnitsOptions.find(
            (unit) => unit.displayName.toLowerCase() === unitName.toLowerCase()
        );
        if (existingUnit) return existingUnit.id;

        const createdUnit = await DB.from('product_units').insert({
            name: unitName,
            name_ar: unitName
        });
        if (!createdUnit?.id) {
            throw new Error('تعذر إنشاء وحدة جديدة للصنف.');
        }
        const displayName = createdUnit.name_ar || createdUnit.name || unitName;
        productUnitsOptions.push({ id: createdUnit.id, displayName });
        productUnitNameById.set(createdUnit.id, displayName);
        return createdUnit.id;
    }

    function resetProductForm(productData = null) {
        if (!productFormElement) return;
        productFormElement.reset();
        productIdField.value = '';

        if (productData) {
            productIdField.value = productData.id;
            productNameField.value = productData.name || '';
            productBarcodeField.value = productData.barcode || '';
            productCategoryField.value = productData.categoryId || '';
            productUnitField.value = productData.unitName || '';
            productPurchasePriceField.value = productData.purchasePrice || '';
            productSalePriceField.value = productData.salePrice || '';
            productDescriptionField.value = productData.description || '';
            productReorderLevelField.value = productData.reorderLevel || '';
        }
    }

    const openProductFormForEdit = window.setupFormToggle({
        currentModule: 'products',
        addButtonId: 'add-product-btn',
        formContainerId: 'product-form-container',
        closeButtonId: 'close-product-form-btn',
        cancelButtonId: 'cancel-product-form-btn',
        formId: 'product-form',
        formTitleId: 'product-form-title',
        addTitle: 'إضافة صنف جديد',
        editTitle: 'تعديل بيانات الصنف',
        resetFormFunction: resetProductForm
    });

    async function loadAndRenderProducts(filters = {}) {
        if (!productsTableBody) return;
        productsTableBody.innerHTML = `<tr><td colspan="7" class="text-center p-4">جاري تحميل الأصناف...</td></tr>`;
        try {
            let query = DB
                .from('products')
                .select('id,name,barcode,category_id,unit_id,purchase_price,sale_price,description,reorder_level,status')
                .order('name', { ascending: true })
                .limit(100); // Added pagination

            // Apply filters
            if (filters.searchTerm) {
                query = query.or(`name.ilike.%${filters.searchTerm}%,barcode.ilike.%${filters.searchTerm}%`);
            }
            if (filters.categoryFilter) {
                query = query.eq('category_id', filters.categoryFilter);
            }

            const { data } = await query;
            if (!Array.isArray(data)) throw new Error('فشل تحميل الأصناف.');
            allProductsData = data.map((row) => ({
                id: row.id,
                name: row.name || '',
                barcode: row.barcode || '',
                categoryId: row.category_id || '',
                categoryName: productCategoryNameById.get(row.category_id) || 'غير مصنف',
                unitId: row.unit_id || '',
                unitName: productUnitNameById.get(row.unit_id) || '',
                purchasePrice: Number(row.purchase_price || 0),
                salePrice: Number(row.sale_price || 0),
                description: row.description || '',
                reorderLevel: Number(row.reorder_level || 0),
                status: row.status || 'active'
            }));
            allProductsData.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
            console.log("Products loaded:", allProductsData);
            renderProductsTable(allProductsData); // Render filtered data
        } catch (error) {
            console.error("Error loading products:", error);
            productsTableBody.innerHTML = `<tr><td colspan="7" class="text-center p-4 text-red-500">فشل تحميل الأصناف.</td></tr>`;
        }
    }

    function applyProductFiltersAndRender() {
        const filters = {
            searchTerm: productSearchInput.value.toLowerCase(),
            categoryFilter: productCategoryFilter.value,
        };
        loadAndRenderProducts(filters);
    }


    function renderProductsTable(productsToRender) {
        if (!productsTableBody) return;
        productsTableBody.innerHTML = '';

        if (productsToRender.length === 0) {
            productsTableBody.innerHTML = `<tr><td colspan="7" class="text-center p-4">لا توجد أصناف تطابق معايير البحث.</td></tr>`;
            return;
        }

        productsToRender.forEach(product => {
            const row = productsTableBody.insertRow();
            const categoryClass = 'bg-gray-100 text-gray-800 dark:bg-gray-600 dark:text-gray-200';

            row.innerHTML = `
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="flex items-center">
                        <div class="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded flex items-center justify-center text-gray-500 dark:text-gray-400">
                            <i class="fas fa-box"></i>
                        </div>
                        <div class="mr-4">
                            <div class="text-sm font-medium text-gray-900 dark:text-gray-100">${product.name}</div>
                            <div class="text-xs text-gray-500 dark:text-gray-400">${product.description || ''}</div>
                        </div>
                    </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">${product.barcode || 'N/A'}</td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${categoryClass}">
                        ${product.categoryName}
                    </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">${product.unitName || '-'}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">${product.purchasePrice} ج.م</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">${product.salePrice} ج.م</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button class="text-primary hover:text-primary/80 ml-2 edit-product-btn" data-id="${product.id}" title="تعديل"><i class="fas fa-edit"></i></button>
                    <button class="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 delete-product-btn" data-id="${product.id}" title="حذف"><i class="fas fa-trash-alt"></i></button>
                </td>
            `;
        });

        productsModuleNode.querySelectorAll('.edit-product-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const productId = e.currentTarget.getAttribute('data-id');
                const productToEdit = allProductsData.find(p => p.id === productId);
                if (productToEdit) {
                    openProductFormForEdit(productToEdit);
                }
            });
        });

        productsModuleNode.querySelectorAll('.delete-product-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const productId = e.currentTarget.getAttribute('data-id');
                handleDeleteProduct(productId);
            });
        });
    }

    if (productFormElement) {
        productFormElement.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!saveProductBtn) return;
            window.showButtonSpinner(saveProductBtn, true);

            const productId = productIdField.value;

            try {
                const productData = {
                    name: productNameField.value.trim(),
                    barcode: productBarcodeField.value.trim(),
                    category_id: productCategoryField.value || null,
                    unit_id: await resolveUnitId(productUnitField.value),
                    purchase_price: parseFloat(productPurchasePriceField.value) || 0,
                    sale_price: parseFloat(productSalePriceField.value) || 0,
                    description: productDescriptionField.value.trim(),
                    reorder_level: parseInt(productReorderLevelField.value, 10) || 0
                };
                if (productId) {
                    await DB.from('products').eq('id', productId).update(productData);
                    console.log("Product updated successfully");
                } else {
                    await DB.from('products').insert(productData);
                    console.log("Product added successfully");
                }
                const closeBtn = document.getElementById('close-product-form-btn');
                if (closeBtn) closeBtn.click();
                await loadAndRenderProducts();
            } catch (error) {
                console.error("Error saving product:", error);
                window.AppNotify?.error(`فشل حفظ الصنف: ${error.message}`);
            } finally {
                window.showButtonSpinner(saveProductBtn, false);
            }
        });
    }

    async function handleDeleteProduct(productId) {
        if (confirm('هل أنت متأكد أنك تريد حذف هذا الصنف؟')) {
            try {
                await DB.from('products').eq('id', productId).softDelete();
                console.log('Product deleted successfully');
                await loadAndRenderProducts();
            } catch (error) {
                console.error("Error deleting product:", error);
                window.AppNotify?.error('فشل حذف الصنف.');
            }
        }
    }

    // Add event listeners for filters
    if(productSearchInput) productSearchInput.addEventListener('input', applyProductFiltersAndRender);
    if(productCategoryFilter) productCategoryFilter.addEventListener('change', applyProductFiltersAndRender);

    await Promise.all([loadCategoryMetadata(), loadUnitsMetadata()]);
    await loadAndRenderProducts();
    console.log("✅ Products module initialized successfully");
}
