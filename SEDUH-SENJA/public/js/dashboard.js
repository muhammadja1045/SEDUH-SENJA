
async function loadDashboard() {
    // Ambil elemen status koneksi
    const connectionStatus = document.getElementById("connectionStatus");

    try {
        // ==========================================
        // 1. MENGAMBIL DATA DARI API
        // ==========================================

        const response = await fetch("/api/dashboard");

        if (!response.ok) {
            throw new Error(
                `Gagal mengambil data dashboard. Status: ${response.status}`
            );
        }

        const result = await response.json();

        // Pastikan respons API berbentuk objek
        if (!result || typeof result !== "object") {
            throw new Error("Format data dashboard tidak valid.");
        }

        // ==========================================
        // 2. MENAMPILKAN STATISTIK DASHBOARD
        // ==========================================

        document.getElementById("totalProducts").textContent =
            result.totalProducts ?? 0;

        document.getElementById("stockIn").textContent =
            result.stockIn ?? 0;

        document.getElementById("stockOut").textContent =
            result.stockOut ?? 0;

        document.getElementById("lowStock").textContent =
            result.lowStock ?? 0;

        // ==========================================
        // 3. MENAMPILKAN TABEL PRODUK
        // ==========================================

        const productBody = document.getElementById("productTable");

        // Pastikan data produk merupakan array
        const products = Array.isArray(result.products)
            ? result.products
            : [];

        if (productBody) {
            if (products.length === 0) {
                productBody.innerHTML = `
                    <tr>
                        <td colspan="5" class="empty-state">
                            Belum ada produk. Silakan tambahkan produk pertama.
                        </td>
                    </tr>
                `;
            } else {
                productBody.innerHTML = products.map(product => `
                    <tr>
                        <td>${escapeHTML(product.code)}</td>
                        <td>${escapeHTML(product.name)}</td>
                        <td>${escapeHTML(product.category || "-")}</td>
                        <td>
                            ${escapeHTML(product.stock ?? 0)}
                            ${escapeHTML(product.unit || "")}
                        </td>
                        <td>
                            <span class="status-badge">
                                ${
                                    Number(product.stock ?? 0) <=
                                    Number(product.minimum_stock ?? 0)
                                        ? "Stok menipis"
                                        : "Tersedia"
                                }
                            </span>
                        </td>
                    </tr>
                `).join("");
            }
        }

        // ==========================================
        // 4. MENAMPILKAN RINGKASAN STOK PER SATUAN
        // ==========================================

        const unitBody = document.getElementById("unitSummary");

        // Pastikan data stok berdasarkan satuan merupakan array
        const stockByUnit = Array.isArray(result.stockByUnit)
            ? result.stockByUnit
            : [];

        if (unitBody) {
            if (stockByUnit.length === 0) {
                unitBody.innerHTML = `
                    <div class="stock-row">
                        <span>Belum ada data stok</span>
                        <strong>0</strong>
                    </div>
                `;
            } else {
                unitBody.innerHTML = stockByUnit.map(item => `
                    <div class="stock-row">
                        <span>
                            Total stok (${escapeHTML(item.unit || "-")})
                        </span>
                        <strong>${escapeHTML(item.total ?? 0)}</strong>
                    </div>
                `).join("");
            }
        }

        // ==========================================
        // 5. MENAMPILKAN WAKTU PEMBARUAN
        // ==========================================

        const lastUpdated = document.getElementById("lastUpdated");

        if (lastUpdated) {
            lastUpdated.textContent =
                "Diperbarui: " +
                new Date().toLocaleTimeString("id-ID");
        }

        // ==========================================
        // 6. STATUS KONEKSI DATABASE
        // ==========================================

        if (connectionStatus) {
            connectionStatus.textContent =
                "Terhubung dengan database SEDUH SENJA";
        }

    } catch (error) {

        // ==========================================
        // 7. PENANGANAN ERROR
        // ==========================================

        console.error("Dashboard Error:", error);

        if (connectionStatus) {
            connectionStatus.textContent =
                "Data belum dapat dimuat";
        }

        // Tampilkan pesan jika data gagal dimuat
        const productBody = document.getElementById("productTable");

        if (productBody) {
            productBody.innerHTML = `
                <tr>
                    <td colspan="5" class="empty-state">
                        Gagal memuat data produk. Silakan muat ulang halaman.
                    </td>
                </tr>
            `;
        }

        const unitBody = document.getElementById("unitSummary");

        if (unitBody) {
            unitBody.innerHTML = `
                <div class="stock-row">
                    <span>Data stok tidak dapat dimuat</span>
                    <strong>-</strong>
                </div>
            `;
        }
    }
}

// ==========================================
// 8. FUNGSI PENGAMAN HTML
// ==========================================

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[character]);
}

// ==========================================
// 9. JALANKAN DASHBOARD
// ==========================================

loadDashboard();
