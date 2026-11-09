
document.addEventListener("DOMContentLoaded", () => {

    // ==========================================
    // 1. ELEMENT
    // ==========================================

    const startDate = document.getElementById("startDate");
    const endDate = document.getElementById("endDate");
    const productFilter = document.getElementById("productFilter");
    const typeFilter = document.getElementById("typeFilter");

    const filterButton = document.getElementById("filterButton");
    const resetButton = document.getElementById("resetButton");
    const excelButton = document.getElementById("excelButton");
    const pdfButton = document.getElementById("pdfButton");

    const tableBody = document.getElementById("reportTable");
    const message = document.getElementById("reportMessage");

    const totalStockIn = document.getElementById("totalStockIn");
    const totalStockOut = document.getElementById("totalStockOut");
    const totalTransactions = document.getElementById("totalTransactions");
    const totalProducts = document.getElementById("totalProducts");
    const reportTotal = document.getElementById("reportTotal");

    const monthlyCanvas = document.getElementById("monthlyChart");
    const topProductsList = document.getElementById("topProductsList");

    const inventoryProducts = document.getElementById("inventoryProducts");
    const inventoryUnits = document.getElementById("inventoryUnits");
    const inventoryValue = document.getElementById("inventoryValue");

    let transactions = [];
    let monthlyChart = null;
    let isLoading = false;

    // ==========================================
    // 2. HELPER
    // ==========================================

    async function apiRequest(url) {
        const response = await fetch(url, {
            method: "GET",
            headers: {
                "Accept": "application/json"
            }
        });

        const result = await response.json().catch(() => ({
            success: false,
            message: "Respons server bukan JSON yang valid."
        }));

        if (!response.ok || !result.success) {
            throw new Error(
                result.message || `HTTP Error ${response.status}`
            );
        }

        return result;
    }

    function formatNumber(value) {
        return new Intl.NumberFormat("id-ID", {
            maximumFractionDigits: 2
        }).format(Number(value) || 0);
    }

    function formatCurrency(value) {
        return new Intl.NumberFormat("id-ID", {
            style: "currency",
            currency: "IDR",
            maximumFractionDigits: 0
        }).format(Number(value) || 0);
    }

    function formatDate(value) {
        if (!value) return "-";

        const datePart = String(value).split(" ")[0];
        const parts = datePart.split("-");

        if (parts.length !== 3) return String(value);

        const date = new Date(
            Number(parts[0]),
            Number(parts[1]) - 1,
            Number(parts[2])
        );

        if (Number.isNaN(date.getTime())) {
            return String(value);
        }

        return date.toLocaleDateString("id-ID", {
            day: "2-digit",
            month: "long",
            year: "numeric"
        });
    }

    function formatMonth(value) {
        if (!value) return "-";

        const parts = String(value).split("-");

        if (parts.length !== 2) return value;

        const date = new Date(
            Number(parts[0]),
            Number(parts[1]) - 1,
            1
        );

        return date.toLocaleDateString("id-ID", {
            month: "short",
            year: "numeric"
        });
    }

    function getLocalDate() {
        const now = new Date();

        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, "0");
        const day = String(now.getDate()).padStart(2, "0");

        return `${year}-${month}-${day}`;
    }

    function showMessage(text, success = false) {
        if (!message) return;

        message.textContent = text;
        message.style.color = success ? "#27834B" : "#C0392B";
    }

    function createCell(value, className = "") {
        const td = document.createElement("td");

        td.textContent = value ?? "";

        if (className) {
            td.className = className;
        }

        return td;
    }

    function getTransactionLabel(type) {
        const labels = {
            IN: "Barang Masuk",
            OUT: "Barang Keluar",
            OPENING: "Stok Awal"
        };

        return labels[type] || "Tidak Diketahui";
    }

    function showLoading() {
        tableBody.innerHTML = `
            <tr>
                <td colspan="8" class="report-empty">
                    Memuat data laporan...
                </td>
            </tr>
        `;
    }

    function showEmpty(text) {
        tableBody.innerHTML = "";

        const tr = document.createElement("tr");
        const td = document.createElement("td");

        td.colSpan = 8;
        td.className = "report-empty";
        td.textContent = text;

        tr.appendChild(td);
        tableBody.appendChild(tr);
    }

    // ==========================================
    // 3. MEMUAT PRODUK
    // ==========================================

    async function loadProducts() {
        try {
            const result = await apiRequest("/api/products");

            const products = Array.isArray(result.products)
                ? result.products
                : Array.isArray(result.data)
                    ? result.data
                    : [];

            productFilter.innerHTML = "";

            const defaultOption = document.createElement("option");

            defaultOption.value = "";
            defaultOption.textContent = "Semua Produk";

            productFilter.appendChild(defaultOption);

            products.forEach(product => {
                if (Number(product.is_archived || 0) !== 0) {
                    return;
                }

                const option = document.createElement("option");

                option.value = product.id;
                option.textContent =
                    `${product.code} - ${product.name}`;

                productFilter.appendChild(option);
            });

            console.log("[REPORT] Produk dimuat:", products.length);

        } catch (error) {
            console.error("[REPORT] Load products:", error);
        }
    }

    // ==========================================
    // 4. FILTER PARAMETER
    // ==========================================

    function buildFilterParams() {
        const params = new URLSearchParams();

        if (startDate.value) {
            params.set("start_date", startDate.value);
        }

        if (endDate.value) {
            params.set("end_date", endDate.value);
        }

        if (productFilter.value) {
            params.set("product_id", productFilter.value);
        }

        if (typeFilter.value) {
            params.set("type", typeFilter.value);
        }

        return params;
    }

    // ==========================================
    // 5. RINGKASAN TRANSAKSI
    // ==========================================

    function updateSummary(summary = {}) {
        totalStockIn.textContent =
            formatNumber(summary.total_stock_in);

        totalStockOut.textContent =
            formatNumber(summary.total_stock_out);

        totalTransactions.textContent =
            formatNumber(summary.total_transactions);

        totalProducts.textContent =
            formatNumber(summary.total_products);
    }

    // ==========================================
    // 6. RINGKASAN PERSEDIAAN
    // ==========================================

    function updateInventory(inventory = {}) {
        inventoryProducts.textContent =
            formatNumber(inventory.total_products);

        inventoryUnits.textContent =
            formatNumber(inventory.total_units);

        inventoryValue.textContent =
            formatCurrency(inventory.total_inventory_value);
    }

    // ==========================================
    // 7. GRAFIK AKTIVITAS INVENTARIS
    // ==========================================

    function renderMonthlyChart(monthly = []) {

        if (!monthlyCanvas) {
            console.error("[REPORT] Canvas monthlyChart tidak ditemukan.");
            return;
        }

        if (typeof Chart === "undefined") {
            console.error("[REPORT] Library Chart.js tidak ditemukan.");
            showMessage("Chart.js gagal dimuat. Periksa koneksi internet.");
            return;
        }

        // Hapus grafik sebelumnya agar tidak bertumpuk
        if (monthlyChart) {
            monthlyChart.destroy();
            monthlyChart = null;
        }

        // Pastikan data berupa array
        if (!Array.isArray(monthly)) {
            monthly = [];
        }

        const labels = monthly.map(item =>
            formatMonth(item.month)
        );

        const stockIn = monthly.map(item =>
            Number(item.stock_in) || 0
        );

        const stockOut = monthly.map(item =>
            Number(item.stock_out) || 0
        );

        const openingStock = monthly.map(item =>
            Number(item.opening_stock) || 0
        );

        monthlyChart = new Chart(monthlyCanvas, {

            type: "bar",

            data: {
                labels: labels,

                datasets: [

                    {
                        type: "bar",
                        label: "Barang Masuk",
                        data: stockIn,
                        backgroundColor: "#9b7653",
                        borderColor: "#79543a",
                        borderWidth: 1,
                        borderRadius: 6,
                        maxBarThickness: 35
                    },

                    {
                        type: "bar",
                        label: "Barang Keluar",
                        data: stockOut,
                        backgroundColor: "#d58b72",
                        borderColor: "#b86b53",
                        borderWidth: 1,
                        borderRadius: 6,
                        maxBarThickness: 35
                    },

                    {
                        type: "line",
                        label: "Stok Awal",
                        data: openingStock,
                        borderColor: "#4e8268",
                        backgroundColor: "rgba(78,130,104,0.12)",
                        pointBackgroundColor: "#4e8268",
                        pointBorderColor: "#ffffff",
                        pointBorderWidth: 2,
                        pointRadius: 5,
                        pointHoverRadius: 7,
                        borderWidth: 3,
                        tension: 0.35,
                        fill: false
                    }

                ]
            },

            options: {

                responsive: true,
                maintainAspectRatio: false,

                interaction: {
                    intersect: false,
                    mode: "index"
                },

                plugins: {

                    legend: {
                        display: true,
                        position: "bottom",

                        labels: {
                            usePointStyle: true,
                            pointStyle: "circle",
                            padding: 18,
                            color: "#594333",
                            font: {
                                family: "Inter",
                                size: 11,
                                weight: "600"
                            }
                        }
                    },

                    tooltip: {
                        backgroundColor: "#30221b",
                        titleColor: "#ffffff",
                        bodyColor: "#f8f4ee",
                        padding: 12,
                        cornerRadius: 8,

                        callbacks: {
                            label: function(context) {
                                return `${context.dataset.label}: ${
                                    formatNumber(context.raw)
                                } unit`;
                            }
                        }
                    }

                },

                scales: {

                    x: {
                        grid: {
                            display: false
                        },

                        ticks: {
                            color: "#8b7969",
                            font: {
                                size: 11
                            }
                        }
                    },

                    y: {
                        beginAtZero: true,

                        grid: {
                            color: "rgba(121,84,58,0.10)"
                        },

                        ticks: {
                            precision: 0,
                            color: "#8b7969"
                        },

                        title: {
                            display: true,
                            text: "Jumlah Barang",
                            color: "#8b7969"
                        }
                    }

                }

            }

        });

        console.log(
            "[REPORT] Grafik berhasil dibuat:",
            monthly
        );
    }

    // ==========================================
    // 8. TOP 5 PRODUK TERBANYAK KELUAR
    // ==========================================

    function renderTopProducts(products = []) {

        topProductsList.innerHTML = "";

        if (!Array.isArray(products) || products.length === 0) {

            const empty = document.createElement("p");

            empty.className = "report-empty";
            empty.textContent = "Belum ada data barang keluar.";

            topProductsList.appendChild(empty);

            return;
        }

        products.forEach((product, index) => {

            const item = document.createElement("div");
            item.className = "top-product-item";

            const rank = document.createElement("div");
            rank.className = "top-product-rank";
            rank.textContent = index + 1;

            const info = document.createElement("div");
            info.className = "top-product-info";

            const name = document.createElement("strong");
            name.textContent = product.name || "Produk tanpa nama";

            const detail = document.createElement("small");
            detail.textContent =
                `${product.code || "-"} • ${
                    formatNumber(product.total_transactions)
                } transaksi`;

            info.appendChild(name);
            info.appendChild(detail);

            const quantity = document.createElement("div");
            quantity.className = "top-product-quantity";

            quantity.textContent =
                `${formatNumber(product.total_quantity)} ${
                    product.unit || "unit"
                }`;

            item.appendChild(rank);
            item.appendChild(info);
            item.appendChild(quantity);

            topProductsList.appendChild(item);
        });

        console.log(
            "[REPORT] Top products berhasil ditampilkan:",
            products.length
        );
    }

    // ==========================================
    // 9. RIWAYAT TRANSAKSI
    // ==========================================

    function renderTransactions(data) {

        tableBody.innerHTML = "";

        if (!Array.isArray(data) || data.length === 0) {
            showEmpty("Tidak ada transaksi pada filter ini.");
            return;
        }

        const fragment = document.createDocumentFragment();

        data.forEach(item => {

            const tr = document.createElement("tr");

            tr.appendChild(createCell(item.transaction_code));

            tr.appendChild(
                createCell(formatDate(item.transaction_date))
            );

            const typeCell = document.createElement("td");
            const badge = document.createElement("span");

            const types = {
                IN: {
                    className: "in",
                    label: "Barang Masuk"
                },

                OUT: {
                    className: "out",
                    label: "Barang Keluar"
                },

                OPENING: {
                    className: "opening",
                    label: "Stok Awal"
                }
            };

            const transaction = types[item.transaction_type] || {
                className: "",
                label: item.transaction_type || "-"
            };

            badge.className =
                `report-type ${transaction.className}`;

            badge.textContent = transaction.label;

            typeCell.appendChild(badge);
            tr.appendChild(typeCell);

            tr.appendChild(createCell(item.product_code));
            tr.appendChild(createCell(item.product_name));

            tr.appendChild(
                createCell(
                    `${formatNumber(item.quantity)} ${item.unit || ""}`,
                    "report-total"
                )
            );

            tr.appendChild(
                createCell(item.supplier_name || "-")
            );

            tr.appendChild(
                createCell(item.notes || item.purpose || "-")
            );

            fragment.appendChild(tr);
        });

        tableBody.appendChild(fragment);
    }

    // ==========================================
    // 10. VALIDASI FILTER
    // ==========================================

    function validateFilters() {

        if (
            startDate.value &&
            endDate.value &&
            startDate.value > endDate.value
        ) {
            showMessage(
                "Tanggal awal tidak boleh melebihi tanggal akhir."
            );

            startDate.focus();

            return false;
        }

        return true;
    }

    // ==========================================
    // 11. MEMUAT LAPORAN DARI API
    // ==========================================

    async function loadReports() {

        if (isLoading) return;

        isLoading = true;

        filterButton.disabled = true;
        filterButton.textContent = "Memuat...";

        showLoading();

        try {

            const params = buildFilterParams();
            const query = params.toString();

            const url = query
                ? `/api/reports?${query}`
                : "/api/reports";

            const result = await apiRequest(url);

            transactions = Array.isArray(result.data)
                ? result.data
                : [];

            // 1. Statistik transaksi
            updateSummary(result.summary || {});

            // 2. Ringkasan persediaan
            updateInventory(result.inventory || {});

            // 3. Grafik bulanan
            renderMonthlyChart(
                result.analytics?.monthly || []
            );

            // 4. Produk terbanyak keluar
            renderTopProducts(
                result.analytics?.top_products || []
            );

            // 5. Riwayat transaksi
            renderTransactions(transactions);

            // 6. Total transaksi
            reportTotal.textContent =
                `${formatNumber(result.total ?? transactions.length)} transaksi`;

            showMessage(
                `Berhasil memuat ${transactions.length} transaksi.`,
                true
            );

            console.log("[REPORT] API RESPONSE:", result);

        } catch (error) {

            console.error("[REPORT] Load reports:", error);

            transactions = [];

            updateSummary({});
            updateInventory({});

            renderMonthlyChart([]);
            renderTopProducts([]);

            showEmpty("Gagal memuat laporan inventaris.");

            reportTotal.textContent = "0 transaksi";

            showMessage(error.message);

        } finally {

            isLoading = false;

            filterButton.disabled = false;
            filterButton.textContent = "🔍 Terapkan Filter";
        }
    }

    // ==========================================
    // 12. TERAPKAN FILTER
    // ==========================================

    filterButton.addEventListener("click", () => {

        if (!validateFilters()) return;

        loadReports();
    });

    // ==========================================
    // 13. RESET FILTER
    // ==========================================

    resetButton.addEventListener("click", () => {

        startDate.value = "";
        endDate.value = "";
        productFilter.value = "";
        typeFilter.value = "";

        showMessage("");

        loadReports();
    });

    // ==========================================
    // 14. EXPORT EXCEL / CSV
    // ==========================================

    function protectCSV(value) {

        let text = String(value ?? "");

        if (/^[\s]*[=+\-@]/.test(text)) {
            text = "'" + text;
        }

        return `"${text.replace(/"/g, '""')}"`;
    }

    function exportExcel() {

        if (!transactions.length) {
            showMessage("Tidak ada data untuk diekspor.");
            return;
        }

        const headers = [
            "Kode Transaksi",
            "Tanggal",
            "Jenis Transaksi",
            "Kode Produk",
            "Nama Produk",
            "Jumlah",
            "Satuan",
            "Supplier",
            "Keterangan"
        ];

        const rows = transactions.map(item => [

            item.transaction_code,
            formatDate(item.transaction_date),
            getTransactionLabel(item.transaction_type),
            item.product_code,
            item.product_name,
            item.quantity,
            item.unit,
            item.supplier_name || "-",
            item.notes || item.purpose || "-"

        ]);

        const csv = [
            headers,
            ...rows
        ]
            .map(row =>
                row.map(protectCSV).join(";")
            )
            .join("\r\n");

        const blob = new Blob(
            ["\uFEFF" + csv],
            {
                type: "text/csv;charset=utf-8;"
            }
        );

        const url = URL.createObjectURL(blob);

        const link = document.createElement("a");

        link.href = url;
        link.download =
            `Laporan_SEDUH_SENJA_${getLocalDate()}.csv`;

        document.body.appendChild(link);
        link.click();
        link.remove();

        setTimeout(() => {
            URL.revokeObjectURL(url);
        }, 1000);

        showMessage(
            "Laporan berhasil diekspor ke Excel.",
            true
        );
    }

    excelButton.addEventListener("click", exportExcel);

    // ==========================================
    // 15. CETAK / PDF
    // ==========================================

    pdfButton.addEventListener("click", () => {

        if (!transactions.length) {
            showMessage("Tidak ada data untuk dicetak.");
            return;
        }

        window.print();
    });

    // ==========================================
    // 16. INISIALISASI
    // ==========================================

    console.log(
        "SEDUH SENJA - Report System Initialized"
    );

    async function initialize() {

        await loadProducts();

        await loadReports();
    }

    initialize();

});
