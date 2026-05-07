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
        if (errEl) {
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

            _user    = data.user;
            _profile = await _loadProfile(_user.id);

            if (!_profile) {
                await window.supabaseClient.auth.signOut();
                _user = null;
                return { error: 'لم يتم العثور على ملف تعريف المستخدم. يرجى التواصل مع مسؤول النظام.' };
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
                // Keep _user in sync; profile stays cached (role changes are rare,
                // and admins would trigger a logout/re-login when they change roles).
                _user = session.user;
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
                _user    = session.user;
                _profile = await _loadProfile(_user.id);

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
                    ? 'لم يتم العثور على ملف تعريف المستخدم. يرجى التواصل مع مسؤول النظام.'
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

        if (!loginForm) return;

        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const email    = document.getElementById('login-email')?.value  || '';
            const password = document.getElementById('login-password')?.value || '';

            if (!email || !password) {
                if (loginError) {
                    loginError.textContent = 'يرجى إدخال البريد الإلكتروني وكلمة المرور.';
                    loginError.classList.remove('hidden');
                }
                return;
            }

            if (loginBtn) {
                loginBtn.disabled = true;
                loginBtn.innerHTML = '<span class="btn-spinner"></span> جاري تسجيل الدخول...';
            }
            if (loginError) loginError.classList.add('hidden');

            const { error } = await window.AppAuth.login(email, password);

            if (error) {
                if (loginError) {
                    loginError.textContent = error;
                    loginError.classList.remove('hidden');
                }
                if (loginBtn) {
                    loginBtn.disabled = false;
                    loginBtn.textContent = 'تسجيل الدخول';
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

        if (menuBtn && menuDropdown) {
            menuBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                menuDropdown.classList.toggle('hidden');
            });

            // Close dropdown when clicking outside
            document.addEventListener('click', () => {
                menuDropdown.classList.add('hidden');
            });
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

})();
