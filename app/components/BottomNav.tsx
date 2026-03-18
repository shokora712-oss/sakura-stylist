"use client";

import Link from "next/link";

export default function BottomNav() {
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