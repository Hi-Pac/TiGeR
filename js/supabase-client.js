/**
 * js/supabase-client.js
 *
 * Supabase Data Access Layer — Phase 1
 *
 * Changes from the previous version:
 *  - Removed the doc_data JSONB wrapper entirely.
 *  - Added window.DB  — a clean _TableQuery builder (new API, use this going forward).
 *  - Updated window.db — the Firestore-compat shim now reads/writes real normalized
 *    columns instead of a single JSONB blob. Existing modules continue to work
 *    via automatic camelCase ↔ snake_case conversion.
 *  - Added soft-delete support: tables with a deleted_at column are never hard-deleted.
 *  - Fixed softDelete() / delete() to use invoice_status for sales_invoices /
 *    purchase_invoices (previously used the wrong column 'status').
 *  - Added TABLES_WITHOUT_COMPANY_ID: child tables (sales_invoice_items, etc.)
 *    are skipped during company_id auto-injection to prevent DB column errors.
 *  - Added CANCEL_STATUS_COLUMN map for tables with non-standard status column names.
 *  - Expanded TABLE_NAME_MAP with full camelCase ↔ snake_case aliases for DB.from().
 *  - Added auto company_id injection on every INSERT so RLS policies are satisfied.
 *  - Fixed SUPABASE_URL: removed the /rest/v1/ suffix that the JS library adds itself.
 *
 * Modules that will require further updates in Phase 2+:
 *  - settings.js  — uses string doc IDs incompatible with UUID primary keys
 *  - users.js     — needs Supabase Auth integration; profiles.full_name ≠ name
 *  - banks.js     — bank_transactions requires balance_before / balance_after
 *  - sales.js / purchases.js — items arrays live in separate child tables
 */

// ============================================================
// ⚙️  Supabase credentials — replace with your project values
//
//     The ANON key is intentionally public (designed for browser use).
//     Supabase RLS policies on every table restrict what the anon key
//     can actually read or write — it cannot bypass row-level security.
//     NEVER put the service_role key here.
// ============================================================
const SUPABASE_URL      = 'https://jseyyzhvmtmbdanvylcx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpzZXl5emh2bXRtYmRhbnZ5bGN4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcyODI1MzMsImV4cCI6MjA5Mjg1ODUzM30.12P6UpsDYBa_KpDDr8oObAv6pKnrjSzTie3AJTCULbk';
// ============================================================

// ---------------------------------------------------------------------------
// Table name map — legacy camelCase collection names → real snake_case tables
// ---------------------------------------------------------------------------
const TABLE_NAME_MAP = {
    // Legacy collection name aliases (used by old Firestore-style modules)
    'bankAccounts':          'bank_accounts',
    'bankTransactions':      'bank_transactions',
    'inventoryStock':        'inventory_stock',
    'inventoryTransactions': 'stock_movements',
    'appSettings':           'app_settings',
    'sales':                 'sales_invoices',
    'purchases':             'purchase_invoices',
    'users':                 'profiles',
    // Convenience camelCase → snake_case aliases for DB.from() calls
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

// ---------------------------------------------------------------------------
// Tables that support soft-delete via deleted_at (no hard deletes on these)
// ---------------------------------------------------------------------------
const SOFT_DELETE_TABLES = new Set(['customers', 'suppliers', 'products']);

// ---------------------------------------------------------------------------
// Tables that use a non-standard column name for the cancellation status.
// All other tables use the generic 'status' column.
// ---------------------------------------------------------------------------
const CANCEL_STATUS_COLUMN = {
    'sales_invoices':    'invoice_status',
    'purchase_invoices': 'invoice_status',
    'journal_entries':   'status',  // uses 'reversed' — listed for clarity
};

// ---------------------------------------------------------------------------
// Child / junction tables that have no company_id column.
// Auto company_id injection is skipped for these to avoid DB errors.
// ---------------------------------------------------------------------------
const TABLES_WITHOUT_COMPANY_ID = new Set([
    'sales_invoice_items',
    'purchase_invoice_items',
    'supplier_categories',
    'journal_entry_lines',
    'audit_logs',
]);

// ---------------------------------------------------------------------------
// Fields to strip before INSERT / UPDATE because they live in a separate
// child table or have no matching column yet (fixed per-module in Phase 2+).
// ---------------------------------------------------------------------------
const FIELDS_TO_IGNORE_BY_TABLE = {
    suppliers:         ['product_categories', 'productCategories'],
    sales_invoices:    ['items'],
    purchase_invoices: ['items'],
    stock_movements:   ['warehouseName', 'productName'],
};

// ---------------------------------------------------------------------------
// camelCase ↔ snake_case utilities
// ---------------------------------------------------------------------------
function _camelToSnake(str) {
    return str.replace(/([A-Z])/g, ch => '_' + ch.toLowerCase());
}

function _snakeToCamel(str) {
    return str.replace(/_([a-z])/g, (_, ch) => ch.toUpperCase());
}

/**
 * Return a copy of obj with keys converted to snake_case.
 * Strips fields listed in FIELDS_TO_IGNORE_BY_TABLE for the given table.
 * Does NOT strip id — callers handle that explicitly when needed.
 */
function _keysToSnake(obj, tableName) {
    if (!obj || typeof obj !== 'object') return obj;
    const ignored = new Set(FIELDS_TO_IGNORE_BY_TABLE[tableName] || []);
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

/** Convert firebase.firestore.FieldValue.serverTimestamp() placeholders to ISO strings. */
function _processTimestamps(data) {
    if (!data || typeof data !== 'object') return data;
    const result = {};
    for (const [key, value] of Object.entries(data)) {
        result[key] = (value && value._isServerTimestamp) ? new Date().toISOString() : value;
    }
    return result;
}

function _toTableName(collectionName) {
    return TABLE_NAME_MAP[collectionName] || collectionName;
}

// ---------------------------------------------------------------------------
// company_id helper
// Fetches and caches the current user's company_id from the profiles table.
// Auto-injected into every INSERT so RLS WITH CHECK (company_id = fn_my_company_id())
// is satisfied without requiring every module to know about multi-tenancy.
// ---------------------------------------------------------------------------
let _cachedCompanyId = null;

async function _getMyCompanyId(client) {
    if (_cachedCompanyId) return _cachedCompanyId;
    try {
        const { data: { user } } = await client.auth.getUser();
        if (!user) return null;
        const { data } = await client
            .from('profiles')
            .select('company_id')
            .eq('id', user.id)
            .maybeSingle();
        _cachedCompanyId = data?.company_id || null;
    } catch (_ignored) {
        // Not authenticated yet — callers will get a descriptive DB error
        _cachedCompanyId = null;
    }
    return _cachedCompanyId;
}

// ===========================================================================
// _TableQuery — clean query builder (new API, exposed as window.DB.from)
// ===========================================================================
class _TableQuery {
    constructor(client, table) {
        this._client  = client;
        this._table   = table;
        this._cols    = '*';
        this._filters = [];
        this._ord     = null;
        this._rng     = null;
        this._single  = false;
        this._maybe   = false;
        this._cnt     = null;
    }

    // ── Column selection ──────────────────────────────────────────────────
    select(cols = '*', { count } = {}) {
        const q = this._clone(); q._cols = cols;
        if (count) q._cnt = count;
        return q;
    }

    // ── Filters ───────────────────────────────────────────────────────────
    eq(col, val)    { return this._f('eq',    col, val); }
    neq(col, val)   { return this._f('neq',   col, val); }
    gt(col, val)    { return this._f('gt',    col, val); }
    gte(col, val)   { return this._f('gte',   col, val); }
    lt(col, val)    { return this._f('lt',    col, val); }
    lte(col, val)   { return this._f('lte',   col, val); }
    like(col, pat)  { return this._f('like',  col, pat); }
    ilike(col, pat) { return this._f('ilike', col, pat); }
    in(col, vals)   { return this._f('in',    col, vals); }
    is(col, val)    { return this._f('is',    col, val); }
    isNull(col)     { return this._f('is',    col, null); }
    isNotNull(col)  { return this._f('not.is', col, null); }

    // ── Ordering & Pagination ─────────────────────────────────────────────
    order(col, { ascending = true } = {}) {
        const q = this._clone(); q._ord = { col, ascending }; return q;
    }
    range(from, to) {
        const q = this._clone(); q._rng = { from, to }; return q;
    }
    limit(n) { return this.range(0, n - 1); }
    /** page(1, 30) → rows 0-29 with exact count */
    page(pageNum, pageSize = 30) {
        const from = (pageNum - 1) * pageSize;
        return this.range(from, from + pageSize - 1).select(this._cols, { count: 'exact' });
    }
    single()      { const q = this._clone(); q._single = true;  return q; }
    maybeSingle() { const q = this._clone(); q._maybe  = true;  return q; }

    // ── Terminal: SELECT ──────────────────────────────────────────────────
    /** Execute a SELECT. Returns { data, count }. */
    async get() {
        let q = this._client.from(this._table)
            .select(this._cols, this._cnt ? { count: this._cnt } : undefined);
        q = this._applyFilters(q);
        if (this._ord) q = q.order(this._ord.col, { ascending: this._ord.ascending });
        if (this._rng) q = q.range(this._rng.from, this._rng.to);
        if (this._single) q = q.single();
        else if (this._maybe) q = q.maybeSingle();
        const { data, error, count } = await q;
        if (error) throw new Error(`[DB:${this._table}] ${error.message}`);
        return { data, count };
    }

    // ── Terminal: INSERT ──────────────────────────────────────────────────
    /** Insert one record. Auto-injects company_id for top-level tables. Returns the created row. */
    async insert(record) {
        const payload = { ...record };
        if (!TABLES_WITHOUT_COMPANY_ID.has(this._table) && !payload.company_id) {
            const cid = await _getMyCompanyId(this._client);
            if (cid) payload.company_id = cid;
        }
        delete payload.id; // let DB generate the UUID
        const { data, error } = await this._client
            .from(this._table).insert(payload).select().single();
        if (error) throw new Error(`[DB:${this._table}] ${error.message}`);
        return data;
    }

    /** Insert multiple records. Returns created rows. */
    async insertMany(records) {
        const cid = TABLES_WITHOUT_COMPANY_ID.has(this._table)
            ? null
            : await _getMyCompanyId(this._client);
        const payloads = records.map(r => {
            const p = { ...r };
            if (!p.company_id && cid) p.company_id = cid;
            delete p.id;
            return p;
        });
        const { data, error } = await this._client
            .from(this._table).insert(payloads).select();
        if (error) throw new Error(`[DB:${this._table}] ${error.message}`);
        return data;
    }

    // ── Terminal: UPDATE ──────────────────────────────────────────────────
    /** Update rows matching the current filters. Always stamps updated_at. */
    async update(updates) {
        const payload = { ...updates, updated_at: new Date().toISOString() };
        let q = this._client.from(this._table).update(payload);
        q = this._applyFilters(q);
        const { error } = await q;
        if (error) throw new Error(`[DB:${this._table}] ${error.message}`);
    }

    // ── Terminal: SOFT-DELETE / CANCEL ────────────────────────────────────
    /**
     * Soft-delete a record.
     * - Tables in SOFT_DELETE_TABLES  → sets deleted_at.
     * - Tables with invoice_status    → sets invoice_status = 'cancelled'.
     * - All other ERP tables          → sets status = 'cancelled'.
     * Hard delete is intentionally not exposed; use supabaseClient directly
     * only for non-ERP data (sessions, temp records).
     */
    async softDelete() {
        if (SOFT_DELETE_TABLES.has(this._table)) {
            return this.update({ deleted_at: new Date().toISOString() });
        }
        const cancelCol = CANCEL_STATUS_COLUMN[this._table] || 'status';
        return this.update({ [cancelCol]: 'cancelled' });
    }

    // ── Terminal: UPSERT ─────────────────────────────────────────────────
    /** Upsert a record. Returns the upserted row. */
    async upsert(record) {
        const { data, error } = await this._client
            .from(this._table).upsert(record).select().single();
        if (error) throw new Error(`[DB:${this._table}] ${error.message}`);
        return data;
    }

    // ── Private ───────────────────────────────────────────────────────────
    _f(type, col, val) {
        const q = this._clone();
        q._filters = [...this._filters, { type, col, val }];
        return q;
    }
    _applyFilters(q) {
        for (const f of this._filters) {
            switch (f.type) {
                case 'eq':      q = q.eq(f.col, f.val);               break;
                case 'neq':     q = q.neq(f.col, f.val);              break;
                case 'gt':      q = q.gt(f.col, f.val);               break;
                case 'gte':     q = q.gte(f.col, f.val);              break;
                case 'lt':      q = q.lt(f.col, f.val);               break;
                case 'lte':     q = q.lte(f.col, f.val);              break;
                case 'like':    q = q.like(f.col, f.val);             break;
                case 'ilike':   q = q.ilike(f.col, f.val);            break;
                case 'in':      q = q.in(f.col, f.val);               break;
                case 'is':      q = q.is(f.col, f.val);               break;
                case 'not.is':  q = q.not(f.col, 'is', f.val);        break;
            }
        }
        return q;
    }
    _clone() {
        const q = new _TableQuery(this._client, this._table);
        q._cols = this._cols; q._filters = [...this._filters];
        q._ord  = this._ord;  q._rng     = this._rng;
        q._single = this._single; q._maybe = this._maybe; q._cnt = this._cnt;
        return q;
    }
}

// Envelope fields added by the DB that existing modules don't expect inside data().
const SNAPSHOT_STRIP_FIELDS = new Set(['id', 'created_at', 'updated_at', 'deleted_at', 'company_id', 'branch_id']);
class _DocumentSnapshot {
    constructor(row) {
        this.id     = row.id;
        this.exists = true;
        this._row   = row;
    }
    /**
     * Returns the row data as camelCase so existing modules continue to work
     * without field-name changes (those happen in Phase 2+).
     * Strips envelope fields (id, timestamps, company_id) because existing
     * modules don't expect them inside data().
     */
    data() {
        const rest = {};
        for (const [k, v] of Object.entries(this._row)) {
            if (!SNAPSHOT_STRIP_FIELDS.has(k)) rest[k] = v;
        }
        return _keysToCamel(rest);
    }
}

// ===========================================================================
// _DocumentRef — compat for db.collection('x').doc('id')
// ===========================================================================
class _DocumentRef {
    constructor(client, table, id) {
        this._client = client;
        this._table  = table;
        this._id     = id;
    }

    async get() {
        const { data, error } = await this._client
            .from(this._table).select('*').eq('id', this._id).maybeSingle();
        if (error) throw new Error(`[DB:${this._table}] ${error.message}`);
        if (!data) return { exists: false, id: this._id, data: () => null };
        return new _DocumentSnapshot(data);
    }

    async update(updateFields) {
        const processed  = _processTimestamps(updateFields);
        const snakeFields = _keysToSnake(processed, this._table);
        const { error } = await this._client
            .from(this._table)
            .update({ ...snakeFields, updated_at: new Date().toISOString() })
            .eq('id', this._id);
        if (error) throw new Error(`[DB:${this._table}] ${error.message}`);
    }

    async delete() {
        // ERP rule: never hard-delete financial / inventory records
        if (SOFT_DELETE_TABLES.has(this._table)) {
            const { error } = await this._client
                .from(this._table)
                .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
                .eq('id', this._id);
            if (error) throw new Error(`[DB:${this._table}] ${error.message}`);
        } else {
            // Use the correct status column for the table (e.g. invoice_status for invoices)
            const cancelCol = CANCEL_STATUS_COLUMN[this._table] || 'status';
            const { error } = await this._client
                .from(this._table)
                .update({ [cancelCol]: 'cancelled', updated_at: new Date().toISOString() })
                .eq('id', this._id);
            if (error) throw new Error(`[DB:${this._table}] ${error.message}`);
        }
    }

    async set(docData, options = {}) {
        const processed   = _processTimestamps(docData);
        const snakeFields = _keysToSnake(processed, this._table);

        if (options.merge) {
            // Read-then-write merge (used by settings.js etc.)
            const { data: existing } = await this._client
                .from(this._table).select('*').eq('id', this._id).maybeSingle();
            if (existing) {
                const { error } = await this._client
                    .from(this._table)
                    .update({ ...snakeFields, updated_at: new Date().toISOString() })
                    .eq('id', this._id);
                if (error) throw new Error(`[DB:${this._table}] ${error.message}`);
            } else {
                const { error } = await this._client
                    .from(this._table).insert({ id: this._id, ...snakeFields });
                if (error) throw new Error(`[DB:${this._table}] ${error.message}`);
            }
        } else {
            const { error } = await this._client
                .from(this._table).upsert({ id: this._id, ...snakeFields });
            if (error) throw new Error(`[DB:${this._table}] ${error.message}`);
        }
    }
}

// ===========================================================================
// _CollectionRef — compat for db.collection('x')
// ===========================================================================
class _CollectionRef {
    constructor(client, table) {
        this._client     = client;
        this._table      = table;
        this._filters    = [];
        this._orderField = null;
        this._orderDir   = 'asc';
    }

    async get() {
        let q = this._client.from(this._table).select('*');

        // Automatically exclude soft-deleted records
        if (SOFT_DELETE_TABLES.has(this._table)) {
            q = q.is('deleted_at', null);
        }

        for (const f of this._filters) {
            q = this._applyFilter(q, f);
        }
        if (this._orderField) {
            q = q.order(this._orderField, { ascending: this._orderDir === 'asc' });
        }

        const { data, error } = await q;
        if (error) throw new Error(`[DB:${this._table}] ${error.message}`);
        return { docs: (data || []).map(row => new _DocumentSnapshot(row)) };
    }

    async add(docData) {
        const processed   = _processTimestamps(docData);
        const snakeFields = _keysToSnake(processed, this._table);

        // Auto-inject company_id required by RLS INSERT policies.
        // Skipped for child tables that have no company_id column.
        if (!TABLES_WITHOUT_COMPANY_ID.has(this._table) && !snakeFields.company_id) {
            const cid = await _getMyCompanyId(this._client);
            if (cid) snakeFields.company_id = cid;
        }
        delete snakeFields.id; // let DB generate the UUID

        const { data, error } = await this._client
            .from(this._table).insert(snakeFields).select('id').single();
        if (error) throw new Error(`[DB:${this._table}] ${error.message}`);
        return { id: data.id };
    }

    doc(id) {
        return new _DocumentRef(this._client, this._table, id);
    }

    where(field, operator, value) {
        const clone = new _CollectionRef(this._client, this._table);
        // Convert camelCase field names to snake_case for the real schema
        clone._filters    = [...this._filters, { field: _camelToSnake(field), operator, value }];
        clone._orderField = this._orderField;
        clone._orderDir   = this._orderDir;
        return clone;
    }

    orderBy(field, direction = 'asc') {
        const clone = new _CollectionRef(this._client, this._table);
        clone._filters    = [...this._filters];
        clone._orderField = _camelToSnake(field); // real column name
        clone._orderDir   = direction;
        return clone;
    }

    _applyFilter(q, { field, operator, value }) {
        // All fields are now real top-level columns (no doc_data path)
        switch (operator) {
            case '==':  return q.eq(field, value);
            case '!=':  return q.neq(field, value);
            case '<':   return q.lt(field, value);
            case '<=':  return q.lte(field, value);
            case '>':   return q.gt(field, value);
            case '>=':  return q.gte(field, value);
            case 'array-contains':
                // Supabase's .contains() maps to PostgreSQL's @> (array/JSONB containment).
                // Wrapping value in an array matches the semantics of Firestore's
                // array-contains: the column array must contain this single element.
                return q.contains(field, [value]);
            default:    return q;
        }
    }
}

// ===========================================================================
// _FirestoreCompatWrapper — same external interface, real columns underneath
// ===========================================================================
class _FirestoreCompatWrapper {
    constructor(client) { this._client = client; }
    collection(collectionName) {
        return new _CollectionRef(this._client, _toTableName(collectionName));
    }
}

// ===========================================================================
// ServerTimestamp shim
// ===========================================================================
class _ServerTimestamp {
    constructor() { this._isServerTimestamp = true; }
}

// ============================================================
// Initialization
// ============================================================
(function initSupabase() {
    if (!window.supabase) {
        console.error('❌ Supabase JS library not loaded. Make sure the Supabase CDN is included in index.html.');
        return;
    }

    const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // Expose the raw Supabase client for advanced use (auth listeners, storage, etc.)
    window.supabaseClient = client;

    // ── New clean data-access API (Phase 1+) ──────────────────────────────
    // Usage: const { data } = await DB.from('customers').eq('status','active').get();
    window.DB = {
        from: (tableName) => new _TableQuery(client, _toTableName(tableName))
    };

    // ── Backward-compat Firestore shim (Phase 0 legacy) ───────────────────
    // Usage: await db.collection('customers').get()  /  .add()  /  .doc(id).update()
    // Will be replaced module-by-module in Phase 2+.
    window.db = new _FirestoreCompatWrapper(client);

    // ── firebase shim — keeps firebase.firestore.FieldValue.serverTimestamp() alive ──
    window.firebase = {
        firestore: {
            FieldValue: { serverTimestamp: () => new _ServerTimestamp() }
        }
    };

    window.auth    = client.auth;
    window.storage = client.storage;

    // Clear cached company_id when the user signs out
    client.auth.onAuthStateChange((event) => {
        if (event === 'SIGNED_OUT') _cachedCompanyId = null;
    });

    console.log('✅ Supabase client initialized (Phase 1 — real columns, no doc_data, invoice_status fix)');
    console.log('🔗 Project:', SUPABASE_URL);
})();
