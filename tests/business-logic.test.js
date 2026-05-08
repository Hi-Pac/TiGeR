/**
 * tests/business-logic.test.js
 *
 * Unit tests for the pure business-logic functions in js/business-logic.js.
 *
 * Coverage areas:
 *  1. String-case utilities (_camelToSnake, _snakeToCamel)
 *  2. Object key conversion (_keysToSnake, _keysToCamel)
 *  3. Invoice total calculations (calculateInvoiceTotals)
 *  4. Payment status inference (inferPaymentStatus)
 *  5. Sales delivery status mappings (mapDeliveryUiToDb / mapDeliveryDbToUi)
 *  6. Sales list filter mappings (mapSalesStatusFilterToDb)
 *  7. Purchase receipt status mappings (mapReceiptUiToDb / mapReceiptDbToUi)
 *  8. Purchase list filter mappings (mapPurchaseStatusFilterToDb)
 *  9. Customer row → view-model mapper (mapCustomerRowToViewModel)
 * 10. Journal-entry balance validator (getJournalBalanceStatus)
 * 11. Money formatter (fmtMoney)
 */

'use strict';

const {
    _camelToSnake,
    _snakeToCamel,
    _keysToSnake,
    _keysToCamel,
    inferPaymentStatus,
    calculateInvoiceTotals,
    mapDeliveryUiToDb,
    mapDeliveryDbToUi,
    mapSalesStatusFilterToDb,
    mapReceiptUiToDb,
    mapReceiptDbToUi,
    mapPurchaseStatusFilterToDb,
    mapCustomerRowToViewModel,
    getJournalBalanceStatus,
    fmtMoney,
} = require('../js/business-logic');

// ===========================================================================
// 1. _camelToSnake
// ===========================================================================
describe('_camelToSnake', () => {
    it('converts a single uppercase letter', () => {
        expect(_camelToSnake('shopName')).toBe('shop_name');
    });

    it('converts multiple humps', () => {
        expect(_camelToSnake('invoiceDate')).toBe('invoice_date');
        expect(_camelToSnake('openingBalance')).toBe('opening_balance');
        expect(_camelToSnake('salesInvoiceItems')).toBe('sales_invoice_items');
    });

    it('leaves already-snake-case strings unchanged', () => {
        expect(_camelToSnake('shop_name')).toBe('shop_name');
        expect(_camelToSnake('invoice_date')).toBe('invoice_date');
    });

    it('handles single-word strings (no uppercase)', () => {
        expect(_camelToSnake('status')).toBe('status');
        expect(_camelToSnake('id')).toBe('id');
    });

    it('handles strings that start with an uppercase letter', () => {
        expect(_camelToSnake('CompanyId')).toBe('_company_id');
    });

    it('returns empty string unchanged', () => {
        expect(_camelToSnake('')).toBe('');
    });
});

// ===========================================================================
// 2. _snakeToCamel
// ===========================================================================
describe('_snakeToCamel', () => {
    it('converts a single underscore segment', () => {
        expect(_snakeToCamel('shop_name')).toBe('shopName');
    });

    it('converts multiple underscores', () => {
        expect(_snakeToCamel('invoice_date')).toBe('invoiceDate');
        expect(_snakeToCamel('opening_balance')).toBe('openingBalance');
        expect(_snakeToCamel('sales_invoice_items')).toBe('salesInvoiceItems');
    });

    it('leaves already-camelCase strings unchanged', () => {
        expect(_snakeToCamel('shopName')).toBe('shopName');
    });

    it('handles single-word strings (no underscore)', () => {
        expect(_snakeToCamel('status')).toBe('status');
        expect(_snakeToCamel('id')).toBe('id');
    });

    it('is the inverse of _camelToSnake for typical field names', () => {
        const fields = ['shopName', 'invoiceDate', 'openingBalance', 'currentBalance', 'creditLimit'];
        fields.forEach(f => {
            expect(_snakeToCamel(_camelToSnake(f))).toBe(f);
        });
    });

    it('returns empty string unchanged', () => {
        expect(_snakeToCamel('')).toBe('');
    });
});

// ===========================================================================
// 3. _keysToSnake
// ===========================================================================
describe('_keysToSnake', () => {
    it('converts all camelCase keys to snake_case', () => {
        const input  = { shopName: 'ACME', ownerName: 'John', creditLimit: 500 };
        const output = _keysToSnake(input);
        expect(output).toEqual({ shop_name: 'ACME', owner_name: 'John', credit_limit: 500 });
    });

    it('preserves values unchanged', () => {
        const input = { totalAmount: 999.99 };
        expect(_keysToSnake(input).total_amount).toBe(999.99);
    });

    it('strips keys listed in fieldsToIgnore (camelCase key)', () => {
        const input  = { shopName: 'ACME', items: [1, 2, 3] };
        const output = _keysToSnake(input, ['items']);
        expect(output).not.toHaveProperty('items');
        expect(output).toHaveProperty('shop_name');
    });

    it('strips keys listed in fieldsToIgnore (snake_case key)', () => {
        const input  = { shop_name: 'ACME', product_categories: [] };
        const output = _keysToSnake(input, ['product_categories']);
        expect(output).not.toHaveProperty('product_categories');
        expect(output).toHaveProperty('shop_name');
    });

    it('returns an empty object for empty input', () => {
        expect(_keysToSnake({})).toEqual({});
    });

    it('returns the value unchanged for non-object input', () => {
        expect(_keysToSnake(null)).toBeNull();
        expect(_keysToSnake(undefined)).toBeUndefined();
        expect(_keysToSnake(42)).toBe(42);
    });
});

// ===========================================================================
// 4. _keysToCamel
// ===========================================================================
describe('_keysToCamel', () => {
    it('converts all snake_case keys to camelCase', () => {
        const input  = { shop_name: 'ACME', owner_name: 'John', credit_limit: 500 };
        const output = _keysToCamel(input);
        expect(output).toEqual({ shopName: 'ACME', ownerName: 'John', creditLimit: 500 });
    });

    it('preserves values unchanged', () => {
        const input = { total_amount: 999.99 };
        expect(_keysToCamel(input).totalAmount).toBe(999.99);
    });

    it('returns the original value for array input', () => {
        const arr = [1, 2, 3];
        expect(_keysToCamel(arr)).toBe(arr);
    });

    it('returns an empty object for empty input', () => {
        expect(_keysToCamel({})).toEqual({});
    });

    it('returns the value unchanged for non-object input', () => {
        expect(_keysToCamel(null)).toBeNull();
    });
});

// ===========================================================================
// 5. calculateInvoiceTotals
// ===========================================================================
describe('calculateInvoiceTotals', () => {
    it('calculates basic totals correctly (14% VAT, no discount)', () => {
        const result = calculateInvoiceTotals(1000, 0, 14);
        expect(result.subtotal).toBe(1000);
        expect(result.discountAmount).toBe(0);
        expect(result.taxRate).toBe(14);
        expect(result.taxBase).toBe(1000);
        expect(result.taxAmount).toBeCloseTo(140, 5);
        expect(result.grandTotal).toBeCloseTo(1140, 5);
    });

    it('deducts discount before computing tax', () => {
        const result = calculateInvoiceTotals(1000, 100, 10);
        expect(result.taxBase).toBe(900);
        expect(result.taxAmount).toBeCloseTo(90, 5);
        expect(result.grandTotal).toBeCloseTo(990, 5);
    });

    it('clamps tax base to 0 when discount exceeds subtotal', () => {
        const result = calculateInvoiceTotals(100, 200, 14);
        expect(result.taxBase).toBe(0);
        expect(result.taxAmount).toBe(0);
        expect(result.grandTotal).toBe(0);
    });

    it('returns zero grand total for all-zero inputs', () => {
        const result = calculateInvoiceTotals(0, 0, 0);
        expect(result.taxAmount).toBe(0);
        expect(result.grandTotal).toBe(0);
    });

    it('handles zero tax rate (tax-exempt invoice)', () => {
        const result = calculateInvoiceTotals(500, 50, 0);
        expect(result.taxBase).toBe(450);
        expect(result.taxAmount).toBe(0);
        expect(result.grandTotal).toBe(450);
    });

    it('handles fractional subtotals and discounts', () => {
        const result = calculateInvoiceTotals(333.33, 33.33, 14);
        expect(result.taxBase).toBeCloseTo(300, 2);
        expect(result.taxAmount).toBeCloseTo(42, 2);
        expect(result.grandTotal).toBeCloseTo(342, 2);
    });

    it('handles 100% tax rate', () => {
        const result = calculateInvoiceTotals(200, 0, 100);
        expect(result.taxAmount).toBe(200);
        expect(result.grandTotal).toBe(400);
    });

    it('coerces string inputs to numbers', () => {
        const result = calculateInvoiceTotals('500', '50', '10');
        expect(result.subtotal).toBe(500);
        expect(result.grandTotal).toBeCloseTo(495, 5);
    });

    it('treats undefined/null inputs as zero', () => {
        const result = calculateInvoiceTotals(undefined, null, undefined);
        expect(result.grandTotal).toBe(0);
    });
});

// ===========================================================================
// 6. inferPaymentStatus
// ===========================================================================
describe('inferPaymentStatus', () => {
    it('returns "paid" for cash payments', () => {
        expect(inferPaymentStatus('cash')).toBe('paid');
    });

    it('returns "unpaid" for credit payments', () => {
        expect(inferPaymentStatus('credit')).toBe('unpaid');
    });

    it('returns "unpaid" for bank_transfer', () => {
        expect(inferPaymentStatus('bank_transfer')).toBe('unpaid');
    });

    it('returns "unpaid" for cheque', () => {
        expect(inferPaymentStatus('cheque')).toBe('unpaid');
    });

    it('returns "unpaid" for an unknown method', () => {
        expect(inferPaymentStatus('barter')).toBe('unpaid');
    });

    it('returns "unpaid" for empty string', () => {
        expect(inferPaymentStatus('')).toBe('unpaid');
    });

    it('returns "unpaid" for undefined', () => {
        expect(inferPaymentStatus(undefined)).toBe('unpaid');
    });
});

// ===========================================================================
// 7. mapDeliveryUiToDb / mapDeliveryDbToUi
// ===========================================================================
describe('delivery status mapping (sales)', () => {
    describe('mapDeliveryUiToDb', () => {
        it('maps pending_delivery → pending', () => {
            expect(mapDeliveryUiToDb('pending_delivery')).toBe('pending');
        });
        it('maps out_for_delivery → dispatched', () => {
            expect(mapDeliveryUiToDb('out_for_delivery')).toBe('dispatched');
        });
        it('maps delivered → delivered', () => {
            expect(mapDeliveryUiToDb('delivered')).toBe('delivered');
        });
        it('defaults to pending for unknown values', () => {
            expect(mapDeliveryUiToDb('unknown')).toBe('pending');
            expect(mapDeliveryUiToDb('')).toBe('pending');
            expect(mapDeliveryUiToDb(undefined)).toBe('pending');
        });
    });

    describe('mapDeliveryDbToUi', () => {
        it('maps pending → pending_delivery', () => {
            expect(mapDeliveryDbToUi('pending')).toBe('pending_delivery');
        });
        it('maps dispatched → out_for_delivery', () => {
            expect(mapDeliveryDbToUi('dispatched')).toBe('out_for_delivery');
        });
        it('maps delivered → delivered', () => {
            expect(mapDeliveryDbToUi('delivered')).toBe('delivered');
        });
        it('defaults to pending_delivery for unknown values', () => {
            expect(mapDeliveryDbToUi('unknown')).toBe('pending_delivery');
            expect(mapDeliveryDbToUi('')).toBe('pending_delivery');
        });
    });

    it('mapDeliveryUiToDb and mapDeliveryDbToUi are inverses', () => {
        const uiValues = ['pending_delivery', 'out_for_delivery', 'delivered'];
        uiValues.forEach(ui => {
            expect(mapDeliveryDbToUi(mapDeliveryUiToDb(ui))).toBe(ui);
        });
    });
});

// ===========================================================================
// 8. mapSalesStatusFilterToDb
// ===========================================================================
describe('mapSalesStatusFilterToDb', () => {
    it('maps pending_payment to payment_status=unpaid', () => {
        expect(mapSalesStatusFilterToDb('pending_payment')).toEqual({ field: 'payment_status', value: 'unpaid' });
    });
    it('passes through known payment_status values directly', () => {
        expect(mapSalesStatusFilterToDb('unpaid')).toEqual({ field: 'payment_status', value: 'unpaid' });
        expect(mapSalesStatusFilterToDb('partially_paid')).toEqual({ field: 'payment_status', value: 'partially_paid' });
        expect(mapSalesStatusFilterToDb('paid')).toEqual({ field: 'payment_status', value: 'paid' });
        expect(mapSalesStatusFilterToDb('overdue')).toEqual({ field: 'payment_status', value: 'overdue' });
    });
    it('maps pending_delivery to delivery_status=pending', () => {
        expect(mapSalesStatusFilterToDb('pending_delivery')).toEqual({ field: 'delivery_status', value: 'pending' });
    });
    it('maps delivered to delivery_status=delivered', () => {
        expect(mapSalesStatusFilterToDb('delivered')).toEqual({ field: 'delivery_status', value: 'delivered' });
    });
    it('maps cancelled to invoice_status=cancelled', () => {
        expect(mapSalesStatusFilterToDb('cancelled')).toEqual({ field: 'invoice_status', value: 'cancelled' });
    });
    it('returns null for unrecognised values (show all)', () => {
        expect(mapSalesStatusFilterToDb('')).toBeNull();
        expect(mapSalesStatusFilterToDb('unknown')).toBeNull();
        expect(mapSalesStatusFilterToDb(undefined)).toBeNull();
    });
});

// ===========================================================================
// 9. mapReceiptUiToDb / mapReceiptDbToUi
// ===========================================================================
describe('receipt status mapping (purchases)', () => {
    describe('mapReceiptUiToDb', () => {
        it('maps pending_receipt → pending', () => {
            expect(mapReceiptUiToDb('pending_receipt')).toBe('pending');
        });
        it('maps partially_received → partial', () => {
            expect(mapReceiptUiToDb('partially_received')).toBe('partial');
        });
        it('maps received → received', () => {
            expect(mapReceiptUiToDb('received')).toBe('received');
        });
        it('defaults to pending for unknown values', () => {
            expect(mapReceiptUiToDb('unknown')).toBe('pending');
            expect(mapReceiptUiToDb('')).toBe('pending');
            expect(mapReceiptUiToDb(undefined)).toBe('pending');
        });
    });

    describe('mapReceiptDbToUi', () => {
        it('maps pending → pending_receipt', () => {
            expect(mapReceiptDbToUi('pending')).toBe('pending_receipt');
        });
        it('maps partial → partially_received', () => {
            expect(mapReceiptDbToUi('partial')).toBe('partially_received');
        });
        it('maps received → received', () => {
            expect(mapReceiptDbToUi('received')).toBe('received');
        });
        it('defaults to pending_receipt for unknown values', () => {
            expect(mapReceiptDbToUi('unknown')).toBe('pending_receipt');
            expect(mapReceiptDbToUi('')).toBe('pending_receipt');
        });
    });

    it('mapReceiptUiToDb and mapReceiptDbToUi are inverses', () => {
        const uiValues = ['pending_receipt', 'partially_received', 'received'];
        uiValues.forEach(ui => {
            expect(mapReceiptDbToUi(mapReceiptUiToDb(ui))).toBe(ui);
        });
    });
});

// ===========================================================================
// 10. mapPurchaseStatusFilterToDb
// ===========================================================================
describe('mapPurchaseStatusFilterToDb', () => {
    it('passes through payment_status values', () => {
        expect(mapPurchaseStatusFilterToDb('unpaid')).toEqual({ field: 'payment_status', value: 'unpaid' });
        expect(mapPurchaseStatusFilterToDb('partially_paid')).toEqual({ field: 'payment_status', value: 'partially_paid' });
        expect(mapPurchaseStatusFilterToDb('paid')).toEqual({ field: 'payment_status', value: 'paid' });
    });
    it('maps pending_receipt to receipt_status=pending', () => {
        expect(mapPurchaseStatusFilterToDb('pending_receipt')).toEqual({ field: 'receipt_status', value: 'pending' });
    });
    it('maps partially_received to receipt_status=partial', () => {
        expect(mapPurchaseStatusFilterToDb('partially_received')).toEqual({ field: 'receipt_status', value: 'partial' });
    });
    it('maps received to receipt_status=received', () => {
        expect(mapPurchaseStatusFilterToDb('received')).toEqual({ field: 'receipt_status', value: 'received' });
    });
    it('maps cancelled to invoice_status=cancelled', () => {
        expect(mapPurchaseStatusFilterToDb('cancelled')).toEqual({ field: 'invoice_status', value: 'cancelled' });
    });
    it('returns null for unrecognised values (show all)', () => {
        expect(mapPurchaseStatusFilterToDb('')).toBeNull();
        expect(mapPurchaseStatusFilterToDb('unknown')).toBeNull();
        expect(mapPurchaseStatusFilterToDb(undefined)).toBeNull();
    });
    it('does NOT handle overdue (purchase-specific difference from sales)', () => {
        expect(mapPurchaseStatusFilterToDb('overdue')).toBeNull();
    });
});

// ===========================================================================
// 11. mapCustomerRowToViewModel
// ===========================================================================
describe('mapCustomerRowToViewModel', () => {
    const fullRow = {
        id:               'cust-001',
        shop_name:        'ACME Store',
        owner_name:       'John Doe',
        phone:            '01001234567',
        phone2:           '01009876543',
        email:            'john@acme.com',
        area:             'Heliopolis',
        address:          '123 Main St',
        credit_limit:     5000,
        opening_balance:  1000,
        current_balance:  800,
        status:           'active',
        notes:            'VIP customer',
    };

    it('maps all fields correctly from a complete row', () => {
        const vm = mapCustomerRowToViewModel(fullRow);
        expect(vm.id).toBe('cust-001');
        expect(vm.shopName).toBe('ACME Store');
        expect(vm.ownerName).toBe('John Doe');
        expect(vm.phone).toBe('01001234567');
        expect(vm.phone2).toBe('01009876543');
        expect(vm.email).toBe('john@acme.com');
        expect(vm.area).toBe('Heliopolis');
        expect(vm.address).toBe('123 Main St');
        expect(vm.creditLimit).toBe(5000);
        expect(vm.openingBalance).toBe(1000);
        expect(vm.currentBalance).toBe(800);
        expect(vm.status).toBe('active');
        expect(vm.notes).toBe('VIP customer');
    });

    it('defaults missing string fields to empty string', () => {
        const vm = mapCustomerRowToViewModel({ id: 'x' });
        expect(vm.shopName).toBe('');
        expect(vm.ownerName).toBe('');
        expect(vm.phone).toBe('');
        expect(vm.email).toBe('');
        expect(vm.area).toBe('');
        expect(vm.address).toBe('');
        expect(vm.notes).toBe('');
    });

    it('defaults missing numeric fields to 0', () => {
        const vm = mapCustomerRowToViewModel({ id: 'x' });
        expect(vm.creditLimit).toBe(0);
        expect(vm.openingBalance).toBe(0);
        expect(vm.currentBalance).toBe(0);
    });

    it('defaults missing status to "active"', () => {
        const vm = mapCustomerRowToViewModel({ id: 'x' });
        expect(vm.status).toBe('active');
    });

    it('converts string numeric values to numbers', () => {
        const vm = mapCustomerRowToViewModel({ id: 'x', credit_limit: '1500', opening_balance: '200', current_balance: '100' });
        expect(vm.creditLimit).toBe(1500);
        expect(vm.openingBalance).toBe(200);
        expect(vm.currentBalance).toBe(100);
    });

    it('preserves blocked status', () => {
        const vm = mapCustomerRowToViewModel({ id: 'x', status: 'blocked' });
        expect(vm.status).toBe('blocked');
    });
});

// ===========================================================================
// 12. getJournalBalanceStatus
// ===========================================================================
describe('getJournalBalanceStatus', () => {
    it('returns "balanced" when debits equal credits and both are positive', () => {
        expect(getJournalBalanceStatus(1000, 1000)).toBe('balanced');
        expect(getJournalBalanceStatus(500.50, 500.50)).toBe('balanced');
    });

    it('returns "unbalanced" when debits do not equal credits', () => {
        expect(getJournalBalanceStatus(1000, 900)).toBe('unbalanced');
        expect(getJournalBalanceStatus(500, 600)).toBe('unbalanced');
    });

    it('returns "empty" when both are zero', () => {
        expect(getJournalBalanceStatus(0, 0)).toBe('empty');
    });

    it('returns "unbalanced" when one side is zero and the other is not', () => {
        expect(getJournalBalanceStatus(100, 0)).toBe('unbalanced');
        expect(getJournalBalanceStatus(0, 100)).toBe('unbalanced');
    });

    it('coerces string inputs', () => {
        expect(getJournalBalanceStatus('500', '500')).toBe('balanced');
        expect(getJournalBalanceStatus('500', '400')).toBe('unbalanced');
    });

    it('treats null / undefined as zero → "empty"', () => {
        expect(getJournalBalanceStatus(null, null)).toBe('empty');
        expect(getJournalBalanceStatus(undefined, undefined)).toBe('empty');
    });
});

// ===========================================================================
// 13. fmtMoney
// ===========================================================================
describe('fmtMoney', () => {
    it('formats a whole number with two decimal places', () => {
        expect(fmtMoney(100)).toBe('100.00 ج.م');
    });
    it('formats a decimal number', () => {
        expect(fmtMoney(1234.5)).toBe('1234.50 ج.م');
    });
    it('formats zero', () => {
        expect(fmtMoney(0)).toBe('0.00 ج.م');
    });
    it('formats a string number', () => {
        expect(fmtMoney('250')).toBe('250.00 ج.م');
    });
    it('treats null/undefined as zero', () => {
        expect(fmtMoney(null)).toBe('0.00 ج.م');
        expect(fmtMoney(undefined)).toBe('0.00 ج.م');
    });
    it('rounds to two decimal places', () => {
        expect(fmtMoney(9.999)).toBe('10.00 ج.م');
        expect(fmtMoney(1.004)).toBe('1.00 ج.م');
    });
    it('includes the Egyptian Pound symbol', () => {
        expect(fmtMoney(50)).toContain('ج.م');
    });
});
