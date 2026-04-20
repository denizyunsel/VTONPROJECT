import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { generatePrompt } from "@/lib/prompt-generator";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { productDetails, imageBase64, imageMediaType, brandSlug } = body;

    if (!productDetails || !brandSlug) {
      return NextResponse.json(
        { error: "productDetails and brandSlug are required" },
        { status: 400 }
      );
    }

    const result = await generatePrompt({
      productDetails,
      imageBase64,
      imageMediaType,
      brandSlug,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Prompt generate error:", error);
    return NextResponse.json(
      { error: "Failed to generate prompt" },
      { status: 500 }
    );
  }
}
