const POSITIVE = [
  "love",
  "great",
  "amazing",
  "awesome",
  "excellent",
  "fantastic",
  "happy",
  "best",
  "thank",
  "beautiful",
  "perfect",
  "wonderful",
];

const NEGATIVE = [
  "hate",
  "bad",
  "terrible",
  "awful",
  "worst",
  "horrible",
  "angry",
  "disappointed",
  "poor",
  "broken",
  "scam",
  "fake",
];

export type SentimentLabel = "positive" | "negative" | "neutral";

export function analyzeSentiment(text: string): SentimentLabel {
  const lower = text.toLowerCase();
  let score = 0;
  for (const w of POSITIVE) {
    if (lower.includes(w)) score++;
  }
  for (const w of NEGATIVE) {
    if (lower.includes(w)) score--;
  }
  if (score > 0) return "positive";
  if (score < 0) return "negative";
  return "neutral";
}
