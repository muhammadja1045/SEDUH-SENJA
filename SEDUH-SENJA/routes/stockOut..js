
const express = require("express");
const crypto = require("crypto");
const db = require("../config/database");

const router = express.Router();

// ==========================================
// 1. KONFIGURASI
// ==========================================

const MAX_NOTES_LENGTH = 500;
const MAX_SEARCH_LENGTH = 100;
const MAX_HISTORY = 100;

// ==========================================
// 2. HELPER
// ==========================================

// Generate kode transaksi unik
function generateTransactionCode() {
    return `OUT-${Date.now()}-${crypto.randomUUID()
        .slice(0, 8)
        .toUpperCase()}`;
}

// Validasi ID
function isValidId(value) {
    const id = Number(value);

    return (
        Number.isSafeInteger(id) &&
        id > 0
    );
}

// Validasi tanggal YYYY-MM-DD
function validateDate(date) {
    if (
        typeof date !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(date)
    ) {
        return false;
    }

    const parsed = new Date(`${date}T00:00:00.000Z`);

    return (
        !Number.isNaN(parsed.getTime()) &&
        parsed.toISOString().slice(0, 10) === date
    );
}

// Format respons error
function sendError(res, status, message) {
    return res.status(status).json({
        success: false,
        message
    });
}

// ==========================================
// 3. GET - RIWAYAT BARANG KELUAR
// ==========================================

router.get("/", (req, res) => {
    try {
        const search = String(
            req.query.search || ""
        ).trim();

        if (search.length > MAX_SEARCH_LENGTH) {
            return sendError(
                res,
                400,
                "Pencarian maksimal 100 karakter."
            );
        }

        const requestedLimit = Number(req.query.limit);

        const limit = Number.isFinite(requestedLimit)
            ? Math.min(
                Math.max(Math.floor(requestedLimit), 1),
                MAX_HISTORY
            )
            : MAX_HISTORY;

        const transactions = db.prepare(`
            SELECT
                st.id,
                st.transaction_code,
                st.product_id,
                p.code AS product_code,
                p.name AS product_name,
                st.quantity,
                st.unit,
                st.price,
                st.notes,
                st.transaction_date

            FROM stock_transactions st

            INNER JOIN products p
                ON p.id = st.product_id

            WHERE st.transaction_type = 'OUT'

            AND (
                @search = ''
                OR st.transaction_code LIKE @keyword
                OR p.name LIKE @keyword
                OR p.code LIKE @keyword
            )

            ORDER BY
                st.transaction_date DESC,
                st.id DESC

            LIMIT @limit
        `).all({
            search,
            keyword: `%${search}%`,
            limit
        });

        return res.json({
            success: true,
            message: "Riwayat barang keluar berhasil diambil.",
            total: transactions.length,
            data: transactions
        });

    } catch (error) {
        console.error(
            "[STOCK OUT] GET ERROR:",
            error
        );

        return sendError(
            res,
            500,
            "Gagal mengambil riwayat barang keluar."
        );
    }
});

// ==========================================
// 4. GET - DETAIL TRANSAKSI
// ==========================================

router.get("/:id", (req, res) => {
    try {
        const id = Number(req.params.id);

        if (!isValidId(id)) {
            return sendError(
                res,
                400,
                "ID transaksi tidak valid."
            );
        }

        const transaction = db.prepare(`
            SELECT
                st.id,
                st.transaction_code,
                st.product_id,
                p.code AS product_code,
                p.name AS product_name,
                st.quantity,
                st.unit,
                st.price,
                st.notes,
                st.transaction_date

            FROM stock_transactions st

            INNER JOIN products p
                ON p.id = st.product_id

            WHERE st.id = ?
            AND st.transaction_type = 'OUT'
        `).get(id);

        if (!transaction) {
            return sendError(
                res,
                404,
                "Transaksi barang keluar tidak ditemukan."
            );
        }

        return res.json({
            success: true,
            message: "Detail transaksi berhasil diambil.",
            data: transaction
        });

    } catch (error) {
        console.error(
            "[STOCK OUT] DETAIL ERROR:",
            error
        );

        return sendError(
            res,
            500,
            "Gagal mengambil detail transaksi."
        );
    }
});

// ==========================================
// 5. POST - TAMBAH BARANG KELUAR
// ==========================================

router.post("/", (req, res) => {
    try {

        // ----------------------------------
        // A. VALIDASI BODY
        // ----------------------------------

        if (
            !req.body ||
            typeof req.body !== "object" ||
            Array.isArray(req.body)
        ) {
            return sendError(
                res,
                400,
                "Format data transaksi tidak valid."
            );
        }

        const {
            product_id,
            quantity,
            transaction_date,
            notes
        } = req.body;

        // ----------------------------------
        // B. VALIDASI PRODUK
        // ----------------------------------

        if (
            product_id === undefined ||
            product_id === null ||
            String(product_id).trim() === ""
        ) {
            return sendError(
                res,
                400,
                "Silakan pilih produk terlebih dahulu."
            );
        }

        const productId = Number(product_id);

        if (!isValidId(productId)) {
            return sendError(
                res,
                400,
                "ID produk tidak valid."
            );
        }

        // ----------------------------------
        // C. VALIDASI JUMLAH
        // ----------------------------------

        if (
            quantity === undefined ||
            quantity === null ||
            String(quantity).trim() === ""
        ) {
            return sendError(
                res,
                400,
                "Jumlah barang wajib diisi."
            );
        }

        const amount = Number(quantity);

        if (
            !Number.isFinite(amount) ||
            amount <= 0
        ) {
            return sendError(
                res,
                400,
                "Jumlah barang harus lebih dari 0."
            );
        }

        // ----------------------------------
        // D. VALIDASI TANGGAL
        // ----------------------------------

        let dateValue = null;

        if (
            transaction_date !== undefined &&
            transaction_date !== null &&
            transaction_date !== ""
        ) {
            if (!validateDate(transaction_date)) {
                return sendError(
                    res,
                    400,
                    "Tanggal transaksi tidak valid."
                );
            }

            dateValue = `${transaction_date} 12:00:00`;
        }

        // ----------------------------------
        // E. VALIDASI CATATAN
        // ----------------------------------

        let cleanNotes = null;

        if (notes !== undefined && notes !== null) {
            if (typeof notes !== "string") {
                return sendError(
                    res,
                    400,
                    "Catatan harus berupa teks."
                );
            }

            cleanNotes = notes.trim();

            if (cleanNotes.length > MAX_NOTES_LENGTH) {
                return sendError(
                    res,
                    400,
                    "Catatan maksimal 500 karakter."
                );
            }

            if (cleanNotes === "") {
                cleanNotes = null;
            }
        }

        // ----------------------------------
        // F. GENERATE KODE TRANSAKSI
        // ----------------------------------

        const transactionCode = generateTransactionCode();

        // ==================================
        // 6. TRANSAKSI DATABASE SQLITE
        // ==================================

        const saveTransaction = db.transaction(() => {

            // Ambil data produk
            const product = db.prepare(`
                SELECT
                    id,
                    code,
                    name,
                    unit,
                    stock

                FROM products

                WHERE id = ?
                AND is_archived = 0
            `).get(productId);

            if (!product) {
                throw new Error("PRODUCT_NOT_FOUND");
            }

            // ----------------------------------
            // CEK STOK TERSEDIA
            // ----------------------------------

            const currentStock = Number(product.stock);

            if (
                !Number.isFinite(currentStock) ||
                currentStock < 0
            ) {
                throw new Error("INVALID_STOCK");
            }

            if (amount > currentStock) {
                throw new Error("STOCK_NOT_ENOUGH");
            }

            const previousStock = currentStock;

            // ----------------------------------
            // KURANGI STOK
            // ----------------------------------

            const updateStock = db.prepare(`
                UPDATE products

                SET stock = stock - ?

                WHERE id = ?
                AND is_archived = 0
                AND stock >= ?
            `).run(
                amount,
                productId,
                amount
            );

            if (updateStock.changes !== 1) {
                throw new Error("STOCK_NOT_ENOUGH");
            }

            // ----------------------------------
            // AMBIL STOK TERBARU
            // ----------------------------------

            const updatedProduct = db.prepare(`
                SELECT stock

                FROM products

                WHERE id = ?
            `).get(productId);

            if (!updatedProduct) {
                throw new Error("PRODUCT_NOT_FOUND");
            }

            const remainingStock = Number(
                updatedProduct.stock
            );

            // ----------------------------------
            // SIMPAN RIWAYAT TRANSAKSI
            // ----------------------------------

            const insertResult = db.prepare(`
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
                    ?,
                    ?,
                    'OUT',
                    ?,
                    ?,
                    NULL,
                    0,
                    ?,
                    COALESCE(?, CURRENT_TIMESTAMP)
                )
            `).run(
                transactionCode,
                productId,
                amount,
                product.unit,
                cleanNotes,
                dateValue
            );

            const transactionId = Number(
                insertResult.lastInsertRowid
            );

            // ----------------------------------
            // AMBIL TANGGAL TRANSAKSI
            // ----------------------------------

            const savedTransaction = db.prepare(`
                SELECT transaction_date

                FROM stock_transactions

                WHERE id = ?
            `).get(transactionId);

            if (!savedTransaction) {
                throw new Error("TRANSACTION_NOT_SAVED");
            }

            // ----------------------------------
            // HASIL TRANSAKSI
            // ----------------------------------

            return {
                id: transactionId,
                transaction_code: transactionCode,

                product_id: product.id,
                product_code: product.code,
                product_name: product.name,

                quantity: amount,
                unit: product.unit,

                previous_stock: previousStock,
                remaining_stock: remainingStock,

                notes: cleanNotes,

                transaction_date:
                    savedTransaction.transaction_date
            };
        });

        // Jalankan transaksi SQLite
        // Semua perubahan akan rollback jika gagal.
        const result = saveTransaction.immediate();

        // ----------------------------------
        // RESPONS BERHASIL
        // ----------------------------------

        return res.status(201).json({
            success: true,
            message: "Barang keluar berhasil dicatat.",
            data: result
        });

    } catch (error) {

        console.error(
            "[STOCK OUT] POST ERROR:",
            error
        );

        // ----------------------------------
        // PENANGANAN ERROR
        // ----------------------------------

        if (error.message === "PRODUCT_NOT_FOUND") {
            return sendError(
                res,
                404,
                "Produk tidak ditemukan atau sudah diarsipkan."
            );
        }

        if (error.message === "STOCK_NOT_ENOUGH") {
            return sendError(
                res,
                400,
                "Stok tidak mencukupi untuk transaksi ini."
            );
        }

        if (error.message === "INVALID_STOCK") {
            return sendError(
                res,
                400,
                "Data stok produk tidak valid."
            );
        }

        if (error.message === "TRANSACTION_NOT_SAVED") {
            return sendError(
                res,
                500,
                "Riwayat transaksi gagal disimpan."
            );
        }

        return res.status(500).json({
            success: false,
            message: "Terjadi kesalahan saat menyimpan transaksi.",

            error: process.env.NODE_ENV === "development"
                ? error.message
                : undefined
        });
    }
});

// ==========================================
// 7. EXPORT ROUTER
// ==========================================

module.exports = router;
