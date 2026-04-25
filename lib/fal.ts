import { fal } from "@fal-ai/client";

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

export async function runTryOn(input: TryOnInput): Promise<{ images: Array<{ url: string }> }> {
  const imageUrls = [
    input.modelImageUrl,
    ...input.topGarmentUrls,
    ...input.bottomGarmentUrls,
  ];

  if (input.backgroundImageUrl) {
    imageUrls.push(input.backgroundImageUrl);
  }

  const result = await fal.subscribe("fal-ai/nano-banana-pro/edit", {
    input: {
      prompt: input.prompt,
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

  return result.data as { images: Array<{ url: string }> };
}
