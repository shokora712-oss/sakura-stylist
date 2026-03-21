import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const goals = await prisma.styleGoal.findMany({
    where: { userId: session.user.id },
    orderBy: [{ isActive: "desc" }, { updatedAt: "desc" }],
  });

  return NextResponse.json({ goals });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const targetStyle =
    typeof body?.targetStyle === "string" ? body.targetStyle.trim() : "";
  const priority =
    typeof body?.priority === "string" ? body.priority.trim() : "";
  const note = typeof body?.note === "string" ? body.note.trim() : "";
  const isActive = Boolean(body?.isActive);
  const imageUrl = typeof body?.imageUrl === "string" ? body.imageUrl.trim() : null;

  if (!targetStyle) {
    return NextResponse.json(
      { error: "targetStyle is required" },
      { status: 400 }
    );
  }

  if (isActive) {
    await prisma.styleGoal.updateMany({
      where: { userId: session.user.id, isActive: true },
      data: { isActive: false },
    });
  }

  const goal = await prisma.styleGoal.create({
    data: {
      userId: session.user.id,
      targetStyle,
      priority: priority || null,
      note: note || null,
      isActive,
      imageUrl: imageUrl || null,
    },
  });

  return NextResponse.json({ ok: true, goal });
}