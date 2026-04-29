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
  dress?: DetailItem;
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

async function attemptGeneratePrompt(
  params: GeneratePromptParams
): Promise<GeneratePromptResult> {
  const baseUrl = process.env.PROMPT_GENERATOR_BASE_URL?.replace(/\/$/, "");
  const url = `${baseUrl}/api/brands/${params.brandSlug}/generate`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ details: params.details }),
    signal: AbortSignal.timeout(90_000),
  });

  const body = await response.text().catch(() => "");

  if (!response.ok) {
    // The API sometimes wraps its Claude response in markdown code blocks and
    // returns 500. If the error body contains a "raw" field with the actual
    // prompt JSON, extract and use it instead of failing.
    try {
      const errJson = JSON.parse(body);
      if (errJson.raw) {
        const cleaned = errJson.raw
          .replace(/^```json\s*/i, "")
          .replace(/^```\s*/i, "")
          .replace(/```\s*$/i, "")
          .trim();
        const parsed = JSON.parse(cleaned);
        if (parsed.image_prompt) {
          return { brand: params.brandSlug, prompt: parsed };
        }
      }
    } catch {
      // fall through to original error
    }
    throw new Error(`Prompt generator returned ${response.status}: ${body}`);
  }

  return parsePromptBody(body, params.brandSlug);
}

// The prompt generator may return either plain JSON or an SSE stream.
// This function handles both formats and accumulates text from streaming responses.
function parsePromptBody(body: string, brandSlug: string): GeneratePromptResult {
  const trimmed = body.trimStart();

  // Plain JSON response
  if (!trimmed.startsWith("data:")) {
    const result = tryParsePromptJson(trimmed, brandSlug);
    if (result) return result;
    throw new Error(`Unexpected non-SSE response: ${body.slice(0, 200)}`);
  }

  // SSE stream: accumulate text deltas from events
  let accumulated = "";
  for (const line of body.split("\n")) {
    if (!line.startsWith("data:")) continue;
    const payload = line.slice(5).trim();
    if (!payload || payload === "[DONE]") continue;

    try {
      const event = JSON.parse(payload) as Record<string, unknown>;
      // Anthropic streaming text delta
      const delta = event.delta as Record<string, unknown> | undefined;
      if (delta?.type === "text_delta" && typeof delta.text === "string") {
        accumulated += delta.text;
        continue;
      }
      // Direct result embedded in SSE event
      if (event.image_prompt || (event.prompt as Record<string, unknown> | undefined)?.image_prompt) {
        const r = tryParsePromptJson(JSON.stringify(event), brandSlug);
        if (r) return r;
      }
    } catch {
      // Non-JSON payload — treat as a raw text chunk
      accumulated += payload;
    }
  }

  if (accumulated) {
    const result = tryParsePromptJson(accumulated, brandSlug);
    if (result) return result;
  }

  throw new Error("Could not extract image_prompt from prompt generator response");
}

function tryParsePromptJson(text: string, brandSlug: string): GeneratePromptResult | null {
  const cleaned = text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  try {
    const parsed = JSON.parse(cleaned) as Record<string, unknown>;
    if (parsed.image_prompt) {
      return { brand: brandSlug, prompt: parsed as { image_prompt: ImagePrompt } };
    }
    const promptField = parsed.prompt as Record<string, unknown> | undefined;
    if (promptField?.image_prompt) {
      return parsed as unknown as GeneratePromptResult;
    }
  } catch {
    // not valid JSON
  }
  return null;
}

export async function generatePrompt(
  params: GeneratePromptParams
): Promise<GeneratePromptResult> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      return await attemptGeneratePrompt(params);
    } catch (err) {
      lastError = err;
      if (attempt < 3) {
        await new Promise((r) => setTimeout(r, 2000 * attempt));
      }
    }
  }
  throw lastError;
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
