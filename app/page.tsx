import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import HomeClient from "./HomeClient";

export default async function Page() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/guest");
  }

  const userId = session.user.id;
  const userName = session.user.name ?? "ユーザー";

  const [recentLogs, itemCount, weeklyLogs] = await Promise.all([
    prisma.outfit.findMany({
      where: { userId, isFavorite: false, imageUrl: { not: null } },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, imageUrl: true, createdAt: true, detectedStyleTags: true },
    }),
    prisma.item.count({ where: { userId } }),
    prisma.outfit.findMany({
      where: {
        userId,
        isFavorite: false,
        createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
      select: { detectedStyleTags: true },
    }),
  ]);

  // AIの一言：直近ログのスタイルタグ集計
  const styleCount: Record<string, number> = {};
  for (const log of recentLogs) {
    for (const tag of log.detectedStyleTags) {
      styleCount[tag] = (styleCount[tag] ?? 0) + 1;
    }
  }
  const topStyle = Object.entries(styleCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  const STYLE_LABELS: Record<string, string> = {
    casual: "カジュアル", clean: "きれいめ", feminine: "フェミニン",
    girly: "ガーリー", simple: "シンプル", natural: "ナチュラル",
    elegant: "エレガント", mode: "モード", street: "ストリート", sporty: "スポーティ",
  };

  const aiComment = topStyle
    ? `最近は${STYLE_LABELS[topStyle] ?? topStyle}系のコーデが多めです`
    : null;

  const weeklyCount = weeklyLogs.length;
  const usageRate = itemCount > 0 ? Math.round((weeklyCount / itemCount) * 100) : 0;

  return (
    <HomeClient
      userName={userName}
      recentLogs={recentLogs.map((log) => ({
        id: log.id,
        imageUrl: log.imageUrl!,
        createdAt: log.createdAt.toISOString(),
      }))}
      itemCount={itemCount}
      weeklyCount={weeklyCount}
      usageRate={usageRate}
      aiComment={aiComment}
    />
  );
}