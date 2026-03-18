import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import AppHeader from "../components/AppHeader";
import BottomNav from "../components/BottomNav";
import StyleGoalsClient from "./StyleGoalsClient";

export default async function StyleGoalsPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/login");
  }

  return (
    <main className="min-h-screen bg-[#fafafa] pb-24">
      <div className="mx-auto max-w-md px-4 py-6">
        <AppHeader
          title="なりたい系統を登録"
          description="近づきたい雰囲気やファッションの方向性を設定できます。"
        />

        <StyleGoalsClient />
      </div>

      <BottomNav />
    </main>
  );
}