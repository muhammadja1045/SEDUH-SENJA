
const express = require("express");
const crypto = require("crypto");
const db = require("../config/database");

const router = express.Router();

// ==========================================
// HELPER VALIDASI
// ==========================================

function isValidText(value, maxLength) {
    return (
        typeof value === "string" &&
        value.trim().length > 0 &&
        value.trim().length <= maxLength
    );
}

function parseNumber(value, defaultValue = 0) {
    if (value === undefined || value === null || value === "") {
        return defaultValue;
    }

    const number = Number(value);

    return Number.isFinite(number) ? number : null;
}

function parseCategoryId(value) {
    if (value === undefined || value === null || value === "") {
        return null;
    }

    const id = Number(value);

    if (!Number.isInteger(id) || id <= 0) {
        return undefined;
    }

    return id;
}

function isUniqueError(error) {
    return error.code === "SQLITE_CONSTRAINT_UNIQUE";
}

function handleError(res, error, message) {
    console.error(message, error);

    if (isUniqueError(error)) {
        return res.status(409).json({
            success: false,
            message: "Kode produk sudah digunakan."
        });
    }

    return res.status(500).json({
        success: false,
        message
    });
}

function validateCategory(categoryId) {
    if (categoryId === null) return true;

    return !!db.prepare(`
        SELECT id FROM categories WHERE id = ?
    `).get(categoryId);
}

// ==========================================
// 1. MENGAMBIL SELURUH PRODUK
// ==========================================

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
                p.description,
                p.created_at
            FROM products p
            LEFT JOIN categories c
                ON p.category_id = c.id
            WHERE p.is_archived = 0
            ORDER BY p.created_at DESC, p.id DESC
        `).all();

        return res.json({
            success: true,
            products
        });

    } catch (error) {
        return handleError(
            res,
            error,
            "Gagal mengambil data produk."
        );
    }
});

// ==========================================
// 2. MENAMBAHKAN PRODUK
// ==========================================

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

        // Validasi teks
        if (
            !isValidText(code, 50) ||
            !isValidText(name, 150) ||
            !isValidText(unit, 30)
        ) {
            return res.status(400).json({
                success: false,
                message: "Kode, nama, dan satuan wajib diisi dengan format yang benar."
            });
        }

        if (
            description !== undefined &&
            description !== null &&
            typeof description !== "string"
        ) {
            return res.status(400).json({
                success: false,
                message: "Format deskripsi tidak valid."
            });
        }

        if (description && description.length > 1000) {
            return res.status(400).json({
                success: false,
                message: "Deskripsi maksimal 1000 karakter."
            });
        }

        // Validasi angka
        const stock = parseNumber(initial_stock);
        const minimum = parseNumber(minimum_stock);
        const price = parseNumber(purchase_price);

        if (
            stock === null || stock < 0 ||
            minimum === null || minimum < 0 ||
            price === null || price < 0
        ) {
            return res.status(400).json({
                success: false,
                message: "Stok, stok minimum, atau harga tidak valid."
            });
        }

        // Validasi kategori
        const categoryId = parseCategoryId(category_id);

        if (categoryId === undefined) {
            return res.status(400).json({
                success: false,
                message: "Kategori tidak valid."
            });
        }

        if (!validateCategory(categoryId)) {
            return res.status(400).json({
                success: false,
                message: "Kategori tidak ditemukan."
            });
        }

        const cleanCode = code.trim();
        const cleanName = name.trim();
        const cleanUnit = unit.trim();
        const cleanDescription = description?.trim() || null;

        // Transaksi database
        const createProduct = db.transaction(() => {
            const result = db.prepare(`
                INSERT INTO products (
                    code,
                    name,
                    category_id,
                    unit,
                    initial_stock,
                    stock,
                    minimum_stock,
                    purchase_price,
                    description
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
                cleanCode,
                cleanName,
                categoryId,
                cleanUnit,
                stock,
                stock,
                minimum,
                price,
                cleanDescription
            );

            const productId = Number(result.lastInsertRowid);

            // Catat stok awal jika jumlahnya lebih dari nol
            if (stock > 0) {
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
                    `OPEN-${crypto.randomUUID().toUpperCase()}`,
                    productId,
                    stock,
                    cleanUnit,
                    price,
                    "Stok awal",
                    "Pencatatan stok awal produk"
                );
            }

            return productId;
        });

        const productId = createProduct();

        return res.status(201).json({
            success: true,
            message: "Produk berhasil ditambahkan.",
            productId
        });

    } catch (error) {
        return handleError(
            res,
            error,
            "Gagal menambahkan produk."
        );
    }
});

// ==========================================
// 3. MENGEDIT INFORMASI PRODUK
// ==========================================

router.put("/:id", (req, res) => {
    try {
        const id = Number(req.params.id);

        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({
                success: false,
                message: "ID produk tidak valid."
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

        // Validasi teks
        if (
            !isValidText(code, 50) ||
            !isValidText(name, 150) ||
            !isValidText(unit, 30)
        ) {
            return res.status(400).json({
                success: false,
                message: "Kode, nama, dan satuan wajib diisi."
            });
        }

        if (
            description !== undefined &&
            description !== null &&
            typeof description !== "string"
        ) {
            return res.status(400).json({
                success: false,
                message: "Format deskripsi tidak valid."
            });
        }

        if (description && description.length > 1000) {
            return res.status(400).json({
                success: false,
                message: "Deskripsi maksimal 1000 karakter."
            });
        }

        // Validasi angka
        const minimum = parseNumber(minimum_stock);
        const price = parseNumber(purchase_price);

        if (
            minimum === null || minimum < 0 ||
            price === null || price < 0
        ) {
            return res.status(400).json({
                success: false,
                message: "Stok minimum atau harga tidak valid."
            });
        }

        // Validasi kategori
        const categoryId = parseCategoryId(category_id);

        if (categoryId === undefined) {
            return res.status(400).json({
                success: false,
                message: "Kategori tidak valid."
            });
        }

        if (!validateCategory(categoryId)) {
            return res.status(400).json({
                success: false,
                message: "Kategori tidak ditemukan."
            });
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
            WHERE id = ?
            AND is_archived = 0
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
                message: "Produk tidak ditemukan atau sudah diarsipkan."
            });
        }

        return res.json({
            success: true,
            message: "Produk berhasil diperbarui."
        });

    } catch (error) {
        return handleError(
            res,
            error,
            "Gagal memperbarui produk."
        );
    }
});

// ==========================================
// 4. MENGARSIPKAN PRODUK
// ==========================================

router.patch("/:id/archive", (req, res) => {
    try {
        const id = Number(req.params.id);

        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({
                success: false,
                message: "ID produk tidak valid."
            });
        }

        const archiveProduct = db.transaction(() => {
            const product = db.prepare(`
                SELECT id, stock, is_archived
                FROM products
                WHERE id = ?
            `).get(id);

            if (!product || product.is_archived === 1) {
                return {
                    status: "NOT_FOUND"
                };
            }

            if (Number(product.stock) > 0) {
                return {
                    status: "HAS_STOCK"
                };
            }

            db.prepare(`
                UPDATE products
                SET is_archived = 1
                WHERE id = ?
            `).run(id);

            return {
                status: "SUCCESS"
            };
        });

        const result = archiveProduct();

        if (result.status === "NOT_FOUND") {
            return res.status(404).json({
                success: false,
                message: "Produk tidak ditemukan atau sudah diarsipkan."
            });
        }

        if (result.status === "HAS_STOCK") {
            return res.status(400).json({
                success: false,
                message: "Produk masih memiliki stok. Kosongkan stok sebelum mengarsipkan."
            });
        }

        return res.json({
            success: true,
            message: "Produk berhasil diarsipkan."
        });

    } catch (error) {
        return handleError(
            res,
            error,
            "Gagal mengarsipkan produk."
        );
    }
});

// ==========================================
// EXPORT ROUTER
// ==========================================

module.exports = router;
