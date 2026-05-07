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
-- Purpose: Bootstrap the very first company + admin user so the
--          application has a valid company_id when the first admin
--          logs in for the first time.
--
-- HOW TO USE:
--   1. Go to Supabase Dashboard → Authentication → Users
--   2. Click "Add User" and create the first admin user with email
--      and a strong password. Note the new user's UUID.
--   3. In the SQL below:
--        a. Replace 'شركة النمر للتجارة والتوزيع' with your company name
--           (or leave it as-is for the demo company).
--        b. Replace '<ADMIN_USER_UUID>' with the UUID from step 2.
--        c. Replace 'المدير العام' with the admin's full name.
--   4. Run the modified SQL in Supabase SQL Editor.
--
-- NOTE: This seed is only needed ONCE. After the first admin profile
--       exists, new users can be created through the Users module.
--
-- ⚠️  DO NOT run this block if the company or profile already exists —
--     the INSERT will fail with a unique-key violation.
-- ============================================================

-- --- UNCOMMENT AND EDIT the block below, then run it in Supabase SQL Editor ---

/*

-- Step 1: Insert the company (or use an existing company_id).
INSERT INTO public.companies (name, currency, status)
VALUES ('شركة النمر للتجارة والتوزيع', 'EGP', 'active')
RETURNING id;
-- ☝️ Copy the returned UUID — it is your company_id for the next INSERT.


-- Step 2: Insert the first admin profile.
-- Replace the UUIDs below with the actual values from your setup.
INSERT INTO public.profiles (id, company_id, full_name, role, status)
VALUES (
    '<ADMIN_USER_UUID>',       -- UUID from Supabase Auth → Users
    '<COMPANY_UUID>',          -- UUID returned from Step 1 above
    'المدير العام',             -- Admin's display name
    'admin',
    'active'
);

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
