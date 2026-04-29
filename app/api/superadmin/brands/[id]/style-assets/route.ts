import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { StyleAssetType } from "@/lib/generated/prisma/enums";
import { fal } from "@fal-ai/client";

fal.config({ credentials: process.env.FAL_KEY });

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: brandId } = await params;

  const brand = await prisma.brand.findUnique({ where: { id: brandId } });
  if (!brand) {
    return NextResponse.json({ error: "Brand not found" }, { status: 404 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const label = formData.get("label") as string | null;
  const promptDescription = (formData.get("promptDescription") as string | null) || null;
  const type = formData.get("type") as string | null;
  const sendToPrompt = formData.get("sendToPrompt") !== "false";

  if (!label || !type) {
    return NextResponse.json({ error: "label and type required" }, { status: 400 });
  }

  if (!Object.values(StyleAssetType).includes(type as StyleAssetType)) {
    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  }

  const imageUrl = file ? await fal.storage.upload(file) : "";

  const asset = await prisma.styleAsset.create({
    data: { brandId, type: type as StyleAssetType, imageUrl, label, promptDescription, sendToPrompt },
    select: { id: true, label: true, promptDescription: true, imageUrl: true, type: true, sendToPrompt: true },
  });

  return NextResponse.json({ asset }, { status: 201 });
}
