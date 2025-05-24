let allInventoryStockData = []; // Will hold {productId, productName, warehouseId, warehouseName, quantity, unit, reorderLevel}
let allWarehousesForInventory = []; // For dropdowns
let allProductsForInventory = []; // For product selectors in forms

function initInventoryModule() {
    console.log("Inventory Module Initialized!");

    const inventoryModuleNode = document.getElementById('inventory-module');
    if (!inventoryModuleNode) return;

    const inventoryTableBody = inventoryModuleNode.querySelector('#inventory-table-body');
    const inventoryWarehouseFilter = inventoryModuleNode.querySelector('#inventory-warehouse-filter');
    // Add other filter selectors

    // "Stock In" Form Elements (Modal is global)
    const inventoryInFormContainer = document.getElementById('inventory-in-form-container');
    const inventoryInFormElement = document.getElementById('inventory-in-form');
    const inventoryInDateField = document.getElementById('inventory-in-date-field');
    const inventoryInWarehouseField = document.getElementById('inventory-in-warehouse-field');
    const inventoryInSupplierField = document.getElementById('inventory-in-supplier-field');
    const inventoryInItemsTableBody = document.getElementById('inventory-in-items-table-body');
    const addInventoryInItemBtn = document.getElementById('add-inventory-in-item-btn');
    // ... other "Stock In" form fields

    // "Transfer" Form Elements (Modal is global)
    const inventoryTransferFormContainer = document.getElementById('inventory-transfer-form-container');
    const inventoryTransferFormElement = document.getElementById('inventory-transfer-form');
    const transferDateField = document.getElementById('transfer-date-field');
    const transferFromWarehouseField = document.getElementById('transfer-from-warehouse-field');
    const transferToWarehouseField = document.getElementById('transfer-to-warehouse-field');
    const inventoryTransferItemsTableBody = document.getElementById('inventory-transfer-items-table-body');
    const addInventoryTransferItemBtn = document.getElementById('add-inventory-transfer-item-btn');
    // ... other "Transfer" form fields
    
    // --- Populate Warehouse Dropdowns (example) ---
    async function populateWarehouseDropdowns() {
        // --- FIREBASE: Fetch warehouses ---
        await new Promise(resolve => setTimeout(resolve, 50));
        allWarehousesForInventory = [
            { id: 'main_wh', name: 'المخزن الرئيسي' },
            { id: 'alex_wh', name: 'مخزن الإسكندرية' },
            { id: 'tanta_wh', name: 'مخزن طنطا' }
        ];
        
        const selects = [
            inventoryWarehouseFilter, 
            inventoryInWarehouseField, 
            transferFromWarehouseField, 
            transferToWarehouseField
        ];

        selects.forEach(selectEl => {
            if (selectEl) {
                const currentVal = selectEl.value; // Preserve current selection if any
                selectEl.innerHTML = `<option value="">${selectEl.querySelector('option').textContent}</option>`; // Keep placeholder
                allWarehousesForInventory.forEach(wh => {
                    selectEl.add(new Option(wh.name, wh.id));
                });
                selectEl.value = currentVal;
            }
        });
    }
    
    // --- Populate Product Dropdowns (example for forms) ---
    async function populateProductSelectorsForForms() {
        // --- FIREBASE: Fetch products ---
        await new Promise(resolve => setTimeout(resolve, 50));
        allProductsForInventory = [ // Should include unit
            { id: 'p1', name: 'زيت عباد الشمس 1 لتر', unit: 'زجاجة' },
            { id: 'p2', name: 'أرز مصري فاخر 5 كجم', unit: 'كيس' },
            { id: 'p3', name: 'مكرونة اسباجتي 400جم', unit: 'كيس' },
        ];
        // This function might be called when a form opens or warehouse changes
    }


    // --- Stock In Form Logic ---
    function resetInventoryInForm(data = null) {
        if (!inventoryInFormElement) return;
        inventoryInFormElement.reset();
        inventoryInDateField.valueAsDate = new Date();
        inventoryInItemsTableBody.innerHTML = '';
        if (!data) addInventoryInItemRow(); // Add one empty row for new forms
        // TODO: Populate form if 'data' is provided (for editing an existing stock-in record)
    }

    window.setupFormToggle({
        currentModule: 'inventory', // Not strictly for this as modal is global
        addButtonId: 'add-inventory-in-btn',
        formContainerId: 'inventory-in-form-container',
        closeButtonId: 'close-inventory-in-form-btn',
        cancelButtonId: 'cancel-inventory-in-form-btn',
        formId: 'inventory-in-form',
        formTitleId: 'inventory-in-form-title',
        addTitle: 'إذن إضافة مخزون (وارد)',
        editTitle: 'تعديل إذن إضافة مخزون',
        resetFormFunction: resetInventoryInForm,
        onOpen: async () => {
            await populateWarehouseDropdowns(); // Ensure warehouses are loaded
            // await populateSuppliersForStockIn(); // If supplier dropdown needed
            await populateProductSelectorsForForms(); // Ensure products are loaded for item rows
            if(inventoryInItemsTableBody.rows.length === 0) addInventoryInItemRow();
        }
    });
    
    function addInventoryInItemRow(item = null) {
        const newRow = inventoryInItemsTableBody.insertRow();
        newRow.className = 'inventory-in-item-row';
        newRow.innerHTML = `
            <td class="px-3 py-2">
                <select class="form-select product-selector p-1.5 text-sm" required>
                    <option value="">اختر الصنف...</option>
                    ${allProductsForInventory.map(p => `<option value="${p.id}">${p.name} (${p.unit})</option>`).join('')}
                </select>
            </td>
            <td class="px-3 py-2"><input type="number" min="1" value="${item ? item.quantity : 1}" class="form-input quantity-input p-1.5 text-sm w-full" required></td>
            <td class="px-3 py-2"><input type="date" class="form-input p-1.5 text-sm w-full production-date-input"></td>
            <td class="px-3 py-2"><input type="date" class="form-input p-1.5 text-sm w-full expiry-date-input"></td>
            <td class="px-1 py-2 text-center"><button type="button" class="text-red-500 hover:text-red-700 remove-item-btn p-1 text-sm"><i class="fas fa-trash-alt"></i></button></td>
        `;
        newRow.querySelector('.remove-item-btn').addEventListener('click', (e) => e.currentTarget.closest('tr').remove());
        // Pre-select if item data provided
        if (item && item.productId) newRow.querySelector('.product-selector').value = item.productId;
        if (item && item.productionDate) newRow.querySelector('.production-date-input').value = item.productionDate;
        if (item && item.expiryDate) newRow.querySelector('.expiry-date-input').value = item.expiryDate;
    }
    if(addInventoryInItemBtn) addInventoryInItemBtn.addEventListener('click', () => addInventoryInItemRow());
    
    if(inventoryInFormElement) inventoryInFormElement.addEventListener('submit', async (e) => {
        e.preventDefault();
        // ... Save stock-in logic (update inventory table, create transaction log)
        alert("حفظ إذن الإضافة (محاكاة)");
        inventoryInFormContainer.classList.add('hidden');
        await loadAndRenderInventoryStock();
    });


    // --- Inventory Transfer Form Logic ---
    function resetInventoryTransferForm(data = null) {
        if (!inventoryTransferFormElement) return;
        inventoryTransferFormElement.reset();
        transferDateField.valueAsDate = new Date();
        inventoryTransferItemsTableBody.innerHTML = '';
        if (!data) addInventoryTransferItemRow();
        // TODO: Populate form if 'data' is provided
    }

    window.setupFormToggle({
        currentModule: 'inventory',
        addButtonId: 'add-inventory-transfer-btn',
        formContainerId: 'inventory-transfer-form-container',
        closeButtonId: 'close-inventory-transfer-form-btn',
        cancelButtonId: 'cancel-inventory-transfer-form-btn',
        formId: 'inventory-transfer-form',
        formTitleId: 'inventory-transfer-form-title',
        addTitle: 'أمر تحويل مخزني',
        editTitle: 'تعديل أمر تحويل مخزني',
        resetFormFunction: resetInventoryTransferForm,
        onOpen: async () => {
            await populateWarehouseDropdowns();
            await populateProductSelectorsForForms();
            if(inventoryTransferItemsTableBody.rows.length === 0) addInventoryTransferItemRow();
        }
    });

    function addInventoryTransferItemRow(item = null) {
        const newRow = inventoryTransferItemsTableBody.insertRow();
        newRow.className = 'inventory-transfer-item-row';
        newRow.innerHTML = `
            <td class="px-3 py-2">
                <select class="form-select product-selector p-1.5 text-sm" required>
                    <option value="">اختر الصنف...</option>
                    ${allProductsForInventory.map(p => `<option value="${p.id}" data-unit="${p.unit}">${p.name} (${p.unit})</option>`).join('')}
                </select>
            </td>
            <td class="px-3 py-2"><span class="available-stock-transfer text-xs text-gray-600">متاح: 0</span></td>
            <td class="px-3 py-2"><input type="number" min="1" value="${item ? item.quantity : 1}" class="form-input quantity-input p-1.5 text-sm w-full" required></td>
            <td class="px-1 py-2 text-center"><button type="button" class="text-red-500 hover:text-red-700 remove-item-btn p-1 text-sm"><i class="fas fa-trash-alt"></i></button></td>
        `;
        newRow.querySelector('.remove-item-btn').addEventListener('click', (e) => e.currentTarget.closest('tr').remove());
        newRow.querySelector('.product-selector').addEventListener('change', updateAvailableStockForTransfer);
        // Pre-select and update stock if item data provided
        if (item && item.productId) {
            newRow.querySelector('.product-selector').value = item.productId;
            updateAvailableStockForTransfer({target: newRow.querySelector('.product-selector')});
        }
    }
    if(addInventoryTransferItemBtn) addInventoryTransferItemBtn.addEventListener('click', () => addInventoryTransferItemRow());
    
    function updateAvailableStockForTransfer(event) {
        const selector = event.target;
        const row = selector.closest('tr');
        const productId = selector.value;
        const fromWarehouseId = transferFromWarehouseField.value;
        // --- FIREBASE: Fetch stock for this product in fromWarehouseId ---
        const productData = allProductsForInventory.find(p => p.id === productId); // Simplified
        const stock = productData && productData.stock && fromWarehouseId ? (productData.stock[fromWarehouseId] || 0) : 0;
        
        row.querySelector('.available-stock-transfer').textContent = `متاح: ${stock}`;
        row.querySelector('.quantity-input').max = stock;
    }
    if(transferFromWarehouseField) transferFromWarehouseField.addEventListener('change', () => {
        // Re-update available stock for all items when source warehouse changes
        inventoryTransferItemsTableBody.querySelectorAll('.product-selector').forEach(sel => {
            if(sel.value) updateAvailableStockForTransfer({target: sel});
        });
    });

    if(inventoryTransferFormElement) inventoryTransferFormElement.addEventListener('submit', async (e) => {
        e.preventDefault();
        // ... Save transfer logic (update stock in both warehouses, create transaction log)
        alert("حفظ أمر التحويل (محاكاة)");
        inventoryTransferFormContainer.classList.add('hidden');
        await loadAndRenderInventoryStock();
    });


    // --- Main Inventory Stock Table Logic ---
    async function loadAndRenderInventoryStock() {
        if (!inventoryTableBody) return;
        inventoryTableBody.innerHTML = `<tr><td colspan="7" class="text-center p-4">جاري تحميل أرصدة المخزون...</td></tr>`;
        try {
            // --- FIREBASE: Fetch aggregated stock data (productId, productName, warehouseId, warehouseName, quantity, unit, reorderLevel) ---
            // This might involve joining 'products' and 'inventoryStock' collections or having denormalized data.
            await new Promise(resolve => setTimeout(resolve, 500));
            allInventoryStockData = [
                { productId: 'p1', productName: 'زيت عباد الشمس 1 لتر', warehouseId: 'main_wh', warehouseName: 'المخزن الرئيسي', quantity: 40, unit: 'زجاجة', reorderLevel: 10, status: 'in_stock' },
                { productId: 'p1', productName: 'زيت عباد الشمس 1 لتر', warehouseId: 'alex_wh', warehouseName: 'مخزن الإسكندرية', quantity: 5, unit: 'زجاجة', reorderLevel: 10, status: 'low_stock' },
                { productId: 'p2', productName: 'أرز مصري فاخر 5 كجم', warehouseId: 'main_wh', warehouseName: 'المخزن الرئيسي', quantity: 80, unit: 'كيس', reorderLevel: 20, status: 'in_stock' },
                { productId: 'p3', productName: 'مكرونة اسباجتي 400جم', warehouseId: 'main_wh', warehouseName: 'المخزن الرئيسي', quantity: 0, unit: 'كيس', reorderLevel: 50, status: 'out_of_stock' },
            ];
            renderInventoryTable(allInventoryStockData); // Initially render all
             // Populate warehouse filter after data load (if not already done)
            if (inventoryWarehouseFilter.options.length <= 1) { // only placeholder exists
                const distinctWarehouses = [...new Map(allInventoryStockData.map(item => [item.warehouseId, {id: item.warehouseId, name: item.warehouseName}])).values()];
                distinctWarehouses.forEach(wh => {
                     if(Array.from(inventoryWarehouseFilter.options).find(opt => opt.value === wh.id) == null)
                        inventoryWarehouseFilter.add(new Option(wh.name, wh.id));
                });
            }
        } catch (error) {
            console.error("Error loading inventory stock:", error);
            inventoryTableBody.innerHTML = `<tr><td colspan="7" class="text-center p-4 text-red-500">فشل تحميل أرصدة المخزون.</td></tr>`;
        }
    }
    
    function applyInventoryFiltersAndRender() {
        // TODO: Implement filtering based on search, warehouse, stock status
        renderInventoryTable(allInventoryStockData);
    }

    function renderInventoryTable(stockDataToRender) {
        if (!inventoryTableBody) return;
        inventoryTableBody.innerHTML = '';
        if (stockDataToRender.length === 0) {
            inventoryTableBody.innerHTML = `<tr><td colspan="7" class="text-center p-4">لا توجد أرصدة مخزون للعرض.</td></tr>`;
            return;
        }
        stockDataToRender.forEach(item => {
            const row = inventoryTableBody.insertRow();
            let statusClass = 'bg-gray-100 text-gray-800';
            let statusText = 'غير محدد';
            if (item.quantity <= 0) {
                statusClass = 'bg-red-100 text-red-800 dark:bg-red-700 dark:text-red-100'; statusText = 'نفذ المخزون';
            } else if (item.reorderLevel && item.quantity <= item.reorderLevel) {
                statusClass = 'bg-yellow-100 text-yellow-800 dark:bg-yellow-700 dark:text-yellow-100'; statusText = 'مخزون منخفض';
            } else {
                statusClass = 'bg-green-100 text-green-800 dark:bg-green-700 dark:text-green-100'; statusText = 'متوفر';
            }

            row.innerHTML = `
                <td class="px-6 py-3 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">${item.productName}</td>
                <td class="px-6 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">${item.warehouseName}</td>
                <td class="px-6 py-3 whitespace-nowrap text-sm font-semibold text-gray-700 dark:text-gray-200">${item.quantity}</td>
                <td class="px-6 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">${item.unit}</td>
                <td class="px-6 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">${item.reorderLevel || 'N/A'}</td>
                <td class="px-6 py-3 whitespace-nowrap"><span class="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${statusClass}">${statusText}</span></td>
                <td class="px-6 py-3 whitespace-nowrap text-sm font-medium text-left">
                    <button class="text-blue-600 hover:text-blue-800 view-item-history-btn" data-product-id="${item.productId}" data-warehouse-id="${item.warehouseId}" title="عرض حركة الصنف"><i class="fas fa-history"></i></button>
                    <!-- Add more actions like 'Stock Adjustment' later -->
                </td>
            `;
        });
        // Add event listeners for actions like view history
    }
    
    // Event listeners for main table filters
    if(inventoryModuleNode.querySelector('#inventory-search-input')) inventoryModuleNode.querySelector('#inventory-search-input').addEventListener('input', applyInventoryFiltersAndRender);
    if(inventoryWarehouseFilter) inventoryWarehouseFilter.addEventListener('change', applyInventoryFiltersAndRender);
    // ...

    // Initial load
    populateWarehouseDropdowns(); // For filters mainly
    populateProductSelectorsForForms(); // For forms
    loadAndRenderInventoryStock();
}