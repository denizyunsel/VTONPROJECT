import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { fal } from "@fal-ai/client";

fal.config({ credentials: process.env.FAL_KEY });

const BLOB_CONFIGURED =
  !!process.env.BLOB_READ_WRITE_TOKEN &&
  !process.env.BLOB_READ_WRITE_TOKEN.includes("placeholder");

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const type = formData.get("type") as string | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (type !== "top_garment" && type !== "bottom_garment") {
      return NextResponse.json(
        { error: "Invalid type. Must be top_garment or bottom_garment" },
        { status: 400 }
      );
    }

    let url: string;

    if (BLOB_CONFIGURED) {
      const { uploadGarment } = await import("@/lib/blob");
      url = await uploadGarment(file, session.userId, type);
    } else {
      // Fallback: use fal.ai storage
      url = await fal.storage.upload(file);
    }

    return NextResponse.json({ url });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
