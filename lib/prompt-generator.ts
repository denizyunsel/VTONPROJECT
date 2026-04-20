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

export interface GeneratePromptParams {
  productDetails: string;
  imageBase64?: string;
  imageMediaType?: string;
  brandSlug: string;
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

  const body: Record<string, string> = {
    product_details: params.productDetails,
  };
  if (params.imageBase64) body.image_base64 = params.imageBase64;
  if (params.imageMediaType) body.image_media_type = params.imageMediaType;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Prompt generator returned ${response.status}`);
  }

  return response.json();
}

export function buildFalPrompt(
  imagePrompt: ImagePrompt,
  styleDescriptions: Record<string, string>
): string {
  const parts = [
    imagePrompt.subject_description,
    styleDescriptions.POSE || imagePrompt.pose_and_body_language,
    imagePrompt.outfit,
    imagePrompt.environment,
    styleDescriptions.LIGHTING || imagePrompt.lighting,
    imagePrompt.composition,
    imagePrompt.styling,
    imagePrompt.technical_specs,
  ].filter(Boolean);
  return parts.join(". ");
}
