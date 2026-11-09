
document.addEventListener("DOMContentLoaded", () => {

    // ==========================================
    // 1. ELEMENT HTML
    // ==========================================

    const form = document.getElementById("stockOutForm");
    const productSelect = document.getElementById("productId");
    const quantityInput = document.getElementById("quantity");
    const dateInput = document.getElementById("transactionDate");
    const notesInput = document.getElementById("notes");

    const stockInfo = document.getElementById("stockInfo");
    const message = document.getElementById("stockOutMessage");
    const saveButton = document.getElementById("saveStockOut");
    const tableBody = document.getElementById("stockOutTable");

    // Pastikan seluruh elemen tersedia
    const requiredElements = {
        form,
        productSelect,
        quantityInput,
        dateInput,
        notesInput,
        stockInfo,
        message,
        saveButton,
        tableBody
    };

    for (const [name, element] of Object.entries(requiredElements)) {
        if (!element) {
            console.error(`Elemen HTML tidak ditemukan: ${name}`);
            return;
        }
    }

    // ==========================================
    // 2. STATE
    // ==========================================

    let products = [];
    let isSaving = false;

    // ==========================================
    // 3. API HELPER
    // ==========================================

    async function apiRequest(url, options = {}) {

        const response = await fetch(url, {
            ...options,
            cache: "no-store",
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
            throw new Error("Respons server tidak valid.");
        }

        if (!response.ok || !result.success) {
            throw new Error(
                result.message || "Terjadi kesalahan pada server."
            );
        }

        return result;
    }

    // ==========================================
    // 4. HELPER FORMAT
    // ==========================================

    function formatNumber(value) {
        return new Intl.NumberFormat("id-ID", {
            maximumFractionDigits: 2
        }).format(Number(value) || 0);
    }

    function formatDate(value) {

        if (!value) return "-";

        const date = new Date(
            String(value).replace(" ", "T")
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

    function getLocalDate() {

        const now = new Date();

        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, "0");
        const day = String(now.getDate()).padStart(2, "0");

        return `${year}-${month}-${day}`;
    }

    function setMessage(text, success = false) {

        message.textContent = text;

        message.style.color = success
            ? "#27834B"
            : "#C0392B";
    }

    function clearMessage() {
        message.textContent = "";
    }

    function createCell(value, className = "") {

        const td = document.createElement("td");

        td.textContent = value ?? "";

        if (className) {
            td.className = className;
        }

        return td;
    }

    function showEmptyHistory(text) {

        tableBody.innerHTML = "";

        const tr = document.createElement("tr");
        const td = document.createElement("td");

        td.colSpan = 6;
        td.className = "out-empty";
        td.textContent = text;

        tr.appendChild(td);
        tableBody.appendChild(tr);
    }

    // ==========================================
    // 5. MEMUAT DATA PRODUK
    // ==========================================

    async function loadProducts() {

        productSelect.innerHTML =
            '<option value="">Memuat produk...</option>';

        productSelect.disabled = true;

        try {

            const result = await apiRequest("/api/products");

            // Backend menggunakan result.products
            products = Array.isArray(result.products)
                ? result.products
                : Array.isArray(result.data)
                    ? result.data
                    : [];

            // Filter produk yang tidak diarsipkan
            products = products.filter(product => {

                return Number(product.is_archived ?? 0) === 0;
            });

            // Urutkan berdasarkan nama
            products.sort((a, b) =>
                String(a.name).localeCompare(String(b.name), "id")
            );

            productSelect.innerHTML =
                '<option value="">Pilih produk</option>';

            products.forEach(product => {

                const option = document.createElement("option");

                option.value = product.id;

                option.textContent =
                    `${product.code} - ${product.name}`;

                productSelect.appendChild(option);
            });

            if (products.length === 0) {

                productSelect.innerHTML =
                    '<option value="">Belum ada produk tersedia</option>';
            }

            console.log(
                "[STOCK OUT] Produk berhasil dimuat:",
                products
            );

        } catch (error) {

            console.error("[STOCK OUT] Load products:", error);

            products = [];

            productSelect.innerHTML =
                '<option value="">Gagal memuat produk</option>';

            setMessage(error.message);

        } finally {

            productSelect.disabled = false;

            updateStockInfo();
        }
    }

    // ==========================================
    // 6. INFORMASI STOK TERSEDIA
    // ==========================================

    function getSelectedProduct() {

        const productId = Number(productSelect.value);

        return products.find(product =>
            Number(product.id) === productId
        );
    }

    function updateStockInfo() {

        const product = getSelectedProduct();

        if (!product) {

            stockInfo.textContent =
                "Pilih produk untuk melihat stok tersedia.";

            quantityInput.removeAttribute("max");

            quantityInput.disabled = true;

            return;
        }

        const stock = Number(product.stock) || 0;
        const unit = product.unit || "";

        stockInfo.innerHTML = "";

        const label = document.createElement("span");

        label.textContent = "Stok tersedia: ";

        const strong = document.createElement("strong");

        strong.textContent =
            `${formatNumber(stock)} ${unit}`;

        stockInfo.append(label, strong);

        quantityInput.max = stock;

        quantityInput.disabled = stock <= 0;

        if (stock <= 0) {

            stockInfo.append(
                document.createTextNode(" - Stok habis!")
            );
        }
    }

    productSelect.addEventListener("change", () => {

        updateStockInfo();

        clearMessage();

        quantityInput.value = "";
    });

    // ==========================================
    // 7. MEMUAT RIWAYAT TRANSAKSI
    // ==========================================

    async function loadHistory() {

        showEmptyHistory("Memuat riwayat transaksi...");

        try {

            const result = await apiRequest("/api/stock-out");

            const transactions = Array.isArray(result.data)
                ? result.data
                : [];

            tableBody.innerHTML = "";

            if (transactions.length === 0) {

                showEmptyHistory(
                    "Belum ada transaksi barang keluar."
                );

                return;
            }

            transactions.forEach(item => {

                const tr = document.createElement("tr");

                // Kode transaksi
                tr.appendChild(
                    createCell(
                        item.transaction_code,
                        "out-code"
                    )
                );

                // Tanggal
                tr.appendChild(
                    createCell(
                        formatDate(item.transaction_date)
                    )
                );

                // Kode produk
                tr.appendChild(
                    createCell(item.product_code)
                );

                // Nama produk
                tr.appendChild(
                    createCell(item.product_name)
                );

                // Jumlah keluar
                tr.appendChild(
                    createCell(
                        `${formatNumber(item.quantity)} ${item.unit}`
                    )
                );

                // Keterangan
                tr.appendChild(
                    createCell(item.notes || "-")
                );

                tableBody.appendChild(tr);
            });

            console.log(
                "[STOCK OUT] Riwayat berhasil dimuat:",
                transactions.length
            );

        } catch (error) {

            console.error("[STOCK OUT] Load history:", error);

            showEmptyHistory(
                "Gagal memuat riwayat transaksi."
            );
        }
    }

    // ==========================================
    // 8. VALIDASI TRANSAKSI
    // ==========================================

    function validateTransaction() {

        const product = getSelectedProduct();

        const quantity = Number(quantityInput.value);

        const transactionDate = dateInput.value;

        const notes = notesInput.value.trim();

        if (!product) {

            throw new Error(
                "Silakan pilih produk terlebih dahulu."
            );
        }

        if (!Number.isFinite(quantity) || quantity <= 0) {

            throw new Error(
                "Jumlah barang harus lebih dari 0."
            );
        }

        if (quantity > Number(product.stock)) {

            throw new Error(
                `Stok tidak mencukupi. Stok tersedia: ${formatNumber(product.stock)} ${product.unit}.`
            );
        }

        if (!transactionDate) {

            throw new Error(
                "Silakan pilih tanggal transaksi."
            );
        }

        if (notes.length > 500) {

            throw new Error(
                "Keterangan maksimal 500 karakter."
            );
        }

        return {
            product,
            product_id: Number(product.id),
            quantity,
            transaction_date: transactionDate,
            notes
        };
    }

    // ==========================================
    // 9. SIMPAN BARANG KELUAR
    // ==========================================

    form.addEventListener("submit", async event => {

        event.preventDefault();

        if (isSaving) return;

        clearMessage();

        let transaction;

        try {

            transaction = validateTransaction();

        } catch (error) {

            setMessage(error.message);

            return;
        }

        isSaving = true;

        saveButton.disabled = true;

        saveButton.textContent = "Menyimpan...";

        try {

            const result = await apiRequest(
                "/api/stock-out",
                {
                    method: "POST",

                    body: JSON.stringify({
                        product_id: transaction.product_id,
                        quantity: transaction.quantity,
                        transaction_date: transaction.transaction_date,
                        notes: transaction.notes
                    })
                }
            );

            console.log(
                "[STOCK OUT] Transaksi berhasil:",
                result
            );

            // Reset form terlebih dahulu
            form.reset();

            dateInput.value = getLocalDate();

            // Perbarui produk dan riwayat dari database
            const refreshResults = await Promise.allSettled([
                loadProducts(),
                loadHistory()
            ]);

            const refreshFailed = refreshResults.some(
                item => item.status === "rejected"
            );

            const remainingStock =
                result.product?.remaining_stock;

            const remainingUnit =
                result.product?.unit || transaction.product.unit;

            let successMessage =
                `${result.message} Kode: ${result.transaction_code}.`;

            if (remainingStock !== undefined) {

                successMessage +=
                    ` Stok tersisa: ${formatNumber(remainingStock)} ${remainingUnit}.`;
            }

            if (refreshFailed) {

                successMessage +=
                    " Namun sebagian tampilan gagal diperbarui. Silakan refresh halaman.";
            }

            setMessage(successMessage, true);

            updateStockInfo();

        } catch (error) {

            console.error(
                "[STOCK OUT] Save transaction:",
                error
            );

            setMessage(error.message);

            // Ambil data stok terbaru
            await loadProducts();

            updateStockInfo();

        } finally {

            isSaving = false;

            saveButton.disabled = false;

            saveButton.textContent =
                "Simpan Barang Keluar";
        }
    });

    // ==========================================
    // 10. RESET FORM
    // ==========================================

    form.addEventListener("reset", () => {

        setTimeout(() => {

            dateInput.value = getLocalDate();

            updateStockInfo();

            clearMessage();

        }, 0);
    });

    // ==========================================
    // 11. INISIALISASI
    // ==========================================

    dateInput.value = getLocalDate();

    quantityInput.disabled = true;

    console.log(
        "SEDUH SENJA - Stock Out System Initialized"
    );

    loadProducts();

    loadHistory();

});
