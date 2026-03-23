import { NextRequest, NextResponse } from "next/server";
import { getQuotesByFilters, getRules } from "@/lib/db";
import type { MatchRequest, MatchResult, SurchargeDetail } from "@/types";

export const runtime = "nodejs";

function matchCondition(aiCondition: string, patterns: string[]): boolean {
  const text = aiCondition.toLowerCase();
  return patterns.some(p => text.includes(p.toLowerCase()));
}

export async function POST(req: NextRequest) {
  try {
    const body: MatchRequest = await req.json();
    const { country, transport_type, cargo_type, actual_weight, dimensions, item_types, is_private_address, postcode, upstream } = body;

    // 计算体积重和计费重量
    const volumeWeight = (dimensions.length * dimensions.width * dimensions.height) / 6000;
    const chargeableWeight = Math.max(actual_weight, volumeWeight);

    // 计算尺寸相关值
    const sides = [dimensions.length, dimensions.width, dimensions.height].sort((a, b) => b - a);
    const maxSide = sides[0];
    const secondSide = sides[1];
    const perimeter = (maxSide + secondSide) * 2;
    // 假设单件（后续可扩展为多件）
    const weightPerItem = actual_weight;

    // 查询可用渠道
    const quotes = getQuotesByFilters(country, transport_type, cargo_type, upstream);

    if (quotes.length === 0) {
      return NextResponse.json({ matches: [], reason: "没有找到符合条件的渠道" });
    }

    // Read all rules for the upstream (or all if no upstream specified)
    const allRules = upstream
      ? getRules(upstream)
      : getRules("默认上游");
    // Filter to surcharges only (category = "surcharge" in rules table)
    const allSurcharges = allRules.filter((r) => r.category === "surcharge");
    console.log("[match] upstream:", upstream || "(默认)", "surcharges:", allSurcharges.map(s => `${s.type}/${s.description}/${s.charge_value}`));

    const results: MatchResult[] = [];

    // 按渠道+上游分组
    const channelMap = new Map<string, typeof quotes>();
    for (const q of quotes) {
      const key = `${q.upstream}|${q.channel_name}`;
      if (!channelMap.has(key)) channelMap.set(key, []);
      channelMap.get(key)!.push(q);
    }

    for (const [channelKey, channelQuotes] of channelMap) {
      const [channelUpstream, channelName] = channelKey.split("|", 2);
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
          (s) => s.type === "品类" && (s.item_type ?? "").toLowerCase().includes(itemType.toLowerCase())
        );
        if (surcharge && surcharge.charge_value != null) {
          const amount = surcharge.charge_type === "per_kg"
            ? surcharge.charge_value * chargeableWeight
            : surcharge.charge_value;
          console.log("[match] itemType:", itemType, "found surcharge:", surcharge.description, "amount:", amount);
          surcharges.push({
            name: surcharge.description,
            type: (surcharge.charge_type as "per_kg" | "per_item" | "fixed") ?? "fixed",
            value: surcharge.charge_value,
            amount,
          });
          totalSurcharge += amount;
        }
      }

      // 异形包装附加费（任何非标准纸箱包装）
      const yxSurcharges = allSurcharges.filter((s) => s.type === "异形包装");
      for (const s of yxSurcharges) {
        if (s.charge_value != null) {
          const amount = s.charge_value;
          console.log("[match] 异形包装 surcharge:", s.description, "amount:", amount);
          surcharges.push({
            name: s.description,
            type: "fixed",
            value: s.charge_value,
            amount,
          });
          totalSurcharge += amount;
        }
      }

      // 尺寸/重量附加费（超尺寸、超重、材重超限）
      const dimSurcharges = allSurcharges.filter(
        (s) => s.type === "超尺寸" || s.type === "超重" || s.type === "材重超限"
      );
      for (const s of dimSurcharges) {
        let triggered = false;
        const cond = s.condition ?? "";
        const lower = cond.toLowerCase();

        if (s.type === "超尺寸") {
          // 最长边
          if (/最长[边长]?[>≥]?\s*(\d+)/.test(cond)) {
            const m = cond.match(/最长[边长]?[>≥]?\s*(\d+)/);
            if (m && maxSide > parseFloat(m[1])) triggered = true;
          }
          // 第二长边
          if (/第二[长边]?[>≥]?\s*(\d+)/.test(cond)) {
            const m = cond.match(/第二[长边]?[>≥]?\s*(\d+)/);
            if (m && secondSide > parseFloat(m[1])) triggered = true;
          }
          // 围长: 两短边之和*2+最长边
          const girth = secondSide * 2 + maxSide;
          if (/围[长周]?[>≥]?\s*(\d+)/.test(cond)) {
            const m = cond.match(/围[长周]?[>≥]?\s*(\d+)/);
            if (m && girth > parseFloat(m[1])) triggered = true;
          }
        } else if (s.type === "超重" || s.type === "材重超限") {
          // 判断基于实重还是材重
          const useVolume = s.type === "材重超限" || /\u6750\u91cd/.test(lower); // "材重"
          const weightToCheck = useVolume ? volumeWeight : actual_weight;
          // 条件格式：">22.5且≤49" 或 ">22.5KG且≤49KG"
          const rangeMatch = cond.match(/[>≥]\s*([\d.]+).*[<≤]\s*([\d.]+)/);
          if (rangeMatch) {
            const low = parseFloat(rangeMatch[1]);
            const high = parseFloat(rangeMatch[2]);
            if (weightToCheck > low && weightToCheck <= high) triggered = true;
          }
          // 单值条件：>49KG
          const singleMatch = cond.match(/[>≥]\s*([\d.]+)/);
          if (singleMatch && !cond.includes("且") && !cond.includes("≤") && !cond.includes("<")) {
            if (weightToCheck > parseFloat(singleMatch[1])) triggered = true;
          }
        }

        if (triggered && s.charge_value != null) {
          const amount = s.charge_value;
          console.log("[match] dim surcharge:", s.type, s.description, "amount:", amount);
          surcharges.push({
            name: s.description,
            type: "fixed",
            value: s.charge_value,
            amount,
          });
          totalSurcharge += amount;
        }
      }

      // 私人地址附加费
      if (is_private_address) {
        const privateSurcharge = allSurcharges.find((s) => s.type === "私人地址");
        console.log("[match] private check:", is_private_address, "found:", privateSurcharge?.description, privateSurcharge?.charge_value);
        if (privateSurcharge && privateSurcharge.charge_value != null) {
          const amount = privateSurcharge.charge_type === "per_kg"
            ? privateSurcharge.charge_value * chargeableWeight
            : privateSurcharge.charge_value;
          surcharges.push({
            name: "私人地址附加费",
            type: (privateSurcharge.charge_type as "per_kg" | "per_item" | "fixed") ?? "fixed",
            value: privateSurcharge.charge_value,
            amount,
          });
          totalSurcharge += amount;
        }
      }

      // 偏远附加费（需要邮编判断，这里简化处理：标记需确认）
      let remoteNote = "";
      if (postcode) {
        const remoteSurcharge = allSurcharges.find((s) => s.type === "偏远");
        if (remoteSurcharge && remoteSurcharge.charge_value != null) {
          remoteNote = `(邮编${postcode}需确认是否偏远，如偏远另加${remoteSurcharge.charge_value}元/件)`;
        }
      }

      results.push({
        upstream: channelUpstream,
        channel: channelName,
        zone: matchedQuote.zone || "统一价",
        volume_weight: Math.round(volumeWeight * 100) / 100,
        chargeable_weight: chargeableWeight,
        base_price: Math.round(basePrice * 100) / 100,
        surcharges,
        total: Math.round((basePrice + totalSurcharge) * 100) / 100,
        time_estimate: matchedQuote.time_estimate,
        notes: remoteNote || "以上为基础费用，最终以体积重计算结果为准",
        is_lowest: false,
      });
      console.log("[match] result:", channelName, "surcharges:", surcharges.map(s => `${s.name}(+${s.amount})`));
    }

    // 按总价排序，标记最低价
    results.sort((a, b) => a.total - b.total);
    if (results.length > 0) {
      results[0].is_lowest = true;
    }

    return NextResponse.json({ matches: results });
  } catch (e) {
    console.error("Match error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
