import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { fal } from "@fal-ai/client";

fal.config({ credentials: process.env.FAL_KEY });

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: brandId } = await params;

  const brandModels = await prisma.brandModel.findMany({
    where: { brandId },
    include: { model: true },
    orderBy: { model: { createdAt: "asc" } },
  });

  return NextResponse.json({ models: brandModels.map((bm) => bm.model) });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: brandId } = await params;

  const brand = await prisma.brand.findUnique({ where: { id: brandId } });
  if (!brand) return NextResponse.json({ error: "Brand not found" }, { status: 404 });

  const formData = await request.formData();
  const name = formData.get("name") as string | null;
  const file = formData.get("file") as File | null;

  if (!name?.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  if (!file) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }

  const imageUrl = await fal.storage.upload(file);

  const model = await prisma.aIModel.create({
    data: {
      id: `model-${Date.now()}`,
      name: name.trim(),
      imageUrl,
      thumbnailUrl: imageUrl,
    },
  });

  await prisma.brandModel.create({ data: { brandId, modelId: model.id } });

  const brandUsers = await prisma.user.findMany({ where: { brandId } });
  for (const user of brandUsers) {
    await prisma.userModelAccess.create({ data: { userId: user.id, modelId: model.id } });
  }

  return NextResponse.json({ model });
}
