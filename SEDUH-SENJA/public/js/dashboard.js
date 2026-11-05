
async function loadDashboard() {
    try {
        const response = await fetch("/api/dashboard");

        if (!response.ok) {
            throw new Error("Gagal mengambil data dashboard");
        }

        const result = await response.json();

        document.getElementById("totalProducts").textContent =
            result.totalProducts;

        document.getElementById("stockIn").textContent =
            result.stockIn;

        document.getElementById("stockOut").textContent =
            result.stockOut;

        document.getElementById("lowStock").textContent =
            result.lowStock;

        const productBody = document.getElementById("productTable");

        if (result.products.length === 0) {
            productBody.innerHTML = `
                <tr>
                    <td colspan="5" class="empty-state">
                        Belum ada produk. Silakan tambahkan produk pertama.
                    </td>
                </tr>
            `;
        } else {
            productBody.innerHTML = result.products.map(product => `
                <tr>
                    <td>${escapeHTML(product.code)}</td>
                    <td>${escapeHTML(product.name)}</td>
                    <td>${escapeHTML(product.category || "-")}</td>
                    <td>${product.stock} ${escapeHTML(product.unit)}</td>
                    <td>
                        <span class="status-badge">
                            ${product.stock <= product.minimum_stock
                                ? "Stok menipis"
                                : "Tersedia"}
                        </span>
                    </td>
                </tr>
            `).join("");
        }

        const unitBody = document.getElementById("unitSummary");

        if (result.stockByUnit.length === 0) {
            unitBody.innerHTML = `
                <div class="stock-row">
                    <span>Belum ada data stok</span>
                    <strong>0</strong>
                </div>
            `;
        } else {
            unitBody.innerHTML = result.stockByUnit.map(item => `
                <div class="stock-row">
                    <span>Total stok (${escapeHTML(item.unit)})</span>
                    <strong>${item.total}</strong>
                </div>
            `).join("");
        }

        document.getElementById("lastUpdated").textContent =
            "Diperbarui: " + new Date().toLocaleTimeString("id-ID");
document.getElementById("connectionStatus").textContent =
    "Terhubung dengan database SEDUH SENJA";
    } catch (error) {
        console.error(error);
        document.getElementById("connectionStatus").textContent =
            "Data belum dapat dimuat";
    }
}

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[character]);
}

loadDashboard();
