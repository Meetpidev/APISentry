import { classifyChangelogHeuristically } from "./changelogClassifier.js";

const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

async function classifyWithGemini(rawText, requestApiKey) {
  const apiKey = requestApiKey || process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const prompt = `You are classifying a piece of text about a third-party API for a developer tool. The text might be a formal changelog entry, or it might be a raw diff of lines added/removed from a documentation page (prefixed "ADDED TO DOCS:" / "REMOVED FROM DOCS:").

Read it for MEANING, not just keywords — e.g. "we simplified the authentication flow" or "the response format is now more consistent" can be breaking changes even with no explicit "breaking" wording, if they imply an existing integration would behave differently.

Respond with ONLY valid JSON (no markdown, no backticks) in this exact shape:
{
  "type": "breaking" | "deprecation" | "feature",
  "severity": "high" | "medium" | "low",
  "title": "short one-line summary, under 90 chars",
  "description": "2-3 sentence plain-English explanation of what changed and what a developer should check or do",
  "confidence": "high" | "medium" | "low"
}

If the text is too vague or ambiguous to confidently classify, use "confidence": "low" and lean toward the more cautious classification (prefer "breaking" over "feature" when genuinely unsure — a missed breaking change is worse than a false alarm).

Text to classify:
"""${rawText.slice(0, 6000)}"""`;

  const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.1 },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini API error: ${errText}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  const cleaned = text.replace(/```json|```/g, "").trim();

  const parsed = JSON.parse(cleaned); // throws if malformed — caller catches
  if (!["breaking", "deprecation", "feature"].includes(parsed.type)) throw new Error("Gemini returned an invalid type");
  if (!["high", "medium", "low"].includes(parsed.severity)) throw new Error("Gemini returned an invalid severity");
  return parsed;
}

// Single entry point used everywhere text needs classifying — manual scans,
// changelog fetches, and docs diffs alike. Always returns something usable;
// never throws.
export async function classifyText(rawText, requestApiKey) {
  try {
    const result = await classifyWithGemini(rawText, requestApiKey);
    if (result) {
      return {
        type: result.type,
        severity: result.severity,
        title: result.title,
        description: result.description,
        method: "gemini",
      };
    }
  } catch (err) {
    console.error("Gemini classification failed, falling back to heuristic:", err.message);
  }

  return { ...classifyChangelogHeuristically(rawText), method: "heuristic" };
}