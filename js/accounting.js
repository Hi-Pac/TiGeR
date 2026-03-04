let chartOfAccountsData = [];
let journalEntriesData = [];
let allAccountsForJournal = []; // To populate account dropdowns in journal entry form

async function initAccountingModule() {
    console.log("Accounting Module Initialized!");

    const accountingModuleNode = document.getElementById('accounting-module');
    if (!accountingModuleNode) return;

    // Tab buttons and content
    const tabButtons = accountingModuleNode.querySelectorAll('.accounting-tab-btn');
    const tabContents = accountingModuleNode.querySelectorAll('.accounting-tab-content');

    // Chart of Accounts (CoA) Elements
    const coaTableBody = accountingModuleNode.querySelector('#chart-of-accounts-table-body');
    const coaFormContainer = document.getElementById('account-coa-form-container'); // Modal
    const coaFormElement = document.getElementById('account-coa-form');
    // ... other CoA form fields

    // Journal Entries Elements
    const journalEntriesTableBody = accountingModuleNode.querySelector('#journal-entries-table-body');
    const journalEntryFormContainer = document.getElementById('journal-entry-form-container'); // Modal
    const journalEntryFormElement = document.getElementById('journal-entry-form');
    const journalEntryLinesTableBody = document.getElementById('journal-entry-lines-table-body');
    const addJournalEntryLineBtn = document.getElementById('add-journal-entry-line-btn');
    const journalTotalDebitEl = document.getElementById('journal-total-debit');
    const journalTotalCreditEl = document.getElementById('journal-total-credit');
    const journalBalanceStatusEl = document.getElementById('journal-balance-status');
    // ... other Journal Entry form fields
    
    // --- Tab Switching Logic ---
    function switchAccountingTab(targetTabId) {
        tabContents.forEach(content => content.classList.add('hidden'));
        tabButtons.forEach(button => button.classList.replace('bg-primary','bg-gray-200') || button.classList.replace('text-white','text-gray-700') /* basic deselection */);
        
        const activeContent = accountingModuleNode.querySelector(`#${targetTabId}-tab`);
        const activeButton = accountingModuleNode.querySelector(`[data-tab="${targetTabId}"]`);
        if (activeContent) activeContent.classList.remove('hidden');
        if (activeButton) activeButton.classList.replace('bg-gray-200','bg-primary') || activeButton.classList.replace('text-gray-700','text-white');

        // Load data for the active tab
        if (targetTabId === 'chart-of-accounts') {
            loadAndRenderChartOfAccounts();
        } else if (targetTabId === 'journal-entries') {
            loadAndRenderJournalEntries();
        }
    }
    tabButtons.forEach(button => {
        button.addEventListener('click', (e) => switchAccountingTab(e.currentTarget.dataset.tab));
    });


    // --- Chart of Accounts (CoA) Logic ---
    function resetCoaForm(accountData = null) {
        if(!coaFormElement) return;
        coaFormElement.reset();
        document.getElementById('account-coa-id-field').value = '';
        if (accountData) {
            // Populate CoA form for editing
            document.getElementById('account-coa-id-field').value = accountData.id;
            document.getElementById('account-coa-code-field').value = accountData.code || '';
            document.getElementById('account-coa-name-field').value = accountData.name || '';
            document.getElementById('account-coa-main-type-field').value = accountData.mainType || '';
            document.getElementById('account-coa-sub-type-field').value = accountData.subType || '';
            document.getElementById('account-coa-nature-field').value = accountData.nature || 'debit';
            document.getElementById('account-coa-opening-balance-field').value = accountData.openingBalance || 0;
            document.getElementById('account-coa-notes-field').value = accountData.notes || '';
        }
    }
    window.setupFormToggle({
        currentModule: 'accounting', // Ensure IDs are unique or scope correctly
        addButtonId: 'add-account-btn', // Button inside CoA tab
        formContainerId: 'account-coa-form-container',
        closeButtonId: 'close-account-coa-form-btn',
        cancelButtonId: 'cancel-account-coa-form-btn',
        formId: 'account-coa-form',
        formTitleId: 'account-coa-form-title',
        addTitle: 'إضافة حساب جديد (شجرة الحسابات)',
        editTitle: 'تعديل حساب',
        resetFormFunction: resetCoaForm
    });
    
    async function loadAndRenderChartOfAccounts() {
        if (!coaTableBody) return;
        coaTableBody.innerHTML = `<tr><td colspan="7" class="p-4 text-center">جاري تحميل شجرة الحسابات...</td></tr>`;
        try {
            await new Promise(resolve => setTimeout(resolve, 300));
            chartOfAccountsData = [
                { id: 'acc1', code: '1101', name: 'النقدية بالصندوق', mainType: 'assets', subType: 'الأصول المتداولة', nature: 'debit', currentBalance: 15000.00, openingBalance: 10000 },
                { id: 'acc2', code: '1201', name: 'حساب البنك الأهلي', mainType: 'assets', subType: 'الأصول المتداولة', nature: 'debit', currentBalance: 75300.50, openingBalance: 50000 },
                { id: 'acc3', code: '2101', name: 'الموردون', mainType: 'liabilities', subType: 'الخصوم المتداولة', nature: 'credit', currentBalance: 25000.00, openingBalance: 20000 },
                { id: 'acc4', code: '4101', name: 'إيرادات المبيعات', mainType: 'revenue', subType: '', nature: 'credit', currentBalance: 250000.00, openingBalance: 0 },
                { id: 'acc5', code: '5101', name: 'مصروف الإيجار', mainType: 'expenses_coa', subType: '', nature: 'debit', currentBalance: 5000.00, openingBalance: 0 },
            ];
            allAccountsForJournal = [...chartOfAccountsData]; // For journal entry dropdowns
            renderChartOfAccountsTable(chartOfAccountsData);
        } catch(e){ console.error("Error CoA:", e); coaTableBody.innerHTML = `<tr><td colspan="7" class="p-4 text-center text-red-500">فشل تحميل شجرة الحسابات.</td></tr>`;}
    }
    
    const mainTypeDisplay = {'assets': 'أصول', 'liabilities': 'خصوم', 'equity': 'حقوق ملكية', 'revenue': 'إيرادات', 'expenses_coa': 'مصروفات'};
    const natureDisplay = {'debit': 'مدين', 'credit': 'دائن'};

    function renderChartOfAccountsTable(accounts) {
        if(!coaTableBody) return;
        coaTableBody.innerHTML = '';
        if(accounts.length === 0) {coaTableBody.innerHTML = `<tr><td colspan="7" class="p-4 text-center">لا توجد حسابات.</td></tr>`; return;}
        accounts.forEach(acc => {
            const row = coaTableBody.insertRow();
            const balance = acc.currentBalance !== undefined ? acc.currentBalance : acc.openingBalance;
            row.innerHTML = `
                <td class="px-4 py-2 text-sm">${acc.code}</td>
                <td class="px-4 py-2 text-sm font-medium text-gray-900 dark:text-gray-100">${acc.name}</td>
                <td class="px-4 py-2 text-sm">${mainTypeDisplay[acc.mainType] || acc.mainType}</td>
                <td class="px-4 py-2 text-sm">${acc.subType || '-'}</td>
                <td class="px-4 py-2 text-sm">${natureDisplay[acc.nature] || acc.nature}</td>
                <td class="px-4 py-2 text-sm font-semibold">${parseFloat(balance).toFixed(2)}</td>
                <td class="px-4 py-2 text-sm text-left">
                    <button class="text-primary hover:text-primary/80 edit-coa-btn" data-id="${acc.id}"><i class="fas fa-edit"></i></button>
                    <button class="text-red-600 hover:text-red-800 delete-coa-btn" data-id="${acc.id}"><i class="fas fa-trash-alt"></i></button>
                </td>
            `;
        });
        // Add listeners for edit/delete CoA buttons
         accountingModuleNode.querySelectorAll('.edit-coa-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const accId = e.currentTarget.getAttribute('data-id');
                const accToEdit = chartOfAccountsData.find(a => a.id === accId);
                if (accToEdit) {
                   resetCoaForm(accToEdit); // Call reset with data
                   coaFormContainer.classList.remove('hidden'); 
                }
            });
        });
    }
    if(coaFormElement) coaFormElement.addEventListener('submit', async e => {
        e.preventDefault(); /* ... save CoA logic ... */
        alert("حفظ الحساب (محاكاة)"); coaFormContainer.classList.add('hidden'); await loadAndRenderChartOfAccounts();
    });


    // --- Journal Entries Logic ---
    let currentJournalEntryLines = [];

    function resetJournalEntryForm(entryData = null) {
        if(!journalEntryFormElement) return;
        journalEntryFormElement.reset();
        document.getElementById('journal-entry-id-field').value = '';
        document.getElementById('journal-entry-date-field').valueAsDate = new Date();
        currentJournalEntryLines = [];
        journalEntryLinesTableBody.innerHTML = '';
        addJournalEntryLineRow(); // Add at least one line for new entry
        calculateJournalTotals();
        // TODO: Populate form if 'entryData' for editing
    }
    window.setupFormToggle({
        currentModule: 'accounting',
        addButtonId: 'add-journal-entry-btn', // Button inside Journal tab
        formContainerId: 'journal-entry-form-container',
        closeButtonId: 'close-journal-entry-form-btn',
        cancelButtonId: 'cancel-journal-entry-form-btn',
        formId: 'journal-entry-form',
        formTitleId: 'journal-entry-form-title',
        addTitle: 'إضافة قيد يومية جديد',
        editTitle: 'تعديل قيد يومية',
        resetFormFunction: resetJournalEntryForm,
        onOpen: async () => {
            // Ensure chart of accounts is loaded for dropdowns
            if(allAccountsForJournal.length === 0) await loadAndRenderChartOfAccounts();
             if(journalEntryLinesTableBody.rows.length === 0) addJournalEntryLineRow();
        }
    });
    
    function addJournalEntryLineRow(line = null) {
        const newRow = journalEntryLinesTableBody.insertRow();
        newRow.className = 'journal-entry-line';
        newRow.innerHTML = `
            <td class="px-2 py-1"><select class="form-select p-1 text-xs account-selector" required>${allAccountsForJournal.map(a => `<option value="${a.id}">${a.code} - ${a.name}</option>`).join('')}</select></td>
            <td class="px-2 py-1"><input type="text" class="form-input p-1 text-xs line-description-field" placeholder="وصف السطر"></td>
            <td class="px-2 py-1"><input type="number" value="${line ? line.debit : 0}" min="0" step="0.01" class="form-input p-1 text-xs debit-field text-right"></td>
            <td class="px-2 py-1"><input type="number" value="${line ? line.credit : 0}" min="0" step="0.01" class="form-input p-1 text-xs credit-field text-right"></td>
            <td class="px-1 py-1 text-center"><button type="button" class="text-red-500 hover:text-red-700 remove-line-btn p-0.5 text-xs"><i class="fas fa-minus-circle"></i></button></td>
        `;
        newRow.querySelectorAll('.debit-field, .credit-field').forEach(input => input.addEventListener('input', calculateJournalTotals));
        newRow.querySelector('.remove-line-btn').addEventListener('click', e => { e.currentTarget.closest('tr').remove(); calculateJournalTotals();});
    }
    if(addJournalEntryLineBtn) addJournalEntryLineBtn.addEventListener('click', () => addJournalEntryLineRow());

    function calculateJournalTotals() {
        let totalDebit = 0;
        let totalCredit = 0;
        journalEntryLinesTableBody.querySelectorAll('.journal-entry-line').forEach(row => {
            totalDebit += parseFloat(row.querySelector('.debit-field').value) || 0;
            totalCredit += parseFloat(row.querySelector('.credit-field').value) || 0;
        });
        journalTotalDebitEl.textContent = totalDebit.toFixed(2);
        journalTotalCreditEl.textContent = totalCredit.toFixed(2);

        if (totalDebit === totalCredit && totalDebit > 0) {
            journalBalanceStatusEl.textContent = 'متوازن';
            journalBalanceStatusEl.className = 'text-sm text-green-600 dark:text-green-400';
            if(document.getElementById('save-journal-entry-form-btn')) document.getElementById('save-journal-entry-form-btn').disabled = false;
        } else if (totalDebit > 0 || totalCredit > 0) {
            journalBalanceStatusEl.textContent = 'غير متوازن';
            journalBalanceStatusEl.className = 'text-sm text-red-600 dark:text-red-400';
             if(document.getElementById('save-journal-entry-form-btn')) document.getElementById('save-journal-entry-form-btn').disabled = true;
        } else {
            journalBalanceStatusEl.textContent = '';
             if(document.getElementById('save-journal-entry-form-btn')) document.getElementById('save-journal-entry-form-btn').disabled = true;
        }
    }
    
    async function loadAndRenderJournalEntries() {
        if(!journalEntriesTableBody) return;
        journalEntriesTableBody.innerHTML = `<tr><td colspan="7" class="p-4 text-center">جاري تحميل القيود...</td></tr>`;
        try {
            await new Promise(resolve => setTimeout(resolve, 200));
            journalEntriesData = [
                {id: 'je1', date: '2023-10-01', description: 'تسجيل إيجار المكتب', totalDebit: 5000, totalCredit: 5000, status: 'posted'},
                {id: 'je2', date: '2023-10-05', description: 'إثبات مبيعات نقدية', totalDebit: 12000, totalCredit: 12000, status: 'posted'},
            ];
            renderJournalEntriesTable(journalEntriesData);
        } catch(e){ console.error("Err JE:",e); journalEntriesTableBody.innerHTML = `<tr><td colspan="7" class="p-4 text-center text-red-500">فشل تحميل القيود.</td></tr>`; }
    }
    
    const jeStatusDisplay = {'posted': 'مرحل', 'draft': 'مسودة'};
    const jeStatusClass = {'posted': 'bg-green-100 text-green-800', 'draft': 'bg-yellow-100 text-yellow-800'};

    function renderJournalEntriesTable(entries) {
        if(!journalEntriesTableBody) return;
        journalEntriesTableBody.innerHTML = '';
        if(entries.length === 0){ journalEntriesTableBody.innerHTML = `<tr><td colspan="7" class="p-4 text-center">لا توجد قيود.</td></tr>`; return; }
        entries.forEach(entry => {
            const row = journalEntriesTableBody.insertRow();
            row.innerHTML = `
                <td class="px-4 py-2 text-sm">${new Date(entry.date).toLocaleDateString('ar-EG')}</td>
                <td class="px-4 py-2 text-sm font-medium text-primary">${entry.id}</td>
                <td class="px-4 py-2 text-sm">${entry.description}</td>
                <td class="px-4 py-2 text-sm">${entry.totalDebit.toFixed(2)}</td>
                <td class="px-4 py-2 text-sm">${entry.totalCredit.toFixed(2)}</td>
                <td class="px-4 py-2 text-sm"><span class="px-2 py-0.5 text-xs rounded-full ${jeStatusClass[entry.status] || ''}">${jeStatusDisplay[entry.status] || entry.status}</span></td>
                <td class="px-4 py-2 text-sm text-left">
                    <button class="text-blue-600 hover:text-blue-800 view-je-btn" data-id="${entry.id}"><i class="fas fa-eye"></i></button>
                    <button class="text-primary hover:text-primary/80 edit-je-btn" data-id="${entry.id}"><i class="fas fa-edit"></i></button>
                </td>
            `;
        });
        // Add listeners for view/edit JE buttons
    }
     if(journalEntryFormElement) journalEntryFormElement.addEventListener('submit', async e => {
        e.preventDefault(); 
        // ... save Journal Entry logic ...
        // Validate totals are balanced
        if(parseFloat(journalTotalDebitEl.textContent) !== parseFloat(journalTotalCreditEl.textContent) || parseFloat(journalTotalDebitEl.textContent) === 0) {
            alert("القيد غير متوازن أو فارغ. يرجى المراجعة.");
            return;
        }
        alert("حفظ القيد (محاكاة)"); journalEntryFormContainer.classList.add('hidden'); await loadAndRenderJournalEntries();
    });


    // Initial tab to show
    switchAccountingTab('chart-of-accounts');
}
