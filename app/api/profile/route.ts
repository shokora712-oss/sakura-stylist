import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
  });

  return NextResponse.json({
    profile: {
      skeletonType: profile?.skeletonType ?? "",
      personalColor: profile?.personalColor ?? "",
      favoriteStyle: profile?.favoriteStyle ?? "",
      targetStyle: profile?.targetStyle ?? "",
    },
  });
}

export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const skeletonType =
    typeof body?.skeletonType === "string" ? body.skeletonType : "";
  const personalColor =
    typeof body?.personalColor === "string" ? body.personalColor : "";
  const favoriteStyle =
    typeof body?.favoriteStyle === "string" ? body.favoriteStyle : "";
  const targetStyle =
    typeof body?.targetStyle === "string" ? body.targetStyle : "";

  const profile = await prisma.profile.upsert({
    where: { userId: session.user.id },
    update: {
      skeletonType: skeletonType || null,
      personalColor: personalColor || null,
      favoriteStyle: favoriteStyle || null,
      targetStyle: targetStyle || null,
    },
    create: {
      userId: session.user.id,
      skeletonType: skeletonType || null,
      personalColor: personalColor || null,
      favoriteStyle: favoriteStyle || null,
      targetStyle: targetStyle || null,
    },
  });

  return NextResponse.json({
    ok: true,
    profile: {
      skeletonType: profile.skeletonType ?? "",
      personalColor: profile.personalColor ?? "",
      favoriteStyle: profile.favoriteStyle ?? "",
      targetStyle: profile.targetStyle ?? "",
    },
  });
}