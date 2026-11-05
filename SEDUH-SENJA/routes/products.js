
const express = require("express");
const db = require("../config/database");

const router = express.Router();

// Mengambil seluruh produk
router.get("/", (req, res) => {
    try {
        const products = db.prepare(`
            SELECT
                p.id,
                p.code,
                p.name,
                p.category_id,
                c.name AS category,
                p.unit,
                p.initial_stock,
                p.stock,
                p.minimum_stock,
                p.purchase_price,
                p.description
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
            WHERE p.is_archived = 0
            ORDER BY p.created_at DESC
        `).all();

        res.json({ success: true, products });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: "Gagal mengambil data produk"
        });
    }
});

// Menambahkan produk
router.post("/", (req, res) => {
    try {
        const {
            code,
            name,
            category_id,
            unit,
            initial_stock,
            minimum_stock,
            purchase_price,
            description
        } = req.body;

        const stock = Number(initial_stock);
        const minimum = Number(minimum_stock);
        const price = Number(purchase_price);

        if (!code?.trim() || !name?.trim() || !unit?.trim()) {
            return res.status(400).json({
                success: false,
                message: "Kode, nama, dan satuan wajib diisi"
            });
        }

        if (
            !Number.isFinite(stock) || stock < 0 ||
            !Number.isFinite(minimum) || minimum < 0 ||
            !Number.isFinite(price) || price < 0
        ) {
            return res.status(400).json({
                success: false,
                message: "Jumlah stok, stok minimum, atau harga tidak valid"
            });
        }

        const categoryId = category_id ? Number(category_id) : null;

        if (categoryId !== null) {
            if (!Number.isInteger(categoryId) || categoryId <= 0) {
                return res.status(400).json({
                    success: false,
                    message: "Kategori tidak valid"
                });
            }

            const category = db.prepare(
                "SELECT id FROM categories WHERE id = ?"
            ).get(categoryId);

            if (!category) {
                return res.status(400).json({
                    success: false,
                    message: "Kategori tidak ditemukan"
                });
            }
        }

        const createProduct = db.transaction(() => {
            const result = db.prepare(`
                INSERT INTO products (
                    code, name, category_id, unit,
                    initial_stock, stock, minimum_stock,
                    purchase_price, description
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
                code.trim(),
                name.trim(),
                categoryId,
                unit.trim(),
                stock,
                stock,
                minimum,
                price,
                description?.trim() || null
            );

            // Catat stok awal sebagai transaksi OPENING
            if (stock > 0) {
                const transactionCode =
                    "OPEN-" + require("crypto").randomUUID();

                db.prepare(`
                    INSERT INTO stock_transactions (
                        transaction_code,
                        product_id,
                        transaction_type,
                        quantity,
                        unit,
                        price,
                        purpose,
                        notes
                    )
                    VALUES (?, ?, 'OPENING', ?, ?, ?, ?, ?)
                `).run(
                    transactionCode,
                    result.lastInsertRowid,
                    stock,
                    unit.trim(),
                    price,
                    "Stok awal",
                    "Pencatatan stok awal produk"
                );
            }

            return result.lastInsertRowid;
        });

        const productId = createProduct();

        res.status(201).json({
            success: true,
            message: "Produk berhasil ditambahkan",
            productId
        });

    } catch (error) {
        console.error(error);

        if (error.code === "SQLITE_CONSTRAINT_UNIQUE") {
            return res.status(409).json({
                success: false,
                message: "Kode produk sudah digunakan"
            });
        }

        res.status(500).json({
            success: false,
            message: "Gagal menambahkan produk"
        });
    }
});

// Mengedit informasi produk
router.put("/:id", (req, res) => {
    try {
        const id = Number(req.params.id);

        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({
                success: false,
                message: "ID produk tidak valid"
            });
        }

        const {
            code,
            name,
            category_id,
            unit,
            minimum_stock,
            purchase_price,
            description
        } = req.body;

        const minimum = Number(minimum_stock);
        const price = Number(purchase_price);
        const categoryId = category_id ? Number(category_id) : null;

        if (!code?.trim() || !name?.trim() || !unit?.trim()) {
            return res.status(400).json({
                success: false,
                message: "Kode, nama, dan satuan wajib diisi"
            });
        }

        if (
            !Number.isFinite(minimum) || minimum < 0 ||
            !Number.isFinite(price) || price < 0
        ) {
            return res.status(400).json({
                success: false,
                message: "Stok minimum atau harga tidak valid"
            });
        }

        if (categoryId !== null) {
            if (!Number.isInteger(categoryId) || categoryId <= 0) {
                return res.status(400).json({
                    success: false,
                    message: "Kategori tidak valid"
                });
            }

            const category = db.prepare(
                "SELECT id FROM categories WHERE id = ?"
            ).get(categoryId);

            if (!category) {
                return res.status(400).json({
                    success: false,
                    message: "Kategori tidak ditemukan"
                });
            }
        }

        const result = db.prepare(`
            UPDATE products
            SET
                code = ?,
                name = ?,
                category_id = ?,
                unit = ?,
                minimum_stock = ?,
                purchase_price = ?,
                description = ?
            WHERE id = ? AND is_archived = 0
        `).run(
            code.trim(),
            name.trim(),
            categoryId,
            unit.trim(),
            minimum,
            price,
            description?.trim() || null,
            id
        );

        if (result.changes === 0) {
            return res.status(404).json({
                success: false,
                message: "Produk tidak ditemukan"
            });
        }

        res.json({
            success: true,
            message: "Produk berhasil diperbarui"
        });

    } catch (error) {
        console.error(error);

        if (error.code === "SQLITE_CONSTRAINT_UNIQUE") {
            return res.status(409).json({
                success: false,
                message: "Kode produk sudah digunakan"
            });
        }

        res.status(500).json({
            success: false,
            message: "Gagal memperbarui produk"
        });
    }
});

// Mengarsipkan produk, bukan menghapus riwayatnya
router.patch("/:id/archive", (req, res) => {
    try {
        const id = Number(req.params.id);

        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({
                success: false,
                message: "ID produk tidak valid"
            });
        }

        const result = db.prepare(`
            UPDATE products
            SET is_archived = 1
            WHERE id = ? AND is_archived = 0
        `).run(id);

        if (result.changes === 0) {
            return res.status(404).json({
                success: false,
                message: "Produk tidak ditemukan"
            });
        }

        res.json({
            success: true,
            message: "Produk berhasil diarsipkan"
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: "Gagal mengarsipkan produk"
        });
    }
});

module.exports = router;
