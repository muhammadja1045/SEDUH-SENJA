
const express = require("express");
const crypto = require("crypto");
const router = express.Router();
const db = require("../config/database");

// ==========================================
// 1. HELPER
// ==========================================

function generateTransactionCode() {
    return `OUT-${Date.now()}-${crypto.randomUUID()
        .slice(0, 8).toUpperCase()}`;
}

function validDate(value) {
    if (typeof value !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return false;
    }

    const [y, m, d] = value.split("-").map(Number);
    const date = new Date(Date.UTC(y, m - 1, d));

    return date.getUTCFullYear() === y &&
        date.getUTCMonth() === m - 1 &&
        date.getUTCDate() === d;
}

// ==========================================
// 2. GET RIWAYAT BARANG KELUAR
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
        console.error("Stock Out GET:", error);

        res.status(500).json({
            success: false,
            message: "Gagal mengambil riwayat barang keluar."
        });
    }
});

// ==========================================
// 3. POST SIMPAN BARANG KELUAR
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

        if (!Number.isSafeInteger(productId) || productId <= 0) {
            return res.status(400).json({
                success: false,
                message: "Pilih produk yang valid."
            });
        }

        if (!Number.isFinite(amount) || amount <= 0) {
            return res.status(400).json({
                success: false,
                message: "Jumlah barang harus lebih dari 0."
            });
        }

        if (!validDate(transaction_date)) {
            return res.status(400).json({
                success: false,
                message: "Tanggal transaksi tidak valid."
            });
        }

        const cleanNotes = notes == null ? "" : String(notes).trim();

        if (cleanNotes.length > 500) {
            return res.status(400).json({
                success: false,
                message: "Keterangan maksimal 500 karakter."
            });
        }

        const product = db.prepare(`
            SELECT id, code, name, stock, unit
            FROM products
            WHERE id = ? AND is_archived = 0
        `).get(productId);

        if (!product) {
            return res.status(404).json({
                success: false,
                message: "Produk tidak ditemukan."
            });
        }

        if (amount > product.stock) {
            return res.status(400).json({
                success: false,
                message: `Stok tidak mencukupi. Stok tersedia: ${product.stock} ${product.unit}.`
            });
        }

        const transactionCode = generateTransactionCode();
        const dateValue = `${transaction_date} 12:00:00`;

        // Transaksi stok dan riwayat harus berhasil bersamaan
        const saveTransaction = db.transaction(() => {

            const update = db.prepare(`
                UPDATE products
                SET stock = stock - ?
                WHERE id = ?
                AND is_archived = 0
                AND stock >= ?
            `).run(amount, productId, amount);

            if (update.changes !== 1) {
                throw new Error("STOCK_INSUFFICIENT");
            }

            db.prepare(`
                INSERT INTO stock_transactions (
                    transaction_code,
                    product_id,
                    transaction_type,
                    quantity,
                    unit,
                    purpose,
                    notes,
                    transaction_date
                )
                VALUES (?, ?, 'OUT', ?, ?, ?, ?, ?)
            `).run(
                transactionCode,
                productId,
                amount,
                product.unit,
                "Penggunaan barang",
                cleanNotes || null,
                dateValue
            );

            return db.prepare(`
                SELECT stock FROM products WHERE id = ?
            `).get(productId);
        });

        const updatedProduct = saveTransaction();

        res.status(201).json({
            success: true,
            message: `Barang keluar ${product.name} berhasil disimpan.`,
            transaction_code: transactionCode,
            product: {
                id: product.id,
                name: product.name,
                quantity: amount,
                unit: product.unit,
                remaining_stock: updatedProduct.stock
            }
        });

    } catch (error) {
        console.error("Stock Out POST:", error);

        if (error.message === "STOCK_INSUFFICIENT") {
            return res.status(400).json({
                success: false,
                message: "Stok tidak mencukupi."
            });
        }

        res.status(500).json({
            success: false,
            message: "Gagal menyimpan transaksi barang keluar."
        });
    }
});

module.exports = router;
