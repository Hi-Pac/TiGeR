let allExpensesData = [];
let allEmployeesForExpense = []; // For employee dropdown if needed

async function initExpensesModule() {
    console.log("Expenses Module Initialized!");

    const expensesModuleNode = document.getElementById('expenses-module');
    if (!expensesModuleNode) return;

    const expensesTableBody = expensesModuleNode.querySelector('#expenses-table-body');
    const expenseFormElement = expensesModuleNode.querySelector('#expense-form'); // Form is not modal here
    const expenseIdField = expensesModuleNode.querySelector('#expense-id-field');
    const expenseDateField = expensesModuleNode.querySelector('#expense-date-field');
    const expenseTypeField = expensesModuleNode.querySelector('#expense-type-field');
    const expenseDescriptionField = expensesModuleNode.querySelector('#expense-description-field');
    const expenseAmountField = expensesModuleNode.querySelector('#expense-amount-field');
    const expensePaymentMethodField = expensesModuleNode.querySelector('#expense-payment-method-field');
    const expensePaidToField = expensesModuleNode.querySelector('#expense-paid-to-field');
    const expenseEmployeeField = expensesModuleNode.querySelector('#expense-employee-field');
    const expenseAttachmentField = expensesModuleNode.querySelector('#expense-attachment-field');
    const expenseCurrentAttachmentEl = expensesModuleNode.querySelector('#expense-current-attachment');
    const saveExpenseBtn = expensesModuleNode.querySelector('#save-expense-form-btn');

    // Filter inputs
    const expenseSearchInput = expensesModuleNode.querySelector('#expense-search-input');
    const expenseTypeFilter = expensesModuleNode.querySelector('#expense-type-filter');
    const expenseDateFromFilter = expensesModuleNode.querySelector('#expense-date-from-filter');
    const expenseDateToFilter = expensesModuleNode.querySelector('#expense-date-to-filter');
    
    // Expense type display names for table
    const expenseTypeDisplayNames = {
        'fuel': 'وقود', 'maintenance': 'صيانة', 'rent': 'إيجارات', 'salaries': 'رواتب',
        'utilities': 'فواتير ومرافق', 'office_supplies': 'أدوات مكتبية', 'marketing': 'تسويق ودعاية',
        'transport': 'نقل ومواصلات', 'bank_fees': 'رسوم بنكية', 'government_fees': 'رسوم حكومية',
        'hospitality': 'ضيافة وبوفيه', 'other': 'أخرى'
    };


    function resetExpenseForm(expenseData = null) {
        if (!expenseFormElement) return;
        expenseFormElement.reset();
        expenseIdField.value = '';
        expenseDateField.valueAsDate = new Date();
        if(expenseCurrentAttachmentEl) expenseCurrentAttachmentEl.textContent = '';
        expenseAttachmentField.value = null; // Clear file input

        if (expenseData) {
            expenseIdField.value = expenseData.id;
            expenseDateField.value = expenseData.date || new Date().toISOString().slice(0,10);
            expenseTypeField.value = expenseData.type || '';
            expenseDescriptionField.value = expenseData.description || '';
            expenseAmountField.value = expenseData.amount || '';
            expensePaymentMethodField.value = expenseData.paymentMethod || 'cash';
            expensePaidToField.value = expenseData.paidTo || '';
            expenseEmployeeField.value = expenseData.employeeId || '';
            if (expenseData.attachmentUrl && expenseCurrentAttachmentEl) {
                expenseCurrentAttachmentEl.innerHTML = `المرفق الحالي: <a href="${expenseData.attachmentUrl}" target="_blank" class="text-primary hover:underline">${expenseData.attachmentName || 'عرض الملف'}</a>`;
            }
        }
    }

    const openExpenseFormForEdit = window.setupFormToggle({
        currentModule: 'expenses',
        addButtonId: 'add-expense-btn',
        formContainerId: 'expense-form-container', // Not a modal, direct div
        closeButtonId: 'close-expense-form-btn',
        cancelButtonId: 'cancel-expense-form-btn',
        formId: 'expense-form',
        formTitleId: 'expense-form-title',
        addTitle: 'إضافة مصروف جديد',
        editTitle: 'تعديل المصروف',
        resetFormFunction: resetExpenseForm,
        onOpen: async () => {
            // await populateEmployeesForExpenseDropdown(); // If needed
            // await populateBankAccountsForPayment(); // For payment method
        }
    });

    async function loadAndRenderExpenses() {
        if (!expensesTableBody) return;
        expensesTableBody.innerHTML = `<tr><td colspan="7" class="text-center p-4">جاري تحميل المصروفات...</td></tr>`;
        try {
            const expensesSnapshot = await db.collection('expenses').get();
            allExpensesData = expensesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            allExpensesData.sort((a, b) => new Date(b.date) - new Date(a.date));
            console.log("Expenses loaded:", allExpensesData);
            applyExpenseFiltersAndRender();
        } catch (error) {
            console.error("Error loading expenses:", error);
            expensesTableBody.innerHTML = `<tr><td colspan="7" class="text-center p-4 text-red-500">فشل تحميل المصروفات.</td></tr>`;
        }
    }
    
    function applyExpenseFiltersAndRender() {
        // TODO: Implement filtering by search, type, date range
        renderExpensesTable(allExpensesData);
    }

    function renderExpensesTable(expensesToRender) {
        if (!expensesTableBody) return;
        expensesTableBody.innerHTML = '';
        if (expensesToRender.length === 0) {
            expensesTableBody.innerHTML = `<tr><td colspan="7" class="text-center p-4">لا توجد مصروفات تطابق معايير البحث.</td></tr>`;
            return;
        }
        expensesToRender.forEach(expense => {
            const row = expensesTableBody.insertRow();
            row.innerHTML = `
                <td class="px-6 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">${new Date(expense.date).toLocaleDateString('ar-EG')}</td>
                <td class="px-6 py-3 whitespace-nowrap text-sm">
                    <span class="px-2 py-1 text-xs leading-5 font-semibold rounded-full bg-indigo-100 text-indigo-800 dark:bg-indigo-700 dark:text-indigo-100">
                        ${expenseTypeDisplayNames[expense.type] || expense.type}
                    </span>
                </td>
                <td class="px-6 py-3 whitespace-normal text-sm text-gray-700 dark:text-gray-200">${expense.description}</td>
                <td class="px-6 py-3 whitespace-nowrap text-sm font-semibold text-red-600 dark:text-red-400">${parseFloat(expense.amount).toFixed(2)}</td>
                <td class="px-6 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">${expense.paymentMethod === 'cash' ? 'نقداً' : (expense.paymentMethod.startsWith('bank_') ? 'بنك' : 'عهدة موظف')}</td>
                <td class="px-6 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">${expense.paidTo || (expense.employeeId ? `موظف ID: ${expense.employeeId}`: 'N/A')}</td>
                <td class="px-6 py-3 whitespace-nowrap text-sm font-medium text-left">
                    ${expense.attachmentUrl ? `<a href="${expense.attachmentUrl}" target="_blank" class="text-blue-600 hover:text-blue-800 ml-2" title="عرض المرفق"><i class="fas fa-paperclip"></i></a>` : ''}
                    <button class="text-primary hover:text-primary/80 ml-2 edit-expense-btn" data-id="${expense.id}" title="تعديل"><i class="fas fa-edit"></i></button>
                    <button class="text-red-600 hover:text-red-800 dark:text-red-400 delete-expense-btn" data-id="${expense.id}" title="حذف"><i class="fas fa-trash-alt"></i></button>
                </td>
            `;
        });

        expensesModuleNode.querySelectorAll('.edit-expense-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const expenseId = e.currentTarget.getAttribute('data-id');
                const expenseToEdit = allExpensesData.find(ex => ex.id === expenseId);
                if (expenseToEdit) {
                    openExpenseFormForEdit(expenseToEdit);
                }
            });
        });
        expensesModuleNode.querySelectorAll('.delete-expense-btn').forEach(btn => {
            btn.addEventListener('click', (e) => handleDeleteExpense(e.currentTarget.getAttribute('data-id')));
        });
    }

    if (expenseFormElement) {
        expenseFormElement.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!saveExpenseBtn) return;
            window.showButtonSpinner(saveExpenseBtn, true);

            const expenseId = expenseIdField.value;
            const file = expenseAttachmentField.files[0];
            let attachmentData = null;

            if (file) {
                console.log("File attachment:", file.name);
                attachmentData = { name: file.name, url: file.name, path: file.name };
            }


            const expenseData = {
                date: expenseDateField.value,
                type: expenseTypeField.value,
                description: expenseDescriptionField.value,
                amount: parseFloat(expenseAmountField.value),
                paymentMethod: expensePaymentMethodField.value,
                paidTo: expensePaidToField.value,
                employeeId: expenseEmployeeField.value,
            };
            if (attachmentData) {
                expenseData.attachmentName = attachmentData.name;
                expenseData.attachmentUrl = attachmentData.url;
                expenseData.attachmentPath = attachmentData.path; // To delete if expense/attachment is removed
            }


            try {
                if (expenseId) {
                    expenseData.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
                    await db.collection('expenses').doc(expenseId).update(expenseData);
                    console.log("Expense updated successfully");
                } else {
                    expenseData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
                    await db.collection('expenses').add(expenseData);
                    console.log("Expense added successfully");
                }
                const closeBtn = expensesModuleNode.querySelector('#close-expense-form-btn');
                if (closeBtn) closeBtn.click();
                await loadAndRenderExpenses();
            } catch (error) {
                console.error("Error saving expense:", error);
                alert(`فشل حفظ المصروف: ${error.message}`);
            } finally {
                window.showButtonSpinner(saveExpenseBtn, false);
            }
        });
    }

    async function handleDeleteExpense(expenseId) {
        if (confirm('هل أنت متأكد من حذف هذا المصروف؟')) {
            try {
                await db.collection('expenses').doc(expenseId).delete();
                console.log('Expense deleted successfully');
                await loadAndRenderExpenses();
            } catch (error) {
                console.error("Error deleting expense:", error);
                alert('فشل حذف المصروف.');
            }
        }
    }
    
    // Add event listeners for main page filters
    if(expenseSearchInput) expenseSearchInput.addEventListener('input', applyExpenseFiltersAndRender);
    // ...

    await loadAndRenderExpenses();
    console.log("✅ Expenses module initialized successfully");
}