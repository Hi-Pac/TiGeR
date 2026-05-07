// js/users.js

let allUsersData = [];

const ROLE_LABELS = {
    admin: 'مدير',
    accountant: 'محاسب',
    sales: 'مندوب مبيعات',
    warehouse: 'أمين مخزن',
    viewer: 'مشاهد',
};

async function initUsersModule() {
    const usersModuleNode = document.getElementById('users-module');
    if (!usersModuleNode) return;

    const usersTableBody = usersModuleNode.querySelector('#users-table-body');
    const userFormElement = document.getElementById('user-form');

    const userIdField = document.getElementById('user-id-field');
    const userAuthIdField = document.getElementById('user-auth-id-field');
    const userNameField = document.getElementById('user-name-field');
    const userPhoneField = document.getElementById('user-phone-field');
    const userRoleField = document.getElementById('user-role-field');
    const userStatusField = document.getElementById('user-status-field');
    const saveUserBtn = document.getElementById('save-user-form-btn');

    const userSearchInput = usersModuleNode.querySelector('#user-search-input');
    const userRoleFilter = usersModuleNode.querySelector('#user-role-filter');
    const userStatusFilter = usersModuleNode.querySelector('#user-status-filter');

    function resetUserForm(userData = null) {
        if (!userFormElement) return;
        userFormElement.reset();
        userIdField.value = '';

        if (userData) {
            userIdField.value = userData.id;
            userAuthIdField.value = userData.id;
            userAuthIdField.readOnly = true;
            userNameField.value = userData.full_name || '';
            userPhoneField.value = userData.phone || '';
            userRoleField.value = userData.role || '';
            userStatusField.value = userData.status || 'active';
        } else {
            userAuthIdField.value = '';
            userAuthIdField.readOnly = false;
            userStatusField.value = 'active';
        }
    }

    const openUserFormForEdit = window.setupFormToggle({
        currentModule: 'users',
        addButtonId: 'add-user-btn',
        formContainerId: 'user-form-container',
        closeButtonId: 'close-user-form-btn',
        cancelButtonId: 'cancel-user-form-btn',
        formId: 'user-form',
        formTitleId: 'user-form-title',
        addTitle: 'إضافة مستخدم جديد',
        editTitle: 'تعديل بيانات المستخدم',
        resetFormFunction: resetUserForm,
    });

    function isValidUUID(value) {
        return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value || '');
    }

    async function loadAndRenderUsers() {
        if (!usersTableBody || !window.DB) {
            if (usersTableBody) {
                usersTableBody.innerHTML = `<tr><td colspan="5" class="text-center p-4 text-red-500">خطأ في تهيئة قاعدة البيانات.</td></tr>`;
            }
            return;
        }

        usersTableBody.innerHTML = `<tr><td colspan="5" class="text-center p-4">جاري تحميل المستخدمين... <span class="loader ml-2"></span></td></tr>`;

        try {
            const { data, error } = await window.supabaseClient
                .from('profiles')
                .select('*')
                .order('full_name', { ascending: true });

            if (error) throw error;

            allUsersData = data || [];
            applyFiltersAndRender();
        } catch (error) {
            console.error('Error loading users from profiles:', error);
            usersTableBody.innerHTML = `<tr><td colspan="5" class="text-center p-4 text-red-500">فشل تحميل المستخدمين: ${error.message}</td></tr>`;
        }
    }

    function applyFiltersAndRender() {
        if (!usersTableBody) return;

        let filteredUsers = [...allUsersData];
        const searchTerm = (userSearchInput?.value || '').trim().toLowerCase();
        const roleFilter = userRoleFilter?.value || '';
        const statusFilter = userStatusFilter?.value || '';

        if (searchTerm) {
            filteredUsers = filteredUsers.filter((user) => {
                const fullName = (user.full_name || '').toLowerCase();
                const phone = (user.phone || '').toLowerCase();
                const uid = (user.id || '').toLowerCase();
                return fullName.includes(searchTerm) || phone.includes(searchTerm) || uid.includes(searchTerm);
            });
        }

        if (roleFilter) filteredUsers = filteredUsers.filter(user => user.role === roleFilter);
        if (statusFilter) filteredUsers = filteredUsers.filter(user => user.status === statusFilter);

        renderUsersTable(filteredUsers);
    }

    function renderUsersTable(usersToRender) {
        if (!usersTableBody) return;
        usersTableBody.innerHTML = '';

        if (usersToRender.length === 0) {
            usersTableBody.innerHTML = `<tr><td colspan="5" class="text-center p-4">لا يوجد مستخدمون يطابقون معايير البحث.</td></tr>`;
            return;
        }

        usersToRender.forEach((user) => {
            const row = usersTableBody.insertRow();
            const initials = (user.full_name || 'NA').substring(0, 2).toUpperCase();
            const roleLabel = ROLE_LABELS[user.role] || user.role || '-';

            row.innerHTML = `
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="flex items-center">
                        <div class="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center text-primary dark:bg-primary/30 dark:text-gray-200">
                            <span>${initials}</span>
                        </div>
                        <div class="mr-4">
                            <div class="text-sm font-medium text-gray-900 dark:text-gray-100">${user.full_name || '-'}</div>
                            <div class="text-xs text-gray-500 dark:text-gray-400">${user.phone || 'لا يوجد رقم'}</div>
                        </div>
                    </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-xs text-gray-500 dark:text-gray-400">${user.id}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">${roleLabel}</td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${user.status === 'active' ? 'bg-green-100 text-green-800 dark:bg-green-700 dark:text-green-100' : 'bg-red-100 text-red-800 dark:bg-red-700 dark:text-red-100'}">
                        ${user.status === 'active' ? 'نشط' : 'غير نشط'}
                    </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button class="text-primary hover:text-primary/80 ml-2 edit-user-btn" data-id="${user.id}" title="تعديل"><i class="fas fa-edit"></i></button>
                    <button class="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 deactivate-user-btn" data-id="${user.id}" title="تعطيل"><i class="fas fa-user-slash"></i></button>
                </td>
            `;
        });

        usersModuleNode.querySelectorAll('.edit-user-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const userId = e.currentTarget.getAttribute('data-id');
                const userToEdit = allUsersData.find(u => u.id === userId);
                if (userToEdit) openUserFormForEdit(userToEdit);
            });
        });

        usersModuleNode.querySelectorAll('.deactivate-user-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const userId = e.currentTarget.getAttribute('data-id');
                await handleDeactivateUser(userId);
            });
        });
    }

    if (userFormElement) {
        userFormElement.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!saveUserBtn || !window.supabaseClient) return;

            window.showButtonSpinner(saveUserBtn, true);

            const userId = userIdField.value.trim();
            const authIdInput = userAuthIdField.value.trim();
            const fullName = userNameField.value.trim();
            const phone = userPhoneField.value.trim();
            const role = userRoleField.value;
            const status = userStatusField.value;

            try {
                if (!fullName) throw new Error('الاسم مطلوب.');
                if (!role) throw new Error('الدور مطلوب.');
                if (!status) throw new Error('الحالة مطلوبة.');

                if (userId) {
                    const { error } = await window.supabaseClient
                        .from('profiles')
                        .update({
                            full_name: fullName,
                            phone: phone || null,
                            role,
                            status,
                            updated_at: new Date().toISOString(),
                        })
                        .eq('id', userId);

                    if (error) throw error;
                } else {
                    if (!isValidUUID(authIdInput)) {
                        throw new Error('معرف Auth UID غير صالح.');
                    }

                    const companyId = window.AppAuth?.companyId();
                    if (!companyId) {
                        throw new Error('تعذر تحديد الشركة الحالية للمستخدم.');
                    }

                    const { error } = await window.supabaseClient
                        .from('profiles')
                        .insert({
                            id: authIdInput,
                            company_id: companyId,
                            full_name: fullName,
                            phone: phone || null,
                            role,
                            status,
                        });

                    if (error) throw error;
                }

                const closeBtn = document.getElementById('close-user-form-btn');
                if (closeBtn) closeBtn.click();
                await loadAndRenderUsers();
            } catch (error) {
                console.error('Error saving profile:', error);
                alert(`فشل حفظ المستخدم: ${error.message || 'خطأ غير متوقع.'}`);
            } finally {
                window.showButtonSpinner(saveUserBtn, false);
            }
        });
    }

    async function handleDeactivateUser(userId) {
        if (!window.supabaseClient) return;
        if (!confirm('هل تريد تعطيل هذا المستخدم؟')) return;

        try {
            const { error } = await window.supabaseClient
                .from('profiles')
                .update({ status: 'inactive', updated_at: new Date().toISOString() })
                .eq('id', userId);

            if (error) throw error;
            await loadAndRenderUsers();
        } catch (error) {
            console.error('Error deactivating user profile:', error);
            alert(`فشل تعطيل المستخدم: ${error.message || 'خطأ غير متوقع.'}`);
        }
    }

    if (userSearchInput) userSearchInput.addEventListener('input', applyFiltersAndRender);
    if (userRoleFilter) userRoleFilter.addEventListener('change', applyFiltersAndRender);
    if (userStatusFilter) userStatusFilter.addEventListener('change', applyFiltersAndRender);

    await loadAndRenderUsers();
}
