const express = require("express");
const crypto = require("crypto");
const router = express.Router();
const db = require("../config/database");

// ==========================================
// GET: RIWAYAT BARANG KELUAR
// ==========================================

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
                st.notes,
                st.transaction_date
            FROM stock_transactions st
            JOIN products p ON p.id = st.product_id
            WHERE st.transaction_type = 'OUT'
            ORDER BY st.transaction_date DESC, st.id DESC
            LIMIT 100
        `).all();

        res.json({
            success: true,
            data: transactions
        });

    } catch (error) {
        console.error("Get stock-out error:", error);

        res.status(500).json({
            success: false,
            message: "Gagal mengambil riwayat barang keluar."
        });
    }
});


// ==========================================
// POST: MENYIMPAN BARANG KELUAR
// ==========================================

router.post("/", (req, res) => {
    try {
        const {
            product_id,
            quantity,
            transaction_date,
            notes
        } = req.body;

        const productId = Number(product_id);
        const amount = Number(quantity);

        // Validasi produk
        if (!Number.isInteger(productId) || productId <= 0) {
            return res.status(400).json({
                success: false,
                message: "Pilih produk yang valid."
            });
        }

        // Validasi jumlah
        if (!Number.isFinite(amount) || amount <= 0) {
            return res.status(400).json({
                success: false,
                message: "Jumlah barang keluar harus lebih dari 0."
            });
        }

        // Validasi tanggal
        let dateValue = null;

        if (transaction_date) {
            const validDate =
                /^\d{4}-\d{2}-\d{2}$/.test(transaction_date) &&
                !Number.isNaN(Date.parse(transaction_date)) &&
                new Date(transaction_date).toISOString().slice(0, 10)
                    === transaction_date;

            if (!validDate) {
                return res.status(400).json({
                    success: false,
                    message: "Format tanggal tidak valid."
                });
            }

            dateValue = `${transaction_date} 12:00:00`;
        }

        // Ambil data produk
        const product = db.prepare(`
            SELECT id, name, unit, stock
            FROM products
            WHERE id = ? AND is_archived = 0
        `).get(productId);

        if (!product) {
            return res.status(404).json({
                success: false,
                message: "Produk tidak ditemukan."
            });
        }

        // Cek stok tersedia
        if (amount > product.stock) {
            return res.status(400).json({
                success: false,
                message: `Stok tidak mencukupi. Stok tersedia: ${product.stock} ${product.unit}.`
            });
        }

        const transactionCode =
            "OUT-" + Date.now() + "-" +
            crypto.randomUUID().slice(0, 8);

        // Transaksi database harus berjalan bersamaan
        const saveTransaction = db.transaction(() => {

            // Kurangi stok hanya jika stok mencukupi
            const update = db.prepare(`
                UPDATE products
                SET stock = stock - ?
                WHERE id = ?
                AND is_archived = 0
                AND stock >= ?
            `).run(amount, productId, amount);

            if (update.changes !== 1) {
                throw new Error("STOCK_NOT_ENOUGH");
            }

            // Simpan riwayat transaksi
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
                VALUES (
                    ?, ?, 'OUT', ?, ?, NULL, 0, ?,
                    COALESCE(?, CURRENT_TIMESTAMP)
                )
            `).run(
                transactionCode,
                productId,
                amount,
                product.unit,
                notes ? String(notes).trim() : null,
                dateValue
            );
        });

        saveTransaction();

        // Ambil stok terbaru
        const updatedProduct = db.prepare(`
            SELECT stock FROM products WHERE id = ?
        `).get(productId);

        res.status(201).json({
            success: true,
            message: `Barang keluar ${product.name} berhasil dicatat.`,
            transaction_code: transactionCode,
            remaining_stock: updatedProduct.stock,
            unit: product.unit
        });

    } catch (error) {
        console.error("Add stock-out error:", error);

        if (error.message === "STOCK_NOT_ENOUGH") {
            return res.status(400).json({
                success: false,
                message: "Stok tidak mencukupi untuk transaksi ini."
            });
        }

        res.status(500).json({
            success: false,
            message: "Gagal menyimpan transaksi barang keluar."
        });
    }
});

module.exports = router;