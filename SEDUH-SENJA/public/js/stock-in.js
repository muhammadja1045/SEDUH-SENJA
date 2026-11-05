const form = document.getElementById("stockInForm");
const productSelect = document.getElementById("productId");
const supplierSelect = document.getElementById("supplierId");
const tableBody = document.getElementById("stockInTable");
const message = document.getElementById("stockInMessage");
const saveButton = document.getElementById("saveStockIn");

const dateInput = document.getElementById("transactionDate");

// Isi tanggal hari ini
dateInput.value = new Date().toLocaleDateString("en-CA");

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}

function formatRupiah(value) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0
  }).format(Number(value) || 0);
}

async function loadProducts() {
  try {
    const response = await fetch("/api/products");
    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.message || "Gagal memuat produk.");
    }

    productSelect.innerHTML = '<option value="">Pilih produk</option>';

    result.data.forEach((product) => {
      const option = document.createElement("option");
      option.value = product.id;
      option.textContent = `${product.code} - ${product.name} (${product.unit})`;
      productSelect.appendChild(option);
    });
  } catch (error) {
    productSelect.innerHTML = '<option value="">Gagal memuat produk</option>';
    console.error(error);
  }
}

async function loadSuppliers() {
  try {
    const response = await fetch("/api/suppliers");
    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.message || "Gagal memuat supplier.");
    }

    supplierSelect.innerHTML = '<option value="">Tanpa supplier</option>';

    result.data.forEach((supplier) => {
      const option = document.createElement("option");
      option.value = supplier.id;
      option.textContent = supplier.name;
      supplierSelect.appendChild(option);
    });
  } catch (error) {
    console.error(error);
  }
}

async function loadStockInHistory() {
  try {
    const response = await fetch("/api/stock-in");
    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.message || "Gagal memuat riwayat.");
    }

    if (result.data.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="7" class="stock-empty">
            Belum ada transaksi barang masuk.
          </td>
        </tr>
      `;
      return;
    }

    tableBody.innerHTML = result.data.map((item) => `
      <tr>
        <td>${escapeHTML(item.transaction_code)}</td>
        <td>${escapeHTML(item.transaction_date)}</td>
        <td>${escapeHTML(item.product_name)}</td>
        <td>${escapeHTML(item.supplier_name || "-")}</td>
        <td>${escapeHTML(item.quantity)} ${escapeHTML(item.unit)}</td>
        <td>${formatRupiah(item.price)}</td>
        <td>${escapeHTML(item.notes || "-")}</td>
      </tr>
    `).join("");
  } catch (error) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="7" class="stock-empty">
          Gagal memuat riwayat barang masuk.
        </td>
      </tr>
    `;
    console.error(error);
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  message.textContent = "";
  saveButton.disabled = true;
  saveButton.textContent = "Menyimpan...";

  const payload = {
    product_id: productSelect.value,
    supplier_id: supplierSelect.value,
    transaction_date: dateInput.value,
    quantity: document.getElementById("quantity").value,
    price: document.getElementById("price").value || 0,
    notes: document.getElementById("notes").value
  };

  try {
    const response = await fetch("/api/stock-in", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.message || "Transaksi gagal disimpan.");
    }

    message.textContent = result.message;
    message.style.color = "green";

    form.reset();
    dateInput.value = new Date().toLocaleDateString("en-CA");

    await loadProducts();
    await loadStockInHistory();

  } catch (error) {
    message.textContent = error.message;
    message.style.color = "#B84A3A";
  } finally {
    saveButton.disabled = false;
    saveButton.textContent = "Simpan Barang Masuk";
  }
});

form.addEventListener("reset", () => {
  setTimeout(() => {
    dateInput.value = new Date().toLocaleDateString("en-CA");
    message.textContent = "";
  }, 0);
});

// Jalankan saat halaman dibuka
loadProducts();
loadSuppliers();
loadStockInHistory();