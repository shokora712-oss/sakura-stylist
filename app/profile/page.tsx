import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import AppHeader from "../components/AppHeader";
import BottomNav from "../components/BottomNav";
import LogoutButton from "./LogoutButton";
import ProfileSettingsCard from "./ProfileSettingsCard";

export default async function ProfilePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const userName = session.user.name ?? "ユーザー";
  const userEmail = session.user.email ?? "";
  const userImage = session.user.image ?? "";

  return (
    <main className="min-h-screen bg-[#fdf2f6] pb-24 text-[#605D62]">
      <div className="mx-auto max-w-md px-4 py-6">
        <AppHeader title="プロフィール" description="アカウント情報とパーソナル設定" />

        <section className="mb-4 rounded-3xl bg-white p-5 ring-1 ring-[#FCE4EC]">
          <div className="flex items-center gap-4">
            {userImage ? (
              <img src={userImage} alt="プロフィール画像" className="h-16 w-16 rounded-full object-cover" />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#fdf2f6] text-2xl">
                👤
              </div>
            )}
            <div className="min-w-0">
              <p className="truncate text-xl font-bold text-[#605D62]">{userName}</p>
              <p className="mt-0.5 truncate text-sm text-[#605D62]/50">{userEmail}</p>
            </div>
          </div>
        </section>

        <div className="mb-4">
          <ProfileSettingsCard />
        </div>

        <section className="rounded-3xl bg-white p-5 ring-1 ring-[#FCE4EC]">
          <LogoutButton />
        </section>
      </div>
      <BottomNav />
    </main>
  );
}