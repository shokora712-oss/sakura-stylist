import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import BottomNav from "../components/BottomNav";
import DeleteOutfitButton from "./DeleteOutfitButton";
import AppHeader from "../components/AppHeader";
import DailyLogSection from "./DailyLogSection";
import { ChartBar, Heart } from "@phosphor-icons/react/dist/ssr";

const CATEGORY_LABELS: Record<string, string> = {
  tops: "トップス", bottoms: "ボトムス", onepiece: "ワンピース",
  outer: "アウター", shoes: "シューズ", bag: "バッグ",
};

const STYLE_LABELS: Record<string, string> = {
  casual: "カジュアル", clean: "きれいめ", feminine: "フェミニン",
  girly: "ガーリー", simple: "シンプル", natural: "ナチュラル",
  elegant: "エレガント", mode: "モード", street: "ストリート", sporty: "スポーティ",
};

type ItemLike = {
  id: string;
  name: string | null;
  category: string;
  imageUrl: string | null;
};

export default async function LogsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const allOutfits = await prisma.outfit.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    include: {
      outfitItems: {
        include: { item: true },
      },
    },
  });

  const favorites = allOutfits.filter((o) => o.isFavorite);
  const dailyLogs = allOutfits.filter((o) => !o.isFavorite && o.imageUrl);

  const itemNameCounts: Record<string, number> = {};
  const styleTagCounts: Record<string, number> = {};
  const monthCounts: Record<string, number> = {};

  for (const o of allOutfits) {
    for (const oi of o.outfitItems) {
      const name = oi.item.name ?? CATEGORY_LABELS[oi.item.category] ?? oi.item.category;
      itemNameCounts[name] = (itemNameCounts[name] ?? 0) + 1;
    }
    for (const tag of o.detectedStyleTags) {
      styleTagCounts[tag] = (styleTagCounts[tag] ?? 0) + 1;
    }
    const month = o.createdAt.toISOString().slice(0, 7);
    monthCounts[month] = (monthCounts[month] ?? 0) + 1;
  }

  const topItems = Object.entries(itemNameCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const topStyles = Object.entries(styleTagCounts).sort((a, b) => b[1] - a[1]);
  const maxStyleCount = topStyles[0]?.[1] ?? 1;
  const months = Object.entries(monthCounts).sort((a, b) => a[0].localeCompare(b[0])).slice(-6);

  const itemIds = Array.from(new Set(
    favorites.flatMap((o) => [
      o.topItemId, o.bottomItemId, o.onepieceItemId,
      o.outerItemId, o.shoesItemId, o.bagItemId,
    ]).filter((id): id is string => typeof id === "string" && id.length > 0)
  ));

  const itemsRaw = itemIds.length
    ? await prisma.item.findMany({ where: { id: { in: itemIds }, userId: session.user.id } })
    : [];

  const itemMap = new Map<string, ItemLike>(
    itemsRaw.map((item) => [item.id, { id: item.id, name: item.name, category: item.category, imageUrl: item.imageUrl }])
  );

  return (
    <main className="min-h-screen bg-[#fdf2f6] pb-32 text-[#605D62]">
      <div className="mx-auto max-w-md px-4 py-6">
        <AppHeader title="コーデログ" description="お気に入りと日々の記録を確認" />

        {allOutfits.length > 0 && (
          <section className="mb-8 rounded-3xl bg-white p-5 ring-1 ring-[#FCE4EC]">
            <h2 className="mb-4 flex items-center gap-2 font-semibold"><ChartBar size={20} color="#605D62" />コーデ分析</h2>

            {topItems.length > 0 && (
              <div className="mb-5">
                <p className="mb-2 text-xs font-semibold text-[#605D62]/60">よく着てるアイテム TOP5</p>
                <div className="space-y-1.5">
                  {topItems.map(([tag, count], i) => (
                    <div key={tag} className="flex items-center gap-2 text-sm">
                      <span className="w-4 text-xs text-[#605D62]/40">{i + 1}</span>
                      <span className="flex-1">{CATEGORY_LABELS[tag] ?? tag}</span>
                      <span className="text-xs text-[#605D62]/50">{count}回</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {topStyles.length > 0 && (
              <div className="mb-5">
                <p className="mb-2 text-xs font-semibold text-[#605D62]/60">よく着てるスタイル傾向</p>
                <div className="space-y-2">
                  {topStyles.map(([tag, count]) => (
                    <div key={tag}>
                      <div className="mb-0.5 flex justify-between text-xs">
                        <span>{STYLE_LABELS[tag] ?? tag}</span>
                        <span className="text-[#605D62]/50">{count}回</span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-[#fdf2f6]">
                        <div
                          className="h-2 rounded-full bg-[#605D62]"
                          style={{ width: `${Math.round((count / maxStyleCount) * 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {months.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-semibold text-[#605D62]/60">月別着用回数（直近6ヶ月）</p>
                <div className="flex items-end gap-2">
                  {months.map(([month, count]) => {
                    const maxCount = Math.max(...months.map(([, c]) => c));
                    return (
                      <div key={month} className="flex flex-1 flex-col items-center gap-1">
                        <span className="text-xs font-medium text-[#605D62]">{count}</span>
                        <div className="w-full rounded-t-lg bg-[#FCE4EC]" style={{ height: `${Math.round((count / maxCount) * 60) + 8}px` }} />
                        <span className="text-[10px] text-[#605D62]/50">{month.slice(5)}月</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </section>
        )}

        <section className="mb-8">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-semibold"><Heart size={20} color="#605D62" />お気に入りコーデ</h2>
            <span className="text-xs text-[#605D62]/50">{favorites.length}件</span>
          </div>

          {favorites.length === 0 ? (
            <div className="rounded-3xl bg-white p-6 text-center ring-1 ring-[#FCE4EC]">
              <p className="text-sm text-[#605D62]/60">まだ保存したコーデはありません</p>
              <Link href="/outfit"
                className="mt-3 inline-block rounded-2xl bg-[#605D62] px-4 py-2 text-sm font-semibold text-white">
                コーデ提案を見る
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {favorites.map((outfit) => {
                const topItem = outfit.topItemId ? itemMap.get(outfit.topItemId) ?? null : null;
                const bottomItem = outfit.bottomItemId ? itemMap.get(outfit.bottomItemId) ?? null : null;
                const onepieceItem = outfit.onepieceItemId ? itemMap.get(outfit.onepieceItemId) ?? null : null;
                const outerItem = outfit.outerItemId ? itemMap.get(outfit.outerItemId) ?? null : null;
                const shoesItem = outfit.shoesItemId ? itemMap.get(outfit.shoesItemId) ?? null : null;
                const bagItem = outfit.bagItemId ? itemMap.get(outfit.bagItemId) ?? null : null;

                const usedItems = [
                  { label: "トップス", item: topItem },
                  { label: "ボトムス", item: bottomItem },
                  { label: "ワンピース", item: onepieceItem },
                  { label: "アウター", item: outerItem },
                  { label: "シューズ", item: shoesItem },
                  { label: "バッグ", item: bagItem },
                ].filter((slot) => slot.item !== null);

                return (
                  <div key={outfit.id} className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-[#FCE4EC]">
                    <div className="mb-3 flex items-start justify-between">
                      <div>
                        <p className="text-xs text-[#605D62]/50">
                          {new Date(outfit.createdAt).toLocaleDateString("ja-JP")}
                        </p>
                        <div className="mt-1 flex items-center gap-2">
                          {outfit.score && (
                            <span className="rounded-full bg-[#FCE4EC] px-2 py-0.5 text-xs font-bold text-[#605D62]">
                              {outfit.score}点
                            </span>
                          )}
                          {outfit.occasion && (
                            <span className="rounded-full bg-[#E3F2FD] px-2 py-0.5 text-xs text-[#605D62]">
                              {getOccasionLabel(outfit.occasion)}
                            </span>
                          )}
                        </div>
                      </div>
                      <DeleteOutfitButton outfitId={outfit.id} />
                    </div>

                    {usedItems.length > 0 && (
                      <div className="grid grid-cols-3 gap-2">
                        {usedItems.map((slot) => (
                          <div key={slot.label} className="overflow-hidden rounded-2xl">
                            <div className="h-24 bg-[#fdf2f6]">
                              {slot.item?.imageUrl ? (
                                <img src={slot.item.imageUrl} alt={slot.item.name ?? ""} className="h-full w-full object-cover" />
                              ) : (
                                <div className="flex h-full items-center justify-center text-xs text-[#605D62]/30">画像なし</div>
                              )}
                            </div>
                            <p className="truncate px-1 py-1 text-xs text-[#605D62]/60">{slot.item?.name ?? slot.label}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {outfit.comment && (
                      <p className="mt-3 text-xs leading-relaxed text-[#605D62]/70">{outfit.comment}</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <DailyLogSection
          logs={dailyLogs.map((o) => ({
            id: o.id,
            imageUrl: o.imageUrl,
            occasion: o.occasion,
            createdAt: o.createdAt.toISOString(),
          }))}
        />
      </div>

      <BottomNav />
    </main>
  );
}

function getOccasionLabel(occasion: string | null) {
  const map: Record<string, string> = {
    casual: "カジュアル", date: "デート", office: "仕事",
    formal: "フォーマル", travel: "旅行", school: "学校",
  };
  return occasion ? (map[occasion] ?? "未設定") : "未設定";
}