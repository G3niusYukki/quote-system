import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import type {
  Quote,
  Surcharge,
  Restriction,
  CompensationRule,
  BillingRule,
  RuleRecord,
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
      upstream TEXT NOT NULL DEFAULT '默认上游',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_quotes_lookup ON quotes(country, transport_type, cargo_type, upstream);

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
      upstream TEXT NOT NULL DEFAULT '默认上游',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS restrictions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sheet_name TEXT NOT NULL,
      type TEXT NOT NULL,
      content TEXT NOT NULL,
      upstream TEXT NOT NULL DEFAULT '默认上游',
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
      upstream TEXT NOT NULL DEFAULT '默认上游',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS billing_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sheet_name TEXT NOT NULL,
      rule_type TEXT NOT NULL,
      rule_key TEXT NOT NULL,
      rule_value TEXT NOT NULL,
      raw_text TEXT DEFAULT '',
      upstream TEXT NOT NULL DEFAULT '默认上游',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS upload_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL,
      upstream TEXT NOT NULL,
      sheet_count INTEGER DEFAULT 0,
      uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      status TEXT DEFAULT 'success',
      checksum TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      upstream TEXT NOT NULL,
      category TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'ai',
      type TEXT NOT NULL DEFAULT '',
      item_type TEXT,
      charge_type TEXT,
      charge_value REAL,
      condition TEXT DEFAULT '',
      description TEXT DEFAULT '',
      content TEXT DEFAULT '',
      standard TEXT,
      rate_per_kg REAL,
      max_compensation REAL,
      notes TEXT,
      rule_type TEXT,
      rule_key TEXT,
      rule_value TEXT,
      raw_text TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_rules_lookup ON rules(upstream, category, source);

    CREATE TABLE IF NOT EXISTS query_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      country TEXT NOT NULL,
      transport_type TEXT NOT NULL,
      cargo_type TEXT NOT NULL,
      actual_weight REAL NOT NULL,
      length INTEGER,
      width INTEGER,
      height INTEGER,
      volume_weight REAL,
      chargeable_weight REAL,
      item_types TEXT DEFAULT '',
      is_private_address INTEGER DEFAULT 0,
      postcode TEXT DEFAULT '',
      upstream TEXT DEFAULT '',
      result_json TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 兼容旧数据库：若无 upstream 列则添加
  try {
    db.exec(`ALTER TABLE quotes ADD COLUMN upstream TEXT NOT NULL DEFAULT '默认上游'`);
  } catch {}
  try {
    db.exec(`ALTER TABLE surcharges ADD COLUMN upstream TEXT NOT NULL DEFAULT '默认上游'`);
  } catch {}
  try {
    db.exec(`ALTER TABLE restrictions ADD COLUMN upstream TEXT NOT NULL DEFAULT '默认上游'`);
  } catch {}
  try {
    db.exec(`ALTER TABLE compensation_rules ADD COLUMN upstream TEXT NOT NULL DEFAULT '默认上游'`);
  } catch {}
  try {
    db.exec(`ALTER TABLE billing_rules ADD COLUMN upstream TEXT NOT NULL DEFAULT '默认上游'`);
  } catch {}
  try {
    db.exec(`ALTER TABLE upload_history ADD COLUMN upstream TEXT NOT NULL DEFAULT '默认上游'`);
  } catch {}
  try {
    db.exec(`ALTER TABLE upload_history ADD COLUMN raw_excel_text TEXT`);
  } catch {}
}

// === 查询封装 ===

export function getStatus() {
  const db = getDb();
  const quoteCount = (db.prepare("SELECT COUNT(*) as c FROM quotes").get() as { c: number }).c;
  const surchargeCount = (db.prepare("SELECT COUNT(*) as c FROM surcharges").get() as { c: number }).c;
  const upstreams = (db.prepare("SELECT DISTINCT upstream FROM quotes ORDER BY upstream").all() as { upstream: string }[]).map(r => r.upstream);
  const lastUpload = db.prepare("SELECT * FROM upload_history ORDER BY id DESC LIMIT 1").get() as
    | { filename: string; upstream: string; uploaded_at: string; sheet_count: number; status: string }
    | undefined;

  return {
    has_data: quoteCount > 0,
    last_upload: lastUpload?.uploaded_at ?? null,
    last_filename: lastUpload?.filename ?? null,
    last_upstream: lastUpload?.upstream ?? null,
    channels: quoteCount,
    surcharges: surchargeCount,
    upstreams,
  };
}

export function getAllUpstreams(): string[] {
  const db = getDb();
  return (db.prepare("SELECT DISTINCT upstream FROM quotes ORDER BY upstream").all() as { upstream: string }[]).map(r => r.upstream);
}

export function clearUpstreamData(upstream: string) {
  const db = getDb();
  db.prepare("DELETE FROM quotes WHERE upstream = ?").run(upstream);
  db.prepare("DELETE FROM surcharges WHERE upstream = ?").run(upstream);
  db.prepare("DELETE FROM restrictions WHERE upstream = ?").run(upstream);
  db.prepare("DELETE FROM compensation_rules WHERE upstream = ?").run(upstream);
  db.prepare("DELETE FROM billing_rules WHERE upstream = ?").run(upstream);
  db.prepare("DELETE FROM rules WHERE upstream = ?").run(upstream);
}

export function clearAllData() {
  const db = getDb();
  db.prepare("DELETE FROM quotes").run();
  db.prepare("DELETE FROM surcharges").run();
  db.prepare("DELETE FROM restrictions").run();
  db.prepare("DELETE FROM compensation_rules").run();
  db.prepare("DELETE FROM billing_rules").run();
}

export function insertQuote(q: Omit<Quote, "id" | "created_at">) {
  const db = getDb();
  db.prepare(`
    INSERT INTO quotes (sheet_name, country, transport_type, cargo_type, channel_name, zone,
      postcode_min, postcode_max, weight_min, weight_max, unit_price, time_estimate, raw_text, upstream)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    q.sheet_name, q.country, q.transport_type, q.cargo_type, q.channel_name, q.zone,
    q.postcode_min, q.postcode_max, q.weight_min, q.weight_max, q.unit_price, q.time_estimate, q.raw_text,
    q.upstream
  );
}

export function insertSurcharge(s: Omit<Surcharge, "id" | "created_at">) {
  const db = getDb();
  db.prepare(`
    INSERT INTO surcharges (sheet_name, category, item_type, charge_type, charge_value, condition, description, raw_text, upstream)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    s.sheet_name, s.category, s.item_type, s.charge_type, s.charge_value, s.condition, s.description, s.raw_text,
    s.upstream
  );
}

export function insertRestriction(r: Omit<Restriction, "id" | "created_at">) {
  const db = getDb();
  db.prepare(`INSERT INTO restrictions (sheet_name, type, content, upstream) VALUES (?, ?, ?, ?)`).run(
    r.sheet_name, r.type, r.content, r.upstream
  );
}

export function insertCompensation(c: Omit<CompensationRule, "id" | "created_at">) {
  const db = getDb();
  db.prepare(`
    INSERT INTO compensation_rules (sheet_name, scenario, standard, rate_per_kg, max_compensation, notes, upstream)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(c.sheet_name, c.scenario, c.standard, c.rate_per_kg, c.max_compensation, c.notes, c.upstream);
}

export function insertBillingRule(b: Omit<BillingRule, "id" | "created_at">) {
  const db = getDb();
  db.prepare(`INSERT INTO billing_rules (sheet_name, rule_type, rule_key, rule_value, raw_text, upstream) VALUES (?, ?, ?, ?, ?, ?)`).run(
    b.sheet_name, b.rule_type, b.rule_key, b.rule_value, b.raw_text, b.upstream
  );
}

export function recordUpload(filename: string, sheetCount: number, checksum: string, upstream: string, rawExcelText?: string) {
  const db = getDb();
  db.prepare(`INSERT INTO upload_history (filename, sheet_count, status, checksum, upstream, raw_excel_text) VALUES (?, ?, 'success', ?, ?, ?)`).run(
    filename, sheetCount, checksum, upstream, rawExcelText ?? null
  );
}

export function getQuotesByFilters(country: string, transportType: string, cargoType: string, upstream?: string): Quote[] {
  const db = getDb();
  if (upstream) {
    return db.prepare(`
      SELECT * FROM quotes
      WHERE country = ? AND transport_type = ? AND cargo_type LIKE '%' || ? || '%' AND upstream = ?
      ORDER BY channel_name, weight_min
    `).all(country, transportType, cargoType, upstream) as Quote[];
  }
  return db.prepare(`
    SELECT * FROM quotes
    WHERE country = ? AND transport_type = ? AND cargo_type LIKE '%' || ? || '%'
    ORDER BY channel_name, upstream, weight_min
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

// === 统一规则表 (rules) ===

export function getRules(upstream: string, category?: string): RuleRecord[] {
  const db = getDb();
  if (category) {
    return db.prepare(
      `SELECT * FROM rules WHERE upstream = ? AND category = ? ORDER BY source, id`
    ).all(upstream, category) as RuleRecord[];
  }
  return db.prepare(
    `SELECT * FROM rules WHERE upstream = ? ORDER BY category, source, id`
  ).all(upstream) as RuleRecord[];
}

export function insertRule(r: Omit<RuleRecord, "id" | "created_at" | "updated_at">) {
  const db = getDb();
  db.prepare(`
    INSERT INTO rules (upstream, category, source, type, item_type, charge_type, charge_value,
      condition, description, content, standard, rate_per_kg, max_compensation, notes,
      rule_type, rule_key, rule_value, raw_text)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(r.upstream, r.category, r.source, r.type, r.item_type ?? null, r.charge_type ?? null,
    r.charge_value ?? null, r.condition, r.description, r.content, r.standard ?? null,
    r.rate_per_kg ?? null, r.max_compensation ?? null, r.notes ?? null,
    r.rule_type ?? null, r.rule_key ?? null, r.rule_value ?? null, r.raw_text);
}

export function updateRule(id: number, r: Partial<RuleRecord>) {
  const db = getDb();
  const fields = Object.keys(r).filter(k => k !== "id" && k !== "created_at");
  if (fields.length === 0) return;
  const sql = `UPDATE rules SET ${fields.map(f => `${f} = ?`).join(", ")}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
  db.prepare(sql).run(...fields.map(f => (r as any)[f]), id);
}

export function deleteRule(id: number) {
  const db = getDb();
  db.prepare(`DELETE FROM rules WHERE id = ?`).run(id);
}

export function clearAIRulesForUpstream(upstream: string) {
  const db = getDb();
  db.prepare(`DELETE FROM rules WHERE upstream = ? AND source = 'ai'`).run(upstream);
}

export function getLatestRawExcelText(upstream: string): string | null {
  const db = getDb();
  const row = db.prepare(
    `SELECT raw_excel_text FROM upload_history WHERE upstream = ? AND raw_excel_text IS NOT NULL AND raw_excel_text != '' ORDER BY id DESC LIMIT 1`
  ).get(upstream) as { raw_excel_text: string } | undefined;
  return row?.raw_excel_text ?? null;
}

// === 查询历史 ===

export interface QueryHistoryRecord {
  id: number;
  country: string;
  transport_type: string;
  cargo_type: string;
  actual_weight: number;
  length: number | null;
  width: number | null;
  height: number | null;
  volume_weight: number | null;
  chargeable_weight: number;
  item_types: string;
  is_private_address: number;
  postcode: string;
  upstream: string;
  result_json: string;
  created_at: string;
}

export function recordQuery(params: {
  country: string;
  transport_type: string;
  cargo_type: string;
  actual_weight: number;
  length: number;
  width: number;
  height: number;
  volume_weight: number;
  chargeable_weight: number;
  item_types: string[];
  is_private_address: boolean;
  postcode: string;
  upstream: string;
  result: unknown;
}) {
  const db = getDb();
  db.prepare(`
    INSERT INTO query_history (country, transport_type, cargo_type, actual_weight,
      length, width, height, volume_weight, chargeable_weight,
      item_types, is_private_address, postcode, upstream, result_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    params.country, params.transport_type, params.cargo_type, params.actual_weight,
    params.length, params.width, params.height, params.volume_weight, params.chargeable_weight,
    params.item_types.join(","), params.is_private_address ? 1 : 0,
    params.postcode, params.upstream, JSON.stringify(params.result)
  );
}

export function getQueryHistory(limit = 50): QueryHistoryRecord[] {
  const db = getDb();
  return db.prepare(
    `SELECT * FROM query_history ORDER BY id DESC LIMIT ?`
  ).all(limit) as QueryHistoryRecord[];
}

export function getQueryHistoryById(id: number): QueryHistoryRecord | null {
  const db = getDb();
  return db.prepare(`SELECT * FROM query_history WHERE id = ?`).get(id) as QueryHistoryRecord | null;
}
