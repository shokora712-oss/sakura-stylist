"use client";

import Link from "next/link";
import { ChangeEvent, useEffect, useMemo, useState } from "react";
import AppHeader from "../components/AppHeader";

type OccasionOption = {
  value: string;
  label: string;
};

type SeasonOption = {
  value: string;
  label: string;
};

type StyleOption = {
  value: string;
  label: string;
};

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


const occasionOptions: OccasionOption[] = [
  { value: "casual", label: "カジュアル" },
  { value: "date", label: "デート" },
  { value: "office", label: "仕事" },
  { value: "formal", label: "フォーマル" },
  { value: "travel", label: "旅行" },
  { value: "school", label: "学校" },
];

const seasonOptions: SeasonOption[] = [
  { value: "spring", label: "春" },
  { value: "summer", label: "夏" },
  { value: "autumn", label: "秋" },
  { value: "winter", label: "冬" },
];

const styleOptions: StyleOption[] = [
  { value: "casual", label: "カジュアル" },
  { value: "girly", label: "ガーリー" },
  { value: "street", label: "ストリート" },
  { value: "mode", label: "モード" },
  { value: "minimal", label: "ミニマル" },
  { value: "feminine", label: "フェミニン" },
  { value: "office", label: "オフィス" },
];

export default function EvaluatePage() {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string>("");

  const [selectedOccasion, setSelectedOccasion] = useState<string | null>(null);
  const [selectedSeason, setSelectedSeason] = useState<string | null>(null);
  const [selectedStyle, setSelectedStyle] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<EvaluationResult | null>(null);

  useEffect(() => {
    return () => {
      if (imagePreviewUrl) {
        URL.revokeObjectURL(imagePreviewUrl);
      }
    };
  }, [imagePreviewUrl]);

  const canEvaluate = useMemo(() => {
    return Boolean(imageFile && selectedOccasion && selectedSeason && selectedStyle);
  }, [imageFile, selectedOccasion, selectedSeason, selectedStyle]);

const compressImageFile = async (file: File): Promise<File> => {
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
    if (!ctx) {
      throw new Error("画像圧縮の初期化に失敗しました");
    }

    ctx.drawImage(img, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", 0.82);
    });

    if (!blob) {
      throw new Error("画像圧縮に失敗しました");
    }

    const originalBaseName = file.name.replace(/\.[^.]+$/, "");
    return new File([blob], `${originalBaseName}.jpg`, {
      type: "image/jpeg",
    });
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
};

  const handleImageChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;

    if (!file) {
      setImageFile(null);
      setImagePreviewUrl("");
      return;
    }

    try {
      setMessage("画像を調整中...");
      setResult(null);

      const compressedFile = await compressImageFile(file);

      setImageFile(compressedFile);
      const previewUrl = URL.createObjectURL(compressedFile);
      setImagePreviewUrl(previewUrl);
      setMessage("");
    } catch (error) {
      console.error(error);
      setImageFile(null);
      setImagePreviewUrl("");
      setMessage("画像の読み込みに失敗しました");
    }
  };

  const handleEvaluate = async () => {
    if (!canEvaluate || !imageFile) {
      setMessage("画像・TPO・季節・なりたい系統を選んでね");
      return;
    }

    try {
      setLoading(true);
      setMessage("");
      setResult(null);

      const formData = new FormData();
      formData.append("image", imageFile);
      formData.append("occasion", selectedOccasion ?? "");
      formData.append("season", selectedSeason ?? "");
      formData.append("style", selectedStyle ?? "");

      const res = await fetch("/api/evaluate", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "コーデ評価に失敗しました");
      }

      setResult(data);
    } catch (error) {
      console.error(error);
      setMessage(
        error instanceof Error ? error.message : "コーデ評価に失敗しました"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#fafafa] pb-24">
      <div className="mx-auto max-w-md px-4 py-6">
        <PageHeader
          title="コーデ評価"
          description="画像からコーデを評価して、良い点と改善点をチェック。"
        />

        <section className="space-y-4">
          <SectionCard>
            <h2 className="mb-4 text-xl font-bold">コーデ画像</h2>

            <label className="block cursor-pointer">
              <div className="flex h-72 items-center justify-center rounded-3xl bg-gray-100 text-center">
                {imagePreviewUrl ? (
                  <img
                    src={imagePreviewUrl}
                    alt="コーデ画像プレビュー"
                    className="h-full w-full rounded-3xl object-contain"
                  />
                ) : (
                  <div className="px-6">
                    <p className="text-lg font-semibold">画像をアップロード</p>
                    <p className="mt-2 text-sm text-gray-500">
                      コーデ全体が分かる写真を1枚選んでね
                    </p>
                  </div>
                )}
              </div>

              <input
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="hidden"
              />
            </label>

            {imageFile && (
              <div className="mt-4 rounded-2xl bg-gray-50 p-3 text-sm text-gray-600">
                <p>
                  <span className="font-semibold text-gray-800">選択中ファイル：</span>
                  {imageFile.name}
                </p>
                <p>
                  <span className="font-semibold text-gray-800">形式：</span>
                  {imageFile.type || "不明"}
                </p>
                <p>
                  <span className="font-semibold text-gray-800">サイズ：</span>
                  {(imageFile.size / 1024).toFixed(1)} KB
                </p>
              </div>
            )}
          </SectionCard>

          <SectionCard>
            <h2 className="mb-4 text-xl font-bold">TPO</h2>
            <div className="flex flex-wrap gap-2">
              {occasionOptions.map((option) => (
                <ChipButton
                  key={option.value}
                  label={option.label}
                  active={selectedOccasion === option.value}
                  onClick={() => setSelectedOccasion(option.value)}
                />
              ))}
            </div>
          </SectionCard>

          <SectionCard>
            <h2 className="mb-4 text-xl font-bold">季節</h2>
            <div className="flex flex-wrap gap-2">
              {seasonOptions.map((option) => (
                <ChipButton
                  key={option.value}
                  label={option.label}
                  active={selectedSeason === option.value}
                  onClick={() => setSelectedSeason(option.value)}
                />
              ))}
            </div>
          </SectionCard>

          <SectionCard>
            <h2 className="mb-4 text-xl font-bold">なりたい系統</h2>
            <div className="flex flex-wrap gap-2">
              {styleOptions.map((option) => (
                <ChipButton
                  key={option.value}
                  label={option.label}
                  active={selectedStyle === option.value}
                  onClick={() => setSelectedStyle(option.value)}
                />
              ))}
            </div>
          </SectionCard>

          <button
            type="button"
            onClick={handleEvaluate}
            disabled={!canEvaluate || loading}
            className="w-full rounded-3xl bg-[#0b2341] py-4 text-base font-semibold text-white shadow-sm disabled:opacity-40"
          >
            {loading ? "AIが評価中..." : "評価する"}
          </button>

          {message && (
            <div className="rounded-3xl bg-yellow-50 p-4 text-sm text-yellow-800">
              {message}
            </div>
          )}

          {result && (
            <>
              <SectionCard>
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-2xl font-bold">AI評価結果</h2>
                  <div className="rounded-2xl bg-gray-100 px-4 py-2 text-sm font-semibold">
                    {result.totalScore}点
                  </div>
                </div>

                <p className="text-sm leading-6 text-gray-600">{result.summary}</p>
              </SectionCard>

              {result.debug && (
                <SectionCard>
                  <h3 className="mb-3 text-lg font-bold">画像受信確認</h3>
                  <div className="space-y-2 text-sm text-gray-600">
                    <p>
                      <span className="font-semibold text-gray-800">ファイル名：</span>
                      {result.debug.imageName ?? "なし"}
                    </p>
                    <p>
                      <span className="font-semibold text-gray-800">形式：</span>
                      {result.debug.imageType ?? "なし"}
                    </p>
                    <p>
                      <span className="font-semibold text-gray-800">サイズ：</span>
                      {typeof result.debug.imageSize === "number"
                        ? `${(result.debug.imageSize / 1024).toFixed(1)} KB`
                        : "なし"}
                    </p>
                  </div>
                </SectionCard>
              )}

              {result.analysis && (
                <SectionCard>
                  <h3 className="mb-3 text-lg font-bold">画像解析結果</h3>
                  <div className="space-y-2 text-sm text-gray-600">
                    <p>
                      <span className="font-semibold text-gray-800">検出アイテム：</span>
                      {result.analysis.detectedItems.join(" / ")}
                    </p>
                    <p>
                      <span className="font-semibold text-gray-800">想定カラー：</span>
                      {result.analysis.dominantColors.join(" / ")}
                    </p>
                    <p>
                      <span className="font-semibold text-gray-800">想定系統：</span>
                      {result.analysis.styleGuess}
                    </p>
                    <p>
                      <span className="font-semibold text-gray-800">想定季節感：</span>
                      {result.analysis.seasonGuess}
                    </p>
                    <p>
                      <span className="font-semibold text-gray-800">AIコメント：</span>
                      {result.analysis.comment}
                    </p>
                  </div>
                </SectionCard>
              )}

              <div className="grid grid-cols-2 gap-4">
                <ScoreCard label="色バランス" score={result.colorScore} />
                <ScoreCard label="シルエット" score={result.silhouetteScore} />
                <ScoreCard label="季節感" score={result.seasonScore} />
                <ScoreCard label="TPO適合" score={result.occasionScore} />
              </div>

              <SectionCard>
                <h3 className="mb-3 text-lg font-bold">良い点</h3>
                <ul className="space-y-2 text-sm leading-6 text-gray-600">
                  {result.goodPoints.map((point, index) => (
                    <li key={index}>・{point}</li>
                  ))}
                </ul>
              </SectionCard>

              <SectionCard>
                <h3 className="mb-3 text-lg font-bold">改善ポイント</h3>
                <ul className="space-y-2 text-sm leading-6 text-gray-600">
                  {result.improvementPoints.map((point, index) => (
                    <li key={index}>・{point}</li>
                  ))}
                </ul>
              </SectionCard>
            </>
          )}
        </section>
      </div>

      <BottomNav />
    </main>
  );
}

function PageHeader({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
      <AppHeader
        title="コーデ評価"
        description="画像からコーデを評価して、良い点と改善点をチェック。"
      />
        );
}

function SectionCard({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
      {children}
    </div>
  );
}

function ChipButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl px-4 py-2 text-sm font-medium transition ${
        active
          ? "bg-[#0b2341] text-white"
          : "border border-gray-200 bg-gray-50 text-gray-700"
      }`}
    >
      {label}
    </button>
  );
}

function ScoreCard({
  label,
  score,
}: {
  label: string;
  score: number;
}) {
  return (
    <div className="rounded-3xl border border-gray-200 bg-white p-4 shadow-sm">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-2 text-2xl font-bold text-[#0b2341]">{score} / 24</p>
    </div>
  );
}

function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-1/2 w-full max-w-md -translate-x-1/2 border-t border-gray-200 bg-white px-8 py-3">
      <div className="flex items-center justify-between">
        <Link href="/" className="flex h-12 w-12 items-center justify-center text-2xl">
          🏠
        </Link>
        <Link
          href="/closet/new"
          className="flex h-12 w-12 items-center justify-center rounded-2xl border border-gray-300 text-2xl"
        >
          ＋
        </Link>
        <Link href="/logs" className="flex h-12 w-12 items-center justify-center text-2xl">
          👤
        </Link>
      </div>
    </nav>
  );
}