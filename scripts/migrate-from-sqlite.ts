/**
 * scripts/migrate-from-sqlite.ts
 *
 * One-time migration script: reads data from data/quote.db (SQLite) and
 * inserts it into PostgreSQL via Prisma.
 *
 * Usage:
 *   npx tsx scripts/migrate-from-sqlite.ts
 *
 * Prerequisites:
 *   - PostgreSQL database must be up with schema applied (prisma migrate deploy)
 *   - Source SQLite file: data/quote.db
 *   - Remote zones file: data/remote-zones.json
 */

import path from "path";
import { fileURLToPath } from "url";
import Database from "better-sqlite3";
import { PrismaClient } from "@prisma/client";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..");
const SQLITE_PATH = path.join(PROJECT_ROOT, "data", "quote.db");
const REMOTE_ZONES_PATH = path.join(PROJECT_ROOT, "data", "remote-zones.json");

// ── SQLite row types (mirroring actual schema) ─────────────────────────────

interface SQLiteQuote {
  id: number;
  sheet_name: string;
  country: string;
  transport_type: string;
  cargo_type: string;
  channel_name: string;
  zone: string;
  postcode_min: string;
  postcode_max: string;
  weight_min: number;
  weight_max: number | null;
  unit_price: number;
  time_estimate: string;
  raw_text: string;
  upstream: string;
  created_at: string;
}

interface SQLiteSurcharge {
  id: number;
  sheet_name: string;
  category: string;
  item_type: string | null;
  charge_type: string;
  charge_value: number;
  condition: string;
  description: string;
  raw_text: string;
  upstream: string;
  created_at: string;
}

interface SQLiteRestriction {
  id: number;
  sheet_name: string;
  type: string;
  content: string;
  upstream: string;
  created_at: string;
}

interface SQLiteBillingRule {
  id: number;
  sheet_name: string;
  rule_type: string;
  rule_key: string;
  rule_value: string;
  raw_text: string;
  upstream: string;
  created_at: string;
}

interface SQLiteCompensationRule {
  id: number;
  sheet_name: string;
  scenario: string;
  standard: string;
  rate_per_kg: number | null;
  max_compensation: number | null;
  notes: string;
  upstream: string;
  created_at: string;
}

interface SQLiteRule {
  id: number;
  upstream: string;
  category: string;
  source: string;
  type: string;
  item_type: string | null;
  charge_type: string | null;
  charge_value: number | null;
  condition: string;
  description: string;
  content: string;
  standard: string | null;
  rate_per_kg: number | null;
  max_compensation: number | null;
  notes: string | null;
  rule_type: string | null;
  rule_key: string | null;
  rule_value: string | null;
  raw_text: string;
  created_at: string;
  updated_at: string;
}

interface RemoteZoneEntry {
  偏远邮编: string[];
  偏远说明: string;
  偏远附加费: number;
  charge_type: string;
}

// ── Main ──────────────────────────────────────────────────────────────────

async function main() {
  console.log("=".repeat(60));
  console.log("SQLite → PostgreSQL Migration");
  console.log("=".repeat(60));

  // Open SQLite read connection
  console.log(`\n[1] Opening SQLite: ${SQLITE_PATH}`);
  const sqlite = new Database(SQLITE_PATH, { readonly: true });
  sqlite.pragma("journal_mode = WAL");

  // Connect Prisma
  console.log("[2] Connecting to PostgreSQL via Prisma...");
  const prisma = new PrismaClient();

  try {
    // ── Step 1: Read all data from SQLite ─────────────────────────────
    console.log("\n[3] Reading data from SQLite...");

    const quotes = sqlite
      .prepare("SELECT * FROM quotes")
      .all() as SQLiteQuote[];
    console.log(`    quotes: ${quotes.length}`);

    const surcharges = sqlite
      .prepare("SELECT * FROM surcharges")
      .all() as SQLiteSurcharge[];
    console.log(`    surcharges: ${surcharges.length}`);

    const restrictions = sqlite
      .prepare("SELECT * FROM restrictions")
      .all() as SQLiteRestriction[];
    console.log(`    restrictions: ${restrictions.length}`);

    const billingRules = sqlite
      .prepare("SELECT * FROM billing_rules")
      .all() as SQLiteBillingRule[];
    console.log(`    billing_rules: ${billingRules.length}`);

    const compensationRules = sqlite
      .prepare("SELECT * FROM compensation_rules")
      .all() as SQLiteCompensationRule[];
    console.log(`    compensation_rules: ${compensationRules.length}`);

    const rules = sqlite
      .prepare("SELECT * FROM rules")
      .all() as SQLiteRule[];
    console.log(`    rules: ${rules.length}`);

    // Collect all distinct upstreams
    const upstreamSet = new Set<string>();
    quotes.forEach((q) => upstreamSet.add(q.upstream));
    surcharges.forEach((s) => upstreamSet.add(s.upstream));
    restrictions.forEach((r) => upstreamSet.add(r.upstream));
    billingRules.forEach((b) => upstreamSet.add(b.upstream));
    compensationRules.forEach((c) => upstreamSet.add(c.upstream));
    rules.forEach((r) => upstreamSet.add(r.upstream));

    const upstreams = Array.from(upstreamSet).filter(Boolean);
    console.log(`\n    Distinct upstreams: [${upstreams.join(", ")}]`);

    // Read remote zones (Node.js compatible: use fs.readFileSync)
    let remoteZones: Record<string, RemoteZoneEntry> = {};
    try {
      const fs = await import("node:fs");
      const raw = fs.readFileSync(REMOTE_ZONES_PATH, "utf-8");
      remoteZones = JSON.parse(raw) as Record<string, RemoteZoneEntry>;
      console.log(`    remote-zones.json: loaded ${Object.keys(remoteZones).length} countries`);
    } catch {
      console.warn("    remote-zones.json: not found or unreadable, skipping remote surcharge migration");
    }

    sqlite.close();

    // ── Step 2: Create / find Organization "Default" ──────────────────
    console.log("\n[4] Creating/finding organization 'Default'...");
    let org = await prisma.organization.findFirst({ where: { name: "Default" } });
    if (!org) {
      org = await prisma.organization.create({ data: { name: "Default" } });
    }
    console.log(`    Organization id: ${org.id}`);

    // ── Step 3: Create RuleVersion + QuoteVersion for each upstream ───
    console.log("\n[5] Creating RuleVersion + QuoteVersion entries...");

    const ruleVersionMap = new Map<string, string>(); // upstream → ruleVersionId
    const quoteVersionMap = new Map<string, string>(); // upstream → quoteVersionId

    for (const upstream of upstreams) {
      // RuleVersion (version=1, published)
      const rv = await prisma.ruleVersion.create({
        data: {
          organizationId: org.id,
          upstream,
          version: 1,
          status: "published",
          publishedAt: new Date(),
        },
      });
      ruleVersionMap.set(upstream, rv.id);
      console.log(`    RuleVersion [${upstream}] v1: ${rv.id}`);

      // QuoteVersion (version=1, published)
      const qv = await prisma.quoteVersion.create({
        data: {
          organizationId: org.id,
          ruleVersionId: rv.id,
          upstream,
          version: 1,
          status: "published",
          publishedAt: new Date(),
        },
      });
      quoteVersionMap.set(upstream, qv.id);
      console.log(`    QuoteVersion [${upstream}] v1: ${qv.id}`);
    }

    // ── Step 4: Migrate quotes ────────────────────────────────────────
    console.log("\n[6] Migrating quotes...");
    let migratedQuotes = 0;
    const quoteErrors: string[] = [];

    for (const q of quotes) {
      const qvId = quoteVersionMap.get(q.upstream);
      if (!qvId) {
        quoteErrors.push(`No QuoteVersion for upstream: ${q.upstream}`);
        continue;
      }
      try {
        await prisma.quote.create({
          data: {
            organizationId: org.id,
            quoteVersionId: qvId,
            country: q.country,
            transportType: q.transport_type,
            cargoType: q.cargo_type,
            channelName: q.channel_name,
            zone: q.zone || null,
            postcodeMin: q.postcode_min || null,
            postcodeMax: q.postcode_max || null,
            weightMin: q.weight_min,
            weightMax: q.weight_max ?? null,
            unitPrice: q.unit_price,
            timeEstimate: q.time_estimate || null,
            rawText: q.raw_text || null,
          },
        });
        migratedQuotes++;
      } catch (e) {
        quoteErrors.push(`Quote id=${q.id}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    console.log(`    Migrated: ${migratedQuotes}/${quotes.length}`);
    if (quoteErrors.length > 0) {
      console.warn("    Errors:", quoteErrors.slice(0, 5));
    }

    // ── Step 5: Migrate surcharges ────────────────────────────────────
    console.log("\n[7] Migrating surcharges...");
    let migratedSurcharges = 0;
    for (const s of surcharges) {
      const qvId = quoteVersionMap.get(s.upstream);
      if (!qvId) continue;
      await prisma.surcharge.create({
        data: {
          organizationId: org.id,
          quoteVersionId: qvId,
          category: s.category,
          chargeType: s.charge_type || null,
          chargeValue: s.charge_value,
          condition: s.condition || null,
          rawEvidence: s.raw_text || null,
        },
      });
      migratedSurcharges++;
    }
    console.log(`    Migrated: ${migratedSurcharges}/${surcharges.length}`);

    // ── Step 6: Migrate restrictions ─────────────────────────────────
    console.log("\n[8] Migrating restrictions...");
    let migratedRestrictions = 0;
    for (const r of restrictions) {
      const qvId = quoteVersionMap.get(r.upstream);
      if (!qvId) continue;
      await prisma.restriction.create({
        data: {
          organizationId: org.id,
          quoteVersionId: qvId,
          type: r.type,
          content: r.content,
          rawEvidence: null,
        },
      });
      migratedRestrictions++;
    }
    console.log(`    Migrated: ${migratedRestrictions}/${restrictions.length}`);

    // ── Step 7: Migrate billing_rules ─────────────────────────────────
    console.log("\n[9] Migrating billing_rules...");
    let migratedBillingRules = 0;
    for (const b of billingRules) {
      const qvId = quoteVersionMap.get(b.upstream);
      if (!qvId) continue;
      await prisma.billingRule.create({
        data: {
          organizationId: org.id,
          quoteVersionId: qvId,
          ruleType: b.rule_type,
          ruleKey: b.rule_key,
          ruleValue: b.rule_value,
          rawEvidence: b.raw_text || null,
        },
      });
      migratedBillingRules++;
    }
    console.log(`    Migrated: ${migratedBillingRules}/${billingRules.length}`);

    // ── Step 8: Migrate compensation_rules → Rule (category=compensation) ──
    console.log("\n[10] Migrating compensation_rules...");
    let migratedCompensation = 0;
    for (const c of compensationRules) {
      const rvId = ruleVersionMap.get(c.upstream);
      if (!rvId) continue;
      await prisma.rule.create({
        data: {
          organizationId: org.id,
          ruleVersionId: rvId,
          category: "compensation",
          type: c.scenario || null,
          description: c.standard || null,
          chargeType: "per_kg",
          chargeValue: c.rate_per_kg ?? null,
          content: c.notes || null,
          confidence: "medium",
          source: "ai",
          rawEvidence: null,
        },
      });
      migratedCompensation++;
    }
    console.log(`    Migrated: ${migratedCompensation}/${compensationRules.length}`);

    // ── Step 9: Migrate rules (from the unified rules table) ──────────
    console.log("\n[11] Migrating rules...");
    let migratedRules = 0;
    for (const r of rules) {
      const rvId = ruleVersionMap.get(r.upstream);
      if (!rvId) continue;
      await prisma.rule.create({
        data: {
          organizationId: org.id,
          ruleVersionId: rvId,
          category: r.category,
          type: r.type || null,
          itemType: r.item_type ? JSON.parse(r.item_type) : null,
          chargeType: r.charge_type || null,
          chargeValue: r.charge_value ?? null,
          condition: r.condition || null,
          description: r.description || null,
          content: r.content || null,
          priority: 0,
          confidence: (r.source === "manual" ? "high" : "medium") as string,
          source: r.source,
          rawEvidence: r.raw_text || null,
        },
      });
      migratedRules++;
    }
    console.log(`    Migrated: ${migratedRules}/${rules.length}`);

    // ── Step 10: Migrate remote-zones.json → Surcharge (category=remote) ──
    console.log("\n[12] Migrating remote zones...");
    let migratedRemote = 0;

    // Use first upstream as fallback for remote surcharges (no specific upstream)
    const fallbackUpstream = upstreams[0] ?? "默认上游";
    const fallbackQuoteVersionId = quoteVersionMap.get(fallbackUpstream);
    const fallbackRuleVersionId = ruleVersionMap.get(fallbackUpstream);

    if (!fallbackQuoteVersionId || !fallbackRuleVersionId) {
      console.warn("    No quote/rule version found for remote zones — skipping");
    } else {
      for (const [country, zoneData] of Object.entries(remoteZones)) {
        for (const postcodePrefix of zoneData.偏远邮编) {
          await prisma.surcharge.create({
            data: {
              organizationId: org.id,
              quoteVersionId: fallbackQuoteVersionId,
              category: "remote",
              chargeType: zoneData.charge_type || "per_item",
              chargeValue: zoneData.偏远附加费,
              condition: `country=${country}, postcode_prefix=${postcodePrefix}`,
              rawEvidence: zoneData.偏远说明,
            },
          });
          migratedRemote++;
        }
      }
      console.log(`    Migrated: ${migratedRemote} remote surcharge records`);
    }

    // ── Final Stats ───────────────────────────────────────────────────
    console.log("\n" + "=".repeat(60));
    console.log("Migration Complete — Summary");
    console.log("=".repeat(60));
    console.log(`  Organization:  ${org.name} (${org.id})`);
    console.log(`  Upstreams:     ${upstreams.length}`);
    console.log(`  RuleVersions:  ${ruleVersionMap.size}`);
    console.log(`  QuoteVersions: ${quoteVersionMap.size}`);
    console.log(`  Quotes:        ${migratedQuotes} / ${quotes.length}`);
    console.log(`  Surcharges:    ${migratedSurcharges} / ${surcharges.length}`);
    console.log(`  Restrictions:  ${migratedRestrictions} / ${restrictions.length}`);
    console.log(`  BillingRules:  ${migratedBillingRules} / ${billingRules.length}`);
    console.log(`  Compensation:  ${migratedCompensation} / ${compensationRules.length}`);
    console.log(`  Rules:         ${migratedRules} / ${rules.length}`);
    console.log(`  Remote Zones:  ${migratedRemote}`);
    console.log("=".repeat(60));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error("Migration failed:", e);
  process.exit(1);
});
