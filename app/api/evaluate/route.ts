import OpenAI from "openai";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type ImageAnalysis = {
  detectedItems: string[];
  dominantColors: string[];
  styleGuess: string;
  seasonGuess: string;
  comment: string;
};

type EvaluationResult = {
  totalScore: number;
  colorScore: number;
  silhouetteScore: number;
  seasonScore: number;
  occasionScore: number;
  summary: string;
  goodPoints: string[];
  improvementPoints: string[];
  debug?: {
    imageName: string | null;
    imageType: string | null;
    imageSize: number | null;
  };
  analysis?: ImageAnalysis;
};

const occasionOptions = [
  { value: "casual", label: "カジュアル" },
  { value: "date", label: "デート" },
  { value: "office", label: "仕事" },
  { value: "formal", label: "フォーマル" },
  { value: "travel", label: "旅行" },
  { value: "school", label: "学校" },
];

const seasonOptions = [
  { value: "spring", label: "春" },
  { value: "summer", label: "夏" },
  { value: "autumn", label: "秋" },
  { value: "winter", label: "冬" },
];

const styleOptions = [
  { value: "casual", label: "カジュアル" },
  { value: "girly", label: "ガーリー" },
  { value: "street", label: "ストリート" },
  { value: "mode", label: "モード" },
  { value: "minimal", label: "ミニマル" },
  { value: "feminine", label: "フェミニン" },
  { value: "office", label: "オフィス" },
];

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();

    const image = formData.get("image");
    const occasion = formData.get("occasion");
    const season = formData.get("season");
    const style = formData.get("style");

    if (!(image instanceof File)) {
      return NextResponse.json(
        { error: "画像ファイルは必須です" },
        { status: 400 }
      );
    }

    if (
      typeof occasion !== "string" ||
      typeof season !== "string" ||
      typeof style !== "string" ||
      !occasion ||
      !season ||
      !style
    ) {
      return NextResponse.json(
        { error: "occasion, season, style は必須です" },
        { status: 400 }
      );
    }

const normalizedImageType = (image.type || "").toLowerCase();

if (
  normalizedImageType.includes("heic") ||
  normalizedImageType.includes("heif")
) {
  return NextResponse.json(
    {
      error:
        "iPhoneのHEIC画像はまだ未対応です。JPEGまたはPNGの画像で試してください。",
    },
    { status: 400 }
  );
}

if (image.size > 5 * 1024 * 1024) {
  return NextResponse.json(
    { error: "画像サイズが大きすぎます。5MB以下で試してください。" },
    { status: 400 }
  );
}

    const bytes = await image.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64 = buffer.toString("base64");
    const mimeType = normalizedImageType || "image/jpeg";
    const dataUrl = `data:${mimeType};base64,${base64}`;

    const analysis = await analyzeImageWithVision({
      dataUrl,
      occasion,
      season,
      style,
    });

      const result = await buildEvaluation({
        occasion,
        season,
        style,
        image,
        analysis,
      });


    return NextResponse.json(result);
  } catch (error) {
    console.error("POST /api/evaluate error:", error);

    const rawMessage =
      error instanceof Error ? error.message : "";

    const friendlyMessage =
      rawMessage.includes("expected pattern")
        ? "画像の形式またはサイズの処理に失敗しました。別の画像でもう一度試してください。"
        : rawMessage.includes("JSON")
        ? "画像の解析に失敗しました。別の画像でもう一度お試しください。"
        : rawMessage.includes("OpenAI")
        ? "現在評価機能が混み合っています。少し時間をおいてもう一度お試しください。"
        : "コーデ評価に失敗しました。時間をおいてもう一度お試しください。";

    return NextResponse.json(
      {
        error: friendlyMessage,
      },
      { status: 500 }
    );
  }

async function analyzeImageWithVision(params: {
  dataUrl: string;
  occasion: string;
  season: string;
  style: string;
}): Promise<ImageAnalysis> {
  const { dataUrl, occasion, season, style } = params;

  const completion = await client.chat.completions.create({
    model: "gpt-4.1-mini",
    temperature: 0.2,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: [
          "あなたはファッション画像解析アシスタントです。",
          "入力されたコーデ画像を解析して、必ずJSONのみ返してください。",
          "分からないことは推測しすぎず、画像から読み取れる範囲で答えてください。",
          "styleGuess は casual / girly / street / mode / minimal / feminine / office のいずれかにしてください。",
          "seasonGuess は spring / summer / autumn / winter のいずれかにしてください。",
          "detectedItems は日本語で返してください。例: トップス, ボトムス, アウター, シューズ, バッグ, ワンピース",
          "dominantColors は日本語で返してください。例: ホワイト, ブラック, グレー, ベージュ, ブルー, グリーン, ピンク",
          "comment は簡潔な1文にしてください。",
          "返却形式:",
          "{",
          '  "detectedItems": ["トップス", "ボトムス"],',
          '  "dominantColors": ["ブラック", "ホワイト"],',
          '  "styleGuess": "casual",',
          '  "seasonGuess": "winter",',
          '  "comment": "モノトーンでカジュアル寄りの印象です。"',
          "}",
        ].join("\n"),
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `TPO: ${occasion}\n季節: ${season}\nなりたい系統: ${style}\nこのコーデ画像を解析してください。`,
          },
          {
            type: "image_url",
            image_url: {
              url: dataUrl,
            },
          },
        ],
      },
    ],
  });

  const raw = completion.choices[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(raw) as ImageAnalysis;

  return {
    detectedItems: Array.isArray(parsed.detectedItems) ? parsed.detectedItems : [],
    dominantColors: Array.isArray(parsed.dominantColors) ? parsed.dominantColors : [],
    styleGuess: parsed.styleGuess ?? "casual",
    seasonGuess: parsed.seasonGuess ?? "spring",
    comment: parsed.comment ?? "シンプルなコーデに見えます。",
  };
}
async function generateEvaluationComment(params: {
  occasion: string;
  season: string;
  style: string;
  analysis: ImageAnalysis;
  totalScore: number;
}) {
  const { occasion, season, style, analysis, totalScore } = params;

  const response = await client.responses.create({
    model: "gpt-4.1-mini",
    input: [
      {
        role: "system",
        content: `
あなたはファッションコーデ評価AIです。

以下の情報を元に、JSON形式で評価コメントを生成してください。

ルール:
- 必ずJSONのみ返す
- summaryは1〜2文
- goodPointsは3つ
- improvementPointsは3つ
- 抽象的すぎず、具体的に
        `,
      },
      {
        role: "user",
        content: `
TPO: ${occasion}
季節: ${season}
なりたい系統: ${style}

検出アイテム: ${analysis.detectedItems.join(",")}
色: ${analysis.dominantColors.join(",")}
印象: ${analysis.comment}

スコア: ${totalScore}
        `,
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "evaluation_comment",
        schema: {
          type: "object",
          properties: {
            summary: { type: "string" },
            goodPoints: {
              type: "array",
              items: { type: "string" },
            },
            improvementPoints: {
              type: "array",
              items: { type: "string" },
            },
          },
          required: ["summary", "goodPoints", "improvementPoints"],
        },
      },
    },
  });

  return JSON.parse(response.output_text);
}

async function buildEvaluation(params: {
  occasion: string;
  season: string;
  style: string;
  image: File;
  analysis: {
    detectedItems: string[];
    dominantColors: string[];
    styleGuess: string;
    seasonGuess: string;
    comment: string;
  };
}) {
  const { occasion, season, style, analysis } = params;

  // ======================
  // ① ベーススコア
  // ======================
  let baseScore = 70;

  // シーン適合
  if (occasion === "date") baseScore += 4;
  if (occasion === "office") baseScore += 3;

  // 季節適合
  if (season && analysis.seasonGuess === season) baseScore += 4;

  // スタイル適合
  if (style && analysis.styleGuess === style) baseScore += 4;

  // ======================
  // ② カラー評価
  // ======================
  const colorCount = analysis.dominantColors.length;

  let colorScore = 18;

  if (colorCount <= 3) colorScore += 4;
  if (colorCount === 1) colorScore -= 2;

  if (style === "minimal") {
    if (colorCount <= 3) colorScore += 2;
  }

  colorScore = Math.min(colorScore, 24);

  // ======================
  // ③ シルエット評価
  // ======================
  const hasTop = analysis.detectedItems.includes("トップス");
  const hasBottom =
    analysis.detectedItems.includes("ボトムス") ||
    analysis.detectedItems.includes("ワンピース");

  let silhouetteScore = 18;

  if (hasTop) silhouetteScore += 2;
  if (hasBottom) silhouetteScore += 2;

  silhouetteScore = Math.min(silhouetteScore, 24);

  // ======================
  // ④ 季節スコア
  // ======================
  let seasonScore = 18;

  if (season && analysis.seasonGuess === season) {
    seasonScore += 4;
  } else {
    seasonScore += 2;
  }

  seasonScore = Math.min(seasonScore, 24);

  // ======================
  // ⑤ シーンスコア
  // ======================
  let occasionScore = 18;

  if (style === "office" && occasion === "office") {
    occasionScore += 4;
  } else {
    occasionScore += 2;
  }

  occasionScore = Math.min(occasionScore, 24);

  // ======================
  // ⑥ 合計スコア
  // ======================
  const totalScore = Math.min(
    baseScore +
      (colorScore - 18) +
      (silhouetteScore - 18) +
      (seasonScore - 18) +
      (occasionScore - 18),
    95
  );

  // ======================
  // ⑦ LLM用 breakdown（←ここ超重要）
  // ======================
  const breakdown = {
    occasion: occasionScore,
    style: style && analysis.styleGuess === style ? 22 : 18,
    color: colorScore,
    preference: 20, // 仮（あとでユーザー嗜好入れる）
    rewear: 18,
    setupBonus: hasTop && hasBottom ? 2 : 0,
    suitBonus: style === "office" ? 2 : 0,
    moodCohesionBonus: colorCount <= 3 ? 2 : 0,
    versatilityBonus: 2,
    harmonyPenalty: colorCount >= 5 ? 2 : 0,
    styleHarmonyPenalty:
      style && analysis.styleGuess !== style ? 2 : 0,
  };

  // ======================
  // ⑧ summary（暫定）
  // ======================
  const summary = "全体としてバランスの取れたコーデです";

  // ======================
  // ⑨ good / improvement（暫定）
  // ======================
  const goodPoints = [
    colorCount <= 3 ? "色数がまとまっている" : "色使いに個性がある",
    hasTop && hasBottom ? "コーデとして成立している" : "構成がシンプル",
  ];

  const improvementPoints = [
    colorCount >= 5 ? "色数を少し絞るとまとまりやすい" : "小物でアクセントを足しても◎",
  ];

  // LLMコメント生成
  const llmComment = await buildEvaluateCommentWithLlm({
    occasion,
    season,
    style,
    totalScore,
    colorScore,
    silhouetteScore,
    seasonScore,
    occasionScore,
    analysis,
    fallbackSummary: summary,
    fallbackGoodPoints: goodPoints,
    fallbackImprovementPoints: improvementPoints,
  });

  return {
    totalScore,
    colorScore,
    silhouetteScore,
    seasonScore,
    occasionScore,
    summary: llmComment?.summary ?? summary,
    goodPoints: llmComment?.goodPoints ?? goodPoints,
    improvementPoints: llmComment?.improvementPoints ?? improvementPoints,
    breakdown,
  };
}

async function buildEvaluateCommentWithLlm(params: {
  occasion: string;
  season: string;
  style: string;
  totalScore: number;
  colorScore: number;
  silhouetteScore: number;
  seasonScore: number;
  occasionScore: number;
  analysis: ImageAnalysis;
  fallbackSummary: string;
  fallbackGoodPoints: string[];
  fallbackImprovementPoints: string[];
}): Promise<{
  summary: string;
  goodPoints: string[];
  improvementPoints: string[];
} | null> {
  try {
    const completion = await client.chat.completions.create({
      model: process.env.OPENAI_TEXT_MODEL || "gpt-4.1-mini",
      temperature: 0.7,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: [
            "あなたは日本語のAIスタイリストです。",
            "ユーザーに返すコーデ評価コメントを作成してください。",
            "出力は必ずJSONのみ。",
            "ポジティブ寄りだが過剰に持ち上げすぎない。",
            "良い点は具体的に、改善点はきつく言いすぎず実用的に。",
            "goodPoints と improvementPoints は各2〜4件。",
            "summary は2〜4文程度の自然な日本語。",
          ].join("\n"),
        },
        {
          role: "user",
          content: JSON.stringify({
            instruction:
              "次の評価結果をもとに、summary / goodPoints / improvementPoints を日本語で生成してください。",
            input: {
              occasion: params.occasion,
              season: params.season,
              style: params.style,
              totalScore: params.totalScore,
              colorScore: params.colorScore,
              silhouetteScore: params.silhouetteScore,
              seasonScore: params.seasonScore,
              occasionScore: params.occasionScore,
              analysis: params.analysis,
            },
            fallback: {
              summary: params.fallbackSummary,
              goodPoints: params.fallbackGoodPoints,
              improvementPoints: params.fallbackImprovementPoints,
            },
            responseFormat: {
              summary: "string",
              goodPoints: ["string", "string"],
              improvementPoints: ["string", "string"],
            },
          }),
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw) as {
      summary?: string;
      goodPoints?: string[];
      improvementPoints?: string[];
    };

    const summary =
      typeof parsed.summary === "string" && parsed.summary.trim()
        ? parsed.summary.trim()
        : params.fallbackSummary;

    const goodPoints =
      Array.isArray(parsed.goodPoints) &&
      parsed.goodPoints.filter((v): v is string => typeof v === "string" && v.trim().length > 0)
        .length > 0
        ? parsed.goodPoints
            .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
            .slice(0, 4)
        : params.fallbackGoodPoints;

    const improvementPoints =
      Array.isArray(parsed.improvementPoints) &&
      parsed.improvementPoints.filter(
        (v): v is string => typeof v === "string" && v.trim().length > 0
      ).length > 0
        ? parsed.improvementPoints
            .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
            .slice(0, 4)
        : params.fallbackImprovementPoints;

    return {
      summary,
      goodPoints,
      improvementPoints,
    };
  } catch (error) {
    console.error("evaluate comment LLM fallback:", error);
    return null;
  }
}

function buildSummary(params: {
  occasion: string;
  season: string;
  style: string;
  totalScore: number;
  analysis: ImageAnalysis;
}) {
  const occasionLabel = getOccasionLabel(params.occasion);
  const seasonLabel = getSeasonLabel(params.season);
  const styleLabel = getStyleLabel(params.style);

  return `${occasionLabel}を意識した${styleLabel}寄りのコーデとしてまとまりがあり、${seasonLabel}らしさも出しやすいバランスです。画像解析では「${params.analysis.comment}」という印象で、全体として ${params.totalScore} 点のかなり取り入れやすいコーデです。`;
}

function buildGoodPoints(params: {
  occasion: string;
  season: string;
  style: string;
  analysis: ImageAnalysis;
}) {
  const points = [
    "全体の方向性がそろっていて、コーデの意図が伝わりやすい",
    "色のまとまりがあり、ちぐはぐに見えにくい",
    "アイテム同士のバランスが取りやすく、普段使いしやすい",
  ];

  if (params.analysis.dominantColors.length <= 3) {
    points.push("色数が絞られていて、全体の統一感が出しやすい");
  }

  if (params.occasion === "office") {
    points.push("きちんと感があり、仕事シーンにもなじみやすい");
  }

  if (params.occasion === "date") {
    points.push("やわらかい雰囲気が出しやすく、親しみやすい印象につながる");
  }

  if (params.style === "mode") {
    points.push("雰囲気が出やすく、ファッション感度の高い印象を作りやすい");
  }

  return points.slice(0, 4);
}

function buildImprovementPoints(params: {
  occasion: string;
  season: string;
  style: string;
  analysis: ImageAnalysis;
}) {
  const points = [
    "足元かバッグで少し抜け感を足すと、より洗練されて見えやすい",
    "アクセサリーや小物で系統を補強すると完成度が上がりやすい",
    "シルエットにメリハリを足すと、全体の印象がさらに整いやすい",
  ];

  if (params.analysis.dominantColors.length >= 4) {
    points.push("色数を少し絞ると、よりまとまりやすくなります");
  }

  if (params.season === "summer") {
    points.push("素材感を軽く見せると、季節感がさらに出しやすい");
  }

  if (params.occasion === "formal") {
    points.push(
      "よりきれいめな靴やバッグに寄せると、フォーマル度が上がりやすい"
    );
  }

  if (params.style === "casual") {
    points.push(
      "どこか1点だけ締めるアイテムを入れると、ラフすぎる印象を避けやすい"
    );
  }

  return points.slice(0, 4);
}

function getOccasionLabel(value: string) {
  return occasionOptions.find((option) => option.value === value)?.label ?? value;
}

function getSeasonLabel(value: string) {
  return seasonOptions.find((option) => option.value === value)?.label ?? value;
}

function getStyleLabel(value: string) {
  return styleOptions.find((option) => option.value === value)?.label ?? value;
}
}