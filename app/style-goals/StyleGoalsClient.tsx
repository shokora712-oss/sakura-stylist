"use client";

import { useEffect, useState } from "react";

type StyleGoal = {
  id: string;
  targetStyle: string;
  priority: string | null;
  note: string | null;
  isActive: boolean;
};

const styleOptions = [
  { value: "casual", label: "カジュアル" },
  { value: "girly", label: "ガーリー" },
  { value: "feminine", label: "フェミニン" },
  { value: "minimal", label: "ミニマル" },
  { value: "mode", label: "モード" },
  { value: "street", label: "ストリート" },
  { value: "office", label: "オフィス" },
  { value: "korean", label: "韓国っぽい" },
  { value: "adult-girly", label: "大人ガーリー" },
];

const priorityOptions = [
  { value: "low", label: "低め" },
  { value: "medium", label: "ふつう" },
  { value: "high", label: "高め" },
];

export default function StyleGoalsClient() {
  const [goals, setGoals] = useState<StyleGoal[]>([]);
  const [targetStyle, setTargetStyle] = useState("girly");
  const [priority, setPriority] = useState("medium");
  const [note, setNote] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function loadGoals() {
    try {
      const res = await fetch("/api/style-goals", { cache: "no-store" });
      const data = await res.json();
      setGoals(Array.isArray(data?.goals) ? data.goals : []);
    } catch (error) {
      console.error("Failed to load goals:", error);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadGoals();
  }, []);

  async function handleCreate() {
    setIsSaving(true);
    setMessage("");

    try {
      const res = await fetch("/api/style-goals", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          targetStyle,
          priority,
          note,
          isActive,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to create style goal");
      }

      setNote("");
      setIsActive(true);
      setMessage("なりたい系統を保存したよ");
      await loadGoals();
    } catch (error) {
      console.error(error);
      setMessage("保存に失敗しました");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSetActive(id: string) {
    try {
      const res = await fetch(`/api/style-goals/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          isActive: true,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to activate style goal");
      }

      setMessage("メインのなりたい系統を切り替えたよ");
      await loadGoals();
    } catch (error) {
      console.error(error);
      setMessage("切り替えに失敗しました");
    }
  }

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`/api/style-goals/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        throw new Error("Failed to delete style goal");
      }

      setMessage("なりたい系統を削除したよ");
      await loadGoals();
    } catch (error) {
      console.error(error);
      setMessage("削除に失敗しました");
    }
  }

  return (
    <div className="space-y-4">
      <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-neutral-200">
        <h2 className="text-xl font-bold text-[#0b2341]">新しく登録する</h2>
        <p className="mt-1 text-sm text-gray-500">
          今後近づきたい理想の系統を登録します。
        </p>

        <div className="mt-4 space-y-3">
          <div>
            <label className="mb-2 block text-sm font-medium text-[#0b2341]">
              なりたい系統
            </label>
            <select
              value={targetStyle}
              onChange={(e) => setTargetStyle(e.target.value)}
              className="w-full rounded-2xl border border-gray-200 bg-white px-3 py-3 text-sm"
            >
              {styleOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-[#0b2341]">
              寄せたい強さ
            </label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="w-full rounded-2xl border border-gray-200 bg-white px-3 py-3 text-sm"
            >
              {priorityOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-[#0b2341]">
              補足メモ
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="例：甘すぎず上品な感じに寄せたい"
              className="w-full rounded-2xl border border-gray-200 bg-white px-3 py-3 text-sm"
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
            />
            これを今のメイン目標にする
          </label>

          <button
            type="button"
            onClick={handleCreate}
            disabled={isSaving}
            className="w-full rounded-2xl bg-[#0b2341] px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
          >
            {isSaving ? "保存中..." : "保存する"}
          </button>

          {message ? (
            <p className="text-sm text-emerald-600">{message}</p>
          ) : null}
        </div>
      </section>

      <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-neutral-200">
        <h2 className="text-xl font-bold text-[#0b2341]">登録済みの目標</h2>

        {isLoading ? (
          <p className="mt-3 text-sm text-gray-500">読み込み中...</p>
        ) : goals.length === 0 ? (
          <p className="mt-3 text-sm text-gray-500">
            まだなりたい系統は登録されていません。
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            {goals.map((goal) => (
              <div
                key={goal.id}
                className="rounded-2xl border border-gray-200 bg-[#fafafa] p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-semibold text-[#0b2341]">
                      {goal.targetStyle}
                    </p>
                    <p className="mt-1 text-sm text-gray-500">
                      寄せたい強さ: {goal.priority ?? "未設定"}
                    </p>
                    <p className="mt-1 text-sm text-gray-500">
                      {goal.note?.trim() ? goal.note : "補足メモなし"}
                    </p>
                  </div>

                  {goal.isActive ? (
                    <span className="rounded-full bg-[#0b2341] px-3 py-1 text-xs font-medium text-white">
                      メイン
                    </span>
                  ) : null}
                </div>

                <div className="mt-3 flex gap-2">
                  {!goal.isActive ? (
                    <button
                      type="button"
                      onClick={() => handleSetActive(goal.id)}
                      className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-[#0b2341]"
                    >
                      メインにする
                    </button>
                  ) : null}

                  <button
                    type="button"
                    onClick={() => handleDelete(goal.id)}
                    className="rounded-xl border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-500"
                  >
                    削除
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}