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
  views?: string[];
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

// The prompt generator may return plain JSON or an SSE stream.
// Logs the raw response so the format is visible in server console.
function parsePromptBody(body: string, brandSlug: string): GeneratePromptResult {
  console.log("[prompt-generator] raw response start:", JSON.stringify(body.slice(0, 400)));

  const trimmed = body.trimStart();

  // Plain JSON (no SSE prefix)
  if (!trimmed.startsWith("data:") && !/^\d+:/.test(trimmed)) {
    const result = tryParsePromptJson(trimmed, brandSlug);
    if (result) return result;
    throw new Error(`Non-SSE response, no image_prompt found: ${body.slice(0, 200)}`);
  }

  let accumulated = "";
  let lastResult: GeneratePromptResult | null = null;

  for (const line of body.split("\n")) {
    const t = line.trim();

    // Standard SSE: "data: <payload>"
    if (t.startsWith("data:")) {
      const payload = t.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;

      try {
        const event = JSON.parse(payload) as Record<string, unknown>;

        // Anthropic streaming text delta
        const delta = event.delta as Record<string, unknown> | undefined;
        if (delta?.type === "text_delta" && typeof delta.text === "string") {
          accumulated += delta.text;
          continue;
        }

        // Try the event itself and every nested object for image_prompt
        const found = searchForImagePrompt(event, brandSlug);
        if (found) lastResult = found;

        // Also collect any string value that contains image_prompt JSON
        for (const val of Object.values(event)) {
          if (typeof val === "string" && val.includes("image_prompt")) {
            const r = tryParsePromptJson(val, brandSlug);
            if (r) lastResult = r;
          }
        }
      } catch {
        // Non-JSON SSE data — treat as raw text chunk
        accumulated += payload;
      }
      continue;
    }

    // Vercel AI SDK stream format: "0:\"text chunk\""
    if (/^\d+:/.test(t)) {
      const payload = t.slice(t.indexOf(":") + 1).trim();
      try {
        const val = JSON.parse(payload);
        if (typeof val === "string") accumulated += val;
      } catch {
        accumulated += payload;
      }
    }
  }

  if (lastResult) return lastResult;

  if (accumulated) {
    console.log("[prompt-generator] accumulated text start:", JSON.stringify(accumulated.slice(0, 200)));
    const result = tryParsePromptJson(accumulated, brandSlug);
    if (result) return result;
  }

  throw new Error(`Could not extract image_prompt. Response: ${body.slice(0, 300)}`);
}

// Searches obj and its immediate children for a shape containing image_prompt.
function searchForImagePrompt(obj: Record<string, unknown>, brandSlug: string): GeneratePromptResult | null {
  const direct = tryParsePromptJson(JSON.stringify(obj), brandSlug);
  if (direct) return direct;
  for (const val of Object.values(obj)) {
    if (val && typeof val === "object" && !Array.isArray(val)) {
      const r = tryParsePromptJson(JSON.stringify(val), brandSlug);
      if (r) return r;
    }
  }
  return null;
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


export async function fetchAsBase64(url: string): Promise<DetailImage | null> {
  try {
    const res = await fetch(url);
    const arrayBuffer = await res.arrayBuffer();
    const buf = Buffer.from(arrayBuffer);
    const sharp = (await import("sharp")).default;
    const resized = await sharp(buf)
      .resize({ width: 1024, height: 1024, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();
    return {
      base64: resized.toString("base64"),
      media_type: "image/jpeg",
    };
  } catch {
    return null;
  }
}
