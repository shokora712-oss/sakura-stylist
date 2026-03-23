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

type StyleCount = { style: string; count: number };

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
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => { loadGoals(); }, []);

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
    setAnalysisResults([]); setStyleCounts([]); setTopStyle(null); setTopInspiration(null); setMessage(null);
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
    setAnalysisResults([]); setStyleCounts([]); setTopStyle(null); setTopInspiration(null);
  }

  async function uploadFile(file: File): Promise<string | null> {
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const json = await res.json();
      return json?.imageUrl ?? null;
    } catch { return null; }
  }

  async function handleAnalyze() {
    if (previewUrls.length === 0) { setMessage("画像を選択してください"); return; }
    setIsAnalyzing(true); setMessage(null); setAnalysisResults([]); setStyleCounts([]); setTopStyle(null); setTopInspiration(null);
    try {
      const results = await Promise.all(files.map(async (file) => {
        const imageDataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        const analyzeRes = await fetch("/api/style-goals/analyze", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageDataUrl }),
        });
        const json = await analyzeRes.json();
        if (!analyzeRes.ok) throw new Error(json?.error ?? "解析に失敗しました");
        return json as AnalysisResult;
      }));
      setAnalysisResults(results);
      const counts: Record<string, number> = {};
      for (const r of results) counts[r.baseStyle] = (counts[r.baseStyle] ?? 0) + 1;
      const sorted = Object.entries(counts).map(([style, count]) => ({ style, count })).sort((a, b) => b.count - a.count);
      setStyleCounts(sorted);
      const inspCounts: Record<string, number> = {};
      for (const r of results) if (r.inspiration) inspCounts[r.inspiration] = (inspCounts[r.inspiration] ?? 0) + 1;
      setTopStyle(sorted[0]?.style ?? null);
      setTopInspiration(Object.entries(inspCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null);
      setMessage(`${results.length}枚を分析しました`);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "解析に失敗しました");
    } finally { setIsAnalyzing(false); }
  }

  async function handleSave() {
    if (!topStyle) return;
    setIsSaving(true); setMessage(null);
    try {
      const uploadedUrls = await Promise.all(files.map((file) => uploadFile(file)));
      await Promise.all(files.map(async (_, index) => {
        const uploadedUrl = uploadedUrls[index];
        const result = analysisResults[index];
        if (!result) return;
        const isTop = result.baseStyle === topStyle && index === analysisResults.findIndex((r) => r.baseStyle === topStyle);
        await fetch("/api/style-goals", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            targetStyle: result.baseStyle, priority: isTop ? "high" : "medium",
            note: result.inspiration ? `inspiration: ${result.inspiration}` : null,
            isActive: isTop, imageUrl: uploadedUrl,
          }),
        });
      }));
      setCurrentTargetStyle(topStyle);
      setMessage("なりたい系統を保存しました！");
      setPreviewUrls([]); setFiles([]); setAnalysisResults([]); setStyleCounts([]); setTopStyle(null); setTopInspiration(null);
      await loadGoals();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "保存に失敗しました");
    } finally { setIsSaving(false); }
  }

  async function handleDeleteGoal(id: string) {
    try {
      const res = await fetch(`/api/style-goals/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("削除に失敗しました");
      setDeletingId(null);
      await loadGoals();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "削除に失敗しました");
      setDeletingId(null);
    }
  }

  async function handleManualSave(style: string) {
    setIsSaving(true); setMessage(null);
    try {
      const res = await fetch("/api/style-goals", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetStyle: style, priority: "medium", note: null, isActive: true, imageUrl: null }),
      });
      if (!res.ok) throw new Error("保存に失敗しました");
      setCurrentTargetStyle(style);
      setMessage("なりたい系統を保存しました！");
      await loadGoals();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "保存に失敗しました");
    } finally { setIsSaving(false); }
  }

  const goalsWithImage = goals.filter((g) => g.imageUrl);

  return (
    <div className="space-y-4">

      {/* 現在の設定 */}
      {!isLoading && (
        <section className="rounded-3xl bg-white p-5 ring-1 ring-[#FCE4EC]">
          <h2 className="mb-2 text-sm font-semibold text-[#605D62]">現在のなりたい系統</h2>
          {currentTargetStyle ? (
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-[#605D62] px-4 py-1.5 text-sm font-semibold text-white">
                {BASE_STYLE_LABELS[currentTargetStyle] ?? currentTargetStyle}
              </span>
              <span className="text-sm text-[#605D62]/60">に設定中</span>
            </div>
          ) : (
            <p className="text-sm text-[#605D62]/50">まだ設定されていません</p>
          )}
        </section>
      )}

      {/* 登録済み画像 */}
      {goalsWithImage.length > 0 && (
        <section className="rounded-3xl bg-white p-5 ring-1 ring-[#FCE4EC]">
          <h2 className="mb-3 text-sm font-semibold text-[#605D62]">登録済みの参考画像</h2>
          <div className="grid grid-cols-3 gap-2">
            {goalsWithImage.map((goal) => (
              <div key={goal.id} className="relative">
                <img src={goal.imageUrl!} alt={goal.targetStyle} className="h-24 w-full rounded-2xl object-cover" />
                <div className="absolute bottom-1 left-1 rounded-full bg-[#605D62]/80 px-1.5 py-0.5 text-xs text-white">
                  {BASE_STYLE_LABELS[goal.targetStyle] ?? goal.targetStyle}
                </div>
                {goal.isActive && (
                  <div className="absolute right-1 top-1 rounded-full bg-[#E3F2FD] px-1.5 py-0.5 text-xs font-medium text-[#605D62]">
                    メイン
                  </div>
                )}
                <button type="button" onClick={() => setDeletingId(goal.id)}
                  className="absolute left-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-400 text-xs text-white">
                  ×
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 画像から分析 */}
      <section className="rounded-3xl bg-white p-5 ring-1 ring-[#FCE4EC]">
        <h2 className="mb-1 text-sm font-semibold text-[#605D62]">気になるコーデ画像から分析</h2>
        <p className="mb-4 text-xs text-[#605D62]/50">複数枚アップするほど精度が上がります</p>

        <label className="mb-3 flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-[#FCE4EC] bg-[#fdf2f6] px-4 py-5 text-center hover:bg-[#FCE4EC]/30">
          <p className="text-sm font-medium text-[#605D62]">画像を選択（複数可）</p>
          <p className="mt-1 text-xs text-[#605D62]/40">タップして複数選択 / 貼り付けもOK</p>
          <input type="file" accept="image/*" multiple className="hidden" onChange={handleFileChange} />
        </label>

        {previewUrls.length > 0 && (
          <div className="mb-3 grid grid-cols-3 gap-2">
            {previewUrls.map((url, index) => (
              <div key={url} className="relative">
                <img src={url} alt={`preview-${index}`} className="h-24 w-full rounded-2xl object-cover" />
                <button type="button" onClick={() => removeImage(index)}
                  className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#605D62] text-xs text-white">
                  ×
                </button>
                {analysisResults[index] && (
                  <div className="absolute bottom-1 left-1 rounded-full bg-[#605D62]/80 px-1.5 py-0.5 text-xs text-white">
                    {BASE_STYLE_LABELS[analysisResults[index].baseStyle] ?? analysisResults[index].baseStyle}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <button type="button" onClick={handleAnalyze} disabled={previewUrls.length === 0 || isAnalyzing}
          className="w-full rounded-2xl bg-[#605D62] px-4 py-3 text-sm font-semibold text-white disabled:opacity-40">
          {isAnalyzing ? `分析中... (${analysisResults.length}/${previewUrls.length}枚)` : "まとめて分析する"}
        </button>

        {styleCounts.length > 0 && topStyle && (
          <div className="mt-4 rounded-2xl bg-[#E3F2FD] p-4">
            <p className="mb-3 text-xs font-semibold text-[#605D62]">分析結果</p>
            <div className="mb-3 space-y-2">
              {styleCounts.map(({ style, count }) => (
                <div key={style} className="flex items-center gap-2">
                  <div className="w-20 text-xs font-medium text-[#605D62]">{BASE_STYLE_LABELS[style] ?? style}</div>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white">
                    <div className="h-full rounded-full bg-[#605D62]" style={{ width: `${(count / previewUrls.length) * 100}%` }} />
                  </div>
                  <div className="text-xs text-[#605D62]/60">{count}枚</div>
                </div>
              ))}
            </div>
            <div className="mb-3 flex flex-wrap gap-2">
              <span className="rounded-full bg-[#605D62] px-3 py-1 text-sm font-bold text-white">
                {BASE_STYLE_LABELS[topStyle] ?? topStyle}
              </span>
              {topInspiration && (
                <span className="rounded-full bg-[#FCE4EC] px-3 py-1 text-sm font-medium text-[#605D62]">
                  {INSPIRATION_LABELS[topInspiration] ?? topInspiration}
                </span>
              )}
              <span className="self-center text-xs text-[#605D62]/60">が一番多かったです</span>
            </div>
            <button type="button" onClick={handleSave} disabled={isSaving}
              className="w-full rounded-xl bg-[#605D62] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40">
              {isSaving ? "保存中..." : "これをなりたい系統に設定する"}
            </button>
          </div>
        )}

        {message && (
          <p className={`mt-3 text-sm ${message.includes("失敗") ? "text-red-500" : "text-emerald-600"}`}>
            {message}
          </p>
        )}
      </section>

      {/* 手動選択 */}
      <section className="rounded-3xl bg-white p-5 ring-1 ring-[#FCE4EC]">
        <h2 className="mb-3 text-sm font-semibold text-[#605D62]">手動で選ぶ</h2>
        <p className="mb-2 text-xs text-[#605D62]/40">Base Style</p>
        <div className="flex flex-wrap gap-2">
          {BASE_STYLE_OPTIONS.map((option) => (
            <button key={option.value} type="button" onClick={() => handleManualSave(option.value)} disabled={isSaving}
              className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                currentTargetStyle === option.value
                  ? "bg-[#605D62] text-white"
                  : "bg-[#fdf2f6] text-[#605D62] ring-1 ring-[#FCE4EC] hover:bg-[#FCE4EC]/50"
              }`}>
              {option.label}
            </button>
          ))}
        </div>
      </section>

      {/* 削除確認モーダル */}
      {deletingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-xl">
            <p className="mb-2 text-center font-semibold text-[#605D62]">この画像を削除しますか？</p>
            <p className="mb-6 text-center text-sm text-[#605D62]/60">この操作は取り消せません</p>
            <div className="flex gap-3">
              <button type="button" onClick={() => setDeletingId(null)}
                className="flex-1 rounded-2xl border border-[#FCE4EC] py-3 text-sm font-medium text-[#605D62]">
                キャンセル
              </button>
              <button type="button" onClick={() => handleDeleteGoal(deletingId)}
                className="flex-1 rounded-2xl bg-red-500 py-3 text-sm font-semibold text-white">
                削除する
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}