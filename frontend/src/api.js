const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

async function request(path, options = {}) {
  const geminiApiKey = localStorage.getItem("geminiApiKey");
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(geminiApiKey ? { "X-Gemini-API-Key": geminiApiKey } : {}),
    },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  return res.status === 204 ? null : res.json();
}

export const api = {
  getProviders: () => request("/providers"),
  createProvider: (data) => request("/providers", { method: "POST", body: JSON.stringify(data) }),
  addRepo: (providerId, data) => request(`/providers/${providerId}/repos`, { method: "POST", body: JSON.stringify(data) }),
  deleteProvider: (providerId) => request(`/providers/${providerId}`, { method: "DELETE" }),
  deleteRepo: (providerId, repoId) => request(`/providers/${providerId}/repos/${repoId}`, { method: "DELETE" }),

  getChanges: (type) => request(`/changes${type && type !== "all" ? `?type=${type}` : ""}`),
  generatePR: (changeId, payload) => request(`/changes/${changeId}/generate-pr`, { method: "POST", body: JSON.stringify(payload) }),
  ignoreChange: (changeId) => request(`/changes/${changeId}/ignore`, { method: "POST" }),
deleteChange: (changeId) => request(`/changes/${changeId}`, { method: "DELETE" }),
  deleteAllChanges: () => request("/changes", { method: "DELETE" }),

  getPRs: () => request("/prs"),

  triggerScan: (providerId, rawChangelogText = null, affectedFiles = []) =>
    request("/scan", { method: "POST", body: JSON.stringify({ providerId, rawChangelogText, affectedFiles }) }),

  connectGithub: (token) => request("/github/connect", { method: "POST", body: JSON.stringify({ token }) }),
  getGithubStatus: () => request("/github/status"),
  getRepoBranches: (repoId) => request(`/repos/${repoId}/branches`),

   getPatterns: (providerId) => request(`/compliance-patterns/providers/${providerId}`),
  createPattern: (providerId, data) => request(`/compliance-patterns/providers/${providerId}`, { method: "POST", body: JSON.stringify(data) }),
  suggestPattern: (changeId) => request(`/compliance-patterns/suggest/${changeId}`, { method: "POST" }),
  deletePattern: (patternId) => request(`/compliance-patterns/${patternId}`, { method: "DELETE" }),

 runAutoComplianceScan: (providerId, repoId, branch) =>
    request("/compliance-auto/scan", { method: "POST", body: JSON.stringify({ providerId, repoId, branch }) }),
  commitAutoComplianceFindings: (payload) =>
    request("/compliance-auto/commit", { method: "POST", body: JSON.stringify(payload) }),
  runComplianceScan: (providerId, repoId, branch) =>
    request("/compliance", { method: "POST", body: JSON.stringify({ providerId, repoId, branch }) }),
};