"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import BottomNav from "@/app/components/BottomNav";

type CategoryStat = {
  category: string;
  label: string;
  count: number;
  ratio: number;
};

type StyleStat = {
  style: string;
  label: string;
  count: number;
};

type GapAnalysis = {
  targetStyle: string;
  targetStyleLabel: string;
  favoriteStyle: string | null;
  favoriteStyleLabel: string | null;
  targetCount: number;
  targetRatio: number;
  isWeak: boolean;
};

type Suggestion = {
  item: string;
  reason: string;
  priority: "high" | "medium" | "low";
};

type AnalysisResult = {
  categoryStats: CategoryStat[];
  styleStats: StyleStat[];
  gapAnalysis: GapAnalysis | null;
  summary: string;
  suggestions: Suggestion[];
  totalItems: number;
  message?: string;
};

const PRIORITY_LABELS: Record<string, { label: string; className: string }> = {
  high: { label: "優先度高", className: "bg-red-100 text-red-800" },
  medium: { label: "優先度中", className: "bg-amber-100 text-amber-800" },
  low: { label: "優先度低", className: "bg-neutral-100 text-neutral-700" },
};

export default function AnalysisPage() {
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchAnalysis() {
      try {
        const res = await fetch("/api/analysis/wardrobe");
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error ?? "分析に失敗しました");
        setResult(json);
      } catch (e) {
        setError(e instanceof Error ? e.message : "分析に失敗しました");
      } finally {
        setIsLoading(false);
      }
    }
    fetchAnalysis();
  }, []);

  return (
    <main className="min-h-screen bg-neutral-50 pb-32 text-neutral-900">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col px-4 py-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-sm text-neutral-500">Closet AI</p>
            <h1 className="text-2xl font-bold">足りない服分析</h1>
          </div>
          <Link
            href="/"
            className="inline-flex w-fit rounded-xl border border-neutral-300 bg-white px-4 py-2 text-sm font-medium hover:bg-neutral-100"
          >
            ホームへ戻る
          </Link>
        </div>

        {isLoading && (
          <div className="flex flex-col items-center justify-center py-20 text-neutral-500">
            <p className="text-sm">クローゼットを分析中...</p>
          </div>
        )}

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {result?.message && !isLoading && (
          <div className="rounded-2xl border border-neutral-200 bg-white px-4 py-6 text-center text-sm text-neutral-500">
            {result.message}
            <div className="mt-4">
              <Link
                href="/closet/new"
                className="rounded-xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white"
              >
                アイテムを登録する
              </Link>
            </div>
          </div>
        )}

        {result && !result.message && (
          <div className="space-y-4">
            {/* サマリー */}
            {result.summary && (
              <section className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-neutral-200">
                <h2 className="mb-2 text-base font-semibold">AIからのコメント</h2>
                <p className="text-sm leading-relaxed text-neutral-700">{result.summary}</p>
              </section>
            )}

            {/* なりたい系統ギャップ */}
            {result.gapAnalysis && (
              <section className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-neutral-200">
                <h2 className="mb-3 text-base font-semibold">系統ギャップ</h2>
                <div className="flex items-center gap-3 text-sm">
                  <div className="flex-1 rounded-2xl bg-neutral-100 px-3 py-2 text-center">
                    <p className="text-xs text-neutral-500">今の系統</p>
                    <p className="font-semibold">
                      {result.gapAnalysis.favoriteStyleLabel ?? "未設定"}
                    </p>
                  </div>
                  <span className="text-neutral-400">→</span>
                  <div className="flex-1 rounded-2xl bg-neutral-900 px-3 py-2 text-center text-white">
                    <p className="text-xs text-neutral-300">なりたい系統</p>
                    <p className="font-semibold">{result.gapAnalysis.targetStyleLabel}</p>
                  </div>
                </div>
                {result.gapAnalysis.isWeak && (
                  <p className="mt-3 text-xs text-amber-700">
                    現在のクローゼットに{result.gapAnalysis.targetStyleLabel}のアイテムが少ないです（{result.gapAnalysis.targetRatio}%）。購入候補を参考にしてみてください。
                  </p>
                )}
              </section>
            )}

            {/* カテゴリ別 */}
            <section className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-neutral-200">
              <h2 className="mb-3 text-base font-semibold">カテゴリ別アイテム数</h2>
              <div className="space-y-2">
                {result.categoryStats.map((stat) => (
                  <div key={stat.category}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span>{stat.label}</span>
                      <span className="text-neutral-500">{stat.count}件</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-100">
                      <div
                        className="h-2 rounded-full bg-neutral-900 transition-all"
                        style={{ width: `${Math.min(stat.ratio, 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* スタイル別 */}
            <section className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-neutral-200">
              <h2 className="mb-3 text-base font-semibold">スタイル別アイテム数</h2>
              <div className="flex flex-wrap gap-2">
                {result.styleStats.map((stat) => (
                  <div
                    key={stat.style}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium ring-1 ${
                      stat.count > 0
                        ? "bg-neutral-900 text-white ring-neutral-900"
                        : "bg-white text-neutral-400 ring-neutral-200"
                    }`}
                  >
                    {stat.label} {stat.count > 0 && `(${stat.count})`}
                  </div>
                ))}
              </div>
            </section>

            {/* 購入候補 */}
            {result.suggestions.length > 0 && (
              <section className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-neutral-200">
                <h2 className="mb-3 text-base font-semibold">購入候補</h2>
                <div className="space-y-3">
                  {result.suggestions.map((suggestion, index) => {
                    const priority = PRIORITY_LABELS[suggestion.priority] ?? PRIORITY_LABELS.medium;
                    return (
                      <div
                        key={index}
                        className="rounded-2xl border border-neutral-200 bg-neutral-50 p-3"
                      >
                        <div className="mb-1 flex items-center gap-2">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${priority.className}`}>
                            {priority.label}
                          </span>
                          <p className="text-sm font-semibold">{suggestion.item}</p>
                        </div>
                        <p className="text-xs leading-relaxed text-neutral-600">{suggestion.reason}</p>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* なりたい系統未設定の場合 */}
            {!result.gapAnalysis && (
              <section className="rounded-3xl border border-dashed border-neutral-300 bg-white p-4 text-center">
                <p className="mb-3 text-sm text-neutral-500">
                  なりたい系統を設定すると、より精度の高い分析ができます
                </p>
                <Link
                  href="/profile"
                  className="inline-flex rounded-xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white"
                >
                  系統を設定する
                </Link>
              </section>
            )}
          </div>
        )}
      </div>
      <BottomNav />
    </main>
  );
}