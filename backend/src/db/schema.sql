-- Run this once against your Neon database to set up tables.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  initial TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT 'bg-slate-500',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('connected', 'pending', 'error')),
  changelog_url TEXT,
  last_checked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS watched_repos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  repo_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('breaking', 'deprecation', 'feature')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('high', 'medium', 'low')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'pr_created', 'ignored')),
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS change_affected_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  change_id UUID NOT NULL REFERENCES changes(id) ON DELETE CASCADE,
  repo_name TEXT NOT NULL,
  file_path TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS pull_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  change_id UUID NOT NULL REFERENCES changes(id) ON DELETE CASCADE,
  repo TEXT NOT NULL,
  title TEXT NOT NULL,
  branch TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'merged', 'closed')),
  files_changed INT NOT NULL DEFAULT 0,
  diff TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_changes_provider ON changes(provider_id);
CREATE INDEX IF NOT EXISTS idx_prs_change ON pull_requests(change_id);
CREATE INDEX IF NOT EXISTS idx_affected_change ON change_affected_files(change_id);

-- Run against your existing database — these are additive migrations.

ALTER TABLE watched_repos ADD COLUMN IF NOT EXISTS repo_url TEXT;
ALTER TABLE watched_repos ADD COLUMN IF NOT EXISTS default_branch TEXT NOT NULL DEFAULT 'main';

ALTER TABLE pull_requests ADD COLUMN IF NOT EXISTS pr_number INT;
ALTER TABLE pull_requests ADD COLUMN IF NOT EXISTS pr_url TEXT;
ALTER TABLE pull_requests ADD COLUMN IF NOT EXISTS base_branch TEXT;

ALTER TABLE pull_requests DROP CONSTRAINT IF EXISTS pull_requests_status_check;
ALTER TABLE pull_requests ADD CONSTRAINT pull_requests_status_check
  CHECK (status IN ('open', 'merged', 'closed', 'committed'));

ALTER TABLE changes DROP CONSTRAINT IF EXISTS changes_status_check;
ALTER TABLE changes ADD CONSTRAINT changes_status_check
  CHECK (status IN ('pending', 'pr_created', 'committed', 'ignored'));

CREATE TABLE IF NOT EXISTS github_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT NOT NULL,
  username TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE providers ADD COLUMN IF NOT EXISTS docs_url TEXT;
ALTER TABLE providers ADD COLUMN IF NOT EXISTS spec_url TEXT;

ALTER TABLE changes ADD COLUMN IF NOT EXISTS detection_source TEXT NOT NULL DEFAULT 'manual';
ALTER TABLE changes ADD COLUMN IF NOT EXISTS classification_method TEXT NOT NULL DEFAULT 'heuristic';

ALTER TABLE pull_requests ADD COLUMN IF NOT EXISTS fix_mode TEXT NOT NULL DEFAULT 'manual';

CREATE TABLE IF NOT EXISTS provider_doc_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  content_hash TEXT NOT NULL,
  content_text TEXT NOT NULL,
  fetched_via TEXT NOT NULL DEFAULT 'fetch' CHECK (fetched_via IN ('fetch', 'headless_browser')),
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_doc_snapshots_provider_fetched
  ON provider_doc_snapshots(provider_id, fetched_at DESC);

ALTER TABLE provider_doc_snapshots ADD COLUMN IF NOT EXISTS source_type TEXT NOT NULL DEFAULT 'docs'
  CHECK (source_type IN ('docs', 'changelog'));

-- Existing index still works, but a scoped one helps if you have both types per provider
CREATE INDEX IF NOT EXISTS idx_doc_snapshots_provider_source_fetched
  ON provider_doc_snapshots(provider_id, source_type, fetched_at DESC);  

CREATE TABLE IF NOT EXISTS changelog_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  entry_hash TEXT NOT NULL,
  entry_text TEXT NOT NULL,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider_id, entry_hash)
);

CREATE INDEX IF NOT EXISTS idx_changelog_entries_provider ON changelog_entries(provider_id);  

CREATE TABLE IF NOT EXISTS compliance_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  change_id UUID REFERENCES changes(id) ON DELETE SET NULL, -- optional: which change this pattern was derived from
  pattern TEXT NOT NULL,
  is_regex BOOLEAN NOT NULL DEFAULT true,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('high', 'medium', 'low')),
  type TEXT NOT NULL DEFAULT 'deprecation' CHECK (type IN ('breaking', 'deprecation', 'feature')),
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'gemini_generated')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_compliance_patterns_provider ON compliance_patterns(provider_id);

ALTER TABLE pull_requests ALTER COLUMN change_id DROP NOT NULL;