-- ============================================================
-- TiGeR ERP - Complete Database Schema Validation
-- Date: 2026-05-11
-- Purpose: Validate that all tables, columns, constraints,
--          indexes, and RLS policies are correctly configured
-- ============================================================

-- ============================================================
-- PART 1: Core Tables Validation
-- ============================================================

DO $$
DECLARE
    v_table_count INTEGER;
    v_missing_tables TEXT[];
    v_required_tables TEXT[] := ARRAY[
        'companies',
        'branches',
        'profiles',
        'product_categories',
        'product_units',
        'products',
        'customers',
        'suppliers',
        'supplier_categories',
        'warehouses',
        'inventory_stock',
        'stock_movements',
        'sales_invoices',
        'sales_invoice_items',
        'purchase_invoices',
        'purchase_invoice_items',
        'payments',
        'bank_accounts',
        'bank_transactions',
        'expenses',
        'chart_of_accounts',
        'journal_entries',
        'journal_entry_lines',
        'app_settings',
        'audit_logs'
    ];
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '=== CHECKING CORE TABLES ===';

    SELECT COUNT(*)
    INTO v_table_count
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      AND table_name = ANY(v_required_tables);

    SELECT ARRAY_AGG(t)
    INTO v_missing_tables
    FROM UNNEST(v_required_tables) AS t
    WHERE NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = t
    );

    RAISE NOTICE 'Found % out of % required tables', v_table_count, array_length(v_required_tables, 1);

    IF v_missing_tables IS NOT NULL THEN
        RAISE WARNING '❌ Missing tables: %', v_missing_tables;
    ELSE
        RAISE NOTICE '✅ All required tables exist';
    END IF;
END $$;


-- ============================================================
-- PART 2: Row Level Security Validation
-- ============================================================

DO $$
DECLARE
    v_tables_without_rls TEXT[];
    v_required_tables TEXT[] := ARRAY[
        'companies',
        'branches',
        'profiles',
        'product_categories',
        'product_units',
        'products',
        'customers',
        'suppliers',
        'warehouses',
        'inventory_stock',
        'stock_movements',
        'sales_invoices',
        'sales_invoice_items',
        'purchase_invoices',
        'purchase_invoice_items',
        'payments',
        'bank_accounts',
        'bank_transactions',
        'expenses',
        'chart_of_accounts',
        'journal_entries',
        'journal_entry_lines',
        'app_settings',
        'audit_logs'
    ];
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '=== CHECKING ROW LEVEL SECURITY ===';

    SELECT ARRAY_AGG(t)
    INTO v_tables_without_rls
    FROM UNNEST(v_required_tables) AS t
    WHERE NOT EXISTS (
        SELECT 1
        FROM pg_tables
        WHERE schemaname = 'public'
          AND tablename = t
          AND rowsecurity = true
    );

    IF v_tables_without_rls IS NOT NULL THEN
        RAISE WARNING '❌ Tables without RLS enabled: %', v_tables_without_rls;
    ELSE
        RAISE NOTICE '✅ All required tables have RLS enabled';
    END IF;
END $$;


-- ============================================================
-- PART 3: Essential Functions Validation
-- ============================================================

DO $$
DECLARE
    v_function_count INTEGER;
    v_missing_functions TEXT[];
    v_required_functions TEXT[] := ARRAY[
        'fn_set_updated_at',
        'fn_my_company_id',
        'fn_my_role',
        'fn_my_branch_id',
        'fn_audit_log',
        'fn_is_admin',
        'bootstrap_first_admin_profile'
    ];
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '=== CHECKING ESSENTIAL FUNCTIONS ===';

    SELECT COUNT(DISTINCT p.proname)
    INTO v_function_count
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.proname = ANY(v_required_functions);

    SELECT ARRAY_AGG(f)
    INTO v_missing_functions
    FROM UNNEST(v_required_functions) AS f
    WHERE NOT EXISTS (
        SELECT 1
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
          AND p.proname = f
    );

    RAISE NOTICE 'Found % out of % required functions', v_function_count, array_length(v_required_functions, 1);

    IF v_missing_functions IS NOT NULL THEN
        RAISE WARNING '❌ Missing functions: %', v_missing_functions;
    ELSE
        RAISE NOTICE '✅ All required functions exist';
    END IF;
END $$;


-- ============================================================
-- PART 4: Specific Column Validation
-- ============================================================

DO $$
DECLARE
    v_missing_columns TEXT[] := '{}';
    v_column_exists BOOLEAN;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '=== CHECKING CRITICAL COLUMNS ===';

    -- Check warehouses.code
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'warehouses' AND column_name = 'code'
    ) INTO v_column_exists;
    IF NOT v_column_exists THEN
        v_missing_columns := array_append(v_missing_columns, 'warehouses.code');
    END IF;

    -- Check warehouses.location
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'warehouses' AND column_name = 'location'
    ) INTO v_column_exists;
    IF NOT v_column_exists THEN
        v_missing_columns := array_append(v_missing_columns, 'warehouses.location');
    END IF;

    -- Check branches.code
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'branches' AND column_name = 'code'
    ) INTO v_column_exists;
    IF NOT v_column_exists THEN
        v_missing_columns := array_append(v_missing_columns, 'branches.code');
    END IF;

    -- Check profiles.email
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'email'
    ) INTO v_column_exists;
    IF NOT v_column_exists THEN
        v_missing_columns := array_append(v_missing_columns, 'profiles.email');
    END IF;

    -- Check profiles.last_login
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'last_login'
    ) INTO v_column_exists;
    IF NOT v_column_exists THEN
        v_missing_columns := array_append(v_missing_columns, 'profiles.last_login');
    END IF;

    -- Check product_units.status
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'product_units' AND column_name = 'status'
    ) INTO v_column_exists;
    IF NOT v_column_exists THEN
        v_missing_columns := array_append(v_missing_columns, 'product_units.status');
    END IF;

    IF array_length(v_missing_columns, 1) > 0 AND v_missing_columns != ARRAY['']::TEXT[] THEN
        RAISE WARNING '❌ Missing columns: %', v_missing_columns;
    ELSE
        RAISE NOTICE '✅ All critical columns exist';
    END IF;
END $$;


-- ============================================================
-- PART 5: Foreign Key Constraints Validation
-- ============================================================

DO $$
DECLARE
    v_fk_count INTEGER;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '=== CHECKING FOREIGN KEY CONSTRAINTS ===';

    SELECT COUNT(*)
    INTO v_fk_count
    FROM information_schema.table_constraints
    WHERE constraint_schema = 'public'
      AND constraint_type = 'FOREIGN KEY';

    RAISE NOTICE 'Found % foreign key constraints', v_fk_count;

    IF v_fk_count < 30 THEN
        RAISE WARNING '❌ Expected at least 30 foreign keys, found only %', v_fk_count;
    ELSE
        RAISE NOTICE '✅ Foreign key constraints appear sufficient';
    END IF;
END $$;


-- ============================================================
-- PART 6: Index Validation
-- ============================================================

DO $$
DECLARE
    v_index_count INTEGER;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '=== CHECKING INDEXES ===';

    SELECT COUNT(*)
    INTO v_index_count
    FROM pg_indexes
    WHERE schemaname = 'public';

    RAISE NOTICE 'Found % indexes on public schema tables', v_index_count;

    IF v_index_count < 40 THEN
        RAISE WARNING '❌ Expected at least 40 indexes, found only %', v_index_count;
    ELSE
        RAISE NOTICE '✅ Index coverage appears adequate';
    END IF;
END $$;


-- ============================================================
-- PART 7: Trigger Validation
-- ============================================================

DO $$
DECLARE
    v_trigger_count INTEGER;
    v_tables_without_updated_at TEXT[];
    v_required_tables TEXT[] := ARRAY[
        'companies',
        'branches',
        'profiles',
        'product_categories',
        'product_units',
        'products',
        'customers',
        'suppliers',
        'warehouses',
        'sales_invoices',
        'purchase_invoices',
        'payments',
        'bank_accounts',
        'expenses'
    ];
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '=== CHECKING TRIGGERS ===';

    SELECT COUNT(*)
    INTO v_trigger_count
    FROM pg_trigger t
    JOIN pg_class c ON t.tgrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE n.nspname = 'public'
      AND NOT t.tgisinternal;

    RAISE NOTICE 'Found % triggers', v_trigger_count;

    -- Check for updated_at triggers
    SELECT ARRAY_AGG(t)
    INTO v_tables_without_updated_at
    FROM UNNEST(v_required_tables) AS t
    WHERE NOT EXISTS (
        SELECT 1
        FROM pg_trigger tr
        JOIN pg_class c ON tr.tgrelid = c.oid
        JOIN pg_namespace n ON c.relnamespace = n.oid
        WHERE n.nspname = 'public'
          AND c.relname = t
          AND tr.tgname LIKE '%updated_at%'
    );

    IF v_tables_without_updated_at IS NOT NULL THEN
        RAISE WARNING '❌ Tables without updated_at trigger: %', v_tables_without_updated_at;
    ELSE
        RAISE NOTICE '✅ All tables have updated_at triggers';
    END IF;
END $$;


-- ============================================================
-- PART 8: Views Validation
-- ============================================================

DO $$
DECLARE
    v_view_count INTEGER;
    v_missing_views TEXT[];
    v_required_views TEXT[] := ARRAY[
        'v_inventory_summary',
        'v_customer_balances',
        'v_supplier_balances',
        'v_outstanding_sales',
        'v_outstanding_purchases'
    ];
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '=== CHECKING VIEWS ===';

    SELECT COUNT(*)
    INTO v_view_count
    FROM information_schema.views
    WHERE table_schema = 'public'
      AND table_name = ANY(v_required_views);

    SELECT ARRAY_AGG(v)
    INTO v_missing_views
    FROM UNNEST(v_required_views) AS v
    WHERE NOT EXISTS (
        SELECT 1 FROM information_schema.views
        WHERE table_schema = 'public' AND table_name = v
    );

    RAISE NOTICE 'Found % out of % required views', v_view_count, array_length(v_required_views, 1);

    IF v_missing_views IS NOT NULL THEN
        RAISE WARNING '❌ Missing views: %', v_missing_views;
    ELSE
        RAISE NOTICE '✅ All required views exist';
    END IF;
END $$;


-- ============================================================
-- PART 9: Extensions Validation
-- ============================================================

DO $$
DECLARE
    v_missing_extensions TEXT[];
    v_required_extensions TEXT[] := ARRAY['uuid-ossp', 'pgcrypto'];
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '=== CHECKING EXTENSIONS ===';

    SELECT ARRAY_AGG(e)
    INTO v_missing_extensions
    FROM UNNEST(v_required_extensions) AS e
    WHERE NOT EXISTS (
        SELECT 1 FROM pg_extension WHERE extname = e
    );

    IF v_missing_extensions IS NOT NULL THEN
        RAISE WARNING '❌ Missing extensions: %', v_missing_extensions;
    ELSE
        RAISE NOTICE '✅ All required extensions are installed';
    END IF;
END $$;


-- ============================================================
-- PART 10: Data Integrity Checks
-- ============================================================

DO $$
DECLARE
    v_orphaned_profiles INTEGER;
    v_orphaned_products INTEGER;
    v_orphaned_invoices INTEGER;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '=== CHECKING DATA INTEGRITY ===';

    -- Check for orphaned profiles (profiles without auth.users)
    SELECT COUNT(*)
    INTO v_orphaned_profiles
    FROM public.profiles p
    WHERE NOT EXISTS (
        SELECT 1 FROM auth.users u WHERE u.id = p.id
    );

    IF v_orphaned_profiles > 0 THEN
        RAISE WARNING '❌ Found % orphaned profile(s) without auth.users', v_orphaned_profiles;
    ELSE
        RAISE NOTICE '✅ No orphaned profiles found';
    END IF;

    -- Check for products without companies
    SELECT COUNT(*)
    INTO v_orphaned_products
    FROM public.products p
    WHERE NOT EXISTS (
        SELECT 1 FROM public.companies c WHERE c.id = p.company_id
    );

    IF v_orphaned_products > 0 THEN
        RAISE WARNING '❌ Found % orphaned product(s) without companies', v_orphaned_products;
    ELSE
        RAISE NOTICE '✅ No orphaned products found';
    END IF;

    -- Check for sales invoices without customers
    SELECT COUNT(*)
    INTO v_orphaned_invoices
    FROM public.sales_invoices si
    WHERE NOT EXISTS (
        SELECT 1 FROM public.customers c WHERE c.id = si.customer_id
    );

    IF v_orphaned_invoices > 0 THEN
        RAISE WARNING '❌ Found % orphaned sales invoice(s) without customers', v_orphaned_invoices;
    ELSE
        RAISE NOTICE '✅ No orphaned sales invoices found';
    END IF;
END $$;


-- ============================================================
-- SUMMARY
-- ============================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '=======================================================';
    RAISE NOTICE 'VALIDATION COMPLETE';
    RAISE NOTICE '=======================================================';
    RAISE NOTICE 'Review the warnings above to identify any issues.';
    RAISE NOTICE 'If you see ❌, run the alignment script first:';
    RAISE NOTICE '  supabase/migrations/20260511_align_schema_with_app.sql';
    RAISE NOTICE '';
END $$;
