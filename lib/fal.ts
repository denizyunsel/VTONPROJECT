import { fal } from "@fal-ai/client";
import sharp from "sharp";

fal.config({ credentials: process.env.FAL_KEY });

export interface TryOnInput {
  modelImageUrl: string;
  topGarmentUrls: string[];
  bottomGarmentUrls: string[];
  prompt: string;
  backgroundImageUrl?: string;
  resolution?: "1K" | "2K" | "4K";
  seed?: number;
}

async function fetchBuffer(url: string): Promise<Buffer> {
  const res = await fetch(url);
  return Buffer.from(await res.arrayBuffer());
}

async function removeBackground(imageUrl: string): Promise<Buffer> {
  const result = await fal.subscribe("fal-ai/bria/background/remove", {
    input: { image_url: imageUrl },
  });
  const data = result.data as { image: { url: string } };
  return fetchBuffer(data.image.url);
}

async function compositeOnBackground(
  cutoutBuffer: Buffer,
  backgroundUrl: string
): Promise<Buffer> {
  const [cutout, bgRaw] = await Promise.all([
    sharp(cutoutBuffer).ensureAlpha().toBuffer({ resolveWithObject: true }),
    fetchBuffer(backgroundUrl),
  ]);

  const { width, height } = cutout.info;

  const bg = await sharp(bgRaw)
    .resize(width, height, { fit: "cover", position: "center" })
    .toBuffer();

  return sharp(bg)
    .composite([{ input: cutout.data, blend: "over" }])
    .jpeg({ quality: 92 })
    .toBuffer();
}

export async function runTryOn(input: TryOnInput): Promise<{ images: Array<{ url: string }> }> {
  const imageUrls = [
    input.modelImageUrl,
    ...input.topGarmentUrls,
    ...input.bottomGarmentUrls,
  ];

  // Background sadece prompt referansı olarak gönder (spesifik görsel için ayrı pipeline var)
  let finalPrompt = input.prompt;
  if (input.backgroundImageUrl) {
    finalPrompt = `${input.prompt}. Use a clean neutral studio background.`;
  }

  const result = await fal.subscribe("fal-ai/nano-banana-pro/edit", {
    input: {
      prompt: finalPrompt,
      image_urls: imageUrls,
      ...(input.resolution ? { resolution: input.resolution } : {}),
      ...(input.seed != null ? { seed: input.seed } : {}),
    },
    logs: true,
    onQueueUpdate: (update) => {
      if (update.status === "IN_PROGRESS") {
        update.logs.map((log: { message: string }) => log.message).forEach(console.log);
      }
    },
  });

  const tryOnData = result.data as { images: Array<{ url: string }> };
  const tryOnUrl = tryOnData.images[0]?.url;

  if (!tryOnUrl) return tryOnData;

  // Spesifik background varsa: remove bg + composite
  if (input.backgroundImageUrl) {
    const cutout = await removeBackground(tryOnUrl);
    const composited = await compositeOnBackground(cutout, input.backgroundImageUrl);

    const file = new File([new Uint8Array(composited)], "result.jpg", { type: "image/jpeg" });
    const uploadedUrl = await fal.storage.upload(file);
    return { images: [{ url: uploadedUrl }] };
  }

  return tryOnData;
}
