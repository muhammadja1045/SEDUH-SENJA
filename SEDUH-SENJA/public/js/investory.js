
let inventoryProducts = [];

const modal = document.getElementById("productModal");
const productForm = document.getElementById("productForm");

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[char]);
}

// Mengambil data produk dari database
async function loadProducts() {
    const table = document.getElementById("inventoryTable");

    try {
        const response = await fetch("/api/products");
        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(result.message || "Gagal mengambil produk");
        }

        inventoryProducts = result.products;

        document.getElementById("inventoryCount").textContent =
            inventoryProducts.length;

        document.getElementById("inventoryLowStock").textContent =
            inventoryProducts.filter(
                p => Number(p.stock) <= Number(p.minimum_stock)
            ).length;

        renderProducts();

        document.getElementById("inventoryMessage").textContent =
            "Terhubung dengan database SEDUH SENJA.";

    } catch (error) {
        console.error(error);

        table.innerHTML = `
            <tr>
                <td colspan="7" class="empty-state">
                    Gagal memuat data. Periksa server dan database.
                </td>
            </tr>
        `;

        document.getElementById("inventoryMessage").textContent =
            error.message;
    }
}

// Menampilkan produk
function renderProducts() {
    const search = document
        .getElementById("searchProduct")
        .value.toLowerCase();

    const filter = document.getElementById("filterStock").value;

    const filtered = inventoryProducts.filter(product => {
        const matchesSearch =
            product.name.toLowerCase().includes(search) ||
            product.code.toLowerCase().includes(search);

        const isLow =
            Number(product.stock) <= Number(product.minimum_stock);

        const matchesFilter =
            filter === "all" ||
            (filter === "low" && isLow) ||
            (filter === "available" && !isLow);

        return matchesSearch && matchesFilter;
    });

    const table = document.getElementById("inventoryTable");

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
        const isLow =
            Number(product.stock) <= Number(product.minimum_stock);

        return `
            <tr>
                <td>${escapeHTML(product.code)}</td>
                <td>${escapeHTML(product.name)}</td>
                <td>${escapeHTML(product.category || "-")}</td>
                <td>
                    ${Number(product.stock)}
                    ${escapeHTML(product.unit)}
                </td>
                <td>
                    ${Number(product.minimum_stock)}
                    ${escapeHTML(product.unit)}
                </td>
                <td>
                    <span class="${isLow ? "low-badge" : "available-badge"}">
                        ${isLow ? "Stok menipis" : "Tersedia"}
                    </span>
                </td>
                <td>
                    <div class="action-buttons">
                        <button
                            class="action-button edit-button"
                            onclick="editProduct(${product.id})">
                            Edit
                        </button>

                        <button
                            class="action-button archive-button"
                            onclick="archiveProduct(${product.id})">
                            Arsip
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join("");
}

// Membuka form tambah
function openProductForm() {
    productForm.reset();

    document.getElementById("productId").value = "";
    document.getElementById("formTitle").textContent = "Tambah Produk";
    document.getElementById("saveButton").textContent = "Simpan Produk";
    document.getElementById("initialStockGroup").style.display = "flex";
    document.getElementById("initialStock").disabled = false;
    document.getElementById("formMessage").textContent = "";

    modal.classList.add("show");
}

// Menutup form
function closeProductForm() {
    modal.classList.remove("show");
}

// Mengedit produk
function editProduct(id) {
    const product = inventoryProducts.find(p => p.id === id);

    if (!product) return;

    document.getElementById("productId").value = product.id;
    document.getElementById("code").value = product.code;
    document.getElementById("name").value = product.name;
    document.getElementById("categoryId").value =
        product.category_id || "";
    document.getElementById("unit").value = product.unit;
    document.getElementById("initialStock").value = product.initial_stock;
    document.getElementById("minimumStock").value = product.minimum_stock;
    document.getElementById("purchasePrice").value = product.purchase_price;
    document.getElementById("description").value =
        product.description || "";

    document.getElementById("formTitle").textContent = "Edit Produk";
    document.getElementById("saveButton").textContent = "Simpan Perubahan";
    document.getElementById("initialStockGroup").style.display = "none";
    document.getElementById("formMessage").textContent = "";

    modal.classList.add("show");
}

// Menyimpan produk baru atau perubahan
productForm.addEventListener("submit", async event => {
    event.preventDefault();

    const id = document.getElementById("productId").value;

    const payload = {
        code: document.getElementById("code").value.trim(),
        name: document.getElementById("name").value.trim(),
        category_id: document.getElementById("categoryId").value || null,
        unit: document.getElementById("unit").value,
        initial_stock: document.getElementById("initialStock").value,
        minimum_stock: document.getElementById("minimumStock").value,
        purchase_price: document.getElementById("purchasePrice").value,
        description: document.getElementById("description").value
    };

    const message = document.getElementById("formMessage");
    const button = document.getElementById("saveButton");

    button.disabled = true;
    button.textContent = "Menyimpan...";

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
            throw new Error(result.message || "Gagal menyimpan produk");
        }

        closeProductForm();
        await loadProducts();

    } catch (error) {
        message.textContent = error.message;
    } finally {
        button.disabled = false;
        button.textContent = id ? "Simpan Perubahan" : "Simpan Produk";
    }
});

// Mengarsipkan produk
async function archiveProduct(id) {
    const product = inventoryProducts.find(p => p.id === id);

    if (!product) return;

    const confirmed = confirm(
        `Arsipkan produk "${product.name}"? Produk tidak akan tampil di inventaris aktif, tetapi riwayat transaksinya tetap disimpan.`
    );

    if (!confirmed) return;

    try {
        const response = await fetch(`/api/products/${id}/archive`, {
            method: "PATCH"
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(result.message || "Gagal mengarsipkan produk");
        }

        await loadProducts();

    } catch (error) {
        alert(error.message);
    }
}

// Pencarian dan filter
document.getElementById("searchProduct")
    .addEventListener("input", renderProducts);

document.getElementById("filterStock")
    .addEventListener("change", renderProducts);

// Memuat produk ketika halaman dibuka
loadProducts();
