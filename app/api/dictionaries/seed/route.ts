import { NextRequest, NextResponse } from "next/server";
import { requireAuth, withOrgContext } from "@/lib/request-auth";
import { prisma } from "@/lib/db";

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
  { category: "unit", normalizedValue: "件", aliases: ["件", "件", "pcs", "piece", "count"] },
  { category: "unit", normalizedValue: "CBM", aliases: ["CBM", "立方米", "体积"] },
];

export async function POST(req: NextRequest) {
  const auth = requireAuth(req);

  return withOrgContext(auth, async () => {
    let count = 0;

    for (const entry of SEED_DATA) {
      // Upsert by finding existing or creating new
      const existing = await prisma.mappingDictionary.findFirst({
        where: {
          category: entry.category,
          normalizedValue: entry.normalizedValue,
        },
      });

      if (!existing) {
        await prisma.mappingDictionary.create({
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          data: {
            category: entry.category,
            normalizedValue: entry.normalizedValue,
            aliases: entry.aliases,
          } as any,
        });
        count++;
      }
    }

    return NextResponse.json({
      success: true,
      count,
      message: `新增 ${count} 条预设数据`,
    });
  });
}
