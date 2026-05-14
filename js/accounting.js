let chartOfAccountsData = [];
let journalEntriesData = [];
let allAccountsForJournal = []; // To populate account dropdowns in journal entry form

async function initAccountingModule() {
    // Reset stale state from any previous visit to this module.
    chartOfAccountsData = [];
    journalEntriesData = [];
    allAccountsForJournal = [];

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
            // Load from database
            const { data, error } = await window.DB.from('chart_of_accounts')
                .select('id,code,name,name_ar,account_type,parent_id,account_nature,current_balance,opening_balance,notes')
                .eq('company_id', window.AppAuth?.companyId())
                .eq('status', 'active')
                .order('code', { ascending: true })
                .limit(100)
                .get(); // Execute DB wrapper select query

            if (error) {
                console.error("Database error loading CoA:", error);
                throw new Error('فشل تحميل شجرة الحسابات من قاعدة البيانات');
            }

            // Map database fields to UI format
            chartOfAccountsData = (data || []).map(acc => ({
                id: acc.id,
                code: acc.code,
                name: acc.name_ar || acc.name,
                mainType: acc.account_type,
                subType: acc.parent_id ? 'حساب فرعي' : '', // Could be enhanced to show parent name
                nature: acc.account_nature,
                currentBalance: parseFloat(acc.current_balance || 0),
                openingBalance: parseFloat(acc.opening_balance || 0),
                notes: acc.notes
            }));

            allAccountsForJournal = [...chartOfAccountsData]; // For journal entry dropdowns
            renderChartOfAccountsTable(chartOfAccountsData);
        } catch(e){
            console.error("Error loading CoA:", e);
            coaTableBody.innerHTML = `<tr><td colspan="7" class="p-4 text-center text-red-500">${e.message || 'فشل تحميل شجرة الحسابات.'}</td></tr>`;
        }
    }

    const mainTypeDisplay = {'assets': 'أصول', 'liabilities': 'خصوم', 'equity': 'حقوق ملكية', 'revenue': 'إيرادات', 'expenses': 'مصروفات'};
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

        // Add delete listeners
        accountingModuleNode.querySelectorAll('.delete-coa-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const accId = e.currentTarget.getAttribute('data-id');
                const accToDelete = chartOfAccountsData.find(a => a.id === accId);
                if (!accToDelete) return;

                if (!confirm(`هل أنت متأكد من حذف الحساب: ${accToDelete.name}؟\nهذا الإجراء لا يمكن التراجع عنه.`)) {
                    return;
                }

                try {
                    // Soft delete by setting status to 'inactive'
                    await window.DB.from('chart_of_accounts')
                        .eq('id', accId)
                        .update({ status: 'inactive' });

                    alert('تم حذف الحساب بنجاح');
                    await loadAndRenderChartOfAccounts();
                } catch (error) {
                    console.error('Error deleting account:', error);
                    alert('حدث خطأ أثناء حذف الحساب: ' + (error.message || 'خطأ غير معروف'));
                }
            });
        });
    }
    if(coaFormElement) coaFormElement.addEventListener('submit', async e => {
        e.preventDefault();

        const accountId = document.getElementById('account-coa-id-field').value;
        const code = document.getElementById('account-coa-code-field').value.trim();
        const name = document.getElementById('account-coa-name-field').value.trim();
        const mainType = document.getElementById('account-coa-main-type-field').value;
        const subType = document.getElementById('account-coa-sub-type-field').value.trim();
        const nature = document.getElementById('account-coa-nature-field').value;
        const openingBalance = parseFloat(document.getElementById('account-coa-opening-balance-field').value) || 0;
        const notes = document.getElementById('account-coa-notes-field').value.trim();

        // Validation
        if (!code || !name || !mainType || !nature) {
            alert('يرجى ملء جميع الحقول المطلوبة (كود الحساب، الاسم، النوع، الطبيعة)');
            return;
        }

        try {
            const saveButton = document.getElementById('save-account-coa-form-btn');
            if (saveButton) {
                saveButton.disabled = true;
                saveButton.textContent = 'جاري الحفظ...';
            }

            const accountData = {
                company_id: window.AppAuth?.companyId(),
                code: code,
                name: name,
                name_ar: name,
                account_type: mainType,
                account_nature: nature,
                opening_balance: openingBalance,
                current_balance: accountId ? undefined : openingBalance, // Set initial balance only for new accounts
                notes: notes,
                status: 'active'
            };

            let result;
            if (accountId) {
                // Update existing account
                delete accountData.current_balance; // Don't update current balance on edit
                try {
                    const updatedAccount = await window.DB.from('chart_of_accounts')
                        .eq('id', accountId)
                        .update(accountData);
                    result = { data: updatedAccount, error: null };
                } catch (err) {
                    result = { data: null, error: err };
                }
            } else {
                // Insert new account
                try {
                    const newAccount = await window.DB.from('chart_of_accounts')
                        .insert(accountData);
                    result = { data: newAccount, error: null };
                } catch (err) {
                    result = { data: null, error: err };
                }
            }

            if (result.error) {
                console.error('Database error saving account:', result.error);
                const errMsg = result.error.message || '';
                if (errMsg.includes('chart_of_accounts_company_id_code_key') || errMsg.includes('duplicate key')) {
                    throw new Error(`كود الحساب "${code}" مستخدم مسبقاً، يرجى اختيار كود مختلف`);
                }
                throw new Error(errMsg || 'فشل حفظ الحساب');
            }

            alert(accountId ? 'تم تحديث الحساب بنجاح' : 'تم إضافة الحساب بنجاح');
            coaFormContainer.classList.add('hidden');
            await loadAndRenderChartOfAccounts();

        } catch (error) {
            console.error('Error saving account:', error);
            alert('خطأ في حفظ الحساب: ' + (error.message || 'خطأ غير معروف'));
        } finally {
            const saveButton = document.getElementById('save-account-coa-form-btn');
            if (saveButton) {
                saveButton.disabled = false;
                saveButton.textContent = 'حفظ الحساب';
            }
        }
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

        // Allow save if balanced OR if both are zero (empty draft entry)
        if (totalDebit === totalCredit && totalDebit > 0) {
            journalBalanceStatusEl.textContent = 'متوازن';
            journalBalanceStatusEl.className = 'text-sm text-green-600 dark:text-green-400';
            if(document.getElementById('save-journal-entry-form-btn')) document.getElementById('save-journal-entry-form-btn').disabled = false;
        } else if (totalDebit === 0 && totalCredit === 0) {
            journalBalanceStatusEl.textContent = 'قيد فارغ (مسودة)';
            journalBalanceStatusEl.className = 'text-sm text-gray-500 dark:text-gray-400';
            if(document.getElementById('save-journal-entry-form-btn')) document.getElementById('save-journal-entry-form-btn').disabled = false;
        } else {
            journalBalanceStatusEl.textContent = 'غير متوازن';
            journalBalanceStatusEl.className = 'text-sm text-red-600 dark:text-red-400';
             if(document.getElementById('save-journal-entry-form-btn')) document.getElementById('save-journal-entry-form-btn').disabled = true;
        }
    }
    
    async function loadAndRenderJournalEntries() {
        if(!journalEntriesTableBody) return;
        journalEntriesTableBody.innerHTML = `<tr><td colspan="7" class="p-4 text-center">جاري تحميل القيود...</td></tr>`;
        try {
            // Load from database
            const { data, error } = await window.supabaseClient
                .from('journal_entries')
                .select(`
                    id,
                    entry_number,
                    entry_date,
                    description,
                    total_debit,
                    total_credit,
                    status,
                    reference_type,
                    reference_id,
                    journal_entry_lines (
                        id,
                        account_id,
                        description,
                        debit_amount,
                        credit_amount
                    )
                `)
                .eq('company_id', window.AppAuth?.companyId())
                .order('entry_date', { ascending: false })
                .order('entry_number', { ascending: false })
                .limit(100); // Added pagination

            if (error) {
                console.error("Database error loading journal entries:", error);
                throw new Error('فشل تحميل القيود من قاعدة البيانات');
            }

            // Map database fields to UI format
            journalEntriesData = (data || []).map(entry => ({
                id: entry.id,
                entryNumber: entry.entry_number,
                date: entry.entry_date,
                description: entry.description,
                totalDebit: parseFloat(entry.total_debit || 0),
                totalCredit: parseFloat(entry.total_credit || 0),
                status: entry.status,
                referenceType: entry.reference_type,
                referenceId: entry.reference_id,
                lines: entry.journal_entry_lines || [] // Pre-fetched lines
            }));

            renderJournalEntriesTable(journalEntriesData);
        } catch(e){
            console.error("Error loading journal entries:", e);
            journalEntriesTableBody.innerHTML = `<tr><td colspan="7" class="p-4 text-center text-red-500">${e.message || 'فشل تحميل القيود.'}</td></tr>`;
        }
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
                <td class="px-4 py-2 text-sm font-medium text-primary">${entry.entryNumber || entry.id}</td>
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
        accountingModuleNode.querySelectorAll('.edit-je-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const entryId = e.currentTarget.getAttribute('data-id');
                const entryToEdit = journalEntriesData.find(je => je.id === entryId);
                if (entryToEdit) {
                    // Populate form with pre-fetched lines
                    resetJournalEntryForm({ ...entryToEdit, lines: entryToEdit.lines || [] });
                    journalEntryFormContainer.classList.remove('hidden');
                }
            });
        });

        accountingModuleNode.querySelectorAll('.view-je-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const entryId = e.currentTarget.getAttribute('data-id');
                const entryToView = journalEntriesData.find(je => je.id === entryId);
                if (entryToView) {
                    // For now, just log or show a simple alert. Full view would need a dedicated UI.
                    window.AppNotify?.info(`عرض تفاصيل القيد ID: ${entryId} (قيد الإنشاء)`);
                }
            });
        });
    } // Added missing closing brace for renderJournalEntriesTable

     if(journalEntryFormElement) journalEntryFormElement.addEventListener('submit', async e => {
        e.preventDefault();

        // Get form data
        const entryId = document.getElementById('journal-entry-id-field').value;
        const entryDate = document.getElementById('journal-entry-date-field').value;
        const referenceNumber = document.getElementById('journal-entry-ref-field').value.trim();
        const description = document.getElementById('journal-entry-description-field').value.trim();

        // Validate totals are balanced
        const totalDebit = parseFloat(journalTotalDebitEl.textContent) || 0;
        const totalCredit = parseFloat(journalTotalCreditEl.textContent) || 0;

        if (totalDebit !== totalCredit || totalDebit === 0) {
            alert("القيد غير متوازن أو فارغ. يرجى المراجعة.");
            return;
        }

        if (!entryDate || !description) {
            alert("يرجى ملء التاريخ والبيان");
            return;
        }

        // Collect journal entry lines
        const lines = [];
        journalEntryLinesTableBody.querySelectorAll('.journal-entry-line').forEach(row => {
            const accountId = row.querySelector('.account-selector').value;
            const lineDescription = row.querySelector('.line-description-field').value.trim();
            const debit = parseFloat(row.querySelector('.debit-field').value) || 0;
            const credit = parseFloat(row.querySelector('.credit-field').value) || 0;

            if (debit > 0 || credit > 0) {
                lines.push({
                    account_id: accountId,
                    description: lineDescription,
                    debit_amount: debit,
                    credit_amount: credit
                });
            }
        });

        if (lines.length === 0) {
            alert("يرجى إضافة بنود للقيد");
            return;
        }

        try {
            const saveButton = document.getElementById('save-journal-entry-form-btn');
            if (saveButton) {
                saveButton.disabled = true;
                saveButton.textContent = 'جاري الحفظ...';
            }

            // Generate entry number if new
            let entryNumber = referenceNumber;
            if (!entryId && !entryNumber) {
                // Auto-generate entry number: JE-YYYYMMDD-XXX
                const dateStr = entryDate.replace(/-/g, '');
                const { data: lastEntry } = await window.DB.from('journal_entries')
                    .select('entry_number')
                    .eq('company_id', window.AppAuth?.companyId())
                    .like('entry_number', `JE-${dateStr}%`)
                    .order('entry_number', { ascending: false })
                    .limit(1)
                    .get();

                let sequence = 1;
                if (lastEntry && lastEntry.length > 0) {
                    const lastNum = lastEntry[0].entry_number.split('-').pop();
                    sequence = parseInt(lastNum) + 1;
                }
                entryNumber = `JE-${dateStr}-${sequence.toString().padStart(3, '0')}`;
            }

            const journalData = {
                company_id: window.AppAuth?.companyId(),
                branch_id: window.AppAuth?.branchId() || null,
                entry_number: entryNumber,
                entry_date: entryDate,
                description: description,
                total_debit: totalDebit,
                total_credit: totalCredit,
                status: 'draft',
                created_by: window.AppAuth?.currentUser?.id
            };

            if (entryId) {
                // Update existing entry - not implemented yet as it's complex
                alert("تعديل القيود غير مدعوم حالياً. يرجى حذف القيد وإنشاء قيد جديد.");
                return;
            } else {
                // Insert new journal entry
                let journalEntry;
                try {
                    journalEntry = await window.DB.from('journal_entries')
                        .insert(journalData);
                } catch (journalError) {
                    console.error('Database error saving journal entry:', journalError);
                    throw new Error(journalError.message || 'فشل حفظ القيد');
                }

                // Insert journal entry lines
                const linesWithEntryId = lines.map(line => ({
                    ...line,
                    journal_entry_id: journalEntry.id
                }));

                try {
                    await window.DB.from('journal_entry_lines')
                        .insertMany(linesWithEntryId);
                } catch (linesError) {
                    console.error('Database error saving journal entry lines:', linesError);
                    // Try to delete the parent entry if lines failed
                    try {
                        await window.supabaseClient.from('journal_entries').delete().eq('id', journalEntry.id);
                    } catch (deleteErr) {
                        console.error('Failed to rollback journal entry:', deleteErr);
                    } 
                    throw new Error('فشل حفظ بنود القيد');
                }

                alert(`تم إضافة القيد بنجاح\nرقم القيد: ${entryNumber}`);
                journalEntryFormContainer.classList.add('hidden');
                await loadAndRenderJournalEntries();
            }

        } catch (error) {
            console.error('Error saving journal entry:', error);
            alert('خطأ في حفظ القيد: ' + (error.message || 'خطأ غير معروف'));
        } finally {
            const saveButton = document.getElementById('save-journal-entry-form-btn');
            if (saveButton) {
                saveButton.disabled = false;
                saveButton.textContent = 'حفظ القيد';
            }
        }
    });


    // Initial tab to show
    switchAccountingTab('chart-of-accounts');
}
