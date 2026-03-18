"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function DeleteOutfitButton({ outfitId }: { outfitId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    const ok = window.confirm("この保存コーデを削除しますか？");
    if (!ok) return;

    try {
      setLoading(true);

      const res = await fetch(`/api/outfits/${outfitId}`, {
        method: "DELETE",
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.error ?? "保存コーデの削除に失敗しました");
      }

      router.refresh();
    } catch (error) {
      console.error(error);
      window.alert(
        error instanceof Error
          ? error.message
          : "保存コーデの削除に失敗しました"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={loading}
      className={`rounded-xl border px-3 py-2 text-sm font-medium ${
        loading
          ? "cursor-not-allowed border-gray-200 bg-gray-100 text-gray-400"
          : "border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
      }`}
    >
      {loading ? "削除中..." : "削除"}
    </button>
  );
}