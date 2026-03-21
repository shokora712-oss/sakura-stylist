import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Params = {
  params: Promise<{
    id: string;
  }>;
};

export async function PATCH(req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const body = await req.json();

    const updated = await prisma.item.update({
      where: { id },
      data: {
        name: body.name ?? null,
        category: body.category,
        subCategory: body.subCategory ?? null,
        color: body.color ?? [],
        material: body.material ?? [],
        season: body.season ?? [],
        styleTags: body.styleTags ?? [],
        inspirationTags: body.inspirationTags ?? [],
        formality: body.formality ?? 3,
        brand: body.brand ?? null,
        imageUrl: body.imageUrl ?? null,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PATCH /api/items/[id] error:", error);
    return NextResponse.json(
      { error: "アイテムの更新に失敗しました" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request, { params }: Params) {
  try {
    const { id } = await params;

    await prisma.item.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/items/[id] error:", error);
    return NextResponse.json(
      { error: "アイテムの削除に失敗しました" },
      { status: 500 }
    );
  }
}