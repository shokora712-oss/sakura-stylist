import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

type BulkCreateItemInput = {
  name?: string | null;
  category?: string | null;
  subCategory?: string | null;
  color?: string[];
  material?: string[];
  season?: string[];
  styleTags?: string[];
  formality?: number | null;
  brand?: string | null;
  memo?: string | null;
  imageUrl?: string | null;
};

type BulkCreateItemsBody = {
  items?: BulkCreateItemInput[];
};

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v): v is string => typeof v === "string")
    .map((v) => v.trim())
    .filter(Boolean);
}

function normalizeNullableString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeNullableNumber(value: unknown): number | null {
  if (typeof value !== "number" || Number.isNaN(value)) return null;
  return value;
}

function validateItem(item: BulkCreateItemInput, index: number): string | null {
  if (!item.category || typeof item.category !== "string" || !item.category.trim()) {
    return `items[${index}].category は必須です`;
  }

  return null;
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as BulkCreateItemsBody;

    if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json(
        { error: "items 配列が必要です" },
        { status: 400 }
      );
    }

    const validationErrors: string[] = [];

    body.items.forEach((item, index) => {
      const error = validateItem(item, index);
      if (error) validationErrors.push(error);
    });

    if (validationErrors.length > 0) {
      return NextResponse.json(
        {
          error: "入力内容に不備があります",
          details: validationErrors,
        },
        { status: 400 }
      );
    }

    const normalizedItems = body.items.map((item) => ({
      name: normalizeNullableString(item.name),
      category: item.category!.trim(),
      subCategory: normalizeNullableString(item.subCategory),
      color: normalizeStringArray(item.color),
      material: normalizeStringArray(item.material),
      season: normalizeStringArray(item.season),
      styleTags: normalizeStringArray(item.styleTags),
      formality: normalizeNullableNumber(item.formality) ?? 3,
      brand: normalizeNullableString(item.brand),
      memo: normalizeNullableString(item.memo),
      imageUrl: normalizeNullableString(item.imageUrl),
      userId: session.user.id,
    }));

    const createdItems = await prisma.$transaction(
      normalizedItems.map((item) =>
        prisma.item.create({
          data: item,
        })
      )
    );

    return NextResponse.json({
      success: true,
      count: createdItems.length,
      items: createdItems,
    });
  } catch (error) {
    console.error("POST /api/items/bulk error:", error);
    return NextResponse.json(
      { error: "アイテム一括登録に失敗しました" },
      { status: 500 }
    );
  }
}