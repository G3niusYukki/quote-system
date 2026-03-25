import { NextRequest, NextResponse } from "next/server";
import { getRequestAuth, withOrgContext } from "@/lib/request-auth";
import { prisma } from "@/lib/db";

// GET /api/rule-versions/[id]/diff?compare_to=[otherId]
// Compares rules between two rule versions.
// Key: category + type + condition (trimmed)
// Results: added, removed, changed, unchanged
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = getRequestAuth(req);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const compareToId = searchParams.get("compare_to");

  if (!compareToId) {
    return NextResponse.json({ error: "compare_to query param is required" }, { status: 400 });
  }

  try {
    const result = await withOrgContext(auth, async () => {
      const [versionA, versionB] = await Promise.all([
        prisma.ruleVersion.findUnique({ where: { id } }),
        prisma.ruleVersion.findUnique({ where: { id: compareToId } }),
      ]);

      if (!versionA) throw new Error("VERSION_A_NOT_FOUND");
      if (!versionB) throw new Error("VERSION_B_NOT_FOUND");

      const [rulesA, rulesB] = await Promise.all([
        prisma.rule.findMany({ where: { ruleVersionId: id } }),
        prisma.rule.findMany({ where: { ruleVersionId: compareToId } }),
      ]);

      // Build maps keyed by category+type+condition
      type RuleKey = string;
      type RuleData = {
        id: string; category: string; type: string | null; itemType: object | null;
        chargeType: string | null; chargeValue: string | null; condition: string | null;
        description: string | null; content: string | null; priority: number;
        confidence: string; source: string; rawEvidence: string | null;
      };

      const toKey = (r: RuleData): RuleKey =>
        `${r.category}::${r.type ?? ""}::${(r.condition ?? "").trim()}`;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mapA = new Map<RuleKey, any>();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mapB = new Map<RuleKey, any>();

      for (const r of rulesA) {
        mapA.set(toKey(r as any), r);
      }
      for (const r of rulesB) {
        mapB.set(toKey(r as any), r);
      }

      const COMPARE_FIELDS: (keyof RuleData)[] = [
        "category", "type", "itemType", "chargeType", "chargeValue",
        "condition", "description", "content", "priority", "confidence",
        "source", "rawEvidence",
      ];

      const serialize = (val: unknown): string =>
        JSON.stringify(val);

      const isChanged = (a: RuleData, b: RuleData): boolean =>
        COMPARE_FIELDS.some((f) => serialize(a[f]) !== serialize(b[f]));

      const added: RuleData[] = [];
      const removed: RuleData[] = [];
      const changed: Array<{ before: RuleData; after: RuleData }> = [];
      const unchanged: RuleData[] = [];

      for (const [key, ruleA] of mapA) {
        if (!mapB.has(key)) {
          removed.push(ruleA);
        } else {
          const ruleB = mapB.get(key)!;
          if (isChanged(ruleA, ruleB)) {
            changed.push({ before: ruleA, after: ruleB });
          } else {
            unchanged.push(ruleA);
          }
        }
      }

      for (const [key, ruleB] of mapB) {
        if (!mapA.has(key)) {
          added.push(ruleB);
        }
      }

      return {
        versionA: { id: versionA.id, upstream: versionA.upstream, version: versionA.version, status: versionA.status },
        versionB: { id: versionB.id, upstream: versionB.upstream, version: versionB.version, status: versionB.status },
        summary: {
          totalA: rulesA.length,
          totalB: rulesB.length,
          added: added.length,
          removed: removed.length,
          changed: changed.length,
          unchanged: unchanged.length,
        },
        added,
        removed,
        changed,
        unchanged,
      };
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error("[GET /api/rule-versions/[id]/diff]", err);
    const msg = err instanceof Error ? err.message : "Internal server error";
    if (msg === "VERSION_A_NOT_FOUND") return NextResponse.json({ error: "Base version not found" }, { status: 404 });
    if (msg === "VERSION_B_NOT_FOUND") return NextResponse.json({ error: "Compare-to version not found" }, { status: 404 });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
