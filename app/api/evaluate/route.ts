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

    const bytes = await image.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64 = buffer.toString("base64");
    const mimeType = image.type || "image/jpeg";
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

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "コーデ評価に失敗しました",
      },
      { status: 500 }
    );
  }
}

async function analyzeImageWithVision(params: {
  dataUrl: string;
  occasion: string;
  season: string;
  style: string;
}): Promise<ImageAnalysis> {
  const { dataUrl, occasion, season, style } = params;

  const response = await client.responses.create({
    model: "gpt-4.1-mini",
    input: [
      {
        role: "system",
        content: [
          {
            type: "input_text",
            text: [
              "あなたはファッション画像解析アシスタントです。",
              "入力されたコーデ画像を解析して、必ず指定されたJSONだけを返してください。",
              "分からないことは推測しすぎず、画像から読み取れる範囲で答えてください。",
              "styleGuess は casual / girly / street / mode / minimal / feminine / office のいずれかにしてください。",
              "seasonGuess は spring / summer / autumn / winter のいずれかにしてください。",
              "detectedItems は日本語で返してください。例: トップス, ボトムス, アウター, シューズ, バッグ, ワンピース",
              "dominantColors は日本語で返してください。例: ホワイト, ブラック, グレー, ベージュ, ブルー, グリーン, ピンク",
              "comment は簡潔な1文にしてください。",
            ].join("\n"),
          },
        ],
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: `TPO: ${occasion}\n季節: ${season}\nなりたい系統: ${style}\nこのコーデ画像を解析してください。`,
          },
          {
            type: "input_image",
            image_url: dataUrl,
            detail: "high",
          },
        ],
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "image_analysis",
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            detectedItems: {
              type: "array",
              items: { type: "string" },
            },
            dominantColors: {
              type: "array",
              items: { type: "string" },
            },
            styleGuess: {
              type: "string",
              enum: [
                "casual",
                "girly",
                "street",
                "mode",
                "minimal",
                "feminine",
                "office",
              ],
            },
            seasonGuess: {
              type: "string",
              enum: ["spring", "summer", "autumn", "winter"],
            },
            comment: {
              type: "string",
            },
          },
          required: [
            "detectedItems",
            "dominantColors",
            "styleGuess",
            "seasonGuess",
            "comment",
          ],
        },
      },
    },
  });

  const parsed = JSON.parse(response.output_text) as ImageAnalysis;
  return parsed;
}

async function buildEvaluation(params: {
  occasion: string;
  season: string;
  style: string;
  image: File;
  analysis: ImageAnalysis;
}): Promise<EvaluationResult> {

  const { occasion, season, style, image, analysis } = params;

  let baseScore = 78;

  if (occasion === "date") baseScore += 3;
  if (occasion === "office") baseScore += 2;
  if (season === "autumn" || season === "winter") baseScore += 2;
  if (style === "minimal" || style === "office") baseScore += 2;

  if (analysis.dominantColors.length <= 3) baseScore += 2;
  if (
    analysis.detectedItems.includes("トップス") &&
    (analysis.detectedItems.includes("ボトムス") ||
      analysis.detectedItems.includes("ワンピース"))
  ) {
    baseScore += 2;
  }

  const totalScore = Math.min(baseScore, 95);

  const colorScore = Math.min(
    24,
    18 +
      (analysis.dominantColors.length <= 3 ? 3 : 1) +
      (style === "minimal" ? 2 : 0)
  );

  const silhouetteScore = Math.min(
    24,
    18 +
      (analysis.detectedItems.includes("トップス") ? 2 : 0) +
      (analysis.detectedItems.includes("ボトムス") ||
      analysis.detectedItems.includes("ワンピース")
        ? 2
        : 0)
  );

  const seasonScore = Math.min(
    24,
    18 + (analysis.seasonGuess === season ? 4 : 2)
  );

  const occasionScore = Math.min(
    24,
    18 + (style === "office" && occasion === "office" ? 4 : 3)
  );

  const fallbackSummary = buildSummary({
    occasion,
    season,
    style,
    totalScore,
    analysis,
  });

  const fallbackGoodPoints = buildGoodPoints({
    occasion,
    season,
    style,
    analysis,
  });

  const fallbackImprovementPoints = buildImprovementPoints({
    occasion,
    season,
    style,
    analysis,
  });

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
    fallbackSummary,
    fallbackGoodPoints,
    fallbackImprovementPoints,
  });

  return {
    totalScore,
    colorScore,
    silhouetteScore,
    seasonScore,
    occasionScore,
    summary: llmComment?.summary ?? fallbackSummary,
    goodPoints: llmComment?.goodPoints ?? fallbackGoodPoints,
    improvementPoints:
      llmComment?.improvementPoints ?? fallbackImprovementPoints,
    debug: {
      imageName: image.name ?? null,
      imageType: image.type ?? null,
      imageSize: typeof image.size === "number" ? image.size : null,
    },
    analysis,
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