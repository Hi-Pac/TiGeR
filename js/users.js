// This file will contain the JavaScript logic specific to the Users module.

let allUsersData = []; // To store fetched users for client-side filtering

function initUsersModule() {
    console.log("Users Module Initialized!");

    // DOM elements specific to users module (scoped to the loaded content)
    const usersModuleNode = document.getElementById('users-module');
    if (!usersModuleNode) {
        console.error("Users module container not found in DOM after load.");
        return;
    }

    const usersTableBody = usersModuleNode.querySelector('#users-table-body');
    const userFormElement = usersModuleNode.querySelector('#user-form'); // Corrected to userFormElement
    const userIdField = usersModuleNode.querySelector('#user-id-field');
    const userNameField = usersModuleNode.querySelector('#user-name-field');
    const userPhoneField = usersModuleNode.querySelector('#user-phone-field');
    const userEmailField = usersModuleNode.querySelector('#user-email-field');
    const userPasswordField = usersModuleNode.querySelector('#user-password-field');
    const userRoleField = usersModuleNode.querySelector('#user-role-field');
    const userStatusField = usersModuleNode.querySelector('#user-status-field');
    const saveUserBtn = usersModuleNode.querySelector('#save-user-form-btn');

    // Filter inputs
    const userSearchInput = usersModuleNode.querySelector('#user-search-input');
    const userRoleFilter = usersModuleNode.querySelector('#user-role-filter');
    const userStatusFilter = usersModuleNode.querySelector('#user-status-filter');


    function resetUserForm(userData = null) {
        if (!userFormElement) return;
        userFormElement.reset();
        userIdField.value = '';
        userPasswordField.placeholder = "اتركه فارغاً لعدم التغيير"; // Reset placeholder for edit

        if (userData) {
            userIdField.value = userData.id;
            userNameField.value = userData.name || '';
            userPhoneField.value = userData.phone || '';
            userEmailField.value = userData.email || '';
            // Password field is intentionally not pre-filled for security/UX reasons on edit
            userPasswordField.value = ''; // Clear it
            userPasswordField.required = false; // Not required for edit unless changing
            userRoleField.value = userData.role || '';
            userStatusField.value = userData.status || 'active';
        } else {
            // For new user, password is required
            userPasswordField.placeholder = "مطلوبة للمستخدم الجديد";
            userPasswordField.required = true;
        }
    }

    // Setup form toggle (using the global function from main.js)
    const openUserFormForEdit = window.setupFormToggle({
        currentModule: 'users', // Pass current module name
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
            // When opening for a new user, ensure password is required
             if (!editData) {
                userPasswordField.required = true;
             }
        }
    });

    async function loadAndRenderUsers() {
        if (!usersTableBody) {
            console.error("Users table body not found!");
            return;
        }
        usersTableBody.innerHTML = `<tr><td colspan="5" class="text-center p-4">جاري تحميل المستخدمين...</td></tr>`;
        try {
            // --- FIREBASE: Replace with actual data fetching ---
            // const usersSnapshot = await db.collection('users').get();
            // allUsersData = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            
            // Simulating Firebase call
            await new Promise(resolve => setTimeout(resolve, 600));
            allUsersData = [
                { id: 'user1', name: 'أحمد محمد علي', email: 'ahmed.ali@example.com', role: 'admin', status: 'active', phone: '01012345678' },
                { id: 'user2', name: 'فاطمة السيد', email: 'fatma.sayed@example.com', role: 'sales', status: 'active', phone: '01198765432' },
                { id: 'user3', name: 'خالد محمود', email: 'khaled.m@example.com', role: 'warehouse', status: 'inactive', phone: '01234567890' },
                { id: 'user4', name: 'منى إبراهيم', email: 'mona.ibrahim@example.com', role: 'accountant', status: 'active', phone: '01567890123' },
            ];
            applyFiltersAndRender(); // Initial render with all data
        } catch (error) {
            console.error("Error loading users:", error);
            usersTableBody.innerHTML = `<tr><td colspan="5" class="text-center p-4 text-red-500">فشل تحميل المستخدمين.</td></tr>`;
        }
    }

    function applyFiltersAndRender() {
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
        if (!usersTableBody) return;
        usersTableBody.innerHTML = ''; // Clear existing rows

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

        // Re-attach event listeners for edit/delete buttons in the current module context
        usersModuleNode.querySelectorAll('.edit-user-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const userId = e.currentTarget.getAttribute('data-id');
                // Find user from allUsersData (or fetch if not available)
                const userToEdit = allUsersData.find(u => u.id === userId);
                if (userToEdit) {
                    openUserFormForEdit(userToEdit);
                } else {
                    console.error("User not found for editing:", userId);
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
            if (!saveUserBtn) return;
            window.showButtonSpinner(saveUserBtn, true); // Use global spinner function

            const userData = {
                name: userNameField.value,
                phone: userPhoneField.value,
                email: userEmailField.value,
                role: userRoleField.value,
                status: userStatusField.value,
            };
            const password = userPasswordField.value;
            const userId = userIdField.value; // This is window.currentEditId or from hidden field

            try {
                if (userId) { // Editing existing user
                    if (password && password.length > 0) {
                         if(password.length < 6) throw new Error("كلمة المرور يجب أن تكون 6 أحرف على الأقل.");
                        // TODO FIREBASE: Handle password update securely (e.g., re-authenticate and updatePassword via Firebase Auth)
                        // For now, we'll just log it for simulation
                        console.log("Password change requested for user:", userId);
                        userData.newPassword = password; // Placeholder
                    }
                    // --- FIREBASE: Update user document (excluding password if not changed) ---
                    // await db.collection('users').doc(userId).update(userData);
                    console.log("Updating user:", userId, userData);
                    alert('تم تحديث المستخدم بنجاح (محاكاة)');
                } else { // Adding new user
                    if (!password || password.length < 6) {
                       throw new Error("كلمة المرور مطلوبة للمستخدم الجديد (6 أحرف على الأقل).");
                    }
                    // --- FIREBASE: Create new user (Auth + Firestore) ---
                    // const userCredential = await auth.createUserWithEmailAndPassword(userData.email, password);
                    // await db.collection('users').doc(userCredential.user.uid).set(userData);
                    userData.password = password; // For simulation
                    console.log("Adding new user:", userData);
                    alert('تم إضافة المستخدم بنجاح (محاكاة)');
                }
                usersModuleNode.querySelector('#close-user-form-btn').click(); // Close form
                await loadAndRenderUsers(); // Reload users table
            } catch (error) {
                console.error("Error saving user:", error);
                alert(`فشل حفظ المستخدم: ${error.message}`);
            } finally {
                window.showButtonSpinner(saveUserBtn, false);
            }
        });
    }

    async function handleDeleteUser(userId) {
        if (confirm('هل أنت متأكد أنك تريد حذف هذا المستخدم؟ لا يمكن التراجع عن هذا الإجراء.')) {
            try {
                // --- FIREBASE: Delete user from Firestore (and potentially Auth) ---
                // await db.collection('users').doc(userId).delete();
                // Consider also deleting from Firebase Auth (more complex, might need a Cloud Function for security)
                console.log("Deleting user:", userId);
                alert('تم حذف المستخدم بنجاح (محاكاة)');
                await loadAndRenderUsers(); // Reload users table
            } catch (error) {
                console.error("Error deleting user:", error);
                alert('فشل حذف المستخدم.');
            }
        }
    }
    
    // Add event listeners for filters
    if (userSearchInput) userSearchInput.addEventListener('input', applyFiltersAndRender);
    if (userRoleFilter) userRoleFilter.addEventListener('change', applyFiltersAndRender);
    if (userStatusFilter) userStatusFilter.addEventListener('change', applyFiltersAndRender);


    // Initial load of users when the module is initialized
    loadAndRenderUsers();
}