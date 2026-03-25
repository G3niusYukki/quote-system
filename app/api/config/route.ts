import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";

const CONFIG_PATH = path.join(process.cwd(), "data", "config.json");

export const runtime = "nodejs";

interface Config {
  dashscopeApiKey?: string;
  baseUrl?: string;
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

async function handleSave(req: NextRequest) {
  try {
    const body = await req.json();
    const { apiKey, baseUrl } = body;

    if (apiKey !== undefined) {
      if (typeof apiKey !== "string" || !apiKey.trim()) {
        return NextResponse.json({ error: "API Key 不能为空" }, { status: 400 });
      }
    }

    const config = readConfig();
    if (apiKey !== undefined) config.dashscopeApiKey = apiKey.trim();
    if (baseUrl !== undefined) config.baseUrl = typeof baseUrl === "string" ? baseUrl.trim() : "";

    writeConfig(config);
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function GET() {
  const config = readConfig();
  let maskedKey = "";
  if (config.dashscopeApiKey) {
    const key = config.dashscopeApiKey;
    maskedKey = key.length > 8 ? `${key.slice(0, 4)}${"*".repeat(key.length - 8)}${key.slice(-4)}` : `${"*".repeat(key.length)}`;
  }
  return NextResponse.json({
    hasKey: !!config.dashscopeApiKey,
    maskedKey,
    baseUrl: config.baseUrl || "",
  });
}

export async function PUT(req: NextRequest) {
  return handleSave(req);
}

export async function POST(req: NextRequest) {
  return handleSave(req);
}
