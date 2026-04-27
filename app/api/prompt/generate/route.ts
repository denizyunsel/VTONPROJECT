import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { generatePrompt, GeneratePromptDetails } from "@/lib/prompt-generator";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { brandSlug, details } = body as { brandSlug: string; details: GeneratePromptDetails };

    if (!brandSlug || !details) {
      return NextResponse.json(
        { error: "brandSlug and details are required" },
        { status: 400 }
      );
    }

    const result = await generatePrompt({ brandSlug, details });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Prompt generate error:", error);
    return NextResponse.json(
      { error: "Failed to generate prompt" },
      { status: 500 }
    );
  }
}
