import { ProviderModel } from "../models/Provider.js";

function parseRepoNameFromUrl(url) {
  if (!url) return "unnamed-repo";
  const match = url.match(/github\.com[:/]([^/]+)\/([^/.]+)/);
  return match ? `${match[1]}/${match[2]}` : url;
}

export async function listProviders(req, res) {
  res.json(await ProviderModel.findAll());
}

export async function createProvider(req, res) {
  const { name, changelogUrl, docsUrl, specUrl, initialRepoUrl, initialDefaultBranch } = req.body;
  const slug = name.toLowerCase().trim().replace(/\s+/g, "-");
  const initial = name.slice(0, 2).toUpperCase();

  const provider = await ProviderModel.create({ name, slug, initial, changelogUrl, docsUrl, specUrl });

  if (initialRepoUrl) {
    await ProviderModel.addWatchedRepo(provider.id, {
      repoName: parseRepoNameFromUrl(initialRepoUrl),
      repoUrl: initialRepoUrl,
      defaultBranch: initialDefaultBranch,
    });
  }

  res.status(201).json(provider);
}

export async function addWatchedRepo(req, res) {
  const { id } = req.params;
  const { repoUrl, defaultBranch } = req.body;
  const provider = await ProviderModel.findById(id);
  if (!provider) return res.status(404).json({ error: "Provider not found" });

  const repo = await ProviderModel.addWatchedRepo(id, {
    repoName: parseRepoNameFromUrl(repoUrl),
    repoUrl,
    defaultBranch,
  });
  res.status(201).json(repo);
}

export async function deleteProvider(req, res) {
  const { id } = req.params;
  const provider = await ProviderModel.findById(id);
  if (!provider) return res.status(404).json({ error: "Provider not found" });

  await ProviderModel.delete(id);
  res.status(200).json({ deleted: true, id });
}

export async function deleteWatchedRepo(req, res) {
  const { id, repoId } = req.params;
  const deleted = await ProviderModel.deleteWatchedRepo(id, repoId);
  if (!deleted) return res.status(404).json({ error: "Repo not found for this provider" });

  res.status(200).json({ deleted: true, id: repoId });
}