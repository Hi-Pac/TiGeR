let allInventoryStockData = [];
let allWarehousesForInventory = [];
let allProductsForInventory = [];
let allSuppliersForInventory = [];

async function initInventoryModule() {
    const inventoryModuleNode = document.getElementById('inventory-module');
    if (!inventoryModuleNode) return;

    const inventoryTableBody = inventoryModuleNode.querySelector('#inventory-table-body');
    const inventorySearchInput = inventoryModuleNode.querySelector('#inventory-search-input');
    const inventoryWarehouseFilter = inventoryModuleNode.querySelector('#inventory-warehouse-filter');
    const inventoryStockStatusFilter = inventoryModuleNode.querySelector('#inventory-stock-status-filter');

    const inventoryInFormElement = document.getElementById('inventory-in-form');
    const inventoryInDateField = document.getElementById('inventory-in-date-field');
    const inventoryInWarehouseField = document.getElementById('inventory-in-warehouse-field');
    const inventoryInSupplierField = document.getElementById('inventory-in-supplier-field');
    const inventoryInRefField = document.getElementById('inventory-in-ref-field');
    const inventoryInNotesField = document.getElementById('inventory-in-notes-field');
    const inventoryInItemsTableBody = document.getElementById('inventory-in-items-table-body');
    const addInventoryInItemBtn = document.getElementById('add-inventory-in-item-btn');
    const saveInventoryInBtn = document.getElementById('save-inventory-in-form-btn');

    const inventoryTransferFormElement = document.getElementById('inventory-transfer-form');
    const transferDateField = document.getElementById('transfer-date-field');
    const transferFromWarehouseField = document.getElementById('transfer-from-warehouse-field');
    const transferToWarehouseField = document.getElementById('transfer-to-warehouse-field');
    const transferNotesField = document.getElementById('transfer-notes-field');
    const inventoryTransferItemsTableBody = document.getElementById('inventory-transfer-items-table-body');
    const addInventoryTransferItemBtn = document.getElementById('add-inventory-transfer-item-btn');
    const saveTransferBtn = document.getElementById('save-inventory-transfer-form-btn');

    const fmtQty = (n) => Number(n || 0).toFixed(3);
    const todayISO = () => new Date().toISOString().slice(0, 10);

    const productLabelMap = new Map();
    const productReorderMap = new Map();

    function productOptionsHtml(selectedId = '') {
        return allProductsForInventory.map((p) => {
            const selected = p.id === selectedId ? 'selected' : '';
            const text = `${p.name}${p.unit_name ? ` (${p.unit_name})` : ''}`;
            return `<option value="${p.id}" ${selected}>${text}</option>`;
        }).join('');
    }

    function setWarehouseOptions(selectEl, placeholder) {
        if (!selectEl) return;
        selectEl.innerHTML = `<option value="">${placeholder}</option>` +
            allWarehousesForInventory.map((w) => `<option value="${w.id}">${w.name}</option>`).join('');
    }

    function setSupplierOptions(selectEl, placeholder) {
        if (!selectEl) return;
        selectEl.innerHTML = `<option value="">${placeholder}</option>` +
            allSuppliersForInventory.map((s) => `<option value="${s.id}">${s.company_name}</option>`).join('');
    }

    async function loadMasterData() {
        const [{ data: warehouses }, { data: products }, { data: suppliers }, { data: units }] = await Promise.all([
            DB.from('warehouses').select('id,name,status').eq('status', 'active').order('name', { ascending: true }).get(),
            DB.from('products').select('id,name,unit_id,reorder_level,status').eq('status', 'active').order('name', { ascending: true }).get(),
            DB.from('suppliers').select('id,company_name,status').eq('status', 'active').order('company_name', { ascending: true }).get(),
            DB.from('product_units').select('id,name,name_ar').get()
        ]);

        const unitMap = new Map((units || []).map((u) => [u.id, u.name_ar || u.name]));

        allWarehousesForInventory = Array.isArray(warehouses) ? warehouses : [];
        allSuppliersForInventory = Array.isArray(suppliers) ? suppliers : [];
        allProductsForInventory = (Array.isArray(products) ? products : []).map((p) => ({
            id: p.id,
            name: p.name,
            reorder_level: Number(p.reorder_level || 0),
            unit_name: unitMap.get(p.unit_id) || ''
        }));

        productLabelMap.clear();
        productReorderMap.clear();
        allProductsForInventory.forEach((p) => {
            productLabelMap.set(p.id, `${p.name}${p.unit_name ? ` (${p.unit_name})` : ''}`);
            productReorderMap.set(p.id, Number(p.reorder_level || 0));
        });

        setWarehouseOptions(inventoryWarehouseFilter, 'كل المخازن');
        setWarehouseOptions(inventoryInWarehouseField, 'اختر المخزن...');
        setWarehouseOptions(transferFromWarehouseField, 'اختر المخزن المصدر...');
        setWarehouseOptions(transferToWarehouseField, 'اختر المخزن الهدف...');
        setSupplierOptions(inventoryInSupplierField, 'اختر المورد...');
    }

    function resetInventoryInForm() {
        if (!inventoryInFormElement) return;
        inventoryInFormElement.reset();
        inventoryInDateField.value = todayISO();
        inventoryInItemsTableBody.innerHTML = '';
        addInventoryInItemRow();
    }

    function addInventoryInItemRow(item = null) {
        const row = inventoryInItemsTableBody.insertRow();
        row.className = 'inventory-in-item-row';
        row.innerHTML = `
            <td class="px-3 py-2">
                <select class="form-select product-selector p-1.5 text-sm" required>
                    <option value="">اختر الصنف...</option>
                    ${productOptionsHtml(item?.product_id || item?.productId || '')}
                </select>
            </td>
            <td class="px-3 py-2"><input type="number" min="0.001" step="0.001" value="${Number(item?.quantity || 1)}" class="form-input quantity-input p-1.5 text-sm w-full" required></td>
            <td class="px-3 py-2"><input type="date" class="form-input p-1.5 text-sm w-full production-date-input" value="${item?.production_date || item?.productionDate || ''}"></td>
            <td class="px-3 py-2"><input type="date" class="form-input p-1.5 text-sm w-full expiry-date-input" value="${item?.expiry_date || item?.expiryDate || ''}"></td>
            <td class="px-1 py-2 text-center"><button type="button" class="text-red-500 hover:text-red-700 remove-item-btn p-1 text-sm"><i class="fas fa-trash-alt"></i></button></td>
        `;
        row.querySelector('.remove-item-btn').addEventListener('click', () => row.remove());
    }

    function collectStockInItems() {
        const items = [];
        for (const row of inventoryInItemsTableBody.querySelectorAll('.inventory-in-item-row')) {
            const productId = row.querySelector('.product-selector').value;
            const quantity = Number(row.querySelector('.quantity-input').value || 0);
            const productionDate = row.querySelector('.production-date-input').value || null;
            const expiryDate = row.querySelector('.expiry-date-input').value || null;
            if (productId && quantity > 0) {
                items.push({ product_id: productId, quantity, production_date: productionDate, expiry_date: expiryDate });
            }
        }
        return items;
    }

    function resetTransferForm() {
        if (!inventoryTransferFormElement) return;
        inventoryTransferFormElement.reset();
        transferDateField.value = todayISO();
        inventoryTransferItemsTableBody.innerHTML = '';
        addInventoryTransferItemRow();
    }

    function addInventoryTransferItemRow(item = null) {
        const row = inventoryTransferItemsTableBody.insertRow();
        row.className = 'inventory-transfer-item-row';
        row.innerHTML = `
            <td class="px-3 py-2">
                <select class="form-select product-selector p-1.5 text-sm" required>
                    <option value="">اختر الصنف...</option>
                    ${productOptionsHtml(item?.product_id || item?.productId || '')}
                </select>
            </td>
            <td class="px-3 py-2"><span class="available-stock-transfer text-xs text-gray-600">متاح: 0</span></td>
            <td class="px-3 py-2"><input type="number" min="0.001" step="0.001" value="${Number(item?.quantity || 1)}" class="form-input quantity-input p-1.5 text-sm w-full" required></td>
            <td class="px-1 py-2 text-center"><button type="button" class="text-red-500 hover:text-red-700 remove-item-btn p-1 text-sm"><i class="fas fa-trash-alt"></i></button></td>
        `;

        row.querySelector('.product-selector').addEventListener('change', () => updateTransferAvailableStock(row));
        row.querySelector('.remove-item-btn').addEventListener('click', () => row.remove());
        updateTransferAvailableStock(row);
    }

    function collectTransferItems() {
        const items = [];
        for (const row of inventoryTransferItemsTableBody.querySelectorAll('.inventory-transfer-item-row')) {
            const productId = row.querySelector('.product-selector').value;
            const quantity = Number(row.querySelector('.quantity-input').value || 0);
            if (productId && quantity > 0) items.push({ product_id: productId, quantity });
        }
        return items;
    }

    async function loadStockMapByWarehouse(warehouseId) {
        if (!warehouseId) return new Map();
        const { data, error } = await window.supabaseClient
            .from('inventory_stock')
            .select('product_id,quantity_on_hand')
            .eq('warehouse_id', warehouseId);
        if (error) throw error;
        return new Map((data || []).map((r) => [r.product_id, Number(r.quantity_on_hand || 0)]));
    }

    async function updateTransferAvailableStock(row) {
        const sourceWarehouse = transferFromWarehouseField.value;
        const productId = row.querySelector('.product-selector').value;
        const target = row.querySelector('.available-stock-transfer');
        if (!sourceWarehouse || !productId) {
            target.textContent = 'متاح: 0';
            return;
        }
        try {
            const stockMap = await loadStockMapByWarehouse(sourceWarehouse);
            const qty = Number(stockMap.get(productId) || 0);
            target.textContent = `متاح: ${fmtQty(qty)}`;
            row.querySelector('.quantity-input').max = qty;
        } catch {
            target.textContent = 'متاح: 0';
        }
    }

    async function getInventoryRow(warehouseId, productId) {
        const { data, error } = await window.supabaseClient
            .from('inventory_stock')
            .select('*')
            .eq('warehouse_id', warehouseId)
            .eq('product_id', productId)
            .maybeSingle();
        if (error) throw error;
        return data;
    }

    async function upsertInventoryQuantity({ warehouseId, productId, newQty, reorderLevel }) {
        const companyId = window.AppAuth?.companyId();
        if (!companyId) throw new Error('تعذر تحديد الشركة الحالية.');

        const existing = await getInventoryRow(warehouseId, productId);
        const nowIso = new Date().toISOString();

        if (existing) {
            const { error } = await window.supabaseClient
                .from('inventory_stock')
                .update({
                    quantity_on_hand: newQty,
                    reorder_level: existing.reorder_level ?? reorderLevel ?? null,
                    last_movement_at: nowIso,
                    updated_at: nowIso
                })
                .eq('id', existing.id);
            if (error) throw error;
            return existing.id;
        }

        const { data, error } = await window.supabaseClient
            .from('inventory_stock')
            .insert({
                company_id: companyId,
                warehouse_id: warehouseId,
                product_id: productId,
                quantity_on_hand: newQty,
                quantity_reserved: 0,
                reorder_level: reorderLevel ?? null,
                last_movement_at: nowIso
            })
            .select('id')
            .single();
        if (error) throw error;
        return data?.id;
    }

    async function insertMovement({ warehouseId, productId, movementType, quantity, qtyBefore, qtyAfter, referenceType, referenceId, productionDate, expiryDate, notes }) {
        const companyId = window.AppAuth?.companyId();
        const userId = window.AppAuth?.currentUser?.id || null;
        if (!companyId) throw new Error('تعذر تحديد الشركة الحالية.');

        const { error } = await window.supabaseClient
            .from('stock_movements')
            .insert({
                company_id: companyId,
                warehouse_id: warehouseId,
                product_id: productId,
                movement_type: movementType,
                quantity,
                quantity_before: qtyBefore,
                quantity_after: qtyAfter,
                reference_type: referenceType || null,
                reference_id: referenceId || null,
                production_date: productionDate || null,
                expiry_date: expiryDate || null,
                notes: notes || null,
                performed_by: userId
            });
        if (error) throw error;
    }

    async function saveStockIn() {
        if (!saveInventoryInBtn) return;
        window.showButtonSpinner(saveInventoryInBtn, true);

        try {
            const warehouseId = inventoryInWarehouseField.value;
            if (!warehouseId) throw new Error('يرجى اختيار المخزن المستلم.');

            const items = collectStockInItems();
            if (!items.length) throw new Error('يرجى إضافة صنف واحد على الأقل.');

            for (const item of items) {
                const existing = await getInventoryRow(warehouseId, item.product_id);
                const qtyBefore = Number(existing?.quantity_on_hand || 0);
                const qtyAfter = qtyBefore + Number(item.quantity);

                await upsertInventoryQuantity({
                    warehouseId,
                    productId: item.product_id,
                    newQty: qtyAfter,
                    reorderLevel: productReorderMap.get(item.product_id) || null
                });

                await insertMovement({
                    warehouseId,
                    productId: item.product_id,
                    movementType: inventoryInSupplierField.value ? 'purchase_receipt' : 'adjustment_in',
                    quantity: item.quantity,
                    qtyBefore,
                    qtyAfter,
                    referenceType: inventoryInSupplierField.value ? 'purchase_invoice' : 'adjustment',
                    referenceId: null,
                    productionDate: item.production_date,
                    expiryDate: item.expiry_date,
                    notes: inventoryInRefField.value || inventoryInNotesField.value || null
                });
            }

            const closeBtn = document.getElementById('close-inventory-in-form-btn');
            if (closeBtn) closeBtn.click();
            await loadAndRenderInventoryStock();
        } catch (err) {
            console.error('Error saving stock-in:', err);
            window.AppNotify?.error(`فشل حفظ إذن الإضافة: ${err.message || 'خطأ غير متوقع.'}`);
        } finally {
            window.showButtonSpinner(saveInventoryInBtn, false);
        }
    }

    async function saveTransfer() {
        if (!saveTransferBtn) return;
        window.showButtonSpinner(saveTransferBtn, true);

        try {
            const sourceWarehouse = transferFromWarehouseField.value;
            const targetWarehouse = transferToWarehouseField.value;
            if (!sourceWarehouse || !targetWarehouse) throw new Error('يرجى اختيار مخزن المصدر والهدف.');
            if (sourceWarehouse === targetWarehouse) throw new Error('لا يمكن التحويل إلى نفس المخزن.');

            const items = collectTransferItems();
            if (!items.length) throw new Error('يرجى إضافة صنف واحد على الأقل.');

            const sourceStockMap = await loadStockMapByWarehouse(sourceWarehouse);
            for (const item of items) {
                const available = Number(sourceStockMap.get(item.product_id) || 0);
                if (item.quantity > available) {
                    throw new Error(`الكمية غير كافية للصنف ${productLabelMap.get(item.product_id) || item.product_id}. المتاح: ${fmtQty(available)}`);
                }
            }

            for (const item of items) {
                const srcExisting = await getInventoryRow(sourceWarehouse, item.product_id);
                const srcBefore = Number(srcExisting?.quantity_on_hand || 0);
                const srcAfter = srcBefore - Number(item.quantity);

                await upsertInventoryQuantity({
                    warehouseId: sourceWarehouse,
                    productId: item.product_id,
                    newQty: srcAfter,
                    reorderLevel: srcExisting?.reorder_level ?? productReorderMap.get(item.product_id) ?? null
                });

                await insertMovement({
                    warehouseId: sourceWarehouse,
                    productId: item.product_id,
                    movementType: 'transfer_out',
                    quantity: item.quantity,
                    qtyBefore: srcBefore,
                    qtyAfter: srcAfter,
                    referenceType: 'transfer',
                    referenceId: null,
                    notes: transferNotesField.value || null
                });

                const dstExisting = await getInventoryRow(targetWarehouse, item.product_id);
                const dstBefore = Number(dstExisting?.quantity_on_hand || 0);
                const dstAfter = dstBefore + Number(item.quantity);

                await upsertInventoryQuantity({
                    warehouseId: targetWarehouse,
                    productId: item.product_id,
                    newQty: dstAfter,
                    reorderLevel: dstExisting?.reorder_level ?? productReorderMap.get(item.product_id) ?? null
                });

                await insertMovement({
                    warehouseId: targetWarehouse,
                    productId: item.product_id,
                    movementType: 'transfer_in',
                    quantity: item.quantity,
                    qtyBefore: dstBefore,
                    qtyAfter: dstAfter,
                    referenceType: 'transfer',
                    referenceId: null,
                    notes: transferNotesField.value || null
                });
            }

            const closeBtn = document.getElementById('close-inventory-transfer-form-btn');
            if (closeBtn) closeBtn.click();
            await loadAndRenderInventoryStock();
        } catch (err) {
            console.error('Error saving transfer:', err);
            window.AppNotify?.error(`فشل حفظ التحويل المخزني: ${err.message || 'خطأ غير متوقع.'}`);
        } finally {
            window.showButtonSpinner(saveTransferBtn, false);
        }
    }

    async function loadAndRenderInventoryStock() {
        if (!inventoryTableBody) return;
        inventoryTableBody.innerHTML = `<tr><td colspan="7" class="text-center p-4">جاري تحميل أرصدة المخزون...</td></tr>`;

        try {
            const { data, error } = await window.supabaseClient
                .from('v_inventory_summary')
                .select('*')
                .order('product_name', { ascending: true });
            if (error) throw error;

            allInventoryStockData = Array.isArray(data) ? data : [];
            applyInventoryFiltersAndRender();
        } catch (err) {
            console.error('Error loading inventory summary:', err);
            inventoryTableBody.innerHTML = `<tr><td colspan="7" class="text-center p-4 text-red-500">فشل تحميل أرصدة المخزون: ${err.message}</td></tr>`;
        }
    }

    function applyInventoryFiltersAndRender() {
        let filtered = [...allInventoryStockData];

        const search = (inventorySearchInput?.value || '').trim().toLowerCase();
        const warehouseId = inventoryWarehouseFilter?.value || '';
        const stockStatus = inventoryStockStatusFilter?.value || '';

        if (search) {
            filtered = filtered.filter((item) =>
                String(item.product_name || '').toLowerCase().includes(search) ||
                String(item.barcode || '').toLowerCase().includes(search)
            );
        }

        if (warehouseId) {
            const selectedName = allWarehousesForInventory.find((w) => w.id === warehouseId)?.name;
            if (selectedName) filtered = filtered.filter((item) => item.warehouse_name === selectedName);
        }

        if (stockStatus) filtered = filtered.filter((item) => item.stock_status === stockStatus);

        renderInventoryTable(filtered);
    }

    function renderInventoryTable(rows) {
        if (!inventoryTableBody) return;
        inventoryTableBody.innerHTML = '';

        if (!rows.length) {
            inventoryTableBody.innerHTML = `<tr><td colspan="7" class="text-center p-4">لا توجد بيانات مخزون للعرض.</td></tr>`;
            return;
        }

        rows.forEach((item) => {
            const row = inventoryTableBody.insertRow();
            const statusClass = item.stock_status === 'out_of_stock'
                ? 'bg-red-100 text-red-800 dark:bg-red-700 dark:text-red-100'
                : item.stock_status === 'low_stock'
                    ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-700 dark:text-yellow-100'
                    : 'bg-green-100 text-green-800 dark:bg-green-700 dark:text-green-100';

            const statusLabel = item.stock_status === 'out_of_stock'
                ? 'نفذ المخزون'
                : item.stock_status === 'low_stock'
                    ? 'مخزون منخفض'
                    : 'متوفر';

            row.innerHTML = `
                <td class="px-6 py-3 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">${item.product_name || '—'}</td>
                <td class="px-6 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">${item.warehouse_name || '—'}</td>
                <td class="px-6 py-3 whitespace-nowrap text-sm font-semibold text-gray-700 dark:text-gray-200">${fmtQty(item.quantity_available)}</td>
                <td class="px-6 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">${item.unit_name || '-'}</td>
                <td class="px-6 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">${item.effective_reorder_level ?? '-'}</td>
                <td class="px-6 py-3 whitespace-nowrap"><span class="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${statusClass}">${statusLabel}</span></td>
                <td class="px-6 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">${item.last_movement_at ? new Date(item.last_movement_at).toLocaleString('ar-EG') : '-'}</td>
            `;
        });
    }

    window.setupFormToggle({
        currentModule: 'inventory',
        addButtonId: 'add-inventory-in-btn',
        formContainerId: 'inventory-in-form-container',
        closeButtonId: 'close-inventory-in-form-btn',
        cancelButtonId: 'cancel-inventory-in-form-btn',
        formId: 'inventory-in-form',
        formTitleId: 'inventory-in-form-title',
        addTitle: 'إذن إضافة مخزون (وارد)',
        editTitle: 'إذن إضافة مخزون (وارد)',
        resetFormFunction: resetInventoryInForm,
        onOpen: async () => {
            await loadMasterData();
            if (!inventoryInItemsTableBody.querySelector('tr')) addInventoryInItemRow();
        }
    });

    window.setupFormToggle({
        currentModule: 'inventory',
        addButtonId: 'add-inventory-transfer-btn',
        formContainerId: 'inventory-transfer-form-container',
        closeButtonId: 'close-inventory-transfer-form-btn',
        cancelButtonId: 'cancel-inventory-transfer-form-btn',
        formId: 'inventory-transfer-form',
        formTitleId: 'inventory-transfer-form-title',
        addTitle: 'أمر تحويل مخزني',
        editTitle: 'أمر تحويل مخزني',
        resetFormFunction: resetTransferForm,
        onOpen: async () => {
            await loadMasterData();
            if (!inventoryTransferItemsTableBody.querySelector('tr')) addInventoryTransferItemRow();
        }
    });

    if (addInventoryInItemBtn) addInventoryInItemBtn.addEventListener('click', () => addInventoryInItemRow());
    if (addInventoryTransferItemBtn) addInventoryTransferItemBtn.addEventListener('click', () => addInventoryTransferItemRow());

    if (transferFromWarehouseField) {
        transferFromWarehouseField.addEventListener('change', () => {
            inventoryTransferItemsTableBody.querySelectorAll('.inventory-transfer-item-row').forEach((row) => updateTransferAvailableStock(row));
        });
    }

    if (inventoryInFormElement) {
        inventoryInFormElement.addEventListener('submit', async (e) => {
            e.preventDefault();
            await saveStockIn();
        });
    }

    if (inventoryTransferFormElement) {
        inventoryTransferFormElement.addEventListener('submit', async (e) => {
            e.preventDefault();
            await saveTransfer();
        });
    }

    if (inventorySearchInput) inventorySearchInput.addEventListener('input', applyInventoryFiltersAndRender);
    if (inventoryWarehouseFilter) inventoryWarehouseFilter.addEventListener('change', applyInventoryFiltersAndRender);
    if (inventoryStockStatusFilter) inventoryStockStatusFilter.addEventListener('change', applyInventoryFiltersAndRender);

    await loadMasterData();
    await loadAndRenderInventoryStock();
}
