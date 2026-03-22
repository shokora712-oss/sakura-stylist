import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import LoginAction from "./LoginAction";
import Link from "next/link";

export default async function LoginPage() {
  const session = await getServerSession(authOptions);

  if (session) {
    redirect("/");
  }

  return (
    <main className="min-h-screen bg-[#fdf2f6] text-[#605D62]">
      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 py-10">
        <div className="mb-8 text-center">
          <p className="text-sm text-[#605D62]/60">Sakura Stylist</p>
          <h1 className="mt-2 text-4xl font-bold tracking-tight">👗</h1>
          <h2 className="mt-3 text-2xl font-bold">あなたのAIスタイリスト</h2>
          <p className="mt-3 text-sm leading-6 text-[#605D62]/70">
            コーデ評価・クローゼット管理・スタイル分析を<br />AIがまるごとサポート
          </p>
        </div>

        <div className="w-full space-y-4">
          <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-[#FCE4EC]">
            <p className="mb-4 text-center text-sm font-semibold">アカウントでログイン</p>
            <LoginAction />
            <p className="mt-3 text-center text-xs text-[#605D62]/50">
              ログインするとデータが保存されます
            </p>
          </div>

          <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-[#FCE4EC]">
            <p className="mb-1 text-center text-sm font-semibold">まずは試してみる</p>
            <p className="mb-4 text-center text-xs text-[#605D62]/60">
              登録不要・データは保存されません
            </p>
            <Link href="/guest"
              className="block w-full rounded-2xl bg-gradient-to-r from-[#FCE4EC] to-[#E3F2FD] py-3 text-center text-sm font-bold text-[#605D62] shadow-sm transition hover:opacity-90">
              ゲストとして試す →
            </Link>
            <div className="mt-4 space-y-2">
              {[
                { emoji: "⭐", text: "コーデ評価" },
                { emoji: "👗", text: "アイテム解析" },
              ].map((item) => (
                <div key={item.text} className="flex items-center gap-2 text-xs text-[#605D62]/60">
                  <span>{item.emoji}</span>
                  <span>{item.text}（結果表示のみ）</span>
                </div>
              ))}
              {[
                { emoji: "🗂️", text: "クローゼット保存" },
                { emoji: "📋", text: "コーデログ" },
                { emoji: "📊", text: "スタイル分析" },
              ].map((item) => (
                <div key={item.text} className="flex items-center gap-2 text-xs text-[#605D62]/30 line-through">
                  <span>{item.emoji}</span>
                  <span>{item.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}