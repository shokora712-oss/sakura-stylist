"use client";

import Link from "next/link";
import { ChangeEvent, useEffect, useMemo, useState } from "react";
import AppHeader from "../../components/AppHeader";

type EvaluationResult = {
  totalScore: number;
  colorScore: number;
  silhouetteScore: number;
  seasonScore: number;
  occasionScore: number;
  summary: string;
  goodPoints: string[];
  improvementPoints: string[];
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
    if (!ctx) throw new Error();
    ctx.drawImage(img, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", 0.82);
    });
    if (!blob) throw new Error();
    return new File([blob], `${file.name.replace(/\.[^.]+$/, "")}.jpg`, { type: "image/jpeg" });
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
}

export default function GuestEvaluatePage() {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string>("");
  const [selectedOccasion, setSelectedOccasion] = useState<string | null>(null);
  const [selectedSeason, setSelectedSeason] = useState<string | null>(null);
  const [selectedStyle, setSelectedStyle] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<EvaluationResult | null>(null);

  useEffect(() => {
    return () => { if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl); };
  }, [imagePreviewUrl]);

  const canEvaluate = useMemo(() => {
    return Boolean(imageFile && selectedOccasion && selectedSeason && selectedStyle);
  }, [imageFile, selectedOccasion, selectedSeason, selectedStyle]);

  const handleImageChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    if (!file) { setImageFile(null); setImagePreviewUrl(""); return; }
    try {
      setMessage("画像を調整中...");
      setResult(null);
      const compressedFile = await compressImageFile(file);
      setImageFile(compressedFile);
      setImagePreviewUrl(URL.createObjectURL(compressedFile));
      setMessage("");
    } catch {
      setImageFile(null);
      setImagePreviewUrl("");
      setMessage("画像の読み込みに失敗しました");
    }
  };

  const handleEvaluate = async () => {
    if (!canEvaluate || !imageFile) { setMessage("画像・TPO・季節・なりたい系統を選んでね"); return; }
    try {
      setLoading(true);
      setMessage("");
      setResult(null);
      const formData = new FormData();
      formData.append("image", imageFile);
      formData.append("occasion", selectedOccasion ?? "");
      formData.append("season", selectedSeason ?? "");
      formData.append("style", selectedStyle ?? "");
      const res = await fetch("/api/evaluate", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "コーデ評価に失敗しました");
      setResult(data);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "コーデ評価に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#fdf2f6] pb-24 text-[#605D62]">
      <div className="mx-auto max-w-md px-4 py-6">
        <div className="mb-4 flex items-center gap-2">
          <Link href="/guest" className="text-sm text-[#605D62]/60">← ゲストホーム</Link>
        </div>
        <AppHeader title="コーデ評価" description="AIがコーデをスコアリングします" />

        <div className="space-y-4">
          {/* 画像アップロード */}
          <div className="rounded-3xl bg-white p-5 ring-1 ring-[#FCE4EC]">
            <h2 className="mb-4 font-semibold">コーデ画像</h2>
            <label className="block cursor-pointer">
              <div className="flex h-64 items-center justify-center overflow-hidden rounded-2xl bg-[#fdf2f6]">
                {imagePreviewUrl ? (
                  <img src={imagePreviewUrl} alt="preview" className="h-full w-full object-contain" />
                ) : (
                  <div className="text-center">
                    <p className="text-3xl">📷</p>
                    <p className="mt-2 text-sm font-medium text-[#605D62]">タップして画像を選択</p>
                    <p className="text-xs text-[#605D62]/50">コーデ全体が写った写真を選んでね</p>
                  </div>
                )}
              </div>
              <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
            </label>
          </div>

          {/* TPO */}
          <div className="rounded-3xl bg-white p-5 ring-1 ring-[#FCE4EC]">
            <h2 className="mb-3 font-semibold">TPO</h2>
            <div className="flex flex-wrap gap-2">
              {occasionOptions.map((opt) => (
                <button key={opt.value} type="button" onClick={() => setSelectedOccasion(opt.value)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                    selectedOccasion === opt.value ? "bg-[#605D62] text-white" : "bg-[#fdf2f6] text-[#605D62]"
                  }`}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* 季節 */}
          <div className="rounded-3xl bg-white p-5 ring-1 ring-[#FCE4EC]">
            <h2 className="mb-3 font-semibold">季節</h2>
            <div className="flex flex-wrap gap-2">
              {seasonOptions.map((opt) => (
                <button key={opt.value} type="button" onClick={() => setSelectedSeason(opt.value)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                    selectedSeason === opt.value ? "bg-[#605D62] text-white" : "bg-[#fdf2f6] text-[#605D62]"
                  }`}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* なりたい系統 */}
          <div className="rounded-3xl bg-white p-5 ring-1 ring-[#FCE4EC]">
            <h2 className="mb-3 font-semibold">なりたい系統</h2>
            <div className="flex flex-wrap gap-2">
              {styleOptions.map((opt) => (
                <button key={opt.value} type="button" onClick={() => setSelectedStyle(opt.value)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                    selectedStyle === opt.value ? "bg-[#605D62] text-white" : "bg-[#fdf2f6] text-[#605D62]"
                  }`}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <button type="button" onClick={handleEvaluate} disabled={!canEvaluate || loading}
            className="w-full rounded-3xl bg-[#605D62] py-4 text-sm font-bold text-white shadow-sm disabled:opacity-40">
            {loading ? "AIが評価中..." : "評価する"}
          </button>

          {message && (
            <div className="rounded-2xl bg-[#FCE4EC] p-4 text-sm text-[#605D62]">{message}</div>
          )}

          {result && (
            <>
              <div className="rounded-3xl bg-white p-5 ring-1 ring-[#FCE4EC]">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="font-semibold">AI評価結果</h2>
                  <span className="rounded-full bg-[#FCE4EC] px-3 py-1 text-sm font-bold text-[#605D62]">
                    {result.totalScore}点
                  </span>
                </div>
                <p className="text-sm leading-relaxed text-[#605D62]/80">{result.summary}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "色バランス", score: result.colorScore },
                  { label: "シルエット", score: result.silhouetteScore },
                  { label: "季節感", score: result.seasonScore },
                  { label: "TPO適合", score: result.occasionScore },
                ].map((item) => (
                  <div key={item.label} className="rounded-2xl bg-white p-4 ring-1 ring-[#FCE4EC]">
                    <p className="text-xs text-[#605D62]/60">{item.label}</p>
                    <p className="mt-1 text-xl font-bold text-[#605D62]">{item.score}<span className="text-xs font-normal"> / 24</span></p>
                  </div>
                ))}
              </div>

              <div className="rounded-3xl bg-white p-5 ring-1 ring-[#FCE4EC]">
                <h3 className="mb-3 text-sm font-semibold text-emerald-600">良い点</h3>
                <ul className="space-y-2">
                  {result.goodPoints.map((p, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <span className="mt-0.5 text-emerald-500">✓</span>{p}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-3xl bg-white p-5 ring-1 ring-[#FCE4EC]">
                <h3 className="mb-3 text-sm font-semibold text-orange-500">改善ポイント</h3>
                <ul className="space-y-2">
                  {result.improvementPoints.map((p, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <span className="mt-0.5 text-orange-400">→</span>{p}
                    </li>
                  ))}
                </ul>
              </div>

              {/* ログイン誘導 */}
              <div className="rounded-3xl bg-gradient-to-r from-[#FCE4EC] to-[#E3F2FD] p-5">
                <p className="font-semibold text-[#605D62]">もっと使いたいですか？</p>
                <p className="mt-1 text-xs text-[#605D62]/70">
                  ログインするとコーデ保存・クローゼット管理・スタイル分析など全機能が使えます
                </p>
                <Link href="/login"
                  className="mt-3 block w-full rounded-2xl bg-[#605D62] py-3 text-center text-sm font-bold text-white">
                  Googleでログイン・新規登録
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}