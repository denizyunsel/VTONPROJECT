import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const models = await prisma.aIModel.findMany({
    where: {
      userAccess: {
        some: { userId: session.userId },
      },
    },
    select: {
      id: true,
      name: true,
      thumbnailUrl: true,
      imageUrl: true,
    },
  });

  return NextResponse.json({ models });
}
