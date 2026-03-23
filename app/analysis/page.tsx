"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import BottomNav from "@/app/components/BottomNav";
import AppHeader from "@/app/components/AppHeader";

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
  high: { label: "優先度高", className: "bg-[#FCE4EC] text-[#605D62]" },
  medium: { label: "優先度中", className: "bg-[#E3F2FD] text-[#605D62]" },
  low: { label: "優先度低", className: "bg-[#fdf2f6] text-[#605D62]/60" },
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
    <main className="min-h-screen bg-[#fdf2f6] pb-32 text-[#605D62]">
      <div className="mx-auto w-full max-w-md px-4 py-6">
        <AppHeader title="クローゼット分析" description="あなたのクローゼットを分析して買い足しを提案" />

        {isLoading && (
          <div className="flex flex-col items-center justify-center py-20 text-[#605D62]/50">
            <p className="text-sm">クローゼットを分析中...</p>
          </div>
        )}

        {error && (
          <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        {result?.message && !isLoading && (
          <div className="rounded-3xl bg-white px-4 py-8 text-center ring-1 ring-[#FCE4EC]">
            <p className="text-sm text-[#605D62]/60">{result.message}</p>
            <div className="mt-4">
              <Link href="/closet/new"
                className="rounded-2xl bg-[#605D62] px-5 py-2.5 text-sm font-semibold text-white">
                アイテムを登録する
              </Link>
            </div>
          </div>
        )}

        {result && !result.message && (
          <div className="space-y-4">

            {/* AIからのコメント */}
            {result.summary && (
              <section className="rounded-3xl bg-white p-5 ring-1 ring-[#FCE4EC]">
                <h2 className="mb-2 text-sm font-semibold text-[#605D62]">AIからのコメント</h2>
                <p className="text-sm leading-relaxed text-[#605D62]/70">{result.summary}</p>
              </section>
            )}

            {/* 系統ギャップ */}
            {result.gapAnalysis && (
              <section className="rounded-3xl bg-white p-5 ring-1 ring-[#FCE4EC]">
                <h2 className="mb-3 text-sm font-semibold text-[#605D62]">系統ギャップ</h2>
                <div className="flex items-center gap-3 text-sm">
                  <div className="flex-1 rounded-2xl bg-[#fdf2f6] px-3 py-2.5 text-center ring-1 ring-[#FCE4EC]">
                    <p className="text-xs text-[#605D62]/50">今の系統</p>
                    <p className="mt-0.5 font-semibold text-[#605D62]">
                      {result.gapAnalysis.favoriteStyleLabel ?? "未設定"}
                    </p>
                  </div>
                  <span className="text-[#605D62]/30">→</span>
                  <div className="flex-1 rounded-2xl bg-[#605D62] px-3 py-2.5 text-center">
                    <p className="text-xs text-white/60">なりたい系統</p>
                    <p className="mt-0.5 font-semibold text-white">{result.gapAnalysis.targetStyleLabel}</p>
                  </div>
                </div>
                {result.gapAnalysis.isWeak && (
                  <p className="mt-3 text-xs leading-relaxed text-[#605D62]/60">
                    現在のクローゼットに{result.gapAnalysis.targetStyleLabel}のアイテムが少ないです（{result.gapAnalysis.targetRatio}%）。購入候補を参考にしてみてください。
                  </p>
                )}
              </section>
            )}

            {/* カテゴリ別 */}
            <section className="rounded-3xl bg-white p-5 ring-1 ring-[#FCE4EC]">
              <h2 className="mb-3 text-sm font-semibold text-[#605D62]">カテゴリ別アイテム数</h2>
              <div className="space-y-3">
                {result.categoryStats.map((stat) => (
                  <div key={stat.category}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="font-medium text-[#605D62]">{stat.label}</span>
                      <span className="text-[#605D62]/50">{stat.count}件</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#fdf2f6]">
                      <div
                        className="h-full rounded-full bg-[#605D62] transition-all"
                        style={{ width: `${Math.min(stat.ratio, 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* スタイル別 */}
            <section className="rounded-3xl bg-white p-5 ring-1 ring-[#FCE4EC]">
              <h2 className="mb-3 text-sm font-semibold text-[#605D62]">スタイル別アイテム数</h2>
              <div className="flex flex-wrap gap-2">
                {result.styleStats.map((stat) => (
                  <div key={stat.style}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                      stat.count > 0
                        ? "bg-[#605D62] text-white"
                        : "bg-[#fdf2f6] text-[#605D62]/40 ring-1 ring-[#FCE4EC]"
                    }`}>
                    {stat.label}{stat.count > 0 && ` (${stat.count})`}
                  </div>
                ))}
              </div>
            </section>

            {/* 購入候補 */}
            {result.suggestions.length > 0 && (
              <section className="rounded-3xl bg-white p-5 ring-1 ring-[#FCE4EC]">
                <h2 className="mb-3 text-sm font-semibold text-[#605D62]">購入候補</h2>
                <div className="space-y-3">
                  {result.suggestions.map((suggestion, index) => {
                    const priority = PRIORITY_LABELS[suggestion.priority] ?? PRIORITY_LABELS.medium;
                    return (
                      <div key={index} className="rounded-2xl bg-[#fdf2f6] p-3 ring-1 ring-[#FCE4EC]">
                        <div className="mb-1.5 flex items-center gap-2">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${priority.className}`}>
                            {priority.label}
                          </span>
                          <p className="text-sm font-semibold text-[#605D62]">{suggestion.item}</p>
                        </div>
                        <p className="text-xs leading-relaxed text-[#605D62]/60">{suggestion.reason}</p>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* なりたい系統未設定 */}
            {!result.gapAnalysis && (
              <section className="rounded-3xl bg-white p-5 text-center ring-1 ring-[#FCE4EC]">
                <p className="mb-3 text-sm text-[#605D62]/60">
                  なりたい系統を設定すると、より精度の高い分析ができます
                </p>
                <Link href="/profile"
                  className="inline-flex rounded-2xl bg-[#605D62] px-5 py-2.5 text-sm font-semibold text-white">
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