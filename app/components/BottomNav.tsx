"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <>
      {/* FAB */}
      <Link
        href="/upload-hub"
        className="fixed bottom-20 right-6 z-[9999] flex h-14 w-14 items-center justify-center rounded-full bg-[#605D62] text-2xl text-white shadow-lg transition hover:shadow-xl"
      >
        ＋
      </Link>

      {/* ボトムナビ */}
      <nav className="fixed bottom-0 left-1/2 z-[9999] w-full max-w-md -translate-x-1/2 border-t border-[#FCE4EC] bg-white px-8 py-2 shadow-[0_-4px_16px_rgba(0,0,0,0.06)]">
        <div className="flex items-center justify-around">

          {/* クローゼット */}
          <Link href="/closet" className="flex flex-col items-center gap-1">
            <span className={`text-2xl transition ${pathname === "/closet" ? "opacity-100" : "opacity-40"}`}>
              👚
            </span>
            <span className={`text-xs font-medium ${pathname === "/closet" ? "text-[#605D62]" : "text-[#605D62]/40"}`}>
              クローゼット
            </span>
          </Link>

          {/* ホーム（中央） */}
          <Link href="/" className="flex flex-col items-center gap-1">
            <span className={`text-2xl transition ${pathname === "/" ? "opacity-100" : "opacity-40"}`}>
              🏠
            </span>
            <span className={`text-xs font-medium ${pathname === "/" ? "text-[#605D62]" : "text-[#605D62]/40"}`}>
              ホーム
            </span>
          </Link>

          {/* プロフィール */}
          <Link href="/profile" className="flex flex-col items-center gap-1">
            <span className={`text-2xl transition ${pathname === "/profile" ? "opacity-100" : "opacity-40"}`}>
              👤
            </span>
            <span className={`text-xs font-medium ${pathname === "/profile" ? "text-[#605D62]" : "text-[#605D62]/40"}`}>
              プロフィール
            </span>
          </Link>

        </div>
      </nav>
    </>
  );
}