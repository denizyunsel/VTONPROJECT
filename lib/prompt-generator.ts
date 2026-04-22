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
  const baseUrl = process.env.PROMPT_GENERATOR_BASE_URL?.replace(/\/$/, "");
  const url = `${baseUrl}/api/brands/${params.brandSlug}/generate`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ details: params.details }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "(no body)");
    throw new Error(`Prompt generator returned ${response.status}: ${body}`);
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

function detectMediaType(buf: Buffer): string {
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "image/png";
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return "image/gif";
  if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46) return "image/webp";
  return "image/jpeg";
}

export async function fetchAsBase64(url: string): Promise<DetailImage | null> {
  try {
    const res = await fetch(url);
    const arrayBuffer = await res.arrayBuffer();
    const buf = Buffer.from(arrayBuffer);
    return {
      base64: buf.toString("base64"),
      media_type: detectMediaType(buf),
    };
  } catch {
    return null;
  }
}
