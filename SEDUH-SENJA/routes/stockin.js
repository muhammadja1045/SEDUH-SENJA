const express = require("express");
const crypto = require("crypto");
const router = express.Router();
const db = require("../config/database");

// GET /api/stock-in
// Mengambil riwayat barang masuk
router.get("/", (req, res) => {
  try {
    const transactions = db.prepare(`
      SELECT
        st.id,
        st.transaction_code,
        st.product_id,
        p.code AS product_code,
        p.name AS product_name,
        st.quantity,
        st.unit,
        st.supplier_id,
        s.name AS supplier_name,
        st.price,
        st.notes,
        st.transaction_date
      FROM stock_transactions st
      JOIN products p ON p.id = st.product_id
      LEFT JOIN suppliers s ON s.id = st.supplier_id
      WHERE st.transaction_type = 'IN'
      ORDER BY st.transaction_date DESC, st.id DESC
      LIMIT 100
    `).all();

    res.json({ success: true, data: transactions });
  } catch (error) {
    console.error("Get stock-in error:", error);
    res.status(500).json({
      success: false,
      message: "Gagal mengambil riwayat barang masuk."
    });
  }
});

// POST /api/stock-in
// Menyimpan transaksi dan menambah stok produk
router.post("/", (req, res) => {
  try {
    const {
      product_id,
      quantity,
      supplier_id,
      price,
      transaction_date,
      notes
    } = req.body;

    const productId = Number(product_id);
    const amount = Number(quantity);
    const unitPrice = price === "" || price === undefined
      ? 0
      : Number(price);

    if (!Number.isInteger(productId) || productId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Pilih produk yang valid."
      });
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Jumlah barang masuk harus lebih dari 0."
      });
    }

    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      return res.status(400).json({
        success: false,
        message: "Harga beli tidak valid."
      });
    }

    const product = db.prepare(`
      SELECT id, name, unit
      FROM products
      WHERE id = ? AND is_archived = 0
    `).get(productId);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Produk tidak ditemukan atau sudah diarsipkan."
      });
    }

    let supplierId = null;

    if (supplier_id !== undefined && supplier_id !== null && supplier_id !== "") {
      supplierId = Number(supplier_id);

      if (!Number.isInteger(supplierId) || supplierId <= 0) {
        return res.status(400).json({
          success: false,
          message: "Supplier tidak valid."
        });
      }

      const supplier = db.prepare(
        "SELECT id FROM suppliers WHERE id = ?"
      ).get(supplierId);

      if (!supplier) {
        return res.status(404).json({
          success: false,
          message: "Supplier tidak ditemukan."
        });
      }
    }

    let dateValue = null;

    if (transaction_date) {
      const validDate = /^\d{4}-\d{2}-\d{2}$/.test(transaction_date)
        && !Number.isNaN(Date.parse(transaction_date));

      if (!validDate) {
        return res.status(400).json({
          success: false,
          message: "Format tanggal tidak valid."
        });
      }

      dateValue = `${transaction_date} 12:00:00`;
    }

    const transactionCode =
      "IN-" + Date.now() + "-" + crypto.randomUUID().slice(0, 8);

    const saveTransaction = db.transaction(() => {
      // Tambahkan stok produk
      db.prepare(`
        UPDATE products
        SET stock = stock + ?
        WHERE id = ?
      `).run(amount, productId);

      // Simpan riwayat barang masuk
      db.prepare(`
        INSERT INTO stock_transactions (
          transaction_code,
          product_id,
          transaction_type,
          quantity,
          unit,
          supplier_id,
          price,
          notes,
          transaction_date
        )
        VALUES (?, ?, 'IN', ?, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP))
      `).run(
        transactionCode,
        productId,
        amount,
        product.unit,
        supplierId,
        unitPrice,
        notes ? String(notes).trim() : null,
        dateValue
      );
    });

    saveTransaction();

    res.status(201).json({
      success: true,
      message: `Barang masuk untuk ${product.name} berhasil dicatat.`,
      transaction_code: transactionCode
    });

  } catch (error) {
    console.error("Add stock-in error:", error);
    res.status(500).json({
      success: false,
      message: "Gagal menyimpan transaksi barang masuk."
    });
  }
});

module.exports = router;