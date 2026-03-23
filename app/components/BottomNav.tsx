"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CoatHanger, House, User, Plus } from "@phosphor-icons/react";

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <>
      <Link
        href="/upload-hub"
        className="fixed bottom-20 right-6 z-[9999] flex h-14 w-14 items-center justify-center rounded-full bg-[#605D62] text-white shadow-lg transition hover:shadow-xl"
      >
        <Plus size={28} weight="bold" />
      </Link>

      <nav className="fixed bottom-0 left-1/2 z-[9999] w-full max-w-md -translate-x-1/2 border-t border-[#FCE4EC] bg-white px-8 py-2 shadow-[0_-4px_16px_rgba(0,0,0,0.06)]">
        <div className="flex items-center justify-around">

          <Link href="/closet" className="flex flex-col items-center gap-1">
            <CoatHanger size={28} weight={pathname === "/closet" ? "fill" : "regular"} color="#605D62" className={pathname === "/closet" ? "opacity-100" : "opacity-40"} />
            <span className={`text-xs font-medium ${pathname === "/closet" ? "text-[#605D62]" : "text-[#605D62]/40"}`}>
              Closet
            </span>
          </Link>

          <Link href="/" className="flex flex-col items-center gap-1">
            <House size={28} weight={pathname === "/" ? "fill" : "regular"} color="#605D62" className={pathname === "/" ? "opacity-100" : "opacity-40"} />
            <span className={`text-xs font-medium ${pathname === "/" ? "text-[#605D62]" : "text-[#605D62]/40"}`}>
              Home
            </span>
          </Link>

          <Link href="/profile" className="flex flex-col items-center gap-1">
            <User size={28} weight={pathname === "/profile" ? "fill" : "regular"} color="#605D62" className={pathname === "/profile" ? "opacity-100" : "opacity-40"} />
            <span className={`text-xs font-medium ${pathname === "/profile" ? "text-[#605D62]" : "text-[#605D62]/40"}`}>
              Profile
            </span>
          </Link>

        </div>
      </nav>
    </>
  );
}