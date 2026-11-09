
const express = require("express");
const router = express.Router();
const db = require("../config/database");

// ==========================================
// 1. KONFIGURASI
// ==========================================

const MAX_HISTORY = 1000;
const VALID_TYPES = ["IN", "OUT", "OPENING"];

// ==========================================
// 2. HELPER VALIDASI
// ==========================================

function isValidDate(value) {
    if (
        typeof value !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(value)
    ) {
        return false;
    }

    const date = new Date(`${value}T00:00:00.000Z`);

    return !Number.isNaN(date.getTime()) &&
        date.toISOString().slice(0, 10) === value;
}

// ==========================================
// 3. GET /api/reports
// LAPORAN UTAMA
// ==========================================

router.get("/", (req, res) => {
    try {
        const {
            start_date,
            end_date,
            product_id,
            type
        } = req.query;

        const conditions = [];
        const params = [];

        // FILTER TANGGAL AWAL
        if (start_date) {
            if (!isValidDate(start_date)) {
                return res.status(400).json({
                    success: false,
                    message: "Tanggal awal tidak valid."
                });
            }

            conditions.push(
                "date(st.transaction_date) >= date(?)"
            );

            params.push(start_date);
        }

        // FILTER TANGGAL AKHIR
        if (end_date) {
            if (!isValidDate(end_date)) {
                return res.status(400).json({
                    success: false,
                    message: "Tanggal akhir tidak valid."
                });
            }

            conditions.push(
                "date(st.transaction_date) <= date(?)"
            );

            params.push(end_date);
        }

        // VALIDASI RENTANG TANGGAL
        if (
            start_date &&
            end_date &&
            start_date > end_date
        ) {
            return res.status(400).json({
                success: false,
                message: "Tanggal awal tidak boleh melebihi tanggal akhir."
            });
        }

        // FILTER PRODUK
        if (product_id) {
            const id = Number(product_id);

            if (!Number.isInteger(id) || id <= 0) {
                return res.status(400).json({
                    success: false,
                    message: "Produk tidak valid."
                });
            }

            conditions.push("st.product_id = ?");
            params.push(id);
        }

        // FILTER JENIS TRANSAKSI
        if (type) {
            if (!VALID_TYPES.includes(type)) {
                return res.status(400).json({
                    success: false,
                    message: "Jenis transaksi tidak valid."
                });
            }

            conditions.push(
                "st.transaction_type = ?"
            );

            params.push(type);
        }

        const where = conditions.length
            ? `WHERE ${conditions.join(" AND ")}`
            : "";

        // Filter grafik dan produk teratas:
        // tanggal dan produk tetap berlaku,
        // tetapi filter jenis transaksi diabaikan
        // agar grafik IN dan OUT tetap dapat dibandingkan.

        const analyticsConditions = conditions.filter(
            condition =>
                condition !== "st.transaction_type = ?"
        );

        const analyticsParams = [];

        conditions.forEach((condition, index) => {
            if (condition !== "st.transaction_type = ?") {
                analyticsParams.push(params[index]);
            }
        });

        const analyticsWhere = analyticsConditions.length
            ? `WHERE ${analyticsConditions.join(" AND ")}`
            : "";

        // ======================================
        // 4. RIWAYAT TRANSAKSI
        // ======================================

        const data = db.prepare(`
            SELECT
                st.id,
                st.transaction_code,
                st.transaction_type,
                st.product_id,
                p.code AS product_code,
                p.name AS product_name,
                st.quantity,
                st.unit,
                st.price,
                st.supplier_id,
                s.name AS supplier_name,
                st.purpose,
                st.notes,
                st.transaction_date

            FROM stock_transactions st

            JOIN products p
                ON p.id = st.product_id

            LEFT JOIN suppliers s
                ON s.id = st.supplier_id

            ${where}

            ORDER BY
                st.transaction_date DESC,
                st.id DESC

            LIMIT ${MAX_HISTORY}
        `).all(...params);

        // ======================================
        // 5. RINGKASAN TRANSAKSI
        // ======================================

        const summary = db.prepare(`
            SELECT
                COALESCE(SUM(
                    CASE
                        WHEN st.transaction_type = 'IN'
                        THEN st.quantity
                        ELSE 0
                    END
                ), 0) AS total_stock_in,

                COALESCE(SUM(
                    CASE
                        WHEN st.transaction_type = 'OUT'
                        THEN st.quantity
                        ELSE 0
                    END
                ), 0) AS total_stock_out,

                COUNT(*) AS total_transactions,

                COUNT(DISTINCT st.product_id)
                    AS total_products,

                COALESCE(SUM(
                    CASE
                        WHEN st.transaction_type = 'IN'
                        THEN 1 ELSE 0
                    END
                ), 0) AS count_in,

                COALESCE(SUM(
                    CASE
                        WHEN st.transaction_type = 'OUT'
                        THEN 1 ELSE 0
                    END
                ), 0) AS count_out,

                COALESCE(SUM(
                    CASE
                        WHEN st.transaction_type = 'OPENING'
                        THEN st.quantity
                        ELSE 0
                    END
                ), 0) AS total_opening

            FROM stock_transactions st

            ${where}
        `).get(...params);

        // ======================================
        // 6. GRAFIK TRANSAKSI BULANAN
        // ======================================

        const monthly = db.prepare(`
            SELECT
                strftime(
                    '%Y-%m',
                    st.transaction_date
                ) AS month,

                COALESCE(SUM(
                    CASE
                        WHEN st.transaction_type = 'IN'
                        THEN st.quantity
                        ELSE 0
                    END
                ), 0) AS stock_in,

                COALESCE(SUM(
                    CASE
                        WHEN st.transaction_type = 'OUT'
                        THEN st.quantity
                        ELSE 0
                    END
                ), 0) AS stock_out,

                COALESCE(SUM(
                    CASE
                        WHEN st.transaction_type = 'OPENING'
                        THEN st.quantity
                        ELSE 0
                    END
                ), 0) AS opening_stock

            FROM stock_transactions st

            ${analyticsWhere}

            GROUP BY strftime(
                '%Y-%m',
                st.transaction_date
            )

            ORDER BY month ASC
        `).all(...analyticsParams);

        // ======================================
        // 7. NILAI PERSEDIAAN SAAT INI
        // ======================================

        const inventory = db.prepare(`
            SELECT
                COUNT(*) AS total_products,

                COALESCE(SUM(stock), 0)
                    AS total_units,

                COALESCE(
                    SUM(stock * purchase_price),
                    0
                ) AS total_inventory_value

            FROM products

            WHERE is_archived = 0
        `).get();

        // ======================================
        // 8. TOP 5 PRODUK BARANG KELUAR
        // ======================================

        const topProducts = db.prepare(`
            SELECT
                p.id,
                p.code,
                p.name,
                p.unit,

                COALESCE(
                    SUM(st.quantity),
                    0
                ) AS total_quantity,

                COUNT(st.id) AS total_transactions

            FROM stock_transactions st

            JOIN products p
                ON p.id = st.product_id

            ${analyticsWhere
                ? analyticsWhere + " AND st.transaction_type = 'OUT'"
                : "WHERE st.transaction_type = 'OUT'"
            }

            GROUP BY
                p.id,
                p.code,
                p.name,
                p.unit

            ORDER BY total_quantity DESC

            LIMIT 5
        `).all(...analyticsParams);

        // ======================================
        // 9. RESPONSE API
        // ======================================

        res.json({
            success: true,

            summary,

            inventory,

            analytics: {
                monthly,
                top_products: topProducts
            },

            total: summary.total_transactions,

            displayed: data.length,

            limit: MAX_HISTORY,

            data
        });

    } catch (error) {
        console.error("[REPORTS ERROR]", error);

        res.status(500).json({
            success: false,
            message: "Gagal mengambil laporan inventaris."
        });
    }
});

module.exports = router;
