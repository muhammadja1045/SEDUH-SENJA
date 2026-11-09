
/* ==================================================
   SEDUH SENJA - COFFEE INVENTORY SYSTEM
   INVENTORY JAVASCRIPT
   Version 5.2 - FINAL STABLE
================================================== */

"use strict";

// ==========================================
// 1. STATE
// ==========================================

let inventoryProducts = [];
let inventoryCategories = [];

let isSavingProduct = false;
let isSavingCategory = false;

const busyProductActions = new Set();
const busyCategoryActions = new Set();

// ==========================================
// 2. ELEMENT HELPER
// ==========================================

const $ = id => document.getElementById(id);

const modal = $("productModal");
const categoryModal = $("categoryModal");

const productForm = $("productForm");
const categoryForm = $("categoryForm");

const productTable = $("productTable");
const categoryTable = $("categoryTable");

function setText(id, value) {
    const element = $(id);
    if (element) element.textContent = value;
}

function setHTML(id, value) {
    const element = $(id);
    if (element) element.innerHTML = value;
}

function setValue(id, value) {
    const element = $(id);
    if (element) element.value = value;
}

function setDisabled(id, disabled) {
    const element = $(id);
    if (element) element.disabled = disabled;
}

function bind(id, event, callback) {
    const element = $(id);

    if (element) {
        element.addEventListener(event, callback);
    } else {
        console.warn(`Elemen #${id} tidak ditemukan.`);
    }
}

// ==========================================
// 3. HELPER
// ==========================================

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[char]);
}

function formatNumber(value) {
    const number = Number(value ?? 0);

    return Number.isFinite(number)
        ? number.toLocaleString("id-ID", {
            maximumFractionDigits: 2
        })
        : "0";
}

function formatCurrency(value) {
    return "Rp " + formatNumber(value);
}

function readNumber(id, optional = false) {
    const element = $(id);

    if (!element) {
        return optional ? 0 : NaN;
    }

    const value = String(element.value ?? "").trim();

    if (value === "") {
        return optional ? 0 : NaN;
    }

    const number = Number(value);

    return Number.isFinite(number) ? number : NaN;
}

async function fetchJSON(url, options = {}) {
    let response;

    try {
        response = await fetch(url, options);
    } catch (error) {
        throw new Error(
            "Tidak dapat terhubung ke server. Pastikan server SEDUH SENJA sedang berjalan."
        );
    }

    let result;

    try {
        const responseText = await response.text();

        result = responseText.trim()
            ? JSON.parse(responseText)
            : {};

    } catch (error) {
        throw new Error(
            `Respons server tidak valid (${response.status}).`
        );
    }

    if (!response.ok || result.success === false) {
        throw new Error(
            result.message ||
            `Terjadi kesalahan pada server (${response.status}).`
        );
    }

    return result;
}

function setMessage(id, message, type = "") {
    const element = $(id);

    if (!element) return;

    element.textContent = message;
    element.className = type;
}

function clearMessage(id) {
    const element = $(id);

    if (!element) return;

    element.textContent = "";
    element.className = "";
}

function setConnectionStatus(message, isError = false) {
    const element = $("connectionStatus");

    if (!element) return;

    element.textContent = message;

    element.style.color = isError
        ? "#E59A8F"
        : "#B9AAA0";
}

function validId(id) {
    const number = Number(id);

    return Number.isInteger(number) && number > 0
        ? number
        : null;
}

function getProductById(id) {
    return inventoryProducts.find(
        product => Number(product.id) === Number(id)
    );
}

function getCategoryById(id) {
    return inventoryCategories.find(
        category => Number(category.id) === Number(id)
    );
}

function getProductStatus(product) {
    const stock = Number(product.stock ?? 0);
    const minimum = Number(product.minimum_stock ?? 0);

    if (stock <= 0) return "empty";
    if (stock <= minimum) return "low";

    return "safe";
}

// ==========================================
// 4. LOAD KATEGORI
// ==========================================

async function loadCategories() {
    try {
        const result = await fetchJSON("/api/categories");

        inventoryCategories = Array.isArray(result.categories)
            ? result.categories
            : [];

        renderCategories();
        updateCategoryDropdowns();

        return true;

    } catch (error) {
        console.error("Load categories:", error);

        setMessage(
            "categoryMessage",
            "Gagal memuat kategori: " + error.message,
            "category-message error"
        );

        return false;
    }
}

// ==========================================
// 5. RENDER KATEGORI
// ==========================================

function renderCategories() {
    setText(
        "totalCategories",
        formatNumber(inventoryCategories.length)
    );

    if (!categoryTable) return;

    if (inventoryCategories.length === 0) {
        categoryTable.innerHTML = `
            <tr>
                <td colspan="4" class="empty-state">
                    Belum ada kategori.
                    Silakan tambahkan kategori baru.
                </td>
            </tr>
        `;

        return;
    }

    categoryTable.innerHTML = inventoryCategories.map(
        (category, index) => {
            const id = Number(category.id);
            const busy = busyCategoryActions.has(id);

            return `
                <tr>
                    <td>${index + 1}</td>

                    <td class="category-name">
                        ${escapeHTML(category.name)}
                    </td>

                    <td>
                        <span class="category-count">
                            ${formatNumber(category.product_count)} produk
                        </span>
                    </td>

                    <td>
                        <div class="category-actions">

                            <button
                                type="button"
                                class="category-action-btn edit"
                                data-category-action="edit"
                                data-id="${id}"
                                ${busy ? "disabled" : ""}
                            >
                                <i class="fas fa-edit"></i>
                                Edit
                            </button>

                            <button
                                type="button"
                                class="category-action-btn delete"
                                data-category-action="delete"
                                data-id="${id}"
                                ${busy ? "disabled" : ""}
                            >
                                <i class="fas fa-trash"></i>
                                Hapus
                            </button>

                        </div>
                    </td>
                </tr>
            `;
        }
    ).join("");
}

// ==========================================
// 6. DROPDOWN KATEGORI
// ==========================================

function updateCategoryDropdowns() {
    const productSelect = $("productCategory");
    const filterSelect = $("filterCategory");

    if (productSelect) {
        const selectedValue = productSelect.value;

        productSelect.innerHTML = `
            <option value="">Tanpa Kategori</option>
        `;

        inventoryCategories.forEach(category => {
            const option = document.createElement("option");

            option.value = category.id;
            option.textContent = category.name;

            productSelect.appendChild(option);
        });

        productSelect.value = inventoryCategories.some(
            category => String(category.id) === selectedValue
        ) ? selectedValue : "";
    }

    if (filterSelect) {
        const selectedValue = filterSelect.value || "all";

        filterSelect.innerHTML = `
            <option value="all">Semua Kategori</option>
        `;

        inventoryCategories.forEach(category => {
            const option = document.createElement("option");

            option.value = category.id;
            option.textContent = category.name;

            filterSelect.appendChild(option);
        });

        filterSelect.value =
            selectedValue === "all" ||
            inventoryCategories.some(
                category => String(category.id) === selectedValue
            )
                ? selectedValue
                : "all";
    }
}

// ==========================================
// 7. LOAD PRODUK
// ==========================================

async function loadProducts() {
    if (productTable) {
        productTable.innerHTML = `
            <tr>
                <td colspan="7" class="empty-state">
                    Memuat data produk...
                </td>
            </tr>
        `;
    }

    try {
        const result = await fetchJSON("/api/products");

        inventoryProducts = Array.isArray(result.products)
            ? result.products
            : [];

        updateInventoryStatistics();
        renderProducts();

        setConnectionStatus(
            "Terhubung dengan database SEDUH SENJA."
        );

        return true;

    } catch (error) {
        console.error("Load products:", error);

        inventoryProducts = [];

        updateInventoryStatistics();

        if (productTable) {
            productTable.innerHTML = `
                <tr>
                    <td colspan="7" class="empty-state">
                        Gagal memuat data produk.
                        <br>
                        ${escapeHTML(error.message)}
                    </td>
                </tr>
            `;
        }

        setConnectionStatus(
            "Gagal terhubung ke database.",
            true
        );

        return false;
    }
}

// ==========================================
// 8. STATISTIK INVENTARIS
// ==========================================

function updateInventoryStatistics() {
    const totalProducts = inventoryProducts.length;

    const totalStock = inventoryProducts.reduce(
        (total, product) =>
            total + Number(product.stock ?? 0),
        0
    );

    const lowStock = inventoryProducts.filter(product => {
        const status = getProductStatus(product);

        return status === "low" || status === "empty";
    }).length;

    setText("totalProducts", formatNumber(totalProducts));
    setText("totalStock", formatNumber(totalStock));
    setText("lowStockProducts", formatNumber(lowStock));
}

// ==========================================
// 9. RENDER PRODUK
// ==========================================

function renderProducts() {
    if (!productTable) return;

    const search = $("searchProduct")
        ? $("searchProduct").value.trim().toLowerCase()
        : "";

    const filterStatus = $("filterStatus")
        ? $("filterStatus").value
        : "all";

    const filterCategory = $("filterCategory")
        ? $("filterCategory").value
        : "all";

    const filtered = inventoryProducts.filter(product => {
        const name = String(product.name ?? "").toLowerCase();
        const code = String(product.code ?? "").toLowerCase();
        const category = String(product.category ?? "").toLowerCase();

        const matchesSearch =
            name.includes(search) ||
            code.includes(search) ||
            category.includes(search);

        const matchesCategory =
            filterCategory === "all" ||
            String(product.category_id ?? "") === filterCategory;

        const status = getProductStatus(product);

        const matchesStatus =
            filterStatus === "all" ||
            filterStatus === status;

        return matchesSearch &&
            matchesCategory &&
            matchesStatus;
    });

    setText(
        "productCount",
        `${formatNumber(filtered.length)} produk`
    );

    if (filtered.length === 0) {
        productTable.innerHTML = `
            <tr>
                <td colspan="7" class="empty-state">
                    Tidak ada produk yang ditemukan.
                </td>
            </tr>
        `;

        return;
    }

    const statusMap = {
        safe: {
            text: "Stok Aman",
            class: "status-safe"
        },
        low: {
            text: "Stok Menipis",
            class: "status-low"
        },
        empty: {
            text: "Stok Habis",
            class: "status-empty"
        }
    };

    productTable.innerHTML = filtered.map(product => {
        const id = Number(product.id);

        const stock = Number(product.stock ?? 0);
        const minimum = Number(product.minimum_stock ?? 0);

        const statusInfo = statusMap[getProductStatus(product)];

        const busy = busyProductActions.has(id);

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
                    ${formatNumber(stock)}
                    ${escapeHTML(product.unit || "")}
                </td>

                <td>
                    ${formatNumber(minimum)}
                    ${escapeHTML(product.unit || "")}
                </td>

                <td>
                    <span class="status-badge ${statusInfo.class}">
                        ${statusInfo.text}
                    </span>
                </td>

                <td>
                    <div class="action-group">

                        <button
                            type="button"
                            class="action-btn edit-btn"
                            data-action="edit"
                            data-id="${id}"
                            ${busy ? "disabled" : ""}
                        >
                            <i class="fas fa-edit"></i>
                            Edit
                        </button>

                        <button
                            type="button"
                            class="action-btn archive-btn"
                            data-action="archive"
                            data-id="${id}"
                            ${busy ? "disabled" : ""}
                        >
                            <i class="fas fa-box-archive"></i>
                            Arsip
                        </button>

                    </div>
                </td>

            </tr>
        `;
    }).join("");
}

// ==========================================
// 10. MODAL PRODUK
// ==========================================

function openProductForm() {
    if (!productForm || !modal || isSavingProduct) return;

    productForm.reset();

    setValue("productId", "");
    setValue("productStock", "0");
    setValue("productMinimum", "5");
    setValue("productPrice", "0");
    setValue("productDescription", "");

    setText("modalTitle", "Tambah Produk Baru");

    setDisabled("productStock", false);
    setDisabled("saveProductBtn", false);

    setHTML(
        "saveProductBtn",
        '<i class="fas fa-save"></i> Simpan Produk'
    );

    clearMessage("formMessage");

    updateCategoryDropdowns();

    modal.classList.add("show");
    modal.setAttribute("aria-hidden", "false");

    $("productCode")?.focus();
}

function closeProductForm() {
    if (isSavingProduct || !modal) return;

    modal.classList.remove("show");
    modal.setAttribute("aria-hidden", "true");
}

// ==========================================
// 11. EDIT PRODUK
// ==========================================

async function editProduct(id) {
    const product = getProductById(id);

    if (!product) {
        alert("Produk tidak ditemukan.");
        return;
    }

    if (!productForm || !modal || isSavingProduct) return;

    const categoryLoaded = await loadCategories();

    if (!categoryLoaded) {
        alert("Kategori gagal dimuat. Silakan periksa koneksi server.");
        return;
    }

    productForm.reset();

    setValue("productId", product.id);
    setValue("productCode", product.code || "");
    setValue("productName", product.name || "");

    updateCategoryDropdowns();

    setValue(
        "productCategory",
        product.category_id != null
            ? String(product.category_id)
            : ""
    );

    setValue("productUnit", product.unit || "");
    setValue("productStock", Number(product.stock ?? 0));

    // Stok hanya bisa berubah melalui transaksi.
    setDisabled("productStock", true);

    setValue(
        "productMinimum",
        Number(product.minimum_stock ?? 0)
    );

    setValue(
        "productPrice",
        Number(product.purchase_price ?? 0)
    );

    setValue(
        "productDescription",
        product.description || ""
    );

    setText("modalTitle", "Edit Produk");

    setHTML(
        "saveProductBtn",
        '<i class="fas fa-save"></i> Simpan Perubahan'
    );

    setDisabled("saveProductBtn", false);

    clearMessage("formMessage");

    modal.classList.add("show");
    modal.setAttribute("aria-hidden", "false");

    $("productName")?.focus();
}

// ==========================================
// 12. VALIDASI PRODUK
// ==========================================

function validateProductPayload(payload, isEdit) {
    if (!payload.code) {
        return "Kode produk wajib diisi.";
    }

    if (payload.code.length > 50) {
        return "Kode produk maksimal 50 karakter.";
    }

    if (!payload.name) {
        return "Nama produk wajib diisi.";
    }

    if (payload.name.length > 150) {
        return "Nama produk maksimal 150 karakter.";
    }

    if (!payload.unit) {
        return "Satuan produk wajib dipilih.";
    }

    if (
        !Number.isFinite(payload.minimum_stock) ||
        payload.minimum_stock < 0
    ) {
        return "Stok minimum harus berupa angka nol atau lebih.";
    }

    if (
        !Number.isFinite(payload.purchase_price) ||
        payload.purchase_price < 0
    ) {
        return "Harga pembelian harus berupa angka nol atau lebih.";
    }

    if (
        !isEdit &&
        (
            !Number.isFinite(payload.initial_stock) ||
            payload.initial_stock < 0
        )
    ) {
        return "Stok awal harus berupa angka nol atau lebih.";
    }

    if (
        typeof payload.description !== "string" ||
        payload.description.length > 1000
    ) {
        return "Deskripsi maksimal 1000 karakter.";
    }

    return null;
}

// ==========================================
// 13. SIMPAN PRODUK
// ==========================================

if (productForm) {
    productForm.addEventListener("submit", async event => {
        event.preventDefault();

        if (isSavingProduct) return;

        const id = $("productId")?.value || "";
        const isEdit = Boolean(id);

        if (isEdit && !getProductById(id)) {
            setMessage(
                "formMessage",
                "Produk tidak ditemukan. Silakan muat ulang halaman.",
                "form-message error"
            );

            return;
        }

        const payload = {
            code: $("productCode")?.value.trim() || "",
            name: $("productName")?.value.trim() || "",

            category_id:
                $("productCategory")?.value || null,

            unit: $("productUnit")?.value || "",

            minimum_stock: readNumber("productMinimum"),

            purchase_price: readNumber("productPrice", true),

            description:
                $("productDescription")?.value.trim() || ""
        };

        if (!isEdit) {
            payload.initial_stock = readNumber("productStock");
        }

        const validationError = validateProductPayload(
            payload,
            isEdit
        );

        if (validationError) {
            setMessage(
                "formMessage",
                validationError,
                "form-message error"
            );

            return;
        }

        const button = $("saveProductBtn");

        isSavingProduct = true;

        if (button) {
            button.disabled = true;

            button.innerHTML = `
                <i class="fas fa-spinner fa-spin"></i>
                Menyimpan...
            `;
        }

        clearMessage("formMessage");

        try {
            const result = await fetchJSON(
                isEdit
                    ? `/api/products/${encodeURIComponent(id)}`
                    : "/api/products",
                {
                    method: isEdit ? "PUT" : "POST",

                    headers: {
                        "Content-Type": "application/json"
                    },

                    body: JSON.stringify(payload)
                }
            );

            const productsLoaded = await loadProducts();

            await loadCategories();

            if (!productsLoaded) {
                setMessage(
                    "formMessage",
                    "Produk berhasil disimpan, tetapi daftar produk gagal diperbarui. Silakan muat ulang halaman.",
                    "form-message error"
                );

                return;
            }

            setMessage(
                "formMessage",
                result.message || "Produk berhasil disimpan.",
                "form-message success"
            );

        } catch (error) {
            console.error("Save product:", error);

            setMessage(
                "formMessage",
                error.message,
                "form-message error"
            );

        } finally {
            isSavingProduct = false;

            if (button) {
                button.disabled = false;

                button.innerHTML = isEdit
                    ? '<i class="fas fa-save"></i> Simpan Perubahan'
                    : '<i class="fas fa-save"></i> Simpan Produk';
            }
        }
    });
}

// ==========================================
// 14. ARSIP PRODUK
// ==========================================

async function archiveProduct(id) {
    const product = getProductById(id);

    if (!product) return;

    const productId = validId(id);

    if (!productId || busyProductActions.has(productId)) return;

    if (Number(product.stock ?? 0) > 0) {
        alert(
            `Produk "${product.name}" masih memiliki stok ${formatNumber(product.stock)} ${product.unit || ""}.\n\nKosongkan stok melalui transaksi barang keluar terlebih dahulu.`
        );

        return;
    }

    const confirmed = confirm(
        `Apakah kamu yakin ingin mengarsipkan "${product.name}"?\n\nProduk tidak akan muncul lagi dalam daftar inventaris aktif.`
    );

    if (!confirmed) return;

    busyProductActions.add(productId);
    renderProducts();

    try {
        const result = await fetchJSON(
            `/api/products/${productId}/archive`,
            {
                method: "PATCH"
            }
        );

        await Promise.all([
            loadProducts(),
            loadCategories()
        ]);

        setConnectionStatus(
            result.message || "Produk berhasil diarsipkan."
        );

    } catch (error) {
        console.error("Archive product:", error);

        alert(error.message);

    } finally {
        busyProductActions.delete(productId);
        renderProducts();
    }
}

// ==========================================
// 15. MODAL KATEGORI
// ==========================================

function openCategoryForm() {
    if (!categoryForm || !categoryModal) {
        console.error("Form atau modal kategori tidak ditemukan.");
        return;
    }

    if (isSavingCategory) return;

    categoryForm.reset();

    setValue("categoryId", "");
    setValue("categoryName", "");
    setValue("categoryDescription", "");

    setText(
        "categoryModalTitle",
        "Tambah Kategori"
    );

    setHTML(
        "saveCategoryBtn",
        '<i class="fas fa-save"></i> Simpan Kategori'
    );

    setDisabled("saveCategoryBtn", false);

    clearMessage("categoryFormMessage");

    categoryModal.classList.add("show");

    categoryModal.setAttribute(
        "aria-hidden",
        "false"
    );

    $("categoryName")?.focus();
}

function closeCategoryForm() {
    if (isSavingCategory || !categoryModal) return;

    categoryModal.classList.remove("show");

    categoryModal.setAttribute(
        "aria-hidden",
        "true"
    );
}

// ==========================================
// 16. EDIT KATEGORI
// ==========================================

function editCategory(id) {
    const category = getCategoryById(id);

    if (!category) {
        alert("Kategori tidak ditemukan.");
        return;
    }

    if (!categoryForm || !categoryModal || isSavingCategory) {
        return;
    }

    categoryForm.reset();

    setValue("categoryId", category.id);
    setValue("categoryName", category.name || "");

    setValue(
        "categoryDescription",
        category.description || ""
    );

    setText(
        "categoryModalTitle",
        "Edit Kategori"
    );

    setHTML(
        "saveCategoryBtn",
        '<i class="fas fa-save"></i> Simpan Perubahan'
    );

    setDisabled("saveCategoryBtn", false);

    clearMessage("categoryFormMessage");

    categoryModal.classList.add("show");

    categoryModal.setAttribute(
        "aria-hidden",
        "false"
    );

    $("categoryName")?.focus();
}

// ==========================================
// 17. SIMPAN KATEGORI
// ==========================================

if (categoryForm) {
    categoryForm.addEventListener("submit", async event => {
        event.preventDefault();

        if (isSavingCategory) return;

        const id = $("categoryId")?.value || "";
        const isEdit = Boolean(id);

        const payload = {
            name: $("categoryName")?.value.trim() || "",

            description:
                $("categoryDescription")?.value.trim() || ""
        };

        if (!payload.name) {
            setMessage(
                "categoryFormMessage",
                "Nama kategori wajib diisi.",
                "form-message error"
            );

            $("categoryName")?.focus();

            return;
        }

        if (payload.name.length > 50) {
            setMessage(
                "categoryFormMessage",
                "Nama kategori maksimal 50 karakter.",
                "form-message error"
            );

            $("categoryName")?.focus();

            return;
        }

        if (payload.description.length > 500) {
            setMessage(
                "categoryFormMessage",
                "Deskripsi kategori maksimal 500 karakter.",
                "form-message error"
            );

            $("categoryDescription")?.focus();

            return;
        }

        const button = $("saveCategoryBtn");

        isSavingCategory = true;

        if (button) {
            button.disabled = true;

            button.innerHTML = `
                <i class="fas fa-spinner fa-spin"></i>
                Menyimpan...
            `;
        }

        clearMessage("categoryFormMessage");

        try {
            const result = await fetchJSON(
                isEdit
                    ? `/api/categories/${encodeURIComponent(id)}`
                    : "/api/categories",
                {
                    method: isEdit ? "PUT" : "POST",

                    headers: {
                        "Content-Type": "application/json"
                    },

                    body: JSON.stringify(payload)
                }
            );

            const categoriesLoaded = await loadCategories();

            const productsLoaded = await loadProducts();

            if (!categoriesLoaded) {
                setMessage(
                    "categoryFormMessage",
                    "Kategori tersimpan, tetapi daftar kategori gagal diperbarui. Silakan muat ulang halaman.",
                    "form-message error"
                );

                return;
            }

            categoryModal.classList.remove("show");

            categoryModal.setAttribute(
                "aria-hidden",
                "true"
            );

            categoryForm.reset();

            setValue("categoryId", "");

            let message = result.message || (
                isEdit
                    ? "Kategori berhasil diperbarui."
                    : "Kategori berhasil ditambahkan."
            );

            if (!productsLoaded) {
                message += " Daftar produk gagal diperbarui.";
            }

            setMessage(
                "categoryMessage",
                message,
                productsLoaded
                    ? "category-message success"
                    : "category-message error"
            );

        } catch (error) {
            console.error("Save category:", error);

            setMessage(
                "categoryFormMessage",
                error.message,
                "form-message error"
            );

        } finally {
            isSavingCategory = false;

            if (button) {
                button.disabled = false;

                button.innerHTML = isEdit
                    ? '<i class="fas fa-save"></i> Simpan Perubahan'
                    : '<i class="fas fa-save"></i> Simpan Kategori';
            }
        }
    });
}

// ==========================================
// 18. HAPUS KATEGORI
// ==========================================

async function deleteCategory(id) {
    const category = getCategoryById(id);

    if (!category) return;

    const categoryId = validId(id);

    if (!categoryId || busyCategoryActions.has(categoryId)) {
        return;
    }

    const confirmed = confirm(
        `Hapus kategori "${category.name}"?\n\nKategori yang masih digunakan produk tidak dapat dihapus.`
    );

    if (!confirmed) return;

    busyCategoryActions.add(categoryId);

    renderCategories();

    try {
        const result = await fetchJSON(
            `/api/categories/${categoryId}`,
            {
                method: "DELETE"
            }
        );

        const categoriesLoaded = await loadCategories();

        await loadProducts();

        setMessage(
            "categoryMessage",
            categoriesLoaded
                ? result.message || "Kategori berhasil dihapus."
                : "Kategori berhasil dihapus, tetapi daftar kategori gagal diperbarui.",
            categoriesLoaded
                ? "category-message success"
                : "category-message error"
        );

    } catch (error) {
        console.error("Delete category:", error);

        setMessage(
            "categoryMessage",
            error.message,
            "category-message error"
        );

    } finally {
        busyCategoryActions.delete(categoryId);

        renderCategories();
    }
}

// ==========================================
// 19. EVENT TABEL PRODUK
// ==========================================

if (productTable) {
    productTable.addEventListener("click", event => {
        const button = event.target.closest("[data-action]");

        if (!button || button.disabled) return;

        const id = validId(button.dataset.id);

        if (!id || busyProductActions.has(id)) return;

        switch (button.dataset.action) {
            case "edit":
                editProduct(id);
                break;

            case "archive":
                archiveProduct(id);
                break;
        }
    });
}

// ==========================================
// 20. EVENT TABEL KATEGORI
// ==========================================

if (categoryTable) {
    categoryTable.addEventListener("click", event => {
        const button = event.target.closest(
            "[data-category-action]"
        );

        if (!button || button.disabled) return;

        const id = validId(button.dataset.id);

        if (!id || busyCategoryActions.has(id)) return;

        switch (button.dataset.categoryAction) {
            case "edit":
                editCategory(id);
                break;

            case "delete":
                deleteCategory(id);
                break;
        }
    });
}

// ==========================================
// 21. EVENT TOMBOL PRODUK
// ==========================================

bind("addProductBtn", "click", openProductForm);
bind("closeModal", "click", closeProductForm);
bind("cancelModal", "click", closeProductForm);

if (modal) {
    modal.addEventListener("click", event => {
        if (event.target === modal) {
            closeProductForm();
        }
    });
}

// ==========================================
// 22. EVENT TOMBOL KATEGORI
// ==========================================

bind("manageCategoryBtn", "click", () => {
    const card = $("categoryCard");
    const button = $("manageCategoryBtn");

    if (!card || !button) return;

    const isVisible = card.classList.toggle("show");

    button.setAttribute(
        "aria-expanded",
        String(isVisible)
    );

    if (isVisible) {
        loadCategories();
    }
});

bind("addCategoryBtn", "click", openCategoryForm);
bind("closeCategoryModal", "click", closeCategoryForm);
bind("cancelCategoryModal", "click", closeCategoryForm);

if (categoryModal) {
    categoryModal.addEventListener("click", event => {
        if (event.target === categoryModal) {
            closeCategoryForm();
        }
    });
}

// ==========================================
// 23. PENCARIAN DAN FILTER
// ==========================================

bind("searchProduct", "input", renderProducts);

bind("filterStatus", "change", renderProducts);

bind("filterCategory", "change", renderProducts);

// ==========================================
// 24. KEYBOARD ESCAPE
// ==========================================

document.addEventListener("keydown", event => {
    if (event.key !== "Escape") return;

    closeProductForm();
    closeCategoryForm();
});

// ==========================================
// 25. INISIALISASI
// ==========================================

async function initializeInventory() {
    setConnectionStatus(
        "Menghubungkan ke database..."
    );

    if (!productForm) {
        console.error("Form #productForm tidak ditemukan.");
    }

    if (!productTable) {
        console.error("Tabel #productTable tidak ditemukan.");
    }

    if (!categoryForm) {
        console.warn("Form #categoryForm tidak ditemukan.");
    }

    if (!categoryTable) {
        console.warn("Tabel #categoryTable tidak ditemukan.");
    }

    const results = await Promise.all([
        loadCategories(),
        loadProducts()
    ]);

    if (!results[0]) {
        console.warn("Kategori belum berhasil dimuat.");
    }

    if (!results[1]) {
        console.warn("Produk belum berhasil dimuat.");
    }
}

if (document.readyState === "loading") {
    document.addEventListener(
        "DOMContentLoaded",
        initializeInventory,
        { once: true }
    );
} else {
    initializeInventory();
}

// ==========================================
// END INVENTORY JAVASCRIPT
// SEDUH SENJA VERSION 5.2
// ==========================================
