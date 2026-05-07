-- ============================================================
-- TiGeR ERP — Phase 2: Authentication Foundation
-- Migration: 20260507_phase2_auth.sql
--
-- What this migration does:
--   1. Adds fn_my_status() helper function (for checking active status
--      in RLS policies and application code).
--   2. Provides a SEED TEMPLATE for the first company + admin user.
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
-- PART 2: First-run seed template
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
    -- Validate auth user exists first
    IF NOT EXISTS (
        SELECT 1 FROM auth.users au WHERE au.id = v_admin_user_id
    ) THEN
        RAISE EXCEPTION 'Auth user % was not found in auth.users. Create it first via Supabase Dashboard → Authentication → Users.', v_admin_user_id;
    END IF;

    -- Prevent duplicate profile for the same auth user
    IF EXISTS (
        SELECT 1 FROM public.profiles p WHERE p.id = v_admin_user_id
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
