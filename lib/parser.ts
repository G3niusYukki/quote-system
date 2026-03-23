import * as XLSX from "xlsx";
import type {
  Quote,
  Surcharge,
  Restriction,
  CompensationRule,
  BillingRule,
} from "@/types";

export interface ParseResult {
  quotes: Omit<Quote, "id" | "created_at">[];
  surcharges: Omit<Surcharge, "id" | "created_at">[];
  restrictions: Omit<Restriction, "id" | "created_at">[];
  compensationRules: Omit<CompensationRule, "id" | "created_at">[];
  billingRules: Omit<BillingRule, "id" | "created_at">[];
  unparsedWarnings: string[];
}

export function parseExcel(buffer: Buffer): ParseResult {
  const workbook = XLSX.read(buffer, { type: "buffer", cellNF: true });
  const result: ParseResult = {
    quotes: [],
    surcharges: [],
    restrictions: [],
    compensationRules: [],
    billingRules: [],
    unparsedWarnings: [],
  };

  for (const sheetName of workbook.SheetNames) {
    const ws = workbook.Sheets[sheetName];
    if (!ws) continue;

    try {
      if (sheetName === "美国海运普货" || sheetName === "美国海运快船") {
        parseUSSheet(ws, result, sheetName);
      } else if (sheetName === "美国海运敏感") {
        parseUSSensitiveSheet(ws, result, sheetName);
      } else if (sheetName === "加拿大海运普敏" || sheetName === "加拿大海运") {
        parseCanadaSeaSheet(ws, result, sheetName);
      } else if (sheetName === "澳大利亚空运") {
        parseAustraliaAirSheet(ws, result, sheetName);
      } else if (sheetName === "加拿大空运") {
        parseCanadaAirSheet(ws, result, sheetName);
      } else {
        result.unparsedWarnings.push(`未知的Sheet: ${sheetName}`);
      }
    } catch (e) {
      result.unparsedWarnings.push(`解析 ${sheetName} 时出错: ${e}`);
    }
  }

  return result;
}

function getCell(ws: XLSX.WorkSheet, addr: string): string {
  const cell = ws[addr];
  if (!cell || cell.v === undefined || cell.v === null) return "";
  return String(cell.v).trim();
}

// ============================================================
// Sheet1: 美国海运快船/慢船 · 纯普货
// 列: A=国家, B=区域, C=邮编, D=12-50KG价, E=51+KG价, F=时效(快船), G=时效(慢船)
// ============================================================
function parseUSSheet(ws: XLSX.WorkSheet, result: ParseResult, sheetName: string) {
  const timeEstimateFast = getCell(ws, "F2");
  const timeEstimateSlow = getCell(ws, "F5");

  const zones = [
    { row: 2, zone: "美国西岸", postcodeMin: "80000", postcodeMax: "99999", isFast: true },
    { row: 3, zone: "美国中部", postcodeMin: "40000", postcodeMax: "79999", isFast: true },
    { row: 4, zone: "美国东岸", postcodeMin: "00000", postcodeMax: "39999", isFast: true },
    { row: 5, zone: "美国西岸", postcodeMin: "80000", postcodeMax: "99999", isFast: false },
    { row: 6, zone: "美国中部", postcodeMin: "40000", postcodeMax: "79999", isFast: false },
    { row: 7, zone: "美国东岸", postcodeMin: "00000", postcodeMax: "39999", isFast: false },
  ];

  for (const z of zones) {
    const price1250 = parseFloat(getCell(ws, `D${z.row}`)) || 0;
    const price51 = parseFloat(getCell(ws, `E${z.row}`)) || 0;
    const shipType = z.isFast ? "美国海运快船" : "美国海运慢船";
    const timeEst = z.isFast ? timeEstimateFast : timeEstimateSlow;

    result.quotes.push({
      sheet_name: sheetName,
      country: "美国",
      transport_type: "海运",
      cargo_type: "纯普货",
      channel_name: `${shipType}-纯普货`,
      zone: z.zone,
      postcode_min: z.postcodeMin,
      postcode_max: z.postcodeMax,
      weight_min: 12,
      weight_max: 50,
      unit_price: price1250,
      time_estimate: timeEst,
      raw_text: "",
    });

    result.quotes.push({
      sheet_name: sheetName,
      country: "美国",
      transport_type: "海运",
      cargo_type: "纯普货",
      channel_name: `${shipType}-纯普货`,
      zone: z.zone,
      postcode_min: z.postcodeMin,
      postcode_max: z.postcodeMax,
      weight_min: 51,
      weight_max: null,
      unit_price: price51,
      time_estimate: timeEst,
      raw_text: "",
    });
  }

  extractUSCommonClauses(sheetName, result);
}

// ============================================================
// Sheet2: 美国海运快船 · 敏感货
// 列: A=国家, B=区域, C=邮编, D=12-50KG价, E=51+KG价, G=时效
// ============================================================
function parseUSSensitiveSheet(ws: XLSX.WorkSheet, result: ParseResult, sheetName: string) {
  const timeEstimate = getCell(ws, "G2");

  const zones = [
    { row: 2, zone: "美国西岸", postcodeMin: "80000", postcodeMax: "99999" },
    { row: 3, zone: "美国中部", postcodeMin: "40000", postcodeMax: "79999" },
    { row: 4, zone: "美国东岸", postcodeMin: "00000", postcodeMax: "39999" },
  ];

  for (const z of zones) {
    const price1250 = parseFloat(getCell(ws, `D${z.row}`)) || 0;
    const price51 = parseFloat(getCell(ws, `E${z.row}`)) || 0;

    result.quotes.push({
      sheet_name: sheetName,
      country: "美国",
      transport_type: "海运",
      cargo_type: "敏感",
      channel_name: "美国海运快船-敏感",
      zone: z.zone,
      postcode_min: z.postcodeMin,
      postcode_max: z.postcodeMax,
      weight_min: 12,
      weight_max: 50,
      unit_price: price1250,
      time_estimate: timeEstimate,
      raw_text: "",
    });

    result.quotes.push({
      sheet_name: sheetName,
      country: "美国",
      transport_type: "海运",
      cargo_type: "敏感",
      channel_name: "美国海运快船-敏感",
      zone: z.zone,
      postcode_min: z.postcodeMin,
      postcode_max: z.postcodeMax,
      weight_min: 51,
      weight_max: null,
      unit_price: price51,
      time_estimate: timeEstimate,
      raw_text: "",
    });
  }

  extractUSCommonClauses(sheetName, result);
  parseUSSensitiveClauses(sheetName, result);
}

// ============================================================
// Sheet3: 加拿大海运 · 普货/敏感
// 列: A=国家, B=?, C=10-20KG, D=21-30KG, E=30-70KG, F=71+KG, G=时效
// ============================================================
function parseCanadaSeaSheet(ws: XLSX.WorkSheet, result: ParseResult, sheetName: string) {
  const timeEstimate = getCell(ws, "G2");

  const rows = [
    { row: 2, cargoType: "普货", channelName: "加拿大海运-普货" },
    { row: 3, cargoType: "敏感", channelName: "加拿大海运-敏感" },
  ];

  const weightBrackets = [
    { col: "C", min: 10, max: 20 },
    { col: "D", min: 21, max: 30 },
    { col: "E", min: 30, max: 70 },
    { col: "F", min: 71, max: null },
  ];

  for (const r of rows) {
    for (const w of weightBrackets) {
      const price = parseFloat(getCell(ws, `${w.col}${r.row}`)) || 0;
      result.quotes.push({
        sheet_name: sheetName,
        country: "加拿大",
        transport_type: "海运",
        cargo_type: r.cargoType as "普货" | "敏感",
        channel_name: r.channelName,
        zone: "",
        postcode_min: "",
        postcode_max: "",
        weight_min: w.min,
        weight_max: w.max,
        unit_price: price,
        time_estimate: timeEstimate,
        raw_text: "",
      });
    }
  }

  // 计费规则
  result.billingRules.push({
    sheet_name: sheetName,
    rule_type: "体积重",
    rule_key: "计算公式",
    rule_value: "长×宽×高/6000",
    raw_text: "实重与体积重取大计费",
  });

  // 偏远
  result.surcharges.push({
    sheet_name: sheetName,
    category: "偏远",
    item_type: null,
    charge_type: "per_kg",
    charge_value: 2.5,
    condition: "UPS官方偏远地址",
    description: "UPS偏远附加费",
    raw_text: "UPS官方偏远地址额外加收2.5元/KG，最低230元/票",
  });

  // 超尺寸
  result.surcharges.push({
    sheet_name: sheetName,
    category: "超尺寸",
    item_type: null,
    charge_type: "per_item",
    charge_value: 320,
    condition: "最长边>119CM",
    description: "超尺寸-最长边",
    raw_text: "最长边超119CM收取320元/件",
  });
  result.surcharges.push({
    sheet_name: sheetName,
    category: "超尺寸",
    item_type: null,
    charge_type: "per_item",
    charge_value: 320,
    condition: "第二长边>70CM",
    description: "超尺寸-第二长边",
    raw_text: "第二长边超70CM收取320元/件",
  });
  result.surcharges.push({
    sheet_name: sheetName,
    category: "超尺寸",
    item_type: null,
    charge_type: "per_item",
    charge_value: 320,
    condition: "周长>260CM",
    description: "超尺寸-周长",
    raw_text: "周长大于260CM收取320元/件",
  });
  result.surcharges.push({
    sheet_name: sheetName,
    category: "超重",
    item_type: null,
    charge_type: "per_item",
    charge_value: 420,
    condition: "单件实重>22KG",
    description: "超重附加费",
    raw_text: "单件实重大于22KG收取420元/件",
  });

  // 赔偿
  result.compensationRules.push({
    sheet_name: sheetName,
    scenario: "已提取未签收",
    standard: "25元/KG赔偿",
    rate_per_kg: 25,
    max_compensation: null,
    notes: "不退运费",
  });
  result.compensationRules.push({
    sheet_name: sheetName,
    scenario: "无法提取或扣关",
    standard: "25元/KG+退回运费",
    rate_per_kg: 25,
    max_compensation: null,
    notes: "无法在UPS官方提取上网或者扣关，赔偿25元/KG同时退回当票运费",
  });
}

// ============================================================
// Sheet4: 澳大利亚空运 · 普敏/特货
// 列: A=国家, B=首重0.5KG, C=续重0.5KG, D/E=?, G=时效
// ============================================================
function parseAustraliaAirSheet(ws: XLSX.WorkSheet, result: ParseResult, sheetName: string) {
  const timeEstimate = getCell(ws, "G3");

  // 普敏
  const puminFirst = parseFloat(getCell(ws, "B2")) || 84;
  const puminCont = parseFloat(getCell(ws, "C2")) || 22;
  result.quotes.push({
    sheet_name: sheetName,
    country: "澳大利亚",
    transport_type: "空运",
    cargo_type: "普敏",
    channel_name: "澳大利亚空运-普敏",
    zone: "",
    postcode_min: "",
    postcode_max: "",
    weight_min: 0,
    weight_max: 0.5,
    unit_price: puminFirst,
    time_estimate: timeEstimate,
    raw_text: "",
  });
  result.quotes.push({
    sheet_name: sheetName,
    country: "澳大利亚",
    transport_type: "空运",
    cargo_type: "普敏",
    channel_name: "澳大利亚空运-普敏",
    zone: "",
    postcode_min: "",
    postcode_max: "",
    weight_min: 0.5,
    weight_max: null,
    unit_price: puminCont,
    time_estimate: timeEstimate,
    raw_text: "",
  });

  // 特货
  const tehuoFirst = parseFloat(getCell(ws, "B3")) || 95;
  const tehuoCont = parseFloat(getCell(ws, "C3")) || 25;
  result.quotes.push({
    sheet_name: sheetName,
    country: "澳大利亚",
    transport_type: "空运",
    cargo_type: "特货",
    channel_name: "澳大利亚空运-特货",
    zone: "",
    postcode_min: "",
    postcode_max: "",
    weight_min: 0,
    weight_max: 0.5,
    unit_price: tehuoFirst,
    time_estimate: timeEstimate,
    raw_text: "",
  });
  result.quotes.push({
    sheet_name: sheetName,
    country: "澳大利亚",
    transport_type: "空运",
    cargo_type: "特货",
    channel_name: "澳大利亚空运-特货",
    zone: "",
    postcode_min: "",
    postcode_max: "",
    weight_min: 0.5,
    weight_max: null,
    unit_price: tehuoCont,
    time_estimate: timeEstimate,
    raw_text: "",
  });

  // 普敏限制
  result.restrictions.push({
    sheet_name: sheetName,
    type: "品类限制",
    content: "拒收肉蛋奶类食品、含磁、带电、液体、膏体、粉末、易燃易爆类",
  });
  result.restrictions.push({
    sheet_name: sheetName,
    type: "尺寸限制",
    content: "任何一边尺寸不得超过1.05米；长度+最大横周合计不得超过3.0米；单件限重20KG",
  });

  // 超尺寸附加费
  result.surcharges.push({
    sheet_name: sheetName,
    category: "超尺寸",
    item_type: null,
    charge_type: "per_item",
    charge_value: 240,
    condition: "特货-31.5KG<实重≤45KG",
    description: "特货超重附加费",
    raw_text: "31.5kg < 实重 ≤ 45kg附加240元/件",
  });

  // 赔偿
  result.compensationRules.push({
    sheet_name: sheetName,
    scenario: "未上网遗失",
    standard: "40元/KG+退运费",
    rate_per_kg: 40,
    max_compensation: null,
    notes: "出库后50天未上网提取",
  });
  result.compensationRules.push({
    sheet_name: sheetName,
    scenario: "已上网遗失",
    standard: "40元/KG",
    rate_per_kg: 40,
    max_compensation: null,
    notes: "不退运费",
  });
}

// ============================================================
// Sheet5: 加拿大空运 · 普敏/特货
// 列: A=国家, B=首重0.5KG, C=续重0.5KG, D/E=?, F=时效
// ============================================================
function parseCanadaAirSheet(ws: XLSX.WorkSheet, result: ParseResult, sheetName: string) {
  const timeEstimate = getCell(ws, "F3");

  const canPuminFirst = parseFloat(getCell(ws, "B2")) || 126;
  const canPuminCont = parseFloat(getCell(ws, "C2")) || 33.75;
  result.quotes.push({
    sheet_name: sheetName,
    country: "加拿大",
    transport_type: "空运",
    cargo_type: "普敏",
    channel_name: "加拿大空运-普敏",
    zone: "",
    postcode_min: "",
    postcode_max: "",
    weight_min: 0,
    weight_max: 0.5,
    unit_price: canPuminFirst,
    time_estimate: timeEstimate,
    raw_text: "",
  });
  result.quotes.push({
    sheet_name: sheetName,
    country: "加拿大",
    transport_type: "空运",
    cargo_type: "普敏",
    channel_name: "加拿大空运-普敏",
    zone: "",
    postcode_min: "",
    postcode_max: "",
    weight_min: 0.5,
    weight_max: null,
    unit_price: canPuminCont,
    time_estimate: timeEstimate,
    raw_text: "",
  });

  const canTehuoFirst = parseFloat(getCell(ws, "B3")) || 75;
  const canTehuoCont = parseFloat(getCell(ws, "C3")) || 33.75;
  result.quotes.push({
    sheet_name: sheetName,
    country: "加拿大",
    transport_type: "空运",
    cargo_type: "特货",
    channel_name: "加拿大空运-特货",
    zone: "",
    postcode_min: "",
    postcode_max: "",
    weight_min: 0,
    weight_max: 0.5,
    unit_price: canTehuoFirst,
    time_estimate: timeEstimate,
    raw_text: "",
  });
  result.quotes.push({
    sheet_name: sheetName,
    country: "加拿大",
    transport_type: "空运",
    cargo_type: "特货",
    channel_name: "加拿大空运-特货",
    zone: "",
    postcode_min: "",
    postcode_max: "",
    weight_min: 0.5,
    weight_max: null,
    unit_price: canTehuoCont,
    time_estimate: timeEstimate,
    raw_text: "",
  });

  result.restrictions.push({
    sheet_name: sheetName,
    type: "品类限制",
    content: "普敏：拒收肉蛋奶类食品、含磁、带电、液体、膏体、粉末、易燃易爆类；特货可运输内置电/磁、食品、保健品、药品、牌子（混装）",
  });
  result.restrictions.push({
    sheet_name: sheetName,
    type: "尺寸限制",
    content: "普敏:任何一边尺寸不得超过1.5米，长度和长度以外的最大横周合计不得超过3.0米；单件限重30KG",
  });
}

// ============================================================
// 通用美国条款提取
// ============================================================
function extractUSCommonClauses(sheetName: string, result: ParseResult) {
  result.billingRules.push({
    sheet_name: sheetName,
    rule_type: "体积重",
    rule_key: "计算公式",
    rule_value: "长×宽×高/6000",
    raw_text: "实重与体积重取大计费；体积重=长*宽*高（CM)/6000",
  });

  const itemSurcharges = [
    { item: "眼镜/FDA相关", value: 0.5 },
    { item: "内置电池", value: 2 },
    { item: "医疗用品", value: 0.5 },
    { item: "儿童用品", value: 0.5 },
    { item: "条纹笔记本/圆珠笔/铅笔", value: 0.5 },
    { item: "汽车配件", value: 0.5 },
    { item: "铝制品", value: 0.5 },
    { item: "服装/成衣", value: 0.5 },
    { item: "膏体", value: 0.5 },
  ];

  for (const s of itemSurcharges) {
    result.surcharges.push({
      sheet_name: sheetName,
      category: "品类",
      item_type: s.item,
      charge_type: "per_kg",
      charge_value: s.value,
      condition: "每KG",
      description: `${s.item}附加费`,
      raw_text: `${s.item}+${s.value}元/kg`,
    });
  }

  result.surcharges.push({
    sheet_name: sheetName,
    category: "品类",
    item_type: "木制品",
    charge_type: "per_kg",
    charge_value: 0.5,
    condition: "不商检不报关",
    description: "木制品附加费",
    raw_text: "木制品不商检不报关+0.5元/kg",
  });

  result.surcharges.push({
    sheet_name: sheetName,
    category: "品类",
    item_type: null,
    charge_type: "fixed",
    charge_value: 30,
    condition: "超出5个品名",
    description: "品名限制附加费",
    raw_text: "每票货限5个品名，超出5个加收RMB30/票",
  });

  result.surcharges.push({
    sheet_name: sheetName,
    category: "偏远",
    item_type: null,
    charge_type: "per_item",
    charge_value: 30,
    condition: "偏远地区",
    description: "偏远附加费",
    raw_text: "偏远30元/件",
  });
  result.surcharges.push({
    sheet_name: sheetName,
    category: "偏远",
    item_type: null,
    charge_type: "per_item",
    charge_value: 45,
    condition: "超偏远",
    description: "超偏远附加费",
    raw_text: "超偏远45元/件",
  });
  result.surcharges.push({
    sheet_name: sheetName,
    category: "偏远",
    item_type: null,
    charge_type: "per_item",
    charge_value: 120,
    condition: "遥远",
    description: "遥远附加费",
    raw_text: "遥远120元/件",
  });

  const sizeSurcharges = [
    { desc: "异形包装", value: 210 },
    { desc: "实重>22.5KG且≤49KG", value: 180 },
    { desc: "实重>49KG且≤68KG", value: 720 },
  ];
  for (const s of sizeSurcharges) {
    result.surcharges.push({
      sheet_name: sheetName,
      category: "超尺寸",
      item_type: null,
      charge_type: "per_item",
      charge_value: s.value,
      condition: s.desc,
      description: `超尺寸附加费-${s.desc}`,
      raw_text: `${s.desc}附加费${s.value}元/件`,
    });
  }

  result.surcharges.push({
    sheet_name: sheetName,
    category: "私人地址",
    item_type: null,
    charge_type: "per_kg",
    charge_value: 1,
    condition: "私人地址",
    description: "私人地址附加费",
    raw_text: "私人地址+1元/kg",
  });

  result.restrictions.push({
    sheet_name: sheetName,
    type: "品类限制",
    content: "散装/违禁药物（精神类）、生鲜、宠物、标本、种子、烟酒类、易燃易爆（压力气罐、酒精、封闭喷雾）、纯电池类、充电宝、移动电源、发热物品无商业包装纯肉类、不明液体、白色粉末枪支弹药、真刀刃超过15cm（cos道具不算）涉及反动、色情、暴力等危害国家安全和社会稳定非法出版违禁物等",
  });

  result.restrictions.push({
    sheet_name: sheetName,
    type: "尺寸限制",
    content: "单件实重超过68KG/单边长度超过240cm/长+（宽+高）*2围长超330cm满足任意一条无法承运",
  });

  result.compensationRules.push({
    sheet_name: sheetName,
    scenario: "未上网遗失",
    standard: "退运费+货值赔偿",
    rate_per_kg: 40,
    max_compensation: null,
    notes: "包税不包查验；需提供采购发票；最高不超过40元/KG；提取了按100美金/件赔偿",
  });
}

// ============================================================
// 敏感货特有条款
// ============================================================
function parseUSSensitiveClauses(sheetName: string, result: ParseResult) {
  result.surcharges.push({
    sheet_name: sheetName,
    category: "拦截",
    item_type: null,
    charge_type: "fixed",
    charge_value: 250,
    condition: "到港前提柜前",
    description: "拦截费（提柜前）",
    raw_text: "到港后，柜子未提柜送UPS/FedEx前，可拦截货物，操作费为实报实销250美金/件",
  });
  result.surcharges.push({
    sheet_name: sheetName,
    category: "拦截",
    item_type: null,
    charge_type: "per_item",
    charge_value: 300,
    condition: "到港后已送UPS/FedEx",
    description: "更改地址费",
    raw_text: "到港后，货物已送UPS/FedEx，需要更改地址的，费用为300元/件",
  });

  result.restrictions.push({
    sheet_name: sheetName,
    type: "品类限制",
    content: "散装/违禁药物（精神类）、生鲜、活物、标本、烟酒类、易燃易爆（压力气罐、酒精、封闭喷雾）、纯电池类、充电宝、移动电源、发热物品无商业包装纯肉类、不明液体、白色粉末枪支弹药等",
  });

  result.restrictions.push({
    sheet_name: sheetName,
    type: "服务范围",
    content: "仅限于美国本土48洲；不接收邮编006-009(波多黎各)、966-969(夏威夷关岛)、995-999(阿拉斯加)；不接收军方地址、邮箱BOX",
  });
}
