import { GithubSettingsModel } from "../models/GithubSettings.js";
import { verifyToken } from "../services/githubApiService.js";

export async function connectGithub(req, res) {
  const { token } = req.body;
  const user = await verifyToken(token);
  const saved = await GithubSettingsModel.upsert({ token, username: user.login, avatarUrl: user.avatar_url });
  res.status(201).json({ username: saved.username, avatarUrl: saved.avatar_url, connectedAt: saved.created_at });
}

export async function githubStatus(req, res) {
  const settings = await GithubSettingsModel.get();
  if (!settings) return res.json({ connected: false });
  res.json({ connected: true, username: settings.username, avatarUrl: settings.avatar_url });
}