"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import BottomNav from "@/app/components/BottomNav";

type Item = {
  id: string;
  name: string | null;
  category: string;
  subCategory: string | null;
  color: string[];
  material: string[];
  season: string[];
  styleTags: string[];
  inspirationTags: string[];
  formality: number;
  brand: string | null;
  imageUrl: string | null;
  createdAt?: string;
  updatedAt?: string;
};

type Option = { value: string; label: string };

const CATEGORY_OPTIONS: Option[] = [
  { value: "all", label: "すべて" },
  { value: "tops", label: "トップス" },
  { value: "bottoms", label: "ボトムス" },
  { value: "outer", label: "アウター" },
  { value: "onepiece", label: "ワンピース" },
  { value: "shoes", label: "シューズ" },
  { value: "bag", label: "バッグ" },
];

const COLOR_OPTIONS: Option[] = [
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

const SEASON_OPTIONS: Option[] = [
  { value: "spring", label: "春" },
  { value: "summer", label: "夏" },
  { value: "autumn", label: "秋" },
  { value: "winter", label: "冬" },
];

const STYLE_TAG_OPTIONS: Option[] = [
  { value: "casual", label: "カジュアル" },
  { value: "clean", label: "きれいめ" },
  { value: "feminine", label: "フェミニン" },
  { value: "girly", label: "ガーリー" },
  { value: "simple", label: "シンプル" },
  { value: "natural", label: "ナチュラル" },
  { value: "elegant", label: "エレガント" },
  { value: "mode", label: "モード" },
  { value: "street", label: "ストリート" },
  { value: "sporty", label: "スポーティ" },
];

const INSPIRATION_OPTIONS: Option[] = [
  { value: "korean", label: "韓国系" },
  { value: "french", label: "フレンチ" },
  { value: "overseas_girl", label: "海外ガール" },
  { value: "city_girl", label: "シティガール" },
  { value: "japanese_feminine", label: "日本フェミニン" },
  { value: "balletcore", label: "バレエコア" },
  { value: "old_money", label: "オールドマネー" },
  { value: "y2k", label: "Y2K" },
];

const SUBCATEGORY_MAP: Record<string, Option[]> = {
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

function getLabel(options: Option[], value: string) {
  return options.find((o) => o.value === value)?.label ?? value;
}

function getSubCategoryLabel(category: string, subCategory: string) {
  return getLabel(SUBCATEGORY_MAP[category] ?? [], subCategory);
}

function normalizeCategory(category: string) {
  if (category === "bags") return "bag";
  return category;
}

function calculateFormality(styleTags: string[]) {
  if (styleTags.includes("office") || styleTags.includes("elegant")) return 4;
  if (styleTags.includes("mode") || styleTags.includes("clean")) return 3;
  if (styleTags.includes("feminine") || styleTags.includes("simple")) return 3;
  return 2;
}

export default function ClosetPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(""), 4000);
    return () => clearTimeout(timer);
  }, [message]);

  // 編集フォーム
  const [name, setName] = useState("");
  const [category, setCategory] = useState("tops");
  const [subCategory, setSubCategory] = useState("");
  const [color, setColor] = useState("");
  const [brand, setBrand] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [seasons, setSeasons] = useState<string[]>([]);
  const [styleTags, setStyleTags] = useState<string[]>([]);
  const [inspirationTags, setInspirationTags] = useState<string[]>([]);

  const subCategoryOptions = useMemo(() => SUBCATEGORY_MAP[category] ?? [], [category]);

  const filteredItems = useMemo(() => {
    if (selectedCategory === "all") return items;
    return items.filter((item) => normalizeCategory(item.category) === selectedCategory);
  }, [items, selectedCategory]);

  useEffect(() => { fetchItems(); }, []);

  async function fetchItems() {
    setIsLoading(true);
    try {
      const res = await fetch("/api/items");
      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
    } catch {
      setMessage("アイテム一覧の取得に失敗しました");
    } finally {
      setIsLoading(false);
    }
  }

  function openEdit(item: Item) {
    setEditingItem(item);
    setName(item.name ?? "");
    setCategory(item.category);
    setSubCategory(item.subCategory ?? "");
    setColor(item.color?.[0] ?? "");
    setBrand(item.brand ?? "");
    setImageUrl(item.imageUrl ?? "");
    setSeasons(item.season ?? []);
    setStyleTags(item.styleTags ?? []);
    setInspirationTags(item.inspirationTags ?? []);
  }

  function closeEdit() {
    setEditingItem(null);
    setMessage("");
  }

  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`/api/items/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("削除に失敗しました");
      setMessage("削除しました");
      setDeletingId(null);
      await fetchItems();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "削除に失敗しました");
      setDeletingId(null);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingItem) return;

    try {
      setMessage("更新中...");
      const res = await fetch(`/api/items/${editingItem.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          category,
          subCategory: subCategory || null,
          color: color ? [color] : [],
          material: [],
          season: seasons,
          styleTags,
          inspirationTags,
          formality: calculateFormality(styleTags),
          brand: brand || null,
          imageUrl: imageUrl || null,
        }),
      });
      if (!res.ok) throw new Error("更新に失敗しました");
      setMessage("更新しました");
      closeEdit();
      await fetchItems();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "更新に失敗しました");
    }
  }

  return (
    <main className="min-h-screen bg-[#fdf2f6] pb-32 text-[#605D62]">
      <div className="mx-auto max-w-md px-4 py-6">

        {/* ヘッダー */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-xs text-neutral-400">Closet AI</p>
            <h1 className="text-2xl font-bold">マイクローゼット</h1>
            <p className="text-sm text-neutral-500">{items.length}件のアイテム</p>
          </div>
          <Link
            href="/closet/new"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-[#605D62] text-white shadow"
          >
            <span className="text-xl leading-none">＋</span>
          </Link>
        </div>

        {/* カテゴリタブ */}
        <div className="mb-5 flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {CATEGORY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setSelectedCategory(opt.value)}
              className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition ${
                selectedCategory === opt.value
                  ? "bg-[#605D62] text-white"
                  : "bg-white text-[#605D62] ring-1 ring-neutral-200 hover:bg-[#E3F2FD]"
              }`}
            >
              {opt.label}
              {opt.value !== "all" && (
                <span className="ml-1 text-xs opacity-60">
                  {items.filter((i) => normalizeCategory(i.category) === opt.value).length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* メッセージ */}
        {message && (
          <div className="mb-4 rounded-2xl bg-neutral-100 px-4 py-3 text-sm text-neutral-700">
            {message}
          </div>
        )}

        {/* アイテムグリッド */}
        {isLoading ? (
          <div className="py-20 text-center text-sm text-neutral-400">読み込み中...</div>
        ) : filteredItems.length === 0 ? (
          <div className="flex flex-col items-center gap-4 py-20 text-center">
            <p className="text-sm text-neutral-400">アイテムがまだありません</p>
            <Link
              href="/closet/new"
              className="rounded-2xl bg-neutral-900 px-6 py-2.5 text-sm font-semibold text-white"
            >
              アイテムを登録
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {filteredItems.map((item) => (
              <div
                key={item.id}
                className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-[#E3F2FD]" 
              >
                {/* 画像 */}
                <div className="relative h-44 bg-neutral-100">
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt={item.name ?? "item"}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-neutral-400">
                      画像なし
                    </div>
                  )}
                  {/* カテゴリラベル */}
                  {item.subCategory && (
                    <div className="absolute bottom-2 left-2 rounded-full bg-[#FCE4EC]/90 px-2 py-0.5 text-xs font-medium text-[#605D62] shadow-sm">
                      {getSubCategoryLabel(item.category, item.subCategory)}
                    </div>
                  )}
                </div>

                {/* 情報 */}
                <div className="p-3">
                  <p className="mb-1 truncate text-sm font-semibold">
                    {item.name ?? "名称未設定"}
                  </p>

                  {/* スタイルタグ */}
                  {item.styleTags?.length > 0 && (
                    <div className="mb-2 flex flex-wrap gap-1">
                      {item.styleTags.slice(0, 2).map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full bg-[#E3F2FD] px-2 py-0.5 text-xs text-[#605D62]"
                        >
                          {getLabel(STYLE_TAG_OPTIONS, tag)}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* 色 */}
                  {item.color?.length > 0 && (
                    <p className="mb-2 text-xs text-neutral-400">
                      {item.color.map((c) => getLabel(COLOR_OPTIONS, c)).join(" / ")}
                    </p>
                  )}

                  {/* ボタン */}
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => openEdit(item)}
                      className="flex-1 rounded-xl border border-neutral-200 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
                    >
                      編集
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeletingId(item.id)}
                      className="flex-1 rounded-xl border border-red-100 bg-red-50 py-1.5 text-xs font-medium text-red-600"
                    >
                      削除
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 編集モーダル */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 px-0">
          <div className="w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-5 pb-10 shadow-xl"
            style={{ maxHeight: "90vh" }}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">アイテムを編集</h2>
              <button type="button" onClick={closeEdit} className="rounded-full p-1 text-neutral-400 hover:text-neutral-700">
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium">アイテム名</label>
                <input value={name} onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm" placeholder="白シャツ" />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">カテゴリ</label>
                <select value={category} onChange={(e) => { setCategory(e.target.value); setSubCategory(""); }}
                  className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm">
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
                <select value={subCategory} onChange={(e) => setSubCategory(e.target.value)}
                  className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm">
                  <option value="">未設定</option>
                  {subCategoryOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">色</label>
                <div className="flex flex-wrap gap-2">
                  {COLOR_OPTIONS.map((opt) => (
                    <button key={opt.value} type="button" onClick={() => setColor(opt.value)}
                      className={`rounded-full border px-3 py-1 text-xs ${
                        color === opt.value ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-200 text-neutral-700"
                      }`}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">ブランド</label>
                <input value={brand} onChange={(e) => setBrand(e.target.value)}
                  className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm" placeholder="UNIQLO" />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">季節</label>
                <div className="flex flex-wrap gap-2">
                  {SEASON_OPTIONS.map((opt) => (
                    <button key={opt.value} type="button"
                      onClick={() => setSeasons((prev) => prev.includes(opt.value) ? prev.filter((s) => s !== opt.value) : [...prev, opt.value])}
                      className={`rounded-full border px-3 py-1 text-xs ${
                        seasons.includes(opt.value) ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-200 text-neutral-700"
                      }`}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">スタイルタグ</label>
                <div className="flex flex-wrap gap-2">
                  {STYLE_TAG_OPTIONS.map((opt) => (
                    <button key={opt.value} type="button"
                      onClick={() => setStyleTags((prev) => prev.includes(opt.value) ? prev.filter((s) => s !== opt.value) : [...prev, opt.value])}
                      className={`rounded-full border px-3 py-1 text-xs ${
                        styleTags.includes(opt.value) ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-200 text-neutral-700"
                      }`}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">インスピレーション</label>
                <div className="flex flex-wrap gap-2">
                  {INSPIRATION_OPTIONS.map((opt) => (
                    <button key={opt.value} type="button"
                      onClick={() => setInspirationTags((prev) => prev.includes(opt.value) ? prev.filter((s) => s !== opt.value) : [...prev, opt.value])}
                      className={`rounded-full border px-3 py-1 text-xs ${
                        inspirationTags.includes(opt.value) ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-200 text-neutral-700"
                      }`}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {message && (
                <p className={`text-sm ${message.includes("失敗") ? "text-red-600" : "text-emerald-600"}`}>
                  {message}
                </p>
              )}

              <button type="submit"
                className="w-full rounded-2xl bg-[#605D62] py-3 text-sm font-semibold text-white">
                更新する
              </button>
            </form>
          </div>
        </div>
      )}

      {deletingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-xl">
            <p className="mb-2 text-center font-semibold text-[#605D62]">アイテムを削除しますか？</p>
            <p className="mb-6 text-center text-sm text-[#605D62]/60">この操作は取り消せません</p>
            <div className="flex gap-3">
              <button type="button" onClick={() => setDeletingId(null)}
                className="flex-1 rounded-2xl border border-[#FCE4EC] py-3 text-sm font-medium text-[#605D62]">
                キャンセル
              </button>
              <button type="button" onClick={() => handleDelete(deletingId)}
                className="flex-1 rounded-2xl bg-red-500 py-3 text-sm font-semibold text-white">
                削除する
              </button>
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </main>
  );
}