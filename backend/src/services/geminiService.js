// Optional AI enrichment: turns raw changelog text into a structured change.
// Only used if GEMINI_API_KEY is set — otherwise scanController falls back
// to a rule-based heuristic so the app works with zero AI keys configured.

const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent";

export async function classifyChangelogWithGemini(rawText) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const prompt = `You are classifying an API changelog entry for a developer tool.
Given the raw changelog text below, respond with ONLY valid JSON (no markdown, no backticks) in this exact shape:
{
  "type": "breaking" | "deprecation" | "feature",
  "severity": "high" | "medium" | "low",
  "title": "short one-line summary, under 90 chars",
  "description": "2-3 sentence plain-English explanation of what changed and what a developer needs to do"
}

Changelog text:
"""${rawText}"""`;

  const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.2 },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw Object.assign(new Error(`Gemini API error: ${errText}`), { status: 502 });
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  const cleaned = text.replace(/```json|```/g, "").trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    throw Object.assign(new Error("Gemini returned non-JSON output"), { status: 502 });
  }
}

// Rule-based fallback used when no GEMINI_API_KEY is configured.
export function classifyChangelogHeuristically(rawText) {
  const lower = rawText.toLowerCase();
  let type = "feature";
  let severity = "low";

  if (lower.includes("breaking") || lower.includes("removed") || lower.includes("no longer")) {
    type = "breaking";
    severity = "high";
  } else if (lower.includes("deprecat")) {
    type = "deprecation";
    severity = "medium";
  }

  const title = rawText.split(/\n|\./)[0].slice(0, 90).trim() || "Untitled change";

  return {
    type,
    severity,
    title,
    description: rawText.trim().slice(0, 400),
  };
}