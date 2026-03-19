import OpenAI from "openai";
import { NextResponse } from "next/server";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const ALLOWED_CATEGORY_VALUES = [
  "tops",
  "bottoms",
  "onepiece",
  "outer",
  "shoes",
  "bag",
] as const;

const ALLOWED_SUBCATEGORY_VALUES = {
  tops: [
    "knit",
    "tshirt",
    "shirt",
    "blouse",
    "hoodie",
    "cardigan",
    "sweat",
    "office_shirt",
  ],
  bottoms: [
    "denim",
    "slacks",
    "skirt",
    "shorts",
    "wide_pants",
    "flare_pants",
    "sweatpants",
    "office_pants",
    "office_skirt",
  ],
  onepiece: ["dress", "shirt_dress", "knit_dress", "jumper_skirt"],
  outer: [
    "jacket",
    "coat",
    "blouson",
    "trench",
    "down",
    "parka",
    "office_jacket",
  ],
  shoes: ["sneakers", "boots", "pumps", "sandals", "loafers", "heels"],
  bag: ["shoulder_bag", "tote_bag", "backpack", "handbag", "mini_bag"],
} as const;

const ALLOWED_COLOR_VALUES = [
  "white",
  "black",
  "gray",
  "beige",
  "brown",
  "navy",
  "blue",
  "red",
  "pink",
  "green",
  "yellow",
] as const;

const ALLOWED_SEASON_VALUES = ["spring", "summer", "autumn", "winter"] as const;

const ALLOWED_STYLE_VALUES = [
  "casual",
  "girly",
  "street",
  "mode",
  "minimal",
  "feminine",
  "office",
] as const;

const SPLITTABLE_CATEGORY_VALUES = [
  "tops",
  "bottoms",
  "onepiece",
  "outer",
  "shoes",
  "bag",
] as const;

type AllowedCategory = (typeof ALLOWED_CATEGORY_VALUES)[number];
type AllowedSubCategory = {
  [K in keyof typeof ALLOWED_SUBCATEGORY_VALUES]: (typeof ALLOWED_SUBCATEGORY_VALUES)[K][number];
}[keyof typeof ALLOWED_SUBCATEGORY_VALUES];
type AllowedColor = (typeof ALLOWED_COLOR_VALUES)[number];
type AllowedSeason = (typeof ALLOWED_SEASON_VALUES)[number];
type AllowedStyle = (typeof ALLOWED_STYLE_VALUES)[number];
type AnalyzeMode = "single_item" | "outfit_photo" | "split_candidate";
type CandidateStatus = "draft" | "needs_review" | "split_generated";
type CandidateConfidence = "high" | "medium" | "low";
type SourceType = "detected" | "split";

type SingleAnalyzeResponse = {
  name: string | null;
  category: AllowedCategory | null;
  subCategory: AllowedSubCategory | null;
  color: AllowedColor[];
  season: AllowedSeason[];
  styleTags: AllowedStyle[];
  formality: number | null;
  brand: string | null;
  memo: string | null;
};

type CandidateVisibility = {
  partiallyVisible: boolean;
  overlapped: boolean;
  ambiguousBoundary: boolean;
};

type CandidateBBox = {
  x: number;
  y: number;
  w: number;
  h: number;
};

type OutfitAnalyzeCandidate = {
  candidateId: string;
  labelIndex: number;
  sourceType: SourceType;
  sourceCandidateId: string | null;
  status: CandidateStatus;
  confidence: CandidateConfidence;
  needsReview: boolean;
  name: string | null;
  category: AllowedCategory | null;
  subCategory: AllowedSubCategory | null;
  color: AllowedColor[];
  season: AllowedSeason[];
  styleTags: AllowedStyle[];
  formality: number | null;
  brand: string | null;
  memo: string | null;
  note: string | null;
  reasons: string[];
  visibility: CandidateVisibility;
  bbox: CandidateBBox | null;
};

type OutfitAnalyzeResponse = {
  success: true;
  mode: Exclude<AnalyzeMode, "single_item">;
  image: {
    sourceImageUrl: string | null;
    width: number | null;
    height: number | null;
  };
  summary: {
    detectedCount: number;
    needsReviewCount: number;
    message: string;
  };
  candidates: OutfitAnalyzeCandidate[];
  warnings: string[];
};

const SINGLE_ITEM_PROMPT = `
あなたはファッション登録補助AIです。
目的は、ユーザーがアップロードした「1着の服またはバッグ/靴」の画像を見て、
Closet AI 用の登録候補を JSON で返すことです。

絶対ルール:
- 必ず JSON のみを返してください。前置きや説明文は禁止です。
- 画像には原則1アイテムだけ写っている前提です。
- 推測しすぎないでください。自信がない項目は null または空配列にしてください。
- 許可された候補以外の値は返さないでください。
- category は必ず次のどれか、または null:
  ${JSON.stringify(ALLOWED_CATEGORY_VALUES)}
- color は次の候補から最大2つまで:
  ${JSON.stringify(ALLOWED_COLOR_VALUES)}
- season は次の候補のみ:
  ${JSON.stringify(ALLOWED_SEASON_VALUES)}
- styleTags は次の候補のみ:
  ${JSON.stringify(ALLOWED_STYLE_VALUES)}

subCategory の候補:
${JSON.stringify(ALLOWED_SUBCATEGORY_VALUES, null, 2)}

判定方針:
- 仕事用シャツなら office_shirt
- スーツパンツなら office_pants
- スーツスカートなら office_skirt
- スーツジャケットなら office_jacket
- それ以外は見た目に最も近い通常 subCategory
- formality は 1〜5 で返してよいが、分からなければ null
- brand は画像から確信できる場合のみ。分からなければ null
- memo には「判断理由」や「不確実な点」を短く日本語で入れてください

返却JSONの型:
{
  "name": string | null,
  "category": string | null,
  "subCategory": string | null,
  "color": string[],
  "season": string[],
  "styleTags": string[],
  "formality": number | null,
  "brand": string | null,
  "memo": string | null
}
`.trim();

const OUTFIT_PHOTO_PROMPT = `
You are an AI that analyzes outfit photos and extracts clothing items.

Return clothing candidates in JSON.

IMPORTANT RULES:

- bbox must tightly bound the item itself, not the surrounding body area.
- Do not include head, arms, or torso when detecting tops.
- For bottoms, include only the waist-to-hem region.
- For shoes, bound the shoe itself, not the whole foot or leg.
- For bags, focus on the bag body rather than the arm holding it.
- bbox coordinates must be normalized between 0 and 1.
- x,y represent top-left corner, w,h represent width and height.

Output text fields in Japanese.

- note must be Japanese
- reasons must be Japanese
- category must be one of the following or null:
${JSON.stringify(ALLOWED_CATEGORY_VALUES)}

- color must be chosen from the following values (max 2):
${JSON.stringify(ALLOWED_COLOR_VALUES)}

- season must be chosen from the following values:
${JSON.stringify(ALLOWED_SEASON_VALUES)}

- styleTags must be chosen from the following values:
${JSON.stringify(ALLOWED_STYLE_VALUES)}

- confidence must be one of: "high", "medium", "low"

- status must be either "draft" or "needs_review"

Allowed subCategory values:
${JSON.stringify(ALLOWED_SUBCATEGORY_VALUES, null, 2)}

IMPORTANT DETECTION RULES:
- If clothing looks like one piece but could be separated, prefer detecting tops and bottoms instead of forcing "onepiece".
- If items are partially occluded, overlapped, or boundaries are unclear, reflect that uncertainty in the visibility fields and confidence.
- bbox values must be normalized between 0 and 1.
- bbox.x and bbox.y represent the top-left corner.
- bbox.w and bbox.h represent width and height.
- bbox must tightly bound the detected item itself as much as possible.
- Prefer tighter bounding boxes rather than large loose ones.
- Do not include unrelated body parts.
- Do not include the whole upper body when detecting tops; focus on the garment itself.
- For tops, include the neckline, sleeves, and hem of the garment.
- For bottoms, include the waist-to-hem region only.
- For shoes, bound the shoe itself, not the whole foot or leg.
- For bags, focus on the bag body rather than the arm or hand holding it.
- Because numeric labels will be placed on the image using bbox, return bbox values that visually correspond to the detected item position.
- If bbox is unclear, return null.
- note and reasons must be written in Japanese, briefly.
- brand should only be filled when reasonably confident.
- formality must be an integer from 1 to 5, or null if unknown.

Expected JSON response:
{
  "candidates": [
    {
      "name": string | null,
      "category": string | null,
      "subCategory": string | null,
      "color": string[],
      "season": string[],
      "styleTags": string[],
      "formality": number | null,
      "brand": string | null,
      "memo": string | null,
      "note": string | null,
      "reasons": string[],
      "confidence": "high" | "medium" | "low",
      "needsReview": boolean,
      "status": "draft" | "needs_review",
      "visibility": {
        "partiallyVisible": boolean,
        "overlapped": boolean,
        "ambiguousBoundary": boolean
      },
      "bbox": {
        "x": number,
        "y": number,
        "w": number,
        "h": number
      } | null
    }
  ],
  "warnings": string[]
}
`.trim();

function buildSplitPrompt(splitTargets: string[]) {
  return `
You are an AI assistant that helps register clothing items from outfit photos.

The user has indicated that the following detected candidates should be split into separate items.

Your task is to reanalyze the outfit photo and return clothing item candidates that match the specified categories.

Target categories to split:
${JSON.stringify(splitTargets)}

STRICT RULES:

- Return JSON only. Do not include explanations or text before or after the JSON.
- Only return candidates whose category matches the splitTargets list.
- Return at most ${splitTargets.length} candidates.
- Do not guess aggressively. If uncertain, return null or an empty array.
- If the detection is unclear, set needsReview to true.

- category must be one of the following or null:
${JSON.stringify(ALLOWED_CATEGORY_VALUES)}

- color must be chosen from the following values (max 2):
${JSON.stringify(ALLOWED_COLOR_VALUES)}

- season must be chosen from the following values:
${JSON.stringify(ALLOWED_SEASON_VALUES)}

- styleTags must be chosen from the following values:
${JSON.stringify(ALLOWED_STYLE_VALUES)}

- confidence must be one of: "high", "medium", "low"
- status must be either "split_generated" or "needs_review"

Allowed subCategory values:
${JSON.stringify(ALLOWED_SUBCATEGORY_VALUES, null, 2)}

IMPORTANT DETECTION RULES:

- Do not return categories that are not included in splitTargets.
- bbox values must be normalized between 0 and 1.
- bbox.x and bbox.y represent the top-left corner.
- bbox.w and bbox.h represent width and height.
- bbox must tightly bound the detected item itself.

- Do not include unrelated body parts.
- For tops, include neckline, sleeves, and garment hem.
- For bottoms, include the waist-to-hem region only.
- For shoes, bound the shoe itself rather than the entire leg or foot.
- For bags, focus on the bag body rather than the strap.

- If bbox is unclear, return null.
- note and reasons must be written briefly in Japanese.

Expected JSON response:
{
  "candidates": [
    {
      "name": string | null,
      "category": string | null,
      "subCategory": string | null,
      "color": string[],
      "season": string[],
      "styleTags": string[],
      "formality": number | null,
      "brand": string | null,
      "memo": string | null,
      "note": string | null,
      "reasons": string[],
      "confidence": "high" | "medium" | "low",
      "needsReview": boolean,
      "status": "split_generated" | "needs_review",
      "visibility": {
        "partiallyVisible": boolean,
        "overlapped": boolean,
        "ambiguousBoundary": boolean
      },
      "bbox": {
        "x": number,
        "y": number,
        "w": number,
        "h": number
      } | null
    }
  ],
  "warnings": string[]
}
`.trim();
}

function isAllowedCategory(value: unknown): value is AllowedCategory {
  return typeof value === "string" && ALLOWED_CATEGORY_VALUES.includes(value as AllowedCategory);
}

function sanitizeArray<T extends string>(values: unknown, allowed: readonly T[]) {
  if (!Array.isArray(values)) return [];
  return values.filter(
    (value): value is T => typeof value === "string" && allowed.includes(value as T)
  );
}

function sanitizeNullableString(value: unknown) {
  return typeof value === "string" ? value.trim() || null : null;
}

function sanitizeSubCategory(category: AllowedCategory | null, subCategory: unknown) {
  if (!category || typeof subCategory !== "string") return null;
  const allowed =
    ALLOWED_SUBCATEGORY_VALUES[category as keyof typeof ALLOWED_SUBCATEGORY_VALUES] ?? [];
  return allowed.includes(subCategory as never) ? (subCategory as AllowedSubCategory) : null;
}

function sanitizeFormality(value: unknown) {
  if (typeof value !== "number" || Number.isNaN(value)) return null;
  if (value < 1 || value > 5) return null;
  return Math.round(value);
}

function sanitizeConfidence(value: unknown): CandidateConfidence {
  if (value === "high" || value === "medium" || value === "low") return value;
  return "low";
}

function sanitizeStatus(value: unknown, fallback: CandidateStatus): CandidateStatus {
  if (value === "draft" || value === "needs_review" || value === "split_generated") {
    return value;
  }
  return fallback;
}

function sanitizeBoolean(value: unknown, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function sanitizeBBox(value: unknown): CandidateBBox | null {
  if (!value || typeof value !== "object") return null;

  const raw = value as Record<string, unknown>;
  const x = typeof raw.x === "number" ? raw.x : null;
  const y = typeof raw.y === "number" ? raw.y : null;
  const w = typeof raw.w === "number" ? raw.w : null;
  const h = typeof raw.h === "number" ? raw.h : null;

  if ([x, y, w, h].some((v) => v === null || Number.isNaN(v))) return null;

  return {
    x: clamp01(x!),
    y: clamp01(y!),
    w: clamp01(w!),
    h: clamp01(h!),
  };
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function sanitizeSingleResponse(parsed: any): SingleAnalyzeResponse {
  const category = isAllowedCategory(parsed?.category) ? parsed.category : null;

  return {
    name: sanitizeNullableString(parsed?.name),
    category,
    subCategory: sanitizeSubCategory(category, parsed?.subCategory),
    color: sanitizeArray(parsed?.color, ALLOWED_COLOR_VALUES).slice(0, 2),
    season: sanitizeArray(parsed?.season, ALLOWED_SEASON_VALUES),
    styleTags: sanitizeArray(parsed?.styleTags, ALLOWED_STYLE_VALUES),
    formality: sanitizeFormality(parsed?.formality),
    brand: sanitizeNullableString(parsed?.brand),
    memo: sanitizeNullableString(parsed?.memo),
  };
}

function sanitizeCandidate(
  parsed: any,
  index: number,
  sourceType: SourceType,
  sourceCandidateId: string | null,
  fallbackStatus: CandidateStatus
): OutfitAnalyzeCandidate {
  const category = isAllowedCategory(parsed?.category) ? parsed.category : null;
  const needsReview = sanitizeBoolean(parsed?.needsReview, false);

  const visibility = {
    partiallyVisible: sanitizeBoolean(parsed?.visibility?.partiallyVisible, false),
    overlapped: sanitizeBoolean(parsed?.visibility?.overlapped, false),
    ambiguousBoundary: sanitizeBoolean(parsed?.visibility?.ambiguousBoundary, false),
  };

  const resolvedNeedsReview =
    needsReview ||
    category === null ||
    visibility.partiallyVisible ||
    visibility.overlapped ||
    visibility.ambiguousBoundary;

  const fallbackConfidence: CandidateConfidence = resolvedNeedsReview ? "low" : "medium";

  return {
    candidateId: `cand_${Date.now()}_${index + 1}_${Math.random().toString(36).slice(2, 8)}`,
    labelIndex: index + 1,
    sourceType,
    sourceCandidateId,
    status: sanitizeStatus(parsed?.status, resolvedNeedsReview ? "needs_review" : fallbackStatus),
    confidence: sanitizeConfidence(parsed?.confidence ?? fallbackConfidence),
    needsReview: resolvedNeedsReview,
    name: sanitizeNullableString(parsed?.name),
    category,
    subCategory: sanitizeSubCategory(category, parsed?.subCategory),
    color: sanitizeArray(parsed?.color, ALLOWED_COLOR_VALUES).slice(0, 2),
    season: sanitizeArray(parsed?.season, ALLOWED_SEASON_VALUES),
    styleTags: sanitizeArray(parsed?.styleTags, ALLOWED_STYLE_VALUES),
    formality: sanitizeFormality(parsed?.formality),
    brand: sanitizeNullableString(parsed?.brand),
    memo: sanitizeNullableString(parsed?.memo),
    note: sanitizeNullableString(parsed?.note),
    reasons: Array.isArray(parsed?.reasons)
      ? parsed.reasons.filter((v: unknown): v is string => typeof v === "string").slice(0, 4)
      : [],
    visibility,
    bbox: sanitizeBBox(parsed?.bbox),
  };
}

function sanitizeWarnings(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string").slice(0, 5);
}

function sanitizeOutfitResponse(
  parsed: any,
  mode: "outfit_photo" | "split_candidate",
  sourceCandidateId: string | null
): OutfitAnalyzeResponse {
  const rawCandidates: any[] = Array.isArray(parsed?.candidates) ? parsed.candidates : [];
  const sourceType: SourceType = mode === "split_candidate" ? "split" : "detected";
  const fallbackStatus: CandidateStatus =
    mode === "split_candidate" ? "split_generated" : "draft";

  const candidates = rawCandidates
    .slice(0, 6)
    .map((candidate, index) =>
      sanitizeCandidate(candidate, index, sourceType, sourceCandidateId, fallbackStatus)
    );

  const needsReviewCount = candidates.filter((candidate) => candidate.needsReview).length;

  return {
    success: true,
    mode,
    image: {
      sourceImageUrl: null,
      width: null,
      height: null,
    },
    summary: {
      detectedCount: candidates.length,
      needsReviewCount,
      message:
        candidates.length > 0
          ? `${candidates.length}件のアイテム候補を検出しました。内容を確認して保存してください。`
          : "アイテム候補を検出できませんでした。",
    },
    candidates,
    warnings: sanitizeWarnings(parsed?.warnings),
  };
}

function extractJson(text: string) {
  const objectStart = text.indexOf("{");
  const objectEnd = text.lastIndexOf("}");

  if (objectStart !== -1 && objectEnd !== -1 && objectEnd > objectStart) {
    return text.slice(objectStart, objectEnd + 1);
  }

  throw new Error("AI応答からJSONを抽出できませんでした");
}

async function requestJsonFromVision(params: {
  prompt: string;
  imageDataUrl: string;
  userText: string;
}) {
  const model = process.env.OPENAI_VISION_MODEL;
  if (!model) {
    throw new Error("OPENAI_VISION_MODEL が設定されていません");
  }

  console.log("[items/analyze] requestJsonFromVision:start", {
    model,
    promptLength: params.prompt.length,
    userTextLength: params.userText.length,
    imageDataUrlLength: params.imageDataUrl.length,
    imageDataUrlPrefix: params.imageDataUrl.slice(0, 40),
  });

  let response;
  try {
    response = await openai.chat.completions.create({
      model,
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content: params.prompt,
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: params.userText,
            },
            {
              type: "image_url",
              image_url: {
                url: params.imageDataUrl,
              },
            },
          ],
        },
      ],
    });
  } catch (error) {
    console.error("[items/analyze] openai.chat.completions.create failed:", error);
    throw new Error(
      error instanceof Error
        ? `OpenAI呼び出し失敗: ${error.message}`
        : "OpenAI呼び出し失敗"
    );
  }

  const rawContent = response.choices?.[0]?.message?.content;

  console.log("[items/analyze] openai response received", {
    choicesLength: response.choices?.length ?? 0,
    contentType: typeof rawContent,
  });

  const text = typeof rawContent === "string" ? rawContent : "";

  console.log("[items/analyze] response text preview", text.slice(0, 500));

  if (!text.trim()) {
    throw new Error("OpenAIの応答テキストが空です");
  }

  let jsonText = "";
  try {
    jsonText = extractJson(text);
  } catch (error) {
    console.error("[items/analyze] extractJson failed. raw text:", text);
    throw new Error(
      error instanceof Error
        ? `JSON抽出失敗: ${error.message}`
        : "JSON抽出失敗"
    );
  }

  console.log("[items/analyze] extracted json preview", jsonText.slice(0, 500));

  try {
    return JSON.parse(jsonText);
  } catch (error) {
    console.error("[items/analyze] JSON.parse failed. jsonText:", jsonText);
    throw new Error(
      error instanceof Error
        ? `JSON解析失敗: ${error.message}`
        : "JSON解析失敗"
    );
  }
}

function resolveMode(value: unknown): AnalyzeMode {
  if (value === "outfit_photo" || value === "split_candidate" || value === "single_item") {
    return value;
  }
  return "single_item";
}

function sanitizeSplitTargets(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is (typeof SPLITTABLE_CATEGORY_VALUES)[number] =>
      typeof item === "string" &&
      SPLITTABLE_CATEGORY_VALUES.includes(item as (typeof SPLITTABLE_CATEGORY_VALUES)[number])
  );
}

export async function POST(req: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY が設定されていません" },
        { status: 500 }
      );
    }

const body = await req.json();
const imageDataUrl = body?.imageDataUrl;
const mode = resolveMode(body?.mode);
const sourceCandidateId =
  typeof body?.sourceCandidateId === "string" ? body.sourceCandidateId : null;
const splitTargets = sanitizeSplitTargets(body?.splitTargets);

console.log("[items/analyze] POST body parsed", {
  mode,
  hasImageDataUrl: typeof imageDataUrl === "string",
  imageDataUrlLength: typeof imageDataUrl === "string" ? imageDataUrl.length : 0,
  imageDataUrlPrefix:
    typeof imageDataUrl === "string" ? imageDataUrl.slice(0, 40) : null,
  sourceCandidateId,
  splitTargets,
});

    if (!imageDataUrl || typeof imageDataUrl !== "string") {
      return NextResponse.json({ error: "imageDataUrl が必要です" }, { status: 400 });
    }

    if (mode === "split_candidate" && splitTargets.length === 0) {
      return NextResponse.json(
        { error: "split_candidate では splitTargets が必要です" },
        { status: 400 }
      );
    }

    if (mode === "single_item") {
      console.log("[items/analyze] mode=single_item start");

      const parsed = await requestJsonFromVision({
        prompt: SINGLE_ITEM_PROMPT,
        imageDataUrl,
        userText: "この画像のアイテムを Closet AI の登録候補JSONとして返してください。",
      });

      console.log("[items/analyze] mode=single_item parsed", {
        keys: parsed && typeof parsed === "object" ? Object.keys(parsed) : [],
      });

      const sanitized = sanitizeSingleResponse(parsed);

      console.log("[items/analyze] mode=single_item sanitized", {
        category: sanitized.category,
        subCategory: sanitized.subCategory,
        colorCount: sanitized.color.length,
        seasonCount: sanitized.season.length,
        styleCount: sanitized.styleTags.length,
      });

      return NextResponse.json(sanitized);
    }

    if (mode === "outfit_photo") {
      console.log("[items/analyze] mode=outfit_photo start");

      const parsed = await requestJsonFromVision({
        prompt: OUTFIT_PHOTO_PROMPT,
        imageDataUrl,
        userText:
          "このコーデ写真に写っているアイテム候補を複数抽出し、Closet AI の候補JSONとして返してください。",
      });

      console.log("[items/analyze] mode=outfit_photo parsed", {
        keys: parsed && typeof parsed === "object" ? Object.keys(parsed) : [],
        rawCandidatesCount: Array.isArray(parsed?.candidates) ? parsed.candidates.length : 0,
        warningsCount: Array.isArray(parsed?.warnings) ? parsed.warnings.length : 0,
      });

      const sanitized = sanitizeOutfitResponse(parsed, "outfit_photo", null);

      console.log("[items/analyze] mode=outfit_photo sanitized", {
        candidateCount: sanitized.candidates.length,
        needsReviewCount: sanitized.summary.needsReviewCount,
        warningsCount: sanitized.warnings.length,
      });

      return NextResponse.json(sanitized);
    }

    console.log("[items/analyze] mode=split_candidate start", {
      sourceCandidateId,
      splitTargets,
    });

    const parsed = await requestJsonFromVision({
      prompt: buildSplitPrompt(splitTargets),
      imageDataUrl,
      userText: `この画像を再解析し、指定カテゴリ ${JSON.stringify(
        splitTargets
      )} に分けた候補JSONを返してください。`,
    });

    console.log("[items/analyze] mode=split_candidate parsed", {
      keys: parsed && typeof parsed === "object" ? Object.keys(parsed) : [],
      rawCandidatesCount: Array.isArray(parsed?.candidates) ? parsed.candidates.length : 0,
      warningsCount: Array.isArray(parsed?.warnings) ? parsed.warnings.length : 0,
    });

    const sanitized = sanitizeOutfitResponse(parsed, "split_candidate", sourceCandidateId);

    console.log("[items/analyze] mode=split_candidate sanitized", {
      candidateCount: sanitized.candidates.length,
      needsReviewCount: sanitized.summary.needsReviewCount,
      warningsCount: sanitized.warnings.length,
    });

return NextResponse.json(sanitized); 
} catch (error) {
  console.error("POST /api/items/analyze error:", error);

  return NextResponse.json(
    {
      error:
        error instanceof Error
          ? `画像解析に失敗しました: ${error.message}`
          : "画像解析に失敗しました",
    },
    { status: 500 }
  );
}
}