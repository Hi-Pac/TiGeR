/**
 * js/auth.js — Phase 2: Authentication & Session Bootstrap
 *
 * Exposes window.AppAuth — the global auth context used across all modules.
 *
 * API:
 *   AppAuth.currentUser     → Supabase auth user object (or null)
 *   AppAuth.profile         → profiles table row (or null)
 *   AppAuth.isAuthenticated()    → bool
 *   AppAuth.isActive()           → profile.status === 'active'
 *   AppAuth.role()               → profile.role string or null
 *   AppAuth.isAdmin()            → role === 'admin'
 *   AppAuth.hasRole(...roles)    → role is in the provided list
 *   AppAuth.companyId()          → profile.company_id or null
 *   AppAuth.branchId()           → profile.branch_id or null (null = all branches)
 *   AppAuth.login(email, password) → Promise<{ error: string|null }>
 *   AppAuth.logout()             → Promise<void>
 *
 * Events dispatched on window:
 *   CustomEvent('auth:ready',    { detail: { authenticated: bool } })
 *   CustomEvent('auth:signedIn', { detail: { user, profile } })
 *   CustomEvent('auth:signedOut')
 *
 * Depends on:
 *   window.supabaseClient  (set by js/supabase-client.js, loaded first)
 *   #login-overlay         (HTML in index.html)
 *   #app                   (main app container in index.html)
 */

(function () {
    'use strict';

    // ── Arabic role labels for UI display ──────────────────────────────────
    const ROLE_LABELS = {
        admin:      'مدير النظام',
        accountant: 'محاسب',
        sales:      'مبيعات',
        warehouse:  'مستودع',
        viewer:     'مشاهد',
    };
    const MISSING_PROFILE_ERROR = 'هذا الحساب لا يملك ملف مستخدم. إذا كانت هذه أول مرة لتشغيل النظام فتأكد من تشغيل ملفات SQL الجديدة، وإذا استمرت المشكلة اطلب من مدير النظام إضافتك.';

    // ── Internal state ─────────────────────────────────────────────────────
    let _user    = null;  // Supabase auth.users row
    let _profile = null;  // public.profiles row

    // ── DOM helpers ────────────────────────────────────────────────────────
    function _showApp() {
        const app     = document.getElementById('app');
        const overlay = document.getElementById('login-overlay');
        if (app)     app.classList.remove('hidden');
        if (overlay) overlay.classList.add('hidden');
    }

    function _showLogin(errorMsg) {
        const app     = document.getElementById('app');
        const overlay = document.getElementById('login-overlay');
        if (app)     app.classList.add('hidden');
        if (overlay) overlay.classList.remove('hidden');
        const errEl = document.getElementById('login-error');
        const errTextEl = document.getElementById('login-error-text');
        if (errEl && errTextEl) {
            errTextEl.textContent = errorMsg || '';
            errEl.classList.toggle('hidden', !errorMsg);
        } else if (errEl) {
            // Fallback for old structure
            errEl.textContent = errorMsg || '';
            errEl.classList.toggle('hidden', !errorMsg);
        }
    }

    function _resetLoginForm() {
        const form = document.getElementById('login-form');
        if (form) form.reset();
        const errEl = document.getElementById('login-error');
        if (errEl) errEl.classList.add('hidden');
    }

    // ── Profile loading ────────────────────────────────────────────────────
    async function _loadProfile(userId) {
        try {
            const { data, error } = await window.supabaseClient
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .maybeSingle();
            if (error) {
                console.error('[Auth] Profile fetch error:', error.message);
                return null;
            }
            return data;
        } catch (err) {
            console.error('[Auth] Profile fetch exception:', err);
            return null;
        }
    }

    function _getBootstrapDisplayName(user) {
        const metadataName = user?.user_metadata?.full_name || user?.user_metadata?.name;
        if (metadataName && metadataName.trim()) return metadataName.trim();
        const email = typeof user?.email === 'string' ? user.email.trim() : '';
        if (email) {
            const localPart = email.split('@')[0].trim();
            if (localPart) return localPart;
        }
        return 'مدير النظام';
    }

    function _translateBootstrapError(err) {
        const code = (err?.code || '').trim();
        const raw = (err?.message || err || '').trim();
        const m = raw.toLowerCase();
        if (!m) return MISSING_PROFILE_ERROR;
        // PGRST202 = PostgREST could not find the requested RPC function.
        if (code === 'PGRST202') {
            return 'قاعدة البيانات لم تُحدَّث بعد. شغّل supabase/schema.sql ثم supabase/migrations/20260507_phase2_auth.sql ثم أعد تسجيل الدخول.';
        }
        if (raw === 'BOOTSTRAP_ALREADY_INITIALIZED') {
            return 'تم تهيئة النظام بالفعل، لكن هذا الحساب ليس مضافاً كمستخدم داخل النظام. اطلب من مدير النظام إضافتك من شاشة إدارة المستخدمين باستخدام Auth UID.';
        }
        if (raw === 'BOOTSTRAP_MULTIPLE_COMPANIES') {
            return 'يوجد أكثر من شركة بدون ملفات مستخدم، لذلك يلزم إكمال الربط الأول يدوياً من ملف SQL الخاص بالإعداد.';
        }
        if (raw === 'BOOTSTRAP_AUTH_REQUIRED') {
            return 'انتهت الجلسة قبل إكمال التهيئة. حاول تسجيل الدخول مرة أخرى.';
        }
        if (raw === 'BOOTSTRAP_AUTH_USER_NOT_FOUND') {
            return 'الحساب الحالي غير موجود داخل Supabase Authentication. تحقق من المستخدم ثم أعد المحاولة.';
        }
        return MISSING_PROFILE_ERROR;
    }

    async function _loadOrBootstrapProfile(user) {
        let profile = await _loadProfile(user.id);
        if (profile) return { profile, error: null };

        try {
            const { error } = await window.supabaseClient.rpc('bootstrap_first_admin_profile', {
                p_full_name: _getBootstrapDisplayName(user),
            });

            if (error) {
                console.warn('[Auth] First-admin bootstrap skipped:', error.message);
                return { profile: null, error: _translateBootstrapError(error) };
            }

            profile = await _loadProfile(user.id);
            if (profile) {
                console.info('[Auth] First admin profile bootstrapped successfully.');
            }
            return { profile, error: profile ? null : MISSING_PROFILE_ERROR };
        } catch (err) {
            console.warn('[Auth] First-admin bootstrap failed:', err);
            return { profile: null, error: _translateBootstrapError(err) };
        }
    }

    // ── Event helpers ──────────────────────────────────────────────────────
    function _fireReady(authenticated) {
        window.dispatchEvent(new CustomEvent('auth:ready', { detail: { authenticated } }));
    }

    function _fireSignedIn() {
        window.dispatchEvent(new CustomEvent('auth:signedIn', {
            detail: { user: _user, profile: _profile },
        }));
    }

    function _fireSignedOut() {
        window.dispatchEvent(new CustomEvent('auth:signedOut'));
    }

    // ── Public API ─────────────────────────────────────────────────────────
    window.AppAuth = {
        /** Supabase auth user object, or null if not signed in */
        get currentUser() { return _user; },

        /** public.profiles row for the current user, or null */
        get profile() { return _profile; },

        /** True if there is a live session */
        isAuthenticated() {
            return !!_user;
        },

        /** True if the profile status is 'active' */
        isActive() {
            return _profile?.status === 'active';
        },

        /** The user's role string, or null */
        role() {
            return _profile?.role || null;
        },

        /** Arabic label for the user's role */
        roleLabel() {
            return ROLE_LABELS[_profile?.role] || _profile?.role || '';
        },

        /** True if role === 'admin' */
        isAdmin() {
            return _profile?.role === 'admin';
        },

        /**
         * True if the user's role matches any of the provided role strings.
         * @param {...string} roles
         */
        hasRole(...roles) {
            return !!_profile && roles.includes(_profile.role);
        },

        /** The user's company_id, or null */
        companyId() {
            return _profile?.company_id || null;
        },

        /**
         * The user's branch_id, or null.
         * null means the user has access to all branches of their company.
         */
        branchId() {
            return _profile?.branch_id || null;
        },

        /**
         * Sign in with email and password.
         * On success: shows the app and dispatches auth:signedIn.
         * On failure: returns a localised error string.
         *
         * @param {string} email
         * @param {string} password
         * @returns {Promise<{ error: string|null }>}
         */
        async login(email, password) {
            const { data, error } = await window.supabaseClient.auth
                .signInWithPassword({ email: email.trim(), password });

            if (error) {
                // Map common Supabase errors to Arabic messages
                const msg = _translateAuthError(error.message);
                return { error: msg };
            }

            _user = data.user;

            const profileResult = await _loadOrBootstrapProfile(_user);
            _profile = profileResult.profile;

            if (!_profile) {
                await window.supabaseClient.auth.signOut();
                _user = null;
                return { error: profileResult.error || MISSING_PROFILE_ERROR };
            }

            if (_profile.status !== 'active') {
                await window.supabaseClient.auth.signOut();
                _user    = null;
                _profile = null;
                return { error: 'حسابك غير نشط. يرجى التواصل مع مسؤول النظام.' };
            }

            _showApp();
            _resetLoginForm();
            _fireSignedIn();
            return { error: null };
        },

        /** Sign out the current user and show the login screen */
        async logout() {
            await window.supabaseClient.auth.signOut();
            _user    = null;
            _profile = null;
            _showLogin();
            _fireSignedOut();
        },
    };

    // ── Auth state change listener ─────────────────────────────────────────
    // Handles token refresh, session expiry, and external sign-out.
    // Registered immediately (supabase-client.js is already evaluated at this point).
    if (window.supabaseClient) {
        window.supabaseClient.auth.onAuthStateChange(async (event, session) => {
            if (event === 'SIGNED_OUT') {
                _user    = null;
                _profile = null;
                _showLogin();
                _fireSignedOut();
            } else if (event === 'TOKEN_REFRESHED' && session?.user) {
                _user = session.user;
                // Re-fetch the profile on every token refresh so that server-side
                // changes (role update, status set to inactive) take effect within
                // one token lifetime (~1 hour) rather than requiring a manual re-login.
                //
                // Performance note: Supabase tokens refresh roughly once per hour.
                // For an ERP with tens of concurrent users this is one lightweight
                // SELECT per user per hour — acceptable overhead for the security
                // benefit of detecting profile deactivation without a forced logout.
                const refreshedProfile = await _loadProfile(_user.id);
                if (!refreshedProfile || refreshedProfile.status !== 'active') {
                    // Profile gone or deactivated — force sign-out.
                    await window.supabaseClient.auth.signOut();
                } else {
                    _profile = refreshedProfile;
                }
            }
        });
    }

    // ── Session bootstrap ──────────────────────────────────────────────────
    // Runs on DOMContentLoaded (after login-form HTML exists in the DOM).
    document.addEventListener('DOMContentLoaded', () => {
        _wireDarkModeForLoginOverlay();
        _wireLoginForm();
        _wireUserMenu();
        _bootstrapSession();
    });

    async function _bootstrapSession() {
        if (!window.supabaseClient) {
            console.error('[Auth] window.supabaseClient not found. Ensure js/supabase-client.js loads before js/auth.js.');
            _showLogin('خطأ في تهيئة النظام. يرجى إعادة تحميل الصفحة.');
            _fireReady(false);
            return;
        }

        try {
            const { data: { session } } = await window.supabaseClient.auth.getSession();

            if (session?.user) {
                _user = session.user;

                const profileResult = await _loadOrBootstrapProfile(_user);
                _profile = profileResult.profile;

                if (_profile && _profile.status === 'active') {
                    _showApp();
                    _fireReady(true);
                    return;
                }

                // Profile missing or inactive — sign out silently
                await window.supabaseClient.auth.signOut();
                _user    = null;
                _profile = null;

                const reason = !_profile
                    ? (profileResult.error || MISSING_PROFILE_ERROR)
                    : 'حسابك غير نشط. يرجى التواصل مع مسؤول النظام.';

                _showLogin(reason);
                _fireReady(false);
                return;
            }
        } catch (err) {
            console.error('[Auth] Bootstrap error:', err);
        }

        _showLogin();
        _fireReady(false);
    }

    // ── Login form wiring ──────────────────────────────────────────────────
    function _wireLoginForm() {
        const loginForm  = document.getElementById('login-form');
        const loginBtn   = document.getElementById('login-btn');
        const loginError = document.getElementById('login-error');
        const togglePasswordBtn = document.getElementById('toggle-password-btn');
        const passwordInput = document.getElementById('login-password');
        const togglePasswordIcon = document.getElementById('toggle-password-icon');

        if (!loginForm) return;

        // Password visibility toggle
        if (togglePasswordBtn && passwordInput && togglePasswordIcon) {
            togglePasswordBtn.addEventListener('click', () => {
                const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
                passwordInput.setAttribute('type', type);
                togglePasswordIcon.classList.toggle('fa-eye');
                togglePasswordIcon.classList.toggle('fa-eye-slash');
            });
        }

        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const email    = document.getElementById('login-email')?.value  || '';
            const password = document.getElementById('login-password')?.value || '';

            if (!email || !password) {
                const errEl = document.getElementById('login-error');
                const errTextEl = document.getElementById('login-error-text');
                if (errEl && errTextEl) {
                    errTextEl.textContent = 'يرجى إدخال البريد الإلكتروني وكلمة المرور.';
                    errEl.classList.remove('hidden');
                } else if (errEl) {
                    errEl.textContent = 'يرجى إدخال البريد الإلكتروني وكلمة المرور.';
                    errEl.classList.remove('hidden');
                }
                return;
            }

            if (loginBtn) {
                loginBtn.disabled = true;
                const btnContent = document.getElementById('login-btn-content');
                if (btnContent) {
                    btnContent.innerHTML = '<span class="inline-block animate-spin rounded-full h-5 w-5 border-b-2 border-white ml-2"></span> جاري تسجيل الدخول...';
                }
            }
            if (loginError) loginError.classList.add('hidden');

            const { error } = await window.AppAuth.login(email, password);

            if (error) {
                const errEl = document.getElementById('login-error');
                const errTextEl = document.getElementById('login-error-text');
                if (errEl && errTextEl) {
                    errTextEl.textContent = error;
                    errEl.classList.remove('hidden');
                } else if (errEl) {
                    errEl.textContent = error;
                    errEl.classList.remove('hidden');
                }
                if (loginBtn) {
                    loginBtn.disabled = false;
                    const btnContent = document.getElementById('login-btn-content');
                    if (btnContent) {
                        btnContent.innerHTML = '<i class="fas fa-sign-in-alt ml-2"></i>تسجيل الدخول';
                    }
                }
            } else {
                // Success - show loading state for app initialization
                if (loginBtn) {
                    const btnContent = document.getElementById('login-btn-content');
                    if (btnContent) {
                        btnContent.innerHTML = '<span class="inline-block animate-spin rounded-full h-5 w-5 border-b-2 border-white ml-2"></span> جاري تحميل النظام...';
                    }
                }
            }
            // On success: AppAuth.login() calls _showApp() and fires auth:signedIn.
            // main.js listens for auth:signedIn to load the dashboard and update the header.
        });
    }

    // ── User menu wiring (dropdown + logout) ───────────────────────────────
    function _wireUserMenu() {
        const menuBtn      = document.getElementById('user-menu-button');
        const menuDropdown = document.getElementById('user-menu-dropdown');
        const logoutBtn    = document.getElementById('logout-btn');
        const profileBtn   = menuDropdown?.querySelector('[data-module="profile"]');

        if (menuBtn && menuDropdown) {
            menuBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                menuDropdown.classList.toggle('hidden');
            });

            // Close dropdown when clicking outside
            document.addEventListener('click', () => {
                menuDropdown.classList.add('hidden');
            });

            // Close dropdown when profile button is clicked
            if (profileBtn) {
                profileBtn.addEventListener('click', () => {
                    menuDropdown.classList.add('hidden');
                });
            }
        }

        if (logoutBtn) {
            logoutBtn.addEventListener('click', async () => {
                if (menuDropdown) menuDropdown.classList.add('hidden');
                await window.AppAuth.logout();
            });
        }

        // Keep dropdown user info in sync whenever the user signs in
        window.addEventListener('auth:signedIn', _updateUserMenuInfo);
        window.addEventListener('auth:ready',    (e) => {
            if (e.detail.authenticated) _updateUserMenuInfo();
        });
    }

    function _updateUserMenuInfo() {
        const p = _profile;
        if (!p) return;
        const nameEl = document.getElementById('user-menu-name');
        const roleEl = document.getElementById('user-menu-role');
        if (nameEl) nameEl.textContent = p.full_name || '';
        if (roleEl) roleEl.textContent = window.AppAuth.roleLabel();
    }

    // ── Dark-mode: apply current theme to the login overlay immediately ────
    // (main.js applies dark mode, but it runs after auth.js; the overlay needs
    // the theme class on <html> right away so Tailwind dark: variants work.)
    function _wireDarkModeForLoginOverlay() {
        const stored = localStorage.getItem('theme');
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const theme = stored || (prefersDark ? 'dark' : 'light');
        if (theme === 'dark') {
            document.documentElement.classList.add('dark');
        }
    }

    // ── Error message translation ──────────────────────────────────────────
    function _translateAuthError(msg) {
        if (!msg) return 'حدث خطأ غير متوقع.';
        const m = msg.toLowerCase();
        if (m.includes('invalid login credentials') || m.includes('invalid_credentials')) {
            return 'البريد الإلكتروني أو كلمة المرور غير صحيحة.';
        }
        if (m.includes('email not confirmed')) {
            return 'لم يتم تأكيد البريد الإلكتروني بعد.';
        }
        if (m.includes('too many requests')) {
            return 'محاولات كثيرة. يرجى الانتظار قليلاً ثم المحاولة مجدداً.';
        }
        if (m.includes('network') || m.includes('fetch')) {
            return 'خطأ في الاتصال بالشبكة. يرجى التحقق من الاتصال والمحاولة مجدداً.';
        }
        return 'فشل تسجيل الدخول. يرجى المحاولة مجدداً.';
    }

    // ── Auto-logout functionality ─────────────────────────────────────────
    let _idleTimer = null;
    let _idleTimeoutMs = 15 * 60 * 1000; // 15 minutes default
    let _autoLogoutEnabled = false;

    function _resetIdleTimer() {
        if (!_autoLogoutEnabled || !window.AppAuth.isAuthenticated()) return;

        if (_idleTimer) {
            clearTimeout(_idleTimer);
        }

        _idleTimer = setTimeout(() => {
            console.log('Auto-logout: User idle for', _idleTimeoutMs / 60000, 'minutes');
            _performAutoLogout();
        }, _idleTimeoutMs);
    }

    async function _performAutoLogout() {
        if (!window.AppAuth.isAuthenticated()) return;

        try {
            // Show notification before logout
            if (window.AppNotify) {
                window.AppNotify.warning('تم تسجيل الخروج تلقائياً بسبب عدم النشاط.');
            }

            // Perform logout
            await window.AppAuth.logout();
        } catch (error) {
            console.error('Auto-logout error:', error);
        }
    }

    function _setupIdleDetection() {
        // Track user activity
        const activityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];

        activityEvents.forEach(eventName => {
            document.addEventListener(eventName, _resetIdleTimer, true);
        });

        // Start timer initially
        _resetIdleTimer();
    }

    function _configureAutoLogout(enabled, timeoutMinutes) {
        _autoLogoutEnabled = enabled;
        _idleTimeoutMs = timeoutMinutes * 60 * 1000;

        // Clear existing timer
        if (_idleTimer) {
            clearTimeout(_idleTimer);
            _idleTimer = null;
        }

        // Start new timer if enabled
        if (enabled && window.AppAuth.isAuthenticated()) {
            _resetIdleTimer();
        }

        console.log('Auto-logout configured:', enabled ? `Enabled (${timeoutMinutes} min)` : 'Disabled');
    }

    // Load settings from localStorage on init
    function _loadAutoLogoutSettings() {
        const enabled = localStorage.getItem('autoLogoutEnabled') === 'true';
        const timeoutMinutes = parseInt(localStorage.getItem('idleTimeoutMinutes') || '15');
        _configureAutoLogout(enabled, timeoutMinutes);
    }

    // ── Public API extension ───────────────────────────────────────────────
    window.AppAuth = {
        ...window.AppAuth,
        configureAutoLogout: _configureAutoLogout,
        getCurrentUser: () => ({ ..._user, ...(_profile || {}) })
    };

    // Setup idle detection when authenticated
    window.addEventListener('auth:signedIn', () => {
        _loadAutoLogoutSettings();
        _setupIdleDetection();
    });

    window.addEventListener('auth:signedOut', () => {
        if (_idleTimer) {
            clearTimeout(_idleTimer);
            _idleTimer = null;
        }
    });

})();
