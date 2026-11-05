
const form = document.getElementById("stockOutForm");
const productSelect = document.getElementById("productId");
const quantityInput = document.getElementById("quantity");
const dateInput = document.getElementById("transactionDate");
const stockInfo = document.getElementById("stockInfo");
const tableBody = document.getElementById("stockOutTable");
const message = document.getElementById("stockOutMessage");
const saveButton = document.getElementById("saveStockOut");

let products = [];

// ==========================================
// 1. TANGGAL HARI INI
// ==========================================

function getTodayDate() {
    const today = new Date();

    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

dateInput.value = getTodayDate();

// ==========================================
// 2. ESCAPE HTML
// ==========================================

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[char]);
}

// ==========================================
// 3. FORMAT TANGGAL
// ==========================================

function formatDate(value) {
    if (!value) return "-";

    const date = String(value).slice(0, 10);
    const parts = date.split("-");

    if (parts.length !== 3) return escapeHTML(value);

    return `${parts[2]}-${parts[1]}-${parts[0]}`;
}

// ==========================================
// 4. FORMAT ANGKA
// ==========================================

function formatNumber(value) {
    return new Intl.NumberFormat("id-ID", {
        maximumFractionDigits: 2
    }).format(Number(value) || 0);
}

// ==========================================
// 5. MEMUAT PRODUK
// ==========================================

async function loadProducts() {
    try {
        const response = await fetch("/api/products");
        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(
                result.message || "Gagal memuat produk."
            );
        }

        products = result.data || [];

        productSelect.innerHTML =
            '<option value="">Pilih produk</option>';

        products.forEach((product) => {
            const option = document.createElement("option");

            option.value = product.id;
            option.textContent =
                `${product.code} - ${product.name}`;

            productSelect.appendChild(option);
        });

        updateStockInfo();

    } catch (error) {
        console.error("Load products error:", error);

        productSelect.innerHTML =
            '<option value="">Gagal memuat produk</option>';

        stockInfo.textContent = error.message;
    }
}

// ==========================================
// 6. INFORMASI STOK PRODUK
// ==========================================

function updateStockInfo() {
    const productId = Number(productSelect.value);

    const product = products.find(
        (item) => Number(item.id) === productId
    );

    if (!product) {
        stockInfo.innerHTML =
            "Pilih produk untuk melihat stok tersedia.";

        return;
    }

    const stock = Number(product.stock) || 0;
    const unit = escapeHTML(product.unit);

    stockInfo.innerHTML = `
        Stok tersedia:
        <strong>${formatNumber(stock)} ${unit}</strong>
    `;

    quantityInput.max = stock;

    if (Number(quantityInput.value) > stock) {
        quantityInput.setCustomValidity(
            `Stok tersedia hanya ${stock} ${product.unit}.`
        );
    } else {
        quantityInput.setCustomValidity("");
    }
}

productSelect.addEventListener("change", updateStockInfo);

quantityInput.addEventListener("input", updateStockInfo);

// ==========================================
// 7. MEMUAT RIWAYAT BARANG KELUAR
// ==========================================

async function loadStockOutHistory() {
    try {
        const response = await fetch("/api/stock-out");
        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(
                result.message || "Gagal memuat riwayat."
            );
        }

        const transactions = result.data || [];

        if (transactions.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="6" class="out-empty">
                        Belum ada transaksi barang keluar.
                    </td>
                </tr>
            `;

            return;
        }

        tableBody.innerHTML = transactions.map((item) => `
            <tr>
                <td class="out-code">
                    ${escapeHTML(item.transaction_code)}
                </td>

                <td>
                    ${formatDate(item.transaction_date)}
                </td>

                <td>
                    ${escapeHTML(item.product_code)}
                </td>

                <td>
                    ${escapeHTML(item.product_name)}
                </td>

                <td>
                    <span class="out-badge">
                        -${formatNumber(item.quantity)}
                        ${escapeHTML(item.unit)}
                    </span>
                </td>

                <td>
                    ${escapeHTML(item.notes || "-")}
                </td>
            </tr>
        `).join("");

    } catch (error) {
        console.error("Load stock-out error:", error);

        tableBody.innerHTML = `
            <tr>
                <td colspan="6" class="out-empty">
                    Gagal memuat riwayat transaksi.
                </td>
            </tr>
        `;
    }
}

// ==========================================
// 8. SIMPAN TRANSAKSI BARANG KELUAR
// ==========================================

form.addEventListener("submit", async (event) => {
    event.preventDefault();

    message.textContent = "";

    const productId = Number(productSelect.value);
    const quantity = Number(quantityInput.value);

    const product = products.find(
        (item) => Number(item.id) === productId
    );

    if (!product) {
        message.textContent = "Silakan pilih produk terlebih dahulu.";
        message.style.color = "#B84A3A";
        return;
    }

    if (!Number.isFinite(quantity) || quantity <= 0) {
        message.textContent = "Jumlah barang harus lebih dari 0.";
        message.style.color = "#B84A3A";
        return;
    }

    if (quantity > Number(product.stock)) {
        message.textContent =
            `Stok tidak mencukupi. Stok tersedia: ${product.stock} ${product.unit}.`;

        message.style.color = "#B84A3A";
        return;
    }

    const payload = {
        product_id: productId,
        quantity: quantity,
        transaction_date: dateInput.value,
        notes: document.getElementById("notes").value.trim()
    };

    saveButton.disabled = true;
    saveButton.textContent = "Menyimpan...";

    try {
        const response = await fetch("/api/stock-out", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(
                result.message || "Transaksi gagal disimpan."
            );
        }

        message.textContent =
            `${result.message} Sisa stok: ${formatNumber(result.remaining_stock)} ${result.unit}.`;

        message.style.color = "#287A48";

        form.reset();
        dateInput.value = getTodayDate();

        await loadProducts();
        await loadStockOutHistory();

    } catch (error) {
        console.error("Save stock-out error:", error);

        message.textContent = error.message;
        message.style.color = "#B84A3A";

    } finally {
        saveButton.disabled = false;
        saveButton.textContent = "Simpan Barang Keluar";
    }
});

// ==========================================
// 9. RESET FORM
// ==========================================

form.addEventListener("reset", () => {
    setTimeout(() => {
        dateInput.value = getTodayDate();
        message.textContent = "";
        updateStockInfo();
    }, 0);
});

// ==========================================
// 10. JALANKAN SAAT HALAMAN DIBUKA
// ==========================================

loadProducts();
loadStockOutHistory();
