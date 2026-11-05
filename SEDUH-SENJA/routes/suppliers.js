
const express = require("express");
const router = express.Router();
const db = require("../config/database");

// GET: Menampilkan semua supplier
router.get("/", (req, res) => {
    try {
        const suppliers = db.prepare(`
            SELECT id, name, phone, address, created_at
            FROM suppliers
            ORDER BY name ASC
        `).all();

        res.json({
            success: true,
            data: suppliers
        });
    } catch (error) {
        console.error("Get suppliers error:", error);
        res.status(500).json({
            success: false,
            message: "Gagal mengambil data supplier."
        });
    }
});

// POST: Menambahkan supplier
router.post("/", (req, res) => {
    try {
        const { name, phone, address } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({
                success: false,
                message: "Nama supplier wajib diisi."
            });
        }

        const result = db.prepare(`
            INSERT INTO suppliers (name, phone, address)
            VALUES (?, ?, ?)
        `).run(
            name.trim(),
            phone || null,
            address || null
        );

        res.status(201).json({
            success: true,
            message: "Supplier berhasil ditambahkan.",
            id: result.lastInsertRowid
        });

    } catch (error) {
        console.error("Add supplier error:", error);
        res.status(500).json({
            success: false,
            message: "Gagal menambahkan supplier."
        });
    }
});

// PUT: Mengedit supplier
router.put("/:id", (req, res) => {
    try {
        const { name, phone, address } = req.body;
        const id = Number(req.params.id);

        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({
                success: false,
                message: "ID supplier tidak valid."
            });
        }

        if (!name || !name.trim()) {
            return res.status(400).json({
                success: false,
                message: "Nama supplier wajib diisi."
            });
        }

        const result = db.prepare(`
            UPDATE suppliers
            SET name = ?, phone = ?, address = ?
            WHERE id = ?
        `).run(
            name.trim(),
            phone || null,
            address || null,
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
        console.error("Update supplier error:", error);
        res.status(500).json({
            success: false,
            message: "Gagal memperbarui supplier."
        });
    }
});

module.exports = router;
