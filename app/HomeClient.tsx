"use client";

import Link from "next/link";
import BottomNav from "./components/BottomNav";

type HomeClientProps = {
  userName: string;
};

export default function HomeClient({ userName }: HomeClientProps) {
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "おはようございます" : hour < 18 ? "こんにちは" : "こんばんは";

  return (
    <main className="min-h-screen bg-[#fdf2f6] pb-32 text-[#605D62]">
      <div className="mx-auto max-w-md px-4 pt-8">

        {/* グリーティング */}
        <div className="mb-6">
          <p className="text-sm text-[#605D62]/60">{greeting}、{userName}さん</p>
          <h1 className="mt-1 text-2xl font-bold text-[#605D62]">Sakura Stylist</h1>
        </div>

        {/* 今日のコーデピック */}
        <Link href="/outfit"
          className="mb-5 block overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-[#FCE4EC] transition hover:shadow-md">
          <div className="bg-gradient-to-r from-[#FCE4EC] to-[#E3F2FD] px-5 py-4">
            <p className="text-xs font-medium text-[#605D62]/60">今日のおすすめ</p>
            <h2 className="mt-0.5 text-lg font-bold text-[#605D62]">今日のコーデを提案してもらう</h2>
            <p className="mt-1 text-xs text-[#605D62]/70">AIが手持ち服から最適なコーデを提案します</p>
          </div>
          <div className="flex items-center justify-between px-5 py-3">
            <span className="text-xs text-[#605D62]/50">タップして提案を見る</span>
            <span className="text-[#605D62]/40">→</span>
          </div>
        </Link>

        {/* クイックアクション */}
        <div className="mb-5 grid grid-cols-3 gap-3">
          <Link href="/closet/new"
            className="flex flex-col items-center gap-2 rounded-2xl bg-white py-4 shadow-sm ring-1 ring-[#FCE4EC] transition hover:shadow-md">
            <span className="text-2xl">＋</span>
            <span className="text-xs font-medium text-[#605D62]">登録</span>
          </Link>
          <Link href="/outfit"
            className="flex flex-col items-center gap-2 rounded-2xl bg-white py-4 shadow-sm ring-1 ring-[#FCE4EC] transition hover:shadow-md">
            <span className="text-2xl">👗</span>
            <span className="text-xs font-medium text-[#605D62]">提案</span>
          </Link>
          <Link href="/closet"
            className="flex flex-col items-center gap-2 rounded-2xl bg-white py-4 shadow-sm ring-1 ring-[#FCE4EC] transition hover:shadow-md">
            <span className="text-2xl">👚</span>
            <span className="text-xs font-medium text-[#605D62]">クローゼット</span>
          </Link>
        </div>

        {/* 機能カード */}
        <h2 className="mb-3 text-sm font-semibold text-[#605D62]/60">機能一覧</h2>
        <div className="grid grid-cols-2 gap-3">

          <Link href="/analysis"
            className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-[#FCE4EC] transition hover:shadow-md">
            <div className="mb-2 text-2xl">🔍</div>
            <p className="font-semibold text-[#605D62]">買い足すべきアイテム</p>
            <p className="mt-1 text-xs text-[#605D62]/60">不足カテゴリを分析</p>
          </Link>

          <Link href="/style-goals"
            className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-[#FCE4EC] transition hover:shadow-md">
            <div className="mb-2 text-2xl">✨</div>
            <p className="font-semibold text-[#605D62]">理想のスタイル</p>
            <p className="mt-1 text-xs text-[#605D62]/60">画像から判定・登録</p>
          </Link>

          <Link href="/evaluate"
            className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-[#FCE4EC] transition hover:shadow-md">
            <div className="mb-2 text-2xl">⭐</div>
            <p className="font-semibold text-[#605D62]">コーデ評価</p>
            <p className="mt-1 text-xs text-[#605D62]/60">AIがコーデを評価</p>
          </Link>

          <Link href="/logs"
            className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-[#FCE4EC] transition hover:shadow-md">
            <div className="mb-2 text-2xl">📋</div>
            <p className="font-semibold text-[#605D62]">コーデログ</p>
            <p className="mt-1 text-xs text-[#605D62]/60">お気に入りや履歴</p>
          </Link>

        </div>
      </div>

      <BottomNav />
    </main>
  );
}