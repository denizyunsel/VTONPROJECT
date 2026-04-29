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
    topGarmentImages,
    bottomGarmentImages,
    dressImages: dressImagesRaw,
    topDescription,
    bottomDescription,
    dressDescription,
    productDetails,
    selectedStyleAssets,
    styleDescriptions,
    resolution,
    seed,
  } = await request.json();

  type GarmentImageRaw = { url: string; view: string };
  const isDressMode = garmentMode === "dress";
  const topImgs: GarmentImageRaw[] = isDressMode ? [] : (topGarmentImages ?? []);
  const bottomImgs: GarmentImageRaw[] = isDressMode ? [] : (bottomGarmentImages ?? []);
  const dressImgs: GarmentImageRaw[] = isDressMode ? (dressImagesRaw ?? []) : [];

  const job = await prisma.tryOnJob.create({
    data: {
      userId: session.userId,
      modelId,
      topGarmentUrls: isDressMode ? dressImgs.map((i) => i.url) : topImgs.map((i) => i.url),
      bottomGarmentUrls: bottomImgs.map((i) => i.url),
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
    topGarmentImages: topImgs,
    bottomGarmentImages: bottomImgs,
    dressImages: dressImgs,
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

type GarmentImageRaw = { url: string; view: string };

const VIEW_LABELS: Record<string, string> = {
  front: "FRONT VIEW",
  back: "BACK VIEW",
  side: "SIDE VIEW",
  detail: "DETAIL",
};

function buildLocalImageRefPrefix(
  topImgs: GarmentImageRaw[],
  bottomImgs: GarmentImageRaw[],
  hasBackground: boolean,
  dressImgs: GarmentImageRaw[] = []
): string {
  const lines: string[] = [];
  let idx = 1;
  lines.push(`Image ${idx}: an AI-generated fashion model — this is a synthetic human created specifically for fashion photography. Preserve the face, skin tone, hair, and body shape exactly as shown; do not alter, replace, or reinterpret any facial or physical features.`);
  idx++;
  if (dressImgs.length > 0) {
    for (const img of dressImgs) {
      const viewLabel = VIEW_LABELS[img.view] || img.view.toUpperCase();
      lines.push(`Image ${idx}: dress garment ${viewLabel} — dress the model with this exact dress.`);
      idx++;
    }
  } else {
    for (const img of topImgs) {
      const viewLabel = VIEW_LABELS[img.view] || img.view.toUpperCase();
      lines.push(`Image ${idx}: top garment ${viewLabel} — use this view to understand the top garment design and dress the model accordingly.`);
      idx++;
    }
    for (const img of bottomImgs) {
      const viewLabel = VIEW_LABELS[img.view] || img.view.toUpperCase();
      lines.push(`Image ${idx}: bottom garment ${viewLabel} — use this view to understand the bottom garment design and dress the model accordingly.`);
      idx++;
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
  topGarmentImages: GarmentImageRaw[];
  bottomGarmentImages: GarmentImageRaw[];
  dressImages: GarmentImageRaw[];
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
    topGarmentImages,
    bottomGarmentImages,
    dressImages,
    topDescription,
    bottomDescription,
    dressDescription,
    productDetails,
    selectedStyleAssets,
    styleDescriptions,
    resolution,
    seed,
  } = params;

  const topGarmentUrls = topGarmentImages.map((i) => i.url);
  const bottomGarmentUrls = bottomGarmentImages.map((i) => i.url);
  const dressUrls = dressImages.map((i) => i.url);

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
    const [topImages, bottomImages, dressBase64Images, modelImage] = await Promise.all([
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
            styleDetails[key].desc = [asset.promptDescription || asset.label, userDesc].filter(Boolean).join(". ");
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
        views: isDress ? [] : topGarmentImages.map((i) => i.view),
      },
      bottom: {
        desc: isDress ? "" : bottomDescription,
        images: isDress ? [] : (bottomImages.filter(Boolean) as NonNullable<typeof bottomImages[0]>[]),
        views: isDress ? [] : bottomGarmentImages.map((i) => i.view),
      },
      ...(isDress && {
        dress: {
          desc: [productDetails, dressDescription].filter(Boolean).join(". "),
          images: dressBase64Images.filter(Boolean) as NonNullable<typeof dressBase64Images[0]>[],
          views: dressImages.map((i) => i.view),
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
      isDress ? [] : topGarmentImages,
      isDress ? [] : bottomGarmentImages,
      !!selectedStyleAssets["BACKGROUND"],
      isDress ? dressImages : []
    );
    const falPrompt = `${imageRefPrefix} ${basePrompt}`;

    if (!aiModel) throw new Error("AI model not found");

    await prisma.tryOnJob.update({
      where: { id: jobId },
      data: { generatedPrompt: promptResult as object, status: "PROCESSING" },
    });

    const backgroundAssetId = selectedStyleAssets["BACKGROUND"];
    let backgroundImageUrl: string | undefined;
    if (backgroundAssetId) {
      const bgAsset = await prisma.styleAsset.findUnique({ where: { id: backgroundAssetId } });
      if (bgAsset?.imageUrl) backgroundImageUrl = bgAsset.imageUrl;
    }

    const falResult = await runTryOn({
      modelImageUrl: aiModel.imageUrl,
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
    try {
      await prisma.tryOnJob.update({
        where: { id: jobId },
        data: {
          status: "FAILED",
          errorMessage: error instanceof Error ? error.message : String(error),
        },
      });
    } catch (dbError) {
      console.error(`Job ${jobId}: also failed to write FAILED status:`, dbError);
    }
  }
}
