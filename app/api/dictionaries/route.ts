import { NextRequest, NextResponse } from "next/server";
import { requireAuth, withOrgContext } from "@/lib/request-auth";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const auth = requireAuth(req);

  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category");

  return withOrgContext(auth, async () => {
    const where = category ? { category } : {};
    const dictionaries = await prisma.mappingDictionary.findMany({
      where,
      orderBy: { normalizedValue: "asc" },
    });
    return NextResponse.json({ data: dictionaries });
  });
}

export async function POST(req: NextRequest) {
  const auth = requireAuth(req);

  let body: { category?: string; normalizedValue?: string; aliases?: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { category, normalizedValue, aliases = [] } = body;

  // Validate required fields
  if (!category || !normalizedValue) {
    return NextResponse.json(
      { error: "category and normalizedValue are required" },
      { status: 400 }
    );
  }

  // Validate category
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

  // Validate aliases is an array of strings
  if (!Array.isArray(aliases)) {
    return NextResponse.json(
      { error: "aliases must be an array of strings" },
      { status: 400 }
    );
  }

  return withOrgContext(auth, async () => {
    const dictionary = await prisma.mappingDictionary.create({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: {
        category,
        normalizedValue: normalizedValue.trim(),
        aliases: aliases.map((a) => a.trim()).filter(Boolean),
      } as any,
    });
    return NextResponse.json({ data: dictionary }, { status: 201 });
  });
}
