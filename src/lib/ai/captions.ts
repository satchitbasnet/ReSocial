import { PLATFORM_CAPTION_LIMITS, type PlatformId } from "@/lib/constants";

export interface CaptionRequest {
  title: string;
  platforms: string[];
  tone?: "professional" | "casual" | "playful";
}

export interface CaptionResult {
  caption: string;
  platformCaptions: Record<string, string>;
  source: "ai" | "template";
}

function trimToLimit(text: string, platform: string): string {
  const limit =
    PLATFORM_CAPTION_LIMITS[platform as PlatformId] ?? 2200;
  if (text.length <= limit) return text;
  return text.slice(0, limit - 3) + "...";
}

function buildTemplateCaptions(
  title: string,
  platforms: string[],
  tone: string
): CaptionResult {
  const hooks: Record<string, string> = {
    professional: `Discover ${title}. Learn more and follow for updates.`,
    casual: `${title} — had to share this one with you all.`,
    playful: `${title} 🚀 Drop a comment if you're feeling this!`,
  };

  const base = hooks[tone] ?? hooks.casual;
  const hashtags = platforms
    .map((p) => `#${p.replace(/[^a-z0-9]/gi, "")}`)
    .join(" ");

  const caption = trimToLimit(`${base}\n\n${hashtags}`, platforms[0] ?? "tiktok");

  const platformCaptions: Record<string, string> = {};
  for (const p of platforms) {
    platformCaptions[p] = trimToLimit(caption, p);
  }

  return { caption, platformCaptions, source: "template" };
}

function parseCaptionJson(
  raw: string,
  title: string,
  platforms: string[]
): CaptionResult | null {
  try {
    const cleaned = raw
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();
    const parsed = JSON.parse(cleaned) as {
      caption?: string;
      platformCaptions?: Record<string, string>;
    };
    const caption = trimToLimit(
      parsed.caption ?? title,
      platforms[0] ?? "tiktok"
    );
    const platformCaptions: Record<string, string> = {};
    for (const p of platforms) {
      platformCaptions[p] = trimToLimit(
        parsed.platformCaptions?.[p] ?? caption,
        p
      );
    }
    return { caption, platformCaptions, source: "ai" };
  } catch {
    return null;
  }
}

async function buildAiCaptions(
  title: string,
  platforms: string[],
  tone: string
): Promise<CaptionResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return buildTemplateCaptions(title, platforms, tone);
  }

  const platformHints = platforms
    .map((p) => {
      const limit = PLATFORM_CAPTION_LIMITS[p as PlatformId] ?? 2200;
      return `${p} (max ${limit} chars)`;
    })
    .join(", ");

  const model = process.env.GEMINI_MODEL ?? "gemini-flash-lite-latest";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: {
        parts: [
          {
            text: 'You write social media captions. Return JSON only: {"caption":"...","platformCaptions":{"platformId":"..."}}',
          },
        ],
      },
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `Title: ${title}\nTone: ${tone}\nPlatforms: ${platformHints}\nInclude a short hook, 2-3 relevant hashtags, and platform-specific variants.`,
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.7,
        responseMimeType: "application/json",
      },
    }),
  });

  if (!res.ok) {
    console.error("Gemini caption error:", res.status, await res.text());
    return buildTemplateCaptions(title, platforms, tone);
  }

  const data = (await res.json()) as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
    }>;
  };
  const raw = data.candidates?.[0]?.content?.parts
    ?.map((p) => p.text ?? "")
    .join("")
    .trim();
  if (!raw) return buildTemplateCaptions(title, platforms, tone);

  return (
    parseCaptionJson(raw, title, platforms) ??
    buildTemplateCaptions(title, platforms, tone)
  );
}

export async function generateCaptions(
  req: CaptionRequest
): Promise<CaptionResult> {
  const tone = req.tone ?? "casual";
  return buildAiCaptions(req.title, req.platforms, tone);
}
