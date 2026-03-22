import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;

    const outfit = await prisma.outfit.findUnique({
      where: { id },
      select: { id: true, userId: true },
    });

    if (!outfit) {
      return NextResponse.json(
        { error: "保存コーデが見つかりません" },
        { status: 404 }
      );
    }

    if (outfit.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await prisma.outfit.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/outfits/[id] error:", error);
    return NextResponse.json(
      { error: "保存コーデの削除に失敗しました" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;

    const outfit = await prisma.outfit.findUnique({
      where: { id },
      select: { id: true, userId: true },
    });

    if (!outfit) {
      return NextResponse.json({ error: "保存コーデが見つかりません" }, { status: 404 });
    }

    if (outfit.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();

    const updated = await prisma.outfit.update({
      where: { id },
      data: {
        ...(body.createdAt ? { createdAt: new Date(body.createdAt) } : {}),
        ...(body.occasion !== undefined ? { occasion: body.occasion } : {}),
      },
    });

    return NextResponse.json({ success: true, outfit: updated });
  } catch (error) {
    console.error("PATCH /api/outfits/[id] error:", error);
    return NextResponse.json(
      { error: "更新に失敗しました" },
      { status: 500 }
    );
  }
}