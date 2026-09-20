// Splits a fetched changelog page's text into individual entries rather
// than treating the whole page as one blob. Works generically off common
// changelog structures (table rows, bullet lists, dated entries) rather
// than being hardcoded to Razorpay's exact HTML.
import { createHash } from "crypto";

const MIN_ENTRY_LENGTH = 20;
const MAX_ENTRY_LENGTH = 500;

// Lines that look like real changelog content typically: start with a
// month/date, or are reasonably long sentences — not nav labels, not
// single words, not pure punctuation/table separators.
function looksLikeEntry(line) {
  if (line.length < MIN_ENTRY_LENGTH || line.length > MAX_ENTRY_LENGTH) return false;
  if (/^-{2,}$/.test(line)) return false; // markdown-table separator rows
  if (/^(was this page helpful|on this page)\??$/i.test(line)) return false;
  return true;
}

export function parseChangelogEntries(rawText) {
  const lines = rawText
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .filter(looksLikeEntry);

  const seen = new Set();
  const entries = [];

  for (const line of lines) {
    const hash = createHash("sha256").update(line).digest("hex");
    if (seen.has(hash)) continue; // de-dupe repeated lines on the same page
    seen.add(hash);
    entries.push({ text: line, hash });
  }

  return entries;
}