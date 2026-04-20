import { fal } from "@fal-ai/client";

fal.config({ credentials: process.env.FAL_KEY });

export interface TryOnInput {
  modelImageUrl: string;
  topGarmentUrls: string[];
  bottomGarmentUrls: string[];
  prompt: string;
}

export async function runTryOn(input: TryOnInput) {
  const result = await fal.subscribe("fal-ai/nano-banana-pro/edit", {
    input: {
      prompt: input.prompt,
      image_urls: [
        input.modelImageUrl,
        ...input.topGarmentUrls,
        ...input.bottomGarmentUrls,
      ],
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
