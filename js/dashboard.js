async function initDashboardModule() {
    const dashboardModuleNode = document.getElementById('dashboard-module');
    if (!dashboardModuleNode) return;

    const totalSalesEl = document.getElementById('dashboard-total-sales');
    const totalPurchasesEl = document.getElementById('dashboard-total-purchases');
    const totalCustomersEl = document.getElementById('dashboard-total-customers');
    const netProfitEl = document.getElementById('dashboard-net-profit');

    const salesChangeEl = document.getElementById('dashboard-sales-change');
    const purchasesChangeEl = document.getElementById('dashboard-purchases-change');
    const customersChangeEl = document.getElementById('dashboard-customers-change');
    const profitChangeEl = document.getElementById('dashboard-profit-change');

    const recentSalesTableBody = document.getElementById('dashboard-recent-sales-table');
    const lowStockTableBody = document.getElementById('dashboard-low-stock-table');

    const fmtMoney = (n) => `${(Number(n) || 0).toFixed(2)} ج.م`;
    const parseDate = (d) => new Date(`${d}T00:00:00`);

    function getRangeDays(days, shiftDays = 0) {
        const end = new Date();
        end.setDate(end.getDate() - shiftDays);
        const start = new Date(end);
        start.setDate(start.getDate() - days + 1);
        return { start, end };
    }

    function sumRowsByDate(rows, dateField, valueField, range) {
        return rows
            .filter((r) => {
                const d = parseDate(String(r[dateField]).slice(0, 10));
                return d >= range.start && d <= range.end;
            })
            .reduce((sum, r) => sum + Number(r[valueField] || 0), 0);
    }

    function countRowsByDate(rows, dateField, range) {
        return rows.filter((r) => {
            const d = parseDate(String(r[dateField]).slice(0, 10));
            return d >= range.start && d <= range.end;
        }).length;
    }

    function calcChangePercent(current, previous) {
        if (previous === 0) return current > 0 ? 100 : 0;
        return ((current - previous) / previous) * 100;
    }

    function paintChange(el, value) {
        if (!el) return;
        const v = Number.isFinite(value) ? value : 0;
        el.textContent = v.toFixed(1);
        const container = el.parentElement;
        if (!container) return;
        container.classList.remove('text-green-500', 'text-red-500');
        container.classList.add(v >= 0 ? 'text-green-500' : 'text-red-500');
        const icon = container.querySelector('i');
        if (icon) {
            icon.classList.remove('fa-arrow-up', 'fa-arrow-down');
            icon.classList.add(v >= 0 ? 'fa-arrow-up' : 'fa-arrow-down');
        }
    }

    async function loadDashboardStats() {
        try {
            const [
                salesRes,
                purchasesRes,
                customersRes,
                expensesRes,
                recentSalesRes,
                lowStockRes,
                customerNamesRes
            ] = await Promise.all([
                window.supabaseClient
                    .from('sales_invoices')
                    .select('id,invoice_date,total_amount,invoice_status,payment_status,customer_id')
                    .in('invoice_status', ['posted', 'draft']),
                window.supabaseClient
                    .from('purchase_invoices')
                    .select('id,invoice_date,total_amount,invoice_status')
                    .in('invoice_status', ['posted', 'draft']),
                window.supabaseClient
                    .from('customers')
                    .select('id,created_at,status')
                    .eq('status', 'active')
                    .is('deleted_at', null),
                window.supabaseClient
                    .from('expenses')
                    .select('id,expense_date,amount,status')
                    .eq('status', 'confirmed'),
                window.supabaseClient
                    .from('sales_invoices')
                    .select('id,invoice_number,invoice_date,total_amount,invoice_status,payment_status,customer_id')
                    .in('invoice_status', ['posted', 'draft'])
                    .order('invoice_date', { ascending: false })
                    .limit(5),
                window.supabaseClient
                    .from('v_inventory_summary')
                    .select('product_name,warehouse_name,quantity_available,stock_status')
                    .in('stock_status', ['low_stock', 'out_of_stock'])
                    .order('quantity_available', { ascending: true })
                    .limit(5),
                window.supabaseClient
                    .from('customers')
                    .select('id,shop_name')
            ]);

            if (salesRes.error) throw salesRes.error;
            if (purchasesRes.error) throw purchasesRes.error;
            if (customersRes.error) throw customersRes.error;
            if (expensesRes.error) throw expensesRes.error;
            if (recentSalesRes.error) throw recentSalesRes.error;
            if (lowStockRes.error) throw lowStockRes.error;
            if (customerNamesRes.error) throw customerNamesRes.error;

            const sales = salesRes.data || [];
            const purchases = purchasesRes.data || [];
            const customers = customersRes.data || [];
            const expenses = expensesRes.data || [];
            const recentSales = recentSalesRes.data || [];
            const lowStock = lowStockRes.data || [];
            const customerNameMap = new Map((customerNamesRes.data || []).map((c) => [c.id, c.shop_name]));

            const totalSales = sales.reduce((sum, x) => sum + Number(x.total_amount || 0), 0);
            const totalPurchases = purchases.reduce((sum, x) => sum + Number(x.total_amount || 0), 0);
            const totalCustomers = customers.length;
            const totalExpenses = expenses.reduce((sum, x) => sum + Number(x.amount || 0), 0);
            const netProfit = totalSales - totalPurchases - totalExpenses;

            if (totalSalesEl) totalSalesEl.textContent = fmtMoney(totalSales);
            if (totalPurchasesEl) totalPurchasesEl.textContent = fmtMoney(totalPurchases);
            if (totalCustomersEl) totalCustomersEl.textContent = String(totalCustomers);
            if (netProfitEl) netProfitEl.textContent = fmtMoney(netProfit);

            const current30 = getRangeDays(30, 0);
            const prev30 = getRangeDays(30, 30);

            const salesCurrent = sumRowsByDate(sales, 'invoice_date', 'total_amount', current30);
            const salesPrevious = sumRowsByDate(sales, 'invoice_date', 'total_amount', prev30);
            const purchasesCurrent = sumRowsByDate(purchases, 'invoice_date', 'total_amount', current30);
            const purchasesPrevious = sumRowsByDate(purchases, 'invoice_date', 'total_amount', prev30);
            const customersCurrent = countRowsByDate(customers, 'created_at', current30);
            const customersPrevious = countRowsByDate(customers, 'created_at', prev30);
            const profitCurrent = salesCurrent - purchasesCurrent;
            const profitPrevious = salesPrevious - purchasesPrevious;

            paintChange(salesChangeEl, calcChangePercent(salesCurrent, salesPrevious));
            paintChange(purchasesChangeEl, calcChangePercent(purchasesCurrent, purchasesPrevious));
            paintChange(customersChangeEl, calcChangePercent(customersCurrent, customersPrevious));
            paintChange(profitChangeEl, calcChangePercent(profitCurrent, profitPrevious));

            if (recentSalesTableBody) {
                recentSalesTableBody.innerHTML = '';
                if (!recentSales.length) {
                    recentSalesTableBody.innerHTML = '<tr><td colspan="4" class="text-center p-4">لا توجد مبيعات حديثة.</td></tr>';
                } else {
                    recentSales.forEach((sale) => {
                        const status = sale.payment_status === 'paid' ? 'مدفوعة' : sale.payment_status === 'partially_paid' ? 'جزئية' : 'غير مدفوعة';
                        const statusClass = sale.payment_status === 'paid'
                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                            : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';

                        const row = recentSalesTableBody.insertRow();
                        row.innerHTML = `
                            <td class="px-4 py-2 text-sm text-gray-800 dark:text-gray-200">${sale.invoice_number || sale.id}</td>
                            <td class="px-4 py-2 text-sm text-gray-800 dark:text-gray-200">${customerNameMap.get(sale.customer_id) || '—'}</td>
                            <td class="px-4 py-2 text-sm text-gray-800 dark:text-gray-200">${fmtMoney(sale.total_amount)}</td>
                            <td class="px-4 py-2 text-sm"><span class="px-2 py-1 rounded text-xs ${statusClass}">${status}</span></td>
                        `;
                    });
                }
            }

            if (lowStockTableBody) {
                lowStockTableBody.innerHTML = '';
                if (!lowStock.length) {
                    lowStockTableBody.innerHTML = '<tr><td colspan="4" class="text-center p-4">لا توجد أصناف منخفضة حالياً.</td></tr>';
                } else {
                    lowStock.forEach((item) => {
                        const isOut = item.stock_status === 'out_of_stock';
                        const status = isOut ? 'غير متوفر' : 'منخفض';
                        const statusClass = isOut
                            ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                            : 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';

                        const row = lowStockTableBody.insertRow();
                        row.innerHTML = `
                            <td class="px-4 py-2 text-sm text-gray-800 dark:text-gray-200">${item.product_name || '—'}</td>
                            <td class="px-4 py-2 text-sm text-gray-800 dark:text-gray-200">${item.warehouse_name || '—'}</td>
                            <td class="px-4 py-2 text-sm text-gray-800 dark:text-gray-200">${Number(item.quantity_available || 0).toFixed(3)}</td>
                            <td class="px-4 py-2 text-sm"><span class="px-2 py-1 rounded text-xs ${statusClass}">${status}</span></td>
                        `;
                    });
                }
            }
        } catch (error) {
            console.error('Error loading dashboard stats:', error);
        }
    }

    await loadDashboardStats();
}
