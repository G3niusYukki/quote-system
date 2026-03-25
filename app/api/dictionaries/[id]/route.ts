import { NextRequest, NextResponse } from "next/server";
import { requireAuth, withOrgContext } from "@/lib/request-auth";
import { prisma } from "@/lib/db";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: RouteParams) {
  const auth = requireAuth(req);
  const { id } = await params;

  return withOrgContext(auth, async () => {
    const dictionary = await prisma.mappingDictionary.findUnique({
      where: { id },
    });
    if (!dictionary) {
      return NextResponse.json({ error: "Dictionary not found" }, { status: 404 });
    }
    return NextResponse.json({ data: dictionary });
  });
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
  const auth = requireAuth(req);
  const { id } = await params;

  let body: { category?: string; normalizedValue?: string; aliases?: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { category, normalizedValue, aliases } = body;

  const VALID_CATEGORIES = [
    "country",
    "channel",
    "transport_type",
    "cargo_type",
    "unit",
    "currency",
    "zone",
  ];

  return withOrgContext(auth, async () => {
    // Check if exists
    const existing = await prisma.mappingDictionary.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Dictionary not found" }, { status: 404 });
    }

    const updateData: {
      category?: string;
      normalizedValue?: string;
      aliases?: string[];
    } = {};

    if (category !== undefined) {
      if (!VALID_CATEGORIES.includes(category)) {
        return NextResponse.json(
          { error: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(", ")}` },
          { status: 400 }
        );
      }
      updateData.category = category;
    }

    if (normalizedValue !== undefined) {
      updateData.normalizedValue = normalizedValue.trim();
    }

    if (aliases !== undefined) {
      if (!Array.isArray(aliases)) {
        return NextResponse.json(
          { error: "aliases must be an array of strings" },
          { status: 400 }
        );
      }
      updateData.aliases = aliases.map((a) => a.trim()).filter(Boolean);
    }

    const updated = await prisma.mappingDictionary.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ data: updated });
  });
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const auth = requireAuth(req);
  const { id } = await params;

  return withOrgContext(auth, async () => {
    const existing = await prisma.mappingDictionary.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Dictionary not found" }, { status: 404 });
    }

    await prisma.mappingDictionary.delete({ where: { id } });
    return NextResponse.json({ success: true });
  });
}
