/**
 * tests/db-utils.test.js
 *
 * Unit tests for the database-utility constants and functions exported from
 * js/supabase-client.js and mirrored in js/business-logic.js.
 *
 * Tests are written against supabase-client.js directly so that any
 * accidental divergence from business-logic.js is caught at the same time.
 *
 * Coverage areas:
 *  1. TABLE_NAME_MAP — all canonical aliases resolve to expected table names
 *  2. SOFT_DELETE_TABLES — correct members
 *  3. CANCEL_STATUS_MAP — correct column/value pairs for each table
 *  4. TABLES_WITHOUT_COMPANY_ID — correct members
 *  5. FIELDS_TO_IGNORE_BY_TABLE — correct ignored fields per table
 *  6. _toTableName — passthrough for unknown names, mapping for known aliases
 *  7. _camelToSnake / _snakeToCamel (imported from supabase-client)
 *  8. _keysToSnake — FIELDS_TO_IGNORE_BY_TABLE applied correctly
 *  9. _keysToCamel — full roundtrip
 * 10. Consistency check: constants in supabase-client match business-logic.js
 */

'use strict';

// supabase-client.js references window via an IIFE that exits gracefully when
// window.supabase is absent (which it will be in jsdom without the Supabase CDN).
// Jest uses jsdom so window exists; the IIFE just logs a console.error and returns.
// Suppress that expected warning to keep test output clean.
jest.spyOn(console, 'error').mockImplementation(() => {});

const client = require('../js/supabase-client');
const utils  = require('../js/business-logic');

// ===========================================================================
// 1. TABLE_NAME_MAP
// ===========================================================================
describe('TABLE_NAME_MAP', () => {
    const map = client.TABLE_NAME_MAP;

    it('contains all required legacy aliases', () => {
        expect(map.bankAccounts).toBe('bank_accounts');
        expect(map.bankTransactions).toBe('bank_transactions');
        expect(map.inventoryStock).toBe('inventory_stock');
        expect(map.inventoryTransactions).toBe('stock_movements');
        expect(map.appSettings).toBe('app_settings');
        expect(map.sales).toBe('sales_invoices');
        expect(map.purchases).toBe('purchase_invoices');
        expect(map.users).toBe('profiles');
    });

    it('contains camelCase convenience aliases', () => {
        expect(map.productCategories).toBe('product_categories');
        expect(map.productUnits).toBe('product_units');
        expect(map.salesInvoices).toBe('sales_invoices');
        expect(map.salesInvoiceItems).toBe('sales_invoice_items');
        expect(map.purchaseInvoices).toBe('purchase_invoices');
        expect(map.purchaseInvoiceItems).toBe('purchase_invoice_items');
        expect(map.stockMovements).toBe('stock_movements');
        expect(map.inventoryStockItems).toBe('inventory_stock');
        expect(map.supplierCategories).toBe('supplier_categories');
        expect(map.bankAcct).toBe('bank_accounts');
        expect(map.chartOfAccounts).toBe('chart_of_accounts');
        expect(map.journalEntries).toBe('journal_entries');
        expect(map.journalEntryLines).toBe('journal_entry_lines');
        expect(map.auditLogs).toBe('audit_logs');
    });

    it('business-logic TABLE_NAME_MAP matches supabase-client TABLE_NAME_MAP', () => {
        expect(utils.TABLE_NAME_MAP).toEqual(client.TABLE_NAME_MAP);
    });
});

// ===========================================================================
// 2. SOFT_DELETE_TABLES
// ===========================================================================
describe('SOFT_DELETE_TABLES', () => {
    const set = client.SOFT_DELETE_TABLES;

    it('contains customers, suppliers, products', () => {
        expect(set.has('customers')).toBe(true);
        expect(set.has('suppliers')).toBe(true);
        expect(set.has('products')).toBe(true);
    });

    it('does NOT contain invoice tables (those use invoice_status = cancelled)', () => {
        expect(set.has('sales_invoices')).toBe(false);
        expect(set.has('purchase_invoices')).toBe(false);
    });

    it('business-logic SOFT_DELETE_TABLES matches supabase-client', () => {
        // Compare as arrays since Sets don't have a built-in equals
        expect([...utils.SOFT_DELETE_TABLES].sort()).toEqual([...client.SOFT_DELETE_TABLES].sort());
    });
});

// ===========================================================================
// 3. CANCEL_STATUS_MAP
// ===========================================================================
describe('CANCEL_STATUS_MAP', () => {
    const map = client.CANCEL_STATUS_MAP;

    it('maps sales_invoices to invoice_status = cancelled', () => {
        expect(map.sales_invoices).toEqual({ column: 'invoice_status', value: 'cancelled' });
    });

    it('maps purchase_invoices to invoice_status = cancelled', () => {
        expect(map.purchase_invoices).toEqual({ column: 'invoice_status', value: 'cancelled' });
    });

    it('maps journal_entries to status = reversed', () => {
        expect(map.journal_entries).toEqual({ column: 'status', value: 'reversed' });
    });

    it('does not contain an entry for customers (soft-deleted via deleted_at instead)', () => {
        expect(map.customers).toBeUndefined();
    });

    it('business-logic CANCEL_STATUS_MAP matches supabase-client', () => {
        expect(utils.CANCEL_STATUS_MAP).toEqual(client.CANCEL_STATUS_MAP);
    });
});

// ===========================================================================
// 4. TABLES_WITHOUT_COMPANY_ID
// ===========================================================================
describe('TABLES_WITHOUT_COMPANY_ID', () => {
    const set = client.TABLES_WITHOUT_COMPANY_ID;

    it('contains the expected child tables', () => {
        expect(set.has('sales_invoice_items')).toBe(true);
        expect(set.has('purchase_invoice_items')).toBe(true);
        expect(set.has('supplier_categories')).toBe(true);
        expect(set.has('journal_entry_lines')).toBe(true);
        expect(set.has('audit_logs')).toBe(true);
    });

    it('does NOT contain parent/top-level tables', () => {
        expect(set.has('customers')).toBe(false);
        expect(set.has('products')).toBe(false);
        expect(set.has('sales_invoices')).toBe(false);
        expect(set.has('purchase_invoices')).toBe(false);
        expect(set.has('warehouses')).toBe(false);
    });

    it('business-logic TABLES_WITHOUT_COMPANY_ID matches supabase-client', () => {
        expect([...utils.TABLES_WITHOUT_COMPANY_ID].sort()).toEqual(
            [...client.TABLES_WITHOUT_COMPANY_ID].sort()
        );
    });
});

// ===========================================================================
// 5. FIELDS_TO_IGNORE_BY_TABLE
// ===========================================================================
describe('FIELDS_TO_IGNORE_BY_TABLE', () => {
    const map = client.FIELDS_TO_IGNORE_BY_TABLE;

    it('ignores "items" for sales_invoices', () => {
        expect(map.sales_invoices).toContain('items');
    });

    it('ignores "items" for purchase_invoices', () => {
        expect(map.purchase_invoices).toContain('items');
    });

    it('ignores product_categories / productCategories for suppliers', () => {
        expect(map.suppliers).toContain('product_categories');
        expect(map.suppliers).toContain('productCategories');
    });

    it('ignores UI-only display fields for stock_movements', () => {
        expect(map.stock_movements).toContain('warehouseName');
        expect(map.stock_movements).toContain('productName');
    });
});

// ===========================================================================
// 6. _toTableName
// ===========================================================================
describe('_toTableName', () => {
    it('resolves known camelCase aliases', () => {
        expect(client._toTableName('sales')).toBe('sales_invoices');
        expect(client._toTableName('purchases')).toBe('purchase_invoices');
        expect(client._toTableName('users')).toBe('profiles');
        expect(client._toTableName('inventoryStock')).toBe('inventory_stock');
    });

    it('returns the input unchanged for unknown / already-snake-case names', () => {
        expect(client._toTableName('customers')).toBe('customers');
        expect(client._toTableName('products')).toBe('products');
        expect(client._toTableName('warehouses')).toBe('warehouses');
        expect(client._toTableName('some_unknown_table')).toBe('some_unknown_table');
    });

    it('handles empty string', () => {
        expect(client._toTableName('')).toBe('');
    });

    it('business-logic _toTableName matches supabase-client _toTableName', () => {
        const aliases = Object.keys(client.TABLE_NAME_MAP);
        aliases.forEach(alias => {
            expect(utils._toTableName(alias)).toBe(client._toTableName(alias));
        });
    });
});

// ===========================================================================
// 7. _camelToSnake / _snakeToCamel from supabase-client
// ===========================================================================
describe('supabase-client string converters', () => {
    it('_camelToSnake converts correctly', () => {
        expect(client._camelToSnake('companyId')).toBe('company_id');
        expect(client._camelToSnake('invoiceDate')).toBe('invoice_date');
    });

    it('_snakeToCamel converts correctly', () => {
        expect(client._snakeToCamel('company_id')).toBe('companyId');
        expect(client._snakeToCamel('invoice_date')).toBe('invoiceDate');
    });

    it('match the business-logic equivalents', () => {
        const fields = ['shopName', 'openingBalance', 'creditLimit', 'totalAmount'];
        fields.forEach(f => {
            expect(client._camelToSnake(f)).toBe(utils._camelToSnake(f));
            expect(client._snakeToCamel(client._camelToSnake(f))).toBe(
                utils._snakeToCamel(utils._camelToSnake(f))
            );
        });
    });
});

// ===========================================================================
// 8. _keysToSnake — FIELDS_TO_IGNORE applied via supabase-client._keysToSnake
// ===========================================================================
describe('supabase-client _keysToSnake', () => {
    it('converts object keys from camelCase to snake_case', () => {
        const result = client._keysToSnake({ shopName: 'ACME', creditLimit: 5000 }, 'customers');
        expect(result).toHaveProperty('shop_name', 'ACME');
        expect(result).toHaveProperty('credit_limit', 5000);
    });

    it('strips fields listed in FIELDS_TO_IGNORE_BY_TABLE for the given table', () => {
        // sales_invoices should have 'items' stripped
        const result = client._keysToSnake(
            { customer_id: 'c1', items: [{ product_id: 'p1' }] },
            'sales_invoices'
        );
        expect(result).not.toHaveProperty('items');
        expect(result).toHaveProperty('customer_id');
    });

    it('strips supplier "product_categories" display field', () => {
        const result = client._keysToSnake(
            { company_name: 'Supplier Co', product_categories: ['candy'], productCategories: [] },
            'suppliers'
        );
        expect(result).not.toHaveProperty('product_categories');
        expect(result).not.toHaveProperty('productCategories');
        expect(result).toHaveProperty('company_name');
    });

    it('handles undefined table name gracefully (no fields stripped)', () => {
        const result = client._keysToSnake({ shopName: 'X' });
        expect(result).toHaveProperty('shop_name', 'X');
    });
});

// ===========================================================================
// 9. _keysToCamel roundtrip
// ===========================================================================
describe('supabase-client _keysToCamel', () => {
    it('converts snake_case keys to camelCase', () => {
        const result = client._keysToCamel({ shop_name: 'ACME', credit_limit: 100 });
        expect(result).toEqual({ shopName: 'ACME', creditLimit: 100 });
    });

    it('roundtrip: snake → camel → snake produces the original keys', () => {
        const original = { shop_name: 'ACME', invoice_date: '2024-01-01', total_amount: 500 };
        const camel    = client._keysToCamel(original);
        const snake    = client._keysToSnake(camel);
        expect(snake).toEqual(original);
    });

    it('returns non-object values unchanged', () => {
        expect(client._keysToCamel(null)).toBeNull();
        expect(client._keysToCamel([1, 2])).toEqual([1, 2]);
    });
});
