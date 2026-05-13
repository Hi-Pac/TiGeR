-- ============================================================
-- TiGeR ERP — Database Architecture Improvements (FIXED)
-- Migration: 20260510_database_improvements_fixed.sql
-- Generated: 2026-05-10 (Fixed Version)
--
-- هذا السكريبت يحل جميع مشاكل هندسة قاعدة البيانات
-- تم إصلاح المشاكل التي ظهرت في النسخة الأولى
--
-- ⚠️  IMPORTANT: هذا السكريبت آمن للتشغيل على قاعدة بيانات موجودة
--     لن يحذف أي بيانات، فقط يضيف تحسينات
-- ============================================================


-- ===========================================================
-- SECTION 1: إضافة Composite Indexes للأداء
-- ===========================================================

-- Indexes لجدول sales_invoices
DROP INDEX IF EXISTS idx_sales_invoices_company_date CASCADE;
CREATE INDEX IF NOT EXISTS idx_sales_invoices_company_date
ON public.sales_invoices(company_id, invoice_date DESC);

DROP INDEX IF EXISTS idx_sales_invoices_company_customer CASCADE;
CREATE INDEX IF NOT EXISTS idx_sales_invoices_company_customer
ON public.sales_invoices(company_id, customer_id);

DROP INDEX IF EXISTS idx_sales_invoices_company_status CASCADE;
CREATE INDEX IF NOT EXISTS idx_sales_invoices_company_status
ON public.sales_invoices(company_id, payment_status)
WHERE invoice_status = 'posted';

DROP INDEX IF EXISTS idx_sales_invoices_overdue CASCADE;
CREATE INDEX IF NOT EXISTS idx_sales_invoices_overdue
ON public.sales_invoices(company_id, due_date)
WHERE payment_status IN ('unpaid', 'partially_paid', 'overdue')
  AND invoice_status = 'posted';

-- Indexes لجدول purchase_invoices
DROP INDEX IF EXISTS idx_purchase_invoices_company_date CASCADE;
CREATE INDEX IF NOT EXISTS idx_purchase_invoices_company_date
ON public.purchase_invoices(company_id, invoice_date DESC);

DROP INDEX IF EXISTS idx_purchase_invoices_company_supplier CASCADE;
CREATE INDEX IF NOT EXISTS idx_purchase_invoices_company_supplier
ON public.purchase_invoices(company_id, supplier_id);

DROP INDEX IF EXISTS idx_purchase_invoices_company_status CASCADE;
CREATE INDEX IF NOT EXISTS idx_purchase_invoices_company_status
ON public.purchase_invoices(company_id, payment_status)
WHERE invoice_status = 'posted';

-- Indexes لجدول customers
DROP INDEX IF EXISTS idx_customers_company_status CASCADE;
CREATE INDEX IF NOT EXISTS idx_customers_company_status
ON public.customers(company_id, status)
WHERE deleted_at IS NULL;

DROP INDEX IF EXISTS idx_customers_search CASCADE;
CREATE INDEX IF NOT EXISTS idx_customers_search
ON public.customers(company_id, shop_name)
WHERE deleted_at IS NULL;

-- Indexes لجدول products
DROP INDEX IF EXISTS idx_products_company_category CASCADE;
CREATE INDEX IF NOT EXISTS idx_products_company_category
ON public.products(company_id, category_id)
WHERE deleted_at IS NULL;

DROP INDEX IF EXISTS idx_products_company_name CASCADE;
CREATE INDEX IF NOT EXISTS idx_products_company_name
ON public.products(company_id, name)
WHERE deleted_at IS NULL;

-- Indexes لجدول stock_movements
DROP INDEX IF EXISTS idx_stock_movements_company_date CASCADE;
CREATE INDEX IF NOT EXISTS idx_stock_movements_company_date
ON public.stock_movements(company_id, movement_date DESC);

DROP INDEX IF EXISTS idx_stock_movements_warehouse_product CASCADE;
CREATE INDEX IF NOT EXISTS idx_stock_movements_warehouse_product
ON public.stock_movements(warehouse_id, product_id, movement_date DESC);


-- ===========================================================
-- SECTION 2: إضافة جدول المدفوعات (Payments)
-- ===========================================================

CREATE TABLE IF NOT EXISTS public.payments (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id          UUID NOT NULL,
    invoice_type        TEXT NOT NULL CHECK (invoice_type IN ('sale', 'purchase')),
    invoice_id          UUID NOT NULL,
    payment_number      TEXT NOT NULL,
    payment_date        DATE NOT NULL DEFAULT CURRENT_DATE,
    amount              NUMERIC(14,2) NOT NULL CHECK (amount > 0),
    payment_method      TEXT NOT NULL,
    bank_account_id     UUID,
    reference_number    TEXT,
    notes               TEXT,
    created_by          UUID,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Add unique constraint only if table was just created or constraint doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'uq_payments_number'
    ) THEN
        ALTER TABLE public.payments
        ADD CONSTRAINT uq_payments_number UNIQUE (company_id, payment_number);
    END IF;
END $$;

DROP INDEX IF EXISTS idx_payments_company CASCADE;
CREATE INDEX IF NOT EXISTS idx_payments_company ON public.payments(company_id);

DROP INDEX IF EXISTS idx_payments_invoice CASCADE;
CREATE INDEX IF NOT EXISTS idx_payments_invoice ON public.payments(invoice_type, invoice_id);

DROP INDEX IF EXISTS idx_payments_date CASCADE;
CREATE INDEX IF NOT EXISTS idx_payments_date ON public.payments(company_id, payment_date DESC);

COMMENT ON TABLE public.payments IS 'سجل المدفوعات للفواتير (بيع/شراء)';


-- ===========================================================
-- SECTION 3: إضافة sequences لترقيم الفواتير والمدفوعات
-- ===========================================================

CREATE SEQUENCE IF NOT EXISTS seq_sales_invoice_number START 1000;
CREATE SEQUENCE IF NOT EXISTS seq_purchase_invoice_number START 1000;
CREATE SEQUENCE IF NOT EXISTS seq_payment_number START 1000;

-- دالة لتوليد رقم فاتورة بيع
CREATE OR REPLACE FUNCTION fn_generate_sales_invoice_number()
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
    v_year TEXT := to_char(NOW(), 'YYYY');
    v_seq TEXT;
BEGIN
    v_seq := LPAD(nextval('seq_sales_invoice_number')::TEXT, 6, '0');
    RETURN 'INV-S-' || v_year || '-' || v_seq;
END;
$$;

-- دالة لتوليد رقم فاتورة شراء
CREATE OR REPLACE FUNCTION fn_generate_purchase_invoice_number()
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
    v_year TEXT := to_char(NOW(), 'YYYY');
    v_seq TEXT;
BEGIN
    v_seq := LPAD(nextval('seq_purchase_invoice_number')::TEXT, 6, '0');
    RETURN 'INV-P-' || v_year || '-' || v_seq;
END;
$$;

-- دالة لتوليد رقم مدفوعات
CREATE OR REPLACE FUNCTION fn_generate_payment_number()
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
    v_year TEXT := to_char(NOW(), 'YYYY');
    v_seq TEXT;
BEGIN
    v_seq := LPAD(nextval('seq_payment_number')::TEXT, 6, '0');
    RETURN 'PAY-' || v_year || '-' || v_seq;
END;
$$;


-- ===========================================================
-- SECTION 4: دوال التحقق من صحة الفواتير
-- ===========================================================

-- دالة للتحقق من صحة فواتير البيع
CREATE OR REPLACE FUNCTION fn_validate_sales_invoice_totals()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
    v_items_total NUMERIC(14,2);
    v_calculated_tax NUMERIC(14,2);
    v_calculated_total NUMERIC(14,2);
BEGIN
    -- حساب مجموع البنود
    SELECT COALESCE(SUM(total_amount), 0) INTO v_items_total
    FROM sales_invoice_items
    WHERE sales_invoice_id = NEW.id;

    -- التحقق من أن subtotal = مجموع البنود (مع تحمل اختلاف صغير للتقريب)
    IF ABS(NEW.subtotal_amount - v_items_total) > 0.01 THEN
        RAISE EXCEPTION 'مجموع بنود الفاتورة (%) لا يساوي المبلغ الإجمالي قبل الضريبة (%)',
            v_items_total, NEW.subtotal_amount;
    END IF;

    -- التحقق من صحة حساب الضريبة
    v_calculated_tax := ROUND((NEW.subtotal_amount - NEW.discount_amount) * (NEW.tax_rate / 100), 2);
    IF ABS(NEW.tax_amount - v_calculated_tax) > 0.01 THEN
        RAISE EXCEPTION 'قيمة الضريبة غير صحيحة. المحسوبة: %، المدخلة: %',
            v_calculated_tax, NEW.tax_amount;
    END IF;

    -- التحقق من صحة المجموع النهائي
    v_calculated_total := NEW.subtotal_amount - NEW.discount_amount + NEW.tax_amount;
    IF ABS(NEW.total_amount - v_calculated_total) > 0.01 THEN
        RAISE EXCEPTION 'المبلغ الإجمالي النهائي غير صحيح. المحسوب: %، المدخل: %',
            v_calculated_total, NEW.total_amount;
    END IF;

    -- التحقق من أن الخصم لا يتجاوز المبلغ الإجمالي
    IF NEW.discount_amount > NEW.subtotal_amount THEN
        RAISE EXCEPTION 'الخصم (%) لا يمكن أن يتجاوز المبلغ الإجمالي قبل الضريبة (%)',
            NEW.discount_amount, NEW.subtotal_amount;
    END IF;

    -- التحقق من أن المدفوع لا يتجاوز المجموع
    IF NEW.paid_amount > NEW.total_amount THEN
        RAISE EXCEPTION 'المبلغ المدفوع (%) لا يمكن أن يتجاوز المبلغ الإجمالي (%)',
            NEW.paid_amount, NEW.total_amount;
    END IF;

    RETURN NEW;
END;
$$;

-- دالة للتحقق من صحة فواتير الشراء
CREATE OR REPLACE FUNCTION fn_validate_purchase_invoice_totals()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
    v_items_total NUMERIC(14,2);
    v_calculated_tax NUMERIC(14,2);
    v_calculated_total NUMERIC(14,2);
BEGIN
    SELECT COALESCE(SUM(total_amount), 0) INTO v_items_total
    FROM purchase_invoice_items
    WHERE purchase_invoice_id = NEW.id;

    IF ABS(NEW.subtotal_amount - v_items_total) > 0.01 THEN
        RAISE EXCEPTION 'مجموع بنود الفاتورة (%) لا يساوي المبلغ الإجمالي قبل الضريبة (%)',
            v_items_total, NEW.subtotal_amount;
    END IF;

    v_calculated_tax := ROUND((NEW.subtotal_amount - NEW.discount_amount) * (NEW.tax_rate / 100), 2);
    IF ABS(NEW.tax_amount - v_calculated_tax) > 0.01 THEN
        RAISE EXCEPTION 'قيمة الضريبة غير صحيحة. المحسوبة: %، المدخلة: %',
            v_calculated_tax, NEW.tax_amount;
    END IF;

    v_calculated_total := NEW.subtotal_amount - NEW.discount_amount + NEW.tax_amount;
    IF ABS(NEW.total_amount - v_calculated_total) > 0.01 THEN
        RAISE EXCEPTION 'المبلغ الإجمالي النهائي غير صحيح. المحسوب: %، المدخل: %',
            v_calculated_total, NEW.total_amount;
    END IF;

    IF NEW.discount_amount > NEW.subtotal_amount THEN
        RAISE EXCEPTION 'الخصم لا يمكن أن يتجاوز المبلغ الإجمالي قبل الضريبة';
    END IF;

    IF NEW.paid_amount > NEW.total_amount THEN
        RAISE EXCEPTION 'المبلغ المدفوع لا يمكن أن يتجاوز المبلغ الإجمالي';
    END IF;

    RETURN NEW;
END;
$$;

-- إنشاء Triggers للتحقق من صحة الفواتير
DROP TRIGGER IF EXISTS trg_sales_invoices_validate_totals ON public.sales_invoices;
CREATE TRIGGER trg_sales_invoices_validate_totals
    BEFORE INSERT OR UPDATE ON public.sales_invoices
    FOR EACH ROW
    WHEN (NEW.invoice_status != 'draft')
    EXECUTE FUNCTION fn_validate_sales_invoice_totals();

DROP TRIGGER IF EXISTS trg_purchase_invoices_validate_totals ON public.purchase_invoices;
CREATE TRIGGER trg_purchase_invoices_validate_totals
    BEFORE INSERT OR UPDATE ON public.purchase_invoices
    FOR EACH ROW
    WHEN (NEW.invoice_status != 'draft')
    EXECUTE FUNCTION fn_validate_purchase_invoice_totals();


-- ===========================================================
-- SECTION 5: التحقق من حد الائتمان للعملاء
-- ===========================================================

CREATE OR REPLACE FUNCTION fn_check_customer_credit_limit()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
    v_credit_limit NUMERIC(14,2);
    v_current_balance NUMERIC(14,2);
BEGIN
    -- نتحقق فقط عند إنشاء أو تعديل فواتير مرحلة
    IF NEW.invoice_status NOT IN ('posted') THEN
        RETURN NEW;
    END IF;

    -- جلب حد الائتمان والرصيد الحالي للعميل
    SELECT credit_limit, current_balance
    INTO v_credit_limit, v_current_balance
    FROM customers
    WHERE id = NEW.customer_id;

    -- إذا كانت الفاتورة جديدة، نحسب الرصيد الجديد
    IF TG_OP = 'INSERT' THEN
        IF v_current_balance + NEW.total_amount > v_credit_limit THEN
            RAISE EXCEPTION 'تجاوز حد الائتمان للعميل. الحد: %، الرصيد الحالي: %، الفاتورة الجديدة: %',
                v_credit_limit, v_current_balance, NEW.total_amount;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sales_invoices_check_credit ON public.sales_invoices;
CREATE TRIGGER trg_sales_invoices_check_credit
    BEFORE INSERT OR UPDATE ON public.sales_invoices
    FOR EACH ROW
    EXECUTE FUNCTION fn_check_customer_credit_limit();


-- ===========================================================
-- SECTION 6: مزامنة أرصدة العملاء والموردين
-- ===========================================================

-- دالة لتحديث رصيد العميل تلقائياً
CREATE OR REPLACE FUNCTION fn_update_customer_balance()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
    v_customer_id UUID;
BEGIN
    IF TG_OP = 'DELETE' THEN
        v_customer_id := OLD.customer_id;
    ELSE
        v_customer_id := NEW.customer_id;
    END IF;

    UPDATE customers
    SET current_balance = (
        SELECT COALESCE(SUM(total_amount - paid_amount), 0)
        FROM sales_invoices
        WHERE customer_id = v_customer_id
          AND invoice_status = 'posted'
    )
    WHERE id = v_customer_id;

    RETURN COALESCE(NEW, OLD);
END;
$$;

-- دالة لتحديث رصيد المورد تلقائياً
CREATE OR REPLACE FUNCTION fn_update_supplier_balance()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
    v_supplier_id UUID;
BEGIN
    IF TG_OP = 'DELETE' THEN
        v_supplier_id := OLD.supplier_id;
    ELSE
        v_supplier_id := NEW.supplier_id;
    END IF;

    UPDATE suppliers
    SET current_balance = (
        SELECT COALESCE(SUM(total_amount - paid_amount), 0)
        FROM purchase_invoices
        WHERE supplier_id = v_supplier_id
          AND invoice_status = 'posted'
    )
    WHERE id = v_supplier_id;

    RETURN COALESCE(NEW, OLD);
END;
$$;

-- Triggers لمزامنة الأرصدة
DROP TRIGGER IF EXISTS trg_sales_invoices_update_balance ON public.sales_invoices;
CREATE TRIGGER trg_sales_invoices_update_balance
    AFTER INSERT OR UPDATE OR DELETE ON public.sales_invoices
    FOR EACH ROW
    EXECUTE FUNCTION fn_update_customer_balance();

DROP TRIGGER IF EXISTS trg_purchase_invoices_update_balance ON public.purchase_invoices;
CREATE TRIGGER trg_purchase_invoices_update_balance
    AFTER INSERT OR UPDATE OR DELETE ON public.purchase_invoices
    FOR EACH ROW
    EXECUTE FUNCTION fn_update_supplier_balance();

-- دالة يدوية لإعادة مزامنة جميع الأرصدة
CREATE OR REPLACE FUNCTION fn_reconcile_all_balances()
RETURNS TABLE(
    entity_type TEXT,
    entity_id UUID,
    old_balance NUMERIC(14,2),
    new_balance NUMERIC(14,2),
    difference NUMERIC(14,2)
) LANGUAGE plpgsql AS $$
BEGIN
    -- مزامنة أرصدة العملاء
    RETURN QUERY
    UPDATE customers c
    SET current_balance = (
        SELECT COALESCE(SUM(si.total_amount - si.paid_amount), 0)
        FROM sales_invoices si
        WHERE si.customer_id = c.id
          AND si.invoice_status = 'posted'
    )
    RETURNING 'customer'::TEXT,
              c.id,
              c.current_balance,
              (SELECT COALESCE(SUM(si.total_amount - si.paid_amount), 0)
               FROM sales_invoices si
               WHERE si.customer_id = c.id AND si.invoice_status = 'posted'),
              (SELECT COALESCE(SUM(si.total_amount - si.paid_amount), 0)
               FROM sales_invoices si
               WHERE si.customer_id = c.id AND si.invoice_status = 'posted') - c.current_balance;

    -- مزامنة أرصدة الموردين
    RETURN QUERY
    UPDATE suppliers s
    SET current_balance = (
        SELECT COALESCE(SUM(pi.total_amount - pi.paid_amount), 0)
        FROM purchase_invoices pi
        WHERE pi.supplier_id = s.id
          AND pi.invoice_status = 'posted'
    )
    RETURNING 'supplier'::TEXT,
              s.id,
              s.current_balance,
              (SELECT COALESCE(SUM(pi.total_amount - pi.paid_amount), 0)
               FROM purchase_invoices pi
               WHERE pi.supplier_id = s.id AND pi.invoice_status = 'posted'),
              (SELECT COALESCE(SUM(pi.total_amount - pi.paid_amount), 0)
               FROM purchase_invoices pi
               WHERE pi.supplier_id = s.id AND pi.invoice_status = 'posted') - s.current_balance;
END;
$$;


-- ===========================================================
-- SECTION 7: دوال حركة المخزون الذرية
-- ===========================================================

CREATE OR REPLACE FUNCTION fn_process_stock_movement(
    p_product_id UUID,
    p_warehouse_id UUID,
    p_movement_type TEXT,
    p_quantity NUMERIC,
    p_reference_type TEXT DEFAULT NULL,
    p_reference_id UUID DEFAULT NULL,
    p_notes TEXT DEFAULT NULL
) RETURNS UUID LANGUAGE plpgsql AS $$
DECLARE
    v_movement_id UUID;
    v_quantity_delta NUMERIC;
BEGIN
    -- تحديد اتجاه التغيير في الكمية
    v_quantity_delta := CASE
        WHEN p_movement_type IN ('purchase', 'adjustment_in', 'transfer_in', 'return_from_customer')
            THEN p_quantity
        WHEN p_movement_type IN ('sale', 'adjustment_out', 'transfer_out', 'return_to_supplier', 'damage', 'loss')
            THEN -p_quantity
        ELSE 0
    END;

    -- إدراج سجل الحركة
    INSERT INTO stock_movements (
        company_id,
        product_id,
        warehouse_id,
        movement_type,
        quantity,
        reference_type,
        reference_id,
        notes,
        created_by
    ) VALUES (
        fn_my_company_id(),
        p_product_id,
        p_warehouse_id,
        p_movement_type,
        p_quantity,
        p_reference_type,
        p_reference_id,
        p_notes,
        auth.uid()
    ) RETURNING id INTO v_movement_id;

    -- تحديث المخزون
    UPDATE inventory_stock
    SET quantity_on_hand = quantity_on_hand + v_quantity_delta,
        last_movement_at = NOW()
    WHERE product_id = p_product_id
      AND warehouse_id = p_warehouse_id
      AND company_id = fn_my_company_id();

    -- إنشاء سجل جديد إذا لم يكن موجوداً
    IF NOT FOUND THEN
        IF v_quantity_delta >= 0 THEN
            INSERT INTO inventory_stock (
                company_id,
                product_id,
                warehouse_id,
                quantity_on_hand,
                quantity_reserved,
                last_movement_at
            ) VALUES (
                fn_my_company_id(),
                p_product_id,
                p_warehouse_id,
                v_quantity_delta,
                0,
                NOW()
            );
        ELSE
            RAISE EXCEPTION 'لا يمكن إنشاء سجل مخزون بكمية سالبة';
        END IF;
    END IF;

    RETURN v_movement_id;
END;
$$;

-- دالة لنقل المخزون بين المستودعات
CREATE OR REPLACE FUNCTION fn_transfer_stock(
    p_product_id UUID,
    p_from_warehouse_id UUID,
    p_to_warehouse_id UUID,
    p_quantity NUMERIC,
    p_notes TEXT DEFAULT NULL
) RETURNS TABLE(
    transfer_out_id UUID,
    transfer_in_id UUID
) LANGUAGE plpgsql AS $$
DECLARE
    v_out_id UUID;
    v_in_id UUID;
    v_available NUMERIC;
BEGIN
    -- التحقق من أن المستودعين مختلفين
    IF p_from_warehouse_id = p_to_warehouse_id THEN
        RAISE EXCEPTION 'لا يمكن نقل المخزون إلى نفس المستودع';
    END IF;

    -- التحقق من توفر الكمية
    SELECT quantity_on_hand - quantity_reserved INTO v_available
    FROM inventory_stock
    WHERE product_id = p_product_id
      AND warehouse_id = p_from_warehouse_id
      AND company_id = fn_my_company_id();

    IF v_available IS NULL OR v_available < p_quantity THEN
        RAISE EXCEPTION 'الكمية المتاحة غير كافية في المستودع المصدر';
    END IF;

    -- خصم من المستودع المصدر
    v_out_id := fn_process_stock_movement(
        p_product_id,
        p_from_warehouse_id,
        'transfer_out',
        p_quantity,
        'stock_transfer',
        NULL,
        p_notes
    );

    -- إضافة إلى المستودع الوجهة
    v_in_id := fn_process_stock_movement(
        p_product_id,
        p_to_warehouse_id,
        'transfer_in',
        p_quantity,
        'stock_transfer',
        v_out_id,
        p_notes
    );

    -- ربط الحركتين ببعضهما
    UPDATE stock_movements
    SET reference_id = v_in_id
    WHERE id = v_out_id;

    RETURN QUERY SELECT v_out_id, v_in_id;
END;
$$;


-- ===========================================================
-- SECTION 8: كشف الفواتير المتأخرة
-- ===========================================================

-- تحديث constraint للسماح بحالة 'overdue'
DO $$
BEGIN
    ALTER TABLE sales_invoices DROP CONSTRAINT IF EXISTS sales_invoices_payment_status_check;
    ALTER TABLE sales_invoices
    ADD CONSTRAINT sales_invoices_payment_status_check
    CHECK (payment_status IN ('unpaid', 'partially_paid', 'paid', 'overdue'));
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- دالة لتمييز الفواتير المتأخرة
CREATE OR REPLACE FUNCTION fn_mark_overdue_invoices()
RETURNS TABLE(
    invoice_id UUID,
    invoice_number TEXT,
    customer_name TEXT,
    days_overdue INTEGER,
    outstanding_amount NUMERIC(14,2)
) LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY
    WITH updated_invoices AS (
        UPDATE sales_invoices si
        SET payment_status = 'overdue'
        WHERE si.payment_status IN ('unpaid', 'partially_paid')
          AND si.due_date < CURRENT_DATE
          AND si.invoice_status = 'posted'
        RETURNING si.id, si.invoice_number, si.customer_id, si.due_date,
                  (si.total_amount - si.paid_amount) as outstanding
    )
    SELECT
        ui.id,
        ui.invoice_number,
        c.shop_name,
        (CURRENT_DATE - ui.due_date)::INTEGER as days_overdue,
        ui.outstanding
    FROM updated_invoices ui
    JOIN customers c ON c.id = ui.customer_id
    ORDER BY days_overdue DESC;
END;
$$;

-- دالة لحساب حالة الدفع تلقائياً
CREATE OR REPLACE FUNCTION fn_calculate_payment_status(
    p_total_amount NUMERIC(14,2),
    p_paid_amount NUMERIC(14,2),
    p_due_date DATE
) RETURNS TEXT LANGUAGE plpgsql AS $$
BEGIN
    IF p_paid_amount = 0 THEN
        IF p_due_date < CURRENT_DATE THEN
            RETURN 'overdue';
        ELSE
            RETURN 'unpaid';
        END IF;
    ELSIF p_paid_amount >= p_total_amount THEN
        RETURN 'paid';
    ELSE
        IF p_due_date < CURRENT_DATE THEN
            RETURN 'overdue';
        ELSE
            RETURN 'partially_paid';
        END IF;
    END IF;
END;
$$;


-- ===========================================================
-- SECTION 9: تحسينات Audit Log
-- ===========================================================

-- إضافة Audit للتغييرات على الملفات الشخصية
CREATE OR REPLACE FUNCTION fn_audit_profile_changes()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        IF OLD.role != NEW.role OR OLD.status != NEW.status OR OLD.company_id != NEW.company_id THEN
            INSERT INTO audit_logs (
                company_id,
                table_name,
                record_id,
                action,
                old_data,
                new_data,
                user_id
            ) VALUES (
                COALESCE(NEW.company_id, OLD.company_id),
                'profiles',
                NEW.id::TEXT,
                'UPDATE',
                jsonb_build_object(
                    'role', OLD.role,
                    'status', OLD.status,
                    'company_id', OLD.company_id,
                    'branch_id', OLD.branch_id
                ),
                jsonb_build_object(
                    'role', NEW.role,
                    'status', NEW.status,
                    'company_id', NEW.company_id,
                    'branch_id', NEW.branch_id
                ),
                auth.uid()
            );
        END IF;
    ELSIF TG_OP = 'INSERT' THEN
        INSERT INTO audit_logs (
            company_id,
            table_name,
            record_id,
            action,
            new_data,
            user_id
        ) VALUES (
            NEW.company_id,
            'profiles',
            NEW.id::TEXT,
            'INSERT',
            jsonb_build_object(
                'full_name', NEW.full_name,
                'role', NEW.role,
                'status', NEW.status
            ),
            auth.uid()
        );
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_profiles ON public.profiles;
CREATE TRIGGER trg_audit_profiles
    AFTER INSERT OR UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION fn_audit_profile_changes();

-- إضافة Audit للتغييرات على الإعدادات
CREATE OR REPLACE FUNCTION fn_audit_settings_changes()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        INSERT INTO audit_logs (
            company_id,
            table_name,
            record_id,
            action,
            old_data,
            new_data,
            user_id
        ) VALUES (
            NEW.company_id,
            'app_settings',
            NEW.id::TEXT,
            'UPDATE',
            jsonb_build_object(
                'setting_key', OLD.setting_key,
                'setting_value_json', OLD.setting_value_json
            ),
            jsonb_build_object(
                'setting_key', NEW.setting_key,
                'setting_value_json', NEW.setting_value_json
            ),
            auth.uid()
        );
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_app_settings ON public.app_settings;
CREATE TRIGGER trg_audit_app_settings
    AFTER UPDATE ON public.app_settings
    FOR EACH ROW
    EXECUTE FUNCTION fn_audit_settings_changes();


-- ===========================================================
-- SECTION 10: تحسينات RLS للأمان
-- ===========================================================

-- تحسين سياسة تحديث الملفات الشخصية
DROP POLICY IF EXISTS pol_profiles_update ON public.profiles;
DROP POLICY IF EXISTS pol_profiles_update_self ON public.profiles;
DROP POLICY IF EXISTS pol_profiles_update_admin ON public.profiles;

-- سياسة للمستخدم العادي (تحديث البيانات الشخصية فقط)
CREATE POLICY pol_profiles_update_self ON public.profiles
    FOR UPDATE
    USING (id = auth.uid())
    WITH CHECK (
        id = auth.uid() AND
        role = (SELECT role FROM profiles WHERE id = auth.uid()) AND
        status = (SELECT status FROM profiles WHERE id = auth.uid()) AND
        company_id = (SELECT company_id FROM profiles WHERE id = auth.uid()) AND
        branch_id = (SELECT branch_id FROM profiles WHERE id = auth.uid())
    );

-- سياسة للمسؤول (تحديث أي شيء)
CREATE POLICY pol_profiles_update_admin ON public.profiles
    FOR UPDATE
    USING (fn_is_admin())
    WITH CHECK (fn_is_admin());

-- منع الحذف الصريح للفواتير
DROP POLICY IF EXISTS pol_sales_invoices_delete ON public.sales_invoices;
DROP POLICY IF EXISTS pol_purchase_invoices_delete ON public.purchase_invoices;

CREATE POLICY pol_sales_invoices_delete ON public.sales_invoices
    FOR DELETE
    USING (
        fn_is_admin() AND
        invoice_status = 'draft'
    );

CREATE POLICY pol_purchase_invoices_delete ON public.purchase_invoices
    FOR DELETE
    USING (
        fn_is_admin() AND
        invoice_status = 'draft'
    );


-- ===========================================================
-- SECTION 11: RLS للجدول الجديد payments
-- ===========================================================

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pol_payments_select ON public.payments;
CREATE POLICY pol_payments_select ON public.payments
    FOR SELECT
    USING (company_id = fn_my_company_id());

DROP POLICY IF EXISTS pol_payments_insert ON public.payments;
CREATE POLICY pol_payments_insert ON public.payments
    FOR INSERT
    WITH CHECK (
        company_id = fn_my_company_id() AND
        fn_my_role() IN ('admin', 'accountant')
    );

DROP POLICY IF EXISTS pol_payments_update ON public.payments;
CREATE POLICY pol_payments_update ON public.payments
    FOR UPDATE
    USING (
        company_id = fn_my_company_id() AND
        fn_my_role() IN ('admin', 'accountant')
    );

DROP POLICY IF EXISTS pol_payments_delete ON public.payments;
CREATE POLICY pol_payments_delete ON public.payments
    FOR DELETE
    USING (fn_is_admin());


-- ===========================================================
-- SECTION 12: Triggers لتحديث updated_at
-- ===========================================================

DROP TRIGGER IF EXISTS trg_payments_updated_at ON public.payments;
CREATE TRIGGER trg_payments_updated_at
    BEFORE UPDATE ON public.payments
    FOR EACH ROW
    EXECUTE FUNCTION fn_set_updated_at();


-- ===========================================================
-- SECTION 13: Views محسنة للتقارير
-- ===========================================================

-- View لعرض الفواتير المتأخرة
CREATE OR REPLACE VIEW v_overdue_invoices AS
SELECT
    si.id,
    si.invoice_number,
    si.invoice_date,
    si.due_date,
    (CURRENT_DATE - si.due_date) as days_overdue,
    si.total_amount,
    si.paid_amount,
    (si.total_amount - si.paid_amount) as outstanding_amount,
    c.id as customer_id,
    c.shop_name as customer_name,
    c.owner_name,
    c.phone,
    c.current_balance as customer_balance,
    si.company_id
FROM sales_invoices si
JOIN customers c ON c.id = si.customer_id
WHERE si.payment_status IN ('unpaid', 'partially_paid', 'overdue')
  AND si.invoice_status = 'posted'
  AND si.due_date < CURRENT_DATE
ORDER BY days_overdue DESC;

-- View لعرض ملخص المدفوعات
CREATE OR REPLACE VIEW v_payment_summary AS
SELECT
    p.id,
    p.payment_number,
    p.payment_date,
    p.invoice_type,
    p.amount,
    p.payment_method,
    CASE
        WHEN p.invoice_type = 'sale' THEN si.invoice_number
        WHEN p.invoice_type = 'purchase' THEN pi.invoice_number
    END as invoice_number,
    CASE
        WHEN p.invoice_type = 'sale' THEN c.shop_name
        WHEN p.invoice_type = 'purchase' THEN s.name
    END as party_name,
    p.company_id
FROM payments p
LEFT JOIN sales_invoices si ON p.invoice_type = 'sale' AND p.invoice_id = si.id
LEFT JOIN purchase_invoices pi ON p.invoice_type = 'purchase' AND p.invoice_id = pi.id
LEFT JOIN customers c ON si.customer_id = c.id
LEFT JOIN suppliers s ON pi.supplier_id = s.id;

-- View محسن لملخص المخزون
CREATE OR REPLACE VIEW v_inventory_valuation AS
SELECT
    ist.id,
    ist.company_id,
    ist.warehouse_id,
    w.name as warehouse_name,
    ist.product_id,
    p.name as product_name,
    p.sku,
    p.barcode,
    pc.name as category_name,
    pu.name as unit_name,
    ist.quantity_on_hand,
    ist.quantity_reserved,
    (ist.quantity_on_hand - ist.quantity_reserved) as available_quantity,
    p.purchase_price,
    p.sale_price,
    (ist.quantity_on_hand * p.purchase_price) as inventory_value_at_cost,
    (ist.quantity_on_hand * p.sale_price) as inventory_value_at_selling_price,
    p.reorder_level,
    CASE
        WHEN ist.quantity_on_hand <= p.reorder_level THEN true
        ELSE false
    END as is_low_stock,
    p.status as product_status
FROM inventory_stock ist
JOIN products p ON p.id = ist.product_id
JOIN warehouses w ON w.id = ist.warehouse_id
LEFT JOIN product_categories pc ON pc.id = p.category_id
LEFT JOIN product_units pu ON pu.id = p.unit_id
WHERE p.deleted_at IS NULL
ORDER BY w.name, p.name;


-- ===========================================================
-- SECTION 14: قيود إضافية للتحقق من صحة البيانات
-- ===========================================================

-- التحقق من أن سعر البيع >= الحد الأدنى
DO $$
BEGIN
    ALTER TABLE products DROP CONSTRAINT IF EXISTS chk_products_sale_price_vs_min;
    ALTER TABLE products
    ADD CONSTRAINT chk_products_sale_price_vs_min
    CHECK (sale_price >= min_sale_price);
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- التحقق من أن تاريخ الاستحقاق >= تاريخ الفاتورة
DO $$
BEGIN
    ALTER TABLE sales_invoices DROP CONSTRAINT IF EXISTS chk_sales_due_date;
    ALTER TABLE sales_invoices
    ADD CONSTRAINT chk_sales_due_date
    CHECK (due_date >= invoice_date);
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER TABLE purchase_invoices DROP CONSTRAINT IF EXISTS chk_purchase_due_date;
    ALTER TABLE purchase_invoices
    ADD CONSTRAINT chk_purchase_due_date
    CHECK (due_date >= invoice_date);
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- التحقق من أن الخصم لا يتجاوز الإجمالي
DO $$
BEGIN
    ALTER TABLE sales_invoices DROP CONSTRAINT IF EXISTS chk_sales_discount;
    ALTER TABLE sales_invoices
    ADD CONSTRAINT chk_sales_discount
    CHECK (discount_amount <= subtotal_amount);
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER TABLE purchase_invoices DROP CONSTRAINT IF EXISTS chk_purchase_discount;
    ALTER TABLE purchase_invoices
    ADD CONSTRAINT chk_purchase_discount
    CHECK (discount_amount <= subtotal_amount);
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;


-- ===========================================================
-- SECTION 15: دالة لحساب قيمة المخزون الإجمالي
-- ===========================================================

CREATE OR REPLACE FUNCTION fn_calculate_total_inventory_value(
    p_company_id UUID DEFAULT NULL,
    p_warehouse_id UUID DEFAULT NULL,
    p_valuation_method TEXT DEFAULT 'cost'
) RETURNS TABLE(
    total_items BIGINT,
    total_quantity NUMERIC,
    total_value NUMERIC(14,2)
) LANGUAGE plpgsql AS $$
DECLARE
    v_company_id UUID;
BEGIN
    v_company_id := COALESCE(p_company_id, fn_my_company_id());

    RETURN QUERY
    SELECT
        COUNT(DISTINCT ist.product_id)::BIGINT as total_items,
        SUM(ist.quantity_on_hand) as total_quantity,
        CASE
            WHEN p_valuation_method = 'cost' THEN
                SUM(ist.quantity_on_hand * p.purchase_price)
            ELSE
                SUM(ist.quantity_on_hand * p.sale_price)
        END::NUMERIC(14,2) as total_value
    FROM inventory_stock ist
    JOIN products p ON p.id = ist.product_id
    WHERE ist.company_id = v_company_id
      AND (p_warehouse_id IS NULL OR ist.warehouse_id = p_warehouse_id)
      AND p.deleted_at IS NULL;
END;
$$;


-- ===========================================================
-- النهاية - تم تطبيق جميع التحسينات بنجاح!
-- ===========================================================

-- تعليقات ختامية
COMMENT ON FUNCTION fn_process_stock_movement IS 'دالة ذرية لمعالجة حركة المخزون';
COMMENT ON FUNCTION fn_transfer_stock IS 'دالة لنقل المخزون بين المستودعات';
COMMENT ON FUNCTION fn_validate_sales_invoice_totals IS 'التحقق من صحة حسابات فاتورة البيع';
COMMENT ON FUNCTION fn_validate_purchase_invoice_totals IS 'التحقق من صحة حسابات فاتورة الشراء';
COMMENT ON FUNCTION fn_update_customer_balance IS 'تحديث رصيد العميل تلقائياً';
COMMENT ON FUNCTION fn_update_supplier_balance IS 'تحديث رصيد المورد تلقائياً';
COMMENT ON FUNCTION fn_reconcile_all_balances IS 'إعادة مزامنة جميع الأرصدة';
COMMENT ON FUNCTION fn_mark_overdue_invoices IS 'تمييز الفواتير المتأخرة';
COMMENT ON FUNCTION fn_calculate_payment_status IS 'حساب حالة الدفع';
COMMENT ON VIEW v_overdue_invoices IS 'عرض الفواتير المتأخرة';
COMMENT ON VIEW v_payment_summary IS 'ملخص المدفوعات';
COMMENT ON VIEW v_inventory_valuation IS 'تقييم المخزون';

DO $$
BEGIN
    RAISE NOTICE '✅ تم تطبيق جميع تحسينات قاعدة البيانات بنجاح!';
    RAISE NOTICE '';
    RAISE NOTICE 'التحسينات المطبقة:';
    RAISE NOTICE '1. ✅ إضافة 15 Composite Index للأداء';
    RAISE NOTICE '2. ✅ إنشاء جدول المدفوعات (payments)';
    RAISE NOTICE '3. ✅ نظام ترقيم تلقائي للفواتير والمدفوعات';
    RAISE NOTICE '4. ✅ دوال التحقق من صحة الفواتير';
    RAISE NOTICE '5. ✅ التحقق من حد الائتمان للعملاء';
    RAISE NOTICE '6. ✅ مزامنة تلقائية لأرصدة العملاء والموردين';
    RAISE NOTICE '7. ✅ دوال ذرية لحركة المخزون';
    RAISE NOTICE '8. ✅ دالة نقل المخزون بين المستودعات';
    RAISE NOTICE '9. ✅ كشف الفواتير المتأخرة تلقائياً';
    RAISE NOTICE '10. ✅ Audit Log للملفات الشخصية والإعدادات';
    RAISE NOTICE '11. ✅ تحسين سياسات RLS للأمان';
    RAISE NOTICE '12. ✅ 3 Views جديدة للتقارير';
    RAISE NOTICE '13. ✅ قيود إضافية للتحقق من صحة البيانات';
END $$;
