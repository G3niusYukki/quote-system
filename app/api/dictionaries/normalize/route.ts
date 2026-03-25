import { NextRequest, NextResponse } from "next/server";
import { requireAuth, withOrgContext } from "@/lib/request-auth";
import { prisma } from "@/lib/db";

interface NormalizeBody {
  text: string;
  category: string;
}

/**
 * POST /api/dictionaries/normalize
 *
 * Normalize a text string using the dictionary.
 * - If an exact/partial match is found in aliases: returns matched entry
 * - Otherwise: returns candidates (all entries with partial matches in the category)
 *
 * Uses case-insensitive LIKE matching on aliases JSONB array.
 */
export async function POST(req: NextRequest) {
  const auth = requireAuth(req);

  let body: NormalizeBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { text, category } = body;

  if (!text || !category) {
    return NextResponse.json(
      { error: "text and category are required" },
      { status: 400 }
    );
  }

  const VALID_CATEGORIES = [
    "country",
    "channel",
    "transport_type",
    "cargo_type",
    "unit",
    "currency",
    "zone",
  ];
  if (!VALID_CATEGORIES.includes(category)) {
    return NextResponse.json(
      { error: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(", ")}` },
      { status: 400 }
    );
  }

  return withOrgContext(auth, async () => {
    // Search for a matching entry: case-insensitive LIKE on any element in aliases JSONB array
    const searchPattern = `%${text.trim()}%`;

    // Use $queryRaw for JSONB array element matching
    // PostgreSQL: check if any array element ILIKE the pattern
    const matched: Array<{ id: string; normalized_value: string; aliases: string[] }> =
      await prisma.$queryRaw`
        SELECT id, normalized_value, aliases
        FROM "MappingDictionary"
        WHERE organization_id = ${auth.organizationId}
          AND category = ${category}
          AND EXISTS (
            SELECT 1 FROM jsonb_array_elements_text(aliases) AS alias
            WHERE alias ILIKE ${searchPattern}
          )
        LIMIT 1
      `;

    if (matched.length > 0) {
      return NextResponse.json({
        matched: true,
        normalized: matched[0].normalized_value,
        aliases: matched[0].aliases,
      });
    }

    // No direct match — return candidates: all entries in category with partial matches
    const candidates: Array<{ normalized: string; aliases: string[] }> =
      await prisma.$queryRaw`
        SELECT DISTINCT normalized_value AS normalized, aliases
        FROM "MappingDictionary"
        WHERE organization_id = ${auth.organizationId}
          AND category = ${category}
          AND EXISTS (
            SELECT 1 FROM jsonb_array_elements_text(aliases) AS alias
            WHERE alias ILIKE ${searchPattern}
          )
        LIMIT 10
      `;

    return NextResponse.json({
      matched: false,
      candidates: candidates.map((c) => ({ normalized: c.normalized, aliases: c.aliases })),
    });
  });
}
