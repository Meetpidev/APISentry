import { ProviderModel } from "../models/Provider.js";
import { ChangeModel } from "../models/Change.js";
import { DocSnapshotModel } from "../models/DocSnapshot.js";
import { ChangelogEntryModel } from "../models/ChangelogEntry.js";
import { classifyText } from "../services/geminiClassifierService.js";
import { fetchDocsText } from "../services/docScraperService.js";
import { diffDocs } from "../services/docDiffService.js";
import { parseChangelogEntries } from "../services/changelogParserService.js";

const MAX_ENTRIES_ON_FIRST_IMPORT = 5; // cap so a first scan doesn't dump 40 changes at once

export async function triggerScan(req, res) {
  const { providerId, rawChangelogText, affectedFiles = [] } = req.body;

  const provider = await ProviderModel.findById(providerId);
  if (!provider) return res.status(404).json({ error: "Provider not found" });

  if (rawChangelogText && rawChangelogText.trim()) {
    return handleManualText(provider, rawChangelogText.trim(), affectedFiles, req.geminiApiKey, res);
  }
  if (provider.changelog_url) {
    return handleChangelogUrl(provider, affectedFiles, req.geminiApiKey, res);
  }
  if (provider.docs_url) {
    return handleDocsUrl(provider, affectedFiles, req.geminiApiKey, res);
  }
  return res.status(400).json({
    error: "This provider has no changelog_url or docs_url configured.",
  });
}

async function handleManualText(provider, text, affectedFiles, apiKey, res) {
  const classified = await classifyText(text, apiKey);
  const change = await createChangeRecord(provider.id, classified, affectedFiles, "manual");
  await ProviderModel.touchLastChecked(provider.id);
  res.status(201).json(change);
}

// Entry-level tracking: real content, no page-diff dependency. On a
// provider's first-ever scan, the most recent real entries are imported
// and surfaced as changes to review (clearly labeled as such) — not
// fabricated, just genuinely new to your system even if old to the provider.
async function handleChangelogUrl(provider, affectedFiles, apiKey, res) {
  const { text } = await fetchDocsText(provider.changelog_url);
  const entries = parseChangelogEntries(text);

  const seenHashes = await ChangelogEntryModel.getSeenHashes(provider.id);
  const isFirstScan = seenHashes.size === 0;

  const newEntries = entries.filter((e) => !seenHashes.has(e.hash));

  await ChangelogEntryModel.recordSeen(provider.id, entries);
  await ProviderModel.touchLastChecked(provider.id);

  if (newEntries.length === 0) {
    return res.status(200).json({
      message: `Changelog checked (${provider.changelog_url}) — no new entries since last scan.`,
      changeCreated: false,
      sourceChecked: "changelog_url",
    });
  }

  const toProcess = isFirstScan ? newEntries.slice(0, MAX_ENTRIES_ON_FIRST_IMPORT) : newEntries;
  const created = [];

  for (const entry of toProcess) {
    const classified = await classifyText(entry.text, apiKey);
    const labelPrefix = isFirstScan ? " " : "";
    const change = await createChangeRecord(
      provider.id,
      { ...classified, description: labelPrefix + classified.description },
      affectedFiles,
      "changelog"
    );
    created.push(change);
  }

  res.status(201).json({
    changeCreated: true,
    isFirstScan,
    entriesFound: newEntries.length,
    entriesProcessed: toProcess.length,
    changes: created,
  });
}

async function handleDocsUrl(provider, affectedFiles, apiKey, res) {
  const { text: currentText, hash: currentHash, fetchedVia } = await fetchDocsText(provider.docs_url);
  const previous = await DocSnapshotModel.getLatest(provider.id, "docs");

  await DocSnapshotModel.create(provider.id, { contentHash: currentHash, contentText: currentText, fetchedVia, sourceType: "docs" });
  await ProviderModel.touchLastChecked(provider.id);

  if (!previous) {
    return res.status(200).json({
      message: "First scan of this docs page — baseline stored. Future scans will detect real changes against it.",
      changeCreated: false,
      sourceChecked: "docs_url",
    });
  }
  if (previous.content_hash === currentHash) {
    return res.status(200).json({
      message: `Docs checked (${provider.docs_url}) — no changes since last scan.`,
      changeCreated: false,
      sourceChecked: "docs_url",
    });
  }

  const diffText = diffDocs(previous.content_text, currentText);
  const classified = await classifyText(diffText, apiKey);
  const change = await createChangeRecord(provider.id, classified, affectedFiles, "docs_diff");
  res.status(201).json(change);
}

async function createChangeRecord(providerId, classified, affectedFiles, detectionSource) {
  return ChangeModel.create({
    providerId,
    type: classified.type,
    title: classified.title,
    description: classified.description,
    severity: classified.severity,
    affectedFiles,
    detectionSource,
    classificationMethod: classified.method,
  });
}