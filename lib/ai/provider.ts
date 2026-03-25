export interface AIResult {
  type: "pricing" | "surcharge" | "restriction" | "notes" | "clause";
  data: Record<string, unknown> | unknown[]; // pricing=object, others=array
  confidence: number; // 0-1 (normalized); the scoring pipeline outputs 0-100 internally
  raw_text: string;
}

export interface AIProvider {
  extract(blockType: AIResult["type"], rawText: string): Promise<AIResult>;
}
