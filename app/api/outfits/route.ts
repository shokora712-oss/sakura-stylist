import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const outfits = await prisma.outfit.findMany({
      where: {
        userId: session.user.id,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({
      success: true,
      outfits,
    });
  } catch (error) {
    console.error("GET /api/outfits error:", error);
    return NextResponse.json(
      { error: "保存コーデの取得に失敗しました" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();

    const outfit = await prisma.outfit.create({
      data: {
        userId: session.user.id,
        topItemId: body.topItemId ?? null,
        bottomItemId: body.bottomItemId ?? null,
        onepieceItemId: body.onepieceItemId ?? null,
        outerItemId: body.outerItemId ?? null,
        shoesItemId: body.shoesItemId ?? null,
        bagItemId: body.bagItemId ?? null,
        score: typeof body.score === "number" ? body.score : null,
        comment: body.comment ?? null,
        occasion: body.occasion ?? null,
        temperatureLabel: body.temperatureLabel ?? null,
        isFavorite: typeof body.isFavorite === "boolean" ? body.isFavorite : true,
        imageUrl: body.imageUrl ?? null,
      },
    });

    return NextResponse.json({
      success: true,
      outfit,
    });
  } catch (error) {
    console.error("POST /api/outfits error:", error);
    return NextResponse.json(
      { error: "コーデ保存に失敗しました" },
      { status: 500 }
    );
  }
}