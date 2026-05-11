/**
 * js/business-logic.js
 *
 * Pure business-logic functions shared across ERP modules.
 *
 * Rules:
 *  - No DOM access.
 *  - No Supabase / network calls.
 *  - Fully testable with Jest (Node.js).
 *
 * Browser usage:
 *   Load this script before supabase-client.js and the module scripts.
 *   All helpers are available via  window.ERPUtils.xxx
 *
 * Jest / Node.js usage:
 *   const ERPUtils = require('./js/business-logic');
 */

// ===========================================================================
// camelCase ↔ snake_case utilities
// ===========================================================================

/** Convert camelCase string to snake_case. */
function _camelToSnake(str) {
    return str.replace(/([A-Z])/g, ch => '_' + ch.toLowerCase());
}

/** Convert snake_case string to camelCase. */
function _snakeToCamel(str) {
    return str.replace(/_([a-z])/g, (_, ch) => ch.toUpperCase());
}

/**
 * Return a copy of obj with keys converted to snake_case.
 * Strips fields listed in the optional fieldsToIgnore set/array.
 */
function _keysToSnake(obj, fieldsToIgnore = []) {
    if (!obj || typeof obj !== 'object') return obj;
    const ignored = new Set(Array.isArray(fieldsToIgnore) ? fieldsToIgnore : [...fieldsToIgnore]);
    const result  = {};
    for (const [key, val] of Object.entries(obj)) {
        const snakeKey = _camelToSnake(key);
        if (ignored.has(key) || ignored.has(snakeKey)) continue;
        result[snakeKey] = val;
    }
    return result;
}

/**
 * Return a copy of obj with keys converted to camelCase.
 * Used by the compat layer so existing modules receive camelCase field names.
 */
function _keysToCamel(obj) {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return obj;
    const result = {};
    for (const [key, val] of Object.entries(obj)) {
        result[_snakeToCamel(key)] = val;
    }
    return result;
}

// ===========================================================================
// ERP table / column constants
// These mirror the matching constants in supabase-client.js so both files
// stay in sync; business-logic.js is the canonical source for tests.
// ===========================================================================

/** camelCase legacy collection names → real snake_case table names */
const TABLE_NAME_MAP = {
    'bankAccounts':          'bank_accounts',
    'bankTransactions':      'bank_transactions',
    'inventoryStock':        'inventory_stock',
    'inventoryTransactions': 'stock_movements',
    'appSettings':           'app_settings',
    'sales':                 'sales_invoices',
    'purchases':             'purchase_invoices',
    'users':                 'profiles',
    'productCategories':     'product_categories',
    'productUnits':          'product_units',
    'salesInvoices':         'sales_invoices',
    'salesInvoiceItems':     'sales_invoice_items',
    'purchaseInvoices':      'purchase_invoices',
    'purchaseInvoiceItems':  'purchase_invoice_items',
    'stockMovements':        'stock_movements',
    'inventoryStockItems':   'inventory_stock',
    'supplierCategories':    'supplier_categories',
    'bankAcct':              'bank_accounts',
    'chartOfAccounts':       'chart_of_accounts',
    'journalEntries':        'journal_entries',
    'journalEntryLines':     'journal_entry_lines',
    'auditLogs':             'audit_logs',
};

/** Tables that support soft-delete via deleted_at (no hard deletes on these) */
const SOFT_DELETE_TABLES = new Set(['customers', 'suppliers', 'products']);

/**
 * Maps table names to their cancellation column + value.
 * Default (tables not listed): column='status', value='cancelled'.
 */
const CANCEL_STATUS_MAP = {
    'sales_invoices':    { column: 'invoice_status', value: 'cancelled' },
    'purchase_invoices': { column: 'invoice_status', value: 'cancelled' },
    'journal_entries':   { column: 'status',         value: 'reversed'  },
};

/** Child tables that carry no company_id column. Auto-injection is skipped for these. */
const TABLES_WITHOUT_COMPANY_ID = new Set([
    'sales_invoice_items',
    'purchase_invoice_items',
    'supplier_categories',
    'journal_entry_lines',
    'audit_logs',
]);

/** Resolve a legacy camelCase collection name to the real snake_case table name. */
function _toTableName(collectionName) {
    return TABLE_NAME_MAP[collectionName] || collectionName;
}

// ===========================================================================
// Payment / invoice helpers (shared by Sales and Purchases modules)
// ===========================================================================

/**
 * Infer the initial payment status from the chosen payment method.
 * Cash payments are considered immediately paid; all other methods start unpaid.
 * @param {string} method  e.g. 'cash' | 'credit' | 'bank_transfer' etc.
 * @returns {'paid'|'unpaid'}
 */
function inferPaymentStatus(method) {
    return method === 'cash' ? 'paid' : 'unpaid';
}

/**
 * Compute invoice totals from raw line-item amounts plus discount and tax.
 *
 * @param {number} subtotal       Sum of (qty × unit_price) for all line items.
 * @param {number} discountAmount Flat discount to deduct from the subtotal.
 * @param {number} taxRate        Tax rate expressed as a percentage (e.g. 14 = 14 %).
 * @returns {{ subtotal, discountAmount, taxRate, taxBase, taxAmount, grandTotal }}
 */
function calculateInvoiceTotals(subtotal, discountAmount, taxRate) {
    const sub  = Number(subtotal)       || 0;
    const disc = Number(discountAmount) || 0;
    const rate = Number(taxRate)        || 0;

    const taxBase   = Math.max(0, sub - disc);
    const taxAmount = taxBase * (rate / 100);
    const grandTotal = taxBase + taxAmount;

    return {
        subtotal:       sub,
        discountAmount: disc,
        taxRate:        rate,
        taxBase,
        taxAmount,
        grandTotal,
    };
}

// ===========================================================================
// Sales module — delivery status mappings
// ===========================================================================

/**
 * Convert UI delivery-status value to the DB column value.
 * @param {string} value  UI value from the form select.
 * @returns {string} DB value.
 */
function mapDeliveryUiToDb(value) {
    if (value === 'pending_delivery') return 'pending';
    if (value === 'out_for_delivery') return 'dispatched';
    if (value === 'delivered')        return 'delivered';
    return 'pending';
}

/**
 * Convert DB delivery_status column value back to the UI select value.
 * @param {string} value  DB value.
 * @returns {string} UI value.
 */
function mapDeliveryDbToUi(value) {
    if (value === 'pending')    return 'pending_delivery';
    if (value === 'dispatched') return 'out_for_delivery';
    if (value === 'delivered')  return 'delivered';
    return 'pending_delivery';
}

/**
 * Map a sales list-filter value to the DB field/value pair used for filtering.
 * @param {string} value  Filter value from the UI select.
 * @returns {{ field: string, value: string }|null}
 */
function mapSalesStatusFilterToDb(value) {
    if (value === 'pending_payment') return { field: 'payment_status', value: 'unpaid' };
    if (['unpaid', 'partially_paid', 'paid', 'overdue'].includes(value))
        return { field: 'payment_status', value };
    if (value === 'pending_delivery') return { field: 'delivery_status', value: 'pending' };
    if (value === 'delivered')        return { field: 'delivery_status', value: 'delivered' };
    if (value === 'cancelled')        return { field: 'invoice_status',  value: 'cancelled' };
    return null;
}

// ===========================================================================
// Purchases module — receipt status mappings
// ===========================================================================

/**
 * Convert UI receipt-status value to the DB column value.
 * @param {string} value  UI value from the form select.
 * @returns {string} DB value.
 */
function mapReceiptUiToDb(value) {
    if (value === 'pending_receipt')      return 'pending';
    if (value === 'partially_received')   return 'partial';
    if (value === 'received')             return 'received';
    return 'pending';
}

/**
 * Convert DB receipt_status column value back to the UI select value.
 * @param {string} value  DB value.
 * @returns {string} UI value.
 */
function mapReceiptDbToUi(value) {
    if (value === 'pending')  return 'pending_receipt';
    if (value === 'partial')  return 'partially_received';
    if (value === 'received') return 'received';
    return 'pending_receipt';
}

/**
 * Map a purchase list-filter value to the DB field/value pair used for filtering.
 * @param {string} value  Filter value from the UI select.
 * @returns {{ field: string, value: string }|null}
 */
function mapPurchaseStatusFilterToDb(value) {
    if (['unpaid', 'partially_paid', 'paid'].includes(value))
        return { field: 'payment_status', value };
    if (value === 'pending_receipt')    return { field: 'receipt_status', value: 'pending'  };
    if (value === 'partially_received') return { field: 'receipt_status', value: 'partial'  };
    if (value === 'received')           return { field: 'receipt_status', value: 'received' };
    if (value === 'cancelled')          return { field: 'invoice_status', value: 'cancelled' };
    return null;
}

// ===========================================================================
// Customers module — row ↔ view-model mapper
// ===========================================================================

/**
 * Map a raw Supabase customers row to the view-model shape used by the UI.
 * @param {Object} row  Raw row from the customers table.
 * @returns {Object}    Camel-cased view-model.
 */
function mapCustomerRowToViewModel(row) {
    return {
        id:             row.id,
        shopName:       row.shop_name       || '',
        ownerName:      row.owner_name      || '',
        phone:          row.phone           || '',
        phone2:         row.phone2          || '',
        email:          row.email           || '',
        area:           row.area            || '',
        address:        row.address         || '',
        creditLimit:    Number(row.credit_limit     || 0),
        openingBalance: Number(row.opening_balance  || 0),
        currentBalance: Number(row.current_balance  || 0),
        status:         row.status          || 'active',
        notes:          row.notes           || '',
    };
}

// ===========================================================================
// Journal-entry helpers (Accounting module)
// ===========================================================================

/**
 * Validate that a journal entry is balanced (total debits === total credits).
 * Both must be positive and equal.
 * @param {number} totalDebit
 * @param {number} totalCredit
 * @returns {'balanced'|'unbalanced'|'empty'}
 */
function getJournalBalanceStatus(totalDebit, totalCredit) {
    const d = Number(totalDebit)  || 0;
    const c = Number(totalCredit) || 0;
    if (d === 0 && c === 0) return 'empty';
    if (d === c && d > 0)   return 'balanced';
    return 'unbalanced';
}

// ===========================================================================
// Formatting helpers
// ===========================================================================

/**
 * Format a number as Egyptian Pound money string.
 * @param {number|string} n  Amount.
 * @returns {string}  e.g. "1 234.56 ج.م"
 */
function fmtMoney(n) {
    return `${(Number(n) || 0).toFixed(2)} ج.م`;
}

// ===========================================================================
// Inventory Validation
// ===========================================================================

/**
 * Validate if sufficient inventory exists for a sale.
 * @param {number} requestedQty - Quantity requested to sell
 * @param {number} availableStock - Current available stock quantity
 * @param {object} options - Additional options
 * @param {string} options.productName - Product name for error message
 * @param {boolean} options.allowNegative - Allow negative stock (default: false)
 * @returns {object} { valid: boolean, shortage: number, message: string }
 */
function validateInventoryAvailability(requestedQty, availableStock, options = {}) {
    const requested = Number(requestedQty) || 0;
    const available = Number(availableStock) || 0;
    const allowNegative = options.allowNegative || false;
    const productName = options.productName || 'المنتج';

    if (requested <= 0) {
        return {
            valid: false,
            shortage: 0,
            message: 'الكمية المطلوبة يجب أن تكون أكبر من صفر'
        };
    }

    if (allowNegative || requested <= available) {
        return {
            valid: true,
            shortage: 0,
            message: ''
        };
    }

    const shortage = requested - available;
    return {
        valid: false,
        shortage: shortage,
        message: `${productName}: الكمية المطلوبة ${requested} أكبر من المتاح ${available}. النقص: ${shortage}`
    };
}

/**
 * Validate multiple items against inventory stock.
 * @param {Array} items - Array of {product_id, product_name, quantity, warehouse_id}
 * @param {Array} stockData - Array of {product_id, warehouse_id, quantity_on_hand}
 * @param {object} options - Additional options
 * @returns {object} { valid: boolean, errors: Array, totalShortage: number }
 */
function validateItemsInventory(items, stockData, options = {}) {
    const allowNegative = options.allowNegative || false;
    const errors = [];
    let totalShortage = 0;

    // Create a map for quick stock lookup
    const stockMap = new Map();
    (stockData || []).forEach(stock => {
        const key = `${stock.product_id}_${stock.warehouse_id}`;
        stockMap.set(key, Number(stock.quantity_on_hand) || 0);
    });

    items.forEach((item, index) => {
        const key = `${item.product_id}_${item.warehouse_id}`;
        const availableStock = stockMap.get(key) || 0;
        const productName = item.product_name || `الصنف #${index + 1}`;

        const validation = validateInventoryAvailability(
            item.quantity,
            availableStock,
            { productName, allowNegative }
        );

        if (!validation.valid) {
            errors.push({
                index: index,
                productId: item.product_id,
                productName: productName,
                message: validation.message,
                shortage: validation.shortage
            });
            totalShortage += validation.shortage;
        }
    });

    return {
        valid: errors.length === 0,
        errors: errors,
        totalShortage: totalShortage
    };
}

// ===========================================================================
// Export — works in both Node.js (Jest) and browser environments
// ===========================================================================
const ERPUtils = {
    // String utilities
    _camelToSnake,
    _snakeToCamel,
    _keysToSnake,
    _keysToCamel,
    _toTableName,

    // ERP constants
    TABLE_NAME_MAP,
    SOFT_DELETE_TABLES,
    CANCEL_STATUS_MAP,
    TABLES_WITHOUT_COMPANY_ID,

    // Payment / invoice
    inferPaymentStatus,
    calculateInvoiceTotals,

    // Sales
    mapDeliveryUiToDb,
    mapDeliveryDbToUi,
    mapSalesStatusFilterToDb,

    // Purchases
    mapReceiptUiToDb,
    mapReceiptDbToUi,
    mapPurchaseStatusFilterToDb,

    // Customers
    mapCustomerRowToViewModel,

    // Accounting
    getJournalBalanceStatus,

    // Inventory Validation
    validateInventoryAvailability,
    validateItemsInventory,

    // Formatting
    fmtMoney,
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = ERPUtils;
} else if (typeof window !== 'undefined') {
    window.ERPUtils = ERPUtils;
}
