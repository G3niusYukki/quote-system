import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";

const CONFIG_PATH = path.join(process.cwd(), "data", "config.json");

export const runtime = "nodejs";

interface Config {
  dashscopeApiKey?: string;
}

function readConfig(): Config {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
    }
  } catch {}
  return {};
}

function writeConfig(config: Config) {
  const dir = path.dirname(CONFIG_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

export async function GET() {
  const config = readConfig();
  return NextResponse.json({
    hasKey: !!config.dashscopeApiKey,
    // 不返回 key 本身，安全
  });
}

export async function POST(req: NextRequest) {
  try {
    const { apiKey } = await req.json();
    if (!apiKey || typeof apiKey !== "string" || !apiKey.trim()) {
      return NextResponse.json({ error: "API Key 不能为空" }, { status: 400 });
    }
    writeConfig({ dashscopeApiKey: apiKey.trim() });
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
