import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import AppHeader from "../components/AppHeader";
import BottomNav from "../components/BottomNav";
import LogoutButton from "./LogoutButton";
import ProfileSettingsCard from "./ProfileSettingsCard";

export default async function ProfilePage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/login");
  }

  const userName = session.user.name ?? "ユーザー";
  const userEmail = session.user.email ?? "";
  const userImage = session.user.image ?? "";

  return (
    <main className="min-h-screen bg-[#fafafa] pb-24">
      <div className="mx-auto max-w-md px-4 py-6">
        <AppHeader
          title="プロフィール"
          description="アカウント情報と今後のパーソナル設定の入口です。"
        />

        <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-neutral-200">
          <div className="flex items-center gap-4">
            {userImage ? (
              <img
                src={userImage}
                alt="プロフィール画像"
                className="h-16 w-16 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 text-xl">
                👤
              </div>
            )}

            <div className="min-w-0">
              <p className="truncate text-2xl font-bold text-[#0b2341]">
                {userName}
              </p>
              <p className="mt-1 truncate text-sm text-gray-500">{userEmail}</p>
            </div>
          </div>
        </section>

        <div className="mt-4">
          <ProfileSettingsCard />
        </div>

        <section className="mt-4 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-neutral-200">
          <LogoutButton />
        </section>
      </div>

      <BottomNav />
    </main>
  );
}