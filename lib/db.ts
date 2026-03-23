import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import type {
  Quote,
  Surcharge,
  Restriction,
  CompensationRule,
  BillingRule,
} from "@/types";

const DB_PATH = path.join(process.cwd(), "data", "quote.db");

function ensureDb() {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;
  ensureDb();
  _db = new Database(DB_PATH);
  _db.pragma("journal_mode = WAL");
  initSchema(_db);
  return _db;
}

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS quotes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sheet_name TEXT NOT NULL,
      country TEXT NOT NULL,
      transport_type TEXT NOT NULL,
      cargo_type TEXT NOT NULL,
      channel_name TEXT NOT NULL,
      zone TEXT DEFAULT '',
      postcode_min TEXT DEFAULT '',
      postcode_max TEXT DEFAULT '',
      weight_min REAL NOT NULL,
      weight_max REAL,
      unit_price REAL NOT NULL,
      time_estimate TEXT DEFAULT '',
      raw_text TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_quotes_lookup ON quotes(country, transport_type, cargo_type);

    CREATE TABLE IF NOT EXISTS surcharges (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sheet_name TEXT NOT NULL,
      category TEXT NOT NULL,
      item_type TEXT,
      charge_type TEXT NOT NULL,
      charge_value REAL NOT NULL,
      condition TEXT DEFAULT '',
      description TEXT DEFAULT '',
      raw_text TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS restrictions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sheet_name TEXT NOT NULL,
      type TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS compensation_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sheet_name TEXT NOT NULL,
      scenario TEXT NOT NULL,
      standard TEXT NOT NULL,
      rate_per_kg REAL,
      max_compensation REAL,
      notes TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS billing_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sheet_name TEXT NOT NULL,
      rule_type TEXT NOT NULL,
      rule_key TEXT NOT NULL,
      rule_value TEXT NOT NULL,
      raw_text TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS upload_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL,
      sheet_count INTEGER DEFAULT 0,
      uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      status TEXT DEFAULT 'success',
      checksum TEXT DEFAULT ''
    );
  `);
}

// === 查询封装 ===

export function getStatus() {
  const db = getDb();
  const quoteCount = (db.prepare("SELECT COUNT(*) as c FROM quotes").get() as { c: number }).c;
  const surchargeCount = (db.prepare("SELECT COUNT(*) as c FROM surcharges").get() as { c: number }).c;
  const lastUpload = db.prepare("SELECT * FROM upload_history ORDER BY id DESC LIMIT 1").get() as
    | { filename: string; uploaded_at: string; sheet_count: number; status: string }
    | undefined;

  return {
    has_data: quoteCount > 0,
    last_upload: lastUpload?.uploaded_at ?? null,
    last_filename: lastUpload?.filename ?? null,
    channels: quoteCount,
    surcharges: surchargeCount,
  };
}

export function clearAllData() {
  const db = getDb();
  db.exec(`
    DELETE FROM quotes;
    DELETE FROM surcharges;
    DELETE FROM restrictions;
    DELETE FROM compensation_rules;
    DELETE FROM billing_rules;
  `);
}

export function insertQuote(q: Omit<Quote, "id" | "created_at">) {
  const db = getDb();
  db.prepare(`
    INSERT INTO quotes (sheet_name, country, transport_type, cargo_type, channel_name, zone,
      postcode_min, postcode_max, weight_min, weight_max, unit_price, time_estimate, raw_text)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    q.sheet_name, q.country, q.transport_type, q.cargo_type, q.channel_name, q.zone,
    q.postcode_min, q.postcode_max, q.weight_min, q.weight_max, q.unit_price, q.time_estimate, q.raw_text
  );
}

export function insertSurcharge(s: Omit<Surcharge, "id" | "created_at">) {
  const db = getDb();
  db.prepare(`
    INSERT INTO surcharges (sheet_name, category, item_type, charge_type, charge_value, condition, description, raw_text)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    s.sheet_name, s.category, s.item_type, s.charge_type, s.charge_value, s.condition, s.description, s.raw_text
  );
}

export function insertRestriction(r: Omit<Restriction, "id" | "created_at">) {
  const db = getDb();
  db.prepare(`INSERT INTO restrictions (sheet_name, type, content) VALUES (?, ?, ?)`).run(
    r.sheet_name, r.type, r.content
  );
}

export function insertCompensation(c: Omit<CompensationRule, "id" | "created_at">) {
  const db = getDb();
  db.prepare(`
    INSERT INTO compensation_rules (sheet_name, scenario, standard, rate_per_kg, max_compensation, notes)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(c.sheet_name, c.scenario, c.standard, c.rate_per_kg, c.max_compensation, c.notes);
}

export function insertBillingRule(b: Omit<BillingRule, "id" | "created_at">) {
  const db = getDb();
  db.prepare(`INSERT INTO billing_rules (sheet_name, rule_type, rule_key, rule_value, raw_text) VALUES (?, ?, ?, ?, ?)`).run(
    b.sheet_name, b.rule_type, b.rule_key, b.rule_value, b.raw_text
  );
}

export function recordUpload(filename: string, sheetCount: number, checksum: string) {
  const db = getDb();
  db.prepare(`INSERT INTO upload_history (filename, sheet_count, status, checksum) VALUES (?, ?, 'success', ?)`).run(
    filename, sheetCount, checksum
  );
}

export function getQuotesByFilters(country: string, transportType: string, cargoType: string): Quote[] {
  const db = getDb();
  // cargo_type 模糊匹配：用户选"普货"时匹配"纯普货"、"普货"等
  return db.prepare(`
    SELECT * FROM quotes
    WHERE country = ? AND transport_type = ? AND cargo_type LIKE '%' || ? || '%'
    ORDER BY channel_name, weight_min
  `).all(country, transportType, cargoType) as Quote[];
}

export function getAllQuotesForChat(): Quote[] {
  const db = getDb();
  return db.prepare("SELECT * FROM quotes").all() as Quote[];
}

export function getAllSurcharges(): Surcharge[] {
  const db = getDb();
  return db.prepare("SELECT * FROM surcharges").all() as Surcharge[];
}

export function getAllRestrictions(): Restriction[] {
  const db = getDb();
  return db.prepare("SELECT * FROM restrictions").all() as Restriction[];
}

export function getAllCompensationRules(): CompensationRule[] {
  const db = getDb();
  return db.prepare("SELECT * FROM compensation_rules").all() as CompensationRule[];
}

export function getAllBillingRules(): BillingRule[] {
  const db = getDb();
  return db.prepare("SELECT * FROM billing_rules").all() as BillingRule[];
}
