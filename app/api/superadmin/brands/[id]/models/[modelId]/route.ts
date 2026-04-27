import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; modelId: string }> }
) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: brandId, modelId } = await params;

  await prisma.brandModel.delete({
    where: { brandId_modelId: { brandId, modelId } },
  });

  return NextResponse.json({ ok: true });
}
