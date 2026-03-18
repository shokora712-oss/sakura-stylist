import OpenAI from "openai";
import { NextResponse } from "next/server";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type OutfitItemInput = {
  name: string | null;
  category: string;
  subcategory?: string | null;
  colors?: string[];
  styles?: string[];
  seasons?: string[];
  formality?: number | null;
};

type OutfitCommentRequest = {
  occasion: string | null;
  style: string | null;
  temperatureLabel?: string | null;
  score: number;
  breakdown: {
    occasion: number;
    style: number;
    color: number;
    preference: number;
    rewear: number;
    setupBonus: number;
    suitBonus: number;
    moodCohesionBonus: number;
    versatilityBonus: number;
    harmonyPenalty: number;
    styleHarmonyPenalty: number;
  };
  items: OutfitItemInput[];
  fixedItemName?: string | null;
  fallbackReasons?: string[];
};

type OutfitCommentResponse = {
  summary: string;
  reasons: string[];
};

function safeArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string").slice(0, 4);
}

function safeString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value.trim() : fallback;
}

function sanitizeResponse(value: unknown, fallbackReasons: string[] = []): OutfitCommentResponse {
  const raw = (value ?? {}) as Record<string, unknown>;

  const summary = safeString(raw.summary, "全体として取り入れやすいコーデ候補です。");
  const reasons = safeArray(raw.reasons).slice(0, 4);

  return {
    summary,
    reasons: reasons.length > 0 ? reasons : fallbackReasons.slice(0, 4),
  };
}

function buildPrompt(body: OutfitCommentRequest) {
  return `
あなたは日本語で話す、やさしくて実用的なAIスタイリストです。
以下のコーデ候補データをもとに、ユーザー向けコメントをJSONで返してください。

目的:
- ルールベースで出た評価を、人が読んで嬉しい自然な日本語に変換する
- 盛りすぎない
- 断定しすぎない
- でもスタイリストっぽくわかりやすく伝える

絶対ルール:
- JSONのみ返す
- summary は1文
- reasons は2〜4個
- reasons は短めの日本語
- スコアやbreakdownの傾向を反映する
- fixedItemName があるなら、できるだけ主役感を反映する
- harmonyPenalty や styleHarmonyPenalty が高い場合は、やんわり改善余地に触れる
- ポジティブ寄りで、使いやすいトーンにする
- まだ存在しない情報を勝手に作らない

返却形式:
{
  "summary": "string",
  "reasons": ["string", "string"]
}

入力データ:
${JSON.stringify(body, null, 2)}
  `.trim();
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as OutfitCommentRequest;

    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_TEXT_MODEL || "gpt-4.1-mini",
      temperature: 0.7,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: "あなたは日本語のファッションスタイリストAIです。必ずJSONのみ返してください。",
        },
        {
          role: "user",
          content: buildPrompt(body),
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw);

    return NextResponse.json(
      sanitizeResponse(parsed, body.fallbackReasons ?? [])
    );
  } catch (error) {
    console.error("POST /api/llm/outfit-comment error:", error);
    return NextResponse.json(
      { error: "LLMによるコーデコメント生成に失敗しました" },
      { status: 500 }
    );
  }
}