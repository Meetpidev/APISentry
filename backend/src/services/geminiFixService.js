const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent";
export async function generateFileFix({ change, filePath, originalContent, requestApiKey }) {
  const apiKey = requestApiKey || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw Object.assign(new Error("GEMINI_API_KEY is not set. Add it to backend/.env to use AI auto-fix."), { status: 400 });
  }

  const prompt = `You are a precise code-fixing agent. An external API provider announced this change:

Title: ${change.title}
Description: ${change.description}
Change type: ${change.type}
Severity: ${change.severity}

Below is the CURRENT full content of one file from a codebase that may be affected (file path: ${filePath}).
Make the MINIMAL edit needed to keep this file compatible with the announced change. Do not reformat, refactor, rename things, or touch any code unrelated to this specific change.
If this file does not actually need any change for this specific API change, return it byte-for-byte unchanged.

Respond with ONLY the full new file content. No markdown code fences, no explanation, no commentary — just the raw file content that should be written to disk.

--- CURRENT FILE CONTENT ---
${originalContent}
--- END FILE CONTENT ---`;

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
    throw Object.assign(new Error(`Gemini API error: ${errText}`), { status: 502 });
  }

  const data = await res.json();
  let text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  text = text.replace(/^```[a-zA-Z]*\n/, "").replace(/\n```$/, "").replace(/```$/, "");
  return text;
}