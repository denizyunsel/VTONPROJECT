import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { imageUrl } = await request.json();
    if (!imageUrl) {
      return NextResponse.json(
        { error: "imageUrl is required" },
        { status: 400 }
      );
    }

    // Fetch image and convert to base64
    const imageRes = await fetch(imageUrl);
    const arrayBuffer = await imageRes.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");
    const contentType =
      (imageRes.headers.get("content-type") as
        | "image/jpeg"
        | "image/png"
        | "image/gif"
        | "image/webp") || "image/jpeg";

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 300,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: contentType, data: base64 },
            },
            {
              type: "text",
              text: "Describe this image as a photography direction instruction. If there is lighting, describe the lighting type. If there is a pose, describe the body language. If there is a background, describe the environment. Write one concise paragraph in English.",
            },
          ],
        },
      ],
    });

    const description =
      message.content[0].type === "text" ? message.content[0].text : "";

    return NextResponse.json({ description });
  } catch (error) {
    console.error("Vision describe error:", error);
    return NextResponse.json(
      { error: "Failed to describe image" },
      { status: 500 }
    );
  }
}
