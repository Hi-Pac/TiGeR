// js/users.js

let allUsersData = []; // This will now be primarily populated from Firebase

async function initUsersModule() { // Make it async
    console.log("Users Module Initialized (Firebase Mode)!");

    const usersModuleNode = document.getElementById('users-module');
    if (!usersModuleNode) {
        console.error("Users module container not found in DOM after load.");
        return;
    }

    const usersTableBody = usersModuleNode.querySelector('#users-table-body');
    const userFormElement = usersModuleNode.querySelector('#user-form');
    const userIdField = usersModuleNode.querySelector('#user-id-field');
    const userNameField = usersModuleNode.querySelector('#user-name-field');
    const userPhoneField = usersModuleNode.querySelector('#user-phone-field');
    const userEmailField = usersModuleNode.querySelector('#user-email-field');
    const userPasswordField = usersModuleNode.querySelector('#user-password-field');
    const userRoleField = usersModuleNode.querySelector('#user-role-field');
    const userStatusField = usersModuleNode.querySelector('#user-status-field');
    const saveUserBtn = usersModuleNode.querySelector('#save-user-form-btn');

    const userSearchInput = usersModuleNode.querySelector('#user-search-input');
    const userRoleFilter = usersModuleNode.querySelector('#user-role-filter');
    const userStatusFilter = usersModuleNode.querySelector('#user-status-filter');

    function resetUserForm(userData = null) {
        if (!userFormElement) return;
        userFormElement.reset();
        userIdField.value = '';
        userPasswordField.placeholder = "اتركه فارغاً لعدم التغيير";
        userPasswordField.required = false; // Default to not required for edit

        if (userData) {
            userIdField.value = userData.id; // Firestore document ID
            userNameField.value = userData.name || '';
            userPhoneField.value = userData.phone || '';
            userEmailField.value = userData.email || '';
            userRoleField.value = userData.role || '';
            userStatusField.value = userData.status || 'active';
        } else {
            userPasswordField.placeholder = "مطلوبة للمستخدم الجديد (6 أحرف على الأقل)";
            userPasswordField.required = true;
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
        onOpen: (editData) => {
            if (!editData) {
                userPasswordField.required = true;
            } else {
                userPasswordField.required = false;
            }
        }
    });

    async function loadAndRenderUsers() {
        console.log("loadAndRenderUsers called");
        if (!usersTableBody || !window.db) {
            console.error("❌ Users table body or Firestore (db) not found!");
            console.error("usersTableBody:", usersTableBody);
            console.error("window.db:", window.db);
            if (usersTableBody) usersTableBody.innerHTML = `<tr><td colspan="5" class="text-center p-4 text-red-500">خطأ في تهيئة قاعدة البيانات.</td></tr>`;
            return;
        }
        usersTableBody.innerHTML = `<tr><td colspan="5" class="text-center p-4">جاري تحميل المستخدمين... <span class="loader ml-2"></span></td></tr>`;
        try {
            console.log("📥 Fetching users from Firestore...");
            const usersSnapshot = await db.collection('users').get();
            allUsersData = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            allUsersData.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
            console.log("✅ Users loaded from Firebase:", allUsersData.length, "users");
            applyFiltersAndRender();
        } catch (error) {
            console.error("❌ Error loading users from Firebase:", error);
            usersTableBody.innerHTML = `<tr><td colspan="5" class="text-center p-4 text-red-500">فشل تحميل المستخدمين: ${error.message}</td></tr>`;
        }
    }

    function applyFiltersAndRender() {
        // ... (كود الفلترة يبقى كما هو) ...
        // This function should be the same as before, operating on allUsersData
        if (!usersTableBody) return;
        let filteredUsers = [...allUsersData];

        const searchTerm = userSearchInput.value.toLowerCase();
        const roleFilter = userRoleFilter.value;
        const statusFilter = userStatusFilter.value;

        if (searchTerm) {
            filteredUsers = filteredUsers.filter(user =>
                user.name.toLowerCase().includes(searchTerm) ||
                user.email.toLowerCase().includes(searchTerm) ||
                (user.phone && user.phone.includes(searchTerm))
            );
        }
        if (roleFilter) {
            filteredUsers = filteredUsers.filter(user => user.role === roleFilter);
        }
        if (statusFilter) {
            filteredUsers = filteredUsers.filter(user => user.status === statusFilter);
        }
        renderUsersTable(filteredUsers);
    }

    function renderUsersTable(usersToRender) {
        // ... (كود عرض الجدول يبقى كما هو، لكن الآن سيعرض بيانات Firebase) ...
        // Ensure allUsersData is accessible for edit buttons to find the full user object
        // (The event listener for edit buttons already uses allUsersData)
        if (!usersTableBody) return;
        usersTableBody.innerHTML = ''; 

        if (usersToRender.length === 0) {
            usersTableBody.innerHTML = `<tr><td colspan="5" class="text-center p-4">لا يوجد مستخدمون يطابقون معايير البحث.</td></tr>`;
            return;
        }

        usersToRender.forEach(user => {
            const row = usersTableBody.insertRow();
            row.innerHTML = `
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="flex items-center">
                        <div class="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center text-primary dark:bg-primary/30 dark:text-gray-200">
                            <span>${user.name ? user.name.substring(0, 2).toUpperCase() : 'N/A'}</span>
                        </div>
                        <div class="mr-4">
                            <div class="text-sm font-medium text-gray-900 dark:text-gray-100">${user.name}</div>
                            <div class="text-sm text-gray-500 dark:text-gray-400">${user.phone || 'لا يوجد رقم'}</div>
                        </div>
                    </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">${user.email}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">${user.role}</td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full 
                        ${user.status === 'active' ? 'bg-green-100 text-green-800 dark:bg-green-700 dark:text-green-100' : 'bg-red-100 text-red-800 dark:bg-red-700 dark:text-red-100'}">
                        ${user.status === 'active' ? 'نشط' : 'غير نشط'}
                    </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button class="text-primary hover:text-primary/80 ml-2 edit-user-btn" data-id="${user.id}" title="تعديل"><i class="fas fa-edit"></i></button>
                    <button class="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 delete-user-btn" data-id="${user.id}" title="حذف"><i class="fas fa-trash-alt"></i></button>
                </td>
            `;
        });
        
        usersModuleNode.querySelectorAll('.edit-user-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const userId = e.currentTarget.getAttribute('data-id');
                const userToEdit = allUsersData.find(u => u.id === userId); // Find from the fetched data
                if (userToEdit) {
                    openUserFormForEdit(userToEdit);
                } else {
                    console.error("User not found for editing:", userId);
                    // Optionally, fetch the user again if not found in the local cache
                    // db.collection('users').doc(userId).get().then(doc => openUserFormForEdit({id: doc.id, ...doc.data()}));
                }
            });
        });

        usersModuleNode.querySelectorAll('.delete-user-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const userId = e.currentTarget.getAttribute('data-id');
                handleDeleteUser(userId);
            });
        });
    }
    
    if (userFormElement) {
        userFormElement.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!saveUserBtn || !window.db) return;
            window.showButtonSpinner(saveUserBtn, true);

            const userData = {
                name: userNameField.value,
                phone: userPhoneField.value,
                email: userEmailField.value,
                role: userRoleField.value,
                status: userStatusField.value,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            const password = userPasswordField.value;
            const userId = userIdField.value;

            try {
                if (userId) {
                    await db.collection('users').doc(userId).update(userData);
                    console.log('User updated successfully');
                } else {
                    if (!password || password.length < 6) {
                       throw new Error("كلمة المرور مطلوبة للمستخدم الجديد (6 أحرف على الأقل).");
                    }
                    userData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
                    const docRef = await db.collection('users').add(userData);
                    console.log("New user added with ID:", docRef.id);
                }
                const closeBtn = usersModuleNode.querySelector('#close-user-form-btn');
                if (closeBtn) closeBtn.click();
                await loadAndRenderUsers();
            } catch (error) {
                console.error("Error saving user to Firebase:", error);
                alert(`فشل حفظ المستخدم: ${error.message}`);
            } finally {
                window.showButtonSpinner(saveUserBtn, false);
            }
        });
    }

    async function handleDeleteUser(userId) {
        if (!window.db) return;
        if (confirm('هل أنت متأكد أنك تريد حذف هذا المستخدم؟')) {
            try {
                await db.collection('users').doc(userId).delete();
                console.log('User deleted successfully');
                await loadAndRenderUsers();
            } catch (error) {
                console.error("Error deleting user from Firebase:", error);
                alert('فشل حذف المستخدم.');
            }
        }
    }
    
    if (userSearchInput) userSearchInput.addEventListener('input', applyFiltersAndRender);
    if (userRoleFilter) userRoleFilter.addEventListener('change', applyFiltersAndRender);
    if (userStatusFilter) userStatusFilter.addEventListener('change', applyFiltersAndRender);

    await loadAndRenderUsers();
    console.log("✅ Users module initialized successfully");
}
