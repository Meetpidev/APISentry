import React, { useState, useEffect, useCallback, useMemo } from "react";
import { api } from "./api";

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------
const Icon = ({ path, className = "w-5 h-5" }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
    strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d={path} />
  </svg>
);
const icons = {
  dashboard: "M3 3h8v8H3V3zm10 0h8v5h-8V3zm0 8h8v10h-8V11zM3 13h8v8H3v-8z",
  providers: "M4 7h16M4 12h16M4 17h10",
  changes: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
  prs: "M6 3v12m0 0a3 3 0 103 3m-3-3a3 3 0 013 3m9-3a3 3 0 11-6 0 3 3 0 016 0zM18 6a3 3 0 100-6 3 3 0 000 6zm-3 0h-1a4 4 0 00-4 4v5",
  settings: "M12 15a3 3 0 100-6 3 3 0 000 6zm7.4-3a7.4 7.4 0 01-.1 1.2l2 1.6-2 3.4-2.4-1a7.6 7.6 0 01-2 1.2L14.5 21h-5l-.4-2.6a7.6 7.6 0 01-2-1.2l-2.4 1-2-3.4 2-1.6A7.4 7.4 0 014.6 12a7.4 7.4 0 01.1-1.2l-2-1.6 2-3.4 2.4 1a7.6 7.6 0 012-1.2L9.5 3h5l.4 2.6a7.6 7.6 0 012 1.2l2.4-1 2 3.4-2 1.6c.07.4.1.8.1 1.2z",
  bolt: "M13 2 3 14h7l-1 8 10-12h-7l1-8z",
  check: "M20 6 9 17l-5-5",
  x: "M18 6 6 18M6 6l12 12",
  arrow: "M5 12h14M13 6l6 6-6 6",
  plus: "M12 5v14M5 12h14",
  scan: "M4 4h4M4 4v4M20 4h-4M20 4v4M4 20h4M4 20v-4M20 20h-4M20 20v-4M8 12h8",
  file: "M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z",
  external: "M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6m5-3h6v6m0-6L10 14",
};

// ---------------------------------------------------------------------------
// Normalizers
// ---------------------------------------------------------------------------
function normalizeChange(raw) {
  const files = raw.affected_files || [];
  const grouped = {};
  for (const f of files) {
    const repoName = f.repo;
    if (!grouped[repoName]) grouped[repoName] = [];
    grouped[repoName].push(f.file);
  }
  return {
    id: raw.id,
    providerId: raw.provider_id,
    providerName: raw.provider_name || "Unknown provider",
    providerSlug: raw.provider_slug,
    type: raw.type,
    title: raw.title,
    description: raw.description,
    severity: raw.severity,
    status: raw.status,
    detectedAt: formatRelativeTime(raw.detected_at),
    affectedRepos: Object.entries(grouped).map(([repo, fileList]) => ({ repo, files: fileList })),
  };
}

function normalizePR(raw) {
  return {
    id: raw.id,
    changeId: raw.change_id,
    repo: raw.repo,
    title: raw.title,
    branch: raw.branch,
    baseBranch: raw.base_branch,
    status: raw.status,
    filesChanged: raw.files_changed ?? 0,
    createdAt: formatRelativeTime(raw.created_at),
    diff: raw.diff || "",
    prNumber: raw.pr_number,
    prUrl: raw.pr_url,
  };
}

function normalizeProvider(raw) {
  return {
    id: raw.id,
    name: raw.name,
    initial: raw.initial,
    color: raw.color || "bg-slate-500",
    status: raw.status,
    lastChecked: raw.last_checked_at ? formatRelativeTime(raw.last_checked_at) : "—",
    watching: raw.watching || [], // [{id, repoName, repoUrl, defaultBranch}]
  };
}

function formatRelativeTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const diffMin = Math.round((Date.now() - date.getTime()) / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hr ago`;
  return `${Math.round(diffHr / 24)} day(s) ago`;
}

// ---------------------------------------------------------------------------
// Shared UI bits
// ---------------------------------------------------------------------------
const Badge = ({ children, tone = "gray" }) => {
  const tones = {
    gray: "bg-gray-100 text-gray-700", red: "bg-red-100 text-red-700",
    amber: "bg-amber-100 text-amber-700", green: "bg-emerald-100 text-emerald-700",
    blue: "bg-blue-100 text-blue-700", indigo: "bg-indigo-100 text-indigo-700",
  };
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${tones[tone]}`}>{children}</span>;
};
const severityTone = { high: "red", medium: "amber", low: "blue" };
const typeTone = { breaking: "red", deprecation: "amber", feature: "green" };

const StatCard = ({ label, value, icon, tone }) => (
  <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4">
    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${tone}`}>
      <Icon path={icon} className="w-5 h-5 text-white" />
    </div>
    <div>
      <div className="text-2xl font-semibold text-gray-900">{value}</div>
      <div className="text-sm text-gray-500">{label}</div>
    </div>
  </div>
);

const Modal = ({ title, onClose, children, wide }) => (
  <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
    <div className={`bg-white rounded-xl w-full ${wide ? "max-w-2xl" : "max-w-md"} max-h-[90vh] overflow-y-auto`}>
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <h3 className="font-semibold text-gray-900">{title}</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
          <Icon path={icons.x} className="w-5 h-5" />
        </button>
      </div>
      <div className="p-5">{children}</div>
    </div>
  </div>
);

// ---------------------------------------------------------------------------
// Sidebar
// ---------------------------------------------------------------------------
const Sidebar = ({ active, setActive, counts, githubStatus }) => {
  const items = [
    { id: "dashboard", label: "Dashboard", icon: icons.dashboard },
    { id: "providers", label: "Providers", icon: icons.providers, count: counts.providers },
    { id: "changes", label: "Changes", icon: icons.changes, count: counts.pendingChanges },
    { id: "prs", label: "Pull Requests", icon: icons.prs, count: counts.openPRs },
    { id: "settings", label: "Settings", icon: icons.settings },
  ];
  return (
    <div className="w-60 shrink-0 h-screen bg-white border-r border-gray-200 flex flex-col">
      <div className="px-5 py-5 flex items-center gap-2 border-b border-gray-100">
        <div className="w-8 h-8 rounded-lg bg-gray-900 flex items-center justify-center">
          <Icon path={icons.bolt} className="w-4 h-4 text-white" />
        </div>
        <span className="font-semibold text-gray-900">APIWatch</span>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1">
        {items.map((it) => (
          <button key={it.id} onClick={() => setActive(it.id)}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition
              ${active === it.id ? "bg-gray-900 text-white" : "text-gray-600 hover:bg-gray-100"}`}>
            <span className="flex items-center gap-2.5"><Icon path={it.icon} className="w-4 h-4" />{it.label}</span>
            {it.count > 0 && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${active === it.id ? "bg-white/20" : "bg-gray-200 text-gray-700"}`}>{it.count}</span>
            )}
          </button>
        ))}
      </nav>
      <div className="p-4 border-t border-gray-100">
        {githubStatus?.connected ? (
          <div className="flex items-center gap-2 text-xs text-gray-600">
            <span className="w-2 h-2 rounded-full bg-emerald-500" /> @{githubStatus.username}
          </div>
        ) : (
          <button onClick={() => setActive("settings")} className="text-xs text-amber-600 hover:underline">
            GitHub not connected
          </button>
        )}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Dashboard — the single "Scan this provider" button drives everything
// ---------------------------------------------------------------------------
const DashboardView = ({ providers, changes, prs, onScan, scanning, scanStage, scanInfo }) => {
  const [selectedProviderId, setSelectedProviderId] = useState(providers[0]?.id || "");
  const pending = changes.filter((c) => c.status === "pending");

  useEffect(() => {
    if (!selectedProviderId && providers.length) setSelectedProviderId(providers[0].id);
  }, [providers, selectedProviderId]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">Live status of every API you depend on.</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={selectedProviderId} onChange={(e) => setSelectedProviderId(e.target.value)}
            disabled={providers.length === 0}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white disabled:opacity-50">
            {providers.length === 0 && <option value="">No providers yet</option>}
            {providers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <button
            onClick={() => onScan(selectedProviderId)}
            disabled={scanning || !selectedProviderId}
            className="flex items-center gap-2 bg-gray-900 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-gray-800 disabled:opacity-50"
          >
            <Icon path={icons.scan} className={`w-4 h-4 ${scanning ? "animate-spin" : ""}`} />
            {scanning ? (scanStage || "Scanning…") : "Scan this provider"}
          </button>
        </div>
      </div>

       {scanInfo && (
        <div className="bg-white border border-gray-200 rounded-lg p-3 space-y-1.5 text-xs">
          <div className="flex items-start gap-2">
            <Badge tone="blue">Changelog</Badge>
            <span className="text-gray-600">{scanInfo.stage1}</span>
          </div>
          <div className="flex items-start gap-2">
            <Badge tone="indigo">Your repo</Badge>
            <span className="text-gray-600">{scanInfo.stage2}</span>
          </div>
        </div>
      )}
     
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Providers tracked" value={providers.length} icon={icons.providers} tone="bg-indigo-500" />
        <StatCard label="Pending changes" value={pending.length} icon={icons.changes} tone="bg-amber-500" />
        <StatCard label="Open PRs" value={prs.filter((p) => p.status === "open").length} icon={icons.prs} tone="bg-emerald-500" />
        <StatCard label="Breaking changes" value={changes.filter((c) => c.type === "breaking").length} icon={icons.bolt} tone="bg-red-500" />
      </div>

      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-5 py-3 border-b border-gray-100 font-medium text-sm text-gray-700">Recent activity</div>
        <div className="divide-y divide-gray-100">
          {changes.length === 0 && <div className="px-5 py-6 text-sm text-gray-400 text-center">No changes detected yet.</div>}
          {changes.slice(0, 5).map((c) => (
            <div key={c.id} className="px-5 py-3 flex items-center justify-between text-sm">
              <div className="flex items-center gap-3">
                <Badge tone={typeTone[c.type]}>{c.type}</Badge>
                <span className="text-gray-800">{c.title}</span>
              </div>
              <span className="text-gray-400 text-xs">{c.detectedAt}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Diff preview — used in the auto-fix review modal
// ---------------------------------------------------------------------------
function computeLineDiff(oldText, newText) {
  const oldLines = oldText.split("\n");
  const newLines = newText.split("\n");
  const m = oldLines.length, n = newLines.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      dp[i][j] = oldLines[i] === newLines[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const result = [];
  let i = 0, j = 0;
  while (i < m && j < n) {
    if (oldLines[i] === newLines[j]) { result.push({ type: "same", text: oldLines[i] }); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { result.push({ type: "removed", text: oldLines[i] }); i++; }
    else { result.push({ type: "added", text: newLines[j] }); j++; }
  }
  while (i < m) { result.push({ type: "removed", text: oldLines[i] }); i++; }
  while (j < n) { result.push({ type: "added", text: newLines[j] }); j++; }
  return result;
}

const DiffPreview = ({ oldContent, newContent }) => {
  const diffLines = useMemo(() => computeLineDiff(oldContent, newContent), [oldContent, newContent]);
  return (
    <pre className="text-xs font-mono bg-gray-900 text-gray-300 rounded-lg p-3 overflow-x-auto max-h-64 overflow-y-auto">
      {diffLines.map((l, idx) => (
        <div key={idx} className={l.type === "added" ? "text-emerald-400" : l.type === "removed" ? "text-red-400 line-through" : "text-gray-500"}>
          {l.type === "added" ? "+ " : l.type === "removed" ? "- " : "  "}{l.text}
        </div>
      ))}
    </pre>
  );
};

// ---------------------------------------------------------------------------
// Auto-fix review modal — opens automatically after a scan finds something.
// No "run scan" button inside it anymore; it's fed findings the Dashboard
// scan already produced. Nothing is committed until the user approves.
// ---------------------------------------------------------------------------
const AutoFixReviewModal = ({ providerName, repoId, branch, findings, onClose, onCommitted }) => {
  const fixableFindings = findings.filter((finding) => !finding.reviewOnly);
  const [approved, setApproved] = useState(new Set(fixableFindings.map((finding) => findings.indexOf(finding))));
  const [mode, setMode] = useState("pr");
  const [newBranchName, setNewBranchName] = useState(`autofix/${providerName.toLowerCase().replace(/\s+/g, "-")}-auto`);
  const [commitMessage, setCommitMessage] = useState("fix: apply auto-detected API compatibility fixes");
  const [committing, setCommitting] = useState(false);
  const [error, setError] = useState(null);

  const toggleApproved = (idx) => {
    setApproved((prev) => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  };

  const commit = async () => {
    if (approved.size === 0) { setError("Select at least one file to apply."); return; }
    if (mode === "pr" && !newBranchName.trim()) { setError("Branch name is required."); return; }
    setCommitting(true); setError(null);
    try {
      const approvedFiles = findings
        .filter((_, i) => approved.has(i))
        .map((f) => ({ file: f.file, newContent: f.newContent, relatedChangeId: f.relatedChangeId || f.changeId }));

      await api.commitAutoComplianceFindings({
        repoId, branch, mode,
        newBranchName: mode === "pr" ? newBranchName.trim() : undefined,
        commitMessage: commitMessage.trim(),
        approvedFiles,
      });
      onCommitted();
      onClose();
    } catch (err) { setError(err.message); } finally { setCommitting(false); }
  };

  return (
    <Modal title={`Review AI fixes — ${providerName}`} onClose={onClose} wide>
      <div className="space-y-4">
        {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}
        <p className="text-xs text-gray-500">
          Your linked repo's code was compared against the changes just detected for {providerName}. Nothing has been
          written to GitHub yet — review each file below and uncheck anything you don't want applied.
        </p>

        <div className="space-y-3 max-h-96 overflow-y-auto">
          {findings.map((f, idx) => (
            <div key={f.file} className="border border-gray-200 rounded-lg p-3 space-y-2">
              <label className="flex items-start gap-2">
                {!f.reviewOnly && <input type="checkbox" checked={approved.has(idx)} onChange={() => toggleApproved(idx)} className="mt-1" />}
                <div className="min-w-0">
                  <div className="text-xs font-mono font-medium text-gray-800">{f.file}</div>
                  {f.relatedChangeTitle && <div className="text-xs text-gray-500 mt-0.5">Related to: {f.relatedChangeTitle}</div>}
                  <div className="text-xs text-gray-600 mt-1">{f.explanation}</div>
                  {f.reviewOnly && <div className="text-xs font-medium text-amber-700 mt-2">Review required — no automatic replacement was applied.</div>}
                </div>
              </label>
              {!f.reviewOnly && <DiffPreview oldContent={f.oldContent} newContent={f.newContent} />}
            </div>
          ))}
        </div>

        <div className="border-t border-gray-100 pt-3 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <select value={mode} onChange={(e) => setMode(e.target.value)} className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs">
              <option value="pr">Create new branch + open PR</option>
              <option value="direct">Commit directly to this branch</option>
            </select>
            {mode === "pr" && (
              <input value={newBranchName} onChange={(e) => setNewBranchName(e.target.value)} className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs font-mono" />
            )}
          </div>
          <input value={commitMessage} onChange={(e) => setCommitMessage(e.target.value)} className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-xs" />
          <div className="flex gap-2">
            <button onClick={commit} disabled={committing || approved.size === 0} className="bg-gray-900 text-white text-xs font-medium px-3 py-1.5 rounded-lg disabled:opacity-50">
              {committing ? "Pushing to GitHub…" : `Approve & commit ${approved.size} file(s)`}
            </button>
            <button onClick={onClose} className="text-gray-600 text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-gray-100">Skip for now</button>
          </div>
        </div>
      </div>
    </Modal>
  );
};

// ---------------------------------------------------------------------------
// Providers view — no compliance/AI-scan buttons here anymore, just
// provider + repo management
// ---------------------------------------------------------------------------
const ProvidersView = ({ providers, addProvider, addRepo, deleteProvider, deleteRepo }) => {
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [source, setSource] = useState("");
  const [docsUrl, setDocsUrl] = useState("");
  const [repoUrl, setRepoUrl] = useState("");
  const [defaultBranch, setDefaultBranch] = useState("main");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState(null);
  const [repoModalProvider, setRepoModalProvider] = useState(null);
  const [newRepoUrl, setNewRepoUrl] = useState("");
  const [newRepoBranch, setNewRepoBranch] = useState("main");
  const [confirmDeleteProvider, setConfirmDeleteProvider] = useState(null);
  const [confirmDeleteRepo, setConfirmDeleteRepo] = useState(null);

  const submit = async () => {
    if (!name.trim()) return;
    setBusy(true); setFormError(null);
    try {
      await addProvider({
        name: name.trim(), changelogUrl: source.trim(), docsUrl: docsUrl.trim(),
        initialRepoUrl: repoUrl.trim() || undefined, initialDefaultBranch: defaultBranch.trim() || "main",
      });
      setName(""); setSource(""); setDocsUrl(""); setRepoUrl(""); setDefaultBranch("main"); setShowAdd(false);
    } catch (err) { setFormError(err.message); } finally { setBusy(false); }
  };

  const submitRepo = async () => {
    if (!newRepoUrl.trim()) return;
    setBusy(true); setFormError(null);
    try {
      await addRepo(repoModalProvider.id, { repoUrl: newRepoUrl.trim(), defaultBranch: newRepoBranch.trim() || "main" });
      setRepoModalProvider(null); setNewRepoUrl(""); setNewRepoBranch("main");
    } catch (err) { setFormError(err.message); } finally { setBusy(false); }
  };

  const confirmAndDeleteProvider = async () => {
    setBusy(true);
    try {
      await deleteProvider(confirmDeleteProvider.id);
      setConfirmDeleteProvider(null);
    } catch (err) { setFormError(err.message); setConfirmDeleteProvider(null); } finally { setBusy(false); }
  };

  const confirmAndDeleteRepo = async () => {
    setBusy(true);
    try {
      await deleteRepo(confirmDeleteRepo.provider.id, confirmDeleteRepo.repo.id);
      setConfirmDeleteRepo(null);
    } catch (err) { setFormError(err.message); setConfirmDeleteRepo(null); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Providers</h1>
          <p className="text-sm text-gray-500 mt-1">Every external API being monitored, and the real GitHub repos it maps to.</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 bg-gray-900 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-gray-800">
          <Icon path={icons.plus} className="w-4 h-4" /> Add provider
        </button>
      </div>

      {showAdd && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
          {formError && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{formError}</div>}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600">Provider name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Plaid"
                className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600">Changelog URL</label>
              <input value={source} onChange={(e) => setSource(e.target.value)} placeholder="https://…/changelog"
                className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">Docs page URL (used when there's no changelog)</label>
            <input value={docsUrl} onChange={(e) => setDocsUrl(e.target.value)} placeholder="https://provider.com/docs/api-reference"
              className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600">Repo URL (real GitHub repo, optional)</label>
              <input value={repoUrl} onChange={(e) => setRepoUrl(e.target.value)} placeholder="https://github.com/owner/repo"
                className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600">Default branch</label>
              <input value={defaultBranch} onChange={(e) => setDefaultBranch(e.target.value)}
                className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={submit} disabled={busy} className="bg-gray-900 text-white text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-50">
              {busy ? "Connecting…" : "Connect"}
            </button>
            <button onClick={() => setShowAdd(false)} className="text-gray-600 text-sm font-medium px-4 py-2 rounded-lg hover:bg-gray-100">Cancel</button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        {providers.length === 0 && (
          <div className="col-span-2 text-sm text-gray-400 bg-white border border-dashed border-gray-200 rounded-xl p-8 text-center">
            No providers yet — add one to start tracking API changes.
          </div>
        )}
        {providers.map((p) => (
          <div key={p.id} className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <div className={`w-10 h-10 rounded-lg ${p.color} text-white flex items-center justify-center font-semibold shrink-0`}>{p.initial}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-900">{p.name}</span>
                  <div className="flex items-center gap-2">
                    <Badge tone={p.status === "connected" ? "green" : "amber"}>{p.status}</Badge>
                    <button onClick={() => setConfirmDeleteProvider(p)} title="Delete provider"
                      className="text-gray-300 hover:text-red-500 transition">
                      <Icon path={icons.x} className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="text-xs text-gray-500 mt-1">Last checked {p.lastChecked}</div>
                <div className="space-y-1 mt-2">
                  {p.watching.map((r) => (
                    <div key={r.id} className="text-xs bg-gray-50 border border-gray-100 rounded-md px-2 py-1 flex items-center justify-between group">
                      <span className="text-gray-700 truncate">{r.repoName}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-gray-400">{r.defaultBranch}</span>
                        <button onClick={() => setConfirmDeleteRepo({ provider: p, repo: r })} title="Unlink repo"
                          className="text-gray-300 hover:text-red-500 transition">
                          <Icon path={icons.x} className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                  {p.watching.length === 0 && <span className="text-xs text-gray-400">No repos linked yet</span>}
                </div>
                <button onClick={() => setRepoModalProvider(p)} className="text-xs text-gray-600 hover:text-gray-900 mt-2 flex items-center gap-1">
                  <Icon path={icons.plus} className="w-3 h-3" /> Link a repo
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {repoModalProvider && (
        <Modal title={`Link a repo to ${repoModalProvider.name}`} onClose={() => setRepoModalProvider(null)}>
          {formError && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">{formError}</div>}
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-gray-600">Repo URL</label>
              <input value={newRepoUrl} onChange={(e) => setNewRepoUrl(e.target.value)} placeholder="https://github.com/owner/repo"
                className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600">Default branch</label>
              <input value={newRepoBranch} onChange={(e) => setNewRepoBranch(e.target.value)}
                className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <button onClick={submitRepo} disabled={busy} className="bg-gray-900 text-white text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-50">
              {busy ? "Linking…" : "Link repo"}
            </button>
          </div>
        </Modal>
      )}

      {confirmDeleteProvider && (
        <Modal title="Delete provider?" onClose={() => setConfirmDeleteProvider(null)}>
          <p className="text-sm text-gray-600">
            This will permanently delete <strong>{confirmDeleteProvider.name}</strong>, all its linked repos, every
            detected change for it, and its doc-diff history. Pull requests already opened on GitHub are not affected —
            only the local records here are removed.
          </p>
          <div className="flex gap-2 mt-4">
            <button onClick={confirmAndDeleteProvider} disabled={busy} className="bg-red-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-red-700 disabled:opacity-50">
              {busy ? "Deleting…" : "Delete provider"}
            </button>
            <button onClick={() => setConfirmDeleteProvider(null)} className="text-gray-600 text-sm font-medium px-4 py-2 rounded-lg hover:bg-gray-100">Cancel</button>
          </div>
        </Modal>
      )}

      {confirmDeleteRepo && (
        <Modal title="Unlink repo?" onClose={() => setConfirmDeleteRepo(null)}>
          <p className="text-sm text-gray-600">
            Remove <strong>{confirmDeleteRepo.repo.repoName}</strong> from <strong>{confirmDeleteRepo.provider.name}</strong>?
            This doesn't touch the actual GitHub repo — just stops APISentry watching it here.
          </p>
          <div className="flex gap-2 mt-4">
            <button onClick={confirmAndDeleteRepo} disabled={busy} className="bg-red-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-red-700 disabled:opacity-50">
              {busy ? "Removing…" : "Unlink repo"}
            </button>
            <button onClick={() => setConfirmDeleteRepo(null)} className="text-gray-600 text-sm font-medium px-4 py-2 rounded-lg hover:bg-gray-100">Cancel</button>
          </div>
        </Modal>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Generate PR modal (manual per-change fix — unchanged, still available
// from the Changes tab for one-off fixes)
// ---------------------------------------------------------------------------
const GeneratePRModal = ({ change, repos, onClose, onSubmit }) => {
  const [repoId, setRepoId] = useState(repos[0]?.id || "");
  const [mode, setMode] = useState("pr");
  const [baseBranch, setBaseBranch] = useState("");
  const [newBranchName, setNewBranchName] = useState(`autofix/${change.providerSlug || "api"}-${change.id.slice(0, 8)}`);
  const [commitMessage, setCommitMessage] = useState(`fix: ${change.title}`);
  const [branches, setBranches] = useState([]);
  const [loadingBranches, setLoadingBranches] = useState(false);

  const allFiles = change.affectedRepos.flatMap((r) => r.files);
  const [fixMode, setFixMode] = useState("ai");
  const [selectedFiles, setSelectedFiles] = useState(new Set(allFiles));
  const [codemods, setCodemods] = useState(
    (allFiles.length ? allFiles : [""]).map((f) => ({ filePath: f, find: "", replace: "", useRegex: false }))
  );

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!repoId) return;
    setLoadingBranches(true);
    setError(null);
    api.getRepoBranches(repoId)
      .then((res) => { setBranches(res.branches); setBaseBranch(res.defaultBranch || res.branches[0] || ""); })
      .catch((err) => setError(err.message))
      .finally(() => setLoadingBranches(false));
  }, [repoId]);

  const toggleFile = (f) => {
    setSelectedFiles((prev) => {
      const next = new Set(prev);
      next.has(f) ? next.delete(f) : next.add(f);
      return next;
    });
  };

  const updateCodemod = (idx, field, value) => setCodemods((prev) => prev.map((c, i) => (i === idx ? { ...c, [field]: value } : c)));
  const addCodemodRow = () => setCodemods((prev) => [...prev, { filePath: "", find: "", replace: "", useRegex: false }]);
  const removeCodemodRow = (idx) => setCodemods((prev) => prev.filter((_, i) => i !== idx));

  const submit = async () => {
    setError(null);

    if (mode === "pr" && !newBranchName.trim()) {
      setError("Branch name is required when opening a PR.");
      return;
    }

    let payload = { repoId, mode, baseBranch, newBranchName: mode === "pr" ? newBranchName.trim() : undefined, commitMessage: commitMessage.trim(), fixMode };

    if (fixMode === "ai") {
      const filePaths = Array.from(selectedFiles).filter(Boolean);
      if (filePaths.length === 0) {
        setError("Select at least one file for Gemini to look at.");
        return;
      }
      payload.filePaths = filePaths;
    } else {
      const validCodemods = codemods.filter((c) => c.filePath.trim() && c.find.trim());
      if (validCodemods.length === 0) {
        setError("Add at least one file path and find pattern.");
        return;
      }
      payload.codemods = validCodemods;
    }

    setSubmitting(true);
    try {
      await onSubmit(payload);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal title="Apply fix to a real repo" onClose={onClose} wide>
      <div className="space-y-4">
        {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}

        <div>
          <label className="text-xs font-medium text-gray-600">Repository</label>
          <select value={repoId} onChange={(e) => setRepoId(e.target.value)} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
            {repos.map((r) => <option key={r.id} value={r.id}>{r.repoName}</option>)}
          </select>
          {repos.length === 0 && <p className="text-xs text-amber-600 mt-1">No linked repo for this provider yet — add one in Providers first.</p>}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-gray-600">Base branch {loadingBranches && "(loading…)"}</label>
            <select value={baseBranch} onChange={(e) => setBaseBranch(e.target.value)} disabled={loadingBranches}
              className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
              {branches.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">Mode</label>
            <select value={mode} onChange={(e) => setMode(e.target.value)} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
              <option value="pr">Create new branch + open PR</option>
              <option value="direct">Commit directly to this branch</option>
            </select>
          </div>
        </div>

        {mode === "pr" && (
          <div>
            <label className="text-xs font-medium text-gray-600">New branch name</label>
            <input value={newBranchName} onChange={(e) => setNewBranchName(e.target.value)} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono" />
          </div>
        )}

        <div>
          <label className="text-xs font-medium text-gray-600">Commit message</label>
          <input value={commitMessage} onChange={(e) => setCommitMessage(e.target.value)} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        </div>

        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">How should the fix be written?</label>
          <div className="flex gap-2">
            <button onClick={() => setFixMode("ai")} className={`flex-1 text-sm px-3 py-2 rounded-lg border ${fixMode === "ai" ? "border-gray-900 bg-gray-50 font-medium" : "border-gray-200 text-gray-600"}`}>
              Let Gemini rewrite affected files
            </button>
            <button onClick={() => setFixMode("manual")} className={`flex-1 text-sm px-3 py-2 rounded-lg border ${fixMode === "manual" ? "border-gray-900 bg-gray-50 font-medium" : "border-gray-200 text-gray-600"}`}>
              I'll write the find/replace myself
            </button>
          </div>
        </div>

        {fixMode === "ai" ? (
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">
              Files Gemini may look at — only ones it decides actually need a change get modified and committed
            </label>
            <div className="space-y-1 border border-gray-200 rounded-lg p-2">
              {allFiles.length === 0 && <div className="text-xs text-gray-400 px-2 py-1">No affected files recorded on this change.</div>}
              {allFiles.map((f) => (
                <label key={f} className="flex items-center gap-2 text-xs font-mono px-2 py-1 hover:bg-gray-50 rounded">
                  <input type="checkbox" checked={selectedFiles.has(f)} onChange={() => toggleFile(f)} />
                  {f}
                </label>
              ))}
            </div>
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-gray-600">Code changes (find → replace)</label>
              <button onClick={addCodemodRow} className="text-xs text-gray-600 hover:text-gray-900 flex items-center gap-1">
                <Icon path={icons.plus} className="w-3 h-3" /> Add file
              </button>
            </div>
            <div className="space-y-3">
              {codemods.map((cm, idx) => (
                <div key={idx} className="border border-gray-200 rounded-lg p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <input value={cm.filePath} onChange={(e) => updateCodemod(idx, "filePath", e.target.value)} placeholder="path/relative/to/repo/root.js"
                      className="flex-1 border border-gray-300 rounded-lg px-2 py-1.5 text-xs font-mono" />
                    <label className="flex items-center gap-1 text-xs text-gray-500 shrink-0">
                      <input type="checkbox" checked={cm.useRegex} onChange={(e) => updateCodemod(idx, "useRegex", e.target.checked)} /> regex
                    </label>
                    <button onClick={() => removeCodemodRow(idx)} className="text-gray-400 hover:text-red-500 shrink-0"><Icon path={icons.x} className="w-4 h-4" /></button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <textarea value={cm.find} onChange={(e) => updateCodemod(idx, "find", e.target.value)} placeholder="find this exact text (or regex)" rows={2}
                      className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs font-mono" />
                    <textarea value={cm.replace} onChange={(e) => updateCodemod(idx, "replace", e.target.value)} placeholder="replace with this" rows={2}
                      className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs font-mono" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <button onClick={submit} disabled={submitting || !repoId} className="bg-gray-900 text-white text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-50">
            {submitting ? (fixMode === "ai" ? "Gemini is writing the fix…" : "Pushing to GitHub…") : mode === "pr" ? "Commit & open PR" : "Commit to branch"}
          </button>
          <button onClick={onClose} className="text-gray-600 text-sm font-medium px-4 py-2 rounded-lg hover:bg-gray-100">Cancel</button>
        </div>
      </div>
    </Modal>
  );
};

// ---------------------------------------------------------------------------
// Changes view (no "suggest pattern" button — that flow is gone)
// ---------------------------------------------------------------------------
const ChangeDetail = ({ change, onOpenGenerate, hasPR, onDelete, onIgnore }) => (
  <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
    <div className="flex items-start justify-between">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Badge tone={typeTone[change.type]}>{change.type}</Badge>
          <Badge tone={severityTone[change.severity]}>{change.severity} severity</Badge>
        </div>
        <h3 className="font-semibold text-gray-900">{change.title}</h3>
        <p className="text-sm text-gray-500 mt-1">{change.providerName} · detected {change.detectedAt}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {!hasPR ? (
          <button onClick={onOpenGenerate} className="flex items-center gap-2 bg-gray-900 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-gray-800">
            <Icon path={icons.bolt} className="w-4 h-4" /> Apply fix
          </button>
        ) : (
          <span className="flex items-center gap-1.5 text-emerald-600 text-sm font-medium">
            <Icon path={icons.check} className="w-4 h-4" /> Applied
          </span>
        )}
        {!hasPR && change.status === "pending" && (
          <button onClick={onIgnore} className="text-gray-600 text-sm font-medium px-3 py-2 rounded-lg hover:bg-gray-100">Skip</button>
        )}
        <button onClick={onDelete} title="Delete this change" className="text-gray-300 hover:text-red-500 transition p-2">
          <Icon path={icons.x} className="w-4 h-4" />
        </button>
      </div>
    </div>
    <p className="text-sm text-gray-700 leading-relaxed">{change.description}</p>
    <div>
      <div className="text-xs font-medium text-gray-500 mb-2">Affected in your codebase</div>
      {(!change.affectedRepos || change.affectedRepos.length === 0) && <div className="text-xs text-gray-400">No affected files recorded.</div>}
      <div className="space-y-2">
        {(change.affectedRepos || []).map((r) => (
          <div key={r.repo} className="border border-gray-100 rounded-lg p-3">
            <div className="text-sm font-medium text-gray-800 mb-1">{r.repo}</div>
            {(r.files || []).map((f) => (
              <div key={f} className="flex items-center gap-1.5 text-xs text-gray-500 pl-1"><Icon path={icons.file} className="w-3.5 h-3.5" /> {f}</div>
            ))}
          </div>
        ))}
      </div>
    </div>
  </div>
);

const ChangesView = ({ changes, prs, providers, onGeneratePR, onDeleteChange, onIgnoreChange, onDeleteAllChanges }) => {
  const [filter, setFilter] = useState("all");
  const [selectedId, setSelectedId] = useState(null);
  const [generateModalChange, setGenerateModalChange] = useState(null);
  const [confirmDeleteChange, setConfirmDeleteChange] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const filtered = useMemo(() => (filter === "all" ? changes : changes.filter((c) => c.type === filter)), [changes, filter]);
  const selected = filtered.find((c) => c.id === selectedId) ?? filtered[0] ?? null;
  const hasPR = (changeId) => prs.some((p) => p.changeId === changeId);

  const reposForChange = (change) => {
    const provider = providers.find((p) => p.id === change.providerId);
    return provider ? provider.watching.filter((r) => r.repoUrl) : [];
  };

  const confirmAndDelete = async () => {
    setDeleting(true);
    try {
      await onDeleteChange(confirmDeleteChange.id);
      if (selectedId === confirmDeleteChange.id) setSelectedId(null);
      setConfirmDeleteChange(null);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Detected changes</h1>
            <p className="text-sm text-gray-500 mt-1">Every change found across your tracked providers.</p>
          </div>
          {changes.length > 0 && (
            <button onClick={onDeleteAllChanges} className="text-sm font-medium text-red-600 border border-red-200 px-3 py-2 rounded-lg hover:bg-red-50">
              Delete all changes
            </button>
          )}
        </div>
      </div>
      <div className="flex gap-2">
        {["all", "breaking", "deprecation", "feature"].map((t) => (
          <button key={t} onClick={() => setFilter(t)}
            className={`text-xs font-medium px-3 py-1.5 rounded-full border ${filter === t ? "bg-gray-900 text-white border-gray-900" : "text-gray-600 border-gray-200 hover:bg-gray-50"}`}>{t}</button>
        ))}
      </div>
      {filtered.length === 0 ? (
        <div className="text-sm text-gray-400 bg-white border border-dashed border-gray-200 rounded-xl p-8 text-center">No changes match this filter.</div>
      ) : (
        <div className="grid grid-cols-[280px_1fr] gap-5">
          <div className="space-y-2">
            {filtered.map((c) => (
              <div key={c.id}
                className={`group relative rounded-lg border text-sm ${selected?.id === c.id ? "border-gray-900 bg-gray-50" : "border-gray-200 bg-white hover:bg-gray-50"}`}>
                <button onClick={() => setSelectedId(c.id)} className="w-full text-left p-3 pr-8">
                  <div className="flex items-center gap-2 mb-1"><Badge tone={typeTone[c.type]}>{c.type}</Badge></div>
                  <div className="font-medium text-gray-800 line-clamp-2">{c.title}</div>
                  <div className="text-xs text-gray-400 mt-1">{c.providerName}</div>
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setConfirmDeleteChange(c); }}
                  title="Delete this change"
                  className="absolute top-2 right-2 text-gray-300 hover:text-red-500 transition opacity-0 group-hover:opacity-100"
                >
                  <Icon path={icons.x} className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
          {selected && (
            <ChangeDetail
              change={selected}
              hasPR={hasPR(selected.id)}
              onOpenGenerate={() => setGenerateModalChange(selected)}
              onDelete={() => setConfirmDeleteChange(selected)}
              onIgnore={() => onIgnoreChange(selected.id)}
            />
          )}
        </div>
      )}

      {generateModalChange && (
        <GeneratePRModal
          change={generateModalChange}
          repos={reposForChange(generateModalChange)}
          onClose={() => setGenerateModalChange(null)}
          onSubmit={(payload) => onGeneratePR(generateModalChange.id, payload)}
        />
      )}

      {confirmDeleteChange && (
        <Modal title="Delete this change?" onClose={() => setConfirmDeleteChange(null)}>
          <p className="text-sm text-gray-600">
            This removes <strong>{confirmDeleteChange.title}</strong> and its affected-file records from APISentry.
            {hasPR(confirmDeleteChange.id) && (
              <> This change has a linked pull request/commit record — deleting the change also removes that local
              record, but <strong>does not close or delete the actual PR on GitHub</strong> if one was opened.</>
            )}
          </p>
          <div className="flex gap-2 mt-4">
            <button onClick={confirmAndDelete} disabled={deleting} className="bg-red-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-red-700 disabled:opacity-50">
              {deleting ? "Deleting…" : "Delete change"}
            </button>
            <button onClick={() => setConfirmDeleteChange(null)} className="text-gray-600 text-sm font-medium px-4 py-2 rounded-lg hover:bg-gray-100">Cancel</button>
          </div>
        </Modal>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// PRs view
// ---------------------------------------------------------------------------
const PRsView = ({ prs }) => (
  <div className="space-y-6">
    <div><h1 className="text-xl font-semibold text-gray-900">Pull requests</h1>
      <p className="text-sm text-gray-500 mt-1">Real commits and PRs pushed to your repos.</p></div>
    {prs.length === 0 && <div className="text-sm text-gray-400 bg-white border border-dashed border-gray-200 rounded-xl p-8 text-center">Nothing pushed yet — scan a provider or apply a fix from the Changes tab.</div>}
    <div className="space-y-3">
      {prs.map((pr) => (
        <div key={pr.id} className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Badge tone={pr.status === "open" ? "blue" : pr.status === "committed" ? "indigo" : "green"}>{pr.status}</Badge>
                <span className="text-xs text-gray-400">{pr.repo} · {pr.branch}{pr.baseBranch ? ` → ${pr.baseBranch}` : ""}</span>
              </div>
              <div className="font-medium text-gray-900 text-sm">{pr.title}</div>
              <div className="text-xs text-gray-400 mt-1">{pr.filesChanged} file(s) changed · {pr.createdAt}</div>
            </div>
            {pr.prUrl ? (
              <a href={pr.prUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-indigo-600 hover:underline shrink-0">
                View on GitHub <Icon path={icons.external} className="w-3.5 h-3.5" />
              </a>
            ) : (
              <Icon path={icons.arrow} className="w-4 h-4 text-gray-300 mt-1" />
            )}
          </div>
          <pre className="mt-3 bg-gray-900 text-gray-100 text-xs rounded-lg p-3 overflow-x-auto whitespace-pre-wrap">{pr.diff}</pre>
        </div>
      ))}
    </div>
  </div>
);

// ---------------------------------------------------------------------------
// Settings view
// ---------------------------------------------------------------------------
const SettingsView = ({ githubStatus, refreshGithubStatus }) => {
  const [token, setToken] = useState("");
  const [geminiKey, setGeminiKey] = useState(() => localStorage.getItem("geminiApiKey") || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const connect = async () => {
    if (!token.trim()) return;
    setBusy(true); setError(null);
    try {
      await api.connectGithub(token.trim());
      setToken("");
      await refreshGithubStatus();
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-6 max-w-xl">
      <div><h1 className="text-xl font-semibold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500 mt-1">Connect the GitHub account this agent will commit and open PRs as.</p></div>
      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
        {githubStatus?.connected ? (
          <div className="flex items-center gap-3">
            <img src={githubStatus.avatarUrl} alt="" className="w-10 h-10 rounded-full" />
            <div>
              <div className="text-sm font-medium text-gray-900">Connected as @{githubStatus.username}</div>
              <div className="text-xs text-gray-500">Real commits and PRs will be attributed to this account.</div>
            </div>
          </div>
        ) : (
          <div>
            {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">{error}</div>}
            <label className="text-xs font-medium text-gray-600">Personal access token</label>
            <p className="text-xs text-gray-400 mb-1">Needs `repo` scope (classic) or Contents + Pull requests read/write (fine-grained). Create one at github.com/settings/tokens.</p>
            <div className="flex gap-2">
              <input type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder="ghp_…"
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono" />
              <button onClick={connect} disabled={busy} className="bg-gray-900 text-white text-sm font-medium px-4 py-2 rounded-lg whitespace-nowrap disabled:opacity-50">
                {busy ? "Connecting…" : "Connect GitHub"}
              </button>
            </div>
          </div>
        )}
      </div>
      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
        <div>
          <div className="text-sm font-medium text-gray-900">Gemini API key</div>
          <p className="text-xs text-gray-500 mt-1">Used for AI changelog classification, compatibility scans, and fixes. Stored only in this browser.</p>
        </div>
        <div className="flex gap-2">
          <input type="password" value={geminiKey} onChange={(e) => setGeminiKey(e.target.value)} placeholder="AIza…"
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono" />
          <button onClick={() => { localStorage.setItem("geminiApiKey", geminiKey.trim()); setGeminiKey(geminiKey.trim()); }}
            className="bg-gray-900 text-white text-sm font-medium px-4 py-2 rounded-lg whitespace-nowrap">Save key</button>
        </div>
      </div>
    </div>
  );
};

const GeminiKeyModal = ({ onSave, onSkip }) => {
  const [key, setKey] = useState("");
  return (
    <Modal title="Connect Gemini" onClose={onSkip}>
      <div className="space-y-4">
        <p className="text-sm text-gray-600">Add your Gemini API key to enable AI-powered changelog analysis and compatibility fixes. It stays in this browser and is sent securely with requests.</p>
        <input autoFocus type="password" value={key} onChange={(e) => setKey(e.target.value)} placeholder="AIza…"
          onKeyDown={(e) => e.key === "Enter" && key.trim() && onSave(key.trim())}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono" />
        <div className="flex justify-end gap-2">
          <button onClick={onSkip} className="text-sm text-gray-500 px-3 py-2">Skip for now</button>
          <button onClick={() => key.trim() && onSave(key.trim())} disabled={!key.trim()}
            className="bg-gray-900 text-white text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-50">Use Gemini</button>
        </div>
      </div>
    </Modal>
  );
};

// ---------------------------------------------------------------------------
// Root App
// ---------------------------------------------------------------------------
export default function App() {
  const [active, setActive] = useState("dashboard");
  const [providers, setProviders] = useState([]);
  const [changes, setChanges] = useState([]);
  const [prs, setPrs] = useState([]);
  const [githubStatus, setGithubStatus] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [scanStage, setScanStage] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [scanInfo, setScanInfo] = useState(null);
  const [showGeminiPrompt, setShowGeminiPrompt] = useState(() => !localStorage.getItem("geminiApiKey") && !sessionStorage.getItem("geminiPromptSkipped"));

  // Holds pending auto-fix findings after a scan, so the review modal can
  // render at the App level regardless of which tab is active.
  const [autoFixReview, setAutoFixReview] = useState(null); // { providerName, repoId, branch, findings } | null

  const loadAll = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [p, c, r, gh] = await Promise.all([api.getProviders(), api.getChanges(), api.getPRs(), api.getGithubStatus()]);
      setProviders((p || []).map(normalizeProvider));
      setChanges((c || []).map(normalizeChange));
      setPrs((r || []).map(normalizePR));
      setGithubStatus(gh);
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const refreshGithubStatus = async () => setGithubStatus(await api.getGithubStatus());

  const counts = {
    providers: providers.length,
    pendingChanges: changes.filter((c) => c.status === "pending").length,
    openPRs: prs.filter((p) => p.status === "open").length,
  };

  const addProvider = async (data) => {
    const provider = await api.createProvider(data);
    await loadAll();
    return provider;
  };

  const addRepo = async (providerId, data) => {
    await api.addRepo(providerId, data);
    await loadAll();
  };

  const deleteProvider = async (providerId) => {
    await api.deleteProvider(providerId);
    await loadAll();
  };

  const deleteRepo = async (providerId, repoId) => {
    await api.deleteRepo(providerId, repoId);
    await loadAll();
  };

  const deleteChange = async (changeId) => {
    await api.deleteChange(changeId);
    setChanges((prev) => prev.filter((c) => c.id !== changeId));
    setPrs((prev) => prev.filter((p) => p.changeId !== changeId));
  };

  // The single scan flow: detect changes from the provider's changelog/docs,
  // then — if a linked repo exists — automatically diff that repo's real
  // code against the known changes and open a review modal if anything
  // needs fixing. Nothing is committed until the user approves.
  const simulateScan = async (providerId) => {
  if (!providerId) return;
  setScanning(true); setError(null); setAutoFixReview(null); setScanInfo(null);

  const info = { stage1: null, stage2: null };

  // Stage 1: check the provider's own changelog/docs for new entries.
  // This has NOTHING to do with your repo's code — it only compares
  // Razorpay's page now vs. last time you scanned it.
  try {
    setScanStage("Checking Razorpay's changelog…");
    const result = await api.triggerScan(providerId);
    if (result?.changeCreated === false) {
      info.stage1 = result.message || "No new provider changes found.";
    } else {
      const detectedCount = result.entriesProcessed || result.changes?.length || 1;
      info.stage1 = `${detectedCount} new provider change${detectedCount === 1 ? "" : "s"} detected.`;
    }
    setChanges((await api.getChanges()).map(normalizeChange));
  } catch (err) {
    info.stage1 = `Changelog check failed: ${err.message}`;
  }

  // Stage 2: check YOUR repo's actual code against every known change on
  // record for this provider (not just ones found in stage 1 — all of them).
  // Wrapped in its own try/catch so a failure here never masks stage 1.
  const provider = providers.find((p) => p.id === providerId);
  const repo = provider?.watching.find((r) => r.repoUrl);

  if (!repo) {
    info.stage2 = "No linked GitHub repo — skipped code check. Link one from the Providers tab.";
  } else {
    try {
      setScanStage("Checking your repo's code…");
      const scanResult = await api.runAutoComplianceScan(providerId, repo.id, repo.defaultBranch);
      setChanges((await api.getChanges()).map(normalizeChange));
      if (scanResult.findings && scanResult.findings.length > 0) {
        info.stage2 = `Found ${scanResult.findings.length} file(s) that may need updating — review below.`;
        setAutoFixReview({
          providerName: provider.name, repoId: repo.id, branch: repo.defaultBranch,
          findings: scanResult.findings,
        });
      } else {
        info.stage2 = scanResult.message || "Repo checked — nothing needed updating.";
      }
    } catch (err) {
      info.stage2 = `Repo check failed: ${err.message}`;
    }
  }

  setScanInfo(info);
  setScanning(false);
  setScanStage("");
};

  const refreshAfterAutoFix = async () => {
    const [c, r] = await Promise.all([api.getChanges(), api.getPRs()]);
    setChanges(c.map(normalizeChange));
    setPrs(r.map(normalizePR));
  };

  const generatePR = async (changeId, payload) => {
    const pr = await api.generatePR(changeId, payload);
    setPrs((prev) => [normalizePR(pr), ...prev]);
    setChanges((prev) => prev.map((c) => (c.id === changeId ? { ...c, status: pr.status === "open" ? "pr_created" : "committed" } : c)));
    setActive("prs");
  };

  const ignoreChange = async (changeId) => {
    await api.ignoreChange(changeId);
    setChanges((prev) => prev.map((change) => change.id === changeId ? { ...change, status: "ignored" } : change));
  };

  const deleteAllChanges = async () => {
    if (!window.confirm("Delete all detected changes? This cannot be undone.")) return;
    await api.deleteAllChanges();
    setChanges([]);
    setPrs([]);
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400 text-sm">Loading…</div>;

  return (
    <div className="flex bg-gray-50 min-h-screen font-sans text-gray-900">
      <Sidebar active={active} setActive={setActive} counts={counts} githubStatus={githubStatus} />
      <main className="flex-1 p-8 overflow-y-auto">
        {error && (
          <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2 flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600"><Icon path={icons.x} className="w-4 h-4" /></button>
          </div>
        )}
        {active === "dashboard" && (
  <DashboardView providers={providers} changes={changes} prs={prs} onScan={simulateScan} scanning={scanning} scanStage={scanStage} scanInfo={scanInfo} />
)}
        {active === "providers" && (
          <ProvidersView providers={providers} addProvider={addProvider} addRepo={addRepo} deleteProvider={deleteProvider} deleteRepo={deleteRepo} />
        )}
        {active === "changes" && (
          <ChangesView changes={changes} prs={prs} providers={providers} onGeneratePR={generatePR} onDeleteChange={deleteChange} onIgnoreChange={ignoreChange} onDeleteAllChanges={deleteAllChanges} />
        )}
        {active === "prs" && <PRsView prs={prs} />}
        {active === "settings" && <SettingsView githubStatus={githubStatus} refreshGithubStatus={refreshGithubStatus} />}
      </main>

      {autoFixReview && (
        <AutoFixReviewModal
          providerName={autoFixReview.providerName}
          repoId={autoFixReview.repoId}
          branch={autoFixReview.branch}
          findings={autoFixReview.findings}
          onClose={() => setAutoFixReview(null)}
          onCommitted={refreshAfterAutoFix}
        />
      )}
      {showGeminiPrompt && (
        <GeminiKeyModal
          onSave={(key) => { localStorage.setItem("geminiApiKey", key); setShowGeminiPrompt(false); }}
          onSkip={() => { sessionStorage.setItem("geminiPromptSkipped", "1"); setShowGeminiPrompt(false); }}
        />
      )}
    </div>
  );
}