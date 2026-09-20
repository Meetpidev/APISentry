import { pool } from "../config/db.js";

export const ProviderModel = {
  async findAll() {
    const { rows } = await pool.query(`
      SELECT p.*,
        COALESCE(json_agg(
          json_build_object(
            'id', w.id, 'repoName', w.repo_name,
            'repoUrl', w.repo_url, 'defaultBranch', w.default_branch
          )
        ) FILTER (WHERE w.id IS NOT NULL), '[]') AS watching
      FROM providers p
      LEFT JOIN watched_repos w ON w.provider_id = p.id
      GROUP BY p.id
      ORDER BY p.created_at DESC
    `);
    return rows;
  },

  async findById(id) {
    const { rows } = await pool.query("SELECT * FROM providers WHERE id = $1", [id]);
    return rows[0] || null;
  },

  async create({ name, slug, initial, color, changelogUrl, docsUrl, specUrl }) {
    const { rows } = await pool.query(
      `INSERT INTO providers (name, slug, initial, color, changelog_url, docs_url, spec_url, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
       RETURNING *`,
      [name, slug, initial, color || "bg-slate-500", changelogUrl || null, docsUrl || null, specUrl || null]
    );
    return rows[0];
  },

  async addWatchedRepo(providerId, { repoName, repoUrl, defaultBranch }) {
    const { rows } = await pool.query(
      `INSERT INTO watched_repos (provider_id, repo_name, repo_url, default_branch)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [providerId, repoName, repoUrl || null, defaultBranch || "main"]
    );
    return rows[0];
  },

  async touchLastChecked(id) {
    await pool.query(
      `UPDATE providers SET last_checked_at = now(), status = 'connected' WHERE id = $1`,
      [id]
    );
  },

  // ON DELETE CASCADE on watched_repos/changes/etc. handles cleanup of
  // everything hanging off this provider (repos, changes, affected files,
  // doc snapshots) — see schema.sql foreign keys.
  async delete(id) {
    const { rows } = await pool.query("DELETE FROM providers WHERE id = $1 RETURNING id", [id]);
    return rows[0] || null;
  },

  async deleteWatchedRepo(providerId, repoId) {
    const { rows } = await pool.query(
      "DELETE FROM watched_repos WHERE id = $1 AND provider_id = $2 RETURNING id",
      [repoId, providerId]
    );
    return rows[0] || null;
  },
};