import { NextRequest, NextResponse } from "next/server";
import { getQuotesByFilters, getAllSurcharges } from "@/lib/db";
import type { MatchRequest, MatchResult, SurchargeDetail } from "@/types";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body: MatchRequest = await req.json();
    const { country, transport_type, cargo_type, actual_weight, dimensions, item_types, is_private_address, postcode } = body;

    // 计算体积重和计费重量
    const volumeWeight = (dimensions.length * dimensions.width * dimensions.height) / 6000;
    const chargeableWeight = Math.max(actual_weight, volumeWeight);

    // 查询可用渠道
    const quotes = getQuotesByFilters(country, transport_type, cargo_type);

    if (quotes.length === 0) {
      return NextResponse.json({ matches: [], reason: "没有找到符合条件的渠道" });
    }

    // 获取附加费规则
    const allSurcharges = getAllSurcharges();

    const results: MatchResult[] = [];

    // 按渠道分组
    const channelMap = new Map<string, typeof quotes>();
    for (const q of quotes) {
      if (!channelMap.has(q.channel_name)) channelMap.set(q.channel_name, []);
      channelMap.get(q.channel_name)!.push(q);
    }

    for (const [channelName, channelQuotes] of channelMap) {
      // 找到匹配的重量区间
      const matchedQuote = channelQuotes.find((q) => {
        if (q.weight_max === null) return chargeableWeight >= q.weight_min;
        return chargeableWeight >= q.weight_min && chargeableWeight <= q.weight_max;
      }) ?? channelQuotes[channelQuotes.length - 1];

      if (!matchedQuote) continue;

      const basePrice = chargeableWeight * matchedQuote.unit_price;
      const surcharges: SurchargeDetail[] = [];
      let totalSurcharge = 0;

      // 品类附加费
      for (const itemType of item_types) {
        const surcharge = allSurcharges.find(
          (s) => s.category === "品类" && s.item_type?.toLowerCase().includes(itemType.toLowerCase())
        );
        if (surcharge) {
          const amount = surcharge.charge_type === "per_kg"
            ? surcharge.charge_value * chargeableWeight
            : surcharge.charge_value;
          surcharges.push({
            name: surcharge.description,
            type: surcharge.charge_type as "per_kg" | "per_item" | "fixed",
            value: surcharge.charge_value,
            amount,
          });
          totalSurcharge += amount;
        }
      }

      // 私人地址附加费
      if (is_private_address) {
        const privateSurcharge = allSurcharges.find((s) => s.category === "私人地址");
        if (privateSurcharge) {
          const amount = privateSurcharge.charge_type === "per_kg"
            ? privateSurcharge.charge_value * chargeableWeight
            : privateSurcharge.charge_value;
          surcharges.push({
            name: "私人地址附加费",
            type: privateSurcharge.charge_type as "per_kg" | "per_item" | "fixed",
            value: privateSurcharge.charge_value,
            amount,
          });
          totalSurcharge += amount;
        }
      }

      // 偏远附加费（需要邮编判断，这里简化处理：标记需确认）
      let remoteNote = "";
      if (postcode) {
        const remoteSurcharge = allSurcharges.find((s) => s.category === "偏远" && s.condition === "偏远地区");
        if (remoteSurcharge) {
          remoteNote = `(邮编${postcode}需确认是否偏远，如偏远另加${remoteSurcharge.charge_value}元/件)`;
        }
      }

      results.push({
        channel: channelName,
        zone: matchedQuote.zone || "统一价",
        volume_weight: Math.round(volumeWeight * 100) / 100,
        chargeable_weight: chargeableWeight,
        base_price: Math.round(basePrice * 100) / 100,
        surcharges,
        total: Math.round((basePrice + totalSurcharge) * 100) / 100,
        time_estimate: matchedQuote.time_estimate,
        notes: remoteNote || "以上为基础费用，最终以体积重计算结果为准",
      });
    }

    // 按总价排序
    results.sort((a, b) => a.total - b.total);

    return NextResponse.json({ matches: results });
  } catch (e) {
    console.error("Match error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
