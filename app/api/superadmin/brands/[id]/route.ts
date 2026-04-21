import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const brand = await prisma.brand.findUnique({
    where: { id },
    include: {
      styleAssets: { orderBy: [{ type: "asc" }, { createdAt: "asc" }] },
      users: {
        select: { id: true, email: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!brand) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ brand });
}
