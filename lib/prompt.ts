import type {
  Quote,
  Surcharge,
  Restriction,
  CompensationRule,
} from "@/types";

export function buildChatPrompt(
  quotes: Quote[],
  surcharges: Surcharge[],
  restrictions: Restriction[],
  compensationRules: CompensationRule[],
  question: string,
  history: { role: "user" | "assistant"; content: string }[]
): string {
  const contextSection = buildContextSection(quotes, surcharges, restrictions, compensationRules);

  // 先拼接历史对话，再拼接当前上下文和提问
  let prompt = "";

  // 历史对话（限制最近3轮）
  const recentHistory = history.slice(-6); // 最多3对对话
  if (recentHistory.length > 0) {
    for (const msg of recentHistory) {
      const roleLabel = msg.role === "user" ? "用户" : "助手";
      prompt += `${roleLabel}：${msg.content}\n`;
    }
    prompt += "\n---\n";
  }

  prompt += `你是一个国际快递询价助手。请根据以下报价数据回答用户问题。

## 报价数据：
${contextSection}

## 用户问题：
${question}

回答要求：
1. 基于报价数据如实回答，不要编造价格或条款
2. 价格以元为单位
3. 如问题涉及多个渠道比较，给出推荐及理由
4. 如有不明确的地方，明确指出
5. 附加费需说明计算方式`;

  return prompt;
}

function buildContextSection(
  quotes: Quote[],
  surcharges: Surcharge[],
  restrictions: Restriction[],
  compensationRules: CompensationRule[]
): string {
  const lines: string[] = [];

  // 按渠道分组
  const channelMap = new Map<string, Quote[]>();
  for (const q of quotes) {
    const key = q.channel_name;
    if (!channelMap.has(key)) channelMap.set(key, []);
    channelMap.get(key)!.push(q);
  }

  lines.push("【渠道定价】");
  for (const [channelName, qs] of channelMap) {
    const first = qs[0];
    lines.push(`\n【${channelName}】国家:${first.country} 运输:${first.transport_type} 货物:${first.cargo_type} 时效:${first.time_estimate}`);
    for (const q of qs) {
      const weightRange = q.weight_max === null ? `${q.weight_min}KG以上` : `${q.weight_min}-${q.weight_max}KG`;
      lines.push(`  ${weightRange}: ${q.unit_price}元/KG`);
    }
  }

  if (surcharges.length > 0) {
    lines.push("\n【附加费规则】");
    const categoryMap = new Map<string, Surcharge[]>();
    for (const s of surcharges) {
      if (!categoryMap.has(s.category)) categoryMap.set(s.category, []);
      categoryMap.get(s.category)!.push(s);
    }
    for (const [cat, ss] of categoryMap) {
      lines.push(`\n[${cat}]`);
      for (const s of ss) {
        const unit = s.charge_type === "per_kg" ? "元/KG" : s.charge_type === "per_item" ? "元/件" : "元/票";
        lines.push(`  ${s.description}(${s.item_type ?? "通用"}): ${s.charge_value}${unit} ${s.condition}`);
      }
    }
  }

  if (restrictions.length > 0) {
    lines.push("\n【拒收/限制规则】");
    for (const r of restrictions) {
      lines.push(`[${r.type}] ${r.content}`);
    }
  }

  if (compensationRules.length > 0) {
    lines.push("\n【赔偿标准】");
    for (const c of compensationRules) {
      const rateStr = c.rate_per_kg !== null ? `${c.rate_per_kg}元/KG` : "";
      lines.push(`[${c.scenario}] ${c.standard} ${rateStr} ${c.notes}`);
    }
  }

  return lines.join("\n");
}
