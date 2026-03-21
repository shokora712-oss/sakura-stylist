"use client";

import { useEffect, useRef, useState } from "react";

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

export default function StyleGoalsClient() {
  const [currentTargetStyle, setCurrentTargetStyle] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzedBaseStyle, setAnalyzedBaseStyle] = useState<string | null>(null);
  const [analyzedInspiration, setAnalyzedInspiration] = useState<string | null>(null);
  const [analyzeComment, setAnalyzeComment] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const pasteAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function loadProfile() {
      try {
        const res = await fetch("/api/profile");
        const data = await res.json();
        setCurrentTargetStyle(data?.profile?.targetStyle || null);
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    }
    loadProfile();
  }, []);

  // クリップボード貼り付け対応
  useEffect(() => {
    async function handlePaste(e: ClipboardEvent) {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) await processImageFile(file);
          break;
        }
      }
    }
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, []);

  async function processImageFile(file: File) {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setAnalyzedBaseStyle(null);
    setAnalyzedInspiration(null);
    setAnalyzeComment(null);
    setMessage(null);
    setIsAnalyzing(true);

    try {
      const reader = new FileReader();
      const imageDataUrl = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const res = await fetch("/api/style-goals/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageDataUrl }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "解析に失敗しました");

      setAnalyzedBaseStyle(json.baseStyle);
      setAnalyzedInspiration(json.inspiration ?? null);
      setAnalyzeComment(json.comment);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "解析に失敗しました");
    } finally {
      setIsAnalyzing(false);
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) await processImageFile(file);
  }

  async function handleSave() {
    if (!analyzedBaseStyle) return;
    setIsSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetStyle: analyzedBaseStyle }),
      });
      if (!res.ok) throw new Error("保存に失敗しました");
      setCurrentTargetStyle(analyzedBaseStyle);
      setMessage("なりたい系統を保存しました！");
      setPreviewUrl(null);
      setAnalyzedBaseStyle(null);
      setAnalyzedInspiration(null);
      setAnalyzeComment(null);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "保存に失敗しました");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleManualSave(style: string) {
    setIsSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetStyle: style }),
      });
      if (!res.ok) throw new Error("保存に失敗しました");
      setCurrentTargetStyle(style);
      setMessage("なりたい系統を保存しました！");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "保存に失敗しました");
    } finally {
      setIsSaving(false);
    }
  }

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

      {/* 画像から判定 */}
      <section className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-neutral-200">
        <h2 className="mb-1 text-base font-semibold">コーデ画像から判定</h2>
        <p className="mb-4 text-xs text-neutral-500">
          気になるコーデ画像をアップロードまたは貼り付けると、AIがスタイルを判定します
        </p>

        <div
          ref={pasteAreaRef}
          className="mb-3 flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 px-4 py-6 text-center"
          onClick={() => document.getElementById("style-image-input")?.click()}
        >
          {previewUrl ? (
            <img src={previewUrl} alt="preview" className="max-h-64 w-auto rounded-xl object-contain" />
          ) : (
            <>
              <p className="text-sm font-medium text-neutral-700">画像を選択 / 貼り付け</p>
              <p className="mt-1 text-xs text-neutral-400">
                スマホで画像を長押しコピー → ここに貼り付けもOK
              </p>
            </>
          )}
          <input
            id="style-image-input"
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>

        {isAnalyzing && (
          <p className="text-center text-sm text-neutral-500">AIが解析中...</p>
        )}

        {analyzedBaseStyle && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="mb-2 text-xs text-emerald-700">判定結果</p>
            <div className="flex flex-wrap gap-2 mb-2">
              <span className="rounded-full bg-neutral-900 px-3 py-1 text-sm font-bold text-white">
                {BASE_STYLE_LABELS[analyzedBaseStyle] ?? analyzedBaseStyle}
              </span>
              {analyzedInspiration && (
                <span className="rounded-full bg-emerald-700 px-3 py-1 text-sm font-medium text-white">
                  {INSPIRATION_LABELS[analyzedInspiration] ?? analyzedInspiration}
                </span>
              )}
            </div>
            {analyzeComment && (
              <p className="mt-1 text-sm text-emerald-800">{analyzeComment}</p>
            )}
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="mt-3 w-full rounded-xl bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white disabled:bg-neutral-300"
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
        <div className="flex flex-wrap gap-2 mb-4">
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