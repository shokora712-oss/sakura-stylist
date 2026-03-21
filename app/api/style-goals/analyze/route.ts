import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const ALLOWED_BASE_STYLES = [
  "casual", "clean", "feminine", "girly", "simple", "natural", "elegant", "mode", "street", "sporty",
] as const;

const ALLOWED_INSPIRATIONS = [
  "korean", "french", "overseas_girl", "city_girl", "japanese_feminine", "balletcore", "old_money", "y2k",
] as const;

const BASE_STYLE_LABELS: Record<string, string> = {
  casual: "カジュアル",
  clean: "きれいめ",
  feminine: "フェミニン",
  girly: "ガーリー",
  simple: "シンプル",
  natural: "ナチュラル",
  elegant: "エレガント",
  mode: "モード",
  street: "ストリート",
  sporty: "スポーティ",
};

const INSPIRATION_LABELS: Record<string, string> = {
  korean: "韓国系",
  french: "フレンチ",
  overseas_girl: "海外ガール",
  city_girl: "シティガール",
  japanese_feminine: "日本フェミニン",
  balletcore: "バレエコア",
  old_money: "オールドマネー",
  y2k: "Y2K",
};

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const imageDataUrl = body?.imageDataUrl;

  if (!imageDataUrl || typeof imageDataUrl !== "string") {
    return NextResponse.json({ error: "imageDataUrl が必要です" }, { status: 400 });
  }

  const prompt = `
あなたはファッションスタイリストAIです。
このコーデ画像を見て、Base StyleとInspirationを判定してください。

Base Style（服の基本的な雰囲気）の選択肢:
${JSON.stringify(ALLOWED_BASE_STYLES)}

Inspiration（文化的・トレンド的な方向性）の選択肢:
${JSON.stringify(ALLOWED_INSPIRATIONS)}

ルール:
- 必ずJSONのみを返してください
- baseStyle は Base Style の選択肢から1つだけ
- inspiration は Inspiration の選択肢から1つ、または該当なければ null
- comment は日本語で1〜2文、なぜそのスタイルか説明してください

返却JSON:
{
  "baseStyle": string,
  "inspiration": string | null,
  "comment": string
}
`.trim();

  try {
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_VISION_MODEL ?? "gpt-4o",
      temperature: 0.2,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: imageDataUrl } },
          ],
        },
      ],
    });

    const text = response.choices?.[0]?.message?.content ?? "";
    const jsonStart = text.indexOf("{");
    const jsonEnd = text.lastIndexOf("}");
    const parsed = JSON.parse(text.slice(jsonStart, jsonEnd + 1));

    const baseStyle = ALLOWED_BASE_STYLES.includes(parsed.baseStyle) ? parsed.baseStyle : "casual";
    const inspiration = ALLOWED_INSPIRATIONS.includes(parsed.inspiration) ? parsed.inspiration : null;
    const comment = typeof parsed.comment === "string" ? parsed.comment : "";

    return NextResponse.json({ baseStyle, inspiration, comment });
  } catch (e) {
    console.error("style analyze error:", e);
    return NextResponse.json({ error: "解析に失敗しました" }, { status: 500 });
  }
}