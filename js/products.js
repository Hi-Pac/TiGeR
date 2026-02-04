let allProductsData = []; // To store fetched products for client-side filtering

async function initProductsModule() {
    console.log("Products Module Initialized!");

    const productsModuleNode = document.getElementById('products-module');
    if (!productsModuleNode) {
        console.error("Products module container not found.");
        return;
    }

    const productsTableBody = productsModuleNode.querySelector('#products-table-body');
    const productFormElement = productsModuleNode.querySelector('#product-form');
    const productIdField = productsModuleNode.querySelector('#product-id-field');
    const productNameField = productsModuleNode.querySelector('#product-name-field');
    const productBarcodeField = productsModuleNode.querySelector('#product-barcode-field');
    const productCategoryField = productsModuleNode.querySelector('#product-category-field');
    const productUnitField = productsModuleNode.querySelector('#product-unit-field');
    const productPurchasePriceField = productsModuleNode.querySelector('#product-purchase-price-field');
    const productSalePriceField = productsModuleNode.querySelector('#product-sale-price-field');
    const productDescriptionField = productsModuleNode.querySelector('#product-description-field');
    const productReorderLevelField = productsModuleNode.querySelector('#product-reorder-level-field');
    const saveProductBtn = productsModuleNode.querySelector('#save-product-form-btn');

    // Filter inputs
    const productSearchInput = productsModuleNode.querySelector('#product-search-input');
    const productCategoryFilter = productsModuleNode.querySelector('#product-category-filter');

    function resetProductForm(productData = null) {
        if (!productFormElement) return;
        productFormElement.reset();
        productIdField.value = '';

        if (productData) {
            productIdField.value = productData.id;
            productNameField.value = productData.name || '';
            productBarcodeField.value = productData.barcode || '';
            productCategoryField.value = productData.category || '';
            productUnitField.value = productData.unit || '';
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

    async function loadAndRenderProducts() {
        if (!productsTableBody) return;
        productsTableBody.innerHTML = `<tr><td colspan="7" class="text-center p-4">جاري تحميل الأصناف...</td></tr>`;
        try {
            const productsSnapshot = await db.collection('products').orderBy('name').get();
            allProductsData = productsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            console.log("Products loaded:", allProductsData);
            applyProductFiltersAndRender();
        } catch (error) {
            console.error("Error loading products:", error);
            productsTableBody.innerHTML = `<tr><td colspan="7" class="text-center p-4 text-red-500">فشل تحميل الأصناف.</td></tr>`;
        }
    }

    function applyProductFiltersAndRender() {
        if(!productsTableBody) return;
        let filteredProducts = [...allProductsData];

        const searchTerm = productSearchInput.value.toLowerCase();
        const categoryFilter = productCategoryFilter.value;

        if (searchTerm) {
            filteredProducts = filteredProducts.filter(product =>
                product.name.toLowerCase().includes(searchTerm) ||
                (product.barcode && product.barcode.toLowerCase().includes(searchTerm))
            );
        }
        if (categoryFilter) {
            filteredProducts = filteredProducts.filter(product => product.category === categoryFilter);
        }
        renderProductsTable(filteredProducts);
    }


    function renderProductsTable(productsToRender) {
        if (!productsTableBody) return;
        productsTableBody.innerHTML = '';

        if (productsToRender.length === 0) {
            productsTableBody.innerHTML = `<tr><td colspan="7" class="text-center p-4">لا توجد أصناف تطابق معايير البحث.</td></tr>`;
            return;
        }

        const categoryDisplayNames = {
            'External': 'خارجي', 'Structural': 'انشائي', 'Colored': 'بلاستيك ملون', 'Cement': 'اسمنتي', 'Decorative': 'ديكوري'
        };

        productsToRender.forEach(product => {
            const row = productsTableBody.insertRow();
            const categoryColors = {
                'oils': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-700 dark:text-yellow-100',
                'rice': 'bg-blue-100 text-blue-800 dark:bg-blue-700 dark:text-blue-100',
                'pasta': 'bg-green-100 text-green-800 dark:bg-green-700 dark:text-green-100',
                'canned': 'bg-red-100 text-red-800 dark:bg-red-700 dark:text-red-100',
                'spices': 'bg-purple-100 text-purple-800 dark:bg-purple-700 dark:text-purple-100'
            };
            const categoryClass = categoryColors[product.category] || 'bg-gray-100 text-gray-800 dark:bg-gray-600 dark:text-gray-200';

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
                        ${categoryDisplayNames[product.category] || product.category}
                    </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">${product.unit}</td>
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

            const productData = {
                name: productNameField.value,
                barcode: productBarcodeField.value,
                category: productCategoryField.value,
                unit: productUnitField.value,
                purchasePrice: parseFloat(productPurchasePriceField.value),
                salePrice: parseFloat(productSalePriceField.value),
                description: productDescriptionField.value,
                reorderLevel: parseInt(productReorderLevelField.value) || 0,
                // currentStock: 0, // Initial stock might be set via inventory module
            };
            const productId = productIdField.value;

            try {
                if (productId) {
                    await db.collection('products').doc(productId).update(productData);
                    console.log("Product updated successfully");
                } else {
                    await db.collection('products').add(productData);
                    console.log("Product added successfully");
                }
                const closeBtn = productsModuleNode.querySelector('#close-product-form-btn');
                if (closeBtn) closeBtn.click();
                await loadAndRenderProducts();
            } catch (error) {
                console.error("Error saving product:", error);
                alert(`فشل حفظ الصنف: ${error.message}`);
            } finally {
                window.showButtonSpinner(saveProductBtn, false);
            }
        });
    }

    async function handleDeleteProduct(productId) {
        if (confirm('هل أنت متأكد أنك تريد حذف هذا الصنف؟')) {
            try {
                await db.collection('products').doc(productId).delete();
                console.log('Product deleted successfully');
                await loadAndRenderProducts();
            } catch (error) {
                console.error("Error deleting product:", error);
                alert('فشل حذف الصنف.');
            }
        }
    }

    // Add event listeners for filters
    if(productSearchInput) productSearchInput.addEventListener('input', applyProductFiltersAndRender);
    if(productCategoryFilter) productCategoryFilter.addEventListener('change', applyProductFiltersAndRender);

    loadAndRenderProducts();
}
