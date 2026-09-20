# APISentry

**Autonomous API-change monitoring and remediation for engineering teams.**

APISentry watches the third-party APIs your codebase depends on, detects when
a provider changes something that could break your integration, and — with
your review — writes the fix, commits it, and opens a pull request. It's
built for the gap between "an API vendor silently changed something" and
"your CI/CD or production traffic finds out the hard way."

> Industry category: **DevOps / Software Supply Chain Security** — the same
> space as Dependabot and Renovate, but for API *contracts* (endpoints,
> params, response shapes, auth requirements) rather than package versions.

---

## Why this exists

Breaking API changes ship with little warning. Useful new features launch
and go unnoticed. Changelogs don't get read — and a meaningful share of
unplanned production incidents trace back to an external API or package
changing underneath a team without anyone noticing in time.

Agentic coding tools have proven that teams are willing to grant an
automated agent access to a codebase when it's genuinely useful. APISentry
applies that same idea to the provider side of API integrations: instead of
a vendor just *announcing* a change, an agent scans for where it's used and
proposes the fix.

---

## How it detects a change

Not every API provider publishes the same kind of signal, so APISentry
checks multiple sources, roughly in order of reliability:

| Source | How it works | Works even with no changelog? |
|---|---|---|
| **Manual scan text** | You paste/trigger a scan with raw changelog text directly | — |
| **Docs page diff** | Snapshots a provider's documentation page (via a real headless browser for JS-rendered sites, so client-side-rendered docs are actually seen) and diffs it against the last snapshot, filtering out timestamp/pagination/cookie-banner noise before diffing | ✅ Yes — this is the fallback of last resort |

Detected text — whether from a changelog or a docs diff — is classified by:

1. **Gemini (if `GEMINI_API_KEY` is set)** — reads the text for actual
   meaning, so prose like *"we simplified the auth flow"* can be correctly
   flagged as breaking even with no explicit trigger words.
2. **Heuristic keyword matching (always available, no key required)** — looks
   for vocabulary like `"breaking change"`, `"deprecated"`, `"no longer"` as
   a zero-dependency fallback.

Every detected change records which source found it and which method
classified it, so you can see at a glance whether a given entry is a
high-confidence AI read of a docs diff or a keyword-matched guess.

---

## How it fixes a change

Once a change is detected and you choose to act on it, APISentry:

1. Clones the real linked GitHub repository at the branch you pick.
2. Applies a fix to real files, using one of two modes:
   - **AI mode** — sends each affected file's current content to Gemini
     along with the change description, and only writes back files Gemini
     determines actually need editing (minimal, targeted diffs — not a
     full rewrite).
   - **Manual mode** — applies find/replace (plain string or regex) rules
     you supply yourself, for full control.
3. Commits with a real `git commit`, and either:
   - pushes to a **new branch and opens a real GitHub pull request**, or
   - **commits directly** to an existing branch you choose.

Nothing here is simulated — it shells out to the real `git` binary and
calls the real GitHub REST API.

---

## Architecture

APISentry is composed of three layers: detection, classification, and remediation — backed by AWS for deployment, storage, and secrets management.

### Detection Layer

Change signals can come from two sources, in order of reliability:

- **Manual scan text** — a user pastes or triggers a scan with raw changelog text directly.
- **Docs page diff** — a real headless browser snapshots a provider's documentation page (so client-side-rendered docs are actually seen), diffs it against the last snapshot, and filters out timestamp, pagination, and cookie-banner noise before comparing. This is the fallback of last resort, and works even when a provider publishes no changelog at all.

### Classification Layer

Once change text is detected, it's classified using one of two methods:

- **Gemini (if `GEMINI_API_KEY` is set)** — reads the text for actual meaning, so prose like "we simplified the auth flow" can be correctly flagged as breaking even with no explicit trigger words.
- **Heuristic keyword matching (always available, no key required)** — a zero-dependency fallback that looks for vocabulary like "breaking change," "deprecated," or "no longer."

Every detected change records which source found it and which method classified it, so it's always clear whether an entry is a high-confidence AI read or a keyword-matched guess.

### Remediation Engine

Once a change is detected and a user chooses to act on it, APISentry:

1. Clones the real linked GitHub repository at the selected branch.
2. Applies a fix using one of two modes:
   - **AI mode** — sends each affected file's current content to Gemini along with the change description, and only writes back files Gemini determines actually need editing (minimal, targeted diffs, not a full rewrite).
   - **Manual mode** — applies find/replace rules (plain string or regex) supplied by the user, for full control.
3. Commits with a real `git commit`, and either pushes to a new branch and opens a real GitHub pull request, or commits directly to an existing branch.

Nothing here is simulated — it shells out to the real `git` binary and calls the real GitHub REST API.

### AWS Infrastructure

- **Deployment** — the application runs on AWS infrastructure end-to-end.
- **S3** — used for storage, persisting docs snapshots, diff history, and change records so the system retains memory across scans.
- **Secrets Manager** — securely holds API keys and tokens (e.g., the Gemini key and GitHub credentials), keeping credentials out of the codebase.
