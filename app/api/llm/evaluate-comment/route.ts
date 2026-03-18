import OpenAI from "openai";
import { NextResponse } from "next/server";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type EvaluateCommentRequest = {
  occasion: string | null;
  season: string | null;
  style: string | null;
  totalScore: number;
  colorScore: number;
  silhouetteScore: number;
  seasonScore: number;
  occasionScore: number;
  analysis?: {
    detectedItems?: string[];
    dominantColors?: string[];
    styleGuess?: string;
    seasonGuess?: string;
    comment?: string;
  };
  fallbackSummary?: string;
  fallbackGoodPoints?: string[];
  fallbackImprovementPoints?: string[];
};

type EvaluateCommentResponse = {
  summary: string;
  goodPoints: string[];
  improvementPoints: string[];
};

function safeArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string").slice(0, 4);
}

function safeString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value.trim() : fallback;
}

function sanitizeResponse(
  value: unknown,
  fallback?: Partial<EvaluateCommentResponse>
): EvaluateCommentResponse {
  const raw = (value ?? {}) as Record<string, unknown>;

  return {
    summary: safeString(
      raw.summary,
      fallback?.summary ?? "全体として大きく崩れていないコーデです。"
    ),
    goodPoints: (() => {
      const arr = safeArray(raw.goodPoints);
      return arr.length > 0
        ? arr
        : (fallback?.goodPoints ?? ["全体として大きな破綻はありません。"]);
    })(),
    improvementPoints: (() => {
      const arr = safeArray(raw.improvementPoints);
      return arr.length > 0
        ? arr
        : (fallback?.improvementPoints ?? ["細部を調整するとさらに完成度が上がりそうです。"]);
    })(),
  };
}

function buildPrompt(body: EvaluateCommentRequest) {
  return `
あなたは日本語で話すAIスタイリストです。
コーデ評価の点数データをもとに、ユーザー向けの自然な講評をJSONで返してください。

目的:
- 数字の評価を、人が読んで理解しやすいコメントに変える
- 良い点 / 改善点 をバランスよく出す
- 厳しすぎず、実用的でやさしい言い方にする
- summary は全体の総評
- goodPoints は2〜3個
- improvementPoints は2〜3個

絶対ルール:
- JSONのみ返す
- 過剰に褒めすぎない
- でもネガティブすぎない
- season / occasion / style の入力があるなら反映する
- analysis があるならそれも軽く反映してよい
- 存在しない事実は作らない

返却形式:
{
  "summary": "string",
  "goodPoints": ["string", "string"],
  "improvementPoints": ["string", "string"]
}

入力データ:
${JSON.stringify(body, null, 2)}
  `.trim();
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as EvaluateCommentRequest;

    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_TEXT_MODEL || "gpt-4.1-mini",
      temperature: 0.7,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: "あなたは日本語のファッション評価AIです。必ずJSONのみ返してください。",
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
      sanitizeResponse(parsed, {
        summary: body.fallbackSummary,
        goodPoints: body.fallbackGoodPoints,
        improvementPoints: body.fallbackImprovementPoints,
      })
    );
  } catch (error) {
    console.error("POST /api/llm/evaluate-comment error:", error);
    return NextResponse.json(
      { error: "LLMによる評価コメント生成に失敗しました" },
      { status: 500 }
    );
  }
}