"use client";

import { useEffect, useMemo, useState } from "react";

type ProfileSettings = {
  skeletonType: string;
  personalColor: string;
  favoriteStyle: string;
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
  { value: "girly", label: "ガーリー" },
  { value: "feminine", label: "フェミニン" },
  { value: "minimal", label: "ミニマル" },
  { value: "mode", label: "モード" },
  { value: "street", label: "ストリート" },
  { value: "office", label: "オフィス" },
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
    <div className="rounded-2xl border border-gray-200 bg-[#fafafa] px-4 py-3">
      <label className="mb-2 block text-sm font-medium text-[#0b2341]">
        {label}
      </label>

      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm text-gray-700 outline-none focus:border-[#0b2341]"
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
    skeletonType: "",
    personalColor: "",
    favoriteStyle: "",
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
    return Boolean(
      settings.skeletonType &&
        settings.personalColor &&
        settings.favoriteStyle
    );
  }, [settings]);

  const updateField = <K extends keyof ProfileSettings>(
    key: K,
    value: ProfileSettings[K]
  ) => {
    setSettings((prev) => ({
      ...prev,
      [key]: value,
    }));
    setSavedMessage("");
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSavedMessage("");

    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(settings),
      });

      if (!res.ok) {
        throw new Error("Failed to save profile");
      }

      setSavedMessage("プロフィール設定を保存したよ");
    } catch (error) {
      console.error(error);
      setSavedMessage("保存に失敗しました");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-neutral-200">
        <p className="text-sm text-gray-500">プロフィール設定を読み込み中...</p>
      </section>
    );
  }

  return (
    <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-neutral-200">
      <div className="mb-4">
        <h2 className="text-xl font-bold text-[#0b2341]">ユーザー設定</h2>
        <p className="mt-1 text-sm text-gray-500">
          提案の個別最適化に使う基本情報です。
        </p>
      </div>

      <div className="space-y-3">
        <SettingRow
          label="骨格タイプ"
          value={settings.skeletonType}
          options={skeletonOptions}
          onChange={(value) => updateField("skeletonType", value)}
        />

        <SettingRow
          label="パーソナルカラー"
          value={settings.personalColor}
          options={personalColorOptions}
          onChange={(value) => updateField("personalColor", value)}
        />

        <SettingRow
          label="好きな系統"
          value={settings.favoriteStyle}
          options={favoriteStyleOptions}
          onChange={(value) => updateField("favoriteStyle", value)}
        />
      </div>

      <div className="mt-4 rounded-2xl bg-gray-50 px-4 py-3 text-sm text-gray-600">
        {isComplete
          ? "現在地としての基本設定は揃ってる状態。"
          : "未設定の項目があってもOK。あとからいつでも変えられる。"}
      </div>

      <button
        type="button"
        onClick={handleSave}
        disabled={isSaving}
        className="mt-4 w-full rounded-2xl bg-[#0b2341] px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
      >
        {isSaving ? "保存中..." : "保存する"}
      </button>

      {savedMessage ? (
        <p className="mt-3 text-sm text-emerald-600">{savedMessage}</p>
      ) : null}
    </section>
  );
}