import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { fal } from "@fal-ai/client";

fal.config({ credentials: process.env.FAL_KEY });

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; assetId: string }> }
) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: brandId, assetId } = await params;
  const asset = await prisma.styleAsset.findUnique({ where: { id: assetId } });

  if (!asset || asset.brandId !== brandId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    const imageUrl = await fal.storage.upload(file);
    const updated = await prisma.styleAsset.update({
      where: { id: assetId },
      data: { imageUrl },
      select: { id: true, imageUrl: true },
    });
    return NextResponse.json({ asset: updated });
  }

  const { sendToPrompt } = await request.json();
  const updated = await prisma.styleAsset.update({
    where: { id: assetId },
    data: { sendToPrompt },
    select: { id: true, sendToPrompt: true },
  });

  return NextResponse.json({ asset: updated });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; assetId: string }> }
) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: brandId, assetId } = await params;
  const asset = await prisma.styleAsset.findUnique({ where: { id: assetId } });

  if (!asset || asset.brandId !== brandId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.styleAsset.delete({ where: { id: assetId } });
  return NextResponse.json({ success: true });
}
