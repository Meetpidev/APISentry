// Pure heuristic classifier — no external API calls, no key required.
// Used as the fallback when GEMINI_API_KEY isn't set, or when Gemini fails.

const BREAKING_SIGNALS = [
  "breaking change", "breaking:", "no longer", "removed", "removes",
  "must now", "now required", "now requires", "incompatible",
];
const DEPRECATION_SIGNALS = ["deprecat", "will be removed", "sunset", "end of life", "legacy"];
const FEATURE_SIGNALS = ["new:", "added", "now supports", "introduces", "you can now"];

export function classifyChangelogHeuristically(rawText) {
  const lower = rawText.toLowerCase();

  let type = "feature";
  let severity = "low";

  if (BREAKING_SIGNALS.some((s) => lower.includes(s))) {
    type = "breaking";
    severity = "high";
  } else if (DEPRECATION_SIGNALS.some((s) => lower.includes(s))) {
    type = "deprecation";
    severity = "medium";
  } else if (FEATURE_SIGNALS.some((s) => lower.includes(s))) {
    type = "feature";
    severity = "low";
  }

  const firstLine = rawText.split(/\n|\.(?=\s|$)/)[0].trim();
  const title = (firstLine || "Untitled change").slice(0, 90);

  return {
    type,
    severity,
    title,
    description: rawText.trim().slice(0, 400),
  };
}