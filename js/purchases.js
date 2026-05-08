let allPurchasesData = [];
let allSuppliersForPurchase = [];
let allProductsForPurchase = [];
let allWarehousesForPurchase = [];

async function initPurchasesModule() {
    const purchasesModuleNode = document.getElementById('purchases-module');
    if (!purchasesModuleNode) return;

    const purchasesTableBody = purchasesModuleNode.querySelector('#purchases-table-body');
    const purchaseSearchInput = purchasesModuleNode.querySelector('#purchase-search-input');
    const purchaseSupplierFilter = purchasesModuleNode.querySelector('#purchase-supplier-filter');
    const purchaseStatusFilter = purchasesModuleNode.querySelector('#purchase-status-filter');
    const purchaseDateFromFilter = purchasesModuleNode.querySelector('#purchase-date-from-filter');
    const purchaseDateToFilter = purchasesModuleNode.querySelector('#purchase-date-to-filter');

    const purchaseFormElement = document.getElementById('purchase-form');
    const purchaseIdField = document.getElementById('purchase-id-field');
    const purchaseSupplierField = document.getElementById('purchase-supplier-field');
    const purchaseDateField = document.getElementById('purchase-date-field');
    const purchaseRefNoField = document.getElementById('purchase-ref-no-field');
    const purchaseWarehouseField = document.getElementById('purchase-warehouse-field');
    const purchasePaymentMethodField = document.getElementById('purchase-payment-method-field');
    const purchaseStatusField = document.getElementById('purchase-status-field');
    const purchaseNotesField = document.getElementById('purchase-notes-field');
    const purchaseItemsTableBody = document.getElementById('purchase-items-table-body');
    const addPurchaseItemBtn = document.getElementById('add-purchase-item-btn');
    const purchaseDiscountField = document.getElementById('purchase-discount-field');
    const purchaseTaxPercentageField = document.getElementById('purchase-tax-percentage-field');
    const purchaseSubtotalAmountEl = document.getElementById('purchase-subtotal-amount');
    const purchaseTaxAmountEl = document.getElementById('purchase-tax-amount');
    const purchaseGrandTotalAmountEl = document.getElementById('purchase-grand-total-amount');
    const savePurchaseBtn = document.getElementById('save-purchase-form-btn');

    const fmtMoney = (n) => `${(Number(n) || 0).toFixed(2)} ج.م`;
    const todayISO = () => new Date().toISOString().slice(0, 10);
    const paymentLabel = { unpaid: 'غير مدفوعة', partially_paid: 'مدفوعة جزئياً', paid: 'مدفوعة' };
    const receiptLabel = { pending: 'بانتظار الاستلام', partial: 'استلام جزئي', received: 'تم الاستلام', returned: 'مرتجع' };

    function mapReceiptUiToDb(value) {
        if (value === 'pending_receipt') return 'pending';
        if (value === 'partially_received') return 'partial';
        if (value === 'received') return 'received';
        return 'pending';
    }

    function mapReceiptDbToUi(value) {
        if (value === 'pending') return 'pending_receipt';
        if (value === 'partial') return 'partially_received';
        if (value === 'received') return 'received';
        return 'pending_receipt';
    }

    function inferPaymentStatus(method) {
        return method === 'cash' ? 'paid' : 'unpaid';
    }

    function mapStatusFilterToDb(value) {
        if (['unpaid', 'partially_paid', 'paid'].includes(value)) return { field: 'payment_status', value };
        if (value === 'pending_receipt') return { field: 'receipt_status', value: 'pending' };
        if (value === 'partially_received') return { field: 'receipt_status', value: 'partial' };
        if (value === 'received') return { field: 'receipt_status', value: 'received' };
        if (value === 'cancelled') return { field: 'invoice_status', value: 'cancelled' };
        return null;
    }

    function itemOptionsHtml(selectedId = '') {
        return allProductsForPurchase
            .map((p) => `<option value="${p.id}" data-price="${p.purchase_price}" ${p.id === selectedId ? 'selected' : ''}>${p.name}${p.unit_name ? ` (${p.unit_name})` : ''}</option>`)
            .join('');
    }

    async function loadSuppliers() {
        const { data } = await DB.from('suppliers')
            .select('id,company_name,status')
            .eq('status', 'active')
            .order('company_name', { ascending: true })
            .get();
        allSuppliersForPurchase = Array.isArray(data) ? data : [];

        const options = '<option value="">اختر المورد...</option>' +
            allSuppliersForPurchase.map((s) => `<option value="${s.id}">${s.company_name}</option>`).join('');
        if (purchaseSupplierField) purchaseSupplierField.innerHTML = options;

        const filterOptions = '<option value="">كل الموردين</option>' +
            allSuppliersForPurchase.map((s) => `<option value="${s.id}">${s.company_name}</option>`).join('');
        if (purchaseSupplierFilter) purchaseSupplierFilter.innerHTML = filterOptions;
    }

    async function loadWarehouses() {
        const { data } = await DB.from('warehouses')
            .select('id,name,status')
            .eq('status', 'active')
            .order('name', { ascending: true })
            .get();
        allWarehousesForPurchase = Array.isArray(data) ? data : [];

        const options = '<option value="">اختر المخزن...</option>' +
            allWarehousesForPurchase.map((w) => `<option value="${w.id}">${w.name}</option>`).join('');
        if (purchaseWarehouseField) purchaseWarehouseField.innerHTML = options;
    }

    async function loadProducts() {
        const [{ data: products }, { data: units }] = await Promise.all([
            DB.from('products').select('id,name,purchase_price,unit_id,status').eq('status', 'active').order('name', { ascending: true }).get(),
            DB.from('product_units').select('id,name,name_ar').get()
        ]);

        const unitMap = new Map((units || []).map((u) => [u.id, u.name_ar || u.name]));
        allProductsForPurchase = (products || []).map((p) => ({
            id: p.id,
            name: p.name,
            purchase_price: Number(p.purchase_price || 0),
            unit_name: unitMap.get(p.unit_id) || ''
        }));
    }

    function resetPurchaseForm(purchaseData = null) {
        if (!purchaseFormElement) return;
        purchaseFormElement.reset();
        purchaseIdField.value = '';
        purchaseDateField.value = todayISO();
        purchaseStatusField.value = 'pending_receipt';
        purchaseItemsTableBody.innerHTML = '';

        if (purchaseData) {
            purchaseIdField.value = purchaseData.id;
            purchaseSupplierField.value = purchaseData.supplier_id || '';
            purchaseDateField.value = purchaseData.invoice_date || todayISO();
            purchaseRefNoField.value = purchaseData.supplier_ref_no || '';
            purchaseWarehouseField.value = purchaseData.warehouse_id || '';
            purchasePaymentMethodField.value = purchaseData.payment_method || 'cash';
            purchaseStatusField.value = mapReceiptDbToUi(purchaseData.receipt_status);
            purchaseDiscountField.value = Number(purchaseData.discount_amount || 0);
            purchaseTaxPercentageField.value = Number(purchaseData.tax_rate || 0);
            purchaseNotesField.value = purchaseData.notes || '';

            (purchaseData.items || []).forEach((item) => addPurchaseItemRow(item));
            if (!purchaseData.items || purchaseData.items.length === 0) addPurchaseItemRow();
        } else {
            purchaseDiscountField.value = 0;
            purchaseTaxPercentageField.value = 14;
            addPurchaseItemRow();
        }

        calculatePurchaseTotals();
    }

    const openPurchaseFormForEdit = window.setupFormToggle({
        currentModule: 'purchases',
        addButtonId: 'add-purchase-btn',
        formContainerId: 'purchase-form-container',
        closeButtonId: 'close-purchase-form-btn',
        cancelButtonId: 'cancel-purchase-form-btn',
        formId: 'purchase-form',
        formTitleId: 'purchase-form-title',
        addTitle: 'فاتورة مشتريات جديدة',
        editTitle: 'تعديل فاتورة المشتريات',
        resetFormFunction: resetPurchaseForm,
        onOpen: async () => {
            await Promise.all([loadSuppliers(), loadWarehouses(), loadProducts()]);
        }
    });

    function addPurchaseItemRow(item = null) {
        const row = purchaseItemsTableBody.insertRow();
        row.className = 'purchase-item-row border-b dark:border-gray-700';

        row.innerHTML = `
            <td class="px-3 py-2">
                <select class="form-select product-selector p-1.5 text-sm" required>
                    <option value="">اختر الصنف...</option>
                    ${itemOptionsHtml(item?.product_id || item?.productId || '')}
                </select>
            </td>
            <td class="px-3 py-2"><input type="number" min="0.001" step="0.001" value="${Number(item?.quantity || 1)}" class="form-input quantity-input p-1.5 text-sm w-full" required></td>
            <td class="px-3 py-2"><input type="number" min="0" step="0.0001" value="${Number(item?.unit_cost || item?.unitPrice || 0)}" class="form-input unit-price-input p-1.5 text-sm w-full" required></td>
            <td class="px-3 py-2 text-sm item-total-display text-right">0.00</td>
            <td class="px-1 py-2 text-center"><button type="button" class="text-red-500 hover:text-red-700 remove-item-btn p-1 text-sm"><i class="fas fa-trash-alt"></i></button></td>
        `;

        const selector = row.querySelector('.product-selector');
        const qtyInput = row.querySelector('.quantity-input');
        const priceInput = row.querySelector('.unit-price-input');

        selector.addEventListener('change', () => {
            const selected = selector.options[selector.selectedIndex];
            priceInput.value = Number(selected?.getAttribute('data-price') || 0);
            calculatePurchaseTotals();
        });
        qtyInput.addEventListener('input', calculatePurchaseTotals);
        priceInput.addEventListener('input', calculatePurchaseTotals);
        row.querySelector('.remove-item-btn').addEventListener('click', () => {
            row.remove();
            calculatePurchaseTotals();
        });

        calculatePurchaseTotals();
    }

    function collectItemsFromForm() {
        const items = [];
        for (const row of purchaseItemsTableBody.querySelectorAll('.purchase-item-row')) {
            const productId = row.querySelector('.product-selector').value;
            const quantity = Number(row.querySelector('.quantity-input').value || 0);
            const unitCost = Number(row.querySelector('.unit-price-input').value || 0);
            if (productId && quantity > 0) {
                items.push({
                    product_id: productId,
                    quantity,
                    unit_cost: unitCost,
                    discount_amount: 0,
                    total_amount: quantity * unitCost
                });
            }
        }
        return items;
    }

    function calculatePurchaseTotals() {
        let subtotal = 0;
        purchaseItemsTableBody.querySelectorAll('.purchase-item-row').forEach((row) => {
            const q = Number(row.querySelector('.quantity-input').value || 0);
            const p = Number(row.querySelector('.unit-price-input').value || 0);
            const total = q * p;
            row.querySelector('.item-total-display').textContent = total.toFixed(2);
            subtotal += total;
        });

        const discount = Number(purchaseDiscountField.value || 0);
        const taxRate = Number(purchaseTaxPercentageField.value || 0);
        const taxBase = Math.max(0, subtotal - discount);
        const taxAmount = taxBase * (taxRate / 100);
        const grandTotal = taxBase + taxAmount;

        purchaseSubtotalAmountEl.textContent = fmtMoney(subtotal);
        purchaseTaxAmountEl.textContent = fmtMoney(taxAmount);
        purchaseGrandTotalAmountEl.textContent = fmtMoney(grandTotal);

        return { subtotal, discount, taxRate, taxAmount, grandTotal };
    }

    async function loadAndRenderPurchases() {
        if (!purchasesTableBody) return;
        purchasesTableBody.innerHTML = `<tr><td colspan="8" class="text-center p-4">جاري تحميل فواتير المشتريات...</td></tr>`;

        try {
            await Promise.all([loadSuppliers(), loadWarehouses()]);

            const { data, error } = await DB.from('purchase_invoices')
                .select('*')
                .order('invoice_date', { ascending: false })
                .get();
            if (error) throw error;

            const supplierMap = new Map(allSuppliersForPurchase.map((s) => [s.id, s.company_name]));
            const warehouseMap = new Map(allWarehousesForPurchase.map((w) => [w.id, w.name]));

            allPurchasesData = (data || []).map((r) => ({
                ...r,
                supplier_name: supplierMap.get(r.supplier_id) || '—',
                warehouse_name: warehouseMap.get(r.warehouse_id) || '—'
            }));

            applyPurchaseFiltersAndRender();
        } catch (err) {
            console.error('Error loading purchases:', err);
            purchasesTableBody.innerHTML = `<tr><td colspan="8" class="text-center p-4 text-red-500">فشل تحميل فواتير المشتريات: ${err.message}</td></tr>`;
        }
    }

    function applyPurchaseFiltersAndRender() {
        let filtered = [...allPurchasesData];

        const search = (purchaseSearchInput?.value || '').trim().toLowerCase();
        const supplierId = purchaseSupplierFilter?.value || '';
        const statusVal = purchaseStatusFilter?.value || '';
        const dateFrom = purchaseDateFromFilter?.value || '';
        const dateTo = purchaseDateToFilter?.value || '';

        if (search) {
            filtered = filtered.filter((p) =>
                String(p.invoice_number || '').toLowerCase().includes(search) ||
                String(p.supplier_name || '').toLowerCase().includes(search)
            );
        }

        if (supplierId) filtered = filtered.filter((p) => p.supplier_id === supplierId);

        if (statusVal) {
            const rule = mapStatusFilterToDb(statusVal);
            if (rule) filtered = filtered.filter((p) => p[rule.field] === rule.value);
        }

        if (dateFrom) filtered = filtered.filter((p) => String(p.invoice_date || '') >= dateFrom);
        if (dateTo) filtered = filtered.filter((p) => String(p.invoice_date || '') <= dateTo);

        renderPurchasesTable(filtered);
    }

    function renderPurchasesTable(purchasesToRender) {
        if (!purchasesTableBody) return;
        purchasesTableBody.innerHTML = '';

        if (!purchasesToRender.length) {
            purchasesTableBody.innerHTML = `<tr><td colspan="8" class="text-center p-4">لا توجد فواتير مشتريات.</td></tr>`;
            return;
        }

        purchasesToRender.forEach((p) => {
            const row = purchasesTableBody.insertRow();
            const pay = paymentLabel[p.payment_status] || p.payment_status || '—';
            const rec = receiptLabel[p.receipt_status] || p.receipt_status || '—';

            row.innerHTML = `
                <td class="px-6 py-3 whitespace-nowrap text-sm font-medium text-primary">${p.invoice_number || p.id}</td>
                <td class="px-6 py-3 whitespace-nowrap text-sm">${p.supplier_name}</td>
                <td class="px-6 py-3 whitespace-nowrap text-sm">${p.invoice_date || '—'}</td>
                <td class="px-6 py-3 whitespace-nowrap text-sm font-semibold">${fmtMoney(p.total_amount)}</td>
                <td class="px-6 py-3 whitespace-nowrap text-sm">${p.warehouse_name}</td>
                <td class="px-6 py-3 whitespace-nowrap text-xs">${pay}</td>
                <td class="px-6 py-3 whitespace-nowrap text-xs">${rec}</td>
                <td class="px-6 py-3 whitespace-nowrap text-sm font-medium text-left">
                    <button class="text-primary hover:text-primary/80 ml-2 edit-purchase-btn" data-id="${p.id}" title="تعديل"><i class="fas fa-edit"></i></button>
                    <button class="text-red-600 hover:text-red-800 delete-purchase-btn" data-id="${p.id}" title="إلغاء"><i class="fas fa-trash-alt"></i></button>
                </td>
            `;
        });

        purchasesModuleNode.querySelectorAll('.edit-purchase-btn').forEach((btn) => {
            btn.addEventListener('click', async (e) => {
                const purchaseId = e.currentTarget.getAttribute('data-id');
                const purchase = allPurchasesData.find((x) => x.id === purchaseId);
                if (!purchase) return;

                const { data: items } = await window.supabaseClient
                    .from('purchase_invoice_items')
                    .select('*')
                    .eq('purchase_invoice_id', purchaseId)
                    .order('created_at', { ascending: true });

                openPurchaseFormForEdit({ ...purchase, items: items || [] });
            });
        });

        purchasesModuleNode.querySelectorAll('.delete-purchase-btn').forEach((btn) => {
            btn.addEventListener('click', async (e) => {
                const purchaseId = e.currentTarget.getAttribute('data-id');
                await handleDeletePurchase(purchaseId);
            });
        });
    }

    async function savePurchase() {
        if (!savePurchaseBtn) return;
        window.showButtonSpinner(savePurchaseBtn, true);

        try {
            const purchaseId = purchaseIdField.value;
            const items = collectItemsFromForm();
            if (!items.length) throw new Error('يجب إضافة صنف واحد على الأقل للفاتورة.');
            if (!purchaseSupplierField.value) throw new Error('يرجى اختيار المورد.');
            if (!purchaseWarehouseField.value) throw new Error('يرجى اختيار المخزن.');

            const totals = calculatePurchaseTotals();
            const generatedNo = `PI-${Date.now()}`;

            const payload = {
                supplier_id: purchaseSupplierField.value,
                warehouse_id: purchaseWarehouseField.value,
                supplier_ref_no: purchaseRefNoField.value || null,
                invoice_date: purchaseDateField.value || todayISO(),
                payment_method: purchasePaymentMethodField.value || 'cash',
                payment_status: inferPaymentStatus(purchasePaymentMethodField.value || 'cash'),
                receipt_status: mapReceiptUiToDb(purchaseStatusField.value),
                invoice_status: 'posted',
                subtotal_amount: totals.subtotal,
                discount_amount: totals.discount,
                tax_rate: totals.taxRate,
                tax_amount: totals.taxAmount,
                total_amount: totals.grandTotal,
                notes: purchaseNotesField.value || null,
                created_by: window.AppAuth?.currentUser?.id || null
            };

            let finalPurchaseId = purchaseId;
            if (purchaseId) {
                await DB.from('purchase_invoices').eq('id', purchaseId).update(payload);

                const { error: delErr } = await window.supabaseClient
                    .from('purchase_invoice_items')
                    .delete()
                    .eq('purchase_invoice_id', purchaseId);
                if (delErr) throw delErr;
            } else {
                const inserted = await DB.from('purchase_invoices').insert({
                    ...payload,
                    invoice_number: generatedNo
                });
                finalPurchaseId = inserted?.id;
                if (!finalPurchaseId) throw new Error('تعذر إنشاء فاتورة المشتريات.');
            }

            const rows = items.map((it) => ({
                purchase_invoice_id: finalPurchaseId,
                product_id: it.product_id,
                quantity: it.quantity,
                unit_cost: it.unit_cost,
                discount_amount: it.discount_amount,
                total_amount: it.total_amount
            }));

            const { error: insErr } = await window.supabaseClient
                .from('purchase_invoice_items')
                .insert(rows);
            if (insErr) throw insErr;

            const closeBtn = document.getElementById('close-purchase-form-btn');
            if (closeBtn) closeBtn.click();
            await loadAndRenderPurchases();
        } catch (err) {
            console.error('Error saving purchase:', err);
            alert(`فشل حفظ فاتورة المشتريات: ${err.message || 'خطأ غير متوقع.'}`);
        } finally {
            window.showButtonSpinner(savePurchaseBtn, false);
        }
    }

    async function handleDeletePurchase(purchaseId) {
        if (!confirm('هل تريد إلغاء هذه الفاتورة؟')) return;
        try {
            await DB.from('purchase_invoices').eq('id', purchaseId).softDelete();
            await loadAndRenderPurchases();
        } catch (err) {
            console.error('Error cancelling purchase:', err);
            alert(`فشل إلغاء الفاتورة: ${err.message || 'خطأ غير متوقع.'}`);
        }
    }

    if (addPurchaseItemBtn) addPurchaseItemBtn.addEventListener('click', () => addPurchaseItemRow());
    if (purchaseDiscountField) purchaseDiscountField.addEventListener('input', calculatePurchaseTotals);
    if (purchaseTaxPercentageField) purchaseTaxPercentageField.addEventListener('input', calculatePurchaseTotals);

    if (purchaseFormElement) {
        purchaseFormElement.addEventListener('submit', async (e) => {
            e.preventDefault();
            await savePurchase();
        });
    }

    [purchaseSearchInput, purchaseSupplierFilter, purchaseStatusFilter, purchaseDateFromFilter, purchaseDateToFilter]
        .filter(Boolean)
        .forEach((el) => el.addEventListener(el.tagName === 'INPUT' && el.type === 'text' ? 'input' : 'change', applyPurchaseFiltersAndRender));

    await Promise.all([loadProducts(), loadAndRenderPurchases()]);
}
