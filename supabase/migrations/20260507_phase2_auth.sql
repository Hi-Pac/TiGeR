-- ============================================================
-- TiGeR ERP — Phase 2: Authentication Foundation
-- Migration: 20260507_phase2_auth.sql
--
-- What this migration does:
--   1. Adds fn_my_status() helper function (for checking active status
--      in RLS policies and application code).
--   2. Adds bootstrap_first_admin_profile() for secure first-login setup.
--   3. Provides a manual SEED TEMPLATE for fallback cases.
--
-- Migration type: ADDITIVE — safe to run on existing database.
-- No tables are dropped or data deleted.
--
-- ⚠️  Copy this file and run it in Supabase SQL Editor before testing
--     Phase 2 authentication features.
-- ============================================================


-- ===========================================================
-- PART 1: fn_my_status() helper function
-- ===========================================================
-- Returns the status ('active' | 'inactive') of the currently
-- authenticated user from the profiles table.
-- SECURITY DEFINER allows it to read profiles even when RLS
-- is active on that table.
-- Used by RLS policies and application code to block inactive users.

CREATE OR REPLACE FUNCTION fn_my_status()
RETURNS TEXT LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
BEGIN
    IF to_regclass('public.profiles') IS NULL THEN
        RETURN NULL;
    END IF;

    RETURN (
        SELECT status
        FROM public.profiles
        WHERE id = auth.uid()
        LIMIT 1
    );
END;
$$;

-- ===========================================================
-- PART 2: bootstrap_first_admin_profile()
-- ===========================================================
-- Purpose: Allow the first authenticated user to bootstrap the
-- first company + first admin profile from the application.
--
-- Safe constraints:
--   - Requires auth.uid()
--   - Runs only before any profile row exists
--   - Reuses the single existing company if one was created
--     manually, otherwise creates the first company automatically
-- ============================================================

CREATE OR REPLACE FUNCTION public.bootstrap_first_admin_profile(
    p_company_name TEXT DEFAULT 'شركة النمر للتجارة والتوزيع',
    p_full_name    TEXT DEFAULT NULL
)
RETURNS TABLE (
    company_id      UUID,
    profile_id      UUID,
    company_created BOOLEAN,
    profile_created BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_user_id          UUID := auth.uid();
    v_company_id       UUID;
    v_company_created  BOOLEAN := FALSE;
    v_profile_count    BIGINT;
    v_company_count    BIGINT;
    v_full_name        TEXT;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication is required to bootstrap the first admin profile.';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM auth.users WHERE id = v_user_id
    ) THEN
        RAISE EXCEPTION 'Authenticated user % was not found in auth.users.', v_user_id;
    END IF;

    IF EXISTS (
        SELECT 1 FROM public.profiles WHERE id = v_user_id
    ) THEN
        RETURN QUERY
        SELECT p.company_id, p.id, FALSE, FALSE
        FROM public.profiles p
        WHERE p.id = v_user_id;
        RETURN;
    END IF;

    SELECT COUNT(*) INTO v_profile_count
    FROM public.profiles;

    IF v_profile_count > 0 THEN
        RAISE EXCEPTION 'Initial admin bootstrap is only available before any profile exists.';
    END IF;

    SELECT COUNT(*) INTO v_company_count
    FROM public.companies;

    IF v_company_count > 1 THEN
        RAISE EXCEPTION 'Cannot bootstrap the first admin automatically because multiple companies already exist.';
    ELSIF v_company_count = 1 THEN
        SELECT c.id INTO v_company_id
        FROM public.companies c
        ORDER BY c.created_at
        LIMIT 1;
    ELSE
        INSERT INTO public.companies (name, currency, status)
        VALUES (
            COALESCE(NULLIF(BTRIM(p_company_name), ''), 'شركة النمر للتجارة والتوزيع'),
            'EGP',
            'active'
        )
        RETURNING id INTO v_company_id;

        v_company_created := TRUE;
    END IF;

    SELECT COALESCE(
        NULLIF(BTRIM(p_full_name), ''),
        NULLIF(BTRIM(COALESCE(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name')), ''),
        NULLIF(BTRIM(u.email), ''),
        'مدير النظام'
    )
    INTO v_full_name
    FROM auth.users u
    WHERE u.id = v_user_id;

    INSERT INTO public.profiles (id, company_id, full_name, role, status)
    VALUES (
        v_user_id,
        v_company_id,
        v_full_name,
        'admin',
        'active'
    );

    RETURN QUERY
    SELECT v_company_id, v_user_id, v_company_created, TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.bootstrap_first_admin_profile(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bootstrap_first_admin_profile(TEXT, TEXT) TO authenticated;

-- ===========================================================
-- PART 3: First-run seed template
-- ===========================================================
-- Purpose: Bootstrap the first company + first admin profile.
--
-- HOW TO USE (safe single script):
--   1) Create the first user from Supabase Authentication → Users
--   2) Copy that user's UUID
--   3) Replace ONLY the variables in the block below
--   4) Run it in Supabase SQL Editor
--
-- This block validates:
--   - Auth user UUID exists in auth.users
--   - Profile does not already exist
-- Then it creates company + profile in one transaction.
-- ============================================================

/*
DO $$
DECLARE
    v_admin_user_id UUID := '00000000-0000-0000-0000-000000000000'; -- Replace with Auth user UUID
    v_company_name  TEXT := 'شركة النمر للتجارة والتوزيع';            -- Replace if needed
    v_admin_name    TEXT := 'المدير العام';                           -- Replace admin display name
    v_company_id    UUID;
BEGIN
    IF v_admin_user_id = '00000000-0000-0000-0000-000000000000'::UUID THEN
        RAISE EXCEPTION 'Replace v_admin_user_id with the real UUID from Supabase Authentication → Users before running this block.';
    END IF;

    -- Validate auth user exists first
    IF NOT EXISTS (
        SELECT 1 FROM auth.users WHERE id = v_admin_user_id
    ) THEN
        RAISE EXCEPTION 'Auth user % was not found in auth.users. Create it first via Supabase Dashboard → Authentication → Users.', v_admin_user_id;
    END IF;

    -- Prevent duplicate profile for the same auth user
    IF EXISTS (
        SELECT 1 FROM public.profiles WHERE id = v_admin_user_id
    ) THEN
        RAISE EXCEPTION 'Profile for auth user % already exists in public.profiles.', v_admin_user_id;
    END IF;

    -- Reuse company if same name already exists, else create one
    SELECT c.id INTO v_company_id
    FROM public.companies c
    WHERE c.name = v_company_name
    LIMIT 1;

    IF v_company_id IS NULL THEN
        INSERT INTO public.companies (name, currency, status)
        VALUES (v_company_name, 'EGP', 'active')
        RETURNING id INTO v_company_id;
    END IF;

    INSERT INTO public.profiles (id, company_id, full_name, role, status)
    VALUES (
        v_admin_user_id,
        v_company_id,
        v_admin_name,
        'admin',
        'active'
    );
END $$;
*/

-- ===========================================================
-- VERIFICATION QUERIES (run after seeding to confirm setup)
-- NOTE: These queries require that the base schema (supabase/schema.sql)
--       has already been applied to the database. The helper functions
--       fn_my_company_id(), fn_my_role(), and fn_my_status() are defined
--       in the base schema and in Part 1 of this migration respectively.
-- ===========================================================
-- SELECT id, name, currency, status FROM public.companies;
-- SELECT id, full_name, role, status, company_id FROM public.profiles;
-- SELECT fn_my_company_id();   -- run as the admin user to verify
-- SELECT fn_my_role();         -- should return 'admin'
-- SELECT fn_my_status();       -- should return 'active'
-- SELECT * FROM public.bootstrap_first_admin_profile();
