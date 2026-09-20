// Clones a linked repo and checks it against whatever compliance_patterns
// exist for that provider — entirely data-driven, no provider names in code.
import simpleGit from "simple-git";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { randomUUID } from "crypto";

const SCANNABLE_EXTENSIONS = [".js", ".ts", ".jsx", ".tsx", ".py", ".rb", ".go", ".java"];
const IGNORE_DIRS = ["node_modules", ".git", "dist", "build", "vendor", "__pycache__"];

async function walkFiles(dir, results = []) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (IGNORE_DIRS.includes(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walkFiles(fullPath, results);
    } else if (SCANNABLE_EXTENSIONS.includes(path.extname(entry.name))) {
      results.push(fullPath);
    }
  }
  return results;
}

function buildMatcher(pattern, isRegex) {
  if (isRegex) {
    try {
      const re = new RegExp(pattern);
      return (content) => re.test(content);
    } catch {
      return () => false; // malformed regex — skip rather than crash the whole scan
    }
  }
  return (content) => content.includes(pattern);
}

export async function scanRepoForCompliance({ repoUrl, token, branch, patterns }) {
  if (!patterns || patterns.length === 0) {
    return { findings: [], message: "No compliance patterns configured for this provider yet. Add one from the Changes tab or the Providers panel." };
  }

  const workDir = path.join(os.tmpdir(), `apisentry-compliance-${randomUUID()}`);
  await fs.mkdir(workDir, { recursive: true });

  try {
    const authedUrl = repoUrl.endsWith(".git") ? repoUrl : `${repoUrl}.git`;
    const url = new URL(authedUrl);
    url.username = "x-access-token";
    url.password = token;

    const git = simpleGit();
    await git.clone(url.toString(), workDir, ["--branch", branch, "--single-branch", "--depth", "1"]);

    const files = await walkFiles(workDir);
    const findings = [];

    const matchers = patterns.map((p) => ({ ...p, matches: buildMatcher(p.pattern, p.is_regex) }));

    for (const filePath of files) {
      const content = await fs.readFile(filePath, "utf-8");
      const relativePath = path.relative(workDir, filePath);

      for (const p of matchers) {
        if (p.matches(content)) {
          findings.push({
            file: relativePath,
            patternId: p.id,
            title: p.title,
            description: p.description,
            severity: p.severity,
            type: p.type,
          });
        }
      }
    }

    return { findings };
  } finally {
    await fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}