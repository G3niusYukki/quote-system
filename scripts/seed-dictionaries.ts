/**
 * scripts/seed-dictionaries.ts
 *
 * Standalone seed script for MappingDictionary preset data.
 * Run with: npx tsx scripts/seed-dictionaries.ts
 *
 * Prerequisites:
 *   1. Set DATABASE_URL in .env or environment
 *   2. Ensure organizationId is provided via ORG_ID env var
 *      (or the script will prompt for it)
 *
 * The script is idempotent — existing entries are skipped.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const SEED_DATA: Array<{
  category: string;
  normalizedValue: string;
  aliases: string[];
}> = [
  // country
  { category: "country", normalizedValue: "美国", aliases: ["美国", "USA", "United States"] },
  { category: "country", normalizedValue: "加拿大", aliases: ["加拿大", "Canada"] },
  { category: "country", normalizedValue: "澳大利亚", aliases: ["澳大利亚", "Australia"] },

  // transport_type
  { category: "transport_type", normalizedValue: "海运", aliases: ["海运", "Sea Freight"] },
  { category: "transport_type", normalizedValue: "空运", aliases: ["空运", "Air Freight"] },
  { category: "transport_type", normalizedValue: "铁运", aliases: ["铁运", "Rail Freight", "铁路"] },
  { category: "transport_type", normalizedValue: "卡航", aliases: ["卡航", "Truck Freight", "卡车"] },

  // cargo_type
  { category: "cargo_type", normalizedValue: "普货", aliases: ["普货", "General Cargo"] },
  { category: "cargo_type", normalizedValue: "敏感", aliases: ["敏感", "Sensitive"] },
  { category: "cargo_type", normalizedValue: "特货", aliases: ["特货", "Special Cargo"] },
  { category: "cargo_type", normalizedValue: "纯普货", aliases: ["纯普货", "Pure General"] },
  { category: "cargo_type", normalizedValue: "普敏", aliases: ["普敏", "General Sensitive", "敏感普货"] },

  // unit
  { category: "unit", normalizedValue: "kg", aliases: ["kg", "公斤", "千克", "kilogram"] },
  { category: "unit", normalizedValue: "件", aliases: ["件", "pcs", "piece", "count"] },
  { category: "unit", normalizedValue: "CBM", aliases: ["CBM", "立方米", "体积"] },
];

async function main() {
  const orgId = process.env.ORG_ID;

  if (!orgId) {
    console.error("Error: ORG_ID environment variable is required.");
    console.error("Usage: ORG_ID=<your-org-id> npx tsx scripts/seed-dictionaries.ts");
    process.exit(1);
  }

  console.log(`Seeding dictionaries for organization: ${orgId}`);
  console.log("---");

  let created = 0;
  let skipped = 0;

  for (const entry of SEED_DATA) {
    const existing = await prisma.mappingDictionary.findFirst({
      where: {
        organizationId: orgId,
        category: entry.category,
        normalizedValue: entry.normalizedValue,
      },
    });

    if (existing) {
      console.log(`  [skip] ${entry.category} / ${entry.normalizedValue}`);
      skipped++;
    } else {
      await prisma.mappingDictionary.create({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: {
          organizationId: orgId,
          category: entry.category,
          normalizedValue: entry.normalizedValue,
          aliases: entry.aliases,
        } as any,
      });
      console.log(`  [add]  ${entry.category} / ${entry.normalizedValue}`);
      created++;
    }
  }

  console.log("---");
  console.log(`Done: ${created} created, ${skipped} skipped (out of ${SEED_DATA.length} total)`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
