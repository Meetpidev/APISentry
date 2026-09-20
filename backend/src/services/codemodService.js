import fs from "fs/promises";
import path from "path";

export async function applyCodemods(repoDir, codemods) {
  const results = [];

  for (const cm of codemods) {
    const filePath = path.join(repoDir, cm.filePath);

    if (!filePath.startsWith(repoDir)) {
      results.push({ file: cm.filePath, changed: false, reason: "invalid file path" });
      continue;
    }

    try {
      const original = await fs.readFile(filePath, "utf-8");
      let updated;

      if (cm.useRegex) {
        updated = original.replace(new RegExp(cm.find, "g"), cm.replace);
      } else {
        updated = original.split(cm.find).join(cm.replace);
      }

      if (updated === original) {
        results.push({ file: cm.filePath, changed: false, reason: "pattern not found in file — nothing was changed" });
        continue;
      }

      await fs.writeFile(filePath, updated, "utf-8");
      results.push({ file: cm.filePath, changed: true });
    } catch (err) {
      const reason = err.code === "ENOENT" ? "file does not exist in this repo/branch" : err.message;
      results.push({ file: cm.filePath, changed: false, reason });
    }
  }

  return results;
}