const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const DB_PATH = path.resolve(process.env.DB_PATH || './data/heche.db');

// 確保資料目錄存在
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// ──────────────────────────────────────────────────
// sql.js → better-sqlite3 相容層
// 讓所有 routes 可以用 db.prepare(sql).get(...) / .all(...) / .run(...)
// ──────────────────────────────────────────────────
let rawDb = null;

function saveToFile() {
  if (!rawDb) return;
  const data = rawDb.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

// 自動存檔間隔（5秒），避免每次寫入都觸發 I/O
let saveTimer = null;
function scheduleSave() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveToFile();
    saveTimer = null;
  }, 5000);
}

// 清理：程式結束前儲存
process.on('exit', saveToFile);
process.on('SIGINT', () => { saveToFile(); process.exit(0); });
process.on('SIGTERM', () => { saveToFile(); process.exit(0); });

class PreparedStatement {
  constructor(database, sql) {
    this._db = database;
    this._sql = sql;
  }

  get(...params) {
    const flat = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
    try {
      const stmt = this._db.prepare(this._sql);
      stmt.bind(flat.length ? flat : undefined);
      if (stmt.step()) {
        const row = stmt.getAsObject();
        stmt.free();
        return row;
      }
      stmt.free();
      return undefined;
    } catch (e) {
      throw new Error(`SQL get error: ${e.message}\nSQL: ${this._sql}`);
    }
  }

  all(...params) {
    const flat = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
    try {
      const results = [];
      const stmt = this._db.prepare(this._sql);
      stmt.bind(flat.length ? flat : undefined);
      while (stmt.step()) {
        results.push(stmt.getAsObject());
      }
      stmt.free();
      return results;
    } catch (e) {
      throw new Error(`SQL all error: ${e.message}\nSQL: ${this._sql}`);
    }
  }

  run(...params) {
    const flat = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
    try {
      this._db.run(this._sql, flat.length ? flat : undefined);
      const changes = this._db.getRowsModified();
      const info = { changes, lastInsertRowid: 0 };
      // 取得 last insert id
      try {
        const r = this._db.exec('SELECT last_insert_rowid() as id');
        if (r.length && r[0].values.length) {
          info.lastInsertRowid = r[0].values[0][0];
        }
      } catch (_) {}
      scheduleSave();
      return info;
    } catch (e) {
      throw new Error(`SQL run error: ${e.message}\nSQL: ${this._sql}`);
    }
  }
}

// db proxy — 模擬 better-sqlite3 介面
const db = {
  prepare(sql) {
    return new PreparedStatement(rawDb, sql);
  },
  exec(sql) {
    rawDb.run(sql);
    scheduleSave();
  },
  pragma(str) {
    try { rawDb.run(`PRAGMA ${str}`); } catch (_) {}
  },
};

async function initDatabase() {
  const SQL = await initSqlJs();

  // 載入或建立資料庫檔案
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    rawDb = new SQL.Database(fileBuffer);
    console.log('已載入既有資料庫');
  } else {
    rawDb = new SQL.Database();
    console.log('已建立新資料庫');
  }

  // 啟用外鍵
  rawDb.run('PRAGMA foreign_keys = ON');

  // 建立資料表
  rawDb.run(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      slug TEXT NOT NULL UNIQUE,
      description TEXT,
      sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    )
  `);
  rawDb.run(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT,
      specs TEXT,
      is_featured INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      updated_at TEXT DEFAULT (datetime('now','localtime'))
    )
  `);
  rawDb.run(`
    CREATE TABLE IF NOT EXISTS product_images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      filename TEXT NOT NULL,
      alt_text TEXT,
      is_primary INTEGER DEFAULT 0,
      sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    )
  `);
  rawDb.run(`
    CREATE TABLE IF NOT EXISTS contacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT,
      subject TEXT NOT NULL,
      message TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      ip_address TEXT,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    )
  `);
  rawDb.run(`
    CREATE TABLE IF NOT EXISTS admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      last_login TEXT,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    )
  `);

  // 索引
  rawDb.run('CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id)');
  rawDb.run('CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active)');
  rawDb.run('CREATE INDEX IF NOT EXISTS idx_images_product ON product_images(product_id)');
  rawDb.run('CREATE INDEX IF NOT EXISTS idx_contacts_status ON contacts(status)');

  // 初始化預設分類
  const catResult = rawDb.exec('SELECT COUNT(*) as c FROM categories');
  const catCount = catResult[0].values[0][0];
  if (catCount === 0) {
    [
      ['淋浴拉門', 'shower-doors', '各式淋浴拉門、無框、半框設計', 1],
      ['鏡浴櫃', 'mirror-cabinets', '鏡面浴室收納櫃、多功能設計', 2],
      ['智能鏡', 'smart-mirrors', '智能防霧鏡、LED照明、觸控功能', 3],
      ['五金配件', 'hardware', '淋浴房五金、毛巾架、皂架等配件', 4],
    ].forEach(([name, slug, desc, order]) => {
      rawDb.run(
        'INSERT INTO categories (name, slug, description, sort_order) VALUES (?, ?, ?, ?)',
        [name, slug, desc, order]
      );
    });
    console.log('已初始化預設產品分類');
  }

  // 初始化管理員帳號
  const adminResult = rawDb.exec('SELECT COUNT(*) as c FROM admins');
  const adminCount = adminResult[0].values[0][0];
  if (adminCount === 0) {
    const username = process.env.ADMIN_USERNAME || 'admin';
    const password = process.env.ADMIN_PASSWORD || 'ChangeMe@2024!';
    const hash = bcrypt.hashSync(password, 12);
    rawDb.run('INSERT INTO admins (username, password_hash) VALUES (?, ?)', [username, hash]);
    console.log(`已建立管理員帳號：${username}`);
  }

  saveToFile();
  console.log('資料庫初始化完成');
}

module.exports = { db, initDatabase };
