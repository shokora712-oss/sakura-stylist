"use client";

import { useEffect, useState } from "react";

const BASE_STYLE_OPTIONS = [
  { value: "casual", label: "カジュアル" },
  { value: "clean", label: "きれいめ" },
  { value: "feminine", label: "フェミニン" },
  { value: "girly", label: "ガーリー" },
  { value: "simple", label: "シンプル" },
  { value: "natural", label: "ナチュラル" },
  { value: "elegant", label: "エレガント" },
  { value: "mode", label: "モード" },
  { value: "street", label: "ストリート" },
  { value: "sporty", label: "スポーティ" },
];

const INSPIRATION_OPTIONS = [
  { value: "korean", label: "韓国系" },
  { value: "french", label: "フレンチ" },
  { value: "overseas_girl", label: "海外ガール" },
  { value: "city_girl", label: "シティガール" },
  { value: "japanese_feminine", label: "日本フェミニン" },
  { value: "balletcore", label: "バレエコア" },
  { value: "old_money", label: "オールドマネー" },
  { value: "y2k", label: "Y2K" },
];

const BASE_STYLE_LABELS: Record<string, string> = Object.fromEntries(
  BASE_STYLE_OPTIONS.map((s) => [s.value, s.label])
);

const INSPIRATION_LABELS: Record<string, string> = Object.fromEntries(
  INSPIRATION_OPTIONS.map((s) => [s.value, s.label])
);

type AnalysisResult = {
  baseStyle: string;
  inspiration: string | null;
  comment: string;
};

type StyleCount = {
  style: string;
  count: number;
};

type StyleGoal = {
  id: string;
  targetStyle: string;
  imageUrl: string | null;
  isActive: boolean;
  note: string | null;
  createdAt: string;
};

export default function StyleGoalsClient() {
  const [currentTargetStyle, setCurrentTargetStyle] = useState<string | null>(null);
  const [goals, setGoals] = useState<StyleGoal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [analysisResults, setAnalysisResults] = useState<AnalysisResult[]>([]);
  const [styleCounts, setStyleCounts] = useState<StyleCount[]>([]);
  const [topStyle, setTopStyle] = useState<string | null>(null);
  const [topInspiration, setTopInspiration] = useState<string | null>(null);

  useEffect(() => {
    loadGoals();
  }, []);

  // クリップボード貼り付け対応
  useEffect(() => {
    async function handlePaste(e: ClipboardEvent) {
      const items = e.clipboardData?.items;
      if (!items) return;
      const newFiles: File[] = [];
      for (const item of Array.from(items)) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) newFiles.push(file);
        }
      }
      if (newFiles.length > 0) addFiles(newFiles);
    }
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, []);

  async function loadGoals() {
    try {
      const res = await fetch("/api/style-goals");
      const data = await res.json();
      const goalList: StyleGoal[] = Array.isArray(data?.goals) ? data.goals : [];
      setGoals(goalList);
      const activeGoal = goalList.find((g) => g.isActive);
      setCurrentTargetStyle(activeGoal?.targetStyle || null);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }

  function addFiles(newFiles: File[]) {
    const newUrls = newFiles.map((f) => URL.createObjectURL(f));
    setFiles((prev) => [...prev, ...newFiles]);
    setPreviewUrls((prev) => [...prev, ...newUrls]);
    setAnalysisResults([]);
    setStyleCounts([]);
    setTopStyle(null);
    setTopInspiration(null);
    setMessage(null);
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const newFiles = Array.from(e.target.files ?? []);
    if (newFiles.length > 0) addFiles(newFiles);
    e.target.value = "";
  }

  function removeImage(index: number) {
    URL.revokeObjectURL(previewUrls[index]);
    setPreviewUrls((prev) => prev.filter((_, i) => i !== index));
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setAnalysisResults([]);
    setStyleCounts([]);
    setTopStyle(null);
    setTopInspiration(null);
  }

  async function uploadFile(file: File): Promise<string | null> {
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const json = await res.json();
      return json?.imageUrl ?? null;
    } catch {
      return null;
    }
  }

  async function handleAnalyze() {
    if (previewUrls.length === 0) {
      setMessage("画像を選択してください");
      return;
    }

    setIsAnalyzing(true);
    setMessage(null);
    setAnalysisResults([]);
    setStyleCounts([]);
    setTopStyle(null);
    setTopInspiration(null);

    try {
      const results = await Promise.all(
        files.map(async (file) => {
          const imageDataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });

          const analyzeRes = await fetch("/api/style-goals/analyze", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ imageDataUrl }),
          });

          const json = await analyzeRes.json();
          if (!analyzeRes.ok) throw new Error(json?.error ?? "解析に失敗しました");
          return json as AnalysisResult;
        })
      );

      setAnalysisResults(results);

      const counts: Record<string, number> = {};
      for (const r of results) {
        counts[r.baseStyle] = (counts[r.baseStyle] ?? 0) + 1;
      }
      const sorted = Object.entries(counts)
        .map(([style, count]) => ({ style, count }))
        .sort((a, b) => b.count - a.count);
      setStyleCounts(sorted);

      const inspCounts: Record<string, number> = {};
      for (const r of results) {
        if (r.inspiration) {
          inspCounts[r.inspiration] = (inspCounts[r.inspiration] ?? 0) + 1;
        }
      }
      const topInsp = Object.entries(inspCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

      setTopStyle(sorted[0]?.style ?? null);
      setTopInspiration(topInsp);
      setMessage(`${results.length}枚を分析しました`);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "解析に失敗しました");
    } finally {
      setIsAnalyzing(false);
    }
  }

  async function handleSave() {
    if (!topStyle) return;
    setIsSaving(true);
    setMessage(null);

    try {
      // 全画像をSupabaseにアップロードして各GoalとしてDBに保存
      await Promise.all(
        files.map(async (file, index) => {
          const uploadedUrl = await uploadFile(file);
          const result = analysisResults[index];
          if (!result) return;

          const isTop = result.baseStyle === topStyle && index === analysisResults.findIndex((r) => r.baseStyle === topStyle);

          await fetch("/api/style-goals", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              targetStyle: result.baseStyle,
              priority: isTop ? "high" : "medium",
              note: result.inspiration ? `inspiration: ${result.inspiration}` : null,
              isActive: isTop,
              imageUrl: uploadedUrl,
            }),
          });
        })
      );

      setCurrentTargetStyle(topStyle);
      setMessage("なりたい系統を保存しました！");
      setPreviewUrls([]);
      setFiles([]);
      setAnalysisResults([]);
      setStyleCounts([]);
      setTopStyle(null);
      setTopInspiration(null);
      await loadGoals();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "保存に失敗しました");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteGoal(id: string) {
    if (!window.confirm("この画像を削除しますか？")) return;
    try {
      const res = await fetch(`/api/style-goals/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("削除に失敗しました");
      await loadGoals();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "削除に失敗しました");
    }
  }

  async function handleManualSave(style: string) {
    setIsSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/style-goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetStyle: style,
          priority: "medium",
          note: null,
          isActive: true,
          imageUrl: null,
        }),
      });
      if (!res.ok) throw new Error("保存に失敗しました");
      setCurrentTargetStyle(style);
      setMessage("なりたい系統を保存しました！");
      await loadGoals();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "保存に失敗しました");
    } finally {
      setIsSaving(false);
    }
  }

  const goalsWithImage = goals.filter((g) => g.imageUrl);

  return (
    <div className="space-y-4">
      {/* 現在の設定 */}
      {!isLoading && (
        <section className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-neutral-200">
          <h2 className="mb-2 text-base font-semibold">現在のなりたい系統</h2>
          {currentTargetStyle ? (
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-neutral-900 px-4 py-1.5 text-sm font-semibold text-white">
                {BASE_STYLE_LABELS[currentTargetStyle] ?? currentTargetStyle}
              </span>
              <span className="text-sm text-neutral-500">に設定中</span>
            </div>
          ) : (
            <p className="text-sm text-neutral-500">まだ設定されていません</p>
          )}
        </section>
      )}

      {/* 登録済み画像一覧 */}
      {goalsWithImage.length > 0 && (
        <section className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-neutral-200">
          <h2 className="mb-3 text-base font-semibold">登録済みの参考画像</h2>
          <div className="grid grid-cols-3 gap-2">
            {goalsWithImage.map((goal) => (
              <div key={goal.id} className="relative">
                <img
                  src={goal.imageUrl!}
                  alt={goal.targetStyle}
                  className="h-24 w-full rounded-xl object-cover"
                />
                <div className="absolute bottom-1 left-1 rounded-full bg-neutral-900 px-1.5 py-0.5 text-xs text-white">
                  {BASE_STYLE_LABELS[goal.targetStyle] ?? goal.targetStyle}
                </div>
                {goal.isActive && (
                  <div className="absolute right-1 top-1 rounded-full bg-emerald-500 px-1.5 py-0.5 text-xs text-white">
                    メイン
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => handleDeleteGoal(goal.id)}
                  className="absolute left-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs text-white"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 画像から分析 */}
      <section className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-neutral-200">
        <h2 className="mb-1 text-base font-semibold">気になるコーデ画像から分析</h2>
        <p className="mb-4 text-xs text-neutral-500">
          複数枚アップするほど精度が上がります
        </p>

        <label className="mb-3 flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 px-4 py-5 text-center hover:bg-neutral-100">
          <p className="text-sm font-medium text-neutral-700">画像を選択（複数可）</p>
          <p className="mt-1 text-xs text-neutral-400">タップして複数選択 / 貼り付けもOK</p>
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleFileChange}
          />
        </label>

        {previewUrls.length > 0 && (
          <div className="mb-3 grid grid-cols-3 gap-2">
            {previewUrls.map((url, index) => (
              <div key={url} className="relative">
                <img
                  src={url}
                  alt={`preview-${index}`}
                  className="h-24 w-full rounded-xl object-cover"
                />
                <button
                  type="button"
                  onClick={() => removeImage(index)}
                  className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-neutral-900 text-xs text-white"
                >
                  ×
                </button>
                {analysisResults[index] && (
                  <div className="absolute bottom-1 left-1 rounded-full bg-neutral-900 px-1.5 py-0.5 text-xs text-white">
                    {BASE_STYLE_LABELS[analysisResults[index].baseStyle] ?? analysisResults[index].baseStyle}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={handleAnalyze}
          disabled={previewUrls.length === 0 || isAnalyzing}
          className="w-full rounded-2xl bg-neutral-900 px-4 py-3 text-sm font-semibold text-white disabled:bg-neutral-300"
        >
          {isAnalyzing
            ? `分析中... (${analysisResults.length}/${previewUrls.length}枚)`
            : "まとめて分析する"}
        </button>

        {styleCounts.length > 0 && topStyle && (
          <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="mb-3 text-xs font-medium text-emerald-700">分析結果</p>

            <div className="mb-3 space-y-2">
              {styleCounts.map(({ style, count }) => (
                <div key={style} className="flex items-center gap-2">
                  <div className="w-20 text-sm font-medium">
                    {BASE_STYLE_LABELS[style] ?? style}
                  </div>
                  <div className="flex-1 h-2 overflow-hidden rounded-full bg-emerald-100">
                    <div
                      className="h-2 rounded-full bg-emerald-600"
                      style={{ width: `${(count / previewUrls.length) * 100}%` }}
                    />
                  </div>
                  <div className="text-xs text-emerald-700">{count}枚</div>
                </div>
              ))}
            </div>

            <div className="mb-3 flex flex-wrap gap-2">
              <span className="rounded-full bg-neutral-900 px-3 py-1 text-sm font-bold text-white">
                {BASE_STYLE_LABELS[topStyle] ?? topStyle}
              </span>
              {topInspiration && (
                <span className="rounded-full bg-emerald-700 px-3 py-1 text-sm font-medium text-white">
                  {INSPIRATION_LABELS[topInspiration] ?? topInspiration}
                </span>
              )}
              <span className="self-center text-sm text-emerald-800">が一番多かったです</span>
            </div>

            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="w-full rounded-xl bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white disabled:bg-neutral-300"
            >
              {isSaving ? "保存中..." : "これをなりたい系統に設定する"}
            </button>
          </div>
        )}

        {message && (
          <p className={`mt-3 text-sm ${message.includes("失敗") ? "text-red-600" : "text-emerald-600"}`}>
            {message}
          </p>
        )}
      </section>

      {/* 手動選択 */}
      <section className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-neutral-200">
        <h2 className="mb-3 text-base font-semibold">手動で選ぶ</h2>
        <p className="mb-2 text-xs text-neutral-500">Base Style</p>
        <div className="flex flex-wrap gap-2">
          {BASE_STYLE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => handleManualSave(option.value)}
              disabled={isSaving}
              className={`rounded-full px-4 py-2 text-sm font-medium ring-1 transition ${
                currentTargetStyle === option.value
                  ? "bg-neutral-900 text-white ring-neutral-900"
                  : "bg-white text-neutral-700 ring-neutral-300 hover:bg-neutral-100"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}