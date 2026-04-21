import { NextRequest, NextResponse } from "next/server";
import { signAdminJWT, setAdminCookie } from "@/lib/admin-auth";

export async function POST(request: NextRequest) {
  const { password } = await request.json();

  if (!password || password !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }

  const token = await signAdminJWT();
  await setAdminCookie(token);

  return NextResponse.json({ ok: true });
}
