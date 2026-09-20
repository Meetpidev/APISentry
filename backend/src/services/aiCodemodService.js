import fs from "fs/promises";
import path from "path";
import { generateFileFix } from "./geminiFixService.js";

export async function applyAiFixes(repoDir, change, filePaths, requestApiKey) {
  const results = [];

  for (const filePath of filePaths) {
    const fullPath = path.join(repoDir, filePath);

    if (!fullPath.startsWith(repoDir)) {
      results.push({ file: filePath, changed: false, reason: "invalid file path" });
      continue;
    }

    let original;
    try {
      original = await fs.readFile(fullPath, "utf-8");
    } catch {
      results.push({ file: filePath, changed: false, reason: "file does not exist in this repo/branch" });
      continue;
    }

    let updated;
    try {
      updated = await generateFileFix({ change, filePath, originalContent: original, requestApiKey });
    } catch (err) {
      results.push({ file: filePath, changed: false, reason: `Gemini error: ${err.message}` });
      continue;
    }

    if (!updated || updated.trim() === original.trim()) {
      results.push({ file: filePath, changed: false, reason: "Gemini determined this file needed no change" });
      continue;
    }

    await fs.writeFile(fullPath, updated, "utf-8");
    results.push({ file: filePath, changed: true });
  }

  return results;
}