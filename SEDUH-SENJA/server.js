
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

app.disable("x-powered-by");

// ==========================================
// 2. MIDDLEWARE
// ==========================================

app.use(express.json({ limit: "1mb" }));

app.use(express.urlencoded({
    extended: true,
    limit: "1mb"
}));

// Folder public
const publicFolder = path.join(__dirname, "public");

app.use(express.static(publicFolder));

// ==========================================
// 3. FUNGSI IMPORT ROUTES
// ==========================================

// Route wajib
function loadRoute(fileNames) {
    const names = Array.isArray(fileNames)
        ? fileNames
        : [fileNames];

    for (const fileName of names) {
        const routePath = path.join(
            __dirname,
            "routes",
            fileName
        );

        if (fs.existsSync(routePath)) {
            console.log(`[ROUTE] Loaded: ${fileName}`);
            return require(routePath);
        }
    }

    throw new Error(
        `Route tidak ditemukan: ${names.join(" / ")}`
    );
}

// Route opsional
function loadOptionalRoute(fileName) {
    const routePath = path.join(
        __dirname,
        "routes",
        fileName
    );

    if (!fs.existsSync(routePath)) {
        console.warn(
            `[WARNING] routes/${fileName} belum tersedia.`
        );

        const router = express.Router();

        router.use((req, res) => {
            res.status(501).json({
                success: false,
                message: `Fitur ${fileName} belum tersedia.`
            });
        });

        return router;
    }

    console.log(`[ROUTE] Loaded: ${fileName}`);

    return require(routePath);
}

// ==========================================
// 4. IMPORT ROUTES
// ==========================================

const productRoutes = loadRoute("products.js");

const categoryRoutes = loadRoute("categories.js");

const supplierRoutes = loadRoute([
    "supplier.js",
    "suppliers.js"
]);

const stockInRoutes = loadRoute("stockin.js");

const stockOutRoutes = loadOptionalRoute(
    "stockOut.js"
);

const reportsRoutes = loadRoute("reports.js");

// ==========================================
// 5. HELPER HALAMAN WEBSITE
// ==========================================

function sendPage(fileName) {
    return (req, res, next) => {
        const filePath = path.join(
            publicFolder,
            fileName
        );

        if (!fs.existsSync(filePath)) {
            console.error(
                `[PAGE ERROR] File tidak ditemukan: ${fileName}`
            );

            return res.status(404).send(`
                <h2>Halaman tidak ditemukan</h2>
                <p>File ${fileName} tidak tersedia di folder public.</p>
                <a href="/">Kembali ke Dashboard</a>
            `);
        }

        res.sendFile(filePath, (error) => {
            if (error && !res.headersSent) {
                next(error);
            }
        });
    };
}

// ==========================================
// 6. HALAMAN WEBSITE
// ==========================================

// DASHBOARD
app.get("/", sendPage("index.html"));

// INVENTARIS
app.get("/inventory", sendPage("inventory.html"));

// BARANG MASUK
app.get("/stock-in", sendPage("stock-in.html"));

// BARANG KELUAR
app.get("/stock-out", sendPage("stock-out.html"));

// SUPPLIER
app.get("/suppliers", sendPage("supplier.html"));

// LAPORAN
app.get("/reports", sendPage("reports.html"));

// PENGATURAN
app.get("/settings", sendPage("settings.html"));

// ==========================================
// 7. API STATUS SERVER
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
        console.error("[STATUS ERROR]", error);

        res.status(500).json({
            success: false,
            message: "Database bermasalah.",
            database: "Disconnected"
        });
    }
});

// ==========================================
// 8. API DASHBOARD
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
        console.error("[DASHBOARD ERROR]", error);

        res.status(500).json({
            success: false,
            message: "Gagal mengambil data dashboard."
        });
    }
});

// ==========================================
// 9. API ROUTES
// ==========================================

// PRODUK
app.use("/api/products", productRoutes);

// KATEGORI
app.use("/api/categories", categoryRoutes);

// SUPPLIER
app.use("/api/suppliers", supplierRoutes);

// BARANG MASUK
app.use("/api/stock-in", stockInRoutes);

// BARANG KELUAR
app.use("/api/stock-out", stockOutRoutes);

// LAPORAN INVENTARIS
app.use("/api/reports", reportsRoutes);

// ==========================================
// 10. API TIDAK DITEMUKAN
// ==========================================

app.use("/api", (req, res) => {
    res.status(404).json({
        success: false,
        message: "API tidak ditemukan."
    });
});

// ==========================================
// 11. ERROR HANDLER
// ==========================================

app.use((error, req, res, next) => {
    console.error("[SERVER ERROR]", error);

    if (res.headersSent) {
        return next(error);
    }

    res.status(500).json({
        success: false,
        message: "Terjadi kesalahan pada server."
    });
});

// ==========================================
// 12. HALAMAN TIDAK DITEMUKAN
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
                <p>
                    Maaf, halaman yang kamu cari
                    tidak tersedia.
                </p>

                <a href="/">Kembali ke Dashboard</a>
            </div>
        </body>
        </html>
    `);
});

// ==========================================
// 13. MENJALANKAN SERVER
// ==========================================

app.listen(PORT, () => {

    console.log("");

    console.log("======================================");
    console.log("       SEDUH SENJA INVENTORY SYSTEM");
    console.log("======================================");

    console.log("Status       : Server Aktif");
    console.log(`Port         : ${PORT}`);

    console.log("");
    console.log("HALAMAN WEBSITE");

    console.log(`Dashboard    : http://localhost:${PORT}/`);
    console.log(`Inventory    : http://localhost:${PORT}/inventory`);
    console.log(`Barang Masuk : http://localhost:${PORT}/stock-in`);
    console.log(`Barang Keluar: http://localhost:${PORT}/stock-out`);
    console.log(`Supplier     : http://localhost:${PORT}/suppliers`);
    console.log(`Laporan      : http://localhost:${PORT}/reports`);
    console.log(`Pengaturan   : http://localhost:${PORT}/settings`);

    console.log("");
    console.log("API");

    console.log(`Status       : http://localhost:${PORT}/api/status`);
    console.log(`Products     : http://localhost:${PORT}/api/products`);
    console.log(`Categories   : http://localhost:${PORT}/api/categories`);
    console.log(`Suppliers    : http://localhost:${PORT}/api/suppliers`);
    console.log(`Reports      : http://localhost:${PORT}/api/reports`);

    console.log("======================================");
    console.log("");
});
