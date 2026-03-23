// 渠道定价
export interface Quote {
  id: number;
  sheet_name: string;
  country: string;
  transport_type: "海运" | "空运";
  cargo_type: "普货" | "敏感" | "特货" | "纯普货" | "普敏";
  channel_name: string;
  zone: string;
  postcode_min: string;
  postcode_max: string;
  weight_min: number;
  weight_max: number | null;
  unit_price: number;
  time_estimate: string;
  raw_text: string;
  upstream: string;
  created_at: string;
}

// 附加费
export interface Surcharge {
  id: number;
  sheet_name: string;
  category: "偏远" | "超尺寸" | "品类" | "超重" | "私人地址" | "拦截";
  item_type?: string | null;
  charge_type: "per_kg" | "per_item" | "fixed";
  charge_value: number;
  condition: string;
  description: string;
  raw_text: string;
  upstream: string;
  created_at: string;
}

// 拒收规则
export interface Restriction {
  id: number;
  sheet_name: string;
  type: "品类限制" | "尺寸限制" | "服务范围";
  content: string;
  upstream: string;
  created_at: string;
}

// 赔偿规则
export interface CompensationRule {
  id: number;
  sheet_name: string;
  scenario: string;
  standard: string;
  rate_per_kg: number | null;
  max_compensation: number | null;
  notes: string;
  upstream: string;
  created_at: string;
}

// 计费规则
export interface BillingRule {
  id: number;
  sheet_name: string;
  rule_type: string;
  rule_key: string;
  rule_value: string;
  raw_text: string;
  upstream: string;
  created_at: string;
}

// 上传历史
export interface UploadHistory {
  id: number;
  filename: string;
  upstream: string;
  sheet_count: number;
  uploaded_at: string;
  status: string;
  checksum: string;
}

// 解析预览
export interface ParsePreview {
  sheets: string[];
  channels: number;
  surcharges: number;
  unparsed_warnings: string[];
}

// API 响应
export interface StatusResponse {
  has_data: boolean;
  last_upload: string | null;
  last_filename: string | null;
  last_upstream: string | null;
  channels: number;
  surcharges: number;
  upstreams: string[];
}

// 匹配请求
export interface MatchRequest {
  country: string;
  transport_type: "海运" | "空运";
  cargo_type: string;
  actual_weight: number;
  dimensions: { length: number; width: number; height: number };
  item_types: string[];
  is_private_address: boolean;
  postcode?: string;
  upstream?: string; // 不填则查所有上游
}

// 匹配结果
export interface SurchargeDetail {
  name: string;
  type: "per_kg" | "per_item" | "fixed";
  value: number;
  amount: number;
}

export interface MatchResult {
  upstream: string;
  channel: string;
  zone: string;
  volume_weight: number;
  chargeable_weight: number;
  base_price: number;
  surcharges: SurchargeDetail[];
  total: number;
  time_estimate: string;
  notes: string;
  is_lowest: boolean;
}

// AI 对话
export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

// 统一规则记录 (AI提取 + 手动录入)
export interface RuleRecord {
  id?: number;
  upstream: string;
  category: "surcharge" | "restriction" | "compensation" | "billing";
  source: "ai" | "manual";
  type: string;
  item_type: string | null;
  charge_type: "per_kg" | "per_item" | "fixed" | null;
  charge_value: number | null;
  condition: string;
  description: string;
  content: string;
  standard: string | null;
  rate_per_kg: number | null;
  max_compensation: number | null;
  notes: string | null;
  rule_type: string | null;
  rule_key: string | null;
  rule_value: string | null;
  raw_text: string;
  created_at?: string;
  updated_at?: string;
}
