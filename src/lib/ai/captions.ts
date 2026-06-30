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

async function buildAiCaptions(
  title: string,
  platforms: string[],
  tone: string
): Promise<CaptionResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return buildTemplateCaptions(title, platforms, tone);
  }

  const platformHints = platforms
    .map((p) => {
      const limit = PLATFORM_CAPTION_LIMITS[p as PlatformId] ?? 2200;
      return `${p} (max ${limit} chars)`;
    })
    .join(", ");

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
      temperature: 0.7,
      messages: [
        {
          role: "system",
          content:
            "You write social media captions. Return JSON only: {\"caption\":\"...\",\"platformCaptions\":{\"platformId\":\"...\"}}",
        },
        {
          role: "user",
          content: `Title: ${title}\nTone: ${tone}\nPlatforms: ${platformHints}\nInclude a short hook, 2-3 relevant hashtags, and platform-specific variants.`,
        },
      ],
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    return buildTemplateCaptions(title, platforms, tone);
  }

  const data = await res.json();
  const raw = data.choices?.[0]?.message?.content;
  if (!raw) return buildTemplateCaptions(title, platforms, tone);

  try {
    const parsed = JSON.parse(raw) as {
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
    return buildTemplateCaptions(title, platforms, tone);
  }
}

export async function generateCaptions(
  req: CaptionRequest
): Promise<CaptionResult> {
  const tone = req.tone ?? "casual";
  return buildAiCaptions(req.title, req.platforms, tone);
}
