import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcrypt";

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

  const { email, password } = await request.json();

  if (!email || !password) {
    return NextResponse.json({ error: "email and password required" }, { status: 400 });
  }

  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "Email already in use" }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: { email, passwordHash, brandId },
    select: { id: true, email: true, createdAt: true },
  });

  // Grant access to all models assigned to this brand
  const brandModels = await prisma.brandModel.findMany({ where: { brandId } });
  for (const bm of brandModels) {
    await prisma.userModelAccess.upsert({
      where: { userId_modelId: { userId: user.id, modelId: bm.modelId } },
      update: {},
      create: { userId: user.id, modelId: bm.modelId },
    });
  }

  return NextResponse.json({ user }, { status: 201 });
}
