-- ============================================================
-- TiGeR ERP — Database Improvements Verification Script
-- اختبار التحقق من تطبيق التحسينات
-- ============================================================

-- يمكن تشغيل هذا السكريبت بعد تطبيق 20260510_database_improvements.sql
-- للتحقق من أن جميع التحسينات تم تطبيقها بنجاح

\echo '========================================='
\echo 'اختبار التحقق من تحسينات قاعدة البيانات'
\echo '========================================='
\echo ''

-- ===========================================================
-- SECTION 1: التحقق من الـ Indexes الجديدة
-- ===========================================================

\echo '1. التحقق من Composite Indexes...'

SELECT
    CASE
        WHEN COUNT(*) >= 15 THEN '✅ تم إنشاء ' || COUNT(*) || ' فهرس مركب'
        ELSE '❌ يجب أن يكون هناك 15+ فهرس مركب، موجود فقط ' || COUNT(*)
    END as result
FROM pg_indexes
WHERE schemaname = 'public'
  AND (
      indexname LIKE '%_company_%'
      OR indexname LIKE '%_overdue%'
      OR indexname LIKE '%_search%'
  );

\echo ''

-- ===========================================================
-- SECTION 2: التحقق من الجداول الجديدة
-- ===========================================================

\echo '2. التحقق من جدول payments...'

SELECT
    CASE
        WHEN EXISTS (SELECT 1 FROM information_schema.tables
                     WHERE table_schema = 'public' AND table_name = 'payments')
        THEN '✅ جدول payments موجود'
        ELSE '❌ جدول payments غير موجود'
    END as result;

\echo ''

-- ===========================================================
-- SECTION 3: التحقق من الـ Sequences
-- ===========================================================

\echo '3. التحقق من Sequences الترقيم التلقائي...'

SELECT
    CASE
        WHEN COUNT(*) >= 3 THEN '✅ تم إنشاء ' || COUNT(*) || ' sequence'
        ELSE '❌ يجب أن يكون هناك 3 sequences'
    END as result
FROM information_schema.sequences
WHERE sequence_schema = 'public'
  AND sequence_name LIKE 'seq_%';

\echo ''

-- ===========================================================
-- SECTION 4: التحقق من الدوال الجديدة
-- ===========================================================

\echo '4. التحقق من الدوال الجديدة...'

WITH expected_functions AS (
    SELECT unnest(ARRAY[
        'fn_generate_sales_invoice_number',
        'fn_generate_purchase_invoice_number',
        'fn_generate_payment_number',
        'fn_validate_sales_invoice_totals',
        'fn_validate_purchase_invoice_totals',
        'fn_check_customer_credit_limit',
        'fn_update_customer_balance',
        'fn_update_supplier_balance',
        'fn_reconcile_all_balances',
        'fn_process_stock_movement',
        'fn_transfer_stock',
        'fn_mark_overdue_invoices',
        'fn_calculate_payment_status',
        'fn_audit_profile_changes',
        'fn_audit_settings_changes',
        'fn_calculate_total_inventory_value'
    ]) AS function_name
),
existing_functions AS (
    SELECT routine_name
    FROM information_schema.routines
    WHERE routine_schema = 'public'
      AND routine_type = 'FUNCTION'
)
SELECT
    '✅ الدالة ' || ef.function_name || ' موجودة' as result
FROM expected_functions ef
JOIN existing_functions ex ON ex.routine_name = ef.function_name
UNION ALL
SELECT
    '❌ الدالة ' || ef.function_name || ' مفقودة' as result
FROM expected_functions ef
WHERE NOT EXISTS (
    SELECT 1 FROM existing_functions ex
    WHERE ex.routine_name = ef.function_name
)
ORDER BY result;

\echo ''

-- ===========================================================
-- SECTION 5: التحقق من الـ Views الجديدة
-- ===========================================================

\echo '5. التحقق من Views الجديدة...'

WITH expected_views AS (
    SELECT unnest(ARRAY[
        'v_overdue_invoices',
        'v_payment_summary',
        'v_inventory_valuation'
    ]) AS view_name
),
existing_views AS (
    SELECT table_name
    FROM information_schema.views
    WHERE table_schema = 'public'
)
SELECT
    '✅ الـ View ' || ev.view_name || ' موجود' as result
FROM expected_views ev
JOIN existing_views ex ON ex.table_name = ev.view_name
UNION ALL
SELECT
    '❌ الـ View ' || ev.view_name || ' مفقود' as result
FROM expected_views ev
WHERE NOT EXISTS (
    SELECT 1 FROM existing_views ex
    WHERE ex.table_name = ev.view_name
)
ORDER BY result;

\echo ''

-- ===========================================================
-- SECTION 6: التحقق من الـ Triggers
-- ===========================================================

\echo '6. التحقق من Triggers الجديدة...'

WITH expected_triggers AS (
    SELECT unnest(ARRAY[
        'trg_sales_invoices_validate_totals',
        'trg_purchase_invoices_validate_totals',
        'trg_sales_invoices_check_credit',
        'trg_sales_invoices_update_balance',
        'trg_purchase_invoices_update_balance',
        'trg_audit_profiles',
        'trg_audit_app_settings',
        'trg_payments_updated_at'
    ]) AS trigger_name
)
SELECT
    CASE
        WHEN COUNT(*) >= 8 THEN '✅ تم إنشاء ' || COUNT(*) || ' trigger'
        ELSE '❌ يجب أن يكون هناك 8 triggers'
    END as result
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
JOIN expected_triggers et ON t.tgname = et.trigger_name
WHERE c.relnamespace = 'public'::regnamespace;

\echo ''

-- ===========================================================
-- SECTION 7: التحقق من RLS Policies
-- ===========================================================

\echo '7. التحقق من RLS Policies المحسّنة...'

-- التحقق من policy للـ profiles
SELECT
    CASE
        WHEN EXISTS (
            SELECT 1 FROM pg_policies
            WHERE schemaname = 'public'
              AND tablename = 'profiles'
              AND policyname = 'pol_profiles_update_self'
        )
        THEN '✅ Policy profiles_update_self موجودة'
        ELSE '❌ Policy profiles_update_self مفقودة'
    END as result;

-- التحقق من policies للـ payments
SELECT
    CASE
        WHEN COUNT(*) >= 4 THEN '✅ تم إنشاء ' || COUNT(*) || ' policies لجدول payments'
        ELSE '❌ يجب أن يكون هناك 4 policies لجدول payments'
    END as result
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'payments';

\echo ''

-- ===========================================================
-- SECTION 8: التحقق من القيود الجديدة
-- ===========================================================

\echo '8. التحقق من CHECK Constraints الجديدة...'

SELECT
    CASE
        WHEN EXISTS (
            SELECT 1 FROM information_schema.check_constraints
            WHERE constraint_schema = 'public'
              AND constraint_name LIKE '%payment_status%'
              AND check_clause LIKE '%overdue%'
        )
        THEN '✅ تم تحديث constraint payment_status لدعم overdue'
        ELSE '❌ constraint payment_status لم يتم تحديثه'
    END as result;

\echo ''

-- ===========================================================
-- SECTION 9: اختبار عملي للدوال
-- ===========================================================

\echo '9. اختبار عملي للدوال...'

-- اختبار fn_calculate_payment_status
\echo '   - اختبار fn_calculate_payment_status...'
SELECT
    CASE
        WHEN fn_calculate_payment_status(1000.00, 0.00, CURRENT_DATE - 5) = 'overdue'
        THEN '✅ الدالة تعمل بشكل صحيح (overdue)'
        ELSE '❌ الدالة لا تعمل بشكل صحيح'
    END as result;

SELECT
    CASE
        WHEN fn_calculate_payment_status(1000.00, 500.00, CURRENT_DATE + 10) = 'partially_paid'
        THEN '✅ الدالة تعمل بشكل صحيح (partially_paid)'
        ELSE '❌ الدالة لا تعمل بشكل صحيح'
    END as result;

SELECT
    CASE
        WHEN fn_calculate_payment_status(1000.00, 1000.00, CURRENT_DATE) = 'paid'
        THEN '✅ الدالة تعمل بشكل صحيح (paid)'
        ELSE '❌ الدالة لا تعمل بشكل صحيح'
    END as result;

\echo ''

-- ===========================================================
-- SECTION 10: ملخص نهائي
-- ===========================================================

\echo '========================================='
\echo 'ملخص التحقق'
\echo '========================================='

WITH verification_summary AS (
    SELECT
        COUNT(*) FILTER (WHERE indexname LIKE '%_company_%') as composite_indexes,
        (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'payments') as payments_table,
        (SELECT COUNT(*) FROM information_schema.sequences WHERE sequence_schema = 'public' AND sequence_name LIKE 'seq_%') as sequences,
        (SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema = 'public' AND routine_name LIKE 'fn_%') as functions,
        (SELECT COUNT(*) FROM information_schema.views WHERE table_schema = 'public' AND table_name LIKE 'v_%') as views,
        (SELECT COUNT(*) FROM pg_trigger WHERE tgname LIKE 'trg_%') as triggers
    FROM pg_indexes
    WHERE schemaname = 'public'
)
SELECT
    '📊 إحصائيات التحسينات المطبقة:' as summary
UNION ALL
SELECT '  - Composite Indexes: ' || composite_indexes || ' (متوقع: 15+)'
FROM verification_summary
UNION ALL
SELECT '  - جدول payments: ' || CASE WHEN payments_table > 0 THEN 'موجود ✅' ELSE 'مفقود ❌' END
FROM verification_summary
UNION ALL
SELECT '  - Sequences: ' || sequences || ' (متوقع: 3)'
FROM verification_summary
UNION ALL
SELECT '  - Functions: ' || functions || ' (متوقع: 16+)'
FROM verification_summary
UNION ALL
SELECT '  - Views: ' || views || ' (متوقع: 3+)'
FROM verification_summary
UNION ALL
SELECT '  - Triggers: ' || triggers || ' (متوقع: 8+)'
FROM verification_summary;

\echo ''
\echo '========================================='
\echo 'انتهى اختبار التحقق'
\echo '========================================='
\echo ''
\echo 'إذا ظهرت علامات ✅ في جميع الاختبارات، فقد تم تطبيق التحسينات بنجاح!'
\echo 'إذا ظهرت علامات ❌، راجع السكريبت وتأكد من تطبيقه بالكامل.'
\echo ''
