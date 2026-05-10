# Frontend Integration Plan - Database Functions

## Overview
Update frontend JavaScript to use new database functions instead of manual operations.

## Changes Required

### 1. Sales Module (`js/sales.js`)

**Current Implementation (lines 427-507):**
- Manually inserts invoice and items
- Does NOT create stock movements
- Does NOT update inventory

**Required Changes:**
```javascript
async function saveSale(shouldPrint = false) {
    // ... existing validation ...

    // After invoice items are inserted (line 492):
    // NEW: Process stock movements for each item
    for (const item of items) {
        const { error: stockErr } = await window.supabaseClient.rpc(
            'fn_process_stock_movement',
            {
                p_product_id: item.product_id,
                p_warehouse_id: saleWarehouseField.value,
                p_movement_type: 'sale',
                p_quantity: item.quantity,
                p_reference_type: 'sales_invoice',
                p_reference_id: finalSaleId,
                p_notes: `Sales invoice ${generatedNo || invoice_number}`
            }
        );
        if (stockErr) throw stockErr;
    }
}
```

**Impact:**
- Stock automatically reduced when invoice posted
- Stock movements logged atomically
- Inventory balance kept consistent

---

### 2. Purchase Module (`js/purchases.js`)

**Current Implementation (lines 371-447):**
- Manually inserts invoice and items
- Does NOT create stock movements
- Does NOT update inventory

**Required Changes:**
```javascript
async function savePurchase() {
    // ... existing validation ...

    // After invoice items are inserted (line 433):
    // NEW: Process stock movements for each item
    for (const item of items) {
        const { error: stockErr } = await window.supabaseClient.rpc(
            'fn_process_stock_movement',
            {
                p_product_id: item.product_id,
                p_warehouse_id: purchaseWarehouseField.value,
                p_movement_type: 'purchase',
                p_quantity: item.quantity,
                p_reference_type: 'purchase_invoice',
                p_reference_id: finalPurchaseId,
                p_notes: `Purchase invoice ${generatedNo || invoice_number}`
            }
        );
        if (stockErr) throw stockErr;
    }
}
```

**Impact:**
- Stock automatically increased when purchase posted
- Stock movements logged atomically
- Inventory balance kept consistent

---

### 3. Inventory Module (`js/inventory.js`)

#### A. Stock In/Out Operations (lines 273-320)

**Current Implementation:**
- Manually reads current stock (line 285-286)
- Manually calculates new quantity (line 287)
- Manually updates inventory_stock table (line 289-294)
- Manually inserts stock_movements (line 296-308)

**Required Changes:**
```javascript
async function saveStockIn() {
    // ... existing validation ...

    // REPLACE lines 284-309 with:
    for (const item of items) {
        const { error: stockErr } = await window.supabaseClient.rpc(
            'fn_process_stock_movement',
            {
                p_product_id: item.product_id,
                p_warehouse_id: warehouseId,
                p_movement_type: inventoryInSupplierField.value ? 'purchase' : 'adjustment_in',
                p_quantity: item.quantity,
                p_reference_type: inventoryInSupplierField.value ? 'purchase_invoice' : 'adjustment',
                p_reference_id: null,
                p_notes: inventoryInRefField.value || inventoryInNotesField.value || null
            }
        );
        if (stockErr) throw stockErr;
    }
}
```

**Benefits:**
- Eliminates race conditions
- Removes manual balance calculation
- Atomic operation with automatic quantity_before/quantity_after tracking

#### B. Warehouse Transfers (lines 322-400)

**Current Implementation:**
- Manually validates source stock (line 335-341)
- Manually reads source stock (line 344)
- Manually calculates source after (line 346)
- Manually updates source inventory (line 348-353)
- Manually inserts source movement (line 355-365)
- Manually reads target stock (line 367)
- Manually calculates target after (line 369)
- Manually updates target inventory (line 371-376)
- Manually inserts target movement (line 378-388)

**Required Changes:**
```javascript
async function saveTransfer() {
    // ... existing validation ...

    // REPLACE lines 335-389 with:
    for (const item of items) {
        const { data, error } = await window.supabaseClient.rpc(
            'fn_transfer_stock',
            {
                p_product_id: item.product_id,
                p_source_warehouse_id: sourceWarehouse,
                p_target_warehouse_id: targetWarehouse,
                p_quantity: item.quantity,
                p_notes: transferNotesField.value || null
            }
        );
        if (error) throw error;
    }
}
```

**Benefits:**
- Atomic transaction (both source and target updated together)
- Automatic validation of sufficient stock
- Eliminates possibility of orphaned movements
- Simpler code (2 lines vs 55 lines per item)

---

## Functions to Remove

These helper functions become obsolete:

### From `inventory.js`:
- `getInventoryRow()` - no longer needed
- `upsertInventoryQuantity()` - replaced by fn_process_stock_movement
- `insertMovement()` - replaced by fn_process_stock_movement

---

## Migration Strategy

### Phase 1: Sales & Purchases (High Priority)
1. Update `js/sales.js` - add stock movements
2. Update `js/purchases.js` - add stock movements
3. Test thoroughly:
   - Create sales invoice → verify stock reduced
   - Create purchase invoice → verify stock increased
   - Check stock_movements records created correctly

### Phase 2: Inventory Operations (Medium Priority)
1. Update `js/inventory.js` saveStockIn()
2. Update `js/inventory.js` saveTransfer()
3. Remove obsolete helper functions
4. Test:
   - Stock adjustments
   - Warehouse transfers
   - Verify atomic operations

### Phase 3: Data Reconciliation (Low Priority)
1. Run `SELECT * FROM fn_reconcile_all_balances()` to sync customer/supplier balances
2. Verify inventory_stock matches stock_movements history

---

## Testing Checklist

- [ ] Sales invoice creates stock movement (type: 'sale')
- [ ] Purchase invoice creates stock movement (type: 'purchase')
- [ ] Stock adjustment creates movement (type: 'adjustment_in' or 'adjustment_out')
- [ ] Warehouse transfer creates 2 movements atomically
- [ ] Customer balance updates automatically on invoice save
- [ ] Supplier balance updates automatically on invoice save
- [ ] Credit limit check triggers on sales invoice
- [ ] Invoice totals validation triggers work
- [ ] Overdue invoices marked correctly

---

## Rollback Plan

If issues occur:
1. Database functions remain in place (safe, not destructive)
2. Revert frontend code to previous version
3. Manually reconcile any inconsistencies using:
   ```sql
   SELECT * FROM fn_reconcile_all_balances();
   ```

---

## Estimated Impact

**Code Reduction:**
- Inventory module: ~60 lines removed (manual operations)
- Sales module: ~0 lines removed, +15 added (new functionality)
- Purchases module: ~0 lines removed, +15 added (new functionality)

**Reliability Improvement:**
- Eliminates race conditions in stock updates
- Atomic operations prevent partial updates
- Automatic balance sync prevents drift

**Performance:**
- Slightly slower (RPC call overhead)
- But safer and more maintainable
- Database-side transactions ensure consistency
