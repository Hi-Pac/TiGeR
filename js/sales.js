let allSalesData = [];
let allCustomersForSale = []; // To populate customer dropdown
let allProductsForSale = [];  // To populate product dropdown in items (with stock info)
let allSalespersons = [];     // To populate salespersons dropdown

function initSalesModule() {
    console.log("Sales Module Initialized!");

    const salesModuleNode = document.getElementById('sales-module');
    if (!salesModuleNode) {
        console.error("Sales module container not found.");
        return;
    }

    // Main list elements
    const salesTableBody = salesModuleNode.querySelector('#sales-table-body');
    // Add filter input selectors here if needed

    // Form elements (scoped to the entire document because it's a modal)
    const saleFormContainer = document.getElementById('sale-form-container');
    const saleFormElement = document.getElementById('sale-form');
    const saleIdField = document.getElementById('sale-id-field');
    const saleCustomerField = document.getElementById('sale-customer-field');
    const saleDateField = document.getElementById('sale-date-field');
    const saleSalespersonField = document.getElementById('sale-salesperson-field');
    const saleWarehouseField = document.getElementById('sale-warehouse-field');
    const salePaymentMethodField = document.getElementById('sale-payment-method-field');
    const saleDeliveryStatusField = document.getElementById('sale-delivery-status-field');
    const saleItemsTableBody = document.getElementById('sale-items-table-body');
    const addSaleItemBtn = document.getElementById('add-sale-item-btn');
    const saleNotesField = document.getElementById('sale-notes-field');
    const saleSubtotalAmountEl = document.getElementById('sale-subtotal-amount');
    const saleDiscountField = document.getElementById('sale-discount-field');
    const saleTaxPercentageField = document.getElementById('sale-tax-percentage-field');
    const saleTaxAmountEl = document.getElementById('sale-tax-amount');
    const saleGrandTotalAmountEl = document.getElementById('sale-grand-total-amount');
    const saveSaleBtn = document.getElementById('save-sale-form-btn');
    const saveAndPrintSaleBtn = document.getElementById('save-print-sale-form-btn');

    let saleItems = []; // Array to hold items for the current sale form

    function resetSaleForm(saleData = null) {
        if (!saleFormElement) return;
        saleFormElement.reset();
        saleIdField.value = '';
        saleItems = [];
        renderSaleItemsTable();
        calculateSaleTotals();
        saleDateField.valueAsDate = new Date();

        if (saleData) {
            saleIdField.value = saleData.id;
            saleCustomerField.value = saleData.customerId || '';
            saleDateField.value = saleData.date || new Date().toISOString().slice(0,10);
            saleSalespersonField.value = saleData.salespersonId || '';
            saleWarehouseField.value = saleData.warehouseId || '';
            salePaymentMethodField.value = saleData.paymentMethod || 'cash';
            saleDeliveryStatusField.value = saleData.deliveryStatus || 'pending_delivery';
            saleNotesField.value = saleData.notes || '';
            saleDiscountField.value = saleData.discountAmount || 0;
            saleTaxPercentageField.value = saleData.taxPercentage || 14;
            
            saleItems = saleData.items ? JSON.parse(JSON.stringify(saleData.items)) : [];
            renderSaleItemsTable(); // This will also trigger stock update for items if needed
            calculateSaleTotals();
        }
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
        onOpen: async (editData) => {
            await populateCustomersDropdown();
            await populateSalespersonsDropdown();
            await populateProductsForSaleData(); // Fetch products with stock info
            if (!editData) {
                addSaleItemRow();
            }
        }
    });

    async function populateCustomersDropdown() {
        // --- FIREBASE: Fetch active customers ---
        await new Promise(resolve => setTimeout(resolve, 100));
        allCustomersForSale = [
            { id: 'cust1', shopName: 'ماركت السعادة الكبرى' },
            { id: 'cust2', shopName: 'بقالة الخير والبركة' }
        ];
        saleCustomerField.innerHTML = '<option value="">اختر العميل...</option>';
        allCustomersForSale.forEach(cust => {
            const option = new Option(cust.shopName, cust.id);
            saleCustomerField.add(option);
        });
    }

    async function populateSalespersonsDropdown() {
        // --- FIREBASE: Fetch users with 'sales' role ---
        await new Promise(resolve => setTimeout(resolve, 100));
        allSalespersons = [
            { id: 'user2', name: 'فاطمة السيد (مندوبة)' },
            { id: 'user_sales_other', name: 'أحمد مندوب (مندوب)'}
        ];
        saleSalespersonField.innerHTML = '<option value="">اختر المندوب...</option>';
        allSalespersons.forEach(sp => {
            const option = new Option(sp.name, sp.id);
            saleSalespersonField.add(option);
        });
    }
    
    async function populateProductsForSaleData() {
        // --- FIREBASE: Fetch products and their current stock for the selected warehouse ---
        // This is more complex. You might fetch all products, then on warehouse selection, fetch stock.
        // For simplicity, we'll assume stock is part of product data for now.
        await new Promise(resolve => setTimeout(resolve, 100));
        allProductsForSale = [
            { id: 'p1', name: 'زيت عباد الشمس 1 لتر', salePrice: 35, unit: 'زجاجة', stock: { main_wh: 50, alex_wh: 20 } },
            { id: 'p2', name: 'أرز مصري فاخر 5 كجم', salePrice: 135, unit: 'كيس', stock: { main_wh: 100, alex_wh: 30 } },
            { id: 'p3', name: 'مكرونة اسباجتي 400جم', salePrice: 10, unit: 'كيس', stock: { main_wh: 200, alex_wh: 0 } }
        ];
         // Update product selectors in existing rows if form is open
        saleItemsTableBody.querySelectorAll('.sale-item-row .product-selector').forEach(selector => {
            const currentVal = selector.value;
            selector.innerHTML = '<option value="">اختر الصنف...</option>' +
                allProductsForSale.map(p => `<option value="${p.id}" data-price="${p.salePrice}" data-unit="${p.unit}">${p.name}</option>`).join('');
            selector.value = currentVal; // try to reselect
            if(selector.value) handleSaleProductSelection({target: selector}); // update stock if item was already selected
        });
    }

    function addSaleItemRow(item = null) {
        const itemId = item ? item.productId : '';
        const qty = item ? item.quantity : 1;
        const price = item ? item.unitPrice : 0;
        const selectedWarehouse = saleWarehouseField.value;

        const newRow = saleItemsTableBody.insertRow();
        newRow.className = 'sale-item-row border-b dark:border-gray-700';
        newRow.innerHTML = `
            <td class="px-3 py-2">
                <select class="form-select product-selector p-1.5 text-sm" required>
                    <option value="">اختر الصنف...</option>
                    ${allProductsForSale.map(p => {
                        const product = allProductsForSale.find(prd => prd.id === p.id);
                        const stock = product && product.stock && selectedWarehouse ? (product.stock[selectedWarehouse] || 0) : 0;
                        return `<option value="${p.id}" data-price="${p.salePrice}" data-unit="${p.unit}" data-stock="${stock}" ${p.id === itemId ? 'selected' : ''}>${p.name} (${p.unit})</option>`
                    }).join('')}
                </select>
            </td>
            <td class="px-3 py-2">
                <span class="available-stock-display text-xs text-gray-600 dark:text-gray-400">متاح: 0</span>
            </td>
            <td class="px-3 py-2">
                <input type="number" value="${qty}" min="1" class="form-input quantity-input p-1.5 text-sm w-full" required>
            </td>
            <td class="px-3 py-2">
                <input type="number" value="${price}" min="0" step="0.01" class="form-input unit-price-input p-1.5 text-sm w-full" required readonly> <!-- Price often set by system -->
            </td>
            <td class="px-3 py-2 text-sm item-total-display text-right">0.00</td>
            <td class="px-1 py-2 text-center">
                <button type="button" class="text-red-500 hover:text-red-700 remove-item-btn p-1 text-sm"><i class="fas fa-trash-alt"></i></button>
            </td>
        `;
        
        const productSelector = newRow.querySelector('.product-selector');
        productSelector.addEventListener('change', handleSaleProductSelection);
        newRow.querySelector('.quantity-input').addEventListener('input', (e) => {
            validateStock(e.target);
            calculateSaleTotals();
        });
        // Price input might be readonly if fetched from product data
        // newRow.querySelector('.unit-price-input').addEventListener('input', calculateSaleTotals); 
        newRow.querySelector('.remove-item-btn').addEventListener('click', (e) => {
            e.currentTarget.closest('tr').remove();
            calculateSaleTotals();
        });

        if (item) { // If editing, populate and update stock display
            handleSaleProductSelection({target: productSelector}); // This will set price and stock display
        }
        calculateSaleTotals();
    }
    
    function handleSaleProductSelection(event) {
        const selector = event.target;
        const selectedOption = selector.options[selector.selectedIndex];
        const price = selectedOption.getAttribute('data-price') || 0;
        const stock = selectedOption.getAttribute('data-stock') || 0;
        const row = selector.closest('tr');
        
        row.querySelector('.unit-price-input').value = parseFloat(price).toFixed(2);
        row.querySelector('.available-stock-display').textContent = `متاح: ${stock}`;
        row.querySelector('.quantity-input').max = stock; // Set max based on stock
        validateStock(row.querySelector('.quantity-input'));
        calculateSaleTotals();
    }

    function validateStock(quantityInput) {
        const maxStock = parseInt(quantityInput.max);
        if (parseInt(quantityInput.value) > maxStock) {
            quantityInput.value = maxStock; // Cap at max stock
            alert(`الكمية المطلوبة تتجاوز المخزون المتاح (${maxStock})`);
        }
    }
    
    // When warehouse selection changes, update stock for all items
    if (saleWarehouseField) {
        saleWarehouseField.addEventListener('change', async () => {
            // Re-fetch product data or update available stock based on new warehouse
            // For now, let's assume allProductsForSale has stock for all warehouses
            // Or we could re-call populateProductsForSaleData() if it filters by warehouse
            await populateProductsForSaleData(); // This re-populates and re-attaches options to selectors
            saleItemsTableBody.querySelectorAll('.sale-item-row').forEach(row => {
                const selector = row.querySelector('.product-selector');
                if (selector.value) { // If a product is selected
                    handleSaleProductSelection({ target: selector }); // Re-trigger to update stock display and price
                }
            });
            calculateSaleTotals();
        });
    }


    function renderSaleItemsTable() { // Used when loading an existing sale for edit
        saleItemsTableBody.innerHTML = '';
        saleItems.forEach(item => addSaleItemRow(item));
         if(saleItems.length === 0 && saleFormContainer && !saleFormContainer.classList.contains('hidden')) {
             addSaleItemRow();
        }
        calculateSaleTotals();
    }
    
    function calculateItemTotalSale(rowElement) {
        const quantity = parseFloat(rowElement.querySelector('.quantity-input').value) || 0;
        const unitPrice = parseFloat(rowElement.querySelector('.unit-price-input').value) || 0;
        const itemTotal = quantity * unitPrice;
        rowElement.querySelector('.item-total-display').textContent = itemTotal.toFixed(2);
        return itemTotal;
    }

    function calculateSaleTotals() {
        let subtotal = 0;
        saleItemsTableBody.querySelectorAll('.sale-item-row').forEach(row => {
            subtotal += calculateItemTotalSale(row);
        });
        saleSubtotalAmountEl.textContent = `${subtotal.toFixed(2)} ج.م`;

        const discount = parseFloat(saleDiscountField.value) || 0;
        const amountAfterDiscount = subtotal - discount;
        
        const taxPercentage = parseFloat(saleTaxPercentageField.value) || 0;
        const taxAmount = amountAfterDiscount * (taxPercentage / 100);
        saleTaxAmountEl.textContent = `${taxAmount.toFixed(2)} ج.م`;
        
        const grandTotal = amountAfterDiscount + taxAmount;
        saleGrandTotalAmountEl.textContent = `${grandTotal.toFixed(2)} ج.م`;
    }
    
    if (addSaleItemBtn) addSaleItemBtn.addEventListener('click', () => addSaleItemRow());
    if (saleDiscountField) saleDiscountField.addEventListener('input', calculateSaleTotals);
    if (saleTaxPercentageField) saleTaxPercentageField.addEventListener('input', calculateSaleTotals);


    async function loadAndRenderSales() {
        if (!salesTableBody) return;
        salesTableBody.innerHTML = `<tr><td colspan="8" class="text-center p-4">جاري تحميل فواتير المبيعات...</td></tr>`;
        try {
            // --- FIREBASE: Fetch sales, customer names, salesperson names ---
            await new Promise(resolve => setTimeout(resolve, 650));
            allSalesData = [
                { id: 'inv001', customerId: 'cust1', customerName: 'ماركت السعادة الكبرى', date: '2023-10-25', totalAmount: 1750.00, salespersonId: 'user2', salespersonName: 'فاطمة السيد', paymentStatus: 'paid', deliveryStatus: 'delivered' },
                { id: 'inv002', customerId: 'cust2', customerName: 'بقالة الخير والبركة', date: '2023-10-28', totalAmount: 850.75, salespersonId: 'user2', salespersonName: 'فاطمة السيد', paymentStatus: 'pending_payment', deliveryStatus: 'out_for_delivery' },
            ];
            applySaleFiltersAndRender();
        } catch (error) {
            console.error("Error loading sales:", error);
            salesTableBody.innerHTML = `<tr><td colspan="8" class="text-center p-4 text-red-500">فشل تحميل فواتير المبيعات.</td></tr>`;
        }
    }

    function applySaleFiltersAndRender() {
         // TODO: Implement filtering logic
        renderSalesTable(allSalesData);
    }

    function renderSalesTable(salesToRender) {
        if (!salesTableBody) return;
        salesTableBody.innerHTML = '';
        if (salesToRender.length === 0) {
            salesTableBody.innerHTML = `<tr><td colspan="8" class="text-center p-4">لا توجد فواتير مبيعات.</td></tr>`;
            return;
        }
         const statusDisplay = {
            pending_payment: { text: 'بانتظار الدفع', class: 'bg-orange-100 text-orange-800' },
            paid: { text: 'مدفوعة', class: 'bg-green-100 text-green-800' },
            partially_paid: { text: 'مدفوعة جزئياً', class: 'bg-yellow-100 text-yellow-800' },
            pending_delivery: { text: 'بانتظار التسليم', class: 'bg-blue-100 text-blue-800' },
            out_for_delivery: { text: 'قيد التوصيل', class: 'bg-indigo-100 text-indigo-800' },
            delivered: { text: 'تم التسليم', class: 'bg-teal-100 text-teal-800' },
            cancelled: { text: 'ملغاة', class: 'bg-red-100 text-red-800' }
        };


        salesToRender.forEach(sale => {
            const row = salesTableBody.insertRow();
            const paymentStatusInfo = statusDisplay[sale.paymentStatus] || {text: sale.paymentStatus, class: 'bg-gray-100 text-gray-800'};
            const deliveryStatusInfo = statusDisplay[sale.deliveryStatus] || {text: sale.deliveryStatus, class: 'bg-gray-100 text-gray-800'};

            row.innerHTML = `
                <td class="px-6 py-3 whitespace-nowrap text-sm font-medium text-primary dark:text-primary/90">${sale.id}</td>
                <td class="px-6 py-3 whitespace-nowrap text-sm">${sale.customerName}</td>
                <td class="px-6 py-3 whitespace-nowrap text-sm">${new Date(sale.date).toLocaleDateString('ar-EG')}</td>
                <td class="px-6 py-3 whitespace-nowrap text-sm font-semibold">${parseFloat(sale.totalAmount).toFixed(2)} ج.م</td>
                <td class="px-6 py-3 whitespace-nowrap text-sm">${sale.salespersonName || 'N/A'}</td>
                <td class="px-6 py-3 whitespace-nowrap text-xs"><span class="px-2 py-1 rounded-full ${paymentStatusInfo.class} dark:bg-opacity-70">${paymentStatusInfo.text}</span></td>
                <td class="px-6 py-3 whitespace-nowrap text-xs"><span class="px-2 py-1 rounded-full ${deliveryStatusInfo.class} dark:bg-opacity-70">${deliveryStatusInfo.text}</span></td>
                <td class="px-6 py-3 whitespace-nowrap text-sm font-medium text-left">
                    <button class="text-blue-600 hover:text-blue-800 dark:text-blue-400 ml-2 view-sale-btn" data-id="${sale.id}" title="عرض التفاصيل"><i class="fas fa-eye"></i></button>
                    <button class="text-primary hover:text-primary/80 ml-2 edit-sale-btn" data-id="${sale.id}" title="تعديل"><i class="fas fa-edit"></i></button>
                    <button class="text-red-600 hover:text-red-800 dark:text-red-400 delete-sale-btn" data-id="${sale.id}" title="حذف"><i class="fas fa-trash-alt"></i></button>
                </td>
            `;
        });
        // Add event listeners for view/edit/delete
         salesModuleNode.querySelectorAll('.edit-sale-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const saleId = e.currentTarget.getAttribute('data-id');
                const saleToEdit = allSalesData.find(s => s.id === saleId);
                 if(saleToEdit) {
                    // Simulate fetching full item details for edit
                    saleToEdit.items = [ 
                        { productId: 'p1', quantity: 2, unitPrice: 35 }, // Assuming salePrice from product data
                        { productId: 'p3', quantity: 10, unitPrice: 10 }
                    ];
                    openSaleFormForEdit(saleToEdit);
                 }
            });
        });
         salesModuleNode.querySelectorAll('.delete-sale-btn').forEach(btn => {
            btn.addEventListener('click', (e) => handleDeleteSale(e.currentTarget.getAttribute('data-id')));
        });

    }

    if (saleFormElement) {
        saleFormElement.addEventListener('submit', async (e) => {
            e.preventDefault();
            const targetButton = e.submitter && e.submitter.id === 'save-print-sale-form-btn' ? saveAndPrintSaleBtn : saveSaleBtn;
            if (!targetButton) return;
            window.showButtonSpinner(targetButton, true);

            const itemsData = [];
            saleItemsTableBody.querySelectorAll('.sale-item-row').forEach(row => {
                const productId = row.querySelector('.product-selector').value;
                const quantity = parseFloat(row.querySelector('.quantity-input').value);
                const unitPrice = parseFloat(row.querySelector('.unit-price-input').value);
                if (productId && quantity > 0 && unitPrice >= 0) {
                    itemsData.push({ productId, quantity, unitPrice, total: quantity * unitPrice });
                }
            });

            if (itemsData.length === 0) {
                alert('يجب إضافة صنف واحد على الأقل للفاتورة.');
                window.showButtonSpinner(targetButton, false);
                return;
            }
            
            const subtotal = itemsData.reduce((sum, item) => sum + item.total, 0);
            const discount = parseFloat(saleDiscountField.value) || 0;
            const taxPercentage = parseFloat(saleTaxPercentageField.value) || 0;
            const taxAmount = (subtotal - discount) * (taxPercentage / 100);
            const grandTotal = subtotal - discount + taxAmount;

            const saleData = {
                customerId: saleCustomerField.value,
                date: saleDateField.value,
                salespersonId: saleSalespersonField.value,
                warehouseId: saleWarehouseField.value,
                paymentMethod: salePaymentMethodField.value,
                deliveryStatus: saleDeliveryStatusField.value,
                notes: saleNotesField.value,
                items: itemsData,
                subtotalAmount: subtotal,
                discountAmount: discount,
                taxPercentage: taxPercentage,
                taxAmount: taxAmount,
                totalAmount: grandTotal,
                // paymentStatus might be set based on paymentMethod or manually
            };
            const saleId = saleIdField.value;

            try {
                saleData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
                if (saleId) {
                    saleData.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
                    await db.collection('sales').doc(saleId).update(saleData);
                    console.log("Sale updated successfully");
                    savedSaleId = saleId;
                } else {
                    const docRef = await db.collection('sales').add(saleData);
                    savedSaleId = docRef.id;
                    console.log("Sale added successfully");
                }
                
                if (e.submitter && e.submitter.id === 'save-print-sale-form-btn') {
                    alert(`سيتم طباعة الفاتورة رقم ${savedSaleId}`);
                }

                const closeBtn = document.getElementById('close-sale-form-btn');
                if (closeBtn) closeBtn.click();
                await loadAndRenderSales();
            } catch (error) {
                console.error("Error saving sale:", error);
                alert(`فشل حفظ فاتورة المبيعات: ${error.message}`);
            } finally {
                window.showButtonSpinner(targetButton, false);
            }
        });
    }
    // Event listener for save and print button (if not handled by form submitter)
    if(saveAndPrintSaleBtn) {
      // saveAndPrintSaleBtn.addEventListener('click', () => { /* ... if needed separately ... */ });
    }


    async function handleDeleteSale(saleId) {
        if (confirm('هل أنت متأكد من حذف فاتورة المبيعات هذه؟')) {
            try {
                await db.collection('sales').doc(saleId).delete();
                console.log('Sale deleted successfully');
                await loadAndRenderSales();
            } catch (error) {
                console.error("Error deleting sale:", error);
                alert('فشل حذف فاتورة المبيعات.');
            }
        }
    }
    
    // Add event listeners for main page filters
    // if(saleSearchInput) saleSearchInput.addEventListener('input', applySaleFiltersAndRender);
    // ... more filter listeners ...

    loadAndRenderSales();
}