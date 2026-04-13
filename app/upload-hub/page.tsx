"use client";

import { useRef, useState } from "react";
import BottomNav from "../components/BottomNav";
import AppHeader from "../components/AppHeader";

const ACTIONS = [
  { id: "evaluate", label: "コーデ評価", emoji: "⭐", description: "AIがコーデをスコアリング" },
  { id: "item", label: "アイテム登録", emoji: "👗", description: "クローゼットに追加" },
  { id: "log", label: "コーデログ", emoji: "📋", description: "今日のコーデを記録" },
  { id: "style-goal", label: "なりたい系統", emoji: "✨", description: "画像からスタイル判定" },
];

type ActionId = "evaluate" | "item" | "log" | "style-goal";

type EvaluateResult = {
  totalScore: number;
  summary: string;
  goodPoints: string[];
  improvementPoints: string[];
};

type ItemCandidate = {
  name: string;
  category: string;
  subCategory?: string;
  color?: string[];
  styleTags?: string[];
  season?: string[];
};

type StyleGoalResult = {
  baseStyle: string;
  inspiration: string | null;
  comment: string;
};

type DetectedItem = {
  category: string;
  categoryLabel: string;
  styleTags: string[];
  styleTagLabels: string[];
  colors: string[];
  colorLabels: string[];
};

type ClosetItem = {
  id: string;
  name: string | null;
  category: string;
  imageUrl: string | null;
};

type LogAnalyzeResult = {
  items: DetectedItem[];
  dominantStyle: string | null;
};

type LogResult = {
  status: "analyzing" | "confirming" | "saved" | "error";
  analyzed?: LogAnalyzeResult;
  confirmedItems?: DetectedItem[];
  imageUrl?: string | null;
};

type Results = {
  evaluate?: EvaluateResult | null;
  item?: ItemCandidate[] | null;
  log?: LogResult | null;
  "style-goal"?: StyleGoalResult | null;
};

const STYLE_LABELS: Record<string, string> = {
  casual: "カジュアル", clean: "きれいめ", feminine: "フェミニン",
  girly: "ガーリー", simple: "シンプル", natural: "ナチュラル",
  elegant: "エレガント", mode: "モード", street: "ストリート", sporty: "スポーティ",
};

const CATEGORY_LABELS: Record<string, string> = {
  tops: "トップス", bottoms: "ボトムス", onepiece: "ワンピース",
  outer: "アウター", shoes: "シューズ", bag: "バッグ",
};

const OCCASION_OPTIONS = [
  { value: "casual", label: "お出かけ" },
  { value: "date", label: "デート" },
  { value: "office", label: "仕事" },
  { value: "formal", label: "フォーマル" },
  { value: "travel", label: "旅行" },
  { value: "school", label: "学校" },
];

const SEASON_OPTIONS = [
  { value: "spring", label: "春" },
  { value: "summer", label: "夏" },
  { value: "autumn", label: "秋" },
  { value: "winter", label: "冬" },
];

export default function UploadHubPage() {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [selectedActions, setSelectedActions] = useState<Set<ActionId>>(new Set());
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<Results>({});
  const [openAccordions, setOpenAccordions] = useState<Set<ActionId>>(new Set());
  const [message, setMessage] = useState<string | null>(null);

  const [occasion, setOccasion] = useState("casual");
  const [season, setSeason] = useState("spring");
  const [style, setStyle] = useState("casual");

  const [savingItemIndex, setSavingItemIndex] = useState<number | null>(null);
  const [savedItems, setSavedItems] = useState<Set<number>>(new Set());
  const [croppedPreviews, setCroppedPreviews] = useState<Record<number, string>>({});
  const [duplicateConfirm, setDuplicateConfirm] = useState<{
    index: number;
    candidate: ItemCandidate;
    matches: ClosetItem[];
  } | null>(null);

  const [logCheckedItems, setLogCheckedItems] = useState<Set<number>>(new Set());
  const [isSavingLog, setIsSavingLog] = useState(false);
  const [closetItems, setClosetItems] = useState<ClosetItem[]>([]);
  // key: 検出アイテムのindex, value: 選択したclosetItemのid（nullは「新規」）
  const [matchedItemIds, setMatchedItemIds] = useState<Record<number, string | null>>({});

  const fileInputRef = useRef<HTMLInputElement>(null);

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

  function adjustBbox(
      bbox: { x: number; y: number; w: number; h: number },
      imgW: number,
      imgH: number
    ): { x: number; y: number; w: number; h: number } {
      const padding = 0.015;
      const padX = Math.floor(padding * imgW);
      const padY = Math.floor(padding * imgH);

      let x = Math.floor(bbox.x * imgW);
      let y = Math.floor(bbox.y * imgH);
      let w = Math.floor(bbox.w * imgW);
      let h = Math.floor(bbox.h * imgH);

      // shoes: bboxが小さすぎる場合は下方向に拡張
      // y+h が画像下端に近い場合、下端まで広げる
      if (bbox.y + bbox.h > 0.8) {
        const extendedH = Math.floor((1.0 - bbox.y) * imgH);
        if (extendedH > h) h = extendedH;
      }

      // 横幅が極端に狭い場合（w < 0.2）は中央寄せで広げる
      if (bbox.w < 0.2) {
        const centerX = x + w / 2;
        w = Math.floor(0.35 * imgW);
        x = Math.max(0, Math.floor(centerX - w / 2));
      }

      const finalX = Math.max(0, x - padX);
      const finalY = Math.max(0, y - padY);
      const finalW = Math.min(imgW - finalX, w + padX * 2);
      const finalH = Math.min(imgH - finalY, h + padY * 2);

      return { x: finalX, y: finalY, w: finalW, h: finalH };
    }

  async function generateCropPreview(
    imageDataUrl: string,
    bbox: { x: number; y: number; w: number; h: number },
    category?: string | null
  ): Promise<string | null> {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");

        // bboxの品質チェック
        const area = bbox.w * bbox.h;
        const isBboxSuspect =
          area > 0.70 ||
          area < 0.01 ||
          ((category === "tops" || category === "outer") && bbox.y < 0.25) ||
          (category === "shoes" && bbox.y < 0.65);

        const effectiveBbox = isBboxSuspect ? getFallbackBbox(category ?? null) : bbox;
        const adjusted = adjustBbox(effectiveBbox, img.naturalWidth, img.naturalHeight);
        const finalX = adjusted.x;
        const finalY = adjusted.y;
        const finalW = adjusted.w;
        const finalH = adjusted.h;
        if (finalW <= 0 || finalH <= 0) { resolve(null); return; }
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

  async function cropAndUpload(
    imageDataUrl: string,
    bbox: { x: number; y: number; w: number; h: number } | null | undefined,
    category: string | null | undefined
  ): Promise<string | null> {
    if (!bbox) return null;
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = async () => {
        const canvas = document.createElement("canvas");
        let cropX = Math.floor(bbox.x * img.naturalWidth);
        let cropY = Math.floor(bbox.y * img.naturalHeight);
        let cropW = Math.floor(bbox.w * img.naturalWidth);
        let cropH = Math.floor(bbox.h * img.naturalHeight);
        if (cropW <= 0 || cropH <= 0) { resolve(null); return; }

        // bboxの品質チェック
        const area = bbox!.w * bbox!.h;
        const isBboxSuspect =
          area > 0.70 ||
          area < 0.01 ||
          ((category === "tops" || category === "outer") && bbox.y < 0.25) ||
          (category === "shoes" && bbox.y < 0.65);

        const effectiveBbox = isBboxSuspect ? getFallbackBbox(category ?? null) : bbox!;
        const adjusted = adjustBbox(effectiveBbox, img.naturalWidth, img.naturalHeight);
        const finalX = adjusted.x;
        const finalY = adjusted.y;
        const finalW = adjusted.w;
        const finalH = adjusted.h;

        canvas.width = finalW;
        canvas.height = finalH;
        const ctx = canvas.getContext("2d");
        if (!ctx) { resolve(null); return; }
        ctx.drawImage(img, finalX, finalY, finalW, finalH, 0, 0, finalW, finalH);

        const croppedDataUrl = canvas.toDataURL("image/jpeg", 0.85);
        try {
          const blob = await (await fetch(croppedDataUrl)).blob();
          const croppedFile = new File([blob], `cropped_${Date.now()}.jpg`, { type: "image/jpeg" });
          const fd = new FormData();
          fd.append("file", croppedFile);
          const uploadRes = await fetch("/api/upload", { method: "POST", body: fd });
          const uploadData = await uploadRes.json();
          resolve(uploadData?.imageUrl ?? null);
        } catch { resolve(null); }
      };
      img.onerror = () => resolve(null);
      img.src = imageDataUrl;
    });
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
    setResults({});
    setOpenAccordions(new Set());
    setMessage(null);
    setLogCheckedItems(new Set());
    setMatchedItemIds({});
  }

  function toggleAction(id: ActionId) {
    setSelectedActions((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAccordion(id: ActionId) {
    setOpenAccordions((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function toDataUrl(f: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(f);
    });
  }

  async function handleRun() {
    if (!file || selectedActions.size === 0) return;
    setIsRunning(true);
    setResults({});
    setOpenAccordions(new Set(selectedActions));
    setMessage(null);
    setLogCheckedItems(new Set());
    setMatchedItemIds({});

    const imageDataUrl = await toDataUrl(file);
    const newResults: Results = {};

    // コーデログが選択されてたらクローゼットを先に取得
    let fetchedClosetItems: ClosetItem[] = closetItems;
    if (selectedActions.has("log") && closetItems.length === 0) {
      try {
        const res = await fetch("/api/items");
        if (res.ok) {
          fetchedClosetItems = await res.json();
          setClosetItems(fetchedClosetItems);
        }
      } catch {}
    }

    await Promise.all(
      Array.from(selectedActions).map(async (action) => {
        try {
          if (action === "evaluate") {
            const formData = new FormData();
            formData.append("image", file);
            formData.append("occasion", occasion);
            formData.append("season", season);
            formData.append("style", style);
            const res = await fetch("/api/evaluate", { method: "POST", body: formData });
            const data = await res.json();
            newResults.evaluate = res.ok ? data : null;
          }

          if (action === "item") {
            // 類似チェック用にクローゼット取得
            if (closetItems.length === 0) {
              try {
                const res = await fetch("/api/items");
                if (res.ok) setClosetItems(await res.json());
              } catch {}
            }

            const res = await fetch("/api/items/analyze", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ imageDataUrl, mode: "outfit_photo" }),
            });
            const data = await res.json();
            newResults.item = res.ok ? (data.candidates ?? []) : null;
            if (res.ok) console.log("[item candidates]", JSON.stringify(data.candidates?.map((c: any) => ({ name: c.name, category: c.category, bbox: c.bbox })), null, 2));

            // bboxがあるcandidateを切り抜いてプレビュー生成
            if (res.ok && data.candidates?.length > 0) {
              const previews: Record<number, string> = {};
              await Promise.all(
                data.candidates.map(async (candidate: any, i: number) => {
                  if (!candidate.bbox) return;
                  const dataUrl = await generateCropPreview(imageDataUrl, candidate.bbox, candidate.category);
                  if (dataUrl) previews[i] = dataUrl;
                })
              );
              setCroppedPreviews(previews);
            }
          }

          if (action === "log") {
            const fd = new FormData();
            fd.append("file", file);
            const uploadRes = await fetch("/api/upload", { method: "POST", body: fd });
            const uploadData = await uploadRes.json();
            const imageUrl = uploadData?.imageUrl ?? null;

            const analyzeRes = await fetch("/api/outfit-log/analyze", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ imageDataUrl }),
            });
            const analyzeData = await analyzeRes.json();

            if (analyzeRes.ok && analyzeData.items?.length > 0) {
              newResults.log = { status: "confirming", analyzed: analyzeData, imageUrl };
              setLogCheckedItems(new Set(analyzeData.items.map((_: any, i: number) => i)));
            } else {
              newResults.log = { status: "confirming", analyzed: { items: [], dominantStyle: null }, imageUrl };
            }
          }

          if (action === "style-goal") {
            const res = await fetch("/api/style-goals/analyze", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ imageDataUrl }),
            });
            const data = await res.json();
            if (res.ok && data.baseStyle) {
              newResults["style-goal"] = data;
              await fetch("/api/style-goals", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  targetStyle: data.baseStyle,
                  priority: "medium",
                  note: data.inspiration ? `inspiration: ${data.inspiration}` : null,
                  isActive: true,
                }),
              });
            } else {
              newResults["style-goal"] = null;
            }
          }
        } catch {
          if (action === "log") newResults.log = { status: "error" };
        }
      })
    );

    setResults(newResults);
    setIsRunning(false);
  }

  async function handleSaveLog() {
    const logResult = results.log;
    if (!logResult || logResult.status !== "confirming") return;
    setIsSavingLog(true);

    try {
      const allItems = logResult.analyzed?.items ?? [];
      const confirmedItems = allItems.filter((_, i) => logCheckedItems.has(i));

      const detectedItemTags = confirmedItems.map((item) => item.category);
      const detectedStyleTags = Array.from(new Set(confirmedItems.flatMap((item) => item.styleTags)));
      const detectedColors = Array.from(new Set(confirmedItems.flatMap((item) => item.colors)));

      // チェック済みアイテムのうちクローゼットと紐付けたitemIdを収集
      const itemIds = Object.entries(matchedItemIds)
        .filter(([i, id]) => logCheckedItems.has(Number(i)) && id !== null)
        .map(([, id]) => id as string);

      const res = await fetch("/api/outfits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageUrl: logResult.imageUrl,
          isFavorite: false,
          occasion: null,
          temperatureLabel: null,
          score: null,
          comment: null,
          detectedItemTags,
          detectedStyleTags,
          detectedColors,
          itemIds,
        }),
      });

      if (!res.ok) throw new Error();

      setResults((prev) => ({
        ...prev,
        log: { ...logResult, status: "saved", confirmedItems },
      }));
    } catch {
      setResults((prev) => ({
        ...prev,
        log: { ...logResult, status: "error" },
      }));
    } finally {
      setIsSavingLog(false);
    }
  }

    async function handleSaveItem(candidate: ItemCandidate, index: number) {
        // closetItemsが空なら直接fetch
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

        const similarItems = currentClosetItems.filter(
          (item) => item.category === candidate.category
        );

        if (similarItems.length > 0) {
          setDuplicateConfirm({ index, candidate, matches: similarItems });
          return;
        }

        await doSaveItem(candidate, index, null);
      }

    async function doSaveItem(
      candidate: ItemCandidate,
      index: number,
      replaceItemId: string | null
    ) {
      setSavingItemIndex(index);
      try {
        const imageDataUrl = await toDataUrl(file!);
        let imageUrl: string | null = null;
        const bbox = (candidate as any).bbox;
        if (bbox) {
          imageUrl = await cropAndUpload(imageDataUrl, bbox, candidate.category);
        }
        if (!imageUrl) {
          const fd = new FormData();
          fd.append("file", file!);
          const uploadRes = await fetch("/api/upload", { method: "POST", body: fd });
          const uploadData = await uploadRes.json();
          imageUrl = uploadData?.imageUrl ?? null;
        }

        if (replaceItemId) {
          // 画像だけ差し替え
          const res = await fetch(`/api/items/${replaceItemId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ imageUrl }),
          });
          if (res.ok) setSavedItems((prev) => new Set([...prev, index]));
        } else {
          const res = await fetch("/api/items", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...candidate, imageUrl }),
          });
          if (res.ok) setSavedItems((prev) => new Set([...prev, index]));
        }
      } catch {
        setMessage("保存に失敗しました");
      } finally {
        setSavingItemIndex(null);
        setDuplicateConfirm(null);
      }
    }

  const canRun = file && selectedActions.size > 0 && !isRunning;
  const hasResults = Object.keys(results).length > 0;

  return (
    <main className="min-h-screen bg-[#fdf2f6] pb-32 text-[#605D62]">
      <div className="mx-auto max-w-md px-4 py-6">
        <AppHeader title="画像をアップロード" description="1枚の画像で複数の操作を一括実行" />

        <div onClick={() => fileInputRef.current?.click()}
          className="mb-5 cursor-pointer overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-[#FCE4EC] transition hover:shadow-md">
          {previewUrl ? (
            <div className="relative">
              <img src={previewUrl} alt="preview" className="h-56 w-full object-cover" />
              <div className="absolute bottom-3 right-3 rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-[#605D62]">
                タップして変更
              </div>
            </div>
          ) : (
            <div className="flex h-48 flex-col items-center justify-center gap-2">
              <span className="text-4xl">📷</span>
              <p className="text-sm font-medium text-[#605D62]">タップして画像を選択</p>
              <p className="text-xs text-[#605D62]/50">JPG・PNG・最大5MB</p>
            </div>
          )}
        </div>
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />

        <div className="mb-5 space-y-3">
          <p className="text-sm font-semibold">やりたいことを選ぶ（複数可）</p>
          {ACTIONS.map((action) => {
            const selected = selectedActions.has(action.id as ActionId);
            return (
              <button key={action.id} type="button"
                onClick={() => toggleAction(action.id as ActionId)}
                className={`flex w-full items-center gap-4 rounded-2xl p-4 text-left transition ${
                  selected ? "bg-[#605D62] text-white shadow-md" : "bg-white text-[#605D62] ring-1 ring-[#FCE4EC]"
                }`}>
                <span className="text-2xl">{action.emoji}</span>
                <div>
                  <p className="font-semibold">{action.label}</p>
                  <p className={`text-xs ${selected ? "text-white/70" : "text-[#605D62]/60"}`}>
                    {action.description}
                  </p>
                </div>
                <div className={`ml-auto flex h-6 w-6 items-center justify-center rounded-full border-2 ${
                  selected ? "border-white bg-white" : "border-[#FCE4EC]"
                }`}>
                  {selected && <span className="text-xs font-bold text-[#605D62]">✓</span>}
                </div>
              </button>
            );
          })}

          {selectedActions.has("evaluate") && (
            <div className="rounded-2xl bg-white p-4 ring-1 ring-[#FCE4EC]">
              <p className="mb-3 text-xs font-semibold text-[#605D62]/60">コーデ評価の条件</p>
              <div className="space-y-3">
                <div>
                  <p className="mb-1.5 text-xs font-medium">シチュエーション</p>
                  <div className="flex flex-wrap gap-2">
                    {OCCASION_OPTIONS.map((opt) => (
                      <button key={opt.value} type="button" onClick={() => setOccasion(opt.value)}
                        className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                          occasion === opt.value ? "bg-[#605D62] text-white" : "bg-[#fdf2f6] text-[#605D62]"
                        }`}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-1.5 text-xs font-medium">季節</p>
                  <div className="flex flex-wrap gap-2">
                    {SEASON_OPTIONS.map((opt) => (
                      <button key={opt.value} type="button" onClick={() => setSeason(opt.value)}
                        className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                          season === opt.value ? "bg-[#605D62] text-white" : "bg-[#fdf2f6] text-[#605D62]"
                        }`}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          <button type="button" onClick={handleRun} disabled={!canRun}
            className="w-full rounded-2xl bg-gradient-to-r from-[#FCE4EC] to-[#E3F2FD] py-4 text-sm font-bold text-[#605D62] shadow-sm transition disabled:opacity-40">
            {isRunning ? "実行中..." : !file ? "先に画像を選択してください" : `${selectedActions.size}つの操作を実行する`}
          </button>
        </div>

        {hasResults && (
          <div className="space-y-3">
            <p className="text-sm font-semibold">結果</p>

            {results.evaluate !== undefined && (
              <div className="rounded-2xl bg-white ring-1 ring-[#FCE4EC]">
                <button type="button" onClick={() => toggleAccordion("evaluate")}
                  className="flex w-full items-center justify-between p-4">
                  <div className="flex items-center gap-2">
                    <span>⭐</span>
                    <span className="font-semibold">コーデ評価</span>
                    {results.evaluate && (
                      <span className="rounded-full bg-[#FCE4EC] px-2 py-0.5 text-xs font-bold text-[#605D62]">
                        {results.evaluate.totalScore}点
                      </span>
                    )}
                  </div>
                  <span className="text-sm text-[#605D62]/40">
                    {openAccordions.has("evaluate") ? "▲" : "▼"}
                  </span>
                </button>
                {openAccordions.has("evaluate") && (
                  <div className="border-t border-[#FCE4EC] p-4">
                    {results.evaluate ? (
                      <div className="space-y-3">
                        <p className="text-sm leading-relaxed">{results.evaluate.summary}</p>
                        <div>
                          <p className="mb-1 text-xs font-semibold text-emerald-600">良い点</p>
                          <ul className="space-y-1">
                            {results.evaluate.goodPoints.map((p, i) => (
                              <li key={i} className="flex items-start gap-1.5 text-xs">
                                <span className="mt-0.5 text-emerald-500">✓</span>{p}
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <p className="mb-1 text-xs font-semibold text-orange-500">改善点</p>
                          <ul className="space-y-1">
                            {results.evaluate.improvementPoints.map((p, i) => (
                              <li key={i} className="flex items-start gap-1.5 text-xs">
                                <span className="mt-0.5 text-orange-400">→</span>{p}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-red-500">評価に失敗しました</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {results.item !== undefined && (
              <div className="rounded-2xl bg-white ring-1 ring-[#FCE4EC]">
                <button type="button" onClick={() => toggleAccordion("item")}
                  className="flex w-full items-center justify-between p-4">
                  <div className="flex items-center gap-2">
                    <span>👗</span>
                    <span className="font-semibold">アイテム登録</span>
                    {results.item && (
                      <span className="rounded-full bg-[#E3F2FD] px-2 py-0.5 text-xs text-[#605D62]">
                        {results.item.length}件検出
                      </span>
                    )}
                  </div>
                  <span className="text-sm text-[#605D62]/40">
                    {openAccordions.has("item") ? "▲" : "▼"}
                  </span>
                </button>
                {openAccordions.has("item") && (
                  <div className="border-t border-[#FCE4EC] p-4">
                    {results.item && results.item.length > 0 ? (
                      <div className="space-y-3">
                        {results.item.map((candidate, i) => (
                          <div key={i} className="rounded-xl bg-[#fdf2f6] p-3">
                            {croppedPreviews[i] && (
                              <div className="mb-3 overflow-hidden rounded-xl">
                                <img
                                  src={croppedPreviews[i]}
                                  alt={candidate.name}
                                  className="h-36 w-full object-cover"
                                />
                              </div>
                            )}
                            <div className="mb-2 flex items-center justify-between">
                              <div>
                                <p className="font-semibold">{candidate.name}</p>
                                <p className="text-xs text-[#605D62]/60">
                                  {CATEGORY_LABELS[candidate.category] ?? candidate.category}
                                </p>
                              </div>
                              {savedItems.has(i) ? (
                                <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-600">保存済み</span>
                              ) : (
                                <button type="button" onClick={() => handleSaveItem(candidate, i)}
                                  disabled={savingItemIndex === i}
                                  className="rounded-full bg-[#605D62] px-3 py-1 text-xs font-medium text-white disabled:opacity-50">
                                  {savingItemIndex === i ? "保存中..." : "保存する"}
                                </button>
                              )}
                            </div>
                            {candidate.styleTags && candidate.styleTags.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {candidate.styleTags.map((tag) => (
                                  <span key={tag} className="rounded-full bg-[#E3F2FD] px-2 py-0.5 text-xs text-[#605D62]">
                                    {STYLE_LABELS[tag] ?? tag}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-red-500">アイテムの検出に失敗しました</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {results.log !== undefined && (
              <div className="rounded-2xl bg-white ring-1 ring-[#FCE4EC]">
                <button type="button" onClick={() => toggleAccordion("log")}
                  className="flex w-full items-center justify-between p-4">
                  <div className="flex items-center gap-2">
                    <span>📋</span>
                    <span className="font-semibold">コーデログ</span>
                    {results.log?.status === "saved" && (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-600">保存済み</span>
                    )}
                    {results.log?.status === "confirming" && (
                      <span className="rounded-full bg-[#FCE4EC] px-2 py-0.5 text-xs text-[#605D62]">確認中</span>
                    )}
                    {results.log?.status === "error" && (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-500">エラー</span>
                    )}
                  </div>
                  <span className="text-sm text-[#605D62]/40">
                    {openAccordions.has("log") ? "▲" : "▼"}
                  </span>
                </button>

                {openAccordions.has("log") && (
                  <div className="border-t border-[#FCE4EC] p-4">
                    {results.log?.status === "confirming" && results.log.analyzed && (
                      <div className="space-y-3">
                        <p className="text-xs font-semibold text-[#605D62]">AIが検出したアイテムを確認してください</p>
                        <p className="text-xs text-[#605D62]/60">チェックを入れて、クローゼットの同じアイテムを選んでください</p>

                        {results.log.analyzed.items.length > 0 ? (
                          <div className="space-y-4">
                            {results.log.analyzed.items.map((item, i) => {
                              const candidates = closetItems.filter((c) => c.category === item.category);
                              const isChecked = logCheckedItems.has(i);
                              const selectedId = matchedItemIds[i];

                              return (
                                <div key={i} className={`rounded-xl p-3 transition ${isChecked ? "bg-[#fdf2f6]" : "bg-white ring-1 ring-[#FCE4EC] opacity-50"}`}>
                                  <button type="button"
                                    onClick={() => setLogCheckedItems((prev) => {
                                      const next = new Set(prev);
                                      if (next.has(i)) next.delete(i);
                                      else next.add(i);
                                      return next;
                                    })}
                                    className="flex w-full items-center gap-3 text-left">
                                    <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                                      isChecked ? "border-[#605D62] bg-[#605D62]" : "border-[#FCE4EC]"
                                    }`}>
                                      {isChecked && <span className="text-xs font-bold text-white">✓</span>}
                                    </div>
                                    <div>
                                      <p className="text-sm font-semibold text-[#605D62]">{item.categoryLabel}</p>
                                      <div className="mt-0.5 flex flex-wrap gap-1">
                                        {item.colorLabels.map((c) => (
                                          <span key={c} className="text-xs text-[#605D62]/60">{c}</span>
                                        ))}
                                        {item.styleTagLabels.map((s) => (
                                          <span key={s} className="rounded-full bg-[#E3F2FD] px-1.5 py-0.5 text-xs text-[#605D62]">{s}</span>
                                        ))}
                                      </div>
                                    </div>
                                  </button>

                                  {isChecked && candidates.length > 0 && (
                                    <div className="mt-3">
                                      <p className="mb-2 text-xs text-[#605D62]/60">クローゼットの同じアイテムは？</p>
                                      <div className="flex gap-2 overflow-x-auto pb-1">
                                        <button type="button"
                                          onClick={() => setMatchedItemIds((prev) => ({ ...prev, [i]: null }))}
                                          className={`shrink-0 rounded-xl px-3 py-2 text-xs font-medium transition ${
                                            selectedId === null && i in matchedItemIds
                                              ? "bg-[#605D62] text-white"
                                              : "bg-white ring-1 ring-[#FCE4EC] text-[#605D62]"
                                          }`}>
                                          新規アイテム
                                        </button>
                                        {candidates.map((c) => (
                                          <button key={c.id} type="button"
                                            onClick={() => setMatchedItemIds((prev) => ({ ...prev, [i]: c.id }))}
                                            className={`shrink-0 rounded-xl transition ${
                                              selectedId === c.id
                                                ? "ring-2 ring-[#605D62]"
                                                : "ring-1 ring-[#FCE4EC]"
                                            }`}>
                                            <div className="h-16 w-16 overflow-hidden rounded-xl">
                                              {c.imageUrl ? (
                                                <img src={c.imageUrl} alt={c.name ?? ""} className="h-full w-full object-cover" />
                                              ) : (
                                                <div className="flex h-full w-full items-center justify-center bg-[#fdf2f6] text-[10px] text-[#605D62]/40">
                                                  {CATEGORY_LABELS[c.category] ?? c.category}
                                                </div>
                                              )}
                                            </div>
                                            <p className="mt-0.5 w-16 truncate px-0.5 text-center text-[10px] text-[#605D62]/70">
                                              {c.name ?? CATEGORY_LABELS[c.category]}
                                            </p>
                                          </button>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-xs text-[#605D62]/60">アイテムを検出できませんでした。このまま保存できます。</p>
                        )}

                        <button type="button" onClick={handleSaveLog} disabled={isSavingLog}
                          className="w-full rounded-xl bg-[#605D62] py-2.5 text-sm font-semibold text-white disabled:opacity-50">
                          {isSavingLog ? "保存中..." : "このまま保存する"}
                        </button>
                      </div>
                    )}

                    {results.log?.status === "saved" && (
                      <div className="space-y-2">
                        <p className="text-sm text-emerald-600">✓ コーデログに保存しました！</p>
                        {results.log.confirmedItems && results.log.confirmedItems.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {results.log.confirmedItems.map((item, i) => (
                              <span key={i} className="rounded-full bg-[#FCE4EC] px-2 py-0.5 text-xs text-[#605D62]">
                                {item.categoryLabel}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {results.log?.status === "error" && (
                      <p className="text-sm text-red-500">保存に失敗しました</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {results["style-goal"] !== undefined && (
              <div className="rounded-2xl bg-white ring-1 ring-[#FCE4EC]">
                <button type="button" onClick={() => toggleAccordion("style-goal")}
                  className="flex w-full items-center justify-between p-4">
                  <div className="flex items-center gap-2">
                    <span>✨</span>
                    <span className="font-semibold">なりたい系統</span>
                    {results["style-goal"] && (
                      <span className="rounded-full bg-[#FCE4EC] px-2 py-0.5 text-xs font-medium text-[#605D62]">
                        {STYLE_LABELS[results["style-goal"].baseStyle] ?? results["style-goal"].baseStyle}
                      </span>
                    )}
                  </div>
                  <span className="text-sm text-[#605D62]/40">
                    {openAccordions.has("style-goal") ? "▲" : "▼"}
                  </span>
                </button>
                {openAccordions.has("style-goal") && (
                  <div className="border-t border-[#FCE4EC] p-4">
                    {results["style-goal"] ? (
                      <div className="space-y-2">
                        <p className="text-sm">{results["style-goal"].comment}</p>
                        <p className="text-xs text-emerald-600">✓ なりたい系統に保存しました！</p>
                      </div>
                    ) : (
                      <p className="text-sm text-red-500">スタイル判定に失敗しました</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {message && (
          <p className="mt-4 text-center text-sm text-red-500">{message}</p>
        )}
      </div>

      {/* 類似アイテム確認モーダル */}
      {duplicateConfirm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 px-4 pb-8">
          <div className="w-full max-w-md rounded-3xl bg-white p-5 shadow-xl">
            <p className="mb-1 text-sm font-bold text-[#605D62]">似たアイテムがあります</p>
            <p className="mb-4 text-xs text-[#605D62]/60">
              クローゼットに同じカテゴリのアイテムがあります。同じアイテムなら画像を差し替えられます。
            </p>

            <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
              {duplicateConfirm.matches.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    doSaveItem(duplicateConfirm.candidate, duplicateConfirm.index, item.id);
                  }}
                  className="shrink-0 rounded-2xl bg-[#fdf2f6] p-2 text-center ring-1 ring-[#FCE4EC] transition hover:ring-[#605D62]"
                >
                  <div className="h-20 w-20 overflow-hidden rounded-xl">
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt={item.name ?? ""} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[10px] text-[#605D62]/40">
                        画像なし
                      </div>
                    )}
                  </div>
                  <p className="mt-1 w-20 truncate text-center text-[10px] text-[#605D62]">
                    {item.name ?? "名称未設定"}
                  </p>
                  <p className="text-[10px] text-[#605D62]/50">タップで差し替え</p>
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => doSaveItem(duplicateConfirm.candidate, duplicateConfirm.index, null)}
              className="mb-2 w-full rounded-2xl bg-[#605D62] py-3 text-sm font-semibold text-white"
            >
              別のアイテムとして新規登録
            </button>
            <button
              type="button"
              onClick={() => setDuplicateConfirm(null)}
              className="w-full rounded-2xl bg-white py-3 text-sm font-medium text-[#605D62] ring-1 ring-[#FCE4EC]"
            >
              キャンセル
            </button>
          </div>
        </div>
      )}

      <BottomNav />
    </main>
  );
}