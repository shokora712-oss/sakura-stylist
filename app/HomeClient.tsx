"use client";

import Link from "next/link";
import BottomNav from "./components/BottomNav";

type HomeClientProps = {
  userName: string;
};

type HomeCardProps = {
  title: string;
  description?: string;
  href: string;
  wide?: boolean;
};

function HomeCard({ title, description, href, wide = false }: HomeCardProps) {
  return (
    <Link
      href={href}
      className={`rounded-3xl border border-gray-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
        wide ? "col-span-2" : ""
      }`}
    >
      <div className="min-h-[120px]">
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        {description && (
          <p className="mt-2 text-sm leading-6 text-gray-500">{description}</p>
        )}
      </div>
    </Link>
  );
}

export default function HomeClient({ userName }: HomeClientProps) {
  return (
    <main className="min-h-screen bg-[#fafafa] pb-32">
      <div className="mx-auto flex max-w-md flex-col px-5 pt-8">
        <div className="mb-8">
          <p className="text-sm text-gray-500">こんにちは、{userName}</p>
          <h1 className="mt-2 text-3xl font-bold text-gray-900">Sakura Stylist</h1>
          <p className="mt-2 text-sm leading-6 text-gray-500">
            今日のコーデ提案から、クローゼット管理までこれ一つで。
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <HomeCard
            title="コーデ提案"
            description="AIが手持ち服から提案"
            href="/outfit"
          />

          <HomeCard
            title="コーデ評価"
            description="AIがコーデを評価"
            href="/evaluate"
          />

          <HomeCard
            title="クローゼット"
            description="登録済みアイテムを見る"
            href="/closet"
            wide
          />

          <HomeCard
            title="コーデログ"
            description="お気に入りや履歴を確認"
            href="/logs"
            wide
          />

          <HomeCard
            title="なりたい系統を登録"
            description="画像・URLで登録"
            href="/style-goals"
          />

          <HomeCard
            title="足りない服分析"
            description="不足カテゴリを分析"
            href="/analysis"
          />

          <HomeCard
            title="開発中の画面"
            description="今までの全部入り画面"
            href="/workbench"
            wide
          />
        </div>
      </div>

      <BottomNav />
    </main>
  );
}