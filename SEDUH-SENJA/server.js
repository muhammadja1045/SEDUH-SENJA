
require("dotenv").config();

const express = require("express");
const path = require("path");
const fs = require("fs");
const db = require("./config/database");

// ==========================================
// 1. INISIALISASI APLIKASI
// ==========================================

const app = express();
const PORT = process.env.PORT || 3000;

// ==========================================
// 2. MIDDLEWARE
// ==========================================

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Folder public
app.use(express.static(path.join(__dirname, "public")));

// ==========================================
// 3. FUNGSI IMPORT ROUTES
// ==========================================

// Route wajib
function loadRoute(fileName) {
    const routePath = path.join(__dirname, "routes", fileName);

    if (!fs.existsSync(routePath)) {
        throw new Error(`Route tidak ditemukan: routes/${fileName}`);
    }

    return require(routePath);
}

// Route opsional
function loadOptionalRoute(fileName) {
    const routePath = path.join(__dirname, "routes", fileName);

    if (!fs.existsSync(routePath)) {
        console.warn(`[WARNING] routes/${fileName} belum tersedia.`);

        const router = express.Router();

        router.use((req, res) => {
            res.status(501).json({
                success: false,
                message: `Fitur ${fileName} belum tersedia.`
            });
        });

        return router;
    }

    return require(routePath);
}

// ==========================================
// 4. IMPORT ROUTES
// ==========================================

const productRoutes = loadRoute("products.js");
const supplierRoutes = loadRoute("suppliers.js");
const stockInRoutes = loadRoute("stockin.js");
const stockOutRoutes = loadOptionalRoute("stockOut.js");

// ==========================================
// 5. HALAMAN WEBSITE
// ==========================================

// Dashboard
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Inventaris
app.get("/inventory", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "inventory.html"));
});

// Barang masuk
app.get("/stock-in", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "stock-in.html"));
});

// Barang keluar
app.get("/stock-out", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "stock-out.html"));
});

// ==========================================
// 6. API STATUS SERVER
// ==========================================

app.get("/api/status", (req, res) => {
    try {
        db.prepare("SELECT 1").get();

        res.json({
            success: true,
            message: "Server SEDUH SENJA berjalan!",
            application: "SEDUH SENJA Inventory System",
            database: "Connected",
            port: PORT
        });

    } catch (error) {
        console.error("Status error:", error);

        res.status(500).json({
            success: false,
            message: "Database bermasalah.",
            database: "Disconnected"
        });
    }
});

// ==========================================
// 7. API DASHBOARD
// ==========================================

app.get("/api/dashboard", (req, res) => {
    try {

        // Total produk aktif
        const totalProducts = db.prepare(`
            SELECT COUNT(*) AS total
            FROM products
            WHERE is_archived = 0
        `).get().total;

        // Barang masuk hari ini
        const stockIn = db.prepare(`
            SELECT COALESCE(SUM(quantity), 0) AS total
            FROM stock_transactions
            WHERE transaction_type = 'IN'
            AND date(transaction_date, 'localtime') =
                date('now', 'localtime')
        `).get().total;

        // Barang keluar hari ini
        const stockOut = db.prepare(`
            SELECT COALESCE(SUM(quantity), 0) AS total
            FROM stock_transactions
            WHERE transaction_type = 'OUT'
            AND date(transaction_date, 'localtime') =
                date('now', 'localtime')
        `).get().total;

        // Produk stok menipis
        const lowStock = db.prepare(`
            SELECT COUNT(*) AS total
            FROM products
            WHERE is_archived = 0
            AND stock <= minimum_stock
        `).get().total;

        // Produk terbaru
        const products = db.prepare(`
            SELECT
                p.id,
                p.code,
                p.name,
                p.stock,
                p.unit,
                p.minimum_stock,
                c.name AS category
            FROM products p
            LEFT JOIN categories c
                ON p.category_id = c.id
            WHERE p.is_archived = 0
            ORDER BY p.created_at DESC
            LIMIT 10
        `).all();

        // Total stok berdasarkan satuan
        const stockByUnit = db.prepare(`
            SELECT
                unit,
                SUM(stock) AS total
            FROM products
            WHERE is_archived = 0
            GROUP BY unit
            ORDER BY unit
        `).all();

        res.json({
            success: true,
            totalProducts,
            stockIn,
            stockOut,
            lowStock,
            products,
            stockByUnit
        });

    } catch (error) {
        console.error("Dashboard error:", error);

        res.status(500).json({
            success: false,
            message: "Gagal mengambil data dashboard."
        });
    }
});

// ==========================================
// 8. API ROUTES
// ==========================================

// Produk
app.use("/api/products", productRoutes);

// Supplier
app.use("/api/suppliers", supplierRoutes);

// Barang masuk
app.use("/api/stock-in", stockInRoutes);

// Barang keluar
app.use("/api/stock-out", stockOutRoutes);

// ==========================================
// 9. API TIDAK DITEMUKAN
// ==========================================

app.use("/api", (req, res) => {
    res.status(404).json({
        success: false,
        message: "API tidak ditemukan."
    });
});

// ==========================================
// 10. HALAMAN TIDAK DITEMUKAN
// ==========================================

app.use((req, res) => {
    res.status(404).send(`
        <!DOCTYPE html>
        <html lang="id">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport"
                content="width=device-width, initial-scale=1.0">

            <title>404 - SEDUH SENJA</title>

            <style>
                * {
                    box-sizing: border-box;
                }

                body {
                    margin: 0;
                    min-height: 100vh;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: #17120f;
                    color: #f5e6d3;
                    font-family: Arial, sans-serif;
                    text-align: center;
                    padding: 20px;
                }

                .error-container {
                    max-width: 450px;
                }

                h1 {
                    font-size: 90px;
                    margin: 0;
                    color: #b58a62;
                }

                h2 {
                    margin-top: 10px;
                }

                p {
                    color: #b9aaa0;
                }

                a {
                    display: inline-block;
                    margin-top: 15px;
                    padding: 12px 22px;
                    background: #a8794f;
                    color: white;
                    text-decoration: none;
                    border-radius: 8px;
                }

                a:hover {
                    background: #805a3d;
                }
            </style>
        </head>

        <body>
            <div class="error-container">
                <h1>404</h1>
                <h2>Halaman Tidak Ditemukan</h2>
                <p>Maaf, halaman yang kamu cari tidak tersedia.</p>
                <a href="/">Kembali ke Dashboard</a>
            </div>
        </body>
        </html>
    `);
});

// ==========================================
// 11. ERROR HANDLER
// ==========================================

app.use((error, req, res, next) => {
    console.error("Server error:", error);

    if (res.headersSent) {
        return next(error);
    }

    res.status(500).json({
        success: false,
        message: "Terjadi kesalahan pada server."
    });
});

// ==========================================
// 12. MENJALANKAN SERVER
// ==========================================

app.listen(PORT, () => {
    console.log("");
    console.log("======================================");
    console.log("       SEDUH SENJA INVENTORY SYSTEM");
    console.log("======================================");
    console.log("Status       : Server Aktif");
    console.log(`Port         : ${PORT}`);
    console.log(`Website      : http://localhost:${PORT}`);
    console.log(`Dashboard    : http://localhost:${PORT}/`);
    console.log(`Inventory    : http://localhost:${PORT}/inventory`);
    console.log(`Barang Masuk : http://localhost:${PORT}/stock-in`);
    console.log(`Barang Keluar: http://localhost:${PORT}/stock-out`);
    console.log("======================================");
    console.log("");
});
