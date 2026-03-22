"use client";

import { useRef, useState } from "react";
import BottomNav from "../components/BottomNav";

const ACTIONS = [
  {
    id: "evaluate",
    label: "コーデ評価",
    emoji: "⭐",
    description: "AIがコーデをスコアリング",
  },
  {
    id: "item",
    label: "アイテム登録",
    emoji: "👗",
    description: "クローゼットに追加",
  },
  {
    id: "log",
    label: "コーデログ",
    emoji: "📋",
    description: "今日のコーデを記録",
  },
  {
    id: "style-goal",
    label: "なりたい系統",
    emoji: "✨",
    description: "画像からスタイル判定",
  },
];

type ActionId = "evaluate" | "item" | "log" | "style-goal";

type EvaluateResult = {
  totalScore: number;
  summary: string;
  goodPoints: string[];
  improvementPoints: string[];
};

type ItemCandidate = {
  name: string;
  category: string;
  subCategory?: string;
  color?: string[];
  styleTags?: string[];
  season?: string[];
};

type StyleGoalResult = {
  baseStyle: string;
  inspiration: string | null;
  comment: string;
};

type Results = {
  evaluate?: EvaluateResult | null;
  item?: ItemCandidate[] | null;
  log?: "saved" | "error" | null;
  "style-goal"?: StyleGoalResult | null;
};

const STYLE_LABELS: Record<string, string> = {
  casual: "カジュアル", clean: "きれいめ", feminine: "フェミニン",
  girly: "ガーリー", simple: "シンプル", natural: "ナチュラル",
  elegant: "エレガント", mode: "モード", street: "ストリート", sporty: "スポーティ",
};

const OCCASION_OPTIONS = [
  { value: "casual", label: "お出かけ" },
  { value: "date", label: "デート" },
  { value: "office", label: "仕事" },
  { value: "formal", label: "フォーマル" },
  { value: "travel", label: "旅行" },
  { value: "school", label: "学校" },
];

const SEASON_OPTIONS = [
  { value: "spring", label: "春" },
  { value: "summer", label: "夏" },
  { value: "autumn", label: "秋" },
  { value: "winter", label: "冬" },
];

export default function UploadHubPage() {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [selectedActions, setSelectedActions] = useState<Set<ActionId>>(new Set());
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<Results>({});
  const [openAccordions, setOpenAccordions] = useState<Set<ActionId>>(new Set());
  const [message, setMessage] = useState<string | null>(null);

  // コーデ評価用
  const [occasion, setOccasion] = useState("casual");
  const [season, setSeason] = useState("spring");
  const [style, setStyle] = useState("casual");

  // アイテム登録用
  const [savingItemIndex, setSavingItemIndex] = useState<number | null>(null);
  const [savedItems, setSavedItems] = useState<Set<number>>(new Set());

  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
    setResults({});
    setOpenAccordions(new Set());
    setMessage(null);
  }

  function toggleAction(id: ActionId) {
    setSelectedActions((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAccordion(id: ActionId) {
    setOpenAccordions((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function toDataUrl(f: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(f);
    });
  }

  async function handleRun() {
    if (!file || selectedActions.size === 0) return;
    setIsRunning(true);
    setResults({});
    setOpenAccordions(new Set(selectedActions));
    setMessage(null);

    const imageDataUrl = await toDataUrl(file);
    const newResults: Results = {};

    await Promise.all(
      Array.from(selectedActions).map(async (action) => {
        try {
          if (action === "evaluate") {
            const formData = new FormData();
            formData.append("image", file);
            formData.append("occasion", occasion);
            formData.append("season", season);
            formData.append("style", style);
            const res = await fetch("/api/evaluate", { method: "POST", body: formData });
            const data = await res.json();
            newResults.evaluate = res.ok ? data : null;
          }

          if (action === "item") {
            const res = await fetch("/api/items/analyze", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ imageDataUrl, mode: "image" }),
            });
            const data = await res.json();
            newResults.item = res.ok ? (data.candidates ?? data.items ?? []) : null;
          }

          if (action === "log") {
            const uploadRes = await fetch("/api/upload", {
              method: "POST",
              body: (() => { const fd = new FormData(); fd.append("file", file); return fd; })(),
            });
            const uploadData = await uploadRes.json();
            const imageUrl = uploadData?.imageUrl ?? null;

            const res = await fetch("/api/outfits", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                imageUrl,
                isFavorite: false,
                occasion: null,
                temperatureLabel: null,
                score: null,
                comment: null,
              }),
            });
            newResults.log = res.ok ? "saved" : "error";
          }

          if (action === "style-goal") {
            const res = await fetch("/api/style-goals/analyze", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ imageDataUrl }),
            });
            const data = await res.json();
            if (res.ok && data.baseStyle) {
              newResults["style-goal"] = data;
              // 自動保存
              await fetch("/api/style-goals", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  targetStyle: data.baseStyle,
                  priority: "medium",
                  note: data.inspiration ? `inspiration: ${data.inspiration}` : null,
                  isActive: true,
                }),
              });
            } else {
              newResults["style-goal"] = null;
            }
          }
        } catch {
          if (action === "log") newResults.log = "error";
        }
      })
    );

    setResults(newResults);
    setIsRunning(false);
  }

  async function handleSaveItem(candidate: ItemCandidate, index: number) {
    setSavingItemIndex(index);
    try {
      const uploadRes = await fetch("/api/upload", {
        method: "POST",
        body: (() => { const fd = new FormData(); fd.append("file", file!); return fd; })(),
      });
      const uploadData = await uploadRes.json();
      const imageUrl = uploadData?.imageUrl ?? null;

      const res = await fetch("/api/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...candidate, imageUrl }),
      });
      if (res.ok) setSavedItems((prev) => new Set([...prev, index]));
    } catch {
      setMessage("保存に失敗しました");
    } finally {
      setSavingItemIndex(null);
    }
  }

  const canRun = file && selectedActions.size > 0 && !isRunning;
  const hasResults = Object.keys(results).length > 0;

  return (
    <main className="min-h-screen bg-[#fdf2f6] pb-32 text-[#605D62]">
      <div className="mx-auto max-w-md px-4 py-6">
        <div className="mb-6">
          <p className="text-xs text-[#605D62]/60">Closet AI</p>
          <h1 className="text-2xl font-bold">画像をアップロード</h1>
          <p className="mt-1 text-sm text-[#605D62]/60">1枚の画像で複数の操作を一括実行</p>
        </div>

        {/* 画像アップロード */}
        <div
          onClick={() => fileInputRef.current?.click()}
          className="mb-5 cursor-pointer overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-[#FCE4EC] transition hover:shadow-md"
        >
          {previewUrl ? (
            <div className="relative">
              <img src={previewUrl} alt="preview" className="h-56 w-full object-cover" />
              <div className="absolute bottom-3 right-3 rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-[#605D62]">
                タップして変更
              </div>
            </div>
          ) : (
            <div className="flex h-48 flex-col items-center justify-center gap-2">
              <span className="text-4xl">📷</span>
              <p className="text-sm font-medium text-[#605D62]">タップして画像を選択</p>
              <p className="text-xs text-[#605D62]/50">JPG・PNG・最大5MB</p>
            </div>
          )}
        </div>
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />

        {/* やりたいことを選ぶ */}
        {file && (
          <div className="mb-5 space-y-3">
            <p className="text-sm font-semibold">やりたいことを選ぶ（複数可）</p>
            {ACTIONS.map((action) => {
              const selected = selectedActions.has(action.id as ActionId);
              return (
                <button key={action.id} type="button"
                  onClick={() => toggleAction(action.id as ActionId)}
                  className={`flex w-full items-center gap-4 rounded-2xl p-4 text-left transition ${
                    selected
                      ? "bg-[#605D62] text-white shadow-md"
                      : "bg-white text-[#605D62] ring-1 ring-[#FCE4EC]"
                  }`}>
                  <span className="text-2xl">{action.emoji}</span>
                  <div>
                    <p className="font-semibold">{action.label}</p>
                    <p className={`text-xs ${selected ? "text-white/70" : "text-[#605D62]/60"}`}>
                      {action.description}
                    </p>
                  </div>
                  <div className={`ml-auto flex h-6 w-6 items-center justify-center rounded-full border-2 ${
                    selected ? "border-white bg-white" : "border-[#FCE4EC]"
                  }`}>
                    {selected && <span className="text-xs font-bold text-[#605D62]">✓</span>}
                  </div>
                </button>
              );
            })}

            {/* コーデ評価の条件 */}
            {selectedActions.has("evaluate") && (
              <div className="rounded-2xl bg-white p-4 ring-1 ring-[#FCE4EC]">
                <p className="mb-3 text-xs font-semibold text-[#605D62]/60">コーデ評価の条件</p>
                <div className="space-y-3">
                  <div>
                    <p className="mb-1.5 text-xs font-medium">シチュエーション</p>
                    <div className="flex flex-wrap gap-2">
                      {OCCASION_OPTIONS.map((opt) => (
                        <button key={opt.value} type="button" onClick={() => setOccasion(opt.value)}
                          className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                            occasion === opt.value ? "bg-[#605D62] text-white" : "bg-[#fdf2f6] text-[#605D62]"
                          }`}>
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="mb-1.5 text-xs font-medium">季節</p>
                    <div className="flex flex-wrap gap-2">
                      {SEASON_OPTIONS.map((opt) => (
                        <button key={opt.value} type="button" onClick={() => setSeason(opt.value)}
                          className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                            season === opt.value ? "bg-[#605D62] text-white" : "bg-[#fdf2f6] text-[#605D62]"
                          }`}>
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 実行ボタン */}
            <button type="button" onClick={handleRun} disabled={!canRun}
              className="w-full rounded-2xl bg-gradient-to-r from-[#FCE4EC] to-[#E3F2FD] py-4 text-sm font-bold text-[#605D62] shadow-sm transition disabled:opacity-40">
              {isRunning ? "実行中..." : `${selectedActions.size}つの操作を実行する`}
            </button>
          </div>
        )}

        {/* 結果 */}
        {hasResults && (
          <div className="space-y-3">
            <p className="text-sm font-semibold">結果</p>

            {/* コーデ評価 */}
            {results.evaluate !== undefined && (
              <div className="rounded-2xl bg-white ring-1 ring-[#FCE4EC]">
                <button type="button" onClick={() => toggleAccordion("evaluate")}
                  className="flex w-full items-center justify-between p-4">
                  <div className="flex items-center gap-2">
                    <span>⭐</span>
                    <span className="font-semibold">コーデ評価</span>
                    {results.evaluate && (
                      <span className="rounded-full bg-[#FCE4EC] px-2 py-0.5 text-xs font-bold text-[#605D62]">
                        {results.evaluate.totalScore}点
                      </span>
                    )}
                  </div>
                  <span className="text-sm text-[#605D62]/40">
                    {openAccordions.has("evaluate") ? "▲" : "▼"}
                  </span>
                </button>
                {openAccordions.has("evaluate") && (
                  <div className="border-t border-[#FCE4EC] p-4">
                    {results.evaluate ? (
                      <div className="space-y-3">
                        <p className="text-sm leading-relaxed">{results.evaluate.summary}</p>
                        <div>
                          <p className="mb-1 text-xs font-semibold text-emerald-600">良い点</p>
                          <ul className="space-y-1">
                            {results.evaluate.goodPoints.map((p, i) => (
                              <li key={i} className="flex items-start gap-1.5 text-xs">
                                <span className="mt-0.5 text-emerald-500">✓</span>{p}
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <p className="mb-1 text-xs font-semibold text-orange-500">改善点</p>
                          <ul className="space-y-1">
                            {results.evaluate.improvementPoints.map((p, i) => (
                              <li key={i} className="flex items-start gap-1.5 text-xs">
                                <span className="mt-0.5 text-orange-400">→</span>{p}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-red-500">評価に失敗しました</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* アイテム登録 */}
            {results.item !== undefined && (
              <div className="rounded-2xl bg-white ring-1 ring-[#FCE4EC]">
                <button type="button" onClick={() => toggleAccordion("item")}
                  className="flex w-full items-center justify-between p-4">
                  <div className="flex items-center gap-2">
                    <span>👗</span>
                    <span className="font-semibold">アイテム登録</span>
                    {results.item && (
                      <span className="rounded-full bg-[#E3F2FD] px-2 py-0.5 text-xs text-[#605D62]">
                        {results.item.length}件検出
                      </span>
                    )}
                  </div>
                  <span className="text-sm text-[#605D62]/40">
                    {openAccordions.has("item") ? "▲" : "▼"}
                  </span>
                </button>
                {openAccordions.has("item") && (
                  <div className="border-t border-[#FCE4EC] p-4">
                    {results.item && results.item.length > 0 ? (
                      <div className="space-y-3">
                        {results.item.map((candidate, i) => (
                          <div key={i} className="rounded-xl bg-[#fdf2f6] p-3">
                            <div className="mb-2 flex items-center justify-between">
                              <div>
                                <p className="font-semibold">{candidate.name}</p>
                                <p className="text-xs text-[#605D62]/60">{candidate.category} / {candidate.subCategory}</p>
                              </div>
                              {savedItems.has(i) ? (
                                <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-600">保存済み</span>
                              ) : (
                                <button type="button"
                                  onClick={() => handleSaveItem(candidate, i)}
                                  disabled={savingItemIndex === i}
                                  className="rounded-full bg-[#605D62] px-3 py-1 text-xs font-medium text-white disabled:opacity-50">
                                  {savingItemIndex === i ? "保存中..." : "保存する"}
                                </button>
                              )}
                            </div>
                            {candidate.styleTags && candidate.styleTags.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {candidate.styleTags.map((tag) => (
                                  <span key={tag} className="rounded-full bg-[#E3F2FD] px-2 py-0.5 text-xs text-[#605D62]">
                                    {STYLE_LABELS[tag] ?? tag}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-red-500">アイテムの検出に失敗しました</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* コーデログ */}
            {results.log !== undefined && (
              <div className="rounded-2xl bg-white ring-1 ring-[#FCE4EC]">
                <button type="button" onClick={() => toggleAccordion("log")}
                  className="flex w-full items-center justify-between p-4">
                  <div className="flex items-center gap-2">
                    <span>📋</span>
                    <span className="font-semibold">コーデログ</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs ${
                      results.log === "saved" ? "bg-emerald-100 text-emerald-600" : "bg-red-100 text-red-500"
                    }`}>
                      {results.log === "saved" ? "保存済み" : "エラー"}
                    </span>
                  </div>
                  <span className="text-sm text-[#605D62]/40">
                    {openAccordions.has("log") ? "▲" : "▼"}
                  </span>
                </button>
                {openAccordions.has("log") && (
                  <div className="border-t border-[#FCE4EC] p-4">
                    {results.log === "saved" ? (
                      <p className="text-sm text-emerald-600">✓ コーデログに保存しました！</p>
                    ) : (
                      <p className="text-sm text-red-500">保存に失敗しました</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* なりたい系統 */}
            {results["style-goal"] !== undefined && (
              <div className="rounded-2xl bg-white ring-1 ring-[#FCE4EC]">
                <button type="button" onClick={() => toggleAccordion("style-goal")}
                  className="flex w-full items-center justify-between p-4">
                  <div className="flex items-center gap-2">
                    <span>✨</span>
                    <span className="font-semibold">なりたい系統</span>
                    {results["style-goal"] && (
                      <span className="rounded-full bg-[#FCE4EC] px-2 py-0.5 text-xs font-medium text-[#605D62]">
                        {STYLE_LABELS[results["style-goal"].baseStyle] ?? results["style-goal"].baseStyle}
                      </span>
                    )}
                  </div>
                  <span className="text-sm text-[#605D62]/40">
                    {openAccordions.has("style-goal") ? "▲" : "▼"}
                  </span>
                </button>
                {openAccordions.has("style-goal") && (
                  <div className="border-t border-[#FCE4EC] p-4">
                    {results["style-goal"] ? (
                      <div className="space-y-2">
                        <p className="text-sm">{results["style-goal"].comment}</p>
                        <p className="text-xs text-emerald-600">✓ なりたい系統に保存しました！</p>
                      </div>
                    ) : (
                      <p className="text-sm text-red-500">スタイル判定に失敗しました</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {message && (
          <p className="mt-4 text-center text-sm text-red-500">{message}</p>
        )}
      </div>

      <BottomNav />
    </main>
  );
}