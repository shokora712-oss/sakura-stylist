import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const STYLE_LABELS: Record<string, string> = {
  casual: "カジュアル",
  girly: "ガーリー",
  street: "ストリート",
  mode: "モード",
  minimal: "ミニマル",
  feminine: "フェミニン",
  office: "オフィス",
};

const CATEGORY_LABELS: Record<string, string> = {
  tops: "トップス",
  bottoms: "ボトムス",
  onepiece: "ワンピース",
  outer: "アウター",
  shoes: "シューズ",
  bag: "バッグ",
};

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // アイテムとプロフィールを取得
  const [items, profile] = await Promise.all([
    prisma.item.findMany({
      where: { userId: session.user.id },
      select: {
        id: true,
        category: true,
        subCategory: true,
        color: true,
        season: true,
        styleTags: true,
        inspirationTags: true,
        formality: true,
        name: true,
      },
    }),
    prisma.profile.findUnique({
      where: { userId: session.user.id },
    }),
  ]);

  if (items.length === 0) {
    return NextResponse.json({
      categoryStats: [],
      styleStats: [],
      gapAnalysis: null,
      suggestions: [],
      message: "クローゼットにアイテムがまだ登録されていません。",
    });
  }

  // カテゴリ別集計
  const categoryCounts: Record<string, number> = {};
  for (const item of items) {
    if (item.category) {
      categoryCounts[item.category] = (categoryCounts[item.category] ?? 0) + 1;
    }
  }

  const totalItems = items.length;
  const categoryStats = Object.entries(CATEGORY_LABELS).map(([key, label]) => ({
    category: key,
    label,
    count: categoryCounts[key] ?? 0,
    ratio: Math.round(((categoryCounts[key] ?? 0) / totalItems) * 100),
  }));

  // スタイルタグ別集計
  const styleCounts: Record<string, number> = {};
  for (const item of items) {
    const tags = Array.isArray(item.styleTags) ? item.styleTags : [];
    for (const tag of tags) {
      if (typeof tag === "string") {
        styleCounts[tag] = (styleCounts[tag] ?? 0) + 1;
      }
    }
  }

  // インスピレーションタグ別集計
  const inspirationCounts: Record<string, number> = {};
  for (const item of items) {
    const tags = Array.isArray(item.inspirationTags) ? item.inspirationTags : [];
    for (const tag of tags) {
      if (typeof tag === "string") {
        inspirationCounts[tag] = (inspirationCounts[tag] ?? 0) + 1;
      }
    }
  }

  const styleStats = Object.entries(STYLE_LABELS).map(([key, label]) => ({
    style: key,
    label,
    count: styleCounts[key] ?? 0,
  })).sort((a, b) => b.count - a.count);

  // targetStyle ギャップ分析
  const targetStyle = profile?.targetStyle ?? null;
  const favoriteStyle = profile?.favoriteStyle ?? null;

  let gapAnalysis = null;
  if (targetStyle) {
    const targetCount = styleCounts[targetStyle] ?? 0;
    const targetRatio = Math.round((targetCount / totalItems) * 100);
    gapAnalysis = {
      targetStyle,
      targetStyleLabel: STYLE_LABELS[targetStyle] ?? targetStyle,
      favoriteStyle,
      favoriteStyleLabel: favoriteStyle ? (STYLE_LABELS[favoriteStyle] ?? favoriteStyle) : null,
      targetCount,
      targetRatio,
      isWeak: targetRatio < 20,
    };
  }

  // LLMによる提案生成
  const prompt = `
あなたはファッションスタイリストAIです。
ユーザーのクローゼット分析結果をもとに、「足りない服」と「購入候補」を提案してください。

【クローゼット情報】
総アイテム数: ${totalItems}件

カテゴリ別:
${categoryStats.map(s => `- ${s.label}: ${s.count}件`).join("\n")}

スタイルタグ別:
${styleStats.map(s => `- ${s.label}: ${s.count}件`).join("\n")}

インスピレーション別:
${Object.entries(inspirationCounts).length > 0 
  ? Object.entries(inspirationCounts).map(([k, v]) => `- ${k}: ${v}件`).join("\n")
  : "- なし"}

現在の系統: ${favoriteStyle ? (STYLE_LABELS[favoriteStyle] ?? favoriteStyle) : "未設定"}
なりたい系統: ${targetStyle ? (STYLE_LABELS[targetStyle] ?? targetStyle) : "未設定"}

【出力ルール】
- 必ずJSONのみを返してください。説明文は禁止です。
- suggestions は最大5件
- 各提案は reason（理由）と item（具体的なアイテム名）を含めてください
- 日本語で返してください

返却JSON:
{
  "summary": "全体的な分析コメント（2〜3文）",
  "suggestions": [
    {
      "item": "具体的なアイテム名（例: ベージュのトレンチコート）",
      "reason": "なぜ必要かの理由（1〜2文）",
      "priority": "high" | "medium" | "low"
    }
  ]
}
`.trim();

  let summary = "";
  let suggestions: { item: string; reason: string; priority: string }[] = [];

  try {
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_VISION_MODEL ?? "gpt-4o",
      temperature: 0.4,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.choices?.[0]?.message?.content ?? "";
    const jsonStart = text.indexOf("{");
    const jsonEnd = text.lastIndexOf("}");
    if (jsonStart !== -1 && jsonEnd !== -1) {
      const parsed = JSON.parse(text.slice(jsonStart, jsonEnd + 1));
      summary = parsed.summary ?? "";
      suggestions = Array.isArray(parsed.suggestions) ? parsed.suggestions.slice(0, 5) : [];
    }
  } catch (e) {
    console.error("LLM分析失敗:", e);
    summary = "分析コメントの生成に失敗しました。";
  }

  return NextResponse.json({
    categoryStats,
    styleStats,
    inspirationCounts,
    gapAnalysis,
    summary,
    suggestions,
    totalItems,
  });
}