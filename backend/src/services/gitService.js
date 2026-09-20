import simpleGit from "simple-git";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { randomUUID } from "crypto";

function buildAuthenticatedUrl(repoUrl, token) {
  const normalized = repoUrl.endsWith(".git") ? repoUrl : `${repoUrl}.git`;
  const url = new URL(normalized);
  url.username = "x-access-token";
  url.password = token;
  return url.toString();
}

export async function cloneApplyCommitPush({
  repoUrl, token, baseBranch, createNewBranch, newBranchName, commitMessage, applyFn,
}) {
  const workDir = path.join(os.tmpdir(), `apisentry-${randomUUID()}`);
  await fs.mkdir(workDir, { recursive: true });
  const authedUrl = buildAuthenticatedUrl(repoUrl, token);
  const git = simpleGit();

  try {
    await git.clone(authedUrl, workDir, ["--branch", baseBranch, "--single-branch", "--depth", "1"]);
    const repoGit = simpleGit(workDir);

    let pushBranch = baseBranch;
    if (createNewBranch) {
      pushBranch = newBranchName;
      await repoGit.checkoutLocalBranch(newBranchName);
    }

    const results = await applyFn(workDir);
    const anyChanged = results.some((r) => r.changed);
    if (!anyChanged) {
      throw Object.assign(
        new Error("No files were modified. Check your patterns, or — in AI mode — that Gemini actually found something to change."),
        { status: 422, results }
      );
    }

    const changedFiles = results.filter((r) => r.changed).map((r) => r.file);
    await repoGit.add(changedFiles);
    await repoGit.commit(commitMessage);

    if (createNewBranch) {
      await repoGit.push(["-u", "origin", pushBranch]);
    } else {
      await repoGit.push(["origin", pushBranch]);
    }

    return { results, pushBranch };
  } finally {
    await fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}