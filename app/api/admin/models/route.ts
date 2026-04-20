import { NextRequest, NextResponse } from "next/server";
import { fal } from "@fal-ai/client";
import { prisma } from "@/lib/prisma";

fal.config({ credentials: process.env.FAL_KEY });

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const name = formData.get("name") as string | null;
  const modelId = formData.get("modelId") as string | null;

  if (!file || (!name && !modelId)) {
    return NextResponse.json({ error: "file and name required" }, { status: 400 });
  }

  const url = await fal.storage.upload(file);

  if (modelId) {
    await prisma.aIModel.update({
      where: { id: modelId },
      data: { imageUrl: url, thumbnailUrl: url },
    });
    return NextResponse.json({ url, updated: modelId });
  }

  const id = `model-${Date.now()}`;
  const model = await prisma.aIModel.create({
    data: { id, name: name!, imageUrl: url, thumbnailUrl: url },
  });

  const brands = await prisma.brand.findMany();
  const users = await prisma.user.findMany();

  for (const brand of brands) {
    await prisma.brandModel.create({ data: { brandId: brand.id, modelId: model.id } });
  }
  for (const user of users) {
    await prisma.userModelAccess.create({ data: { userId: user.id, modelId: model.id } });
  }

  return NextResponse.json({ url, modelId: model.id });
}
