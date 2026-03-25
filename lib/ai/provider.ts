export interface AIResult {
  type: "pricing" | "surcharge" | "restriction" | "notes" | "clause";
  data: Record<string, unknown>;
  confidence: number; // 0-1
  raw_text: string;
}

export interface AIProvider {
  extract(blockType: AIResult["type"], rawText: string): Promise<AIResult>;
}
