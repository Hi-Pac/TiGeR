let allBankAccountsData = [];
let allBankTransactionsData = []; // Might be loaded per account or filtered

function initBanksModule() {
    console.log("Banks Module Initialized!");

    const banksModuleNode = document.getElementById('banks-module');
    if (!banksModuleNode) return;

    const bankAccountsTableBody = banksModuleNode.querySelector('#bank-accounts-table-body');
    const bankSummaryCardsContainer = banksModuleNode.querySelector('#bank-summary-cards');

    // Bank Account Form Elements (Modal is global)
    const bankAccountFormContainer = document.getElementById('bank-account-form-container');
    const bankAccountFormElement = document.getElementById('bank-account-form');
    const accountIdField = document.getElementById('bank-account-id-field');
    const accountNameField = document.getElementById('account-name-field');
    const accountTypeField = document.getElementById('account-type-field');
    const bankNameField = document.getElementById('bank-name-field');
    const accountNumberField = document.getElementById('account-number-field');
    const accountIbanField = document.getElementById('account-iban-field');
    const accountCurrencyField = document.getElementById('account-currency-field');
    const accountOpeningBalanceField = document.getElementById('account-opening-balance-field');
    const accountOpeningDateField = document.getElementById('account-opening-date-field');
    const accountNotesField = document.getElementById('account-notes-field');
    // ... other bank account form fields

    // Bank Transaction Form Elements (Modal is global)
    const bankTransactionFormContainer = document.getElementById('bank-transaction-form-container');
    const bankTransactionFormElement = document.getElementById('bank-transaction-form');
    const transactionAccountIdField = document.getElementById('transaction-account-field'); // Account selector in transaction form
    // ... other transaction form fields
    
    // Toggle bank-specific fields based on account type
    if(accountTypeField) {
        accountTypeField.addEventListener('change', (e) => {
            const isBank = e.target.value.startsWith('bank_');
            bankNameField.closest('div').style.display = isBank ? 'block' : 'none';
            accountNumberField.closest('div').style.display = isBank ? 'block' : 'none';
            accountIbanField.closest('div').style.display = isBank ? 'block' : 'none';
            bankNameField.required = isBank;
            // accountNumberField.required = isBank; // Might not always be required
        });
        // Trigger change on load if editing
    }


    function resetBankAccountForm(accountData = null) {
        if (!bankAccountFormElement) return;
        bankAccountFormElement.reset();
        accountIdField.value = '';
        accountOpeningDateField.valueAsDate = new Date();
        // Trigger change to hide/show bank specific fields
        if(accountTypeField) accountTypeField.dispatchEvent(new Event('change'));


        if (accountData) {
            accountIdField.value = accountData.id;
            accountNameField.value = accountData.accountName || '';
            accountTypeField.value = accountData.accountType || 'bank_current';
            accountTypeField.dispatchEvent(new Event('change')); // Update field visibility
            bankNameField.value = accountData.bankName || '';
            accountNumberField.value = accountData.accountNumber || '';
            accountIbanField.value = accountData.iban || '';
            accountCurrencyField.value = accountData.currency || 'EGP';
            accountOpeningBalanceField.value = accountData.openingBalance || 0;
            accountOpeningDateField.value = accountData.openingDate || new Date().toISOString().slice(0,10);
            accountNotesField.value = accountData.notes || '';
        }
    }

    window.setupFormToggle({
        currentModule: 'banks', // Not strictly needed as modal is global
        addButtonId: 'add-bank-account-btn',
        formContainerId: 'bank-account-form-container',
        closeButtonId: 'close-bank-account-form-btn',
        cancelButtonId: 'cancel-bank-account-form-btn',
        formId: 'bank-account-form',
        formTitleId: 'bank-account-form-title',
        addTitle: 'إضافة حساب بنكي/خزينة',
        editTitle: 'تعديل بيانات الحساب',
        resetFormFunction: resetBankAccountForm,
        onOpen: (editData) => {
            if (editData && accountTypeField) { // Trigger change if editing to show/hide fields
                 accountTypeField.dispatchEvent(new Event('change'));
            }
        }
    });

    function resetBankTransactionForm(transactionData = null) {
        if(!bankTransactionFormElement) return;
        bankTransactionFormElement.reset();
        document.getElementById('bank-transaction-id-field').value = '';
        document.getElementById('transaction-date-field').valueAsDate = new Date();
        // TODO: Populate form if 'transactionData' is provided
    }

    window.setupFormToggle({
        currentModule: 'banks',
        addButtonId: 'add-bank-transaction-btn',
        formContainerId: 'bank-transaction-form-container',
        closeButtonId: 'close-bank-transaction-form-btn',
        cancelButtonId: 'cancel-bank-transaction-form-btn',
        formId: 'bank-transaction-form',
        formTitleId: 'bank-transaction-form-title',
        addTitle: 'تسجيل معاملة جديدة',
        editTitle: 'تعديل معاملة',
        resetFormFunction: resetBankTransactionForm,
        onOpen: async () => {
            await populateAccountsForTransactionDropdown();
        }
    });
    
    async function populateAccountsForTransactionDropdown() {
        // Use allBankAccountsData if already loaded, otherwise fetch
        if (allBankAccountsData.length === 0) {
            // --- FIREBASE: Fetch bank accounts/cash boxes ---
            // const snapshot = await db.collection('bankAccounts').orderBy('accountName').get();
            // allBankAccountsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
             await new Promise(resolve => setTimeout(resolve, 50)); // Simulate fetch if needed
        }
        
        if(transactionAccountIdField) {
            transactionAccountIdField.innerHTML = '<option value="">اختر الحساب...</option>';
            allBankAccountsData.forEach(acc => {
                transactionAccountIdField.add(new Option(`${acc.accountName} (${acc.currency})`, acc.id));
            });
        }
    }


    async function loadAndRenderBankAccounts() {
        if (!bankAccountsTableBody) return;
        bankAccountsTableBody.innerHTML = `<tr><td colspan="6" class="text-center p-4">جاري تحميل الحسابات...</td></tr>`;
        if (bankSummaryCardsContainer) bankSummaryCardsContainer.innerHTML = '<div class="animate-pulse"><div class="h-16 bg-gray-300 dark:bg-gray-700 rounded"></div></div>'.repeat(3);

        try {
            const accountsSnapshot = await db.collection('bankAccounts').get();
            allBankAccountsData = accountsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            console.log("Bank Accounts loaded:", allBankAccountsData);
            renderBankAccountsTable(allBankAccountsData);
            renderBankSummaryCards(allBankAccountsData);
            await populateAccountsForTransactionDropdown();
        } catch (error) {
            console.error("Error loading bank accounts:", error);
            bankAccountsTableBody.innerHTML = `<tr><td colspan="6" class="text-center p-4 text-red-500">فشل تحميل الحسابات.</td></tr>`;
            if(bankSummaryCardsContainer) bankSummaryCardsContainer.innerHTML = '<p class="text-red-500 col-span-full">فشل تحميل ملخص الحسابات.</p>';
        }
    }

    function renderBankSummaryCards(accounts) {
        if (!bankSummaryCardsContainer) return;
        bankSummaryCardsContainer.innerHTML = ''; // Clear pulse/previous

        const summary = accounts.reduce((acc, curr) => {
            const currency = curr.currency || 'EGP';
            if (!acc[currency]) {
                acc[currency] = { total: 0, count: 0 };
            }
            acc[currency].total += (parseFloat(curr.currentBalance) || 0);
            acc[currency].count++;
            return acc;
        }, {});

        Object.entries(summary).forEach(([currency, data]) => {
            const card = document.createElement('div');
            card.className = 'bg-white dark:bg-gray-800 p-4 rounded-lg shadow';
            card.innerHTML = `
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-sm text-gray-500 dark:text-gray-400">إجمالي رصيد (${currency})</p>
                        <h3 class="text-xl font-bold text-primary dark:text-primary/90">${data.total.toLocaleString('ar-EG', {minimumFractionDigits: 2})}</h3>
                    </div>
                    <div class="w-10 h-10 bg-primary/10 dark:bg-primary/20 rounded-full flex items-center justify-center text-primary dark:text-gray-200">
                        <i class="fas fa-wallet"></i>
                    </div>
                </div>
                <p class="text-xs text-gray-400 dark:text-gray-500 mt-1">عدد الحسابات: ${data.count}</p>
            `;
            bankSummaryCardsContainer.appendChild(card);
        });
        if (Object.keys(summary).length === 0) {
            bankSummaryCardsContainer.innerHTML = '<p class="text-gray-500 col-span-full text-center">لا توجد حسابات لعرض ملخص لها.</p>';
        }
    }
    
    const accountTypeDisplay = {
        'bank_current': 'بنكي - جاري',
        'bank_saving': 'بنكي - توفير',
        'cash_on_hand': 'خزينة نقدية',
        'e_wallet': 'محفظة إلكترونية'
    };

    function renderBankAccountsTable(accountsToRender) {
        if (!bankAccountsTableBody) return;
        bankAccountsTableBody.innerHTML = '';
        if (accountsToRender.length === 0) {
            bankAccountsTableBody.innerHTML = `<tr><td colspan="6" class="text-center p-4">لا توجد حسابات بنكية أو خزائن معرفة.</td></tr>`;
            return;
        }
        accountsToRender.forEach(account => {
            const row = bankAccountsTableBody.insertRow();
            const balanceColor = (parseFloat(account.currentBalance) || 0) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';
            row.innerHTML = `
                <td class="px-6 py-3 whitespace-nowrap">
                    <div class="text-sm font-medium text-gray-900 dark:text-gray-100">${account.accountName}</div>
                    ${account.accountType.startsWith('bank_') ? `<div class="text-xs text-gray-500 dark:text-gray-400">${account.bankName || ''}</div>` : ''}
                </td>
                <td class="px-6 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">${accountTypeDisplay[account.accountType] || account.accountType}</td>
                <td class="px-6 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">${account.accountNumber || 'N/A'}</td>
                <td class="px-6 py-3 whitespace-nowrap text-sm font-semibold ${balanceColor}">${(parseFloat(account.currentBalance) || 0).toLocaleString('ar-EG', {minimumFractionDigits: 2})}</td>
                <td class="px-6 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">${account.currency}</td>
                <td class="px-6 py-3 whitespace-nowrap text-sm font-medium text-left">
                    <button class="text-blue-600 hover:text-blue-800 dark:text-blue-400 ml-2 view-account-transactions-btn" data-id="${account.id}" title="عرض المعاملات"><i class="fas fa-list-alt"></i></button>
                    <button class="text-primary hover:text-primary/80 ml-2 edit-bank-account-btn" data-id="${account.id}" title="تعديل الحساب"><i class="fas fa-edit"></i></button>
                    <button class="text-red-600 hover:text-red-800 dark:text-red-400 delete-bank-account-btn" data-id="${account.id}" title="حذف الحساب"><i class="fas fa-trash-alt"></i></button>
                </td>
            `;
        });

        banksModuleNode.querySelectorAll('.edit-bank-account-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const accountId = e.currentTarget.getAttribute('data-id');
                const accountToEdit = allBankAccountsData.find(acc => acc.id === accountId);
                if (accountToEdit) {
                    resetBankAccountForm(accountToEdit); // Call reset with data
                    bankAccountFormContainer.classList.remove('hidden'); // Manually open if setupFormToggle not used or different
                }
            });
        });
        // Add delete and view transactions listeners
    }

    if (bankAccountFormElement) {
        bankAccountFormElement.addEventListener('submit', async (e) => {
            e.preventDefault();
            // ... Save bank account logic (add/update)
            const isBank = accountTypeField.value.startsWith('bank_');
            const accountData = {
                accountName: accountNameField.value,
                accountType: accountTypeField.value,
                bankName: isBank ? bankNameField.value : null,
                accountNumber: isBank ? accountNumberField.value : null,
                iban: isBank ? accountIbanField.value : null,
                currency: accountCurrencyField.value,
                openingBalance: parseFloat(accountOpeningBalanceField.value),
                openingDate: accountOpeningDateField.value,
                notes: accountNotesField.value,
                // currentBalance will be openingBalance initially, then updated by transactions
            };
            const accountId = accountIdField.value;
            if(accountId){
                console.log("Updating account:", accountId, accountData); alert("تحديث الحساب (محاكاة)");
            } else {
                 console.log("Adding account:", accountData); alert("إضافة حساب (محاكاة)");
            }
            bankAccountFormContainer.classList.add('hidden');
            await loadAndRenderBankAccounts();
        });
    }
    
    if (bankTransactionFormElement) {
        bankTransactionFormElement.addEventListener('submit', async (e) => {
            e.preventDefault();
            // ... Save bank transaction logic
            // This should update the currentBalance of the selected bank account
            alert("حفظ المعاملة البنكية (محاكاة)");
            bankTransactionFormContainer.classList.add('hidden');
            await loadAndRenderBankAccounts(); // To reflect balance changes
            // Optionally, load and display transactions for the affected account
        });
    }
    
    // TODO: handleDeleteBankAccount function

    loadAndRenderBankAccounts();
}
