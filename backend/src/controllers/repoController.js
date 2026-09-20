import { RepoModel } from "../models/Repo.js";
import { GithubSettingsModel } from "../models/GithubSettings.js";
import { listBranches } from "../services/githubApiService.js";

export async function getRepoBranches(req, res) {
  const repo = await RepoModel.findById(req.params.repoId);
  if (!repo) return res.status(404).json({ error: "Repo not found" });
  if (!repo.repo_url) return res.status(400).json({ error: "This repo has no GitHub URL saved yet." });

  const settings = await GithubSettingsModel.get();
  if (!settings) return res.status(400).json({ error: "Connect a GitHub account in Settings first." });

  const branches = await listBranches(settings.token, repo.repo_url);
  res.json({ branches, defaultBranch: repo.default_branch });
}