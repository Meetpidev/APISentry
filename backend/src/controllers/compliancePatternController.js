import { CompliancePatternModel } from "../models/CompliancePattern.js";
import { ChangeModel } from "../models/Change.js";
import { suggestPatternFromChange } from "../services/geminiPatternService.js";

export async function listPatterns(req, res) {
  const { providerId } = req.params;
  res.json(await CompliancePatternModel.findByProvider(providerId));
}

// Manual: you write the pattern yourself
export async function createPattern(req, res) {
  const { providerId } = req.params;
  const { pattern, isRegex, title, description, severity, type } = req.body;

  const created = await CompliancePatternModel.create({
    providerId, pattern, isRegex: isRegex !== false, title, description,
    severity: severity || "medium", type: type || "deprecation", source: "manual",
  });
  res.status(201).json(created);
}

// AI-assisted: derive a pattern from an existing detected change, so you
// don't have to write regex by hand every time a change comes in.
export async function suggestPatternForChange(req, res) {
  const { changeId } = req.params;
  const change = await ChangeModel.findById(changeId);
  if (!change) return res.status(404).json({ error: "Change not found" });

  const suggested = await suggestPatternFromChange({
    title: change.title, description: change.description, type: change.type, requestApiKey: req.geminiApiKey,
  });

  if (!suggested) {
    return res.status(200).json({ suggested: null, message: "Gemini couldn't derive a reliable code pattern from this change — write one manually, or this change may not be code-facing." });
  }

  res.status(200).json({ suggested, changeId: change.id, providerId: change.provider_id });
}

export async function deletePattern(req, res) {
  const { patternId } = req.params;
  const deleted = await CompliancePatternModel.delete(patternId);
  if (!deleted) return res.status(404).json({ error: "Pattern not found" });
  res.status(200).json({ deleted: true, id: patternId });
}