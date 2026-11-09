
const express = require("express");
const db = require("../config/database");

const router = express.Router();


// ==================================================
// SEDUH SENJA - COFFEE INVENTORY SYSTEM
// CATEGORY ROUTES
// VERSION 5.3 STABLE
// ==================================================


// ==========================================
// 1. HELPER VALIDASI
// ==========================================

// Memastikan request body berbentuk object.
function isValidBody(body) {
    return (
        body !== null &&
        typeof body === "object" &&
        !Array.isArray(body)
    );
}


// Validasi nama kategori.
function validateCategoryName(name) {
    if (typeof name !== "string") {
        return "Nama kategori wajib diisi.";
    }

    const cleanName = name.trim();

    if (!cleanName) {
        return "Nama kategori tidak boleh kosong.";
    }

    if (cleanName.length > 50) {
        return "Nama kategori maksimal 50 karakter.";
    }

    return null;
}


// Validasi deskripsi kategori.
function validateDescription(description) {
    if (
        description === undefined ||
        description === null
    ) {
        return null;
    }

    if (typeof description !== "string") {
        return "Deskripsi kategori harus berupa teks.";
    }

    if (description.trim().length > 500) {
        return "Deskripsi kategori maksimal 500 karakter.";
    }

    return null;
}


// Validasi ID kategori.
function isValidId(id) {
    if (
        typeof id !== "string" &&
        typeof id !== "number"
    ) {
        return null;
    }

    const number = Number(id);

    if (
        !Number.isSafeInteger(number) ||
        number <= 0
    ) {
        return null;
    }

    return number;
}


// Membersihkan nama kategori.
function cleanCategoryName(name) {
    return name.trim();
}


// Membersihkan deskripsi kategori.
function cleanCategoryDescription(description) {
    if (
        description === undefined ||
        description === null
    ) {
        return null;
    }

    return description.trim() || null;
}


// ==========================================
// 2. HELPER DATABASE
// ==========================================


// Mencari kategori berdasarkan ID.
function getCategoryById(id) {
    return db.prepare(`
        SELECT
            id,
            name,
            description,
            created_at
        FROM categories
        WHERE id = ?
    `).get(id);
}


// Memeriksa nama kategori duplikat.
function findDuplicateCategory(name, excludeId = null) {
    if (excludeId !== null) {
        return db.prepare(`
            SELECT id
            FROM categories
            WHERE LOWER(TRIM(name)) = LOWER(TRIM(?))
              AND id != ?
            LIMIT 1
        `).get(name, excludeId);
    }

    return db.prepare(`
        SELECT id
        FROM categories
        WHERE LOWER(TRIM(name)) = LOWER(TRIM(?))
        LIMIT 1
    `).get(name);
}


// Menghitung produk aktif dalam kategori.
function countActiveProducts(categoryId) {
    return db.prepare(`
        SELECT COUNT(*) AS total
        FROM products
        WHERE category_id = ?
          AND is_archived = 0
    `).get(categoryId).total;
}


// Menghitung seluruh produk dalam kategori,
// termasuk produk yang sudah diarsipkan.
function countAllProducts(categoryId) {
    return db.prepare(`
        SELECT COUNT(*) AS total
        FROM products
        WHERE category_id = ?
    `).get(categoryId).total;
}


// ==========================================
// 3. HELPER ERROR
// ==========================================

function handleError(res, error, message) {
    console.error(
        `[CATEGORIES ERROR] ${message}`,
        error
    );

    // Nama kategori sudah digunakan.
    if (
        error?.code === "SQLITE_CONSTRAINT_UNIQUE" ||
        error?.code === "SQLITE_CONSTRAINT_PRIMARYKEY"
    ) {
        return res.status(409).json({
            success: false,
            message: "Nama kategori sudah digunakan."
        });
    }

    // Foreign key constraint.
    if (
        error?.code === "SQLITE_CONSTRAINT_FOREIGNKEY"
    ) {
        return res.status(409).json({
            success: false,
            message:
                "Kategori masih memiliki hubungan dengan data lain."
        });
    }

    // Database sedang terkunci.
    if (
        error?.code === "SQLITE_BUSY" ||
        error?.code === "SQLITE_LOCKED"
    ) {
        return res.status(503).json({
            success: false,
            message:
                "Database sedang sibuk. Silakan coba kembali."
        });
    }

    return res.status(500).json({
        success: false,
        message
    });
}


// ==========================================
// 4. GET SEMUA KATEGORI
// ==========================================

router.get("/", (req, res) => {
    try {
        const categories = db.prepare(`
            SELECT
                c.id,
                c.name,
                c.description,
                c.created_at,

                (
                    SELECT COUNT(*)
                    FROM products p
                    WHERE p.category_id = c.id
                      AND p.is_archived = 0
                ) AS product_count

            FROM categories c

            ORDER BY
                c.name COLLATE NOCASE ASC,
                c.id ASC
        `).all();

        return res.status(200).json({
            success: true,
            message: "Data kategori berhasil diambil.",
            total: categories.length,
            categories
        });

    } catch (error) {
        return handleError(
            res,
            error,
            "Gagal mengambil data kategori."
        );
    }
});


// ==========================================
// 5. GET KATEGORI BERDASARKAN ID
// ==========================================

router.get("/:id", (req, res) => {
    try {
        const id = isValidId(req.params.id);

        if (!id) {
            return res.status(400).json({
                success: false,
                message: "ID kategori tidak valid."
            });
        }

        const category = getCategoryById(id);

        if (!category) {
            return res.status(404).json({
                success: false,
                message: "Kategori tidak ditemukan."
            });
        }

        const productCount = countActiveProducts(id);
        const totalProducts = countAllProducts(id);

        return res.status(200).json({
            success: true,
            category: {
                ...category,
                product_count: productCount,
                total_products: totalProducts
            }
        });

    } catch (error) {
        return handleError(
            res,
            error,
            "Gagal mengambil detail kategori."
        );
    }
});


// ==========================================
// 6. POST TAMBAH KATEGORI
// ==========================================

router.post("/", (req, res) => {
    try {

        // Validasi request body.
        if (!isValidBody(req.body)) {
            return res.status(400).json({
                success: false,
                message: "Data permintaan tidak valid."
            });
        }

        const { name, description } = req.body;


        // ----------------------------------
        // Validasi nama
        // ----------------------------------

        const nameError = validateCategoryName(name);

        if (nameError) {
            return res.status(400).json({
                success: false,
                message: nameError
            });
        }


        // ----------------------------------
        // Validasi deskripsi
        // ----------------------------------

        const descriptionError =
            validateDescription(description);

        if (descriptionError) {
            return res.status(400).json({
                success: false,
                message: descriptionError
            });
        }


        // ----------------------------------
        // Bersihkan input
        // ----------------------------------

        const cleanName = cleanCategoryName(name);

        const cleanDescription =
            cleanCategoryDescription(description);


        // ----------------------------------
        // Cek duplikasi
        // ----------------------------------

        const duplicate = findDuplicateCategory(cleanName);

        if (duplicate) {
            return res.status(409).json({
                success: false,
                message:
                    "Kategori dengan nama tersebut sudah tersedia."
            });
        }


        // ----------------------------------
        // Simpan kategori
        // ----------------------------------

        const result = db.prepare(`
            INSERT INTO categories (
                name,
                description
            )
            VALUES (?, ?)
        `).run(
            cleanName,
            cleanDescription
        );


        // ----------------------------------
        // Ambil data kategori terbaru
        // ----------------------------------

        const category = getCategoryById(
            Number(result.lastInsertRowid)
        );


        return res.status(201).json({
            success: true,
            message: "Kategori berhasil ditambahkan.",
            category
        });

    } catch (error) {
        return handleError(
            res,
            error,
            "Gagal menambahkan kategori."
        );
    }
});


// ==========================================
// 7. PUT EDIT KATEGORI
// ==========================================

router.put("/:id", (req, res) => {
    try {

        // ----------------------------------
        // Validasi request body
        // ----------------------------------

        if (!isValidBody(req.body)) {
            return res.status(400).json({
                success: false,
                message: "Data permintaan tidak valid."
            });
        }


        // ----------------------------------
        // Validasi ID
        // ----------------------------------

        const id = isValidId(req.params.id);

        if (!id) {
            return res.status(400).json({
                success: false,
                message: "ID kategori tidak valid."
            });
        }


        const { name, description } = req.body;


        // ----------------------------------
        // Validasi nama
        // ----------------------------------

        const nameError = validateCategoryName(name);

        if (nameError) {
            return res.status(400).json({
                success: false,
                message: nameError
            });
        }


        // ----------------------------------
        // Validasi deskripsi
        // ----------------------------------

        const descriptionError =
            validateDescription(description);

        if (descriptionError) {
            return res.status(400).json({
                success: false,
                message: descriptionError
            });
        }


        // ----------------------------------
        // Periksa kategori
        // ----------------------------------

        const existing = getCategoryById(id);

        if (!existing) {
            return res.status(404).json({
                success: false,
                message: "Kategori tidak ditemukan."
            });
        }


        // ----------------------------------
        // Bersihkan nama
        // ----------------------------------

        const cleanName = cleanCategoryName(name);


        // ----------------------------------
        // Pertahankan deskripsi lama
        // jika field tidak dikirim.
        // ----------------------------------

        const cleanDescription =
            description === undefined
                ? existing.description
                : cleanCategoryDescription(description);


        // ----------------------------------
        // Cek duplikasi nama
        // ----------------------------------

        const duplicate = findDuplicateCategory(
            cleanName,
            id
        );

        if (duplicate) {
            return res.status(409).json({
                success: false,
                message:
                    "Nama kategori sudah digunakan oleh kategori lain."
            });
        }


        // ----------------------------------
        // Update kategori
        // ----------------------------------

        const result = db.prepare(`
            UPDATE categories
            SET
                name = ?,
                description = ?
            WHERE id = ?
        `).run(
            cleanName,
            cleanDescription,
            id
        );


        if (result.changes === 0) {
            return res.status(404).json({
                success: false,
                message: "Kategori gagal diperbarui."
            });
        }


        // ----------------------------------
        // Ambil data terbaru
        // ----------------------------------

        const category = getCategoryById(id);


        return res.status(200).json({
            success: true,
            message: "Kategori berhasil diperbarui.",
            category
        });

    } catch (error) {
        return handleError(
            res,
            error,
            "Gagal memperbarui kategori."
        );
    }
});


// ==========================================
// 8. DELETE HAPUS KATEGORI
// ==========================================

router.delete("/:id", (req, res) => {
    try {

        // ----------------------------------
        // Validasi ID
        // ----------------------------------

        const id = isValidId(req.params.id);

        if (!id) {
            return res.status(400).json({
                success: false,
                message: "ID kategori tidak valid."
            });
        }


        // ----------------------------------
        // Transaksi penghapusan
        // ----------------------------------

        const deleteCategory = db.transaction(() => {

            const category = db.prepare(`
                SELECT
                    id,
                    name
                FROM categories
                WHERE id = ?
            `).get(id);


            if (!category) {
                return {
                    status: "NOT_FOUND"
                };
            }


            // Periksa seluruh produk,
            // termasuk produk yang diarsipkan.

            const usage = countAllProducts(id);


            if (usage > 0) {
                return {
                    status: "IN_USE",
                    name: category.name,
                    total: usage
                };
            }


            // Hapus kategori.
            db.prepare(`
                DELETE FROM categories
                WHERE id = ?
            `).run(id);


            return {
                status: "SUCCESS",
                name: category.name
            };
        });


        const result = deleteCategory();


        // ----------------------------------
        // Hasil penghapusan
        // ----------------------------------

        if (result.status === "NOT_FOUND") {
            return res.status(404).json({
                success: false,
                message: "Kategori tidak ditemukan."
            });
        }


        if (result.status === "IN_USE") {
            return res.status(409).json({
                success: false,
                message:
                    `Kategori "${result.name}" masih digunakan oleh ` +
                    `${result.total} produk. ` +
                    "Pindahkan produk ke kategori lain terlebih dahulu."
            });
        }


        return res.status(200).json({
            success: true,
            message: "Kategori berhasil dihapus."
        });

    } catch (error) {
        return handleError(
            res,
            error,
            "Gagal menghapus kategori."
        );
    }
});


// ==========================================
// 9. EXPORT ROUTER
// ==========================================

module.exports = router;


// ==================================================
// END CATEGORY ROUTES
// SEDUH SENJA VERSION 5.3 STABLE
// ==================================================
