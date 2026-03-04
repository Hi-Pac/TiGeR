/**
 * Supabase Client & Firestore Compatibility Wrapper
 * 
 * يوفر هذا الملف:
 * 1. اتصال Supabase
 * 2. طبقة توافق مع Firestore API القديمة لتقليل التغييرات في باقي الملفات
 * 
 * للضبط: استبدل SUPABASE_URL و SUPABASE_ANON_KEY بقيم مشروعك على Supabase
 */

// ============================================================
// ⚙️  إعدادات Supabase — استبدلها بقيم مشروعك
// ============================================================
const SUPABASE_URL = 'YOUR_SUPABASE_URL';          // مثال: https://xxxx.supabase.co
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY'; // anon/public key من لوحة تحكم Supabase
// ============================================================

// تعيين أسماء Collections (Firestore) → أسماء الجداول في Supabase
const TABLE_NAME_MAP = {
    'bankAccounts':           'bank_accounts',
    'bankTransactions':       'bank_transactions',
    'inventoryStock':         'inventory_stock',
    'inventoryTransactions':  'inventory_transactions',
    'appSettings':            'app_settings',
};

// الأعمدة الموجودة في الجدول مباشرةً (وليس داخل doc_data)
const TOP_LEVEL_COLUMNS = new Set(['id', 'created_at', 'updated_at']);

function _isTopLevelColumn(field) {
    return TOP_LEVEL_COLUMNS.has(field);
}

function _toTableName(collectionName) {
    return TABLE_NAME_MAP[collectionName] || collectionName;
}

// تحويل قيم ServerTimestamp إلى ISO string
function _processTimestamps(data) {
    if (!data || typeof data !== 'object') return data;
    const result = {};
    for (const [key, value] of Object.entries(data)) {
        if (value && value._isServerTimestamp) {
            result[key] = new Date().toISOString();
        } else {
            result[key] = value;
        }
    }
    return result;
}

// -------------------------------------------------------
// DocumentSnapshot  — يحاكي نتيجة قراءة مستند Firestore
// -------------------------------------------------------
class _DocumentSnapshot {
    constructor(row) {
        this.id      = row.id;
        this.exists  = true;
        this._docData = row.doc_data || {};
    }
    data() {
        return { ...this._docData };
    }
}

// -------------------------------------------------------
// DocumentRef — يحاكي db.collection('x').doc('id')
// -------------------------------------------------------
class _DocumentRef {
    constructor(client, table, id) {
        this._client = client;
        this._table  = table;
        this._id     = id;
    }

    async get() {
        const { data, error } = await this._client
            .from(this._table)
            .select('id, doc_data')
            .eq('id', this._id)
            .maybeSingle();

        if (error) throw new Error(error.message);
        if (!data) return { exists: false, id: this._id, data: () => null };
        return new _DocumentSnapshot(data);
    }

    async update(updateFields) {
        const processed = _processTimestamps(updateFields);

        // جلب البيانات الحالية ثم دمج التحديث
        const { data: existing, error: fetchErr } = await this._client
            .from(this._table)
            .select('doc_data')
            .eq('id', this._id)
            .single();

        if (fetchErr) throw new Error(fetchErr.message);

        const merged = { ...(existing.doc_data || {}), ...processed };

        const { error } = await this._client
            .from(this._table)
            .update({ doc_data: merged, updated_at: new Date().toISOString() })
            .eq('id', this._id);

        if (error) throw new Error(error.message);
    }

    async delete() {
        const { error } = await this._client
            .from(this._table)
            .delete()
            .eq('id', this._id);

        if (error) throw new Error(error.message);
    }

    async set(docData, options = {}) {
        const processed = _processTimestamps(docData);

        if (options.merge) {
            const { data: existing } = await this._client
                .from(this._table)
                .select('id, doc_data')
                .eq('id', this._id)
                .maybeSingle();

            const merged = existing
                ? { ...(existing.doc_data || {}), ...processed }
                : processed;

            if (existing) {
                const { error } = await this._client
                    .from(this._table)
                    .update({ doc_data: merged, updated_at: new Date().toISOString() })
                    .eq('id', this._id);
                if (error) throw new Error(error.message);
            } else {
                const { error } = await this._client
                    .from(this._table)
                    .insert({ id: this._id, doc_data: merged });
                if (error) throw new Error(error.message);
            }
        } else {
            const { error } = await this._client
                .from(this._table)
                .upsert({ id: this._id, doc_data: processed });
            if (error) throw new Error(error.message);
        }
    }
}

// -------------------------------------------------------
// CollectionRef — يحاكي db.collection('x')
// -------------------------------------------------------
class _CollectionRef {
    constructor(client, table) {
        this._client  = client;
        this._table   = table;
        this._filters = [];
        this._orderField = null;
        this._orderDir   = 'asc';
    }

    async get() {
        let query = this._client.from(this._table).select('id, doc_data');

        for (const f of this._filters) {
            query = this._applyFilter(query, f);
        }
        if (this._orderField) {
            query = query.order(this._orderField, { ascending: this._orderDir === 'asc' });
        }

        const { data, error } = await query;
        if (error) throw new Error(error.message);

        return {
            docs: (data || []).map(row => new _DocumentSnapshot(row))
        };
    }

    async add(docData) {
        const processed = _processTimestamps(docData);
        const { data, error } = await this._client
            .from(this._table)
            .insert({ doc_data: processed })
            .select('id')
            .single();

        if (error) throw new Error(error.message);
        return { id: data.id };
    }

    doc(id) {
        return new _DocumentRef(this._client, this._table, id);
    }

    where(field, operator, value) {
        const clone = new _CollectionRef(this._client, this._table);
        clone._filters    = [...this._filters, { field, operator, value }];
        clone._orderField = this._orderField;
        clone._orderDir   = this._orderDir;
        return clone;
    }

    orderBy(field, direction = 'asc') {
        const clone = new _CollectionRef(this._client, this._table);
        clone._filters    = [...this._filters];
        // If the field is a top-level column use it directly; otherwise reference doc_data
        clone._orderField = _isTopLevelColumn(field) ? field : `doc_data->>${field}`;
        clone._orderDir   = direction;
        return clone;
    }

    _applyFilter(query, { field, operator, value }) {
        // Business data lives inside doc_data JSONB; use ->> to extract as text for comparison.
        // Only id, created_at, updated_at are top-level columns.
        const col = _isTopLevelColumn(field) ? field : `doc_data->>${field}`;
        switch (operator) {
            case '==':  return query.filter(col, 'eq', String(value));
            case '!=':  return query.filter(col, 'neq', String(value));
            case '<':   return query.filter(col, 'lt', String(value));
            case '<=':  return query.filter(col, 'lte', String(value));
            case '>':   return query.filter(col, 'gt', String(value));
            case '>=':  return query.filter(col, 'gte', String(value));
            case 'array-contains':
                // JSONB array containment: doc_data->'field' @> '["value"]'
                return query.contains(field === 'doc_data' ? field : `doc_data->${field}`, [value]);
            default:    return query;
        }
    }
}

// -------------------------------------------------------
// FirestoreCompatWrapper — يحاكي firebase.firestore()
// -------------------------------------------------------
class _FirestoreCompatWrapper {
    constructor(client) {
        this._client = client;
    }
    collection(collectionName) {
        return new _CollectionRef(this._client, _toTableName(collectionName));
    }
}

// -------------------------------------------------------
// ServerTimestamp placeholder
// -------------------------------------------------------
class _ServerTimestamp {
    constructor() { this._isServerTimestamp = true; }
}

// ============================================================
// التهيئة الرئيسية
// ============================================================
(function initSupabase() {
    if (!window.supabase) {
        console.error('❌ Supabase JS library not loaded. تأكد من تضمين Supabase CDN في index.html');
        return;
    }

    if (SUPABASE_URL === 'YOUR_SUPABASE_URL' || SUPABASE_ANON_KEY === 'YOUR_SUPABASE_ANON_KEY') {
        console.warn(
            '⚠️  لم يتم ضبط بيانات Supabase بعد.\n' +
            'افتح js/supabase-client.js واستبدل SUPABASE_URL و SUPABASE_ANON_KEY بقيم مشروعك.\n' +
            'راجع ملف SUPABASE_SETUP.md للتفاصيل.'
        );
    }

    // إنشاء عميل Supabase
    const supabaseClientInstance = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // تعريض العميل الأصلي للاستخدام المباشر عند الحاجة
    window.supabaseClient = supabaseClientInstance;

    // طبقة التوافق مع Firestore
    window.db = new _FirestoreCompatWrapper(supabaseClientInstance);

    // محاكاة مؤقتة لكائن firebase لدعم firebase.firestore.FieldValue.serverTimestamp()
    window.firebase = {
        firestore: {
            FieldValue: {
                serverTimestamp: () => new _ServerTimestamp()
            }
        }
    };

    // auth و storage: متاحان عبر Supabase SDK الأصلي
    window.auth    = supabaseClientInstance.auth;
    window.storage = supabaseClientInstance.storage;

    console.log('✅ Supabase client initialized successfully!');
    console.log('🔗 Project URL:', SUPABASE_URL);
})();
