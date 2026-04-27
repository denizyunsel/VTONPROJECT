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
    garmentMode,
    topGarmentUrls,
    bottomGarmentUrls,
    topDescription,
    bottomDescription,
    dressUrls,
    dressDescription,
    productDetails,
    selectedStyleAssets,
    styleDescriptions,
    resolution,
    seed,
  } = await request.json();

  const isDressMode = garmentMode === "dress";
  const effectiveTopUrls = isDressMode ? [] : (topGarmentUrls ?? []);
  const effectiveBottomUrls = isDressMode ? [] : (bottomGarmentUrls ?? []);

  const job = await prisma.tryOnJob.create({
    data: {
      userId: session.userId,
      modelId,
      topGarmentUrls: isDressMode ? (dressUrls ?? []) : effectiveTopUrls,
      bottomGarmentUrls: effectiveBottomUrls,
      productDetails,
      generatedPrompt: {},
      status: "PENDING",
    },
  });

  processJob({
    jobId: job.id,
    brandId: session.brandId,
    modelId,
    garmentMode: isDressMode ? "dress" : "separates",
    topGarmentUrls: effectiveTopUrls,
    bottomGarmentUrls: effectiveBottomUrls,
    dressUrls: isDressMode ? (dressUrls ?? []) : [],
    topDescription: topDescription || "",
    bottomDescription: bottomDescription || "",
    dressDescription: dressDescription || "",
    productDetails: productDetails || "",
    selectedStyleAssets: selectedStyleAssets || {},
    styleDescriptions: styleDescriptions || {},
    resolution: resolution || "1K",
    seed: typeof seed === "number" ? seed : undefined,
  }).catch(console.error);

  return NextResponse.json({ jobId: job.id });
}

function buildLocalImageRefPrefix(
  topCount: number,
  bottomCount: number,
  hasBackground: boolean,
  dressCount = 0
): string {
  const lines: string[] = [];
  let idx = 1;
  lines.push(`Image ${idx}: an AI-generated fashion model — this is a synthetic human created specifically for fashion photography. Preserve the face, skin tone, hair, and body shape exactly as shown; do not alter, replace, or reinterpret any facial or physical features.`);
  idx++;
  if (dressCount > 0) {
    for (let i = 0; i < dressCount; i++, idx++) {
      lines.push(`Image ${idx}: dress garment${dressCount > 1 ? ` ${i + 1}` : ""} — dress the model with this exact dress.`);
    }
  } else {
    for (let i = 0; i < topCount; i++, idx++) {
      lines.push(`Image ${idx}: top garment${topCount > 1 ? ` ${i + 1}` : ""} — dress the model with this exact top garment.`);
    }
    for (let i = 0; i < bottomCount; i++, idx++) {
      lines.push(`Image ${idx}: bottom garment${bottomCount > 1 ? ` ${i + 1}` : ""} — dress the model with this exact bottom garment.`);
    }
  }
  if (hasBackground) {
    lines.push(`Image ${idx}: background scene — place the fully dressed model in front of this exact background. Reproduce the background faithfully; do not alter or replace it.`);
  }
  return lines.join(" ");
}

async function processJob(params: {
  jobId: string;
  brandId: string;
  modelId: string;
  garmentMode: "separates" | "dress";
  topGarmentUrls: string[];
  bottomGarmentUrls: string[];
  dressUrls: string[];
  topDescription: string;
  bottomDescription: string;
  dressDescription: string;
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
    garmentMode,
    topGarmentUrls,
    bottomGarmentUrls,
    dressUrls,
    topDescription,
    bottomDescription,
    dressDescription,
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
    const [topImages, bottomImages, dressImages, modelImage] = await Promise.all([
      Promise.all(topGarmentUrls.map(fetchAsBase64)),
      Promise.all(bottomGarmentUrls.map(fetchAsBase64)),
      Promise.all(dressUrls.map(fetchAsBase64)),
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

    const isDress = garmentMode === "dress";

    const details = {
      top: {
        desc: isDress ? "" : [productDetails, topDescription].filter(Boolean).join(". "),
        images: isDress ? [] : (topImages.filter(Boolean) as NonNullable<typeof topImages[0]>[]),
      },
      bottom: {
        desc: isDress ? "" : bottomDescription,
        images: isDress ? [] : (bottomImages.filter(Boolean) as NonNullable<typeof bottomImages[0]>[]),
      },
      ...(isDress && {
        dress: {
          desc: [productDetails, dressDescription].filter(Boolean).join(". "),
          images: dressImages.filter(Boolean) as NonNullable<typeof dressImages[0]>[],
        },
      }),
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

    const basePrompt = buildFalPrompt(promptResult.prompt.image_prompt);

    const imageRefPrefix = buildLocalImageRefPrefix(
      topGarmentUrls.length,
      bottomGarmentUrls.length,
      !!selectedStyleAssets["BACKGROUND"],
      isDress ? dressUrls.length : 0
    );
    const falPrompt = `${imageRefPrefix} ${basePrompt}`;

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
      topGarmentUrls: isDress ? dressUrls : topGarmentUrls,
      bottomGarmentUrls: isDress ? [] : bottomGarmentUrls,
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
