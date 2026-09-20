import { ProviderModel } from "../models/Provider.js";
import { RepoModel } from "../models/Repo.js";
import { GithubSettingsModel } from "../models/GithubSettings.js";
import { ChangeModel } from "../models/Change.js";
import { CompliancePatternModel } from "../models/CompliancePattern.js";
import { scanRepoForCompliance } from "../services/complianceScanService.js";

export async function runComplianceScan(req, res) {
  const { providerId, repoId, branch } = req.body;

  const provider = await ProviderModel.findById(providerId);
  if (!provider) return res.status(404).json({ error: "Provider not found" });

  const repo = await RepoModel.findById(repoId);
  if (!repo || repo.provider_id !== providerId) return res.status(400).json({ error: "Repo not linked to this provider" });
  if (!repo.repo_url) return res.status(400).json({ error: "This repo has no GitHub URL." });

  const settings = await GithubSettingsModel.get();
  if (!settings) return res.status(400).json({ error: "Connect a GitHub account in Settings first." });

  const patterns = await CompliancePatternModel.findByProvider(providerId);

  const { findings, message } = await scanRepoForCompliance({
    repoUrl: repo.repo_url,
    token: settings.token,
    branch: branch || repo.default_branch,
    patterns,
  });

  if (findings.length === 0) {
    return res.status(200).json({ message: message || "No configured patterns matched this repo.", changesCreated: 0 });
  }

  const created = [];
  for (const finding of findings) {
    const change = await ChangeModel.create({
      providerId,
      type: finding.type,
      title: finding.title,
      description: `${finding.description}\n\nFound in your codebase on branch "${branch || repo.default_branch}".`,
      severity: finding.severity,
      affectedFiles: [{ repo: repo.repo_name, file: finding.file }],
      detectionSource: "manual",
      classificationMethod: "heuristic",
    });
    created.push(change);
  }

  res.status(201).json({ changesCreated: created.length, changes: created });
}