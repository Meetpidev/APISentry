const GITHUB_API = "https://api.github.com";

export function parseOwnerRepo(repoUrl) {
  const match = repoUrl.match(/github\.com[:/]([^/]+)\/([^/.]+)(\.git)?/);
  if (!match) {
    throw Object.assign(new Error(`Could not parse owner/repo from "${repoUrl}". Expected something like https://github.com/owner/repo`), { status: 400 });
  }
  return { owner: match[1], repo: match[2] };
}

async function githubFetch(token, path, options = {}) {
  const res = await fetch(`${GITHUB_API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw Object.assign(new Error(`GitHub API error (${res.status}): ${body}`), { status: res.status >= 500 ? 502 : res.status });
  }
  return res.status === 204 ? null : res.json();
}

export function verifyToken(token) {
  return githubFetch(token, "/user");
}

export async function listBranches(token, repoUrl) {
  const { owner, repo } = parseOwnerRepo(repoUrl);
  const branches = await githubFetch(token, `/repos/${owner}/${repo}/branches?per_page=100`);
  return branches.map((b) => b.name);
}

export function createPullRequest(token, repoUrl, { head, base, title, body }) {
  const { owner, repo } = parseOwnerRepo(repoUrl);
  return githubFetch(token, `/repos/${owner}/${repo}/pulls`, {
    method: "POST",
    body: JSON.stringify({ head, base, title, body }),
  });
}