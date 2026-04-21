export interface ImagePrompt {
  subject_description: string;
  pose_and_body_language: string;
  outfit: string;
  environment: string;
  lighting: string;
  composition: string;
  styling: string;
  technical_specs: string;
}

export interface DetailImage {
  base64: string;
  media_type: string;
}

export interface DetailItem {
  desc: string;
  images: DetailImage[];
}

export interface GeneratePromptDetails {
  top: DetailItem;
  bottom: DetailItem;
  model: DetailItem;
  lighting: DetailItem;
  pose: DetailItem;
  environment: DetailItem;
  composition: DetailItem;
}

export interface GeneratePromptParams {
  brandSlug: string;
  details: GeneratePromptDetails;
}

export interface GeneratePromptResult {
  brand: string;
  prompt: {
    image_prompt: ImagePrompt;
  };
}

export async function generatePrompt(
  params: GeneratePromptParams
): Promise<GeneratePromptResult> {
  const baseUrl = process.env.PROMPT_GENERATOR_BASE_URL;
  const url = `${baseUrl}/api/brands/${params.brandSlug}/generate`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ details: params.details }),
  });

  if (!response.ok) {
    throw new Error(`Prompt generator returned ${response.status}`);
  }

  return response.json();
}

export function buildFalPrompt(imagePrompt: ImagePrompt): string {
  const parts = [
    imagePrompt.subject_description,
    imagePrompt.pose_and_body_language,
    imagePrompt.outfit,
    imagePrompt.environment,
    imagePrompt.lighting,
    imagePrompt.composition,
    imagePrompt.styling,
    imagePrompt.technical_specs,
  ].filter(Boolean);
  return parts.join(". ");
}

export async function fetchAsBase64(url: string): Promise<DetailImage | null> {
  try {
    const res = await fetch(url);
    const arrayBuffer = await res.arrayBuffer();
    return {
      base64: Buffer.from(arrayBuffer).toString("base64"),
      media_type: res.headers.get("content-type") || "image/jpeg",
    };
  } catch {
    return null;
  }
}
