import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// GET: 自分の服だけ取得
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const items = await prisma.item.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(items);
  } catch (error) {
    console.error("GET /api/items error:", error);
    return NextResponse.json(
      { error: "アイテム一覧の取得に失敗しました" },
      { status: 500 }
    );
  }
}

// POST: 自分の服として保存
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    if (!body?.category) {
      return NextResponse.json(
        { error: "category は必須です" },
        { status: 400 }
      );
    }

    const item = await prisma.item.create({
      data: {
        name: body.name ?? null,
        category: body.category,
        subCategory: body.subCategory ?? null,
        color: Array.isArray(body.color) ? body.color : [],
        material: Array.isArray(body.material) ? body.material : [],
        season: Array.isArray(body.season) ? body.season : [],
        styleTags: Array.isArray(body.styleTags) ? body.styleTags : [],
        inspirationTags: Array.isArray(body.inspirationTags) ? body.inspirationTags : [],
        formality: typeof body.formality === "number" ? body.formality : 3,
        brand: body.brand ?? null,
        imageUrl: body.imageUrl ?? null,
        memo: body.memo ?? null,
        userId: session.user.id,
      },
    });

    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    console.error("POST /api/items error:", error);
    return NextResponse.json(
      { error: "アイテム登録に失敗しました" },
      { status: 500 }
    );
  }
}