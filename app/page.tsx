import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import HomeClient from "./HomeClient";

export default async function Page() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/guest");
  }

  const userName = session.user.name ?? "ユーザー";

  return <HomeClient userName={userName} />;
}