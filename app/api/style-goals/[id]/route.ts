import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function PATCH(req: Request, context: RouteContext) {
  const { id } = await context.params;
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const existing = await prisma.styleGoal.findFirst({
    where: {
      id,
      userId: session.user.id,
    },
  });

  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json();

  const targetStyle =
    typeof body?.targetStyle === "string"
      ? body.targetStyle.trim()
      : existing.targetStyle;

  const priority =
    typeof body?.priority === "string"
      ? body.priority.trim()
      : existing.priority;

  const note =
    typeof body?.note === "string"
      ? body.note.trim()
      : existing.note;

  const isActive =
    typeof body?.isActive === "boolean"
      ? body.isActive
      : existing.isActive;

  if (isActive) {
    await prisma.styleGoal.updateMany({
      where: {
        userId: session.user.id,
        isActive: true,
        NOT: { id },
      },
      data: { isActive: false },
    });
  }

  const goal = await prisma.styleGoal.update({
    where: { id },
    data: {
      targetStyle,
      priority: priority || null,
      note: note || null,
      isActive,
    },
  });

  return NextResponse.json({ ok: true, goal });
}

export async function DELETE(_req: Request, context: RouteContext) {
  const { id } = await context.params;
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const existing = await prisma.styleGoal.findFirst({
    where: {
      id,
      userId: session.user.id,
    },
  });

  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.styleGoal.delete({
    where: { id },
  });

  return NextResponse.json({ ok: true });
}