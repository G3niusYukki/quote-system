/**
 * One-time migration: Create QuoteVersion + Quote + Surcharge records
 * from existing published RuleVersion + Rule records.
 *
 * This bridges the gap where old imports only created Rule records
 * but the calculation engine reads Quote records.
 *
 * Run: npx tsx scripts/migrate-quote-from-rule.ts
 */

import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Starting migration: Rule → Quote");

  // Find all published RuleVersions that don't have a corresponding QuoteVersion
  const ruleVersions = await prisma.ruleVersion.findMany({
    where: { status: "published" },
    include: {
      rules: {
        include: { organization: true },
      },
    },
  });

  console.log(`Found ${ruleVersions.length} published RuleVersions`);

  let quoteVersionCount = 0;
  let quoteCount = 0;
  let surchargeCount = 0;

  for (const rv of ruleVersions) {
    // Check if QuoteVersion already exists for this RuleVersion
    const existingQV = await prisma.quoteVersion.findFirst({
      where: { ruleVersionId: rv.id },
    });

    let quoteVersion = existingQV;

    if (!quoteVersion) {
      quoteVersion = await prisma.quoteVersion.create({
        data: {
          organizationId: rv.organizationId,
          ruleVersionId: rv.id,
          upstream: rv.upstream,
          status: "published",
        },
      });
      quoteVersionCount++;
      console.log(`  Created QuoteVersion: ${quoteVersion.id} (upstream: ${rv.upstream})`);
    }

    // Process each rule
    for (const rule of rv.rules) {
      if (rule.category === "quote") {
        // Try to extract zone from type or description
        const zone = rule.type ?? rule.description?.split("\n")[0] ?? null;

        await prisma.quote.create({
          data: {
            organizationId: rv.organizationId,
            quoteVersionId: quoteVersion.id,
            country: extractCountry(rv.upstream) ?? "",
            transportType: extractTransport(rv.upstream) ?? "",
            cargoType: extractCargo(rv.upstream) ?? "",
            channelName: rule.description ?? rv.upstream,
            zone,
            postcodeMin: null,
            postcodeMax: null,
            weightMin: 0,
            weightMax: null,
            unitPrice: Number(rule.chargeValue ?? 0),
            timeEstimate: null,
            rawText: rule.rawEvidence ?? null,
          },
        });
        quoteCount++;
      } else if (rule.category === "surcharge") {
        await prisma.surcharge.create({
          data: {
            organizationId: rv.organizationId,
            quoteVersionId: quoteVersion.id,
            category: rule.type ?? "other",
            chargeType: rule.chargeType ?? "fixed",
            chargeValue: rule.chargeValue,
            condition: rule.condition,
            rawEvidence: rule.rawEvidence ?? null,
          },
        });
        surchargeCount++;
      }
    }
  }

  console.log(`\nMigration complete:`);
  console.log(`  QuoteVersions created: ${quoteVersionCount}`);
  console.log(`  Quotes created: ${quoteCount}`);
  console.log(`  Surcharges created: ${surchargeCount}`);
}

function extractCountry(upstream: string): string | null {
  if (upstream.includes("美国")) return "美国";
  if (upstream.includes("加拿大")) return "加拿大";
  if (upstream.includes("澳大利亚")) return "澳大利亚";
  if (upstream.includes("澳洲")) return "澳大利亚";
  return null;
}

function extractTransport(upstream: string): string | null {
  if (upstream.includes("海运")) return "海运";
  if (upstream.includes("空运")) return "空运";
  if (upstream.includes("铁运")) return "铁运";
  if (upstream.includes("卡车")) return "卡车";
  return null;
}

function extractCargo(upstream: string): string | null {
  if (upstream.includes("纯普货")) return "纯普货";
  if (upstream.includes("敏感")) return "敏感";
  if (upstream.includes("特货")) return "特货";
  if (upstream.includes("普货")) return "普货";
  if (upstream.includes("普敏")) return "普敏";
  return null;
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
