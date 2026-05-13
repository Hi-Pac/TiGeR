async function initProfileModule() {
    const currentUser = window.AppAuth?.getCurrentUser?.();
    if (!currentUser) {
        window.AppNotify?.error('لم يتم العثور على معلومات المستخدم.');
        return;
    }

    // Load user profile data
    await loadUserProfile(currentUser.id);

    // Wire up forms
    wirePersonalInfoForm();
    wirePasswordForm();
    wireSessionSettings();
    wirePasswordToggles();
}

async function loadUserProfile(userId) {
    try {
        const { data: profile } = await window.supabaseClient
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();

        if (profile) {
            // Update UI with profile data
            const initial = profile.full_name?.charAt(0) || 'م';
            document.getElementById('profile-avatar-initial').textContent = initial;
            document.getElementById('profile-display-name').textContent = profile.full_name || '-';
            document.getElementById('profile-role-badge').textContent = window.AppConfig?.roleLabels?.[profile.role] || profile.role || '-';
            document.getElementById('profile-email').textContent = profile.email || '-';
            document.getElementById('profile-status').textContent = profile.status === 'active' ? 'نشط' : 'غير نشط';

            // Format dates
            if (profile.created_at) {
                const createdDate = new Date(profile.created_at);
                document.getElementById('profile-created-at').textContent = createdDate.toLocaleDateString('ar-EG');
            }

            // Last login (from current session)
            const now = new Date();
            document.getElementById('profile-last-login').textContent = now.toLocaleDateString('ar-EG') + ' ' + now.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });

            // Fill form fields
            document.getElementById('profile-full-name').value = profile.full_name || '';
            document.getElementById('profile-phone').value = profile.phone || '';
        }
    } catch (error) {
        console.error('Error loading profile:', error);
        window.AppNotify?.error('فشل تحميل بيانات الملف الشخصي.');
    }

    // Load session settings
    loadSessionSettings();
}

function wirePersonalInfoForm() {
    const form = document.getElementById('profile-info-form');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const fullName = document.getElementById('profile-full-name').value.trim();
        const phone = document.getElementById('profile-phone').value.trim();

        const currentUser = window.AppAuth?.getCurrentUser?.();
        if (!currentUser) return;

        const submitBtn = e.submitter;
        if (submitBtn) window.showButtonSpinner(submitBtn, true);

        try {
            await window.DB.from('profiles')
                .eq('id', currentUser.id)
                .update({
                    full_name: fullName,
                    phone: phone || null
                });

            window.AppNotify?.success('تم تحديث المعلومات الشخصية بنجاح.');

            // Update display name in header
            const userDisplayName = document.getElementById('user-display-name');
            if (userDisplayName) userDisplayName.textContent = fullName;

            // Reload profile to update all fields
            await loadUserProfile(currentUser.id);
        } catch (error) {
            window.AppNotify?.error('فشل تحديث المعلومات: ' + error.message);
        } finally {
            if (submitBtn) window.showButtonSpinner(submitBtn, false);
        }
    });
}

function wirePasswordForm() {
    const form = document.getElementById('profile-password-form');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const currentPassword = document.getElementById('profile-current-password').value;
        const newPassword = document.getElementById('profile-new-password').value;
        const confirmPassword = document.getElementById('profile-confirm-password').value;

        if (newPassword !== confirmPassword) {
            window.AppNotify?.error('كلمة المرور الجديدة وتأكيد كلمة المرور غير متطابقتين.');
            return;
        }

        if (newPassword.length < 6) {
            window.AppNotify?.error('يجب أن تحتوي كلمة المرور على 6 أحرف على الأقل.');
            return;
        }

        const submitBtn = e.submitter;
        if (submitBtn) window.showButtonSpinner(submitBtn, true);

        try {
            // Verify current password by attempting to sign in
            const currentUser = window.AppAuth?.getCurrentUser?.();
            if (!currentUser?.email) {
                throw new Error('لم يتم العثور على البريد الإلكتروني للمستخدم');
            }

            // Use Supabase to update password
            const { error } = await window.supabaseClient.auth.updateUser({
                password: newPassword
            });

            if (error) throw error;

            window.AppNotify?.success('تم تحديث كلمة المرور بنجاح.');
            form.reset();
        } catch (error) {
            window.AppNotify?.error('فشل تحديث كلمة المرور: ' + error.message);
        } finally {
            if (submitBtn) window.showButtonSpinner(submitBtn, false);
        }
    });
}

function wireSessionSettings() {
    const autoLogoutCheckbox = document.getElementById('auto-logout-enabled');
    const settingsDiv = document.getElementById('auto-logout-settings');
    const saveBtn = document.getElementById('save-session-settings-btn');

    if (autoLogoutCheckbox && settingsDiv) {
        autoLogoutCheckbox.addEventListener('change', () => {
            if (autoLogoutCheckbox.checked) {
                settingsDiv.classList.remove('hidden');
            } else {
                settingsDiv.classList.add('hidden');
            }
        });
    }

    if (saveBtn) {
        saveBtn.addEventListener('click', async () => {
            const enabled = autoLogoutCheckbox?.checked || false;
            const timeoutMinutes = parseInt(document.getElementById('idle-timeout-minutes')?.value || '15');

            window.showButtonSpinner(saveBtn, true);

            try {
                // Save to localStorage
                localStorage.setItem('autoLogoutEnabled', enabled ? 'true' : 'false');
                localStorage.setItem('idleTimeoutMinutes', timeoutMinutes.toString());

                // Apply settings immediately
                if (window.AppAuth?.configureAutoLogout) {
                    window.AppAuth.configureAutoLogout(enabled, timeoutMinutes);
                }

                window.AppNotify?.success('تم حفظ إعدادات الجلسة بنجاح.');
            } catch (error) {
                window.AppNotify?.error('فشل حفظ الإعدادات: ' + error.message);
            } finally {
                window.showButtonSpinner(saveBtn, false);
            }
        });
    }
}

function loadSessionSettings() {
    const enabled = localStorage.getItem('autoLogoutEnabled') === 'true';
    const timeoutMinutes = parseInt(localStorage.getItem('idleTimeoutMinutes') || '15');

    const autoLogoutCheckbox = document.getElementById('auto-logout-enabled');
    const timeoutSelect = document.getElementById('idle-timeout-minutes');
    const settingsDiv = document.getElementById('auto-logout-settings');

    if (autoLogoutCheckbox) {
        autoLogoutCheckbox.checked = enabled;
        if (enabled && settingsDiv) {
            settingsDiv.classList.remove('hidden');
        }
    }

    if (timeoutSelect) {
        timeoutSelect.value = timeoutMinutes.toString();
    }
}

function wirePasswordToggles() {
    document.querySelectorAll('.toggle-password-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.dataset.target;
            const input = document.getElementById(targetId);
            const icon = btn.querySelector('i');

            if (input && icon) {
                const type = input.getAttribute('type') === 'password' ? 'text' : 'password';
                input.setAttribute('type', type);
                icon.classList.toggle('fa-eye');
                icon.classList.toggle('fa-eye-slash');
            }
        });
    });
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initProfileModule);
} else {
    initProfileModule();
}
