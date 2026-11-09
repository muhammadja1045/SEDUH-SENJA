
document.addEventListener("DOMContentLoaded", () => {

    // ==========================================
    // 1. ELEMENT
    // ==========================================

    const table = document.getElementById("supplierTable");
    const search = document.getElementById("supplierSearch");
    const modal = document.getElementById("supplierModal");
    const form = document.getElementById("supplierForm");

    const modalTitle = document.getElementById("modalTitle");
    const supplierId = document.getElementById("supplierId");
    const supplierName = document.getElementById("supplierName");
    const supplierPhone = document.getElementById("supplierPhone");
    const supplierAddress = document.getElementById("supplierAddress");

    const addButton = document.getElementById("addSupplierButton");
    const closeButton = document.getElementById("closeSupplierModal");
    const cancelButton = document.getElementById("cancelSupplier");
    const saveButton = document.getElementById("saveSupplier");

    const totalSuppliers = document.getElementById("totalSuppliers");
    const suppliersWithPhone = document.getElementById("suppliersWithPhone");
    const suppliersWithAddress = document.getElementById("suppliersWithAddress");
    const supplierCount = document.getElementById("supplierCount");
    const message = document.getElementById("supplierMessage");

    let suppliers = [];
    let isSaving = false;

    // ==========================================
    // 2. API HELPER
    // ==========================================

    async function apiRequest(url, options = {}) {

        const response = await fetch(url, {
            ...options,
            headers: {
                "Accept": "application/json",
                ...(options.body
                    ? { "Content-Type": "application/json" }
                    : {}),
                ...options.headers
            }
        });

        const result = await response.json().catch(() => ({
            success: false,
            message: "Respons server tidak valid."
        }));

        if (!response.ok || !result.success) {
            throw new Error(
                result.message || `HTTP Error ${response.status}`
            );
        }

        return result;
    }

    // ==========================================
    // 3. HELPER
    // ==========================================

    function formatDate(value) {

        if (!value) return "-";

        const datePart = String(value).split(/[ T]/)[0];

        const parts = datePart.split("-");

        if (parts.length !== 3) return String(value);

        const date = new Date(
            Number(parts[0]),
            Number(parts[1]) - 1,
            Number(parts[2])
        );

        if (Number.isNaN(date.getTime())) {
            return "-";
        }

        return date.toLocaleDateString("id-ID", {
            day: "2-digit",
            month: "long",
            year: "numeric"
        });
    }

    function showMessage(text, success = false) {

        message.textContent = text;

        message.style.color = success
            ? "#27834B"
            : "#B84A3A";
    }

    function createCell(value, className = "") {

        const td = document.createElement("td");

        td.textContent = value ?? "";

        if (className) {
            td.className = className;
        }

        return td;
    }

    function showEmpty(text) {

        table.innerHTML = "";

        const tr = document.createElement("tr");
        const td = document.createElement("td");

        td.colSpan = 6;
        td.className = "supplier-empty";
        td.textContent = text;

        tr.appendChild(td);
        table.appendChild(tr);
    }

    // ==========================================
    // 4. MEMUAT DATA SUPPLIER
    // ==========================================

    async function loadSuppliers() {

        showEmpty("Memuat data supplier...");

        try {

            const result = await apiRequest("/api/suppliers");

            suppliers = Array.isArray(result.data)
                ? result.data
                : [];

            updateStatistics();

            renderSuppliers(suppliers);

            console.log(
                "[SUPPLIER] Data berhasil dimuat:",
                suppliers.length
            );

        } catch (error) {

            console.error("[SUPPLIER] Load error:", error);

            suppliers = [];

            updateStatistics();

            showEmpty("Gagal memuat data supplier.");

            showMessage(error.message);
        }
    }

    // ==========================================
    // 5. UPDATE STATISTIK
    // ==========================================

    function updateStatistics() {

        totalSuppliers.textContent = suppliers.length;

        suppliersWithPhone.textContent =
            suppliers.filter(item =>
                item.phone && String(item.phone).trim()
            ).length;

        suppliersWithAddress.textContent =
            suppliers.filter(item =>
                item.address && String(item.address).trim()
            ).length;
    }

    // ==========================================
    // 6. MENAMPILKAN TABEL
    // ==========================================

    function renderSuppliers(data) {

        table.innerHTML = "";

        supplierCount.textContent =
            `${data.length} supplier`;

        if (!data.length) {

            showEmpty(
                suppliers.length
                    ? "Supplier tidak ditemukan."
                    : "Belum ada supplier. Silakan tambahkan supplier baru."
            );

            return;
        }

        const fragment = document.createDocumentFragment();

        data.forEach((item, index) => {

            const tr = document.createElement("tr");

            tr.appendChild(
                createCell(index + 1)
            );

            tr.appendChild(
                createCell(
                    item.name,
                    "supplier-name"
                )
            );

            tr.appendChild(
                createCell(
                    item.phone || "-",
                    "supplier-contact"
                )
            );

            tr.appendChild(
                createCell(
                    item.address || "-"
                )
            );

            tr.appendChild(
                createCell(
                    formatDate(item.created_at)
                )
            );

            // AKSI

            const actionCell = document.createElement("td");

            const actionWrapper = document.createElement("div");

            actionWrapper.className = "supplier-actions";

            const editButton = document.createElement("button");

            editButton.type = "button";
            editButton.className =
                "supplier-action supplier-edit";

            editButton.textContent = "✎ Edit";

            editButton.addEventListener("click", () => {
                openEditModal(item.id);
            });

            const deleteButton = document.createElement("button");

            deleteButton.type = "button";
            deleteButton.className =
                "supplier-action supplier-delete";

            deleteButton.textContent = "✕ Hapus";

            deleteButton.addEventListener("click", () => {
                deleteSupplier(item.id, item.name);
            });

            actionWrapper.appendChild(editButton);
            actionWrapper.appendChild(deleteButton);

            actionCell.appendChild(actionWrapper);

            tr.appendChild(actionCell);

            fragment.appendChild(tr);
        });

        table.appendChild(fragment);
    }

    // ==========================================
    // 7. PENCARIAN SUPPLIER
    // ==========================================

    search.addEventListener("input", () => {

        const keyword = search.value
            .trim()
            .toLowerCase();

        const filtered = suppliers.filter(item => {

            return [
                item.name,
                item.phone,
                item.address
            ].some(value =>
                String(value || "")
                    .toLowerCase()
                    .includes(keyword)
            );
        });

        renderSuppliers(filtered);
    });

    // ==========================================
    // 8. MODAL TAMBAH SUPPLIER
    // ==========================================

    function openAddModal() {

        form.reset();

        supplierId.value = "";

        modalTitle.textContent = "Tambah Supplier";

        saveButton.textContent = "Simpan Supplier";

        modal.classList.add("show");

        supplierName.focus();
    }

    // ==========================================
    // 9. MODAL EDIT SUPPLIER
    // ==========================================

    function openEditModal(id) {

        const supplier = suppliers.find(
            item => Number(item.id) === Number(id)
        );

        if (!supplier) {
            showMessage("Data supplier tidak ditemukan.");
            return;
        }

        form.reset();

        supplierId.value = supplier.id;

        supplierName.value = supplier.name || "";

        supplierPhone.value = supplier.phone || "";

        supplierAddress.value = supplier.address || "";

        modalTitle.textContent = "Edit Supplier";

        saveButton.textContent = "Perbarui Supplier";

        modal.classList.add("show");

        supplierName.focus();
    }

    // ==========================================
    // 10. TUTUP MODAL
    // ==========================================

    function closeModal() {

        modal.classList.remove("show");

        form.reset();

        supplierId.value = "";

        isSaving = false;

        saveButton.disabled = false;
    }

    addButton.addEventListener("click", openAddModal);

    closeButton.addEventListener("click", closeModal);

    cancelButton.addEventListener("click", closeModal);

    modal.addEventListener("click", event => {

        if (event.target === modal) {
            closeModal();
        }
    });

    document.addEventListener("keydown", event => {

        if (
            event.key === "Escape" &&
            modal.classList.contains("show")
        ) {
            closeModal();
        }
    });

    // ==========================================
    // 11. SIMPAN / UPDATE SUPPLIER
    // ==========================================

    form.addEventListener("submit", async event => {

        event.preventDefault();

        if (isSaving) return;

        const id = supplierId.value;

        const payload = {
            name: supplierName.value.trim(),
            phone: supplierPhone.value.trim(),
            address: supplierAddress.value.trim()
        };

        if (!payload.name) {

            showMessage("Nama supplier wajib diisi.");

            supplierName.focus();

            return;
        }

        isSaving = true;

        saveButton.disabled = true;

        saveButton.textContent = "Menyimpan...";

        try {

            const url = id
                ? `/api/suppliers/${encodeURIComponent(id)}`
                : "/api/suppliers";

            const method = id ? "PUT" : "POST";

            const result = await apiRequest(url, {
                method,
                body: JSON.stringify(payload)
            });

            closeModal();

            await loadSuppliers();

            showMessage(
                result.message ||
                "Data supplier berhasil disimpan.",
                true
            );

        } catch (error) {

            console.error("[SUPPLIER] Save error:", error);

            showMessage(error.message);

        } finally {

            isSaving = false;

            saveButton.disabled = false;

            saveButton.textContent =
                supplierId.value
                    ? "Perbarui Supplier"
                    : "Simpan Supplier";
        }
    });

    // ==========================================
    // 12. HAPUS SUPPLIER
    // ==========================================

    async function deleteSupplier(id, name) {

        const confirmation = confirm(
            `Apakah kamu yakin ingin menghapus supplier "${name}"?\n\nData yang dihapus tidak dapat dikembalikan.`
        );

        if (!confirmation) return;

        try {

            const result = await apiRequest(
                `/api/suppliers/${encodeURIComponent(id)}`,
                {
                    method: "DELETE"
                }
            );

            await loadSuppliers();

            showMessage(
                result.message ||
                "Supplier berhasil dihapus.",
                true
            );

        } catch (error) {

            console.error("[SUPPLIER] Delete error:", error);

            showMessage(error.message);
        }
    }

    // ==========================================
    // 13. INISIALISASI
    // ==========================================

    console.log(
        "SEDUH SENJA - Supplier Management Initialized"
    );

    loadSuppliers();

});
