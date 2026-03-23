"use client";

import { useRef, useState } from "react";
import { Camera, Plus } from "@phosphor-icons/react";

type DailyLog = {
  id: string;
  imageUrl: string | null;
  occasion: string | null;
  createdAt: string;
};

const OCCASION_LABELS: Record<string, string> = {
  casual: "カジュアル", date: "デート", office: "仕事",
  formal: "フォーマル", travel: "旅行", school: "学校",
};

function getOccasionLabel(occasion: string | null) {
  return occasion ? (OCCASION_LABELS[occasion] ?? null) : null;
}

function groupByDate(logs: DailyLog[]) {
  const map = new Map<string, DailyLog>();
  for (const log of logs) {
    const date = new Date(log.createdAt);
    const key = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
    if (!map.has(key)) map.set(key, log);
  }
  return map;
}

function getMonthList(logs: DailyLog[]) {
  const set = new Set(logs.map((log) => {
    const d = new Date(log.createdAt);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }));
  return Array.from(set).sort().reverse();
}

function toDateInputValue(dateStr: string) {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function CalendarMonth({
  year, month, logsByDate, onSelectLog,
}: {
  year: number;
  month: number;
  logsByDate: Map<string, DailyLog>;
  onSelectLog: (log: DailyLog) => void;
}) {
  const firstDay = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="mb-8">
      <p className="mb-4 text-center text-base font-semibold text-[#605D62]">
        {month}月 {year}
      </p>
      <div className="grid grid-cols-7 gap-1 text-center">
        {["日", "月", "火", "水", "木", "金", "土"].map((d) => (
          <div key={d} className="pb-2 text-xs text-[#605D62]/40">{d}</div>
        ))}
        {cells.map((day, i) => {
          if (!day) return <div key={i} className="h-12" />;
          const key = `${year}-${month}-${day}`;
          const log = logsByDate.get(key);
          return (
            <div key={i} className="flex flex-col items-center">
              {log?.imageUrl ? (
                <button type="button" onClick={() => onSelectLog(log)}
                  className="relative h-11 w-11 overflow-hidden rounded-full ring-2 ring-[#FCE4EC] transition hover:ring-[#605D62]">
                  <img src={log.imageUrl} alt="" className="h-full w-full object-cover" />
                  <div className="absolute inset-0 flex items-end justify-center rounded-full bg-gradient-to-t from-black/40 to-transparent pb-1">
                    <span className="text-xs font-bold text-white">{day}</span>
                  </div>
                </button>
              ) : (
                <span className="flex h-11 w-11 items-center justify-center text-sm text-[#605D62]/40">
                  {day}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LogModal({
  log,
  onClose,
  onDeleted,
  onUpdated,
}: {
  log: DailyLog;
  onClose: () => void;
  onDeleted: (id: string) => void;
  onUpdated: (updated: DailyLog) => void;
}) {
  const date = new Date(log.createdAt);
  const occasionLabel = getOccasionLabel(log.occasion);
  const [isEditing, setIsEditing] = useState(false);
  const [dateValue, setDateValue] = useState(toDateInputValue(log.createdAt));
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleDelete() {
    if (!window.confirm("この記録を削除しますか？")) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/outfits/${log.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      onDeleted(log.id);
      onClose();
    } catch {
      setMessage("削除に失敗しました");
    } finally {
      setIsDeleting(false);
    }
  }

  async function handleSaveDate() {
    setIsSaving(true);
    try {
      const res = await fetch(`/api/outfits/${log.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ createdAt: new Date(dateValue).toISOString() }),
      });
      if (!res.ok) throw new Error();
      onUpdated({ ...log, createdAt: new Date(dateValue).toISOString() });
      setIsEditing(false);
      setMessage("日付を更新しました");
    } catch {
      setMessage("更新に失敗しました");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
      onClick={onClose}>
      <div className="w-full max-w-sm overflow-hidden rounded-3xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}>
        {log.imageUrl && (
          <div className="relative h-96">
            <img src={log.imageUrl} alt="コーデ記録" className="h-full w-full object-cover" />
            <div className="absolute left-3 top-3 rounded-2xl bg-white/90 px-3 py-1.5 shadow">
              <p className="text-lg font-bold leading-none text-[#605D62]">{date.getDate()}</p>
              <p className="text-xs text-[#605D62]/60">{date.getMonth() + 1}月</p>
            </div>
            <button type="button" onClick={onClose}
              className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-white">
              ✕
            </button>
          </div>
        )}

        <div className="p-4 space-y-3">
          {/* 日付表示 / 編集 */}
          {isEditing ? (
            <div className="space-y-2">
              <p className="text-xs font-medium text-[#605D62]">日付を変更</p>
              <input
                type="date"
                value={dateValue}
                onChange={(e) => setDateValue(e.target.value)}
                className="w-full rounded-xl border border-[#FCE4EC] px-3 py-2 text-sm text-[#605D62]"
              />
              <div className="flex gap-2">
                <button type="button" onClick={() => setIsEditing(false)}
                  className="flex-1 rounded-xl border border-[#FCE4EC] py-2 text-xs text-[#605D62]">
                  キャンセル
                </button>
                <button type="button" onClick={handleSaveDate} disabled={isSaving}
                  className="flex-1 rounded-xl bg-[#605D62] py-2 text-xs font-semibold text-white disabled:opacity-50">
                  {isSaving ? "保存中..." : "保存する"}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#605D62]/60">
                  {new Date(log.createdAt).toLocaleDateString("ja-JP", {
                    year: "numeric", month: "long", day: "numeric", weekday: "short",
                  })}
                </p>
                {occasionLabel && (
                  <span className="mt-1 inline-block rounded-full bg-[#FCE4EC] px-3 py-1 text-xs font-medium text-[#605D62]">
                    {occasionLabel}
                  </span>
                )}
              </div>
              <button type="button" onClick={() => setIsEditing(true)}
                className="rounded-xl border border-[#FCE4EC] px-3 py-1.5 text-xs text-[#605D62]">
                日付変更
              </button>
            </div>
          )}

          {message && (
            <p className={`text-xs ${message.includes("失敗") ? "text-red-500" : "text-emerald-600"}`}>
              {message}
            </p>
          )}

          {/* 削除ボタン */}
          <button type="button" onClick={handleDelete} disabled={isDeleting}
            className="w-full rounded-xl border border-red-100 bg-red-50 py-2.5 text-xs font-medium text-red-500 disabled:opacity-50">
            {isDeleting ? "削除中..." : "この記録を削除する"}
          </button>
        </div>
      </div>
    </div>
  );
}

function RecordModal({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: (log: DailyLog) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [dateValue, setDateValue] = useState(toDateInputValue(new Date().toISOString()));
  const [occasion, setOccasion] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
  }

  async function handleSave() {
    if (!file) { setMessage("写真を選択してください"); return; }
    setIsSaving(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const uploadRes = await fetch("/api/upload", { method: "POST", body: fd });
      const uploadData = await uploadRes.json();
      const imageUrl = uploadData?.imageUrl ?? null;

      // AI解析
      const imageDataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const analyzeRes = await fetch("/api/outfit-log/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageDataUrl }),
      });
      const analyzeData = analyzeRes.ok ? await analyzeRes.json() : { items: [], overallStyleTags: [], overallColors: [] };

      const detectedItemTags = (analyzeData.items ?? []).map((item: any) => item.category).filter(Boolean);
      const detectedStyleTags = analyzeData.overallStyleTags ?? [];
      const detectedColors = analyzeData.overallColors ?? [];

      const res = await fetch("/api/outfits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageUrl,
          isFavorite: false,
          occasion: occasion || null,
          createdAt: new Date(dateValue).toISOString(),
          temperatureLabel: null,
          score: null,
          comment: null,
          detectedItemTags,
          detectedStyleTags,
          detectedColors,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error();

      onSaved({
        id: data.outfit.id,
        imageUrl,
        occasion: occasion || null,
        createdAt: new Date(dateValue).toISOString(),
      });
      onClose();
    } catch {
      setMessage("保存に失敗しました");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60"
      onClick={onClose}>
      <div className="w-full max-w-md rounded-t-3xl bg-white p-5 pb-10 shadow-xl"
        onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-bold text-[#605D62]">コーデを記録する</h2>
          <button type="button" onClick={onClose} className="text-[#605D62]/40">✕</button>
        </div>

        {/* 写真選択 */}
        <div onClick={() => fileInputRef.current?.click()}
          className="mb-4 cursor-pointer overflow-hidden rounded-2xl ring-1 ring-[#FCE4EC]">
          {previewUrl ? (
            <img src={previewUrl} alt="preview" className="h-48 w-full object-cover" />
          ) : (
            <div className="flex h-36 flex-col items-center justify-center gap-1 bg-[#fdf2f6]">
              <span className="text-3xl">📷</span>
              <p className="text-xs text-[#605D62]/60">タップして写真を選択</p>
            </div>
          )}
        </div>
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />

        {/* 日付 */}
        <div className="mb-3">
          <p className="mb-1 text-xs font-medium text-[#605D62]">日付</p>
          <input type="date" value={dateValue} onChange={(e) => setDateValue(e.target.value)}
            className="w-full rounded-xl border border-[#FCE4EC] px-3 py-2 text-sm text-[#605D62]" />
        </div>

        {/* シチュエーション */}
        <div className="mb-4">
          <p className="mb-2 text-xs font-medium text-[#605D62]">シチュエーション（任意）</p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(OCCASION_LABELS).map(([value, label]) => (
              <button key={value} type="button" onClick={() => setOccasion(occasion === value ? "" : value)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                  occasion === value ? "bg-[#605D62] text-white" : "bg-[#fdf2f6] text-[#605D62]"
                }`}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {message && <p className="mb-2 text-xs text-red-500">{message}</p>}

        <button type="button" onClick={handleSave} disabled={isSaving || !file}
          className="w-full rounded-2xl bg-[#605D62] py-3 text-sm font-semibold text-white disabled:opacity-40">
          {isSaving ? "保存中..." : "記録する"}
        </button>
      </div>
    </div>
  );
}

export default function DailyLogSection({ logs: initialLogs }: { logs: DailyLog[] }) {
  const [logs, setLogs] = useState<DailyLog[]>(initialLogs);
  const [tab, setTab] = useState<"grid" | "calendar">("grid");
  const [selectedLog, setSelectedLog] = useState<DailyLog | null>(null);
  const [showRecordModal, setShowRecordModal] = useState(false);

  const byDate = groupByDate(logs);
  const monthList = getMonthList(logs);

  function handleDeleted(id: string) {
    setLogs((prev) => prev.filter((l) => l.id !== id));
  }

  function handleUpdated(updated: DailyLog) {
    setLogs((prev) => prev.map((l) => l.id === updated.id ? updated : l));
    setSelectedLog(updated);
  }

  function handleSaved(log: DailyLog) {
    setLogs((prev) => [log, ...prev].sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    ));
  }

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-semibold"><Camera size={20} color="#605D62" />日々のコーデ記録</h2>
        <div className="flex items-center gap-2">
          <span className="text-xs text-[#605D62]/50">{logs.length}件</span>
          <button type="button" onClick={() => setShowRecordModal(true)}
            className="flex items-center gap-1 rounded-full bg-[#605D62] px-3 py-1.5 text-xs font-semibold text-white">
            <Plus size={14} weight="bold" />記録する
          </button>
        </div>
      </div>

      {logs.length === 0 ? (
        <div className="rounded-3xl bg-white p-6 text-center ring-1 ring-[#FCE4EC]">
          <p className="mb-3 text-sm text-[#605D62]/60">まだ記録がありません</p>
          <button type="button" onClick={() => setShowRecordModal(true)}
            className="rounded-2xl bg-[#605D62] px-4 py-2 text-sm font-semibold text-white">
            今日のコーデを記録する
          </button>
        </div>
      ) : (
        <>
          {/* タブ切り替え */}
          <div className="mb-4 flex rounded-2xl bg-white p-1 ring-1 ring-[#FCE4EC]">
            {(["grid", "calendar"] as const).map((t) => (
              <button key={t} type="button" onClick={() => setTab(t)}
                className={`flex-1 rounded-xl py-2 text-xs font-semibold transition ${
                  tab === t ? "bg-[#605D62] text-white" : "text-[#605D62]/60"
                }`}>
                {t === "grid" ? "グリッド" : "カレンダー"}
              </button>
            ))}
          </div>

          {/* グリッドビュー */}
          {tab === "grid" && (
            <div className="grid grid-cols-3 gap-1">
              {logs.map((log) => {
                const date = new Date(log.createdAt);
                return (
                  <button key={log.id} type="button" onClick={() => setSelectedLog(log)}
                    className="relative overflow-hidden rounded-2xl bg-[#fdf2f6]">
                    <div className="aspect-square">
                      {log.imageUrl ? (
                        <img src={log.imageUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full items-center justify-center text-xs text-[#605D62]/30">
                          画像なし
                        </div>
                      )}
                    </div>
                    <div className="absolute left-1.5 top-1.5 rounded-lg bg-white/90 px-1.5 py-0.5 shadow-sm">
                      <p className="text-xs font-bold leading-none text-[#605D62]">{date.getDate()}</p>
                      <p className="text-xs leading-none text-[#605D62]/60">{date.getMonth() + 1}月</p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* カレンダービュー */}
          {tab === "calendar" && (
            <div className="rounded-3xl bg-white p-4 ring-1 ring-[#FCE4EC]">
              {monthList.map((monthKey) => {
                const [y, m] = monthKey.split("-").map(Number);
                return (
                  <CalendarMonth key={monthKey} year={y} month={m}
                    logsByDate={byDate} onSelectLog={setSelectedLog} />
                );
              })}
            </div>
          )}
        </>
      )}

      {/* 拡大モーダル */}
      {selectedLog && (
        <LogModal
          log={selectedLog}
          onClose={() => setSelectedLog(null)}
          onDeleted={handleDeleted}
          onUpdated={handleUpdated}
        />
      )}

      {/* 記録モーダル */}
      {showRecordModal && (
        <RecordModal
          onClose={() => setShowRecordModal(false)}
          onSaved={handleSaved}
        />
      )}
    </section>
  );
}