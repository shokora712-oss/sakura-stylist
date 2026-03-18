"use client";

import Link from "next/link";
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

type Option = {
  value: string;
  label: string;
};

type Screen = "categories" | "items";

const categoryTiles: Option[] = [
  { value: "tops", label: "トップス" },
  { value: "bottoms", label: "ボトムス" },
  { value: "outer", label: "アウター" },
  { value: "shoes", label: "シューズ" },
  { value: "onepiece", label: "ワンピース" },
  { value: "bag", label: "バッグ" },
  { value: "accessory", label: "アクセサリー" },
  { value: "other", label: "小物" },
];

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
    { value: "office_shirt", label: "オフィスシャツ" },
  ],
  bottoms: [
    { value: "denim", label: "デニム" },
    { value: "slacks", label: "スラックス" },
    { value: "skirt", label: "スカート" },
    { value: "shorts", label: "ショートパンツ" },
    { value: "wide_pants", label: "ワイドパンツ" },
    { value: "flare_pants", label: "フレアパンツ" },
    { value: "sweatpants", label: "スウェットパンツ" },
    { value: "office_pants", label: "オフィスパンツ" },
    { value: "office_skirt", label: "オフィススカート" },
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
    { value: "office_jacket", label: "オフィスジャケット" },
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

function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-1/2 z-[9999] w-full max-w-md -translate-x-1/2 border-t border-gray-200 bg-white px-8 py-3 shadow-[0_-4px_16px_rgba(0,0,0,0.08)]">
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

function getCategoryLabel(category: string) {
  return categoryTiles.find((item) => item.value === category)?.label ?? category;
}

function getColorLabel(color: string) {
  return colorOptions.find((item) => item.value === color)?.label ?? color;
}

function calculateFormalityFromStyleTags(styleTags: string[]) {
  if (styleTags.includes("office")) return 4;
  if (styleTags.includes("mode")) return 4;
  if (styleTags.includes("feminine")) return 3;
  if (styleTags.includes("minimal")) return 3;
  if (styleTags.includes("girly")) return 2;
  if (styleTags.includes("street")) return 2;
  return 2;
}

function normalizeCategory(category: string) {
  if (category === "bags") return "bag";
  return category;
}

export default function ClosetPage() {
  const [screen, setScreen] = useState<Screen>("categories");
  const [items, setItems] = useState<Item[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [message, setMessage] = useState("");

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [category, setCategory] = useState("tops");
  const [subCategory, setSubCategory] = useState("");
  const [color, setColor] = useState("");
  const [brand, setBrand] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [seasons, setSeasons] = useState<string[]>([]);
  const [styleTags, setStyleTags] = useState<string[]>([]);

  const currentSubCategoryOptions = useMemo(() => {
    return subCategoryOptionsMap[category] ?? [];
  }, [category]);

  const filteredItems = useMemo(() => {
    if (!selectedCategory) return [];
    return items.filter((item) => normalizeCategory(item.category) === selectedCategory);
  }, [items, selectedCategory]);

  useEffect(() => {
    fetchItems();
  }, []);

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
        throw new Error("アイテム一覧の取得に失敗しました");
      }

      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error(error);
      setMessage("アイテム一覧の取得に失敗しました");
    } finally {
      setLoadingItems(false);
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

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.error || "削除に失敗しました");
      }

      if (editingItemId === id) {
        resetForm();
      }

      setMessage("アイテムを削除しました");
      await fetchItems();
    } catch (error) {
      console.error(error);
      setMessage(error instanceof Error ? error.message : "削除に失敗しました");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!editingItemId) {
      setMessage("編集対象がありません");
      return;
    }

    try {
      setMessage("更新中...");

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

      const res = await fetch(`/api/items/${editingItemId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.error || "更新に失敗しました");
      }

      setMessage(`更新成功: ${data.name ?? "名称なし"}`);
      resetForm();
      await fetchItems();
    } catch (error) {
      console.error(error);
      setMessage(error instanceof Error ? error.message : "更新に失敗しました");
    }
  };

  return (
    <main className="min-h-screen bg-[#fafafa] px-5 py-8 pb-32">
      <div className="mx-auto max-w-md">
        {screen === "categories" && (
          <>
            <h1 className="mb-6 text-2xl font-bold">クローゼット</h1>

            <div className="grid grid-cols-2 gap-4">
              {categoryTiles.map((categoryTile) => (
                <button
                  key={categoryTile.value}
                  type="button"
                  onClick={() => {
                    setSelectedCategory(categoryTile.value);
                    setScreen("items");
                    resetForm();
                    setMessage("");
                  }}
                  className="flex min-h-[120px] items-center justify-center rounded-3xl border border-gray-200 bg-white p-4 text-center font-semibold shadow-sm"
                >
                  {categoryTile.label}
                </button>
              ))}

              <Link
                href="/closet/new"
                className="col-span-2 flex min-h-[88px] items-center justify-center rounded-3xl border border-gray-200 bg-white p-4 text-center font-semibold shadow-sm"
              >
                アイテムを登録
              </Link>
            </div>
          </>
        )}

        {screen === "items" && (
          <>
            <div className="mb-4 flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setScreen("categories");
                  setSelectedCategory(null);
                  resetForm();
                  setMessage("");
                }}
                className="rounded-full border border-gray-300 bg-white px-3 py-1 text-sm"
              >
                戻る
              </button>

              <div>
                <h1 className="text-2xl font-bold">
                  {getCategoryLabel(selectedCategory ?? "")}
                </h1>
                <p className="text-sm text-gray-500">アイテム一覧 / 編集 / 削除</p>
              </div>
            </div>

            {editingItemId && (
              <section className="mb-6 rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold">アイテムを編集</h2>
                    <p className="text-sm text-gray-500">
                      既存アイテムのカテゴリ・サブカテゴリを修正できる
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={resetForm}
                    className="rounded-xl border px-3 py-2 text-sm"
                  >
                    キャンセル
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium">アイテム名</label>
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full rounded-xl border px-3 py-2"
                      placeholder="白シャツ"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium">カテゴリ</label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full rounded-xl border px-3 py-2"
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
                      className="w-full rounded-xl border px-3 py-2"
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
                      className="w-full rounded-xl border px-3 py-2"
                      placeholder="UNIQLO"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium">画像URL</label>
                    <input
                      value={imageUrl}
                      onChange={(e) => setImageUrl(e.target.value)}
                      className="w-full rounded-xl border px-3 py-2"
                      placeholder="https://..."
                    />
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
                    className="w-full rounded-xl bg-black px-4 py-3 text-sm text-white"
                  >
                    更新する
                  </button>
                </form>
              </section>
            )}

            {message && (
              <div className="mb-4 rounded-2xl bg-gray-100 px-4 py-3 text-sm text-gray-700">
                {message}
              </div>
            )}

            {loadingItems ? (
              <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
                読み込み中...
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="space-y-4">
                <div className="rounded-3xl border border-gray-200 bg-white p-6 text-center shadow-sm">
                  このカテゴリのアイテムはまだありません
                </div>

                <Link
                  href="/closet/new"
                  className="flex min-h-[88px] items-center justify-center rounded-3xl border border-gray-200 bg-white p-4 text-center font-semibold shadow-sm"
                >
                  アイテムを登録
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                {filteredItems.map((item) => (
                  <div
                    key={item.id}
                    className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm"
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

                    <div className="space-y-3 p-4">
                      <div>
                        <p className="font-bold">{item.name ?? "名称未設定"}</p>
                        <p className="mt-1 text-sm text-gray-500">
                          {item.subCategory ?? "サブカテゴリ未設定"}
                        </p>
                      </div>

                      <div className="space-y-1 text-xs text-gray-600">
                        <p>
                          色:{" "}
                          {item.color?.length
                            ? item.color.map(getColorLabel).join(" / ")
                            : "未設定"}
                        </p>
                        <p>ブランド: {item.brand ?? "未設定"}</p>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => handleEdit(item)}
                          className="rounded-xl border px-3 py-2 text-sm"
                        >
                          編集
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDelete(item.id)}
                          className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
                        >
                          削除
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <BottomNav />
    </main>
  );
}