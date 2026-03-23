import { describe, it, expect } from "vitest";
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const TEST_DB = path.join("/tmp", "test_quote.db");

function getTestDb() {
  if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
  const db = new Database(TEST_DB);
  db.pragma("journal_mode = WAL");
  return db;
}

describe("DB helpers", () => {
  it("can insert and query a quote", () => {
    const db = getTestDb();
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
    `);

    db.prepare(`
      INSERT INTO quotes (sheet_name, country, transport_type, cargo_type, channel_name,
        zone, postcode_min, postcode_max, weight_min, weight_max, unit_price, time_estimate, raw_text)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      "Sheet1", "美国", "海运", "普货", "美国海运快船-纯普货",
      "美国西岸", "80000", "99999", 12, 50, 13.5, "18-25天", ""
    );

    const rows = db.prepare("SELECT * FROM quotes WHERE country = ?").all("美国") as any[];
    expect(rows.length).toBe(1);
    expect(rows[0].unit_price).toBe(13.5);
    expect(rows[0].weight_min).toBe(12);
    expect(rows[0].weight_max).toBe(50);
    db.close();
  });

  it("handles NULL weight_max for unlimited weight", () => {
    const db = getTestDb();
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
    `);

    db.prepare(`
      INSERT INTO quotes (sheet_name, country, transport_type, cargo_type, channel_name,
        zone, postcode_min, postcode_max, weight_min, weight_max, unit_price, time_estimate, raw_text)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      "Sheet1", "美国", "海运", "普货", "美国海运快船-纯普货",
      "美国西岸", "80000", "99999", 51, null, 11.1, "18-25天", ""
    );

    const rows = db.prepare("SELECT * FROM quotes WHERE weight_max IS NULL").all() as any[];
    expect(rows.length).toBe(1);
    expect(rows[0].unit_price).toBe(11.1);
    db.close();
  });
});
