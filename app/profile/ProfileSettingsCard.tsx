"use client";

import { useEffect, useMemo, useState } from "react";

type ProfileSettings = {
  skeletonType: string;
  personalColor: string;
  favoriteStyle: string;
  gender: string;
  ageGroup: string;
};

const skeletonOptions = [
  { value: "", label: "未設定" },
  { value: "straight", label: "ストレート" },
  { value: "wave", label: "ウェーブ" },
  { value: "natural", label: "ナチュラル" },
];

const personalColorOptions = [
  { value: "", label: "未設定" },
  { value: "spring", label: "イエベ春" },
  { value: "summer", label: "ブルベ夏" },
  { value: "autumn", label: "イエベ秋" },
  { value: "winter", label: "ブルベ冬" },
];

const favoriteStyleOptions = [
  { value: "", label: "未設定" },
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

const genderOptions = [
  { value: "", label: "未設定" },
  { value: "female", label: "女性" },
  { value: "male", label: "男性" },
  { value: "other", label: "その他" },
];

const ageGroupOptions = [
  { value: "", label: "未設定" },
  { value: "teens", label: "10代" },
  { value: "twenties", label: "20代" },
  { value: "thirties", label: "30代" },
  { value: "forties", label: "40代" },
  { value: "fifties", label: "50代" },
  { value: "sixties", label: "60代以上" },
];

function SettingRow({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="rounded-2xl bg-[#fdf2f6] px-4 py-3 ring-1 ring-[#FCE4EC]">
      <label className="mb-2 block text-xs font-semibold text-[#605D62]/60">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-[#FCE4EC] bg-white px-3 py-2.5 text-sm text-[#605D62] outline-none focus:border-[#605D62]"
      >
        {options.map((option) => (
          <option key={`${label}-${option.value}`} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export default function ProfileSettingsCard() {
  const [settings, setSettings] = useState<ProfileSettings>({
    skeletonType: "", personalColor: "", favoriteStyle: "", gender: "", ageGroup: "",
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState("");

  useEffect(() => {
    async function loadProfile() {
      try {
        const res = await fetch("/api/profile", { cache: "no-store" });
        const data = await res.json();
        setSettings({
          skeletonType: data?.profile?.skeletonType ?? "",
          personalColor: data?.profile?.personalColor ?? "",
          favoriteStyle: data?.profile?.favoriteStyle ?? "",
          gender: data?.profile?.gender ?? "",
          ageGroup: data?.profile?.ageGroup ?? "",
        });
      } catch (error) {
        console.error("Failed to load profile:", error);
      } finally {
        setIsLoading(false);
      }
    }
    loadProfile();
  }, []);

  const isComplete = useMemo(() => {
    return Boolean(settings.skeletonType && settings.personalColor && settings.favoriteStyle);
  }, [settings]);

  const updateField = <K extends keyof ProfileSettings>(key: K, value: ProfileSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setSavedMessage("");
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSavedMessage("");
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (!res.ok) throw new Error();
      setSavedMessage("プロフィール設定を保存しました");
    } catch {
      setSavedMessage("保存に失敗しました");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <section className="rounded-3xl bg-white p-5 ring-1 ring-[#FCE4EC]">
        <p className="text-sm text-[#605D62]/50">読み込み中...</p>
      </section>
    );
  }

  return (
    <section className="rounded-3xl bg-white p-5 ring-1 ring-[#FCE4EC]">
      <div className="mb-4">
        <h2 className="font-semibold text-[#605D62]">ユーザー設定</h2>
        <p className="mt-1 text-xs text-[#605D62]/50">提案の個別最適化に使う基本情報です。</p>
      </div>

      <div className="space-y-3">
        <SettingRow label="骨格タイプ" value={settings.skeletonType} options={skeletonOptions} onChange={(v) => updateField("skeletonType", v)} />
        <SettingRow label="パーソナルカラー" value={settings.personalColor} options={personalColorOptions} onChange={(v) => updateField("personalColor", v)} />
        <SettingRow label="好きな系統" value={settings.favoriteStyle} options={favoriteStyleOptions} onChange={(v) => updateField("favoriteStyle", v)} />
        <SettingRow label="性別" value={settings.gender} options={genderOptions} onChange={(v) => updateField("gender", v)} />
        <SettingRow label="年代" value={settings.ageGroup} options={ageGroupOptions} onChange={(v) => updateField("ageGroup", v)} />
      </div>

      <div className="mt-4 rounded-2xl bg-[#fdf2f6] px-4 py-3 text-xs text-[#605D62]/60">
        {isComplete ? "基本設定は揃っています。" : "未設定の項目があってもOK。あとからいつでも変えられます。"}
      </div>

      <button type="button" onClick={handleSave} disabled={isSaving}
        className="mt-4 w-full rounded-2xl bg-[#605D62] px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50">
        {isSaving ? "保存中..." : "保存する"}
      </button>

      {savedMessage && (
        <p className={`mt-3 text-sm ${savedMessage.includes("失敗") ? "text-red-500" : "text-emerald-600"}`}>
          {savedMessage}
        </p>
      )}
    </section>
  );
}