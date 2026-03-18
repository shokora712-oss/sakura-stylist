"use client";

import { useEffect, useMemo, useState } from "react";

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
  createdAt?: string;
  updatedAt?: string;
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

type Outfit = {
  rank: number;
  score: number;
  reasons: string[];
  breakdown: {
    structure: number;
    temperature: number;
    occasion: number;
    style: number;
    color: number;
    preference: number;
    rewear: number;
  };
  items: OutfitItem[];
};

type OutfitResponse = {
  success?: boolean;
  count?: number;
  outfits?: Outfit[];
  error?: string;
};

type SavedOutfit = {
  id: string;
  topItemId?: string | null;
  bottomItemId?: string | null;
  onepieceItemId?: string | null;
  outerItemId?: string | null;
  shoesItemId?: string | null;
  bagItemId?: string | null;
  score?: number | null;
  comment?: string | null;
  isFavorite?: boolean;
  temperatureLabel?: string | null;
  occasion?: string | null;
  createdAt: string;
};

type Option = {
  value: string;
  label: string;
};

const colorOptions: Option[] = [
  { value: "white", label: "白" },
  { value: "black", label: "黒" },
  { value: "gray", label: "グレー" },
  { value: "beige", label: "ベージュ" },
  { value: "brown", label: "ブラウン" },
  { value: "navy", label: "ネイビー" },
  { value: "blue", label: "ブルー" },
  { value: "red", label: "レッド" },
  { value: "pink", label: "ピンク" },
  { value: "green", label: "グリーン" },
  { value: "yellow", label: "イエロー" },
];

const temperatureOptions = [
  { label: "レベル1", description: "〜15℃ / 冬服", min: 0, max: 15 },
  { label: "レベル2", description: "16〜20℃ / 軽アウター", min: 16, max: 20 },
  { label: "レベル3", description: "21〜26℃ / 長袖", min: 21, max: 26 },
  { label: "レベル4", description: "27℃〜 / 夏服", min: 27, max: 40 },
];

const seasonOptions: Option[] = [
  { value: "spring", label: "春" },
  { value: "summer", label: "夏" },
  { value: "autumn", label: "秋" },
  { value: "winter", label: "冬" },
];

const styleTagOptions: Option[] = [
  { value: "casual", label: "カジュアル" },
  { value: "girly", label: "ガーリー" },
  { value: "street", label: "ストリート" },
  { value: "mode", label: "モード" },
  { value: "minimal", label: "ミニマル" },
  { value: "feminine", label: "フェミニン" },
  { value: "office", label: "オフィス" },
];

const subCategoryOptionsMap: Record<string, Option[]> = {
  tops: [
    { value: "knit", label: "ニット" },
    { value: "tshirt", label: "Tシャツ" },
    { value: "shirt", label: "シャツ" },
    { value: "blouse", label: "ブラウス" },
    { value: "hoodie", label: "パーカー" },
    { value: "cardigan", label: "カーディガン" },
    { value: "sweat", label: "スウェット" },
  ],
  bottoms: [
    { value: "denim", label: "デニム" },
    { value: "slacks", label: "スラックス" },
    { value: "skirt", label: "スカート" },
    { value: "shorts", label: "ショートパンツ" },
    { value: "wide_pants", label: "ワイドパンツ" },
    { value: "flare_pants", label: "フレアパンツ" },
    { value: "sweatpants", label: "スウェットパンツ" },
  ],
  onepiece: [
    { value: "dress", label: "ワンピース" },
    { value: "shirt_dress", label: "シャツワンピース" },
    { value: "knit_dress", label: "ニットワンピース" },
    { value: "jumper_skirt", label: "ジャンパースカート" },
  ],
  outer: [
    { value: "jacket", label: "ジャケット" },
    { value: "coat", label: "コート" },
    { value: "blouson", label: "ブルゾン" },
    { value: "trench", label: "トレンチコート" },
    { value: "down", label: "ダウン" },
    { value: "parka", label: "パーカー" },
  ],
  shoes: [
    { value: "sneakers", label: "スニーカー" },
    { value: "boots", label: "ブーツ" },
    { value: "pumps", label: "パンプス" },
    { value: "sandals", label: "サンダル" },
    { value: "loafers", label: "ローファー" },
    { value: "heels", label: "ヒール" },
  ],
  bag: [
    { value: "shoulder_bag", label: "ショルダーバッグ" },
    { value: "tote_bag", label: "トートバッグ" },
    { value: "backpack", label: "リュック" },
    { value: "handbag", label: "ハンドバッグ" },
    { value: "mini_bag", label: "ミニバッグ" },
  ],
};

const occasionOptions: Option[] = [
  { value: "casual", label: "カジュアル" },
  { value: "office", label: "オフィス" },
  { value: "date", label: "デート" },
  { value: "formal", label: "フォーマル" },
  { value: "travel", label: "旅行" },
];

export default function Home() {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("tops");
  const [subCategory, setSubCategory] = useState("");
  const [color, setColor] = useState("");
  const [brand, setBrand] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [seasons, setSeasons] = useState<string[]>([]);
  const [styleTags, setStyleTags] = useState<string[]>([]);
  const [message, setMessage] = useState("");

  const [items, setItems] = useState<Item[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);

  const [outfitResult, setOutfitResult] = useState<OutfitResponse | null>(null);
  const [loadingOutfit, setLoadingOutfit] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [likedOutfits, setLikedOutfits] = useState<number[]>([]);
  const [selectedItemId, setSelectedItemId] = useState("");
  const [favoriteOutfits, setFavoriteOutfits] = useState<SavedOutfit[]>([]);
  const [loadingFavorites, setLoadingFavorites] = useState(false);
  const [selectedTemperatureLabel, setSelectedTemperatureLabel] = useState("レベル3");
  const [selectedOccasion, setSelectedOccasion] = useState<string | null>(null);
  const [prioritizeVersatility, setPrioritizeVersatility] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);

  useEffect(() => {
    if (selectedOccasion !== "travel") {
      setPrioritizeVersatility(false);
    }
  }, [selectedOccasion]);

  const selectedTemperature =
    temperatureOptions.find((option) => option.label === selectedTemperatureLabel) ??
    temperatureOptions[2];

  const currentSubCategoryOptions = useMemo(() => {
    return subCategoryOptionsMap[category] ?? [];
  }, [category]);

  useEffect(() => {
    if (!editingItemId) {
      setSubCategory("");
    }
  }, [category, editingItemId]);

  const fetchItems = async () => {
    try {
      setLoadingItems(true);
      const res = await fetch("/api/items");

      if (!res.ok) {
        throw new Error("一覧取得失敗");
      }

      const data = await res.json();
      setItems(data);
    } catch (error) {
      console.error(error);
      setMessage("アイテム一覧の取得に失敗しました");
    } finally {
      setLoadingItems(false);
    }
  };

  const fetchFavoriteOutfits = async () => {
    try {
      setLoadingFavorites(true);
      const res = await fetch("/api/outfits");

      if (!res.ok) {
        throw new Error("お気に入り取得失敗");
      }

      const data = await res.json();
      setFavoriteOutfits(data);
    } catch (error) {
      console.error(error);
      setMessage("お気に入りコーデ一覧の取得に失敗しました");
    } finally {
      setLoadingFavorites(false);
    }
  };

  useEffect(() => {
    fetchItems();
    fetchFavoriteOutfits();
  }, []);

  const handleImageUpload = async (file: File) => {
    try {
      setUploadingImage(true);
      setMessage("画像をアップロード中...");

      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.error || "画像アップロードに失敗しました");
      }

      setImageUrl(data.imageUrl);
      setMessage("画像アップロード完了");
    } catch (error) {
      console.error(error);
      setMessage(
        error instanceof Error
          ? error.message
          : "画像アップロードに失敗しました"
      );
    } finally {
      setUploadingImage(false);
    }
  };

  const handleDeleteFavoriteOutfit = async (id: string) => {
    const ok = window.confirm("このお気に入りコーデを削除しますか？");
    if (!ok) return;

    try {
      const res = await fetch(`/api/outfits/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        console.error("favorite delete error response:", errorData);
        throw new Error(errorData?.error || "お気に入り削除失敗");
      }

      setMessage("お気に入りコーデを削除しました");
      await fetchFavoriteOutfits();
    } catch (error) {
      console.error(error);
      setMessage(
        error instanceof Error
          ? error.message
          : "お気に入りコーデの削除に失敗しました"
      );
    }
  };

  const toggleSeason = (value: string) => {
    setSeasons((prev) =>
      prev.includes(value) ? prev.filter((season) => season !== value) : [...prev, value]
    );
  };

  const toggleStyleTag = (value: string) => {
    setStyleTags((prev) =>
      prev.includes(value) ? prev.filter((tag) => tag !== value) : [...prev, value]
    );
  };

  const resetForm = () => {
    setEditingItemId(null);
    setName("");
    setCategory("tops");
    setSubCategory("");
    setColor("");
    setBrand("");
    setImageUrl("");
    setSeasons([]);
    setStyleTags([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(editingItemId ? "更新中..." : "登録中...");

    try {
      const payload = {
        name,
        category,
        subCategory: subCategory || null,
        color: color ? [color] : [],
        material: [],
        season: seasons,
        styleTags,
        formality: calculateFormalityFromStyleTags(styleTags),
        brand: brand || null,
        imageUrl: imageUrl || null,
      };

      const isEditMode = Boolean(editingItemId);

      const res = await fetch(
        isEditMode ? `/api/items/${editingItemId}` : "/api/items",
        {
          method: isEditMode ? "PATCH" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.error || (isEditMode ? "更新失敗" : "登録失敗"));
      }

      setMessage(
        isEditMode
          ? `更新成功: ${data.name ?? "名称なし"}`
          : `登録成功: ${data.name ?? "名称なし"}`
      );

      resetForm();
      await fetchItems();
    } catch (error) {
      console.error(error);
      setMessage(
        error instanceof Error
          ? error.message
          : editingItemId
          ? "更新に失敗しました"
          : "登録に失敗しました"
      );
    }
  };

  const handleEdit = (item: Item) => {
    setEditingItemId(item.id);
    setName(item.name ?? "");
    setCategory(item.category);
    setSubCategory(item.subCategory ?? "");
    setColor(item.color?.[0] ?? "");
    setBrand(item.brand ?? "");
    setImageUrl(item.imageUrl ?? "");
    setSeasons(item.season ?? []);
    setStyleTags(item.styleTags ?? []);
    setMessage(`編集中: ${item.name ?? "名称なし"}`);

    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (id: string) => {
    const ok = window.confirm("このアイテムを削除しますか？");
    if (!ok) return;

    try {
      const res = await fetch(`/api/items/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        console.error("delete error response:", errorData);
        throw new Error(errorData?.error || "削除失敗");
      }

      setMessage("削除しました");
      await fetchItems();
    } catch (error) {
      console.error(error);
      setMessage(error instanceof Error ? error.message : "削除に失敗しました");
    }
  };

  const generateOutfit = async () => {
    try {
      setLoadingOutfit(true);
      setOutfitResult(null);
      setCurrentIndex(0);
      setLikedOutfits([]);
      setMessage("");

      const styleFromOccasion =
        selectedOccasion === "formal"
          ? "office"
          : selectedOccasion === "office"
          ? "office"
          : selectedOccasion === "casual"
          ? "casual"
          : selectedOccasion === "date"
          ? "feminine"
          : selectedOccasion === "travel"
          ? "casual"
          : null;

      const res = await fetch("/api/outfit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          style: styleFromOccasion,
          minTemp: selectedTemperature.min,
          maxTemp: selectedTemperature.max,
          limit: 3,
          fixedItemId: selectedItemId || null,
          occasion: selectedOccasion,
          prioritizeVersatility,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "コーデ生成に失敗しました");
      }

      if (!data.outfits || data.outfits.length === 0) {
        setOutfitResult({
          success: true,
          count: 0,
          outfits: [],
          error: "条件に合うコーデが見つかりませんでした。TPOや気温条件を少し緩めて試してみてください。",
        });
        return;
      }

      setOutfitResult(data);
    } catch (error) {
      console.error(error);
      setOutfitResult({
        error: error instanceof Error ? error.message : "コーデ生成に失敗しました",
      });
    } finally {
      setLoadingOutfit(false);
    }
  };

  const currentOutfit = outfitResult?.outfits?.[currentIndex];
  const totalOutfits = outfitResult?.outfits?.length ?? 0;

  const saveFavoriteOutfit = async () => {
    if (!currentOutfit) return;

    const topItem = currentOutfit.items.find((item) => item.category === "tops");
    const bottomItem = currentOutfit.items.find((item) => item.category === "bottoms");
    const onepieceItem = currentOutfit.items.find((item) => item.category === "onepiece");
    const outerItem = currentOutfit.items.find((item) => item.category === "outer");
    const shoesItem = currentOutfit.items.find((item) => item.category === "shoes");
    const bagItem = currentOutfit.items.find(
      (item) => item.category === "bag" || item.category === "bags"
    );

    const res = await fetch("/api/outfits", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        topItemId: topItem?.id ?? null,
        bottomItemId: bottomItem?.id ?? null,
        onepieceItemId: onepieceItem?.id ?? null,
        outerItemId: outerItem?.id ?? null,
        shoesItemId: shoesItem?.id ?? null,
        bagItemId: bagItem?.id ?? null,
        score: currentOutfit.score,
        comment: buildStylistComment(currentOutfit),
        isFavorite: true,
        temperatureLabel: selectedTemperatureLabel ?? null,
        occasion: selectedOccasion ?? null,
      }),
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => null);
      throw new Error(errorData?.error || "お気に入り保存失敗");
    }
  };

  const handleLikeOutfit = async () => {
    if (!currentOutfit) return;

    try {
      await saveFavoriteOutfit();

      setLikedOutfits((prev) =>
        prev.includes(currentOutfit.rank) ? prev : [...prev, currentOutfit.rank]
      );

      await fetchFavoriteOutfits();
      setMessage("お気に入りコーデを保存しました");

      if (currentIndex < totalOutfits - 1) {
        setCurrentIndex((prev) => prev + 1);
      }
    } catch (error) {
      console.error(error);
      setMessage(
        error instanceof Error
          ? error.message
          : "お気に入りコーデの保存に失敗しました"
      );
    }
  };

  const handleSkipOutfit = () => {
    if (currentIndex < totalOutfits - 1) {
      setCurrentIndex((prev) => prev + 1);
    }
  };

  const handlePrevOutfit = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  };

  const getItemNameById = (id?: string | null) => {
    if (!id) return "なし";

    const matched = items.find((item) => item.id === id);
    if (!matched) return "不明なアイテム";

    return matched.name ?? `${getCategoryLabel(matched.category)}（名称なし）`;
  };

  const getItemById = (id?: string | null) => {
    if (!id) return null;
    return items.find((item) => item.id === id) ?? null;
  };

  return (
    <main className="min-h-screen bg-white px-6 py-10">
      <div className="mx-auto max-w-6xl">
        <h1 className="mb-6 text-3xl font-bold">Closet AI</h1>
        <p className="mb-8 text-gray-600">まずは服を1件登録してみましょう！</p>

        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">
              {editingItemId ? "アイテムを編集" : "アイテムを登録"}
            </h2>
            <p className="text-sm text-gray-500">
              {editingItemId ? "内容を修正して保存できます" : "まずは服を1件登録してみましょう！"}
            </p>
          </div>

          {editingItemId && (
            <button
              type="button"
              onClick={resetForm}
              className="rounded-lg border px-4 py-2 text-sm"
            >
              編集をキャンセル
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 rounded-2xl border p-6 shadow-sm">
          <div>
            <label className="mb-1 block text-sm font-medium">アイテム名</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border px-3 py-2"
              placeholder="白ニット"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">カテゴリ</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-lg border px-3 py-2"
            >
              <option value="tops">トップス</option>
              <option value="bottoms">ボトムス</option>
              <option value="onepiece">ワンピース</option>
              <option value="outer">アウター</option>
              <option value="shoes">シューズ</option>
              <option value="bag">バッグ</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">サブカテゴリ</label>
            <select
              value={subCategory}
              onChange={(e) => setSubCategory(e.target.value)}
              className="w-full rounded-lg border px-3 py-2"
            >
              <option value="">未設定</option>
              {currentSubCategoryOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">色</label>
            <div className="flex flex-wrap gap-2">
              {colorOptions.map((option) => {
                const selected = color === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setColor(option.value)}
                    className={`rounded-full border px-3 py-1 text-sm ${
                      selected
                        ? "border-black bg-black text-white"
                        : "border-gray-300 bg-white text-black"
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-sm text-gray-600">
              選択中: {getColorLabel(color) || "未選択"}
            </p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">ブランド</label>
            <input
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              className="w-full rounded-lg border px-3 py-2"
              placeholder="UNIQLO"
            />
          </div>

          <div className="space-y-3">
            <label className="mb-1 block text-sm font-medium">画像</label>

            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  handleImageUpload(file);
                }
              }}
              className="w-full rounded-lg border px-3 py-2"
            />

            {uploadingImage && (
              <p className="text-sm text-gray-500">アップロード中...</p>
            )}

            {imageUrl && (
              <div className="space-y-2">
                <img
                  src={imageUrl}
                  alt="preview"
                  className="h-40 w-full rounded-lg object-cover"
                />
                <p className="text-xs text-gray-500 break-all">{imageUrl}</p>
              </div>
            )}
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">季節</label>
            <div className="flex flex-wrap gap-2">
              {seasonOptions.map((option) => {
                const selected = seasons.includes(option.value);
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => toggleSeason(option.value)}
                    className={`rounded-full border px-3 py-1 text-sm ${
                      selected
                        ? "border-black bg-black text-white"
                        : "border-gray-300 bg-white text-black"
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">スタイルタグ</label>
            <div className="flex flex-wrap gap-2">
              {styleTagOptions.map((option) => {
                const selected = styleTags.includes(option.value);
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => toggleStyleTag(option.value)}
                    className={`rounded-full border px-3 py-1 text-sm ${
                      selected
                        ? "border-black bg-black text-white"
                        : "border-gray-300 bg-white text-black"
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>

          <button
            type="submit"
            className="w-full rounded-lg bg-black px-4 py-2 text-sm text-white"
          >
            {editingItemId ? "更新する" : "登録する"}
          </button>

          {message && <p className="text-sm text-gray-700">{message}</p>}
        </form>

        <section className="mt-10 space-y-5 rounded-2xl border p-6 shadow-sm">
          <h2 className="text-2xl font-semibold">コーデ生成</h2>

          <div>
            <label className="mb-1 block text-sm font-medium">使いたいアイテム</label>
            <select
              value={selectedItemId}
              onChange={(e) => setSelectedItemId(e.target.value)}
              className="w-full rounded-lg border px-3 py-2"
            >
              <option value="">指定なし</option>
              {items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name ?? "名称なし"} / {getCategoryLabel(item.category)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">気温</label>
            <div className="flex flex-wrap gap-2">
              {temperatureOptions.map((option) => {
                const selected = selectedTemperatureLabel === option.label;

                return (
                  <button
                    key={option.label}
                    type="button"
                    onClick={() => setSelectedTemperatureLabel(option.label)}
                    className={`rounded-xl border px-3 py-2 text-sm ${
                      selected
                        ? "border-black bg-black text-white"
                        : "border-gray-300 bg-white text-black"
                    }`}
                  >
                    <div className="font-medium">{option.label}</div>
                    <div className="text-xs opacity-80">{option.description}</div>
                  </button>
                );
              })}
            </div>

            <p className="mt-2 text-sm text-gray-600">
              選択中: {selectedTemperature.label}（{selectedTemperature.description}）
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">TPO</p>
            <div className="flex flex-wrap gap-2">
              {occasionOptions.map((option) => {
                const isSelected = selectedOccasion === option.value;

                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() =>
                      setSelectedOccasion((prev) =>
                        prev === option.value ? null : option.value
                      )
                    }
                    className={`rounded-full border px-3 py-1 text-sm transition ${
                      isSelected
                        ? "border-black bg-black text-white"
                        : "border-gray-300 bg-white text-black hover:bg-gray-100"
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
            <p className="text-sm text-gray-600">
              選択中: {getOccasionLabel(selectedOccasion) || "未選択"}
            </p>
          </div>

          <div>
            <button
              onClick={generateOutfit}
              className="w-full rounded-lg bg-blue-600 px-4 py-2 text-white"
              type="button"
            >
              {loadingOutfit ? "生成中..." : "コーデ生成"}
            </button>
          </div>
        </section>

        {selectedOccasion === "travel" && (
          <div className="space-y-2">
            <p className="text-sm font-medium">旅行では着回しやすさを重視する？</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPrioritizeVersatility(true)}
                className={`rounded-full border px-3 py-1 text-sm ${
                  prioritizeVersatility
                    ? "border-black bg-black text-white"
                    : "border-gray-300 bg-white text-black"
                }`}
              >
                はい
              </button>
              <button
                type="button"
                onClick={() => setPrioritizeVersatility(false)}
                className={`rounded-full border px-3 py-1 text-sm ${
                  !prioritizeVersatility
                    ? "border-black bg-black text-white"
                    : "border-gray-300 bg-white text-black"
                }`}
              >
                いいえ
              </button>
            </div>
          </div>
        )}

        {outfitResult?.error && (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {outfitResult.error}
          </div>
        )}

        {outfitResult?.success && currentOutfit && (
          <section className="mt-10">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-2xl font-semibold">コーデ提案結果</h2>
              <span className="rounded-full bg-blue-50 px-3 py-1 text-sm text-blue-700">
                {currentIndex + 1} / {totalOutfits}
              </span>
            </div>

            {(() => {
              const tops = currentOutfit.items.find((item) => item.category === "tops");
              const bottoms = currentOutfit.items.find(
                (item) => item.category === "bottoms"
              );
              const onepiece = currentOutfit.items.find(
                (item) => item.category === "onepiece"
              );
              const outer = currentOutfit.items.find((item) => item.category === "outer");
              const shoes = currentOutfit.items.find((item) => item.category === "shoes");
              const bag = currentOutfit.items.find(
                (item) => item.category === "bag" || item.category === "bags"
              );

              return (
                <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                  <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm text-gray-500">コーデ {currentOutfit.rank}</p>
                      <h3 className="text-2xl font-bold">{currentOutfit.score}点</h3>
                    </div>

                    <div className="rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-700">
                      Rank #{currentOutfit.rank}
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    <ItemCard label="トップス" item={tops} />
                    <ItemCard label="ボトムス" item={bottoms} />
                    <ItemCard label="ワンピース" item={onepiece} />
                    <ItemCard label="アウター" item={outer} />
                    <ItemCard label="シューズ" item={shoes} />
                    <ItemCard label="バッグ" item={bag} />
                  </div>

                  <div className="mt-6 rounded-2xl bg-gray-50 p-4">
                    <h4 className="mb-2 font-semibold">スタイリストコメント</h4>
                    <p className="text-sm leading-7 text-gray-700">
                      {buildStylistComment(currentOutfit)}
                    </p>
                  </div>

                  <div className="mt-6 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={handlePrevOutfit}
                      disabled={currentIndex === 0}
                      className="rounded-xl border border-gray-300 px-4 py-2 text-sm text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      前へ
                    </button>

                    <button
                      type="button"
                      onClick={handleSkipOutfit}
                      disabled={currentIndex === totalOutfits - 1}
                      className="rounded-xl border border-gray-300 px-4 py-2 text-sm text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      スキップ
                    </button>

                    <button
                      type="button"
                      onClick={handleLikeOutfit}
                      className="rounded-xl bg-black px-4 py-2 text-sm text-white"
                    >
                      これがいい！
                    </button>
                  </div>

                  <div className="mt-6">
                    <h4 className="mb-3 font-semibold">スコア内訳</h4>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <ScoreBadge label="構造" value={currentOutfit.breakdown.structure} />
                      <ScoreBadge label="気温" value={currentOutfit.breakdown.temperature} />
                      <ScoreBadge label="TPO" value={currentOutfit.breakdown.occasion} />
                      <ScoreBadge label="スタイル" value={currentOutfit.breakdown.style} />
                      <ScoreBadge label="色" value={currentOutfit.breakdown.color} />
                      <ScoreBadge label="好み" value={currentOutfit.breakdown.preference} />
                      <ScoreBadge label="着回し" value={currentOutfit.breakdown.rewear} />
                    </div>
                  </div>

                  {likedOutfits.length > 0 && (
                    <div className="mt-6 rounded-xl bg-green-50 p-3 text-sm text-green-700">
                      お気に入りにしたコーデ: {likedOutfits.join(", ")}
                    </div>
                  )}
                </div>
              );
            })()}
          </section>
        )}

        <section className="mt-10">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-2xl font-semibold">登録済みアイテム一覧</h2>
            <button onClick={fetchItems} className="rounded-lg border px-4 py-2 text-sm" type="button">
              再読み込み
            </button>
          </div>

          {loadingItems ? (
            <p className="text-sm text-gray-500">読み込み中...</p>
          ) : items.length === 0 ? (
            <div className="rounded-2xl border border-dashed p-6 text-sm text-gray-500">
              まだアイテムが登録されていません
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {items.map((item) => (
                <div key={item.id} className="rounded-2xl border p-4 shadow-sm">
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt={item.name ?? "item"}
                      className="mb-3 h-48 w-full rounded-lg object-cover"
                    />
                  ) : (
                    <div className="mb-3 flex h-48 w-full items-center justify-center rounded-lg bg-gray-100 text-sm text-gray-400">
                      画像なし
                    </div>
                  )}

                  <div className="mb-2 flex items-start justify-between gap-3">
                    <h3 className="font-semibold">{item.name ?? "名称なし"}</h3>
                    <span className="rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-700">
                      {getCategoryLabel(item.category)}
                    </span>
                  </div>

                  <div className="space-y-1 text-sm text-gray-600">
                    <p>
                      <span className="font-medium text-gray-800">色:</span>{" "}
                      {item.color?.length ? item.color.map(getColorLabel).join(", ") : "未設定"}
                    </p>
                    <p>
                      <span className="font-medium text-gray-800">ブランド:</span>{" "}
                      {item.brand ?? "未設定"}
                    </p>
                    <p>
                      <span className="font-medium text-gray-800">サブカテゴリ:</span>{" "}
                      {getSubCategoryLabel(item.category, item.subCategory) || "未設定"}
                    </p>
                    <p>
                      <span className="font-medium text-gray-800">季節:</span>{" "}
                      {item.season?.length ? item.season.map(getSeasonLabel).join(", ") : "未設定"}
                    </p>
                    <p>
                      <span className="font-medium text-gray-800">スタイルタグ:</span>{" "}
                      {item.styleTags?.length
                        ? item.styleTags.map(getStyleTagLabel).join(", ")
                        : "未設定"}
                    </p>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handleEdit(item)}
                      className="rounded-lg border px-4 py-2 text-sm"
                    >
                      編集
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDelete(item.id)}
                      className="rounded-lg border border-red-300 px-4 py-2 text-sm text-red-600"
                    >
                      削除
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="mt-10">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-2xl font-semibold">お気に入りコーデ一覧</h2>
            <button
              onClick={fetchFavoriteOutfits}
              className="rounded-lg border px-4 py-2 text-sm"
              type="button"
            >
              再読み込み
            </button>
          </div>

          {loadingFavorites ? (
            <p className="text-sm text-gray-500">読み込み中...</p>
          ) : favoriteOutfits.length === 0 ? (
            <div className="rounded-2xl border border-dashed p-6 text-sm text-gray-500">
              まだお気に入りコーデは保存されていません
            </div>
          ) : (
            <div className="grid gap-4">
              {favoriteOutfits.map((outfit) => {
                const topItem = getItemById(outfit.topItemId);
                const bottomItem = getItemById(outfit.bottomItemId);
                const onepieceItem = getItemById(outfit.onepieceItemId);
                const outerItem = getItemById(outfit.outerItemId);
                const shoesItem = getItemById(outfit.shoesItemId);
                const bagItem = getItemById(outfit.bagItemId);

                return (
                  <div
                    key={outfit.id}
                    className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
                  >
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-semibold">お気に入りコーデ</h3>
                        <p className="text-sm text-gray-500">
                          保存日: {new Date(outfit.createdAt).toLocaleString("ja-JP")}
                        </p>
                      </div>
                      <div className="rounded-full bg-pink-50 px-3 py-1 text-sm text-pink-700">
                        {outfit.score}点
                      </div>
                    </div>

                    <p className="text-sm text-gray-500">
                      気温: {outfit.temperatureLabel ?? "未設定"}
                    </p>

                    <p className="text-sm text-gray-500">
                      TPO: {outfit.occasion ?? "未設定"}
                    </p>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                      <SavedItemCard label="トップス" item={topItem} />
                      <SavedItemCard label="ボトムス" item={bottomItem} />
                      <SavedItemCard label="ワンピース" item={onepieceItem} />
                      <SavedItemCard label="アウター" item={outerItem} />
                      <SavedItemCard label="シューズ" item={shoesItem} />
                      <SavedItemCard label="バッグ" item={bagItem} />
                    </div>

                    {outfit.comment && (
                      <div className="mt-4 rounded-xl bg-gray-50 p-4">
                        <p className="text-sm leading-7 text-gray-700">{outfit.comment}</p>
                      </div>
                    )}

                    <div className="mt-4 flex justify-end">
                      <button
                        type="button"
                        onClick={() => handleDeleteFavoriteOutfit(outfit.id)}
                        className="rounded-lg border border-red-300 px-4 py-2 text-sm text-red-600"
                      >
                        削除
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function calculateFormalityFromStyleTags(styleTags: string[]) {
  if (!styleTags.length) return 3;

  const scoreMap: Record<string, number> = {
    street: 1,
    casual: 2,
    girly: 2.5,
    feminine: 3,
    minimal: 3,
    mode: 3.5,
    office: 4.5,
  };

  const scores = styleTags
    .map((tag) => scoreMap[tag])
    .filter((score): score is number => typeof score === "number");

  if (!scores.length) return 3;

  const average =
    scores.reduce((sum, score) => sum + score, 0) / scores.length;

  return Math.round(average * 10) / 10;
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
    default:
      return category;
  }
}

function getColorLabel(value?: string | null) {
  return colorOptions.find((option) => option.value === value)?.label ?? value ?? "";
}

function getSeasonLabel(value?: string | null) {
  return seasonOptions.find((option) => option.value === value)?.label ?? value ?? "";
}

function getStyleTagLabel(value?: string | null) {
  return styleTagOptions.find((option) => option.value === value)?.label ?? value ?? "";
}

function getOccasionLabel(value?: string | null) {
  return occasionOptions.find((option) => option.value === value)?.label ?? value ?? "";
}

function getSubCategoryLabel(category: string, value?: string | null) {
  if (!value) return "";
  const options = subCategoryOptionsMap[category] ?? [];
  return options.find((option) => option.value === value)?.label ?? value;
}

function buildStylistComment(outfit: Outfit) {
  const comments: string[] = [];

  if (outfit.breakdown.color >= 10) {
    comments.push(
      "色合わせはまとまりがあって、全体がちぐはぐに見えにくい組み合わせです。"
    );
  } else if (outfit.breakdown.color >= 7) {
    comments.push(
      "色合わせは大きく外してはいないので、取り入れやすいバランスです。"
    );
  } else {
    comments.push(
      "色のまとまりが少し弱いので、どこか1色を軸にするとより整って見えそうです。"
    );
  }

  if (outfit.breakdown.style >= 10) {
    comments.push(
      "スタイルの方向性も比較的揃っていて、コーデとして意図が伝わりやすいです。"
    );
  } else {
    comments.push(
      "スタイル感は少し弱めなので、バッグや羽織りで系統を補うとより完成度が上がりそうです。"
    );
  }

  if (outfit.breakdown.temperature >= 10) {
    comments.push(
      "気温面では大きく外しておらず、普段使いしやすい提案になっています。"
    );
  } else {
    comments.push(
      "気温との相性は悪くないですが、体感に合わせてインナーや羽織りで微調整すると安心です。"
    );
  }

  if (outfit.score >= 75) {
    comments.push("全体としてかなり取り入れやすく、失敗しにくいコーデです。");
  } else if (outfit.score >= 60) {
    comments.push(
      "無難にまとまっているので、まず試しやすいコーデとしておすすめです。"
    );
  } else {
    comments.push(
      "ベースは成立しているので、もう少し小物やシルエットで調整すると良くなりそうです。"
    );
  }

  return comments.join(" ");
}

function SavedItemCard({
  label,
  item,
}: {
  label: string;
  item: Item | null;
}) {
  if (!item) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 p-4 text-sm text-gray-400">
        <p className="font-semibold text-gray-500">{label}</p>
        <p className="mt-2">なし</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 p-4">
      <p className="text-sm text-gray-500">{label}</p>

      {item.imageUrl ? (
        <img
          src={item.imageUrl}
          alt={item.name ?? "item"}
          className="mt-2 h-32 w-full rounded-lg object-cover"
        />
      ) : (
        <div className="mt-2 flex h-32 w-full items-center justify-center rounded-lg bg-gray-100 text-sm text-gray-400">
          画像なし
        </div>
      )}

      <h5 className="mt-3 font-semibold">{item.name ?? "名称なし"}</h5>
      <p className="text-sm text-gray-600">{getCategoryLabel(item.category)}</p>
    </div>
  );
}

function ItemCard({
  label,
  item,
}: {
  label: string;
  item?: OutfitItem;
}) {
  if (!item) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 p-4 text-sm text-gray-400">
        <p className="font-semibold text-gray-500">{label}</p>
        <p className="mt-2">なし</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 p-4">
      <p className="text-sm text-gray-500">{label}</p>

      {item.imageUrl ? (
        <img
          src={item.imageUrl}
          alt={item.name ?? "item"}
          className="mt-2 h-40 w-full rounded-lg object-cover"
        />
      ) : (
        <div className="mt-2 flex h-40 w-full items-center justify-center rounded-lg bg-gray-100 text-sm text-gray-400">
          画像なし
        </div>
      )}

      <h5 className="mt-3 font-semibold">{item.name ?? "名称未設定"}</h5>
      <p className="text-sm text-gray-600">カテゴリ: {getCategoryLabel(item.category)}</p>

      {item.subcategory && (
        <p className="text-sm text-gray-600">
          サブカテゴリ: {getSubCategoryLabel(item.category, item.subcategory)}
        </p>
      )}

      {item.colors?.length > 0 && (
        <p className="mt-1 text-sm text-gray-600">色: {item.colors.map(getColorLabel).join(", ")}</p>
      )}

      {item.styles?.length > 0 && (
        <p className="mt-1 text-sm text-gray-600">
          スタイル: {item.styles.map(getStyleTagLabel).join(", ")}
        </p>
      )}

      {item.seasons?.length > 0 && (
        <p className="mt-1 text-sm text-gray-600">
          季節: {item.seasons.map(getSeasonLabel).join(", ")}
        </p>
      )}

      <p className="mt-1 text-sm text-gray-600">フォーマル度: {item.formality}</p>
    </div>
  );
}

function ScoreBadge({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-lg bg-gray-100 px-3 py-2">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="font-semibold">{value}点</p>
    </div>
  );
}
