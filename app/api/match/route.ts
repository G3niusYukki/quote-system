/**
 * POST /api/match
 * 渠道匹配 API
 *
 * 接收询价参数，调用 /api/quotes/calculate，
 * 将结果转换为 MatchResult[] 格式返回。
 */

import { NextRequest, NextResponse } from "next/server";
import { getRequestAuth } from "@/lib/request-auth";
import { withErrorHandler, UnauthorizedError } from "@/lib/error";

export const POST = withErrorHandler(async (req: NextRequest) => {
  const auth = getRequestAuth(req);
  if (!auth) throw new UnauthorizedError("Unauthorized");

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const {
    country,
    transport_type,
    cargo_type,
    actual_weight,
    volume_weight,
    dimensions,
    postcode,
    item_types = [],
    is_private_address = false,
    upstream: upstreamFilter,
  } = body as {
    country?: string;
    transport_type?: string;
    cargo_type?: string;
    actual_weight?: number;
    volume_weight?: number;
    dimensions?: { L?: number; W?: number; H?: number };
    postcode?: string;
    item_types?: string[];
    is_private_address?: boolean;
    upstream?: string;
  };

  // Call the internal calculate API
  const calcBody: Record<string, unknown> = {
    country,
    transport_type,
    cargo_type,
    actual_weight: actual_weight ?? 0,
    volume_weight: volume_weight ?? 0,
    postcode,
    item_types,
    is_private_address,
    upstream: upstreamFilter,
  };
  if (dimensions) {
    calcBody.dimensions = dimensions;
  }

  // Forward the request internally using the cookie-based auth
  const calcUrl = new URL("/api/quotes/calculate", req.url);
  const calcResponse = await fetch(calcUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Cookie": req.headers.get("cookie") ?? "",
    },
    body: JSON.stringify(calcBody),
  });

  const calcData = await calcResponse.json();

  if (!calcResponse.ok) {
    return NextResponse.json({ error: calcData.error ?? "Calculation failed" }, { status: calcResponse.status });
  }

  // Transform calculate API response → MatchResult[]
  if (!calcData.quote?.matched_channel) {
    return NextResponse.json({ matches: [] });
  }

  const ch = calcData.quote.matched_channel;
  const surchargeTotal = (calcData.surcharges ?? []).reduce(
    (sum: number, s: Record<string, unknown>) => sum + (s.amount as number),
    0
  );

  const result = {
    upstream: ch.upstream ?? "",
    channel: ch.channel_name ?? "",
    zone: ch.zone ?? "",
    volume_weight: calcData.quote.volume_weight ?? 0,
    chargeable_weight: calcData.quote.chargeable_weight ?? 0,
    base_price: calcData.quote.base_price ?? 0,
    surcharges: (calcData.surcharges ?? []).map((s: Record<string, unknown>) => ({
      name: s.name ?? "",
      type: s.type ?? "fixed",
      value: (s.calculation as string)?.includes("×") ? 0 : (s.amount as number),
      amount: s.amount ?? 0,
    })),
    total: calcData.total ?? 0,
    time_estimate: ch.time_estimate ?? "",
    notes: (calcData.billing_rules_applied ?? []).map((r: Record<string, unknown>) => r.rule_value).join("；"),
    is_lowest: true,
  };

  return NextResponse.json({ matches: [result] });
});
