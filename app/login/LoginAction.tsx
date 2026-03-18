"use client";

import { signIn } from "next-auth/react";

export default function LoginAction() {
  return (
    <button
      type="button"
      onClick={() => signIn("google", { callbackUrl: "/" })}
      className="flex w-full items-center justify-center rounded-2xl bg-neutral-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-neutral-800"
    >
      Googleでログイン
    </button>
  );
}