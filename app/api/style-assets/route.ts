import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { StyleAssetType } from "@/lib/generated/prisma/enums";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") as StyleAssetType | null;

  const where: { brandId: string; type?: StyleAssetType } = {
    brandId: session.brandId,
  };

  if (type && Object.values(StyleAssetType).includes(type)) {
    where.type = type;
  }

  const assets = await prisma.styleAsset.findMany({
    where,
    select: { id: true, label: true, imageUrl: true, type: true },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ assets });
}
