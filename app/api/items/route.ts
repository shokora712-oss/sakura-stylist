import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const AUTH_ERROR_MESSAGE = "ログイン状態を確認できませんでした。もう一度ログインしてください。";
const FETCH_ERROR_MESSAGE = "アイテム一覧の取得に失敗しました。時間をおいてもう一度お試しください。";
const CREATE_ERROR_MESSAGE = "アイテムの保存に失敗しました。時間をおいてもう一度お試しください。";

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

// GET: 自分の服だけ取得
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: AUTH_ERROR_MESSAGE }, { status: 401 });
    }

    const items = await prisma.item.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(items);
  } catch (error) {
    console.error("GET /api/items error:", error);
    return NextResponse.json(
      { error: FETCH_ERROR_MESSAGE },
      { status: 500 }
    );
  }
}

// POST: 自分の服として保存
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: AUTH_ERROR_MESSAGE }, { status: 401 });
    }

    const body = await request.json();

    if (!isNonEmptyString(body?.category)) {
      return NextResponse.json(
        { error: "カテゴリを選択してください。" },
        { status: 400 }
      );
    }

    const item = await prisma.item.create({
      data: {
        name: isNonEmptyString(body?.name) ? body.name.trim() : null,
        category: body.category,
        subCategory: isNonEmptyString(body?.subCategory) ? body.subCategory.trim() : null,
        color: Array.isArray(body?.color) ? body.color : [],
        material: Array.isArray(body?.material) ? body.material : [],
        season: Array.isArray(body?.season) ? body.season : [],
        styleTags: Array.isArray(body?.styleTags) ? body.styleTags : [],
        inspirationTags: Array.isArray(body?.inspirationTags) ? body.inspirationTags : [],
        formality: typeof body?.formality === "number" ? body.formality : 3,
        brand: isNonEmptyString(body?.brand) ? body.brand.trim() : null,
        imageUrl: isNonEmptyString(body?.imageUrl) ? body.imageUrl.trim() : null,
        memo: isNonEmptyString(body?.memo) ? body.memo.trim() : null,
        userId: session.user.id,
      },
    });

    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    console.error("POST /api/items error:", error);
    return NextResponse.json(
      { error: CREATE_ERROR_MESSAGE },
      { status: 500 }
    );
  }
}