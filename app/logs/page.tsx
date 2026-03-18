import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import BottomNav from "../components/BottomNav";
import DeleteOutfitButton from "./DeleteOutfitButton";
import AppHeader from "../components/AppHeader";

type ItemLike = {
  id: string;
  name: string | null;
  category: string;
  imageUrl: string | null;
};

type SavedOutfit = {
  id: string;
  userId: string | null;
  topItemId: string | null;
  bottomItemId: string | null;
  onepieceItemId: string | null;
  outerItemId: string | null;
  shoesItemId: string | null;
  bagItemId: string | null;
  score: number | null;
  comment: string | null;
  isFavorite: boolean;
  temperatureLabel: string | null;
  occasion: string | null;
  createdAt: Date;
};

export default async function LogsPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/login");
  }

  const outfitsRaw = await prisma.outfit.findMany({
    where: {
      userId: session.user.id,
      isFavorite: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  const outfits: SavedOutfit[] = outfitsRaw;

  const itemIds = Array.from(
    new Set(
      outfits
        .flatMap((outfit: SavedOutfit): Array<string | null> => [
          outfit.topItemId,
          outfit.bottomItemId,
          outfit.onepieceItemId,
          outfit.outerItemId,
          outfit.shoesItemId,
          outfit.bagItemId,
        ])
        .filter(
          (id: string | null): id is string =>
            typeof id === "string" && id.length > 0
        )
    )
  );

  const itemsRaw = itemIds.length
    ? await prisma.item.findMany({
        where: {
          id: { in: itemIds },
          userId: session.user.id,
        },
      })
    : [];

  const items: ItemLike[] = itemsRaw.map((item) => ({
    id: item.id,
    name: item.name,
    category: item.category,
    imageUrl: item.imageUrl,
  }));

  const itemMap = new Map<string, ItemLike>(
    items.map((item: ItemLike): [string, ItemLike] => [item.id, item])
  );

  return (
    <main className="min-h-screen bg-[#fafafa] pb-32">
      <div className="mx-auto max-w-md px-4 py-6">
        <div className="mb-6">
          <AppHeader
            title="コーデログ"
            description="お気に入り保存したコーデを一覧で確認できます。"
          />
        </div>

        {outfits.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-gray-300 bg-white p-6 text-center shadow-sm">
            <p className="text-sm text-gray-500">
              まだ保存したコーデはありません。
            </p>

            <Link
              href="/outfit"
              className="mt-4 inline-flex rounded-2xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold hover:bg-gray-50"
            >
              コーデ提案を見にいく
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {outfits.map((outfit: SavedOutfit) => {
              const topItem = outfit.topItemId ? itemMap.get(outfit.topItemId) ?? null : null;
              const bottomItem = outfit.bottomItemId
                ? itemMap.get(outfit.bottomItemId) ?? null
                : null;
              const onepieceItem = outfit.onepieceItemId
                ? itemMap.get(outfit.onepieceItemId) ?? null
                : null;
              const outerItem = outfit.outerItemId
                ? itemMap.get(outfit.outerItemId) ?? null
                : null;
              const shoesItem = outfit.shoesItemId
                ? itemMap.get(outfit.shoesItemId) ?? null
                : null;
              const bagItem = outfit.bagItemId ? itemMap.get(outfit.bagItemId) ?? null : null;

              return (
                <section
                  key={outfit.id}
                  className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm"
                >
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-semibold text-[#0b2341]">
                        お気に入りコーデ
                      </h2>
                      <p className="mt-1 text-sm text-gray-500">
                        保存日：
                        {outfit.createdAt.toLocaleString("ja-JP")}
                      </p>
                    </div>

                    <div className="flex flex-col items-end gap-2">
                      <div className="rounded-full bg-pink-50 px-3 py-1 text-sm font-semibold text-pink-700">
                        {typeof outfit.score === "number" ? `${outfit.score}点` : "スコアなし"}
                      </div>
                      <DeleteOutfitButton outfitId={outfit.id} />
                    </div>
                  </div>

                  <div className="mb-4 space-y-1 text-sm text-gray-600">
                    <p>気温帯：{outfit.temperatureLabel ?? "未設定"}</p>
                    <p>TPO：{getOccasionLabel(outfit.occasion)}</p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <SavedItemCard label="トップス" item={topItem} />
                    <SavedItemCard label="ボトムス" item={bottomItem} />
                    <SavedItemCard label="ワンピース" item={onepieceItem} />
                    <SavedItemCard label="アウター" item={outerItem} />
                    <SavedItemCard label="シューズ" item={shoesItem} />
                    <SavedItemCard label="バッグ" item={bagItem} />
                  </div>

                  {outfit.comment && (
                    <div className="mt-4 rounded-2xl bg-gray-50 p-4">
                      <p className="text-sm leading-7 text-gray-700">{outfit.comment}</p>
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </div>

      <BottomNav />
    </main>
  );
}

function SavedItemCard({
  label,
  item,
}: {
  label: string;
  item: ItemLike | null;
}) {
  if (!item) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-4">
        <p className="text-sm font-semibold text-gray-500">{label}</p>
        <p className="mt-2 text-sm text-gray-400">未使用</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="flex h-36 items-center justify-center bg-gray-100">
        {item.imageUrl ? (
          <img
            src={item.imageUrl}
            alt={item.name ?? label}
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="text-sm text-gray-500">画像なし</span>
        )}
      </div>

      <div className="p-4">
        <p className="text-sm font-semibold text-gray-500">{label}</p>
        <p className="mt-1 font-bold text-gray-900">{item.name ?? "名称未設定"}</p>
        <p className="mt-1 text-sm text-gray-500">{getCategoryLabel(item.category)}</p>
      </div>
    </div>
  );
}

function getCategoryLabel(category: string) {
  switch (category) {
    case "tops":
      return "トップス";
    case "bottoms":
      return "ボトムス";
    case "onepiece":
      return "ワンピース";
    case "outer":
      return "アウター";
    case "shoes":
      return "シューズ";
    case "bag":
    case "bags":
      return "バッグ";
    case "accessory":
      return "アクセサリー";
    case "other":
      return "小物";
    default:
      return category;
  }
}

function getOccasionLabel(occasion: string | null) {
  switch (occasion) {
    case "casual":
      return "カジュアル";
    case "date":
      return "デート";
    case "office":
      return "仕事";
    case "formal":
      return "フォーマル";
    case "travel":
      return "旅行";
    case "school":
      return "学校";
    default:
      return "未設定";
  }
}