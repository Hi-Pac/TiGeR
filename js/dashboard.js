async function initDashboardModule() {
    console.log("Dashboard Module Initialized!");

    const dashboardModuleNode = document.getElementById('dashboard-module');
    if (!dashboardModuleNode) {
        console.error("Dashboard module container not found.");
        return;
    }

    loadDashboardStats();

    async function loadDashboardStats() {
        try {
            await new Promise(resolve => setTimeout(resolve, 500));
            
            const dashboardStats = {
                totalSales: 125650.75,
                totalPurchases: 98500.00,
                totalCustomers: 156,
                netProfit: 27150.75,
                salesChange: 12.5,
                purchasesChange: 8.3,
                customersChange: 5.2,
                profitChange: 15.8,
                recentSales: [
                    { invoiceNo: 'INV-001', customer: 'ماركت السعادة', amount: 2500, status: 'مكتملة' },
                    { invoiceNo: 'INV-002', customer: 'بقالة الخير', amount: 1800, status: 'مكتملة' },
                    { invoiceNo: 'INV-003', customer: 'هايبر النور', amount: 3200, status: 'معلقة' }
                ],
                lowStockItems: [
                    { productName: 'زيت عباد الشمس 1 لتر', warehouse: 'مخزن الإسكندرية', quantity: 5, status: 'منخفضة' },
                    { productName: 'مكرونة اسباجتي 400جم', warehouse: 'المخزن الرئيسي', quantity: 0, status: 'غير متوفر' }
                ]
            };

            const totalSalesEl = document.getElementById('dashboard-total-sales');
            const totalPurchasesEl = document.getElementById('dashboard-total-purchases');
            const totalCustomersEl = document.getElementById('dashboard-total-customers');
            const netProfitEl = document.getElementById('dashboard-net-profit');
            
            const salesChangeEl = document.getElementById('dashboard-sales-change');
            const purchasesChangeEl = document.getElementById('dashboard-purchases-change');
            const customersChangeEl = document.getElementById('dashboard-customers-change');
            const profitChangeEl = document.getElementById('dashboard-profit-change');

            if (totalSalesEl) totalSalesEl.textContent = dashboardStats.totalSales.toFixed(2) + ' ج.م';
            if (totalPurchasesEl) totalPurchasesEl.textContent = dashboardStats.totalPurchases.toFixed(2) + ' ج.م';
            if (totalCustomersEl) totalCustomersEl.textContent = dashboardStats.totalCustomers;
            if (netProfitEl) netProfitEl.textContent = dashboardStats.netProfit.toFixed(2) + ' ج.م';
            
            if (salesChangeEl) salesChangeEl.textContent = dashboardStats.salesChange.toFixed(1);
            if (purchasesChangeEl) purchasesChangeEl.textContent = dashboardStats.purchasesChange.toFixed(1);
            if (customersChangeEl) customersChangeEl.textContent = dashboardStats.customersChange.toFixed(1);
            if (profitChangeEl) profitChangeEl.textContent = dashboardStats.profitChange.toFixed(1);

            const recentSalesTableBody = document.getElementById('dashboard-recent-sales-table');
            if (recentSalesTableBody) {
                recentSalesTableBody.innerHTML = '';
                dashboardStats.recentSales.forEach(sale => {
                    const row = recentSalesTableBody.insertRow();
                    row.innerHTML = `
                        <td class="px-4 py-2 text-sm text-gray-800 dark:text-gray-200">${sale.invoiceNo}</td>
                        <td class="px-4 py-2 text-sm text-gray-800 dark:text-gray-200">${sale.customer}</td>
                        <td class="px-4 py-2 text-sm text-gray-800 dark:text-gray-200">${sale.amount} ج.م</td>
                        <td class="px-4 py-2 text-sm">
                            <span class="px-2 py-1 rounded text-xs ${sale.status === 'مكتملة' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'}">
                                ${sale.status}
                            </span>
                        </td>
                    `;
                });
            }

            const lowStockTableBody = document.getElementById('dashboard-low-stock-table');
            if (lowStockTableBody) {
                lowStockTableBody.innerHTML = '';
                dashboardStats.lowStockItems.forEach(item => {
                    const row = lowStockTableBody.insertRow();
                    row.innerHTML = `
                        <td class="px-4 py-2 text-sm text-gray-800 dark:text-gray-200">${item.productName}</td>
                        <td class="px-4 py-2 text-sm text-gray-800 dark:text-gray-200">${item.warehouse}</td>
                        <td class="px-4 py-2 text-sm text-gray-800 dark:text-gray-200">${item.quantity}</td>
                        <td class="px-4 py-2 text-sm">
                            <span class="px-2 py-1 rounded text-xs ${item.quantity > 0 ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'}">
                                ${item.status}
                            </span>
                        </td>
                    `;
                });
            }

        } catch (error) {
            console.error("Error loading dashboard stats:", error);
        }
    }
}
