import OpenAI from "openai";
import { NextResponse } from "next/server";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const ALLOWED_CATEGORIES = ["tops", "bottoms", "onepiece", "outer", "shoes", "bag"] as const;
const ALLOWED_STYLE_TAGS = ["casual", "clean", "feminine", "girly", "simple", "natural", "elegant", "mode", "street", "sporty"] as const;
const ALLOWED_COLORS = ["white", "black", "gray", "beige", "brown", "navy", "blue", "red", "pink", "green", "yellow"] as const;

const CATEGORY_LABELS: Record<string, string> = {
  tops: "トップス", bottoms: "ボトムス", onepiece: "ワンピース",
  outer: "アウター", shoes: "シューズ", bag: "バッグ",
};

const STYLE_LABELS: Record<string, string> = {
  casual: "カジュアル", clean: "きれいめ", feminine: "フェミニン",
  girly: "ガーリー", simple: "シンプル", natural: "ナチュラル",
  elegant: "エレガント", mode: "モード", street: "ストリート", sporty: "スポーティ",
};

const COLOR_LABELS: Record<string, string> = {
  white: "白", black: "黒", gray: "グレー", beige: "ベージュ",
  brown: "ブラウン", navy: "ネイビー", blue: "ブルー", red: "レッド",
  pink: "ピンク", green: "グリーン", yellow: "イエロー",
};

const PROMPT = `
あなたはコーデ画像解析AIです。
画像に写っているコーデを解析して、着用アイテムのリストをJSONで返してください。

ルール：
- 必ずJSONのみ返す。説明文は禁止。
- items は最大6件
- category は次のいずれか: ${JSON.stringify(ALLOWED_CATEGORIES)}
- styleTags は次から1〜2個: ${JSON.stringify(ALLOWED_STYLE_TAGS)}
- colors は次から最大2個: ${JSON.stringify(ALLOWED_COLORS)}
- name は短い日本語の名詞（例：「白ニット」「デニムパンツ」）

返却JSON:
{
  "items": [
    {
      "category": string,
      "name": string,
      "styleTags": string[],
      "colors": string[]
    }
  ],
  "overallStyleTags": string[],
  "overallColors": string[]
}
`.trim();

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { imageDataUrl } = body;

    if (!imageDataUrl || typeof imageDataUrl !== "string") {
      return NextResponse.json({ error: "imageDataUrl が必要です" }, { status: 400 });
    }

    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_VISION_MODEL ?? "gpt-4o",
      temperature: 0.2,
      messages: [
        { role: "system", content: PROMPT },
        {
          role: "user",
          content: [
            { type: "text", text: "このコーデ画像を解析してください。" },
            { type: "image_url", image_url: { url: imageDataUrl } },
          ],
        },
      ],
    });

    const text = response.choices[0]?.message?.content ?? "";
    const jsonStart = text.indexOf("{");
    const jsonEnd = text.lastIndexOf("}");
    if (jsonStart === -1 || jsonEnd === -1) throw new Error("JSON抽出失敗");

    const parsed = JSON.parse(text.slice(jsonStart, jsonEnd + 1));

    // サニタイズ
    const items = Array.isArray(parsed.items)
      ? parsed.items.slice(0, 6).map((item: any) => ({
          category: ALLOWED_CATEGORIES.includes(item.category) ? item.category : null,
          name: typeof item.name === "string" ? item.name : null,
          styleTags: Array.isArray(item.styleTags)
            ? item.styleTags.filter((t: string) => ALLOWED_STYLE_TAGS.includes(t as any))
            : [],
          colors: Array.isArray(item.colors)
            ? item.colors.filter((c: string) => ALLOWED_COLORS.includes(c as any)).slice(0, 2)
            : [],
          // ラベル変換
          categoryLabel: CATEGORY_LABELS[item.category] ?? item.category,
          styleTagLabels: (Array.isArray(item.styleTags) ? item.styleTags : [])
            .filter((t: string) => ALLOWED_STYLE_TAGS.includes(t as any))
            .map((t: string) => STYLE_LABELS[t] ?? t),
          colorLabels: (Array.isArray(item.colors) ? item.colors : [])
            .filter((c: string) => ALLOWED_COLORS.includes(c as any))
            .slice(0, 2)
            .map((c: string) => COLOR_LABELS[c] ?? c),
        }))
      : [];

    const overallStyleTags = Array.isArray(parsed.overallStyleTags)
      ? parsed.overallStyleTags.filter((t: string) => ALLOWED_STYLE_TAGS.includes(t as any))
      : [];

    const overallColors = Array.isArray(parsed.overallColors)
      ? parsed.overallColors.filter((c: string) => ALLOWED_COLORS.includes(c as any))
      : [];

    return NextResponse.json({ items, overallStyleTags, overallColors });
  } catch (error) {
    console.error("POST /api/outfit-log/analyze error:", error);
    return NextResponse.json(
      { error: "解析に失敗しました" },
      { status: 500 }
    );
  }
}