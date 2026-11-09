
const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

// ==========================================
// 1. KONFIGURASI DATABASE
// ==========================================

const databaseFolder = path.join(__dirname, "..", "database");

if (!fs.existsSync(databaseFolder)) {
    fs.mkdirSync(databaseFolder, { recursive: true });
}

const databasePath = path.join(
    databaseFolder,
    "coffee_stock.db"
);

const db = new Database(databasePath);

// Pengaturan SQLite
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.pragma("busy_timeout = 5000");

// ==========================================
// 2. PEMBUATAN TABEL
// ==========================================

db.exec(`
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'admin',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS suppliers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        phone TEXT,
        address TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        category_id INTEGER,
        unit TEXT NOT NULL,
        initial_stock REAL NOT NULL DEFAULT 0,
        stock REAL NOT NULL DEFAULT 0 CHECK(stock >= 0),
        minimum_stock REAL NOT NULL DEFAULT 0,
        purchase_price REAL NOT NULL DEFAULT 0,
        description TEXT,
        is_archived INTEGER NOT NULL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

        FOREIGN KEY(category_id)
            REFERENCES categories(id)
    );

    CREATE TABLE IF NOT EXISTS stock_transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        transaction_code TEXT NOT NULL UNIQUE,
        product_id INTEGER NOT NULL,

        transaction_type TEXT NOT NULL
            CHECK(transaction_type IN ('IN', 'OUT', 'OPENING')),

        quantity REAL NOT NULL CHECK(quantity > 0),
        unit TEXT NOT NULL,
        supplier_id INTEGER,
        price REAL DEFAULT 0,
        purpose TEXT,
        notes TEXT,
        transaction_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        user_id INTEGER,

        FOREIGN KEY(product_id)
            REFERENCES products(id),

        FOREIGN KEY(supplier_id)
            REFERENCES suppliers(id),

        FOREIGN KEY(user_id)
            REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS activity_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        action TEXT NOT NULL,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

        FOREIGN KEY(user_id)
            REFERENCES users(id)
    );
`);

// ==========================================
// 3. MIGRASI DATABASE LAMA
// ==========================================

// Memeriksa duplikasi kategori sebelum membuat
// unique index yang tidak membedakan kapitalisasi.

const duplicateCategories = db.prepare(`
    SELECT
        LOWER(TRIM(name)) AS normalized_name,
        COUNT(*) AS total
    FROM categories
    GROUP BY LOWER(TRIM(name))
    HAVING COUNT(*) > 1
`).all();

if (duplicateCategories.length > 0) {
    console.error(
        "Ditemukan nama kategori duplikat:",
        duplicateCategories
    );

    throw new Error(
        "Migrasi database dihentikan: terdapat kategori " +
        "dengan nama sama. Periksa dan perbaiki duplikasi " +
        "sebelum menjalankan server."
    );
}

// Unique index kategori.
// Contoh: Kopi, KOPI, dan kopi dianggap sama.

db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS
    idx_categories_name_normalized
    ON categories(LOWER(TRIM(name)));
`);

// ==========================================
// 4. VALIDASI PRODUK
// ==========================================

// Trigger diperlukan karena tabel lama mungkin
// belum memiliki CHECK constraint terbaru.

db.exec(`
    CREATE TRIGGER IF NOT EXISTS
    validate_products_before_insert

    BEFORE INSERT ON products

    FOR EACH ROW

    WHEN
        NEW.initial_stock < 0
        OR NEW.stock < 0
        OR NEW.minimum_stock < 0
        OR NEW.purchase_price < 0
        OR NEW.is_archived NOT IN (0, 1)

    BEGIN
        SELECT RAISE(
            ABORT,
            'Data produk tidak valid: nilai stok, harga, atau status arsip.'
        );
    END;


    CREATE TRIGGER IF NOT EXISTS
    validate_products_before_update

    BEFORE UPDATE ON products

    FOR EACH ROW

    WHEN
        NEW.initial_stock < 0
        OR NEW.stock < 0
        OR NEW.minimum_stock < 0
        OR NEW.purchase_price < 0
        OR NEW.is_archived NOT IN (0, 1)

    BEGIN
        SELECT RAISE(
            ABORT,
            'Data produk tidak valid: nilai stok, harga, atau status arsip.'
        );
    END;
`);

// ==========================================
// 5. INDEX DATABASE
// ==========================================

db.exec(`
    -- Pencarian produk
    CREATE INDEX IF NOT EXISTS
    idx_products_name
    ON products(name);

    CREATE INDEX IF NOT EXISTS
    idx_products_category
    ON products(category_id);

    CREATE INDEX IF NOT EXISTS
    idx_products_archive
    ON products(is_archived);

    CREATE INDEX IF NOT EXISTS
    idx_products_created
    ON products(created_at);

    -- Riwayat transaksi
    CREATE INDEX IF NOT EXISTS
    idx_transactions_product
    ON stock_transactions(product_id);

    CREATE INDEX IF NOT EXISTS
    idx_transactions_date
    ON stock_transactions(transaction_date);

    CREATE INDEX IF NOT EXISTS
    idx_transactions_type
    ON stock_transactions(transaction_type);

    CREATE INDEX IF NOT EXISTS
    idx_transactions_product_date
    ON stock_transactions(product_id, transaction_date);

    -- Aktivitas pengguna
    CREATE INDEX IF NOT EXISTS
    idx_activity_logs_user
    ON activity_logs(user_id);

    CREATE INDEX IF NOT EXISTS
    idx_activity_logs_date
    ON activity_logs(created_at);
`);

// ==========================================
// 6. INFORMASI DATABASE
// ==========================================

console.log("------------------------------------------");
console.log(" SEDUH SENJA - COFFEE INVENTORY SYSTEM");
console.log("------------------------------------------");
console.log("Database berhasil disiapkan.");
console.log("Database :", databasePath);
console.log("Mode     : WAL");
console.log("Foreign Keys : ON");
console.log("Validation   : ON");
console.log("Migration    : READY");
console.log("------------------------------------------");

// ==========================================
// 7. EXPORT DATABASE
// ==========================================

module.exports = db;

// ==========================================
// END DATABASE CONFIGURATION
// SEDUH SENJA VERSION 5.2 STABLE
// ==========================================
