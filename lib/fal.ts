import { fal } from "@fal-ai/client";

fal.config({ credentials: process.env.FAL_KEY });

export interface TryOnInput {
  modelImageUrl: string;
  topGarmentUrls: string[];
  bottomGarmentUrls: string[];
  prompt: string;
  backgroundImageUrl?: string;
}

export async function runTryOn(input: TryOnInput) {
  const imageUrls = [
    input.modelImageUrl,
    ...input.topGarmentUrls,
    ...input.bottomGarmentUrls,
  ];

  let finalPrompt = input.prompt;
  if (input.backgroundImageUrl) {
    imageUrls.push(input.backgroundImageUrl);
    finalPrompt = `${input.prompt}. The last image is the background/environment reference — place the model in a scene matching that background.`;
  }

  const result = await fal.subscribe("fal-ai/nano-banana-pro/edit", {
    input: {
      prompt: finalPrompt,
      image_urls: imageUrls,
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
