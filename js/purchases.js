let allPurchasesData = [];
let allSuppliersForPurchase = []; // To populate supplier dropdown
let allProductsForPurchase = [];  // To populate product dropdown in items

function initPurchasesModule() {
    console.log("Purchases Module Initialized!");

    const purchasesModuleNode = document.getElementById('purchases-module');
    if (!purchasesModuleNode) {
        console.error("Purchases module container not found.");
        return;
    }

    // Main list elements
    const purchasesTableBody = purchasesModuleNode.querySelector('#purchases-table-body');
    const purchaseSearchInput = purchasesModuleNode.querySelector('#purchase-search-input');
    const purchaseSupplierFilter = purchasesModuleNode.querySelector('#purchase-supplier-filter');
    const purchaseStatusFilter = purchasesModuleNode.querySelector('#purchase-status-filter');
    const purchaseDateFromFilter = purchasesModuleNode.querySelector('#purchase-date-from-filter');
    const purchaseDateToFilter = purchasesModuleNode.querySelector('#purchase-date-to-filter');

    // Form elements (scoped to the entire document because it's a modal)
    const purchaseFormContainer = document.getElementById('purchase-form-container'); // Modal container
    const purchaseFormElement = document.getElementById('purchase-form');
    const purchaseIdField = document.getElementById('purchase-id-field');
    const purchaseSupplierField = document.getElementById('purchase-supplier-field');
    const purchaseDateField = document.getElementById('purchase-date-field');
    const purchaseRefNoField = document.getElementById('purchase-ref-no-field');
    const purchaseWarehouseField = document.getElementById('purchase-warehouse-field');
    const purchasePaymentMethodField = document.getElementById('purchase-payment-method-field');
    const purchaseStatusField = document.getElementById('purchase-status-field');
    const purchaseItemsTableBody = document.getElementById('purchase-items-table-body');
    const addPurchaseItemBtn = document.getElementById('add-purchase-item-btn');
    const purchaseNotesField = document.getElementById('purchase-notes-field');
    const purchaseSubtotalAmountEl = document.getElementById('purchase-subtotal-amount');
    const purchaseDiscountField = document.getElementById('purchase-discount-field');
    const purchaseTaxPercentageField = document.getElementById('purchase-tax-percentage-field');
    const purchaseTaxAmountEl = document.getElementById('purchase-tax-amount');
    const purchaseGrandTotalAmountEl = document.getElementById('purchase-grand-total-amount');
    const savePurchaseBtn = document.getElementById('save-purchase-form-btn');
    
    let purchaseItems = []; // Array to hold items for the current purchase form

    function resetPurchaseForm(purchaseData = null) {
        if (!purchaseFormElement) return;
        purchaseFormElement.reset();
        purchaseIdField.value = '';
        purchaseItems = [];
        renderPurchaseItemsTable();
        calculatePurchaseTotals();
        purchaseDateField.valueAsDate = new Date(); // Default to today

        if (purchaseData) {
            purchaseIdField.value = purchaseData.id;
            purchaseSupplierField.value = purchaseData.supplierId || '';
            purchaseDateField.value = purchaseData.date || new Date().toISOString().slice(0,10);
            purchaseRefNoField.value = purchaseData.refNo || '';
            purchaseWarehouseField.value = purchaseData.warehouseId || '';
            purchasePaymentMethodField.value = purchaseData.paymentMethod || 'credit';
            purchaseStatusField.value = purchaseData.status || 'pending_receipt';
            purchaseNotesField.value = purchaseData.notes || '';
            purchaseDiscountField.value = purchaseData.discountAmount || 0;
            purchaseTaxPercentageField.value = purchaseData.taxPercentage || 14; // Default tax
            
            // Deep copy items if editing
            purchaseItems = purchaseData.items ? JSON.parse(JSON.stringify(purchaseData.items)) : [];
            renderPurchaseItemsTable();
            calculatePurchaseTotals();
        }
    }

    const openPurchaseFormForEdit = window.setupFormToggle({
        currentModule: 'purchases', // Not strictly needed here as form is global modal
        addButtonId: 'add-purchase-btn', // This button is in purchases.html
        formContainerId: 'purchase-form-container', // The modal container
        closeButtonId: 'close-purchase-form-btn',
        cancelButtonId: 'cancel-purchase-form-btn',
        formId: 'purchase-form',
        formTitleId: 'purchase-form-title',
        addTitle: 'فاتورة مشتريات جديدة',
        editTitle: 'تعديل فاتورة المشتريات',
        resetFormFunction: resetPurchaseForm,
        onOpen: async (editData) => { // Load suppliers & products for dropdowns when form opens
            await populateSuppliersDropdown();
            await populateProductsData(); // To have product data for item selection
            if (!editData) { // If new purchase, add one empty item row
                addPurchaseItemRow();
            }
        }
    });

    async function populateSuppliersDropdown() {
        // --- FIREBASE: Fetch suppliers ---
        // const snapshot = await db.collection('suppliers').where('status', '==', 'active').orderBy('companyName').get();
        // allSuppliersForPurchase = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        await new Promise(resolve => setTimeout(resolve, 100)); // Simulate
        allSuppliersForPurchase = [
            { id: 'sup1', companyName: 'شركة الأغذية المتحدة' },
            { id: 'sup2', companyName: 'مؤسسة الخير للتوريدات' }
        ];

        purchaseSupplierField.innerHTML = '<option value="">اختر المورد...</option>';
        allSuppliersForPurchase.forEach(sup => {
            const option = new Option(sup.companyName, sup.id);
            purchaseSupplierField.add(option);
        });
    }
    
    async function populateProductsData() {
        // --- FIREBASE: Fetch products ---
        // const snapshot = await db.collection('products').orderBy('name').get();
        // allProductsForPurchase = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
         await new Promise(resolve => setTimeout(resolve, 100)); // Simulate
        allProductsForPurchase = [
            { id: 'p1', name: 'زيت عباد الشمس 1 لتر', purchasePrice: 30, unit: 'زجاجة' },
            { id: 'p2', name: 'أرز مصري فاخر 5 كجم', purchasePrice: 120, unit: 'كيس' },
            { id: 'p3', name: 'مكرونة اسباجتي 400جم', purchasePrice: 8, unit: 'كيس' }
        ];
    }


    function addPurchaseItemRow(item = null) {
        const itemId = item ? item.productId : '';
        const qty = item ? item.quantity : 1;
        const price = item ? item.unitPrice : 0;
        
        const newRow = purchaseItemsTableBody.insertRow();
        newRow.className = 'purchase-item-row border-b dark:border-gray-700';
        newRow.innerHTML = `
            <td class="px-3 py-2">
                <select class="form-select product-selector p-1.5 text-sm" required>
                    <option value="">اختر الصنف...</option>
                    ${allProductsForPurchase.map(p => `<option value="${p.id}" data-price="${p.purchasePrice}" ${p.id === itemId ? 'selected' : ''}>${p.name} (${p.unit})</option>`).join('')}
                </select>
            </td>
            <td class="px-3 py-2">
                <input type="number" value="${qty}" min="1" class="form-input quantity-input p-1.5 text-sm w-full" required>
            </td>
            <td class="px-3 py-2">
                <input type="number" value="${price}" min="0" step="0.01" class="form-input unit-price-input p-1.5 text-sm w-full" required>
            </td>
            <td class="px-3 py-2 text-sm item-total-display text-right">0.00</td>
            <td class="px-1 py-2 text-center">
                <button type="button" class="text-red-500 hover:text-red-700 remove-item-btn p-1 text-sm"><i class="fas fa-trash-alt"></i></button>
            </td>
        `;

        // Add event listeners for the new row
        newRow.querySelector('.product-selector').addEventListener('change', handleProductSelection);
        newRow.querySelector('.quantity-input').addEventListener('input', calculatePurchaseTotals);
        newRow.querySelector('.unit-price-input').addEventListener('input', calculatePurchaseTotals);
        newRow.querySelector('.remove-item-btn').addEventListener('click', (e) => {
            e.currentTarget.closest('tr').remove();
            calculatePurchaseTotals();
        });
        if (item) calculateItemTotal(newRow); // Calculate total for pre-filled item
    }
    
    function handleProductSelection(event) {
        const selectedOption = event.target.options[event.target.selectedIndex];
        const price = selectedOption.getAttribute('data-price') || 0;
        const row = event.target.closest('tr');
        row.querySelector('.unit-price-input').value = parseFloat(price).toFixed(2);
        calculatePurchaseTotals();
    }

    function renderPurchaseItemsTable() {
        purchaseItemsTableBody.innerHTML = '';
        purchaseItems.forEach(item => addPurchaseItemRow(item));
        if(purchaseItems.length === 0 && purchaseFormContainer && !purchaseFormContainer.classList.contains('hidden')) {
             addPurchaseItemRow(); // Add one empty row if form is open and no items
        }
        calculatePurchaseTotals();
    }
    
    function calculateItemTotal(rowElement) {
        const quantity = parseFloat(rowElement.querySelector('.quantity-input').value) || 0;
        const unitPrice = parseFloat(rowElement.querySelector('.unit-price-input').value) || 0;
        const itemTotal = quantity * unitPrice;
        rowElement.querySelector('.item-total-display').textContent = itemTotal.toFixed(2);
        return itemTotal;
    }

    function calculatePurchaseTotals() {
        let subtotal = 0;
        purchaseItemsTableBody.querySelectorAll('.purchase-item-row').forEach(row => {
            subtotal += calculateItemTotal(row);
        });
        purchaseSubtotalAmountEl.textContent = `${subtotal.toFixed(2)} ج.م`;

        const discount = parseFloat(purchaseDiscountField.value) || 0;
        const amountAfterDiscount = subtotal - discount;
        
        const taxPercentage = parseFloat(purchaseTaxPercentageField.value) || 0;
        const taxAmount = amountAfterDiscount * (taxPercentage / 100);
        purchaseTaxAmountEl.textContent = `${taxAmount.toFixed(2)} ج.م`;
        
        const grandTotal = amountAfterDiscount + taxAmount;
        purchaseGrandTotalAmountEl.textContent = `${grandTotal.toFixed(2)} ج.م`;
    }
    
    if (addPurchaseItemBtn) addPurchaseItemBtn.addEventListener('click', () => addPurchaseItemRow());
    if (purchaseDiscountField) purchaseDiscountField.addEventListener('input', calculatePurchaseTotals);
    if (purchaseTaxPercentageField) purchaseTaxPercentageField.addEventListener('input', calculatePurchaseTotals);


    async function loadAndRenderPurchases() {
        if (!purchasesTableBody) return;
        purchasesTableBody.innerHTML = `<tr><td colspan="8" class="text-center p-4">جاري تحميل فواتير المشتريات...</td></tr>`;
        try {
            // --- FIREBASE: Fetch purchases, supplier names, warehouse names ---
            await new Promise(resolve => setTimeout(resolve, 700));
            allPurchasesData = [
                { id: 'pur001', supplierId: 'sup1', supplierName: 'شركة الأغذية المتحدة', date: '2023-10-15', totalAmount: 1250.50, warehouseId: 'main_wh', warehouseName: 'المخزن الرئيسي', paymentStatus: 'paid', receiptStatus: 'received', refNo: 'INV-S-101' },
                { id: 'pur002', supplierId: 'sup2', supplierName: 'مؤسسة الخير', date: '2023-10-20', totalAmount: 3400.00, warehouseId: 'alex_wh', warehouseName: 'مخزن الإسكندرية', paymentStatus: 'pending', receiptStatus: 'pending_receipt', refNo: 'INV-S-102' },
            ];
            applyPurchaseFiltersAndRender();
        } catch (error) {
            console.error("Error loading purchases:", error);
            purchasesTableBody.innerHTML = `<tr><td colspan="8" class="text-center p-4 text-red-500">فشل تحميل فواتير المشتريات.</td></tr>`;
        }
    }

    function applyPurchaseFiltersAndRender() {
         // TODO: Implement filtering logic similar to users/products
        renderPurchasesTable(allPurchasesData); // For now, render all
    }


    function renderPurchasesTable(purchasesToRender) {
        if (!purchasesTableBody) return;
        purchasesTableBody.innerHTML = '';
        if (purchasesToRender.length === 0) {
            purchasesTableBody.innerHTML = `<tr><td colspan="8" class="text-center p-4">لا توجد فواتير مشتريات.</td></tr>`;
            return;
        }
        const statusDisplay = {
            pending_receipt: { text: 'بانتظار الاستلام', class: 'bg-yellow-100 text-yellow-800' },
            received: { text: 'مستلمة', class: 'bg-green-100 text-green-800' },
            paid: { text: 'مدفوعة', class: 'bg-blue-100 text-blue-800' },
            pending: { text: 'معلقة الدفع', class: 'bg-orange-100 text-orange-800' },
            cancelled: { text: 'ملغاة', class: 'bg-red-100 text-red-800' }
        };

        purchasesToRender.forEach(purchase => {
            const row = purchasesTableBody.insertRow();
            const paymentStatusInfo = statusDisplay[purchase.paymentStatus] || {text: purchase.paymentStatus, class: 'bg-gray-100 text-gray-800'};
            const receiptStatusInfo = statusDisplay[purchase.receiptStatus] || {text: purchase.receiptStatus, class: 'bg-gray-100 text-gray-800'};

            row.innerHTML = `
                <td class="px-6 py-3 whitespace-nowrap text-sm font-medium text-primary dark:text-primary/90">${purchase.id}</td>
                <td class="px-6 py-3 whitespace-nowrap text-sm">${purchase.supplierName}</td>
                <td class="px-6 py-3 whitespace-nowrap text-sm">${new Date(purchase.date).toLocaleDateString('ar-EG')}</td>
                <td class="px-6 py-3 whitespace-nowrap text-sm font-semibold">${parseFloat(purchase.totalAmount).toFixed(2)} ج.م</td>
                <td class="px-6 py-3 whitespace-nowrap text-sm">${purchase.warehouseName}</td>
                <td class="px-6 py-3 whitespace-nowrap text-xs"><span class="px-2 py-1 rounded-full ${paymentStatusInfo.class}">${paymentStatusInfo.text}</span></td>
                <td class="px-6 py-3 whitespace-nowrap text-xs"><span class="px-2 py-1 rounded-full ${receiptStatusInfo.class}">${receiptStatusInfo.text}</span></td>
                <td class="px-6 py-3 whitespace-nowrap text-sm font-medium text-left">
                    <button class="text-blue-600 hover:text-blue-800 dark:text-blue-400 ml-2 view-purchase-btn" data-id="${purchase.id}" title="عرض التفاصيل"><i class="fas fa-eye"></i></button>
                    <button class="text-primary hover:text-primary/80 ml-2 edit-purchase-btn" data-id="${purchase.id}" title="تعديل"><i class="fas fa-edit"></i></button>
                    <button class="text-red-600 hover:text-red-800 dark:text-red-400 delete-purchase-btn" data-id="${purchase.id}" title="حذف"><i class="fas fa-trash-alt"></i></button>
                </td>
            `;
        });
        // Add event listeners for view/edit/delete (similar to other modules)
        purchasesModuleNode.querySelectorAll('.edit-purchase-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const purchaseId = e.currentTarget.getAttribute('data-id');
                const purchaseToEdit = allPurchasesData.find(p => p.id === purchaseId);
                 if(purchaseToEdit) {
                    // Simulate fetching full item details for edit
                    purchaseToEdit.items = [ 
                        { productId: 'p1', quantity: 10, unitPrice: 30 },
                        { productId: 'p2', quantity: 5, unitPrice: 120 }
                    ];
                    openPurchaseFormForEdit(purchaseToEdit);
                 }
            });
        });
         purchasesModuleNode.querySelectorAll('.delete-purchase-btn').forEach(btn => {
            btn.addEventListener('click', (e) => handleDeletePurchase(e.currentTarget.getAttribute('data-id')));
        });

    }

    if (purchaseFormElement) {
        purchaseFormElement.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!savePurchaseBtn) return;
            window.showButtonSpinner(savePurchaseBtn, true);

            const itemsData = [];
            purchaseItemsTableBody.querySelectorAll('.purchase-item-row').forEach(row => {
                const productId = row.querySelector('.product-selector').value;
                const quantity = parseFloat(row.querySelector('.quantity-input').value);
                const unitPrice = parseFloat(row.querySelector('.unit-price-input').value);
                if (productId && quantity > 0 && unitPrice >= 0) {
                    itemsData.push({ productId, quantity, unitPrice, total: quantity * unitPrice });
                }
            });

            if (itemsData.length === 0) {
                alert('يجب إضافة صنف واحد على الأقل للفاتورة.');
                window.showButtonSpinner(savePurchaseBtn, false);
                return;
            }
            
            const subtotal = itemsData.reduce((sum, item) => sum + item.total, 0);
            const discount = parseFloat(purchaseDiscountField.value) || 0;
            const taxPercentage = parseFloat(purchaseTaxPercentageField.value) || 0;
            const taxAmount = (subtotal - discount) * (taxPercentage / 100);
            const grandTotal = subtotal - discount + taxAmount;


            const purchaseData = {
                supplierId: purchaseSupplierField.value,
                date: purchaseDateField.value,
                refNo: purchaseRefNoField.value,
                warehouseId: purchaseWarehouseField.value,
                paymentMethod: purchasePaymentMethodField.value,
                status: purchaseStatusField.value, // This is overall invoice status
                notes: purchaseNotesField.value,
                items: itemsData,
                subtotalAmount: subtotal,
                discountAmount: discount,
                taxPercentage: taxPercentage,
                taxAmount: taxAmount,
                totalAmount: grandTotal,
                // paymentStatus: 'pending' (or based on paymentMethod), receiptStatus: 'pending_receipt'
            };
            const purchaseId = purchaseIdField.value;

            try {
                purchaseData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
                if (purchaseId) {
                    purchaseData.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
                    await db.collection('purchases').doc(purchaseId).update(purchaseData);
                    console.log("Purchase updated successfully");
                } else {
                    await db.collection('purchases').add(purchaseData);
                    console.log("Purchase added successfully");
                }

                const closeBtn = document.getElementById('close-purchase-form-btn');
                if (closeBtn) closeBtn.click();
                await loadAndRenderPurchases();
            } catch (error) {
                console.error("Error saving purchase:", error);
                alert(`فشل حفظ فاتورة المشتريات: ${error.message}`);
            } finally {
                window.showButtonSpinner(savePurchaseBtn, false);
            }
        });
    }

    async function handleDeletePurchase(purchaseId) {
        if (confirm('هل أنت متأكد من حذف فاتورة المشتريات هذه؟')) {
            try {
                await db.collection('purchases').doc(purchaseId).delete();
                console.log('Purchase deleted successfully');
                await loadAndRenderPurchases();
            } catch (error) {
                console.error("Error deleting purchase:", error);
                alert('فشل حذف فاتورة المشتريات.');
            }
        }
    }
    
    // Add event listeners for main page filters
    if(purchaseSearchInput) purchaseSearchInput.addEventListener('input', applyPurchaseFiltersAndRender);
    // Add more filter listeners...

    loadAndRenderPurchases();
}
