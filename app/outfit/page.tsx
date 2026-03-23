"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import BottomNav from "../components/BottomNav";
import {
  Shuffle, Dress, MapPin, Palette,
  Sneaker, Sparkle, Flower, Butterfly, TShirt, Leaf, Diamond, Moon, Lightning, HighHeel, BaseballCap,
  ShoppingBag, Heart, Briefcase, Crown, Airplane, GraduationCap, ShirtFolded,
} from "@phosphor-icons/react";

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

type Screen =
  | "home"
  | "closet-categories"
  | "closet-items"
  | "occasion-select"
  | "style-select"
  | "results";

const STYLE_OPTIONS = [
  { value: "casual", label: "カジュアル", icon: Sneaker },
  { value: "clean", label: "きれいめ", icon: HighHeel },
  { value: "feminine", label: "フェミニン", icon: Flower },
  { value: "girly", label: "ガーリー", icon: Butterfly },
  { value: "simple", label: "シンプル", icon: TShirt },
  { value: "natural", label: "ナチュラル", icon: Leaf },
  { value: "elegant", label: "エレガント", icon: Diamond },
  { value: "mode", label: "モード", icon: Moon },
  { value: "street", label: "ストリート", icon: Lightning },
  { value: "sporty", label: "スポーティ", icon: BaseballCap },
];

const OCCASION_OPTIONS = [
  { value: "casual", label: "お出かけ", icon: ShoppingBag },
  { value: "date", label: "デート", icon: Heart },
  { value: "office", label: "仕事", icon: Briefcase },
  { value: "formal", label: "フォーマル", icon: ShirtFolded },
  { value: "travel", label: "旅行", icon: Airplane, subLabel: "着回し重視" },
  { value: "school", label: "学校", icon: GraduationCap },
];

const CATEGORY_TILES = [
  { value: "all", label: "すべて" },
  { value: "tops", label: "トップス" },
  { value: "bottoms", label: "ボトムス" },
  { value: "outer", label: "アウター" },
  { value: "shoes", label: "シューズ" },
  { value: "onepiece", label: "ワンピース" },
  { value: "bag", label: "バッグ" },
];

const OUTING_TIMES = ["今から", "朝", "昼", "夕方", "夜"];
const RETURN_TIMES = ["昼", "夕方", "夜", "深夜"];

export default function OutfitPage() {
  const { data: session } = useSession();

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

  useEffect(() => { void fetchItems(); }, []);
  useEffect(() => {
    setPrioritizeVersatility(selectedOccasion === "travel");
  }, [selectedOccasion]);

  const filteredItems = useMemo(() => {
    if (!selectedCategory || selectedCategory === "all") return items;
    return items.filter((item) => normalizeCategory(item.category) === selectedCategory);
  }, [items, selectedCategory]);

  const currentOutfit = outfitResult?.outfits?.[currentResultIndex] ?? null;
  const totalResults = outfitResult?.outfits?.length ?? 0;

  async function fetchItems() {
    try {
      setLoadingItems(true);
      const res = await fetch("/api/items");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
    } catch {
      setMessage("アイテム一覧の取得に失敗しました");
    } finally {
      setLoadingItems(false);
    }
  }

  async function generateOutfits(params?: {
    style?: string | null;
    occasion?: string | null;
    fixedItemId?: string | null;
  }) {
    try {
      setLoadingOutfit(true);
      setMessage("");
      setOutfitResult(null);

      const res = await fetch("/api/outfit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          style: params?.style ?? selectedStyle ?? null,
          occasion: params?.occasion ?? selectedOccasion ?? null,
          fixedItemId: params?.fixedItemId ?? (selectedItemId || null),
          minTemp: getTempRange(selectedOutingTime, selectedReturnTime).min,
          maxTemp: getTempRange(selectedOutingTime, selectedReturnTime).max,
          prioritizeVersatility: (params?.occasion ?? selectedOccasion) === "travel",
          limit: 3,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "コーデ提案に失敗しました");

      setOutfitResult(data);
      setCurrentResultIndex(0);
      setScreen("results");
    } catch (error) {
      setOutfitResult({ error: error instanceof Error ? error.message : "コーデ提案に失敗しました" });
      setScreen("results");
    } finally {
      setLoadingOutfit(false);
    }
  }

  async function handleSaveFavorite(outfit: Outfit) {
    try {
      const payload: SaveOutfitPayload = {
        topItemId: outfit.slotMap.topPrimary?.id ?? null,
        bottomItemId: outfit.slotMap.bottom?.id ?? null,
        onepieceItemId: outfit.slotMap.onepiece?.id ?? null,
        outerItemId: outfit.slotMap.outer?.id ?? null,
        shoesItemId: outfit.slotMap.shoes?.id ?? null,
        bagItemId: outfit.slotMap.bag?.id ?? null,
        score: outfit.score,
        comment: outfit.reasons?.[0] ?? null,
        occasion: selectedOccasion ?? null,
        temperatureLabel: `${selectedOutingTime}-${selectedReturnTime}`,
        isFavorite: true,
      };
      const res = await fetch("/api/outfits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error();
      setMessage("お気に入りに保存しました");
    } catch {
      setMessage("保存に失敗しました");
    }
  }

  function goNext() {
    if (currentResultIndex < totalResults - 1) {
      setCurrentResultIndex((prev) => prev + 1);
    }
  }

  function goPrev() {
    if (currentResultIndex > 0) {
      setCurrentResultIndex((prev) => prev - 1);
    }
  }

  return (
    <main className="min-h-screen bg-[#fdf2f6] pb-32 text-[#605D62]">
      <div className="mx-auto max-w-md px-4 py-6">

        {/* ホーム画面 */}
        {screen === "home" && (
          <div className="space-y-5">
            <div>
              <p className="text-xs text-[#605D62]/60">Sakura Stylist</p>
              <h1 className="text-2xl font-bold">コーデ提案</h1>
            </div>

            {/* 時間帯選択 */}
            <div className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-[#FCE4EC]">
              <p className="mb-3 text-sm font-semibold">お出かけ時間</p>
              <div className="flex flex-wrap gap-2">
                {OUTING_TIMES.map((time) => (
                  <button key={time} type="button"
                    onClick={() => setSelectedOutingTime(time)}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                      selectedOutingTime === time
                        ? "bg-[#605D62] text-white"
                        : "bg-[#fdf2f6] text-[#605D62]"
                    }`}>
                    {time}
                  </button>
                ))}
              </div>
              <p className="mb-2 mt-3 text-sm font-semibold">帰宅時間</p>
              <div className="flex flex-wrap gap-2">
                {RETURN_TIMES.map((time) => (
                  <button key={time} type="button"
                    onClick={() => setSelectedReturnTime(time)}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                      selectedReturnTime === time
                        ? "bg-[#605D62] text-white"
                        : "bg-[#fdf2f6] text-[#605D62]"
                    }`}>
                    {time}
                  </button>
                ))}
              </div>
            </div>

            {/* おまかせボタン */}
            <button type="button"
              onClick={() => generateOutfits({ style: null, occasion: null, fixedItemId: null })}
              disabled={loadingOutfit || loadingItems || items.length === 0}
              className="w-full rounded-3xl bg-gradient-to-r from-[#FCE4EC] to-[#E3F2FD] py-5 text-center font-bold text-[#605D62] shadow-sm transition hover:shadow-md disabled:opacity-50">
              <div className="flex items-center justify-center gap-2">
                <Shuffle size={22} color="#605D62" />
                <p className="text-lg">おまかせコーデ</p>
              </div>
              <p className="mt-1 text-xs text-[#605D62]/60">AIが手持ち服から自由に提案</p>
            </button>

            {/* 3つの選択肢 */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "使いたい服", icon: Dress, sub: "アイテム指定", screen: "closet-categories" as Screen },
                { label: "シチュエーション", icon: MapPin, sub: "TPO指定", screen: "occasion-select" as Screen },
                { label: "系統", icon: Palette, sub: "スタイル指定", screen: "style-select" as Screen },
              ].map((item) => (
                <button key={item.label} type="button"
                  onClick={() => setScreen(item.screen)}
                  className="rounded-2xl bg-white p-3 text-center shadow-sm ring-1 ring-[#FCE4EC] transition hover:shadow-md">
                  <div className="mb-1 flex justify-center"><item.icon size={28} color="#605D62" /></div>
                  <p className="text-xs font-semibold text-[#605D62]">{item.label}</p>
                  <p className="text-xs text-[#605D62]/50">{item.sub}</p>
                </button>
              ))}
            </div>
          </div>
        )}

{/* アイテム選択（タブ形式） */}
        {(screen === "closet-categories" || screen === "closet-items") && (
          <div>
            <SubHeader title="使いたい服を選ぶ" onBack={() => setScreen("home")} />

            {/* カテゴリタブ */}
            <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
              {CATEGORY_TILES.map((cat) => (
                <button key={cat.value} type="button"
                  onClick={() => { setSelectedCategory(cat.value); setScreen("closet-items"); }}
                  className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition ${
                    selectedCategory === cat.value
                      ? "bg-[#605D62] text-white"
                      : "bg-white text-[#605D62] ring-1 ring-[#FCE4EC] hover:bg-[#FCE4EC]/30"
                  }`}>
                  {cat.label}
                  <span className="ml-1 text-xs opacity-60">
                    {items.filter((i) => normalizeCategory(i.category) === cat.value).length}
                  </span>
                </button>
              ))}
            </div>

            {/* アイテムグリッド */}
            {!selectedCategory ? (
              <p className="py-10 text-center text-sm text-[#605D62]/50">
                カテゴリを選んでください
              </p>
            ) : loadingItems ? (
              <p className="py-10 text-center text-sm text-[#605D62]/50">読み込み中...</p>
            ) : filteredItems.length === 0 ? (
              <div className="rounded-2xl bg-white p-6 text-center text-sm text-[#605D62]/60 ring-1 ring-[#FCE4EC]">
                このカテゴリのアイテムはありません
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {filteredItems.map((item) => (
                  <button key={item.id} type="button"
                    onClick={() => generateOutfits({ style: selectedStyle, occasion: selectedOccasion, fixedItemId: item.id })}
                    className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-[#FCE4EC] transition hover:shadow-md text-left">
                    <div className="relative h-44 bg-[#fdf2f6]">
                      {item.imageUrl ? (
                        <img src={item.imageUrl} alt={item.name ?? ""} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full items-center justify-center text-xs text-[#605D62]/40">画像なし</div>
                      )}
                      {item.subCategory && (
                        <div className="absolute bottom-2 left-2 rounded-full bg-[#FCE4EC]/90 px-2 py-0.5 text-xs font-medium text-[#605D62]">
                          {item.subCategory}
                        </div>
                      )}
                    </div>
                    <div className="p-3">
                      <p className="truncate text-sm font-semibold">{item.name ?? "名称未設定"}</p>
                      {item.styleTags?.slice(0, 2).map((tag) => (
                        <span key={tag} className="mr-1 mt-1 inline-block rounded-full bg-[#E3F2FD] px-2 py-0.5 text-xs text-[#605D62]">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* スタイル選択 */}
        {screen === "style-select" && (
          <div>
            <SubHeader title="系統を選ぶ" onBack={() => setScreen("home")} />
            <div className="grid grid-cols-2 gap-3">
              {STYLE_OPTIONS.map((opt) => (
                <button key={opt.value} type="button"
                  onClick={() => { setSelectedStyle(opt.value); generateOutfits({ style: opt.value, occasion: selectedOccasion }); }}
                  className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-[#FCE4EC] transition hover:shadow-md">
                  <opt.icon size={24} color="#605D62" />
                  <span className="text-sm font-semibold">{opt.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* シチュエーション選択 */}
        {screen === "occasion-select" && (
          <div>
            <SubHeader title="シチュエーション" onBack={() => setScreen("home")} />
            <div className="grid grid-cols-2 gap-3">
              {OCCASION_OPTIONS.map((opt) => (
                <button key={opt.value} type="button"
                  onClick={() => { setSelectedOccasion(opt.value); generateOutfits({ style: selectedStyle, occasion: opt.value }); }}
                  className="flex h-28 flex-col items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-[#FCE4EC] transition hover:shadow-md">
                  <opt.icon size={28} color="#605D62" className="mb-1" />
                  <span className="text-sm font-semibold">{opt.label}</span>
                  {opt.subLabel && <span className="mt-0.5 text-xs text-[#605D62]/50">{opt.subLabel}</span>}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 結果画面 */}
        {screen === "results" && (
          <div>
            <SubHeader title="コーデ提案" onBack={() => setScreen("home")} />

            {loadingOutfit && (
              <div className="py-20 text-center text-sm text-[#605D62]/60">
                コーデを考え中...
              </div>
            )}

            {outfitResult?.error && (
              <div className="rounded-2xl bg-red-50 p-4 text-sm text-red-600">
                {outfitResult.error}
              </div>
            )}

            {!loadingOutfit && currentOutfit && (
              <div className="space-y-4">
                {/* ページネーション */}
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">
                    提案 {currentResultIndex + 1} / {totalResults}
                  </p>
                  <div className="flex gap-2">
                    {Array.from({ length: totalResults }).map((_, i) => (
                      <button key={i} type="button" onClick={() => setCurrentResultIndex(i)}
                        className={`h-2 rounded-full transition-all ${
                          i === currentResultIndex ? "w-6 bg-[#605D62]" : "w-2 bg-[#FCE4EC]"
                        }`} />
                    ))}
                  </div>
                </div>

                {/* スコア + コメント */}
                <div className="rounded-3xl bg-gradient-to-r from-[#FCE4EC] to-[#E3F2FD] p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="text-lg font-bold">スコア {currentOutfit.score}点</span>
                  </div>
                  {currentOutfit.reasons?.length > 0 && (
                    <p className="text-sm leading-relaxed text-[#605D62]">
                      {currentOutfit.reasons[0]}
                    </p>
                  )}
                </div>

                {/* アイテム一覧 */}
                <div className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-[#FCE4EC]">
                  <p className="mb-3 text-sm font-semibold">コーデアイテム</p>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: "トップス", item: currentOutfit.slotMap.topPrimary },
                      { label: "トップス2", item: currentOutfit.slotMap.topSecondary },
                      { label: "ボトムス", item: currentOutfit.slotMap.bottom },
                      { label: "ワンピース", item: currentOutfit.slotMap.onepiece },
                      { label: "アウター", item: currentOutfit.slotMap.outer },
                      { label: "シューズ", item: currentOutfit.slotMap.shoes },
                      { label: "バッグ", item: currentOutfit.slotMap.bag },
                    ].filter((slot) => slot.item !== null).map((slot) => (
                      <div key={slot.label} className="overflow-hidden rounded-2xl ring-1 ring-[#FCE4EC]">
                        <div className="h-32 bg-[#fdf2f6]">
                          {slot.item?.imageUrl ? (
                            <img src={slot.item.imageUrl} alt={slot.item.name ?? ""} className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full items-center justify-center text-xs text-[#605D62]/40">画像なし</div>
                          )}
                        </div>
                        <div className="p-2">
                          <p className="text-xs text-[#605D62]/50">{slot.label}</p>
                          <p className="truncate text-xs font-semibold">{slot.item?.name ?? "名称未設定"}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* アクションボタン */}
                <div className="grid grid-cols-2 gap-3">
                  <button type="button" onClick={goPrev} disabled={currentResultIndex === 0}
                    className="rounded-2xl bg-white py-3 text-sm font-medium ring-1 ring-[#FCE4EC] disabled:opacity-30">
                    ← 前のコーデ
                  </button>
                  <button type="button" onClick={goNext} disabled={currentResultIndex >= totalResults - 1}
                    className="rounded-2xl bg-white py-3 text-sm font-medium ring-1 ring-[#FCE4EC] disabled:opacity-30">
                    次のコーデ →
                  </button>
                  <button type="button" onClick={() => handleSaveFavorite(currentOutfit)}
                    className="rounded-2xl bg-[#605D62] py-3 text-sm font-semibold text-white">
                    ♡ お気に入り保存
                  </button>
                  <button type="button" onClick={() => generateOutfits()}
                    className="rounded-2xl bg-gradient-to-r from-[#FCE4EC] to-[#E3F2FD] py-3 text-sm font-semibold text-[#605D62]">
                    再提案する
                  </button>
                </div>

                {message && (
                  <div className="rounded-2xl bg-emerald-50 p-3 text-center text-sm text-emerald-600">
                    {message}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <BottomNav />
    </main>
  );
}

function SubHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div className="mb-5 flex items-center justify-between">
      <h1 className="text-xl font-bold text-[#605D62]">{title}</h1>
      <button type="button" onClick={onBack}
        className="rounded-full bg-white px-3 py-1.5 text-xs text-[#605D62] ring-1 ring-[#FCE4EC]">
        戻る
      </button>
    </div>
  );
}

function normalizeCategory(category: string) {
  if (category === "bags") return "bag";
  return category;
}

function getCategoryLabel(category: string) {
  const map: Record<string, string> = {
    tops: "トップス", bottoms: "ボトムス", onepiece: "ワンピース",
    outer: "アウター", shoes: "シューズ", bag: "バッグ", bags: "バッグ",
  };
  return map[category] ?? category;
}

function getTempRange(outing: string, returning: string) {
  const key = `${outing}-${returning}`;
  switch (key) {
    case "今から-深夜": case "夜-深夜": return { min: 8, max: 18 };
    case "朝-夜": case "朝-深夜": return { min: 10, max: 20 };
    case "昼-夕方": case "昼-夜": return { min: 18, max: 26 };
    case "夕方-夜": return { min: 14, max: 22 };
    default: return { min: 12, max: 24 };
  }
}