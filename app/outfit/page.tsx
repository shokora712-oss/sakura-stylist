"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useSession } from "next-auth/react";
import BottomNav from "../components/BottomNav";
import {
  Shuffle, Dress, MapPin, Palette,
  Sneaker, Sparkle, Flower, Butterfly, TShirt, Leaf, Diamond, Moon, Lightning, HighHeel, BaseballCap,
  ShoppingBag, Heart, Briefcase, ShirtFolded, Airplane, GraduationCap,
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
  breakdown: Record<string, number>;
  items: OutfitItem[];
  slotMap: OutfitSlotMap;
};

type OutfitResponse = {
  success?: boolean;
  count?: number;
  outfits?: Outfit[];
  error?: string;
};

type WeatherData = {
  minTemp: number;
  maxTemp: number;
  isRainy: boolean;
  description: string;
  iconUrl: string;
  cityName: string;
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

const LOCATION_CACHE_KEY = "sakura_location";
const WEATHER_CACHE_KEY = "sakura_weather_forecast";
const LOCATION_TTL = 5 * 60 * 1000;
const WEATHER_TTL = 30 * 60 * 1000;

type LocationCache = { lat: number; lon: number; ts: number };
type WeatherCache = { data: WeatherData; outingTime: string; returnTime: string; ts: number };

function getCachedLocation(): LocationCache | null {
  try {
    const raw = localStorage.getItem(LOCATION_CACHE_KEY);
    if (!raw) return null;
    const cache: LocationCache = JSON.parse(raw);
    if (Date.now() - cache.ts > LOCATION_TTL) return null;
    return cache;
  } catch { return null; }
}

function getCachedWeather(outingTime: string, returnTime: string): WeatherData | null {
  try {
    const raw = localStorage.getItem(WEATHER_CACHE_KEY);
    if (!raw) return null;
    const cache: WeatherCache = JSON.parse(raw);
    if (Date.now() - cache.ts > WEATHER_TTL) return null;
    if (cache.outingTime !== outingTime || cache.returnTime !== returnTime) return null;
    return cache.data;
  } catch { return null; }
}

function OutfitPage() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const autoTriggered = useRef(false);

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

  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLon, setUserLon] = useState<number | null>(null);

  const [outfitResult, setOutfitResult] = useState<OutfitResponse | null>(null);
  const [excludedOutfitKeys, setExcludedOutfitKeys] = useState<string[][]>([]);
  const [message, setMessage] = useState("");
  const [currentResultIndex, setCurrentResultIndex] = useState(0);


  useEffect(() => {
    void fetchItems().then(() => {
      if (searchParams.get("auto") === "1" && !autoTriggered.current) {
        autoTriggered.current = true;
        generateOutfits({
          style: null,
          occasion: null,
          fixedItemId: null,
          isRegenerate: false,
        });
      }
    });
  }, []);

  useEffect(() => {
    setPrioritizeVersatility(selectedOccasion === "travel");
  }, [selectedOccasion]);

  // 位置情報取得
  useEffect(() => {
    const locCache = getCachedLocation();
    if (locCache) {
      setUserLat(locCache.lat);
      setUserLon(locCache.lon);
      return;
    }

    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lon } = pos.coords;
        localStorage.setItem(LOCATION_CACHE_KEY, JSON.stringify({ lat, lon, ts: Date.now() }));
        setUserLat(lat);
        setUserLon(lon);
      },
      () => setLocationError("位置情報を取得できませんでした")
    );
  }, []);

  // 時間帯変更時に予報を取得
  useEffect(() => {
    if (!userLat || !userLon) return;
    void fetchForecast(userLat, userLon, selectedOutingTime, selectedReturnTime);
  }, [userLat, userLon, selectedOutingTime, selectedReturnTime]);

  async function fetchForecast(lat: number, lon: number, outingTime: string, returnTime: string) {
    const cached = getCachedWeather(outingTime, returnTime);
    if (cached) {
      setWeather(cached);
      return;
    }

    setWeatherLoading(true);
    try {
      const res = await fetch(
        `/api/weather?lat=${lat}&lon=${lon}&type=forecast&outingTime=${encodeURIComponent(outingTime)}&returnTime=${encodeURIComponent(returnTime)}`
      );
      const data = await res.json();
      if (res.ok) {
        setWeather(data);
        localStorage.setItem(WEATHER_CACHE_KEY, JSON.stringify({
          data,
          outingTime,
          returnTime,
          ts: Date.now(),
        }));
      }
    } catch {
      // 天気取得失敗は無視して続行
    } finally {
      setWeatherLoading(false);
    }
  }

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
  isRegenerate?: boolean;
}) {
  try {
    setLoadingOutfit(true);
    setMessage("");
    setOutfitResult(null);

    const currentExcluded: string[][] = params?.isRegenerate
      ? [
          ...excludedOutfitKeys,
          ...(outfitResult?.outfits?.map((o) =>
            o.items.map((i) => i.id).sort()
          ) ?? []),
        ]
      : [];

    if (params?.isRegenerate) {
      setExcludedOutfitKeys(currentExcluded);
    } else {
      setExcludedOutfitKeys([]);
    }

    const tempRange = weather
      ? { min: weather.minTemp, max: weather.maxTemp }
      : getTempRange(selectedOutingTime, selectedReturnTime);

    const res = await fetch("/api/outfit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        style: params?.style ?? selectedStyle ?? null,
        occasion: params?.occasion ?? selectedOccasion ?? null,
        fixedItemId: params?.fixedItemId ?? (selectedItemId || null),
        minTemp: tempRange.min,
        maxTemp: tempRange.max,
        isRainy: weather?.isRainy ?? false,
        prioritizeVersatility:
          (params?.occasion ?? selectedOccasion) === "travel",
        limit: 3,
        excludedOutfitKeys: currentExcluded,
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
    setOutfitResult({
      error: error instanceof Error ? error.message : "コーデ提案に失敗しました",
    });
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
      temperatureLabel: weather
        ? `${weather.minTemp}℃〜${weather.maxTemp}℃`
        : `${selectedOutingTime}-${selectedReturnTime}`,
      isFavorite: true,
    };

    const res = await fetch("/api/outfits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      throw new Error();
    }

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
}  return (
    <main className="min-h-screen bg-[#fdf2f6] pb-32 text-[#605D62]">
      <div className="mx-auto max-w-md px-4 py-6">

        {screen === "home" && (
          <div className="space-y-5">
            <div>
              <p className="text-xs text-[#605D62]/60">Sakura Stylist</p>
              <h1 className="text-2xl font-bold">コーデ提案</h1>
            </div>

            {/* 天気カード */}
            <div className="rounded-3xl bg-white p-4 ring-1 ring-[#FCE4EC]">
              <p className="mb-2 text-xs font-semibold text-[#605D62]/60">今日の天気</p>
              {weatherLoading ? (
                <p className="text-sm text-[#605D62]/40">取得中...</p>
              ) : locationError ? (
                <p className="text-xs text-[#605D62]/40">{locationError}</p>
              ) : weather ? (
                <div className="flex items-center gap-3">
                  {weather.iconUrl && (
                    <img src={weather.iconUrl} alt={weather.description} className="h-12 w-12" />
                  )}
                  <div>
                    <p className="text-lg font-bold text-[#605D62]">
                      {weather.minTemp}℃〜{weather.maxTemp}℃
                    </p>
                    <p className="text-xs text-[#605D62]/60">{weather.cityName} · {weather.description}</p>
                    {weather.isRainy && (
                      <span className="mt-0.5 inline-block rounded-full bg-[#E3F2FD] px-2 py-0.5 text-xs text-[#605D62]">
                        🌂 雨対策コーデを提案します
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-[#605D62]/40">位置情報を許可すると天気を表示できます</p>
              )}
            </div>

            {/* 時間帯選択 */}
            <div className="rounded-3xl bg-white p-4 ring-1 ring-[#FCE4EC]">
              <p className="mb-3 text-sm font-semibold">お出かけ時間</p>
              <div className="flex flex-wrap gap-2">
                {OUTING_TIMES.map((time) => (
                  <button key={time} type="button"
                    onClick={() => setSelectedOutingTime(time)}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                      selectedOutingTime === time ? "bg-[#605D62] text-white" : "bg-[#fdf2f6] text-[#605D62]"
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
                      selectedReturnTime === time ? "bg-[#605D62] text-white" : "bg-[#fdf2f6] text-[#605D62]"
                    }`}>
                    {time}
                  </button>
                ))}
              </div>
            </div>

            {/* おまかせボタン */}
            <button type="button"
              onClick={() =>
                generateOutfits({
                  style: null,
                  occasion: null,
                  fixedItemId: null,
                  isRegenerate: false,
                })
              }
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

        {(screen === "closet-categories" || screen === "closet-items") && (
          <div>
            <SubHeader title="使いたい服を選ぶ" onBack={() => setScreen("home")} />
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

            {!selectedCategory ? (
              <p className="py-10 text-center text-sm text-[#605D62]/50">カテゴリを選んでください</p>
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
                    onClick={() =>
                      generateOutfits({
                        style: selectedStyle,
                        occasion: selectedOccasion,
                        fixedItemId: item.id,
                        isRegenerate: false,
                      })
                    }
                    className="overflow-hidden rounded-3xl bg-white text-left shadow-sm ring-1 ring-[#FCE4EC] transition hover:shadow-md">
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

        {screen === "style-select" && (
          <div>
            <SubHeader title="系統を選ぶ" onBack={() => setScreen("home")} />
            <div className="grid grid-cols-2 gap-3">
              {STYLE_OPTIONS.map((opt) => (
                <button key={opt.value} type="button"
                  onClick={() => {
                    setSelectedStyle(opt.value);
                    generateOutfits({
                      style: opt.value,
                      occasion: selectedOccasion,
                      fixedItemId: null,
                      isRegenerate: false,
                    });
                  }}
                  className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-[#FCE4EC] transition hover:shadow-md">
                  <opt.icon size={24} color="#605D62" />
                  <span className="text-sm font-semibold">{opt.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {screen === "occasion-select" && (
          <div>
            <SubHeader title="シチュエーション" onBack={() => setScreen("home")} />
            <div className="grid grid-cols-2 gap-3">
              {OCCASION_OPTIONS.map((opt) => (
                <button key={opt.value} type="button"
                  onClick={() => {
                    setSelectedOccasion(opt.value);
                    generateOutfits({
                      style: selectedStyle,
                      occasion: opt.value,
                      fixedItemId: null,
                      isRegenerate: false,
                    });
                  }}
                  className="flex h-28 flex-col items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-[#FCE4EC] transition hover:shadow-md">
                  <opt.icon size={28} color="#605D62" className="mb-1" />
                  <span className="text-sm font-semibold">{opt.label}</span>
                  {opt.subLabel && <span className="mt-0.5 text-xs text-[#605D62]/50">{opt.subLabel}</span>}
                </button>
              ))}
            </div>
          </div>
        )}

        {screen === "results" && (
          <div>
            <SubHeader title="コーデ提案" onBack={() => setScreen("home")} />

            {/* 天気サマリー */}
            {weather && (
              <div className="mb-4 flex items-center gap-2 rounded-2xl bg-white px-4 py-2.5 ring-1 ring-[#FCE4EC]">
                {weather.iconUrl && <img src={weather.iconUrl} alt="" className="h-8 w-8" />}
                <p className="text-xs text-[#605D62]">
                  {weather.minTemp}℃〜{weather.maxTemp}℃ · {weather.description}
                  {weather.isRainy && " · 雨対策済み"}
                </p>
              </div>
            )}

            {loadingOutfit && (
              <div className="py-20 text-center text-sm text-[#605D62]/60">コーデを考え中...</div>
            )}

            {outfitResult?.error && (
              <div className="rounded-2xl bg-red-50 p-4 text-sm text-red-600">{outfitResult.error}</div>
            )}

            {!loadingOutfit && currentOutfit && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">提案 {currentResultIndex + 1} / {totalResults}</p>
                  <div className="flex gap-2">
                    {Array.from({ length: totalResults }).map((_, i) => (
                      <button key={i} type="button" onClick={() => setCurrentResultIndex(i)}
                        className={`h-2 rounded-full transition-all ${
                          i === currentResultIndex ? "w-6 bg-[#605D62]" : "w-2 bg-[#FCE4EC]"
                        }`} />
                    ))}
                  </div>
                </div>

                <div className="rounded-3xl bg-gradient-to-r from-[#FCE4EC] to-[#E3F2FD] p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="text-lg font-bold">スコア {currentOutfit.score}点</span>
                  </div>
                  {currentOutfit.reasons?.length > 0 && (
                    <p className="text-sm leading-relaxed text-[#605D62]">{currentOutfit.reasons[0]}</p>
                  )}
                </div>

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
                  <button type="button" onClick={() => generateOutfits({ isRegenerate: true })}
                    className="rounded-2xl bg-gradient-to-r from-[#FCE4EC] to-[#E3F2FD] py-3 text-sm font-semibold text-[#605D62]">
                    再提案する
                  </button>
                </div>

                {message && (
                  <div className="rounded-2xl bg-emerald-50 p-3 text-center text-sm text-emerald-600">{message}</div>
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

function getOutfitKeyArray(outfit: Outfit): string[] {
  return outfit.items.map((item) => item.id).sort();
}

export default function OutfitPageWrapper() {
  return (
    <Suspense>
      <OutfitPage />
    </Suspense>
  );
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