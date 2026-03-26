/**
 * Prompt templates for each block_type used by the AI extractor.
 * Each template instructs the AI to output a JSON object matching
 * the expected structured data for that block type.
 */

const SYSTEM_PROMPT = `你是一个专业的物流报价表解析助手。你的任务是从报价表文本中提取结构化的物流信息。
请严格按照JSON格式输出，不要包含任何额外文字。
只输出JSON对象，不要有markdown代码块标记。`;

function buildPricingPrompt(rawText: string): string {
  return `${SYSTEM_PROMPT}

从以下pricing区块文本中提取报价信息，输出JSON数组（每个数据行一条记录）：

**每条记录字段：**
- country: 国家（如：美国、加拿大、澳大利亚）
- transport_type: 运输类型（海运、空运、铁运、卡车）
- cargo_type: 货物类型（普货、敏感、特货、纯普货等）
- channel_name: 渠道名称
- zone: 区域（美国：西岸/中部/东岸；无需填写留空字符串）
- postcode_min / postcode_max: 邮编范围（美国邮编：西岸80000-99999，中部40000-79999，东岸00000-39999）
- weight_min / weight_max: 重量范围（KG）
- unit_price: 单价（元/KG 或 元/票）
- time_estimate: 时效描述

**可选字段：**
- billing_rule_key / billing_rule_value: 计费规则（如：体积重=长×宽×高/6000）
- currency: 货币（默认CNY）

文本内容：
${rawText}

输出示例：
[
  {
    "country": "美国",
    "transport_type": "海运",
    "cargo_type": "纯普货",
    "channel_name": "美国海运快船-纯普货",
    "zone": "美国西岸",
    "postcode_min": "80000",
    "postcode_max": "99999",
    "weight_min": 12,
    "weight_max": 50,
    "unit_price": 8.5,
    "time_estimate": "12-15天",
    "currency": "CNY"
  }
]`;
}

function buildSurchargePrompt(rawText: string): string {
  return `${SYSTEM_PROMPT}

从以下surcharge区块文本中提取附加费信息，输出JSON数组（每个附加费一条记录）：

**每条记录字段：**
- category: 类别（偏远/超尺寸/超重/私人地址/品类/拦截/其他）
- charge_type: 计费方式（per_kg/per_item/fixed）
- charge_value: 金额数值
- condition: 触发条件描述
- description: 附加费名称
- item_type: 适用货物类型（如适用，否则填null）

文本内容：
${rawText}

输出示例：
[
  {
    "category": "偏远",
    "charge_type": "per_item",
    "charge_value": 30,
    "condition": "偏远地区",
    "description": "偏远附加费",
    "item_type": null
  },
  {
    "category": "超尺寸",
    "charge_type": "per_item",
    "charge_value": 320,
    "condition": "最长边>119CM",
    "description": "超尺寸-最长边",
    "item_type": null
  }
]`;
}

function buildRestrictionPrompt(rawText: string): string {
  return `${SYSTEM_PROMPT}

从以下restriction区块文本中提取限制规则，输出JSON数组（每条限制一条记录）：

**每条记录字段：**
- type: 限制类型（品类限制/尺寸限制/区域限制/服务范围）
- content: 限制内容描述

文本内容：
${rawText}

输出示例：
[
  {
    "type": "品类限制",
    "content": "拒收肉蛋奶类食品、含磁、带电、液体、膏体、粉末、易燃易爆类"
  },
  {
    "type": "尺寸限制",
    "content": "任何一边尺寸不得超过1.05米；长度+最大横周合计不得超过3.0米；单件限重20KG"
  }
]`;
}

function buildNotesPrompt(rawText: string): string {
  return `${SYSTEM_PROMPT}

从以下notes区块文本中提取备注信息，输出JSON数组：

**每条记录字段：**
- title: 备注标题（如：体积重计算/赔偿标准/服务说明）
- content: 备注内容

文本内容：
${rawText}

输出示例：
[
  {
    "title": "体积重计算",
    "content": "实重与体积重取大计费；体积重=长*宽*高（CM)/6000"
  },
  {
    "title": "赔偿标准",
    "content": "未上网遗失赔偿40元/KG，退运费，最高不超过货值"
  }
]`;
}

function buildClausePrompt(rawText: string): string {
  return `${SYSTEM_PROMPT}

从以下clause区块文本中提取条款信息，输出JSON数组：

**每条记录字段：**
- clause_type: 条款类型（赔偿条款/免责条款/服务条款/违约条款）
- content: 条款内容
- title: 条款标题

文本内容：
${rawText}

输出示例：
[
  {
    "clause_type": "赔偿条款",
    "title": "未上网遗失",
    "content": "赔偿40元/KG，退运费，不退服务费"
  }
]`;
}

export function buildPrompt(
  blockType: "pricing" | "surcharge" | "restriction" | "notes" | "clause",
  rawText: string
): string {
  switch (blockType) {
    case "pricing":
      return buildPricingPrompt(rawText);
    case "surcharge":
      return buildSurchargePrompt(rawText);
    case "restriction":
      return buildRestrictionPrompt(rawText);
    case "notes":
      return buildNotesPrompt(rawText);
    case "clause":
      return buildClausePrompt(rawText);
    default:
      return `${SYSTEM_PROMPT}\n\n从以下文本中提取信息：\n${rawText}`;
  }
}
