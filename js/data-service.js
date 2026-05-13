
// js/data-service.js
// Centralized Data Fetching and Caching Layer

const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes for static data
const cache = new Map(); // Stores { data: ..., timestamp: ... }

function isCacheValid(key) {
    if (!cache.has(key)) return false;
    const { timestamp } = cache.get(key);
    return (Date.now() - timestamp) < CACHE_DURATION_MS;
}

function getCachedData(key) {
    if (isCacheValid(key)) {
        return cache.get(key).data;
    }
    return null;
}

function setCachedData(key, data) {
    cache.set(key, { data, timestamp: Date.now() });
}

// Generic fetch function with caching
async function fetchWithCache(key, fetchFn, forceRefresh = false) {
    if (!forceRefresh) {
        const cached = getCachedData(key);
        if (cached) {
            console.log(`[DataService] Cache hit for ${key}`);
            return cached;
        }
    }
    console.log(`[DataService] Cache miss or forced refresh for ${key}`);
    const data = await fetchFn();
    setCachedData(key, data);
    return data;
}

// --- Specific Data Fetchers (examples) ---

async function getProductCategories(forceRefresh = false) {
    return fetchWithCache('product_categories', async () => {
        const { data, error } = await window.supabaseClient
            .from('product_categories')
            .select('id,name,name_ar')
            .order('name', { ascending: true });
        if (error) throw error;
        return data || [];
    }, forceRefresh);
}

async function getProductUnits(forceRefresh = false) {
    return fetchWithCache('product_units', async () => {
        const { data, error } = await window.supabaseClient
            .from('product_units')
            .select('id,name,name_ar')
            .order('name', { ascending: true });
        if (error) throw error;
        return data || [];
    }, forceRefresh);
}

async function getWarehouses(forceRefresh = false) {
    return fetchWithCache('warehouses', async () => {
        const { data, error } = await window.supabaseClient
            .from('warehouses')
            .select('id,name,status')
            .eq('status', 'active')
            .order('name', { ascending: true });
        if (error) throw error;
        return data || [];
    }, forceRefresh);
}

async function getSuppliers(forceRefresh = false) {
    return fetchWithCache('suppliers', async () => {
        const { data, error } = await window.supabaseClient
            .from('suppliers')
            .select('id,company_name,status')
            .eq('status', 'active')
            .order('company_name', { ascending: true });
        if (error) throw error;
        return data || [];
    }, forceRefresh);
}

async function getCustomers(forceRefresh = false) {
    return fetchWithCache('customers', async () => {
        const { data, error } = await window.supabaseClient
            .from('customers')
            .select('id,shop_name,status')
            .eq('status', 'active')
            .order('shop_name', { ascending: true });
        if (error) throw error;
        return data || [];
    }, forceRefresh);
}

async function getSalespersons(forceRefresh = false) {
    return fetchWithCache('salespersons', async () => {
        const { data, error } = await window.supabaseClient
            .from('profiles')
            .select('id,full_name,role,status')
            .eq('status', 'active')
            .in('role', ['sales', 'admin'])
            .order('full_name', { ascending: true });
        if (error) throw error;
        return (data || []).filter((u) => ['sales', 'admin'].includes(u.role));
    }, forceRefresh);
}

async function getProductsWithStock(forceRefresh = false) {
    return fetchWithCache('products_with_stock', async () => {
        const [{ data: products }, { data: units }, { data: stockRows }] = await Promise.all([
            window.supabaseClient.from('products').select('id,name,sale_price,unit_id,status').eq('status', 'active').order('name', { ascending: true }),
            window.supabaseClient.from('product_units').select('id,name,name_ar'),
            window.supabaseClient.from('inventory_stock').select('product_id,warehouse_id,quantity_on_hand')
        ]);

        const unitMap = new Map((units || []).map((u) => [u.id, u.name_ar || u.name]));
        const stockByProduct = new Map();
        (stockRows || []).forEach((r) => {
            if (!stockByProduct.has(r.product_id)) stockByProduct.set(r.product_id, {});
            stockByProduct.get(r.product_id)[r.warehouse_id] = Number(r.quantity_on_hand || 0);
        });

        return (products || []).map((p) => ({
            id: p.id,
            name: p.name,
            sale_price: Number(p.sale_price || 0),
            unit_name: unitMap.get(p.unit_id) || '',
            stockByWarehouse: stockByProduct.get(p.id) || {}
        }));
    }, forceRefresh);
}

async function getProducts(forceRefresh = false) {
    return fetchWithCache('products', async () => {
        const [{ data: products }, { data: units }] = await Promise.all([
            window.supabaseClient.from('products').select('id,name,purchase_price,unit_id,status').eq('status', 'active').order('name', { ascending: true }),
            window.supabaseClient.from('product_units').select('id,name,name_ar')
        ]);

        const unitMap = new Map((units || []).map((u) => [u.id, u.name_ar || u.name]));
        return (products || []).map((p) => ({
            id: p.id,
            name: p.name,
            purchase_price: Number(p.purchase_price || 0),
            unit_name: unitMap.get(p.unit_id) || ''
        }));
    }, forceRefresh);
}

// Expose a global object for data service
window.AppDataService = {
    getProductCategories,
    getProductUnits,
    getWarehouses,
    getSuppliers,
    getCustomers,
    getSalespersons,
    getProductsWithStock,
    getProducts,
    // Add other common data fetchers here
};
