const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

// Given a detected change's title/description, asks Gemini to propose a
// literal or regex pattern that would plausibly appear in code still using
// the old/deprecated behavior. This is inherently a best-effort guess —
// Gemini doesn't see your actual codebase, so the generated pattern needs
// human review before being trusted at scale (surfaced clearly in the UI
// as "AI-suggested — review before running").
export async function suggestPatternFromChange({ title, description, type, requestApiKey }) {
  const apiKey = requestApiKey || process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const prompt = `An API provider made this change:

Title: ${title}
Type: ${type}
Description: ${description}

Suggest ONE regex pattern (JavaScript regex syntax, no delimiters) that would
likely match code STILL USING the OLD/deprecated behavior being described —
i.e. a pattern that should trigger a "you need to update this" flag.

If the description is too vague to derive a reliable code pattern (e.g. it
describes a UI-only or non-code-facing change), respond with exactly: NONE

Respond with ONLY the regex pattern itself, or NONE. No explanation, no
markdown, no delimiters like slashes or backticks.`;

  const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.1 },
    }),
  });

  if (!res.ok) throw new Error(`Gemini API error: ${await res.text()}`);

  const data = await res.json();
  const text = (data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "").trim();

  if (!text || text === "NONE") return null;

  // Sanity-check it's actually a valid regex before handing it back —
  // a malformed pattern would crash the scan later otherwise.
  try {
    new RegExp(text);
  } catch {
    return null;
  }

  return text;
}