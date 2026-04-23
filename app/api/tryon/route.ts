import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { runTryOn } from "@/lib/fal";
import {
  generatePrompt,
  buildFalPrompt,
  fetchAsBase64,
  type DetailItem,
} from "@/lib/prompt-generator";

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
    styleDescriptions,
    resolution,
    seed,
  } = await request.json();

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

  processJob({
    jobId: job.id,
    brandId: session.brandId,
    modelId,
    topGarmentUrls,
    bottomGarmentUrls,
    topDescription: topDescription || "",
    bottomDescription: bottomDescription || "",
    productDetails: productDetails || "",
    selectedStyleAssets: selectedStyleAssets || {},
    styleDescriptions: styleDescriptions || {},
    resolution: resolution || "1K",
    seed: typeof seed === "number" ? seed : undefined,
  }).catch(console.error);

  return NextResponse.json({ jobId: job.id });
}

async function processJob(params: {
  jobId: string;
  brandId: string;
  modelId: string;
  topGarmentUrls: string[];
  bottomGarmentUrls: string[];
  topDescription: string;
  bottomDescription: string;
  productDetails: string;
  selectedStyleAssets: Record<string, string>;
  styleDescriptions: Record<string, string>;
  resolution: "1K" | "2K" | "4K";
  seed?: number;
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
    styleDescriptions,
    resolution,
    seed,
  } = params;

  try {
    await prisma.tryOnJob.update({
      where: { id: jobId },
      data: { status: "GENERATING_PROMPT" },
    });

    const [brand, aiModel] = await Promise.all([
      prisma.brand.findUnique({ where: { id: brandId } }),
      prisma.aIModel.findUnique({ where: { id: modelId } }),
    ]);

    // Fetch all images in parallel
    const [topImages, bottomImages, modelImage] = await Promise.all([
      Promise.all(topGarmentUrls.map(fetchAsBase64)),
      Promise.all(bottomGarmentUrls.map(fetchAsBase64)),
      aiModel?.imageUrl ? fetchAsBase64(aiModel.imageUrl) : Promise.resolve(null),
    ]);

    // Fetch style asset images from DB then as base64
    const assetTypeMap: Record<string, string> = {
      LIGHTING: "lighting",
      POSE: "pose",
      BACKGROUND: "environment",
      COMPOSITION: "composition",
    };

    const styleDetails: Record<string, DetailItem> = {
      lighting: { desc: "", images: [] },
      pose: { desc: "", images: [] },
      environment: { desc: "", images: [] },
      composition: { desc: "", images: [] },
    };

    const allAssetTypes = new Set([
      ...Object.keys(selectedStyleAssets),
      ...Object.keys(styleDescriptions),
    ]);

    await Promise.all(
      Array.from(allAssetTypes).map(async (assetType) => {
        const key = assetTypeMap[assetType];
        if (!key) return;

        const userDesc = styleDescriptions[assetType] || "";
        const assetId = selectedStyleAssets[assetType];

        if (assetId) {
          const asset = await prisma.styleAsset.findUnique({ where: { id: assetId } });
          if (asset) {
            styleDetails[key].desc = [asset.label, userDesc].filter(Boolean).join(". ");
            if (asset.imageUrl) {
              const img = await fetchAsBase64(asset.imageUrl);
              if (img) styleDetails[key].images = [img];
            }
          }
        } else if (userDesc) {
          styleDetails[key].desc = userDesc;
        }
      })
    );

    const topDesc = [productDetails, topDescription].filter(Boolean).join(". ");

    const details = {
      top: {
        desc: topDesc,
        images: topImages.filter(Boolean) as NonNullable<typeof topImages[0]>[],
      },
      bottom: {
        desc: bottomDescription,
        images: bottomImages.filter(Boolean) as NonNullable<typeof bottomImages[0]>[],
      },
      model: {
        desc: "",
        images: modelImage ? [modelImage] : [],
      },
      lighting: styleDetails.lighting,
      pose: styleDetails.pose,
      environment: styleDetails.environment,
      composition: styleDetails.composition,
    };

    const promptResult = await generatePrompt({
      brandSlug: brand!.slug,
      details,
    });

    const falPrompt = buildFalPrompt(promptResult.prompt.image_prompt);

    await prisma.tryOnJob.update({
      where: { id: jobId },
      data: { generatedPrompt: promptResult as object },
    });

    await prisma.tryOnJob.update({
      where: { id: jobId },
      data: { status: "PROCESSING" },
    });

    const backgroundAssetId = selectedStyleAssets["BACKGROUND"];
    let backgroundImageUrl: string | undefined;
    if (backgroundAssetId) {
      const bgAsset = await prisma.styleAsset.findUnique({ where: { id: backgroundAssetId } });
      if (bgAsset?.imageUrl) backgroundImageUrl = bgAsset.imageUrl;
    }

    const falResult = await runTryOn({
      modelImageUrl: aiModel!.imageUrl,
      topGarmentUrls,
      bottomGarmentUrls,
      prompt: falPrompt,
      backgroundImageUrl,
      resolution,
      seed,
    });

    const resultImageUrl = falResult.images[0]?.url;
    if (!resultImageUrl) throw new Error("No result image from fal.ai");

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
