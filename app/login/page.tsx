import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import LoginAction from "./LoginAction";

export default async function LoginPage() {
  const session = await getServerSession(authOptions);

  if (session) {
    redirect("/");
  }

  return (
    <main className="min-h-screen bg-neutral-50 text-neutral-900">
      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 py-10">
        <div className="w-full rounded-3xl bg-white p-8 shadow-sm ring-1 ring-neutral-200">
          <div className="mb-8 text-center">
            <p className="mb-2 text-sm text-neutral-500">Closet AI</p>
            <h1 className="text-3xl font-bold">ログイン</h1>
            <p className="mt-3 text-sm leading-6 text-neutral-600">
              クローゼットをユーザーごとに管理するため、
              まずはGoogleアカウントでログインしてください。
            </p>
          </div>

          <LoginAction />
        </div>
      </div>
    </main>
  );
}