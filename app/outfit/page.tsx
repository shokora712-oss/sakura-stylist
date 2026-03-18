"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import AppHeader from "../components/AppHeader";

type SaveOutfitPayload = {
  topItemId: string | null;
  bottomItemId: string | null;
  onepieceItemId: string | null;
  outerItemId: string | null;
  shoesItemId: string | null;
  bagItemId: string | null;
  score: number | null;
  comment: string | null;
  occasion: string | null;
  temperatureLabel: string | null;
  isFavorite: boolean;
};

type Item = {
  id: string;
  name: string | null;
  category: string;
  subCategory: string | null;
  color: string[];
  material: string[];
  season: string[];
  styleTags: string[];
  formality: number;
  brand: string | null;
  imageUrl: string | null;
};

type OutfitItem = {
  id: string;
  name: string | null;
  category: string;
  subcategory: string | null;
  colors: string[];
  styles: string[];
  seasons: string[];
  formality: number;
  imageUrl: string | null;
};

type OutfitSlotMap = {
  topPrimary: OutfitItem | null;
  topSecondary: OutfitItem | null;
  bottom: OutfitItem | null;
  onepiece: OutfitItem | null;
  outer: OutfitItem | null;
  shoes: OutfitItem | null;
  bag: OutfitItem | null;
};

type Outfit = {
  rank: number;
  score: number;
  reasons: string[];
  breakdown: {
    occasion: number;
    style: number;
    color: number;
    preference: number;
    rewear: number;
    setupBonus: number;
    suitBonus: number;
    moodCohesionBonus: number;
    versatilityBonus: number;
    harmonyPenalty: number;
    styleHarmonyPenalty: number;
  };
  items: OutfitItem[];
  slotMap: OutfitSlotMap;
};

type OutfitResponse = {
  success?: boolean;
  count?: number;
  outfits?: Outfit[];
  error?: string;
};

type StyleOption = {
  value: string;
  label: string;
};

type OccasionOption = {
  value: string;
  label: string;
  subLabel?: string;
};

type Screen =
  | "home"
  | "closet-categories"
  | "closet-items"
  | "occasion-select"
  | "style-select"
  | "results";

const styleOptions: StyleOption[] = [
  { value: "casual", label: "カジュアル" },
  { value: "girly", label: "ガーリー" },
  { value: "mode", label: "モード" },
  { value: "street", label: "ストリート" },
  { value: "minimal", label: "ミニマル" },
  { value: "feminine", label: "フェミニン" },
  { value: "office", label: "オフィス" },
];

const occasionOptions: OccasionOption[] = [
  { value: "casual", label: "カジュアル" },
  { value: "date", label: "デート" },
  { value: "office", label: "仕事" },
  { value: "formal", label: "フォーマル" },
  { value: "travel", label: "旅行", subLabel: "着回し力の高いコーデを提案" },
  { value: "school", label: "学校", subLabel: "大学生向け" },
];

const categoryTiles = [
  { value: "tops", label: "トップス" },
  { value: "bottoms", label: "ボトムス" },
  { value: "outer", label: "アウター" },
  { value: "shoes", label: "シューズ" },
  { value: "onepiece", label: "ワンピース" },
  { value: "bag", label: "バッグ" },
  { value: "accessory", label: "アクセサリー" },
  { value: "other", label: "小物" },
];

const outingTimeOptions = ["今から", "朝", "昼", "夕方", "夜"];
const returnTimeOptions = ["昼", "夕方", "夜", "深夜"];

export default function OutfitPage() {
  const { data: session } = useSession();
  const userName = session?.user?.name ?? "ユーザー";

  const [screen, setScreen] = useState<Screen>("home");
  const [items, setItems] = useState<Item[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [loadingOutfit, setLoadingOutfit] = useState(false);

  const [selectedOutingTime, setSelectedOutingTime] = useState("今から");
  const [selectedReturnTime, setSelectedReturnTime] = useState("深夜");

  const [selectedStyle, setSelectedStyle] = useState<string | null>(null);
  const [selectedOccasion, setSelectedOccasion] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string>("");
  const [prioritizeVersatility, setPrioritizeVersatility] = useState(false);

  const [outfitResult, setOutfitResult] = useState<OutfitResponse | null>(null);
  const [message, setMessage] = useState("");
  const [currentResultIndex, setCurrentResultIndex] = useState(0);

  useEffect(() => {
    void fetchItems();
  }, []);

  useEffect(() => {
    setPrioritizeVersatility(selectedOccasion === "travel");
  }, [selectedOccasion]);

  const filteredItems = useMemo(() => {
    if (!selectedCategory) return [];
    return items.filter((item) => normalizeCategory(item.category) === selectedCategory);
  }, [items, selectedCategory]);

  const fetchItems = async () => {
    try {
      setLoadingItems(true);
      const res = await fetch("/api/items");
      if (!res.ok) throw new Error("アイテム一覧の取得に失敗しました");
      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error(error);
      setMessage("アイテム一覧の取得に失敗しました");
    } finally {
      setLoadingItems(false);
    }
  };

  const generateOutfits = async (params?: {
    style?: string | null;
    occasion?: string | null;
    fixedItemId?: string | null;
  }) => {
    try {
      setLoadingOutfit(true);
      setMessage("");
      setOutfitResult(null);

      const res = await fetch("/api/outfit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          style: params?.style ?? selectedStyle ?? null,
          occasion: params?.occasion ?? selectedOccasion ?? null,
          fixedItemId: params?.fixedItemId ?? (selectedItemId || null),
          minTemp: getTempRange(selectedOutingTime, selectedReturnTime).min,
          maxTemp: getTempRange(selectedOutingTime, selectedReturnTime).max,
          prioritizeVersatility:
            (params?.occasion ?? selectedOccasion) === "travel"
              ? true
              : prioritizeVersatility,
          limit: 3,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "コーデ提案に失敗しました");
      }

      setOutfitResult(data);
      setCurrentResultIndex(0);
      setScreen("results");
    } catch (error) {
      console.error(error);
      setOutfitResult({
        error: error instanceof Error ? error.message : "コーデ提案に失敗しました",
      });
      setScreen("results");
    } finally {
      setLoadingOutfit(false);
    }
  };

  const handleChooseRandom = async () => {
    setSelectedStyle(null);
    setSelectedOccasion(null);
    setSelectedItemId("");
    await generateOutfits({
      style: null,
      occasion: null,
      fixedItemId: null,
    });
  };

  const handleChooseStyle = async (style: string) => {
    setSelectedStyle(style);
    await generateOutfits({
      style,
      occasion: selectedOccasion,
      fixedItemId: selectedItemId || null,
    });
  };

  const handleChooseOccasion = async (occasion: string) => {
    setSelectedOccasion(occasion);
    await generateOutfits({
      style: selectedStyle,
      occasion,
      fixedItemId: selectedItemId || null,
    });
  };

  const handleChooseItem = async (itemId: string) => {
    setSelectedItemId(itemId);
    await generateOutfits({
      style: selectedStyle,
      occasion: selectedOccasion,
      fixedItemId: itemId,
    });
  };

  const handleSaveFavorite = async (outfit: Outfit) => {
    try {
      const payload: SaveOutfitPayload = {
        topItemId: outfit.slotMap.topPrimary?.id ?? null,
        bottomItemId: outfit.slotMap.bottom?.id ?? null,
        onepieceItemId: outfit.slotMap.onepiece?.id ?? null,
        outerItemId: outfit.slotMap.outer?.id ?? null,
        shoesItemId: outfit.slotMap.shoes?.id ?? null,
        bagItemId: outfit.slotMap.bag?.id ?? null,
        score: typeof outfit.score === "number" ? outfit.score : null,
        comment: buildStylistComment(outfit),
        occasion: selectedOccasion ?? null,
        temperatureLabel: `${selectedOutingTime}-${selectedReturnTime}`,
        isFavorite: true,
      };

      const res = await fetch("/api/outfits", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        throw new Error(errorData?.error || "お気に入り保存に失敗しました");
      }

      setMessage("お気に入りに保存しました");
    } catch (error) {
      console.error(error);
      setMessage(
        error instanceof Error ? error.message : "お気に入り保存に失敗しました"
      );
    }
  };


  
  const currentOutfit = outfitResult?.outfits?.[currentResultIndex] ?? null;
  const remainingCount = (outfitResult?.outfits?.length ?? 0) - currentResultIndex - 1;

  const totalResults = outfitResult?.outfits?.length ?? 0;

  const goNextCard = () => {
    const total = outfitResult?.outfits?.length ?? 0;
    if (currentResultIndex < total - 1) {
      setCurrentResultIndex((prev) => prev + 1);
    } else {
      setMessage("すべての提案を見終わったよ");
    }
  };

  const goPrevCard = () => {
    if (currentResultIndex > 0) {
      setCurrentResultIndex((prev) => prev - 1);
    }
  };

  const handleSaveCurrent = async () => {
    if (!currentOutfit) return;
    await handleSaveFavorite(currentOutfit);
    goNextCard();
  };

  const handleTodayCurrent = async () => {
    if (!currentOutfit) return;
    await handleSaveFavorite(currentOutfit);
    setMessage("今日のコーデ候補として保存したよ");
    goNextCard();
  };

  return (
    <main className="min-h-screen bg-[#fafafa] pb-24">
      <div className="mx-auto max-w-md px-4 py-6">
        {screen === "home" && (
          <>
              <AppHeader
                title="コーデ提案"
                description="今日のコーデをAIが提案します。"
              />
            <section className="space-y-4">
              <SectionCard>
                <h2 className="mb-4 text-center text-xl font-bold">今日の条件</h2>
                <div className="space-y-2 text-center text-sm text-gray-700">
                  <p>🌡️ 気温　12°C</p>
                  <p>☁️ 天気　くもり</p>
                </div>
              </SectionCard>

              <SectionCard>
                <h2 className="mb-4 text-center text-2xl font-bold">お出かけ時間</h2>

                <div className="mb-5">
                  <div className="flex flex-wrap justify-center gap-2">
                    {outingTimeOptions.map((time) => (
                      <SmallToggle
                        key={time}
                        active={selectedOutingTime === time}
                        onClick={() => setSelectedOutingTime(time)}
                        label={time}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <p className="mb-3 text-center text-lg font-bold">帰宅時間</p>
                  <div className="flex flex-wrap justify-center gap-2">
                    {returnTimeOptions.map((time) => (
                      <SmallToggle
                        key={time}
                        active={selectedReturnTime === time}
                        onClick={() => setSelectedReturnTime(time)}
                        label={time}
                      />
                    ))}
                  </div>
                </div>
              </SectionCard>

              <div>
                <h2 className="mb-4 text-2xl font-bold">今日は何からコーデを考えますか？</h2>

                <PrimaryCardButton
                  title="おまかせ"
                  description="AIが手持ち服から系統も自由に提案"
                  onClick={handleChooseRandom}
                  disabled={loadingOutfit || loadingItems || items.length === 0}
                  className="mb-4"
                />

                <div className="grid grid-cols-3 gap-3">
                  <SquareCardButton
                    title="使いたい服"
                    description={
                      <>
                        使いたいアイテムを
                        <br />
                        指定して提案
                      </>
                    }
                    onClick={() => setScreen("closet-categories")}
                  />

                  <SquareCardButton
                    title="シチュエーション"
                    description={
                      <>
                        TPOを
                        <br />
                        指定して提案
                      </>
                    }
                    onClick={() => setScreen("occasion-select")}
                  />

                  <SquareCardButton
                    title="系統"
                    description={
                      <>
                        なりたい系統を
                        <br />
                        指定して提案
                      </>
                    }
                    onClick={() => setScreen("style-select")}
                  />
                </div>
              </div>
            </section>
          </>
        )}

        {screen === "closet-categories" && (
          <>
            <SubHeader title="クローゼット" onBack={() => setScreen("home")} />

            <div className="grid grid-cols-2 gap-4">
              {categoryTiles.map((category) => (
                <LargeTileButton
                  key={category.value}
                  label={category.label}
                  onClick={() => {
                    setSelectedCategory(category.value);
                    setScreen("closet-items");
                  }}
                />
              ))}
            </div>

            <Link
              href="/closet/new"
              className="mt-4 flex h-24 items-center justify-center rounded-3xl border border-gray-200 bg-white text-xl font-bold shadow-sm"
            >
              アイテムを登録
            </Link>
          </>
        )}

        {screen === "closet-items" && (
          <>
            <SubHeader
              title={getCategoryLabel(selectedCategory ?? "") || "アイテム選択"}
              onBack={() => setScreen("closet-categories")}
            />

            <p className="mb-4 text-sm text-gray-500">使いたい服を1つ選んでコーデ提案へ</p>

            {loadingItems ? (
              <SectionCard>読み込み中...</SectionCard>
            ) : filteredItems.length === 0 ? (
              <div className="space-y-4">
                <SectionCard>
                  <p className="text-center text-gray-600">
                    このカテゴリのアイテムはまだありません
                  </p>
                </SectionCard>
                <Link
                  href="/closet/new"
                  className="flex h-24 items-center justify-center rounded-3xl border border-gray-200 bg-white text-lg font-bold shadow-sm"
                >
                  アイテムを登録
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                {filteredItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleChooseItem(item.id)}
                    className="overflow-hidden rounded-3xl border border-gray-200 bg-white text-left shadow-sm"
                  >
                    <div className="flex h-40 items-center justify-center bg-gray-100">
                      {item.imageUrl ? (
                        <img
                          src={item.imageUrl}
                          alt={item.name ?? "item"}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="text-sm text-gray-500">画像なし</span>
                      )}
                    </div>
                    <div className="p-4">
                      <p className="font-bold">{item.name ?? "名称未設定"}</p>
                      <p className="mt-1 text-sm text-gray-500">
                        {getCategoryLabel(item.category)}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {screen === "style-select" && (
          <>
            <SubHeader title="系統選択" onBack={() => setScreen("home")} />

            <div className="grid grid-cols-2 gap-4">
              {styleOptions.map((option) => (
                <LargeTileButton
                  key={option.value}
                  label={option.label}
                  onClick={() => handleChooseStyle(option.value)}
                />
              ))}

              <LargeTileButton label="戻る" onClick={() => setScreen("home")} />
            </div>
          </>
        )}

        {screen === "occasion-select" && (
          <>
            <SubHeader title="シチュエーション選択" onBack={() => setScreen("home")} />

            <div className="grid grid-cols-2 gap-4">
              {occasionOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleChooseOccasion(option.value)}
                  className="flex h-40 flex-col items-center justify-center rounded-3xl border border-gray-200 bg-white px-3 text-center shadow-sm"
                >
                  <span className="mb-2 text-xl font-bold">{option.label}</span>
                  {option.subLabel && (
                    <span className="text-xs leading-5 text-gray-500">{option.subLabel}</span>
                  )}
                </button>
              ))}
            </div>
          </>
        )}

        {screen === "results" && (
          <>
            <SubHeader title="コーデ提案" onBack={() => setScreen("home")} />

            {loadingOutfit && <SectionCard>コーデ提案中...</SectionCard>}

            {outfitResult?.error && (
              <div className="mb-4 rounded-3xl bg-red-50 p-4 text-sm text-red-700">
                {outfitResult.error}
              </div>
            )}

            {!loadingOutfit &&
              (!outfitResult?.outfits || outfitResult.outfits.length === 0) && (
                <SectionCard>
                  <p className="text-center text-gray-600">
                    条件に合うコーデが見つかりませんでした
                  </p>
                </SectionCard>
              )}

            {!loadingOutfit && currentOutfit && (
              <>
                <p className="mb-4 text-xl font-bold text-[#6a2243]">
                  こちらのコーデはいかがでしょう？
                </p>

                <div className="mb-6 rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
                  <p className="mb-2 text-2xl font-bold">AIスコア：{currentOutfit.score}点</p>
                  <p className="text-sm leading-6 text-gray-700">
                    {buildStylistComment(currentOutfit)}
                  </p>
                </div>

                <div className="mb-6 grid gap-4 sm:grid-cols-2">
                  <ItemCard
                    label="トップス1"
                    item={currentOutfit.slotMap.topPrimary}
                  />
                  <ItemCard
                    label="トップス2"
                    item={currentOutfit.slotMap.topSecondary}
                  />
                  <ItemCard label="ボトムス" item={currentOutfit.slotMap.bottom} />
                  <ItemCard
                    label="ワンピース"
                    item={currentOutfit.slotMap.onepiece}
                  />
                  <ItemCard label="アウター" item={currentOutfit.slotMap.outer} />
                  <ItemCard label="シューズ" item={currentOutfit.slotMap.shoes} />
                  <ItemCard label="バッグ" item={currentOutfit.slotMap.bag} />
                </div>

                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={goPrevCard}
                      disabled={currentResultIndex === 0}
                      className={`rounded-2xl py-4 text-sm font-semibold shadow-sm ${
                        currentResultIndex === 0
                          ? "bg-gray-50 text-gray-300"
                          : "bg-gray-100 text-black"
                      }`}
                    >
                      戻る
                    </button>

                    <button
                      type="button"
                      onClick={goNextCard}
                      disabled={currentResultIndex >= totalResults - 1}
                      className={`rounded-2xl py-4 text-sm font-semibold shadow-sm ${
                        currentResultIndex >= totalResults - 1
                          ? "bg-gray-50 text-gray-300"
                          : "bg-gray-100 text-black"
                      }`}
                    >
                      次のコーデ
                    </button>

                    <button
                      type="button"
                      onClick={handleTodayCurrent}
                      className="rounded-2xl bg-gray-100 py-4 text-sm font-semibold shadow-sm"
                    >
                      今日のコーデ
                      <br />
                      にする
                    </button>

                    <button
                      type="button"
                      onClick={handleSaveCurrent}
                      className="rounded-2xl bg-gray-100 py-4 text-sm font-semibold shadow-sm"
                    >
                      保存する
                    </button>
                  </div>
                  
                <div className="mt-4 text-center text-xs text-gray-500">
                  {remainingCount > 0
                    ? `残り ${remainingCount} 件`
                    : "これが最後の提案です"}
                </div>
              </>
            )}
          </>
        )}

        {message && (
          <div className="mt-4 rounded-3xl bg-green-50 p-4 text-sm text-green-700">
            {message}
          </div>
        )}
      </div>

      <BottomNav />
    </main>
  );
}

function PageHeader({
  userName,
  title,
  description,
}: {
  userName: string;
  title: string;
  description: string;
}) {
  return (
    <div className="mb-6">
      <p className="mb-2 text-sm text-gray-500">こんにちは、{userName}</p>
      <h1 className="text-5xl font-bold tracking-tight text-[#0b2341]">{title}</h1>
      <p className="mt-2 text-sm text-gray-500">{description}</p>
    </div>
  );
}

function SubHeader({
  title,
  onBack,
}: {
  title: string;
  onBack: () => void;
}) {
  return (
    <div className="mb-6 flex items-center justify-between">
      <div>
        <h1 className="text-3xl font-bold text-[#0b2341]">{title}</h1>
      </div>
      <button type="button" onClick={onBack} className="text-sm text-gray-500">
        戻る
      </button>
    </div>
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

function PrimaryCardButton({
  title,
  description,
  onClick,
  disabled,
  className = "",
}: {
  title: string;
  description: string;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex h-28 w-full flex-col items-center justify-center rounded-3xl border border-gray-200 bg-white text-center shadow-sm disabled:opacity-50 ${className}`}
    >
      <span className="mb-2 text-2xl font-bold">{title}</span>
      <span className="text-sm text-gray-500">{description}</span>
    </button>
  );
}

function SquareCardButton({
  title,
  description,
  onClick,
}: {
  title: string;
  description: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-32 flex-col items-center justify-center rounded-3xl border border-gray-200 bg-white px-2 text-center shadow-sm"
    >
      <span className="mb-2 text-lg font-bold leading-tight">{title}</span>
      <span className="text-xs leading-5 text-gray-500">{description}</span>
    </button>
  );
}

function LargeTileButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-32 items-center justify-center rounded-3xl border border-gray-200 bg-white text-center text-xl font-bold shadow-sm"
    >
      {label}
    </button>
  );
}

function SmallToggle({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-w-[64px] rounded-xl px-4 py-2 text-sm font-semibold ${
        active ? "bg-[#0b2341] text-white" : "bg-gray-100 text-gray-700"
      }`}
    >
      {label}
    </button>
  );
}

function ItemCard({
  label,
  item,
}: {
  label: string;
  item: OutfitItem | null;
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
      <div className="flex h-40 items-center justify-center bg-gray-100">
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
        <p className="mt-1 font-bold">{item.name ?? "名称未設定"}</p>
        <p className="mt-1 text-sm text-gray-500">{getCategoryLabel(item.category)}</p>
      </div>
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
        <Link href="/profile" className="flex h-12 w-12 items-center justify-center text-2xl">
          👤
        </Link>
      </div>
    </nav>
  );
}

function normalizeCategory(category: string) {
  if (category === "bags") return "bag";
  return category;
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

function getTempRange(outing: string, returning: string) {
  const key = `${outing}-${returning}`;

  switch (key) {
    case "今から-深夜":
    case "夜-深夜":
      return { min: 8, max: 18 };
    case "朝-夜":
    case "朝-深夜":
      return { min: 10, max: 20 };
    case "昼-夕方":
    case "昼-夜":
      return { min: 18, max: 26 };
    case "夕方-夜":
      return { min: 14, max: 22 };
    default:
      return { min: 12, max: 24 };
  }
}

function buildStylistComment(outfit: Outfit) {
  const comments: string[] = [];
  const { breakdown } = outfit;

  if (breakdown.color >= 12) {
    comments.push(
      "色合わせはまとまりがあり、全体がちぐはぐに見えにくいです。"
    );
  } else if (breakdown.color >= 9) {
    comments.push(
      "色合わせは大きく外しておらず、取り入れやすいバランスです。"
    );
  } else {
    comments.push(
      "配色はやや不安定なので、どこか1色を軸にするとより整って見えそうです。"
    );
  }

  if (breakdown.style >= 14) {
    comments.push(
      "スタイルの方向性が比較的揃っていて、コーデの意図が伝わりやすいです。"
    );
  } else if (breakdown.style >= 8) {
    comments.push(
      "スタイルは部分的に一致していて、無難にまとまりやすいです。"
    );
  } else {
    comments.push(
      "スタイル感は少し弱めなので、バッグや羽織りで系統を補うとより完成度が上がりそうです。"
    );
  }

  if (breakdown.moodCohesionBonus >= 8) {
    comments.push(
      "全体の雰囲気がよく揃っていて、統一感のある見え方になっています。"
    );
  } else if (breakdown.moodCohesionBonus >= 4) {
    comments.push(
      "雰囲気にはある程度まとまりがあり、着やすい印象です。"
    );
  }

  if (breakdown.setupBonus >= 6) {
    comments.push(
      "セットアップ感が強く、上下のつながりがきれいに見えます。"
    );
  } else if (breakdown.suitBonus >= 3) {
    comments.push(
      "フォーマル寄りに整っていて、きちんと感を出しやすい組み合わせです。"
    );
  }

  if (breakdown.harmonyPenalty >= 8 || breakdown.styleHarmonyPenalty >= 8) {
    comments.push(
      "一部に少しちぐはぐさがあるので、靴や羽織りを変えるともっと自然にまとまりそうです。"
    );
  } else if (breakdown.harmonyPenalty >= 4 || breakdown.styleHarmonyPenalty >= 4) {
    comments.push(
      "大きくは崩れていませんが、細部を調整するとさらに洗練されそうです。"
    );
  } else {
    comments.push(
      "強い違和感が出にくく、全体として取り入れやすい候補です。"
    );
  }

  return comments.join(" ");
}