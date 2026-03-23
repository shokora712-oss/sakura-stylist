"use client";

import Link from "next/link";
import BottomNav from "./components/BottomNav";
import { Plus, TShirt, CoatHanger, ShoppingCart, CheckSquare, CalendarDots, Sparkle } from "@phosphor-icons/react";
import { Noto_Serif_JP } from "next/font/google";

const notoSerifJP = Noto_Serif_JP({
  subsets: ["latin"],
  weight: ["400", "700"],
});

type RecentLog = {
  id: string;
  imageUrl: string;
  createdAt: string;
};

type HomeClientProps = {
  userName: string;
  recentLogs: RecentLog[];
  itemCount: number;
  weeklyCount: number;
  usageRate: number;
  aiComment: string | null;
};

export default function HomeClient({
  userName,
  recentLogs = [],
  itemCount = 0,
  weeklyCount = 0,
  usageRate = 0,
  aiComment = null,
}: HomeClientProps) {
  return (
    <main className="min-h-screen bg-[#fdf2f6] pb-32 text-[#605D62]">
      <div className="mx-auto max-w-md px-4 pt-10">

        {/* ヘッダー */}
        <div className="mb-6">
          <p className="text-xs font-medium tracking-widest text-[#605D62]/40 uppercase">Sakura Stylist</p>
          <h1 className={`mt-1 text-3xl font-bold text-[#605D62] ${notoSerifJP.className}`}>{userName}さんの<br />クローゼット</h1>
        </div>

        {/* AIの一言 */}
        {aiComment && (
          <div className="mb-6 flex items-start gap-3 rounded-2xl bg-white px-4 py-3 ring-1 ring-[#FCE4EC]">
            <span className="mt-0.5 text-lg">✦</span>
            <div>
              <p className="text-xs font-semibold text-[#605D62]">{aiComment}</p>
              <p className="mt-0.5 text-xs text-[#605D62]/50">他のスタイルもためしてみませんか？</p>
            </div>
          </div>
        )}

        {/* メインCTA */}
        <Link href="/outfit"
          className="mb-6 block overflow-hidden rounded-3xl bg-white shadow-md ring-1 ring-[#FCE4EC] transition hover:shadow-lg">
          <div className="bg-gradient-to-br from-[#FCE4EC] via-[#fdf2f6] to-[#E3F2FD] px-5 py-5">
            <p className="text-xs font-medium tracking-wide text-[#605D62]/50">TODAY'S PICK</p>
            <h2 className="mt-1 text-xl font-bold leading-snug text-[#605D62]">今日のコーデを<br />提案してもらう</h2>
            <p className="mt-2 text-xs text-[#605D62]/60">手持ち服からAIが最適なコーデを提案</p>
          </div>
          <div className="flex items-center justify-between bg-[#605D62] px-5 py-3">
            <span className="text-xs font-bold text-white">今日のコーデを見る</span>
            <span className="text-white">→</span>
          </div>
        </Link>

        {/* クイックアクション */}
        <div className="mb-6 grid grid-cols-3 gap-3">
          <Link href="/closet/new"
            className="flex flex-col items-center gap-2 rounded-2xl bg-white py-4 shadow-sm ring-1 ring-[#FCE4EC] transition hover:shadow-md">
            <Plus size={24} color="#605D62" />
            <span className="text-xs font-medium text-[#605D62]">登録</span>
          </Link>
          <Link href="/outfit"
            className="flex flex-col items-center gap-2 rounded-2xl bg-white py-4 shadow-sm ring-1 ring-[#FCE4EC] transition hover:shadow-md">
            <TShirt size={24} color="#605D62" />
            <span className="text-xs font-medium text-[#605D62]">提案</span>
          </Link>
          <Link href="/closet"
            className="flex flex-col items-center gap-2 rounded-2xl bg-white py-4 shadow-sm ring-1 ring-[#FCE4EC] transition hover:shadow-md">
            <CoatHanger size={24} color="#605D62" />
            <span className="text-xs font-medium text-[#605D62]">クローゼット</span>
          </Link>
        </div>

        {/* 今週の使用率 */}
        <div className="mb-6 rounded-2xl bg-white px-5 py-4 ring-1 ring-[#FCE4EC]">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold text-[#605D62]">今週の着用回数</p>
            <p className="text-xs text-[#605D62]/50">{itemCount}着中</p>
          </div>
          <div className="mb-1 flex items-end gap-2">
            <p className="text-2xl font-bold text-[#605D62]">{weeklyCount}<span className="ml-1 text-sm font-normal text-[#605D62]/60">回</span></p>
            <p className="mb-0.5 text-xs text-[#605D62]/50">使用率 {usageRate}%</p>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#fdf2f6]">
            <div className="h-full rounded-full bg-[#605D62] transition-all" style={{ width: `${Math.min(usageRate, 100)}%` }} />
          </div>
        </div>

        {/* 最近のコーデ */}
        {recentLogs.length > 0 && (
          <div className="mb-6">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-semibold tracking-wide text-[#605D62]/40 uppercase">Recent Logs</p>
              <Link href="/logs" className="text-xs text-[#605D62]/60">すべて見る →</Link>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {recentLogs.map((log) => {
                const date = new Date(log.createdAt);
                return (
                  <Link key={log.id} href="/logs" className="shrink-0">
                    <div className="relative h-24 w-24 overflow-hidden rounded-2xl ring-1 ring-[#FCE4EC]">
                      <img src={log.imageUrl} alt="" className="h-full w-full object-cover" />
                      <div className="absolute bottom-1 left-1 rounded-lg bg-white/80 px-1.5 py-0.5">
                        <p className="text-[10px] font-bold leading-none text-[#605D62]">{date.getDate()}</p>
                        <p className="text-[10px] leading-none text-[#605D62]/60">{date.getMonth() + 1}月</p>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* 機能一覧 */}
        <p className="mb-3 text-xs font-semibold tracking-wide text-[#605D62]/40 uppercase">Features</p>
        <div className="grid grid-cols-2 gap-3">

          <Link href="/analysis"
            className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-[#FCE4EC] transition hover:shadow-md">
            <div className="mb-2 flex items-center gap-2">
              <ShoppingCart size={20} color="#605D62" />
              <p className={`text-sm font-bold text-[#605D62] ${notoSerifJP.className}`}>クローゼット分析</p>
            </div>
            <p className="text-xs leading-relaxed text-[#605D62]/50">足りないアイテムをAIが分析・提案</p>
          </Link>

          <Link href="/style-goals"
            className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-[#FCE4EC] transition hover:shadow-md">
            <div className="mb-2 flex items-center gap-2">
              <Sparkle size={20} color="#605D62" />
              <p className={`text-sm font-bold text-[#605D62] ${notoSerifJP.className}`}>理想のスタイル</p>
            </div>
            <p className="text-xs leading-relaxed text-[#605D62]/50">画像から理想の系統を登録</p>
          </Link>

          <Link href="/evaluate"
            className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-[#FCE4EC] transition hover:shadow-md">
            <div className="mb-2 flex items-center gap-2">
              <CheckSquare size={20} color="#605D62" />
              <p className={`text-sm font-bold text-[#605D62] ${notoSerifJP.className}`}>コーデ評価</p>
            </div>
            <p className="text-xs leading-relaxed text-[#605D62]/50">AIがコーデを客観的に評価</p>
          </Link>

          <Link href="/logs"
            className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-[#FCE4EC] transition hover:shadow-md">
            <div className="mb-2 flex items-center gap-2">
              <CalendarDots size={20} color="#605D62" />
              <p className={`text-sm font-bold text-[#605D62] ${notoSerifJP.className}`}>コーデログ</p>
            </div>
            <p className="text-xs leading-relaxed text-[#605D62]/50">コーデの履歴を自動で記録・管理</p>
          </Link>

        </div>
      </div>

      <BottomNav />
    </main>
  );
}