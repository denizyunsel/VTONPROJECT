import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { runTryOn } from "@/lib/fal";
import { generatePrompt, buildFalPrompt } from "@/lib/prompt-generator";

const BLOB_CONFIGURED =
  !!process.env.BLOB_READ_WRITE_TOKEN &&
  !process.env.BLOB_READ_WRITE_TOKEN.includes("placeholder");

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const {
    modelId,
    topGarmentUrls,
    bottomGarmentUrls,
    topDescription,
    bottomDescription,
    productDetails,
    selectedStyleAssets,
  } = await request.json();

  // 1. Create job record
  const job = await prisma.tryOnJob.create({
    data: {
      userId: session.userId,
      modelId,
      topGarmentUrls,
      bottomGarmentUrls,
      productDetails,
      generatedPrompt: {},
      status: "PENDING",
    },
  });

  // Run the job async — respond immediately with jobId
  processJob({
    jobId: job.id,
    userId: session.userId,
    brandId: session.brandId,
    modelId,
    topGarmentUrls,
    bottomGarmentUrls,
    topDescription: topDescription || "",
    bottomDescription: bottomDescription || "",
    productDetails,
    selectedStyleAssets: selectedStyleAssets || {},
  }).catch(console.error);

  return NextResponse.json({ jobId: job.id });
}

async function processJob(params: {
  jobId: string;
  userId: string;
  brandId: string;
  modelId: string;
  topGarmentUrls: string[];
  bottomGarmentUrls: string[];
  topDescription: string;
  bottomDescription: string;
  productDetails: string;
  selectedStyleAssets: Record<string, string>;
}) {
  const {
    jobId,
    brandId,
    modelId,
    topGarmentUrls,
    bottomGarmentUrls,
    topDescription,
    bottomDescription,
    productDetails,
    selectedStyleAssets,
  } = params;

  try {
    // 2. Describe selected style asset images via vision API
    const styleDescriptions: Record<string, string> = {};
    for (const [assetType, assetId] of Object.entries(selectedStyleAssets)) {
      if (!assetId) continue;
      const asset = await prisma.styleAsset.findUnique({
        where: { id: assetId },
      });
      if (!asset) continue;
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/vision/describe`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ imageUrl: asset.imageUrl }),
          }
        );
        const data = await res.json();
        if (data.description) styleDescriptions[assetType] = data.description;
      } catch {
        // vision description is best-effort
      }
    }

    // 3. Generate prompt
    await prisma.tryOnJob.update({
      where: { id: jobId },
      data: { status: "GENERATING_PROMPT" },
    });

    const brand = await prisma.brand.findUnique({ where: { id: brandId } });
    const aiModel = await prisma.aIModel.findUnique({ where: { id: modelId } });

    const combinedProductDetails = [
      productDetails,
      topDescription,
      bottomDescription,
    ]
      .filter(Boolean)
      .join(", ");

    let modelImageBase64: string | undefined;
    let modelImageMediaType: string | undefined;
    if (aiModel?.imageUrl) {
      try {
        const imgRes = await fetch(aiModel.imageUrl);
        const arrayBuffer = await imgRes.arrayBuffer();
        modelImageBase64 = Buffer.from(arrayBuffer).toString("base64");
        modelImageMediaType = (imgRes.headers.get("content-type") || "image/jpeg") as string;
      } catch {
        // model image fetch is best-effort
      }
    }

    const promptResult = await generatePrompt({
      productDetails: combinedProductDetails,
      brandSlug: brand!.slug,
      imageBase64: modelImageBase64,
      imageMediaType: modelImageMediaType,
    });

    const falPrompt = buildFalPrompt(
      promptResult.prompt.image_prompt,
      styleDescriptions
    );

    await prisma.tryOnJob.update({
      where: { id: jobId },
      data: { generatedPrompt: promptResult as object },
    });

    // 4. Run Fal.ai try-on
    await prisma.tryOnJob.update({
      where: { id: jobId },
      data: { status: "PROCESSING" },
    });

    const falResult = await runTryOn({
      modelImageUrl: aiModel!.imageUrl,
      topGarmentUrls,
      bottomGarmentUrls,
      prompt: falPrompt,
    });

    const resultImageUrl = falResult.images[0]?.url;
    if (!resultImageUrl) throw new Error("No result image from fal.ai");

    // 5. Save result image to Vercel Blob (if configured), otherwise use fal URL directly
    let finalResultUrl = resultImageUrl;
    if (BLOB_CONFIGURED) {
      const { put } = await import("@vercel/blob");
      const imageRes = await fetch(resultImageUrl);
      const imageBuffer = await imageRes.arrayBuffer();
      const blob = await put(
        `results/${jobId}/result.jpg`,
        Buffer.from(imageBuffer),
        { access: "public", contentType: "image/jpeg" }
      );
      finalResultUrl = blob.url;
    }

    // 6. Update job as completed
    await prisma.tryOnJob.update({
      where: { id: jobId },
      data: { status: "COMPLETED", resultUrl: finalResultUrl },
    });
  } catch (error) {
    console.error(`Job ${jobId} failed:`, error);
    await prisma.tryOnJob.update({
      where: { id: jobId },
      data: {
        status: "FAILED",
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      },
    });
  }
}
