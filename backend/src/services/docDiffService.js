// Line-level diff between two docs snapshots, with noise filtering so
// dynamic page furniture (timestamps, "updated X days ago", cookie
// banners, ad slots, view counters) doesn't generate false-positive
// "changes" on every scan.
import { diffLines } from "diff";

const MIN_LINE_LENGTH = 8;
const MAX_CHANGED_LINES = 40;

// Lines matching any of these are dropped before diffing — they're
// near-certain noise rather than real documentation content changes.
const NOISE_PATTERNS = [
  /^\d{1,2}[:.]\d{2}([:.]\d{2})?\s*(am|pm)?$/i,                 // bare timestamps
  /updated?\s+\d+\s+(second|minute|hour|day|week|month)s?\s+ago/i,
  /last\s+updated\s*[:\-]?\s*/i,
  /^©\s*\d{4}/,                                                   // copyright lines
  /all rights reserved/i,
  /cookie(s)?\s+(policy|consent|notice)/i,
  /^\d+\s+(views?|likes?|shares?|comments?)$/i,
  /^(loading|please wait)\.{0,3}$/i,
  /^\s*\d+\s*\/\s*\d+\s*$/,                                       // pagination "3 / 12"
];

function isNoiseLine(line) {
  if (line.length < MIN_LINE_LENGTH) return true;
  return NOISE_PATTERNS.some((pattern) => pattern.test(line));
}

export function diffDocs(oldText, newText) {
  const parts = diffLines(oldText, newText, { ignoreWhitespace: true });

  const added = [];
  const removed = [];

  for (const part of parts) {
    const lines = part.value
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && !isNoiseLine(l));

    if (part.added) added.push(...lines);
    else if (part.removed) removed.push(...lines);
  }

  if (added.length === 0 && removed.length === 0) return null;

  const summaryLines = [
    ...removed.slice(0, MAX_CHANGED_LINES / 2).map((l) => `REMOVED FROM DOCS: ${l}`),
    ...added.slice(0, MAX_CHANGED_LINES / 2).map((l) => `ADDED TO DOCS: ${l}`),
  ];

  return summaryLines.join("\n");
}