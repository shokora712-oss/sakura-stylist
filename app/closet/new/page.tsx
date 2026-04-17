"use client";

import Link from "next/link";
import { ChangeEvent, useEffect, useMemo, useState } from "react";
import BottomNav from "@/app/components/BottomNav";

type ClosetMode = "image" | "outfit" | "manual";
type Category = "tops" | "bottoms" | "onepiece" | "outer" | "shoes" | "bag";
type SplitCategory = Category;
type Confidence = "high" | "medium" | "low";
type CandidateStatus = "draft" | "needs_review" | "split_generated";

type ClosetItem = {
  id: string;
  name: string | null;
  category: string;
  imageUrl: string | null;
  color: string[];
  styleTags: string[];
  subCategory: string | null;
};

type FormState = {
  name: string;
  category: string;
  subCategory: string;
  color: string[];
  material: string[];
  season: string[];
  styleTags: string[];
  inspirationTags: string[];
  formality: string;
  brand: string;
  memo: string;
};

type AnalyzeSingleResponse = {
  name: string | null;
  category: string | null;
  subCategory: string | null;
  color: string[];
  season: string[];
  styleTags: string[];
  inspirationTags: string[];
  formality: number | null;
  brand: string | null;
  memo: string | null;
  bbox: { x: number; y: number; w: number; h: number } | null;
};

type AnalyzeCandidate = {
  candidateId: string;
  labelIndex: number;
  sourceType: "detected" | "split";
  sourceCandidateId: string | null;
  status: CandidateStatus;
  confidence: Confidence;
  needsReview: boolean;
  name: string | null;
  category: string | null;
  subCategory: string | null;
  color: string[];
  season: string[];
  styleTags: string[];
  inspirationTags: string[];
  formality: number | null;
  brand: string | null;
  memo: string | null;
  note: string | null;
  reasons: string[];
  visibility: {
    partiallyVisible: boolean;
    overlapped: boolean;
    ambiguousBoundary: boolean;
  };
  bbox: { x: number; y: number; w: number; h: number } | null;
};

type AnalyzeOutfitResponse = {
  success: true;
  mode: "outfit_photo" | "split_candidate";
  image: { sourceImageUrl: string | null; width: number | null; height: number | null };
  summary: { detectedCount: number; needsReviewCount: number; message: string };
  candidates: AnalyzeCandidate[];
  warnings: string[];
};

type CandidateFormState = {
  candidateId: string;
  labelIndex: number;
  selected: boolean;
  excluded: boolean;
  edited: boolean;
  sourceType: "detected" | "split";
  sourceCandidateId: string | null;
  status: CandidateStatus;
  confidence: Confidence;
  needsReview: boolean;
  imageUrl: string | null;
  form: FormState;
  ui: {
    note: string | null;
    reasons: string[];
    partiallyVisible: boolean;
    overlapped: boolean;
    ambiguousBoundary: boolean;
  };
  bbox: { x: number; y: number; w: number; h: number } | null;
  similarItems: ClosetItem[];
  replaceItemId: string | null;
};

const CATEGORY_OPTIONS: { value: Category; label: string }[] = [
  { value: "tops", label: "トップス" },
  { value: "bottoms", label: "ボトムス" },
  { value: "onepiece", label: "ワンピース" },
  { value: "outer", label: "アウター" },
  { value: "shoes", label: "シューズ" },
  { value: "bag", label: "バッグ" },
];

const SUBCATEGORY_OPTIONS: Record<Category, { value: string; label: string }[]> = {
  tops: [
    { value: "knit", label: "ニット" },
    { value: "tshirt", label: "Tシャツ" },
    { value: "shirt", label: "シャツ" },
    { value: "blouse", label: "ブラウス" },
    { value: "hoodie", label: "パーカー" },
    { value: "cardigan", label: "カーディガン" },
    { value: "sweat", label: "スウェット" },
    { value: "vest", label: "ベスト" },
    { value: "office_shirt", label: "オフィスシャツ" },
  ],
  bottoms: [
    { value: "denim", label: "デニム" },
    { value: "slacks", label: "スラックス" },
    { value: "skirt", label: "スカート" },
    { value: "shorts", label: "ショートパンツ" },
    { value: "wide_pants", label: "ワイドパンツ" },
    { value: "flare_pants", label: "フレアパンツ" },
    { value: "sweatpants", label: "スウェットパンツ" },
    { value: "office_pants", label: "オフィスパンツ" },
    { value: "office_skirt", label: "オフィススカート" },
  ],
  onepiece: [
    { value: "dress", label: "ドレス" },
    { value: "shirt_dress", label: "シャツワンピ" },
    { value: "knit_dress", label: "ニットワンピ" },
    { value: "jumper_skirt", label: "ジャンスカ" },
  ],
  outer: [
    { value: "jacket", label: "ジャケット" },
    { value: "coat", label: "コート" },
    { value: "blouson", label: "ブルゾン" },
    { value: "trench", label: "トレンチ" },
    { value: "down", label: "ダウン" },
    { value: "parka", label: "パーカー" },
    { value: "office_jacket", label: "オフィスジャケット" },
  ],
  shoes: [
    { value: "sneakers", label: "スニーカー" },
    { value: "boots", label: "ブーツ" },
    { value: "pumps", label: "パンプス" },
    { value: "sandals", label: "サンダル" },
    { value: "loafers", label: "ローファー" },
    { value: "heels", label: "ヒール" },
  ],
  bag: [
    { value: "shoulder_bag", label: "ショルダーバッグ" },
    { value: "tote_bag", label: "トートバッグ" },
    { value: "backpack", label: "バックパック" },
    { value: "handbag", label: "ハンドバッグ" },
    { value: "mini_bag", label: "ミニバッグ" },
  ],
};

const COLOR_OPTIONS = [
  "white", "black", "gray", "beige", "brown", "navy", "blue", "red", "pink", "green", "yellow",
] as const;

const COLOR_LABELS: Record<(typeof COLOR_OPTIONS)[number], string> = {
  white: "ホワイト", black: "ブラック", gray: "グレー", beige: "ベージュ",
  brown: "ブラウン", navy: "ネイビー", blue: "ブルー", red: "レッド",
  pink: "ピンク", green: "グリーン", yellow: "イエロー",
};

const SEASON_OPTIONS = ["spring", "summer", "autumn", "winter"] as const;
const SEASON_LABELS: Record<(typeof SEASON_OPTIONS)[number], string> = {
  spring: "春", summer: "夏", autumn: "秋", winter: "冬",
};

const STYLE_OPTIONS = [
  "casual", "clean", "feminine", "girly", "simple", "natural", "elegant", "mode", "street", "sporty",
] as const;

const STYLE_LABELS: Record<(typeof STYLE_OPTIONS)[number], string> = {
  casual: "カジュアル", clean: "きれいめ", feminine: "フェミニン", girly: "ガーリー",
  simple: "シンプル", natural: "ナチュラル", elegant: "エレガント", mode: "モード",
  street: "ストリート", sporty: "スポーティ",
};

const INSPIRATION_OPTIONS = [
  "korean", "french", "overseas_girl", "city_girl", "japanese_feminine", "balletcore", "old_money", "y2k",
] as const;

const INSPIRATION_LABELS: Record<(typeof INSPIRATION_OPTIONS)[number], string> = {
  korean: "韓国系", french: "フレンチ", overseas_girl: "海外ガール", city_girl: "シティガール",
  japanese_feminine: "日本フェミニン", balletcore: "バレエコア", old_money: "オールドマネー", y2k: "Y2K",
};

const SPLIT_CATEGORY_OPTIONS: { value: SplitCategory; label: string }[] = [
  { value: "tops", label: "トップス" },
  { value: "bottoms", label: "ボトムス" },
  { value: "onepiece", label: "ワンピース" },
  { value: "outer", label: "アウター" },
  { value: "shoes", label: "シューズ" },
  { value: "bag", label: "バッグ" },
];

function calcSimilarityScore(candidate: AnalyzeCandidate, item: ClosetItem): number {
  // category不一致は即0
  if (candidate.category !== item.category) return 0;

  let score = 0;

  // subCategory一致
  if (candidate.subCategory && item.subCategory && candidate.subCategory === item.subCategory) {
    score += 40;
  }

  // color一致（候補の色がアイテムの色に含まれてるか）
  const candidateColors = candidate.color ?? [];
  const itemColors = item.color ?? [];
  const colorMatches = candidateColors.filter((c) => itemColors.includes(c)).length;
  score += colorMatches * 25;

  // styleTags一致
  const candidateStyles = candidate.styleTags ?? [];
  const itemStyles = item.styleTags ?? [];
  const styleMatches = candidateStyles.filter((s) => itemStyles.includes(s)).length;
  score += styleMatches * 15;

  return score;
}

function emptyForm(): FormState {
  return {
    name: "", category: "", subCategory: "", color: [], material: [],
    season: [], styleTags: [], inspirationTags: [], formality: "", brand: "", memo: "",
  };
}

function normalizeSubCategory(category: string, subCategory: string) {
  if (!category) return "";
  const options = SUBCATEGORY_OPTIONS[category as Category] ?? [];
  return options.some((opt) => opt.value === subCategory) ? subCategory : "";
}

function candidateToForm(candidate: AnalyzeCandidate): FormState {
  return {
    name: candidate.name ?? "",
    category: candidate.category ?? "",
    subCategory: candidate.category ? normalizeSubCategory(candidate.category, candidate.subCategory ?? "") : "",
    color: candidate.color ?? [],
    material: [],
    season: candidate.season ?? [],
    styleTags: candidate.styleTags ?? [],
    inspirationTags: candidate.inspirationTags ?? [],
    formality: typeof candidate.formality === "number" && Number.isFinite(candidate.formality)
      ? String(candidate.formality) : "",
    brand: candidate.brand ?? "",
    memo: candidate.memo ?? "",
  };
}

function formToPayload(form: FormState, imageUrl: string | null) {
  return {
    name: form.name.trim() || null,
    category: form.category,
    subCategory: form.subCategory || null,
    color: form.color,
    material: form.material,
    season: form.season,
    styleTags: form.styleTags,
    inspirationTags: form.inspirationTags,
    formality: form.formality ? Number(form.formality) : null,
    brand: form.brand.trim() || null,
    memo: form.memo.trim() || null,
    imageUrl,
  };
}

function classNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function buildApiErrorMessage(
  json: { error?: string; code?: string } | null,
  fallback: string
) {
  const message = json?.error ?? fallback;
  return json?.code ? `${message}（${json.code}）` : message;
}



async function compressImageFile(file: File): Promise<File> {
  const imageUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = imageUrl;
    });
    const maxWidth = 1600;
    const maxHeight = 1600;
    let { width, height } = img;
    if (width > maxWidth || height > maxHeight) {
      const ratio = Math.min(maxWidth / width, maxHeight / height);
      width = Math.round(width * ratio);
      height = Math.round(height * ratio);
    }
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("画像圧縮の初期化に失敗しました");
    ctx.drawImage(img, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", 0.82);
    });
    if (!blob) throw new Error("画像圧縮に失敗しました");
    const originalBaseName = file.name.replace(/\.[^.]+$/, "");
    return new File([blob], `${originalBaseName}.jpg`, { type: "image/jpeg" });
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
}

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === "string") resolve(result);
      else reject(new Error("FileReaderの結果が文字列ではありません"));
    };
    reader.onerror = () => reject(new Error("ファイルの読み込みに失敗しました"));
    reader.readAsDataURL(file);
  });
}

function getFallbackBbox(category: string | null): { x: number; y: number; w: number; h: number } {
  switch (category) {
    case "tops":
      return { x: 0.1, y: 0.10, w: 0.8, h: 0.45 };
    case "outer":
      return { x: 0.05, y: 0.05, w: 0.90, h: 0.60 };
    case "bottoms":
      return { x: 0.1, y: 0.45, w: 0.8, h: 0.45 };
    case "onepiece":
      return { x: 0.05, y: 0.05, w: 0.90, h: 0.85 };
    case "shoes":
      return { x: 0.2, y: 0.75, w: 0.6, h: 0.25 };
    case "bag":
    default:
      return { x: 0.1, y: 0.20, w: 0.8, h: 0.60 };
  }
}

async function cropCandidateImage(
  imageDataUrl: string,
  bbox: { x: number; y: number; w: number; h: number },
  category?: string | null
): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      let cropX = Math.floor(bbox.x * img.naturalWidth);
      let cropY = Math.floor(bbox.y * img.naturalHeight);
      let cropW = Math.floor(bbox.w * img.naturalWidth);
      let cropH = Math.floor(bbox.h * img.naturalHeight);
      if (cropW <= 0 || cropH <= 0) { resolve(null); return; }

      // bboxの品質チェック：怪しいbboxはカテゴリ別固定範囲にフォールバック
      const area = bbox.w * bbox.h;
      const isBboxSuspect =
        area > 0.70 ||
        area < 0.01 ||
        ((category === "tops" || category === "outer") && bbox.y < 0.25) ||
        (category === "shoes" && bbox.y < 0.65);

      if (isBboxSuspect) {
        const fallbackBbox = getFallbackBbox(category ?? null);
        cropX = Math.floor(fallbackBbox.x * img.naturalWidth);
        cropY = Math.floor(fallbackBbox.y * img.naturalHeight);
        cropW = Math.floor(fallbackBbox.w * img.naturalWidth);
        cropH = Math.floor(fallbackBbox.h * img.naturalHeight);
      }

      if (category === "shoes") {
        const maxH = Math.floor(cropW * 1.5);
        if (cropH > maxH) { cropY = cropY + Math.floor((cropH - maxH) / 2); cropH = maxH; }
      } else if (category === "bag") {
        const maxH = Math.floor(cropW * 1.5);
        if (cropH > maxH) { cropY = cropY + Math.floor((cropH - maxH) / 4); cropH = maxH; }
      } else if (category === "tops") {
        const maxH = Math.floor(cropW * 2);
        if (cropH > maxH) cropH = maxH;
      }
      const padding = 0.015;
      const padX = Math.floor(padding * img.naturalWidth);
      const padY = Math.floor(padding * img.naturalHeight);
      const finalX = Math.max(0, cropX - padX);
      const finalY = Math.max(0, cropY - padY);
      const finalW = Math.min(img.naturalWidth - finalX, cropW + padX * 2);
      const finalH = Math.min(img.naturalHeight - finalY, cropH + padY * 2);
      canvas.width = finalW;
      canvas.height = finalH;
      const ctx = canvas.getContext("2d");
      if (!ctx) { resolve(null); return; }
      ctx.drawImage(img, finalX, finalY, finalW, finalH, 0, 0, finalW, finalH);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => resolve(null);
    img.src = imageDataUrl;
  });
}

async function uploadCroppedImage(croppedDataUrl: string): Promise<string | null> {
  try {
    const res = await fetch(croppedDataUrl);
    const blob = await res.blob();
    const file = new File([blob], `cropped_${Date.now()}.jpg`, { type: "image/jpeg" });
    const formData = new FormData();
    formData.append("file", file);
    const uploadRes = await fetch("/api/upload", { method: "POST", body: formData });
    const json = await uploadRes.json().catch(() => null);
    if (!uploadRes.ok) return null;
    const uploadedUrl = json?.url ?? json?.imageUrl ?? json?.secure_url ?? null;
    return uploadedUrl ? String(uploadedUrl) : null;
  } catch {
    return null;
  }
}

export default function ClosetNewPage() {
  const [mode, setMode] = useState<ClosetMode>("image");

  const [singleFile, setSingleFile] = useState<File | null>(null);
  const [singlePreviewUrl, setSinglePreviewUrl] = useState<string | null>(null);
  const [singleUploadedImageUrl, setSingleUploadedImageUrl] = useState<string | null>(null);

  const [outfitFile, setOutfitFile] = useState<File | null>(null);
  const [outfitPreviewUrl, setOutfitPreviewUrl] = useState<string | null>(null);
  const [outfitUploadedImageUrl, setOutfitUploadedImageUrl] = useState<string | null>(null);

  const [form, setForm] = useState<FormState>(emptyForm());
  const [singleDetectedBbox, setSingleDetectedBbox] = useState<{
    x: number; y: number; w: number; h: number;
  } | null>(null);

  const [isAnalyzingSingle, setIsAnalyzingSingle] = useState(false);
  const [isAnalyzingOutfit, setIsAnalyzingOutfit] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [analyzeSuccess, setAnalyzeSuccess] = useState<string | null>(null);

  const [outfitSummaryMessage, setOutfitSummaryMessage] = useState<string | null>(null);
  const [outfitWarnings, setOutfitWarnings] = useState<string[]>([]);
  const [candidates, setCandidates] = useState<CandidateFormState[]>([]);

  const [closetItems, setClosetItems] = useState<ClosetItem[]>([]);

  const [splitTargetCandidateId, setSplitTargetCandidateId] = useState<string | null>(null);
  const [splitSelectedCategories, setSplitSelectedCategories] = useState<SplitCategory[]>([]);
  const [splitError, setSplitError] = useState<string | null>(null);
  const [isSubmittingSplit, setIsSubmittingSplit] = useState(false);

  const [isSavingSingle, setIsSavingSingle] = useState(false);
  const [isSavingBulk, setIsSavingBulk] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (singlePreviewUrl) URL.revokeObjectURL(singlePreviewUrl);
      if (outfitPreviewUrl) URL.revokeObjectURL(outfitPreviewUrl);
    };
  }, [singlePreviewUrl, outfitPreviewUrl]);

  useEffect(() => {
    if (!saveSuccess) return;
    const timer = setTimeout(() => setSaveSuccess(null), 4000);
    return () => clearTimeout(timer);
  }, [saveSuccess]);

  // クローゼット取得（outfit モード切替時）
  useEffect(() => {
    if (mode !== "outfit") return;
    if (closetItems.length > 0) return;
    fetch("/api/items")
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setClosetItems(data); })
      .catch(() => {});
  }, [mode]);

  const subCategoryOptions = useMemo(() => {
    if (!form.category || !SUBCATEGORY_OPTIONS[form.category as Category]) return [];
    return SUBCATEGORY_OPTIONS[form.category as Category];
  }, [form.category]);

  const selectedBulkCount = useMemo(
    () => candidates.filter((c) => c.selected && !c.excluded && c.form.category).length,
    [candidates]
  );

  function resetMessages() {
    setAnalyzeError(null);
    setAnalyzeSuccess(null);
    setSaveError(null);
    setSaveSuccess(null);
    setSplitError(null);
  }

  function handleModeChange(nextMode: ClosetMode) {
    setMode(nextMode);
    resetMessages();
  }

  function applyAnalyzeResultToForm(result: AnalyzeSingleResponse) {
    setForm((prev) => ({
      ...prev,
      name: result.name ?? "",
      category: result.category ?? "",
      subCategory: result.category ? normalizeSubCategory(result.category, result.subCategory ?? "") : "",
      color: result.color ?? [],
      season: result.season ?? [],
      styleTags: result.styleTags ?? [],
      inspirationTags: result.inspirationTags ?? [],
      formality: typeof result.formality === "number" && Number.isFinite(result.formality)
        ? String(result.formality) : "",
      brand: result.brand ?? "",
      memo: result.memo ?? "",
    }));
    setSingleDetectedBbox(result.bbox ?? null);
  }

  async function ensureUploadedImageUrl(file: File | null, currentUrl: string | null) {
    if (currentUrl) return currentUrl;
    if (!file) return null;
    const uploadFormData = new FormData();
    uploadFormData.append("file", file);
    const uploadRes = await fetch("/api/upload", { method: "POST", body: uploadFormData });
    const uploadJson = await uploadRes.json().catch(() => null);
    if (!uploadRes.ok) {
      throw new Error(
        buildApiErrorMessage(
          uploadJson as { error?: string; code?: string } | null,
          "画像アップロードに失敗しました"
        )
      );
    }
    const uploadedUrl = uploadJson?.url ?? uploadJson?.imageUrl ?? uploadJson?.secure_url ?? null;
    if (!uploadedUrl) throw new Error("アップロード結果に画像URLが含まれていません");
    return String(uploadedUrl);
  }

  async function handleSingleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setSingleUploadedImageUrl(null);
    setSingleDetectedBbox(null);
    resetMessages();
    if (!file) { setSingleFile(null); setSinglePreviewUrl(null); return; }
    try {
      setAnalyzeSuccess("画像を調整中...");
      setAnalyzeError(null);
      const compressedFile = await compressImageFile(file);
      setSingleFile(compressedFile);
      if (singlePreviewUrl) URL.revokeObjectURL(singlePreviewUrl);
      setSinglePreviewUrl(URL.createObjectURL(compressedFile));
      setAnalyzeSuccess(null);
    } catch {
      setSingleFile(null);
      setSinglePreviewUrl(null);
      setAnalyzeSuccess(null);
      setAnalyzeError("画像の読み込みに失敗しました");
    }
  }

  async function handleOutfitFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setOutfitUploadedImageUrl(null);
    setCandidates([]);
    setOutfitSummaryMessage(null);
    setOutfitWarnings([]);
    resetMessages();
    if (!file) { setOutfitFile(null); setOutfitPreviewUrl(null); return; }
    try {
      setAnalyzeSuccess("画像を調整中...");
      setAnalyzeError(null);
      const compressedFile = await compressImageFile(file);
      setOutfitFile(compressedFile);
      if (outfitPreviewUrl) URL.revokeObjectURL(outfitPreviewUrl);
      setOutfitPreviewUrl(URL.createObjectURL(compressedFile));
      setAnalyzeSuccess(null);
    } catch {
      setOutfitFile(null);
      setOutfitPreviewUrl(null);
      setAnalyzeSuccess(null);
      setAnalyzeError("画像の読み込みに失敗しました");
    }
  }

  async function handleAnalyzeSingleImage() {
    try {
      resetMessages();
      if (!singleFile) { setAnalyzeError("先に画像を選択してください"); return; }
      setIsAnalyzingSingle(true);
      const imageDataUrl = await fileToDataUrl(singleFile);
      const res = await fetch("/api/items/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageDataUrl }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(
          buildApiErrorMessage(
            json as { error?: string; code?: string } | null,
            "画像解析に失敗しました"
          )
        );
      }
      applyAnalyzeResultToForm(json as AnalyzeSingleResponse);
      setAnalyzeSuccess("解析結果をフォームに反映しました。必要なら修正して保存してください。");
    } catch (error) {
      setAnalyzeError(error instanceof Error ? error.message : "画像解析に失敗しました");
    } finally {
      setIsAnalyzingSingle(false);
    }
  }

  async function mapCandidatesForUiWithCrop(
    response: AnalyzeOutfitResponse,
    imageDataUrl: string,
    currentClosetItems: ClosetItem[]
  ): Promise<CandidateFormState[]> {
    const results = await Promise.all(
      response.candidates.map(async (candidate) => {
        let croppedImageUrl: string | null = null;
        if (candidate.bbox) {
          const cropped = await cropCandidateImage(imageDataUrl, candidate.bbox, candidate.category);
          if (cropped) croppedImageUrl = await uploadCroppedImage(cropped);
        }

        // 類似アイテム検索（スコアリング）
        const scoredItems = currentClosetItems
          .map((item) => ({ item, score: calcSimilarityScore(candidate, item) }))
          .filter(({ item }) => {
            // subCategory と color の両方が最低1つ一致していることが必須条件
            const subMatch = candidate.subCategory && item.subCategory
              && candidate.subCategory === item.subCategory;
            const colorMatch = (candidate.color ?? []).some((c) =>
              (item.color ?? []).includes(c)
            );
            return subMatch && colorMatch;
          })
          .sort((a, b) => b.score - a.score)
          .map(({ item }) => item);

        const similarItems = scoredItems;
        const hasSimilar = similarItems.length > 0;

        return {
          candidateId: candidate.candidateId,
          labelIndex: candidate.labelIndex,
          selected: !hasSimilar,
          excluded: hasSimilar,
          edited: false,
          sourceType: candidate.sourceType,
          sourceCandidateId: candidate.sourceCandidateId,
          status: candidate.status,
          confidence: candidate.confidence,
          needsReview: candidate.needsReview,
          imageUrl: croppedImageUrl,
          form: candidateToForm(candidate),
          ui: {
            note: candidate.note,
            reasons: candidate.reasons ?? [],
            partiallyVisible: candidate.visibility?.partiallyVisible ?? false,
            overlapped: candidate.visibility?.overlapped ?? false,
            ambiguousBoundary: candidate.visibility?.ambiguousBoundary ?? false,
          },
          bbox: candidate.bbox ?? null,
          similarItems,
          replaceItemId: null,
        };
      })
    );
    return results;
  }

  async function handleAnalyzeOutfitPhoto() {
    try {
      resetMessages();
      if (!outfitFile) { setAnalyzeError("先にコーデ写真を選択してください"); return; }
      setIsAnalyzingOutfit(true);

      // クローゼット未取得なら取得
      let currentClosetItems = closetItems;
      if (currentClosetItems.length === 0) {
        try {
          const res = await fetch("/api/items");
          if (res.ok) {
            currentClosetItems = await res.json();
            setClosetItems(currentClosetItems);
          }
        } catch {}
      }

      const imageDataUrl = await fileToDataUrl(outfitFile);
      const res = await fetch("/api/items/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "outfit_photo", imageDataUrl }),
      });
      const json = (await res.json().catch(() => null)) as
        | AnalyzeOutfitResponse
        | { error?: string; code?: string }
        | null;

      if (!res.ok || !json || !("success" in json)) {
        throw new Error(
          buildApiErrorMessage(
            json as { error?: string; code?: string } | null,
            "コーデ写真の解析に失敗しました"
          )
        );
      }

      setOutfitSummaryMessage(json.summary.message);
      setOutfitWarnings(json.warnings ?? []);
      setAnalyzeSuccess("候補を検出しました。アイテム画像を切り取り中...");

      const mappedCandidates = await mapCandidatesForUiWithCrop(json, imageDataUrl, currentClosetItems);
      setCandidates(mappedCandidates);
      setAnalyzeSuccess("認識できたアイテム候補を一覧化しました。内容を確認して保存してください。");
    } catch (error) {
      setAnalyzeError(error instanceof Error ? error.message : "コーデ写真の解析に失敗しました");
    } finally {
      setIsAnalyzingOutfit(false);
    }
  }

  function updateFormField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      if (key === "category") next.subCategory = "";
      return next;
    });
  }

  function toggleArrayValue(key: "color" | "season" | "styleTags" | "inspirationTags", value: string) {
    setForm((prev) => {
      const current = prev[key];
      const next = current.includes(value) ? current.filter((item) => item !== value) : [...current, value];
      return { ...prev, [key]: next };
    });
  }

  function updateCandidate(candidateId: string, updater: (prev: CandidateFormState) => CandidateFormState) {
    setCandidates((prev) => prev.map((c) => c.candidateId === candidateId ? updater(c) : c));
  }

  function updateCandidateFormField<K extends keyof FormState>(candidateId: string, key: K, value: FormState[K]) {
    updateCandidate(candidateId, (prev) => {
      const nextForm = { ...prev.form, [key]: value };
      if (key === "category") nextForm.subCategory = "";
      return { ...prev, edited: true, form: nextForm };
    });
  }

  function toggleCandidateArrayValue(
    candidateId: string,
    key: "color" | "season" | "styleTags" | "inspirationTags",
    value: string
  ) {
    updateCandidate(candidateId, (prev) => {
      const current = prev.form[key];
      const next = current.includes(value) ? current.filter((item) => item !== value) : [...current, value];
      return { ...prev, edited: true, form: { ...prev.form, [key]: next } };
    });
  }

  function handleCandidateSelectedChange(candidateId: string, selected: boolean) {
    updateCandidate(candidateId, (prev) => ({ ...prev, selected, excluded: !selected }));
  }

  function handleCandidateReplaceItem(candidateId: string, replaceItemId: string | null) {
    updateCandidate(candidateId, (prev) => ({
      ...prev,
      replaceItemId,
      // 差し替え選択したら保存対象にする
      selected: true,
      excluded: false,
    }));
  }

  function openSplitUi(candidateId: string) {
    setSplitTargetCandidateId(candidateId);
    setSplitSelectedCategories([]);
    setSplitError(null);
    resetMessages();
  }

  function closeSplitUi() {
    setSplitTargetCandidateId(null);
    setSplitSelectedCategories([]);
    setSplitError(null);
  }

  function toggleSplitCategory(category: SplitCategory) {
    setSplitSelectedCategories((prev) =>
      prev.includes(category) ? prev.filter((item) => item !== category) : [...prev, category]
    );
  }

  async function handleSplitCandidate() {
    try {
      setSplitError(null);
      resetMessages();
      if (!splitTargetCandidateId) { setSplitError("分割対象が見つかりません"); return; }
      if (!outfitFile) { setSplitError("元画像が見つかりません"); return; }
      if (splitSelectedCategories.length === 0) { setSplitError("分けたいカテゴリを1つ以上選んでください"); return; }
      setIsSubmittingSplit(true);

      const imageDataUrl = await fileToDataUrl(outfitFile);
      const sourceCandidate = candidates.find((c) => c.candidateId === splitTargetCandidateId);

      const res = await fetch("/api/items/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "split_candidate",
          imageDataUrl,
          sourceCandidateId: splitTargetCandidateId,
          splitTargets: splitSelectedCategories,
          sourceColor: sourceCandidate?.form.color ?? [],
          sourceSeason: sourceCandidate?.form.season ?? [],
          sourceStyleTags: sourceCandidate?.form.styleTags ?? [],
          sourceInspirationTags: sourceCandidate?.form.inspirationTags ?? [],
          sourceFormality: sourceCandidate?.form.formality ? Number(sourceCandidate.form.formality) : null,
        }),
      });

      const json = (await res.json().catch(() => null)) as
        | AnalyzeOutfitResponse
        | { error?: string; code?: string }
        | null;

      if (!res.ok || !json || !("success" in json)) {
        throw new Error(
          buildApiErrorMessage(
            json as { error?: string; code?: string } | null,
            "候補の分割に失敗しました"
          )
        );
      }

      const splitCandidates = await mapCandidatesForUiWithCrop(json, imageDataUrl, closetItems);

      setCandidates((prev) => {
        const nextBase = prev.map((c) =>
          c.candidateId === splitTargetCandidateId ? { ...c, selected: false, excluded: true } : c
        );
        return [...nextBase, ...splitCandidates];
      });

      setSaveSuccess("候補を分割して再認識しました。内容を確認してください。");
      closeSplitUi();
    } catch (error) {
      setSplitError(error instanceof Error ? error.message : "分割再解析に失敗しました");
    } finally {
      setIsSubmittingSplit(false);
    }
  }

  async function handleSaveSingle() {
    try {
      resetMessages();
      if (!form.category) { setSaveError("カテゴリを選択してください"); return; }
      setIsSavingSingle(true);

      let finalImageUrl: string | null = null;
      if (singleFile && singleDetectedBbox) {
        const imageDataUrl = await fileToDataUrl(singleFile);
        const croppedDataUrl = await cropCandidateImage(imageDataUrl, singleDetectedBbox, form.category || null);
        if (croppedDataUrl) finalImageUrl = await uploadCroppedImage(croppedDataUrl);
      }
      if (!finalImageUrl) finalImageUrl = await ensureUploadedImageUrl(singleFile, singleUploadedImageUrl);
      if (finalImageUrl && finalImageUrl !== singleUploadedImageUrl) setSingleUploadedImageUrl(finalImageUrl);

      const res = await fetch("/api/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formToPayload(form, finalImageUrl)),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(
          buildApiErrorMessage(
            json as { error?: string; code?: string } | null,
            "保存に失敗しました"
          )
        );
      }

      setSaveSuccess("アイテムを保存しました");
      setForm(emptyForm());
      setSingleFile(null);
      setSinglePreviewUrl(null);
      setSingleUploadedImageUrl(null);
      setSingleDetectedBbox(null);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "保存に失敗しました");
    } finally {
      setIsSavingSingle(false);
    }
  }

  async function handleBulkSave() {
    try {
      resetMessages();
      const targetCandidates = candidates.filter((c) => c.selected && !c.excluded && c.form.category);
      if (targetCandidates.length === 0) { setSaveError("保存対象の候補がありません"); return; }
      setIsSavingBulk(true);

      const uploadedUrl = await ensureUploadedImageUrl(outfitFile, outfitUploadedImageUrl);
      if (uploadedUrl && uploadedUrl !== outfitUploadedImageUrl) setOutfitUploadedImageUrl(uploadedUrl);

      const missingCroppedCandidates = targetCandidates.filter((c) => c.bbox && !c.imageUrl && !c.replaceItemId);
      if (missingCroppedCandidates.length > 0) {
        throw new Error("一部の候補で切り抜き画像の保存に失敗しました。もう一度解析してください");
      }

      // 差し替えと新規を分けて処理
      const replaceTargets = targetCandidates.filter((c) => c.replaceItemId);
      const newTargets = targetCandidates.filter((c) => !c.replaceItemId);

      // 差し替え：PATCHでimageUrlのみ更新
      await Promise.all(
        replaceTargets.map(async (c) => {
          const imageUrl = c.imageUrl ?? uploadedUrl;
          await fetch(`/api/items/${c.replaceItemId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ imageUrl }),
          });
        })
      );

      // 新規：一括POST
      let newCount = 0;
      if (newTargets.length > 0) {
        const payload = {
          items: newTargets.map((c) => formToPayload(c.form, c.imageUrl ?? uploadedUrl)),
        };
        const res = await fetch("/api/items/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const json = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(
            buildApiErrorMessage(
              json as { error?: string; code?: string } | null,
              "一括保存に失敗しました"
            )
          );
        }
        newCount = json?.count ?? newTargets.length;
      }

      const replaceCount = replaceTargets.length;
      const messages = [];
      if (newCount > 0) messages.push(`${newCount}件を新規登録`);
      if (replaceCount > 0) messages.push(`${replaceCount}件の画像を差し替え`);
      setSaveSuccess(messages.join("、") + "しました");

      setCandidates([]);
      setOutfitSummaryMessage(null);
      setOutfitWarnings([]);
      setOutfitFile(null);
      setOutfitPreviewUrl(null);
      setOutfitUploadedImageUrl(null);
      closeSplitUi();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "一括保存に失敗しました");
    } finally {
      setIsSavingBulk(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#fdf2f6] pb-32 text-[#605D62]">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col px-4 py-6">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs text-[#605D62]/40">Sakura Stylist</p>
            <h1 className="text-2xl font-bold">アイテム登録</h1>
          </div>
          <Link href="/closet"
            className="inline-flex w-fit rounded-xl border border-[#FCE4EC] bg-white px-4 py-2 text-sm font-medium text-[#605D62] hover:bg-[#fdf2f6]">
            クローゼットへ戻る
          </Link>
        </div>

        <div className="mb-6 flex flex-wrap gap-2">
          {(["image", "outfit", "manual"] as ClosetMode[]).map((m) => (
            <button key={m} type="button" onClick={() => handleModeChange(m)}
              className={classNames(
                "rounded-full px-4 py-2 text-sm font-medium transition",
                mode === m ? "bg-[#605D62] text-white" : "bg-white text-[#605D62] ring-1 ring-[#FCE4EC] hover:bg-[#fdf2f6]"
              )}>
              {m === "image" ? "画像登録(1着)" : m === "outfit" ? "画像登録(まとめて)" : "手入力"}
            </button>
          ))}
        </div>

        {analyzeError && (
          <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{analyzeError}</div>
        )}
        {analyzeSuccess && (
          <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{analyzeSuccess}</div>
        )}
        {saveError && (
          <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{saveError}</div>
        )}
        {saveSuccess && (
          <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{saveSuccess}</div>
        )}

        {mode === "image" && (
          <div className="space-y-4">
            <section className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-[#FCE4EC] sm:p-5">
              <h2 className="mb-4 text-lg font-semibold">画像から1着登録</h2>
              <label className="mb-4 flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 px-4 py-8 text-center hover:bg-neutral-100">
                <span className="mb-2 text-sm font-medium">画像を選択</span>
                <span className="text-xs text-neutral-500">1着だけ写った画像向け</span>
                <input type="file" accept="image/*" className="hidden" onChange={handleSingleFileChange} />
              </label>
              {singlePreviewUrl && (
                <div className="mb-4 overflow-hidden rounded-2xl ring-1 ring-[#FCE4EC]">
                  <img src={singlePreviewUrl} alt="preview" className="h-auto w-full object-cover" />
                </div>
              )}
              <button type="button" onClick={handleAnalyzeSingleImage} disabled={!singleFile || isAnalyzingSingle}
                className="w-full rounded-2xl bg-[#605D62] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#605D62]/90 disabled:cursor-not-allowed disabled:opacity-40">
                {isAnalyzingSingle ? "解析中..." : "AIで解析する"}
              </button>
              <p className="mt-3 text-xs leading-5 text-neutral-500">AIの判定は仮入力です。必要なら修正してから保存してください。</p>
            </section>

            <section className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-[#FCE4EC] sm:p-5">
              <h2 className="mb-4 text-lg font-semibold">登録フォーム</h2>
              <div className="grid gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium">名前</label>
                  <input value={form.name} onChange={(e) => updateFormField("name", e.target.value)}
                    className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm" placeholder="例: 白ブラウス" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">カテゴリ *</label>
                  <select value={form.category} onChange={(e) => updateFormField("category", e.target.value)}
                    className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm">
                    <option value="">選択してください</option>
                    {CATEGORY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">サブカテゴリ</label>
                  <select value={form.subCategory} onChange={(e) => updateFormField("subCategory", e.target.value)}
                    className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm" disabled={!form.category}>
                    <option value="">選択してください</option>
                    {subCategoryOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">フォーマル度 (1-5)</label>
                  <input value={form.formality} onChange={(e) => updateFormField("formality", e.target.value)}
                    className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm" placeholder="例: 3" inputMode="numeric" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">ブランド</label>
                  <input value={form.brand} onChange={(e) => updateFormField("brand", e.target.value)}
                    className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm" placeholder="例: GU" />
                </div>
                <div className="md:col-span-2">
                  <label className="mb-1 block text-sm font-medium">メモ</label>
                  <textarea value={form.memo} onChange={(e) => updateFormField("memo", e.target.value)}
                    className="min-h-[92px] w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm" placeholder="気になる点や補足" />
                </div>
                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm font-medium">色</label>
                  <div className="flex flex-wrap gap-2">
                    {COLOR_OPTIONS.map((color) => (
                      <button key={color} type="button" onClick={() => toggleArrayValue("color", color)}
                        className={classNames("rounded-full px-3 py-1.5 text-xs font-medium ring-1 transition",
                          form.color.includes(color) ? "bg-neutral-900 text-white ring-neutral-900" : "bg-white text-neutral-700 ring-neutral-300 hover:bg-neutral-100")}>
                        {COLOR_LABELS[color]}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm font-medium">季節</label>
                  <div className="flex flex-wrap gap-2">
                    {SEASON_OPTIONS.map((season) => (
                      <button key={season} type="button" onClick={() => toggleArrayValue("season", season)}
                        className={classNames("rounded-full px-3 py-1.5 text-xs font-medium ring-1 transition",
                          form.season.includes(season) ? "bg-neutral-900 text-white ring-neutral-900" : "bg-white text-neutral-700 ring-neutral-300 hover:bg-neutral-100")}>
                        {SEASON_LABELS[season]}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm font-medium">スタイルタグ</label>
                  <div className="flex flex-wrap gap-2">
                    {STYLE_OPTIONS.map((style) => (
                      <button key={style} type="button" onClick={() => toggleArrayValue("styleTags", style)}
                        className={classNames("rounded-full px-3 py-1.5 text-xs font-medium ring-1 transition",
                          form.styleTags.includes(style) ? "bg-neutral-900 text-white ring-neutral-900" : "bg-white text-neutral-700 ring-neutral-300 hover:bg-neutral-100")}>
                        {STYLE_LABELS[style]}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm font-medium">インスピレーション</label>
                  <div className="flex flex-wrap gap-2">
                    {INSPIRATION_OPTIONS.map((inspiration) => (
                      <button key={inspiration} type="button" onClick={() => toggleArrayValue("inspirationTags", inspiration)}
                        className={classNames("rounded-full px-3 py-1.5 text-xs font-medium ring-1 transition",
                          form.inspirationTags.includes(inspiration) ? "bg-neutral-900 text-white ring-neutral-900" : "bg-white text-neutral-700 ring-neutral-300 hover:bg-neutral-100")}>
                        {INSPIRATION_LABELS[inspiration]}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <button type="button" onClick={handleSaveSingle} disabled={isSavingSingle}
                className="mt-6 w-full rounded-2xl bg-[#605D62] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#605D62]/90 disabled:cursor-not-allowed disabled:opacity-40">
                {isSavingSingle ? "保存中..." : "保存する"}
              </button>
            </section>
          </div>
        )}

        {mode === "outfit" && (
          <div className="space-y-4">
            <section className="space-y-4 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-[#FCE4EC] sm:p-5">
              <div>
                <h2 className="text-lg font-semibold">コーデ写真からまとめて登録</h2>
                <p className="mt-1 text-sm text-neutral-500">AIが認識できたアイテム候補を一覧化します。内容を確認して一括保存できます。</p>
              </div>
              <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 px-4 py-8 text-center hover:bg-neutral-100">
                <span className="mb-2 text-sm font-medium">コーデ写真を選択</span>
                <span className="text-xs text-neutral-500">全身コーデや着用写真向け</span>
                <input type="file" accept="image/*" className="hidden" onChange={handleOutfitFileChange} />
              </label>
              {outfitPreviewUrl && (
                <div className="overflow-hidden rounded-2xl ring-1 ring-[#FCE4EC]">
                  <div className="relative">
                    <img src={outfitPreviewUrl} alt="outfit preview" className="h-auto w-full object-contain" />
                    {candidates.map((candidate) => {
                      const hasBbox = !!candidate.bbox;
                      const style = hasBbox ? (() => {
                        const bbox = candidate.bbox!;
                        const left = Math.min(96, Math.max(4, (bbox.x + bbox.w * 0.5) * 100));
                        const anchorY = candidate.form.category === "tops" ? bbox.y + bbox.h * 0.62
                          : candidate.form.category === "shoes" ? bbox.y + bbox.h * 0.78
                          : candidate.form.category === "bag" ? bbox.y + bbox.h * 0.45
                          : bbox.y + bbox.h * 0.5;
                        const top = Math.min(94, Math.max(6, anchorY * 100));
                        return { left: `${left}%`, top: `${top}%` };
                      })() : {
                        left: `${10 + ((candidate.labelIndex - 1) % 3) * 12}%`,
                        top: `${10 + Math.floor((candidate.labelIndex - 1) / 3) * 10}%`,
                      };
                      return (
                        <div key={candidate.candidateId}
                          className={classNames(
                            "absolute z-10 flex h-7 w-7 -translate-x-1/2 -translate-y-full items-center justify-center rounded-full text-xs font-bold text-white shadow",
                            candidate.selected && !candidate.excluded ? "bg-neutral-900" : "bg-neutral-400"
                          )}
                          style={style}>
                          {candidate.labelIndex}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              <button type="button" onClick={handleAnalyzeOutfitPhoto} disabled={!outfitFile || isAnalyzingOutfit}
                className="w-full rounded-2xl bg-[#605D62] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#605D62]/90 disabled:cursor-not-allowed disabled:opacity-40">
                {isAnalyzingOutfit ? "解析中..." : "アイテム候補を抽出する"}
              </button>
              {outfitSummaryMessage && (
                <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-700">{outfitSummaryMessage}</div>
              )}
              {outfitWarnings.length > 0 && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  <p className="mb-1 font-medium">注意</p>
                  <ul className="list-disc space-y-1 pl-5">
                    {outfitWarnings.map((warning, index) => <li key={`${warning}-${index}`}>{warning}</li>)}
                  </ul>
                </div>
              )}
            </section>

            <section className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-[#FCE4EC] sm:p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold">認識候補一覧</h2>
                <p className="text-sm text-neutral-500">認識結果は仮入力です。必要に応じて修正してください。</p>
              </div>

              {candidates.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-neutral-300 px-4 py-10 text-center text-sm text-neutral-500">
                  まだ候補はありません。コーデ写真を解析するとここに一覧が表示されます。
                </div>
              ) : (
                <div className="space-y-4">
                  {candidates.map((candidate) => {
                    const subOptions = candidate.form.category && SUBCATEGORY_OPTIONS[candidate.form.category as Category]
                      ? SUBCATEGORY_OPTIONS[candidate.form.category as Category] : [];
                    const isSplitOpen = splitTargetCandidateId === candidate.candidateId;
                    const hasSimilar = candidate.similarItems.length > 0;

                    return (
                      <div key={candidate.candidateId}
                        className={classNames(
                          "rounded-3xl border p-4 transition",
                          candidate.selected && !candidate.excluded
                            ? "border-neutral-200 bg-white"
                            : "border-neutral-200 bg-neutral-50 opacity-70"
                        )}>
                        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-neutral-900 text-sm font-bold text-white">
                              {candidate.labelIndex}
                            </div>
                            <div>
                              <p className="text-sm font-semibold">
                                {candidate.form.name
                                  ? candidate.form.name.replace(/。$/, "").trim()
                                  : (candidate.ui.note
                                    ? candidate.ui.note.replace(/[。.]$/, "").replace(/が(見えます|特徴的です|確認できます).*$/, "").trim()
                                    : null) || "名称未設定"}
                              </p>
                              <div className="mt-1 flex flex-wrap gap-2 text-xs">
                                <span className="rounded-full bg-neutral-100 px-2 py-1 text-neutral-700">{candidate.confidence}</span>
                                <span className={classNames("rounded-full px-2 py-1",
                                  candidate.needsReview ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800")}>
                                  {candidate.needsReview ? "要確認" : "確認OK寄り"}
                                </span>
                                {candidate.sourceType === "split" && (
                                  <span className="rounded-full bg-sky-100 px-2 py-1 text-sky-800">分割生成</span>
                                )}
                              </div>
                            </div>
                          </div>
                          <label className="flex items-center gap-2 text-sm">
                            <input type="checkbox"
                              checked={candidate.selected && !candidate.excluded}
                              onChange={(e) => handleCandidateSelectedChange(candidate.candidateId, e.target.checked)} />
                            保存する
                          </label>
                        </div>

                        {/* 類似アイテムパネル */}
                        {hasSimilar && (
                          <div className="mb-4 rounded-2xl bg-[#FFF8E7] px-4 py-3 ring-1 ring-amber-200">
                            <p className="mb-2 text-xs font-semibold text-amber-800">
                              クローゼットに似たアイテムがあります
                            </p>
                            <p className="mb-3 text-xs text-amber-700">
                              同じアイテムなら画像を差し替えできます。別アイテムなら「新規登録」を選んでください。
                            </p>
                            <div className="flex gap-2 overflow-x-auto pb-1">
                              {/* 新規登録ボタン */}
                              <button type="button"
                                onClick={() => {
                                  handleCandidateReplaceItem(candidate.candidateId, null);
                                  handleCandidateSelectedChange(candidate.candidateId, true);
                                }}
                                className={classNames(
                                  "shrink-0 rounded-xl px-3 py-2 text-xs font-medium transition",
                                  candidate.selected && !candidate.replaceItemId
                                    ? "bg-[#605D62] text-white"
                                    : "bg-white text-[#605D62] ring-1 ring-[#FCE4EC]"
                                )}>
                                新規登録
                              </button>
                              {/* 既存アイテム差し替えボタン */}
                              {candidate.similarItems.map((item) => (
                                <button key={item.id} type="button"
                                  onClick={() => handleCandidateReplaceItem(candidate.candidateId, item.id)}
                                  className={classNames(
                                    "shrink-0 rounded-xl transition",
                                    candidate.replaceItemId === item.id
                                      ? "ring-2 ring-[#605D62]"
                                      : "ring-1 ring-[#FCE4EC]"
                                  )}>
                                  <div className="h-16 w-16 overflow-hidden rounded-xl">
                                    {item.imageUrl ? (
                                      <img src={item.imageUrl} alt={item.name ?? ""} className="h-full w-full object-cover" />
                                    ) : (
                                      <div className="flex h-full w-full items-center justify-center bg-[#fdf2f6] text-[10px] text-[#605D62]/40">
                                        画像なし
                                      </div>
                                    )}
                                  </div>
                                  <p className="mt-0.5 w-16 truncate px-0.5 text-center text-[10px] text-[#605D62]/70">
                                    {item.name ?? "名称未設定"}
                                  </p>
                                  <p className="text-center text-[10px] text-[#605D62]/50">差し替え</p>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {(candidate.ui.note || candidate.ui.reasons.length > 0 || candidate.ui.partiallyVisible || candidate.ui.overlapped || candidate.ui.ambiguousBoundary) && (
                          <div className="mb-4 rounded-2xl bg-neutral-50 px-4 py-3 text-sm text-neutral-700 ring-1 ring-[#FCE4EC]">
                            {candidate.ui.note && <p className="mb-2">{candidate.ui.note}</p>}
                            {candidate.ui.reasons.length > 0 && (
                              <ul className="list-disc space-y-1 pl-5">
                                {candidate.ui.reasons.map((reason, index) => <li key={`${reason}-${index}`}>{reason}</li>)}
                              </ul>
                            )}
                            <div className="mt-3 flex flex-wrap gap-2 text-xs">
                              {candidate.ui.partiallyVisible && <span className="rounded-full bg-amber-100 px-2 py-1 text-amber-800">一部のみ表示</span>}
                              {candidate.ui.overlapped && <span className="rounded-full bg-amber-100 px-2 py-1 text-amber-800">重なりあり</span>}
                              {candidate.ui.ambiguousBoundary && <span className="rounded-full bg-amber-100 px-2 py-1 text-amber-800">境界が曖昧</span>}
                            </div>
                          </div>
                        )}

                        {candidate.imageUrl && (
                          <div className="mb-4 overflow-hidden rounded-2xl ring-1 ring-[#FCE4EC]">
                            <img src={candidate.imageUrl} alt={candidate.form.name || "candidate preview"} className="h-40 w-full object-cover" />
                          </div>
                        )}

                        <div className="grid gap-4">
                          <div>
                            <label className="mb-1 block text-sm font-medium">名前</label>
                            <input value={candidate.form.name}
                              onChange={(e) => updateCandidateFormField(candidate.candidateId, "name", e.target.value)}
                              className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm" placeholder="例: 白シャツ" />
                          </div>
                          <div>
                            <label className="mb-1 block text-sm font-medium">カテゴリ *</label>
                            <select value={candidate.form.category}
                              onChange={(e) => updateCandidateFormField(candidate.candidateId, "category", e.target.value)}
                              className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm">
                              <option value="">選択してください</option>
                              {CATEGORY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="mb-1 block text-sm font-medium">サブカテゴリ</label>
                            <select value={candidate.form.subCategory}
                              onChange={(e) => updateCandidateFormField(candidate.candidateId, "subCategory", e.target.value)}
                              className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm" disabled={!candidate.form.category}>
                              <option value="">選択してください</option>
                              {subOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="mb-1 block text-sm font-medium">フォーマル度 (1-5)</label>
                            <input value={candidate.form.formality}
                              onChange={(e) => updateCandidateFormField(candidate.candidateId, "formality", e.target.value)}
                              className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm" placeholder="例: 3" inputMode="numeric" />
                          </div>
                          <div>
                            <label className="mb-1 block text-sm font-medium">ブランド</label>
                            <input value={candidate.form.brand}
                              onChange={(e) => updateCandidateFormField(candidate.candidateId, "brand", e.target.value)}
                              className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm" placeholder="例: GU" />
                          </div>
                          <div className="md:col-span-2">
                            <label className="mb-1 block text-sm font-medium">メモ</label>
                            <textarea value={candidate.form.memo}
                              onChange={(e) => updateCandidateFormField(candidate.candidateId, "memo", e.target.value)}
                              className="min-h-[88px] w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm" placeholder="必要なら補足を入力" />
                          </div>
                          <div className="md:col-span-2">
                            <label className="mb-2 block text-sm font-medium">色</label>
                            <div className="flex flex-wrap gap-2">
                              {COLOR_OPTIONS.map((color) => (
                                <button key={color} type="button"
                                  onClick={() => toggleCandidateArrayValue(candidate.candidateId, "color", color)}
                                  className={classNames("rounded-full px-3 py-1.5 text-xs font-medium ring-1 transition",
                                    candidate.form.color.includes(color) ? "bg-neutral-900 text-white ring-neutral-900" : "bg-white text-neutral-700 ring-neutral-300 hover:bg-neutral-100")}>
                                  {COLOR_LABELS[color]}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div className="md:col-span-2">
                            <label className="mb-2 block text-sm font-medium">季節</label>
                            <div className="flex flex-wrap gap-2">
                              {SEASON_OPTIONS.map((season) => (
                                <button key={season} type="button"
                                  onClick={() => toggleCandidateArrayValue(candidate.candidateId, "season", season)}
                                  className={classNames("rounded-full px-3 py-1.5 text-xs font-medium ring-1 transition",
                                    candidate.form.season.includes(season) ? "bg-neutral-900 text-white ring-neutral-900" : "bg-white text-neutral-700 ring-neutral-300 hover:bg-neutral-100")}>
                                  {SEASON_LABELS[season]}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div className="md:col-span-2">
                            <label className="mb-2 block text-sm font-medium">スタイルタグ</label>
                            <div className="flex flex-wrap gap-2">
                              {STYLE_OPTIONS.map((style) => (
                                <button key={style} type="button"
                                  onClick={() => toggleCandidateArrayValue(candidate.candidateId, "styleTags", style)}
                                  className={classNames("rounded-full px-3 py-1.5 text-xs font-medium ring-1 transition",
                                    candidate.form.styleTags.includes(style) ? "bg-neutral-900 text-white ring-neutral-900" : "bg-white text-neutral-700 ring-neutral-300 hover:bg-neutral-100")}>
                                  {STYLE_LABELS[style]}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div className="md:col-span-2">
                            <label className="mb-2 block text-sm font-medium">インスピレーション</label>
                            <div className="flex flex-wrap gap-2">
                              {INSPIRATION_OPTIONS.map((inspiration) => (
                                <button key={inspiration} type="button"
                                  onClick={() => toggleCandidateArrayValue(candidate.candidateId, "inspirationTags", inspiration)}
                                  className={classNames("rounded-full px-3 py-1.5 text-xs font-medium ring-1 transition",
                                    candidate.form.inspirationTags.includes(inspiration) ? "bg-neutral-900 text-white ring-neutral-900" : "bg-white text-neutral-700 ring-neutral-300 hover:bg-neutral-100")}>
                                  {INSPIRATION_LABELS[inspiration]}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2">
                          <button type="button" onClick={() => openSplitUi(candidate.candidateId)}
                            className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm font-medium hover:bg-neutral-100">
                            別アイテムとして分ける
                          </button>
                          <button type="button"
                            onClick={() => handleCandidateSelectedChange(candidate.candidateId, !(candidate.selected && !candidate.excluded))}
                            className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm font-medium hover:bg-neutral-100">
                            {candidate.selected && !candidate.excluded ? "保存対象から外す" : "保存対象に戻す"}
                          </button>
                        </div>

                        {isSplitOpen && (
                          <div className="mt-4 rounded-2xl border border-sky-200 bg-sky-50 p-4">
                            <p className="mb-3 text-sm font-semibold text-sky-900">この候補を複数アイテムに分けます</p>
                            <div className="mb-3 flex flex-wrap gap-2">
                              {SPLIT_CATEGORY_OPTIONS.map((option) => (
                                <button key={option.value} type="button" onClick={() => toggleSplitCategory(option.value)}
                                  className={classNames("rounded-full px-3 py-1.5 text-xs font-medium ring-1 transition",
                                    splitSelectedCategories.includes(option.value)
                                      ? "bg-sky-700 text-white ring-sky-700"
                                      : "bg-white text-sky-800 ring-sky-300 hover:bg-sky-100")}>
                                  {option.label}
                                </button>
                              ))}
                            </div>
                            {splitError && (
                              <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{splitError}</div>
                            )}
                            <div className="flex flex-wrap gap-2">
                              <button type="button" onClick={handleSplitCandidate} disabled={isSubmittingSplit}
                                className="rounded-xl bg-sky-700 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-800 disabled:bg-sky-300">
                                {isSubmittingSplit ? "再認識中..." : "この内容で再認識"}
                              </button>
                              <button type="button" onClick={closeSplitUi}
                                className="rounded-xl border border-neutral-300 bg-white px-4 py-2 text-sm font-medium hover:bg-neutral-100">
                                閉じる
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {candidates.length > 0 && (
                <div className="mt-6 space-y-3">
                  <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-600">
                    選択中: <span className="font-semibold text-neutral-900">{selectedBulkCount}</span> 件
                  </div>
                  <button type="button" onClick={handleBulkSave} disabled={isSavingBulk || selectedBulkCount === 0}
                    className="w-full rounded-2xl bg-[#605D62] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#605D62]/90 disabled:cursor-not-allowed disabled:opacity-40">
                    {isSavingBulk ? "一括保存中..." : "選択した候補を保存"}
                  </button>
                </div>
              )}
            </section>
          </div>
        )}

        {mode === "manual" && (
          <div className="mx-auto w-full max-w-2xl rounded-3xl bg-white p-4 shadow-sm ring-1 ring-[#FCE4EC] sm:p-5">
            <h2 className="mb-4 text-lg font-semibold">手入力で登録</h2>
            <div className="grid gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium">名前</label>
                <input value={form.name} onChange={(e) => updateFormField("name", e.target.value)}
                  className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm" placeholder="例: 黒スラックス" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">カテゴリ *</label>
                <select value={form.category} onChange={(e) => updateFormField("category", e.target.value)}
                  className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm">
                  <option value="">選択してください</option>
                  {CATEGORY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">サブカテゴリ</label>
                <select value={form.subCategory} onChange={(e) => updateFormField("subCategory", e.target.value)}
                  className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm" disabled={!form.category}>
                  <option value="">選択してください</option>
                  {subCategoryOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">フォーマル度 (1-5)</label>
                <input value={form.formality} onChange={(e) => updateFormField("formality", e.target.value)}
                  className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm" placeholder="例: 3" inputMode="numeric" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">ブランド</label>
                <input value={form.brand} onChange={(e) => updateFormField("brand", e.target.value)}
                  className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm" placeholder="例: UNIQLO" />
              </div>
              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-medium">メモ</label>
                <textarea value={form.memo} onChange={(e) => updateFormField("memo", e.target.value)}
                  className="min-h-[92px] w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm" placeholder="必要なら補足を入力" />
              </div>
              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-medium">色</label>
                <div className="flex flex-wrap gap-2">
                  {COLOR_OPTIONS.map((color) => (
                    <button key={color} type="button" onClick={() => toggleArrayValue("color", color)}
                      className={classNames("rounded-full px-3 py-1.5 text-xs font-medium ring-1 transition",
                        form.color.includes(color) ? "bg-neutral-900 text-white ring-neutral-900" : "bg-white text-neutral-700 ring-neutral-300 hover:bg-neutral-100")}>
                      {COLOR_LABELS[color]}
                    </button>
                  ))}
                </div>
              </div>
              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-medium">季節</label>
                <div className="flex flex-wrap gap-2">
                  {SEASON_OPTIONS.map((season) => (
                    <button key={season} type="button" onClick={() => toggleArrayValue("season", season)}
                      className={classNames("rounded-full px-3 py-1.5 text-xs font-medium ring-1 transition",
                        form.season.includes(season) ? "bg-neutral-900 text-white ring-neutral-900" : "bg-white text-neutral-700 ring-neutral-300 hover:bg-neutral-100")}>
                      {SEASON_LABELS[season]}
                    </button>
                  ))}
                </div>
              </div>
              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-medium">スタイルタグ</label>
                <div className="flex flex-wrap gap-2">
                  {STYLE_OPTIONS.map((style) => (
                    <button key={style} type="button" onClick={() => toggleArrayValue("styleTags", style)}
                      className={classNames("rounded-full px-3 py-1.5 text-xs font-medium ring-1 transition",
                        form.styleTags.includes(style) ? "bg-neutral-900 text-white ring-neutral-900" : "bg-white text-neutral-700 ring-neutral-300 hover:bg-neutral-100")}>
                      {STYLE_LABELS[style]}
                    </button>
                  ))}
                </div>
              </div>
              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-medium">インスピレーション</label>
                <div className="flex flex-wrap gap-2">
                  {INSPIRATION_OPTIONS.map((inspiration) => (
                    <button key={inspiration} type="button" onClick={() => toggleArrayValue("inspirationTags", inspiration)}
                      className={classNames("rounded-full px-3 py-1.5 text-xs font-medium ring-1 transition",
                        form.inspirationTags.includes(inspiration) ? "bg-neutral-900 text-white ring-neutral-900" : "bg-white text-neutral-700 ring-neutral-300 hover:bg-neutral-100")}>
                      {INSPIRATION_LABELS[inspiration]}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <button type="button" onClick={handleSaveSingle} disabled={isSavingSingle}
              className="mt-6 w-full rounded-2xl bg-[#605D62] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#605D62]/90 disabled:cursor-not-allowed disabled:opacity-40">
              {isSavingSingle ? "保存中..." : "保存する"}
            </button>
          </div>
        )}
      </div>
      <BottomNav />
    </main>
  );
}