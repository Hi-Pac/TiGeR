// js/users.js

let allUsersData = [];
let usersEmailMap = new Map(); // Store email addresses separately

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
    const userEmailField = document.getElementById('user-email-field');
    const userPasswordField = document.getElementById('user-password-field');
    const userNameField = document.getElementById('user-name-field');
    const userPhoneField = document.getElementById('user-phone-field');
    const userRoleField = document.getElementById('user-role-field');
    const userStatusField = document.getElementById('user-status-field');
    const saveUserBtn = document.getElementById('save-user-form-btn');

    const emailFieldContainer = document.getElementById('email-field-container');
    const passwordFieldContainer = document.getElementById('password-field-container');

    const userSearchInput = usersModuleNode.querySelector('#user-search-input');
    const userRoleFilter = usersModuleNode.querySelector('#user-role-filter');
    const userStatusFilter = usersModuleNode.querySelector('#user-status-filter');

    function resetUserForm(userData = null) {
        if (!userFormElement) return;
        userFormElement.reset();
        userIdField.value = '';

        if (userData) {
            // Editing existing user
            userIdField.value = userData.id;
            userNameField.value = userData.full_name || '';
            userPhoneField.value = userData.phone || '';
            userRoleField.value = userData.role || '';
            userStatusField.value = userData.status || 'active';

            // Hide email/password fields for editing (can't change auth credentials easily)
            if (emailFieldContainer) emailFieldContainer.classList.add('hidden');
            if (passwordFieldContainer) passwordFieldContainer.classList.add('hidden');
            if (userEmailField) userEmailField.removeAttribute('required');
            if (userPasswordField) userPasswordField.removeAttribute('required');

            // Show email as read-only info
            const userEmail = usersEmailMap.get(userData.id);
            if (userEmail && emailFieldContainer) {
                emailFieldContainer.classList.remove('hidden');
                userEmailField.value = userEmail;
                userEmailField.readOnly = true;
                userEmailField.removeAttribute('required');
                userEmailField.classList.add('bg-gray-100', 'dark:bg-gray-700');
                const helpText = emailFieldContainer.querySelector('p');
                if (helpText) helpText.textContent = 'لا يمكن تغيير البريد الإلكتروني للمستخدم الموجود';
            }
        } else {
            // Adding new user
            if (emailFieldContainer) emailFieldContainer.classList.remove('hidden');
            if (passwordFieldContainer) passwordFieldContainer.classList.remove('hidden');
            if (userEmailField) {
                userEmailField.setAttribute('required', 'required');
                userEmailField.readOnly = false;
                userEmailField.classList.remove('bg-gray-100', 'dark:bg-gray-700');
            }
            if (userPasswordField) userPasswordField.setAttribute('required', 'required');
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

    async function loadAndRenderUsers() {
        if (!usersTableBody || !window.supabaseClient) {
            if (usersTableBody) {
                usersTableBody.innerHTML = `<tr><td colspan="5" class="text-center p-4 text-red-500">خطأ في تهيئة قاعدة البيانات.</td></tr>`;
            }
            return;
        }

        usersTableBody.innerHTML = `<tr><td colspan="5" class="text-center p-4">جاري تحميل المستخدمين... <span class="loader ml-2"></span></td></tr>`;

        try {
            // Get profiles from database
            const { data: profilesData, error: profilesError } = await window.supabaseClient
                .from('profiles')
                .select('id, full_name, phone, role, status')
                .order('full_name', { ascending: true });

            if (profilesError) throw profilesError;

            // Get auth users to map emails (requires admin/service-role key, so this might fail)
            // We'll try to get it but handle failure gracefully
            try {
                const { data: { users }, error: authError } = await window.supabaseClient.auth.admin.listUsers();
                if (!authError && users) {
                    usersEmailMap.clear();
                    users.forEach(user => {
                        if (user.email) {
                            usersEmailMap.set(user.id, user.email);
                        }
                    });
                }
            } catch (e) {
                console.warn('Could not load auth users (admin API not available):', e);
                // This is expected if using anon key - emails won't be shown but functionality still works
            }

            allUsersData = profilesData || [];
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
                const email = (usersEmailMap.get(user.id) || '').toLowerCase();
                return fullName.includes(searchTerm) || phone.includes(searchTerm) || email.includes(searchTerm);
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
            const userEmail = usersEmailMap.get(user.id) || '-';

            row.innerHTML = `
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="flex items-center">
                        <div class="w-10 h-10 bg-gradient-to-br from-purple-500 to-indigo-500 rounded-full flex items-center justify-center text-white shadow-md">
                            <span class="font-semibold">${initials}</span>
                        </div>
                        <div class="mr-4">
                            <div class="text-sm font-medium text-gray-900 dark:text-gray-100">${user.full_name || '-'}</div>
                            <div class="text-xs text-gray-500 dark:text-gray-400">${user.phone || 'لا يوجد رقم'}</div>
                        </div>
                    </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">${userEmail}</td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                        ${roleLabel}
                    </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${user.status === 'active' ? 'bg-green-100 text-green-800 dark:bg-green-700 dark:text-green-100' : 'bg-red-100 text-red-800 dark:bg-red-700 dark:text-red-100'}">
                        ${user.status === 'active' ? 'نشط' : 'غير نشط'}
                    </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button class="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300 ml-3 transition-colors edit-user-btn" data-id="${user.id}" title="تعديل">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 transition-colors deactivate-user-btn" data-id="${user.id}" title="${user.status === 'active' ? 'تعطيل' : 'تفعيل'}">
                        <i class="fas fa-${user.status === 'active' ? 'user-slash' : 'user-check'}"></i>
                    </button>
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
                await handleToggleUserStatus(userId);
            });
        });

        window.applyModuleActionGuards?.('users', usersModuleNode);
    }

    if (userFormElement) {
        userFormElement.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!saveUserBtn || !window.supabaseClient) return;

            window.showButtonSpinner(saveUserBtn, true);

            const userId = userIdField.value.trim();
            const email = userEmailField.value.trim();
            const password = userPasswordField.value.trim();
            const fullName = userNameField.value.trim();
            const phone = userPhoneField.value.trim();
            const role = userRoleField.value;
            const status = userStatusField.value;

            try {
                if (!fullName) throw new Error('الاسم مطلوب.');
                if (!role) throw new Error('الدور مطلوب.');
                if (!status) throw new Error('الحالة مطلوبة.');

                if (userId) {
                    // Update existing user (profile only)
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
                    window.AppNotify?.success('تم تحديث بيانات المستخدم بنجاح.');
                } else {
                    // Create new user
                    if (!email) throw new Error('البريد الإلكتروني مطلوب.');
                    if (!password) throw new Error('كلمة المرور مطلوبة.');
                    if (password.length < 6) throw new Error('كلمة المرور يجب أن تكون 6 أحرف على الأقل.');

                    // Create auth user with signUp
                    // Note: This creates a user but doesn't sign them in, and auto-confirms their email
                    const { data: authData, error: authError } = await window.supabaseClient.auth.signUp({
                        email: email,
                        password: password,
                        options: {
                            data: {
                                full_name: fullName
                            },
                            emailRedirectTo: window.location.origin
                        }
                    });

                    if (authError) throw new Error(`فشل إنشاء حساب المصادقة: ${authError.message}`);
                    if (!authData.user) throw new Error('فشل إنشاء حساب المستخدم.');

                    const newUserId = authData.user.id;

                    // Create profile
                    const companyId = window.AppAuth?.companyId();
                    if (!companyId) throw new Error('تعذر تحديد الشركة الحالية للمستخدم.');

                    const { error: profileError } = await window.supabaseClient
                        .from('profiles')
                        .insert({
                            id: newUserId,
                            company_id: companyId,
                            full_name: fullName,
                            phone: phone || null,
                            role,
                            status,
                        });

                    if (profileError) throw new Error(`فشل إنشاء ملف المستخدم: ${profileError.message}`);

                    // Add to email map
                    usersEmailMap.set(newUserId, email);

                    window.AppNotify?.success('تمت إضافة المستخدم بنجاح. تم إرسال رسالة تأكيد إلى البريد الإلكتروني.');
                }

                const closeBtn = document.getElementById('close-user-form-btn');
                if (closeBtn) closeBtn.click();
                await loadAndRenderUsers();
            } catch (error) {
                console.error('Error saving user:', error);
                window.AppNotify?.error(`فشل حفظ المستخدم: ${error.message || 'خطأ غير متوقع.'}`);
            } finally {
                window.showButtonSpinner(saveUserBtn, false);
            }
        });
    }

    async function handleToggleUserStatus(userId) {
        if (!window.supabaseClient) return;

        const user = allUsersData.find(u => u.id === userId);
        if (!user) return;

        const newStatus = user.status === 'active' ? 'inactive' : 'active';
        const confirmMsg = newStatus === 'inactive'
            ? 'هل تريد تعطيل هذا المستخدم؟'
            : 'هل تريد تفعيل هذا المستخدم؟';

        if (!confirm(confirmMsg)) return;

        try {
            const { error } = await window.supabaseClient
                .from('profiles')
                .update({ status: newStatus, updated_at: new Date().toISOString() })
                .eq('id', userId);

            if (error) throw error;
            await loadAndRenderUsers();
            window.AppNotify?.success(newStatus === 'inactive' ? 'تم تعطيل المستخدم.' : 'تم تفعيل المستخدم.');
        } catch (error) {
            console.error('Error toggling user status:', error);
            window.AppNotify?.error(`فشل تغيير حالة المستخدم: ${error.message || 'خطأ غير متوقع.'}`);
        }
    }

    if (userSearchInput) userSearchInput.addEventListener('input', applyFiltersAndRender);
    if (userRoleFilter) userRoleFilter.addEventListener('change', applyFiltersAndRender);
    if (userStatusFilter) userStatusFilter.addEventListener('change', applyFiltersAndRender);

    await loadAndRenderUsers();
    window.applyModuleActionGuards?.('users', usersModuleNode);
}
