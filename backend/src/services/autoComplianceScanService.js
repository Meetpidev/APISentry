
import simpleGit from "simple-git";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { randomUUID } from "crypto";

const SCANNABLE_EXTENSIONS = [".js", ".ts", ".jsx", ".tsx", ".py", ".rb", ".go", ".java"];
const IGNORE_DIRS = ["node_modules", ".git", "dist", "build", "vendor", "__pycache__"];
const MAX_FILE_BYTES = 60_000; // skip huge files to keep prompts sane
const MAX_AI_FILES = 40; // cap Gemini calls per scan — deterministic checks cover all files

const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.6-flash";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const CODE_IDENTIFIER = /[A-Za-z_$][A-Za-z0-9_$]*(?:_[A-Za-z0-9_$]+)+/g;

async function walkFiles(dir, results = []) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (IGNORE_DIRS.includes(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) await walkFiles(fullPath, results);
    else if (SCANNABLE_EXTENSIONS.includes(path.extname(entry.name))) results.push(fullPath);
  }
  return results;
}

async function analyzeFile({ filePath, content, providerName, knownChanges, providerContext, requestApiKey }) {
  const apiKey = requestApiKey || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw Object.assign(new Error("GEMINI_API_KEY is not set — automatic scanning needs Gemini configured in backend/.env."), { status: 400 });
  }

  const changesList = knownChanges
    .map((c, i) => `${i + 1}. [${c.type}/${c.severity}] ${c.title}: ${c.description}`)
    .join("\n");

  const prompt = `You are reviewing ONE file from a codebase for compatibility with the ${providerName} API.

Inspect only the API-style candidates listed below. Report a finding only when the provider's current API/changelog evidence or your provider-specific knowledge confirms that the exact candidate is deprecated, removed, or unsupported. Do not report environment variables, internal project fields, or ordinary snake_case names.

Candidate API identifiers found in this file:
${(content.match(CODE_IDENTIFIER) || []).join(", ")}

Known API changes for this provider:
${changesList}

Current provider changelog/documentation context:
"""${providerContext.slice(0, 12000)}"""

File path: ${filePath}

Determine if this file's code needs updating because of ANY of the changes above. If NONE apply to this file, respond with exactly:
NO_CHANGE_NEEDED

If one or more DO apply, respond with ONLY valid JSON (no markdown, no backticks) in this exact shape:
{
  "relatedChangeIndex": <the number from the list above that best matches, 1-indexed>,
  "matchedIdentifier": "the exact unsupported identifier from the candidate list",
  "explanation": "1-2 sentences on what in this file needs to change and why",
  "newContent": "the FULL new file content with the minimal fix applied — do not reformat or touch anything unrelated"
}

Current file content:
"""${content}"""`;

  const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.1 } }),
  });
  if (!res.ok) throw new Error(`Gemini API error: ${await res.text()}`);

  const data = await res.json();
  const text = (data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "").trim();
  if (text === "NO_CHANGE_NEEDED" || text.startsWith("NO_CHANGE_NEEDED")) return null;

  const cleaned = text.replace(/```json|```/g, "").trim();
  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return null; // malformed model output — skip rather than crash the whole scan
  }
  if (!parsed.newContent || parsed.newContent.trim() === content.trim()) return null;
  if (!parsed.matchedIdentifier || !content.includes(parsed.matchedIdentifier)) return null;
  return parsed;
}

export async function autoScanRepo({ repoUrl, token, branch, providerName = "the provider", knownChanges = [], providerContext = "", requestApiKey }) {
  if (knownChanges.length === 0 && !providerContext.trim()) {
    return { findings: [], message: "No provider changelog or documentation context is available for this scan." };
  }

  const workDir = path.join(os.tmpdir(), `apisentry-autoscan-${randomUUID()}`);
  await fs.mkdir(workDir, { recursive: true });

  try {
    const authedUrl = repoUrl.endsWith(".git") ? repoUrl : `${repoUrl}.git`;
    const url = new URL(authedUrl);
    url.username = "x-access-token";
    url.password = token;

    const git = simpleGit();
    await git.clone(url.toString(), workDir, ["--branch", branch, "--single-branch", "--depth", "1"]);

    const files = await walkFiles(workDir);
    const aiFiles = new Set(files.slice(0, MAX_AI_FILES));

    const findings = [];
    let aiUnavailableMessage = null;
    let aiEnabled = true;
    for (const filePath of files) {
      const stat = await fs.stat(filePath);
      if (stat.size > MAX_FILE_BYTES) continue;

      const content = await fs.readFile(filePath, "utf-8");
      const relativePath = path.relative(workDir, filePath);

      if (!aiEnabled || !aiFiles.has(filePath) || (content.match(CODE_IDENTIFIER) || []).length === 0) continue;

      let result;
      try {
        result = await analyzeFile({ filePath: relativePath, content, providerName, knownChanges, providerContext, requestApiKey });
      } catch (err) {
        console.error(`Auto-scan failed on ${relativePath}:`, err.message);
        if (err.message.includes("429") || err.message.includes("RESOURCE_EXHAUSTED") || err.message.includes("quota")) {
          aiUnavailableMessage = "AI compatibility analysis is temporarily unavailable because the Gemini API quota was exceeded. Try again after the quota resets or configure a paid Gemini quota.";
          aiEnabled = false;
        }
        continue;
      }

      if (result) {
        const relatedChange = knownChanges[result.relatedChangeIndex - 1] || null;
        findings.push({
          file: relativePath,
          oldContent: content,
          newContent: result.newContent,
          explanation: `${result.explanation} Matched provider API identifier: \`${result.matchedIdentifier}\`.`,
          relatedChangeId: relatedChange?.id || null,
          relatedChangeTitle: relatedChange?.title || null,
        });
      }
    }

    return {
      findings,
      filesScanned: files.length,
      message: aiUnavailableMessage || (findings.length === 0 ? "Scanned the entire repo — nothing matched the provider's current compatibility context." : null),
    };
  } finally {
    await fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}

// Second pass: re-clones (stateless across requests) and writes ONLY the
// files the user approved, then commits/pushes.
export async function applyApprovedFindings({ repoUrl, token, branch, createNewBranch, newBranchName, commitMessage, approvedFiles }) {
  const workDir = path.join(os.tmpdir(), `apisentry-autoscan-commit-${randomUUID()}`);
  await fs.mkdir(workDir, { recursive: true });

  try {
    const authedUrl = repoUrl.endsWith(".git") ? repoUrl : `${repoUrl}.git`;
    const url = new URL(authedUrl);
    url.username = "x-access-token";
    url.password = token;

    const git = simpleGit();
    await git.clone(url.toString(), workDir, ["--branch", branch, "--single-branch", "--depth", "1"]);
    const repoGit = simpleGit(workDir);

    let pushBranch = branch;
    if (createNewBranch) {
      pushBranch = newBranchName;
      await repoGit.checkoutLocalBranch(newBranchName);
    }

    const writtenFiles = [];
    for (const f of approvedFiles) {
      const fullPath = path.join(workDir, f.file);
      if (!fullPath.startsWith(workDir)) continue; // path-traversal guard
      await fs.writeFile(fullPath, f.newContent, "utf-8");
      writtenFiles.push(f.file);
    }
    if (writtenFiles.length === 0) throw Object.assign(new Error("No approved files to write."), { status: 400 });

    await repoGit.add(writtenFiles);
    await repoGit.commit(commitMessage);
    if (createNewBranch) await repoGit.push(["-u", "origin", pushBranch]);
    else await repoGit.push(["origin", pushBranch]);

    return { writtenFiles, pushBranch };
  } finally {
    await fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}