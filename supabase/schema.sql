-- ============================================================
-- TiGeR ERP — El-Nemr Trading & Distribution
-- PostgreSQL / Supabase Schema
-- Version: 1.0.0
-- Generated: 2026-05-07
--
-- Business type: Snack, candy, marshmallow, biscuits, wafers,
--                sweets, and packaged food distribution.
--
-- ⚠️  IMPORTANT: Copy this entire file and run it in
--     Supabase SQL Editor (NOT in psql directly) so that
--     auth.users, Supabase RLS hooks, and the service role
--     are all available.
--
-- This is a FRESH SETUP script — it drops and recreates
-- everything. Do NOT run it on a database that has data.
-- ============================================================


-- ===========================================================
-- SECTION 0: Extensions
-- ===========================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- ===========================================================
-- SECTION 1: Helper Functions (timestamps, auth, role checks)
-- ===========================================================

-- Auto-update updated_at on every row change
CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- Returns the company_id of the currently authenticated user
-- (stored in the profiles table, linked to auth.users)
-- SECURITY DEFINER so it can read profiles even when RLS is active
CREATE OR REPLACE FUNCTION fn_my_company_id()
RETURNS UUID LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
BEGIN
    IF to_regclass('public.profiles') IS NULL THEN
        RETURN NULL;
    END IF;

    RETURN (
        SELECT company_id
        FROM public.profiles
        WHERE id = auth.uid()
        LIMIT 1
    );
END;
$$;

-- Returns the role of the currently authenticated user
CREATE OR REPLACE FUNCTION fn_my_role()
RETURNS TEXT LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
BEGIN
    IF to_regclass('public.profiles') IS NULL THEN
        RETURN NULL;
    END IF;

    RETURN (
        SELECT role
        FROM public.profiles
        WHERE id = auth.uid()
        LIMIT 1
    );
END;
$$;

-- Returns the branch_id of the currently authenticated user
-- (NULL means the user has access to all branches of their company)
CREATE OR REPLACE FUNCTION fn_my_branch_id()
RETURNS UUID LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
BEGIN
    IF to_regclass('public.profiles') IS NULL THEN
        RETURN NULL;
    END IF;

    RETURN (
        SELECT branch_id
        FROM public.profiles
        WHERE id = auth.uid()
        LIMIT 1
    );
END;
$$;

-- Writes one row to audit_logs (called from module-level triggers)
CREATE OR REPLACE FUNCTION fn_audit_log()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_action TEXT;
    v_old    JSONB;
    v_new    JSONB;
BEGIN
    IF    TG_OP = 'INSERT' THEN v_action := 'INSERT'; v_old := NULL;          v_new := to_jsonb(NEW);
    ELSIF TG_OP = 'UPDATE' THEN v_action := 'UPDATE'; v_old := to_jsonb(OLD); v_new := to_jsonb(NEW);
    ELSIF TG_OP = 'DELETE' THEN v_action := 'DELETE'; v_old := to_jsonb(OLD); v_new := NULL;
    END IF;

    INSERT INTO public.audit_logs (
        table_name, record_id, action, old_data, new_data,
        performed_by, company_id
    ) VALUES (
        TG_TABLE_NAME,
        COALESCE(
            (to_jsonb(NEW) ->> 'id')::UUID,
            (to_jsonb(OLD) ->> 'id')::UUID
        ),
        v_action,
        v_old,
        v_new,
        auth.uid(),
        fn_my_company_id()
    );

    RETURN COALESCE(NEW, OLD);
END;
$$;

-- Macro to attach the updated_at trigger to any table
-- Usage: SELECT attach_updated_at_trigger('table_name');
CREATE OR REPLACE FUNCTION attach_updated_at_trigger(p_table TEXT)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
    EXECUTE format(
        'CREATE TRIGGER trg_%s_updated_at
         BEFORE UPDATE ON public.%I
         FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at()',
        p_table, p_table
    );
END;
$$;


-- ===========================================================
-- SECTION 2: Core Domain Tables
-- ===========================================================

-- -----------------------------------------------------------
-- 2.1  companies
-- Top-level tenant. Everything belongs to a company.
-- -----------------------------------------------------------
CREATE TABLE public.companies (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name          TEXT        NOT NULL,
    legal_name    TEXT,
    cr_number     TEXT,                          -- Commercial Registration number
    tax_number    TEXT,
    phone         TEXT,
    email         TEXT,
    website       TEXT,
    address       TEXT,
    logo_url      TEXT,
    currency      CHAR(3)     NOT NULL DEFAULT 'EGP',
    status        TEXT        NOT NULL DEFAULT 'active'
                              CHECK (status IN ('active', 'suspended', 'inactive')),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

SELECT attach_updated_at_trigger('companies');

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;


-- -----------------------------------------------------------
-- 2.2  branches
-- A company may have multiple branches / warehouses locations.
-- -----------------------------------------------------------
CREATE TABLE public.branches (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id    UUID        NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    name          TEXT        NOT NULL,
    address       TEXT,
    phone         TEXT,
    manager_name  TEXT,
    status        TEXT        NOT NULL DEFAULT 'active'
                              CHECK (status IN ('active', 'inactive')),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (company_id, name)
);

SELECT attach_updated_at_trigger('branches');
CREATE INDEX idx_branches_company ON public.branches(company_id);

ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;


-- -----------------------------------------------------------
-- 2.3  profiles
-- One profile per auth.users row.
-- Extends Supabase Auth with ERP-specific fields.
-- -----------------------------------------------------------
CREATE TABLE public.profiles (
    id            UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    company_id    UUID        NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    branch_id     UUID        REFERENCES public.branches(id) ON DELETE SET NULL,
    full_name     TEXT        NOT NULL,
    phone         TEXT,
    role          TEXT        NOT NULL DEFAULT 'sales'
                              CHECK (role IN ('admin', 'accountant', 'sales', 'warehouse', 'viewer')),
    status        TEXT        NOT NULL DEFAULT 'active'
                              CHECK (status IN ('active', 'inactive')),
    avatar_url    TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

SELECT attach_updated_at_trigger('profiles');
CREATE INDEX idx_profiles_company  ON public.profiles(company_id);
CREATE INDEX idx_profiles_branch   ON public.profiles(branch_id);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Automatically create a profile row when a new Auth user signs up.
-- The trigger is AFTER INSERT on auth.users but it can also be done
-- from the application side (recommended when company_id is known).
-- Left as application-side responsibility for flexibility.


-- ===========================================================
-- SECTION 3: Product Catalogue
-- ===========================================================

-- -----------------------------------------------------------
-- 3.1  product_categories
-- Examples: Candy, Marshmallow, Biscuits, Wafers, Chips,
--           Chocolate, Sweets, Packaged Snacks …
-- -----------------------------------------------------------
CREATE TABLE public.product_categories (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id    UUID        NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    name          TEXT        NOT NULL,
    name_ar       TEXT,                          -- Arabic display name
    description   TEXT,
    status        TEXT        NOT NULL DEFAULT 'active'
                              CHECK (status IN ('active', 'inactive')),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (company_id, name)
);

SELECT attach_updated_at_trigger('product_categories');
CREATE INDEX idx_product_categories_company ON public.product_categories(company_id);

ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;


-- -----------------------------------------------------------
-- 3.2  product_units
-- Examples: Carton (كرتون), Pack (علبة), Piece (حبة),
--           Kg (كيلو), Gram (جرام) …
-- -----------------------------------------------------------
CREATE TABLE public.product_units (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id    UUID        NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    name          TEXT        NOT NULL,
    name_ar       TEXT,
    abbreviation  TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (company_id, name)
);

SELECT attach_updated_at_trigger('product_units');
CREATE INDEX idx_product_units_company ON public.product_units(company_id);

ALTER TABLE public.product_units ENABLE ROW LEVEL SECURITY;


-- -----------------------------------------------------------
-- 3.3  products
-- Master product catalogue.
-- -----------------------------------------------------------
CREATE TABLE public.products (
    id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id          UUID          NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    category_id         UUID          REFERENCES public.product_categories(id) ON DELETE SET NULL,
    unit_id             UUID          REFERENCES public.product_units(id) ON DELETE SET NULL,
    name                TEXT          NOT NULL,
    name_ar             TEXT,
    barcode             TEXT,
    sku                 TEXT,
    description         TEXT,
    purchase_price      NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (purchase_price >= 0),
    sale_price          NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (sale_price >= 0),
    min_sale_price      NUMERIC(14,2) DEFAULT 0 CHECK (min_sale_price >= 0),
    reorder_level       INTEGER       NOT NULL DEFAULT 0 CHECK (reorder_level >= 0),
    tax_rate            NUMERIC(5,2)  NOT NULL DEFAULT 0 CHECK (tax_rate >= 0 AND tax_rate <= 100),
    image_url           TEXT,
    notes               TEXT,
    status              TEXT          NOT NULL DEFAULT 'active'
                                      CHECK (status IN ('active', 'discontinued', 'inactive')),
    deleted_at          TIMESTAMPTZ,             -- soft-delete
    created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    UNIQUE (company_id, barcode),
    UNIQUE (company_id, sku)
);

SELECT attach_updated_at_trigger('products');
CREATE INDEX idx_products_company    ON public.products(company_id);
CREATE INDEX idx_products_category   ON public.products(category_id);
CREATE INDEX idx_products_barcode    ON public.products(company_id, barcode);
CREATE INDEX idx_products_status     ON public.products(company_id, status) WHERE deleted_at IS NULL;

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;


-- ===========================================================
-- SECTION 4: Parties — Customers & Suppliers
-- ===========================================================

-- -----------------------------------------------------------
-- 4.1  customers
-- Retail shops, supermarkets, distributors that buy from us.
-- -----------------------------------------------------------
CREATE TABLE public.customers (
    id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id          UUID          NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    branch_id           UUID          REFERENCES public.branches(id) ON DELETE SET NULL,
    shop_name           TEXT          NOT NULL,
    owner_name          TEXT,
    phone               TEXT,
    phone2              TEXT,
    email               TEXT,
    area                TEXT,
    address             TEXT,
    credit_limit        NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (credit_limit >= 0),
    opening_balance     NUMERIC(14,2) NOT NULL DEFAULT 0,
    current_balance     NUMERIC(14,2) NOT NULL DEFAULT 0, -- updated by payments/invoices
    status              TEXT          NOT NULL DEFAULT 'active'
                                      CHECK (status IN ('active', 'inactive', 'blocked')),
    notes               TEXT,
    deleted_at          TIMESTAMPTZ,
    created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

SELECT attach_updated_at_trigger('customers');
CREATE INDEX idx_customers_company   ON public.customers(company_id);
CREATE INDEX idx_customers_branch    ON public.customers(branch_id);
CREATE INDEX idx_customers_status    ON public.customers(company_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_customers_area      ON public.customers(company_id, area);

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;


-- -----------------------------------------------------------
-- 4.2  suppliers
-- Companies / manufacturers that sell goods to us.
-- -----------------------------------------------------------
CREATE TABLE public.suppliers (
    id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id          UUID          NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    company_name        TEXT          NOT NULL,
    contact_person      TEXT,
    phone               TEXT,
    phone2              TEXT,
    email               TEXT,
    address             TEXT,
    payment_terms_days  INTEGER       DEFAULT 30 CHECK (payment_terms_days >= 0),
    opening_balance     NUMERIC(14,2) NOT NULL DEFAULT 0,
    current_balance     NUMERIC(14,2) NOT NULL DEFAULT 0,
    status              TEXT          NOT NULL DEFAULT 'active'
                                      CHECK (status IN ('active', 'inactive')),
    notes               TEXT,
    deleted_at          TIMESTAMPTZ,
    created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

SELECT attach_updated_at_trigger('suppliers');
CREATE INDEX idx_suppliers_company   ON public.suppliers(company_id);
CREATE INDEX idx_suppliers_status    ON public.suppliers(company_id, status) WHERE deleted_at IS NULL;

ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

-- Many-to-many: which product categories a supplier covers
CREATE TABLE public.supplier_categories (
    supplier_id   UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
    category_id   UUID NOT NULL REFERENCES public.product_categories(id) ON DELETE CASCADE,
    PRIMARY KEY (supplier_id, category_id)
);
ALTER TABLE public.supplier_categories ENABLE ROW LEVEL SECURITY;


-- ===========================================================
-- SECTION 5: Warehouses & Inventory
-- ===========================================================

-- -----------------------------------------------------------
-- 5.1  warehouses
-- Physical storage locations (per branch).
-- -----------------------------------------------------------
CREATE TABLE public.warehouses (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id    UUID        NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    branch_id     UUID        REFERENCES public.branches(id) ON DELETE SET NULL,
    name          TEXT        NOT NULL,
    address       TEXT,
    manager_name  TEXT,
    status        TEXT        NOT NULL DEFAULT 'active'
                              CHECK (status IN ('active', 'inactive')),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (company_id, name)
);

SELECT attach_updated_at_trigger('warehouses');
CREATE INDEX idx_warehouses_company  ON public.warehouses(company_id);
CREATE INDEX idx_warehouses_branch   ON public.warehouses(branch_id);

ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;


-- -----------------------------------------------------------
-- 5.2  inventory_stock
-- Current quantity on hand per product + warehouse.
-- Updated by stock_movements (never edited directly by app).
-- -----------------------------------------------------------
CREATE TABLE public.inventory_stock (
    id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id          UUID          NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    warehouse_id        UUID          NOT NULL REFERENCES public.warehouses(id) ON DELETE CASCADE,
    product_id          UUID          NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    quantity_on_hand    NUMERIC(14,3) NOT NULL DEFAULT 0,
    quantity_reserved   NUMERIC(14,3) NOT NULL DEFAULT 0,  -- reserved by pending orders
    reorder_level       INTEGER,                            -- override per warehouse (NULL = use product default)
    last_movement_at    TIMESTAMPTZ,
    updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    UNIQUE (warehouse_id, product_id),
    CHECK (quantity_on_hand >= 0),
    CHECK (quantity_reserved >= 0),
    CHECK (quantity_reserved <= quantity_on_hand)
);

SELECT attach_updated_at_trigger('inventory_stock');
CREATE INDEX idx_inv_stock_company    ON public.inventory_stock(company_id);
CREATE INDEX idx_inv_stock_warehouse  ON public.inventory_stock(warehouse_id);
CREATE INDEX idx_inv_stock_product    ON public.inventory_stock(product_id);
CREATE INDEX idx_inv_stock_low        ON public.inventory_stock(company_id, warehouse_id)
    WHERE quantity_on_hand <= COALESCE(reorder_level, 10);

ALTER TABLE public.inventory_stock ENABLE ROW LEVEL SECURITY;


-- -----------------------------------------------------------
-- 5.3  stock_movements
-- Immutable ledger of every inventory change.
-- Never UPDATE or DELETE rows — only INSERT.
-- -----------------------------------------------------------
CREATE TABLE public.stock_movements (
    id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id          UUID          NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    warehouse_id        UUID          NOT NULL REFERENCES public.warehouses(id),
    product_id          UUID          NOT NULL REFERENCES public.products(id),
    movement_type       TEXT          NOT NULL
                                      CHECK (movement_type IN (
                                          'purchase_receipt',   -- goods received from supplier
                                          'sale_dispatch',      -- goods dispatched on sale
                                          'sale_return',        -- customer returns
                                          'purchase_return',    -- return to supplier
                                          'transfer_out',       -- inter-warehouse (source)
                                          'transfer_in',        -- inter-warehouse (destination)
                                          'adjustment_in',      -- stock count surplus
                                          'adjustment_out',     -- stock count deficit
                                          'opening_balance'     -- initial stock entry
                                      )),
    quantity            NUMERIC(14,3) NOT NULL,   -- always positive; type encodes direction
    quantity_before     NUMERIC(14,3) NOT NULL,
    quantity_after      NUMERIC(14,3) NOT NULL,
    unit_cost           NUMERIC(14,4),            -- cost at time of movement (for FIFO/AVCO)
    reference_type      TEXT,                     -- 'purchase_invoice' | 'sales_invoice' | 'transfer' | 'adjustment'
    reference_id        UUID,                     -- FK to the originating document
    production_date     DATE,
    expiry_date         DATE,
    notes               TEXT,
    performed_by        UUID          REFERENCES public.profiles(id),
    created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
    -- No updated_at — immutable ledger
);

CREATE INDEX idx_stock_movements_company    ON public.stock_movements(company_id);
CREATE INDEX idx_stock_movements_product    ON public.stock_movements(product_id, warehouse_id);
CREATE INDEX idx_stock_movements_reference  ON public.stock_movements(reference_type, reference_id);
CREATE INDEX idx_stock_movements_date       ON public.stock_movements(created_at DESC);

ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;


-- ===========================================================
-- SECTION 6: Sales
-- ===========================================================

-- -----------------------------------------------------------
-- 6.1  sales_invoices
-- -----------------------------------------------------------
CREATE TABLE public.sales_invoices (
    id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id          UUID          NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    branch_id           UUID          REFERENCES public.branches(id) ON DELETE SET NULL,
    warehouse_id        UUID          NOT NULL REFERENCES public.warehouses(id),
    customer_id         UUID          NOT NULL REFERENCES public.customers(id),
    salesperson_id      UUID          REFERENCES public.profiles(id) ON DELETE SET NULL,
    invoice_number      TEXT          NOT NULL,
    invoice_date        DATE          NOT NULL DEFAULT CURRENT_DATE,
    due_date            DATE,
    payment_method      TEXT          NOT NULL DEFAULT 'credit'
                                      CHECK (payment_method IN ('cash', 'credit', 'bank_transfer', 'pos', 'mixed')),
    payment_status      TEXT          NOT NULL DEFAULT 'unpaid'
                                      CHECK (payment_status IN ('unpaid', 'partially_paid', 'paid', 'overdue')),
    delivery_status     TEXT          NOT NULL DEFAULT 'pending'
                                      CHECK (delivery_status IN ('pending', 'partial', 'dispatched', 'delivered', 'returned')),
    invoice_status      TEXT          NOT NULL DEFAULT 'draft'
                                      CHECK (invoice_status IN ('draft', 'posted', 'cancelled', 'voided')),
    subtotal_amount     NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (subtotal_amount >= 0),
    discount_amount     NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
    tax_rate            NUMERIC(5,2)  NOT NULL DEFAULT 0 CHECK (tax_rate >= 0 AND tax_rate <= 100),
    tax_amount          NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
    total_amount        NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
    paid_amount         NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (paid_amount >= 0),
    notes               TEXT,
    cancelled_at        TIMESTAMPTZ,
    cancelled_by        UUID          REFERENCES public.profiles(id),
    cancel_reason       TEXT,
    created_by          UUID          REFERENCES public.profiles(id),
    created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    UNIQUE (company_id, invoice_number)
);

SELECT attach_updated_at_trigger('sales_invoices');
CREATE INDEX idx_sales_company        ON public.sales_invoices(company_id);
CREATE INDEX idx_sales_customer       ON public.sales_invoices(customer_id);
CREATE INDEX idx_sales_date           ON public.sales_invoices(company_id, invoice_date DESC);
CREATE INDEX idx_sales_payment_status ON public.sales_invoices(company_id, payment_status);
CREATE INDEX idx_sales_status         ON public.sales_invoices(company_id, invoice_status);

ALTER TABLE public.sales_invoices ENABLE ROW LEVEL SECURITY;


-- -----------------------------------------------------------
-- 6.2  sales_invoice_items
-- -----------------------------------------------------------
CREATE TABLE public.sales_invoice_items (
    id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    sales_invoice_id    UUID          NOT NULL REFERENCES public.sales_invoices(id) ON DELETE CASCADE,
    product_id          UUID          NOT NULL REFERENCES public.products(id),
    quantity            NUMERIC(14,3) NOT NULL CHECK (quantity > 0),
    unit_price          NUMERIC(14,4) NOT NULL CHECK (unit_price >= 0),
    discount_amount     NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
    total_amount        NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
    notes               TEXT,
    created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sale_items_invoice  ON public.sales_invoice_items(sales_invoice_id);
CREATE INDEX idx_sale_items_product  ON public.sales_invoice_items(product_id);

ALTER TABLE public.sales_invoice_items ENABLE ROW LEVEL SECURITY;


-- ===========================================================
-- SECTION 7: Purchases
-- ===========================================================

-- -----------------------------------------------------------
-- 7.1  purchase_invoices
-- -----------------------------------------------------------
CREATE TABLE public.purchase_invoices (
    id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id          UUID          NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    branch_id           UUID          REFERENCES public.branches(id) ON DELETE SET NULL,
    warehouse_id        UUID          NOT NULL REFERENCES public.warehouses(id),
    supplier_id         UUID          NOT NULL REFERENCES public.suppliers(id),
    invoice_number      TEXT          NOT NULL,           -- our internal number
    supplier_ref_no     TEXT,                             -- supplier's invoice number
    invoice_date        DATE          NOT NULL DEFAULT CURRENT_DATE,
    due_date            DATE,
    payment_method      TEXT          NOT NULL DEFAULT 'credit'
                                      CHECK (payment_method IN ('cash', 'credit', 'bank_transfer', 'mixed')),
    payment_status      TEXT          NOT NULL DEFAULT 'unpaid'
                                      CHECK (payment_status IN ('unpaid', 'partially_paid', 'paid')),
    receipt_status      TEXT          NOT NULL DEFAULT 'pending'
                                      CHECK (receipt_status IN ('pending', 'partial', 'received', 'returned')),
    invoice_status      TEXT          NOT NULL DEFAULT 'draft'
                                      CHECK (invoice_status IN ('draft', 'posted', 'cancelled', 'voided')),
    subtotal_amount     NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (subtotal_amount >= 0),
    discount_amount     NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
    tax_rate            NUMERIC(5,2)  NOT NULL DEFAULT 0,
    tax_amount          NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
    total_amount        NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
    paid_amount         NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (paid_amount >= 0),
    notes               TEXT,
    cancelled_at        TIMESTAMPTZ,
    cancelled_by        UUID          REFERENCES public.profiles(id),
    cancel_reason       TEXT,
    created_by          UUID          REFERENCES public.profiles(id),
    created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    UNIQUE (company_id, invoice_number)
);

SELECT attach_updated_at_trigger('purchase_invoices');
CREATE INDEX idx_purchases_company     ON public.purchase_invoices(company_id);
CREATE INDEX idx_purchases_supplier    ON public.purchase_invoices(supplier_id);
CREATE INDEX idx_purchases_date        ON public.purchase_invoices(company_id, invoice_date DESC);
CREATE INDEX idx_purchases_pay_status  ON public.purchase_invoices(company_id, payment_status);

ALTER TABLE public.purchase_invoices ENABLE ROW LEVEL SECURITY;


-- -----------------------------------------------------------
-- 7.2  purchase_invoice_items
-- -----------------------------------------------------------
CREATE TABLE public.purchase_invoice_items (
    id                      UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_invoice_id     UUID          NOT NULL REFERENCES public.purchase_invoices(id) ON DELETE CASCADE,
    product_id              UUID          NOT NULL REFERENCES public.products(id),
    quantity                NUMERIC(14,3) NOT NULL CHECK (quantity > 0),
    unit_cost               NUMERIC(14,4) NOT NULL CHECK (unit_cost >= 0),
    discount_amount         NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
    total_amount            NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
    production_date         DATE,
    expiry_date             DATE,
    notes                   TEXT,
    created_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_purchase_items_invoice ON public.purchase_invoice_items(purchase_invoice_id);
CREATE INDEX idx_purchase_items_product ON public.purchase_invoice_items(product_id);

ALTER TABLE public.purchase_invoice_items ENABLE ROW LEVEL SECURITY;


-- ===========================================================
-- SECTION 8: Payments
-- ===========================================================

-- -----------------------------------------------------------
-- 8.1  payments
-- Unified table for customer payments received and
-- supplier payments made.
-- -----------------------------------------------------------
CREATE TABLE public.payments (
    id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id          UUID          NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    branch_id           UUID          REFERENCES public.branches(id) ON DELETE SET NULL,
    payment_type        TEXT          NOT NULL
                                      CHECK (payment_type IN ('customer_payment', 'supplier_payment')),
    -- Only one of these will be set:
    customer_id         UUID          REFERENCES public.customers(id) ON DELETE SET NULL,
    supplier_id         UUID          REFERENCES public.suppliers(id) ON DELETE SET NULL,
    -- The account cash / bank was credited or debited from:
    bank_account_id     UUID,
    reference_type      TEXT          CHECK (reference_type IN ('sales_invoice', 'purchase_invoice', 'advance', 'other')),
    reference_id        UUID,                             -- FK to the invoice being settled
    payment_method      TEXT          NOT NULL DEFAULT 'cash'
                                      CHECK (payment_method IN ('cash', 'bank_transfer', 'cheque', 'pos')),
    payment_date        DATE          NOT NULL DEFAULT CURRENT_DATE,
    amount              NUMERIC(14,2) NOT NULL CHECK (amount > 0),
    cheque_number       TEXT,
    cheque_date         DATE,
    bank_name           TEXT,
    notes               TEXT,
    status              TEXT          NOT NULL DEFAULT 'confirmed'
                                      CHECK (status IN ('confirmed', 'bounced', 'cancelled', 'voided')),
    created_by          UUID          REFERENCES public.profiles(id),
    created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    -- Exactly one party must be set
    CHECK (
        (customer_id IS NOT NULL AND supplier_id IS NULL) OR
        (supplier_id IS NOT NULL AND customer_id IS NULL)
    )
);

SELECT attach_updated_at_trigger('payments');
CREATE INDEX idx_payments_company    ON public.payments(company_id);
CREATE INDEX idx_payments_customer   ON public.payments(customer_id);
CREATE INDEX idx_payments_supplier   ON public.payments(supplier_id);
CREATE INDEX idx_payments_date       ON public.payments(company_id, payment_date DESC);
CREATE INDEX idx_payments_reference  ON public.payments(reference_type, reference_id);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;


-- ===========================================================
-- SECTION 9: Bank Accounts & Transactions
-- ===========================================================

-- -----------------------------------------------------------
-- 9.1  bank_accounts
-- Both physical cash boxes and real bank accounts.
-- -----------------------------------------------------------
CREATE TABLE public.bank_accounts (
    id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id          UUID          NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    branch_id           UUID          REFERENCES public.branches(id) ON DELETE SET NULL,
    account_name        TEXT          NOT NULL,
    account_type        TEXT          NOT NULL DEFAULT 'cash_on_hand'
                                      CHECK (account_type IN ('bank_current', 'bank_saving', 'cash_on_hand', 'e_wallet')),
    bank_name           TEXT,
    account_number      TEXT,
    iban                TEXT,
    currency            CHAR(3)       NOT NULL DEFAULT 'EGP',
    opening_balance     NUMERIC(14,2) NOT NULL DEFAULT 0,
    current_balance     NUMERIC(14,2) NOT NULL DEFAULT 0,
    opening_date        DATE          DEFAULT CURRENT_DATE,
    status              TEXT          NOT NULL DEFAULT 'active'
                                      CHECK (status IN ('active', 'inactive', 'closed')),
    notes               TEXT,
    created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

SELECT attach_updated_at_trigger('bank_accounts');
CREATE INDEX idx_bank_accounts_company ON public.bank_accounts(company_id);

ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.payments
    ADD CONSTRAINT fk_payments_bank_account
    FOREIGN KEY (bank_account_id)
    REFERENCES public.bank_accounts(id)
    ON DELETE SET NULL;


-- -----------------------------------------------------------
-- 9.2  bank_transactions
-- Immutable ledger of every cash / bank account movement.
-- -----------------------------------------------------------
CREATE TABLE public.bank_transactions (
    id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id          UUID          NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    bank_account_id     UUID          NOT NULL REFERENCES public.bank_accounts(id) ON DELETE CASCADE,
    transaction_type    TEXT          NOT NULL
                                      CHECK (transaction_type IN (
                                          'deposit', 'withdrawal',
                                          'transfer_in', 'transfer_out',
                                          'bank_fee', 'interest',
                                          'payment_in', 'payment_out'
                                      )),
    transaction_date    DATE          NOT NULL DEFAULT CURRENT_DATE,
    amount              NUMERIC(14,2) NOT NULL CHECK (amount > 0),
    balance_before      NUMERIC(14,2) NOT NULL,
    balance_after       NUMERIC(14,2) NOT NULL,
    description         TEXT          NOT NULL,
    reference_type      TEXT,
    reference_id        UUID,
    reference_number    TEXT,                             -- cheque / transfer number
    performed_by        UUID          REFERENCES public.profiles(id),
    created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
    -- No updated_at — immutable ledger
);

CREATE INDEX idx_bank_tx_company    ON public.bank_transactions(company_id);
CREATE INDEX idx_bank_tx_account    ON public.bank_transactions(bank_account_id);
CREATE INDEX idx_bank_tx_date       ON public.bank_transactions(bank_account_id, transaction_date DESC);
CREATE INDEX idx_bank_tx_reference  ON public.bank_transactions(reference_type, reference_id);

ALTER TABLE public.bank_transactions ENABLE ROW LEVEL SECURITY;


-- ===========================================================
-- SECTION 10: Expenses
-- ===========================================================

CREATE TABLE public.expenses (
    id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id          UUID          NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    branch_id           UUID          REFERENCES public.branches(id) ON DELETE SET NULL,
    bank_account_id     UUID          REFERENCES public.bank_accounts(id) ON DELETE SET NULL,
    expense_date        DATE          NOT NULL DEFAULT CURRENT_DATE,
    expense_type        TEXT          NOT NULL
                                      CHECK (expense_type IN (
                                          'fuel', 'maintenance', 'rent', 'salaries',
                                          'utilities', 'office_supplies', 'marketing',
                                          'transport', 'bank_fees', 'government_fees',
                                          'hospitality', 'other'
                                      )),
    description         TEXT          NOT NULL,
    amount              NUMERIC(14,2) NOT NULL CHECK (amount > 0),
    payment_method      TEXT          NOT NULL DEFAULT 'cash'
                                      CHECK (payment_method IN ('cash', 'bank_transfer', 'cheque')),
    paid_to             TEXT,
    attachment_url      TEXT,
    attachment_name     TEXT,
    status              TEXT          NOT NULL DEFAULT 'confirmed'
                                      CHECK (status IN ('confirmed', 'cancelled', 'voided')),
    notes               TEXT,
    created_by          UUID          REFERENCES public.profiles(id),
    created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

SELECT attach_updated_at_trigger('expenses');
CREATE INDEX idx_expenses_company   ON public.expenses(company_id);
CREATE INDEX idx_expenses_date      ON public.expenses(company_id, expense_date DESC);
CREATE INDEX idx_expenses_type      ON public.expenses(company_id, expense_type);

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;


-- ===========================================================
-- SECTION 11: Accounting
-- ===========================================================

-- -----------------------------------------------------------
-- 11.1  chart_of_accounts
-- -----------------------------------------------------------
CREATE TABLE public.chart_of_accounts (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id          UUID        NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    parent_id           UUID        REFERENCES public.chart_of_accounts(id) ON DELETE SET NULL,
    code                TEXT        NOT NULL,
    name                TEXT        NOT NULL,
    name_ar             TEXT,
    account_type        TEXT        NOT NULL
                                    CHECK (account_type IN (
                                        'assets', 'liabilities', 'equity',
                                        'revenue', 'expenses'
                                    )),
    account_nature      TEXT        NOT NULL DEFAULT 'debit'
                                    CHECK (account_nature IN ('debit', 'credit')),
    is_control          BOOLEAN     NOT NULL DEFAULT FALSE, -- linked to sub-ledger
    opening_balance     NUMERIC(14,2) NOT NULL DEFAULT 0,
    current_balance     NUMERIC(14,2) NOT NULL DEFAULT 0,
    notes               TEXT,
    status              TEXT        NOT NULL DEFAULT 'active'
                                    CHECK (status IN ('active', 'inactive')),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (company_id, code)
);

SELECT attach_updated_at_trigger('chart_of_accounts');
CREATE INDEX idx_coa_company   ON public.chart_of_accounts(company_id);
CREATE INDEX idx_coa_parent    ON public.chart_of_accounts(parent_id);
CREATE INDEX idx_coa_type      ON public.chart_of_accounts(company_id, account_type);

ALTER TABLE public.chart_of_accounts ENABLE ROW LEVEL SECURITY;


-- -----------------------------------------------------------
-- 11.2  journal_entries
-- -----------------------------------------------------------
CREATE TABLE public.journal_entries (
    id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id          UUID          NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    branch_id           UUID          REFERENCES public.branches(id) ON DELETE SET NULL,
    entry_number        TEXT          NOT NULL,
    entry_date          DATE          NOT NULL DEFAULT CURRENT_DATE,
    description         TEXT          NOT NULL,
    reference_type      TEXT,
    reference_id        UUID,
    total_debit         NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (total_debit >= 0),
    total_credit        NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (total_credit >= 0),
    status              TEXT          NOT NULL DEFAULT 'draft'
                                      CHECK (status IN ('draft', 'posted', 'reversed')),
    created_by          UUID          REFERENCES public.profiles(id),
    posted_by           UUID          REFERENCES public.profiles(id),
    posted_at           TIMESTAMPTZ,
    created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    UNIQUE (company_id, entry_number),
    CHECK (total_debit = total_credit OR status = 'draft')
);

SELECT attach_updated_at_trigger('journal_entries');
CREATE INDEX idx_je_company    ON public.journal_entries(company_id);
CREATE INDEX idx_je_date       ON public.journal_entries(company_id, entry_date DESC);
CREATE INDEX idx_je_reference  ON public.journal_entries(reference_type, reference_id);
CREATE INDEX idx_je_status     ON public.journal_entries(company_id, status);

ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;


-- -----------------------------------------------------------
-- 11.3  journal_entry_lines
-- -----------------------------------------------------------
CREATE TABLE public.journal_entry_lines (
    id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    journal_entry_id    UUID          NOT NULL REFERENCES public.journal_entries(id) ON DELETE CASCADE,
    account_id          UUID          NOT NULL REFERENCES public.chart_of_accounts(id),
    description         TEXT,
    debit_amount        NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (debit_amount >= 0),
    credit_amount       NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (credit_amount >= 0),
    created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    -- A line cannot be both debit AND credit at the same time
    CHECK (
        (debit_amount > 0 AND credit_amount = 0) OR
        (credit_amount > 0 AND debit_amount = 0) OR
        (debit_amount = 0 AND credit_amount = 0)
    )
);

CREATE INDEX idx_jel_entry    ON public.journal_entry_lines(journal_entry_id);
CREATE INDEX idx_jel_account  ON public.journal_entry_lines(account_id);

ALTER TABLE public.journal_entry_lines ENABLE ROW LEVEL SECURITY;


-- ===========================================================
-- SECTION 12: Settings
-- ===========================================================

CREATE TABLE public.app_settings (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id          UUID        NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    setting_key         TEXT        NOT NULL,
    setting_value       TEXT,
    setting_value_json  JSONB,      -- for complex settings (arrays, objects)
    description         TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (company_id, setting_key)
);

SELECT attach_updated_at_trigger('app_settings');
CREATE INDEX idx_app_settings_company ON public.app_settings(company_id);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;


-- ===========================================================
-- SECTION 13: Audit Log
-- ===========================================================

-- Immutable. Rows are INSERTED by fn_audit_log().
-- Never UPDATE or DELETE from this table.
CREATE TABLE public.audit_logs (
    id            BIGSERIAL   PRIMARY KEY,
    table_name    TEXT        NOT NULL,
    record_id     UUID,
    action        TEXT        NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
    old_data      JSONB,
    new_data      JSONB,
    performed_by  UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
    company_id    UUID        REFERENCES public.companies(id) ON DELETE SET NULL,
    ip_address    TEXT,
    user_agent    TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_company    ON public.audit_logs(company_id);
CREATE INDEX idx_audit_table      ON public.audit_logs(table_name, record_id);
CREATE INDEX idx_audit_user       ON public.audit_logs(performed_by);
CREATE INDEX idx_audit_date       ON public.audit_logs(created_at DESC);
CREATE INDEX idx_audit_action     ON public.audit_logs(action, table_name);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;


-- ===========================================================
-- SECTION 14: Audit Triggers
-- Attach audit logging to all business-critical tables.
-- ===========================================================

-- Helper macro to attach audit trigger to a table
CREATE OR REPLACE FUNCTION attach_audit_trigger(p_table TEXT)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
    EXECUTE format(
        'CREATE TRIGGER trg_%s_audit
         AFTER INSERT OR UPDATE OR DELETE ON public.%I
         FOR EACH ROW EXECUTE FUNCTION fn_audit_log()',
        p_table, p_table
    );
END;
$$;

SELECT attach_audit_trigger('sales_invoices');
SELECT attach_audit_trigger('purchase_invoices');
SELECT attach_audit_trigger('payments');
SELECT attach_audit_trigger('stock_movements');
SELECT attach_audit_trigger('bank_transactions');
SELECT attach_audit_trigger('expenses');
SELECT attach_audit_trigger('journal_entries');
SELECT attach_audit_trigger('profiles');


-- ===========================================================
-- SECTION 15: Row Level Security Policies
-- ===========================================================
-- Design principle:
--   • Every authenticated user has a profile row in public.profiles
--     which carries their company_id, branch_id, and role.
--   • fn_my_company_id()  → current user's company
--   • fn_my_role()        → current user's role
--   • fn_my_branch_id()   → current user's branch (NULL = all branches)
--
-- Role matrix:
--   admin       → full access to own company
--   accountant  → read all + write financial docs + no user management
--   sales       → read products/customers/warehouses + write sales invoices + payments in
--   warehouse   → read products + write inventory moves
--   viewer      → read-only on most tables
-- ===========================================================

-- ----
-- Helper: is the current user an admin of their company?
-- ----
CREATE OR REPLACE FUNCTION fn_is_admin() RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
    SELECT fn_my_role() = 'admin';
$$;

-- Bootstrap the very first admin profile for a fresh installation.
-- Safe constraints:
--   • Requires an authenticated Auth user (auth.uid()).
--   • Runs only before any profile row exists.
--   • Reuses the single existing company if one was created manually,
--     otherwise creates the first company automatically.
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
        RAISE EXCEPTION 'BOOTSTRAP_AUTH_REQUIRED';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM auth.users WHERE id = v_user_id
    ) THEN
        RAISE EXCEPTION 'BOOTSTRAP_AUTH_USER_NOT_FOUND';
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
        RAISE EXCEPTION 'BOOTSTRAP_ALREADY_INITIALIZED';
    END IF;

    SELECT COUNT(*) INTO v_company_count
    FROM public.companies;

    IF v_company_count > 1 THEN
        RAISE EXCEPTION 'BOOTSTRAP_MULTIPLE_COMPANIES';
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

-- Safe to grant to all authenticated users because the function itself
-- aborts unless no profile rows exist yet; after first setup it cannot
-- create or modify additional users.
REVOKE ALL ON FUNCTION public.bootstrap_first_admin_profile(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bootstrap_first_admin_profile(TEXT, TEXT) TO authenticated;

-- ----
-- companies: admin can read/write own company; others read-only own company
-- ----
CREATE POLICY pol_companies_select ON public.companies
    FOR SELECT USING (id = fn_my_company_id());

CREATE POLICY pol_companies_update ON public.companies
    FOR UPDATE USING (id = fn_my_company_id() AND fn_is_admin());

-- ----
-- branches
-- ----
CREATE POLICY pol_branches_select ON public.branches
    FOR SELECT USING (company_id = fn_my_company_id());

CREATE POLICY pol_branches_all ON public.branches
    FOR ALL USING (company_id = fn_my_company_id() AND fn_is_admin());

-- ----
-- profiles: each user reads own row; admin reads all in company
-- ----
CREATE POLICY pol_profiles_own_select ON public.profiles
    FOR SELECT USING (
        id = auth.uid() OR
        (company_id = fn_my_company_id() AND fn_is_admin())
    );

CREATE POLICY pol_profiles_own_update ON public.profiles
    FOR UPDATE USING (id = auth.uid());

CREATE POLICY pol_profiles_admin_all ON public.profiles
    FOR ALL USING (company_id = fn_my_company_id() AND fn_is_admin());

-- ----
-- product_categories
-- ----
CREATE POLICY pol_product_categories_select ON public.product_categories
    FOR SELECT USING (company_id = fn_my_company_id());

CREATE POLICY pol_product_categories_write ON public.product_categories
    FOR ALL USING (
        company_id = fn_my_company_id() AND
        fn_my_role() IN ('admin', 'accountant', 'warehouse')
    );

-- ----
-- product_units
-- ----
CREATE POLICY pol_product_units_select ON public.product_units
    FOR SELECT USING (company_id = fn_my_company_id());

CREATE POLICY pol_product_units_write ON public.product_units
    FOR ALL USING (
        company_id = fn_my_company_id() AND
        fn_my_role() IN ('admin', 'accountant', 'warehouse')
    );

-- ----
-- products: everyone in the company can read; admin/warehouse can write
-- ----
CREATE POLICY pol_products_select ON public.products
    FOR SELECT USING (company_id = fn_my_company_id() AND deleted_at IS NULL);

CREATE POLICY pol_products_write ON public.products
    FOR ALL USING (
        company_id = fn_my_company_id() AND
        fn_my_role() IN ('admin', 'warehouse')
    );

-- ----
-- customers
-- ----
CREATE POLICY pol_customers_select ON public.customers
    FOR SELECT USING (company_id = fn_my_company_id() AND deleted_at IS NULL);

CREATE POLICY pol_customers_write ON public.customers
    FOR ALL USING (
        company_id = fn_my_company_id() AND
        fn_my_role() IN ('admin', 'accountant', 'sales')
    );

-- ----
-- suppliers
-- ----
CREATE POLICY pol_suppliers_select ON public.suppliers
    FOR SELECT USING (company_id = fn_my_company_id() AND deleted_at IS NULL);

CREATE POLICY pol_suppliers_write ON public.suppliers
    FOR ALL USING (
        company_id = fn_my_company_id() AND
        fn_my_role() IN ('admin', 'accountant')
    );

-- ----
-- supplier_categories
-- ----
CREATE POLICY pol_supplier_cats_select ON public.supplier_categories
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.suppliers s
            WHERE s.id = supplier_id AND s.company_id = fn_my_company_id()
        )
    );

CREATE POLICY pol_supplier_cats_write ON public.supplier_categories
    FOR ALL USING (
        fn_my_role() IN ('admin', 'accountant') AND
        EXISTS (
            SELECT 1 FROM public.suppliers s
            WHERE s.id = supplier_id AND s.company_id = fn_my_company_id()
        )
    );

-- ----
-- warehouses
-- ----
CREATE POLICY pol_warehouses_select ON public.warehouses
    FOR SELECT USING (company_id = fn_my_company_id());

CREATE POLICY pol_warehouses_write ON public.warehouses
    FOR ALL USING (
        company_id = fn_my_company_id() AND fn_is_admin()
    );

-- ----
-- inventory_stock: everyone reads; warehouse/admin write
-- ----
CREATE POLICY pol_inv_stock_select ON public.inventory_stock
    FOR SELECT USING (company_id = fn_my_company_id());

CREATE POLICY pol_inv_stock_write ON public.inventory_stock
    FOR ALL USING (
        company_id = fn_my_company_id() AND
        fn_my_role() IN ('admin', 'warehouse')
    );

-- ----
-- stock_movements: immutable — only insert, no update/delete
-- ----
CREATE POLICY pol_stock_move_select ON public.stock_movements
    FOR SELECT USING (company_id = fn_my_company_id());

CREATE POLICY pol_stock_move_insert ON public.stock_movements
    FOR INSERT WITH CHECK (
        company_id = fn_my_company_id() AND
        fn_my_role() IN ('admin', 'warehouse', 'accountant')
    );
-- No UPDATE or DELETE policies → blocked by default

-- ----
-- sales_invoices
-- ----
CREATE POLICY pol_sales_select ON public.sales_invoices
    FOR SELECT USING (company_id = fn_my_company_id());

CREATE POLICY pol_sales_insert ON public.sales_invoices
    FOR INSERT WITH CHECK (
        company_id = fn_my_company_id() AND
        fn_my_role() IN ('admin', 'accountant', 'sales')
    );

CREATE POLICY pol_sales_update ON public.sales_invoices
    FOR UPDATE USING (
        company_id = fn_my_company_id() AND
        fn_my_role() IN ('admin', 'accountant', 'sales') AND
        invoice_status NOT IN ('cancelled', 'voided')
    );

-- No DELETE policy — use status = 'voided' / 'cancelled' instead

-- ----
-- sales_invoice_items
-- ----
CREATE POLICY pol_sale_items_select ON public.sales_invoice_items
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.sales_invoices si
            WHERE si.id = sales_invoice_id AND si.company_id = fn_my_company_id()
        )
    );

CREATE POLICY pol_sale_items_write ON public.sales_invoice_items
    FOR ALL USING (
        fn_my_role() IN ('admin', 'accountant', 'sales') AND
        EXISTS (
            SELECT 1 FROM public.sales_invoices si
            WHERE si.id = sales_invoice_id AND si.company_id = fn_my_company_id()
        )
    );

-- ----
-- purchase_invoices
-- ----
CREATE POLICY pol_purchases_select ON public.purchase_invoices
    FOR SELECT USING (company_id = fn_my_company_id());

CREATE POLICY pol_purchases_insert ON public.purchase_invoices
    FOR INSERT WITH CHECK (
        company_id = fn_my_company_id() AND
        fn_my_role() IN ('admin', 'accountant')
    );

CREATE POLICY pol_purchases_update ON public.purchase_invoices
    FOR UPDATE USING (
        company_id = fn_my_company_id() AND
        fn_my_role() IN ('admin', 'accountant') AND
        invoice_status NOT IN ('cancelled', 'voided')
    );

-- ----
-- purchase_invoice_items
-- ----
CREATE POLICY pol_purchase_items_select ON public.purchase_invoice_items
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.purchase_invoices pi
            WHERE pi.id = purchase_invoice_id AND pi.company_id = fn_my_company_id()
        )
    );

CREATE POLICY pol_purchase_items_write ON public.purchase_invoice_items
    FOR ALL USING (
        fn_my_role() IN ('admin', 'accountant') AND
        EXISTS (
            SELECT 1 FROM public.purchase_invoices pi
            WHERE pi.id = purchase_invoice_id AND pi.company_id = fn_my_company_id()
        )
    );

-- ----
-- payments
-- ----
CREATE POLICY pol_payments_select ON public.payments
    FOR SELECT USING (company_id = fn_my_company_id());

CREATE POLICY pol_payments_insert ON public.payments
    FOR INSERT WITH CHECK (
        company_id = fn_my_company_id() AND
        fn_my_role() IN ('admin', 'accountant', 'sales')
    );

CREATE POLICY pol_payments_update ON public.payments
    FOR UPDATE USING (
        company_id = fn_my_company_id() AND
        fn_my_role() IN ('admin', 'accountant') AND
        status NOT IN ('cancelled', 'voided')
    );

-- ----
-- bank_accounts
-- ----
CREATE POLICY pol_bank_accts_select ON public.bank_accounts
    FOR SELECT USING (company_id = fn_my_company_id());

CREATE POLICY pol_bank_accts_write ON public.bank_accounts
    FOR ALL USING (
        company_id = fn_my_company_id() AND
        fn_my_role() IN ('admin', 'accountant')
    );

-- ----
-- bank_transactions: immutable — insert only
-- ----
CREATE POLICY pol_bank_tx_select ON public.bank_transactions
    FOR SELECT USING (company_id = fn_my_company_id());

CREATE POLICY pol_bank_tx_insert ON public.bank_transactions
    FOR INSERT WITH CHECK (
        company_id = fn_my_company_id() AND
        fn_my_role() IN ('admin', 'accountant')
    );
-- No UPDATE / DELETE policies

-- ----
-- expenses
-- ----
CREATE POLICY pol_expenses_select ON public.expenses
    FOR SELECT USING (company_id = fn_my_company_id());

CREATE POLICY pol_expenses_insert ON public.expenses
    FOR INSERT WITH CHECK (
        company_id = fn_my_company_id() AND
        fn_my_role() IN ('admin', 'accountant')
    );

CREATE POLICY pol_expenses_update ON public.expenses
    FOR UPDATE USING (
        company_id = fn_my_company_id() AND
        fn_my_role() IN ('admin', 'accountant') AND
        status NOT IN ('cancelled', 'voided')
    );

-- ----
-- chart_of_accounts
-- ----
CREATE POLICY pol_coa_select ON public.chart_of_accounts
    FOR SELECT USING (company_id = fn_my_company_id());

CREATE POLICY pol_coa_write ON public.chart_of_accounts
    FOR ALL USING (
        company_id = fn_my_company_id() AND
        fn_my_role() IN ('admin', 'accountant')
    );

-- ----
-- journal_entries
-- ----
CREATE POLICY pol_je_select ON public.journal_entries
    FOR SELECT USING (company_id = fn_my_company_id());

CREATE POLICY pol_je_insert ON public.journal_entries
    FOR INSERT WITH CHECK (
        company_id = fn_my_company_id() AND
        fn_my_role() IN ('admin', 'accountant')
    );

CREATE POLICY pol_je_update ON public.journal_entries
    FOR UPDATE USING (
        company_id = fn_my_company_id() AND
        fn_my_role() IN ('admin', 'accountant') AND
        status = 'draft'    -- only drafts can be edited
    );

-- ----
-- journal_entry_lines
-- ----
CREATE POLICY pol_jel_select ON public.journal_entry_lines
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.journal_entries je
            WHERE je.id = journal_entry_id AND je.company_id = fn_my_company_id()
        )
    );

CREATE POLICY pol_jel_write ON public.journal_entry_lines
    FOR ALL USING (
        fn_my_role() IN ('admin', 'accountant') AND
        EXISTS (
            SELECT 1 FROM public.journal_entries je
            WHERE je.id = journal_entry_id
              AND je.company_id = fn_my_company_id()
              AND je.status = 'draft'
        )
    );

-- ----
-- app_settings
-- ----
CREATE POLICY pol_app_settings_select ON public.app_settings
    FOR SELECT USING (company_id = fn_my_company_id());

CREATE POLICY pol_app_settings_write ON public.app_settings
    FOR ALL USING (
        company_id = fn_my_company_id() AND fn_is_admin()
    );

-- ----
-- audit_logs: readable by admin only; writable by service role only
-- ----
CREATE POLICY pol_audit_select ON public.audit_logs
    FOR SELECT USING (
        company_id = fn_my_company_id() AND fn_is_admin()
    );
-- No INSERT / UPDATE / DELETE policies for regular users


-- ===========================================================
-- SECTION 16: Useful Views
-- ===========================================================

-- Quick inventory summary per warehouse and product
CREATE OR REPLACE VIEW public.v_inventory_summary AS
SELECT
    s.id,
    s.company_id,
    w.name          AS warehouse_name,
    p.name          AS product_name,
    p.barcode,
    c.name          AS category_name,
    u.name          AS unit_name,
    s.quantity_on_hand,
    s.quantity_reserved,
    (s.quantity_on_hand - s.quantity_reserved) AS quantity_available,
    COALESCE(s.reorder_level, p.reorder_level) AS effective_reorder_level,
    CASE
        WHEN s.quantity_on_hand = 0 THEN 'out_of_stock'
        WHEN s.quantity_on_hand <= COALESCE(s.reorder_level, p.reorder_level) THEN 'low_stock'
        ELSE 'in_stock'
    END AS stock_status,
    s.last_movement_at
FROM public.inventory_stock s
JOIN public.warehouses       w ON w.id = s.warehouse_id
JOIN public.products         p ON p.id = s.product_id
LEFT JOIN public.product_categories c ON c.id = p.category_id
LEFT JOIN public.product_units      u ON u.id = p.unit_id
WHERE p.deleted_at IS NULL;

-- Customer balance summary
CREATE OR REPLACE VIEW public.v_customer_balances AS
SELECT
    c.id,
    c.company_id,
    c.shop_name,
    c.owner_name,
    c.phone,
    c.area,
    c.credit_limit,
    c.current_balance,
    c.status,
    (c.credit_limit - c.current_balance) AS available_credit
FROM public.customers c
WHERE c.deleted_at IS NULL;

-- Supplier balance summary
CREATE OR REPLACE VIEW public.v_supplier_balances AS
SELECT
    s.id,
    s.company_id,
    s.company_name,
    s.contact_person,
    s.phone,
    s.current_balance,
    s.status
FROM public.suppliers s
WHERE s.deleted_at IS NULL;

-- Outstanding sales invoices (unpaid / partially paid)
CREATE OR REPLACE VIEW public.v_outstanding_sales AS
SELECT
    si.id,
    si.company_id,
    si.invoice_number,
    si.invoice_date,
    si.due_date,
    cu.shop_name   AS customer_name,
    si.total_amount,
    si.paid_amount,
    (si.total_amount - si.paid_amount) AS balance_due,
    si.payment_status,
    (CURRENT_DATE - si.due_date) AS days_overdue
FROM public.sales_invoices si
JOIN public.customers cu ON cu.id = si.customer_id
WHERE si.payment_status IN ('unpaid', 'partially_paid')
  AND si.invoice_status = 'posted';

-- Outstanding purchase invoices
CREATE OR REPLACE VIEW public.v_outstanding_purchases AS
SELECT
    pi.id,
    pi.company_id,
    pi.invoice_number,
    pi.invoice_date,
    pi.due_date,
    su.company_name AS supplier_name,
    pi.total_amount,
    pi.paid_amount,
    (pi.total_amount - pi.paid_amount) AS balance_due,
    pi.payment_status,
    (CURRENT_DATE - pi.due_date) AS days_overdue
FROM public.purchase_invoices pi
JOIN public.suppliers su ON su.id = pi.supplier_id
WHERE pi.payment_status IN ('unpaid', 'partially_paid')
  AND pi.invoice_status = 'posted';


-- ===========================================================
-- SECTION 17: Cleanup Helper Functions (safe to drop)
-- ===========================================================
DROP FUNCTION IF EXISTS attach_updated_at_trigger(TEXT);
DROP FUNCTION IF EXISTS attach_audit_trigger(TEXT);


-- ===========================================================
-- END OF SCHEMA
-- ============================================================
-- ✅ After running this script:
--    1. Go to Authentication → Providers → enable Email.
--    2. Create the first Auth user from Supabase Authentication.
--    3. Sign in to the app once with that user; the app will call
--       bootstrap_first_admin_profile() to create the first company
--       and admin profile automatically when no profiles exist yet.
--    4. Update js/supabase-client.js to use the correct Project URL
--       (NOT the /rest/v1/ sub-path) and your anon key.
-- ============================================================
