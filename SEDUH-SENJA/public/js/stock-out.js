
"use strict";

// ==========================================
// 1. ELEMENT HTML
// ==========================================

const form = document.getElementById("stockOutForm");
const productSelect = document.getElementById("productId");
const quantityInput = document.getElementById("quantity");
const dateInput = document.getElementById("transactionDate");
const stockInfo = document.getElementById("stockInfo");
const tableBody = document.getElementById("stockOutTable");
const message = document.getElementById("stockOutMessage");
const saveButton = document.getElementById("saveStockOut");

const notesInput = document.getElementById("notes");

let products = [];
let isLoading = false;

// ==========================================
// 2. VALIDASI ELEMENT
// ==========================================

if (
    !form ||
    !productSelect ||
    !quantityInput ||
    !dateInput ||
    !stockInfo ||
    !tableBody ||
    !message ||
    !saveButton ||
    !notesInput
) {
    console.error(
        "Elemen HTML Barang Keluar tidak lengkap. Periksa ID elemen."
    );
} else {

    // ==========================================
    // 3. TANGGAL HARI INI
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
    // 4. ESCAPE HTML
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
    // 5. FORMAT ANGKA
    // ==========================================

    function formatNumber(value) {
        return new Intl.NumberFormat("id-ID", {
            maximumFractionDigits: 2
        }).format(Number(value) || 0);
    }

    // ==========================================
    // 6. FORMAT TANGGAL
    // ==========================================

    function formatDate(value) {
        if (!value) return "-";

        const date = String(value).slice(0, 10);
        const parts = date.split("-");

        if (parts.length !== 3) {
            return escapeHTML(value);
        }

        return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }

    // ==========================================
    // 7. MENAMPILKAN PESAN
    // ==========================================

    function showMessage(text, type = "error") {
        message.textContent = text;

        message.style.color =
            type === "success" ? "#287A48" : "#B84A3A";
    }

    // ==========================================
    // 8. REQUEST API
    // ==========================================

    async function apiRequest(url, options = {}) {
        const response = await fetch(url, {
            ...options,
            headers: {
                ...(options.body ? {
                    "Content-Type": "application/json"
                } : {}),
                ...options.headers
            }
        });

        let result;

        try {
            result = await response.json();
        } catch {
            throw new Error(
                "Server memberikan respons yang tidak valid."
            );
        }

        if (!response.ok || result.success === false) {
            throw new Error(
                result.message || `Request gagal (${response.status}).`
            );
        }

        return result;
    }

    // ==========================================
    // 9. MEMUAT DATA PRODUK
    // ==========================================

    async function loadProducts() {
        try {
            productSelect.innerHTML =
                '<option value="">Memuat produk...</option>';

            productSelect.disabled = true;

            const result = await apiRequest("/api/products");

            // Backend products.js mengirim result.products
            products = Array.isArray(result.products)
                ? result.products
                : Array.isArray(result.data)
                    ? result.data
                    : [];

            productSelect.innerHTML =
                '<option value="">Pilih produk</option>';

            if (products.length === 0) {
                productSelect.innerHTML =
                    '<option value="">Belum ada produk tersedia</option>';

                stockInfo.textContent =
                    "Belum ada produk aktif di Inventaris.";

                return;
            }

            products.forEach((product) => {
                const option = document.createElement("option");

                const stock = Number(product.stock) || 0;
                const unit = product.unit || "";

                option.value = product.id;

                option.textContent =
                    `${product.code} - ${product.name} | Stok: ${formatNumber(stock)} ${unit}`;

                // Produk dengan stok kosong tidak dapat dipilih
                option.disabled = stock <= 0;

                productSelect.appendChild(option);
            });

            productSelect.disabled = false;

            updateStockInfo();

        } catch (error) {
            console.error("Load products error:", error);

            products = [];

            productSelect.innerHTML =
                '<option value="">Gagal memuat produk</option>';

            stockInfo.textContent = error.message;

            showMessage(
                "Gagal mengambil data Inventaris: " + error.message
            );
        }
    }

    // ==========================================
    // 10. INFORMASI STOK PRODUK
    // ==========================================

    function updateStockInfo() {
        const productId = Number(productSelect.value);

        const product = products.find(
            (item) => Number(item.id) === productId
        );

        if (!product) {
            stockInfo.textContent =
                "Pilih produk untuk melihat stok tersedia.";

            quantityInput.removeAttribute("max");
            quantityInput.setCustomValidity("");

            return;
        }

        const stock = Number(product.stock) || 0;
        const unit = escapeHTML(product.unit);

        stockInfo.innerHTML = `
            Stok tersedia:
            <strong>${formatNumber(stock)} ${unit}</strong>
        `;

        quantityInput.max = stock;

        if (stock <= 0) {
            stockInfo.innerHTML += `
                <br><strong style="color:#B84A3A">
                    Stok produk kosong!
                </strong>
            `;

            quantityInput.setCustomValidity(
                "Produk tidak memiliki stok tersedia."
            );

            return;
        }

        if (Number(quantityInput.value) > stock) {
            quantityInput.setCustomValidity(
                `Stok tersedia hanya ${stock} ${product.unit}.`
            );
        } else {
            quantityInput.setCustomValidity("");
        }
    }

    productSelect.addEventListener(
        "change",
        updateStockInfo
    );

    quantityInput.addEventListener(
        "input",
        updateStockInfo
    );

    // ==========================================
    // 11. MEMUAT RIWAYAT BARANG KELUAR
    // ==========================================

    async function loadStockOutHistory() {
        try {
            const result = await apiRequest("/api/stock-out");

            // Mendukung beberapa format respons backend
            const transactions = Array.isArray(result.data)
                ? result.data
                : Array.isArray(result.transactions)
                    ? result.transactions
                    : Array.isArray(result.stockOut)
                        ? result.stockOut
                        : [];

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
            console.error("Load history error:", error);

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
    // 12. SIMPAN TRANSAKSI BARANG KELUAR
    // ==========================================

    form.addEventListener("submit", async (event) => {
        event.preventDefault();

        if (isLoading) return;

        showMessage("");

        const productId = Number(productSelect.value);
        const quantity = Number(quantityInput.value);

        const product = products.find(
            (item) => Number(item.id) === productId
        );

        // Validasi produk
        if (!product) {
            showMessage(
                "Silakan pilih produk terlebih dahulu."
            );

            productSelect.focus();
            return;
        }

        // Validasi stok
        const availableStock = Number(product.stock);

        if (availableStock <= 0) {
            showMessage(
                "Produk ini tidak memiliki stok tersedia."
            );

            return;
        }

        // Validasi jumlah
        if (!Number.isFinite(quantity) || quantity <= 0) {
            showMessage(
                "Jumlah barang harus lebih dari 0."
            );

            quantityInput.focus();
            return;
        }

        if (quantity > availableStock) {
            showMessage(
                `Stok tidak mencukupi. Tersedia ${formatNumber(availableStock)} ${product.unit}.`
            );

            quantityInput.focus();
            return;
        }

        // Validasi tanggal
        if (!dateInput.value) {
            showMessage("Tanggal transaksi wajib diisi.");
            dateInput.focus();
            return;
        }

        const payload = {
            product_id: productId,
            quantity: quantity,
            transaction_date: dateInput.value,
            notes: notesInput.value.trim()
        };

        isLoading = true;

        saveButton.disabled = true;
        saveButton.textContent = "Menyimpan...";

        try {
            const result = await apiRequest(
                "/api/stock-out",
                {
                    method: "POST",
                    body: JSON.stringify(payload)
                }
            );

            const remainingStock =
                result.remaining_stock !== undefined
                    ? result.remaining_stock
                    : availableStock - quantity;

            const unit = result.unit || product.unit;

            showMessage(
                `${result.message || "Barang keluar berhasil disimpan."} Sisa stok: ${formatNumber(remainingStock)} ${unit}.`,
                "success"
            );

            // Reset form
            form.reset();

            dateInput.value = getTodayDate();

            // Perbarui data produk dan riwayat
            await Promise.all([
                loadProducts(),
                loadStockOutHistory()
            ]);

        } catch (error) {
            console.error("Save stock-out error:", error);

            showMessage(error.message);

            // Refresh stok terbaru jika transaksi gagal
            await loadProducts();

        } finally {
            isLoading = false;

            saveButton.disabled = false;
            saveButton.textContent = "Simpan Barang Keluar";
        }
    });

    // ==========================================
    // 13. RESET FORM
    // ==========================================

    form.addEventListener("reset", () => {
        setTimeout(() => {
            dateInput.value = getTodayDate();

            quantityInput.removeAttribute("max");
            quantityInput.setCustomValidity("");

            message.textContent = "";

            updateStockInfo();
        }, 0);
    });

    // ==========================================
    // 14. INISIALISASI HALAMAN
    // ==========================================

    async function initializeStockOut() {
        await Promise.all([
            loadProducts(),
            loadStockOutHistory()
        ]);
    }

    initializeStockOut();

}
