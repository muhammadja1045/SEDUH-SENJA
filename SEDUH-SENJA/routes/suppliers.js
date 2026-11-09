const express = require("express");
const router = express.Router();
const db = require("../config/database");

// ==========================================
// 1. GET - MENAMPILKAN SEMUA SUPPLIER
// ==========================================

router.get("/", (req, res) => {
    try {
        const suppliers = db.prepare(`
            SELECT
                id,
                name,
                phone,
                address,
                created_at
            FROM suppliers
            ORDER BY name COLLATE NOCASE ASC
        `).all();

        res.json({
            success: true,
            data: suppliers
        });

    } catch (error) {
        console.error("[SUPPLIER GET]", error);

        res.status(500).json({
            success: false,
            message: "Gagal mengambil data supplier."
        });
    }
});

// ==========================================
// 2. POST - TAMBAH SUPPLIER
// ==========================================

router.post("/", (req, res) => {
    try {
        const { name, phone, address } = req.body;

        if (typeof name !== "string" || !name.trim()) {
            return res.status(400).json({
                success: false,
                message: "Nama supplier wajib diisi."
            });
        }

        const result = db.prepare(`
            INSERT INTO suppliers (
                name,
                phone,
                address
            )
            VALUES (?, ?, ?)
        `).run(
            name.trim(),
            typeof phone === "string" && phone.trim()
                ? phone.trim()
                : null,
            typeof address === "string" && address.trim()
                ? address.trim()
                : null
        );

        res.status(201).json({
            success: true,
            message: "Supplier berhasil ditambahkan.",
            id: result.lastInsertRowid
        });

    } catch (error) {
        console.error("[SUPPLIER POST]", error);

        res.status(500).json({
            success: false,
            message: "Gagal menambahkan supplier."
        });
    }
});

// ==========================================
// 3. PUT - EDIT SUPPLIER
// ==========================================

router.put("/:id", (req, res) => {
    try {
        const id = Number(req.params.id);
        const { name, phone, address } = req.body;

        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({
                success: false,
                message: "ID supplier tidak valid."
            });
        }

        if (typeof name !== "string" || !name.trim()) {
            return res.status(400).json({
                success: false,
                message: "Nama supplier wajib diisi."
            });
        }

        const result = db.prepare(`
            UPDATE suppliers
            SET
                name = ?,
                phone = ?,
                address = ?
            WHERE id = ?
        `).run(
            name.trim(),
            typeof phone === "string" && phone.trim()
                ? phone.trim()
                : null,
            typeof address === "string" && address.trim()
                ? address.trim()
                : null,
            id
        );

        if (result.changes === 0) {
            return res.status(404).json({
                success: false,
                message: "Supplier tidak ditemukan."
            });
        }

        res.json({
            success: true,
            message: "Supplier berhasil diperbarui."
        });

    } catch (error) {
        console.error("[SUPPLIER PUT]", error);

        res.status(500).json({
            success: false,
            message: "Gagal memperbarui supplier."
        });
    }
});

// ==========================================
// 4. DELETE - HAPUS SUPPLIER
// ==========================================

router.delete("/:id", (req, res) => {
    try {
        const id = Number(req.params.id);

        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({
                success: false,
                message: "ID supplier tidak valid."
            });
        }

        const result = db.prepare(`
            DELETE FROM suppliers
            WHERE id = ?
        `).run(id);

        if (result.changes === 0) {
            return res.status(404).json({
                success: false,
                message: "Supplier tidak ditemukan."
            });
        }

        res.json({
            success: true,
            message: "Supplier berhasil dihapus."
        });

    } catch (error) {
        console.error("[SUPPLIER DELETE]", error);

        if (error.code === "SQLITE_CONSTRAINT_FOREIGNKEY") {
            return res.status(409).json({
                success: false,
                message: "Supplier tidak dapat dihapus karena masih digunakan dalam transaksi."
            });
        }

        res.status(500).json({
            success: false,
            message: "Gagal menghapus supplier."
        });
    }
});

module.exports = router;