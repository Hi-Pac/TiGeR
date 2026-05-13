let allSalesData = [];
let allCustomersForSale = [];
let allSalespersons = [];
let allProductsForSale = [];
let allWarehousesForSale = [];

async function initSalesModule() {
    // Reset stale state from any previous visit to this module.
    allSalesData = [];
    allCustomersForSale = [];
    allSalespersons = [];
    allProductsForSale = [];
    allWarehousesForSale = [];

    const salesModuleNode = document.getElementById('sales-module');
    if (!salesModuleNode) return;

    const salesTableBody = salesModuleNode.querySelector('#sales-table-body');
    const saleSearchInput = salesModuleNode.querySelector('#sale-search-input');
    const saleCustomerFilter = salesModuleNode.querySelector('#sale-customer-filter');
    const saleStatusFilter = salesModuleNode.querySelector('#sale-status-filter');
    const saleDateFromFilter = salesModuleNode.querySelector('#sale-date-from-filter');
    const saleDateToFilter = salesModuleNode.querySelector('#sale-date-to-filter');

    const saleFormElement = document.getElementById('sale-form');
    const saleIdField = document.getElementById('sale-id-field');
    const saleCustomerField = document.getElementById('sale-customer-field');
    const saleDateField = document.getElementById('sale-date-field');
    const saleSalespersonField = document.getElementById('sale-salesperson-field');
    const saleWarehouseField = document.getElementById('sale-warehouse-field');
    const salePaymentMethodField = document.getElementById('sale-payment-method-field');
    const saleDeliveryStatusField = document.getElementById('sale-delivery-status-field');
    const saleNotesField = document.getElementById('sale-notes-field');
    const saleItemsTableBody = document.getElementById('sale-items-table-body');
    const addSaleItemBtn = document.getElementById('add-sale-item-btn');
    const saleDiscountField = document.getElementById('sale-discount-field');
    const saleTaxPercentageField = document.getElementById('sale-tax-percentage-field');
    const saleSubtotalAmountEl = document.getElementById('sale-subtotal-amount');
    const saleTaxAmountEl = document.getElementById('sale-tax-amount');
    const saleGrandTotalAmountEl = document.getElementById('sale-grand-total-amount');
    const saveSaleBtn = document.getElementById('save-sale-form-btn');
    const saveAndPrintSaleBtn = document.getElementById('save-print-sale-form-btn');

    const fmtMoney = (n) => (window.ERPUtils?.fmtMoney ?? ((x) => `${(Number(x) || 0).toFixed(2)} ج.م`))(n);
    const todayISO = () => new Date().toISOString().slice(0, 10);
    const getSalesSettings = () => window.AppConfig?.getSection('salesSettings') || {};
    const getFinancialSettings = () => window.AppConfig?.getSection('financialSettings') || {};
    const paymentLabel = { unpaid: 'غير مدفوعة', partially_paid: 'مدفوعة جزئياً', paid: 'مدفوعة', overdue: 'متأخرة' };
    const deliveryLabel = { pending: 'قيد الانتظار', partial: 'جزئي', dispatched: 'تم الشحن', delivered: 'تم التسليم', returned: 'مرتجعة' };

    // Delegate to ERPUtils canonical implementations (js/business-logic.js)
    const mapDeliveryUiToDb    = (v) => (window.ERPUtils?.mapDeliveryUiToDb    ?? _mapDeliveryUiToDbFallback)(v);
    const mapDeliveryDbToUi    = (v) => (window.ERPUtils?.mapDeliveryDbToUi    ?? _mapDeliveryDbToUiFallback)(v);
    const mapStatusFilterToDb  = (v) => (window.ERPUtils?.mapSalesStatusFilterToDb ?? _mapSalesStatusFilterFallback)(v);
    const inferPaymentStatus   = (m) => (window.ERPUtils?.inferPaymentStatus   ?? _inferPaymentStatusFallback)(m);

    // Fallback implementations (active only when business-logic.js did not load)
    function _mapDeliveryUiToDbFallback(value) {
        if (value === 'pending_delivery') return 'pending';
        if (value === 'out_for_delivery') return 'dispatched';
        if (value === 'delivered') return 'delivered';
        return 'pending';
    }
    function _mapDeliveryDbToUiFallback(value) {
        if (value === 'pending') return 'pending_delivery';
        if (value === 'dispatched') return 'out_for_delivery';
        if (value === 'delivered') return 'delivered';
        return 'pending_delivery';
    }
    function _mapSalesStatusFilterFallback(value) {
        if (value === 'pending_payment') return { field: 'payment_status', value: 'unpaid' };
        if (['unpaid', 'partially_paid', 'paid', 'overdue'].includes(value)) return { field: 'payment_status', value };
        if (value === 'pending_delivery') return { field: 'delivery_status', value: 'pending' };
        if (value === 'delivered') return { field: 'delivery_status', value: 'delivered' };
        if (value === 'cancelled') return { field: 'invoice_status', value: 'cancelled' };
        return null;
    }
    function _inferPaymentStatusFallback(method) {
        return method === 'cash' ? 'paid' : 'unpaid';
    }

    function saleItemOptionsHtml(selectedId = '', selectedWarehouseId = '') {
        return allProductsForSale.map((p) => {
            const selected = p.id === selectedId ? 'selected' : '';
            const stock = Number(p.stockByWarehouse?.[selectedWarehouseId] || 0);
            return `<option value="${p.id}" data-price="${p.sale_price}" data-unit="${p.unit_name || ''}" data-stock="${stock}" ${selected}>${p.name} ${p.unit_name ? `(${p.unit_name})` : ''}</option>`;
        }).join('');
    }

    function populatePaymentMethodOptions() {
        window.AppConfig?.populateSelect(salePaymentMethodField, 'salePaymentMethods', { preserveValue: true });
    }

    async function loadCustomers() {
        const { data } = await DB.from('customers')
            .select('id,shop_name,status')
            .eq('status', 'active')
            .order('shop_name', { ascending: true })
            .get();
        allCustomersForSale = Array.isArray(data) ? data : [];

        const options = '<option value="">اختر العميل...</option>' +
            allCustomersForSale.map((c) => `<option value="${c.id}">${c.shop_name}</option>`).join('');
        if (saleCustomerField) saleCustomerField.innerHTML = options;

        const filterOptions = '<option value="">كل العملاء</option>' +
            allCustomersForSale.map((c) => `<option value="${c.id}">${c.shop_name}</option>`).join('');
        if (saleCustomerFilter) saleCustomerFilter.innerHTML = filterOptions;
    }

    async function loadSalespersons() {
        const { data } = await DB.from('profiles')
            .select('id,full_name,role,status')
            .eq('status', 'active')
            .order('full_name', { ascending: true })
            .get();
        allSalespersons = (Array.isArray(data) ? data : []).filter((u) => ['sales', 'admin'].includes(u.role));
        const options = '<option value="">اختر المندوب...</option>' +
            allSalespersons.map((u) => `<option value="${u.id}">${u.full_name}</option>`).join('');
        if (saleSalespersonField) saleSalespersonField.innerHTML = options;
    }

    async function loadWarehouses() {
        const { data } = await DB.from('warehouses')
            .select('id,name,status')
            .eq('status', 'active')
            .order('name', { ascending: true })
            .get();
        allWarehousesForSale = Array.isArray(data) ? data : [];
        const options = '<option value="">اختر المخزن...</option>' +
            allWarehousesForSale.map((w) => `<option value="${w.id}">${w.name}</option>`).join('');
        if (saleWarehouseField) saleWarehouseField.innerHTML = options;
    }

    async function loadProductsWithStock() {
        const [{ data: products }, { data: units }, { data: stockRows }] = await Promise.all([
            DB.from('products').select('id,name,sale_price,unit_id,status').eq('status', 'active').order('name', { ascending: true }).get(),
            DB.from('product_units').select('id,name,name_ar').get(),
            window.supabaseClient.from('inventory_stock').select('product_id,warehouse_id,quantity_on_hand')
        ]);

        const unitMap = new Map((units || []).map((u) => [u.id, u.name_ar || u.name]));
        const stockByProduct = new Map();
        (stockRows || []).forEach((r) => {
            if (!stockByProduct.has(r.product_id)) stockByProduct.set(r.product_id, {});
            stockByProduct.get(r.product_id)[r.warehouse_id] = Number(r.quantity_on_hand || 0);
        });

        allProductsForSale = (products || []).map((p) => ({
            id: p.id,
            name: p.name,
            sale_price: Number(p.sale_price || 0),
            unit_name: unitMap.get(p.unit_id) || '',
            stockByWarehouse: stockByProduct.get(p.id) || {}
        }));
    }

    function resetSaleForm(saleData = null) {
        if (!saleFormElement) return;
        saleFormElement.reset();
        const salesSettings = getSalesSettings();
        const financialSettings = getFinancialSettings();
        populatePaymentMethodOptions();
        saleIdField.value = '';
        saleDateField.value = todayISO();
        saleDeliveryStatusField.value = 'pending_delivery';
        saleItemsTableBody.innerHTML = '';

        if (saleData) {
            saleIdField.value = saleData.id;
            saleCustomerField.value = saleData.customer_id || '';
            saleDateField.value = saleData.invoice_date || todayISO();
            saleSalespersonField.value = saleData.salesperson_id || '';
            saleWarehouseField.value = saleData.warehouse_id || salesSettings.defaultWarehouseId || '';
            salePaymentMethodField.value = saleData.payment_method || salesSettings.defaultPaymentMethod || 'cash';
            saleDeliveryStatusField.value = mapDeliveryDbToUi(saleData.delivery_status);
            saleDiscountField.value = Number(saleData.discount_amount || 0);
            saleTaxPercentageField.value = Number(saleData.tax_rate || salesSettings.defaultTaxRate || financialSettings.vatPercentage || 0);
            saleNotesField.value = saleData.notes || '';

            (saleData.items || []).forEach((item) => addSaleItemRow(item));
            if (!saleData.items || saleData.items.length === 0) addSaleItemRow();
        } else {
            saleWarehouseField.value = salesSettings.defaultWarehouseId || '';
            salePaymentMethodField.value = salesSettings.defaultPaymentMethod || 'cash';
            saleDiscountField.value = 0;
            saleTaxPercentageField.value = Number(salesSettings.defaultTaxRate ?? financialSettings.vatPercentage ?? 14);
            addSaleItemRow();
        }

        updateAllItemStockIndicators();
        calculateSaleTotals();
    }

    const openSaleFormForEdit = window.setupFormToggle({
        currentModule: 'sales',
        addButtonId: 'add-sale-btn',
        formContainerId: 'sale-form-container',
        closeButtonId: 'close-sale-form-btn',
        cancelButtonId: 'cancel-sale-form-btn',
        formId: 'sale-form',
        formTitleId: 'sale-form-title',
        addTitle: 'فاتورة مبيعات جديدة',
        editTitle: 'تعديل فاتورة المبيعات',
        resetFormFunction: resetSaleForm,
        onOpen: async () => {
            await Promise.all([loadCustomers(), loadSalespersons(), loadWarehouses(), loadProductsWithStock()]);
        }
    });

    function addSaleItemRow(item = null) {
        const row = saleItemsTableBody.insertRow();
        row.className = 'sale-item-row border-b dark:border-gray-700';

        row.innerHTML = `
            <td class="px-3 py-2">
                <select class="form-select product-selector p-1.5 text-sm" required>
                    <option value="">اختر الصنف...</option>
                    ${saleItemOptionsHtml(item?.product_id || item?.productId || '', saleWarehouseField.value)}
                </select>
            </td>
            <td class="px-3 py-2"><span class="available-stock-display text-xs text-gray-600 dark:text-gray-400">متاح: 0</span></td>
            <td class="px-3 py-2"><input type="number" min="0.001" step="0.001" value="${Number(item?.quantity || 1)}" class="form-input quantity-input p-1.5 text-sm w-full" required></td>
            <td class="px-3 py-2"><input type="number" min="0" step="0.0001" value="${Number(item?.unit_price || item?.unitPrice || 0)}" class="form-input unit-price-input p-1.5 text-sm w-full" required></td>
            <td class="px-3 py-2 text-sm item-total-display text-right">0.00</td>
            <td class="px-1 py-2 text-center"><button type="button" class="text-red-500 hover:text-red-700 remove-item-btn p-1 text-sm"><i class="fas fa-trash-alt"></i></button></td>
        `;

        const productSelector = row.querySelector('.product-selector');
        const qtyInput = row.querySelector('.quantity-input');
        const priceInput = row.querySelector('.unit-price-input');

        productSelector.addEventListener('change', () => {
            const selected = productSelector.options[productSelector.selectedIndex];
            priceInput.value = Number(selected?.getAttribute('data-price') || 0);
            updateStockIndicator(row);
            calculateSaleTotals();
        });

        qtyInput.addEventListener('input', () => {
            const maxStock = Number(productSelector.options[productSelector.selectedIndex]?.getAttribute('data-stock') || 0);
            const requestedQty = Number(qtyInput.value || 0);
            if (maxStock >= 0 && requestedQty > maxStock) {
                qtyInput.value = maxStock > 0 ? maxStock : 0;
                window.AppNotify?.warning(`الكمية المطلوبة (${requestedQty}) تتجاوز المخزون المتاح (${maxStock}).`);
            }
            calculateSaleTotals();
        });
        priceInput.addEventListener('input', calculateSaleTotals);
        row.querySelector('.remove-item-btn').addEventListener('click', () => {
            row.remove();
            calculateSaleTotals();
        });

        updateStockIndicator(row);
        calculateSaleTotals();
    }

    function updateStockIndicator(row) {
        const productSelector = row.querySelector('.product-selector');
        const stockEl = row.querySelector('.available-stock-display');
        const stock = Number(productSelector.options[productSelector.selectedIndex]?.getAttribute('data-stock') || 0);
        stockEl.textContent = `متاح: ${stock}`;
    }

    function updateAllItemStockIndicators() {
        const selectedWarehouse = saleWarehouseField.value;
        saleItemsTableBody.querySelectorAll('.sale-item-row').forEach((row) => {
            const selector = row.querySelector('.product-selector');
            const selectedId = selector.value;
            selector.innerHTML = `<option value="">اختر الصنف...</option>${saleItemOptionsHtml(selectedId, selectedWarehouse)}`;
            selector.value = selectedId;
            updateStockIndicator(row);
        });
    }

    function collectItemsFromForm() {
        const items = [];
        for (const row of saleItemsTableBody.querySelectorAll('.sale-item-row')) {
            const productId = row.querySelector('.product-selector').value;
            const quantity = Number(row.querySelector('.quantity-input').value || 0);
            const unitPrice = Number(row.querySelector('.unit-price-input').value || 0);
            if (productId && quantity > 0) {
                items.push({
                    product_id: productId,
                    quantity,
                    unit_price: unitPrice,
                    discount_amount: 0,
                    total_amount: quantity * unitPrice
                });
            }
        }
        return items;
    }

    function calculateSaleTotals() {
        let subtotal = 0;
        saleItemsTableBody.querySelectorAll('.sale-item-row').forEach((row) => {
            const q = Number(row.querySelector('.quantity-input').value || 0);
            const p = Number(row.querySelector('.unit-price-input').value || 0);
            const total = q * p;
            row.querySelector('.item-total-display').textContent = total.toFixed(2);
            subtotal += total;
        });

        const discount = Number(saleDiscountField.value || 0);
        const taxRate = Number(saleTaxPercentageField.value || 0);
        const taxBase = Math.max(0, subtotal - discount);
        const taxAmount = taxBase * (taxRate / 100);
        const grandTotal = taxBase + taxAmount;

        saleSubtotalAmountEl.textContent = fmtMoney(subtotal);
        saleTaxAmountEl.textContent = fmtMoney(taxAmount);
        saleGrandTotalAmountEl.textContent = fmtMoney(grandTotal);

        return { subtotal, discount, taxRate, taxAmount, grandTotal };
    }

    // Page size for the sales list. Increase or add cursor-based pagination UI as needed.
    const SALES_PAGE_SIZE = 100;

    async function loadAndRenderSales() {
        if (!salesTableBody) return;
        salesTableBody.innerHTML = `<tr><td colspan="8" class="text-center p-4">جاري تحميل فواتير المبيعات...</td></tr>`;

        try {
            await Promise.all([loadCustomers(), loadSalespersons(), loadWarehouses()]);

            // Explicit column selection (avoids over-fetching notes, audit fields, etc.)
            // Embed invoice items in the same query to eliminate N+1 on edit clicks.
            const { data, error } = await window.supabaseClient
                .from('sales_invoices')
                .select(`
                    id,
                    invoice_number,
                    invoice_date,
                    customer_id,
                    salesperson_id,
                    warehouse_id,
                    payment_method,
                    payment_status,
                    delivery_status,
                    invoice_status,
                    subtotal_amount,
                    discount_amount,
                    tax_rate,
                    tax_amount,
                    total_amount,
                    notes,
                    sales_invoice_items (
                        id,
                        product_id,
                        quantity,
                        unit_price,
                        discount_amount,
                        total_amount
                    )
                `)
                .order('invoice_date', { ascending: false })
                .limit(SALES_PAGE_SIZE);
            if (error) throw error;

            const customerMap = new Map(allCustomersForSale.map((c) => [c.id, c.shop_name]));
            const salespersonMap = new Map(allSalespersons.map((u) => [u.id, u.full_name]));
            const warehouseMap = new Map(allWarehousesForSale.map((w) => [w.id, w.name]));

            allSalesData = (data || []).map((r) => ({
                ...r,
                customer_name: customerMap.get(r.customer_id) || '—',
                salesperson_name: salespersonMap.get(r.salesperson_id) || '—',
                warehouse_name: warehouseMap.get(r.warehouse_id) || '—'
                // r.sales_invoice_items is now pre-fetched and available for edit
            }));

            applySaleFiltersAndRender();
        } catch (err) {
            console.error('Error loading sales:', err);
            salesTableBody.innerHTML = `<tr><td colspan="8" class="text-center p-4 text-red-500">فشل تحميل فواتير المبيعات: ${err.message}</td></tr>`;
        }
    }

    function applySaleFiltersAndRender() {
        let filtered = [...allSalesData];

        const search = (saleSearchInput?.value || '').trim().toLowerCase();
        const customerId = saleCustomerFilter?.value || '';
        const statusVal = saleStatusFilter?.value || '';
        const dateFrom = saleDateFromFilter?.value || '';
        const dateTo = saleDateToFilter?.value || '';

        if (search) {
            filtered = filtered.filter((s) =>
                String(s.invoice_number || '').toLowerCase().includes(search) ||
                String(s.customer_name || '').toLowerCase().includes(search)
            );
        }

        if (customerId) filtered = filtered.filter((s) => s.customer_id === customerId);

        if (statusVal) {
            const rule = mapStatusFilterToDb(statusVal);
            if (rule) filtered = filtered.filter((s) => s[rule.field] === rule.value);
        }

        if (dateFrom) filtered = filtered.filter((s) => String(s.invoice_date || '') >= dateFrom);
        if (dateTo) filtered = filtered.filter((s) => String(s.invoice_date || '') <= dateTo);

        renderSalesTable(filtered);
    }

    function renderSalesTable(salesToRender) {
        if (!salesTableBody) return;
        salesTableBody.innerHTML = '';

        if (!salesToRender.length) {
            salesTableBody.innerHTML = `<tr><td colspan="8" class="text-center p-4">لا توجد فواتير مبيعات.</td></tr>`;
            return;
        }

        salesToRender.forEach((sale) => {
            const row = salesTableBody.insertRow();
            const pay = paymentLabel[sale.payment_status] || sale.payment_status || '—';
            const del = deliveryLabel[sale.delivery_status] || sale.delivery_status || '—';

            row.innerHTML = `
                <td class="px-6 py-3 whitespace-nowrap text-sm font-medium text-primary">${sale.invoice_number || sale.id}</td>
                <td class="px-6 py-3 whitespace-nowrap text-sm">${sale.customer_name}</td>
                <td class="px-6 py-3 whitespace-nowrap text-sm">${sale.invoice_date || '—'}</td>
                <td class="px-6 py-3 whitespace-nowrap text-sm font-semibold">${fmtMoney(sale.total_amount)}</td>
                <td class="px-6 py-3 whitespace-nowrap text-sm">${sale.salesperson_name}</td>
                <td class="px-6 py-3 whitespace-nowrap text-xs">${pay}</td>
                <td class="px-6 py-3 whitespace-nowrap text-xs">${del}</td>
                <td class="px-6 py-3 whitespace-nowrap text-sm font-medium text-left">
                    <button class="text-primary hover:text-primary/80 ml-2 edit-sale-btn" data-id="${sale.id}" title="تعديل"><i class="fas fa-edit"></i></button>
                    <button class="text-red-600 hover:text-red-800 delete-sale-btn" data-id="${sale.id}" title="إلغاء"><i class="fas fa-trash-alt"></i></button>
                </td>
            `;
        });

        salesModuleNode.querySelectorAll('.edit-sale-btn').forEach((btn) => {
            btn.addEventListener('click', async (e) => {
                const saleId = e.currentTarget.getAttribute('data-id');
                const sale = allSalesData.find((s) => s.id === saleId);
                if (!sale) return;

                // Items were pre-fetched with the list query (sales_invoice_items embedded).
                // Fall back to a direct fetch only if the embedded array is missing (e.g. RLS
                // stripped it or the record was loaded before this optimisation was deployed).
                let items = Array.isArray(sale.sales_invoice_items) ? sale.sales_invoice_items : null;
                if (!items) {
                    const { data: fetched } = await window.supabaseClient
                        .from('sales_invoice_items')
                        .select('id,product_id,quantity,unit_price,discount_amount,total_amount')
                        .eq('sales_invoice_id', saleId)
                        .order('created_at', { ascending: true });
                    items = fetched || [];
                }

                openSaleFormForEdit({ ...sale, items });
            });
        });

        salesModuleNode.querySelectorAll('.delete-sale-btn').forEach((btn) => {
            btn.addEventListener('click', async (e) => {
                const saleId = e.currentTarget.getAttribute('data-id');
                await handleDeleteSale(saleId);
            });
        });

        window.applyModuleActionGuards?.('sales', salesModuleNode);
    }

    async function saveSale(shouldPrint = false) {
        const submitBtn = shouldPrint ? saveAndPrintSaleBtn : saveSaleBtn;
        if (!submitBtn) return;

        window.showButtonSpinner(submitBtn, true);

        try {
            const saleId = saleIdField.value;
            const items = collectItemsFromForm();
            if (!items.length) throw new Error('يجب إضافة صنف واحد على الأقل للفاتورة.');
            if (!saleCustomerField.value) throw new Error('يرجى اختيار العميل.');
            if (!saleWarehouseField.value) throw new Error('يرجى اختيار المخزن.');

            // ✅ NEW: Validate inventory availability before saving
            const warehouseId = saleWarehouseField.value;
            const productIds = [...new Set(items.map(item => item.product_id))];

            // Fetch current stock for all products in this warehouse
            const { data: stockData, error: stockErr } = await window.supabaseClient
                .from('inventory_stock')
                .select('product_id, warehouse_id, quantity_on_hand')
                .eq('warehouse_id', warehouseId)
                .in('product_id', productIds);

            if (stockErr) {
                console.error('Error fetching stock:', stockErr);
                throw new Error('فشل التحقق من المخزون المتاح');
            }

            // Get product names for better error messages
            const productsMap = new Map();
            allProductsForSale.forEach(p => productsMap.set(p.id, p.name));

            // Prepare items with product names and warehouse
            const itemsToValidate = items.map(item => ({
                product_id: item.product_id,
                product_name: productsMap.get(item.product_id) || 'منتج غير معروف',
                quantity: item.quantity,
                warehouse_id: warehouseId
            }));

            // Validate inventory using business-logic function
            const validation = window.ERPUtils?.validateItemsInventory(
                itemsToValidate,
                stockData || [],
                { allowNegative: false }
            );

            if (!validation.valid) {
                const errorMessages = validation.errors.map(err => err.message).join('\n');
                throw new Error(`لا يمكن حفظ الفاتورة - المخزون غير كافٍ:\n\n${errorMessages}\n\nإجمالي النقص: ${validation.totalShortage}`);
            }

            const totals = calculateSaleTotals();
            const nowStamp = Date.now();
            const generatedNo = `SI-${nowStamp}`;

            const invoicePayload = {
                customer_id: saleCustomerField.value,
                warehouse_id: saleWarehouseField.value,
                salesperson_id: saleSalespersonField.value || null,
                invoice_date: saleDateField.value || todayISO(),
                payment_method: salePaymentMethodField.value || 'cash',
                payment_status: inferPaymentStatus(salePaymentMethodField.value || 'cash'),
                delivery_status: mapDeliveryUiToDb(saleDeliveryStatusField.value),
                invoice_status: 'posted',
                subtotal_amount: totals.subtotal,
                discount_amount: totals.discount,
                tax_rate: totals.taxRate,
                tax_amount: totals.taxAmount,
                total_amount: totals.grandTotal,
                notes: saleNotesField.value || null,
                created_by: window.AppAuth?.currentUser?.id || null
            };

            let finalSaleId = saleId;
            if (saleId) {
                await DB.from('sales_invoices').eq('id', saleId).update(invoicePayload);

                const { error: delErr } = await window.supabaseClient
                    .from('sales_invoice_items')
                    .delete()
                    .eq('sales_invoice_id', saleId);
                if (delErr) throw delErr;
            } else {
                const inserted = await DB.from('sales_invoices').insert({
                    ...invoicePayload,
                    invoice_number: generatedNo
                });
                finalSaleId = inserted?.id;
                if (!finalSaleId) throw new Error('تعذر إنشاء الفاتورة.');
            }

            const rows = items.map((it) => ({
                sales_invoice_id: finalSaleId,
                product_id: it.product_id,
                quantity: it.quantity,
                unit_price: it.unit_price,
                discount_amount: it.discount_amount,
                total_amount: it.total_amount
            }));

            const { error: insErr } = await window.supabaseClient
                .from('sales_invoice_items')
                .insert(rows);
            if (insErr) throw insErr;

            // Process stock movements for each item using database function
            for (const item of items) {
                const { error: stockErr } = await window.supabaseClient.rpc(
                    'fn_process_stock_movement',
                    {
                        p_product_id: item.product_id,
                        p_warehouse_id: saleWarehouseField.value,
                        p_movement_type: 'sale',
                        p_quantity: item.quantity,
                        p_reference_type: 'sales_invoice',
                        p_reference_id: finalSaleId,
                        p_notes: `Sales invoice ${invoicePayload.invoice_number || generatedNo}`
                    }
                );
                if (stockErr) throw stockErr;
            }

            if (window.AppConfig?.getSection('notificationsSettings')?.notifyInvoiceSave || shouldPrint) {
                window.AppNotify?.success(`تم حفظ الفاتورة ${finalSaleId}${shouldPrint ? ' وجاهزة للطباعة' : ''}.`);
            }

            const closeBtn = document.getElementById('close-sale-form-btn');
            if (closeBtn) closeBtn.click();
            await loadAndRenderSales();
        } catch (err) {
            console.error('Error saving sale:', err);
            window.AppNotify?.error(`فشل حفظ فاتورة المبيعات: ${err.message || 'خطأ غير متوقع.'}`);
        } finally {
            window.showButtonSpinner(submitBtn, false);
        }
    }

    async function handleDeleteSale(saleId) {
        if (!confirm('هل تريد إلغاء هذه الفاتورة؟')) return;
        try {
            await DB.from('sales_invoices').eq('id', saleId).softDelete();
            await loadAndRenderSales();
            window.AppNotify?.success('تم إلغاء الفاتورة بنجاح.');
        } catch (err) {
            console.error('Error cancelling sale:', err);
            window.AppNotify?.error(`فشل إلغاء الفاتورة: ${err.message || 'خطأ غير متوقع.'}`);
        }
    }

    if (addSaleItemBtn) addSaleItemBtn.addEventListener('click', () => addSaleItemRow());
    if (saleDiscountField) saleDiscountField.addEventListener('input', calculateSaleTotals);
    if (saleTaxPercentageField) saleTaxPercentageField.addEventListener('input', calculateSaleTotals);
    if (saleWarehouseField) saleWarehouseField.addEventListener('change', updateAllItemStockIndicators);

    if (saleFormElement) {
        saleFormElement.addEventListener('submit', async (e) => {
            e.preventDefault();
            await saveSale(false);
        });
    }

    if (saveAndPrintSaleBtn) {
        saveAndPrintSaleBtn.addEventListener('click', async () => {
            await saveSale(true);
        });
    }

    [saleSearchInput, saleCustomerFilter, saleStatusFilter, saleDateFromFilter, saleDateToFilter]
        .filter(Boolean)
        .forEach((el) => el.addEventListener(el.tagName === 'INPUT' && el.type === 'text' ? 'input' : 'change', applySaleFiltersAndRender));

    populatePaymentMethodOptions();
    await Promise.all([loadProductsWithStock(), loadAndRenderSales()]);
    window.applyModuleActionGuards?.('sales', salesModuleNode);
}
