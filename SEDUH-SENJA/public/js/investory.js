
let inventoryProducts = [];

const modal = document.getElementById("productModal");
const productForm = document.getElementById("productForm");

const $ = id => document.getElementById(id);

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[char]);
}

// ==========================================
// 1. MENGAMBIL KATEGORI
// ==========================================

async function loadCategories() {
    const select = $("productCategory");

    select.innerHTML = '<option value="">Tanpa kategori</option>';
    select.required = false;

    try {
        const response = await fetch("/api/categories");
        const result = await response.json();

        if (!response.ok || !result.success) return;

        const categories = result.categories || [];

        categories.forEach(category => {
            const option = document.createElement("option");
            option.value = category.id;
            option.textContent = category.name;
            select.appendChild(option);
        });

    } catch (error) {
        console.warn("Kategori belum dapat dimuat:", error.message);
    }
}

// ==========================================
// 2. MENGAMBIL DATA PRODUK
// ==========================================

async function loadProducts() {
    const table = $("productTable");

    table.innerHTML = `
        <tr>
            <td colspan="7" class="empty-state">
                Memuat data produk...
            </td>
        </tr>
    `;

    try {
        const response = await fetch("/api/products");
        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(result.message || "Gagal mengambil produk.");
        }

        inventoryProducts = result.products || [];

        // Total produk
        $("totalProducts").textContent = inventoryProducts.length;
        $("productCount").textContent =
            inventoryProducts.length + " produk";

        // Total stok
        const totalStock = inventoryProducts.reduce(
            (total, product) => total + Number(product.stock || 0),
            0
        );

        $("totalStock").textContent = totalStock.toLocaleString("id-ID");

        // Stok menipis
        const lowStock = inventoryProducts.filter(product =>
            Number(product.stock) <= Number(product.minimum_stock)
        );

        $("lowStockProducts").textContent = lowStock.length;

        renderProducts();

        $("connectionStatus").textContent =
            "Terhubung dengan database SEDUH SENJA.";

    } catch (error) {
        console.error("Load products:", error);

        inventoryProducts = [];

        table.innerHTML = `
            <tr>
                <td colspan="7" class="empty-state">
                    Gagal memuat data produk.
                    <br>${escapeHTML(error.message)}
                </td>
            </tr>
        `;

        $("connectionStatus").textContent =
            "Gagal terhubung ke database.";
    }
}

// ==========================================
// 3. MENAMPILKAN PRODUK
// ==========================================

function renderProducts() {
    const search = $("searchProduct").value
        .trim()
        .toLowerCase();

    const filter = $("filterStatus").value;

    const filtered = inventoryProducts.filter(product => {
        const name = String(product.name || "").toLowerCase();
        const code = String(product.code || "").toLowerCase();

        const matchesSearch =
            name.includes(search) || code.includes(search);

        const stock = Number(product.stock || 0);
        const minimum = Number(product.minimum_stock || 0);

        let status = "safe";

        if (stock <= 0) {
            status = "empty";
        } else if (stock <= minimum) {
            status = "low";
        }

        const matchesFilter =
            filter === "all" || filter === status;

        return matchesSearch && matchesFilter;
    });

    const table = $("productTable");

    $("productCount").textContent =
        filtered.length + " produk";

    if (filtered.length === 0) {
        table.innerHTML = `
            <tr>
                <td colspan="7" class="empty-state">
                    Tidak ada produk yang ditemukan.
                </td>
            </tr>
        `;
        return;
    }

    table.innerHTML = filtered.map(product => {
        const stock = Number(product.stock || 0);
        const minimum = Number(product.minimum_stock || 0);

        let statusText = "Stok Aman";
        let statusClass = "status-safe";

        if (stock <= 0) {
            statusText = "Stok Habis";
            statusClass = "status-empty";
        } else if (stock <= minimum) {
            statusText = "Stok Menipis";
            statusClass = "status-low";
        }

        return `
            <tr>
                <td class="product-code">
                    ${escapeHTML(product.code)}
                </td>

                <td class="product-name">
                    ${escapeHTML(product.name)}
                </td>

                <td>
                    ${escapeHTML(product.category || "-")}
                </td>

                <td>
                    ${stock.toLocaleString("id-ID")}
                    ${escapeHTML(product.unit)}
                </td>

                <td>
                    ${minimum.toLocaleString("id-ID")}
                    ${escapeHTML(product.unit)}
                </td>

                <td>
                    <span class="status-badge ${statusClass}">
                        ${statusText}
                    </span>
                </td>

                <td>
                    <div class="action-group">
                        <button
                            type="button"
                            class="action-btn edit-btn"
                            onclick="editProduct(${Number(product.id)})">
                            Edit
                        </button>

                        <button
                            type="button"
                            class="action-btn archive-btn"
                            onclick="archiveProduct(${Number(product.id)})">
                            Arsip
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join("");
}

// ==========================================
// 4. MEMBUKA FORM TAMBAH PRODUK
// ==========================================

function openProductForm() {
    productForm.reset();

    $("productId").value = "";

    $("modalTitle").textContent = "Tambah Produk Baru";
    $("saveProductBtn").textContent = "Simpan Produk";

    $("productStock").disabled = false;
    $("productStock").value = 0;

    $("productMinimum").value = 5;

    $("formMessage").textContent = "";

    $("formMessage").style.color = "";

    modal.classList.add("show");
}

// ==========================================
// 5. MENUTUP FORM
// ==========================================

function closeProductForm() {
    modal.classList.remove("show");
}

// ==========================================
// 6. EDIT PRODUK
// ==========================================

function editProduct(id) {
    const product = inventoryProducts.find(
        p => Number(p.id) === Number(id)
    );

    if (!product) {
        alert("Produk tidak ditemukan.");
        return;
    }

    $("productId").value = product.id;

    $("productCode").value = product.code || "";
    $("productName").value = product.name || "";

    $("productCategory").value =
        product.category_id || "";

    $("productUnit").value = product.unit || "";

    $("productStock").value = product.stock || 0;
    $("productMinimum").value = product.minimum_stock || 0;

    $("modalTitle").textContent = "Edit Produk";
    $("saveProductBtn").textContent = "Simpan Perubahan";

    // Stok tidak diedit melalui form ini.
    $("productStock").disabled = true;

    $("formMessage").textContent = "";

    modal.classList.add("show");
}

// ==========================================
// 7. MENYIMPAN PRODUK
// ==========================================

productForm.addEventListener("submit", async function(event) {
    event.preventDefault();

    const id = $("productId").value;

    const payload = {
        code: $("productCode").value.trim(),
        name: $("productName").value.trim(),
        category_id: $("productCategory").value || null,
        unit: $("productUnit").value,
        initial_stock: $("productStock").value,
        minimum_stock: $("productMinimum").value,
        purchase_price: 0,
        description: ""
    };

    const button = $("saveProductBtn");
    const message = $("formMessage");

    button.disabled = true;
    button.textContent = "Menyimpan...";

    message.textContent = "";

    try {
        const response = await fetch(
            id ? `/api/products/${id}` : "/api/products",
            {
                method: id ? "PUT" : "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify(payload)
            }
        );

        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(
                result.message || "Gagal menyimpan produk."
            );
        }

        message.style.color = "#287A48";
        message.textContent = result.message;

        alert(result.message);

        closeProductForm();

        await loadProducts();

    } catch (error) {
        console.error("Save product:", error);

        message.style.color = "#B84A3A";
        message.textContent = error.message;

    } finally {
        button.disabled = false;

        button.textContent = id
            ? "Simpan Perubahan"
            : "Simpan Produk";
    }
});

// ==========================================
// 8. MENGARSIPKAN PRODUK
// ==========================================

async function archiveProduct(id) {
    const product = inventoryProducts.find(
        p => Number(p.id) === Number(id)
    );

    if (!product) return;

    const confirmed = confirm(
        `Apakah kamu yakin ingin mengarsipkan ${product.name}?`
    );

    if (!confirmed) return;

    try {
        const response = await fetch(
            `/api/products/${id}/archive`,
            {
                method: "PATCH"
            }
        );

        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(
                result.message || "Gagal mengarsipkan produk."
            );
        }

        alert(result.message);

        await loadProducts();

    } catch (error) {
        alert(error.message);
    }
}

// ==========================================
// 9. EVENT TOMBOL
// ==========================================

// Tombol tambah
$("addProductBtn").addEventListener(
    "click",
    openProductForm
);

// Tombol tutup
$("closeModal").addEventListener(
    "click",
    closeProductForm
);

// Tombol batal
$("cancelModal").addEventListener(
    "click",
    closeProductForm
);

// Klik area luar modal
modal.addEventListener("click", event => {
    if (event.target === modal) {
        closeProductForm();
    }
});

// Tombol Escape
document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
        closeProductForm();
    }
});

// Pencarian
$("searchProduct").addEventListener(
    "input",
    renderProducts
);

// Filter status
$("filterStatus").addEventListener(
    "change",
    renderProducts
);

// ==========================================
// 10. INISIALISASI
// ==========================================

async function initializeInventory() {
    await loadCategories();
    await loadProducts();
}

initializeInventory();
