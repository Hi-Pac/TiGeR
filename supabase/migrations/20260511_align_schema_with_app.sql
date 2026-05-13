-- ============================================================
-- TiGeR ERP - Schema Alignment with Application
-- Date: 2026-05-11
-- Purpose: Add missing columns that the application expects
-- ============================================================

-- Add missing columns to warehouses table
-- The app (js/settings.js) expects 'code' and 'location' fields
ALTER TABLE public.warehouses
    ADD COLUMN IF NOT EXISTS code TEXT,
    ADD COLUMN IF NOT EXISTS location TEXT;

-- Add unique constraint for warehouse code per company
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'warehouses_company_code_unique'
    ) THEN
        ALTER TABLE public.warehouses
            ADD CONSTRAINT warehouses_company_code_unique
            UNIQUE (company_id, code);
    END IF;
END $$;

-- Create index on warehouse code for faster lookups
CREATE INDEX IF NOT EXISTS idx_warehouses_code
    ON public.warehouses(company_id, code)
    WHERE code IS NOT NULL;

COMMENT ON COLUMN public.warehouses.code IS 'Unique warehouse code for identification (e.g., WH01, MAIN, BRANCH1)';
COMMENT ON COLUMN public.warehouses.location IS 'Physical location description of the warehouse';


-- Add missing column to branches table
-- The app (js/settings.js) expects 'code' field
ALTER TABLE public.branches
    ADD COLUMN IF NOT EXISTS code TEXT;

-- Add unique constraint for branch code per company
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'branches_company_code_unique'
    ) THEN
        ALTER TABLE public.branches
            ADD CONSTRAINT branches_company_code_unique
            UNIQUE (company_id, code);
    END IF;
END $$;

-- Create index on branch code for faster lookups
CREATE INDEX IF NOT EXISTS idx_branches_code
    ON public.branches(company_id, code)
    WHERE code IS NOT NULL;

COMMENT ON COLUMN public.branches.code IS 'Unique branch code for identification (e.g., BR01, MAIN, ALEX)';


-- Add email column to profiles table (derived from auth.users)
-- The profile page (js/profile.js) expects to display email
-- Note: This is redundant data but improves query performance
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS email TEXT;

COMMENT ON COLUMN public.profiles.email IS 'User email (cached from auth.users for performance)';

-- Create function to sync email from auth.users to profiles
CREATE OR REPLACE FUNCTION fn_sync_profile_email()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    -- When a profile is created, copy email from auth.users
    IF TG_OP = 'INSERT' THEN
        NEW.email := (
            SELECT email
            FROM auth.users
            WHERE id = NEW.id
        );
    END IF;
    RETURN NEW;
END;
$$;

-- Create trigger to auto-populate email when profile is created
DROP TRIGGER IF EXISTS trg_profiles_sync_email ON public.profiles;
CREATE TRIGGER trg_profiles_sync_email
    BEFORE INSERT ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION fn_sync_profile_email();

-- Update existing profiles to sync email from auth.users
UPDATE public.profiles p
SET email = (SELECT email FROM auth.users u WHERE u.id = p.id)
WHERE email IS NULL;


-- Add status column to product_units (app may expect it)
ALTER TABLE public.product_units
    ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active'
    CHECK (status IN ('active', 'inactive'));

COMMENT ON COLUMN public.product_units.status IS 'Unit status: active or inactive';


-- Add last_login column to profiles for tracking
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS last_login TIMESTAMPTZ;

COMMENT ON COLUMN public.profiles.last_login IS 'Timestamp of last successful login';


-- ============================================================
-- Verification Queries
-- Run these to verify the changes
-- ============================================================

-- Verify warehouses columns
DO $$
DECLARE
    v_has_code     BOOLEAN;
    v_has_location BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'warehouses'
          AND column_name = 'code'
    ) INTO v_has_code;

    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'warehouses'
          AND column_name = 'location'
    ) INTO v_has_location;

    IF v_has_code AND v_has_location THEN
        RAISE NOTICE '✅ warehouses table: code and location columns added successfully';
    ELSE
        RAISE WARNING '❌ warehouses table: missing columns - code: %, location: %', v_has_code, v_has_location;
    END IF;
END $$;

-- Verify branches columns
DO $$
DECLARE
    v_has_code BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'branches'
          AND column_name = 'code'
    ) INTO v_has_code;

    IF v_has_code THEN
        RAISE NOTICE '✅ branches table: code column added successfully';
    ELSE
        RAISE WARNING '❌ branches table: missing code column';
    END IF;
END $$;

-- Verify profiles columns
DO $$
DECLARE
    v_has_email      BOOLEAN;
    v_has_last_login BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'profiles'
          AND column_name = 'email'
    ) INTO v_has_email;

    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'profiles'
          AND column_name = 'last_login'
    ) INTO v_has_last_login;

    IF v_has_email AND v_has_last_login THEN
        RAISE NOTICE '✅ profiles table: email and last_login columns added successfully';
    ELSE
        RAISE WARNING '❌ profiles table: missing columns - email: %, last_login: %', v_has_email, v_has_last_login;
    END IF;
END $$;

-- ============================================================
-- Summary of Changes
-- ============================================================
-- 1. Added 'code' and 'location' columns to warehouses table
-- 2. Added 'code' column to branches table
-- 3. Added 'email' column to profiles table (synced from auth.users)
-- 4. Added 'status' column to product_units table
-- 5. Added 'last_login' column to profiles table
-- 6. Created unique constraints for warehouse and branch codes
-- 7. Created indexes for better query performance
-- 8. Created trigger to auto-sync email from auth.users
-- ============================================================
