import { NextRequest, NextResponse } from "next/server";
import { getRequestAuth, withOrgContext } from "@/lib/request-auth";
import { prisma } from "@/lib/db";
import path from "path";
import fs from "fs";

// ---------------------------------------------------------------------------
// Remote zones JSON fallback (V1 early stage, before DB migration)
// ---------------------------------------------------------------------------
function loadRemoteZonesFromFile(): Record<string, string[]> {
  try {
    const filePath = path.join(process.cwd(), "data", "remote-zones.json");
    if (fs.existsSync(filePath)) {
      const raw = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      // Normalise: { "美国": { "偏远邮编": [...] }, ... }  -> { "美国": [...] }
      const result: Record<string, string[]> = {};
      for (const [country, val] of Object.entries(raw)) {
        if (typeof val === "object" && val !== null && "偏远邮编" in (val as object)) {
          result[country] = (val as { 偏远邮编: string[] }).偏远邮编;
        }
      }
      return result;
    }
  } catch {
    // ignore
  }
  return {};
}

// ---------------------------------------------------------------------------
// Category -> user-friendly name
// ---------------------------------------------------------------------------
const CATEGORY_LABELS: Record<string, string> = {
  remote: "偏远附加费",
  oversize: "超尺寸附加费",
  overweight: "超重附加费",
  item_type: "品类附加费",
  private_address: "私人地址附加费",
  other: "其他附加费",
};

function surchargeName(category: string, condition: string | null): string {
  const base = CATEGORY_LABELS[category] ?? `${category}附加费`;
  if (!condition) return base;
  // Extract a short descriptor from condition if it looks structured
  const firstLine = condition.split("\n")[0].trim();
  if (firstLine.length > 0 && firstLine.length < 40) return `${base}（${firstLine}）`;
  return base;
}

// ---------------------------------------------------------------------------
// Remote postcode matching (prefix match)
// ---------------------------------------------------------------------------
function isRemotePostcode(
  postcode: string,
  remoteZones: Record<string, string[]>,
  country: string
): boolean {
  const zones = remoteZones[country];
  if (!zones || zones.length === 0) return false;
  return zones.some((z) => {
    if (z.includes("-")) {
      // Range: "995-999"
      const [start, end] = z.split("-");
      const pNum = parseInt(postcode, 10);
      return !isNaN(pNum) && pNum >= parseInt(start, 10) && pNum <= parseInt(end, 10);
    }
    // Prefix match for alpha postcodes like "Y0A"
    return postcode.toUpperCase().startsWith(z.toUpperCase());
  });
}

// ---------------------------------------------------------------------------
// Parse weight threshold from condition string
// e.g. "实际重量>30KG" -> 30
// ---------------------------------------------------------------------------
function parseWeightThreshold(condition: string | null): number | null {
  if (!condition) return null;
  const m = condition.match(/>?\s*(\d+(?:\.\d+)?)\s*KG/i);
  if (m) return parseFloat(m[1]);
  return null;
}

// ---------------------------------------------------------------------------
// Check if dimensions trigger oversize surcharge
// Default thresholds: L>120 || W>80 || H>80 cm
// ---------------------------------------------------------------------------
function isOversize(
  dims: { L?: number; W?: number; H?: number },
  condition: string | null
): boolean {
  const L = dims.L ?? 0;
  const W = dims.W ?? 0;
  const H = dims.H ?? 0;

  if (condition) {
    // Try to parse specific thresholds from condition
    const lM = condition.match(/L\s*[>]=?\s*(\d+(?:\.\d+)?)/i);
    const wM = condition.match(/W\s*[>]=?\s*(\d+(?:\.\d+)?)/i);
    const hM = condition.match(/H\s*[>]=?\s*(\d+(?:\.\d+)?)/i);
    if (lM || wM || hM) {
      const lThresh = lM ? parseFloat(lM[1]) : 120;
      const wThresh = wM ? parseFloat(wM[1]) : 80;
      const hThresh = hM ? parseFloat(hM[1]) : 80;
      return L > lThresh || W > wThresh || H > hThresh;
    }
  }
  return L > 120 || W > 80 || H > 80;
}

// ---------------------------------------------------------------------------
// API types
// ---------------------------------------------------------------------------
interface CalculateRequest {
  country: string;
  transport_type: string;
  cargo_type: string;
  actual_weight: number;
  volume_weight?: number;
  dimensions?: { L?: number; W?: number; H?: number };
  postcode?: string;
  item_types?: string[];
  is_private_address?: boolean;
  upstream?: string;
}

interface SurchargeResult {
  type: string;
  name: string;
  amount: number;
  calculation: string;
  rule_id: string;
  raw_evidence: string | null;
  hit_reason: string;
}

interface UnmatchedSurcharge {
  type: string;
  rule_id: string;
  reason: string;
}

interface CalculateResponse {
  quote: {
    base_price: number;
    chargeable_weight: number;
    matched_channel: {
      upstream: string;
      channel_name: string;
      zone: string;
      unit_price: number;
      weight_min: number;
      weight_max: number | null;
      postcode_min: string | null;
      postcode_max: string | null;
      time_estimate: string | null;
    } | null;
  };
  surcharges: SurchargeResult[];
  unmatched_surcharges: UnmatchedSurcharge[];
  billing_rules_applied: {
    rule_key: string;
    rule_value: string;
    raw_evidence: string | null;
  }[];
  total: number;
  rule_version_id: string | null;
  quote_version_id: string;
}

// ---------------------------------------------------------------------------
// POST /api/quotes/calculate
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  const auth = getRequestAuth(req);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: CalculateRequest;
  try {
    body = (await req.json()) as CalculateRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const {
    country,
    transport_type,
    cargo_type,
    actual_weight,
    volume_weight = 0,
    dimensions,
    postcode,
    item_types = [],
    is_private_address = false,
    upstream: upstreamFilter,
  } = body;

  // Input validation
  if (!country || !transport_type || !cargo_type) {
    return NextResponse.json(
      { error: "country, transport_type, cargo_type are required" },
      { status: 400 }
    );
  }
  if (typeof actual_weight !== "number" || actual_weight <= 0) {
    return NextResponse.json(
      { error: "actual_weight must be a positive number" },
      { status: 400 }
    );
  }

  try {
    const result = await withOrgContext(auth, async (): Promise<CalculateResponse> => {
      // ----------------------------------------------------------------
      // Step 1: Load published quote version (latest version)
      // ----------------------------------------------------------------
      const versionWhere: Record<string, unknown> = { status: "published" };
      if (upstreamFilter) versionWhere.upstream = upstreamFilter;

      const versions = await prisma.quoteVersion.findMany({
        where: versionWhere,
        orderBy: { version: "desc" },
        take: 1,
      });

      if (versions.length === 0) {
        return {
          quote: { base_price: 0, chargeable_weight: 0, matched_channel: null },
          surcharges: [],
          unmatched_surcharges: [],
          billing_rules_applied: [],
          total: 0,
          rule_version_id: null,
          quote_version_id: "",
        };
      }

      const quoteVersion = versions[0];
      const quoteVersionId = quoteVersion.id;
      const ruleVersionId = quoteVersion.ruleVersionId;

      // ----------------------------------------------------------------
      // Step 2: Load remote zones
      // ----------------------------------------------------------------
      // Priority 1: surcharges table with category=remote
      const remoteSurcharges = await prisma.surcharge.findMany({
        where: { quoteVersionId, category: "remote" },
      });

      let remoteZones: Record<string, string[]> = {};
      if (remoteSurcharges.length > 0) {
        // Build { country: [postcodes] } from DB records
        // Each record's condition/rawEvidence should contain country + postcode list
        for (const s of remoteSurcharges) {
          // Try to parse country from condition field
          const countryMatch = s.condition?.match(/^(美国|加拿大|澳大利亚)/);
          if (countryMatch) {
            const c = countryMatch[1];
            if (!remoteZones[c]) remoteZones[c] = [];
            // Extract postcodes from condition (comma-separated or range notation)
            const rest = s.condition!.slice(countryMatch[0].length).trim();
            const parts = rest.split(/[,，\s]+/);
            for (const p of parts) {
              const trimmed = p.replace(/^[\s,，:：]+|[\s,，:：]+$/g, "");
              if (trimmed) remoteZones[c].push(trimmed);
            }
          }
        }
      } else {
        // Fallback: remote-zones.json
        remoteZones = loadRemoteZonesFromFile();
      }

      // ----------------------------------------------------------------
      // Step 3: Calculate chargeable weight
      // ----------------------------------------------------------------
      const chargeableWeight = Math.max(actual_weight, volume_weight);

      // ----------------------------------------------------------------
      // Step 4: Find matching channels
      // ----------------------------------------------------------------
      const quoteWhere: Record<string, unknown> = {
        quoteVersionId,
        country,
        transportType: transport_type,
        cargoType: cargo_type,
        weightMin: { lte: chargeableWeight },
      };

      const channels = await prisma.quote.findMany({
        where: quoteWhere,
        orderBy: { unitPrice: "asc" },
      });

      // Fetch upstream info for channels if upstreamFilter is active
      // (upstream filter needs DB join)
      const quoteVersionMap: Record<string, string> = {};
      if (upstreamFilter) {
        const versionIds = [...new Set(channels.map((ch) => ch.quoteVersionId))];
        const versions = await prisma.quoteVersion.findMany({
          where: { id: { in: versionIds } },
          select: { id: true, upstream: true },
        });
        for (const v of versions) {
          quoteVersionMap[v.id] = v.upstream;
        }
      }

      // Filter by postcode range and weightMax in JS
      const postcodeNorm = postcode ?? "";
      const matchedChannels = channels.filter((ch) => {
        // postcode range
        if (ch.postcodeMin || ch.postcodeMax) {
          // numeric postcode range
          if (ch.postcodeMin && ch.postcodeMax) {
            const pMin = parseInt(ch.postcodeMin, 10);
            const pMax = parseInt(ch.postcodeMax, 10);
            const pNum = parseInt(postcodeNorm, 10);
            if (!isNaN(pMin) && !isNaN(pMax) && !isNaN(pNum)) {
              if (pNum < pMin || pNum > pMax) return false;
            }
          } else if (ch.postcodeMin && !postcodeNorm.startsWith(ch.postcodeMin)) {
            return false;
          }
        }
        // weightMax
        if (ch.weightMax !== null) {
          if (chargeableWeight > Number(ch.weightMax)) return false;
        }
        // upstream filter
        if (upstreamFilter) {
          const chUpstream = quoteVersionMap[ch.quoteVersionId] ?? "";
          if (chUpstream !== upstreamFilter) return false;
        }
        return true;
      });

      if (matchedChannels.length === 0) {
        return {
          quote: { base_price: 0, chargeable_weight: chargeableWeight, matched_channel: null },
          surcharges: [],
          unmatched_surcharges: [],
          billing_rules_applied: [],
          total: 0,
          rule_version_id: ruleVersionId,
          quote_version_id: quoteVersionId,
        };
      }

      // Pick cheapest channel
      const channel = matchedChannels[0];
      const unitPrice = Number(channel.unitPrice);
      const basePrice = chargeableWeight * unitPrice;

      // ----------------------------------------------------------------
      // Step 5: Evaluate surcharges
      // ----------------------------------------------------------------
      const allSurcharges = await prisma.surcharge.findMany({
        where: { quoteVersionId },
      });

      const matchedSurcharges: SurchargeResult[] = [];
      const unmatchedSurcharges: UnmatchedSurcharge[] = [];

      for (const s of allSurcharges) {
        let hit = false;
        let hitReason = "";

        switch (s.category) {
          case "remote": {
            if (postcodeNorm && Object.keys(remoteZones).length > 0) {
              const isRemote = isRemotePostcode(postcodeNorm, remoteZones, country);
              if (isRemote) {
                hit = true;
                hitReason = `邮编 ${postcodeNorm} 匹配偏远分区`;
              } else {
                hitReason = `邮编 ${postcodeNorm} 不在偏远分区`;
              }
            } else {
              hitReason = "未提供邮编或偏远分区未配置";
            }
            break;
          }
          case "oversize": {
            if (dimensions) {
              const oversize = isOversize(dimensions, s.condition);
              if (oversize) {
                hit = true;
                hitReason = `尺寸 L=${dimensions.L} W=${dimensions.W} H=${dimensions.H} 超出阈值`;
              } else {
                hitReason = `尺寸未超出阈值`;
              }
            } else {
              hitReason = "未提供尺寸数据";
            }
            break;
          }
          case "overweight": {
            const threshold = parseWeightThreshold(s.condition);
            if (threshold !== null) {
              if (actual_weight > threshold) {
                hit = true;
                hitReason = `实重 ${actual_weight}KG > ${threshold}KG`;
              } else {
                hitReason = `实重 ${actual_weight}KG 未超过 ${threshold}KG 阈值`;
              }
            } else {
              hitReason = "无法解析重量阈值条件";
            }
            break;
          }
          case "item_type": {
            // item_type surcharge: check intersection with item_types[]
            if (item_types.length > 0) {
              const surchargeItemTypes: string[] = [];
              try {
                if (s.condition) {
                  // condition may contain JSON or comma-separated list
                  const parsed = JSON.parse(s.condition);
                  if (Array.isArray(parsed)) surchargeItemTypes.push(...parsed);
                }
              } catch {
                // try comma-separated
                if (s.condition) {
                  surchargeItemTypes.push(...s.condition.split(/[,，]/).map((t) => t.trim()));
                }
              }
              const intersection = item_types.filter((it) =>
                surchargeItemTypes.some((st) =>
                  st.toLowerCase() === it.toLowerCase() ||
                  it.toLowerCase().includes(st.toLowerCase()) ||
                  st.toLowerCase().includes(it.toLowerCase())
                )
              );
              if (intersection.length > 0) {
                hit = true;
                hitReason = `品类匹配: ${intersection.join(", ")}`;
              } else {
                hitReason = `品类 ${item_types.join(", ")} 与规则不匹配`;
              }
            } else {
              hitReason = "未选择品类";
            }
            break;
          }
          case "private_address": {
            if (is_private_address) {
              hit = true;
              hitReason = "私人地址标记为 true";
            } else {
              hitReason = "非私人地址";
            }
            break;
          }
          case "other":
          default: {
            hit = true;
            hitReason = "无条件附加费";
            break;
          }
        }

        if (hit) {
          const chargeType = s.chargeType ?? "fixed";
          const chargeValue = s.chargeValue ? Number(s.chargeValue) : 0;
          let amount = 0;
          let calcStr = "";

          if (chargeType === "per_kg") {
            amount = chargeableWeight * chargeValue;
            calcStr = `${chargeableWeight}KG × ¥${chargeValue}`;
          } else if (chargeType === "per_item") {
            const itemCount = item_types.length > 0 ? item_types.length : 1;
            amount = itemCount * chargeValue;
            calcStr = `${itemCount}件 × ¥${chargeValue}`;
          } else {
            amount = chargeValue;
            calcStr = `固定 ¥${chargeValue}`;
          }

          matchedSurcharges.push({
            type: s.category,
            name: surchargeName(s.category, s.condition),
            amount: Math.round(amount * 100) / 100,
            calculation: calcStr,
            rule_id: s.id,
            raw_evidence: s.rawEvidence,
            hit_reason: hitReason,
          });
        } else {
          unmatchedSurcharges.push({
            type: s.category,
            rule_id: s.id,
            reason: hitReason,
          });
        }
      }

      // ----------------------------------------------------------------
      // Step 6: Apply billing rules
      // ----------------------------------------------------------------
      const billingRules = await prisma.billingRule.findMany({
        where: { quoteVersionId },
      });

      const appliedBillingRules = billingRules.map((br) => ({
        rule_key: br.ruleKey,
        rule_value: br.ruleValue,
        raw_evidence: br.rawEvidence,
      }));

      // ----------------------------------------------------------------
      // Step 7: Calculate total
      // ----------------------------------------------------------------
      const surchargeTotal = matchedSurcharges.reduce((sum, s) => sum + s.amount, 0);
      const total = Math.round((basePrice + surchargeTotal) * 100) / 100;

      return {
        quote: {
          base_price: Math.round(basePrice * 100) / 100,
          chargeable_weight: chargeableWeight,
          matched_channel: {
            upstream: quoteVersion.upstream,
            channel_name: channel.channelName,
            zone: channel.zone ?? "",
            unit_price: unitPrice,
            weight_min: Number(channel.weightMin),
            weight_max: channel.weightMax ? Number(channel.weightMax) : null,
            postcode_min: channel.postcodeMin,
            postcode_max: channel.postcodeMax,
            time_estimate: channel.timeEstimate,
          },
        },
        surcharges: matchedSurcharges,
        unmatched_surcharges: unmatchedSurcharges,
        billing_rules_applied: appliedBillingRules,
        total,
        rule_version_id: ruleVersionId,
        quote_version_id: quoteVersionId,
      };
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error("[POST /api/quotes/calculate]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
